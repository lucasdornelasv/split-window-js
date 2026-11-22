import { ChangeDetectionStrategy, Component, inject, signal, type OnDestroy } from '@angular/core';
import {
  SplitContainerDirective,
  SplitContainerRegistry,
  PushSplitContainerMode,
  SplitWindowManager,
  type SplitAnimationContext,
  type SplitContainerOptions,
  type SplitModeSettings,
} from '@split-window/angular';
import { CssSplitAnimationEngine } from '@split-window/css-animation';
import { DemoExampleComponent } from '../shared/demo-example.component';
import { NoteTabComponent } from '../shared/tabs';

/** A mode by class: extends the built-in push and adds its own settings. */
export class CompactPushMode extends PushSplitContainerMode {
  override settings(): SplitModeSettings {
    return { size: '240px', panelClass: 'demo-compact', animation: { preset: 'collapse' } };
  }
}

/** An engine by class: the CSS engine with a slower duration. */
export class SlowCssEngine extends CssSplitAnimationEngine {
  protected override duration(): string {
    return '700ms';
  }
}

/** An engine by function: reveals the panel with a clip-path. */
function clipEngine(ctx: SplitAnimationContext): Promise<void> | void {
  const { shell } = ctx.elements;
  if (typeof shell.animate !== 'function') return;
  ctx.started();
  const frames = [{ clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0 0)' }];
  const animation = shell.animate(ctx.phase === 'show' ? frames : frames.reverse(), {
    duration: 320,
    easing: 'ease-out',
    fill: 'both',
  });
  ctx.signal.addEventListener('abort', () => animation.cancel());
  return animation.finished.then(
    () => animation.cancel(),
    () => undefined,
  );
}

const LAYOUTS_CODE = `<!-- push: the host grows and pushes the content -->
<div splitContainer="modo-push" [splitContainerOptions]="{
  mode: 'push', side: 'right', size: '320px', closeWhenEmpty: true, animation: true
}"></div>

<!-- overlay: the host is an anchor; the panel floats over the content -->
<div splitContainer="modo-overlay" [splitContainerOptions]="{
  mode: 'overlay', side: 'right', size: '320px', closeWhenEmpty: true, animation: true
}"></div>

<!-- body: push instead of overlay -->
registry.useBodyContainers({ right: { mode: 'push', size: '360px', animation: true } });`;

const ENGINES_CODE = `// engines registered globally, by name; the first one is the default
provideSplitWindows({
  animationEngines: {
    css: new CssSplitAnimationEngine(),
    keyframes: () => new KeyframesSplitAnimationEngine(),
  },
});
{ animation: true }                       // css (the first registered)
{ animation: { engine: 'keyframes' } }    // by name
{ animation: { engine: 'none' } }         // noop: events only, nothing moves

// presets of your own, added to each engine with addPreset (it returns the engine)
provideSplitWindows({
  animationEngines: {
    css: new CssSplitAnimationEngine().addPreset('pop', {
      variables: { '--pop-scale': '0.92' },
      styles: \`[data-split-animation='pop']:is(.split-enter-from, .split-hiding) {
        opacity: 0; transform: scale(var(--pop-scale)); } ...\`,
    }),
    keyframes: new KeyframesSplitAnimationEngine().addPreset('pop', {
      show: [{ opacity: 0, transform: 'scale(0.92)' }, { opacity: 1, transform: 'none' }],
    }),
  },
});
{ mode: 'overlay', animation: { engine: 'css', preset: 'pop', duration: 300 } }
{ mode: 'overlay', animation: { engine: 'keyframes', duration: 300, show: 'pop', hide: 'slide' } }

// an engine by class, extending the CSS engine
class SlowCssEngine extends CssSplitAnimationEngine {
  protected override duration() { return '700ms'; }
}
{ mode: 'overlay', animation: { engine: SlowCssEngine } }

// an engine by function: gets elements, frames (from/to), signal and started()
function clipEngine(ctx: SplitAnimationContext) {
  ctx.started();
  const a = ctx.elements.shell.animate(frames, { duration: 320, fill: 'both' });
  ctx.signal.addEventListener('abort', () => a.cancel());
  return a.finished.then(() => a.cancel());
}
{ mode: 'overlay', animation: clipEngine }`;

const MODES_CODE = `// global, in provideSplitWindows()
provideSplitWindows({
  modes: {
    drawer: { extends: 'overlay', size: '300px', panelClass: 'demo-drawer',
              animation: { preset: 'slide', duration: 260 } },
  },
});
{ mode: 'drawer', closeWhenEmpty: true }

// by class (created with DI, can inject())
class CompactPushMode extends PushSplitContainerMode {
  override settings() {
    return { size: '240px', panelClass: 'demo-compact', animation: { preset: 'collapse' } };
  }
}
{ mode: CompactPushMode, closeWhenEmpty: true }

// local object over a global mode, and a function
{ mode: { extends: 'drawer', side: 'left', hostClass: 'demo-left' } }
{ mode: (ctx) => (window.innerWidth < 800 ? 'overlay' : 'push') }`;

@Component({
  imports: [DemoExampleComponent, SplitContainerDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Modos e animação</h1>
    <p>
      Qualquer container pode ficar <code>inline</code> (padrão dos custom),
      <code>push</code> (empurra o conteúdo) ou <code>overlay</code> (flutua sobre ele, padrão do
      body). Com <code>closeWhenEmpty</code> e animação, a última aba continua na tela enquanto o
      container sai e só é destruída no fim.
    </p>

    <demo-example name="modes-layouts" heading="push e overlay" [code]="layoutsCode">
      <div class="demo-actions">
        <button
          type="button"
          class="demo-button"
          data-action="open-push"
          (click)="open('modo-push')"
        >
          Abrir no push
        </button>
        <button
          type="button"
          class="demo-button"
          data-action="open-overlay"
          (click)="open('modo-overlay')"
        >
          Abrir no overlay
        </button>
        <button type="button" class="demo-button" data-action="body-push" (click)="bodyPush()">
          Body em push
        </button>
      </div>
      <div class="modes-row">
        <div class="modes-content">Conteúdo da página: encolhe quando o push abre.</div>
        <div data-host="modo-push" splitContainer="modo-push" [splitContainerOptions]="push"></div>
      </div>
      <div class="modes-row">
        <div class="modes-content">Conteúdo da página: fica por baixo do overlay.</div>
        <div
          data-host="modo-overlay"
          splitContainer="modo-overlay"
          [splitContainerOptions]="overlay"
        ></div>
      </div>
    </demo-example>

    <demo-example name="modes-engines" heading="Motores de animação" [code]="enginesCode">
      <div class="demo-actions">
        @for (key of engineKeys; track key) {
          <button type="button" class="demo-button" [attr.data-open]="key" (click)="open(key)">
            Abrir em {{ key }}
          </button>
        }
      </div>
      @for (key of engineKeys; track key) {
        <div class="modes-row">
          <div class="modes-content">{{ key }}</div>
          <div
            [attr.data-host]="key"
            [splitContainer]="key"
            [splitContainerOptions]="engines[key]"
          ></div>
        </div>
      }
    </demo-example>

    <demo-example
      name="modes-custom"
      heading="Modos globais, por classe e locais"
      [code]="modesCode"
    >
      <div class="demo-actions">
        @for (key of modeKeys; track key) {
          <button type="button" class="demo-button" [attr.data-open]="key" (click)="open(key)">
            Abrir em {{ key }}
          </button>
        }
      </div>
      @for (key of modeKeys; track key) {
        <div class="modes-row">
          @if (key === 'modo-esquerda') {
            <div
              [attr.data-host]="key"
              [splitContainer]="key"
              [splitContainerOptions]="modes[key]"
            ></div>
          }
          <div class="modes-content">{{ key }}</div>
          @if (key !== 'modo-esquerda') {
            <div
              [attr.data-host]="key"
              [splitContainer]="key"
              [splitContainerOptions]="modes[key]"
            ></div>
          }
        </div>
      }
      <h2>containerTransitions</h2>
      <pre class="demo-log" data-log="transitions">{{ log().join('\\n') }}</pre>
    </demo-example>
  `,
  styles: `
    .modes-row {
      display: flex;
      height: 200px;
      margin: 0 0 12px;
      border: 1px dashed var(--demo-border);
      border-radius: 6px;
      overflow: hidden;
    }
    .modes-content {
      flex: 1 1 auto;
      min-width: 0;
      padding: 12px;
      color: var(--demo-muted);
    }
  `,
})
export default class ModesPage implements OnDestroy {
  private readonly manager = inject(SplitWindowManager);
  private readonly registry = inject(SplitContainerRegistry);
  private bodyChanged = false;
  readonly layoutsCode = LAYOUTS_CODE;
  readonly enginesCode = ENGINES_CODE;
  readonly modesCode = MODES_CODE;
  readonly log = signal<string[]>([]);

  readonly push: SplitContainerOptions = {
    mode: 'push',
    side: 'right',
    size: '320px',
    closeWhenEmpty: true,
    animation: true,
    label: 'Push',
  };
  readonly overlay: SplitContainerOptions = {
    mode: 'overlay',
    side: 'right',
    size: '320px',
    closeWhenEmpty: true,
    animation: true,
    label: 'Overlay',
  };

  readonly engineKeys = [
    'preset-css',
    'preset-keyframes',
    'motor-nome',
    'motor-classe',
    'motor-funcao',
  ] as const;
  readonly engines: Record<string, SplitContainerOptions> = {
    // The "pop" preset added to both engines in app.config.ts.
    'preset-css': {
      mode: 'overlay',
      size: '300px',
      closeWhenEmpty: true,
      animation: { engine: 'css', preset: 'pop', duration: 300 },
    },
    'preset-keyframes': {
      mode: 'overlay',
      size: '300px',
      closeWhenEmpty: true,
      animation: { engine: 'keyframes', duration: 300, show: 'pop', hide: 'slide' },
    },
    'motor-nome': {
      mode: 'overlay',
      size: '300px',
      closeWhenEmpty: true,
      animation: { engine: 'keyframes', preset: 'fade', duration: 250 },
    },
    'motor-classe': {
      mode: 'overlay',
      size: '300px',
      closeWhenEmpty: true,
      animation: { engine: SlowCssEngine },
    },
    'motor-funcao': {
      mode: 'overlay',
      size: '300px',
      closeWhenEmpty: true,
      animation: clipEngine,
    },
  };

  readonly modeKeys = ['modo-drawer', 'modo-classe', 'modo-esquerda'] as const;
  readonly modes: Record<string, SplitContainerOptions> = {
    'modo-drawer': { mode: 'drawer', closeWhenEmpty: true },
    'modo-classe': { mode: CompactPushMode, closeWhenEmpty: true },
    'modo-esquerda': {
      mode: { extends: 'drawer', side: 'left', hostClass: 'demo-left' },
      closeWhenEmpty: true,
    },
  };

  private readonly subscription = this.manager.containerTransitions.subscribe((e) => {
    if (e.state === 'running' && e.progress === undefined) return;
    this.log.update((l) => [...l.slice(-11), `${e.key}: ${e.phase} ${e.state}`]);
  });

  open(key: string): void {
    const count = this.manager.getTabs(key).length + 1;
    this.manager.open(NoteTabComponent, { containerKey: key, title: `Aba ${count}` });
  }

  bodyPush(): void {
    this.registry.useBodyContainers({
      right: { mode: 'push', size: '360px', animation: true },
      default: 'right',
    });
    this.bodyChanged = true;
    this.manager.open(NoteTabComponent, { containerKey: 'body-right', title: 'Body push' });
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    // Back to the app configuration.
    if (this.bodyChanged) this.registry.useBodyContainers();
  }
}
