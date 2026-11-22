import { afterEach, describe, expect, it } from 'vitest';
import {
  SPLIT_DEFAULT_EASING,
  SPLIT_DEFAULT_HIDE_EASING,
  easingToCss,
  spring,
  type SplitAnimationContext,
  type SplitEasingInput,
  type SplitAnimationFrame,
  type SplitAnimationSettings,
} from '@split-window/core';
import {
  SPLIT_CSS_ANIMATION_STYLE_ID,
  SplitCssAnimationEngine,
  type SplitCssAnimationClasses,
} from '../index.js';

const frame = (patch: Partial<SplitAnimationFrame> = {}): SplitAnimationFrame => ({
  rect: { x: 0, y: 0, width: 100, height: 100 },
  opacity: 1,
  hostSize: null,
  push: null,
  ...patch,
});

type ContextPatch = Partial<Omit<SplitAnimationContext<HTMLElement>, 'options'>> & {
  options?: Partial<SplitAnimationSettings>;
};

function context({ options, ...patch }: ContextPatch = {}) {
  const shell = document.createElement('div');
  const host = document.createElement('div');
  document.body.append(host);
  host.append(shell);
  const abort = new AbortController();
  const events: string[] = [];
  const ctx: SplitAnimationContext<HTMLElement> = {
    phase: 'show',
    container: {} as never,
    layout: 'overlay',
    side: 'right',
    size: '300px',
    elements: { shell, host, backdrop: null, pushTarget: null },
    from: frame({ rect: { x: 100, y: 0, width: 100, height: 100 } }),
    to: frame(),
    properties: { host: null, push: null },
    options: {
      preset: 'slide',
      origin: 'right',
      distance: '100%',
      scale: 0.9,
      respectReducedMotion: true,
      ...options,
    },
    reducedMotion: false,
    signal: abort.signal,
    started: () => events.push('started'),
    progress: () => undefined,
    ...patch,
  };
  return { ctx, shell, host, abort, events };
}

afterEach(() => {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
});

