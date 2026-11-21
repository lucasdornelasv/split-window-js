import type { SplitWindowController } from '../controller/split-window-controller.js';
import type { SplitWindowRef } from '../controller/split-window-ref.js';
import type { ContainerState, TabState } from '../model/types.js';

/** Opaque value an engine returns from `createTab` to identify the rendered tab. */
export type TabHandle = unknown;

/**
 * Contract each adapter implements. The core decides; the engine builds and executes.
 * The engine never decides whether something is allowed: it asks the controller.
 *
 * Extend `BaseSplitWindowEngine` to get the show/hide transitions (animation engines,
 * cancellation, tabs kept on screen while their container leaves) for free.
 *
 * @typeParam TContent - what the adapter accepts in `open()`.
 * @typeParam THost - the host of a container.
 * @typeParam TAdapterOptions - options only the adapter understands (inputs, injector...).
 */
export interface SplitWindowEngine<TContent = unknown, THost = unknown, TAdapterOptions = unknown> {
  /** Called by the controller it belongs to, in its constructor. */
  connect?(controller: SplitWindowController<TContent, THost, TAdapterOptions>): void;
  /** Called when the controller is destroyed. */
  disconnect?(): void;
  /**
   * A container was registered (or the controller started with it registered). The engine
   * may prepare its host before the first tab, without mounting the shell.
   */
  prepareContainer?(container: ContainerState<THost>): void;
  /** A container was removed. Called after `unmountContainer` when it was mounted. */
  releaseContainer?(container: ContainerState<THost>): void;
  /** Creates the shell of a container (and its host, for body containers). */
  mountContainer(container: ContainerState<THost>): void;
  unmountContainer(container: ContainerState<THost>): void;
  /**
   * Shows or hides a mounted container without unmounting it. May animate: the returned
   * promise (optional) resolves when the transition ends. The core does not wait for it.
   */
  setContainerOpen(container: ContainerState<THost>, open: boolean): void | Promise<void>;
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
  /**
   * Sets inputs on the content of an open tab (`SplitWindowRef.setInputData`). The engine
   * decides which names apply; content without inputs ignores the call.
   */
  setInputs?(tab: TabHandle, inputs: Readonly<Record<string, unknown>>): void;
  /**
   * Destroys a closed tab. When the container of the tab is hiding with an animation, the
   * engine may keep the tab visible until the end and return a promise: the core emits
   * `hidden` only after it resolves.
   */
  destroy(tab: TabHandle): void | Promise<void>;
  setExpanded(container: ContainerState<THost>, expanded: boolean): void;
  /** The expansion changed during a drag: end the drag and return the tab to its place. */
  cancelDrag(): void;
}
