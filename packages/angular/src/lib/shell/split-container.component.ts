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
import { SplitWindowController } from '../controller/split-window-controller';
import { AngularSplitEngine } from '../engine/angular-split-engine';
import { SPLIT_WINDOW_CONFIG } from '../tokens';
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
  private readonly controller = inject(SplitWindowController);
  private readonly engine = inject(AngularSplitEngine);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly containerKey = input.required<string>();
  readonly view = signal<SplitContainerView<HTMLElement> | null>(null);
  readonly highlight = signal(false);
  readonly emptyLabel = inject(SPLIT_WINDOW_CONFIG).labels.emptyContainer;
  private readonly content = viewChild<ElementRef<HTMLElement>>('content');
  private frozen = false;

  readonly contentId = computed(() => contentListId(this.containerKey()));
  readonly contentData = computed<SplitDropListData>(() => ({
    key: this.containerKey(),
    kind: 'content',
  }));

  readonly enterPredicate = (drag: CdkDrag<SplitWindowRef>): boolean =>
    drag.data.containerKey !== this.containerKey() &&
    this.controller.canDrop(drag.data, this.containerKey());

  ngOnInit(): void {
    const key = this.containerKey();
    const { controller, engine } = this;
    this.refresh();
    const subscription = controller.changes.pipe(filter((k) => k === key)).subscribe(() => {
      if (!this.frozen) this.refresh();
      const container = controller.registry._get(key);
      if (container) engine.applyContainerOptions(container);
    });
    this.destroyRef.onDestroy(() => subscription.unsubscribe());
  }

  /** Element that receives the tab panels. */
  contentElement(): HTMLElement | null {
    return this.content()?.nativeElement ?? null;
  }

  onDrop(event: CdkDragDrop<SplitDropListData, SplitDropListData, SplitWindowRef>): void {
    this.highlight.set(false);
    this.engine.handleDrop(event);
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    const view = this.view();
    const expand = view?.container.options.expand;
    if (!view?.container.expanded || (expand && expand.restoreOnEscape === false)) return;
    event.preventDefault();
    this.controller.restoreContainer(view.key);
    this.host.nativeElement.focus({ preventScroll: true });
  }

  /**
   * Stops following the container state, keeping what is on screen (used while the
   * container animates out, so its last tab does not disappear first).
   */
  freeze(): void {
    this.frozen = true;
  }

  /** Follows the container state again. */
  unfreeze(): void {
    if (!this.frozen) return;
    this.frozen = false;
    this.refresh();
  }

  private refresh(): void {
    this.view.set(this.controller.getContainerView(this.containerKey()));
  }
}
