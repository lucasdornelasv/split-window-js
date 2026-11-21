import { Injectable, type OnDestroy } from '@angular/core';
import { SplitContainerRegistry as CoreSplitContainerRegistry } from '@split-window/core';

/**
 * Definition and state of the containers: registered containers, body containers, default
 * container, open/closed and expanded. Injectable on its own (for example in a
 * `provideAppInitializer`) without creating the manager.
 *
 * Registered only by `provideSplitWindows()`.
 */
@Injectable()
export class SplitContainerRegistry
  extends CoreSplitContainerRegistry<HTMLElement>
  implements OnDestroy
{
  ngOnDestroy(): void {
    this.destroy();
  }
}
