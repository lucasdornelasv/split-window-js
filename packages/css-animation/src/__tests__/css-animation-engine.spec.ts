import { afterEach, describe, expect, it, vi } from 'vitest';
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
import {
  CssSplitAnimationEngine,
  SPLIT_CSS_ANIMATION_STYLE_ID,
  SPLIT_CSS_PRESET_STYLE_ATTRIBUTE,
  type SplitCssAnimationClasses,
} from '../index.js';

/*
 * jsdom does not compute `transition-duration` from rules with custom properties, so the
 * time the engine waits for is computed here as a browser would: the inline transition (host
 * size, padding, reveal), the preset duration of the state classes, or an explicit duration.
 */
const { transitionMs } = vi.hoisted(() => {
  const ms = (value: string) =>
    value.endsWith('ms') ? parseFloat(value) : value.endsWith('s') ? parseFloat(value) * 1000 : 0;
  const transitionMs = (el: HTMLElement): number => {
    const inline = el.style.getPropertyValue('transition');
    if (inline && inline !== 'none') {
      return Math.max(
        ...inline.split(',').map((part) => {
          const times = part.match(/-?[\d.]+m?s\b/g) ?? [];
          return ms(times[0] ?? '0s') + ms(times[1] ?? '0s');
        }),
      );
    }
    // Every preset but none and collapse (inline only) has a transition on the state classes.
    const preset = el.getAttribute('data-split-animation');
    const moving = el.classList.contains('split-showing') || el.classList.contains('split-hiding');
    if (moving && preset && preset !== 'none' && preset !== 'collapse') {
      return (
        ms(el.style.getPropertyValue('--split-animation-duration') || '200ms') +
        ms(el.style.getPropertyValue('--split-animation-delay') || '0ms')
      );
    }
    return ms(el.style.transitionDuration || '0s');
  };
  return { transitionMs };
});

vi.mock('@split-window/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@split-window/core')>()),
  transitionTimeMs: transitionMs,
}));

afterEach(() => {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
});

// ------------------------------------------------------------ contract

/** CSS of a preset of the contract: the shell goes from `from` (out of view) to `to`. */
function presetCss(name: string, preset: SplitAnimationContractPreset): string {
  const sel = `[data-split-animation='${name}']`;
  const properties = preset.shell.map((t) => t.property).join(', ');
  const out = preset.shell.map((t) => `${t.property}: ${t.from};`).join(' ');
  return [
    `${sel}:is(.split-showing, .split-hiding) { transition-property: ${properties};`,
    '  transition-duration: var(--split-animation-duration);',
    '  transition-timing-function: var(--split-animation-easing);',
    '  transition-delay: var(--split-animation-delay); }',
    `${sel}.split-hiding { transition-timing-function: var(--split-animation-easing-hide); }`,
    `${sel}:is(.split-enter-from, .split-hiding) { ${out} }`,
  ].join('\n');
}

/** Exposes the timing the engine applies (inline transitions and preset variables). */
class ObservedCssEngine extends CssSplitAnimationEngine {
  /** Presets of the contract added to this engine, by name. */
  readonly contractPresets = new Map<string, SplitAnimationContractPreset>();

  constructor(private readonly translator?: (easing: SplitEasingInput) => string) {
    super();
  }

  protected override translateEasing(
    easing: SplitEasingInput,
    ctx: SplitAnimationContext<HTMLElement>,
  ): string {
    return this.translator ? this.translator(easing) : super.translateEasing(easing, ctx);
  }

  timingOf(ctx: SplitAnimationContext<HTMLElement>) {
    return {
      duration: parseFloat(this.duration(ctx)),
      easing: this.easing(ctx),
      delay: ctx.options.delay ?? 0,
    };
  }
}

