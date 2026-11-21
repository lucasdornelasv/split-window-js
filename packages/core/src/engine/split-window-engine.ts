import type { SplitWindowRef } from '../controller/split-window-ref.js';
import type { ContainerState, TabState } from '../model/types.js';

/** Opaque value an engine returns from `createTab` to identify the rendered tab. */
export type TabHandle = unknown;

/**
 * Contract each adapter implements. The core decides; the engine builds and executes.
 * The engine never decides whether something is allowed: it asks the controller.
 *
 * @typeParam TContent - what the adapter accepts in `open()`.
 * @typeParam THost - the host of a container.
 * @typeParam TAdapterOptions - options only the adapter understands (inputs, injector...).
 */
export interface SplitWindowEngine<TContent = unknown, THost = unknown, TAdapterOptions = unknown> {
  /** Creates the shell of a container (and its host, for body containers). */
  mountContainer(container: ContainerState<THost>): void;
  unmountContainer(container: ContainerState<THost>): void;
  /** Shows or hides a mounted container without unmounting it. */
  setContainerOpen(container: ContainerState<THost>, open: boolean): void;
  createTab(
    content: TContent,
    tab: TabState,
    ref: SplitWindowRef,
    adapterOptions: TAdapterOptions | undefined,
  ): TabHandle;
  /** Places a new tab in a container, inactive. */
  attach(tab: TabHandle, container: ContainerState<THost>, index: number): void;
  /** Moves a tab to another container without destroying it. */
  move(tab: TabHandle, to: ContainerState<THost>, index: number): void;
  activate(tab: TabHandle): void;
  deactivate(tab: TabHandle): void;
  destroy(tab: TabHandle): void;
  setExpanded(container: ContainerState<THost>, expanded: boolean): void;
  /** The expansion changed during a drag: end the drag and return the tab to its place. */
  cancelDrag(): void;
}
