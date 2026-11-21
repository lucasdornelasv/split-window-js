import { SplitInvalidOptionError } from '../errors/errors.js';
import type { SplitBodySide, SplitLength, SplitRect } from '../model/types.js';

export interface SplitSize {
  width: number;
  height: number;
}

/**
 * Converts a length to px. Numbers are px; strings accept `px`, `vw`, `vh` and `%`
 * (percent of the reference area on the given axis).
 */
export function resolveLength(
  value: SplitLength | undefined,
  axis: 'x' | 'y',
  viewport: SplitSize,
  area: SplitSize,
): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'number') return value;
  const match = /^\s*(\d+(?:\.\d+)?)\s*(px|vw|vh|%)\s*$/.exec(value);
  if (!match) {
    throw new SplitInvalidOptionError(
      axis === 'x' ? 'maxWidth' : 'maxHeight',
      value,
      'px, vw, vh ou %',
    );
  }
  const n = Number(match[1]);
  switch (match[2]) {
    case 'vw':
      return (n * viewport.width) / 100;
    case 'vh':
      return (n * viewport.height) / 100;
    case '%':
      return (n * (axis === 'x' ? area.width : area.height)) / 100;
    default:
      return n;
  }
}

export interface ExpandedRectOptions {
  maxWidth?: number;
  maxHeight?: number;
  margin?: number;
  align?: 'center' | 'start' | 'end';
}

/** Rectangle of an expanded container inside the reference area. */
export function computeExpandedRect(area: SplitRect, options: ExpandedRectOptions = {}): SplitRect {
  const margin = Math.max(0, options.margin ?? 0);
  const inner: SplitRect = {
    x: area.x + margin,
    y: area.y + margin,
    width: Math.max(0, area.width - margin * 2),
    height: Math.max(0, area.height - margin * 2),
  };
  const width = Math.min(inner.width, options.maxWidth ?? Infinity);
  const height = Math.min(inner.height, options.maxHeight ?? Infinity);
  const align = options.align ?? 'center';
  const place = (start: number, free: number) =>
    align === 'start' ? start : align === 'end' ? start + free : start + free / 2;
  return {
    x: place(inner.x, inner.width - width),
    y: place(inner.y, inner.height - height),
    width,
    height,
  };
}

/** Distance between a floating drop panel and the window edge, for body containers. */
export const BODY_DROP_ZONE_EDGE_GAP = 16;

export interface ClosedDropZoneInput {
  /** Size of the panel. */
  size: SplitSize;
  /** The visible window. */
  viewport: SplitRect;
  /** Side of a body container. Body panels sit on their window edge. */
  bodySide?: SplitBodySide | null;
  /** Current host measurement. `displayed: false` means `display: none` (no layout box). */
  host?: { rect: SplitRect; displayed: boolean } | null;
  /** Last rectangle measured while the host was visible. */
  lastKnownRect?: SplitRect | null;
  /** Rectangle of `closedDropZoneAnchor`. */
  anchorRect?: SplitRect | null;
}

/** Centers a rectangle of `size` on a point. */
export function centerOn(cx: number, cy: number, size: SplitSize): SplitRect {
  return {
    x: cx - size.width / 2,
    y: cy - size.height / 2,
    width: size.width,
    height: size.height,
  };
}

/** Moves a rectangle so it stays inside the viewport whenever it fits. */
export function clampToViewport(rect: SplitRect, viewport: SplitRect): SplitRect {
  const maxX = viewport.x + viewport.width - rect.width;
  const maxY = viewport.y + viewport.height - rect.height;
  return {
    ...rect,
    x: Math.max(viewport.x, Math.min(rect.x, maxX)),
    y: Math.max(viewport.y, Math.min(rect.y, maxY)),
  };
}

function centerOf(rect: SplitRect): [number, number] {
  return [rect.x + rect.width / 2, rect.y + rect.height / 2];
}

/**
 * Position of the floating panel of a closed container, or `null` when the container has
 * no known position (it then only receives tabs through `moveTo()`).
 */
export function computeClosedDropZoneRect(input: ClosedDropZoneInput): SplitRect | null {
  const { size, viewport } = input;
  let rect: SplitRect | null = null;
  if (input.bodySide) {
    const gap = BODY_DROP_ZONE_EDGE_GAP;
    const [cx, cy] = centerOf(viewport);
    switch (input.bodySide) {
      case 'left':
        rect = centerOn(viewport.x + gap + size.width / 2, cy, size);
        break;
      case 'right':
        rect = centerOn(viewport.x + viewport.width - gap - size.width / 2, cy, size);
        break;
      case 'top':
        rect = centerOn(cx, viewport.y + gap + size.height / 2, size);
        break;
      case 'bottom':
        rect = centerOn(cx, viewport.y + viewport.height - gap - size.height / 2, size);
        break;
    }
  } else if (input.host?.displayed) {
    // With a size: centered over the host. Collapsed (0 width or height): centered on its point.
    rect = centerOn(...centerOf(input.host.rect), size);
  } else if (input.lastKnownRect) {
    rect = centerOn(...centerOf(input.lastKnownRect), size);
  } else if (input.anchorRect) {
    rect = centerOn(...centerOf(input.anchorRect), size);
  }
  return rect ? clampToViewport(rect, viewport) : null;
}

/** Whether two rectangles match within a tolerance in px. */
export function rectsMatch(a: SplitRect, b: SplitRect, tolerance = 1): boolean {
  return (
    Math.abs(a.x - b.x) <= tolerance &&
    Math.abs(a.y - b.y) <= tolerance &&
    Math.abs(a.width - b.width) <= tolerance &&
    Math.abs(a.height - b.height) <= tolerance
  );
}
