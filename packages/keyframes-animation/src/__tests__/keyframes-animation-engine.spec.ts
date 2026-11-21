import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SplitAnimationContext, SplitAnimationFrame } from '@split-window/core';
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

function context(patch: Partial<SplitAnimationContext<HTMLElement>> = {}) {
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
    options: { preset: 'slide', respectReducedMotion: true },
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
  it('slides the shell from the frames and resolves when the animations finish', async () => {
    mockAnimate();
    const engine = new SplitKeyframesAnimationEngine();
    const { ctx, shell } = context({
      options: { preset: 'slide', duration: 50, respectReducedMotion: true },
    });
    const done = engine.animate(ctx);
    expect(ctx.started).toHaveBeenCalled();
    expect(animations[0].el).toBe(shell);
    expect(animations[0].keyframes).toEqual([
      { transform: 'translate(100px, 0px)' },
      { transform: 'translate(0px, 0px)' },
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
    const { ctx, host } = context({
      phase: 'hide',
      layout: 'push',
      options: { preset: 'collapse', respectReducedMotion: true },
      from: frame({ hostSize: '300px', push: '300px' }),
      to: frame({ hostSize: '0px', push: '0px' }),
      properties: { host: 'width', push: 'padding-right' },
    });
    void engine.animate({ ...ctx, elements: { ...ctx.elements, pushTarget: target, backdrop } });
    expect(animations.map((a) => a.el)).toEqual([host, target, backdrop]);
    expect(animations[0].keyframes).toEqual([{ width: '300px' }, { width: '0px' }]);
    expect(animations[1].keyframes).toEqual([{ paddingRight: '300px' }, { paddingRight: '0px' }]);
    expect(animations[2].keyframes).toEqual([{ opacity: 1 }, { opacity: 0.2 }]);
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
