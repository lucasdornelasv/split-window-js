import {
  SPLIT_ANIMATION_PRESETS,
  SplitAnimationEngine,
  SplitInvalidOptionError,
  collapseReveal,
  isBuiltInAnimationPreset,
  defaultEasing,
  easingToCss,
  presetAnimatesSizes,
  scaleTransformOrigin,
  slideTransform,
  type SplitAnimationContext,
  type SplitEasingInput,
} from '@split-window/core';

/** Keyframes, or a function that builds them from the context (frames, side, phase...). */
export type SplitKeyframesInput =
  Keyframe[] | ((ctx: SplitAnimationContext<HTMLElement>) => Keyframe[]);

/**
 * A preset added to the engine (`addPreset`), picked by name in `animation.preset`,
 * `animation.show` or `animation.hide`, like the built-in ones.
 */
export interface KeyframesSplitAnimationPreset {
  /** Keyframes of the shell on show. Without it, those of `hide`, played backwards. */
  show?: SplitKeyframesInput;
  /** Keyframes of the shell on hide. Without it, those of `show`, played backwards. */
  hide?: SplitKeyframesInput;
  /**
   * Host size (custom `push`). Arrays play backwards on hide. Without it, the host size
   * animates only with `sizes`.
   */
  host?: SplitKeyframesInput;
  /**
   * Page padding (body `push`). Arrays play backwards on hide. Without it, the padding
   * animates only with `sizes`.
   */
  push?: SplitKeyframesInput;
  /** Backdrop. Arrays play backwards on hide. Default: a fade. */
  backdrop?: SplitKeyframesInput;
  /**
   * Animates the host size and the page padding from the frames, like `slide`. Default:
   * `false`: they change at once, at the start of a show and at the end of a hide.
   */
  sizes?: boolean;
}

export interface KeyframesSplitAnimationEngineOptions {
  /** Presets of this engine, by name. Same as calling `addPreset` for each one. */
  presets?: Record<string, KeyframesSplitAnimationPreset>;
}

/** One element and the keyframes it plays. */
export interface SplitKeyframesTarget {
  element: Element;
  keyframes: Keyframe[];
}

const camel = (property: string) =>
  property.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

/**
 * Web Animations engine: plays keyframes on the shell, the host, the push target and the
 * backdrop. The keyframes come from the preset of the phase: a built-in one (built from the
 * options and the frames of the context) or one added with `addPreset`. Duration, easing
 * and delay come from the animation options (default 200ms).
 *
 * ```ts
 * new KeyframesSplitAnimationEngine().addPreset('pop', {
 *   show: [{ opacity: 0, transform: 'scale(.95)' }, { opacity: 1, transform: 'none' }],
 * });
 *
 * animation: { engine: 'keyframes', show: 'pop', hide: 'slide', duration: 250 }
 * ```
 *
 * Extend it and override `keyframes`, `shellKeyframes`, `timing`, `translateEasing` or
 * `animatesSizes`.
 */
export class KeyframesSplitAnimationEngine extends SplitAnimationEngine<HTMLElement> {
  private readonly running = new WeakMap<SplitAnimationContext<HTMLElement>, Animation[]>();
  /** Presets added to this engine, by name. */
  protected readonly presets = new Map<string, KeyframesSplitAnimationPreset>();

  constructor(options: KeyframesSplitAnimationEngineOptions = {}) {
    super();
    for (const [name, preset] of Object.entries(options.presets ?? {})) {
      this.addPreset(name, preset);
    }
  }

  /**
   * Adds (or replaces) a preset, picked by its name in the animation options. The names
   * of the built-in presets are reserved.
   * @returns this engine, to chain calls.
   * @throws SplitInvalidOptionError for an invalid name or preset.
   */
  addPreset(name: string, preset: KeyframesSplitAnimationPreset): this {
    checkPresetName(name);
    const input = (key: keyof KeyframesSplitAnimationPreset) => {
      const value = preset?.[key];
      if (value !== undefined && !Array.isArray(value) && typeof value !== 'function') {
        throw new SplitInvalidOptionError(`presets.${name}.${key}`, value, 'keyframes ou função');
      }
    };
    if (typeof preset !== 'object' || preset === null) {
      throw new SplitInvalidOptionError(`presets.${name}`, preset, 'objeto de preset');
    }
    for (const key of ['show', 'hide', 'host', 'push', 'backdrop'] as const) input(key);
    if (preset.sizes !== undefined && typeof preset.sizes !== 'boolean') {
      throw new SplitInvalidOptionError(`presets.${name}.sizes`, preset.sizes, 'boolean');
    }
    this.presets.set(name, preset);
    return this;
  }

