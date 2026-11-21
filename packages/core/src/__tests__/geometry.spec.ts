import { describe, expect, it } from 'vitest';
import {
  BODY_DROP_ZONE_EDGE_GAP,
  clampToViewport,
  computeClosedDropZoneRect,
  computeExpandedRect,
  rectsMatch,
  resolveLength,
} from '../geometry/geometry.js';
import { SplitInvalidOptionError } from '../errors/errors.js';
import { SplitContainerStack } from '../stack/split-container-stack.js';
import { validateLength } from '../model/validation.js';

const viewport = { x: 0, y: 0, width: 1000, height: 800 };

describe('resolveLength', () => {
  it.each([
    [undefined, 'x', undefined],
    [300, 'x', 300],
    ['120px', 'x', 120],
    ['50vw', 'x', 500],
    ['25vh', 'y', 200],
    ['50%', 'x', 200],
    ['50%', 'y', 100],
    [' 10.5px ', 'x', 10.5],
  ] as const)('%s on %s -> %s', (value, axis, expected) => {
    expect(resolveLength(value, axis, viewport, { width: 400, height: 200 })).toBe(expected);
  });

  it('rejects unknown units', () => {
    expect(() => resolveLength('3em', 'x', viewport, viewport)).toThrow(SplitInvalidOptionError);
    expect(() => resolveLength('3em', 'y', viewport, viewport)).toThrow(/maxHeight/);
  });

  it('validateLength', () => {
    expect(() => validateLength('w', 0)).toThrow(SplitInvalidOptionError);
    expect(() => validateLength('w', 'abc')).toThrow(SplitInvalidOptionError);
    expect(() => validateLength('w', '90vw')).not.toThrow();
    expect(() => validateLength('w', 10)).not.toThrow();
  });
});

describe('computeExpandedRect', () => {
  const area = { x: 100, y: 50, width: 800, height: 600 };

  it('fills the area by default', () => {
    expect(computeExpandedRect(area)).toEqual(area);
  });

  it('applies the margin', () => {
    expect(computeExpandedRect(area, { margin: 20 })).toEqual({
      x: 120,
      y: 70,
      width: 760,
      height: 560,
    });
  });

  it('a margin larger than the area yields an empty rectangle', () => {
    expect(
      computeExpandedRect({ x: 0, y: 0, width: 10, height: 10 }, { margin: 20 }),
    ).toMatchObject({
      width: 0,
      height: 0,
    });
  });

  it.each([
    ['center', { x: 300, y: 150 }],
    ['start', { x: 100, y: 50 }],
    ['end', { x: 500, y: 250 }],
  ] as const)('align %s with smaller max size', (align, pos) => {
    expect(computeExpandedRect(area, { maxWidth: 400, maxHeight: 400, align })).toEqual({
      ...pos,
      width: 400,
      height: 400,
    });
  });

  it('max sizes larger than the area are capped by the area', () => {
    expect(computeExpandedRect(area, { maxWidth: 5000, maxHeight: 5000 })).toEqual(area);
  });
});

describe('computeClosedDropZoneRect', () => {
  const size = { width: 200, height: 100 };

  it('centers over a host with size', () => {
    expect(
      computeClosedDropZoneRect({
        size,
        viewport,
        host: { rect: { x: 100, y: 100, width: 400, height: 300 }, displayed: true },
      }),
    ).toEqual({ x: 200, y: 200, width: 200, height: 100 });
  });

  it('centers on the point of a collapsed host', () => {
    expect(
      computeClosedDropZoneRect({
        size,
        viewport,
        host: { rect: { x: 500, y: 400, width: 0, height: 300 }, displayed: true },
      }),
    ).toEqual({ x: 400, y: 500, width: 200, height: 100 });
  });

  it('uses the last known rectangle for a host with display: none', () => {
    expect(
      computeClosedDropZoneRect({
        size,
        viewport,
        host: { rect: { x: 0, y: 0, width: 0, height: 0 }, displayed: false },
        lastKnownRect: { x: 0, y: 0, width: 400, height: 200 },
      }),
    ).toEqual({ x: 100, y: 50, width: 200, height: 100 });
  });

  it('uses the anchor for a host never measured', () => {
    expect(
      computeClosedDropZoneRect({
        size,
        viewport,
        host: null,
        anchorRect: { x: 400, y: 300, width: 200, height: 200 },
      }),
    ).toEqual({ x: 400, y: 350, width: 200, height: 100 });
  });

  it('returns null without host, last rect or anchor', () => {
    expect(computeClosedDropZoneRect({ size, viewport })).toBeNull();
  });

  it.each([
    ['left', { x: BODY_DROP_ZONE_EDGE_GAP, y: 350 }],
    ['right', { x: 1000 - BODY_DROP_ZONE_EDGE_GAP - 200, y: 350 }],
    ['top', { x: 400, y: BODY_DROP_ZONE_EDGE_GAP }],
    ['bottom', { x: 400, y: 800 - BODY_DROP_ZONE_EDGE_GAP - 100 }],
  ] as const)('body side %s sits on its edge', (side, pos) => {
    expect(computeClosedDropZoneRect({ size, viewport, bodySide: side })).toEqual({
      ...pos,
      ...size,
    });
  });

  it('keeps the panel inside the viewport', () => {
    expect(
      computeClosedDropZoneRect({
        size,
        viewport,
        host: { rect: { x: -500, y: 790, width: 10, height: 10 }, displayed: true },
      }),
    ).toEqual({ x: 0, y: 700, width: 200, height: 100 });
    expect(clampToViewport({ x: 990, y: -5, width: 20, height: 20 }, viewport)).toEqual({
      x: 980,
      y: 0,
      width: 20,
      height: 20,
    });
  });

  it('rectsMatch tolerates small differences', () => {
    expect(
      rectsMatch({ x: 0, y: 0, width: 10, height: 10 }, { x: 0.5, y: 0, width: 10, height: 10.9 }),
    ).toBe(true);
    expect(
      rectsMatch({ x: 0, y: 0, width: 10, height: 10 }, { x: 5, y: 0, width: 10, height: 10 }),
    ).toBe(false);
  });
});

describe('SplitContainerStack edge cases', () => {
  it('handles unknown refs and non-finite indexes', () => {
    const stack = new SplitContainerStack();
    const fake = { id: 'x' } as never;
    expect(stack.remove(fake)).toEqual({ index: -1, wasActive: false });
    expect(stack.move(fake, 0)).toEqual({ from: -1, to: -1 });
    expect(stack.insert(fake, Number.NaN)).toBe(0);
    expect(stack.has(fake)).toBe(true);
    expect(stack.active).toBeNull();
    expect(stack.neighborOf(5)).toBeNull();
  });
});
