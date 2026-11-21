import type { Injector, TemplateRef, Type } from '@angular/core';
import type {
  SplitBodyContainerOptions as CoreBodyContainerOptions,
  SplitBodyContainersConfig as CoreBodyContainersConfig,
  SplitBodySide,
  SplitContainerOptions as CoreContainerOptions,
  SplitExpandOptions as CoreExpandOptions,
  SplitWindowConfigInput,
  SplitWindowLabels,
  SplitWindowOptions as CoreWindowOptions,
} from '@split-window/core';
import type { SplitActiveWindow } from './active-window/split-active-window';
import type { SplitAnimationInput } from './animation/animation-engine';
import type { SplitWindowController } from './controller/split-window-controller';
import type { AngularSplitEngine } from './engine/angular-split-engine';
import type { SplitClassInput, SplitModeInput, SplitModeSettings } from './modes/container-mode';
import type { SplitAnimationEngineEntry } from './tokens';

/** What `open()` accepts. */
export type SplitContent<T = unknown> = Type<T> | TemplateRef<any>;

/** Context of a template opened as a tab. */
export interface SplitTemplateContext {
  $implicit: SplitActiveWindow;
  window: SplitActiveWindow;
}

/** Options of `SplitWindowManager.open()`. */
export interface SplitWindowOptions extends CoreWindowOptions {
  /** Inputs set on the component with `setInput`. */
  inputs?: Record<string, unknown>;
  /**
   * Parent injector of the tab. Without a value, the `EnvironmentInjector` of the manager
   * (as in `NgbModal`): the manager does not know the injector of its caller.
   */
  injector?: Injector;
}

/** Options only the Angular engine understands. */
export interface SplitAngularTabOptions {
  inputs?: Record<string, unknown>;
  injector?: Injector;
}

/** Display options of a container, resolved by the Angular engine. */
export interface SplitContainerDisplayOptions {
  /**
   * Display mode: `'inline'` (default of custom containers), `'push'`, `'overlay'` (default
   * of body containers), a mode registered in `provideSplitWindows({ modes })`, an object,
   * a class extending `SplitContainerMode`, an instance or a function.
   */
  mode?: SplitModeInput;
  /** Open/close animation. Default: off (or `containerDefaults.animation`). */
  animation?: SplitAnimationInput;
  /** Classes of the host (the app element, or the fixed host of a body container). */
  hostClass?: SplitClassInput;
  /** Classes of the `split-container` element. */
  panelClass?: SplitClassInput;
  /** Classes of the backdrop. */
  backdropClass?: SplitClassInput;
}

export type SplitContainerOptions = Omit<CoreContainerOptions<HTMLElement>, 'mode' | 'animation'> &
  SplitContainerDisplayOptions;

export type SplitBodyContainerOptions = Omit<
  CoreBodyContainerOptions<HTMLElement>,
  'mode' | 'animation'
> &
  SplitContainerDisplayOptions;

export interface SplitBodyContainersConfig extends Omit<
  CoreBodyContainersConfig<HTMLElement>,
  'defaults' | SplitBodySide
> {
  /** Applies to every enabled side. */
  defaults?: SplitBodyContainerOptions;
  left?: boolean | SplitBodyContainerOptions;
  right?: boolean | SplitBodyContainerOptions;
  top?: boolean | SplitBodyContainerOptions;
  bottom?: boolean | SplitBodyContainerOptions;
}

export type SplitExpandOptions = CoreExpandOptions<HTMLElement>;

/**
 * Container options that `containerDefaults` pre-configures: copied into the options of
 * each container when it is registered, below its own options.
 */
export type SplitContainerBehaviorDefaults = Pick<
  CoreContainerOptions<HTMLElement>,
  'maxTabs' | 'onFull' | 'onReject' | 'closeWhenEmpty' | 'closedDropZone' | 'expand'
>;

/**
 * Global defaults of the containers:
 * - display (`mode` and its settings): overridden by the mode and by the container;
 * - behavior (`maxTabs`, `onFull`, `onReject`, `closeWhenEmpty`, `closedDropZone`,
 *   `expand`): pre-configured on each container when it is registered, overridden by its
 *   own options.
 */
export interface SplitContainerDefaults extends SplitModeSettings, SplitContainerBehaviorDefaults {
  mode?: SplitModeInput;
}

/** Defaults of body containers: also `backdrop`. */
export interface SplitBodyContainerDefaults extends SplitContainerDefaults {
  /** Blocks the page behind the container while it is open. */
  backdrop?: boolean;
}

/** `containerDefaults` of `provideSplitWindows()`: for every container, then per kind. */
export interface SplitContainerDefaultsConfig extends SplitContainerDefaults {
  custom?: SplitContainerDefaults;
  body?: SplitBodyContainerDefaults;
}

/**
 * Texts of the library: an object, or a factory that returns it. The factory runs once, in
 * an injection context, when the config is first injected, so it may use `inject()`:
 *
 * ```ts
 * labels: () => {
 *   const t = inject(MyTranslations);
 *   return { defaultTitle: t.get('tab.new'), closeTab: t.get('tab.close') };
 * }
 * ```
 */
export type SplitLabelsInput = Partial<SplitWindowLabels> | (() => Partial<SplitWindowLabels>);

/** Config of `provideSplitWindows()`. */
export interface SplitWindowAngularConfig extends Omit<SplitWindowConfigInput, 'labels'> {
  /** Texts of the library, or a factory run in an injection context. */
  labels?: SplitLabelsInput;
  /** Named modes, used as `mode: '<name>'`. */
  modes?: Record<string, SplitModeInput>;
  /**
   * Defaults of the containers: display (mode, animation, classes...) and behavior
   * (`maxTabs`, `onFull`, `closeWhenEmpty`...), per kind with `custom`/`body`.
   */
  containerDefaults?: SplitContainerDefaultsConfig;
  /**
   * Named animation engines, in order. An animated container without `animation.engine`
   * uses the first one; the noop engine is used only when none is registered or
   * `engine: 'none'` is chosen.
   */
  animationEngines?: Record<string, SplitAnimationEngineEntry>;
  /** A subclass of `AngularSplitEngine` to use instead of it. */
  engine?: Type<AngularSplitEngine>;
  /** A subclass of `SplitWindowController` to use instead of it. */
  controller?: Type<SplitWindowController>;
}