const roles = (ctx: SplitAnimationContext<HTMLElement>) =>
  (['shell', 'host', 'pushTarget', 'backdrop'] as const)
    .map((role) => [role, ctx.elements[role]] as const)
    .filter((entry): entry is readonly [SplitAnimationRole, HTMLElement] => entry[1] !== null);

/**
 * Tracks of a preset played by the state classes: the built-in styles of the engine, or the
 * CSS of an added preset (counted only when the engine injected it in the document).
 */
function presetTracks(
  engine: ObservedCssEngine,
  role: SplitAnimationRole,
  el: HTMLElement,
  phase: 'show' | 'hide',
): SplitAnimationTrack[] {
  const variable = (name: string) => el.style.getPropertyValue(name);
  const out: SplitAnimationTrack[] = [];
  const name = el.getAttribute('data-split-animation') ?? '';
  const added = engine.contractPresets.get(name);
  if (added) {
    const style = [...document.head.querySelectorAll('style')].find(
      (s) => s.getAttribute(SPLIT_CSS_PRESET_STYLE_ATTRIBUTE) === name,
    );
    if (style?.textContent === presetCss(name, added)) {
      for (const t of added.shell) out.push({ element: role, ...t });
    }
  }
  switch (name) {
    case 'slide':
      out.push({
        element: role,
        property: 'transform',
        from: variable('--split-slide'),
        to: 'none',
      });
      break;
    case 'fade':
      out.push({ element: role, property: 'opacity', from: '0', to: '1' });
      break;
    case 'scale': {
      const origin = variable('--split-transform-origin');
      out.push({
        element: role,
        property: 'transform',
        from: `scale(${variable('--split-scale')})`,
        to: 'none',
      });
      out.push({ element: role, property: 'transform-origin', from: origin, to: origin });
      break;
    }
  }
  return phase === 'show' ? out : out.map((t) => ({ ...t, from: t.to, to: t.from }));
}

const cssDriver: SplitAnimationEngineDriver<HTMLElement> = {
  create(options) {
    const engine = new ObservedCssEngine(options?.translateEasing);
    for (const [name, preset] of Object.entries(options?.presets ?? {})) {
      engine.contractPresets.set(name, preset);
      expect(engine.addPreset(name, { styles: presetCss(name, preset), sizes: preset.sizes })).toBe(
        engine,
      );
    }
    return engine;
  },
  elements() {
    const [shell, host, pushTarget, backdrop] = ['div', 'div', 'main', 'div'].map((tag) =>
      document.body.appendChild(document.createElement(tag)),
    );
    return { shell, host, pushTarget, backdrop };
  },
  start(engine, ctx) {
    // Every inline style the engine writes, in order: inline transitions go from the
    // first value written to the last one.
    const writes = new Map<HTMLElement, [string, string][]>();
    const elements = roles(ctx);
    for (const [, el] of elements) {
      const original = el.style.setProperty.bind(el.style);
      writes.set(el, []);
      el.style.setProperty = (property: string, value: string | null, priority?: string) => {
        writes.get(el)!.push([property, value ?? '']);
        original(property, value, priority);
      };
    }
    let result: Promise<void> | void;
    try {
      result = engine.animate(ctx);
    } finally {
      for (const [, el] of elements) delete (el.style as { setProperty?: unknown }).setProperty;
    }
    const tracks: SplitAnimationTrack[] = [];
    for (const [role, el] of elements) {
      const inline = new Map<string, { from: string; to: string }>();
      for (const [property, value] of writes.get(el)!) {
        if (property.startsWith('--') || property === 'transition') continue;
        const t = inline.get(property);
        if (t) t.to = value;
        else inline.set(property, { from: value, to: value });
      }
      for (const [property, { from, to }] of inline)
        tracks.push({ element: role, property, from, to });
      tracks.push(...presetTracks(engine as ObservedCssEngine, role, el, ctx.phase));
    }
    const timing = tracks.length ? (engine as ObservedCssEngine).timingOf(ctx) : null;
    return { result, tracks, timing };
  },
  finish(ctx) {
    for (const [, el] of roles(ctx)) el.dispatchEvent(new Event('transitionend'));
  },
  snapshot(el) {
    // The open state of a show (split-show) stays on purpose.
    const classes = [...el.classList].filter((c) => c !== 'split-show').sort();
    const attributes = [...el.attributes]
      .filter((a) => a.name !== 'style' && a.name !== 'class')
      .map((a) => `${a.name}=${a.value}`)
      .sort();
    return JSON.stringify({ style: el.style.cssText, classes, attributes });
  },
};

