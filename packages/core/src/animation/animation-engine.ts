import { SplitInvalidOptionError } from '../errors/errors.js';
import type {
  ContainerState,
  SplitBodySide,
  SplitContainerLayout,
  SplitRect,
} from '../model/types.js';
import { SPLIT_EASINGS, isEasing, type SplitEasing, type SplitEasingInput } from './easing.js';

/** The part of `AbortSignal` the engines use. A DOM `AbortSignal` satisfies it. */
export interface SplitAbortSignal {
  readonly aborted: boolean;
  addEventListener(type: 'abort', listener: () => void, options?: { once?: boolean }): void;
}

/**
 * Elements of a container that a mode or an animation can touch.
 * @typeParam TElement - the element type of the adapter (`HTMLElement` in Angular).
 */
export interface SplitContainerElements<TElement = unknown> {
  /** The shell (tab strip + content). */
  readonly shell: TElement;
  /** The app host of a custom container, or the fixed host of a body container. */
  readonly host: TElement;
  /** Backdrop of a body container with `backdrop: true`. */
  readonly backdrop: TElement | null;
  /** Element pushed by a body container in the `push` layout. */
  readonly pushTarget: TElement | null;
}

/** State of the container at one end of a transition. */
export interface SplitAnimationFrame {
  /** Rectangle of the shell, in viewport coordinates. */
  readonly rect: SplitRect;
  readonly opacity: number;
  /** Size of the host on the side axis (custom containers in `push`), as a CSS length. */
  readonly hostSize: string | null;
  /** Value of the push property on the push target (body containers in `push`). */
  readonly push: string | null;
}

/** CSS properties that change between the frames, when the layout has them. */
export interface SplitAnimationProperties {
  /** `width` or `height` of the host (custom containers in `push`). */
  readonly host: 'width' | 'height' | null;
  /** `padding-<side>` of the push target (body containers in `push`). */
  readonly push: string | null;
}

/**
 * Looks the engines understand:
 * - `slide`: moves in from `origin` (show) and out toward it (hide), by `distance`;
 * - `scale`: from `scale` to the natural size (show) and back (hide), anchored at `origin`;
 * - `fade`: opacity only;
 * - `collapse`: a curtain: the panel stays still in its final place and shows from the edge
 *   at the container side inward; in `push`, in step with the host size or page padding
 *   (`collapseReveal`);
 * - `none`: no motion in that phase.
 *
 * Only `slide` and `collapse` animate the sizes of the layout. With the others, they change
 * at once: at the start of a show and at the end of a hide.
 */
export type SplitAnimationPreset = 'slide' | 'fade' | 'scale' | 'collapse' | 'none';

export const SPLIT_ANIMATION_PRESETS: readonly SplitAnimationPreset[] = [
  'slide',
  'fade',
  'scale',
  'collapse',
  'none',
];

/** A side of the container, or `center` (`scale` only). */
export type SplitAnimationOrigin = SplitBodySide | 'center';

/** Options of one phase (show or hide), or of both when given at the top of `animation`. */
export interface SplitAnimationPhaseOptions {
  /** Default: `slide` for overlay and body push, `collapse` for custom push, `fade` for inline. */
  preset?: SplitAnimationPreset;
  /** In ms. Without a value, each engine uses its own default. */
  duration?: number;
  /**
   * `cubicBezier([...])`, `spring()`, `SPLIT_EASINGS.easeOut`, an easing of your own type or
   * a CSS string. Default: decelerating on show, accelerating on hide (`defaultEasing`).
   */
  easing?: SplitEasingInput;
  /** In ms. */
  delay?: number;
  /**
   * `slide`: side the panel comes from (show) or goes to (hide); default: the container
   * side (`center` also means the container side). `scale`: edge the panel grows from and
   * shrinks to; default: `center`.
   */
  origin?: SplitAnimationOrigin;
  /**
   * How far `slide` moves: px (number) or a CSS length; percentages are of the panel size.
   * Default: `'100%'` (fully out).
   */
  distance?: number | string;
  /**
   * Scale of `scale` out of view: below 1 the panel grows to its size, above 1 it shrinks
   * to it. Default: `0.9`.
   */
  scale?: number;
}

