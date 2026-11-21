import { Subject } from 'rxjs';
import {
  SplitContainerNotFoundError,
  SplitDuplicateContainerError,
  SplitInvalidOptionError,
  SplitNoDefaultContainerError,
  SplitReservedContainerKeyError,
} from '../errors/errors.js';
import {
  SPLIT_BODY_SIDES,
  bodyContainerKey,
  bodySideOf,
  type ContainerState,
  type SplitBodyContainerOptions,
  type SplitBodyContainersConfig,
  type SplitBodySide,
  type SplitContainerOptions,
} from '../model/types.js';
import { validateContainerKey, validateContainerOptions } from '../model/validation.js';
import { SplitContainerStack } from '../stack/split-container-stack.js';

type AnyContainerOptions<THost> = SplitContainerOptions<THost> & SplitBodyContainerOptions<THost>;

/**
 * Record of a container: its configuration, kept by the registry. The runtime fields
 * (`open`, `expanded`, `mounted`, `stack`) are written only by the controller. The engine
 * sees it as a read-only `ContainerState`.
 */
export class ContainerRecord<THost = unknown> implements ContainerState<THost> {
  /** @internal Written by the controller. */
  open = false;
  /** @internal Written by the controller. */
  expanded = false;
  /** @internal Written by the controller. */
  mounted = false;
  /** @internal Created by the controller on the first tab opened or moved to the container. */
  stack: SplitContainerStack | null = null;

  constructor(
    readonly key: string,
    readonly kind: 'custom' | 'body',
    readonly side: SplitBodySide | null,
    readonly host: THost | null,
    public options: Readonly<AnyContainerOptions<THost>>,
  ) {}

  get label(): string {
    return this.options.label ?? this.key;
  }

  get closeWhenEmpty(): boolean {
    return this.options.closeWhenEmpty ?? this.kind === 'body';
  }
}

/** @internal Events the controller listens to. */
export type RegistryEvent<THost> =
  | { type: 'registered'; record: ContainerRecord<THost> }
  | { type: 'removing'; record: ContainerRecord<THost> }
  | { type: 'updated'; record: ContainerRecord<THost> };

/**
 * Configuration of the containers: registered containers, body containers and the default
 * container. It only stores; opening, closing and expanding are done by the controller.
 * The registry never depends on the controller.
 */
export class SplitContainerRegistry<THost = unknown> {
  private readonly containers = new Map<string, ContainerRecord<THost>>();
  private defaultKey: string | null = null;

  /** @internal */
  readonly _events = new Subject<RegistryEvent<THost>>();

  /** Registers a container on a host. Throws for reserved, duplicate or invalid keys. */
  registerContainer(key: string, host: THost, options?: SplitContainerOptions<THost>): void {
    validateContainerKey(key, 'key');
    if (key.startsWith('body-')) throw new SplitReservedContainerKeyError(key);
    if (this.containers.has(key)) throw new SplitDuplicateContainerError(key);
    if (host === null || host === undefined) {
      throw new SplitInvalidOptionError('host', host, 'o elemento host do container');
    }
    validateContainerOptions(options);
    const record = new ContainerRecord(key, 'custom', null, host, { ...options });
    this.containers.set(key, record);
    this._events.next({ type: 'registered', record });
  }

  /** Unregisters a container. Its tabs receive `dismiss('container-removed')`, without `canClose`. */
  unregisterContainer(key: string): void {
    const record = this.containers.get(key);
    if (!record) return;
    if (record.kind === 'body') {
      throw new SplitReservedContainerKeyError(key);
    }
    this.remove(record);
  }

