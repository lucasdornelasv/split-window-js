import type { SplitWindowController } from '../controller/split-window-controller.js';
import type { SplitWindowRef } from '../controller/split-window-ref.js';
import type { SplitWindowEngine } from '../engine/split-window-engine.js';
import type { ContainerState, TabState } from '../model/types.js';

/** A tab rendered by the fake engine. */
export interface FakeTab<TContent = unknown> {
  id: string;
  content: TContent;
  tab: TabState;
  ref: SplitWindowRef;
  adapterOptions: unknown;
  containerKey: string | null;
  active: boolean;
  destroyed: boolean;
  /** Inputs received through `setInputs`, merged. */
  inputs: Record<string, unknown>;
}

/** A container rendered by the fake engine. */
export interface FakeContainer {
  key: string;
  mounted: boolean;
  open: boolean;
  expanded: boolean;
}

export type FakeEngineCall = {
  method: keyof SplitWindowEngine;
  /** Container key or tab id the call refers to. */
  target: string;
  index?: number;
  value?: boolean;
};

/**
 * In-memory engine that records every call, for tests of the core and of future adapters.
 */
export class FakeSplitEngine<TContent = unknown, THost = unknown> implements SplitWindowEngine<
  TContent,
  THost,
  unknown
> {
  readonly calls: FakeEngineCall[] = [];
  readonly tabs = new Map<string, FakeTab<TContent>>();
  readonly containers = new Map<string, FakeContainer>();
  cancelDragCount = 0;
  /** Set to make the next `createTab` throw. */
  failNextCreate: Error | null = null;
  /**
   * When `true`, `destroy` returns a promise that stays pending until `finishDestroys()`,
   * like an engine that keeps the tab visible while its container animates out.
   */
  deferDestroy = false;
  private readonly pendingDestroys: (() => void)[] = [];
  /** Controller connected through `connect`. */
  controller: SplitWindowController<TContent, THost, unknown> | null = null;
  /** Keys given to `prepareContainer` / `releaseContainer`, in order. */
  readonly prepared: string[] = [];
  readonly released: string[] = [];

  get connected(): boolean {
    return this.controller !== null;
  }

  connect(controller: SplitWindowController<TContent, THost, unknown>): void {
    this.controller = controller;
  }

  disconnect(): void {
    this.controller = null;
  }

  prepareContainer(container: ContainerState<THost>): void {
    this.prepared.push(container.key);
  }

  releaseContainer(container: ContainerState<THost>): void {
    this.released.push(container.key);
  }

  mountContainer(container: ContainerState<THost>): void {
    this.record('mountContainer', container.key);
    this.containers.set(container.key, {
      key: container.key,
      mounted: true,
      open: false,
      expanded: false,
    });
  }

  unmountContainer(container: ContainerState<THost>): void {
    this.record('unmountContainer', container.key);
    const c = this.containers.get(container.key);
    if (c) c.mounted = false;
  }

  setContainerOpen(container: ContainerState<THost>, open: boolean): void {
    this.record('setContainerOpen', container.key, { value: open });
    const c = this.containers.get(container.key);
    if (c) c.open = open;
  }

  createTab(
    content: TContent,
    tab: TabState,
    ref: SplitWindowRef,
    adapterOptions: unknown,
  ): string {
    this.record('createTab', tab.id);
    if (this.failNextCreate) {
      const error = this.failNextCreate;
      this.failNextCreate = null;
      throw error;
    }
    const instance = { content };
    ref._setComponentInstance(instance);
    this.tabs.set(tab.id, {
      id: tab.id,
      content,
      tab,
      ref,
      adapterOptions,
      containerKey: null,
      active: false,
      destroyed: false,
      inputs: {},
    });
    return tab.id;
  }

  setInputs(handle: unknown, inputs: Readonly<Record<string, unknown>>): void {
    this.record('setInputs', handle as string);
    Object.assign(this.tab(handle).inputs, inputs);
  }

  attach(handle: unknown, container: ContainerState<THost>, index: number): void {
    this.record('attach', handle as string, { index });
    this.tab(handle).containerKey = container.key;
  }

  move(handle: unknown, to: ContainerState<THost>, index: number): void {
    this.record('move', handle as string, { index });
    this.tab(handle).containerKey = to.key;
  }

  activate(handle: unknown): void {
    this.record('activate', handle as string);
    this.tab(handle).active = true;
  }

  deactivate(handle: unknown): void {
    this.record('deactivate', handle as string);
    this.tab(handle).active = false;
  }

  destroy(handle: unknown): void | Promise<void> {
    this.record('destroy', handle as string);
    const tab = this.tab(handle);
    const finish = () => {
      tab.destroyed = true;
      tab.active = false;
      tab.containerKey = null;
    };
    if (!this.deferDestroy) return finish();
    return new Promise<void>((resolve) =>
      this.pendingDestroys.push(() => {
        finish();
        resolve();
      }),
    );
  }

  /** Completes the destroys deferred by `deferDestroy`. */
  finishDestroys(): void {
    for (const finish of this.pendingDestroys.splice(0)) finish();
  }

  setExpanded(container: ContainerState<THost>, expanded: boolean): void {
    this.record('setExpanded', container.key, { value: expanded });
    const c = this.containers.get(container.key);
    if (c) c.expanded = expanded;
  }

  cancelDrag(): void {
    this.record('cancelDrag', '');
    this.cancelDragCount++;
  }

  /** Calls of one method, in order. */
  callsOf(method: keyof SplitWindowEngine): FakeEngineCall[] {
    return this.calls.filter((call) => call.method === method);
  }

  /** Method names in call order, optionally only for one target. */
  sequence(target?: string): string[] {
    return this.calls
      .filter((c) => target === undefined || c.target === target)
      .map((c) => c.method);
  }

  reset(): void {
    this.calls.length = 0;
    this.pendingDestroys.length = 0;
  }

  private tab(handle: unknown): FakeTab<TContent> {
    const tab = this.tabs.get(handle as string);
    if (!tab) throw new Error(`FakeSplitEngine: unknown tab ${String(handle)}`);
    return tab;
  }

  private record(
    method: keyof SplitWindowEngine,
    target: string,
    extra: Partial<FakeEngineCall> = {},
  ): void {
    this.calls.push({ method, target, ...extra });
  }
}
