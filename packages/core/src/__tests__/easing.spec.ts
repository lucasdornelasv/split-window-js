import { describe, expect, it } from 'vitest';
import {
  SPLIT_EASINGS,
  cubicBezier,
  customEasing,
  easingToCss,
  isEasing,
  linear,
  spring,
  steps,
  toEasingFunction,
} from '../animation/easing.js';
import { SplitInvalidOptionError } from '../errors/errors.js';

describe('easing', () => {
  it('builds easings and translates them to CSS', () => {
    expect(easingToCss(cubicBezier([0.2, 0, 0, 1]))).toBe('cubic-bezier(0.2, 0, 0, 1)');
    expect(easingToCss(linear())).toBe('linear');
    expect(easingToCss(linear([0, [0.8, 0.5], 1]))).toBe('linear(0, 0.8 50%, 1)');
    expect(easingToCss(steps(4))).toBe('steps(4, jump-end)');
    expect(easingToCss(steps(3, 'start'))).toBe('steps(3, start)');
    expect(easingToCss('ease-in')).toBe('ease-in');
    expect(easingToCss(SPLIT_EASINGS.easeOut)).toBe('cubic-bezier(0, 0, 0.58, 1)');
  });

  it('samples springs and functions as linear()', () => {
    const css = easingToCss(customEasing((t) => t * t, { samples: 3 }));
    expect(css).toBe('linear(0, 0.25, 1)');
    const bouncy = easingToCss(spring({ stiffness: 200, damping: 10, samples: 20 }));
    expect(bouncy.startsWith('linear(0, ')).toBe(true);
    expect(bouncy.endsWith(', 1)')).toBe(true);
    const values = bouncy.slice(7, -1).split(', ').map(Number);
    expect(values).toHaveLength(20);
    expect(Math.max(...values)).toBeGreaterThan(1); // overshoots
  });

  it('evaluates easings as functions', () => {
    const bezier = toEasingFunction(cubicBezier([0.42, 0, 0.58, 1]));
    expect(bezier(0)).toBe(0);
    expect(bezier(1)).toBe(1);
    expect(bezier(0.5)).toBeCloseTo(0.5, 5);
    expect(bezier(0.25)).toBeLessThan(0.25);
    expect(toEasingFunction('ease-out')(0.5)).toBeGreaterThan(0.5);
    expect(toEasingFunction('cubic-bezier(0, 0, 1, 1)')(0.3)).toBeCloseTo(0.3, 5);
    expect(toEasingFunction(linear())(0.3)).toBe(0.3);
    const stops = toEasingFunction(linear([0, [0.8, 0.5], 1]));
    expect(stops(0.25)).toBeCloseTo(0.4);
    expect(stops(0.75)).toBeCloseTo(0.9);
    const even = toEasingFunction(linear([0, 0.5, 0.6, 1]));
    expect(even(1 / 3)).toBeCloseTo(0.5);
    expect(toEasingFunction(steps(4))(0.3)).toBe(0.25);
    expect(toEasingFunction(steps(4, 'jump-start'))(0.3)).toBe(0.5);
    expect(toEasingFunction(steps(2, 'jump-both'))(0.5)).toBeCloseTo(2 / 3);
    expect(toEasingFunction(steps(3, 'jump-none'))(0.5)).toBe(0.5);
    const calm = toEasingFunction(spring());
    expect(calm(0)).toBe(0);
    expect(calm(1)).toBe(1);
    expect(calm(0.5)).toBeGreaterThan(0.8);
    expect(toEasingFunction(spring({ damping: 2 * Math.sqrt(170) }))(0.5)).toBeGreaterThan(0.5);
    expect(toEasingFunction(spring({ damping: 60 }))(0.5)).toBeGreaterThan(0.5);
  });

  it('rejects invalid settings and unknown types', () => {
    expect(() => cubicBezier([2, 0, 0, 1])).toThrow(SplitInvalidOptionError);
    expect(() => linear([Number.NaN])).toThrow(SplitInvalidOptionError);
    expect(() => steps(0)).toThrow(SplitInvalidOptionError);
    expect(() => steps(1, 'jump-none')).toThrow(SplitInvalidOptionError);
    expect(() => spring({ stiffness: 0 })).toThrow(SplitInvalidOptionError);
    expect(() => spring({ velocity: Number.NaN })).toThrow(SplitInvalidOptionError);
    expect(() => spring({ samples: 1 })).toThrow(SplitInvalidOptionError);
    expect(() => customEasing('x' as never)).toThrow(SplitInvalidOptionError);
    expect(() => easingToCss({ type: 'elastic' })).toThrow(/elastic/);
    expect(() => toEasingFunction({ type: 'elastic' })).toThrow(SplitInvalidOptionError);
    expect(() => toEasingFunction('steps(2)')).toThrow(SplitInvalidOptionError);
    expect(isEasing(spring())).toBe(true);
    expect(isEasing({ type: '' })).toBe(false);
    expect(isEasing('ease')).toBe(false);
  });
});
