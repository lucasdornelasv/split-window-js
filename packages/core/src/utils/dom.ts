/*
 * DOM helpers shared by the adapters and the animation engines. They use structural types
 * (an `HTMLElement` satisfies them), so the core builds without the DOM library.
 */

/** The part of `CSSStyleDeclaration` the helpers use. */
export interface SplitStyleDeclaration {
  getPropertyValue(property: string): string;
  getPropertyPriority(property: string): string;
  setProperty(property: string, value: string | null, priority?: string): void;
  removeProperty(property: string): string;
}

/** An element with inline styles. */
export interface SplitStyledElement {
  readonly style: SplitStyleDeclaration;
}

/** An element with classes. */
export interface SplitClassElement {
  readonly classList: {
    contains(token: string): boolean;
    add(...tokens: string[]): void;
    remove(...tokens: string[]): void;
  };
}

/** An element with attributes. */
export interface SplitAttributeElement {
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
}

/** The computed style properties `transitionTimeMs` reads. */
export interface SplitComputedTimes {
  readonly transitionDuration: string;
  readonly transitionDelay: string;
  readonly animationName: string;
  readonly animationDuration: string;
  readonly animationDelay: string;
}

/** An element whose computed style can be read. */
export interface SplitComputableElement {
  readonly ownerDocument: {
    readonly defaultView: { getComputedStyle(element: any): SplitComputedTimes } | null;
  };
}

/**
 * Writes to elements. Adapters plug their own (Angular passes one backed by `Renderer2`);
 * the default writes to the DOM directly. Reads stay direct: only writes go through it.
 */
export interface SplitDomWriter {
  /** Sets an inline style; `property` is dash-case and may be a custom property. */
  setStyle(el: SplitStyledElement, property: string, value: string, priority?: string): void;
  removeStyle(el: SplitStyledElement, property: string): void;
  addClass(el: SplitClassElement, name: string): void;
  removeClass(el: SplitClassElement, name: string): void;
  setAttribute(el: SplitAttributeElement, name: string, value: string): void;
  removeAttribute(el: SplitAttributeElement, name: string): void;
}

/** Writer that changes the DOM directly. */
export const DIRECT_DOM_WRITER: SplitDomWriter = Object.freeze<SplitDomWriter>({
  setStyle: (el, property, value, priority = '') => el.style.setProperty(property, value, priority),
  removeStyle: (el, property) => void el.style.removeProperty(property),
  addClass: (el, name) => el.classList.add(name),
  removeClass: (el, name) => el.classList.remove(name),
  setAttribute: (el, name, value) => el.setAttribute(name, value),
  removeAttribute: (el, name) => el.removeAttribute(name),
});

/**
 * Records inline styles, classes and attributes set on elements so they can be undone in
 * one call, newest first. Every write goes through its `writer`.
 */
export class SplitStyleStash {
  private styles: { el: SplitStyledElement; prop: string; value: string; priority: string }[] = [];
  private classes: { el: SplitClassElement; name: string }[] = [];
  private attributes: { el: SplitAttributeElement; name: string; value: string | null }[] = [];

  constructor(readonly writer: SplitDomWriter = DIRECT_DOM_WRITER) {}

  /** Sets an inline style, remembering the value it had before the first change. */
  set(el: SplitStyledElement, prop: string, value: string): void {
    if (!this.styles.some((s) => s.el === el && s.prop === prop)) {
      this.styles.push({
        el,
        prop,
        value: el.style.getPropertyValue(prop),
        priority: el.style.getPropertyPriority(prop),
      });
    }
    this.writer.setStyle(el, prop, value);
  }

  /** Adds classes. Only the classes the element did not have are removed by `restore()`. */
  addClass(el: SplitClassElement, ...names: (string | null | undefined | false)[]): void {
    for (const name of names) {
      if (!name || el.classList.contains(name)) continue;
      this.writer.addClass(el, name);
      this.classes.push({ el, name });
    }
  }

  /** Sets an attribute, remembering the value it had before the first change. */
  setAttribute(el: SplitAttributeElement, name: string, value: string): void {
    if (!this.attributes.some((a) => a.el === el && a.name === name)) {
      this.attributes.push({ el, name, value: el.getAttribute(name) });
    }
    this.writer.setAttribute(el, name, value);
  }

  /** Undoes every change, newest first. */
  restore(): void {
    const { writer } = this;
    for (const s of this.styles.reverse()) {
      if (s.value) writer.setStyle(s.el, s.prop, s.value, s.priority);
      else writer.removeStyle(s.el, s.prop);
    }
    for (const a of this.attributes.reverse()) {
      if (a.value === null) writer.removeAttribute(a.el, a.name);
      else writer.setAttribute(a.el, a.name, a.value);
    }
    for (const c of this.classes) writer.removeClass(c.el, c.name);
    this.styles = [];
    this.attributes = [];
    this.classes = [];
  }
}

/** Normalizes `'a b'`, `['a', 'b c']` and `undefined` to a list of class names. */
export function toClassList(value: string | readonly string[] | null | undefined): string[] {
  if (!value) return [];
  const list = typeof value === 'string' ? [value] : value;
  return list.flatMap((item) => item.split(/\s+/)).filter(Boolean);
}

/** Reads a CSS time list ('0.2s, 100ms') and returns the largest value in ms. */
export function maxCssTime(value: string): number {
  return Math.max(
    0,
    ...value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => (part.endsWith('ms') ? parseFloat(part) : parseFloat(part) * 1000))
      .filter((n) => Number.isFinite(n)),
  );
}

/** Longest transition or animation (duration + delay) of an element, in ms. */
export function transitionTimeMs(el: SplitComputableElement): number {
  const view = el.ownerDocument.defaultView;
  if (!view) return 0;
  const style = view.getComputedStyle(el);
  const transition = maxCssTime(style.transitionDuration) + maxCssTime(style.transitionDelay);
  const name = style.animationName;
  const animation =
    name && name !== 'none'
      ? maxCssTime(style.animationDuration) + maxCssTime(style.animationDelay)
      : 0;
  return Math.max(transition, animation);
}

/** Forces a style recalculation, so the next class change starts a transition. */
export function reflow(el: { readonly offsetHeight: number }): void {
  void el.offsetHeight;
}