  animate(ctx: SplitAnimationContext<HTMLElement>): Promise<void> | void {
    const timing = this.timing(ctx);
    const targets = this.keyframes(ctx).filter(
      (t) => t.keyframes.length > 0 && typeof (t.element as HTMLElement).animate === 'function',
    );
    ctx.started();
    // Nothing to play, or no time to play it: the transition ends at once.
    const time = Number(timing.duration ?? 0) + (timing.delay ?? 0);
    if (targets.length === 0 || !(time > 0)) return;
    const animations = targets.map((t) => t.element.animate(t.keyframes, timing));
    this.running.set(ctx, animations);
    ctx.signal.addEventListener('abort', () => animations.forEach((a) => a.cancel()), {
      once: true,
    });
    return Promise.all(animations.map((a) => a.finished.catch(() => undefined))).then(
      () => undefined,
    );
  }

  override cleanup(ctx: SplitAnimationContext<HTMLElement>): void {
    this.running.get(ctx)?.forEach((a) => a.cancel());
    this.running.delete(ctx);
  }

  /**
   * Translates an easing to the Web Animations API, which takes CSS easings
   * (`cubicBezier([0.2, 0, 0, 1])` → `cubic-bezier(0.2, 0, 0, 1)`, springs to a sampled
   * `linear()`). Override it to support easings of your own type.
   */
  protected translateEasing(
    easing: SplitEasingInput,
    _ctx: SplitAnimationContext<HTMLElement>,
  ): string {
    return easingToCss(easing);
  }

  /** Timing of every animation of the transition. */
  protected timing(ctx: SplitAnimationContext<HTMLElement>): KeyframeAnimationOptions {
    return {
      duration: ctx.options.duration ?? 200,
      easing: this.translateEasing(ctx.options.easing ?? defaultEasing(ctx.phase), ctx),
      delay: ctx.options.delay ?? 0,
      // Holds the end state until `cleanup`, which runs right before the final layout.
      fill: 'both',
    };
  }

  /**
   * Every element and its keyframes, from the preset of the phase.
   * @throws SplitInvalidOptionError for a preset this engine does not know.
   */
  protected keyframes(ctx: SplitAnimationContext<HTMLElement>): SplitKeyframesTarget[] {
    const preset = this.presetOf(ctx);
    const { elements, properties, from, to, phase } = ctx;
    const targets: SplitKeyframesTarget[] = [];
    const shell = preset ? this.presetShellKeyframes(preset, ctx) : this.shellKeyframes(ctx);
    targets.push({ element: elements.shell, keyframes: shell });
    if (ctx.options.preset === 'none') return targets;

    // Keyframes of the preset always play; the ones from the frames only when sizes animate.
    const sizes = this.animatesSizes(ctx);
    if (properties.host && from.hostSize !== null && to.hostSize !== null) {
      const key = camel(properties.host);
      const keyframes =
        this.read(preset?.host, ctx, true) ??
        (sizes ? [{ [key]: from.hostSize }, { [key]: to.hostSize }] : null);
      if (keyframes) targets.push({ element: elements.host, keyframes });
    }
    if (properties.push && elements.pushTarget && from.push !== null && to.push !== null) {
      const key = camel(properties.push);
      const keyframes =
        this.read(preset?.push, ctx, true) ??
        (sizes ? [{ [key]: from.push }, { [key]: to.push }] : null);
      if (keyframes) targets.push({ element: elements.pushTarget, keyframes });
    }
    if (elements.backdrop) {
      const show = phase === 'show';
      targets.push({
        element: elements.backdrop,
        keyframes: this.read(preset?.backdrop, ctx, true) ?? [
          { opacity: show ? 0 : 1 },
          { opacity: show ? 1 : 0 },
        ],
      });
    }
    return targets;
  }

