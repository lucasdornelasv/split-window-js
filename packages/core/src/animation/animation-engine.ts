import { SplitInvalidOptionError } from '../errors/errors.js';
import type {
  ContainerState,
  SplitBodySide,
  SplitContainerLayout,
  SplitRect,
} from '../model/types.js';

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
 * Looks the engines understand: `slide` from the side, `collapse` (sizes only), `none`, and
 * `fade` (opacity only: the sizes of the layout, like the push padding, change at once, at the
 * start of a show and at the end of a hide).
 */
export type SplitAnimationPreset = 'slide' | 'fade' | 'collapse' | 'none';

/** Animation options after merging the global defaults, the mode and the container. */
export interface SplitAnimationSettings {
  readonly preset: SplitAnimationPreset;
  /** In ms. Without a value, each engine uses its own default. */
  readonly duration?: number;
  /** For show and hide. Without a value: `defaultEasing(phase)`. */
  readonly easing?: string;
  /** In ms. */
  readonly delay?: number;
  readonly respectReducedMotion: boolean;
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

/** Animation options. */
export interface SplitAnimationOptions<TElement = unknown> {
  /** `false` turns the animation off. An options object without it turns it on. */
  enabled?: boolean;
  /** Default: the first registered engine, or `NoopSplitAnimationEngine` when there is none. */
  engine?: SplitAnimationEngineInput<TElement>;
  /** Default: `slide` for overlay and body push, `collapse` for custom push, `fade` for inline. */
  preset?: SplitAnimationPreset;
  duration?: number;
  /**
   * For show and hide. Default: decelerating on show (`SPLIT_DEFAULT_EASING`), accelerating
   * on hide (`SPLIT_DEFAULT_HIDE_EASING`).
   */
  easing?: string;
  delay?: number;
  /** With reduced motion, transitions end at once. Default: `true`. */
  respectReducedMotion?: boolean;
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
export const SPLIT_DEFAULT_EASING = 'cubic-bezier(0.2, 0, 0, 1)';

/**
 * Easing of a hide when nothing else is configured (accelerates). A decelerating curve on a
 * hide makes the panel look gone long before the transition ends, so what follows it (the
 * page growing back in `push`) looks late.
 */
export const SPLIT_DEFAULT_HIDE_EASING = 'cubic-bezier(0.4, 0, 1, 1)';

/** Default easing of a phase: `SPLIT_DEFAULT_EASING` on show, `SPLIT_DEFAULT_HIDE_EASING` on hide. */
export function defaultEasing(phase: 'show' | 'hide'): string {
  return phase === 'hide' ? SPLIT_DEFAULT_HIDE_EASING : SPLIT_DEFAULT_EASING;
}

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
  return { enabled: true, ...input };
}

/** Merges two animation inputs; the second wins key by key. */
export function mergeAnimation<TElement>(
  first: SplitAnimationInput<TElement> | undefined,
  second: SplitAnimationInput<TElement> | undefined,
): SplitAnimationOptions<TElement> {
  return { ...normalizeAnimation(first), ...normalizeAnimation(second) };
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
  private readonly noop = new NoopSplitAnimationEngine<TElement>();

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
