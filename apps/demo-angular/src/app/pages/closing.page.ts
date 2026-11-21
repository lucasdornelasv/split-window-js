import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  SplitContainerDirective,
  SplitWindowManager,
  type SplitWindowRef,
} from '@split-window/angular';
import { of, delay } from 'rxjs';
import { ConfirmService } from '../shared/confirm.service';
import { DemoExampleComponent } from '../shared/demo-example.component';
import { FormTabComponent, NoteTabComponent } from '../shared/tabs';

const CODE = `// closable: false hides the X and "close all" skips the tab
manager.open(NoteTabComponent, { title: 'Fixa', closable: false });

// canClose: boolean, Promise or Observable
manager.open(NoteTabComponent, { title: 'Nunca', canClose: () => false });
manager.open(NoteTabComponent, {
  title: 'Confirma',
  canClose: () => confirm.confirm('Fechar esta aba?'),   // Promise<boolean>
});
manager.open(NoteTabComponent, { title: 'Observable', canClose: () => of(true).pipe(delay(300)) });

// from inside the component
constructor() {
  inject(SplitActiveWindow).setCanClose(() => !this.dirty() || this.confirmDiscard());
}

// force skips the check
ref.dismiss('forced', { force: true });

// close all, in sequence, waiting for each confirmation
const { closed, kept } = await manager.dismissAll({ containerKey: 'fechamento' });`;

@Component({
  imports: [DemoExampleComponent, SplitContainerDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Fechamento</h1>
    <p>
      Todo pedido de fechamento passa pelo <code>canClose</code> da aba, a menos que use
      <code>force</code>. O botão de fechar tudo percorre as abas em ordem, ativa cada aba que pede
      confirmação e continua depois da resposta.
    </p>
    <demo-example name="closing" heading="closable, canClose, force e fechar tudo" [code]="code">
      <div class="demo-actions">
        <button type="button" class="demo-button" data-action="open-pinned" (click)="openPinned()">
          Aba fixa
        </button>
        <button type="button" class="demo-button" data-action="open-never" (click)="openNever()">
          canClose: false
        </button>
        <button
          type="button"
          class="demo-button"
          data-action="open-confirm"
          (click)="openConfirm()"
        >
          canClose com confirmação
        </button>
        <button
          type="button"
          class="demo-button"
          data-action="open-observable"
          (click)="openObservable()"
        >
          canClose Observable
        </button>
        <button type="button" class="demo-button" data-action="open-form" (click)="openForm()">
          Formulário
        </button>
      </div>
      <div class="demo-actions">
        <button type="button" class="demo-button" data-action="force" (click)="forceLast()">
          Fechar a última com force
        </button>
        <button
          type="button"
          class="demo-button primary"
          data-action="close-all"
          (click)="closeAll()"
        >
          dismissAll()
        </button>
      </div>
      <div class="demo-host" data-host="fechamento" splitContainer="fechamento"></div>
      <pre class="demo-log" data-log="closing">{{ log().join('\\n') }}</pre>
    </demo-example>
  `,
})
export default class ClosingPage {
  private readonly manager = inject(SplitWindowManager);
  private readonly confirm = inject(ConfirmService);
  readonly code = CODE;
  readonly log = signal<string[]>([]);

  openPinned(): void {
    this.track(
      this.manager.open(NoteTabComponent, {
        containerKey: 'fechamento',
        title: 'Fixa',
        closable: false,
      }),
    );
  }

  openNever(): void {
    this.track(
      this.manager.open(NoteTabComponent, {
        containerKey: 'fechamento',
        title: 'Nunca',
        canClose: () => false,
      }),
    );
  }

  openConfirm(): void {
    this.track(
      this.manager.open(NoteTabComponent, {
        containerKey: 'fechamento',
        title: 'Confirma',
        canClose: () => this.confirm.confirm('Fechar esta aba?'),
      }),
    );
  }

  openObservable(): void {
    this.track(
      this.manager.open(NoteTabComponent, {
        containerKey: 'fechamento',
        title: 'Observable',
        canClose: () => of(true).pipe(delay(300)),
      }),
    );
  }

  openForm(): void {
    this.track(
      this.manager.open(FormTabComponent, { containerKey: 'fechamento', title: 'Formulário' }),
    );
  }

  forceLast(): void {
    const tabs = this.manager.getTabs('fechamento');
    void tabs[tabs.length - 1]?.dismiss('forced', { force: true });
  }

  async closeAll(): Promise<void> {
    const { closed, kept } = await this.manager.dismissAll({ containerKey: 'fechamento' });
    this.write(
      `dismissAll: fechadas [${closed.map((r) => r.label).join(', ')}], mantidas [${kept.map((r) => r.label).join(', ')}]`,
    );
  }

  private track(ref: SplitWindowRef): void {
    ref.closePrevented.subscribe((e) => this.write(`${ref.label}: closePrevented (${e.trigger})`));
    ref.closed.subscribe((v) => this.write(`${ref.label}: closed (${String(v)})`));
    ref.dismissed.subscribe((v) => this.write(`${ref.label}: dismissed (${String(v)})`));
  }

  private write(line: string): void {
    this.log.update((l) => [...l, line]);
  }
}