/** Options of one phase after merging the layers and filling the defaults. */
export interface SplitAnimationSettings {
  readonly preset: SplitAnimationPreset;
  /** In ms. Without a value, each engine uses its own default. */
  readonly duration?: number;
  /** Without a value: `defaultEasing(phase)`. */
  readonly easing?: SplitEasingInput;
  /** In ms. */
  readonly delay?: number;
  /** Resolved: a side for `slide`, a side or `center` for `scale`. */
  readonly origin: SplitAnimationOrigin;
  readonly distance: number | string;
  readonly scale: number;
  readonly respectReducedMotion: boolean;
}

/** Settings of both phases. */
export interface SplitAnimationPhases {
  readonly show: SplitAnimationSettings;
  readonly hide: SplitAnimationSettings;
}

/**
 * Everything an animation engine receives. On a show, the layout of the open state is
 * already applied when `animate` runs; on a hide, it is still applied. The engine animates
 * from `from` to `to` and resolves (or returns) when it is done.
 */
export interface SplitAnimationContext<TElement = unknown> {
  readonly phase: 'show' | 'hide';
  readonly container: ContainerState<TElement>;
  readonly layout: SplitContainerLayout;
  readonly side: SplitBodySide;
  /** Panel size on the side axis, when the layout has one. */
  readonly size: string | null;
  readonly elements: SplitContainerElements<TElement>;
  readonly from: SplitAnimationFrame;
  readonly to: SplitAnimationFrame;
  readonly properties: SplitAnimationProperties;
  /** Settings of this phase (`animation.show`/`animation.hide` over the shared options). */
  readonly options: SplitAnimationSettings;
  /** The user asked the system for reduced motion. */
  readonly reducedMotion: boolean;
  /** Aborted when another transition interrupts this one: stop and resolve. */
  readonly signal: SplitAbortSignal;
  /** Tells the adapter that elements started moving. */
  started(): void;
  /** Optional progress report, from 0 to 1. */
  progress(value: number): void;
}

/**
 * Base class of every animation engine. Extend it, or one of the engines of
 * `@split-window/css-animation` and `@split-window/keyframes-animation`.
 */
export abstract class SplitAnimationEngine<TElement = unknown> {
  /** Runs one transition. Return (or resolve) when it is over. */
  abstract animate(ctx: SplitAnimationContext<TElement>): Promise<void> | void;

  /**
   * Called when the transition ends or is interrupted, before the adapter applies the
   * final state (on a hide, before the open layout is removed). Undo temporary changes here.
   */
  cleanup(_ctx: SplitAnimationContext<TElement>): void {
    // nothing to undo
  }
}

/**
 * Default engine, used when no engine is registered, when `'none'` is chosen and with
 * reduced motion. Nothing moves, but the transition goes through every step synchronously:
 * `started()`, `progress(1)` and the end, so the adapter emits the same events.
 */
export class NoopSplitAnimationEngine<TElement = unknown> extends SplitAnimationEngine<TElement> {
  animate(ctx: SplitAnimationContext<TElement>): void {
    ctx.started();
    ctx.progress(1);
  }
}

/** A function used as an animation engine. */
export type SplitAnimationFn<TElement = unknown> = (
  ctx: SplitAnimationContext<TElement>,
) => Promise<void> | void;

/** Wraps a function as an engine. */
export class SplitFunctionAnimationEngine<
  TElement = unknown,
> extends SplitAnimationEngine<TElement> {
  constructor(private readonly fn: SplitAnimationFn<TElement>) {
    super();
  }

  animate(ctx: SplitAnimationContext<TElement>): Promise<void> | void {
    return this.fn(ctx);
  }
}

