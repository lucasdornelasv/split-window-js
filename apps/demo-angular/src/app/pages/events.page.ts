import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  type OnDestroy,
  type OnInit,
} from '@angular/core';
import {
  SplitContainerDirective,
  SplitWindowManager,
  type SplitWindowRef,
} from '@split-window/angular';
import { Subscription, merge, map } from 'rxjs';
import { DemoExampleComponent } from '../shared/demo-example.component';
import { NoteTabComponent } from '../shared/tabs';

const CODE = `const ref = manager.open(NoteTabComponent, { containerKey: 'eventos-a' });

ref.activated.subscribe(() => ...);
ref.deactivated.subscribe(() => ...);
ref.titleChanged.subscribe(({ title, label }) => ...);
ref.dragStarted.subscribe(() => ...);
ref.dragEnded.subscribe(({ moved }) => ...);
ref.reordered.subscribe(({ from, to }) => ...);
ref.containerChanged.subscribe(({ fromKey, toKey, index, label }) => ...);
ref.closePrevented.subscribe(({ trigger, reason }) => ...);
ref.closed.subscribe((result) => ...);      // before destroy
ref.dismissed.subscribe((reason) => ...);   // before destroy
ref.hidden.subscribe(() => ...);            // after destroy; every observable completes

manager.tabMoved.subscribe((e) => ...);
manager.tabRejected.subscribe((e) => ...);
manager.containerStateChanged.subscribe(({ key, open, expanded }) => ...);`;

@Component({
  imports: [DemoExampleComponent, SplitContainerDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Eventos</h1>
    <p>Log ao vivo dos eventos das refs, e do manager.</p>
    <demo-example name="events" heading="Log de eventos" [code]="code">
      <div class="demo-actions">
        <button type="button" class="demo-button primary" data-action="open" (click)="open()">
          Abrir aba
        </button>
        <button type="button" class="demo-button" data-action="rename" (click)="renameLast()">
          Renomear a última
        </button>
        <button type="button" class="demo-button" data-action="move" (click)="moveLast()">
          Mover a última
        </button>
        <button type="button" class="demo-button" data-action="clear" (click)="log.set([])">
          Limpar log
        </button>
      </div>
      <div class="demo-grid">
        <div class="demo-host" data-host="eventos-a" splitContainer="eventos-a"></div>
        <div
          class="demo-host"
          data-host="eventos-b"
          splitContainer="eventos-b"
          [splitContainerOptions]="{ closeWhenEmpty: true }"
        ></div>
      </div>
      <pre class="demo-log" data-log="events">{{ log().join('\\n') }}</pre>
    </demo-example>
  `,
})
export default class EventsPage implements OnInit, OnDestroy {
  private readonly manager = inject(SplitWindowManager);
  private readonly subscription = new Subscription();
  private count = 0;
  readonly code = CODE;
  readonly log = signal<string[]>([]);

  ngOnInit(): void {
    this.subscription.add(
      this.manager.tabMoved.subscribe((e) =>
        this.write(`manager.tabMoved ${e.ref.label} ${e.type}`),
      ),
    );
    this.subscription.add(
      this.manager.tabRejected.subscribe((e) => this.write(`manager.tabRejected ${e.resolution}`)),
    );
    this.subscription.add(
      this.manager.containerStateChanged.subscribe((s) =>
        this.write(`manager.containerStateChanged ${s.key} open=${s.open} expanded=${s.expanded}`),
      ),
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  open(): void {
    const ref = this.manager.open(NoteTabComponent, {
      containerKey: 'eventos-a',
      title: `Aba ${++this.count}`,
    });
    this.watch(ref);
  }

  renameLast(): void {
    this.last()?.setTitle(`Renomeada ${++this.count}`);
  }

  moveLast(): void {
    const ref = this.last();
    ref?.moveTo(ref.containerKey === 'eventos-a' ? 'eventos-b' : 'eventos-a');
  }

  private last(): SplitWindowRef | undefined {
    const tabs = [...this.manager.getTabs('eventos-a'), ...this.manager.getTabs('eventos-b')];
    return tabs[tabs.length - 1];
  }

  private watch(ref: SplitWindowRef): void {
    const name = () => ref.label;
    this.subscription.add(
      merge(
        ref.activated.pipe(map(() => 'activated')),
        ref.deactivated.pipe(map(() => 'deactivated')),
        ref.titleChanged.pipe(map((e) => `titleChanged ${e.label}`)),
        ref.dragStarted.pipe(map(() => 'dragStarted')),
        ref.dragEnded.pipe(map((e) => `dragEnded moved=${e.moved}`)),
        ref.reordered.pipe(map((e) => `reordered ${e.from}->${e.to}`)),
        ref.containerChanged.pipe(map((e) => `containerChanged ${e.fromKey}->${e.toKey}`)),
        ref.closePrevented.pipe(map((e) => `closePrevented ${e.trigger}`)),
        ref.closed.pipe(map((v) => `closed ${String(v)}`)),
        ref.dismissed.pipe(map((v) => `dismissed ${String(v)}`)),
        ref.hidden.pipe(map(() => 'hidden')),
      ).subscribe((event) => this.write(`ref ${name()} ${event}`)),
    );
  }

  private write(line: string): void {
    this.log.update((l) => [...l.slice(-199), line]);
  }
}
