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
export { splitAnimationEngineRegistryFactory } from './lib/animation/split-animation-engine-registry';
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
  SPLIT_BODY_CONTAINERS,
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
  SplitContainerBehaviorDefaults,
  SplitLabelsInput,
  SplitBodyContainerDefaults,
  SplitWindowAngularConfig,
} from './lib/types';

// Modes
export {
  SplitContainerMode,
  InlineSplitContainerMode,
  PushSplitContainerMode,
  OverlaySplitContainerMode,
  DefinedSplitContainerMode,
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
  FunctionSplitAnimationEngine,
  SplitAnimationEngineRegistry,
  SPLIT_DEFAULT_EASING,
  SPLIT_DEFAULT_HIDE_EASING,
  SPLIT_DEFAULT_ANIMATION_SCALE,
  SPLIT_DEFAULT_ANIMATION_DISTANCE,
  SPLIT_ANIMATION_PRESETS,
  defaultEasing,
  resolveAnimation,
  normalizeAnimationPhase,
  validateAnimation,
  slideTransform,
  scaleTransformOrigin,
  presetAnimatesSizes,
  collapseReveal,
  SPLIT_NOOP_ANIMATION_ENGINE,
  // Easings: descriptions that each animation engine translates.
  SPLIT_EASINGS,
  cubicBezier,
  linear,
  steps,
  spring,
  customEasing,
  easingToCss,
  toEasingFunction,
  isEasing,
} from '@split-window/core';
export type {
  SplitAnimationFrame,
  SplitAnimationOrigin,
  SplitAnimationPhaseInput,
  SplitAnimationPhaseOptions,
  SplitAnimationPhases,
  SplitAnimationPreset,
  SplitAnimationProperties,
  SplitAnimationSettings,
  SplitCollapseReveal,
  SplitCubicBezierEasing,
  SplitCustomEasing,
  SplitEasing,
  SplitEasingInput,
  SplitFunctionEasing,
  SplitLinearEasing,
  SplitLinearStop,
  SplitSpringEasing,
  SplitSpringOptions,
  SplitStepPosition,
  SplitStepsEasing,
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
