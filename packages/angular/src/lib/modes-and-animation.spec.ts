import {
  ApplicationRef,
  RendererStyleFlags2,
  type Renderer2,
  Component,
  Injectable,
  InjectionToken,
  inject,
  type OnDestroy,
  type EnvironmentProviders,
  type Provider,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  SplitActiveWindow,
  SplitContainerRegistry,
  SplitInvalidOptionError,
  SplitOverlayMode,
  SplitPushMode,
  SplitWindowManager,
  provideSplitAnimationEngines,
  SplitAnimationEngineRegistry,
  provideSplitModes,
  SplitWindowController,
  type ContainerState,
  provideSplitWindows,
  type SplitAnimationContext,
  type SplitContainerTransitionEvent,
  type SplitWindowAngularConfig,
} from '../public-api';
import { SplitAnimationEngine } from '@split-window/core';
import {
  SplitCssAnimationEngine,
  type SplitCssAnimationClasses,
} from '@split-window/css-animation';
import { SplitKeyframesAnimationEngine } from '@split-window/keyframes-animation';
import { AngularSplitEngine } from './engine/angular-split-engine';

@Component({
  selector: 'split-mode-tab',
  template: `<p class="tab-content">{{ window.title() }}</p>`,
})
class Tab implements OnDestroy {
  readonly window = inject(SplitActiveWindow);
  static destroyed = 0;
  ngOnDestroy(): void {
    Tab.destroyed++;
  }
}

const MODE_CLASS = new InjectionToken<string>('MODE_CLASS');

class TokenMode extends SplitPushMode {
  private readonly cls = inject(MODE_CLASS);
  override settings() {
    return { panelClass: this.cls, size: '123px' };
  }
}

class MyCssEngine extends SplitCssAnimationEngine {
  protected override classesFor(ctx: SplitAnimationContext): SplitCssAnimationClasses {
    return { ...super.classesFor(ctx), showing: 'my-showing' };
  }
}

class Named extends SplitAnimationEngine<HTMLElement> {
  static used: string[] = [];
  animate(ctx: SplitAnimationContext): void {
    Named.used.push(`${this.constructor.name}:${ctx.container.key}`);
  }
}
class First extends Named {}
class Second extends Named {}

@Injectable()
class MarkingEngine extends AngularSplitEngine {
  protected override enter(container: ContainerState<HTMLElement>): void {
    super.enter(container);
    this.shellElement(container.key)?.classList.add('entered-by-subclass');
  }
}

@Injectable()
class CountingController extends SplitWindowController {
  opened = 0;
  override open(...args: Parameters<SplitWindowController['open']>) {
    this.opened++;
    return super.open(...args);
  }
}

@Injectable()
class PresetEngines extends SplitAnimationEngineRegistry {
  constructor() {
    super();
    this.register('first', First);
  }
}

/** Engine controlled by the test: each transition waits for `finish()`. */
function controlledEngine() {
  const calls: SplitAnimationContext[] = [];
  const pending: (() => void)[] = [];
  const fn = (ctx: SplitAnimationContext) => {
    calls.push(ctx);
    ctx.started();
    return new Promise<void>((resolve) => {
      pending.push(resolve);
      ctx.signal.addEventListener('abort', () => resolve());
    });
  };
  const finish = async () => {
    pending.splice(0).forEach((resolve) => resolve());
    await settle();
  };
  return { calls, fn, finish };
}

