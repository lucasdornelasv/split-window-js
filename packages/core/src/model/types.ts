import type { Observable } from 'rxjs';
import type { SplitWindowRef } from '../controller/split-window-ref.js';

/** One of the four window edges that can hold a body container. */
export type SplitBodySide = 'left' | 'right' | 'top' | 'bottom';

/** Reserved keys of the body containers. */
export type SplitBodyContainerKey = `body-${SplitBodySide}`;

/** All body sides, in a stable order. */
export const SPLIT_BODY_SIDES: readonly SplitBodySide[] = ['left', 'right', 'top', 'bottom'];

/** Returns the reserved container key of a body side. */
export function bodyContainerKey(side: SplitBodySide): SplitBodyContainerKey {
  return `body-${side}`;
}

/** Returns the body side of a reserved key, or `null` for any other key. */
export function bodySideOf(key: string): SplitBodySide | null {
  const side = key.startsWith('body-') ? key.slice(5) : '';
  return (SPLIT_BODY_SIDES as readonly string[]).includes(side) ? (side as SplitBodySide) : null;
}

/** A rectangle in viewport coordinates. `DOMRect` satisfies this shape. */
export interface SplitRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** What closed the tab, passed to `canClose`. */
export type SplitCloseTrigger = 'tab-button' | 'close-all' | 'close' | 'dismiss';

export interface SplitCloseContext {
  ref: SplitWindowRef;
  trigger: SplitCloseTrigger;
  reason?: any;
}

/**
 * Verification called on every close request. `true` closes the tab, `false` keeps it open.
 * For an Observable, the first emitted value counts; completing without a value or erroring keeps the tab open.
 */
export type SplitCloseGuard = (
  ctx: SplitCloseContext,
) => boolean | Promise<boolean> | Observable<boolean>;

/** Veto for moves. `index` is absent while dragging, before the drop. */
export type SplitMoveGuard = (target: { containerKey: string; index?: number }) => boolean;

/** Options of `open()` understood by the core. Adapters extend this with their own options. */
export interface SplitWindowOptions {
  /** Target container. Without a value, the default container is used. */
  containerKey?: string;
  /** Tab title. Without a value, `labels.defaultTitle` of the config ('Nova aba'). */
  title?: string;
  /** Numbering group. Without a value, the default group. */
  groupKey?: string;
  /** Activates the tab after opening. Default: `true`. */
  activate?: boolean;
  /** `false` hides the tab close button and makes "close all" skip the tab. Default: `true`. */
  closable?: boolean;
  /** Verification called on every close request. */
  canClose?: SplitCloseGuard;
  /** Veto for moves to another position or container. */
  canMove?: SplitMoveGuard;
}

/** Context passed to `maxTabs` functions and overflow/reject handlers. */
export interface SplitCapacityContext {
  containerKey: string;
  /** Current tabs, in strip order. */
  tabs: readonly SplitWindowRef[];
  /** Options of the arriving tab. */
  incoming: SplitWindowOptions;
  /** The arriving tab, on moves. */
  incomingRef?: SplitWindowRef;
  source: 'open' | 'move';
}

export type SplitOverflowStrategy =
  'reject' | 'replace-oldest' | 'replace-lru' | 'replace-same-label';

export type SplitOverflowDecision =
  { action: 'reject' } | { action: 'replace'; ref: SplitWindowRef };

export type SplitOverflowHandler = (ctx: SplitCapacityContext) => SplitOverflowDecision;

export type SplitRejectStrategy = 'throw' | 'redirect-default' | 'cancel';

export type SplitRejectDecision =
  { action: 'throw' | 'cancel' } | { action: 'redirect'; containerKey: string };

export type SplitRejectHandler = (ctx: SplitCapacityContext) => SplitRejectDecision;

/** A length: a number in px, or a string in `px`, `vw`, `vh` or `%` (of the reference area). */
export type SplitLength = number | string;

/**
 * Full screen options.
 * @typeParam THost - the host type of the adapter (an `HTMLElement` in Angular).
 */
export interface SplitExpandOptions<THost = unknown> {
  /** Reference area. A string is a CSS selector. Default: `'viewport'`. */
  bounds?: 'viewport' | THost | string | (() => SplitRect);
  maxWidth?: SplitLength;
  maxHeight?: SplitLength;
  /** Free space inside the area, in px. Default: 0. */
  margin?: number;
  /** Position inside the area when the max size is smaller. Default: `'center'`. */
  align?: 'center' | 'start' | 'end';
  /** Esc restores the container. Default: `true`. */
  restoreOnEscape?: boolean;
}

export interface SplitContainerOptions<THost = unknown> {
  /** Fixed limit, or a function that returns `true` when the container is full for the arriving tab. */
  maxTabs?: number | ((ctx: SplitCapacityContext) => boolean);
  /** What to do when full. Default: `'reject'`. */
  onFull?: SplitOverflowStrategy | SplitOverflowHandler;
  /** Destination of a rejected tab. Default: `'throw'`. */
  onReject?: SplitRejectStrategy | SplitRejectHandler;
  /** Closes (hides) the container when it becomes empty, without unregistering. */
  closeWhenEmpty?: boolean;
  /** Name shown in drop zones. Default: the key. */
  label?: string;
  /** Size of the floating drop panel shown while the container is closed. */
  closedDropZone?: { width?: number; height?: number };
  /** Anchor of the floating drop panel when the host was never measured. */
  closedDropZoneAnchor?: THost;
  /** Full screen options. `false` hides the button. Default: the whole window. */
  expand?: SplitExpandOptions<THost> | false;
}

