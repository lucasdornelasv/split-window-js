import { InjectionToken } from '@angular/core';
import { mergeSplitWindowConfig, type SplitWindowConfig } from '@split-window/core';

/** Default values of SplitWindow, set through `provideSplitWindows(config)`. */
export const SPLIT_WINDOW_CONFIG = new InjectionToken<SplitWindowConfig>('SPLIT_WINDOW_CONFIG', {
  factory: () => mergeSplitWindowConfig(),
});
