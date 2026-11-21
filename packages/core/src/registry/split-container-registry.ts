import { Subject, type Observable } from 'rxjs';
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
  type SplitContainerStateChange,
} from '../model/types.js';
import { validateContainerKey, validateContainerOptions } from '../model/validation.js';
import { SplitContainerStack } from '../stack/split-container-stack.js';

type AnyContainerOptions<THost> = SplitContainerOptions<THost> & SplitBodyContainerOptions<THost>;

/** Internal mutable record of a container. The engine sees it as a read-only `ContainerState`. */
export class ContainerRecord<THost = unknown> implements ContainerState<THost> {
  open = false;
  expanded = false;
  mounted = false;
  /** Created on demand, on the first tab opened or moved to the container. */
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
  | { type: 'removing'; record: ContainerRecord<THost> }
  | { type: 'expanded'; record: ContainerRecord<THost>; expanded: boolean }
  | { type: 'updated'; record: ContainerRecord<THost> };

/**
 * Definition of the containers, body containers, default container and container state
 * (open, closed, expanded). The registry never depends on the controller.
 */
export class SplitContainerRegistry<THost = unknown> {
  private readonly containers = new Map<string, ContainerRecord<THost>>();
  private defaultKey: string | null = null;
  private readonly stateSubject = new Subject<SplitContainerStateChange>();

  /** @internal */
  readonly _events = new Subject<RegistryEvent<THost>>();

  /** Container opened, closed, expanded or restored. */
  readonly containerStateChanged: Observable<SplitContainerStateChange> =
    this.stateSubject.asObservable();

  /** Registers a container on a host. Throws for reserved, duplicate or invalid keys. */
  registerContainer(key: string, host: THost, options?: SplitContainerOptions<THost>): void {
    validateContainerKey(key, 'key');
    if (key.startsWith('body-')) throw new SplitReservedContainerKeyError(key);
    if (this.containers.has(key)) throw new SplitDuplicateContainerError(key);
    if (host === null || host === undefined) {
      throw new SplitInvalidOptionError('host', host, 'o elemento host do container');
    }
    validateContainerOptions(options);
    this.containers.set(key, new ContainerRecord(key, 'custom', null, host, { ...options }));
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
    validateContainerOptions(cfg.defaults, 'defaults.');
    const enabled = new Map<SplitBodySide, AnyContainerOptions<THost>>();
    for (const side of SPLIT_BODY_SIDES) {
      const value = cfg[side];
      if (value === undefined || value === false) continue;
      if (value !== true && (value === null || typeof value !== 'object')) {
        throw new SplitInvalidOptionError(side, value, 'boolean ou objeto de opções');
      }
      const own = value === true ? {} : value;
      validateContainerOptions(own, `${side}.`);
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
        this.containers.set(key, new ContainerRecord<THost>(key, 'body', side, null, options));
      }
    }
    if (cfg.default) this.defaultKey = bodyContainerKey(cfg.default);
  }

  /** Sets the default container. `null` removes the default. */
  setDefaultContainer(key: string | null): void {
    if (key !== null) this.assertExists(key);
    this.defaultKey = key;
  }

  /** The default container, or `null` until one is configured. */
  getDefaultContainer(): string | null {
    return this.defaultKey;
  }

  hasContainer(key: string): boolean {
    return this.containers.has(key);
  }

  /** Keys of all configured containers, in registration order. */
  getContainerKeys(): string[] {
    return this.keys();
  }

  isContainerOpen(key: string): boolean {
    return this.containers.get(key)?.open ?? false;
  }

  isContainerExpanded(key: string): boolean {
    return this.containers.get(key)?.expanded ?? false;
  }

  /** Key of the expanded container, if any. */
  getExpandedContainer(): string | null {
    for (const record of this.containers.values()) if (record.expanded) return record.key;
    return null;
  }

  /**
   * Expands a container, restoring the one that was expanded. Ignored when the container
   * is closed or has `expand: false`.
   */
  expandContainer(key: string): void {
    const record = this.assertExists(key);
    if (record.expanded || !record.open || record.options.expand === false) return;
    const current = this.getExpandedContainer();
    if (current) this.restoreContainer(current);
    this.setExpanded(record, true);
  }

  restoreContainer(key: string): void {
    const record = this.assertExists(key);
    if (record.expanded) this.setExpanded(record, false);
  }

  /** Resolves the container of an `open()`: `containerKey ?? default`, with explicit errors. */
  resolveKey(containerKey?: string): string {
    if (containerKey !== undefined) return this.assertExists(containerKey).key;
    if (this.defaultKey === null) throw new SplitNoDefaultContainerError(this.keys());
    return this.defaultKey;
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

  /** @internal Called by the controller when a container opens or closes. */
  _setOpen(record: ContainerRecord<THost>, open: boolean): void {
    if (record.open === open) return;
    if (!open && record.expanded) this.setExpanded(record, false);
    record.open = open;
    this.emitState(record);
  }

  /** Completes the observables. */
  destroy(): void {
    this.stateSubject.complete();
    this._events.complete();
  }

  private setExpanded(record: ContainerRecord<THost>, expanded: boolean): void {
    record.expanded = expanded;
    this._events.next({ type: 'expanded', record, expanded });
    this.emitState(record);
  }

  private remove(record: ContainerRecord<THost>): void {
    // The controller closes the tabs while the record still exists.
    this._events.next({ type: 'removing', record });
    this.containers.delete(record.key);
    if (this.defaultKey === record.key) this.defaultKey = null;
    const changed = record.open || record.expanded;
    record.open = false;
    record.expanded = false;
    if (changed) this.emitState(record);
  }

  private emitState(record: ContainerRecord<THost>): void {
    this.stateSubject.next({ key: record.key, open: record.open, expanded: record.expanded });
  }

  private keys(): string[] {
    return [...this.containers.keys()];
  }
}
