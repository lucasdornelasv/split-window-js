import { ChangeDetectionStrategy, Component, inject, signal, type OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  SplitContainerDirective,
  SplitWindowManager,
  type SplitWindowRef,
} from '@split-window/angular';
import { Subscription } from 'rxjs';
import { DemoExampleComponent } from '../shared/demo-example.component';
import { NoteTabComponent } from '../shared/tabs';

const CODE = `// numbering per group + title, inside each container
manager.open(NoteTabComponent, { containerKey: 'abas', title: 'Contrato' });           // Contrato
manager.open(NoteTabComponent, { containerKey: 'abas', title: 'Contrato' });           // Contrato (2)
manager.open(NoteTabComponent, { containerKey: 'abas', title: 'Contrato', groupKey: 'B' }); // Contrato
manager.open(NoteTabComponent, { containerKey: 'abas' });                                // Nova aba

// open without activating
manager.open(NoteTabComponent, { containerKey: 'abas', activate: false });

// rename: the tab moves to the new pair and gets a new number
ref.setTitle('Proposta');`;

@Component({
  imports: [DemoExampleComponent, SplitContainerDirective, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Abas e numeração</h1>
    <p>
      A primeira aba de cada par grupo + título não mostra número; as seguintes recebem (2), (3)… O
      número é fixado na abertura, e uma aba nova pega o menor número livre.
    </p>
    <demo-example name="tabs" heading="Títulos, grupos e ativação" [code]="code">
      <div class="demo-actions">
        <label class="demo-field">Título<input data-field="title" [(ngModel)]="title" /></label>
        <label class="demo-field">Grupo<input data-field="group" [(ngModel)]="group" /></label>
        <label class="demo-field"
          >Ativar<input type="checkbox" data-field="activate" [(ngModel)]="activate"
        /></label>
      </div>
      <div class="demo-actions">
        <button type="button" class="demo-button primary" data-action="open" (click)="open()">
          Abrir
        </button>
      </div>
      <div class="demo-host" data-host="abas" splitContainer="abas"></div>
      <h2>Abas abertas</h2>
      <ul class="tab-list">
        @for (ref of refs(); track ref.id) {
          <li [attr.data-ref]="ref.label">
            <code>{{ ref.label }}</code> grupo {{ ref.groupKey ?? 'default' }}
            <button
              type="button"
              class="demo-button"
              data-action="activate"
              (click)="ref.activate()"
            >
              Ativar
            </button>
            <button type="button" class="demo-button" data-action="rename" (click)="rename(ref)">
              Renomear para "{{ renameTo }}"
            </button>
          </li>
        }
      </ul>
      <label class="demo-field"
        >Novo título<input data-field="rename-to" [(ngModel)]="renameTo"
      /></label>
    </demo-example>
  `,
})
export default class TabsPage implements OnDestroy {
  private readonly manager = inject(SplitWindowManager);
  private readonly subscription = new Subscription();
  readonly code = CODE;
  readonly refs = signal<readonly SplitWindowRef[]>([]);
  title = 'Contrato';
  group = '';
  activate = true;
  renameTo = 'Proposta';

  open(): void {
    const ref = this.manager.open(NoteTabComponent, {
      containerKey: 'abas',
      title: this.title || undefined,
      groupKey: this.group || undefined,
      activate: this.activate,
    });
    this.subscription.add(ref.hidden.subscribe(() => this.refresh()));
    this.subscription.add(ref.titleChanged.subscribe(() => this.refresh()));
    this.refresh();
  }

  rename(ref: SplitWindowRef): void {
    ref.setTitle(this.renameTo);
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  private refresh(): void {
    this.refs.set([...this.manager.getTabs('abas')]);
  }
}
