import type {
  SplitAnimationContext,
  SplitAnimationEngine,
  SplitAnimationFrame,
  SplitAnimationSettings,
} from '../animation/animation-engine.js';
import { SPLIT_DEFAULT_EASING, SPLIT_DEFAULT_HIDE_EASING } from '../animation/animation-engine.js';
import {
  cubicBezier,
  easingToCss,
  spring,
  steps,
  type SplitEasingInput,
} from '../animation/easing.js';
import type { SplitBodySide, SplitContainerLayout } from '../model/types.js';

/*
 * Contract of the animation engines: the scenarios every engine must pass the same way.
 * Each engine plugs in with a driver that turns what it does into a common shape (which
 * property of which element animates, from what to what, with what timing), so the
 * scenarios do not depend on how the engine animates (CSS classes, Web Animations...).
 *
 * ```ts
 * for (const scenario of splitAnimationEngineScenarios) {
 *   it(scenario.name, () => scenario.run(myDriver));
 * }
 * ```
 */

/** The elements an engine may animate. */
export type SplitAnimationRole = 'shell' | 'host' | 'pushTarget' | 'backdrop';

/** One animated property of one element. Values are as the engine sets them. */
export interface SplitAnimationTrack {
  readonly element: SplitAnimationRole;
  /** CSS property, in kebab-case (`transform`, `padding-right`, `clip-path`...). */
  readonly property: string;
  readonly from: string;
  readonly to: string;
}

/** Timing of the transition, as the engine applies it. */
export interface SplitAnimationTiming {
  /** In ms. */
  readonly duration: number;
  /** CSS easing. */
  readonly easing: string;
  /** In ms. */
  readonly delay: number;
}

/** What `animate` started, seen by the driver. */
export interface SplitAnimationRun {
  /** What `animate` returned. */
  readonly result: Promise<void> | void;
  readonly tracks: readonly SplitAnimationTrack[];
  /** `null` when nothing animates. */
  readonly timing: SplitAnimationTiming | null;
}

/** Fresh elements of one scenario. */
export interface SplitAnimationElements<TElement> {
  shell: TElement;
  host: TElement;
  pushTarget: TElement;
  backdrop: TElement;
}

/**
 * A preset added to the engine, described the same way for every engine: the properties
 * of the shell from out of view to open. The driver turns it into a preset of its engine
 * (CSS rules, keyframes...).
 */
export interface SplitAnimationContractPreset {
  /** Properties of the shell on show (`from`: out of view; `to`: open). The hide plays them backwards. */
  readonly shell: readonly {
    readonly property: string;
    readonly from: string;
    readonly to: string;
  }[];
  /** Whether the host size and the page padding animate. */
  readonly sizes?: boolean;
}

/** What the contract asks of the engine it creates. */
export interface SplitAnimationEngineCreateOptions {
  /** Translates easings with this function (a subclass overriding the translation). */
  readonly translateEasing?: (easing: SplitEasingInput) => string;
  /** Presets to add to the engine (`addPreset`), by name. */
  readonly presets?: Readonly<Record<string, SplitAnimationContractPreset>>;
}

/** How an engine plugs into the contract. */
export interface SplitAnimationEngineDriver<TElement> {
  /** A new engine, with the presets and the easing translation asked for. */
  create(options?: SplitAnimationEngineCreateOptions): SplitAnimationEngine<TElement>;
  /** New, unrelated elements. */
  elements(): SplitAnimationElements<TElement>;
  /** Calls `engine.animate(ctx)` and reports what it started. */
  start(
    engine: SplitAnimationEngine<TElement>,
    ctx: SplitAnimationContext<TElement>,
  ): SplitAnimationRun;
  /** Plays every running animation of the context to its end. */
  finish(ctx: SplitAnimationContext<TElement>): void;
  /**
   * State of an element that the engine may change (styles, attributes, running
   * animations...). After `cleanup`, it must be back to what it was before `animate`.
   * Leave out what the engine keeps on purpose (the open state of a show).
   */
  snapshot(element: TElement): string;
}

/** One scenario of the contract. */
export interface SplitAnimationEngineScenario {
  readonly name: string;
  run<TElement>(driver: SplitAnimationEngineDriver<TElement>): Promise<void>;
}

// ------------------------------------------------------------ helpers

