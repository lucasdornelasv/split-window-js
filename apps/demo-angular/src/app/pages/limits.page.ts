import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
  type AfterViewInit,
  type OnDestroy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  SplitContainerDirective,
  SplitContainerRegistry,
  SplitWindowManager,
  type SplitContainerOptions,
  type SplitOverflowStrategy,
  type SplitRejectStrategy,
} from '@split-window/angular';
import type { Subscription } from 'rxjs';
import { DemoExampleComponent } from '../shared/demo-example.component';
import { NoteTabComponent } from '../shared/tabs';

type OnFullChoice = SplitOverflowStrategy | 'custom';
type OnRejectChoice = SplitRejectStrategy | 'custom';

@Component({
  imports: [DemoExampleComponent, SplitContainerDirective, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Limite de abas</h1>
    <p>
      <code>onFull</code> decide entre rejeitar a aba nova e substituir uma existente;
      <code>onReject</code> decide o destino de uma aba rejeitada. As estratégias pré-definidas
      nunca substituem a aba ativa nem abas com <code>canClose</code>.
    </p>
    <demo-example name="limits" heading="maxTabs, onFull e onReject" [code]="code()">
      <div class="demo-actions">
        <label class="demo-field"
          >maxTabs
          <input
            type="number"
            min="1"
            data-field="max"
            [ngModel]="max()"
            (ngModelChange)="max.set(+$event); apply()"
          />
        </label>
        <label class="demo-field"
          >onFull
          <select
            data-field="on-full"
            [ngModel]="onFull()"
            (ngModelChange)="onFull.set($event); apply()"
          >
            @for (o of onFullOptions; track o) {
              <option [value]="o">{{ o }}</option>
            }
          </select>
        </label>
        <label class="demo-field"
          >onReject
          <select
            data-field="on-reject"
            [ngModel]="onReject()"
            (ngModelChange)="onReject.set($event); apply()"
          >
            @for (o of onRejectOptions; track o) {
              <option [value]="o">{{ o }}</option>
            }
          </select>
        </label>
        <label class="demo-field"
          >Título
          <input data-field="title" [(ngModel)]="title" />
        </label>
      </div>
      <div class="demo-actions">
        <button type="button" class="demo-button primary" data-action="open" (click)="open()">
          Abrir em "limitado"
        </button>
      </div>
      @if (error()) {
        <p class="error" role="alert" data-field="error">{{ error() }}</p>
      }
      <div class="demo-grid">
        <div class="demo-host" data-host="limitado" #limited></div>
        <div class="demo-host" data-host="reserva" splitContainer="reserva"></div>
      </div>
      <h2>tabRejected</h2>
      <pre class="demo-log" data-log="rejected">{{ log().join('\\n') }}</pre>
    </demo-example>
  `,
  styles: `
    .error {
      color: #cf222e;
    }
  `,
})
export default class LimitsPage implements AfterViewInit, OnDestroy {
  private readonly manager = inject(SplitWindowManager);
  private readonly registry = inject(SplitContainerRegistry);
  private readonly host = viewChild.required<ElementRef<HTMLElement>>('limited');
  private subscription?: Subscription;

  readonly onFullOptions: OnFullChoice[] = [
    'reject',
    'replace-oldest',
    'replace-lru',
    'replace-same-label',
    'custom',
  ];
  readonly onRejectOptions: OnRejectChoice[] = ['throw', 'redirect-default', 'cancel', 'custom'];
  readonly max = signal(3);
  readonly onFull = signal<OnFullChoice>('reject');
  readonly onReject = signal<OnRejectChoice>('throw');
  readonly error = signal('');
  readonly log = signal<string[]>([]);
  title = 'Relatório';

  readonly code = computed(() => {
    const onFull =
      this.onFull() === 'custom'
        ? `(ctx) => ctx.source === 'open'
      ? { action: 'replace', ref: ctx.tabs[ctx.tabs.length - 1] }   // the newest tab
      : { action: 'reject' }`
        : `'${this.onFull()}'`;
    const onReject =
      this.onReject() === 'custom'
        ? `(ctx) => ({ action: 'redirect', containerKey: 'reserva' })`
        : `'${this.onReject()}'`;
    return `registry.registerContainer('limitado', host, {
  maxTabs: ${this.max()},
  onFull: ${onFull},
  onReject: ${onReject},
});

manager.tabRejected.subscribe((e) => console.log(e.resolution, e.redirectTo));

// maxTabs as a function: true = full for the arriving tab
registry.registerContainer('relatorios', host, {
  maxTabs: (ctx) => ctx.tabs.filter((t) => t.title === ctx.incoming.title).length >= 2,
});`;
  });

  ngAfterViewInit(): void {
    this.registry.setDefaultContainer('reserva');
    this.apply();
    this.subscription = this.manager.tabRejected.subscribe((e) =>
      this.log.update((l) => [
        ...l,
        `${e.context.containerKey}: ${e.resolution}${e.redirectTo ? ' -> ' + e.redirectTo : ''} (${e.context.source})`,
      ]),
    );
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
    if (this.registry.hasContainer('limitado')) this.registry.unregisterContainer('limitado');
    if (this.registry.hasContainer('body-right')) this.registry.setDefaultContainer('body-right');
  }

  /** Re-registers the container with the chosen options (its tabs are dismissed). */
  apply(): void {
    if (this.registry.hasContainer('limitado')) this.registry.unregisterContainer('limitado');
    const options: SplitContainerOptions = {
      maxTabs: Math.max(1, this.max() || 1),
      onFull:
        this.onFull() === 'custom'
          ? (ctx) =>
              ctx.source === 'open' && ctx.tabs.length
                ? { action: 'replace', ref: ctx.tabs[ctx.tabs.length - 1]! }
                : { action: 'reject' }
          : (this.onFull() as SplitOverflowStrategy),
      onReject:
        this.onReject() === 'custom'
          ? () => ({ action: 'redirect', containerKey: 'reserva' })
          : (this.onReject() as SplitRejectStrategy),
    };
    this.registry.registerContainer('limitado', this.host().nativeElement, options);
    this.error.set('');
  }

  open(): void {
    this.error.set('');
    try {
      const ref = this.manager.open(NoteTabComponent, {
        containerKey: 'limitado',
        title: this.title,
      });
      if (ref.rejected)
        this.error.set('Aba cancelada (onReject: cancel); result rejeitado com container-full.');
    } catch (e) {
      this.error.set(`${(e as Error).name}: ${(e as Error).message}`);
    }
  }
}