async function settle() {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

describe('modes and animations', () => {
  let manager: SplitWindowManager;
  let registry: SplitContainerRegistry;
  let engine: AngularSplitEngine;
  let created: HTMLElement[] = [];

  function setup(
    config?: SplitWindowAngularConfig,
    providers: (Provider | EnvironmentProviders)[] = [],
  ) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideSplitWindows(config), ...providers] });
    manager = TestBed.inject(SplitWindowManager);
    registry = TestBed.inject(SplitContainerRegistry);
    engine = TestBed.inject(AngularSplitEngine);
  }

  function hostEl(id?: string): HTMLElement {
    const el = document.createElement('div');
    if (id) el.id = id;
    document.body.appendChild(el);
    created.push(el);
    return el;
  }

  const tick = () => TestBed.inject(ApplicationRef).tick();
  const shell = (key: string) => engine.shellElement(key)!;

  beforeEach(() => {
    Tab.destroyed = 0;
    created = [];
    setup();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    created.forEach((el) => el.remove());
    document.body.removeAttribute('style');
    document.documentElement.removeAttribute('style');
    document
      .querySelectorAll('.split-body-host, .split-body-backdrop')
      .forEach((el) => el.remove());
  });

  describe('layouts', () => {
    it('body containers overlay by default and do not touch the page', () => {
      registry.useBodyContainers();
      manager.open(Tab);
      expect(shell('body-right').classList).toContain('split-layout--overlay');
      expect(document.body.style.paddingRight).toBe('');
    });

    it('a body container in push adds its size to the body padding while open', async () => {
      registry.useBodyContainers({ right: { mode: 'push', size: '300px' }, default: 'right' });
      const ref = manager.open(Tab);
      expect(document.body.style.paddingRight).toContain('300px');
      expect(document.documentElement.style.getPropertyValue('--split-body-offset-right')).toBe(
        '300px',
      );
      expect(shell('body-right').classList).toContain('split-layout--push');
      await ref.close();
      expect(document.body.style.paddingRight).toBe('');
      expect(document.documentElement.style.getPropertyValue('--split-body-offset-right')).toBe('');
    });

    it('pushTarget moves the push to another element', async () => {
      const app = hostEl('app-shell');
      registry.useBodyContainers({
        left: { mode: 'push', size: '200px', pushTarget: '#app-shell' },
        default: 'left',
      });
      const ref = manager.open(Tab);
      expect(app.style.paddingLeft).toContain('200px');
      expect(document.body.style.paddingLeft).toBe('');
      await ref.close();
      expect(app.style.paddingLeft).toBe('');
    });

    it('a custom container in push collapses its host until it opens', async () => {
      const host = hostEl();
      registry.registerContainer('p', host, {
        mode: 'push',
        side: 'left',
        size: '250px',
        closeWhenEmpty: true,
      });
      // Classes and the collapsed size are on the host from the registration on.
      expect([...host.classList]).toEqual(
        expect.arrayContaining(['split-host', 'split-layout--push', 'split-side--left']),
      );
      expect(host.style.width).toBe('0px');
      expect(host.style.flex).toBe('0 0 auto');
      const ref = manager.open(Tab, { containerKey: 'p' });
      expect(host.classList).toContain('split-host--open');
      expect(host.style.width).toBe('250px');
      expect(shell('p').style.getPropertyValue('--split-size')).toBe('250px');
      expect(shell('p').style.getPropertyValue('--split-inset')).toBe('0 0 0 auto');
      await ref.close();
      expect(host.classList).not.toContain('split-host--open');
      expect(host.style.width).toBe('0px');
      registry.unregisterContainer('p');
      expect(host.classList).not.toContain('split-layout--push');
      expect(host.style.width).toBe('');
    });

    it('a custom container in overlay floats from its host with the default size', () => {
      const host = hostEl();
      registry.registerContainer('o', host, { mode: 'overlay' });
      manager.open(Tab, { containerKey: 'o' });
      const el = shell('o');
      expect([...el.classList]).toEqual(
        expect.arrayContaining([
          'split-container--custom',
          'split-layout--overlay',
          'split-side--right',
        ]),
      );
      expect(el.style.getPropertyValue('--split-size')).toBe('420px');
    });

    it('custom containers stay inline by default', () => {
      const host = hostEl();
      registry.registerContainer('i', host);
      manager.open(Tab, { containerKey: 'i' });
      expect(shell('i').classList).toContain('split-layout--inline');
      expect(host.classList).toContain('split-layout--inline');
    });

    it('rejects unknown mode names and inline on the body', () => {
      expect(() => registry.registerContainer('x', hostEl(), { mode: 'drawer' })).toThrow(
        SplitInvalidOptionError,
      );
      expect(() => registry.useBodyContainers({ right: { mode: 'inline' } })).toThrow(/right.mode/);
      expect(() =>
        registry.useBodyContainers({ defaults: { mode: { layout: 'inline' } }, right: true }),
      ).toThrow(/defaults.mode/);
    });

    it('a reconfiguration swaps the layout of an open body container', () => {
      registry.useBodyContainers({ right: { mode: 'push', size: '200px' }, default: 'right' });
      manager.open(Tab);
      expect(document.body.style.paddingRight).toContain('200px');
      registry.useBodyContainers({ right: { mode: 'overlay', panelClass: 'new' } });
      expect(document.body.style.paddingRight).toBe('');
      expect(shell('body-right').classList).toContain('split-layout--overlay');
      expect(shell('body-right').classList).not.toContain('split-layout--push');
      expect(shell('body-right').classList).toContain('new');
    });
  });

  describe('modes', () => {
    it('global named modes, extends and custom classes', () => {
      setup({
        modes: {
          drawer: { extends: 'overlay', panelClass: 'drawer', hostClass: ['h1'], size: '360px' },
          wide: { extends: 'drawer', panelClass: 'wide', size: '50vw' },
        },
      });
      const a = hostEl();
      registry.registerContainer('a', a, { mode: 'wide', backdropClass: 'ignored' });
      manager.open(Tab, { containerKey: 'a' });
      const el = shell('a');
      expect(el.classList).toContain('drawer');
      expect(el.classList).toContain('wide');
      expect(el.classList).toContain('split-layout--overlay');
      expect(el.style.getPropertyValue('--split-size')).toBe('50vw');
      expect(a.classList).toContain('h1');
    });

    it('provideSplitModes adds modes; local options win over the mode', () => {
      setup(undefined, [
        provideSplitModes({ side: { extends: 'push', side: 'top', size: '10px' } }),
      ]);
      const host = hostEl();
      registry.registerContainer('s', host, { mode: 'side', size: '99px' });
      manager.open(Tab, { containerKey: 's' });
      expect(host.classList).toContain('split-side--top');
      expect(host.style.height).toBe('99px');
    });

    it('a mode class is created with dependency injection', () => {
      setup(undefined, [{ provide: MODE_CLASS, useValue: 'from-token' }]);
      const host = hostEl();
      registry.registerContainer('t', host, { mode: TokenMode });
      manager.open(Tab, { containerKey: 't' });
      expect(shell('t').classList).toContain('from-token');
      expect(shell('t').classList).toContain('split-layout--push');
      expect(host.style.width).toBe('123px');
    });

    it('a mode instance, a function and hooks', () => {
      const events: string[] = [];
      const host = hostEl();
      registry.registerContainer('fn', host, {
        mode: (ctx) =>
          ctx.key === 'fn'
            ? {
                extends: new SplitOverlayMode(),
                onOpen: () => events.push('open'),
                onShown: () => events.push('shown'),
                onClose: () => events.push('close'),
                onHidden: () => events.push('hidden'),
              }
            : 'inline',
        closeWhenEmpty: true,
      });
      const ref = manager.open(Tab, { containerKey: 'fn' });
      expect(shell('fn').classList).toContain('split-layout--overlay');
      void ref.close();
      expect(events).toEqual(['open', 'shown', 'close', 'hidden']);
    });

    it('containerDefaults apply to all containers, then per kind', () => {
      setup({ containerDefaults: { panelClass: 'all', custom: { mode: 'push', size: '1px' } } });
      registry.useBodyContainers();
      registry.registerContainer('c', hostEl());
      manager.open(Tab);
      manager.open(Tab, { containerKey: 'c' });
      expect(shell('body-right').classList).toContain('all');
      expect(shell('body-right').classList).toContain('split-layout--overlay');
      expect(shell('c').classList).toContain('all');
      expect(shell('c').classList).toContain('split-layout--push');
    });
  });

  describe('animation engines', () => {
    it('a custom engine receives elements, frames and a signal, and controls the end', async () => {
      const { calls, fn, finish } = controlledEngine();
      const events: SplitContainerTransitionEvent[] = [];
      manager.containerTransitions.subscribe((e) => events.push(e));
      const host = hostEl();
      registry.registerContainer('a', host, {
        mode: 'push',
        size: '200px',
        animation: fn,
      });
      manager.open(Tab, { containerKey: 'a' });
      expect(calls).toHaveLength(1);
      const ctx = calls[0];
      expect(ctx.phase).toBe('show');
      expect(ctx.elements.shell).toBe(shell('a'));
      expect(ctx.elements.host).toBe(host);
      expect(ctx.from.hostSize).toBe('0px');
      expect(ctx.to.hostSize).toBe('200px');
      expect(ctx.properties).toEqual({ host: 'width', push: null });
      expect(ctx.signal.aborted).toBe(false);
      expect(shell('a').classList).toContain('split-animating');
      expect(engine.isTransitioning('a')).toBe(true);
      await finish();
      expect(engine.isTransitioning('a')).toBe(false);
      expect(shell('a').classList).not.toContain('split-animating');
      expect(events.map((e) => `${e.phase}:${e.state}`)).toEqual([
        'show:start',
        'show:running',
        'show:done',
      ]);
    });

    it('animation: false ends transitions synchronously', () => {
      const host = hostEl();
      registry.registerContainer('a', host, { mode: 'overlay', animation: false });
      manager.open(Tab, { containerKey: 'a' });
      expect(engine.isTransitioning('a')).toBe(false);
    });

    it('reduced motion skips the engine unless respectReducedMotion is false', () => {
      const original = window.matchMedia;
      window.matchMedia = (() => ({ matches: true })) as never;
      try {
        const { calls, fn } = controlledEngine();
        registry.registerContainer('a', hostEl(), { animation: fn });
        manager.open(Tab, { containerKey: 'a' });
        expect(calls).toHaveLength(0);
        registry.registerContainer('b', hostEl(), {
          animation: { engine: fn, respectReducedMotion: false },
        });
        manager.open(Tab, { containerKey: 'b' });
        expect(calls).toHaveLength(1);
        expect(calls[0].reducedMotion).toBe(true);
      } finally {
        window.matchMedia = original;
      }
    });

    it('the CSS engine toggles the state classes and waits for transitionend', async () => {
      setup({ animationEngines: { css: SplitCssAnimationEngine } });
      const host = hostEl();
      registry.registerContainer('a', host, {
        mode: {
          extends: 'overlay',
          onOpen: (ctx) => ctx.styles.set(ctx.elements.shell, 'transition-duration', '5000ms'),
        },
        animation: true,
        closeWhenEmpty: true,
      });
      const ref = manager.open(Tab, { containerKey: 'a' });
      const el = shell('a');
      expect(el.getAttribute('data-split-animation')).toBe('slide');
      expect(el.classList).toContain('split-showing');
      el.dispatchEvent(new Event('transitionend'));
      await settle();
      expect(el.classList).toContain('split-show');
      expect(el.classList).not.toContain('split-showing');
      void ref.close();
      expect(el.classList).toContain('split-hiding');
      expect(el.hidden).toBe(false);
      el.dispatchEvent(new Event('transitionend'));
      await settle();
      expect(el.hidden).toBe(true);
      expect(el.classList).not.toContain('split-hiding');
      expect(el.classList).not.toContain('split-show');
    });

    it('the CSS engine ends at once without a transition duration', () => {
      setup({ animationEngines: { css: SplitCssAnimationEngine } });
      registry.registerContainer('a', hostEl(), {
        // The library styles give 200ms; a zero duration must end synchronously.
        mode: { onOpen: (ctx) => ctx.styles.set(ctx.elements.shell, 'transition-duration', '0s') },
        animation: { engine: 'css', preset: 'fade' },
      });
      manager.open(Tab, { containerKey: 'a' });
      expect(engine.isTransitioning('a')).toBe(false);
      expect(shell('a').classList).toContain('split-show');
    });

    it('an extended engine class can change the classes', () => {
      registry.registerContainer('a', hostEl(), {
        mode: {
          onOpen: (ctx) => ctx.styles.set(ctx.elements.shell, 'transition-duration', '5000ms'),
        },
        animation: { engine: MyCssEngine },
      });
      manager.open(Tab, { containerKey: 'a' });
      expect(shell('a').classList).toContain('my-showing');
    });

    it('the keyframes engine animates the shell and the host size', async () => {
      setup({ animationEngines: { keyframes: SplitKeyframesAnimationEngine } });
      const animations: { el: Element; keyframes: Keyframe[]; cancel: ReturnType<typeof vi.fn> }[] =
        [];
      let resolveAll!: () => void;
      const finished = new Promise<void>((resolve) => (resolveAll = resolve));
      const proto = HTMLElement.prototype as unknown as { animate?: unknown };
      const original = proto.animate;
      proto.animate = function (this: Element, keyframes: Keyframe[]) {
        const cancel = vi.fn();
        animations.push({ el: this, keyframes, cancel });
        return { finished, cancel } as unknown as Animation;
      };
      try {
        const host = hostEl();
        registry.registerContainer('a', host, {
          mode: 'push',
          size: '200px',
          animation: { engine: 'keyframes', duration: 50, preset: 'slide' },
        });
        manager.open(Tab, { containerKey: 'a' });
        expect(animations.map((a) => a.el)).toEqual([shell('a'), host]);
        expect(animations[0].keyframes[0]).toHaveProperty('transform');
        expect(animations[1].keyframes).toEqual([{ width: '0px' }, { width: '200px' }]);
        expect(engine.isTransitioning('a')).toBe(true);
        resolveAll();
        await settle();
        expect(engine.isTransitioning('a')).toBe(false);
        expect(animations.every((a) => a.cancel.mock.calls.length === 1)).toBe(true);
      } finally {
        proto.animate = original;
      }
    });
  });

  describe('closing with closeWhenEmpty', () => {
    it('the last tab stays visible while the container hides, then is destroyed', async () => {
      const { fn, finish } = controlledEngine();
      registry.registerContainer('a', hostEl(), {
        mode: 'overlay',
        animation: fn,
        closeWhenEmpty: true,
      });
      const first = manager.open(Tab, { containerKey: 'a', title: 'First' });
      const last = manager.open(Tab, { containerKey: 'a', title: 'Last' });
      await finish();
      tick();

      await first.close();
      expect(Tab.destroyed).toBe(1);
      expect(engine.isTransitioning('a')).toBe(false);

      const hidden = vi.fn();
      last.hidden.subscribe(hidden);
      expect(await last.close()).toBe(true);
      tick();
      const el = shell('a');
      expect(last.isOpen).toBe(false);
      expect(manager.isContainerOpen('a')).toBe(false);
      expect(engine.isTransitioning('a')).toBe(true);
      expect(el.hidden).toBe(false);
      expect(el.hasAttribute('inert')).toBe(true);
      expect(el.querySelector('.tab-content')).not.toBeNull();
      expect([...el.querySelectorAll('[role="tab"]')].map((t) => t.textContent!.trim())).toEqual(
        expect.arrayContaining([expect.stringContaining('Last')]),
      );
      expect(Tab.destroyed).toBe(1);
      expect(hidden).not.toHaveBeenCalled();

      await finish();
      tick();
      expect(el.hidden).toBe(true);
      expect(el.hasAttribute('inert')).toBe(false);
      expect(el.querySelector('.tab-content')).toBeNull();
      expect(Tab.destroyed).toBe(2);
      expect(hidden).toHaveBeenCalledTimes(1);
    });

    it('opening a tab while the container hides cancels the hide and drops the closed tab', async () => {
      const { calls, fn, finish } = controlledEngine();
      const events: string[] = [];
      manager.containerTransitions.subscribe((e) => events.push(`${e.phase}:${e.state}`));
      registry.registerContainer('a', hostEl(), { animation: fn, closeWhenEmpty: true });
      const first = manager.open(Tab, { containerKey: 'a' });
      await finish();
      void first.close();
      expect(engine.isTransitioning('a')).toBe(true);
      manager.open(Tab, { containerKey: 'a' });
      expect(Tab.destroyed).toBe(1);
      expect(calls.map((c) => c.phase)).toEqual(['show', 'hide', 'show']);
      expect(calls[1].signal.aborted).toBe(true);
      expect(events).toContain('hide:cancelled');
      expect(shell('a').hidden).toBe(false);
      await finish();
      expect(engine.isTransitioning('a')).toBe(false);
    });

    it('unregistering during a hide destroys the deferred tab', async () => {
      const { fn, finish } = controlledEngine();
      registry.registerContainer('a', hostEl(), { animation: fn, closeWhenEmpty: true });
      const ref = manager.open(Tab, { containerKey: 'a' });
      await finish();
      void ref.close();
      registry.unregisterContainer('a');
      expect(Tab.destroyed).toBe(1);
    });
  });
  describe('registered animation engines', () => {
    beforeEach(() => (Named.used = []));

    it('uses the first registered engine, a chosen one, or noop with none', () => {
      setup({ animationEngines: { first: First, second: Second } });
      registry.registerContainer('a', hostEl(), { animation: true });
      registry.registerContainer('b', hostEl(), { animation: { engine: 'second' } });
      registry.registerContainer('c', hostEl(), { animation: { engine: 'none' } });
      manager.open(Tab, { containerKey: 'a' });
      manager.open(Tab, { containerKey: 'b' });
      manager.open(Tab, { containerKey: 'c' });
      expect(Named.used).toEqual(['First:a', 'Second:b']);
    });

    it('engines registered later through the injected registry count from the next transition', async () => {
      const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      try {
        const engines = TestBed.inject(SplitAnimationEngineRegistry);
        expect(engines.names()).toEqual([]);
        // Names are not checked on registration: the engine may come later.
        registry.registerContainer('a', hostEl(), {
          animation: { engine: 'later' },
          closeWhenEmpty: true,
        });
        registry.registerContainer('b', hostEl(), { animation: true, closeWhenEmpty: true });
        const a1 = manager.open(Tab, { containerKey: 'a' });
        const b1 = manager.open(Tab, { containerKey: 'b' });
        expect(Named.used).toEqual([]);
        expect(errors).toHaveBeenCalledTimes(1); // unknown 'later': noop instead
        expect(errors.mock.calls[0][1]).toBeInstanceOf(SplitInvalidOptionError);
        await a1.close();
        await b1.close();

        engines.register('later', Second);
        engines.register('first', First);
        manager.open(Tab, { containerKey: 'a' });
        manager.open(Tab, { containerKey: 'b' });
        // 'a' uses the named engine; 'b' the first registered ('later' -> Second).
        expect(Named.used).toEqual(['Second:a', 'Second:b']);
      } finally {
        errors.mockRestore();
      }
    });

    it('provideSplitWindows can replace the registry with a subclass', () => {
      setup({ animationEngineRegistry: PresetEngines });
      expect(TestBed.inject(SplitAnimationEngineRegistry)).toBeInstanceOf(PresetEngines);
      registry.registerContainer('a', hostEl(), { animation: true });
      manager.open(Tab, { containerKey: 'a' });
      expect(Named.used).toEqual(['First:a']);
    });

    it('a global engine in containerDefaults, and provideSplitAnimationEngines adds after', () => {
      setup(
        {
          animationEngines: { first: First },
          containerDefaults: { animation: { engine: 'second' } },
        },
        [provideSplitAnimationEngines({ second: Second })],
      );
      registry.registerContainer('a', hostEl());
      manager.open(Tab, { containerKey: 'a' });
      expect(Named.used).toEqual(['Second:a']);
    });

    it('the noop engine emits every step synchronously', () => {
      const events: string[] = [];
      manager.containerTransitions.subscribe((e) =>
        events.push(`${e.phase}:${e.state}${e.progress === undefined ? '' : ':' + e.progress}`),
      );
      registry.registerContainer('a', hostEl(), { animation: true }); // nothing registered
      manager.open(Tab, { containerKey: 'a' });
      expect(engine.isTransitioning('a')).toBe(false);
      expect(events).toEqual(['show:start', 'show:running', 'show:running:1', 'show:done']);
      expect(manager.isContainerOpen('a')).toBe(true);
    });
  });

  describe('dependency injection', () => {
    it('provideSplitWindows replaces the engine and the controller with subclasses', () => {
      setup({ engine: MarkingEngine, controller: CountingController });
      expect(engine).toBeInstanceOf(MarkingEngine);
      const controller = TestBed.inject(SplitWindowController) as CountingController;
      expect(controller).toBeInstanceOf(CountingController);
      expect(controller.engine).toBe(engine);
      registry.registerContainer('a', hostEl());
      manager.open(Tab, { containerKey: 'a' });
      expect(controller.opened).toBe(1);
      expect(shell('a').classList).toContain('entered-by-subclass');
    });

    it('the engine writes to the DOM through Renderer2', () => {
      const renderer = (engine as unknown as { renderer: Renderer2 }).renderer;
      const addClass = vi.spyOn(renderer, 'addClass');
      const setStyle = vi.spyOn(renderer, 'setStyle');
      const appendChild = vi.spyOn(renderer, 'appendChild');
      const listen = vi.spyOn(renderer, 'listen');
      try {
        const host = hostEl();
        registry.registerContainer('a', host, { mode: 'push', size: '200px' });
        manager.open(Tab, { containerKey: 'a' });
        manager.expandContainer('a');
        const flags = RendererStyleFlags2.DashCase;
        expect(addClass).toHaveBeenCalledWith(host, 'split-layout--push');
        expect(setStyle).toHaveBeenCalledWith(host, 'width', '0px', flags);
        expect(setStyle).toHaveBeenCalledWith(host, 'width', '200px', flags);
        expect(setStyle).toHaveBeenCalledWith(shell('a'), '--split-size', '200px', flags);
        expect(setStyle).toHaveBeenCalledWith(shell('a'), 'position', 'fixed', flags);
        expect(appendChild).toHaveBeenCalledWith(host, shell('a'));
        expect(listen).toHaveBeenCalledWith('window', 'resize', expect.any(Function));
      } finally {
        vi.restoreAllMocks();
      }
    });

    it('full screen goes through the manager and the controller', () => {
      registry.registerContainer('a', hostEl());
      manager.open(Tab, { containerKey: 'a' });
      const states: unknown[] = [];
      manager.containerStateChanged.subscribe((st) => states.push(st));
      manager.expandContainer('a');
      expect(manager.isContainerExpanded('a')).toBe(true);
      expect(manager.getExpandedContainer()).toBe('a');
      expect(shell('a').classList).toContain('split-container--expanded');
      manager.restoreContainer('a');
      expect(states).toEqual([
        { key: 'a', open: true, expanded: true },
        { key: 'a', open: true, expanded: false },
      ]);
    });
  });
});
