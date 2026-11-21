import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SplitWindowManager } from '@split-window/angular';
import { DemoExampleComponent } from '../shared/demo-example.component';
import { NoteTabComponent } from '../shared/tabs';

const CODE = `// app.config.ts
providers: [
  provideSplitWindows(),
  provideAppInitializer(() => {
    // only body-right, no tab limit, as the default container
    inject(SplitContainerRegistry).useBodyContainers();
  }),
]

// any component
private manager = inject(SplitWindowManager);

open() {
  const ref = this.manager.open(NoteTabComponent, { title: 'Nota' });
  ref.result.then((value) => console.log('closed with', value), () => {});
}`;

@Component({
  imports: [DemoExampleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Início rápido</h1>
    <p>
      <code>provideSplitWindows()</code> registra a biblioteca,
      <code>useBodyContainers()</code> habilita o container da borda direita como padrão, e
      <code>open()</code> abre um componente como aba.
    </p>
    <demo-example name="quick-start" heading="Abrir uma aba" [code]="code">
      <div class="demo-actions">
        <button type="button" class="demo-button primary" data-action="open-note" (click)="open()">
          Abrir aba
        </button>
      </div>
      <p>Abra várias vezes para ver a numeração: Nota, Nota (2), Nota (3)…</p>
    </demo-example>
  `,
})
export default class QuickStartPage {
  private readonly manager = inject(SplitWindowManager);
  readonly code = CODE;

  open(): void {
    this.manager.open(NoteTabComponent, { title: 'Nota' });
  }
}