/** A class of engine. Adapters may create it with their dependency injection. */
export type SplitAnimationEngineClass<TElement = unknown> = new (
  ...args: any[]
) => SplitAnimationEngine<TElement>;

/**
 * What `animation.engine` accepts: the name of a registered engine, `'none'` (the noop
 * engine), an instance, a class or a function. Without a value: the first registered engine,
 * or the noop engine when none is registered.
 */
export type SplitAnimationEngineInput<TElement = unknown> =
  | 'none'
  | (string & {})
  | SplitAnimationEngine<TElement>
  | SplitAnimationEngineClass<TElement>
  | SplitAnimationFn<TElement>;

/** What `animation.show` and `animation.hide` accept: a preset or the options of the phase. */
export type SplitAnimationPhaseInput = SplitAnimationPreset | SplitAnimationPhaseOptions;

/**
 * Animation options. The phase options at the top (`preset`, `duration`, `easing`...) are
 * shared by show and hide; `show` and `hide` override them for one phase:
 *
 * ```ts
 * animation: { duration: 250, show: 'fade', hide: { preset: 'slide', origin: 'bottom' } }
 * ```
 */
export interface SplitAnimationOptions<TElement = unknown> extends SplitAnimationPhaseOptions {
  /** `false` turns the animation off. An options object without it turns it on. */
  enabled?: boolean;
  /** Default: the first registered engine, or `NoopSplitAnimationEngine` when there is none. */
  engine?: SplitAnimationEngineInput<TElement>;
  /** With reduced motion, transitions end at once. Default: `true`. */
  respectReducedMotion?: boolean;
  /** Opening: overrides the shared options. */
  show?: SplitAnimationPhaseInput;
  /** Closing: overrides the shared options. */
  hide?: SplitAnimationPhaseInput;
}

/**
 * What the `animation` option accepts: `true`/`false`, a preset, options, or an engine
 * (instance, class or function).
 */
export type SplitAnimationInput<TElement = unknown> =
  | boolean
  | SplitAnimationPreset
  | SplitAnimationOptions<TElement>
  | SplitAnimationEngine<TElement>
  | SplitAnimationEngineClass<TElement>
  | SplitAnimationFn<TElement>;

/** Easing of a show when nothing else is configured (decelerates: fast start, soft landing). */
export const SPLIT_DEFAULT_EASING: SplitEasing = SPLIT_EASINGS.decelerate;

/**
 * Easing of a hide when nothing else is configured (accelerates). A decelerating curve on a
 * hide makes the panel look gone long before the transition ends, so what follows it (the
 * page growing back in `push`) looks late.
 */
export const SPLIT_DEFAULT_HIDE_EASING: SplitEasing = SPLIT_EASINGS.accelerate;

/** Default easing of a phase: `SPLIT_DEFAULT_EASING` on show, `SPLIT_DEFAULT_HIDE_EASING` on hide. */
export function defaultEasing(phase: 'show' | 'hide'): SplitEasing {
  return phase === 'hide' ? SPLIT_DEFAULT_HIDE_EASING : SPLIT_DEFAULT_EASING;
}

/** Default of `scale`. */
export const SPLIT_DEFAULT_ANIMATION_SCALE = 0.9;
/** Default of `distance`. */
export const SPLIT_DEFAULT_ANIMATION_DISTANCE = '100%';

/** Whether a value is an engine instance (duck typed, so it works across bundles). */
export function isAnimationEngine(value: unknown): value is SplitAnimationEngine<any> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { animate?: unknown }).animate === 'function'
  );
}

/** Whether a function is an engine class (its prototype has `animate`). */
export function isAnimationEngineClass(value: unknown): value is SplitAnimationEngineClass<any> {
  return (
    typeof value === 'function' &&
    typeof (value as { prototype?: { animate?: unknown } }).prototype?.animate === 'function'
  );
}

