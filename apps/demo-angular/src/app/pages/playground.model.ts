import {
  SPLIT_EASINGS,
  cubicBezier,
  spring,
  type SplitBodyContainerOptions,
  type SplitBodyContainersConfig,
  type SplitBodySide,
  type SplitContainerOptions,
  type SplitOverflowStrategy,
  type SplitRejectStrategy,
  type SplitWindowOptions,
} from '@split-window/angular';

/** Containers of the playground: three of the page and the four body sides. */
export const CUSTOM_KEYS = ['esquerdo', 'direito', 'inferior'] as const;
export const BODY_KEYS = ['body-left', 'body-right', 'body-top', 'body-bottom'] as const;
export const CONTAINER_KEYS = [...CUSTOM_KEYS, ...BODY_KEYS] as const;

export type CustomKey = (typeof CUSTOM_KEYS)[number];
export type BodyKey = (typeof BODY_KEYS)[number];
export type ContainerKey = (typeof CONTAINER_KEYS)[number];

export const ON_FULL: SplitOverflowStrategy[] = [
  'reject',
  'replace-oldest',
  'replace-lru',
  'replace-same-label',
];
export const ON_REJECT: SplitRejectStrategy[] = ['throw', 'redirect-default', 'cancel'];
export const MODES = ['', 'inline', 'push', 'overlay', 'drawer'] as const;
export const ENGINES = ['', 'css', 'keyframes', 'none'] as const;
export const PRESETS = ['', 'slide', 'fade', 'scale', 'collapse', 'none'] as const;
export const SIDES: SplitBodySide[] = ['left', 'right', 'top', 'bottom'];
export const PHASES = ['show', 'hide'] as const;
export const ORIGINS = ['', 'left', 'right', 'top', 'bottom', 'center'] as const;
/** `''`: the default of the phase; `cubic`: `cubicBezier()` with the points typed. */
export const EASINGS = [
  '',
  'linear',
  'ease',
  'easeIn',
  'easeOut',
  'easeInOut',
  'decelerate',
  'accelerate',
  'spring',
  'spring-bouncy',
  'cubic',
] as const;

export type Phase = (typeof PHASES)[number];
type NamedEasing = Exclude<(typeof EASINGS)[number], '' | 'spring' | 'spring-bouncy' | 'cubic'>;

/** Animation options of one phase. Empty strings and `null` mean "library default". */
export interface PhaseConfig {
  preset: (typeof PRESETS)[number];
  duration: number | null;
  delay: number | null;
  easing: (typeof EASINGS)[number];
  /** Points of `cubicBezier()`, as typed: `0.2, 0, 0, 1`. */
  cubic: string;
  origin: (typeof ORIGINS)[number];
  /** Digits (px) or a CSS length. */
  distance: string;
  scale: number | null;
}

/** Editable options of one container. Empty strings and `null` mean "library default". */
export interface ContainerConfig {
  enabled: boolean;
  label: string;
  maxTabs: number | null;
  onFull: SplitOverflowStrategy;
  onReject: SplitRejectStrategy;
  closeWhenEmpty: boolean;
  mode: (typeof MODES)[number];
  /** Custom containers only (body containers take it from the key). */
  side: SplitBodySide;
  size: string;
  animation: boolean;
  engine: (typeof ENGINES)[number];
  /** Opening. Options equal in both phases go to the top of `animation`. */
  show: PhaseConfig;
  /** Closing. */
  hide: PhaseConfig;
  panelClass: string;
  /** Body containers only. */
  backdrop: boolean;
  expand: boolean;
  expandMaxWidth: string;
  expandMargin: number;
  expandAlign: 'center' | 'start' | 'end';
  dropZoneWidth: number | null;
  dropZoneHeight: number | null;
}

/** Options of the next `open()`. */
export interface OpenConfig {
  /** Empty: no `containerKey`, so the default container. */
  target: '' | ContainerKey;
  title: string;
  groupKey: string;
  text: string;
  activate: boolean;
  closable: boolean;
  confirmClose: boolean;
  lockToContainer: boolean;
}

export interface PlaygroundState {
  containers: Record<ContainerKey, ContainerConfig>;
  /** Empty: automatic default (the first configured container). */
  defaultKey: '' | ContainerKey;
  open: OpenConfig;
}

export const isBody = (key: ContainerKey): key is BodyKey => key.startsWith('body-');
export const bodySide = (key: BodyKey): SplitBodySide => key.slice(5) as SplitBodySide;

/** Default of `closeWhenEmpty` in the library: `true` on the body, `false` elsewhere. */
const closeWhenEmptyDefault = (key: ContainerKey) => isBody(key);

export function emptyPhase(): PhaseConfig {
  return {
    preset: '',
    duration: null,
    delay: null,
    easing: '',
    cubic: '0.2, 0, 0, 1',
    origin: '',
    distance: '',
    scale: null,
  };
}

