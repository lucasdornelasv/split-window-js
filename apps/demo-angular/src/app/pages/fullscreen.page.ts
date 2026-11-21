import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  SplitContainerDirective,
  SplitWindowManager,
  type SplitContainerOptions,
} from '@split-window/angular';
import { DemoExampleComponent } from '../shared/demo-example.component';
import { NoteTabComponent } from '../shared/tabs';

const CODE = `// default: the whole window
<div splitContainer="janela"></div>

// limited to a reference area, with max sizes, margin and alignment
<div splitContainer="area" [splitContainerOptions]="{
  expand: { bounds: '#area-referencia', maxWidth: 640, maxHeight: '80%', margin: 16, align: 'start' }
}"></div>

// no full screen button
<div splitContainer="sem-expandir" [splitContainerOptions]="{ expand: false }"></div>

// API
manager.expandContainer('janela');
manager.restoreContainer('janela');
manager.containerStateChanged.subscribe(({ key, expanded }) => ...);`;

@Component({
  imports: [DemoExampleComponent, SplitContainerDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Tela cheia</h1>
    <p>
      O botão ⤢ expande o container sobre a página; Esc, o botão de novo ou
      <code>restoreContainer</code> restauram. Só um container fica expandido por vez, e enquanto
      isso o arraste só reordena dentro dele. O último container está dentro de um ancestral com
      <code>transform</code>: a engine detecta e usa uma camada no body.
    </p>
    <demo-example name="fullscreen" heading="expand" [code]="code">
      <div class="demo-actions">
        <button type="button" class="demo-button primary" data-action="seed" (click)="seed()">
          Abrir abas
        </button>
        <button
          type="button"
          class="demo-button"
          data-action="expand-api"
          (click)="manager.expandContainer('janela')"
        >
          expandContainer('janela')
        </button>
      </div>
      <div id="area-referencia" class="reference" data-host="area-referencia">
        <span>Área de referência do container "area"</span>
      </div>
      <div class="demo-grid">
        <div class="demo-host" data-host="janela" splitContainer="janela"></div>
        <div
          class="demo-host"
          data-host="area"
          splitContainer="area"
          [splitContainerOptions]="areaOptions"
        ></div>
        <div
          class="demo-host"
          data-host="sem-expandir"
          splitContainer="sem-expandir"
          [splitContainerOptions]="{ expand: false }"
        ></div>
        <div class="transformed">
          <div class="demo-host" data-host="transformado" splitContainer="transformado"></div>
        </div>
      </div>
    </demo-example>
  `,
  styles: `
    .reference {
      height: 220px;
      margin-bottom: 12px;
      border: 2px dashed var(--demo-border);
      border-radius: 8px;
      display: flex;
      align-items: flex-end;
      padding: 8px;
      color: var(--demo-muted);
    }
    .transformed {
      transform: translateZ(0);
    }
  `,
})
export default class FullscreenPage {
  readonly manager = inject(SplitWindowManager);
  readonly code = CODE;
  readonly areaOptions: SplitContainerOptions = {
    expand: {
      bounds: '#area-referencia',
      maxWidth: 640,
      maxHeight: '80%',
      margin: 16,
      align: 'start',
    },
  };

  seed(): void {
    for (const key of ['janela', 'area', 'sem-expandir', 'transformado']) {
      this.manager.open(NoteTabComponent, { containerKey: key, title: key });
      this.manager.open(NoteTabComponent, { containerKey: key, title: key });
    }
  }
}