class ContractAbort {
  aborted = false;
  private listeners: (() => void)[] = [];
  addEventListener(_type: 'abort', listener: () => void): void {
    if (this.aborted) listener();
    else this.listeners.push(listener);
  }
  abort(): void {
    this.aborted = true;
    for (const listener of this.listeners.splice(0)) listener();
  }
}

/** Where the scenario happens. */
interface Setup {
  phase?: 'show' | 'hide';
  layout?: SplitContainerLayout;
  side?: SplitBodySide;
  /** Custom push: the host size animates (`width`/`height`). */
  hostSize?: boolean;
  /** Body push: the page padding animates. */
  push?: boolean;
  backdrop?: boolean;
  options?: Partial<SplitAnimationSettings>;
}

const axis = (side: SplitBodySide) => (side === 'left' || side === 'right' ? 'width' : 'height');

function build<TElement>(driver: SplitAnimationEngineDriver<TElement>, setup: Setup) {
  const elements = driver.elements();
  const phase = setup.phase ?? 'show';
  const side = setup.side ?? 'right';
  const abort = new ContractAbort();
  const calls = { started: 0 };
  const open = (patch: Partial<SplitAnimationFrame>): SplitAnimationFrame => ({
    rect: { x: 0, y: 0, width: 300, height: 300 },
    opacity: 1,
    hostSize: setup.hostSize ? '300px' : null,
    push: setup.push ? '300px' : null,
    ...patch,
  });
  const closed = open({
    hostSize: setup.hostSize ? '0px' : null,
    push: setup.push ? '0px' : null,
  });
  const ctx: SplitAnimationContext<TElement> = {
    phase,
    container: {} as never,
    layout: setup.layout ?? 'overlay',
    side,
    size: '300px',
    elements: {
      shell: elements.shell,
      host: elements.host,
      backdrop: setup.backdrop ? elements.backdrop : null,
      pushTarget: setup.push ? elements.pushTarget : null,
    },
    from: phase === 'show' ? closed : open({}),
    to: phase === 'show' ? open({}) : closed,
    properties: {
      host: setup.hostSize ? axis(side) : null,
      push: setup.push ? `padding-${side}` : null,
    },
    options: {
      preset: 'slide',
      origin: side,
      distance: '100%',
      scale: 0.9,
      respectReducedMotion: true,
      ...setup.options,
    },
    reducedMotion: false,
    signal: abort,
    started: () => calls.started++,
    progress: () => undefined,
  };
  const snapshot = () =>
    (['shell', 'host', 'pushTarget', 'backdrop'] as const)
      .map((role) => `${role}: ${driver.snapshot(elements[role])}`)
      .join('\n');
  return { ctx, abort, calls, snapshot };
}

function sortTracks(tracks: readonly SplitAnimationTrack[]): SplitAnimationTrack[] {
  return [...tracks]
    .map((t) => ({ element: t.element, property: t.property, from: t.from, to: t.to }))
    .sort((a, b) => `${a.element}|${a.property}`.localeCompare(`${b.element}|${b.property}`));
}

