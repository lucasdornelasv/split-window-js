import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  SplitAnimationContext,
  SplitAnimationFrame,
  SplitAnimationSettings,
  SplitEasingInput,
} from '@split-window/core';
import {
  splitAnimationEngineScenarios,
  type SplitAnimationContractPreset,
  type SplitAnimationEngineDriver,
  type SplitAnimationRole,
  type SplitAnimationTrack,
} from '@split-window/core/testing';
import { KeyframesSplitAnimationEngine, type KeyframesSplitAnimationPreset } from '../index.js';

/*
 * jsdom has no Web Animations API: `element.animate` is replaced by a fake that records the
 * keyframes and timing, finishes on demand and rejects `finished` when cancelled, as a
 * browser does.
 */
interface FakeAnimation {
  el: Element;
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
  cancelled: boolean;
  resolve: () => void;
}

let animations: FakeAnimation[] = [];
const proto = HTMLElement.prototype as unknown as { animate?: unknown };
const original = proto.animate;

beforeEach(() => {
  animations = [];
  proto.animate = function (
    this: Element,
    keyframes: Keyframe[],
    options: KeyframeAnimationOptions,
  ) {
    let resolve!: () => void;
    let reject!: (error: unknown) => void;
    const finished = new Promise<void>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    const animation: FakeAnimation = { el: this, keyframes, options, cancelled: false, resolve };
    animations.push(animation);
    return {
      finished,
      cancel: () => {
        if (animation.cancelled) return;
        animation.cancelled = true;
        reject(new DOMException('The animation was cancelled', 'AbortError'));
      },
    } as unknown as Animation;
  };
});

afterEach(() => {
  proto.animate = original;
});

// ------------------------------------------------------------ contract

class TranslatingKeyframesEngine extends KeyframesSplitAnimationEngine {
  constructor(private readonly translator: (easing: SplitEasingInput) => string) {
    super();
  }

  protected override translateEasing(easing: SplitEasingInput): string {
    return this.translator(easing);
  }
}

const roles = (ctx: SplitAnimationContext<HTMLElement>) =>
  new Map<Element, SplitAnimationRole>(
    (['shell', 'host', 'pushTarget', 'backdrop'] as const)
      .filter((role) => ctx.elements[role] !== null)
      .map((role) => [ctx.elements[role]!, role]),
  );

const kebab = (key: string) => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const NOT_PROPERTIES = new Set(['offset', 'easing', 'composite']);

const camel = (property: string) =>
  property.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

/** Keyframes of a preset of the contract: the shell goes from `from` (out of view) to `to`. */
function presetKeyframes(preset: SplitAnimationContractPreset): KeyframesSplitAnimationPreset {
  const frame = (end: 'from' | 'to') =>
    Object.fromEntries(preset.shell.map((t) => [camel(t.property), t[end]]));
  return { show: [frame('from'), frame('to')], sizes: preset.sizes };
}

const keyframesDriver: SplitAnimationEngineDriver<HTMLElement> = {
  create(options) {
    const engine = options?.translateEasing
      ? new TranslatingKeyframesEngine(options.translateEasing)
      : new KeyframesSplitAnimationEngine();
    for (const [name, preset] of Object.entries(options?.presets ?? {})) {
      expect(engine.addPreset(name, presetKeyframes(preset))).toBe(engine);
    }
    return engine;
  },
  elements() {
    const [shell, host, pushTarget, backdrop] = ['div', 'div', 'main', 'div'].map((tag) =>
      document.createElement(tag),
    );
    return { shell, host, pushTarget, backdrop };
  },
  start(engine, ctx) {
    const first = animations.length;
    const result = engine.animate(ctx);
    const played = animations.slice(first);
    const role = roles(ctx);
    const tracks: SplitAnimationTrack[] = [];
    for (const a of played) {
      const start = a.keyframes[0] as Record<string, unknown>;
      const end = a.keyframes[a.keyframes.length - 1] as Record<string, unknown>;
      const keys = new Set([...Object.keys(start), ...Object.keys(end)]);
      for (const key of keys) {
        if (NOT_PROPERTIES.has(key)) continue;
        tracks.push({
          element: role.get(a.el)!,
          property: kebab(key),
          from: String(start[key]),
          to: String(end[key]),
        });
      }
    }
    const options = played[0]?.options;
    const timing = options
      ? {
          duration: Number(options.duration),
          easing: String(options.easing),
          delay: options.delay ?? 0,
        }
      : null;
    return { result, tracks, timing };
  },
  finish(ctx) {
    const role = roles(ctx);
    for (const a of animations) if (role.has(a.el) && !a.cancelled) a.resolve();
  },
  snapshot(el) {
    const running = animations.filter((a) => a.el === el && !a.cancelled).length;
    const attributes = [...el.attributes].map((a) => `${a.name}=${a.value}`).sort();
    return JSON.stringify({ attributes, running });
  },
};