describe('SplitCssAnimationEngine', () => {
  it('injects the preset styles once and ends at once without a duration', () => {
    const engine = new SplitCssAnimationEngine();
    const { ctx, shell, events } = context();
    shell.style.transitionDuration = '0s';
    expect(engine.animate(ctx)).toBeUndefined();
    expect(document.querySelectorAll(`#${SPLIT_CSS_ANIMATION_STYLE_ID}`)).toHaveLength(1);
    engine.animate(context().ctx);
    expect(document.querySelectorAll(`#${SPLIT_CSS_ANIMATION_STYLE_ID}`)).toHaveLength(1);
    expect(events).toEqual(['started']);
    expect(shell.classList).toContain('split-show');
    expect(shell.getAttribute('data-split-animation')).toBe('slide');
    expect(shell.style.getPropertyValue('--split-slide')).toBe('translateX(100%)');
    engine.cleanup(ctx);
    expect(shell.getAttribute('data-split-animation')).toBeNull();
    expect(shell.classList).toContain('split-show');
  });

  it('waits for transitionend, then sets the show class', async () => {
    const engine = new SplitCssAnimationEngine({ injectStyles: false });
    const { ctx, shell } = context();
    shell.style.transitionDuration = '5s';
    const done = engine.animate(ctx);
    expect(done).toBeInstanceOf(Promise);
    expect(shell.classList).toContain('split-showing');
    shell.dispatchEvent(new Event('transitionend'));
    await done;
    expect(shell.classList).toContain('split-show');
    expect(shell.classList).not.toContain('split-showing');
    expect(document.getElementById(SPLIT_CSS_ANIMATION_STYLE_ID)).toBeNull();
  });

  it('a hide uses the hiding class and cleanup removes the state classes', async () => {
    const engine = new SplitCssAnimationEngine();
    const { ctx, shell } = context({ phase: 'hide' });
    shell.classList.add('split-show');
    shell.style.transitionDuration = '5s';
    const done = engine.animate(ctx);
    expect(shell.classList).toContain('split-hiding');
    expect(shell.classList).not.toContain('split-show');
    shell.dispatchEvent(new Event('animationend'));
    await done;
    engine.cleanup(ctx);
    expect(shell.classList).not.toContain('split-hiding');
  });

  it('an abort resolves at once and skips the show class', async () => {
    const engine = new SplitCssAnimationEngine();
    const { ctx, shell, abort } = context();
    shell.style.transitionDuration = '5s';
    const done = engine.animate(ctx);
    abort.abort();
    await done;
    expect(shell.classList).not.toContain('split-show');
  });

  it('animates the host size and the push padding with inline transitions', () => {
    const engine = new SplitCssAnimationEngine();
    const target = document.createElement('main');
    const { ctx, host } = context({
      layout: 'push',
      options: { preset: 'collapse', duration: 300, easing: 'linear', respectReducedMotion: true },
      from: frame({ hostSize: '0px', push: '0px' }),
      to: frame({ hostSize: '300px', push: '300px' }),
      properties: { host: 'width', push: 'padding-right' },
    });
    const withTarget = { ...ctx, elements: { ...ctx.elements, pushTarget: target } };
    target.style.paddingRight = 'calc(0px + 300px)';
    const before = target.style.paddingRight;
    void engine.animate(withTarget);
    expect(host.style.width).toBe('300px');
    expect(host.style.transition).toContain('width 300ms linear');
    expect(target.style.paddingRight).toBe('300px');
    engine.cleanup(withTarget);
    expect(host.style.width).toBe('');
    expect(host.style.transition).toBe('');
    expect(target.style.paddingRight).toBe(before);
  });

  it('collapse reveals the panel like a curtain, in step with the push padding', () => {
    const engine = new SplitCssAnimationEngine();
    const target = document.createElement('main');
    const push = {
      layout: 'push' as const,
      options: { preset: 'collapse' as const, duration: 300, easing: 'linear' },
      from: frame({ push: '0px' }),
      to: frame({ push: '300px' }),
      properties: { host: null, push: 'padding-right' },
    };
    const show = context(push);
    const showCtx = { ...show.ctx, elements: { ...show.ctx.elements, pushTarget: target } };
    void engine.animate(showCtx);
    expect(show.shell.style.clipPath).toBe('inset(0px)');
    expect(show.shell.style.transition).toBe('clip-path 300ms linear 0ms');
    expect(target.style.transition).toBe('padding-right 300ms linear 0ms');
    engine.cleanup(showCtx);
    expect(show.shell.style.clipPath).toBe('');

    const hide = context({ ...push, phase: 'hide', side: 'left' });
    void engine.animate({ ...hide.ctx, elements: { ...hide.ctx.elements, pushTarget: target } });
    expect(hide.shell.style.clipPath).toBe('inset(0px 100% 0px 0px)');

    // overlay: the clip alone
    const overlay = context({ options: { preset: 'collapse', duration: 300 } });
    void engine.animate(overlay.ctx);
    expect(overlay.shell.style.clipPath).toBe('inset(0px)');
    expect(overlay.shell.style.transition).toContain('clip-path 300ms');

    // custom push: the host grows and the shell is held in its final place
    const custom = context({
      layout: 'push',
      options: { preset: 'collapse', duration: 300 },
      from: frame({ hostSize: '0px' }),
      to: frame({ hostSize: '300px' }),
      properties: { host: 'width', push: null },
    });
    void engine.animate(custom.ctx);
    expect(custom.host.style.width).toBe('300px');
    expect(custom.shell.style.transform).toBe('none');
    expect(custom.shell.style.transition).toContain('transform 300ms');
  });

  it('decelerates the inline transitions on show and accelerates them on hide', () => {
    const engine = new SplitCssAnimationEngine();
    const push = {
      layout: 'push' as const,
      options: { preset: 'collapse' as const, duration: 300, respectReducedMotion: true },
      from: frame({ hostSize: '0px' }),
      to: frame({ hostSize: '300px' }),
      properties: { host: 'width' as const, push: null },
    };
    const show = context(push);
    void engine.animate(show.ctx);
    expect(show.host.style.transition).toContain(easingToCss(SPLIT_DEFAULT_EASING));
    const hide = context({ ...push, phase: 'hide' });
    void engine.animate(hide.ctx);
    expect(hide.host.style.transition).toContain(easingToCss(SPLIT_DEFAULT_HIDE_EASING));
  });

  it('sets both easing variables from the easing option', () => {
    const { ctx, shell } = context({
      options: { preset: 'fade', easing: 'linear', respectReducedMotion: true },
    });
    void new SplitCssAnimationEngine().animate(ctx);
    expect(shell.style.getPropertyValue('--split-animation-easing')).toBe('linear');
    expect(shell.style.getPropertyValue('--split-animation-easing-hide')).toBe('linear');
  });

  it('sets the slide transform from origin/distance and the scale variables', () => {
    const engine = new SplitCssAnimationEngine();
    const slide = context({ options: { preset: 'slide', origin: 'top', distance: 48 } });
    slide.shell.style.transitionDuration = '5s';
    void engine.animate(slide.ctx);
    expect(slide.shell.getAttribute('data-split-animation')).toBe('slide');
    expect(slide.shell.style.getPropertyValue('--split-slide')).toBe('translateY(-48px)');

    const scale = context({
      phase: 'hide',
      options: { preset: 'scale', scale: 1.15, origin: 'left' },
    });
    scale.shell.style.transitionDuration = '5s';
    void engine.animate(scale.ctx);
    expect(scale.shell.getAttribute('data-split-animation')).toBe('scale');
    expect(scale.shell.style.getPropertyValue('--split-scale')).toBe('1.15');
    expect(scale.shell.style.getPropertyValue('--split-transform-origin')).toBe('left center');
    expect(scale.shell.classList).toContain('split-hiding');
    expect(document.getElementById(SPLIT_CSS_ANIMATION_STYLE_ID)?.textContent).toContain(
      "[data-split-animation='scale']:is(.split-enter-from, .split-hiding) { transform: scale(var(--split-scale)); }",
    );
  });

  it('translates easing objects and lets subclasses translate their own types', () => {
    const { ctx, shell } = context({
      options: { preset: 'fade', easing: spring({ samples: 3 }) },
    });
    void new SplitCssAnimationEngine().animate(ctx);
    expect(shell.style.getPropertyValue('--split-animation-easing')).toMatch(/^linear\(0, /);

    class Elastic extends SplitCssAnimationEngine {
      protected override translateEasing(easing: SplitEasingInput): string {
        return typeof easing === 'object' && easing.type === 'elastic'
          ? 'cubic-bezier(0.5, 1.6, 0.4, 0.7)'
          : easingToCss(easing);
      }
    }
    const custom = context({ options: { preset: 'fade', easing: { type: 'elastic' } } });
    void new Elastic().animate(custom.ctx);
    expect(custom.shell.style.getPropertyValue('--split-animation-easing')).toBe(
      'cubic-bezier(0.5, 1.6, 0.4, 0.7)',
    );
    expect(() =>
      new SplitCssAnimationEngine().animate(
        context({ options: { preset: 'fade', easing: { type: 'elastic' } } }).ctx,
      ),
    ).toThrow(/elastic/);
  });

  it('does not animate the sizes with fade: the open layout stays during the transition', () => {
    const engine = new SplitCssAnimationEngine();
    const target = document.createElement('main');
    target.style.paddingRight = 'calc(0px + 300px)';
    const open = target.style.paddingRight;
    for (const phase of ['show', 'hide'] as const) {
      const { ctx, host, shell } = context({
        phase,
        layout: 'push',
        options: { preset: 'fade', duration: 300, respectReducedMotion: true },
        from: frame({ hostSize: '0px', push: '0px' }),
        to: frame({ hostSize: '300px', push: '300px' }),
        properties: { host: 'width', push: 'padding-right' },
      });
      void engine.animate({ ...ctx, elements: { ...ctx.elements, pushTarget: target } });
      expect(shell.getAttribute('data-split-animation')).toBe('fade');
      expect(host.style.width).toBe('');
      expect(target.style.transition).toBe('');
      expect(target.style.paddingRight).toBe(open);
    }
  });

  it('marks the backdrop and lets subclasses change the classes', () => {
    class Custom extends SplitCssAnimationEngine {
      protected override classesFor(): SplitCssAnimationClasses {
        return { ...this.classes, showing: 'mine' };
      }
    }
    const backdrop = document.createElement('div');
    const { ctx, shell } = context();
    shell.style.transitionDuration = '5s';
    const withBackdrop = { ...ctx, elements: { ...ctx.elements, backdrop } };
    void new Custom({ classes: { show: 'open' } }).animate(withBackdrop);
    expect(shell.classList).toContain('mine');
    expect(backdrop.classList).toContain('mine');
    expect(backdrop.getAttribute('data-split-animation')).toBe('fade');
  });
});