/** Keys of the phase options. */
export const SPLIT_ANIMATION_PHASE_KEYS = [
  'preset',
  'duration',
  'easing',
  'delay',
  'origin',
  'distance',
  'scale',
] as const satisfies readonly (keyof SplitAnimationPhaseOptions)[];

/** Turns a phase input into options (`'fade'` → `{ preset: 'fade' }`). */
export function normalizeAnimationPhase(
  input: SplitAnimationPhaseInput | undefined,
): SplitAnimationPhaseOptions {
  if (input === undefined) return {};
  if (typeof input === 'string') return { preset: input };
  return { ...input };
}

/** Turns any animation input into options, so layers can be merged. */
export function normalizeAnimation<TElement>(
  input: SplitAnimationInput<TElement> | undefined,
): SplitAnimationOptions<TElement> {
  if (input === undefined) return {};
  if (typeof input === 'boolean') return { enabled: input };
  if (input === 'none') return { enabled: false };
  if (typeof input === 'string') return { enabled: true, preset: input };
  if (typeof input === 'function' || isAnimationEngine(input)) {
    return { enabled: true, engine: input };
  }
  const options: SplitAnimationOptions<TElement> = { enabled: true, ...input };
  if (input.show !== undefined) options.show = normalizeAnimationPhase(input.show);
  if (input.hide !== undefined) options.hide = normalizeAnimationPhase(input.hide);
  return options;
}

/**
 * Merges two animation inputs; the second wins key by key. A shared option of the second
 * also replaces the same option given for one phase in the first, so a container
 * `animation: 'slide'` wins over `containerDefaults.animation: { hide: 'fade' }`. Within one
 * input, `show`/`hide` win over the shared options.
 */
export function mergeAnimation<TElement>(
  first: SplitAnimationInput<TElement> | undefined,
  second: SplitAnimationInput<TElement> | undefined,
): SplitAnimationOptions<TElement> {
  const a = normalizeAnimation(first);
  const b = normalizeAnimation(second);
  const merged: SplitAnimationOptions<TElement> = { ...a, ...b };
  for (const phase of ['show', 'hide'] as const) {
    const lower: Record<string, unknown> = { ...(a[phase] as SplitAnimationPhaseOptions) };
    for (const key of SPLIT_ANIMATION_PHASE_KEYS) if (b[key] !== undefined) delete lower[key];
    const result = { ...lower, ...(b[phase] as SplitAnimationPhaseOptions | undefined) };
    if (Object.keys(result).length > 0) merged[phase] = result;
    else delete merged[phase];
  }
  return merged;
}

/** Where the container is, for the defaults of `resolveAnimation`. */
export interface SplitAnimationTarget {
  readonly layout: SplitContainerLayout;
  readonly kind: 'custom' | 'body';
  readonly side: SplitBodySide;
}

/**
 * Settings of both phases: the shared options under `show`/`hide`, with the defaults
 * (preset by layout, origin, distance, scale) filled in.
 */
export function resolveAnimation<TElement>(
  input: SplitAnimationInput<TElement> | undefined,
  target: SplitAnimationTarget,
): SplitAnimationPhases {
  const options = normalizeAnimation(input);
  const shared: SplitAnimationPhaseOptions = {};
  for (const key of SPLIT_ANIMATION_PHASE_KEYS) {
    if (options[key] !== undefined) (shared as Record<string, unknown>)[key] = options[key];
  }
  const phase = (own: SplitAnimationPhaseInput | undefined): SplitAnimationSettings => {
    const p = { ...shared, ...normalizeAnimationPhase(own) };
    const preset = p.preset ?? defaultAnimationPreset(target.layout, target.kind);
    const origin: SplitAnimationOrigin =
      preset === 'scale'
        ? (p.origin ?? 'center')
        : p.origin && p.origin !== 'center'
          ? p.origin
          : target.side;
    return {
      preset,
      duration: p.duration,
      easing: p.easing,
      delay: p.delay,
      origin,
      distance: p.distance ?? SPLIT_DEFAULT_ANIMATION_DISTANCE,
      scale: p.scale ?? SPLIT_DEFAULT_ANIMATION_SCALE,
      respectReducedMotion: options.respectReducedMotion ?? true,
    };
  };
  return { show: phase(options.show), hide: phase(options.hide) };
}

