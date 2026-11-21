import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
  viewChild,
  type AfterViewInit,
  type OnDestroy,
} from '@angular/core';
import {
  SplitContainerDirective,
  SplitContainerRegistry,
  SplitWindowManager,
} from '@split-window/angular';
import { DemoExampleComponent } from '../shared/demo-example.component';
import { NoteTabComponent } from '../shared/tabs';

const CODE = `<!-- by directive, anywhere in the page -->
<div splitContainer="esquerdo"></div>
<div splitContainer="direito" [splitContainerOptions]="{ label: 'Painel direito' }"></div>

// by code
registry.registerContainer('programatico', hostElement, { maxTabs: 4 });

// open in a container, or in the default one
manager.open(NoteTabComponent, { containerKey: 'esquerdo', title: 'Esquerdo' });
registry.setDefaultContainer('direito');
manager.open(NoteTabComponent); // goes to 'direito'`;

@Component({
  imports: [DemoExampleComponent, SplitContainerDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Containers</h1>
    <p>Containers são divs da aplicação registradas por chave, em qualquer posição da página.</p>
    <demo-example name="containers" heading="Containers registrados" [code]="code">
      <div class="demo-actions">
        <button
          type="button"
          class="demo-button"
          data-action="open-left"
          (click)="open('esquerdo')"
        >
          Abrir no esquerdo
        </button>
        <button
          type="button"
          class="demo-button"
          data-action="open-right"
          (click)="open('direito')"
        >
          Abrir no direito
        </button>
        <button
          type="button"
          class="demo-button"
          data-action="open-code"
          (click)="open('programatico')"
        >
          Abrir no programático
        </button>
        <button type="button" class="demo-button" data-action="open-default" (click)="open()">
          Abrir no padrão
        </button>
      </div>
      <div class="demo-actions">
        <label class="demo-field"
          >Container padrão
          <select data-field="default" (change)="setDefault($any($event.target).value)">
            @for (key of keys(); track key) {
              <option [value]="key" [selected]="key === defaultKey()">{{ key }}</option>
            }
          </select>
        </label>
      </div>
      <div class="demo-grid">
        <div class="demo-host" data-host="esquerdo" splitContainer="esquerdo"></div>
        <div
          class="demo-host"
          data-host="direito"
          splitContainer="direito"
          [splitContainerOptions]="{ label: 'Painel direito' }"
        ></div>
        <div class="demo-host" data-host="programatico" #programatico></div>
      </div>
    </demo-example>
  `,
})
export default class ContainersPage implements AfterViewInit, OnDestroy {
  private readonly manager = inject(SplitWindowManager);
  private readonly registry = inject(SplitContainerRegistry);
  private readonly host = viewChild.required<ElementRef<HTMLElement>>('programatico');
  readonly code = CODE;
  readonly keys = signal<string[]>([]);
  readonly defaultKey = signal<string | null>(null);
  private previousDefault: string | null = null;

  ngAfterViewInit(): void {
    this.registry.registerContainer('programatico', this.host().nativeElement, { maxTabs: 4 });
    this.previousDefault = this.registry.getDefaultContainer();
    this.refresh();
  }

  ngOnDestroy(): void {
    this.registry.unregisterContainer('programatico');
    if (this.previousDefault && this.registry.hasContainer(this.previousDefault)) {
      this.registry.setDefaultContainer(this.previousDefault);
    }
  }

  open(containerKey?: string): void {
    this.manager.open(NoteTabComponent, { containerKey, title: containerKey ?? 'Padrão' });
  }

  setDefault(key: string): void {
    this.registry.setDefaultContainer(key);
    this.refresh();
  }

  private refresh(): void {
    this.keys.set(this.registry.getContainerKeys());
    this.defaultKey.set(this.registry.getDefaultContainer());
  }
}
