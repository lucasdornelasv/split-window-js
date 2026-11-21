import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  type OnDestroy,
  type OnInit,
} from '@angular/core';
import { SplitContainerDirective, SplitWindowManager } from '@split-window/angular';
import { Subscription } from 'rxjs';
import { DemoExampleComponent } from '../shared/demo-example.component';
import { NoteTabComponent } from '../shared/tabs';

const CODE = `<div splitContainer="origem"></div>
<div splitContainer="destino"></div>
<!-- closes when empty; while closed it shows a floating drop panel -->
<div splitContainer="fechavel" [splitContainerOptions]="{ closeWhenEmpty: true, label: 'Fechável' }"></div>

// a tab that cannot leave its container
manager.open(NoteTabComponent, {
  containerKey: 'origem',
  title: 'Presa',
  canMove: (target) => target.containerKey === 'origem',
});

// programmatic move: same method as the drag
ref.moveTo('destino', 0);

manager.tabMoved.subscribe((e) => console.log(e.type, e.fromKey, '->', e.toKey));`;

@Component({
  imports: [DemoExampleComponent, SplitContainerDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Drag and drop</h1>
    <p>
      Arraste pela aba para reordenar ou mover para outro container: na barra, a aba cai na posição
      do placeholder; na área de conteúdo, no fim. O componente não é recriado, e o estado (contador
      e texto) continua. Containers fechados aparecem como um painel flutuante durante o arraste.
    </p>
    <demo-example name="drag" heading="Reordenar, mover, zonas de soltura e canMove" [code]="code">
      <div class="demo-actions">
        <button type="button" class="demo-button primary" data-action="seed" (click)="seed()">
          Abrir abas de exemplo
        </button>
        <button
          type="button"
          class="demo-button"
          data-action="open-closable"
          (click)="openClosable()"
        >
          Abrir no fechável
        </button>
        <button type="button" class="demo-button" data-action="move-first" (click)="moveFirst()">
          moveTo('destino', 0) na primeira aba da origem
        </button>
      </div>
      <div class="demo-grid">
        <div class="demo-host" data-host="origem" splitContainer="origem"></div>
        <div class="demo-host" data-host="destino" splitContainer="destino"></div>
        <div
          class="demo-host"
          data-host="fechavel"
          splitContainer="fechavel"
          [splitContainerOptions]="{ closeWhenEmpty: true, label: 'Fechável' }"
        ></div>
      </div>
      <pre class="demo-log" data-log="moves">{{ log().join('\\n') }}</pre>
    </demo-example>
  `,
})
export default class DragPage implements OnInit, OnDestroy {
  private readonly manager = inject(SplitWindowManager);
  private readonly subscription = new Subscription();
  readonly code = CODE;
  readonly log = signal<string[]>([]);

  ngOnInit(): void {
    this.subscription.add(
      this.manager.tabMoved.subscribe((e) =>
        this.log.update((l) => [
          ...l,
          `${e.ref.label}: ${e.type} ${e.fromKey}[${e.fromIndex}] -> ${e.toKey}[${e.toIndex}]`,
        ]),
      ),
    );
    this.subscription.add(
      this.manager.containerStateChanged.subscribe((s) =>
        this.log.update((l) => [...l, `${s.key}: ${s.open ? 'aberto' : 'fechado'}`]),
      ),
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  seed(): void {
    for (const title of ['Alfa', 'Beta', 'Gama']) {
      this.manager.open(NoteTabComponent, { containerKey: 'origem', title });
    }
    this.manager.open(NoteTabComponent, {
      containerKey: 'origem',
      title: 'Presa',
      canMove: (target) => target.containerKey === 'origem',
    });
    this.manager.open(NoteTabComponent, { containerKey: 'destino', title: 'Delta' });
  }

  openClosable(): void {
    this.manager.open(NoteTabComponent, { containerKey: 'fechavel', title: 'Temporária' });
  }

  moveFirst(): void {
    this.manager.getTabs('origem')[0]?.moveTo('destino', 0);
  }
}