export interface SplitBodyContainerOptions<THost = unknown> extends Omit<
  SplitContainerOptions<THost>,
  'closedDropZoneAnchor'
> {
  /** Width (left/right) or height (top/bottom): '420px', '30vw'. */
  size?: string;
  /** Blocks the page behind the container while it is open. Default: `false`. */
  backdrop?: boolean;
}

export interface SplitBodyContainersConfig<THost = unknown> {
  /** Applies to every enabled side. */
  defaults?: SplitBodyContainerOptions<THost>;
  left?: boolean | SplitBodyContainerOptions<THost>;
  right?: boolean | SplitBodyContainerOptions<THost>;
  top?: boolean | SplitBodyContainerOptions<THost>;
  bottom?: boolean | SplitBodyContainerOptions<THost>;
  /** Makes this side the default container. */
  default?: SplitBodySide;
}

/** Texts used by the library. Translate them through the config. */
export interface SplitWindowLabels {
  defaultTitle: string;
  emptyContainer: string;
  closeTab: string;
  closeAll: string;
  expand: string;
  restore: string;
  tabList: string;
}

/** Default values of the library. */
export interface SplitWindowConfig {
  /** Default of `activate` in `open()`. */
  activate: boolean;
  /** Default of `closable` in `open()`. */
  closable: boolean;
  /** Default size of the floating drop panel. */
  closedDropZone: { width: number; height: number };
  /** Default size of body containers. */
  bodySize: string;
  labels: SplitWindowLabels;
}

export type SplitWindowConfigInput = Partial<
  Omit<SplitWindowConfig, 'labels' | 'closedDropZone'>
> & {
  labels?: Partial<SplitWindowLabels>;
  closedDropZone?: Partial<SplitWindowConfig['closedDropZone']>;
};

export const DEFAULT_SPLIT_WINDOW_CONFIG: Readonly<SplitWindowConfig> = Object.freeze({
  activate: true,
  closable: true,
  closedDropZone: { width: 220, height: 120 },
  bodySize: '420px',
  labels: {
    defaultTitle: 'Nova aba',
    emptyContainer: 'Nenhuma aba aberta',
    closeTab: 'Fechar aba',
    closeAll: 'Fechar todas as abas',
    expand: 'Tela cheia',
    restore: 'Restaurar tamanho',
    tabList: 'Abas',
  },
});

/** Merges a partial config over the defaults. */
export function mergeSplitWindowConfig(input?: SplitWindowConfigInput): SplitWindowConfig {
  return {
    ...DEFAULT_SPLIT_WINDOW_CONFIG,
    ...input,
    closedDropZone: { ...DEFAULT_SPLIT_WINDOW_CONFIG.closedDropZone, ...input?.closedDropZone },
    labels: { ...DEFAULT_SPLIT_WINDOW_CONFIG.labels, ...input?.labels },
  };
}

/** Snapshot of a tab passed to the engine. */
export interface TabState {
  readonly id: string;
  readonly title: string;
  readonly label: string;
  readonly groupKey: string | null;
  readonly ordinal: number;
  readonly closable: boolean;
  readonly containerKey: string;
}

/** State of a container, as seen by the engine. */
export interface ContainerState<THost = unknown> {
  readonly key: string;
  readonly kind: 'custom' | 'body';
  readonly side: SplitBodySide | null;
  /** The host. `null` on body containers: the engine creates it in `mountContainer`. */
  readonly host: THost | null;
  readonly options: Readonly<SplitBodyContainerOptions<THost> & SplitContainerOptions<THost>>;
  readonly label: string;
  readonly open: boolean;
  readonly expanded: boolean;
  readonly mounted: boolean;
}

/** A tab as shown in the strip. */
export interface SplitTabView {
  readonly id: string;
  readonly title: string;
  readonly label: string;
  readonly closable: boolean;
  readonly active: boolean;
  readonly ref: SplitWindowRef;
}

/** Immutable snapshot of a container, for rendering. */
export interface SplitContainerView<THost = unknown> {
  readonly key: string;
  readonly container: ContainerState<THost>;
  readonly tabs: readonly SplitTabView[];
  readonly activeId: string | null;
  /** A "close all" is running on this container. */
  readonly closingAll: boolean;
  /** The full screen button is available. */
  readonly canExpand: boolean;
  /** A drag is running anywhere. */
  readonly dragging: boolean;
}

export interface SplitTabMovedEvent {
  ref: SplitWindowRef;
  type: 'reordered' | 'containerChanged';
  fromKey: string;
  toKey: string;
  fromIndex: number;
  toIndex: number;
  label: string;
}

export interface SplitTabRejectedEvent {
  context: SplitCapacityContext;
  /** Resolution applied: the `onReject` result on opens, `'move-refused'` on moves. */
  resolution: 'throw' | 'cancel' | 'redirect' | 'move-refused';
  redirectTo?: string;
}

export interface SplitContainerStateChange {
  key: string;
  open: boolean;
  expanded: boolean;
}

export interface SplitCloseAllResult {
  closed: SplitWindowRef[];
  /** Refused by `canClose` or with `closable: false`. */
  kept: SplitWindowRef[];
}

export interface SplitDismissAllOptions {
  containerKey?: string;
  reason?: any;
  force?: boolean;
}
