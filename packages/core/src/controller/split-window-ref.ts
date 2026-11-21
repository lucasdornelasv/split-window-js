import { Observable, Subject, Subscription, asapScheduler, observeOn } from 'rxjs';
import type {
  SplitCloseGuard,
  SplitCloseTrigger,
  SplitMoveGuard,
  SplitWindowOptions,
} from '../model/types.js';
import { formatTabLabel } from '../numbering/tab-group-resolver.js';
import { validateContainerKey } from '../model/validation.js';
import { SplitInvalidOptionError } from '../errors/errors.js';

/** @internal Operations the ref delegates to its controller. */
export interface SplitRefHost {
  _requestClose(
    ref: SplitWindowRef,
    kind: 'close' | 'dismiss',
    value: any,
    trigger: SplitCloseTrigger,
    force: boolean,
  ): Promise<boolean>;
  _activate(ref: SplitWindowRef): void;
  _moveTo(ref: SplitWindowRef, containerKey: string, index: number | undefined): boolean;
  _setTitle(ref: SplitWindowRef, title: string): void;
  _changed(ref: SplitWindowRef): void;
  _setInputs(ref: SplitWindowRef, inputs: Readonly<Record<string, unknown>>): void;
  _isActive(ref: SplitWindowRef): boolean;
}

/** @internal Mutable state of a ref, owned by the controller. */
export interface SplitRefState {
  title: string;
  groupKey: string | null;
  ordinal: number;
  closable: boolean;
  canClose: SplitCloseGuard | null;
  canMove: SplitMoveGuard | null;
  containerKey: string | null;
  status: 'open' | 'closed' | 'rejected';
  createdSeq: number;
  activatedSeq: number;
  closing: Promise<boolean> | null;
  handle: unknown;
}

let nextId = 0;

/** Control of one open tab and its events. */
export class SplitWindowRef<T = unknown> {
  /** Unique, stable while the tab exists. */
  readonly id: string;
  /** Resolves on `close` and rejects on `dismiss`. */
  readonly result: Promise<any>;

  /** @internal */
  readonly _state: SplitRefState;
  private _instance: T | undefined;
  private resolveResult!: (value: any) => void;
  private rejectResult!: (reason: any) => void;

  private readonly closedSubject = new Subject<any>();
  private readonly dismissedSubject = new Subject<any>();
  private readonly closePreventedSubject = new Subject<{
    trigger: SplitCloseTrigger;
    reason?: any;
  }>();
  private readonly hiddenSubject = new Subject<void>();
  private readonly activatedSubject = new Subject<void>();
  private readonly deactivatedSubject = new Subject<void>();
  private readonly titleChangedSubject = new Subject<{ title: string; label: string }>();
  private readonly dragStartedSubject = new Subject<void>();
  private readonly dragEndedSubject = new Subject<{ moved: boolean }>();
  private readonly reorderedSubject = new Subject<{ from: number; to: number }>();
  private readonly containerChangedSubject = new Subject<{
    fromKey: string;
    toKey: string;
    index: number;
    label: string;
  }>();

  readonly closed: Observable<any> = this.closedSubject.asObservable();
  readonly dismissed: Observable<any> = this.dismissedSubject.asObservable();
  readonly closePrevented = this.closePreventedSubject.asObservable();
  readonly hidden: Observable<void> = this.hiddenSubject.asObservable();
  readonly activated: Observable<void> = this.activatedSubject.asObservable();
  readonly deactivated: Observable<void> = this.deactivatedSubject.asObservable();
  readonly titleChanged = this.titleChangedSubject.asObservable();
  readonly dragStarted: Observable<void> = this.dragStartedSubject.asObservable();
  readonly dragEnded = this.dragEndedSubject.asObservable();
  readonly reordered = this.reorderedSubject.asObservable();
  readonly containerChanged = this.containerChangedSubject.asObservable();

  /** @internal Created by the controller. */
  constructor(
    private readonly host: SplitRefHost,
    options: Required<Pick<SplitWindowOptions, 'title' | 'closable'>> & SplitWindowOptions,
    createdSeq: number,
  ) {
    this.id = `split-tab-${++nextId}`;
    this._state = {
      title: options.title,
      groupKey: options.groupKey ?? null,
      ordinal: 1,
      closable: options.closable,
      canClose: options.canClose ?? null,
      canMove: options.canMove ?? null,
      containerKey: null,
      status: 'open',
      createdSeq,
      activatedSeq: 0,
      closing: null,
      handle: undefined,
    };
    this.result = new Promise((resolve, reject) => {
      this.resolveResult = resolve;
      this.rejectResult = reject;
    });
    // As in ng-bootstrap: no "Uncaught (in promise)" for callers that ignore `result`.
    this.result.then(undefined, () => {});
  }

