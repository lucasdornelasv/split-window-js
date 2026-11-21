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
  SplitContainerRegistry,
  SplitWindowManager,
  type SplitContainerOptions,
  type SplitOverflowStrategy,
  type SplitRejectStrategy,
  type SplitWindowOptions,
} from '@split-window/angular';
import { DemoExampleComponent } from '../shared/demo-example.component';
import { NoteTabComponent } from '../shared/tabs';

export interface PlaygroundState {
  maxTabs: number | null;
  onFull: SplitOverflowStrategy;
  onReject: SplitRejectStrategy;
  closeWhenEmpty: boolean;
  label: string;
  expand: boolean;
  expandMaxWidth: string;
  expandMargin: number;
  expandAlign: 'center' | 'start' | 'end';
  title: string;
  groupKey: string;
  activate: boolean;
  closable: boolean;
  confirmClose: boolean;
  lockToContainer: boolean;
}

const INITIAL: PlaygroundState = {
  maxTabs: null,
  onFull: 'reject',
  onReject: 'throw',
  closeWhenEmpty: false,
  label: '',
  expand: true,
  expandMaxWidth: '',
  expandMargin: 0,
  expandAlign: 'center',
  title: '',
  groupKey: '',
  activate: true,
  closable: true,
  confirmClose: false,
  lockToContainer: false,
};

/** Builds the container options of the playground. */
export function containerOptions(s: PlaygroundState): SplitContainerOptions {
  const options: SplitContainerOptions = {};
  if (s.maxTabs) options.maxTabs = s.maxTabs;
  if (s.onFull !== 'reject') options.onFull = s.onFull;
  if (s.onReject !== 'throw') options.onReject = s.onReject;
  if (s.closeWhenEmpty) options.closeWhenEmpty = true;
  if (s.label) options.label = s.label;
  if (!s.expand) options.expand = false;
  else if (s.expandMaxWidth || s.expandMargin || s.expandAlign !== 'center') {
    options.expand = {
      ...(s.expandMaxWidth
        ? { maxWidth: /^\d+$/.test(s.expandMaxWidth) ? Number(s.expandMaxWidth) : s.expandMaxWidth }
        : {}),
      ...(s.expandMargin ? { margin: s.expandMargin } : {}),
      ...(s.expandAlign !== 'center' ? { align: s.expandAlign } : {}),
    };
  }
  return options;
}

/** Builds the open options of the playground (without functions). */
export function openOptions(s: PlaygroundState): SplitWindowOptions {
  const options: SplitWindowOptions = { containerKey: 'playground' };
  if (s.title) options.title = s.title;
  if (s.groupKey) options.groupKey = s.groupKey;
  if (!s.activate) options.activate = false;
  if (!s.closable) options.closable = false;
  return options;
}

