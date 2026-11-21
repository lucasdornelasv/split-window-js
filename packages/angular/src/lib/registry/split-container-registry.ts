import { Injectable, inject, type OnDestroy } from '@angular/core';
import {
  SPLIT_BODY_SIDES,
  SplitContainerRegistry as CoreSplitContainerRegistry,
  validateContainerOptions,
} from '@split-window/core';
import { SplitModeResolver } from '../modes/mode-resolver';
import { SPLIT_CONTAINER_DEFAULTS } from '../tokens';
import type {
  SplitBodyContainerOptions,
  SplitBodyContainersConfig,
  SplitContainerOptions,
} from '../types';

/** Options of `containerDefaults` copied into the containers when they are registered. */
const BEHAVIOR_KEYS = [
  'maxTabs',
  'onFull',
  'onReject',
  'closeWhenEmpty',
  'closedDropZone',
  'expand',
] as const;

function pickBehavior(source: object | undefined, extra: readonly string[] = []) {
  const result: Record<string, unknown> = {};
  if (!source) return result;
  for (const key of [...BEHAVIOR_KEYS, ...extra]) {
    const value = (source as Record<string, unknown>)[key];
    if (value !== undefined) result[key] = value;
  }
  return result;
}

/**
 * Configuration of the containers: registered containers, body containers and the default
 * container. It only stores: opening, closing and full screen are done by the controller
 * (`SplitWindowManager`). Injectable on its own, for example in a `provideAppInitializer`.
 *
 * Applies `provideSplitWindows({ containerDefaults })`: the behavior options there
 * (`maxTabs`, `onFull`, `onReject`, `closeWhenEmpty`, `closedDropZone`, `expand`, and
 * `backdrop` for body containers) pre-configure every container registered here, below its
 * own options. The display options (mode, animation, classes...) are merged by the mode
 * resolver.
 *
 * Registered only by `provideSplitWindows()`.
 */
@Injectable()
export class SplitContainerRegistry
  extends CoreSplitContainerRegistry<HTMLElement>
  implements OnDestroy
{
  private readonly resolver = inject(SplitModeResolver);
  /** Behavior defaults of custom containers (`containerDefaults` + `containerDefaults.custom`). */
  private readonly customDefaults: Record<string, unknown>;
  /** Behavior defaults of body containers (`containerDefaults` + `containerDefaults.body`). */
  private readonly bodyDefaults: Record<string, unknown>;

  constructor() {
    super();
    const defaults = inject(SPLIT_CONTAINER_DEFAULTS);
    this.customDefaults = { ...pickBehavior(defaults), ...pickBehavior(defaults.custom) };
    this.bodyDefaults = {
      ...pickBehavior(defaults),
      ...pickBehavior(defaults.body, ['backdrop']),
    };
    validateContainerOptions(this.customDefaults, 'containerDefaults.');
    validateContainerOptions(this.bodyDefaults, 'containerDefaults.body.', 'body');
  }

  /**
   * Registers a container on a host. Besides the core options, accepts `mode`, `animation`
   * and the `*Class` options. Unknown mode names throw here; animation engines may be
   * registered later, so their names are checked on each transition.
   */
  override registerContainer(
    key: string,
    host: HTMLElement,
    options?: SplitContainerOptions,
  ): void {
    this.resolver.validate(options?.mode, 'custom', 'mode');
    super.registerContainer(key, host, { ...this.customDefaults, ...options });
  }

  /**
   * Enables body containers. `containerDefaults` (and `containerDefaults.body`) apply below
   * `config.defaults` and the options of each side.
   */
  override useBodyContainers(config?: SplitBodyContainersConfig): void {
    if (config && typeof config === 'object') {
      const { defaults } = config;
      this.resolver.validate(defaults?.mode, 'body', 'defaults.mode');
      for (const side of SPLIT_BODY_SIDES) {
        const value = config[side];
        if (value && typeof value === 'object') {
          this.resolver.validate(value.mode, 'body', `${side}.mode`);
        }
      }
    }
    // Without arguments the core enables `{ right: true, default: 'right' }`.
    const base: SplitBodyContainersConfig = config ?? { right: true, default: 'right' };
    if (base === null || typeof base !== 'object' || Object.keys(this.bodyDefaults).length === 0) {
      super.useBodyContainers(config); // the core validates the shape
      return;
    }
    super.useBodyContainers({
      ...base,
      defaults: { ...(this.bodyDefaults as SplitBodyContainerOptions), ...base.defaults },
    });
  }

  ngOnDestroy(): void {
    this.destroy();
  }
}
