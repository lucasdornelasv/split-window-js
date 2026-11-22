import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { SplitWindowManager, type SplitWindowRef } from '@split-window/angular';
import { DemoExampleComponent } from '../shared/demo-example.component';
import { NoteTabComponent } from '../shared/tabs';

const CODE = `// app.config.ts
providers: [
  // only body-right, no tab limit, as the default container
  provideSplitWindows({ bodyContainers: true }),
]

// any component
private manager = inject(SplitWindowManager);

open() {
  const ref = this.manager.open(NoteTabComponent, { title: 'Nota' });
  ref.result.then((value) => console.log('closed with', value), () => {});
}`;

const REQUEST_CODE = `// the tab as a request: emits the close result and completes
const ref = this.manager.open(NoteTabComponent, { title: 'Pedido', inputs: { text: 'Aguardando' } });
ref.asRequest<string>().subscribe({
  next: (value) => (this.result = value),      // ref.close('done') inside the tab
  complete: () => (this.status = 'finished'),  // also on dismiss, with no value
});
// unsubscribing before the answer dismisses the tab (see ref.attachTo(subscription))

// update inputs of the open component (only declared inputs are set)
ref.setInputData({ text: 'Atualizado' });`;

@Component({
  imports: [DemoExampleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Início rápido</h1>
    <p>
      <code>provideSplitWindows({{ '{' }} bodyContainers: true {{ '}' }})</code> registra a
      biblioteca e habilita o container da borda direita como padrão, e <code>open()</code> abre um
      componente como aba.
    </p>
    <demo-example name="quick-start" heading="Abrir uma aba" [code]="code">
      <div class="demo-actions">
        <button type="button" class="demo-button primary" data-action="open-note" (click)="open()">
          Abrir aba
        </button>
      </div>
      <p>Abra várias vezes para ver a numeração: Nota, Nota (2), Nota (3)…</p>
    </demo-example>

    <demo-example name="request" heading="A aba como requisição" [code]="requestCode">
      <div class="demo-actions">
        <button
          type="button"
          class="demo-button primary"
          data-action="open-request"
          (click)="openRequest()"
        >
          Abrir e aguardar
        </button>
        <button
          type="button"
          class="demo-button"
          data-action="update-inputs"
          [disabled]="!pending()"
          (click)="updateInputs()"
        >
          Atualizar o texto (setInputData)
        </button>
      </div>
      <p>
        Estado: <strong data-field="request-status">{{ status() }}</strong> · resultado:
        <code data-field="request-result">{{ result() }}</code>
      </p>
      <p>
        Feche pelo botão "Fechar pela aba" (emite <code>'done'</code>) ou pelo X (completa sem
        valor).
      </p>
    </demo-example>
  `,
})
export default class QuickStartPage {
  private readonly manager = inject(SplitWindowManager);
  private readonly destroyRef = inject(DestroyRef);
  readonly code = CODE;
  readonly requestCode = REQUEST_CODE;
  readonly pending = signal<SplitWindowRef | null>(null);
  readonly status = signal('nenhuma');
  readonly result = signal('—');

  open(): void {
    this.manager.open(NoteTabComponent, { title: 'Nota' });
  }

  openRequest(): void {
    const ref = this.manager.open(NoteTabComponent, {
      title: 'Pedido',
      inputs: { text: 'Aguardando resposta' },
    });
    this.pending.set(ref);
    this.status.set('aguardando');
    this.result.set('—');
    const subscription = ref.asRequest<string>().subscribe({
      next: (value) => this.result.set(String(value)),
      complete: () => {
        this.status.set('concluída');
        if (this.pending() === ref) this.pending.set(null);
      },
    });
    // Leaving the page cancels the request, which dismisses the tab.
    this.destroyRef.onDestroy(() => subscription.unsubscribe());
  }

  updateInputs(): void {
    this.pending()?.setInputData({ text: `Atualizado às ${new Date().toLocaleTimeString()}` });
  }
}
