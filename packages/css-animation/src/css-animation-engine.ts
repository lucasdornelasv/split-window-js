import {
  SplitAnimationEngine,
  SplitStyleStash,
  collapseReveal,
  defaultEasing,
  easingToCss,
  presetAnimatesSizes,
  reflow,
  scaleTransformOrigin,
  slideTransform,
  transitionTimeMs,
  type SplitAnimationContext,
  type SplitEasingInput,
} from '@split-window/core';
import { SPLIT_CSS_ANIMATION_STYLES, SPLIT_CSS_ANIMATION_STYLE_ID } from './styles.js';

/** State classes (the `showing`/`show`/`hiding` of ng-bootstrap). */
export interface SplitCssAnimationClasses {
  /** Start state of a show, removed right after a reflow. */
  enterFrom: string;
  /** During a show. */
  showing: string;
  /** While open, after the show. */
  show: string;
  /** During a hide. */
  hiding: string;
}

export const SPLIT_CSS_ANIMATION_CLASSES: Readonly<SplitCssAnimationClasses> = Object.freeze({
  enterFrom: 'split-enter-from',
  showing: 'split-showing',
  show: 'split-show',
  hiding: 'split-hiding',
});

export interface SplitCssAnimationEngineOptions {
  /** State classes. Custom names need your own CSS. */
  classes?: Partial<SplitCssAnimationClasses>;
  /** Injects the preset styles once per document. Default: `true`. */
  injectStyles?: boolean;
}

/** A property animated with an inline transition (host size, push padding). */
export interface SplitCssFlipTarget {
  element: HTMLElement;
  property: string;
  from: string;
  to: string;
}

/**
 * CSS engine, in the style of `ngbRunTransition`: toggles state classes on the shell and the
 * backdrop, waits for `transitionend`/`animationend` (with a timeout from the computed
 * durations) and ends at once when there is no transition.
 *
 * The look comes from CSS: the built-in presets (`slide`, `fade`, `scale`, `collapse`) are
 * injected once per document; any other look is a class of your own (`panelClass`) with
 * rules for the state classes. Each phase sets its own preset, so a fade in and a slide out
 * work. Sizes that change with the layout (host width, push padding) are animated with
 * inline transitions between the frames.
 *
 * Extend it and override `classesFor`, `prepare`, `flipTargets`, `waitFor`, `finish`,
 * `duration`, `easing` or `translateEasing`.
 */
export class SplitCssAnimationEngine extends SplitAnimationEngine<HTMLElement> {
  private readonly stashes = new WeakMap<SplitAnimationContext<HTMLElement>, SplitStyleStash>();
  protected readonly classes: SplitCssAnimationClasses;
  protected readonly injectStyles: boolean;

  constructor(options: SplitCssAnimationEngineOptions = {}) {
    super();
    this.classes = { ...SPLIT_CSS_ANIMATION_CLASSES, ...options.classes };
    this.injectStyles = options.injectStyles ?? true;
  }

  animate(ctx: SplitAnimationContext<HTMLElement>): Promise<void> | void {
    const { shell } = ctx.elements;
    if (this.injectStyles) injectStyles(shell.ownerDocument);
    const stash = new SplitStyleStash();
    this.stashes.set(ctx, stash);
    const classes = this.classesFor(ctx);
    const elements = this.stateElements(ctx);
    const flips = this.flipTargets(ctx);
    this.prepare(ctx, stash);
    const transition = (property: string) =>
      `${property} ${this.duration(ctx)} ${this.easing(ctx)} ${ctx.options.delay ?? 0}ms`;

    if (ctx.phase === 'show') {
      for (const el of elements) el.classList.add(classes.enterFrom);
    }
    for (const f of flips) {
      stash.set(f.element, 'transition', 'none');
      stash.set(f.element, f.property, f.from);
    }
    reflow(shell);
    ctx.started();
    for (const el of elements) {
      if (ctx.phase === 'show') {
        el.classList.remove(classes.enterFrom);
        el.classList.add(classes.showing);
      } else {
        el.classList.remove(classes.show);
        el.classList.add(classes.hiding);
      }
    }
    for (const f of flips) {
      f.element.style.setProperty('transition', transition(f.property));
      f.element.style.setProperty(f.property, f.to);
    }

    const wait = this.waitFor([...elements, ...flips.map((f) => f.element)], ctx);
    if (!wait) return this.finish(ctx);
    return wait.then(() => this.finish(ctx));
  }

