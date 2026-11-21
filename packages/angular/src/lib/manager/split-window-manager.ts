import { Injectable, inject } from '@angular/core';
import type {
  SplitCloseAllResult,
  SplitContainerStateChange,
  SplitContainerTransitionEvent,
  SplitDismissAllOptions,
  SplitTabMovedEvent,
  SplitTabRejectedEvent,
  SplitWindowRef,
} from '@split-window/core';
import type { Observable } from 'rxjs';
import { SplitWindowController } from '../controller/split-window-controller';
import { SplitContainerRegistry } from '../registry/split-container-registry';
import type { SplitContent, SplitWindowOptions } from '../types';

/**
 * Public API to open tabs, in the format of `NgbOffcanvas` and `NgbModal`:
 * `open(content, options)` returns a reference that controls the tab. Also controls the
 * containers (full screen, state) through the controller.
 *
 * Registered only by `provideSplitWindows()`.
 */
@Injectable()
export class SplitWindowManager {
  private readonly controller = inject(SplitWindowController);

  /** The registry singleton: configuration of the containers. */
  readonly registry = inject(SplitContainerRegistry);

  /** Any reorder or container change of any tab. */
  readonly tabMoved: Observable<SplitTabMovedEvent> = this.controller.tabMoved;

  /** A tab refused by the tab limit, with the resolution applied. */
  readonly tabRejected: Observable<SplitTabRejectedEvent> = this.controller.tabRejected;

  /** Container opened, closed, expanded or restored. */
  readonly containerStateChanged: Observable<SplitContainerStateChange> =
    this.controller.containerStateChanged;

  /** Show/hide transitions of the containers: start, progress, end or cancel. */
  readonly containerTransitions: Observable<SplitContainerTransitionEvent> =
    this.controller.engine.transitions;

  /**
   * Opens a component or template as a tab. The container comes from `options.containerKey`
   * or the default container.
   */
  open<T = any>(content: SplitContent<T>, options: SplitWindowOptions = {}): SplitWindowRef<T> {
    const { inputs, injector, ...coreOptions } = options ?? {};
    return this.controller.open(content as SplitContent, coreOptions, {
      inputs,
      injector,
    }) as SplitWindowRef<T>;
  }

  /**
   * Closes the tabs of a container (or of all containers) in sequence, waiting for each
   * `canClose`. Tabs with `closable: false` are kept.
   */
  dismissAll(options?: SplitDismissAllOptions): Promise<SplitCloseAllResult> {
    return this.controller.dismissAll(options);
  }

  hasOpenWindows(containerKey?: string): boolean {
    return this.controller.hasOpenWindows(containerKey);
  }

  /** Open tabs of a container, in strip order. */
  getTabs(containerKey: string): readonly SplitWindowRef[] {
    return this.controller.getTabs(containerKey);
  }

  /**
   * Expands a container, restoring the one that was expanded. Ignored when the container
   * is closed or has `expand: false`.
   */
  expandContainer(key: string): void {
    this.controller.expandContainer(key);
  }

  restoreContainer(key: string): void {
    this.controller.restoreContainer(key);
  }

  isContainerOpen(key: string): boolean {
    return this.controller.isContainerOpen(key);
  }

  isContainerExpanded(key: string): boolean {
    return this.controller.isContainerExpanded(key);
  }

  /** Key of the expanded container, if any. */
  getExpandedContainer(): string | null {
    return this.controller.getExpandedContainer();
  }
}
