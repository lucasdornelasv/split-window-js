import { Injectable, inject } from '@angular/core';
import type {
  SplitCloseAllResult,
  SplitDismissAllOptions,
  SplitTabMovedEvent,
  SplitTabRejectedEvent,
  SplitWindowRef,
} from '@split-window/core';
import type { Observable } from 'rxjs';
import { SplitContainerRegistry } from '../registry/split-container-registry';
import { SplitWindowRuntime } from '../runtime';
import type { SplitContent, SplitWindowOptions } from '../types';

/**
 * Public API to open tabs, in the format of `NgbOffcanvas` and `NgbModal`:
 * `open(content, options)` returns a reference that controls the tab.
 *
 * Registered only by `provideSplitWindows()`.
 */
@Injectable()
export class SplitWindowManager {
  private readonly runtime = inject(SplitWindowRuntime);

  /** The same injectable registry singleton, for container control. */
  readonly registry = inject(SplitContainerRegistry);

  /** Any reorder or container change of any tab. */
  readonly tabMoved: Observable<SplitTabMovedEvent> = this.runtime.controller.tabMoved;

  /** A tab refused by the tab limit, with the resolution applied. */
  readonly tabRejected: Observable<SplitTabRejectedEvent> = this.runtime.controller.tabRejected;

  /**
   * Opens a component or template as a tab. The container comes from `options.containerKey`
   * or the default container.
   */
  open<T = any>(content: SplitContent<T>, options: SplitWindowOptions = {}): SplitWindowRef<T> {
    const { inputs, injector, ...coreOptions } = options ?? {};
    return this.runtime.controller.open(content as SplitContent, coreOptions, {
      inputs,
      injector,
    }) as SplitWindowRef<T>;
  }

  /**
   * Closes the tabs of a container (or of all containers) in sequence, waiting for each
   * `canClose`. Tabs with `closable: false` are kept.
   */
  dismissAll(options?: SplitDismissAllOptions): Promise<SplitCloseAllResult> {
    return this.runtime.controller.dismissAll(options);
  }

  hasOpenWindows(containerKey?: string): boolean {
    return this.runtime.controller.hasOpenWindows(containerKey);
  }

  /** Open tabs of a container, in strip order. */
  getTabs(containerKey: string): readonly SplitWindowRef[] {
    return this.runtime.controller.getTabs(containerKey);
  }
}
