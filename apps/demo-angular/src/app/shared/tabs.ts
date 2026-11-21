import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SplitActiveWindow } from '@split-window/angular';
import { ConfirmService } from './confirm.service';

/** A tab with local state (a counter and a text field), to show that moves keep it. */
@Component({
  selector: 'demo-note-tab',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="note">
      <p class="note__title">
        <strong>{{ window.label() }}</strong> em
        <code class="note__container">{{ window.containerKey() }}</code>
      </p>
      @if (text()) {
        <p class="note__text">{{ text() }}</p>
      }
      <div class="demo-actions">
        <button type="button" class="demo-button note__increment" (click)="count.set(count() + 1)">
          Cliques: <span class="note__count">{{ count() }}</span>
        </button>
        <button type="button" class="demo-button note__close" (click)="window.close('done')">
          Fechar pela aba
        </button>
      </div>
      <label class="demo-field"
        >Texto livre<textarea class="note__input" rows="3" [(ngModel)]="draft"></textarea>
      </label>
    </div>
  `,
  styles: `
    .note {
      padding: 12px;
    }
    .note__title {
      margin-top: 0;
    }
  `,
})
export class NoteTabComponent {
  readonly window = inject(SplitActiveWindow);
  readonly text = input('');
  readonly count = signal(0);
  draft = '';
}

/** A form tab that asks for confirmation before closing when there are unsaved changes. */
@Component({
  selector: 'demo-form-tab',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="form-tab" (submit)="$event.preventDefault(); saved.set(value)">
      <p>
        {{
          dirty()
            ? 'Alterações não salvas: fechar pede confirmação.'
            : 'Sem alterações: fecha direto.'
        }}
      </p>
      <label class="demo-field"
        >Nome<input
          class="form-tab__input"
          name="nome"
          [ngModel]="value"
          (ngModelChange)="value = $event; changed.set($event)"
      /></label>
      <div class="demo-actions">
        <button type="submit" class="demo-button form-tab__save">Salvar</button>
      </div>
    </form>
  `,
  styles: `
    .form-tab {
      padding: 12px;
    }
  `,
})
export class FormTabComponent {
  private readonly window = inject(SplitActiveWindow);
  private readonly confirm = inject(ConfirmService);
  value = '';
  readonly changed = signal('');
  readonly saved = signal('');

  dirty(): boolean {
    return this.changed() !== this.saved();
  }

  constructor() {
    this.window.setCanClose(() =>
      this.dirty() ? this.confirm.confirm('Descartar as alterações?') : true,
    );
  }
}
