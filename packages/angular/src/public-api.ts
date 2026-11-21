/*
 * Public API of @split-window/angular. Re-exports the core types an Angular app needs, so it
 * imports only from this package.
 */
export { provideSplitWindows } from './lib/provide-split-windows';
export { SplitWindowManager } from './lib/manager/split-window-manager';
export { SplitContainerRegistry } from './lib/registry/split-container-registry';
export { SplitActiveWindow } from './lib/active-window/split-active-window';
export { SplitContainerDirective } from './lib/directive/split-container.directive';
export { SplitContainerComponent } from './lib/shell/split-container.component';
export { SplitTabStripComponent } from './lib/shell/split-tab-strip.component';
export { AngularSplitEngine, moveNode } from './lib/engine/angular-split-engine';
export { SPLIT_WINDOW_CONFIG } from './lib/tokens';
export type {
  SplitContent,
  SplitTemplateContext,
  SplitWindowOptions,
  SplitContainerOptions,
  SplitBodyContainerOptions,
  SplitBodyContainersConfig,
  SplitExpandOptions,
} from './lib/types';

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
} from '@split-window/core';
export type {
  SplitBodySide,
  SplitCapacityContext,
  SplitCloseAllResult,
  SplitCloseContext,
  SplitCloseGuard,
  SplitCloseTrigger,
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
