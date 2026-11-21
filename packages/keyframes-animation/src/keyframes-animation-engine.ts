import {
  SPLIT_DEFAULT_EASING,
  SplitAnimationEngine,
  type SplitAnimationContext,
  type SplitAnimationFrame,
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

  /** Timing of every animation of the transition. */
  protected timing(ctx: SplitAnimationContext<HTMLElement>): KeyframeAnimationOptions {
    return {
      duration: ctx.options.duration ?? 200,
      easing: ctx.options.easing ?? SPLIT_DEFAULT_EASING,
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

    if (properties.host && from.hostSize !== null && to.hostSize !== null) {
      const key = camel(properties.host);
      targets.push({
        element: elements.host,
        keyframes: this.read(config.host, ctx, true) ?? [
          { [key]: from.hostSize },
          { [key]: to.hostSize },
        ],
      });
    }
    if (properties.push && elements.pushTarget && from.push !== null && to.push !== null) {
      const key = camel(properties.push);
      targets.push({
        element: elements.pushTarget,
        keyframes: this.read(config.push, ctx, true) ?? [{ [key]: from.push }, { [key]: to.push }],
      });
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

  /** Keyframes of the shell for the preset. */
  protected shellKeyframes(ctx: SplitAnimationContext<HTMLElement>): Keyframe[] {
    const { from, to, phase } = ctx;
    // The shell sits at its open position during the whole transition.
    const open = phase === 'show' ? to : from;
    const translate = (frame: SplitAnimationFrame) =>
      `translate(${frame.rect.x - open.rect.x}px, ${frame.rect.y - open.rect.y}px)`;
    switch (ctx.options.preset) {
      case 'slide':
        return [{ transform: translate(from) }, { transform: translate(to) }];
      case 'fade':
        return phase === 'show'
          ? [{ opacity: 0 }, { opacity: 1 }]
          : [{ opacity: 1 }, { opacity: 0 }];
      default:
        return [];
    }
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
