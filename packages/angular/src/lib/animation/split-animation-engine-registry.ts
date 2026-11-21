import { EnvironmentInjector, inject, runInInjectionContext } from '@angular/core';
import {
  SplitAnimationEngineRegistry,
  isAnimationEngineClass,
  type SplitAnimationEngine,
} from '@split-window/core';
import { SPLIT_ANIMATION_ENGINES, type SplitAnimationEngineEntry } from '../tokens';

/**
 * Factory of the `SplitAnimationEngineRegistry` (from the core) that `provideSplitWindows()`
 * registers. Must run in an injection context. Registers the engines of
 * `provideSplitWindows({ animationEngines })` and `provideSplitAnimationEngines()`, in order;
 * factory entries run here, in the injection context. Engine classes given as
 * `animation.engine` are created in the same context, so they may use `inject()`.
 *
 * Use it to provide your own registry on top of the default one:
 *
 * ```ts
 * {
 *   provide: SplitAnimationEngineRegistry,
 *   useFactory: () => {
 *     const registry = splitAnimationEngineRegistryFactory();
 *     registry.register('pop', new PopAnimationEngine());
 *     return registry;
 *   },
 * }
 * ```
 */
export function splitAnimationEngineRegistryFactory(): SplitAnimationEngineRegistry<HTMLElement> {
  const injector = inject(EnvironmentInjector);
  const registry = new SplitAnimationEngineRegistry<HTMLElement>((type) =>
    runInInjectionContext(injector, () => new type()),
  );
  for (const record of inject(SPLIT_ANIMATION_ENGINES, { optional: true }) ?? []) {
    for (const [name, entry] of Object.entries(record)) {
      registry.register(name, engineOf(entry));
    }
  }
  return registry;
}

/** Runs a factory entry (we are in the injection context of the registry factory). */
function engineOf(entry: SplitAnimationEngineEntry): SplitAnimationEngine<HTMLElement> {
  if (typeof entry === 'function' && !isAnimationEngineClass(entry)) return entry();
  // An engine, or a class (outside the types): the registry creates it in the injection context.
  return entry as SplitAnimationEngine<HTMLElement>;
}