/** Whether the preset animates the sizes of the layout (host in `push`, page padding). */
export function presetAnimatesSizes(preset: SplitAnimationPreset): boolean {
  return preset === 'slide' || preset === 'collapse';
}

/** Negates a CSS length: `40px` → `-40px`, `100%` → `-100%`, `2rem + 1px` → `calc(-1 * (...))`. */
function negate(length: string): string {
  const value = length.trim();
  if (/^-?\d*\.?\d+[a-z%]*$/i.test(value)) {
    return value.startsWith('-') ? value.slice(1) : `-${value}`;
  }
  return `calc(-1 * (${value}))`;
}

/**
 * Transform of a `slide` out of view: moved by `distance` toward `origin`.
 * `slideTransform('right', '100%')` → `translateX(100%)`; `('top', 40)` → `translateY(-40px)`.
 */
export function slideTransform(origin: SplitAnimationOrigin, distance: number | string): string {
  const length = typeof distance === 'number' ? `${distance}px` : distance;
  switch (origin) {
    case 'left':
      return `translateX(${negate(length)})`;
    case 'right':
      return `translateX(${length})`;
    case 'top':
      return `translateY(${negate(length)})`;
    case 'bottom':
      return `translateY(${length})`;
    default:
      return 'none';
  }
}

/** How the panel of a `collapse` is revealed: a property of the shell, from `closed` to `open`. */
export interface SplitCollapseReveal {
  readonly property: 'clip-path' | 'transform';
  /** Value with the panel hidden (start of a show, end of a hide). */
  readonly closed: string;
  /** Value with the panel fully shown. */
  readonly open: string;
}

const OPPOSITE: Record<SplitBodySide, SplitBodySide> = {
  left: 'right',
  right: 'left',
  top: 'bottom',
  bottom: 'top',
};

/**
 * Reveal of a `collapse`, like a curtain: the panel stays still in its final place and shows
 * from the edge at the container side inward (in the body `push`, exactly the space the page
 * gave). `null` for other presets.
 * - custom `push`: the growing host already clips the panel, which sits against the content
 *   side, so a `transform` in step with the host keeps it still in its final place;
 * - everything else: a `clip-path` (`inset`) on the shell. Played with the same duration and
 *   easing as the host size or page padding, it stays in step with them.
 */
export function collapseReveal(ctx: {
  options: { preset: SplitAnimationPreset };
  layout: SplitContainerLayout;
  side: SplitBodySide;
  properties: SplitAnimationProperties;
}): SplitCollapseReveal | null {
  if (ctx.options.preset !== 'collapse') return null;
  if (ctx.layout === 'push' && ctx.properties.host !== null) {
    return {
      property: 'transform',
      closed: slideTransform(OPPOSITE[ctx.side], '100%'),
      open: 'none',
    };
  }
  // inset(top right bottom left): the edge on the content side starts fully inset.
  const closed: Record<SplitBodySide, string> = {
    right: 'inset(0px 0px 0px 100%)',
    left: 'inset(0px 100% 0px 0px)',
    top: 'inset(0px 0px 100% 0px)',
    bottom: 'inset(100% 0px 0px 0px)',
  };
  return { property: 'clip-path', closed: closed[ctx.side], open: 'inset(0px 0px 0px 0px)' };
}

/** `transform-origin` of a `scale`: `left` → `left center`, `center` → `center`. */
export function scaleTransformOrigin(origin: SplitAnimationOrigin): string {
  switch (origin) {
    case 'left':
    case 'right':
      return `${origin} center`;
    case 'top':
    case 'bottom':
      return `center ${origin}`;
    default:
      return 'center';
  }
}

