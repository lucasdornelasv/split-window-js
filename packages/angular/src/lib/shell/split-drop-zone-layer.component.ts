import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject } from '@angular/core';
import { CdkDropList, type CdkDrag, type CdkDragDrop } from '@angular/cdk/drag-drop';
import type { SplitRect, SplitWindowRef } from '@split-window/core';
import { SplitWindowController } from '../controller/split-window-controller';
import {
  AngularSplitEngine,
  floatListId,
  type SplitDropListData,
} from '../engine/angular-split-engine';
import { SPLIT_WINDOW_STYLES } from './split-styles';

/** A floating drop zone of a closed container. */
export interface SplitFloatingZone {
  key: string;
  label: string;
  rect: SplitRect;
}

/**
 * Layer in the body with the floating drop zones of closed containers, shown during a drag.
 * The engine renders it synchronously in `cdkDragStarted`, before the CDK measures lists.
 */
@Component({
  selector: 'split-drop-zone-layer',
  imports: [CdkDropList],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [SPLIT_WINDOW_STYLES],
  template: `
    @for (zone of zones(); track zone.key) {
      <div
        class="split-drop-zone"
        cdkDropList
        cdkDropListSortingDisabled
        [id]="id(zone.key)"
        [cdkDropListData]="data(zone.key)"
        [cdkDropListEnterPredicate]="predicate(zone.key)"
        (cdkDropListDropped)="onDrop($event)"
        [attr.data-container-key]="zone.key"
        [style.left.px]="zone.rect.x"
        [style.top.px]="zone.rect.y"
        [style.width.px]="zone.rect.width"
        [style.height.px]="zone.rect.height"
      >
        <span class="split-drop-zone__label">{{ zone.label }}</span>
      </div>
    }
  `,
})
export class SplitDropZoneLayerComponent {
  private readonly controller = inject(SplitWindowController);
  private readonly engine = inject(AngularSplitEngine);
  readonly zones = this.engine.floatingZones;
  private readonly predicates = new Map<string, (drag: CdkDrag<SplitWindowRef>) => boolean>();

  private readonly dataCache = new Map<string, SplitDropListData>();

  id(key: string): string {
    return floatListId(key);
  }

  data(key: string): SplitDropListData {
    let data = this.dataCache.get(key);
    if (!data) {
      data = { key, kind: 'float' };
      this.dataCache.set(key, data);
    }
    return data;
  }

  predicate(key: string): (drag: CdkDrag<SplitWindowRef>) => boolean {
    let fn = this.predicates.get(key);
    if (!fn) {
      fn = (drag) => this.controller.canDrop(drag.data, key);
      this.predicates.set(key, fn);
    }
    return fn;
  }

  onDrop(event: CdkDragDrop<SplitDropListData, SplitDropListData, SplitWindowRef>): void {
    this.engine.handleDrop(event);
  }
}
