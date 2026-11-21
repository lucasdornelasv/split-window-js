import type { Type } from '@angular/core';
import type {
  SplitAnimationContext as CoreAnimationContext,
  SplitAnimationEngine,
  SplitAnimationFn as CoreAnimationFn,
  SplitAnimationOptions as CoreAnimationOptions,
  SplitAnimationPreset,
  SplitContainerElements as CoreContainerElements,
} from '@split-window/core';

/*
 * The animation contract lives in @split-window/core. These are its types bound to
 * `HTMLElement`, plus engine classes (`Type`), created in an injection context.
 * Engines: `@split-window/css-animation`, `@split-window/keyframes-animation`, or your own.
 */

/** Elements of a container. */
export type SplitContainerElements = CoreContainerElements<HTMLElement>;

/** What an animation engine receives. */
export type SplitAnimationContext = CoreAnimationContext<HTMLElement>;

/** A function used as an engine. */
export type SplitAnimationFn = CoreAnimationFn<HTMLElement>;

/**
 * What `animation.engine` accepts: the name of a registered engine, `'none'` (noop), an
 * instance, a class (created in an injection context) or a function. Without a value: the first registered
 * engine, or noop when none is registered.
 */
export type SplitAnimationEngineInput =
  | 'none'
  | (string & {})
  | SplitAnimationEngine<HTMLElement>
  | Type<SplitAnimationEngine<HTMLElement>>
  | SplitAnimationFn;

/** Animation options. Without `engine`: the first registered engine, or noop when there is none. */
export interface SplitAnimationOptions extends Omit<CoreAnimationOptions<HTMLElement>, 'engine'> {
  engine?: SplitAnimationEngineInput;
}

/** What the `animation` option accepts. */
export type SplitAnimationInput =
  | boolean
  | SplitAnimationPreset
  | SplitAnimationOptions
  | SplitAnimationEngine<HTMLElement>
  | Type<SplitAnimationEngine<HTMLElement>>
  | SplitAnimationFn;
