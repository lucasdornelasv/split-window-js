import { SplitInvalidOptionError } from '../errors/errors.js';

/*
 * Easing as data: each easing is a description (`type` + its own settings) that every
 * animation engine translates to what it plays. CSS and Web Animations engines use
 * `easingToCss`; an engine that steps the animation itself uses `toEasingFunction`.
 */

/** `cubic-bezier(x1, y1, x2, y2)`. */
export interface SplitCubicBezierEasing {
  readonly type: 'cubic-bezier';
  readonly points: readonly [x1: number, y1: number, x2: number, y2: number];
}

/** A stop of `linear()`: an output value, or `[value, at]` with `at` the progress (0..1). */
export type SplitLinearStop = number | readonly [value: number, at: number];

/** Constant speed, or a piecewise linear curve through its stops (CSS `linear()`). */
export interface SplitLinearEasing {
  readonly type: 'linear';
  readonly stops: readonly SplitLinearStop[];
}

export type SplitStepPosition =
  'jump-start' | 'jump-end' | 'jump-none' | 'jump-both' | 'start' | 'end';

/** Jumps in `count` steps (CSS `steps()`). */
export interface SplitStepsEasing {
  readonly type: 'steps';
  readonly count: number;
  readonly position: SplitStepPosition;
}

/**
 * A damped spring, played in the configured duration: the curve is the spring's motion
 * until it settles, scaled to the duration. May overshoot 1 (bounces).
 */
export interface SplitSpringEasing {
  readonly type: 'spring';
  readonly stiffness: number;
  readonly damping: number;
  readonly mass: number;
  /** Initial velocity, in progress units per second. */
  readonly velocity: number;
  /** Points of the `linear()` that approximates it in CSS. */
  readonly samples: number;
}

/** Any curve given as a function of the progress (0..1). */
export interface SplitFunctionEasing {
  readonly type: 'function';
  readonly fn: (progress: number) => number;
  /** Points of the `linear()` that approximates it in CSS. */
  readonly samples: number;
}

/** Built-in easings. */
export type SplitEasing =
  | SplitCubicBezierEasing
  | SplitLinearEasing
  | SplitStepsEasing
  | SplitSpringEasing
  | SplitFunctionEasing;

/** An easing of your own type, translated by your engine (override its translation method). */
export interface SplitCustomEasing {
  readonly type: string;
  readonly [setting: string]: unknown;
}

/**
 * What `easing` accepts: a built-in easing (`cubicBezier([...])`, `spring()`...), an
 * easing of your own type, or a CSS easing string used as it is.
 */
export type SplitEasingInput = string | SplitEasing | SplitCustomEasing;

const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** `cubicBezier([0.2, 0, 0, 1])` → CSS `cubic-bezier(0.2, 0, 0, 1)`. `x1` and `x2` in 0..1. */
export function cubicBezier(
  points: readonly [x1: number, y1: number, x2: number, y2: number],
): SplitCubicBezierEasing {
  const ok =
    Array.isArray(points) &&
    points.length === 4 &&
    points.every(finite) &&
    points[0] >= 0 &&
    points[0] <= 1 &&
    points[2] >= 0 &&
    points[2] <= 1;
  if (!ok) {
    throw new SplitInvalidOptionError(
      'cubicBezier',
      points,
      '[x1, y1, x2, y2] com x1 e x2 em 0..1',
    );
  }
  return { type: 'cubic-bezier', points: [...points] as [number, number, number, number] };
}

/** `linear()` → CSS `linear`; `linear([0, [0.8, 0.5], 1])` → `linear(0, 0.8 50%, 1)`. */
export function linear(stops: readonly SplitLinearStop[] = []): SplitLinearEasing {
  const ok = stops.every(
    (s) => finite(s) || (Array.isArray(s) && s.length === 2 && finite(s[0]) && finite(s[1])),
  );
  if (!ok) throw new SplitInvalidOptionError('linear', stops, 'valores ou [valor, progresso]');
  return { type: 'linear', stops: [...stops] };
}

/** `steps(4)` → CSS `steps(4, jump-end)`. */
export function steps(count: number, position: SplitStepPosition = 'jump-end'): SplitStepsEasing {
  const min = position === 'jump-none' ? 2 : 1;
  if (!Number.isInteger(count) || count < min) {
    throw new SplitInvalidOptionError('steps', count, `inteiro >= ${min}`);
  }
  return { type: 'steps', count, position };
}

/** Settings of `spring()`. */
export interface SplitSpringOptions {
  /** Default: 170. */
  stiffness?: number;
  /** Default: 26 (no bounce). Lower values bounce. */
  damping?: number;
  /** Default: 1. */
  mass?: number;
  /** Default: 0. */
  velocity?: number;
  /** Default: 40. */
  samples?: number;
}