function assertEqual(actual: unknown, expected: unknown, what: string): void {
  const a = JSON.stringify(actual, null, 2);
  const e = JSON.stringify(expected, null, 2);
  if (a !== e) throw new Error(`${what}\nexpected: ${e}\nreceived: ${a}`);
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const isPromise = (value: unknown): value is Promise<void> =>
  typeof (value as Promise<void> | undefined)?.then === 'function';

/** Resolves when the promise settles, or reports that it is still pending. */
async function settled(promise: Promise<void>): Promise<boolean> {
  let done = false;
  void promise.then(() => (done = true));
  for (let i = 0; i < 5; i++) await Promise.resolve();
  return done;
}

const swap = (t: SplitAnimationTrack): SplitAnimationTrack => ({ ...t, from: t.to, to: t.from });

const scenarios: SplitAnimationEngineScenario[] = [];

/** Same tracks on show and, swapped, on hide. `tracks` are those of the show. */
function tracks(
  name: string,
  setup: Setup,
  expected: SplitAnimationTrack[],
  create?: SplitAnimationEngineCreateOptions,
): void {
  for (const phase of ['show', 'hide'] as const) {
    scenarios.push({
      name: `${name} (${phase})`,
      async run(driver) {
        const { ctx } = build(driver, { ...setup, phase });
        const run = driver.start(driver.create(create), ctx);
        const want = phase === 'show' ? expected : expected.map(swap);
        assertEqual(sortTracks(run.tracks), sortTracks(want), 'tracks');
      },
    });
  }
}

/** Timing of the transition on both phases. */
function timing(
  name: string,
  options: Partial<SplitAnimationSettings>,
  expected: (phase: 'show' | 'hide') => SplitAnimationTiming,
  create?: SplitAnimationEngineCreateOptions,
): void {
  for (const phase of ['show', 'hide'] as const) {
    scenarios.push({
      name: `${name} (${phase})`,
      async run(driver) {
        const { ctx } = build(driver, { phase, options: { preset: 'fade', ...options } });
        const run = driver.start(driver.create(create), ctx);
        assertEqual(run.timing, expected(phase), 'timing');
      },
    });
  }
}

const track = (
  element: SplitAnimationRole,
  property: string,
  from: string,
  to: string,
): SplitAnimationTrack => ({ element, property, from, to });

// ------------------------------------------------------------ presets

tracks('slide moves the shell in from its side', {}, [
  track('shell', 'transform', 'translateX(100%)', 'none'),
]);
tracks('slide uses origin and distance (px)', { options: { origin: 'top', distance: 48 } }, [
  track('shell', 'transform', 'translateY(-48px)', 'none'),
]);
tracks(
  'slide uses origin and distance (CSS length)',
  {
    options: { origin: 'left', distance: '2rem' },
  },
  [track('shell', 'transform', 'translateX(-2rem)', 'none')],
);
tracks('fade animates the opacity', { options: { preset: 'fade' } }, [
  track('shell', 'opacity', '0', '1'),
]);
tracks(
  'scale below 1 grows from the center',
  {
    options: { preset: 'scale', scale: 0.8, origin: 'center' },
  },
  [
    track('shell', 'transform', 'scale(0.8)', 'none'),
    track('shell', 'transform-origin', 'center', 'center'),
  ],
);
tracks(
  'scale above 1 shrinks, anchored at the origin',
  {
    options: { preset: 'scale', scale: 1.2, origin: 'bottom' },
  },
  [
    track('shell', 'transform', 'scale(1.2)', 'none'),
    track('shell', 'transform-origin', 'center bottom', 'center bottom'),
  ],
);
tracks('none animates nothing', { options: { preset: 'none' } }, []);

// ------------------------------------------------------------ layouts

tracks(
  'collapse in overlay reveals the shell from its side',
  {
    options: { preset: 'collapse' },
  },
  [track('shell', 'clip-path', 'inset(0px 0px 0px 100%)', 'inset(0px 0px 0px 0px)')],
);
tracks(
  'collapse in inline reveals the shell from its side',
  {
    layout: 'inline',
    side: 'top',
    options: { preset: 'collapse' },
  },
  [track('shell', 'clip-path', 'inset(0px 0px 100% 0px)', 'inset(0px 0px 0px 0px)')],
);
tracks(
  'collapse in the body push reveals the shell with the padding',
  {
    layout: 'push',
    side: 'left',
    push: true,
    options: { preset: 'collapse' },
  },
  [
    track('shell', 'clip-path', 'inset(0px 100% 0px 0px)', 'inset(0px 0px 0px 0px)'),
    track('pushTarget', 'padding-left', '0px', '300px'),
  ],
);
tracks(
  'collapse in a custom push holds the shell while the host grows',
  {
    layout: 'push',
    hostSize: true,
    options: { preset: 'collapse' },
  },
  [
    track('shell', 'transform', 'translateX(-100%)', 'none'),
    track('host', 'width', '0px', '300px'),
  ],
);
tracks(
  'slide in the body push animates the padding too',
  {
    layout: 'push',
    push: true,
  },
  [
    track('shell', 'transform', 'translateX(100%)', 'none'),
    track('pushTarget', 'padding-right', '0px', '300px'),
  ],
);
tracks(
  'slide in a custom push animates the host size too',
  {
    layout: 'push',
    side: 'bottom',
    hostSize: true,
  },
  [
    track('shell', 'transform', 'translateY(100%)', 'none'),
    track('host', 'height', '0px', '300px'),
  ],
);
tracks(
  'fade in the body push leaves the padding alone',
  {
    layout: 'push',
    push: true,
    options: { preset: 'fade' },
  },
  [track('shell', 'opacity', '0', '1')],
);
tracks(
  'scale in a custom push leaves the host size alone',
  {
    layout: 'push',
    hostSize: true,
    options: { preset: 'scale', origin: 'center' },
  },
  [
    track('shell', 'transform', 'scale(0.9)', 'none'),
    track('shell', 'transform-origin', 'center', 'center'),
  ],
);
tracks('the backdrop fades with the panel', { backdrop: true }, [
  track('shell', 'transform', 'translateX(100%)', 'none'),
  track('backdrop', 'opacity', '0', '1'),
]);
tracks(
  'the backdrop does not animate with none',
  {
    backdrop: true,
    options: { preset: 'none' },
  },
  [],
);

// ------------------------------------------------------------ added presets

const pop: SplitAnimationContractPreset = {
  shell: [
    { property: 'opacity', from: '0', to: '1' },
    { property: 'transform', from: 'scale(0.5)', to: 'none' },
  ],
};
const popShell = pop.shell.map((t) => track('shell', t.property, t.from, t.to));
const withPop = { presets: { pop, grow: { ...pop, sizes: true } } };

tracks('an added preset plays its look', { options: { preset: 'pop' } }, popShell, withPop);
tracks(
  'an added preset leaves the page padding alone',
  { layout: 'push', push: true, options: { preset: 'pop' } },
  popShell,
  withPop,
);
tracks(
  'an added preset leaves the host size alone',
  { layout: 'push', hostSize: true, options: { preset: 'pop' } },
  popShell,
  withPop,
);
tracks(
  'an added preset with sizes animates the page padding',
  { layout: 'push', push: true, options: { preset: 'grow' } },
  [...popShell, track('pushTarget', 'padding-right', '0px', '300px')],
  withPop,
);
tracks(
  'an added preset with sizes animates the host size',
  { layout: 'push', hostSize: true, options: { preset: 'grow' } },
  [...popShell, track('host', 'width', '0px', '300px')],
  withPop,
);
tracks(
  'the backdrop fades with an added preset',
  { backdrop: true, options: { preset: 'pop' } },
  [...popShell, track('backdrop', 'opacity', '0', '1')],
  withPop,
);
for (const phase of ['show', 'hide'] as const) {
  scenarios.push({
    name: `an added preset uses the timing of the options (${phase})`,
    async run(driver) {
      const { ctx } = build(driver, {
        phase,
        options: { preset: 'pop', duration: 300, delay: 20, easing: 'linear' },
      });
      const run = driver.start(driver.create(withPop), ctx);
      assertEqual(run.timing, { duration: 300, easing: 'linear', delay: 20 }, 'timing');
    },
  });
  scenarios.push({
    name: `an added preset resolves only when its animations end (${phase})`,
    async run(driver) {
      const { ctx, calls } = build(driver, { phase, options: { preset: 'pop' } });
      const { result } = driver.start(driver.create(withPop), ctx);
      assertEqual(calls.started, 1, 'started() calls');
      assert(isPromise(result), 'animate() should return a promise while it animates');
      assert(!(await settled(result as Promise<void>)), 'the promise resolved before the end');
      driver.finish(ctx);
      assert(await settled(result as Promise<void>), 'the promise did not resolve at the end');
    },
  });
}
scenarios.push({
  name: 'a preset the engine does not know throws, naming it',
  async run(driver) {
    const { ctx } = build(driver, { options: { preset: 'zoom' } });
    let error: unknown = null;
    try {
      driver.start(driver.create(withPop), ctx);
    } catch (e) {
      error = e;
    }
    assert(/zoom/.test(String(error)), `expected an error about 'zoom', got ${String(error)}`);
  },
});

// ------------------------------------------------------------ timing

const css = (easing: SplitEasingInput) => easingToCss(easing);

timing('default timing: 200ms, decelerating on show, accelerating on hide', {}, (phase) => ({
  duration: 200,
  easing: css(phase === 'show' ? SPLIT_DEFAULT_EASING : SPLIT_DEFAULT_HIDE_EASING),
  delay: 0,
}));
timing(
  'duration, delay and a CSS easing string',
  {
    duration: 300,
    delay: 50,
    easing: 'linear',
  },
  () => ({ duration: 300, easing: 'linear', delay: 50 }),
);
timing(
  'cubicBezier() becomes cubic-bezier()',
  {
    easing: cubicBezier([0.3, 0, 0.2, 1]),
  },
  () => ({ duration: 200, easing: 'cubic-bezier(0.3, 0, 0.2, 1)', delay: 0 }),
);
timing('steps() becomes steps()', { easing: steps(5) }, () => ({
  duration: 200,
  easing: 'steps(5, jump-end)',
  delay: 0,
}));
timing('spring() becomes a sampled linear()', { easing: spring({ samples: 3 }) }, () => ({
  duration: 200,
  easing: css(spring({ samples: 3 })),
  delay: 0,
}));
timing(
  'a subclass translates easings of its own type',
  { easing: { type: 'elastic' } },
  () => ({ duration: 200, easing: 'cubic-bezier(0.5, 1.6, 0.4, 0.7)', delay: 0 }),
  {
    translateEasing: (easing) =>
      typeof easing === 'object' && easing.type === 'elastic'
        ? 'cubic-bezier(0.5, 1.6, 0.4, 0.7)'
        : easingToCss(easing),
  },
);
scenarios.push({
  name: 'an easing type the engine does not know throws',
  async run(driver) {
    const { ctx } = build(driver, { options: { preset: 'fade', easing: { type: 'elastic' } } });
    let error: unknown = null;
    try {
      driver.start(driver.create(), ctx);
    } catch (e) {
      error = e;
    }
    assert(
      /elastic/.test(String(error)),
      `expected an error about 'elastic', got ${String(error)}`,
    );
  },
});

// ------------------------------------------------------------ lifecycle

for (const phase of ['show', 'hide'] as const) {
  scenarios.push({
    name: `calls started() once and resolves only when the animations end (${phase})`,
    async run(driver) {
      const { ctx, calls } = build(driver, { phase });
      const { result } = driver.start(driver.create(), ctx);
      assertEqual(calls.started, 1, 'started() calls');
      assert(isPromise(result), 'animate() should return a promise while it animates');
      assert(!(await settled(result as Promise<void>)), 'the promise resolved before the end');
      driver.finish(ctx);
      assert(await settled(result as Promise<void>), 'the promise did not resolve at the end');
    },
  });
  scenarios.push({
    name: `an abort resolves at once (${phase})`,
    async run(driver) {
      const { ctx, abort } = build(driver, { phase });
      const { result } = driver.start(driver.create(), ctx);
      abort.abort();
      assert(
        !isPromise(result) || (await settled(result)),
        'the promise did not resolve after the abort',
      );
    },
  });
  scenarios.push({
    name: `duration 0 ends at once (${phase})`,
    async run(driver) {
      const { ctx, calls } = build(driver, { phase, options: { duration: 0 } });
      const { result } = driver.start(driver.create(), ctx);
      assertEqual(calls.started, 1, 'started() calls');
      assert(result === undefined, 'animate() should end synchronously');
    },
  });
  scenarios.push({
    name: `none ends at once (${phase})`,
    async run(driver) {
      const { ctx, calls } = build(driver, { phase, options: { preset: 'none' } });
      const { result } = driver.start(driver.create(), ctx);
      assertEqual(calls.started, 1, 'started() calls');
      assert(result === undefined, 'animate() should end synchronously');
    },
  });
  for (const end of ['finish', 'abort'] as const) {
    scenarios.push({
      name: `cleanup after ${end === 'finish' ? 'the end' : 'an abort'} leaves the elements as they were (${phase})`,
      async run(driver) {
        for (const setup of [
          { push: true, layout: 'push', backdrop: true },
          { hostSize: true, layout: 'push', options: { preset: 'collapse' } },
          { options: { preset: 'scale' } },
        ] as Setup[]) {
          const { ctx, abort, snapshot } = build(driver, { ...setup, phase });
          const before = snapshot();
          const engine = driver.create();
          const { result } = driver.start(engine, ctx);
          if (end === 'finish') driver.finish(ctx);
          else abort.abort();
          if (isPromise(result)) await result;
          engine.cleanup(ctx);
          assertEqual(snapshot(), before, `elements after cleanup (${JSON.stringify(setup)})`);
        }
      },
    });
  }
}

/** Every scenario of the contract. */
export const splitAnimationEngineScenarios: readonly SplitAnimationEngineScenario[] = scenarios;