/**
 * Checks the `animation` option (when it is options, presets or phases). Engines and
 * functions are accepted as they are.
 * @throws SplitInvalidOptionError
 */
export function validateAnimation(option: string, value: unknown): void {
  if (value === undefined || typeof value === 'boolean') return;
  if (typeof value === 'function' || isAnimationEngine(value)) return;
  if (typeof value === 'string') {
    if (!SPLIT_ANIMATION_PRESETS.includes(value as SplitAnimationPreset)) {
      throw new SplitInvalidOptionError(option, value, SPLIT_ANIMATION_PRESETS.join(' | '));
    }
    return;
  }
  if (typeof value !== 'object' || value === null) {
    throw new SplitInvalidOptionError(option, value, 'boolean, preset, objeto, motor ou função');
  }
  const options = value as SplitAnimationOptions;
  for (const key of ['enabled', 'respectReducedMotion'] as const) {
    if (options[key] !== undefined && typeof options[key] !== 'boolean') {
      throw new SplitInvalidOptionError(`${option}.${key}`, options[key], 'boolean');
    }
  }
  validatePhase(option, options);
  for (const phase of ['show', 'hide'] as const) {
    const own = options[phase];
    if (own === undefined) continue;
    if (typeof own === 'string' || (typeof own === 'object' && own !== null)) {
      validatePhase(`${option}.${phase}`, normalizeAnimationPhase(own));
    } else {
      throw new SplitInvalidOptionError(`${option}.${phase}`, own, 'preset ou objeto');
    }
  }
}

const ORIGINS: readonly SplitAnimationOrigin[] = ['left', 'right', 'top', 'bottom', 'center'];

function validatePhase(option: string, p: SplitAnimationPhaseOptions): void {
  const fail = (key: string, value: unknown, expected: string): never => {
    throw new SplitInvalidOptionError(`${option}.${key}`, value, expected);
  };
  if (p.preset !== undefined && !SPLIT_ANIMATION_PRESETS.includes(p.preset)) {
    fail('preset', p.preset, SPLIT_ANIMATION_PRESETS.join(' | '));
  }
  for (const key of ['duration', 'delay'] as const) {
    const v = p[key];
    if (v !== undefined && (typeof v !== 'number' || !Number.isFinite(v) || v < 0)) {
      fail(key, v, 'número >= 0 (ms)');
    }
  }
  if (
    p.easing !== undefined &&
    !(typeof p.easing === 'string' && p.easing.trim() !== '') &&
    !isEasing(p.easing)
  ) {
    fail('easing', p.easing, 'easing (cubicBezier, spring...) ou texto CSS');
  }
  if (p.origin !== undefined && !ORIGINS.includes(p.origin)) {
    fail('origin', p.origin, ORIGINS.join(' | '));
  }
  const d = p.distance;
  if (
    d !== undefined &&
    !(typeof d === 'number' && Number.isFinite(d) && d >= 0) &&
    !(typeof d === 'string' && d.trim() !== '')
  ) {
    fail('distance', d, 'número >= 0 (px) ou comprimento CSS');
  }
  const s = p.scale;
  if (s !== undefined && (typeof s !== 'number' || !Number.isFinite(s) || s <= 0)) {
    fail('scale', s, 'número > 0');
  }
}

/** Name of the noop engine, always available. */
export const SPLIT_NOOP_ANIMATION_ENGINE = 'none';

/**
 * Named animation engines, in registration order. A container picks one by name (or gives
 * an engine directly); without a choice, the first registered engine is used, and the noop
 * engine only when nothing is registered or `'none'` is chosen.
 */
export class SplitAnimationEngineRegistry<TElement = unknown> {
  private readonly entries = new Map<
    string,
    SplitAnimationEngine<TElement> | SplitAnimationEngineClass<TElement>
  >();
  private readonly instances = new Map<unknown, SplitAnimationEngine<TElement>>();
  private noopEngine: NoopSplitAnimationEngine<TElement> | null = null;

