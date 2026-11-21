import {
  SPLIT_DEFAULT_EASING,
  SplitAnimationEngine,
  SplitStyleStash,
  reflow,
  transitionTimeMs,
  type SplitAnimationContext,
  type SplitBodySide,
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

const SLIDE: Record<SplitBodySide, string> = {
  left: 'translateX(-100%)',
  right: 'translateX(100%)',
  top: 'translateY(-100%)',
  bottom: 'translateY(100%)',
};

/**
 * CSS engine, in the style of `ngbRunTransition`: toggles state classes on the shell and the
 * backdrop, waits for `transitionend`/`animationend` (with a timeout from the computed
 * durations) and ends at once when there is no transition.
 *
 * The look comes from CSS: the built-in presets (`slide`, `fade`, `collapse`) are injected
 * once per document; any other look is a class of your own (`panelClass`) with rules for the
 * state classes. Sizes that change with the layout (host width, push padding) are animated
 * with inline transitions between the frames.
 *
 * Extend it and override `classesFor`, `prepare`, `flipTargets`, `waitFor`, `finish` or
 * `duration`.
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
    stash.set(shell, '--split-slide', SLIDE[ctx.side]);
    if (options.duration !== undefined) {
      stash.set(shell, '--split-animation-duration', `${options.duration}ms`);
      if (backdrop) stash.set(backdrop, '--split-animation-duration', `${options.duration}ms`);
    }
    if (options.easing !== undefined) stash.set(shell, '--split-animation-easing', options.easing);
    if (options.delay !== undefined)
      stash.set(shell, '--split-animation-delay', `${options.delay}ms`);
    const offsetX = from.rect.x - to.rect.x;
    const offsetY = from.rect.y - to.rect.y;
    stash.set(shell, '--split-from-x', `${phase === 'show' ? offsetX : 0}px`);
    stash.set(shell, '--split-from-y', `${phase === 'show' ? offsetY : 0}px`);
    stash.set(shell, '--split-to-x', `${phase === 'hide' ? -offsetX : 0}px`);
    stash.set(shell, '--split-to-y', `${phase === 'hide' ? -offsetY : 0}px`);
  }

  /** Sizes animated with inline transitions. */
  protected flipTargets(ctx: SplitAnimationContext<HTMLElement>): SplitCssFlipTarget[] {
    if (ctx.options.preset === 'none') return [];
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

  /** Easing of the inline transitions. */
  protected easing(ctx: SplitAnimationContext<HTMLElement>): string {
    return (
      ctx.options.easing ??
      (cssVar(ctx.elements.shell, '--split-animation-easing') || SPLIT_DEFAULT_EASING)
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
