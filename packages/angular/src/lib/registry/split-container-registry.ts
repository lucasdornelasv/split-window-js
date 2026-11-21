import { Injectable, inject, type OnDestroy } from '@angular/core';
import {
  SPLIT_BODY_SIDES,
  SplitContainerRegistry as CoreSplitContainerRegistry,
} from '@split-window/core';
import { SplitModeResolver } from '../modes/mode-resolver';
import type { SplitBodyContainersConfig, SplitContainerOptions } from '../types';

/**
 * Configuration of the containers: registered containers, body containers and the default
 * container. It only stores: opening, closing and full screen are done by the controller
 * (`SplitWindowManager`). Injectable on its own, for example in a `provideAppInitializer`.
 *
 * Registered only by `provideSplitWindows()`.
 */
@Injectable()
export class SplitContainerRegistry
  extends CoreSplitContainerRegistry<HTMLElement>
  implements OnDestroy
{
  private readonly resolver = inject(SplitModeResolver);

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
    super.registerContainer(key, host, options);
  }

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
    super.useBodyContainers(config);
  }

  ngOnDestroy(): void {
    this.destroy();
  }
}