  /** Instance created by the engine (the component in Angular; `undefined` for templates). */
  get componentInstance(): T | undefined {
    return this._instance;
  }

  /** `true` when `open()` was cancelled by `onReject: 'cancel'`. */
  get rejected(): boolean {
    return this._state.status === 'rejected';
  }

  /** Current container, or `null` after closing or when rejected. */
  get containerKey(): string | null {
    return this._state.containerKey;
  }

  get title(): string {
    return this._state.title;
  }

  /** Title with the number, as shown in the strip. */
  get label(): string {
    return formatTabLabel(this._state.title, this._state.ordinal);
  }

  get groupKey(): string | null {
    return this._state.groupKey;
  }

  get ordinal(): number {
    return this._state.ordinal;
  }

  get closable(): boolean {
    return this._state.closable;
  }

  /** Whether a `canClose` is set. */
  get hasCanClose(): boolean {
    return this._state.canClose !== null;
  }

  get isOpen(): boolean {
    return this._state.status === 'open';
  }

  get isActive(): boolean {
    return this.isOpen && this.host._isActive(this);
  }

  /** Closes the tab and resolves `result`. Resolves with `true` if the tab closed. */
  close(result?: any, options?: { force?: boolean }): Promise<boolean> {
    return this.host._requestClose(this, 'close', result, 'close', !!options?.force);
  }

  /** Closes the tab and rejects `result`. Resolves with `true` if the tab closed. */
  dismiss(reason?: any, options?: { force?: boolean }): Promise<boolean> {
    return this.host._requestClose(this, 'dismiss', reason, 'dismiss', !!options?.force);
  }

  /** Activates the tab in its current container. */
  activate(): void {
    if (this.isOpen) this.host._activate(this);
  }

  /**
   * Moves the tab. Without `index`, to the end of the strip. Returns `true` when the tab
   * changed place, `false` when the destination refused it.
   */
  moveTo(containerKey: string, index?: number): boolean {
    if (!this.isOpen) return false;
    validateContainerKey(containerKey);
    return this.host._moveTo(this, containerKey, index);
  }

  /** Changes the title. The tab moves to the new group + title pair and gets a new number. */
  setTitle(title: string): void {
    if (typeof title !== 'string') throw new SplitInvalidOptionError('title', title, 'texto');
    if (this.isOpen && title !== this._state.title) this.host._setTitle(this, title);
  }

  setClosable(closable: boolean): void {
    if (!this.isOpen || this._state.closable === !!closable) return;
    this._state.closable = !!closable;
    this.host._changed(this);
  }

  setCanClose(guard: SplitCloseGuard | null): void {
    if (!this.isOpen) return;
    if (guard !== null && typeof guard !== 'function') {
      throw new SplitInvalidOptionError('canClose', guard, 'função ou null');
    }
    this._state.canClose = guard;
    this.host._changed(this);
  }

  setCanMove(guard: SplitMoveGuard | null): void {
    if (!this.isOpen) return;
    this._state.canMove = guard;
  }

  /**
   * Updates inputs of the open content (in Angular, `setInput` on the component). Only names
   * the content declares are applied and `undefined` values are skipped; the rest is ignored.
   * Does nothing for closed tabs, templates or a `null`/`undefined` argument.
   */
  setInputData(data: Readonly<Record<string, unknown>> | null | undefined): void {
    if (data == null || !this.isOpen) return;
    if (typeof data !== 'object' || Array.isArray(data)) {
      throw new SplitInvalidOptionError('inputs', data, 'objeto');
    }
    this.host._setInputs(this, data);
  }

