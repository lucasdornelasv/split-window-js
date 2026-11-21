import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  ViewEncapsulation,
  computed,
  inject,
  input,
  signal,
  viewChild,
  type OnInit,
} from '@angular/core';
import { CdkDropList, type CdkDrag, type CdkDragDrop } from '@angular/cdk/drag-drop';
import { filter } from 'rxjs';
import type { SplitContainerView, SplitWindowRef } from '@split-window/core';
import { contentListId, type SplitDropListData } from '../engine/angular-split-engine';
import { SplitWindowRuntime } from '../runtime';
import { SplitTabStripComponent } from './split-tab-strip.component';
import { SPLIT_WINDOW_STYLES } from './split-styles';

/**
 * Visual shell of a container: tab strip and content area. Created by the engine in
 * `mountContainer`; tab panels are appended to the content area by the engine.
 */
@Component({
  selector: 'split-container',
  imports: [SplitTabStripComponent, CdkDropList],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [SPLIT_WINDOW_STYLES],
  host: {
    tabindex: '-1',
    '[attr.data-container-key]': 'containerKey()',
    '[class.split-container--empty]': '!view()?.tabs?.length',
    '[class.split-drop-target]': 'highlight()',
    '(keydown)': 'onKeydown($event)',
  },
  template: `
    @if (view(); as v) {
      <split-tab-strip [view]="v" />
      <div
        #content
        class="split-content"
        cdkDropList
        cdkDropListSortingDisabled
        [id]="contentId()"
        [cdkDropListData]="contentData()"
        [cdkDropListEnterPredicate]="enterPredicate"
        (cdkDropListDropped)="onDrop($event)"
        (cdkDropListEntered)="highlight.set(true)"
        (cdkDropListExited)="highlight.set(false)"
        [attr.data-empty-label]="emptyLabel"
      ></div>
    }
  `,
})
export class SplitContainerComponent implements OnInit {
  private readonly runtime = inject(SplitWindowRuntime);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly containerKey = input.required<string>();
  readonly view = signal<SplitContainerView<HTMLElement> | null>(null);
  readonly highlight = signal(false);
  readonly emptyLabel = this.runtime.config.labels.emptyContainer;
  private readonly content = viewChild<ElementRef<HTMLElement>>('content');

  readonly contentId = computed(() => contentListId(this.containerKey()));
  readonly contentData = computed<SplitDropListData>(() => ({
    key: this.containerKey(),
    kind: 'content',
  }));

  readonly enterPredicate = (drag: CdkDrag<SplitWindowRef>): boolean =>
    drag.data.containerKey !== this.containerKey() &&
    this.runtime.controller.canDrop(drag.data, this.containerKey());

  ngOnInit(): void {
    const key = this.containerKey();
    const { controller, engine } = this.runtime;
    this.refresh();
    const subscription = controller.changes.pipe(filter((k) => k === key)).subscribe(() => {
      this.refresh();
      const container = this.view()?.container;
      if (container?.kind === 'body') engine.applyBodyOptions(container);
    });
    this.destroyRef.onDestroy(() => subscription.unsubscribe());
  }

  /** Element that receives the tab panels. */
  contentElement(): HTMLElement | null {
    return this.content()?.nativeElement ?? null;
  }

  onDrop(event: CdkDragDrop<SplitDropListData, SplitDropListData, SplitWindowRef>): void {
    this.highlight.set(false);
    this.runtime.engine.handleDrop(event);
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    const view = this.view();
    const expand = view?.container.options.expand;
    if (!view?.container.expanded || (expand && expand.restoreOnEscape === false)) return;
    event.preventDefault();
    this.runtime.registry.restoreContainer(view.key);
    this.host.nativeElement.focus({ preventScroll: true });
  }

  private refresh(): void {
    this.view.set(this.runtime.controller.getContainerView(this.containerKey()));
  }
}
