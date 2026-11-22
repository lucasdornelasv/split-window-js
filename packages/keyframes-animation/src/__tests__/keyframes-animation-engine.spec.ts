import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SPLIT_DEFAULT_EASING,
  SPLIT_DEFAULT_HIDE_EASING,
  cubicBezier,
  easingToCss,
  steps,
  type SplitAnimationContext,
  type SplitAnimationFrame,
  type SplitAnimationSettings,
} from '@split-window/core';
import { SplitKeyframesAnimationEngine } from '../index.js';

const frame = (patch: Partial<SplitAnimationFrame> = {}): SplitAnimationFrame => ({
  rect: { x: 0, y: 0, width: 100, height: 100 },
  opacity: 1,
  hostSize: null,
  push: null,
  ...patch,
});

interface FakeAnimation {
  el: Element;
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
  cancel: ReturnType<typeof vi.fn>;
}

let animations: FakeAnimation[] = [];
let resolveAll: () => void = () => undefined;
const proto = HTMLElement.prototype as unknown as { animate?: unknown };
const original = proto.animate;

function mockAnimate() {
  animations = [];
  const finished = new Promise<void>((resolve) => (resolveAll = resolve));
  proto.animate = function (
    this: Element,
    keyframes: Keyframe[],
    options: KeyframeAnimationOptions,
  ) {
    const cancel = vi.fn();
    animations.push({ el: this, keyframes, options, cancel });
    return { finished, cancel } as unknown as Animation;
  };
}

type ContextPatch = Partial<Omit<SplitAnimationContext<HTMLElement>, 'options'>> & {
  options?: Partial<SplitAnimationSettings>;
};

function context({ options, ...patch }: ContextPatch = {}) {
  const shell = document.createElement('div');
  const host = document.createElement('div');
  const abort = new AbortController();
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
    started: vi.fn(),
    progress: () => undefined,
    ...patch,
  };
  return { ctx, shell, host, abort };
}

afterEach(() => {
  proto.animate = original;
});