/** A damped spring: `spring()`, `spring({ stiffness: 200, damping: 12 })` (bounces). */
export function spring(options: SplitSpringOptions = {}): SplitSpringEasing {
  const easing: SplitSpringEasing = {
    type: 'spring',
    stiffness: options.stiffness ?? 170,
    damping: options.damping ?? 26,
    mass: options.mass ?? 1,
    velocity: options.velocity ?? 0,
    samples: options.samples ?? 40,
  };
  for (const key of ['stiffness', 'damping', 'mass'] as const) {
    if (!finite(easing[key]) || easing[key] <= 0) {
      throw new SplitInvalidOptionError(`spring.${key}`, easing[key], 'número > 0');
    }
  }
  if (!finite(easing.velocity)) {
    throw new SplitInvalidOptionError('spring.velocity', easing.velocity, 'número');
  }
  checkSamples('spring.samples', easing.samples);
  return easing;
}

/** Any curve as a function of the progress: `customEasing((t) => t * t)`. */
export function customEasing(
  fn: (progress: number) => number,
  options: { samples?: number } = {},
): SplitFunctionEasing {
  if (typeof fn !== 'function') throw new SplitInvalidOptionError('customEasing', fn, 'função');
  const samples = options.samples ?? 40;
  checkSamples('customEasing.samples', samples);
  return { type: 'function', fn, samples };
}

function checkSamples(option: string, samples: number): void {
  if (!Number.isInteger(samples) || samples < 2) {
    throw new SplitInvalidOptionError(option, samples, 'inteiro >= 2');
  }
}

/** Ready-made easings. */
export const SPLIT_EASINGS = Object.freeze({
  linear: linear(),
  ease: cubicBezier([0.25, 0.1, 0.25, 1]),
  easeIn: cubicBezier([0.42, 0, 1, 1]),
  easeOut: cubicBezier([0, 0, 0.58, 1]),
  easeInOut: cubicBezier([0.42, 0, 0.58, 1]),
  /** Fast start, soft landing: the default of a show. */
  decelerate: cubicBezier([0.2, 0, 0, 1]),
  /** Soft start, fast end: the default of a hide. */
  accelerate: cubicBezier([0.4, 0, 1, 1]),
});

/** Whether a value is an easing object (built-in or custom). */
export function isEasing(value: unknown): value is SplitEasing | SplitCustomEasing {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { type?: unknown }).type === 'string' &&
    (value as { type: string }).type !== ''
  );
}

const round = (value: number) => Number(value.toFixed(4));

/**
 * Translates an easing to CSS (also valid for the Web Animations API). Springs and
 * functions become a sampled `linear()`. A string is returned as it is.
 * @throws SplitInvalidOptionError for a custom type it does not know.
 */
export function easingToCss(easing: SplitEasingInput): string {
  if (typeof easing === 'string') return easing;
  const e = easing as SplitEasing;
  switch (e.type) {
    case 'cubic-bezier':
      return `cubic-bezier(${e.points.join(', ')})`;
    case 'linear':
      if (e.stops.length === 0) return 'linear';
      return `linear(${e.stops
        .map((s) => (typeof s === 'number' ? `${s}` : `${s[0]} ${round(s[1] * 100)}%`))
        .join(', ')})`;
    case 'steps':
      return `steps(${e.count}, ${e.position})`;
    case 'spring':
    case 'function': {
      const fn = toEasingFunction(e);
      const values = Array.from({ length: e.samples }, (_, i) => round(fn(i / (e.samples - 1))));
      return `linear(${values.join(', ')})`;
    }
    default:
      throw unsupported(easing);
  }
}

/**
 * The easing as a function of the progress (0..1), for engines that step the animation
 * themselves. Strings: the CSS keywords and `cubic-bezier(...)`.
 * @throws SplitInvalidOptionError for a string or custom type it does not know.
 */
export function toEasingFunction(easing: SplitEasingInput): (progress: number) => number {
  if (typeof easing === 'string') return cssEasingFunction(easing);
  const e = easing as SplitEasing;
  switch (e.type) {
    case 'cubic-bezier':
      return bezier(...e.points);
    case 'linear':
      return linearFunction(e.stops);
    case 'steps':
      return stepsFunction(e.count, e.position);
    case 'spring':
      return springFunction(e);
    case 'function': {
      const fn = e.fn;
      return (t) => (t <= 0 ? fn(0) : t >= 1 ? fn(1) : fn(t));
    }
    default:
      throw unsupported(easing);
  }
}

function unsupported(easing: SplitEasingInput): SplitInvalidOptionError {
  return new SplitInvalidOptionError(
    'animation.easing',
    (easing as { type?: unknown }).type ?? easing,
    'cubic-bezier | linear | steps | spring | function (ou um motor que traduza o tipo)',
  );
}