describe('CssSplitAnimationEngine: contract of the animation engines', () => {
  for (const scenario of splitAnimationEngineScenarios) {
    it(scenario.name, () => scenario.run(cssDriver));
  }
});

// ------------------------------------------------------------ CSS engine only

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
    signal: abort.signal,
    started: () => undefined,
    progress: () => undefined,
    ...patch,
  };
  return { ctx, shell, host, abort };
}

describe('CssSplitAnimationEngine: CSS only', () => {
  it('injects the preset styles once per document, unless injectStyles is false', () => {
    const engine = new CssSplitAnimationEngine();
    void engine.animate(context().ctx);
    void engine.animate(context().ctx);
    expect(document.querySelectorAll(`#${SPLIT_CSS_ANIMATION_STYLE_ID}`)).toHaveLength(1);
    expect(document.head.firstElementChild?.id).toBe(SPLIT_CSS_ANIMATION_STYLE_ID);
    expect(document.getElementById(SPLIT_CSS_ANIMATION_STYLE_ID)?.textContent).toContain(
      "[data-split-animation='scale']:is(.split-enter-from, .split-hiding) { transform: scale(var(--split-scale)); }",
    );
    document.head.innerHTML = '';
    void new CssSplitAnimationEngine({ injectStyles: false }).animate(context().ctx);
    expect(document.getElementById(SPLIT_CSS_ANIMATION_STYLE_ID)).toBeNull();
  });

  it('a show goes split-showing → split-show; a hide uses split-hiding', async () => {
    const engine = new CssSplitAnimationEngine();
    const show = context();
    const done = engine.animate(show.ctx);
    expect(show.shell.classList).toContain('split-showing');
    expect(show.shell.getAttribute('data-split-animation')).toBe('slide');
    show.shell.dispatchEvent(new Event('transitionend'));
    await done;
    expect(show.shell.classList).toContain('split-show');
    expect(show.shell.classList).not.toContain('split-showing');
    engine.cleanup(show.ctx);
    expect(show.shell.classList).toContain('split-show');
    expect(show.shell.getAttribute('data-split-animation')).toBeNull();

    const hide = context({ phase: 'hide' });
    hide.shell.classList.add('split-show');
    const hiding = engine.animate(hide.ctx);
    expect(hide.shell.classList).toContain('split-hiding');
    expect(hide.shell.classList).not.toContain('split-show');
    hide.shell.dispatchEvent(new Event('animationend'));
    await hiding;
    engine.cleanup(hide.ctx);
    expect(hide.shell.classList).not.toContain('split-hiding');
  });

  it('an abort skips the split-show class', async () => {
    const { ctx, shell, abort } = context();
    const done = new CssSplitAnimationEngine().animate(ctx);
    abort.abort();
    await done;
    expect(shell.classList).not.toContain('split-show');
  });

  it('ends by the timeout when no transitionend arrives', async () => {
    vi.useFakeTimers();
    try {
      const { ctx } = context({ options: { preset: 'fade', duration: 100 } });
      let ended = false;
      void (new CssSplitAnimationEngine().animate(ctx) as Promise<void>).then(() => (ended = true));
      await vi.advanceTimersByTimeAsync(100);
      expect(ended).toBe(false);
      await vi.advanceTimersByTimeAsync(60);
      expect(ended).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('sets both easing variables from the easing option', () => {
    const { ctx, shell } = context({ options: { preset: 'fade', easing: 'linear' } });
    void new CssSplitAnimationEngine().animate(ctx);
    expect(shell.style.getPropertyValue('--split-animation-easing')).toBe('linear');
    expect(shell.style.getPropertyValue('--split-animation-easing-hide')).toBe('linear');
  });

  it('addPreset chains, the presets option adds them too, and built-in names are reserved', () => {
    const engine = new CssSplitAnimationEngine({ presets: { a: { styles: '.a {}' } } });
    expect(engine.addPreset('b', {}).addPreset('c', { sizes: true })).toBe(engine);
    for (const name of ['a', 'b', 'c']) {
      expect(() => engine.animate(context({ options: { preset: name } }).ctx)).not.toThrow();
    }
    for (const name of ['slide', 'fade', 'scale', 'collapse', 'none', '', ' ']) {
      expect(() => engine.addPreset(name, {}), name).toThrow(/presets/);
    }
    expect(() => engine.addPreset('x', null as never)).toThrow(/presets\.x/);
    expect(() => engine.addPreset('x', { styles: 3 as never })).toThrow(/presets\.x\.styles/);
    expect(() => engine.addPreset('x', { variables: 'a' as never })).toThrow(/variables/);
    expect(() => engine.addPreset('x', { backdrop: '' })).toThrow(/backdrop/);
    expect(() => engine.addPreset('x', { sizes: 'yes' as never })).toThrow(/sizes/);
  });

  it('injects the CSS of a preset once, after the built-in styles, and updates it', () => {
    const engine = new CssSplitAnimationEngine().addPreset('pop', { styles: '.pop { a: 1 }' });
    void engine.animate(context({ options: { preset: 'pop' } }).ctx);
    void engine.animate(context({ options: { preset: 'pop' } }).ctx);
    const styles = [...document.head.querySelectorAll('style')];
    expect(styles.map((s) => s.id || s.getAttribute(SPLIT_CSS_PRESET_STYLE_ATTRIBUTE))).toEqual([
      SPLIT_CSS_ANIMATION_STYLE_ID,
      'pop',
    ]);
    engine.addPreset('pop', { styles: '.pop { a: 2 }' });
    void engine.animate(context({ options: { preset: 'pop' } }).ctx);
    expect(document.head.querySelectorAll('style')).toHaveLength(2);
    expect(document.head.lastElementChild?.textContent).toBe('.pop { a: 2 }');
  });

  it('a preset sets its variables (fixed or from the context) and names the backdrop preset', () => {
    const engine = new CssSplitAnimationEngine()
      .addPreset('pop', { variables: { '--pop-scale': '0.5' }, backdrop: 'veil' })
      .addPreset('veil', { styles: '.veil {}' })
      .addPreset('side', { variables: (ctx) => ({ '--from': ctx.side }) });
    const backdrop = document.createElement('div');
    const pop = context({ options: { preset: 'pop' } });
    const popCtx = { ...pop.ctx, elements: { ...pop.ctx.elements, backdrop } };
    void engine.animate(popCtx);
    expect(pop.shell.style.getPropertyValue('--pop-scale')).toBe('0.5');
    expect(backdrop.getAttribute('data-split-animation')).toBe('veil');
    expect(document.querySelector(`[${SPLIT_CSS_PRESET_STYLE_ATTRIBUTE}="veil"]`)).not.toBeNull();
    engine.cleanup(popCtx);
    expect(pop.shell.style.getPropertyValue('--pop-scale')).toBe('');

    const side = context({ side: 'left', options: { preset: 'side' } });
    void engine.animate(side.ctx);
    expect(side.shell.style.getPropertyValue('--from')).toBe('left');
  });

  it('custom classes and classesFor; the backdrop gets the state classes too', () => {
    class Custom extends CssSplitAnimationEngine {
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
