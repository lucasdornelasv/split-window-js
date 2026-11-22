import { describe, expect, it, vi } from 'vitest';
import {
  NoopSplitAnimationEngine,
  SplitAnimationEngine,
  SplitAnimationEngineRegistry,
  type SplitAnimationContext,
} from '../animation/animation-engine.js';
import { SplitWindowController } from '../controller/split-window-controller.js';
import {
  BaseSplitWindowEngine,
  type SplitTransitionPlan,
} from '../engine/base-split-window-engine.js';
import { SplitInvalidOptionError } from '../errors/errors.js';
import type { ContainerState } from '../model/types.js';
import { SplitContainerRegistry } from '../registry/split-container-registry.js';
import { flush, host, type Host } from './helpers.js';

/** Engine with in-memory rendering, to test the transitions of the base class. */
class MemoryEngine extends BaseSplitWindowEngine<string, Host, unknown, string> {
  readonly log: string[] = [];
  readonly mounted = new Set<string>();
  readonly entered = new Set<string>();
  readonly tabs = new Map<string, string | null>();
  animation: SplitAnimationEngine<string> | null = null;
  reduced = false;

  mountContainer(c: ContainerState<Host>): void {
    this.mounted.add(c.key);
  }
  unmountContainer(c: ContainerState<Host>): void {
    this.cancelTransition(c.key);
    this.mounted.delete(c.key);
  }
  createTab(_content: string, tab: { id: string }): string {
    this.tabs.set(tab.id, null);
    return tab.id;
  }
  attach(handle: unknown, c: ContainerState<Host>): void {
    this.tabs.set(handle as string, c.key);
  }
  move(handle: unknown, c: ContainerState<Host>): void {
    this.tabs.set(handle as string, c.key);
  }
  activate(): void {}
  deactivate(): void {}
  setExpanded(): void {}
  cancelDrag(): void {}

  protected isMounted(c: ContainerState<Host>): boolean {
    return this.mounted.has(c.key);
  }
  protected isEntered(c: ContainerState<Host>): boolean {
    return this.entered.has(c.key);
  }
  protected enter(c: ContainerState<Host>): void {
    this.entered.add(c.key);
    this.log.push(`enter:${c.key}`);
  }
  protected leave(c: ContainerState<Host>): void {
    this.entered.delete(c.key);
    this.log.push(`leave:${c.key}`);
  }
  protected override setLeaving(c: ContainerState<Host>, leaving: boolean): void {
    this.log.push(`leaving:${c.key}:${leaving}`);
  }
  protected override setAnimating(c: ContainerState<Host>, animating: boolean): void {
    this.log.push(`animating:${c.key}:${animating}`);
  }
  protected override afterShown(c: ContainerState<Host>): void {
    this.log.push(`shown:${c.key}`);
  }
  protected override afterHidden(c: ContainerState<Host>): void {
    this.log.push(`hidden:${c.key}`);
  }
  protected override prefersReducedMotion(): boolean {
    return this.reduced;
  }
  protected transitionPlan(): SplitTransitionPlan<string> | null {
    if (!this.animation) return null;
    const frame = {
      rect: { x: 0, y: 0, width: 1, height: 1 },
      opacity: 1,
      hostSize: null,
      push: null,
    };
    return {
      engine: this.animation,
      context: {
        layout: 'overlay',
        side: 'right',
        size: null,
        elements: { shell: 'shell', host: 'host', backdrop: null, pushTarget: null },
        from: frame,
        to: frame,
        properties: { host: null, push: null },
        options: {
          preset: 'slide',
          origin: 'right',
          distance: '100%',
          scale: 0.9,
          respectReducedMotion: true,
        },
      },
    };
  }
  protected destroyTab(handle: unknown): void {
    this.tabs.delete(handle as string);
    this.log.push(`destroy:${handle as string}`);
  }
  protected containerOfTab(handle: unknown): string | null {
    return this.tabs.get(handle as string) ?? null;
  }
  get ctrl() {
    return this.controller;
  }
}