const CSS_KEYWORDS: Record<string, SplitEasing> = {
  linear: SPLIT_EASINGS.linear,
  ease: SPLIT_EASINGS.ease,
  'ease-in': SPLIT_EASINGS.easeIn,
  'ease-out': SPLIT_EASINGS.easeOut,
  'ease-in-out': SPLIT_EASINGS.easeInOut,
};

function cssEasingFunction(css: string): (progress: number) => number {
  const value = css.trim();
  const keyword = CSS_KEYWORDS[value];
  if (keyword) return toEasingFunction(keyword);
  const match = /^cubic-bezier\(([^)]*)\)$/.exec(value);
  const points = match?.[1].split(',').map(Number);
  if (points?.length === 4 && points.every(Number.isFinite)) {
    return toEasingFunction(cubicBezier(points as [number, number, number, number]));
  }
  throw new SplitInvalidOptionError(
    'animation.easing',
    css,
    'palavra-chave CSS ou cubic-bezier() (use um objeto de easing para outras curvas)',
  );
}

/** Cubic Bézier through (0,0), (x1,y1), (x2,y2), (1,1): solves x(t) = progress, returns y(t). */
function bezier(x1: number, y1: number, x2: number, y2: number): (progress: number) => number {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const x = (t: number) => ((ax * t + bx) * t + cx) * t;
  const y = (t: number) => ((ay * t + by) * t + cy) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  const solve = (target: number) => {
    let t = target;
    for (let i = 0; i < 8; i++) {
      const err = x(t) - target;
      if (Math.abs(err) < 1e-7) return t;
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    let lo = 0;
    let hi = 1;
    t = target;
    for (let i = 0; i < 40; i++) {
      const value = x(t);
      if (Math.abs(value - target) < 1e-7) break;
      if (value < target) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return t;
  };
  return (p) => (p <= 0 ? 0 : p >= 1 ? 1 : y(solve(p)));
}

function linearFunction(stops: readonly SplitLinearStop[]): (progress: number) => number {
  if (stops.length === 0) return (p) => Math.min(1, Math.max(0, p));
  // Stops without a position are spread evenly between their neighbors, as in CSS.
  const points = stops.map((s) =>
    typeof s === 'number' ? { v: s, at: NaN } : { v: s[0], at: s[1] },
  );
  if (Number.isNaN(points[0].at)) points[0].at = 0;
  if (Number.isNaN(points[points.length - 1].at)) points[points.length - 1].at = 1;
  for (let i = 1; i < points.length; i++) {
    if (!Number.isNaN(points[i].at)) continue;
    let j = i;
    while (Number.isNaN(points[j].at)) j++;
    const start = points[i - 1].at;
    const step = (points[j].at - start) / (j - i + 1);
    for (let k = i; k < j; k++) points[k].at = start + step * (k - i + 1);
  }
  return (p) => {
    if (p <= points[0].at) return points[0].v;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      if (p <= b.at) return b.at === a.at ? b.v : a.v + ((b.v - a.v) * (p - a.at)) / (b.at - a.at);
    }
    return points[points.length - 1].v;
  };
}

function stepsFunction(count: number, position: SplitStepPosition): (progress: number) => number {
  const start = position === 'jump-start' || position === 'start' || position === 'jump-both';
  const jumps = position === 'jump-both' ? count + 1 : position === 'jump-none' ? count - 1 : count;
  return (p) => {
    if (p <= 0) return start ? 1 / jumps : 0;
    if (p >= 1) return 1;
    let step = Math.floor(p * count);
    if (start) step++;
    return Math.min(1, step / jumps);
  };
}

/** Distance to the target of a spring released at 1 (0 = settled), at time `t` in seconds. */
function springError(e: SplitSpringEasing): (t: number) => number {
  const w0 = Math.sqrt(e.stiffness / e.mass);
  const zeta = e.damping / (2 * Math.sqrt(e.stiffness * e.mass));
  const v0 = e.velocity;
  if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    const b = (zeta * w0 - v0) / wd;
    return (t) => Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + b * Math.sin(wd * t));
  }
  if (zeta === 1) return (t) => Math.exp(-w0 * t) * (1 + (w0 - v0) * t);
  const root = Math.sqrt(zeta * zeta - 1);
  const r1 = -w0 * (zeta - root);
  const r2 = -w0 * (zeta + root);
  const a = (-v0 - r2) / (r1 - r2);
  return (t) => a * Math.exp(r1 * t) + (1 - a) * Math.exp(r2 * t);
}

function springFunction(e: SplitSpringEasing): (progress: number) => number {
  const error = springError(e);
  // Time until the motion stays within 0.1% of the target (at most 10s).
  const dt = 1 / 120;
  let settle = dt;
  for (let t = 0; t <= 10; t += dt) if (Math.abs(error(t)) > 0.001) settle = t + dt;
  return (p) => (p <= 0 ? 0 : p >= 1 ? 1 : 1 - error(p * settle));
}
