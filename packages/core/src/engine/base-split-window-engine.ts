import { Subject, type Observable } from 'rxjs';
import {
  NoopSplitAnimationEngine,
  type SplitAbortSignal,
  type SplitAnimationContext,
  type SplitAnimationEngine,
} from '../animation/animation-engine.js';
import type { SplitWindowController } from '../controller/split-window-controller.js';
import type { SplitWindowRef } from '../controller/split-window-ref.js';
import type { ContainerState, TabState } from '../model/types.js';
import { isPromiseLike } from '../utils/promise.js';
import type { SplitWindowEngine, TabHandle } from './split-window-engine.js';

/** A show/hide transition of a container. */
export interface SplitContainerTransitionEvent {
  key: string;
  phase: 'show' | 'hide';
  /** `running` follows `started()` and each `progress()` of the animation engine. */
  state: 'start' | 'running' | 'done' | 'cancelled';
  progress?: number;
}

/**
 * What the adapter gives to animate one transition: the animation engine and the context
 * fields it measures (elements, frames, options...). The base engine adds the rest.
 */
export interface SplitTransitionPlan<TElement = unknown> {
  engine: SplitAnimationEngine<TElement> | null;
  context: Omit<
    SplitAnimationContext<TElement>,
    'phase' | 'container' | 'signal' | 'started' | 'progress' | 'reducedMotion'
  >;
}

class SplitAbortController implements SplitAbortSignal {
  aborted = false;
  private listeners: (() => void)[] = [];

  addEventListener(_type: 'abort', listener: () => void): void {
    if (this.aborted) listener();
    else this.listeners.push(listener);
  }

  abort(): void {
    if (this.aborted) return;
    this.aborted = true;
    for (const listener of this.listeners.splice(0)) listener();
  }
}

interface RunningTransition<THost, TElement> {
  phase: 'show' | 'hide';
  container: ContainerState<THost>;
  signal: SplitAbortController;
  engine: SplitAnimationEngine<TElement> | null;
  ctx: SplitAnimationContext<TElement> | null;
}

/**
 * Base of the adapter engines. Runs the show/hide transitions of the containers through
 * the animation engines: interrupts a running transition when another one starts, keeps
 * the tabs closed while their container hides on screen until the end (`destroy` returns
 * a promise), and emits every step on `transitions`.
 *
 * The adapter implements the rendering (`mountContainer`, `createTab`...) and the hooks of
 * the transitions: `isEntered`, `enter`, `leave`, `transitionPlan` and, optionally,
 * `setLeaving`, `setAnimating`, `beforeTransition`, `afterShown`, `afterHidden`.
 *
 * @typeParam TElement - the element type the animation engines receive.
 */
export abstract class BaseSplitWindowEngine<
  TContent = unknown,
  THost = unknown,
  TAdapterOptions = unknown,
  TElement = THost,