  /**
   * Ties the tab to `subscription`, both ways:
   * - when the tab is dismissed, or hidden after `close`, `subscription` is unsubscribed;
   * - when `subscription` is unsubscribed while the tab is open, the tab is dismissed (going
   *   through `canClose`).
   *
   * Returns the link: unsubscribing it undoes the tie without touching either side. Attaching
   * to a closed subscription dismisses the tab at once; attaching a finished tab unsubscribes
   * `subscription` at once.
   */
  attachTo(subscription: Subscription): Subscription {
    if (typeof subscription?.add !== 'function' || typeof subscription.remove !== 'function') {
      throw new SplitInvalidOptionError('subscription', subscription, 'Subscription do RxJS');
    }
    const end = () => subscription.unsubscribe();
    const watchers = new Subscription();
    watchers.add(this.dismissed.subscribe(end));
    // `hidden` completes right after it emits, and at once for a tab that already finished.
    watchers.add(this.hidden.subscribe({ complete: end }));
    const dismissTab = () => {
      if (this.isOpen) void this.dismiss();
    };
    subscription.add(watchers);
    subscription.add(dismissTab);
    const link = new Subscription(() => {
      subscription.remove(watchers);
      subscription.remove(dismissTab);
      watchers.unsubscribe();
    });
    subscription.add(link);
    return link;
  }

  /**
   * The tab as a request: emits the `close` result and completes; completes without a value
   * on `dismiss` (or when the open was rejected). Unsubscribing before that dismisses the tab
   * (see `attachTo`). Values arrive on the `asapScheduler`.
   */
  asRequest<R = any>(): Observable<R> {
    return new Observable<R>((subscriber) => {
      if (!this.isOpen) {
        // Closed or rejected already: answer from the result.
        this.result.then(
          (value: R) => {
            subscriber.next(value);
            subscriber.complete();
          },
          () => subscriber.complete(),
        );
        return;
      }
      // Subscribed before `attachTo`, so these run first when the tab closes. They cannot run
      // before `link` exists: the subjects do not replay.
      const settle = (emit: boolean, value?: R) => {
        link.unsubscribe(); // the request ends with the tab: no dismiss on teardown
        if (emit) subscriber.next(value as R);
        subscriber.complete();
      };
      subscriber.add(this.closed.subscribe((value: R) => settle(true, value)));
      subscriber.add(this.dismissed.subscribe(() => settle(false)));
      const link = this.attachTo(subscriber);
    }).pipe(observeOn(asapScheduler));
  }

  /** @internal */
  _setComponentInstance(instance: T | undefined): void {
    this._instance = instance;
  }

  /** @internal */
  _emit(event: 'activated' | 'deactivated' | 'dragStarted'): void {
    if (event === 'activated') this.activatedSubject.next();
    else if (event === 'deactivated') this.deactivatedSubject.next();
    else this.dragStartedSubject.next();
  }

  /** @internal */
  _emitTitleChanged(): void {
    this.titleChangedSubject.next({ title: this.title, label: this.label });
  }

  /** @internal */
  _emitDragEnded(moved: boolean): void {
    this.dragEndedSubject.next({ moved });
  }

  /** @internal */
  _emitReordered(from: number, to: number): void {
    this.reorderedSubject.next({ from, to });
  }

  /** @internal */
  _emitContainerChanged(fromKey: string, toKey: string, index: number): void {
    this.containerChangedSubject.next({ fromKey, toKey, index, label: this.label });
  }

  /** @internal */
  _emitClosePrevented(trigger: SplitCloseTrigger, reason: any): void {
    this.closePreventedSubject.next({ trigger, reason });
  }

  /** @internal Marks the ref as closed and settles `result`. */
  _settle(kind: 'close' | 'dismiss', value: any): void {
    this._state.status = 'closed';
    this._state.containerKey = null;
    if (kind === 'close') {
      this.closedSubject.next(value);
      this.resolveResult(value);
    } else {
      this.dismissedSubject.next(value);
      this.rejectResult(value);
    }
  }

  /** @internal Emits `hidden` and completes every observable. */
  _finish(): void {
    this.hiddenSubject.next();
    for (const subject of [
      this.closedSubject,
      this.dismissedSubject,
      this.closePreventedSubject,
      this.hiddenSubject,
      this.activatedSubject,
      this.deactivatedSubject,
      this.titleChangedSubject,
      this.dragStartedSubject,
      this.dragEndedSubject,
      this.reorderedSubject,
      this.containerChangedSubject,
    ] as Subject<unknown>[]) {
      subject.complete();
    }
  }

  /** @internal The open was cancelled by `onReject: 'cancel'`. */
  _markRejected(): void {
    this._state.status = 'rejected';
    this.rejectResult('container-full');
    this._finish();
  }
}
