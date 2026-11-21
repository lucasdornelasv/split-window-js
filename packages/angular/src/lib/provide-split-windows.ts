import { makeEnvironmentProviders, type EnvironmentProviders } from '@angular/core';
import { mergeSplitWindowConfig, type SplitWindowConfigInput } from '@split-window/core';
import { AngularSplitEngine } from './engine/angular-split-engine';
import { SplitWindowManager } from './manager/split-window-manager';
import { SplitContainerRegistry } from './registry/split-container-registry';
import { SplitWindowRuntime } from './runtime';
import { SPLIT_WINDOW_CONFIG } from './tokens';

/**
 * Registers SplitWindow. The services are created the first time something injects them, so
 * an app can inject only the registry in a `provideAppInitializer` without the manager.
 *
 * ```ts
 * providers: [provideSplitWindows({ labels: { defaultTitle: 'New tab' } })]
 * ```
 */
export function provideSplitWindows(config?: SplitWindowConfigInput): EnvironmentProviders {
  return makeEnvironmentProviders([
    SplitContainerRegistry,
    AngularSplitEngine,
    SplitWindowRuntime,
    SplitWindowManager,
    { provide: SPLIT_WINDOW_CONFIG, useValue: mergeSplitWindowConfig(config) },
  ]);
}