class ControlledAnimation extends SplitAnimationEngine<string> {
  readonly calls: SplitAnimationContext<string>[] = [];
  private readonly pending: (() => void)[] = [];
  cleanups = 0;
  animate(ctx: SplitAnimationContext<string>): Promise<void> {
    this.calls.push(ctx);
    ctx.started();
    ctx.progress(0.5);
    return new Promise((resolve) => {
      this.pending.push(resolve);
      ctx.signal.addEventListener('abort', () => resolve());
    });
  }
  override cleanup(): void {
    this.cleanups++;
  }
  async finish() {
    this.pending.splice(0).forEach((r) => r());
    await flush();
  }
}

function setup() {
  const registry = new SplitContainerRegistry<Host>();
  const engine = new MemoryEngine();
  const controller = new SplitWindowController<string, Host>(registry, engine);
  registry.registerContainer('a', host(), { closeWhenEmpty: true });
  const events: string[] = [];
  engine.transitions.subscribe((e) =>
    events.push(`${e.phase}:${e.state}${e.progress === undefined ? '' : `:${e.progress}`}`),
  );
  return { registry, engine, controller, events };
}

describe('BaseSplitWindowEngine', () => {
  it('without animation, enters and leaves synchronously', async () => {
    const { engine, controller, events } = setup();
    const ref = controller.open('x', { containerKey: 'a' });
    expect(engine.ctrl).toBe(controller);
    expect(engine.isTransitioning('a')).toBe(false);
    await ref.close();
    expect(engine.log).toEqual([
      'enter:a',
      'animating:a:false',
      'shown:a',
      'leaving:a:true',
      'animating:a:false',
      'leave:a',
      'leaving:a:false',
      'hidden:a',
      `destroy:${ref.id}`,
    ]);
    expect(events).toEqual(['show:start', 'show:done', 'hide:start', 'hide:done']);
  });

  it('keeps the last tab until the hide ends, and emits hidden after it', async () => {
    const { engine, controller, events } = setup();
    const animation = new ControlledAnimation();
    engine.animation = animation;
    const ref = controller.open('x', { containerKey: 'a' });
    expect(animation.calls[0].phase).toBe('show');
    expect(animation.calls[0].container.key).toBe('a');
    await animation.finish();
    const hidden = vi.fn();
    ref.hidden.subscribe(hidden);
    await ref.close();
    expect(engine.isTransitioning('a')).toBe(true);
    expect(engine.tabs.has(ref.id)).toBe(true);
    expect(hidden).not.toHaveBeenCalled();
    await animation.finish();
    expect(engine.tabs.has(ref.id)).toBe(false);
    expect(hidden).toHaveBeenCalled();
    expect(animation.cleanups).toBe(2);
    expect(events).toEqual([
      'show:start',
      'show:running',
      'show:running:0.5',
      'show:done',
      'hide:start',
      'hide:running',
      'hide:running:0.5',
      'hide:done',
    ]);
  });

  it('a new transition cancels the running one', async () => {
    const { engine, controller, events } = setup();
    const animation = new ControlledAnimation();
    engine.animation = animation;
    const first = controller.open('x', { containerKey: 'a' });
    await animation.finish();
    void first.close();
    controller.open('y', { containerKey: 'a' });
    expect(animation.calls[1].signal.aborted).toBe(true);
    expect(engine.tabs.has(first.id)).toBe(false);
    expect(events).toContain('hide:cancelled');
    await animation.finish();
    expect(engine.isTransitioning('a')).toBe(false);
  });

  it('noop engines (also for reduced motion) emit every step synchronously; errors end at once', async () => {
    const { engine, controller, events } = setup();
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    engine.animation = new NoopSplitAnimationEngine();
    const a = controller.open('x', { containerKey: 'a' });
    expect(engine.isTransitioning('a')).toBe(false);
    expect(events).toEqual(['show:start', 'show:running', 'show:running:1', 'show:done']);
    await a.close();

    engine.animation = new ControlledAnimation();
    engine.reduced = true;
    const b = controller.open('x', { containerKey: 'a' });
    expect(engine.isTransitioning('a')).toBe(false);
    expect(events.slice(-2)).toEqual(['show:running:1', 'show:done']);
    await b.close();

    engine.reduced = false;
    engine.animation = new (class extends SplitAnimationEngine<string> {
      animate(): void {
        throw new Error('boom');
      }
      override cleanup(): void {
        throw new Error('cleanup');
      }
    })();
    controller.open('x', { containerKey: 'a' });
    expect(engine.isTransitioning('a')).toBe(false);
    expect(errors).toHaveBeenCalledTimes(2);

    engine.animation = new (class extends SplitAnimationEngine<string> {
      animate(): Promise<void> {
        return Promise.reject(new Error('async'));
      }
    })();
    controller.dismissAll();
    await flush();
    expect(errors).toHaveBeenCalledTimes(3);
    errors.mockRestore();
  });

  it('unmounting and disconnecting end the transitions', async () => {
    const { engine, controller, registry, events } = setup();
    const animation = new ControlledAnimation();
    engine.animation = animation;
    const ref = controller.open('x', { containerKey: 'a' });
    await animation.finish();
    void ref.close();
    registry.unregisterContainer('a');
    expect(engine.tabs.size).toBe(0);
    registry.registerContainer('b', host());
    controller.open('x', { containerKey: 'b' });
    let completed = false;
    engine.transitions.subscribe({ complete: () => (completed = true) });
    controller.destroy();
    expect(events.at(-1)).toBe('show:cancelled');
    expect(completed).toBe(true);
    expect(() => engine.ctrl).toThrow(/connected/);
  });
});