function container(key: ContainerKey, change: Partial<ContainerConfig> = {}): ContainerConfig {
  return {
    enabled: false,
    label: '',
    maxTabs: null,
    onFull: 'reject',
    onReject: 'throw',
    closeWhenEmpty: closeWhenEmptyDefault(key),
    mode: '',
    side: 'right',
    size: '',
    animation: false,
    engine: '',
    show: emptyPhase(),
    hide: emptyPhase(),
    panelClass: '',
    backdrop: false,
    expand: true,
    expandMaxWidth: '',
    expandMargin: 0,
    expandAlign: 'center',
    dropZoneWidth: null,
    dropZoneHeight: null,
    ...change,
  };
}

export function initialState(): PlaygroundState {
  return {
    containers: {
      esquerdo: container('esquerdo', { enabled: true, side: 'left', label: 'Esquerdo' }),
      direito: container('direito', { side: 'right', mode: 'push', size: '280px' }),
      inferior: container('inferior', { side: 'bottom', mode: 'overlay', size: '160px' }),
      'body-left': container('body-left'),
      'body-right': container('body-right', { enabled: true }),
      'body-top': container('body-top'),
      'body-bottom': container('body-bottom'),
    },
    defaultKey: '',
    open: {
      target: '',
      title: '',
      groupKey: '',
      text: '',
      activate: true,
      closable: true,
      confirmClose: false,
      lockToContainer: false,
    },
  };
}

/** A piece of code printed as it is by `literal()` (calls like `spring()`). */
export class Code {
  constructor(readonly text: string) {}
}

/** Easing of a phase: the easing object, or the code that builds it. */
function easingOf(p: PhaseConfig, asCode: boolean): unknown {
  switch (p.easing) {
    case '':
      return undefined;
    case 'spring':
      return asCode ? new Code('spring()') : spring();
    case 'spring-bouncy':
      return asCode
        ? new Code('spring({ stiffness: 200, damping: 12 })')
        : spring({ stiffness: 200, damping: 12 });
    case 'cubic': {
      if (asCode) return new Code(`cubicBezier([${p.cubic}])`);
      const points = p.cubic.split(',').map((n) => Number(n.trim()));
      const ok =
        points.length === 4 &&
        points.every(Number.isFinite) &&
        [points[0], points[2]].every((x) => x >= 0 && x <= 1);
      // An invalid easing (empty type): the library reports it as SplitInvalidOptionError.
      return ok ? cubicBezier(points as [number, number, number, number]) : { type: '' };
    }
    default:
      return asCode
        ? new Code(`SPLIT_EASINGS.${p.easing}`)
        : SPLIT_EASINGS[p.easing satisfies NamedEasing];
  }
}

/** Options of one phase, without the library defaults. */
function phaseOptions(p: PhaseConfig, asCode: boolean): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  if (p.preset) o['preset'] = p.preset;
  if (p.duration !== null) o['duration'] = p.duration;
  if (p.delay) o['delay'] = p.delay;
  const easing = easingOf(p, asCode);
  if (easing !== undefined) o['easing'] = easing;
  if (p.origin) o['origin'] = p.origin;
  const distance = p.distance.trim();
  if (distance) o['distance'] = /^\d+(\.\d+)?$/.test(distance) ? Number(distance) : distance;
  if (p.scale !== null) o['scale'] = p.scale;
  return o;
}

/**
 * `animation` of a container: options equal in both phases at the top, the rest in
 * `show`/`hide` (a preset alone as a string). `true` when nothing differs from the defaults.
 */
function animationOptions(c: ContainerConfig, asCode: boolean): unknown {
  const show = phaseOptions(c.show, asCode);
  const hide = phaseOptions(c.hide, asCode);
  const animation: Record<string, unknown> = {};
  if (c.engine) animation['engine'] = c.engine;
  for (const key of Object.keys(show)) {
    if (key in hide && JSON.stringify(show[key]) === JSON.stringify(hide[key])) {
      animation[key] = show[key];
      delete show[key];
      delete hide[key];
    }
  }
  const phase = (p: Record<string, unknown>) =>
    Object.keys(p).length === 1 && p['preset'] ? p['preset'] : p;
  if (Object.keys(show).length) animation['show'] = phase(show);
  if (Object.keys(hide).length) animation['hide'] = phase(hide);
  return Object.keys(animation).length ? animation : true;
}

/**
 * Options of one container, with only what differs from the library defaults. With
 * `asCode`, easings are `Code` (for `playgroundCode`).
 */