  override cleanup(ctx: SplitAnimationContext<HTMLElement>): void {
    const classes = this.classesFor(ctx);
    for (const el of this.stateElements(ctx)) {
      el.classList.remove(classes.enterFrom, classes.showing, classes.hiding);
      if (ctx.phase === 'hide') el.classList.remove(classes.show);
    }
    this.stashes.get(ctx)?.restore();
    this.stashes.delete(ctx);
  }

  /** State classes for this transition. */
  protected classesFor(_ctx: SplitAnimationContext<HTMLElement>): SplitCssAnimationClasses {
    return this.classes;
  }

  /** Elements that receive the state classes. */
  protected stateElements(ctx: SplitAnimationContext<HTMLElement>): HTMLElement[] {
    const { shell, backdrop } = ctx.elements;
    return backdrop ? [shell, backdrop] : [shell];
  }

  /** Sets the preset attribute and the CSS variables the presets (and your CSS) read. */
  protected prepare(ctx: SplitAnimationContext<HTMLElement>, stash: SplitStyleStash): void {
    const { shell, backdrop } = ctx.elements;
    const { from, to, options, phase } = ctx;
    stash.setAttribute(shell, 'data-split-animation', options.preset);
    if (backdrop && options.preset !== 'none') {
      stash.setAttribute(backdrop, 'data-split-animation', 'fade');
    }
    stash.set(shell, '--split-slide', slideTransform(options.origin, options.distance));
    stash.set(shell, '--split-scale', `${options.scale}`);
    stash.set(shell, '--split-transform-origin', scaleTransformOrigin(options.origin));
    if (options.duration !== undefined) {
      stash.set(shell, '--split-animation-duration', `${options.duration}ms`);
      if (backdrop) stash.set(backdrop, '--split-animation-duration', `${options.duration}ms`);
    }
    if (options.easing !== undefined) {
      const easing = this.translateEasing(options.easing, ctx);
      for (const el of backdrop ? [shell, backdrop] : [shell]) {
        stash.set(el, '--split-animation-easing', easing);
        stash.set(el, '--split-animation-easing-hide', easing);
      }
    }
    if (options.delay !== undefined)
      stash.set(shell, '--split-animation-delay', `${options.delay}ms`);
    const offsetX = from.rect.x - to.rect.x;
    const offsetY = from.rect.y - to.rect.y;
    stash.set(shell, '--split-from-x', `${phase === 'show' ? offsetX : 0}px`);
    stash.set(shell, '--split-from-y', `${phase === 'show' ? offsetY : 0}px`);
    stash.set(shell, '--split-to-x', `${phase === 'hide' ? -offsetX : 0}px`);
    stash.set(shell, '--split-to-y', `${phase === 'hide' ? -offsetY : 0}px`);
  }

  /**
   * Whether the sizes that change with the layout (host size, push padding) are animated:
   * with `slide` and `collapse`. With the others they change at once: the open layout is
   * applied at the start of a show and removed only after a hide.
   */
  protected animatesSizes(ctx: SplitAnimationContext<HTMLElement>): boolean {
    return presetAnimatesSizes(ctx.options.preset);
  }

  /**
   * Translates an easing to CSS (`cubicBezier([0.2, 0, 0, 1])` → `cubic-bezier(0.2, 0, 0, 1)`,
   * springs to a sampled `linear()`). Override it to support easings of your own type.
   */
  protected translateEasing(
    easing: SplitEasingInput,
    _ctx: SplitAnimationContext<HTMLElement>,
  ): string {
    return easingToCss(easing);
  }

