/*
 * Public API of @split-window/angular. Re-exports the core types an Angular app needs, so it
 * imports only from this package (plus the animation engine packages it chooses).
 */
export {
  provideSplitWindows,
  provideSplitModes,
  provideSplitAnimationEngines,
} from './lib/provide-split-windows';
export { SplitWindowManager } from './lib/manager/split-window-manager';
export { SplitWindowController } from './lib/controller/split-window-controller';
export { SplitAnimationEngineRegistry } from './lib/animation/split-animation-engine-registry';
export { SplitContainerRegistry } from './lib/registry/split-container-registry';
export { SplitActiveWindow } from './lib/active-window/split-active-window';
export { SplitContainerDirective } from './lib/directive/split-container.directive';
export { SplitContainerComponent } from './lib/shell/split-container.component';
export { SplitTabStripComponent } from './lib/shell/split-tab-strip.component';
export {
  AngularSplitEngine,
  moveNode,
  type AngularTabHandle,
  type SplitContainerDisplay,
  type SplitDropListData,
  type SplitShellEntry,
} from './lib/engine/angular-split-engine';
export { rendererDomWriter } from './lib/engine/renderer-dom-writer';
export {
  SPLIT_WINDOW_CONFIG,
  SPLIT_WINDOW_MODES,
  SPLIT_CONTAINER_DEFAULTS,
  SPLIT_ANIMATION_ENGINES,
  type SplitAnimationEngineEntry,
} from './lib/tokens';
export type {
  SplitContent,
  SplitTemplateContext,
  SplitWindowOptions,
  SplitContainerOptions,
  SplitContainerDisplayOptions,
  SplitBodyContainerOptions,
  SplitBodyContainersConfig,
  SplitExpandOptions,
  SplitContainerDefaults,
  SplitContainerDefaultsConfig,
  SplitWindowAngularConfig,
} from './lib/types';

// Modes
export {
  SplitContainerMode,
  SplitInlineMode,
  SplitPushMode,
  SplitOverlayMode,
  SplitDefinedMode,
  offsetRect,
  axisOf,
} from './lib/modes/container-mode';
export type {
  SplitClassInput,
  SplitModeSettings,
  SplitModeContext,
  SplitModeResolveContext,
  SplitModeHooks,
  SplitModeDefinition,
  SplitModeFn,
  SplitModeInput,
} from './lib/modes/container-mode';
export type { SplitResolvedMode } from './lib/modes/mode-resolver';

// Animation: the contract lives in the core; these types are bound to HTMLElement.
export type {
  SplitAnimationContext,
  SplitAnimationEngineInput,
  SplitAnimationFn,
  SplitAnimationInput,
  SplitAnimationOptions,
  SplitContainerElements,
} from './lib/animation/animation-engine';
export {
  SplitAnimationEngine,
  NoopSplitAnimationEngine,
  SplitFunctionAnimationEngine,
  SPLIT_DEFAULT_EASING,
  SPLIT_NOOP_ANIMATION_ENGINE,
} from '@split-window/core';
export type {
  SplitAnimationFrame,
  SplitAnimationPreset,
  SplitAnimationProperties,
  SplitAnimationSettings,
  SplitContainerTransitionEvent,
} from '@split-window/core';

// Shared helpers of the core
export { SplitStyleStash, DIRECT_DOM_WRITER, toClassList } from '@split-window/core';
export type { SplitDomWriter } from '@split-window/core';

export {
  SplitWindowRef,
  SplitWindowError,
  SplitContainerNotFoundError,
  SplitNoDefaultContainerError,
  SplitContainerFullError,
  SplitReservedContainerKeyError,
  SplitDuplicateContainerError,
  SplitInvalidOptionError,
  DEFAULT_SPLIT_WINDOW_CONFIG,
  SPLIT_CONTAINER_LAYOUTS,
} from '@split-window/core';
export type {
  ContainerState,
  SplitBodySide,
  SplitCapacityContext,
  SplitCloseAllResult,
  SplitCloseContext,
  SplitCloseGuard,
  SplitCloseTrigger,
  SplitContainerLayout,
  SplitContainerStateChange,
  SplitDismissAllOptions,
  SplitMoveGuard,
  SplitOverflowDecision,
  SplitOverflowHandler,
  SplitOverflowStrategy,
  SplitRect,
  SplitRejectDecision,
  SplitRejectHandler,
  SplitRejectStrategy,
  SplitTabMovedEvent,
  SplitTabRejectedEvent,
  SplitWindowConfig,
  SplitWindowConfigInput,
  SplitWindowLabels,
} from '@split-window/core';