describe('SplitAnimationEngineRegistry', () => {
  class Named extends SplitAnimationEngine<string> {
    animate(): void {}
  }

  it('uses the first registered engine by default and noop when empty', () => {
    const empty = new SplitAnimationEngineRegistry<string>();
    expect(empty.resolve()).toBeInstanceOf(NoopSplitAnimationEngine);
    const registry = new SplitAnimationEngineRegistry<string>();
    const instance = new Named();
    registry.register('first', Named);
    registry.register('second', instance);
    expect(registry.names()).toEqual(['first', 'second']);
    const first = registry.resolve();
    expect(first).toBeInstanceOf(Named);
    expect(registry.resolve('first')).toBe(first);
    expect(registry.resolve('second')).toBe(instance);
    expect(registry.resolve('none')).toBeInstanceOf(NoopSplitAnimationEngine);
    expect(registry.has('none')).toBe(true);
    expect(registry.has('missing')).toBe(false);
    expect(registry.get('missing')).toBeUndefined();
  });

  it('creates the noop engine only on first use, then reuses it', () => {
    const registry = new SplitAnimationEngineRegistry<string>();
    const lazy = registry as unknown as { noopEngine: unknown };
    registry.register('first', new Named());
    registry.resolve();
    expect(lazy.noopEngine).toBeNull();
    const noop = registry.resolve('none');
    expect(noop).toBeInstanceOf(NoopSplitAnimationEngine);
    expect(registry.get('none')).toBe(noop);
    expect(new SplitAnimationEngineRegistry<string>().resolve()).not.toBe(noop);
  });

  it('resolves instances, classes and functions; rejects bad names and values', () => {
    const created: unknown[] = [];
    const registry = new SplitAnimationEngineRegistry<string>((type) => {
      created.push(type);
      return new type();
    });
    const instance = new Named();
    expect(registry.resolve(instance)).toBe(instance);
    expect(registry.resolve(Named)).toBe(registry.resolve(Named));
    expect(created).toEqual([Named]);
    const fn = () => undefined;
    expect(registry.resolve(fn)).toBe(registry.resolve(fn));
    expect(() => registry.resolve('missing')).toThrow(SplitInvalidOptionError);
    expect(() => registry.resolve(5 as never)).toThrow(SplitInvalidOptionError);
    expect(() => registry.register('none', Named)).toThrow(SplitInvalidOptionError);
    expect(() => registry.register('', Named)).toThrow(SplitInvalidOptionError);
    expect(() => registry.register('x', {} as never)).toThrow(SplitInvalidOptionError);
  });
});
