import type { Type } from '@angular/core';
import {
  mergeAnimation,
  type ContainerState,
  type SplitAnimationFrame,
  type SplitAnimationInput as CoreAnimationInput,
  type SplitBodySide,
  type SplitContainerLayout,
  type SplitRect,
  type SplitStyleStash,
} from '@split-window/core';
import type {
  SplitAnimationInput,
  SplitAnimationOptions,
  SplitContainerElements,
} from '../animation/animation-engine';

/** One class, several separated by spaces, or a list. */
export type SplitClassInput = string | readonly string[];

/** What a mode (or a container) can set besides the layout behavior. */
export interface SplitModeSettings {
  /** Edge the panel docks to (custom containers). Default: `'right'`. */
  side?: SplitBodySide;
  /** Panel size on the side axis: '360px', '30vw'. */
  size?: string;
  /** Element pushed by a body container in `push`. A string is a CSS selector. */
  pushTarget?: HTMLElement | string;
  animation?: SplitAnimationInput;
  /** Classes of the host (the app element, or the fixed host of a body container). */
  hostClass?: SplitClassInput;
  /** Classes of the `split-container` element. */
  panelClass?: SplitClassInput;
  /** Classes of the backdrop. */
  backdropClass?: SplitClassInput;
}

/** What a mode receives while it applies or removes its layout. */
export interface SplitModeContext {
  readonly container: ContainerState<HTMLElement>;
  readonly kind: 'custom' | 'body';
  readonly layout: SplitContainerLayout;
  readonly side: SplitBodySide;
  /** Resolved panel size, or `null` when the layout has none (inline, custom push without `size`). */
  readonly size: string | null;
  readonly elements: SplitContainerElements;
  readonly document: Document;
  /** Use it for every style or class change: it is undone after the container hides. */
  readonly styles: SplitStyleStash;
  /** Free space for the mode, kept while the container is open. */
  readonly data: Record<string, unknown>;
}

/** Passed to a mode function. */
export interface SplitModeResolveContext {
  readonly key: string;
  readonly kind: 'custom' | 'body';
  /** Side of a body container. */
  readonly side: SplitBodySide | null;
  readonly options: Readonly<Record<string, unknown>>;
}

/**
 * Base class of the modes. A mode decides how the open container takes space (`open`,
 * `close`), where a transition starts and ends (`frames`) and what it adds to the
 * container (`settings`). Extend a built-in mode to change a part of it:
 *
 * ```ts
 * class DrawerMode extends SplitOverlayMode {
 *   override settings() { return { panelClass: 'drawer', animation: { duration: 300 } }; }
 * }
 * ```
 *
 * Classes are created with dependency injection, so they can use `inject()`.
 */
export abstract class SplitContainerMode {
  abstract readonly layout: SplitContainerLayout;

  /** Settings the mode adds over the global defaults. The container options win. */
  settings(): SplitModeSettings {
    return {};
  }

  /** Applies the open layout. Called before the show transition. */
  open(ctx: SplitModeContext): void {
    void ctx;
  }

  /** Called after the hide transition, right before `ctx.styles` is restored. */
  close(ctx: SplitModeContext): void {
    void ctx;
  }

  /** Called after the show transition. */
  shown(ctx: SplitModeContext): void {
    void ctx;
  }

  /** Called after the container is hidden. */
  hidden(ctx: SplitModeContext): void {
    void ctx;
  }

  /** Start and end frames, measured with the open layout applied. */
  frames(
    ctx: SplitModeContext,
    phase: 'show' | 'hide',
  ): { from: SplitAnimationFrame; to: SplitAnimationFrame } {
    const open = this.openFrame(ctx);
    const closed = this.closedFrame(ctx, open);
    return phase === 'show' ? { from: closed, to: open } : { from: open, to: closed };
  }

  /** The container fully open. */
  protected openFrame(ctx: SplitModeContext): SplitAnimationFrame {
    const r = ctx.elements.shell.getBoundingClientRect();
    return {
      rect: { x: r.x, y: r.y, width: r.width, height: r.height },
      opacity: 1,
      hostSize: null,
      push: null,
    };
  }