export function containerOptions(
  key: ContainerKey,
  c: ContainerConfig,
  asCode = false,
): SplitContainerOptions & SplitBodyContainerOptions {
  const o: SplitContainerOptions & SplitBodyContainerOptions = {};
  if (c.label) o.label = c.label;
  if (c.mode) o.mode = c.mode;
  if (!isBody(key) && c.side !== 'right') o.side = c.side;
  if (c.size) o.size = c.size;
  if (c.maxTabs) o.maxTabs = c.maxTabs;
  if (c.onFull !== 'reject') o.onFull = c.onFull;
  if (c.onReject !== 'throw') o.onReject = c.onReject;
  if (c.closeWhenEmpty !== closeWhenEmptyDefault(key)) o.closeWhenEmpty = c.closeWhenEmpty;
  if (c.animation) o.animation = animationOptions(c, asCode) as SplitContainerOptions['animation'];
  if (c.panelClass) o.panelClass = c.panelClass;
  if (isBody(key) && c.backdrop) o.backdrop = true;
  if (!c.expand) o.expand = false;
  else if (c.expandMaxWidth || c.expandMargin || c.expandAlign !== 'center') {
    o.expand = {
      ...(c.expandMaxWidth
        ? { maxWidth: /^\d+$/.test(c.expandMaxWidth) ? Number(c.expandMaxWidth) : c.expandMaxWidth }
        : {}),
      ...(c.expandMargin ? { margin: c.expandMargin } : {}),
      ...(c.expandAlign !== 'center' ? { align: c.expandAlign } : {}),
    };
  }
  if (c.dropZoneWidth || c.dropZoneHeight) {
    o.closedDropZone = {
      ...(c.dropZoneWidth ? { width: c.dropZoneWidth } : {}),
      ...(c.dropZoneHeight ? { height: c.dropZoneHeight } : {}),
    };
  }
  return o;
}

/** Argument of `useBodyContainers()`: the enabled sides (`true` when without options). */
export function bodyConfig(s: PlaygroundState, asCode = false): SplitBodyContainersConfig {
  const config: SplitBodyContainersConfig = {};
  for (const key of BODY_KEYS) {
    const c = s.containers[key];
    if (!c.enabled) continue;
    const options = containerOptions(key, c, asCode);
    config[bodySide(key)] = Object.keys(options).length ? options : true;
  }
  return config;
}

/** Options of the next `open()`, without the functions. */
export function openOptions(s: PlaygroundState): SplitWindowOptions {
  const o = s.open;
  const options: SplitWindowOptions = {};
  if (o.target) options.containerKey = o.target;
  if (o.title) options.title = o.title;
  if (o.groupKey) options.groupKey = o.groupKey;
  if (!o.activate) options.activate = false;
  if (!o.closable) options.closable = false;
  if (o.text) options.inputs = { text: o.text };
  return options;
}

/** A value as TypeScript code in the Prettier style of the repository (trailing commas). */
export function literal(value: unknown, indent = ''): string {
  const code: string[] = [];
  const json =
    JSON.stringify(
      value,
      (_key, v: unknown) => (v instanceof Code ? `@@code${code.push(v.text) - 1}@@` : v),
      2,
    ) ?? 'undefined';
  return json
    .replace(/"([a-zA-Z_$][\w$]*)":/g, '$1:')
    .replace(/"/g, "'")
    .replace(/([^{[,\s])(?=\n\s*[}\]])/g, '$1,')
    .replace(/'@@code(\d+)@@'/g, (_m, i: string) => code[Number(i)])
    .replace(/\n/g, `\n${indent}`);
}

const hostName = (key: CustomKey) => `host${key[0].toUpperCase()}${key.slice(1)}`;

/** Code equivalent to the playground state, ready to copy. */
export function playgroundCode(s: PlaygroundState): string {
  const lines: string[] = [
    '// app.config.ts of the demo (global options are set at startup)',
    'provideSplitWindows({',
    '  bodyContainers: true,',
    '  animationEngines: {',
    '    css: new SplitCssAnimationEngine(),',
    '    keyframes: new SplitKeyframesAnimationEngine(),',
    '  },',
    "  modes: { drawer: { extends: 'overlay', size: '300px', panelClass: 'demo-drawer' } },",
    '});',
    '',
    '// body containers (sides not given are disabled)',
    `registry.useBodyContainers(${literal(bodyConfig(s, true))});`,
  ];
  const customs = CUSTOM_KEYS.filter((key) => s.containers[key].enabled);
  if (customs.length) lines.push('', '// containers of the page');
  for (const key of customs) {
    const options = containerOptions(key, s.containers[key], true);
    const args = Object.keys(options).length ? `, ${literal(options)}` : '';
    lines.push(`registry.registerContainer('${key}', ${hostName(key)}${args});`);
  }
  lines.push(
    '',
    s.defaultKey
      ? `registry.setDefaultContainer('${s.defaultKey}');`
      : '// no explicit default: the first configured container is the default',
  );
  const entries = Object.entries(openOptions(s)).map(
    ([key, value]) => `${key}: ${literal(value, '  ')}`,
  );
  if (s.open.confirmClose) entries.push(`canClose: () => confirm('Fechar esta aba?')`);
  if (s.open.lockToContainer) {
    entries.push('canMove: (target) => target.containerKey === ref.containerKey');
  }
  lines.push(
    '',
    entries.length
      ? `const ref = manager.open(NoteTabComponent, {\n  ${entries.join(',\n  ')},\n});`
      : 'const ref = manager.open(NoteTabComponent);',
  );
  const code = lines.join('\n');
  // Easing helpers used by the code.
  const helpers = [
    ['SPLIT_EASINGS', /SPLIT_EASINGS\./],
    ['cubicBezier', /cubicBezier\(/],
    ['spring', /spring\(/],
  ]
    .filter(([, pattern]) => (pattern as RegExp).test(code))
    .map(([name]) => name);
  return helpers.length
    ? `import { ${helpers.join(', ')} } from '@split-window/angular';\n\n${code}`
    : code;
}