  /**
   * Enables body containers. Without arguments: `{ right: true, default: 'right' }`.
   * A new call replaces the previous config: sides not given are disabled.
   */
  useBodyContainers(config?: SplitBodyContainersConfig<THost>): void {
    const cfg: SplitBodyContainersConfig<THost> = config ?? { right: true, default: 'right' };
    if (cfg === null || typeof cfg !== 'object') {
      throw new SplitInvalidOptionError('useBodyContainers', cfg, 'objeto');
    }
    validateContainerOptions(cfg.defaults, 'defaults.', 'body');
    const enabled = new Map<SplitBodySide, AnyContainerOptions<THost>>();
    for (const side of SPLIT_BODY_SIDES) {
      const value = cfg[side];
      if (value === undefined || value === false) continue;
      if (value !== true && (value === null || typeof value !== 'object')) {
        throw new SplitInvalidOptionError(side, value, 'boolean ou objeto de opções');
      }
      const own = value === true ? {} : value;
      validateContainerOptions(own, `${side}.`, 'body');
      enabled.set(side, { closeWhenEmpty: true, ...cfg.defaults, ...own });
    }
    if (cfg.default !== undefined) {
      if (!SPLIT_BODY_SIDES.includes(cfg.default)) {
        throw new SplitInvalidOptionError('default', cfg.default, SPLIT_BODY_SIDES.join(' | '));
      }
      if (!enabled.has(cfg.default)) {
        throw new SplitContainerNotFoundError(bodyContainerKey(cfg.default), this.keys(), true);
      }
    }

    for (const side of SPLIT_BODY_SIDES) {
      const key = bodyContainerKey(side);
      const existing = this.containers.get(key);
      const options = enabled.get(side);
      if (existing && !options) {
        this.remove(existing);
      } else if (existing && options) {
        existing.options = options;
        this._events.next({ type: 'updated', record: existing });
      } else if (options) {
        const record = new ContainerRecord<THost>(key, 'body', side, null, options);
        this.containers.set(key, record);
        this._events.next({ type: 'registered', record });
      }
    }
    if (cfg.default) this.defaultKey = bodyContainerKey(cfg.default);
  }

  /**
   * Sets the default container. `null` removes the explicit choice and goes back to the
   * automatic default (the first configured container).
   */
  setDefaultContainer(key: string | null): void {
    if (key !== null) this.assertExists(key);
    this.defaultKey = key;
  }

  /**
   * The default container: the one set with `setDefaultContainer()` (or `default` of
   * `useBodyContainers`), otherwise the first configured container, in registration order.
   * `null` only while no container is configured.
   */
  getDefaultContainer(): string | null {
    return this.defaultKey ?? this.containers.keys().next().value ?? null;
  }

  /** Whether the default was chosen explicitly (`false` when it is the automatic one). */
  hasExplicitDefaultContainer(): boolean {
    return this.defaultKey !== null;
  }

  hasContainer(key: string): boolean {
    return this.containers.has(key);
  }

  /** Keys of all configured containers, in registration order. */
  getContainerKeys(): string[] {
    return this.keys();
  }

  /**
   * Resolves the container of an `open()`: `containerKey ?? default`, with explicit errors.
   * Without a key and without any configured container, throws `SplitNoDefaultContainerError`.
   */
  resolveKey(containerKey?: string): string {
    if (containerKey !== undefined) return this.assertExists(containerKey).key;
    const key = this.getDefaultContainer();
    if (key === null) throw new SplitNoDefaultContainerError(this.keys());
    return key;
  }

  /** Returns the record of a key, or throws `SplitContainerNotFoundError`. */
  assertExists(key: string): ContainerRecord<THost> {
    const record = this.containers.get(key);
    if (!record) {
      throw new SplitContainerNotFoundError(key, this.keys(), bodySideOf(key) !== null);
    }
    return record;
  }

  /** @internal */
  _get(key: string): ContainerRecord<THost> | undefined {
    return this.containers.get(key);
  }

  /** @internal */
  _all(): ContainerRecord<THost>[] {
    return [...this.containers.values()];
  }

  /** Completes the observables. */
  destroy(): void {
    this._events.complete();
  }

  private remove(record: ContainerRecord<THost>): void {
    // The controller closes the tabs while the record still exists.
    this._events.next({ type: 'removing', record });
    this.containers.delete(record.key);
    if (this.defaultKey === record.key) this.defaultKey = null;
  }

  private keys(): string[] {
    return [...this.containers.keys()];
  }
}
