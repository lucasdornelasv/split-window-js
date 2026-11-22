export * from './model/types.js';
export {
  validateContainerKey,
  validateContainerOptions,
  validateExpandOptions,
  validateLength,
  validateWindowOptions,
} from './model/validation.js';
export * from './errors/errors.js';
export { TabGroupResolver, nextOrdinal, formatTabLabel } from './numbering/tab-group-resolver.js';
export { SplitContainerStack } from './stack/split-container-stack.js';
export { SplitContainerRegistry, ContainerRecord } from './registry/split-container-registry.js';
export { SplitWindowRef } from './controller/split-window-ref.js';
export {
  SplitWindowController,
  evaluateGuard,
  type SplitMoveSource,
  type SplitDropTarget,
} from './controller/split-window-controller.js';
export { isFull, pickReplacement, resolveReject } from './policies/capacity.js';
export type { SplitWindowEngine, TabHandle } from './engine/split-window-engine.js';
export {
  BaseSplitWindowEngine,
  type SplitContainerTransitionEvent,
  type SplitTransitionPlan,
} from './engine/base-split-window-engine.js';
export * from './animation/animation-engine.js';
export * from './animation/easing.js';
export * from './geometry/geometry.js';
export * from './utils/index.js';