  /** The container fully closed: moved out by its size toward the side, or transparent inline. */
  protected closedFrame(ctx: SplitModeContext, open: SplitAnimationFrame): SplitAnimationFrame {
    if (this.layout === 'inline') return { ...open, opacity: 0 };
    return { ...open, rect: offsetRect(open.rect, ctx.side) };
  }
}

/** Moves a rectangle out by its own size toward a side. */
export function offsetRect(rect: SplitRect, side: SplitBodySide): SplitRect {
  switch (side) {
    case 'left':
      return { ...rect, x: rect.x - rect.width };
    case 'right':
      return { ...rect, x: rect.x + rect.width };
    case 'top':
      return { ...rect, y: rect.y - rect.height };
    case 'bottom':
      return { ...rect, y: rect.y + rect.height };
  }
}

/** `width` for left/right, `height` for top/bottom. */
export function axisOf(side: SplitBodySide): 'width' | 'height' {
  return side === 'left' || side === 'right' ? 'width' : 'height';
}

/** The panel fills its host (custom containers only). */
export class SplitInlineMode extends SplitContainerMode {
  readonly layout = 'inline' as const;
}

/**
 * The panel floats over the content. Body containers: fixed at a window edge. Custom
 * containers: the host becomes an anchor without size on the side axis and the panel is
 * placed against its `side` edge, over the neighbors.
 */
export class SplitOverlayMode extends SplitContainerMode {
  readonly layout = 'overlay' as const;
}

/**
 * The panel takes space and pushes the content. Body containers: adds the size to the
 * padding of the push target (`document.body` by default) and sets
 * `--split-body-offset-<side>` on `<html>`. Custom containers: the host grows from 0 to the
 * size (or its natural size) on the side axis.
 */
export class SplitPushMode extends SplitContainerMode {
  readonly layout = 'push' as const;

  override open(ctx: SplitModeContext): void {
    const { elements, side, styles, document } = ctx;
    if (ctx.kind === 'body') {
      const target = elements.pushTarget ?? document.body;
      const property = `padding-${side}`;
      const base = computed(target, property) || '0px';
      const size = ctx.size ?? '0px';
      ctx.data['pushFrom'] = base;
      styles.set(target, property, `calc(${base} + ${size})`);
      styles.set(document.documentElement, `--split-body-offset-${side}`, size);
      return;
    }
    const { host, shell } = elements;
    const axis = axisOf(side);
    let size = ctx.size;
    if (!size) {
      // Natural size of the host: measured without the inline styles that collapse it.
      // Writes go through the stash writer (Renderer2 in Angular).
      const { writer } = styles;
      const saved = [axis, `min-${axis}`, 'flex'].map((prop) => ({
        prop,
        value: host.style.getPropertyValue(prop),
        priority: host.style.getPropertyPriority(prop),
      }));
      for (const { prop } of saved) writer.removeStyle(host, prop);
      const r = host.getBoundingClientRect();
      for (const { prop, value, priority } of saved) {
        if (value) writer.setStyle(host, prop, value, priority);
      }
      size = `${axis === 'width' ? r.width : r.height}px`;
    }
    ctx.data['hostSize'] = size;
    styles.set(host, axis, size);
    styles.set(shell, '--split-size', size);
  }

  protected override openFrame(ctx: SplitModeContext): SplitAnimationFrame {
    const frame = super.openFrame(ctx);
    if (ctx.kind === 'body') {
      const target = ctx.elements.pushTarget ?? ctx.document.body;
      const property = `padding-${ctx.side}`;
      const value = computed(target, property) || target.style.getPropertyValue(property);
      return { ...frame, push: value || null };
    }
    return { ...frame, hostSize: (ctx.data['hostSize'] as string | undefined) ?? null };
  }

  protected override closedFrame(
    ctx: SplitModeContext,
    open: SplitAnimationFrame,
  ): SplitAnimationFrame {
    const frame = super.closedFrame(ctx, open);
    if (ctx.kind === 'body') {
      return { ...frame, push: (ctx.data['pushFrom'] as string | undefined) ?? '0px' };
    }
    return { ...frame, hostSize: '0px' };
  }
}

function computed(el: HTMLElement, property: string): string {
  const view = el.ownerDocument.defaultView;
  return view ? view.getComputedStyle(el).getPropertyValue(property).trim() : '';
}

