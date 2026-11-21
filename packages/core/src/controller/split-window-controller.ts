import { Subject, isObservable, firstValueFrom, type Observable, type Subscription } from 'rxjs';
import type { SplitWindowEngine } from '../engine/split-window-engine.js';
import { SplitContainerFullError } from '../errors/errors.js';
import {
  mergeSplitWindowConfig,
  type SplitCapacityContext,
  type SplitCloseAllResult,
  type SplitCloseGuard,
  type SplitCloseTrigger,
  type SplitContainerStateChange,
  type SplitContainerView,
  type SplitDismissAllOptions,
  type SplitTabMovedEvent,
  type SplitTabRejectedEvent,
  type SplitWindowConfig,
  type SplitWindowConfigInput,
  type SplitWindowOptions,
  type TabState,
} from '../model/types.js';
import { validateWindowOptions } from '../model/validation.js';
import { pickReplacement, resolveReject, isFull } from '../policies/capacity.js';
import {
  ContainerRecord,
  type RegistryEvent,
  type SplitContainerRegistry,
} from '../registry/split-container-registry.js';
import { SplitContainerStack } from '../stack/split-container-stack.js';
import { isPromiseLike } from '../utils/promise.js';
import { SplitWindowRef, type SplitRefHost } from './split-window-ref.js';

/** Where a move request comes from. Drags respect the expanded-container restriction. */
export type SplitMoveSource = 'drag' | 'api';

/** A container that can receive the dragged tab. */
export interface SplitDropTarget<THost = unknown> {
  key: string;
  container: ContainerRecord<THost>;
}

/**
 * Organizes opening, rules, numbering, limits, closing and moving, and calls the engine.
 * One controller per application.
 */
export class SplitWindowController<
  TContent = unknown,
  THost = unknown,
  TAdapterOptions = unknown,
