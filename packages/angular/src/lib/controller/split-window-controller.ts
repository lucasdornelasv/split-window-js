import { Injectable, inject, type OnDestroy } from '@angular/core';
import { SplitWindowController as CoreSplitWindowController } from '@split-window/core';
import { AngularSplitEngine } from '../engine/angular-split-engine';
import { SplitContainerRegistry } from '../registry/split-container-registry';
import { SPLIT_WINDOW_CONFIG } from '../tokens';
import type { SplitAngularTabOptions, SplitContent } from '../types';

/**
 * The core controller as an Angular service: opening, rules, numbering, limits, closing,
 * moving and the state of the containers (open, expanded). It connects itself to the
 * engine. Replace it with a subclass through `provideSplitWindows({ controller })`.
 *
 * Registered only by `provideSplitWindows()`.
 */
@Injectable()
export class SplitWindowController
  extends CoreSplitWindowController<SplitContent, HTMLElement, SplitAngularTabOptions>
  implements OnDestroy
{
  constructor() {
    super(inject(SplitContainerRegistry), inject(AngularSplitEngine), inject(SPLIT_WINDOW_CONFIG));
  }

  /** The engine, typed as the Angular engine (or the subclass provided in its place). */
  declare readonly engine: AngularSplitEngine;

  ngOnDestroy(): void {
    this.destroy();
  }
}