/** Hooks of a mode given as an object. */
export interface SplitModeHooks {
  /** After the layout of the base mode is applied. */
  onOpen?(ctx: SplitModeContext): void;
  /** Before the layout of the base mode is removed. */
  onClose?(ctx: SplitModeContext): void;
  onShown?(ctx: SplitModeContext): void;
  onHidden?(ctx: SplitModeContext): void;
}

/**
 * A mode given as an object. Without `extends`, it builds on the built-in mode of its
 * `layout` (default: inline for custom containers, overlay for body containers).
 */
export interface SplitModeDefinition extends SplitModeSettings, SplitModeHooks {
  /** Mode to build on: a name, a definition, a class, an instance or a function. */
  extends?: SplitModeInput;
  layout?: SplitContainerLayout;
}

/** A function that picks the mode of a container. */
export type SplitModeFn = (ctx: SplitModeResolveContext) => SplitModeInput;

/**
 * What the `mode` option accepts: a built-in layout or a registered name, an object, a
 * class (created with DI), an instance, or a function.
 */
export type SplitModeInput =
  | SplitContainerLayout
  | (string & {})
  | SplitModeDefinition
  | SplitContainerMode
  | Type<SplitContainerMode>
  | SplitModeFn;

/** Mode built from a `SplitModeDefinition` over a base mode. */
export class SplitDefinedMode extends SplitContainerMode {
  constructor(
    /** Mode whose settings are inherited. */
    readonly base: SplitContainerMode,
    /** Mode whose layout behavior is used (the base, or the built-in of `definition.layout`). */
    readonly delegate: SplitContainerMode,
    readonly definition: SplitModeDefinition,
  ) {
    super();
  }

  get layout(): SplitContainerLayout {
    return this.delegate.layout;
  }

  override settings(): SplitModeSettings {
    return mergeModeSettings(this.base.settings(), pickModeSettings(this.definition));
  }

  override open(ctx: SplitModeContext): void {
    this.delegate.open(ctx);
    this.definition.onOpen?.(ctx);
  }

  override close(ctx: SplitModeContext): void {
    this.definition.onClose?.(ctx);
    this.delegate.close(ctx);
  }

  override shown(ctx: SplitModeContext): void {
    this.delegate.shown(ctx);
    this.definition.onShown?.(ctx);
  }

  override hidden(ctx: SplitModeContext): void {
    this.delegate.hidden(ctx);
    this.definition.onHidden?.(ctx);
  }

  override frames(ctx: SplitModeContext, phase: 'show' | 'hide') {
    return this.delegate.frames(ctx, phase);
  }
}

const SETTING_KEYS = [
  'side',
  'size',
  'pushTarget',
  'animation',
  'hostClass',
  'panelClass',
  'backdropClass',
] as const;

/** Only the settings of an object (mode definition or container options). */
export function pickModeSettings(source: object | null | undefined): SplitModeSettings {
  const result: Record<string, unknown> = {};
  if (!source) return result;
  for (const key of SETTING_KEYS) {
    const value = (source as Record<string, unknown>)[key];
    if (value !== undefined) result[key] = value;
  }
  return result as SplitModeSettings;
}

/**
 * Merges settings, later layers first: scalars are replaced, classes are added and
 * animation options are merged key by key.
 */
export function mergeModeSettings(...layers: SplitModeSettings[]): SplitModeSettings {
  const result: SplitModeSettings = {};
  for (const layer of layers) {
    if (layer.side !== undefined) result.side = layer.side;
    if (layer.size !== undefined) result.size = layer.size;
    if (layer.pushTarget !== undefined) result.pushTarget = layer.pushTarget;
    for (const key of ['hostClass', 'panelClass', 'backdropClass'] as const) {
      const value = layer[key];
      if (value === undefined) continue;
      const previous = result[key];
      const list = (v: SplitClassInput | undefined) =>
        v === undefined ? [] : typeof v === 'string' ? [v] : [...v];
      result[key] = [...list(previous), ...list(value)];
    }
    if (layer.animation !== undefined) {
      result.animation = mergeAnimation(
        result.animation as CoreAnimationInput<HTMLElement> | undefined,
        layer.animation as CoreAnimationInput<HTMLElement>,
      ) as SplitAnimationOptions;
    }
  }
  return result;
}