  /**
   * The added preset of the phase, or `null` for a built-in one.
   * @throws SplitInvalidOptionError for a preset this engine does not know.
   */
  protected presetOf(
    ctx: SplitAnimationContext<HTMLElement>,
  ): KeyframesSplitAnimationPreset | null {
    const name = ctx.options.preset;
    const preset = this.presets.get(name);
    if (preset) return preset;
    if (isBuiltInAnimationPreset(name)) return null;
    throw new SplitInvalidOptionError(
      'animation.preset',
      name,
      [...SPLIT_ANIMATION_PRESETS, ...this.presets.keys()].join(' | '),
    );
  }

  /**
   * Keyframes of the shell for an added preset: its `show`/`hide`, or the other one played
   * backwards.
   */
  protected presetShellKeyframes(
    preset: KeyframesSplitAnimationPreset,
    ctx: SplitAnimationContext<HTMLElement>,
  ): Keyframe[] {
    const own = ctx.phase === 'show' ? preset.show : preset.hide;
    if (own) return this.read(own, ctx, false)!;
    const other = ctx.phase === 'show' ? preset.hide : preset.show;
    return other ? [...this.read(other, ctx, false)!].reverse() : [];
  }

  /**
   * Whether the sizes that change with the layout (host size, push padding) animate: with
   * `slide` and `collapse`, and with an added preset that sets `sizes`. Otherwise they
   * change at once: the open layout is applied at the start of a show and removed only
   * after a hide.
   */
  protected animatesSizes(ctx: SplitAnimationContext<HTMLElement>): boolean {
    const preset = this.presets.get(ctx.options.preset);
    return preset ? preset.sizes === true : presetAnimatesSizes(ctx.options.preset);
  }

  /**
   * Keyframes of the shell for the preset of the phase, from the out-of-view state to the
   * open one on show and back on hide: `slide` (`origin`, `distance`), `scale` (`scale`,
   * anchored at `origin`), `fade` and `collapse` (a curtain: the panel stays still and shows
   * from the edge at its side, `collapseReveal`).
   */
  protected shellKeyframes(ctx: SplitAnimationContext<HTMLElement>): Keyframe[] {
    const { options, phase } = ctx;
    let out: Keyframe;
    let open: Keyframe;
    switch (options.preset) {
      case 'slide':
        out = { transform: slideTransform(options.origin, options.distance) };
        open = { transform: 'none' };
        break;
      case 'scale': {
        const transformOrigin = scaleTransformOrigin(options.origin);
        out = { transform: `scale(${options.scale})`, transformOrigin };
        open = { transform: 'none', transformOrigin };
        break;
      }
      case 'fade':
        out = { opacity: 0 };
        open = { opacity: 1 };
        break;
      case 'collapse': {
        // A curtain: the panel stays still and shows from the edge at its side.
        const reveal = collapseReveal(ctx);
        if (!reveal) return [];
        const key = reveal.property === 'clip-path' ? 'clipPath' : 'transform';
        out = { [key]: reveal.closed };
        open = { [key]: reveal.open };
        break;
      }
      default:
        return [];
    }
    return phase === 'show' ? [out, open] : [open, out];
  }

  private read(
    input: SplitKeyframesInput | undefined,
    ctx: SplitAnimationContext<HTMLElement>,
    reverseOnHide: boolean,
  ): Keyframe[] | null {
    if (!input) return null;
    if (typeof input === 'function') return input(ctx);
    return reverseOnHide && ctx.phase === 'hide' ? [...input].reverse() : input;
  }
}

/** A preset name: not empty and not one of the built-in presets. */
function checkPresetName(name: string): void {
  if (typeof name !== 'string' || name.trim() === '' || isBuiltInAnimationPreset(name)) {
    throw new SplitInvalidOptionError(
      'presets',
      name,
      `nome não vazio, diferente dos presets prontos (${SPLIT_ANIMATION_PRESETS.join(', ')})`,
    );
  }
}
