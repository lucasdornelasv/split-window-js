import { Injectable, inject, type OnDestroy } from '@angular/core';
import { SplitWindowController } from '@split-window/core';
import { AngularSplitEngine } from './engine/angular-split-engine';
import { SplitContainerRegistry } from './registry/split-container-registry';
import { SPLIT_WINDOW_CONFIG } from './tokens';
import type { SplitAngularTabOptions, SplitContent } from './types';

/**
 * @internal Wires the core controller to the Angular engine. One per environment injector.
 */
@Injectable()
export class SplitWindowRuntime implements OnDestroy {
  readonly registry = inject(SplitContainerRegistry);
  readonly engine = inject(AngularSplitEngine);
  readonly config = inject(SPLIT_WINDOW_CONFIG);
  readonly controller = new SplitWindowController<
    SplitContent,
    HTMLElement,
    SplitAngularTabOptions
  >(this.registry, this.engine, this.config);

  constructor() {
    this.engine.connect(this);
  }

  ngOnDestroy(): void {
    this.controller.destroy();
    this.engine.disconnect();
  }
}