describe('KeyframesSplitAnimationEngine: contract of the animation engines', () => {
  for (const scenario of splitAnimationEngineScenarios) {
    it(scenario.name, () => scenario.run(keyframesDriver));
  }
});

// ------------------------------------------------------------ keyframes engine only

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
  const ctx: SplitAnimationContext<HTMLElement> = {
    phase: 'show',
    container: {} as never,
    layout: 'overlay',
    side: 'right',
    size: '300px',
    elements: { shell, host, backdrop: null, pushTarget: null },
    from: frame(),
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
    signal: new AbortController().signal,
    started: vi.fn(),
    progress: () => undefined,
    ...patch,
  };
  return { ctx, shell, host };
}

describe('KeyframesSplitAnimationEngine: keyframes only', () => {
  it('addPreset chains, the presets option adds them too, and built-in names are reserved', () => {
    const show = [{ opacity: 0 }, { opacity: 1 }];
    const engine = new KeyframesSplitAnimationEngine({ presets: { a: { show } } });
    expect(engine.addPreset('b', { show }).addPreset('c', { hide: show })).toBe(engine);
    for (const name of ['a', 'b', 'c']) {
      expect(() => engine.animate(context({ options: { preset: name } }).ctx)).not.toThrow();
    }
    for (const name of ['slide', 'fade', 'scale', 'collapse', 'none', '', ' ']) {
      expect(() => engine.addPreset(name, { show }), name).toThrow(/presets/);
    }
    expect(() => engine.addPreset('x', null as never)).toThrow(/presets\.x/);
    expect(() => engine.addPreset('x', { show: 'a' as never })).toThrow(/presets\.x\.show/);
    expect(() => engine.addPreset('x', { backdrop: 3 as never })).toThrow(/backdrop/);
    expect(() => engine.addPreset('x', { sizes: 'yes' as never })).toThrow(/sizes/);
  });

  it('a preset with only show plays it backwards on hide, and the other way around', () => {
    const keyframes = [{ opacity: 0 }, { opacity: 0.5 }, { opacity: 1 }];
    const engine = new KeyframesSplitAnimationEngine()
      .addPreset('in', { show: keyframes })
      .addPreset('out', { hide: keyframes });
    void engine.animate(context({ phase: 'hide', options: { preset: 'in' } }).ctx);
    void engine.animate(context({ phase: 'show', options: { preset: 'out' } }).ctx);
    expect(animations[0].keyframes).toEqual([...keyframes].reverse());
    expect(animations[1].keyframes).toEqual([...keyframes].reverse());
  });

  it('keyframe functions of a preset receive the context', () => {
    const show = vi.fn(() => [{ opacity: 0 }, { opacity: 1 }]);
    const { ctx, shell } = context({ options: { preset: 'fn' } });
    void new KeyframesSplitAnimationEngine().addPreset('fn', { show }).animate(ctx);
    expect(show).toHaveBeenCalledWith(ctx);
    expect(animations.map((a) => a.el)).toEqual([shell]);
  });

  it('host, push and backdrop of a preset play (backwards on hide) without sizes', () => {
    const engine = new KeyframesSplitAnimationEngine().addPreset('own', {
      show: [{ opacity: 0 }, { opacity: 1 }],
      host: [{ width: '10px' }, { width: '20px' }],
      push: [{ paddingRight: '1px' }, { paddingRight: '2px' }],
      backdrop: [{ opacity: 0.2 }, { opacity: 1 }],
    });
    const target = document.createElement('main');
    const backdrop = document.createElement('div');
    const { ctx, host } = context({
      phase: 'hide',
      layout: 'push',
      options: { preset: 'own' },
      from: frame({ hostSize: '300px', push: '300px' }),
      to: frame({ hostSize: '0px', push: '0px' }),
      properties: { host: 'width', push: 'padding-right' },
    });
    void engine.animate({ ...ctx, elements: { ...ctx.elements, pushTarget: target, backdrop } });
    const of = (el: Element) => animations.find((a) => a.el === el)!.keyframes;
    expect(of(host)).toEqual([{ width: '20px' }, { width: '10px' }]);
    expect(of(target)).toEqual([{ paddingRight: '2px' }, { paddingRight: '1px' }]);
    expect(of(backdrop)).toEqual([{ opacity: 1 }, { opacity: 0.2 }]);
  });

  it('holds the end state (fill: both) until cleanup cancels the animations', async () => {
    const engine = new KeyframesSplitAnimationEngine();
    const { ctx } = context();
    const done = engine.animate(ctx);
    expect(animations[0].options.fill).toBe('both');
    animations[0].resolve();
    await done;
    engine.cleanup(ctx);
    expect(animations[0].cancelled).toBe(true);
  });

  it('ends at once without element.animate', () => {
    proto.animate = undefined;
    const { ctx } = context();
    expect(new KeyframesSplitAnimationEngine().animate(ctx)).toBeUndefined();
    expect(ctx.started).toHaveBeenCalledTimes(1);
  });
});
