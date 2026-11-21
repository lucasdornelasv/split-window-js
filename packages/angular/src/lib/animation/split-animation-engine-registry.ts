import { EnvironmentInjector, Injectable, Injector, inject } from '@angular/core';
import { SplitAnimationEngineRegistry as CoreSplitAnimationEngineRegistry } from '@split-window/core';
import { SPLIT_ANIMATION_ENGINES } from '../tokens';

/**
 * Named animation engines, as an Angular service. Starts with the engines of
 * `provideSplitWindows({ animationEngines })` and `provideSplitAnimationEngines()`, in
 * order, and creates engine classes with dependency injection. Inject it to register more
 * engines at any time:
 *
 * ```ts
 * inject(SplitAnimationEngineRegistry).register('pop', PopAnimationEngine);
 * ```
 *
 * Engines are resolved on each transition, so a registration counts from the next
 * open/close on: a container without a chosen engine uses the first registered one, and a
 * container that names an engine uses it once it is registered.
 *
 * Registered only by `provideSplitWindows()`. Replace it with a subclass through
 * `provideSplitWindows({ animationEngineRegistry })`.
 */
@Injectable()
export class SplitAnimationEngineRegistry extends CoreSplitAnimationEngineRegistry<HTMLElement> {
  constructor() {
    const injector = inject(EnvironmentInjector);
    super((type) =>
      Injector.create({ providers: [{ provide: type, useClass: type }], parent: injector }).get(
        type,
      ),
    );
    for (const record of inject(SPLIT_ANIMATION_ENGINES, { optional: true }) ?? []) {
      for (const [name, engine] of Object.entries(record)) this.register(name, engine);
    }
  }
}