describe('SplitKeyframesAnimationEngine', () => {
  it('slides the shell in from its side and resolves when the animations finish', async () => {
    mockAnimate();
    const engine = new SplitKeyframesAnimationEngine();
    const { ctx, shell } = context({
      options: { preset: 'slide', duration: 50, respectReducedMotion: true },
    });
    const done = engine.animate(ctx);
    expect(ctx.started).toHaveBeenCalled();
    expect(animations[0].el).toBe(shell);
    expect(animations[0].keyframes).toEqual([
      { transform: 'translateX(100%)' },
      { transform: 'none' },
    ]);
    expect(animations[0].options).toMatchObject({ duration: 50, fill: 'both' });
    resolveAll();
    await done;
    engine.cleanup(ctx);
    expect(animations[0].cancel).toHaveBeenCalledTimes(1);
  });

  it('animates host size, push padding and backdrop; arrays reverse on hide', () => {
    mockAnimate();
    const engine = new SplitKeyframesAnimationEngine({
      backdrop: [{ opacity: 0.2 }, { opacity: 1 }],
    });
    const target = document.createElement('main');
    const backdrop = document.createElement('div');
    const { ctx, host, shell } = context({
      phase: 'hide',
      layout: 'push',
      options: { preset: 'collapse', respectReducedMotion: true },
      from: frame({ hostSize: '300px', push: '300px' }),
      to: frame({ hostSize: '0px', push: '0px' }),
      properties: { host: 'width', push: 'padding-right' },
    });
    void engine.animate({ ...ctx, elements: { ...ctx.elements, pushTarget: target, backdrop } });
    expect(animations.map((a) => a.el)).toEqual([shell, host, target, backdrop]);
    expect(animations[1].keyframes).toEqual([{ width: '300px' }, { width: '0px' }]);
    expect(animations[2].keyframes).toEqual([{ paddingRight: '300px' }, { paddingRight: '0px' }]);
    expect(animations[3].keyframes).toEqual([{ opacity: 1 }, { opacity: 0.2 }]);
  });

  it('decelerates on show and accelerates on hide, unless an easing is given', () => {
    mockAnimate();
    void new SplitKeyframesAnimationEngine().animate(context().ctx);
    void new SplitKeyframesAnimationEngine().animate(context({ phase: 'hide' }).ctx);
    void new SplitKeyframesAnimationEngine().animate(
      context({
        phase: 'hide',
        options: { preset: 'slide', easing: 'linear', respectReducedMotion: true },
      }).ctx,
    );
    expect(animations.map((a) => a.options.easing)).toEqual([
      easingToCss(SPLIT_DEFAULT_EASING),
      easingToCss(SPLIT_DEFAULT_HIDE_EASING),
      'linear',
    ]);
  });

  it('builds slide and scale keyframes from origin, distance and scale', () => {
    mockAnimate();
    const engine = new SplitKeyframesAnimationEngine();
    void engine.animate(context({ options: { origin: 'left', distance: '2rem' } }).ctx);
    void engine.animate(
      context({ phase: 'hide', options: { preset: 'scale', scale: 1.2, origin: 'bottom' } }).ctx,
    );
    void engine.animate(
      context({ options: { preset: 'scale', scale: 0.8, origin: 'center' } }).ctx,
    );
    expect(animations[0].keyframes).toEqual([
      { transform: 'translateX(-2rem)' },
      { transform: 'none' },
    ]);
    expect(animations[1].keyframes).toEqual([
      { transform: 'none', transformOrigin: 'center bottom' },
      { transform: 'scale(1.2)', transformOrigin: 'center bottom' },
    ]);
    expect(animations[2].keyframes).toEqual([
      { transform: 'scale(0.8)', transformOrigin: 'center' },
      { transform: 'none', transformOrigin: 'center' },
    ]);
  });

  it('collapse reveals the shell like a curtain in every layout', () => {
    mockAnimate();
    const engine = new SplitKeyframesAnimationEngine();
    const target = document.createElement('main');
    const body = context({
      phase: 'hide',
      layout: 'push',
      options: { preset: 'collapse' },
      from: frame({ push: '300px' }),
      to: frame({ push: '0px' }),
      properties: { host: null, push: 'padding-right' },
    });
    void engine.animate({ ...body.ctx, elements: { ...body.ctx.elements, pushTarget: target } });
    expect(animations.map((a) => a.el)).toEqual([body.shell, target]);
    expect(animations[0].keyframes).toEqual([
      { clipPath: 'inset(0px 0px 0px 0px)' },
      { clipPath: 'inset(0px 0px 0px 100%)' },
    ]);

    mockAnimate();
    const overlay = context({ options: { preset: 'collapse' } });
    void engine.animate(overlay.ctx);
    expect(animations.map((a) => a.el)).toEqual([overlay.shell]);
    expect(animations[0].keyframes).toEqual([
      { clipPath: 'inset(0px 0px 0px 100%)' },
      { clipPath: 'inset(0px 0px 0px 0px)' },
    ]);

    mockAnimate();
    const custom = context({
      layout: 'push',
      options: { preset: 'collapse' },
      from: frame({ hostSize: '0px' }),
      to: frame({ hostSize: '300px' }),
      properties: { host: 'width', push: null },
    });
    void engine.animate(custom.ctx);
    expect(animations.map((a) => a.el)).toEqual([custom.shell, custom.host]);
    expect(animations[0].keyframes).toEqual([
      { transform: 'translateX(-100%)' },
      { transform: 'none' },
    ]);
  });

  it('translates easing objects to CSS easings', () => {
    mockAnimate();
    void new SplitKeyframesAnimationEngine().animate(
      context({ options: { easing: cubicBezier([0.3, 0, 0.2, 1]) } }).ctx,
    );
    void new SplitKeyframesAnimationEngine().animate(
      context({ options: { easing: steps(5) } }).ctx,
    );
    expect(animations.map((a) => a.options.easing)).toEqual([
      'cubic-bezier(0.3, 0, 0.2, 1)',
      'steps(5, jump-end)',
    ]);
  });

  it('with fade, animates only the shell, unless host/push keyframes are given', () => {
    const push = {
      layout: 'push' as const,
      options: { preset: 'fade' as const, respectReducedMotion: true },
      from: frame({ hostSize: '300px', push: '300px' }),
      to: frame({ hostSize: '0px', push: '0px' }),
      properties: { host: 'width' as const, push: 'padding-right' },
    };
    const target = document.createElement('main');

    mockAnimate();
    const plain = context({ phase: 'hide', ...push });
    void new SplitKeyframesAnimationEngine().animate({
      ...plain.ctx,
      elements: { ...plain.ctx.elements, pushTarget: target },
    });
    expect(animations.map((a) => a.el)).toEqual([plain.shell]);

    mockAnimate();
    const custom = context({ phase: 'hide', ...push });
    void new SplitKeyframesAnimationEngine({
      push: [{ paddingRight: '300px' }, { paddingRight: '300px' }],
    }).animate({ ...custom.ctx, elements: { ...custom.ctx.elements, pushTarget: target } });
    expect(animations.map((a) => a.el)).toEqual([custom.shell, target]);
  });

  it('uses custom keyframes, fade and none; aborts cancel the animations', () => {
    mockAnimate();
    const show = vi.fn(() => [{ opacity: 0 }, { opacity: 1 }]);
    const { ctx, abort } = context();
    void new SplitKeyframesAnimationEngine({ show }).animate(ctx);
    expect(show).toHaveBeenCalledWith(ctx);
    abort.abort();
    expect(animations[0].cancel).toHaveBeenCalled();

    mockAnimate();
    const fade = context({
      phase: 'hide',
      options: { preset: 'fade', respectReducedMotion: true },
    });
    void new SplitKeyframesAnimationEngine().animate(fade.ctx);
    expect(animations[0].keyframes).toEqual([{ opacity: 1 }, { opacity: 0 }]);

    mockAnimate();
    const none = context({ options: { preset: 'none', respectReducedMotion: true } });
    expect(new SplitKeyframesAnimationEngine().animate(none.ctx)).toBeUndefined();
    expect(animations).toHaveLength(0);
  });

  it('ends at once without element.animate', () => {
    proto.animate = undefined;
    const { ctx } = context();
    expect(new SplitKeyframesAnimationEngine().animate(ctx)).toBeUndefined();
    expect(ctx.started).not.toHaveBeenCalled();
  });
});
