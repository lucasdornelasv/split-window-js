import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { SplitContainerRegistry, SplitWindowManager } from '@split-window/angular';
import { SplitContainerRegistry as CoreSplitContainerRegistry } from '@split-window/core';
import { DemoExampleComponent } from '../shared/demo-example.component';
import { NoteTabComponent } from '../shared/tabs';

const CODE = `try {
  manager.open(NoteTabComponent, { containerKey: 'contratos' });
} catch (e) {
  if (e instanceof SplitContainerNotFoundError) {
    console.log(e.containerKey, e.availableKeys);
  }
}

// SplitContainerNotFoundError   unknown key, or a body side that is not enabled
// SplitNoDefaultContainerError  no containerKey and no container configured
// SplitContainerFullError       tab limit with onReject: 'throw'
// SplitReservedContainerKeyError registerContainer('body-left', ...)
// SplitDuplicateContainerError  key already registered
// SplitInvalidOptionError       invalid option value`;

interface Scenario {
  id: string;
  label: string;
  run: () => unknown;
}

@Component({
  imports: [DemoExampleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Erros</h1>
    <p>
      Cada erro de resolução tem uma mensagem que diz o que configurar e expõe os dados como
      propriedades.
    </p>
    <demo-example name="errors" heading="Erros de resolução e chaves reservadas" [code]="code">
      <div class="demo-actions">
        @for (s of scenarios; track s.id) {
          <button type="button" class="demo-button" [attr.data-error]="s.id" (click)="run(s)">
            {{ s.label }}
          </button>
        }
      </div>
      @if (result(); as r) {
        <p role="alert" data-field="error-name">
          <strong>{{ r.name }}</strong>
        </p>
        <p data-field="error-message">{{ r.message }}</p>
      }
    </demo-example>
  `,
})
export default class ErrorsPage {
  private readonly manager = inject(SplitWindowManager);
  private readonly registry = inject(SplitContainerRegistry);
  readonly code = CODE;
  readonly result = signal<{ name: string; message: string } | null>(null);

  readonly scenarios: Scenario[] = [
    {
      id: 'not-found',
      label: "containerKey: 'contratos'",
      run: () => this.manager.open(NoteTabComponent, { containerKey: 'contratos' }),
    },
    {
      id: 'body-disabled',
      label: "containerKey: 'body-left'",
      run: () => this.manager.open(NoteTabComponent, { containerKey: 'body-left' }),
    },
    {
      id: 'no-default',
      label: 'Nenhum container configurado',
      // The first configured container is the automatic default, so this error only
      // happens with no container at all: an empty registry of the core shows it.
      run: () => new CoreSplitContainerRegistry<HTMLElement>().resolveKey(),
    },
    {
      id: 'reserved',
      label: "registerContainer('body-top')",
      run: () => this.registry.registerContainer('body-top', document.body),
    },
    {
      id: 'invalid',
      label: 'maxTabs: 0',
      run: () => this.registry.registerContainer('invalido', document.body, { maxTabs: 0 }),
    },
  ];

  run(scenario: Scenario): void {
    try {
      scenario.run();
      this.result.set({ name: 'Sem erro', message: '' });
    } catch (e) {
      this.result.set({ name: (e as Error).name, message: (e as Error).message });
    }
  }
}
