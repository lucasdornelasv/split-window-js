import { makeEnvironmentProviders, type EnvironmentProviders, type Provider } from '@angular/core';
import {
  SplitAnimationEngineRegistry,
  SplitInvalidOptionError,
  mergeSplitWindowConfig,
  type SplitWindowLabels,
} from '@split-window/core';
import { splitAnimationEngineRegistryFactory } from './animation/split-animation-engine-registry';
import { SplitWindowController } from './controller/split-window-controller';
import { AngularSplitEngine } from './engine/angular-split-engine';
import { SplitWindowManager } from './manager/split-window-manager';
import type { SplitModeInput } from './modes/container-mode';
import { SplitModeResolver } from './modes/mode-resolver';
import { SplitContainerRegistry } from './registry/split-container-registry';
import {
  SPLIT_ANIMATION_ENGINES,
  SPLIT_BODY_CONTAINERS,
  SPLIT_CONTAINER_DEFAULTS,
  SPLIT_WINDOW_CONFIG,
  SPLIT_WINDOW_MODES,
  type SplitAnimationEngineEntry,
} from './tokens';
import type { SplitWindowAngularConfig } from './types';

/**
 * Registers SplitWindow. Every piece is a provider, so it can be replaced with a subclass:
 * the engine (`engine`), the controller (`controller`), or any of them with your own
 * provider for the same class. The services are created the first time something injects
 * them, so an app can inject only the registry in a `provideAppInitializer`.
 *
 * ```ts
 * providers: [
 *   provideSplitWindows({
 *     labels: { defaultTitle: 'New tab' }, // or () => inject(MyTranslations).splitLabels
 *     bodyContainers: true, // body-right enabled, as the default
 *     animationEngines: { css: new CssSplitAnimationEngine() },
 *     modes: { drawer: { extends: 'overlay', panelClass: 'drawer', animation: 'slide' } },
 *     containerDefaults: { animation: true },
 *   }),
 * ]
 * ```
 */
export function provideSplitWindows(config?: SplitWindowAngularConfig): EnvironmentProviders {
  const {
    modes,
    containerDefaults,
    animationEngines,
    engine,
    controller,
    labels,
    bodyContainers,
    ...core
  } = config ?? {};
  const providers: Provider[] = [
    SplitContainerRegistry,
    SplitModeResolver,
    { provide: SplitAnimationEngineRegistry, useFactory: splitAnimationEngineRegistryFactory },
    engine ? { provide: AngularSplitEngine, useClass: engine } : AngularSplitEngine,
    controller ? { provide: SplitWindowController, useClass: controller } : SplitWindowController,
    SplitWindowManager,
    typeof labels === 'function'
      ? // Runs in the injection context of the environment injector, on first injection.
        {
          provide: SPLIT_WINDOW_CONFIG,
          useFactory: () => mergeSplitWindowConfig({ ...core, labels: resolveLabels(labels) }),
        }
      : { provide: SPLIT_WINDOW_CONFIG, useValue: mergeSplitWindowConfig({ ...core, labels }) },
    { provide: SPLIT_CONTAINER_DEFAULTS, useValue: containerDefaults ?? {} },
    { provide: SPLIT_BODY_CONTAINERS, useValue: bodyContainers ?? false },
  ];
  if (modes) providers.push({ provide: SPLIT_WINDOW_MODES, useValue: modes, multi: true });
  if (animationEngines) {
    providers.push({ provide: SPLIT_ANIMATION_ENGINES, useValue: animationEngines, multi: true });
  }
  return makeEnvironmentProviders(providers);
}

/** Runs a labels factory and checks that it returned an object. */
function resolveLabels(factory: () => Partial<SplitWindowLabels>): Partial<SplitWindowLabels> {
  const labels = factory();
  if (labels === null || typeof labels !== 'object') {
    throw new SplitInvalidOptionError('labels', labels, 'objeto com os textos');
  }
  return labels;
}

/**
 * Registers named modes, for libraries or feature areas. Must be in the same environment
 * injector as `provideSplitWindows()`.
 */
export function provideSplitModes(modes: Record<string, SplitModeInput>): EnvironmentProviders {
  return makeEnvironmentProviders([{ provide: SPLIT_WINDOW_MODES, useValue: modes, multi: true }]);
}

/**
 * Registers named animation engines (engines, or factories run in an injection context),
 * after the ones of `provideSplitWindows()`. Must be in the same environment injector. To
 * register at run time, inject `SplitAnimationEngineRegistry` and call `register()`.
 *
 * ```ts
 * provideSplitAnimationEngines({
 *   css: () => new CssSplitAnimationEngine({ injectStyles: inject(MY_FLAG) }),
 *   pop: new KeyframesSplitAnimationEngine().addPreset('pop', {
 *     show: [{ transform: 'scale(.9)' }, { transform: 'none' }],
 *   }),
 * })
 * ```
 */
export function provideSplitAnimationEngines(
  engines: Record<string, SplitAnimationEngineEntry>,
): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: SPLIT_ANIMATION_ENGINES, useValue: engines, multi: true },
  ]);
}