  /** The noop engine, created on first use. */
  private get noop(): NoopSplitAnimationEngine<TElement> {
    return (this.noopEngine ??= new NoopSplitAnimationEngine<TElement>());
  }

  /**
   * @param instantiate - creates engine classes (adapters pass their dependency injection).
   */
  constructor(
    private readonly instantiate: (
      type: SplitAnimationEngineClass<TElement>,
    ) => SplitAnimationEngine<TElement> = (type) => new type(),
  ) {}

  /** Registers an engine (instance or class) under a name. A name registered again is replaced in place. */
  register(
    name: string,
    engine: SplitAnimationEngine<TElement> | SplitAnimationEngineClass<TElement>,
  ): void {
    if (typeof name !== 'string' || name.trim() === '' || name === SPLIT_NOOP_ANIMATION_ENGINE) {
      throw new SplitInvalidOptionError(
        'animationEngines',
        name,
        `nome não vazio, diferente de '${SPLIT_NOOP_ANIMATION_ENGINE}'`,
      );
    }
    if (!isAnimationEngine(engine) && !isAnimationEngineClass(engine)) {
      throw new SplitInvalidOptionError(
        `animationEngines.${name}`,
        engine,
        'motor ou classe de motor',
      );
    }
    this.entries.set(name, engine);
  }

  has(name: string): boolean {
    return name === SPLIT_NOOP_ANIMATION_ENGINE || this.entries.has(name);
  }

  /** Registered names, in order (without `'none'`). */
  names(): string[] {
    return [...this.entries.keys()];
  }

  /** Engine of a name, or `undefined`. */
  get(name: string): SplitAnimationEngine<TElement> | undefined {
    if (name === SPLIT_NOOP_ANIMATION_ENGINE) return this.noop;
    const entry = this.entries.get(name);
    return entry === undefined ? undefined : this.create(entry);
  }

  /**
   * Resolves an engine input. Without a value: the first registered engine, or the noop
   * engine when nothing is registered. Unknown names throw `SplitInvalidOptionError`.
   */
  resolve(input?: SplitAnimationEngineInput<TElement>): SplitAnimationEngine<TElement> {
    if (input === undefined) {
      const first = this.entries.values().next();
      return first.done ? this.noop : this.create(first.value);
    }
    if (typeof input === 'string') {
      const engine = this.get(input);
      if (!engine) {
        throw new SplitInvalidOptionError(
          'animation.engine',
          input,
          [SPLIT_NOOP_ANIMATION_ENGINE, ...this.names()].join(' | '),
        );
      }
      return engine;
    }
    if (isAnimationEngine(input)) return input;
    if (isAnimationEngineClass(input)) return this.create(input);
    if (typeof input === 'function') {
      let wrapped = this.instances.get(input);
      if (!wrapped) {
        wrapped = new SplitFunctionAnimationEngine(input as SplitAnimationFn<TElement>);
        this.instances.set(input, wrapped);
      }
      return wrapped;
    }
    throw new SplitInvalidOptionError('animation.engine', input, 'nome, motor, classe ou função');
  }

  private create(
    entry: SplitAnimationEngine<TElement> | SplitAnimationEngineClass<TElement>,
  ): SplitAnimationEngine<TElement> {
    if (isAnimationEngine(entry)) return entry;
    let instance = this.instances.get(entry);
    if (!instance) {
      instance = this.instantiate(entry);
      this.instances.set(entry, instance);
    }
    return instance;
  }
}

/** Preset used when none is given. */
export function defaultAnimationPreset(
  layout: SplitContainerLayout,
  kind: 'custom' | 'body',
): SplitAnimationPreset {
  if (layout === 'overlay') return 'slide';
  if (layout === 'push') return kind === 'body' ? 'slide' : 'collapse';
  return 'fade';
}