  /**
   * Properties animated with inline transitions: the host size, the push padding and, in a
   * `collapse`, the reveal of the panel (`collapseReveal`), in step with them.
   */
  protected flipTargets(ctx: SplitAnimationContext<HTMLElement>): SplitCssFlipTarget[] {
    if (!this.animatesSizes(ctx)) return [];
    const targets: SplitCssFlipTarget[] = [];
    const { from, to, properties, elements } = ctx;
    if (properties.host && from.hostSize !== null && to.hostSize !== null) {
      targets.push({
        element: elements.host,
        property: properties.host,
        from: from.hostSize,
        to: to.hostSize,
      });
    }
    if (properties.push && elements.pushTarget && from.push !== null && to.push !== null) {
      targets.push({
        element: elements.pushTarget,
        property: properties.push,
        from: from.push,
        to: to.push,
      });
    }
    const reveal = collapseReveal(ctx);
    if (reveal) {
      const show = ctx.phase === 'show';
      targets.push({
        element: elements.shell,
        property: reveal.property,
        from: show ? reveal.closed : reveal.open,
        to: show ? reveal.open : reveal.closed,
      });
    }
    return targets;
  }

  /**
   * Waits for the transitions of the elements. Returns `null` when none has a duration, so
   * the transition ends synchronously.
   */
  protected waitFor(
    elements: HTMLElement[],
    ctx: SplitAnimationContext<HTMLElement>,
  ): Promise<void> | null {
    const timed = [...new Set(elements)]
      .map((el) => ({ el, ms: transitionTimeMs(el) }))
      .filter((t) => t.ms > 0);
    if (timed.length === 0) return null;
    return new Promise<void>((resolve) => {
      let pending = timed.length;
      const cleanups: (() => void)[] = [];
      const finishAll = () => {
        cleanups.splice(0).forEach((fn) => fn());
        resolve();
      };
      for (const { el, ms } of timed) {
        let settled = false;
        const settle = () => {
          if (settled) return;
          settled = true;
          if (--pending === 0) finishAll();
        };
        const onEnd = (event: Event) => {
          if (event.target === el) settle();
        };
        el.addEventListener('transitionend', onEnd);
        el.addEventListener('animationend', onEnd);
        const timer = setTimeout(settle, ms + 50);
        cleanups.push(() => {
          clearTimeout(timer);
          el.removeEventListener('transitionend', onEnd);
          el.removeEventListener('animationend', onEnd);
        });
      }
      ctx.signal.addEventListener('abort', finishAll, { once: true });
    });
  }

  /** Final classes of a completed transition. */
  protected finish(ctx: SplitAnimationContext<HTMLElement>): void {
    if (ctx.phase !== 'show' || ctx.signal.aborted) return;
    const classes = this.classesFor(ctx);
    for (const el of this.stateElements(ctx)) {
      el.classList.remove(classes.showing);
      el.classList.add(classes.show);
    }
  }

  /** Duration of the inline transitions. */
  protected duration(ctx: SplitAnimationContext<HTMLElement>): string {
    if (ctx.options.duration !== undefined) return `${ctx.options.duration}ms`;
    return cssVar(ctx.elements.shell, '--split-animation-duration') || '200ms';
  }

  /** Easing of the inline transitions: the option, the CSS variable of the phase, or the default. */
  protected easing(ctx: SplitAnimationContext<HTMLElement>): string {
    const variable =
      ctx.phase === 'hide' ? '--split-animation-easing-hide' : '--split-animation-easing';
    if (ctx.options.easing !== undefined) return this.translateEasing(ctx.options.easing, ctx);
    return (
      cssVar(ctx.elements.shell, variable) || this.translateEasing(defaultEasing(ctx.phase), ctx)
    );
  }
}

function cssVar(el: HTMLElement, name: string): string {
  const view = el.ownerDocument.defaultView;
  return view ? view.getComputedStyle(el).getPropertyValue(name).trim() : '';
}

/** Adds the preset styles to a document, once. */
export function injectStyles(doc: Document): void {
  if (doc.getElementById(SPLIT_CSS_ANIMATION_STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = SPLIT_CSS_ANIMATION_STYLE_ID;
  style.textContent = SPLIT_CSS_ANIMATION_STYLES;
  doc.head.prepend(style);
}