> implements SplitRefHost {
  readonly config: SplitWindowConfig;
  private readonly changesSubject = new Subject<string>();
  private readonly tabMovedSubject = new Subject<SplitTabMovedEvent>();
  private readonly tabRejectedSubject = new Subject<SplitTabRejectedEvent>();
  private readonly stateSubject = new Subject<SplitContainerStateChange>();
  private readonly closingAll = new Map<string, number>();
  private readonly removing = new Set<ContainerRecord<THost>>();
  private readonly registrySubscription: Subscription;
  private seq = 0;
  private dragging: SplitWindowRef | null = null;
  private dragCancelled = false;

  /** Key of a container whose state changed (tabs, labels, active tab, open, expanded...). */
  readonly changes: Observable<string> = this.changesSubject.asObservable();
  /** Any `reordered` or `containerChanged`. */
  readonly tabMoved: Observable<SplitTabMovedEvent> = this.tabMovedSubject.asObservable();
  /** A tab refused by the tab limit. */
  readonly tabRejected: Observable<SplitTabRejectedEvent> = this.tabRejectedSubject.asObservable();
  /** Container opened, closed, expanded or restored. */
  readonly containerStateChanged: Observable<SplitContainerStateChange> =
    this.stateSubject.asObservable();

  constructor(
    readonly registry: SplitContainerRegistry<THost>,
    readonly engine: SplitWindowEngine<TContent, THost, TAdapterOptions>,
    config?: SplitWindowConfigInput,
  ) {
    this.config = mergeSplitWindowConfig(config);
    this.registrySubscription = registry._events.subscribe((event) => this.onRegistryEvent(event));
    engine.connect?.(this);
    for (const record of registry._all()) engine.prepareContainer?.(record);
  }

  // ---------------------------------------------------------------- container state

  isContainerOpen(key: string): boolean {
    return this.registry._get(key)?.open ?? false;
  }

  isContainerExpanded(key: string): boolean {
    return this.registry._get(key)?.expanded ?? false;
  }

  /** Key of the expanded container, if any. */
  getExpandedContainer(): string | null {
    for (const record of this.registry._all()) if (record.expanded) return record.key;
    return null;
  }

  /**
   * Expands a container, restoring the one that was expanded. Ignored when the container
   * is closed or has `expand: false`.
   */
  expandContainer(key: string): void {
    const record = this.registry.assertExists(key);
    if (record.expanded || !record.open || record.options.expand === false) return;
    const current = this.getExpandedContainer();
    if (current) this.restoreContainer(current);
    this.setExpanded(record, true);
  }

  restoreContainer(key: string): void {
    const record = this.registry.assertExists(key);
    if (record.expanded) this.setExpanded(record, false);
  }

  // ---------------------------------------------------------------- opening

  /** Opens a tab. Resolves the container, applies the tab limit and asks the engine to create it. */
  open(
    content: TContent,
    options: SplitWindowOptions = {},
    adapterOptions?: TAdapterOptions,
  ): SplitWindowRef {
    validateWindowOptions(options);
    const ref = new SplitWindowRef(
      this,
      {
        ...options,
        title: options.title ?? this.config.labels.defaultTitle,
        closable: options.closable ?? this.config.closable,
      },
      ++this.seq,
    );
    let key = this.registry.resolveKey(options.containerKey);
    const tried: string[] = [];

    for (;;) {
      tried.push(key);
      const record = this.registry.assertExists(key);
      const stack = this.ensureStack(record);
      const ctx: SplitCapacityContext = {
        containerKey: key,
        tabs: stack.tabs,
        incoming: { ...options, title: ref.title },
        source: 'open',
      };
      if (!isFull(record, ctx)) break;
      const victim = pickReplacement(record, ctx);
      if (victim) {
        this.finalizeClose(victim, 'dismiss', 'replaced');
        break;
      }
      const decision = resolveReject(record, ctx, this.registry.getDefaultContainer());
      if (decision.action === 'throw') {
        this.tabRejectedSubject.next({ context: ctx, resolution: 'throw' });
        throw new SplitContainerFullError(key, tried);
      }
      if (decision.action === 'cancel') {
        this.tabRejectedSubject.next({ context: ctx, resolution: 'cancel' });
        ref._markRejected();
        return ref;
      }
      this.tabRejectedSubject.next({
        context: ctx,
        resolution: 'redirect',
        redirectTo: decision.containerKey ?? undefined,
      });
      if (decision.containerKey === null || tried.includes(decision.containerKey)) {
        throw new SplitContainerFullError(key, tried);
      }
      key = this.registry.assertExists(decision.containerKey).key;
    }

    this.placeNewTab(ref, this.registry.assertExists(key), content, adapterOptions, options);
    return ref;
  }

  private placeNewTab(
    ref: SplitWindowRef,
    record: ContainerRecord<THost>,
    content: TContent,
    adapterOptions: TAdapterOptions | undefined,
    options: SplitWindowOptions,
  ): void {
    const stack = this.ensureStack(record);
    const wasEmpty = stack.size === 0;
    const state = ref._state;
    state.containerKey = record.key;
    state.ordinal = stack.numbering.reserve(state.groupKey, state.title);
    const index = stack.insert(ref);
    try {
      this.ensureMounted(record);
      state.handle = this.engine.createTab(content, this.tabState(ref), ref, adapterOptions);
      this.engine.attach(state.handle, record, index);
    } catch (error) {
      stack.remove(ref);
      stack.numbering.release(state.groupKey, state.title, state.ordinal);
      state.containerKey = null;
      state.status = 'closed';
      throw error;
    }
    this.openContainer(record);
    if ((options.activate ?? this.config.activate) || wasEmpty) this.activateRef(ref);
    this.emitChange(record.key);
  }

  // ---------------------------------------------------------------- queries

  /** Whether a container (or any container) has open tabs. */
  hasOpenWindows(containerKey?: string): boolean {
    if (containerKey !== undefined) return (this.registry._get(containerKey)?.stack?.size ?? 0) > 0;
    return this.registry._all().some((record) => (record.stack?.size ?? 0) > 0);
  }

  /** Open tabs of a container, in strip order. */
  getTabs(containerKey: string): readonly SplitWindowRef[] {
    return this.registry._get(containerKey)?.stack?.tabs ?? [];
  }

  /** Immutable snapshot of a container for rendering, or `null` if it does not exist. */
  getContainerView(key: string): SplitContainerView<THost> | null {
    const record = this.registry._get(key);
    if (!record) return null;
    const stack = record.stack;
    const activeId = stack?.activeId ?? null;
    return {
      key,
      container: record,
      activeId,
      closingAll: (this.closingAll.get(key) ?? 0) > 0,
      canExpand: record.options.expand !== false,
      dragging: this.dragging !== null,
      tabs: (stack?.tabs ?? []).map((ref) => ({
        id: ref.id,
        title: ref.title,
        label: ref.label,
        closable: ref.closable,
        active: ref.id === activeId,
        ref,
      })),
    };
  }

  /** @internal */
  _isActive(ref: SplitWindowRef): boolean {
    const key = ref.containerKey;
    return key !== null && this.registry._get(key)?.stack?.activeId === ref.id;
  }

  // ---------------------------------------------------------------- activation

  /** @internal */
  _activate(ref: SplitWindowRef): void {
    this.activateRef(ref);
  }

  private activateRef(ref: SplitWindowRef): void {
    const record = ref.containerKey ? this.registry._get(ref.containerKey) : undefined;
    const stack = record?.stack;
    if (!record || !stack || stack.activeId === ref.id) return;
    const previous = stack.active;
    if (previous) {
      this.engine.deactivate(previous._state.handle);
      previous._emit('deactivated');
    }
    stack.activeId = ref.id;
    ref._state.activatedSeq = ++this.seq;
    this.engine.activate(ref._state.handle);
    ref._emit('activated');
    this.emitChange(record.key);
  }

  // ---------------------------------------------------------------- titles and flags

  /** @internal */
  _setTitle(ref: SplitWindowRef, title: string): void {
    const stack = this.stackOf(ref);
    const state = ref._state;
    if (stack) stack.numbering.release(state.groupKey, state.title, state.ordinal);
    state.title = title;
    state.ordinal = stack ? stack.numbering.reserve(state.groupKey, title) : 1;
    ref._emitTitleChanged();
    if (state.containerKey) this.emitChange(state.containerKey);
  }

  /** @internal */
  _changed(ref: SplitWindowRef): void {
    if (ref.containerKey) this.emitChange(ref.containerKey);
  }

  /** @internal */
  _setInputs(ref: SplitWindowRef, inputs: Readonly<Record<string, unknown>>): void {
    this.engine.setInputs?.(ref._state.handle, inputs);
  }

  // ---------------------------------------------------------------- closing

  /**
   * Close request from the strip (the tab X button). Goes through `canClose`.
   */
  requestTabClose(ref: SplitWindowRef): Promise<boolean> {
    return this._requestClose(ref, 'dismiss', 'tab-button', 'tab-button', false);
  }

  /** @internal */
  _requestClose(
    ref: SplitWindowRef,
    kind: 'close' | 'dismiss',
    value: any,
    trigger: SplitCloseTrigger,
    force: boolean,
  ): Promise<boolean> {
    if (!ref.isOpen) return Promise.resolve(false);
    if (force) {
      this.finalizeClose(ref, kind, value);
      return Promise.resolve(true);
    }
    const state = ref._state;
    if (state.closing) return state.closing;
    const guard = state.canClose;
    if (!guard) {
      this.finalizeClose(ref, kind, value);
      return Promise.resolve(true);
    }
    const verdict = evaluateGuard(guard, { ref, trigger, reason: value });
    const settle = (ok: boolean): boolean => {
      state.closing = null;
      if (!ref.isOpen) return true; // closed with `force` meanwhile
      if (ok) {
        this.finalizeClose(ref, kind, value);
        return true;
      }
      ref._emitClosePrevented(trigger, value);
      return false;
    };
    if (typeof verdict === 'boolean') return Promise.resolve(settle(verdict));
    state.closing = verdict.then(settle);
    return state.closing;
  }

  /**
   * Closes the tabs of one container (or of all containers) in sequence. Tabs with
   * `closable: false` are skipped; tabs with `canClose` are activated and awaited.
   */
  async dismissAll(options: SplitDismissAllOptions = {}): Promise<SplitCloseAllResult> {
    const records =
      options.containerKey !== undefined
        ? [this.registry.assertExists(options.containerKey)]
        : this.registry._all();
    const snapshot = records.flatMap((record) => [...(record.stack?.tabs ?? [])]);
    const keys = records.map((record) => record.key);
    for (const key of keys) {
      this.closingAll.set(key, (this.closingAll.get(key) ?? 0) + 1);
      this.emitChange(key);
    }
    const result: SplitCloseAllResult = { closed: [], kept: [] };
    try {
      for (const ref of snapshot) {
        if (!ref.isOpen) continue;
        if (!ref.closable) {
          result.kept.push(ref);
          continue;
        }
        if (options.force || !ref.hasCanClose) {
          this.finalizeClose(ref, 'dismiss', options.reason);
          result.closed.push(ref);
          continue;
        }
        this.activateRef(ref);
        const closed = await this._requestClose(ref, 'dismiss', options.reason, 'close-all', false);
        (closed ? result.closed : result.kept).push(ref);
      }
    } finally {
      for (const key of keys) {
        const count = (this.closingAll.get(key) ?? 1) - 1;
        if (count > 0) this.closingAll.set(key, count);
        else this.closingAll.delete(key);
        this.emitChange(key);
      }
    }
    return result;
  }

  /** Whether a "close all" is running on a container. */
  isClosingAll(containerKey: string): boolean {
    return (this.closingAll.get(containerKey) ?? 0) > 0;
  }

  private finalizeClose(ref: SplitWindowRef, kind: 'close' | 'dismiss', value: any): void {
    if (!ref.isOpen) return;
    const state = ref._state;
    const record = state.containerKey ? this.registry._get(state.containerKey) : undefined;
    const stack = record?.stack;
    let neighbor: SplitWindowRef | null = null;
    if (record && stack) {
      const { index, wasActive } = stack.remove(ref);
      stack.numbering.release(state.groupKey, state.title, state.ordinal);
      if (wasActive) neighbor = stack.neighborOf(index);
    }
    ref._settle(kind, value); // closed/dismissed: before destroying
    if (neighbor) this.activateRef(neighbor);
    // The last tab of a `closeWhenEmpty` container: hide the container first, so an animated
    // engine keeps the tab visible while the container leaves and destroys it at the end.
    // Checked after `_settle`: a `closed` handler may have opened another tab here.
    if (
      record &&
      stack &&
      stack.size === 0 &&
      record.closeWhenEmpty &&
      !this.removing.has(record)
    ) {
      this.closeContainer(record);
    }
    const handle = state.handle;
    state.handle = undefined;
    const destroyed = this.engine.destroy(handle);
    if (isPromiseLike(destroyed)) {
      const finish = () => ref._finish(); // hidden: after destroying
      destroyed.then(finish, finish);
    } else {
      ref._finish(); // hidden: after destroying
    }
    if (record && stack) this.emitChange(record.key);
  }

  // ---------------------------------------------------------------- moving

  /**
   * Whether the tab can be dropped on a container. Applies `canMove`, `maxTabs` (with
   * `source: 'move'`) and, for drags, the expanded-container restriction. No side effects.
   */
  canDrop(
    ref: SplitWindowRef,
    targetKey: string,
    index?: number,
    source: SplitMoveSource = 'drag',
  ): boolean {
    if (!ref.isOpen || ref.containerKey === null) return false;
    const target = this.registry._get(targetKey);
    if (!target) return false;
    if (source === 'drag' && this.dragCancelled) return false;
    if (source === 'drag') {
      const expanded = this.getExpandedContainer();
      if (expanded !== null && (ref.containerKey !== expanded || targetKey !== expanded)) {
        return false;
      }
    }
    const canMove = ref._state.canMove;
    if (
      canMove &&
      !canMove(
        index === undefined ? { containerKey: targetKey } : { containerKey: targetKey, index },
      )
    ) {
      return false;
    }
    if (targetKey === ref.containerKey) return true;
    const ctx = this.moveContext(target, ref);
    return !isFull(target, ctx) || pickReplacement(target, ctx) !== null;
  }

  /** @internal */
  _moveTo(ref: SplitWindowRef, containerKey: string, index: number | undefined): boolean {
    this.registry.assertExists(containerKey);
    return this.moveTab(ref, containerKey, index, 'api');
  }

  /**
   * Moves a tab without destroying it: reorders inside the container or moves to another one.
   * Returns `true` when the tab changed place.
   */
  moveTab(
    ref: SplitWindowRef,
    targetKey: string,
    index?: number,
    source: SplitMoveSource = 'api',
  ): boolean {
    if (!ref.isOpen || ref.containerKey === null) return false;
    const target = this.registry._get(targetKey);
    const from = this.registry._get(ref.containerKey);
    if (!target || !from?.stack) return false;
    if (source === 'drag') {
      if (this.dragCancelled) return false;
      const expanded = this.getExpandedContainer();
      if (expanded !== null && (from.key !== expanded || targetKey !== expanded)) return false;
    }
    const canMove = ref._state.canMove;
    if (
      canMove &&
      !canMove(
        index === undefined ? { containerKey: targetKey } : { containerKey: targetKey, index },
      )
    ) {
      return false;
    }

    const fromStack = from.stack;
    const fromIndex = fromStack.indexOf(ref);

    if (target === from) {
      const { from: f, to } = fromStack.move(ref, index ?? fromStack.size - 1);
      if (f === to) return false;
      ref._emitReordered(f, to);
      this.tabMovedSubject.next({
        ref,
        type: 'reordered',
        fromKey: from.key,
        toKey: from.key,
        fromIndex: f,
        toIndex: to,
        label: ref.label,
      });
      this.emitChange(from.key);
      return true;
    }

    const ctx = this.moveContext(target, ref);
    if (isFull(target, ctx)) {
      const victim = pickReplacement(target, ctx);
      if (!victim) {
        this.tabRejectedSubject.next({ context: ctx, resolution: 'move-refused' });
        return false;
      }
      this.finalizeClose(victim, 'dismiss', 'replaced');
    }

    const state = ref._state;
    const previousLabel = ref.label;
    const { index: removedAt, wasActive } = fromStack.remove(ref);
    fromStack.numbering.release(state.groupKey, state.title, state.ordinal);

    const targetStack = this.ensureStack(target);
    this.ensureMounted(target);
    const toIndex = targetStack.insert(ref, index);
    state.ordinal = targetStack.numbering.reserve(state.groupKey, state.title);
    state.containerKey = target.key;
    this.engine.move(state.handle, target, toIndex);
    this.openContainer(target);

    if (wasActive) {
      const neighbor = fromStack.neighborOf(removedAt);
      if (neighbor) this.activateRef(neighbor);
    }
    this.activateRef(ref);
    if (fromStack.size === 0 && from.closeWhenEmpty) {
      // Render the empty source first: a hiding animation must not show the tab that left.
      this.emitChange(from.key);
      this.closeContainer(from);
    }

    if (ref.label !== previousLabel) ref._emitTitleChanged();
    ref._emitContainerChanged(from.key, target.key, toIndex);
    this.tabMovedSubject.next({
      ref,
      type: 'containerChanged',
      fromKey: from.key,
      toKey: target.key,
      fromIndex,
      toIndex,
      label: ref.label,
    });
    this.emitChange(from.key);
    this.emitChange(target.key);
    return true;
  }

  /** Containers (other than the tab's own) that can receive the dragged tab right now. */
  getDropTargets(ref: SplitWindowRef): SplitDropTarget<THost>[] {
    return this.registry
      ._all()
      .filter((record) => record.key !== ref.containerKey && this.canDrop(ref, record.key))
      .map((record) => ({ key: record.key, container: record }));
  }

  /** The engine reports the start of a drag. */
  beginDrag(ref: SplitWindowRef): void {
    this.dragging = ref;
    this.dragCancelled = false;
    ref._emit('dragStarted');
    this.emitAll();
  }

  /** The engine reports the end of a drag (valid or cancelled). */
  endDrag(ref: SplitWindowRef, moved: boolean): void {
    if (this.dragging !== ref) return;
    this.dragging = null;
    this.dragCancelled = false;
    if (ref.isOpen) ref._emitDragEnded(moved);
    this.emitAll();
  }

  /** The tab being dragged, if any. */
  get draggingTab(): SplitWindowRef | null {
    return this.dragging;
  }

  // ---------------------------------------------------------------- lifecycle

  /** Completes the observables and stops listening to the registry. */
  destroy(): void {
    this.registrySubscription.unsubscribe();
    this.engine.disconnect?.();
    this.changesSubject.complete();
    this.tabMovedSubject.complete();
    this.tabRejectedSubject.complete();
    this.stateSubject.complete();
  }

  // ---------------------------------------------------------------- helpers

  private onRegistryEvent(event: RegistryEvent<THost>): void {
    const { record } = event;
    switch (event.type) {
      case 'registered':
        this.engine.prepareContainer?.(record);
        break;
      case 'removing': {
        this.removing.add(record);
        try {
          for (const ref of [...(record.stack?.tabs ?? [])]) {
            this.finalizeClose(ref, 'dismiss', 'container-removed');
          }
        } finally {
          this.removing.delete(record);
        }
        if (record.mounted) {
          this.engine.unmountContainer(record);
          record.mounted = false;
        }
        this.engine.releaseContainer?.(record);
        record.stack = null;
        const changed = record.open || record.expanded;
        record.open = false;
        record.expanded = false;
        if (changed) this.emitState(record);
        break;
      }
      case 'updated':
        this.emitChange(record.key);
        break;
    }
  }

  private setExpanded(record: ContainerRecord<THost>, expanded: boolean): void {
    record.expanded = expanded;
    if (record.mounted) this.engine.setExpanded(record, expanded);
    if (this.dragging) {
      this.dragCancelled = true;
      this.engine.cancelDrag();
    }
    this.emitChange(record.key);
    this.emitState(record);
  }

  private setOpen(record: ContainerRecord<THost>, open: boolean): void {
    if (record.open === open) return;
    if (!open && record.expanded) this.setExpanded(record, false);
    record.open = open;
    this.emitState(record);
  }

  private emitState(record: ContainerRecord<THost>): void {
    this.stateSubject.next({ key: record.key, open: record.open, expanded: record.expanded });
  }

  private moveContext(target: ContainerRecord<THost>, ref: SplitWindowRef): SplitCapacityContext {
    return {
      containerKey: target.key,
      tabs: target.stack?.tabs ?? [],
      incoming: {
        title: ref.title,
        ...(ref.groupKey !== null ? { groupKey: ref.groupKey } : {}),
        closable: ref.closable,
      },
      incomingRef: ref,
      source: 'move',
    };
  }

  private ensureStack(record: ContainerRecord<THost>): SplitContainerStack {
    return (record.stack ??= new SplitContainerStack());
  }

  private ensureMounted(record: ContainerRecord<THost>): void {
    if (record.mounted) return;
    this.engine.mountContainer(record);
    record.mounted = true;
  }

  private openContainer(record: ContainerRecord<THost>): void {
    if (record.open) return;
    this.setOpen(record, true);
    this.engine.setContainerOpen(record, true);
  }

  private closeContainer(record: ContainerRecord<THost>): void {
    if (!record.open) return;
    this.setOpen(record, false); // restores it first when expanded
    this.engine.setContainerOpen(record, false);
  }

  private stackOf(ref: SplitWindowRef): SplitContainerStack | null {
    return ref.containerKey ? (this.registry._get(ref.containerKey)?.stack ?? null) : null;
  }

  private tabState(ref: SplitWindowRef): TabState {
    return {
      id: ref.id,
      title: ref.title,
      label: ref.label,
      groupKey: ref.groupKey,
      ordinal: ref.ordinal,
      closable: ref.closable,
      containerKey: ref.containerKey!,
    };
  }

  private emitChange(key: string): void {
    this.changesSubject.next(key);
  }

  private emitAll(): void {
    for (const record of this.registry._all()) if (record.mounted) this.emitChange(record.key);
  }
}

/**
 * Runs a `canClose`. Returns a boolean synchronously when the guard did, or a promise.
 * Errors, rejections and Observables that complete without a value keep the tab open.
 */
export function evaluateGuard(
  guard: SplitCloseGuard,
  ctx: Parameters<SplitCloseGuard>[0],
): boolean | Promise<boolean> {
  const logAndKeep = (error: unknown): boolean => {
    console.error('[split-window] canClose falhou; a aba continua aberta.', error);
    return false;
  };
  let verdict: ReturnType<SplitCloseGuard>;
  try {
    verdict = guard(ctx);
  } catch (error) {
    return logAndKeep(error);
  }
  if (typeof verdict === 'boolean') return verdict;
  if (isObservable(verdict)) {
    return firstValueFrom(verdict, { defaultValue: false }).then((v) => v === true, logAndKeep);
  }
  if (verdict && typeof (verdict as PromiseLike<boolean>).then === 'function') {
    return Promise.resolve(verdict).then((v) => v === true, logAndKeep);
  }
  return false;
}

// The core targets ES2022 without DOM or Node types; `console` exists in every runtime.
declare const console: { error(...args: unknown[]): void };
