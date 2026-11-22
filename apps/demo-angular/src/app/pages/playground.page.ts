import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
  type AfterViewInit,
  type OnDestroy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SplitContainerRegistry, SplitWindowManager } from '@split-window/angular';
import { DemoExampleComponent } from '../shared/demo-example.component';
import { NoteTabComponent } from '../shared/tabs';
import {
  CONTAINER_KEYS,
  CUSTOM_KEYS,
  EASINGS,
  ENGINES,
  MODES,
  ON_FULL,
  ON_REJECT,
  ORIGINS,
  PHASES,
  PRESETS,
  SIDES,
  bodyConfig,
  containerOptions,
  initialState,
  isBody,
  openOptions,
  playgroundCode,
  type ContainerConfig,
  type ContainerKey,
  type CustomKey,
  type OpenConfig,
  type Phase,
  type PhaseConfig,
  type PlaygroundState,
} from './playground.model';

const errorText = (e: unknown) => `${(e as Error).name}: ${(e as Error).message}`;

@Component({
  imports: [DemoExampleComponent, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Playground</h1>
    <p>
      Ative containers da página e do body, edite as opções de cada um e abra abas com qualquer
      combinação de opções. As mudanças valem na hora: os containers do body são reconfigurados com
      <code>useBodyContainers()</code> (as abas continuam), e um container da página é registrado de
      novo (as abas dele são fechadas). As opções globais do
      <code>provideSplitWindows()</code> valem na inicialização e aparecem no código.
    </p>
    <demo-example name="playground" heading="Todas as opções" [code]="code()">
      <div class="pg-grid">
        <fieldset>
          <legend>Containers</legend>
          <table class="pg-table">
            <thead>
              <tr>
                <th scope="col">Ativo</th>
                <th scope="col">Container</th>
                <th scope="col">Padrão</th>
                <th scope="col">Opções</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td></td>
                <td>automático</td>
                <td>
                  <input
                    type="radio"
                    name="pg-default"
                    data-default="auto"
                    aria-label="Padrão automático: o primeiro container configurado"
                    [checked]="state().defaultKey === ''"
                    (change)="setDefault('')"
                  />
                </td>
                <td></td>
              </tr>
              @for (key of keys; track key) {
                <tr [class.pg-selected]="selected() === key">
                  <td>
                    <input
                      type="checkbox"
                      [attr.data-enable]="key"
                      [attr.aria-label]="'Ativar ' + key"
                      [checked]="state().containers[key].enabled"
                      (change)="patchContainer(key, { enabled: checked($event) })"
                    />
                  </td>
                  <td>
                    <code>{{ key }}</code>
                    <small class="pg-kind">{{ isBody(key) ? 'body' : 'página' }}</small>
                  </td>
                  <td>
                    <input
                      type="radio"
                      name="pg-default"
                      [attr.data-default]="key"
                      [attr.aria-label]="'Padrão: ' + key"
                      [disabled]="!state().containers[key].enabled"
                      [checked]="state().defaultKey === key"
                      (change)="setDefault(key)"
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      class="demo-button"
                      [attr.data-edit]="key"
                      [attr.aria-label]="'Editar ' + key"
                      [attr.aria-pressed]="selected() === key"
                      (click)="selected.set(key)"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
          <p class="pg-note">
            Padrão em vigor:
            <code data-field="effective-default">{{ effectiveDefault() ?? 'nenhum' }}</code>
          </p>
        </fieldset>

        <fieldset data-editor>
          <legend>
            Opções de <code data-field="editing">{{ selected() }}</code>
            @if (!current().enabled) {
              <small>(inativo)</small>
            }
          </legend>
          <label class="demo-field"
            >label
            <input
              data-field="label"
              [ngModel]="current().label"
              (ngModelChange)="patchSelected({ label: $event })"
          /></label>
          <label class="demo-field"
            >mode
            <select
              data-field="mode"
              [ngModel]="current().mode"
              (ngModelChange)="patchSelected({ mode: $event })"
            >
              @for (m of modes; track m) {
                <option [value]="m" [disabled]="m === 'inline' && isBody(selected())">
                  {{ m || (isBody(selected()) ? '(padrão: overlay)' : '(padrão: inline)') }}
                </option>
              }
            </select>
          </label>
          @if (!isBody(selected())) {
            <label class="demo-field"
              >side
              <select
                data-field="side"
                [ngModel]="current().side"
                (ngModelChange)="patchSelected({ side: $event })"
              >
                @for (side of sides; track side) {
                  <option [value]="side">{{ side }}</option>
                }
              </select>
            </label>
          }
          <label class="demo-field"
            >size
            <input
              data-field="size"
              placeholder="ex.: 320px, 30vw"
              [ngModel]="current().size"
              (ngModelChange)="patchSelected({ size: $event })"
          /></label>
          <label class="demo-field"
            >maxTabs
            <input
              type="number"
              min="1"
              data-field="maxTabs"
              [ngModel]="current().maxTabs"
              (ngModelChange)="patchSelected({ maxTabs: $event ? +$event : null })"
          /></label>
          <label class="demo-field"
            >onFull
            <select
              data-field="onFull"
              [ngModel]="current().onFull"
              (ngModelChange)="patchSelected({ onFull: $event })"
            >
              @for (o of onFull; track o) {
                <option [value]="o">{{ o }}</option>
              }
            </select>
          </label>
          <label class="demo-field"
            >onReject
            <select
              data-field="onReject"
              [ngModel]="current().onReject"
              (ngModelChange)="patchSelected({ onReject: $event })"
            >
              @for (o of onReject; track o) {
                <option [value]="o">{{ o }}</option>
              }
            </select>
          </label>
          <label class="demo-check"
            ><input
              type="checkbox"
              data-field="closeWhenEmpty"
              [ngModel]="current().closeWhenEmpty"
              (ngModelChange)="patchSelected({ closeWhenEmpty: $event })"
            />
            closeWhenEmpty</label
          >
          <label class="demo-check"
            ><input
              type="checkbox"
              data-field="animation"
              [ngModel]="current().animation"
              (ngModelChange)="patchSelected({ animation: $event })"
            />
            animation</label
          >
          @if (current().animation) {
            <label class="demo-field"
              >animation.engine
              <select
                data-field="engine"
                [ngModel]="current().engine"
                (ngModelChange)="patchSelected({ engine: $event })"
              >
                @for (e of engines; track e) {
                  <option [value]="e">{{ e || '(o primeiro registrado: css)' }}</option>
                }
              </select>
            </label>
            <p class="pg-note">
              Opções iguais nas duas fases vão para o topo de <code>animation</code> no código.
            </p>
            @for (phase of phases; track phase) {
              <fieldset class="pg-phase" [attr.data-phase]="phase">
                <legend>
                  animation.{{ phase }} ({{ phase === 'show' ? 'abertura' : 'fechamento' }})
                </legend>
                <label class="demo-field"
                  >preset
                  <select
                    [attr.data-field]="phase + '-preset'"
                    [ngModel]="current()[phase].preset"
                    (ngModelChange)="patchPhase(phase, { preset: $event })"
                  >
                    @for (p of presets; track p) {
                      <option [value]="p">{{ p || '(pelo layout)' }}</option>
                    }
                  </select>
                </label>
                <label class="demo-field"
                  >duration (ms)
                  <input
                    type="number"
                    min="0"
                    [attr.data-field]="phase + '-duration'"
                    [ngModel]="current()[phase].duration"
                    (ngModelChange)="patchPhase(phase, { duration: number($event) })"
                /></label>
                <label class="demo-field"
                  >delay (ms)
                  <input
                    type="number"
                    min="0"
                    [attr.data-field]="phase + '-delay'"
                    [ngModel]="current()[phase].delay"
                    (ngModelChange)="patchPhase(phase, { delay: number($event) })"
                /></label>
                <label class="demo-field"
                  >easing
                  <select
                    [attr.data-field]="phase + '-easing'"
                    [ngModel]="current()[phase].easing"
                    (ngModelChange)="patchPhase(phase, { easing: $event })"
                  >
                    @for (e of easings; track e) {
                      <option [value]="e">{{ easingLabel(e, phase) }}</option>
                    }
                  </select>
                </label>
                @if (current()[phase].easing === 'cubic') {
                  <label class="demo-field"
                    >cubicBezier([x1, y1, x2, y2])
                    <input
                      [attr.data-field]="phase + '-cubic'"
                      placeholder="0.2, 0, 0, 1"
                      [ngModel]="current()[phase].cubic"
                      (ngModelChange)="patchPhase(phase, { cubic: $event })"
                  /></label>
                }
                @if (movesPanel(phase)) {
                  <label class="demo-field"
                    >origin
                    <select
                      [attr.data-field]="phase + '-origin'"
                      [ngModel]="current()[phase].origin"
                      (ngModelChange)="patchPhase(phase, { origin: $event })"
                    >
                      @for (o of origins; track o) {
                        <option [value]="o">
                          {{
                            o ||
                              (current()[phase].preset === 'scale'
                                ? '(center)'
                                : '(o lado do container)')
                          }}
                        </option>
                      }
                    </select>
                  </label>
                }
                @if (current()[phase].preset !== 'scale' && movesPanel(phase)) {
                  <label class="demo-field"
                    >distance (slide)
                    <input
                      [attr.data-field]="phase + '-distance'"
                      placeholder="100% (px ou comprimento CSS)"
                      [ngModel]="current()[phase].distance"
                      (ngModelChange)="patchPhase(phase, { distance: $event })"
                  /></label>
                }
                @if (current()[phase].preset === 'scale') {
                  <label class="demo-field"
                    >scale (menor que 1 cresce, maior que 1 encolhe)
                    <input
                      type="number"
                      min="0.05"
                      step="0.05"
                      placeholder="0.9"
                      [attr.data-field]="phase + '-scale'"
                      [ngModel]="current()[phase].scale"
                      (ngModelChange)="patchPhase(phase, { scale: number($event) })"
                  /></label>
                }
              </fieldset>
            }
          }
          <label class="demo-field"
            >panelClass
            <input
              data-field="panelClass"
              placeholder="ex.: demo-drawer"
              [ngModel]="current().panelClass"
              (ngModelChange)="patchSelected({ panelClass: $event })"
          /></label>
          @if (isBody(selected())) {
            <label class="demo-check"
              ><input
                type="checkbox"
                data-field="backdrop"
                [ngModel]="current().backdrop"
                (ngModelChange)="patchSelected({ backdrop: $event })"
              />
              backdrop</label
            >
          }
          <label class="demo-check"
            ><input
              type="checkbox"
              data-field="expand"
              [ngModel]="current().expand"
              (ngModelChange)="patchSelected({ expand: $event })"
            />
            expand (tela cheia)</label
          >
          @if (current().expand) {
            <label class="demo-field"
              >expand.maxWidth
              <input
                data-field="expandMaxWidth"
                placeholder="ex.: 800 ou 60vw"
                [ngModel]="current().expandMaxWidth"
                (ngModelChange)="patchSelected({ expandMaxWidth: $event })"
            /></label>
            <label class="demo-field"
              >expand.margin
              <input
                type="number"
                min="0"
                data-field="expandMargin"
                [ngModel]="current().expandMargin"
                (ngModelChange)="patchSelected({ expandMargin: +$event || 0 })"
            /></label>
            <label class="demo-field"
              >expand.align
              <select
                data-field="expandAlign"
                [ngModel]="current().expandAlign"
                (ngModelChange)="patchSelected({ expandAlign: $event })"
              >
                <option value="center">center</option>
                <option value="start">start</option>
                <option value="end">end</option>
              </select>
            </label>
          }
          <label class="demo-field"
            >closedDropZone.width
            <input
              type="number"
              min="1"
              data-field="dropZoneWidth"
              [ngModel]="current().dropZoneWidth"
              (ngModelChange)="patchSelected({ dropZoneWidth: $event ? +$event : null })"
          /></label>
          <label class="demo-field"
            >closedDropZone.height
            <input
              type="number"
              min="1"
              data-field="dropZoneHeight"
              [ngModel]="current().dropZoneHeight"
              (ngModelChange)="patchSelected({ dropZoneHeight: $event ? +$event : null })"
          /></label>
        </fieldset>

        <fieldset>
          <legend>Abertura</legend>
          <label class="demo-field"
            >containerKey
            <select
              data-field="target"
              [ngModel]="state().open.target"
              (ngModelChange)="patchOpen({ target: $event })"
            >
              <option value="">(o padrão)</option>
              @for (key of keys; track key) {
                <option [value]="key" [disabled]="!state().containers[key].enabled">
                  {{ key }}
                </option>
              }
            </select>
          </label>
          <label class="demo-field"
            >title
            <input
              data-field="title"
              placeholder="vazio: labels.defaultTitle"
              [ngModel]="state().open.title"
              (ngModelChange)="patchOpen({ title: $event })"
          /></label>
          <label class="demo-field"
            >groupKey
            <input
              data-field="groupKey"
              [ngModel]="state().open.groupKey"
              (ngModelChange)="patchOpen({ groupKey: $event })"
          /></label>
          <label class="demo-field"
            >inputs.text
            <input
              data-field="text"
              [ngModel]="state().open.text"
              (ngModelChange)="patchOpen({ text: $event })"
          /></label>
          <label class="demo-check"
            ><input
              type="checkbox"
              data-field="activate"
              [ngModel]="state().open.activate"
              (ngModelChange)="patchOpen({ activate: $event })"
            />
            activate</label
          >
          <label class="demo-check"
            ><input
              type="checkbox"
              data-field="closable"
              [ngModel]="state().open.closable"
              (ngModelChange)="patchOpen({ closable: $event })"
            />
            closable</label
          >
          <label class="demo-check"
            ><input
              type="checkbox"
              data-field="confirmClose"
              [ngModel]="state().open.confirmClose"
              (ngModelChange)="patchOpen({ confirmClose: $event })"
            />
            canClose com confirm()</label
          >
          <label class="demo-check"
            ><input
              type="checkbox"
              data-field="lockToContainer"
              [ngModel]="state().open.lockToContainer"
              (ngModelChange)="patchOpen({ lockToContainer: $event })"
            />
            canMove só no container de origem</label
          >
          <div class="demo-actions">
            <button type="button" class="demo-button primary" data-action="open" (click)="open()">
              open()
            </button>
            <button type="button" class="demo-button" data-action="open-3" (click)="open(3)">
              Abrir 3
            </button>
            <button
              type="button"
              class="demo-button"
              data-action="dismiss-all"
              (click)="dismissAll()"
            >
              dismissAll()
            </button>
            <button type="button" class="demo-button" data-action="reset" (click)="reset()">
              Restaurar padrões
            </button>
          </div>
        </fieldset>
      </div>
      @if (error()) {
        <p role="alert" class="error" data-field="error">{{ error() }}</p>
      }
    </demo-example>

    <div class="pg-stage">
      <div class="pg-row">
        <div
          #esquerdo
          class="pg-host pg-host--side"
          data-host="esquerdo"
          [class.pg-off]="!state().containers.esquerdo.enabled"
        ></div>
        <div class="pg-content">Conteúdo da página (containers esquerdo e direito)</div>
        <div
          #direito
          class="pg-host pg-host--side"
          data-host="direito"
          [class.pg-off]="!state().containers.direito.enabled"
        ></div>
      </div>
      <div class="pg-row pg-row--column">
        <div class="pg-content">Conteúdo da página (container inferior)</div>
        <div
          #inferior
          class="pg-host pg-host--bottom"
          data-host="inferior"
          [class.pg-off]="!state().containers.inferior.enabled"
        ></div>
      </div>
    </div>
  `,
  styles: `
    .pg-grid {
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    }
    fieldset {
      border: 1px solid var(--demo-border);
      border-radius: 6px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 0;
    }
    .pg-table {
      border-collapse: collapse;
      font-size: 0.85rem;
    }
    .pg-table th,
    .pg-table td {
      padding: 2px 4px;
      text-align: left;
      border-bottom: 1px solid var(--demo-border);
    }
    .pg-selected {
      background: var(--demo-surface);
    }
    .pg-phase {
      gap: 6px;
    }
    .pg-kind,
    .pg-note {
      color: var(--demo-muted);
      font-size: 0.8rem;
    }
    .demo-check {
      display: flex;
      gap: 6px;
      align-items: center;
      font-size: 0.9rem;
    }
    .error {
      color: #cf222e;
    }
    .pg-stage {
      display: grid;
      gap: 12px;
    }
    .pg-row {
      display: flex;
      height: 260px;
      border: 1px dashed var(--demo-border);
      border-radius: 6px;
      overflow: hidden;
    }
    .pg-row--column {
      flex-direction: column;
      height: 320px;
    }
    .pg-content {
      flex: 1 1 auto;
      min-width: 0;
      min-height: 0;
      padding: 12px;
      color: var(--demo-muted);
    }
    .pg-host--side {
      flex: 0 0 280px;
      min-width: 0;
    }
    .pg-host--bottom {
      flex: 0 0 170px;
      min-height: 0;
    }
    .pg-off {
      display: none;
    }
  `,
})
export default class PlaygroundPage implements AfterViewInit, OnDestroy {
  private readonly manager = inject(SplitWindowManager);
  private readonly registry = inject(SplitContainerRegistry);
  private readonly esquerdo = viewChild.required<ElementRef<HTMLElement>>('esquerdo');
  private readonly direito = viewChild.required<ElementRef<HTMLElement>>('direito');
  private readonly inferior = viewChild.required<ElementRef<HTMLElement>>('inferior');
  private readonly hosts: Record<CustomKey, () => ElementRef<HTMLElement>> = {
    esquerdo: this.esquerdo,
    direito: this.direito,
    inferior: this.inferior,
  };
  /** Options applied to each registered container of the page, as JSON. */
  private readonly applied = new Map<CustomKey, string>();
  private appliedBody: string | null = null;

  readonly keys = CONTAINER_KEYS;
  readonly modes = MODES;
  readonly sides = SIDES;
  readonly engines = ENGINES;
  readonly presets = PRESETS;
  readonly phases = PHASES;
  readonly origins = ORIGINS;
  readonly easings = EASINGS;
  readonly onFull = ON_FULL;
  readonly onReject = ON_REJECT;
  readonly isBody = isBody;

  readonly state = signal<PlaygroundState>(initialState());
  readonly selected = signal<ContainerKey>('esquerdo');
  readonly current = computed(() => this.state().containers[this.selected()]);
  readonly code = computed(() => playgroundCode(this.state()));
  readonly error = signal('');
  readonly effectiveDefault = signal<string | null>(null);

  ngAfterViewInit(): void {
    this.apply();
  }

  ngOnDestroy(): void {
    for (const key of CUSTOM_KEYS) {
      if (this.registry.hasContainer(key)) this.registry.unregisterContainer(key);
    }
    // Back to the app configuration: body-right, as the default.
    this.registry.useBodyContainers();
  }

  checked(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }

  patchContainer(key: ContainerKey, change: Partial<ContainerConfig>): void {
    this.state.update((s) => ({
      ...s,
      containers: { ...s.containers, [key]: { ...s.containers[key], ...change } },
    }));
    this.apply();
  }

  patchSelected(change: Partial<ContainerConfig>): void {
    this.patchContainer(this.selected(), change);
  }

  patchPhase(phase: Phase, change: Partial<PhaseConfig>): void {
    this.patchSelected({ [phase]: { ...this.current()[phase], ...change } });
  }

  /** Number of a numeric field, or `null` when empty. */
  number(value: unknown): number | null {
    return value === '' || value === null || value === undefined ? null : Number(value);
  }

  /** Whether the preset of the phase moves the panel (slide, scale or the layout default). */
  movesPanel(phase: Phase): boolean {
    return ['', 'slide', 'scale'].includes(this.current()[phase].preset);
  }

  easingLabel(easing: string, phase: Phase): string {
    if (easing === '') return phase === 'show' ? '(padrão: decelerate)' : '(padrão: accelerate)';
    if (easing === 'spring-bouncy') return 'spring({ stiffness: 200, damping: 12 })';
    if (easing === 'spring') return 'spring()';
    if (easing === 'cubic') return 'cubicBezier([...])';
    return `SPLIT_EASINGS.${easing}`;
  }

  patchOpen(change: Partial<OpenConfig>): void {
    this.state.update((s) => ({ ...s, open: { ...s.open, ...change } }));
  }

  setDefault(key: '' | ContainerKey): void {
    this.state.update((s) => ({ ...s, defaultKey: key }));
    this.apply();
  }

  reset(): void {
    this.state.set(initialState());
    this.selected.set('esquerdo');
    this.apply();
  }

  open(count = 1): void {
    const s = this.state();
    this.error.set('');
    for (let i = 0; i < count; i++) {
      try {
        const origin = s.open.target || this.registry.getDefaultContainer();
        const ref = this.manager.open(NoteTabComponent, {
          ...openOptions(s),
          ...(s.open.confirmClose ? { canClose: () => confirm('Fechar esta aba?') } : {}),
          ...(s.open.lockToContainer
            ? { canMove: (target: { containerKey: string }) => target.containerKey === origin }
            : {}),
        });
        if (ref.rejected) this.error.set('Aba cancelada pelo onReject.');
      } catch (e) {
        this.error.set(errorText(e));
        return;
      }
    }
  }

  dismissAll(): void {
    void this.manager.dismissAll();
  }

  /** Applies the state to the registry: body sides, containers of the page and the default. */
  private apply(): void {
    const s = this.state();
    const errors: string[] = [];
    const body = bodyConfig(s);
    const bodyJson = JSON.stringify(body);
    if (bodyJson !== this.appliedBody) {
      try {
        this.registry.useBodyContainers(body);
        this.appliedBody = bodyJson;
      } catch (e) {
        errors.push(errorText(e));
      }
    }
    for (const key of CUSTOM_KEYS) {
      const c = s.containers[key];
      const options = c.enabled ? containerOptions(key, c) : null;
      const json = options && JSON.stringify(options);
      if (json === (this.applied.get(key) ?? null) && this.registry.hasContainer(key) === !!json) {
        continue;
      }
      if (this.registry.hasContainer(key)) this.registry.unregisterContainer(key);
      this.applied.delete(key);
      if (!options) continue;
      try {
        this.registry.registerContainer(key, this.hosts[key]().nativeElement, options);
        this.applied.set(key, json!);
      } catch (e) {
        errors.push(errorText(e));
      }
    }
    // A default that is no longer enabled goes back to the automatic one.
    if (s.defaultKey && !this.registry.hasContainer(s.defaultKey)) {
      this.state.update((st) => ({ ...st, defaultKey: '' }));
    }
    const defaultKey = this.state().defaultKey;
    this.registry.setDefaultContainer(defaultKey || null);
    this.effectiveDefault.set(this.registry.getDefaultContainer());
    this.error.set(errors.join(' · '));
  }
}
