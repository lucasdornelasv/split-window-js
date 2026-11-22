import {
  SplitAnimationEngine,
  collapseReveal,
  defaultEasing,
  easingToCss,
  presetAnimatesSizes,
  scaleTransformOrigin,
  slideTransform,
  type SplitAnimationContext,
  type SplitEasingInput,
} from '@split-window/core';

/** Keyframes, or a function that builds them from the context (frames, side...). */
export type SplitKeyframesInput =
  Keyframe[] | ((ctx: SplitAnimationContext<HTMLElement>) => Keyframe[]);

/**
 * Keyframes of the engine. `show`/`hide` animate the shell; the others animate the host
 * size, the push property and the backdrop. Arrays given for `host`, `push` and `backdrop`
 * play forwards on show and backwards on hide.
 */
export interface SplitKeyframesConfig {
  show?: SplitKeyframesInput;
  hide?: SplitKeyframesInput;
  host?: SplitKeyframesInput;
  push?: SplitKeyframesInput;
  backdrop?: SplitKeyframesInput;
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
 * backdrop. Keyframes come from the config given to the constructor or from the preset,
 * built from the frames (`from`/`to`) of the context. Duration, easing and delay come from
 * the animation options (default 200ms).
 *
 * ```ts
 * animation: {
 *   engine: new SplitKeyframesAnimationEngine({
 *     show: [{ opacity: 0, transform: 'scale(.95)' }, { opacity: 1, transform: 'none' }],
 *   }),
 *   duration: 250,
 * }
 * ```
 *
 * Extend it and override `keyframes`, `shellKeyframes` or `timing`.
 */
export class SplitKeyframesAnimationEngine extends SplitAnimationEngine<HTMLElement> {
  private readonly running = new WeakMap<SplitAnimationContext<HTMLElement>, Animation[]>();

  constructor(protected readonly config: SplitKeyframesConfig = {}) {
    super();
  }

  animate(ctx: SplitAnimationContext<HTMLElement>): Promise<void> | void {
    const targets = this.keyframes(ctx).filter(
      (t) => t.keyframes.length > 0 && typeof (t.element as HTMLElement).animate === 'function',
    );
    if (targets.length === 0) return;
    const timing = this.timing(ctx);
    ctx.started();
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

  /** Every element and its keyframes. */
  protected keyframes(ctx: SplitAnimationContext<HTMLElement>): SplitKeyframesTarget[] {
    const config = this.config;
    const { elements, properties, from, to, phase } = ctx;
    const targets: SplitKeyframesTarget[] = [];
    const custom = this.read(phase === 'show' ? config.show : config.hide, ctx, false);
    targets.push({ element: elements.shell, keyframes: custom ?? this.shellKeyframes(ctx) });
    if (ctx.options.preset === 'none') return targets;

    // Keyframes given in the config always play; the preset ones only when sizes animate.
    const sizes = this.animatesSizes(ctx);
    if (properties.host && from.hostSize !== null && to.hostSize !== null) {
      const key = camel(properties.host);
      const keyframes =
        this.read(config.host, ctx, true) ??
        (sizes ? [{ [key]: from.hostSize }, { [key]: to.hostSize }] : null);
      if (keyframes) targets.push({ element: elements.host, keyframes });
    }
    if (properties.push && elements.pushTarget && from.push !== null && to.push !== null) {
      const key = camel(properties.push);
      const keyframes =
        this.read(config.push, ctx, true) ??
        (sizes ? [{ [key]: from.push }, { [key]: to.push }] : null);
      if (keyframes) targets.push({ element: elements.pushTarget, keyframes });
    }
    if (elements.backdrop) {
      const show = phase === 'show';
      targets.push({
        element: elements.backdrop,
        keyframes: this.read(config.backdrop, ctx, true) ?? [
          { opacity: show ? 0 : 1 },
          { opacity: show ? 1 : 0 },
        ],
      });
    }
    return targets;
  }

  /**
   * Whether the preset animates the sizes that change with the layout (host size, push
   * padding): with `slide` and `collapse`. With the others they change at once: the open
   * layout is applied at the start of a show and removed only after a hide.
   */
  protected animatesSizes(ctx: SplitAnimationContext<HTMLElement>): boolean {
    return presetAnimatesSizes(ctx.options.preset);
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
