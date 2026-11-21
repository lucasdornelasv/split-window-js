import { ChangeDetectionStrategy, Component, inject, signal, type OnDestroy } from '@angular/core';
import {
  SplitContainerRegistry,
  SplitWindowManager,
  type SplitBodyContainersConfig,
  type SplitBodySide,
} from '@split-window/angular';
import { DemoExampleComponent } from '../shared/demo-example.component';
import { NoteTabComponent } from '../shared/tabs';

const CONFIGS: Record<string, { label: string; config?: SplitBodyContainersConfig; code: string }> =
  {
    minimal: {
      label: 'Mínima',
      code: `registry.useBodyContainers(); // only body-right, as the default`,
    },
    full: {
      label: 'Quatro lados',
      config: {
        defaults: { maxTabs: 8, onFull: 'replace-lru' },
        left: { size: '320px' },
        right: true,
        top: { size: '30vh' },
        bottom: { size: '35vh', maxTabs: 4, onFull: 'reject', onReject: 'redirect-default' },
        default: 'left',
      },
      code: `registry.useBodyContainers({
  defaults: { maxTabs: 8, onFull: 'replace-lru' },
  left: { size: '320px' },
  right: true,
  top: { size: '30vh' },
  bottom: { size: '35vh', maxTabs: 4, onFull: 'reject', onReject: 'redirect-default' },
  default: 'left',
});`,
    },
    backdrop: {
      label: 'Direita com backdrop',
      config: { right: { size: '40vw', backdrop: true }, default: 'right' },
      code: `registry.useBodyContainers({
  right: { size: '40vw', backdrop: true },
  default: 'right',
});`,
    },
    push: {
      label: 'Direita empurrando',
      config: { right: { size: '360px', mode: 'push', animation: true }, default: 'right' },
      code: `registry.useBodyContainers({
  // push: the page gets padding-right while the panel is open; animated
  right: { size: '360px', mode: 'push', animation: true },
  default: 'right',
});`,
    },
  };

@Component({
  imports: [DemoExampleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Containers do body</h1>
    <p>
      Até quatro painéis fixos nas bordas da janela, criados no primeiro <code>open()</code> e
      fechados quando ficam vazios. Reconfigurar substitui a configuração anterior: lados não
      informados são desabilitados e as abas deles recebem
      <code>dismiss('container-removed')</code>.
    </p>
    <demo-example name="body" heading="Configuração e reconfiguração" [code]="code()">
      <div class="demo-actions">
        @for (entry of configs; track entry[0]) {
          <button
            type="button"
            class="demo-button"
            [class.primary]="current() === entry[0]"
            [attr.data-config]="entry[0]"
            (click)="apply(entry[0])"
          >
            {{ entry[1].label }}
          </button>
        }
      </div>
      <div class="demo-actions">
        @for (side of sides; track side) {
          <button
            type="button"
            class="demo-button"
            [attr.data-open-side]="side"
            [disabled]="!enabled(side)"
            (click)="open(side)"
          >
            Abrir em body-{{ side }}
          </button>
        }
      </div>
      <p>
        Padrão atual: <code data-field="default">{{ defaultKey() ?? 'nenhum' }}</code>
      </p>
    </demo-example>
  `,
})
export default class BodyPage implements OnDestroy {
  private readonly manager = inject(SplitWindowManager);
  private readonly registry = inject(SplitContainerRegistry);
  readonly configs = Object.entries(CONFIGS);
  readonly sides: SplitBodySide[] = ['left', 'right', 'top', 'bottom'];
  readonly current = signal('minimal');
  readonly code = signal(CONFIGS['minimal']!.code);
  readonly defaultKey = signal(this.registry.getDefaultContainer());
  private readonly version = signal(0);

  enabled(side: SplitBodySide): boolean {
    this.version();
    return this.registry.hasContainer(`body-${side}`);
  }

  apply(name: string): void {
    const entry = CONFIGS[name]!;
    this.registry.useBodyContainers(entry.config);
    this.current.set(name);
    this.code.set(entry.code);
    this.defaultKey.set(this.registry.getDefaultContainer());
    this.version.update((v) => v + 1);
  }

  open(side: SplitBodySide): void {
    this.manager.open(NoteTabComponent, { containerKey: `body-${side}`, title: `Aba ${side}` });
  }

  ngOnDestroy(): void {
    // Back to the app configuration.
    if (this.current() !== 'minimal') this.registry.useBodyContainers();
  }
}