> implements SplitWindowEngine<TContent, THost, TAdapterOptions> {
  private connectedController: SplitWindowController<TContent, THost, TAdapterOptions> | null =
    null;
  private readonly running = new Map<string, RunningTransition<THost, TElement>>();
  private readonly deferred = new Map<string, { handle: TabHandle; resolve: () => void }[]>();
  private readonly transitionsSubject = new Subject<SplitContainerTransitionEvent>();
  private lazyNoopEngine: NoopSplitAnimationEngine<TElement> | null = null;

  /** Engine of the reduced-motion transitions, created on first use. */
  private get noopEngine(): NoopSplitAnimationEngine<TElement> {
    return (this.lazyNoopEngine ??= new NoopSplitAnimationEngine<TElement>());
  }

  /** Every container transition: start, progress, end or cancel. */
  readonly transitions: Observable<SplitContainerTransitionEvent> =
    this.transitionsSubject.asObservable();

  connect(controller: SplitWindowController<TContent, THost, TAdapterOptions>): void {
    this.connectedController = controller;
  }

  disconnect(): void {
    for (const key of [...this.running.keys()]) this.completeTransition(key, true);
    this.transitionsSubject.complete();
    this.connectedController = null;
  }

  /** The controller this engine belongs to. Throws before `connect`. */
  protected get controller(): SplitWindowController<TContent, THost, TAdapterOptions> {
    if (!this.connectedController) {
      throw new Error('[split-window] engine used before being connected to a controller');
    }
    return this.connectedController;
  }

  /** Whether a controller is connected. */
  protected get isConnected(): boolean {
    return this.connectedController !== null;
  }

  // ------------------------------------------------------------ rendering (adapter)

  abstract mountContainer(container: ContainerState<THost>): void;
  abstract unmountContainer(container: ContainerState<THost>): void;
  abstract createTab(
    content: TContent,
    tab: TabState,
    ref: SplitWindowRef,
    adapterOptions: TAdapterOptions | undefined,
  ): TabHandle;
  abstract attach(tab: TabHandle, container: ContainerState<THost>, index: number): void;
  abstract move(tab: TabHandle, to: ContainerState<THost>, index: number): void;
  abstract activate(tab: TabHandle): void;
  abstract deactivate(tab: TabHandle): void;
  abstract setExpanded(container: ContainerState<THost>, expanded: boolean): void;
  abstract cancelDrag(): void;

  // ------------------------------------------------------------ transitions

  setContainerOpen(container: ContainerState<THost>, open: boolean): void | Promise<void> {
    if (!this.isMounted(container)) return;
    this.beforeTransition(container);
    this.completeTransition(container.key, true);
    if (open) {
      if (this.isEntered(container)) return;
      this.enter(container);
    } else {
      if (!this.isEntered(container)) {
        this.leave(container);
        return;
      }
      this.setLeaving(container, true);
    }
    return this.runTransition(container, open ? 'show' : 'hide');
  }

  /**
   * Destroys a tab, or keeps it on screen while its container hides and destroys it at the
   * end (the promise resolves then).
   */
  destroy(handle: TabHandle): void | Promise<void> {
    const key = this.containerOfTab(handle);
    if (key !== null && this.running.get(key)?.phase === 'hide') {
      return new Promise<void>((resolve) => {
        const list = this.deferred.get(key) ?? [];
        list.push({ handle, resolve });
        this.deferred.set(key, list);
      });
    }
    this.destroyTab(handle);
  }

  /** Whether a container is running a show or hide transition. */
  isTransitioning(key: string): boolean {
    return this.running.has(key);
  }

  /** Ends the transition of a container at once (for example before unmounting it). */
  protected cancelTransition(key: string): void {
    this.completeTransition(key, true);
    this.flushDeferred(key);
  }

  private runTransition(
    container: ContainerState<THost>,
    phase: 'show' | 'hide',
  ): void | Promise<void> {
    const key = container.key;
    const plan = this.transitionPlan(container, phase);
    const reducedMotion = this.prefersReducedMotion();
    let engine = plan?.engine ?? null;
    // Reduced motion: the noop engine still goes through every step, synchronously.
    if (engine && reducedMotion && plan!.context.options.respectReducedMotion) {
      engine = this.noopEngine;
    }
    const run: RunningTransition<THost, TElement> = {
      phase,
      container,
      signal: new SplitAbortController(),
      engine,
      ctx: null,
    };
    this.running.set(key, run);
    this.emit(key, phase, 'start');
    if (!engine || !plan) {
      this.completeTransition(key, false);
      return;
    }
    const ctx: SplitAnimationContext<TElement> = {
      ...plan.context,
      phase,
      container: container as unknown as ContainerState<TElement>,
      reducedMotion,
      signal: run.signal,
      started: () => {
        if (this.running.get(key) !== run) return;
        this.setAnimating(container, true);
        this.emit(key, phase, 'running');
      },
      progress: (value: number) => {
        if (this.running.get(key) === run) this.emit(key, phase, 'running', value);
      },
    };
    run.ctx = ctx;
    let result: Promise<void> | void;
    try {
      result = engine.animate(ctx);
    } catch (error) {
      this.reportError(error);
      result = undefined;
    }
    const finish = () => {
      if (this.running.get(key) === run) this.completeTransition(key, false);
    };
    if (!isPromiseLike(result)) return finish();
    return Promise.resolve(result)
      .catch((error: unknown) => this.reportError(error))
      .then(finish);
  }

  /** Ends the running transition, at once when `cancelled`, and applies its final state. */
  protected completeTransition(key: string, cancelled: boolean): void {
    const run = this.running.get(key);
    if (!run) return;
    this.running.delete(key);
    if (cancelled) run.signal.abort();
    if (run.engine && run.ctx) {
      try {
        run.engine.cleanup(run.ctx);
      } catch (error) {
        this.reportError(error);
      }
    }
    this.setAnimating(run.container, false);
    if (run.phase === 'hide') {
      this.leave(run.container);
      this.setLeaving(run.container, false);
      this.flushDeferred(key);
      this.afterHidden(run.container);
    } else {
      this.afterShown(run.container);
    }
    this.emit(key, run.phase, cancelled ? 'cancelled' : 'done');
  }

  private flushDeferred(key: string): void {
    const list = this.deferred.get(key);
    if (!list) return;
    this.deferred.delete(key);
    for (const { handle, resolve } of list) {
      this.destroyTab(handle);
      resolve();
    }
  }

  private emit(
    key: string,
    phase: 'show' | 'hide',
    state: SplitContainerTransitionEvent['state'],
    progress?: number,
  ): void {
    this.transitionsSubject.next(
      progress === undefined ? { key, phase, state } : { key, phase, state, progress },
    );
  }

  // ------------------------------------------------------------ transition hooks (adapter)

  /** Whether the shell of the container exists. */
  protected abstract isMounted(container: ContainerState<THost>): boolean;
  /** Whether the open state (visible, open layout) is applied. */
  protected abstract isEntered(container: ContainerState<THost>): boolean;
  /** Makes the container visible and applies its open layout, before the show transition. */
  protected abstract enter(container: ContainerState<THost>): void;
  /** Removes the open layout and hides the container, after the hide transition. */
  protected abstract leave(container: ContainerState<THost>): void;
  /**
   * Engine and measured context of a transition, or `null` for none. Called after `enter`
   * on a show and before `leave` on a hide.
   */
  protected abstract transitionPlan(
    container: ContainerState<THost>,
    phase: 'show' | 'hide',
  ): SplitTransitionPlan<TElement> | null;
  /** Destroys a tab now. */
  protected abstract destroyTab(handle: TabHandle): void;
  /** Key of the container a tab is in, or `null`. */
  protected abstract containerOfTab(handle: TabHandle): string | null;

  /** While hiding: keep the content on screen and block interaction. */
  protected setLeaving(_container: ContainerState<THost>, _leaving: boolean): void {}
  /** Elements started (or stopped) moving. */
  protected setAnimating(_container: ContainerState<THost>, _animating: boolean): void {}
  /** Before any open/close (re-apply options...). */
  protected beforeTransition(_container: ContainerState<THost>): void {}
  protected afterShown(_container: ContainerState<THost>): void {}
  protected afterHidden(_container: ContainerState<THost>): void {}
  /** The user asked for reduced motion. Default: `false`. */
  protected prefersReducedMotion(): boolean {
    return false;
  }
  /** Errors of animation engines. Default: `console.error`. */
  protected reportError(error: unknown): void {
    (globalThis as { console?: { error(...args: unknown[]): void } }).console?.error(
      '[split-window] animation failed',
      error,
    );
  }
}
