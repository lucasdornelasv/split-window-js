import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  ViewEncapsulation,
  afterNextRender,
  computed,
  inject,
  input,
  viewChild,
} from '@angular/core';
import {
  CdkDrag,
  CdkDragHandle,
  CdkDragPlaceholder,
  CdkDropList,
  type CdkDragDrop,
} from '@angular/cdk/drag-drop';
import type { SplitContainerView, SplitTabView, SplitWindowRef } from '@split-window/core';
import { stripListId, type SplitDropListData } from '../engine/angular-split-engine';
import { SplitWindowController } from '../controller/split-window-controller';
import { AngularSplitEngine } from '../engine/angular-split-engine';
import { SPLIT_WINDOW_CONFIG } from '../tokens';
import { SPLIT_WINDOW_STYLES } from './split-styles';

/** Tab strip of a container: tabs, close buttons, full screen and close all. */
@Component({
  selector: 'split-tab-strip',
  imports: [CdkDropList, CdkDrag, CdkDragHandle, CdkDragPlaceholder],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [SPLIT_WINDOW_STYLES],
  host: { class: 'split-strip-row' },
  template: `
    <div
      class="split-strip"
      role="tablist"
      [attr.aria-label]="labels.tabList + ': ' + view().container.label"
      cdkDropList
      cdkDropListOrientation="horizontal"
      [id]="listId()"
      [cdkDropListData]="listData()"
      [cdkDropListEnterPredicate]="enterPredicate"
      (cdkDropListDropped)="onDrop($event)"
    >
      @for (tab of view().tabs; track tab.id) {
        <div
          class="split-tab"
          cdkDrag
          [cdkDragData]="tab.ref"
          cdkDragPreviewClass="split-drag-preview"
          (cdkDragStarted)="onDragStarted(tab.ref)"
          [attr.data-tab-id]="tab.id"
          [class.split-tab--active]="tab.active"
        >
          <div
            class="split-tab__label"
            role="tab"
            cdkDragHandle
            [id]="tab.id + '-tab'"
            [attr.aria-selected]="tab.active"
            [attr.aria-controls]="tab.id + '-panel'"
            [attr.aria-keyshortcuts]="tab.closable ? 'Delete' : null"
            [attr.tabindex]="tab.active ? 0 : -1"
            [attr.title]="tab.label"
            (click)="activate(tab)"
            (keydown)="onTabKeydown($event, tab)"
          >
            {{ tab.label }}
          </div>
          @if (tab.closable) {
            <!-- Not a nested control of the tab: hidden from assistive technology, which closes with Delete. -->
            <button
              type="button"
              class="split-icon-button split-tab__close"
              tabindex="-1"
              aria-hidden="true"
              [attr.title]="labels.closeTab + ': ' + tab.label"
              (pointerdown)="$event.stopPropagation()"
              (mousedown)="$event.stopPropagation()"
              (click)="closeTab($event, tab)"
            >
              ×
            </button>
          }
          <div *cdkDragPlaceholder class="split-tab cdk-drag-placeholder">
            <span class="split-tab__label">{{ tab.label }}</span>
          </div>
        </div>
      }
    </div>
    <div class="split-actions">
      @if (view().canExpand) {
        <button
          type="button"
          class="split-icon-button split-expand-button"
          [attr.aria-label]="expanded() ? labels.restore : labels.expand"
          [attr.aria-pressed]="expanded()"
          [attr.title]="expanded() ? labels.restore : labels.expand"
          [disabled]="view().dragging"
          (click)="toggleExpand()"
        >
          {{ expanded() ? '⤡' : '⤢' }}
        </button>
      }
      <button
        type="button"
        class="split-icon-button split-close-all-button"
        [attr.aria-label]="labels.closeAll"
        [attr.title]="labels.closeAll"
        [disabled]="view().closingAll || !hasClosableTabs()"
        (click)="closeAll()"
      >
        ⨯
      </button>
    </div>
  `,
})
export class SplitTabStripComponent {
  private readonly controller = inject(SplitWindowController);
  private readonly engine = inject(AngularSplitEngine);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  readonly labels = inject(SPLIT_WINDOW_CONFIG).labels;

  readonly view = input.required<SplitContainerView<HTMLElement>>();
  readonly dropList = viewChild.required(CdkDropList);

  readonly listId = computed(() => stripListId(this.view().key));
  readonly listData = computed<SplitDropListData>(() => ({ key: this.view().key, kind: 'strip' }));
  readonly expanded = computed(() => this.view().container.expanded);
  readonly hasClosableTabs = computed(() => this.view().tabs.some((t) => t.closable));

  readonly enterPredicate = (drag: CdkDrag<SplitWindowRef>): boolean =>
    this.controller.canDrop(drag.data, this.view().key);

  activate(tab: SplitTabView): void {
    tab.ref.activate();
  }

  closeTab(event: Event, tab: SplitTabView): void {
    event.stopPropagation();
    void this.controller.requestTabClose(tab.ref);
  }

  toggleExpand(): void {
    const { controller } = this;
    const key = this.view().key;
    if (controller.isContainerExpanded(key)) controller.restoreContainer(key);
    else controller.expandContainer(key);
  }

  closeAll(): void {
    void this.controller.dismissAll({ containerKey: this.view().key, reason: 'close-all' });
  }

  onDragStarted(ref: SplitWindowRef): void {
    this.engine.startDrag(ref, this.dropList());
  }

  onDrop(event: CdkDragDrop<SplitDropListData, SplitDropListData, SplitWindowRef>): void {
    this.engine.handleDrop(event);
  }

  /**
   * WAI-ARIA tabs pattern with automatic activation: arrows, Home and End move between
   * tabs; Delete closes; Ctrl+Shift+arrows reorder.
   */
  onTabKeydown(event: KeyboardEvent, tab: SplitTabView): void {
    const tabs = this.view().tabs;
    const index = tabs.findIndex((t) => t.id === tab.id);
    let target: number | null = null;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowLeft': {
        const step = event.key === 'ArrowRight' ? 1 : -1;
        if (event.ctrlKey && event.shiftKey) {
          tab.ref.moveTo(this.view().key, Math.max(0, index + step));
          this.focusTab(tab.id);
          event.preventDefault();
          return;
        }
        target = (index + step + tabs.length) % tabs.length;
        break;
      }
      case 'Home':
        target = 0;
        break;
      case 'End':
        target = tabs.length - 1;
        break;
      case 'Delete':
        if (tab.closable) void this.controller.requestTabClose(tab.ref);
        event.preventDefault();
        return;
      case 'Enter':
      case ' ':
        tab.ref.activate();
        event.preventDefault();
        return;
      default:
        return;
    }
    event.preventDefault();
    const next = tabs[target];
    if (next) {
      next.ref.activate();
      this.focusTab(next.id);
    }
  }

  /** Focuses a tab after the strip re-renders (a reorder moves the element and drops focus). */
  private focusTab(id: string): void {
    const focus = () =>
      (
        this.element.nativeElement.querySelector(
          `[data-tab-id="${id}"] [role="tab"]`,
        ) as HTMLElement | null
      )?.focus();
    focus();
    afterNextRender(focus, { injector: this.injector });
  }
}
