import { InjectionToken, type Type } from '@angular/core';
import {
  mergeSplitWindowConfig,
  type SplitAnimationEngine,
  type SplitWindowConfig,
} from '@split-window/core';
import type { SplitModeInput } from './modes/container-mode';
import type { SplitContainerDefaultsConfig } from './types';

/** Default values of SplitWindow, set through `provideSplitWindows(config)`. */
export const SPLIT_WINDOW_CONFIG = new InjectionToken<SplitWindowConfig>('SPLIT_WINDOW_CONFIG', {
  factory: () => mergeSplitWindowConfig(),
});

/**
 * Named modes (multi provider). `provideSplitWindows({ modes })` and `provideSplitModes()`
 * add to it; a later record wins for the same name.
 */
export const SPLIT_WINDOW_MODES = new InjectionToken<readonly Record<string, SplitModeInput>[]>(
  'SPLIT_WINDOW_MODES',
);

/** Display defaults of the containers, from `provideSplitWindows({ containerDefaults })`. */
export const SPLIT_CONTAINER_DEFAULTS = new InjectionToken<SplitContainerDefaultsConfig>(
  'SPLIT_CONTAINER_DEFAULTS',
  { factory: () => ({}) },
);

/** A registered animation engine: an instance or a class (created with DI). */
export type SplitAnimationEngineEntry =
  SplitAnimationEngine<HTMLElement> | Type<SplitAnimationEngine<HTMLElement>>;

/**
 * Named animation engines (multi provider), in registration order. Without a chosen
 * engine, an animated container uses the first one; the noop engine is used only when none
 * is registered or `engine: 'none'` is chosen. `provideSplitWindows({ animationEngines })`
 * and `provideSplitAnimationEngines()` add to it.
 */
export const SPLIT_ANIMATION_ENGINES = new InjectionToken<
  readonly Record<string, SplitAnimationEngineEntry>[]
>('SPLIT_ANIMATION_ENGINES');
