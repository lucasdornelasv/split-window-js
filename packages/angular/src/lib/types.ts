import type { Injector, TemplateRef, Type } from '@angular/core';
import type {
  SplitBodyContainerOptions as CoreBodyContainerOptions,
  SplitBodyContainersConfig as CoreBodyContainersConfig,
  SplitContainerOptions as CoreContainerOptions,
  SplitExpandOptions as CoreExpandOptions,
  SplitWindowOptions as CoreWindowOptions,
} from '@split-window/core';
import type { SplitActiveWindow } from './active-window/split-active-window';

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

export type SplitContainerOptions = CoreContainerOptions<HTMLElement>;
export type SplitBodyContainerOptions = CoreBodyContainerOptions<HTMLElement>;
export type SplitBodyContainersConfig = CoreBodyContainersConfig<HTMLElement>;
export type SplitExpandOptions = CoreExpandOptions<HTMLElement>;