function literal(value: unknown, indent = '  '): string {
  const json = JSON.stringify(value, null, 2) ?? 'undefined';
  return json
    .replace(/"([a-zA-Z_$][\w$]*)":/g, '$1:')
    .replace(/"/g, "'")
    .replace(/\n/g, `\n${indent}`);
}

/** Code equivalent to the playground state, ready to copy. */
export function playgroundCode(s: PlaygroundState): string {
  const entries = Object.entries(openOptions(s)).map(([key, value]) => `${key}: ${literal(value)}`);
  if (s.confirmClose) entries.push(`canClose: () => confirm('Fechar esta aba?')`);
  if (s.lockToContainer) entries.push(`canMove: (target) => target.containerKey === 'playground'`);
  return `registry.registerContainer('playground', host, ${literal(containerOptions(s), '')});

manager.open(NoteTabComponent, {
  ${entries.join(',\n  ')},
});`;
}

@Component({
  imports: [DemoExampleComponent, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Playground</h1>
    <p>
      Cada mudança nas opções de container reaplica a configuração (o container é registrado de novo
      e as abas dele são fechadas). As opções de abertura valem para o próximo <code>open()</code>.
    </p>
    <demo-example name="playground" heading="Todas as opções" [code]="code()">
      <form class="form" (submit)="$event.preventDefault()">
        <fieldset>
          <legend>Container</legend>
          <label class="demo-field"
            >maxTabs
            <input
              type="number"
              min="1"
              name="maxTabs"
              data-field="maxTabs"
              [ngModel]="state().maxTabs"
              (ngModelChange)="patch({ maxTabs: $event ? +$event : null }, true)"
          /></label>
          <label class="demo-field"
            >onFull
            <select
              name="onFull"
              data-field="onFull"
              [ngModel]="state().onFull"
              (ngModelChange)="patch({ onFull: $event }, true)"
            >
              @for (o of onFullOptions; track o) {
                <option [value]="o">{{ o }}</option>
              }
            </select>
          </label>
          <label class="demo-field"
            >onReject
            <select
              name="onReject"
              data-field="onReject"
              [ngModel]="state().onReject"
              (ngModelChange)="patch({ onReject: $event }, true)"
            >
              @for (o of onRejectOptions; track o) {
                <option [value]="o">{{ o }}</option>
              }
            </select>
          </label>
          <label class="demo-field"
            >label
            <input
              name="label"
              data-field="label"
              [ngModel]="state().label"
              (ngModelChange)="patch({ label: $event }, true)"
          /></label>
          <label class="demo-check"
            ><input
              type="checkbox"
              name="closeWhenEmpty"
              data-field="closeWhenEmpty"
              [ngModel]="state().closeWhenEmpty"
              (ngModelChange)="patch({ closeWhenEmpty: $event }, true)"
            />
            closeWhenEmpty</label
          >
          <label class="demo-check"
            ><input
              type="checkbox"
              name="expand"
              data-field="expand"
              [ngModel]="state().expand"
              (ngModelChange)="patch({ expand: $event }, true)"
            />
            expand</label
          >
          <label class="demo-field"
            >expand.maxWidth
            <input
              name="expandMaxWidth"
              data-field="expandMaxWidth"
              placeholder="ex.: 800 ou 60vw"
              [ngModel]="state().expandMaxWidth"
              (ngModelChange)="patch({ expandMaxWidth: $event }, true)"
          /></label>
          <label class="demo-field"
            >expand.margin
            <input
              type="number"
              min="0"
              name="expandMargin"
              data-field="expandMargin"
              [ngModel]="state().expandMargin"
              (ngModelChange)="patch({ expandMargin: +$event || 0 }, true)"
          /></label>
          <label class="demo-field"
            >expand.align
            <select
              name="expandAlign"
              data-field="expandAlign"
              [ngModel]="state().expandAlign"
              (ngModelChange)="patch({ expandAlign: $event }, true)"
            >
              <option value="center">center</option>
              <option value="start">start</option>
              <option value="end">end</option>
            </select>
          </label>
        </fieldset>
        <fieldset>
          <legend>Abertura</legend>
          <label class="demo-field"
            >title
            <input
              name="title"
              data-field="title"
              [ngModel]="state().title"
              (ngModelChange)="patch({ title: $event })"
          /></label>
          <label class="demo-field"
            >groupKey
            <input
              name="groupKey"
              data-field="groupKey"
              [ngModel]="state().groupKey"
              (ngModelChange)="patch({ groupKey: $event })"
          /></label>
          <label class="demo-check"
            ><input
              type="checkbox"
              name="activate"
              data-field="activate"
              [ngModel]="state().activate"
              (ngModelChange)="patch({ activate: $event })"
            />
            activate</label
          >
          <label class="demo-check"
            ><input
              type="checkbox"
              name="closable"
              data-field="closable"
              [ngModel]="state().closable"
              (ngModelChange)="patch({ closable: $event })"
            />
            closable</label
          >
          <label class="demo-check"
            ><input
              type="checkbox"
              name="confirmClose"
              data-field="confirmClose"
              [ngModel]="state().confirmClose"
              (ngModelChange)="patch({ confirmClose: $event })"
            />
            canClose com confirm()</label
          >
          <label class="demo-check"
            ><input
              type="checkbox"
              name="lockToContainer"
              data-field="lockToContainer"
              [ngModel]="state().lockToContainer"
              (ngModelChange)="patch({ lockToContainer: $event })"
            />
            canMove só no playground</label
          >
        </fieldset>
      </form>
      <div class="demo-actions">
        <button type="button" class="demo-button primary" data-action="open" (click)="open()">
          open()
        </button>
        <button type="button" class="demo-button" data-action="reset" (click)="reset()">
          Restaurar padrões
        </button>
      </div>
      @if (error()) {
        <p role="alert" class="error" data-field="error">{{ error() }}</p>
      }
      <div class="demo-host" data-host="playground" #host></div>
    </demo-example>
  `,
  styles: `
    .form {
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    }
    fieldset {
      border: 1px solid var(--demo-border);
      border-radius: 6px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .demo-check {
      display: flex;
      gap: 6px;
      align-items: center;
      font-size: 0.9rem;
    }
    .error {
      color: #cf222e;
    }
  `,
})
export default class PlaygroundPage implements AfterViewInit, OnDestroy {
  private readonly manager = inject(SplitWindowManager);
  private readonly registry = inject(SplitContainerRegistry);
  private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');
  readonly onFullOptions: SplitOverflowStrategy[] = [
    'reject',
    'replace-oldest',
    'replace-lru',
    'replace-same-label',
  ];
  readonly onRejectOptions: SplitRejectStrategy[] = ['throw', 'redirect-default', 'cancel'];
  readonly state = signal<PlaygroundState>({ ...INITIAL });
  readonly code = computed(() => playgroundCode(this.state()));
  readonly error = signal('');

  ngAfterViewInit(): void {
    this.applyContainer();
  }

  ngOnDestroy(): void {
    if (this.registry.hasContainer('playground')) this.registry.unregisterContainer('playground');
  }

  patch(change: Partial<PlaygroundState>, container = false): void {
    this.state.update((s) => ({ ...s, ...change }));
    if (container) this.applyContainer();
  }

  reset(): void {
    this.state.set({ ...INITIAL });
    this.applyContainer();
  }

  open(): void {
    const s = this.state();
    this.error.set('');
    try {
      const ref = this.manager.open(NoteTabComponent, {
        ...openOptions(s),
        ...(s.confirmClose ? { canClose: () => confirm('Fechar esta aba?') } : {}),
        ...(s.lockToContainer
          ? { canMove: (t: { containerKey: string }) => t.containerKey === 'playground' }
          : {}),
      });
      if (ref.rejected) this.error.set('Aba cancelada pelo onReject.');
    } catch (e) {
      this.error.set(`${(e as Error).name}: ${(e as Error).message}`);
    }
  }

  private applyContainer(): void {
    this.error.set('');
    if (this.registry.hasContainer('playground')) this.registry.unregisterContainer('playground');
    try {
      this.registry.registerContainer(
        'playground',
        this.host().nativeElement,
        containerOptions(this.state()),
      );
    } catch (e) {
      this.error.set(`${(e as Error).name}: ${(e as Error).message}`);
    }
  }
}
