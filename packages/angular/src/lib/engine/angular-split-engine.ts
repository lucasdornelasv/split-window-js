import {
  ApplicationRef,
  ChangeDetectorRef,
  DOCUMENT,
  EnvironmentInjector,
  Injectable,
  Injector,
  PLATFORM_ID,
  RendererFactory2,
  RendererStyleFlags2,
  TemplateRef,
  createComponent,
  inject,
  reflectComponentType,
  signal,
  type ComponentRef,
  type EmbeddedViewRef,
  type Renderer2,
  type Type,
  type ViewRef,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import {
  BaseSplitWindowEngine,
  computeClosedDropZoneRect,
  computeExpandedRect,
  rectsMatch,
  resolveLength,
  SplitStyleStash,
  type ContainerState,
  type SplitAnimationEngine,
  type SplitRect,
  type SplitTransitionPlan,
  type SplitWindowRef,
  type TabState,
} from '@split-window/core';
import { SplitActiveWindow } from '../active-window/split-active-window';
import { SplitAnimationEngineRegistry } from '../animation/split-animation-engine-registry';
import type { SplitContainerElements } from '../animation/animation-engine';
import { axisOf, type SplitModeContext } from '../modes/container-mode';
import { SplitModeResolver, type SplitResolvedMode } from '../modes/mode-resolver';
import { SplitContainerComponent } from '../shell/split-container.component';
import {
  SplitDropZoneLayerComponent,
  type SplitFloatingZone,
} from '../shell/split-drop-zone-layer.component';
import { SPLIT_WINDOW_CONFIG } from '../tokens';
import { rendererDomWriter } from './renderer-dom-writer';
import type { SplitAngularTabOptions, SplitContent, SplitTemplateContext } from '../types';

/** Data attached to every CDK drop list of the library. */
export interface SplitDropListData {
  key: string;
  kind: 'strip' | 'content' | 'float';
}

/** A rendered tab. */
export interface AngularTabHandle {
  ref: SplitWindowRef;
  panel: HTMLElement;
  /** Root view attached to the `ApplicationRef` for the whole life of the tab. */
  view: ViewRef | null;
  componentRef: ComponentRef<unknown> | null;
  /**
   * Change detector switched off while the tab is inactive. For components it is the
   * component's own view: `ApplicationRef.detachView()` would also remove the nodes from the
   * DOM, and the app tick ignores the attached flag of root views.
   */
  cd: ChangeDetectorRef | null;
  active: SplitActiveWindow;
  /** Container the panel is in. */
  containerKey: string | null;
}

/** Mode of a container and the static classes and styles it put on the elements. */
export interface SplitContainerDisplay {
  resolved: SplitResolvedMode;
  /** `container.options` the mode was resolved from: a new object means a reconfiguration. */
  options: object;
  /** Classes and styles of the mode, kept while the container exists. */
  stash: SplitStyleStash;
}

/** A mounted container. */
export interface SplitShellEntry {
  componentRef: ComponentRef<SplitContainerComponent>;
  /** The `split-container` element. */
  shell: HTMLElement;
  /** Element that holds the shell when not expanded (the app host or the body host). */
  home: HTMLElement;
  bodyHost: HTMLElement | null;
  backdrop: HTMLElement | null;
  expandCleanup: (() => void) | null;
  display: SplitContainerDisplay;
  /** Open layout of the mode, undone after the container hides. */
  layout: SplitStyleStash;
  /** Context of the applied open layout; `null` while closed. */
  modeCtx: SplitModeContext | null;
}

const hasMoveBefore =
  typeof Element !== 'undefined' && typeof (Element.prototype as any).moveBefore === 'function';

/**
 * Moves a node keeping its state where the browser supports `moveBefore()` (iframes do not
 * reload, videos keep playing, focus is kept). Falls back to `insertBefore`, through the
 * renderer when one is given (`Renderer2` has no `moveBefore`).
 */
export function moveNode(
  parent: Element,
  node: Element,
  before: Node | null = null,
  renderer?: Renderer2,
): void {
  if (node.parentNode === parent && node.nextSibling === before) return;
  if (hasMoveBefore && node.isConnected && parent.isConnected) {
    try {
      (parent as any).moveBefore(node, before);
      return;
    } catch {
      // different documents or a disconnected node: fall back
    }
  }
  if (renderer) renderer.insertBefore(parent, node, before);
  else parent.insertBefore(node, before);
}

function toRect(rect: DOMRect | SplitRect): SplitRect {
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
}

/** Position of a floating panel (custom push/overlay) inside its host: `inset` per side. */
const PANEL_INSET: Record<'push' | 'overlay', Record<string, string>> = {
  // overlay: against the side edge of the host
  overlay: { right: '0 0 0 auto', left: '0 auto 0 0', top: '0 0 auto 0', bottom: 'auto 0 0 0' },
  // push: against the content side, so the panel slides in as the host grows
  push: { right: '0 auto 0 0', left: '0 0 0 auto', top: 'auto 0 0 0', bottom: '0 0 auto 0' },
};

/**
 * The Angular engine: renders the shells with `createComponent`, moves tabs without
 * destroying them, applies full screen, the modes of the containers and, through
 * `BaseSplitWindowEngine`, their animated transitions. It never decides: it asks the core.
 * Every write to the DOM goes through `Renderer2` (also the styles of the modes, through a
 * renderer-backed `SplitStyleStash`); only reads, focus, `moveBefore` and the synthetic
 * events of `cancelDrag` use the DOM directly.
 *
 * Replace it with a subclass through dependency injection:
 *
 * ```ts
 * @Injectable()
 * class MyEngine extends AngularSplitEngine {
 *   protected override enter(container: ContainerState<HTMLElement>) {
 *     super.enter(container);
 *     // ...
 *   }
 * }
 * provideSplitWindows({ engine: MyEngine });
 * ```
 */
@Injectable()
export class AngularSplitEngine extends BaseSplitWindowEngine<
  SplitContent,
  HTMLElement,
  SplitAngularTabOptions,
  HTMLElement
> {
  protected readonly appRef = inject(ApplicationRef);
  protected readonly environmentInjector = inject(EnvironmentInjector);
  protected readonly document = inject(DOCUMENT);
  protected readonly resolver = inject(SplitModeResolver);
  protected readonly config = inject(SPLIT_WINDOW_CONFIG);
  /** Named animation engines, resolved on each transition. */
  protected readonly animationEngines = inject(SplitAnimationEngineRegistry);
  /** Renderer for every DOM write of the engine. */
  protected readonly renderer: Renderer2 = inject(RendererFactory2).createRenderer(null, null);
  /** Writer of the style stashes (modes included), backed by the renderer. */
  protected readonly domWriter = rendererDomWriter(this.renderer);
  readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly shells = new Map<string, SplitShellEntry>();
  /** Modes of custom containers prepared on registration, before their first tab. */
  protected readonly prepared = new Map<string, SplitContainerDisplay>();
  private layerRef: ComponentRef<SplitDropZoneLayerComponent> | null = null;
  private expandLayer: HTMLElement | null = null;
  private readonly lastKnownRects = new WeakMap<HTMLElement, SplitRect>();
  private readonly hostObserver: ResizeObserver | null =
    this.isBrowser && typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver((entries) =>
          entries.forEach((e) => this.remember(e.target as HTMLElement)),
        )
      : null;

  /** Floating drop zones shown during a drag. */
  readonly floatingZones = signal<SplitFloatingZone[]>([]);

  override disconnect(): void {
    for (const key of [...this.shells.keys()]) this.destroyShell(key);
    for (const display of this.prepared.values()) display.stash.restore();
    this.prepared.clear();
    this.layerRef?.destroy();
    this.layerRef = null;
    if (this.expandLayer) this.detach(this.expandLayer);
    this.hostObserver?.disconnect();
    super.disconnect();
  }

  // ------------------------------------------------------------ containers

  /**
   * Resolves the mode of a custom container on registration and styles its host, so a
   * `push`/`overlay` host is collapsed before the first tab.
   */
  prepareContainer(container: ContainerState<HTMLElement>): void {
    if (!this.isBrowser || container.kind !== 'custom' || !container.host) return;
    if (this.shells.has(container.key)) return;
    this.prepared.get(container.key)?.stash.restore();
    const display = this.createDisplay(container);
    this.prepared.set(container.key, display);
    this.applyStatic(display, { host: container.host, shell: null, backdrop: null });
  }

  /** Undoes `prepareContainer`. */
  releaseContainer(container: ContainerState<HTMLElement>): void {
    this.prepared.get(container.key)?.stash.restore();
    this.prepared.delete(container.key);
  }

  mountContainer(container: ContainerState<HTMLElement>): void {
    if (!this.isBrowser || this.shells.has(container.key)) return;
    const prepared = this.prepared.get(container.key);
    this.prepared.delete(container.key);
    let display: SplitContainerDisplay;
    if (prepared && prepared.options === container.options) {
      display = prepared;
    } else {
      prepared?.stash.restore();
      display = this.createDisplay(container);
    }
    let home: HTMLElement;
    let bodyHost: HTMLElement | null = null;
    if (container.kind === 'body') {
      bodyHost = this.createElement('div', 'split-body-host', `split-body-host--${container.side}`);
      this.setHidden(bodyHost, true);
      this.renderer.appendChild(this.document.body, bodyHost);
      home = bodyHost;
    } else {
      home = container.host!;
      this.remember(home);
      this.hostObserver?.observe(home);
    }
    const componentRef = createComponent(SplitContainerComponent, {
      environmentInjector: this.environmentInjector,
    });
    componentRef.setInput('containerKey', container.key);
    const shell = componentRef.location.nativeElement as HTMLElement;
    this.setHidden(shell, true);
    this.renderer.appendChild(home, shell);
    this.appRef.attachView(componentRef.hostView);
    componentRef.changeDetectorRef.detectChanges();
    const entry: SplitShellEntry = {
      componentRef,
      shell,
      home,
      bodyHost,
      backdrop: null,
      expandCleanup: null,
      display,
      layout: new SplitStyleStash(this.domWriter),
      modeCtx: null,
    };
    this.shells.set(container.key, entry);
    this.syncBackdrop(entry, container);
    this.applyStatic(display, this.staticElements(entry));
    this.ensureLayer();
  }

  unmountContainer(container: ContainerState<HTMLElement>): void {
    this.destroyShell(container.key);
  }

  /**
   * Re-applies the options of a container after a change: backdrop, and the mode when
   * `container.options` was replaced (reconfiguration).
   */
  applyContainerOptions(container: ContainerState<HTMLElement>): void {
    const entry = this.shells.get(container.key);
    if (!entry) return;
    const backdropChanged = this.syncBackdrop(entry, container);
    if (entry.display.options !== container.options) {
      this.completeTransition(container.key, true);
      const wasOpen = entry.modeCtx !== null;
      if (wasOpen) this.removeLayout(entry);
      entry.display.stash.restore();
      entry.display = this.createDisplay(container);
      this.applyStatic(entry.display, this.staticElements(entry));
      if (wasOpen) this.applyLayout(entry, container);
    } else if (backdropChanged) {
      this.applyStatic(entry.display, this.staticElements(entry));
    }
  }

  /** Content element of a mounted container. */
  contentElement(key: string): HTMLElement | null {
    return this.shells.get(key)?.componentRef.instance.contentElement() ?? null;
  }

  /** Shell element of a mounted container. */
  shellElement(key: string): HTMLElement | null {
    return this.shells.get(key)?.shell ?? null;
  }

  /** Resolved mode of a mounted (or prepared) container. */
  resolvedMode(key: string): SplitResolvedMode | null {
    return (this.shells.get(key)?.display ?? this.prepared.get(key))?.resolved ?? null;
  }

  protected destroyShell(key: string): void {
    const entry = this.shells.get(key);
    if (!entry) return;
    this.cancelTransition(key);
    this.removeLayout(entry);
    entry.expandCleanup?.();
    this.hostObserver?.unobserve(entry.home);
    entry.display.stash.restore();
    entry.componentRef.destroy();
    this.detach(entry.shell);
    if (entry.bodyHost) this.detach(entry.bodyHost);
    if (entry.backdrop) this.detach(entry.backdrop);
    this.shells.delete(key);
  }

  // ------------------------------------------------------------ DOM writes (Renderer2)

  /** Creates an element with classes. */
  protected createElement(tag: string, ...classes: string[]): HTMLElement {
    const el = this.renderer.createElement(tag) as HTMLElement;
    for (const name of classes) this.renderer.addClass(el, name);
    return el;
  }

  /** Removes an element from its parent. */
  protected detach(el: Element): void {
    const parent = this.renderer.parentNode(el);
    if (parent) this.renderer.removeChild(parent, el);
  }

  protected setHidden(el: HTMLElement, hidden: boolean): void {
    this.renderer.setProperty(el, 'hidden', hidden);
  }

  protected toggleClass(el: Element, name: string, on: boolean): void {
    if (on) this.renderer.addClass(el, name);
    else this.renderer.removeClass(el, name);
  }

  private ensureLayer(): void {
    if (this.layerRef) return;
    this.layerRef = createComponent(SplitDropZoneLayerComponent, {
      environmentInjector: this.environmentInjector,
    });
    this.renderer.appendChild(this.document.body, this.layerRef.location.nativeElement);
    this.appRef.attachView(this.layerRef.hostView);
  }

  // ------------------------------------------------------------ modes

  protected createDisplay(container: ContainerState<HTMLElement>): SplitContainerDisplay {
    return {
      resolved: this.resolver.resolve(container),
      options: container.options,
      stash: new SplitStyleStash(this.domWriter),
    };
  }

  private staticElements(entry: SplitShellEntry) {
    return { host: entry.home, shell: entry.shell, backdrop: entry.backdrop };
  }

  /** Classes and styles of the mode that stay while the container exists. */
  protected applyStatic(
    display: SplitContainerDisplay,
    els: { host: HTMLElement; shell: HTMLElement | null; backdrop: HTMLElement | null },
  ): void {
    const { stash, resolved } = display;
    const { kind, layout, side, size } = resolved;
    const { host, shell, backdrop } = els;
    stash.restore();
    stash.addClass(
      host,
      kind === 'custom' && 'split-host',
      `split-layout--${layout}`,
      `split-side--${side}`,
      ...resolved.hostClass,
    );
    if (kind === 'body') stash.set(host, '--split-body-size', size ?? this.config.bodySize);
    const floating = kind === 'custom' && layout !== 'inline';
    if (floating) {
      // The host does not take space while closed (push) or never does (overlay).
      const axis = axisOf(side);
      stash.set(host, 'flex', '0 0 auto');
      stash.set(host, axis, '0px');
      stash.set(host, `min-${axis}`, '0px');
      stash.set(host, 'overflow', layout === 'push' ? 'hidden' : 'visible');
      const view = this.document.defaultView;
      if (view && ['', 'static'].includes(view.getComputedStyle(host).position)) {
        stash.set(host, 'position', 'relative');
      }
    }
    if (shell) {
      stash.addClass(
        shell,
        `split-container--${kind}`,
        `split-layout--${layout}`,
        `split-side--${side}`,
        ...resolved.panelClass,
      );
      if (floating) {
        const horizontal = axisOf(side) === 'width';
        stash.set(shell, '--split-inset', PANEL_INSET[layout as 'push' | 'overlay'][side]!);
        stash.set(shell, '--split-w', horizontal ? 'var(--split-size)' : 'auto');
        stash.set(shell, '--split-h', horizontal ? 'auto' : 'var(--split-size)');
        if (layout === 'overlay' && size) stash.set(shell, '--split-size', size);
      }
    }
    if (backdrop) stash.addClass(backdrop, ...resolved.backdropClass);
  }

  /** Creates or removes the backdrop of a body container. Returns whether it changed. */
  private syncBackdrop(entry: SplitShellEntry, container: ContainerState<HTMLElement>): boolean {
    if (!entry.bodyHost) return false;
    const wanted = !!container.options.backdrop;
    if (wanted === !!entry.backdrop) return false;
    if (wanted) {
      entry.backdrop = this.createElement('div', 'split-body-backdrop');
      this.setHidden(entry.backdrop, !!entry.shell.hidden);
      this.renderer.insertBefore(this.document.body, entry.backdrop, entry.bodyHost);
    } else {
      this.detach(entry.backdrop!);
      entry.backdrop = null;
    }
    if (entry.modeCtx) entry.modeCtx = { ...entry.modeCtx, elements: this.elements(entry) };
    return true;
  }

  protected elements(entry: SplitShellEntry): SplitContainerElements {
    const { resolved } = entry.display;
    let pushTarget: HTMLElement | null = null;
    if (resolved.kind === 'body' && resolved.layout === 'push') {
      const target = resolved.pushTarget;
      pushTarget =
        typeof target === 'string'
          ? this.document.querySelector<HTMLElement>(target)
          : (target ?? null);
      if (!pushTarget) {
        if (target) console.warn(`[split-window] pushTarget not found: ${String(target)}`);
        pushTarget = this.document.body;
      }
    }
    return { shell: entry.shell, host: entry.home, backdrop: entry.backdrop, pushTarget };
  }

  /** Applies the open layout of the mode. */
  protected applyLayout(entry: SplitShellEntry, container: ContainerState<HTMLElement>): void {
    const { resolved } = entry.display;
    const ctx: SplitModeContext = {
      container,
      kind: resolved.kind,
      layout: resolved.layout,
      side: resolved.side,
      size: resolved.size,
      elements: this.elements(entry),
      document: this.document,
      styles: entry.layout,
      data: {},
    };
    entry.modeCtx = ctx;
    entry.layout.addClass(entry.home, 'split-host--open');
    resolved.mode.open(ctx);
  }

  /** Removes the open layout of the mode. */
  protected removeLayout(entry: SplitShellEntry): void {
    const ctx = entry.modeCtx;
    if (!ctx) return;
    try {
      entry.display.resolved.mode.close(ctx);
    } finally {
      entry.layout.restore();
      entry.modeCtx = null;
    }
  }

  private setVisible(entry: SplitShellEntry, visible: boolean): void {
    this.setHidden(entry.shell, !visible);
    if (entry.bodyHost) this.setHidden(entry.bodyHost, !visible);
    if (entry.backdrop) this.setHidden(entry.backdrop, !visible);
  }

  // ------------------------------------------------------------ transition hooks

  protected isMounted(container: ContainerState<HTMLElement>): boolean {
    return this.shells.has(container.key);
  }

  protected isEntered(container: ContainerState<HTMLElement>): boolean {
    return !!this.shells.get(container.key)?.modeCtx;
  }

  protected enter(container: ContainerState<HTMLElement>): void {
    const entry = this.shells.get(container.key);
    if (!entry) return;
    this.setVisible(entry, true);
    this.applyLayout(entry, container);
  }

  protected leave(container: ContainerState<HTMLElement>): void {
    const entry = this.shells.get(container.key);
    if (!entry) return;
    const ctx = entry.modeCtx;
    this.removeLayout(entry);
    this.setVisible(entry, false);
    if (ctx) entry.display.resolved.mode.hidden(ctx);
  }

  protected override beforeTransition(container: ContainerState<HTMLElement>): void {
    this.applyContainerOptions(container);
  }

  /** Keeps the last tab and the strip on screen, without interaction, while hiding. */
  protected override setLeaving(container: ContainerState<HTMLElement>, leaving: boolean): void {
    const entry = this.shells.get(container.key);
    if (!entry) return;
    this.toggleClass(entry.shell, 'split-container--leaving', leaving);
    if (leaving) {
      entry.componentRef.instance.freeze();
      this.renderer.setAttribute(entry.shell, 'inert', '');
    } else {
      this.renderer.removeAttribute(entry.shell, 'inert');
      entry.componentRef.instance.unfreeze();
    }
  }

  protected override setAnimating(container: ContainerState<HTMLElement>, on: boolean): void {
    const shell = this.shells.get(container.key)?.shell;
    if (shell) this.toggleClass(shell, 'split-animating', on);
  }

  protected override afterShown(container: ContainerState<HTMLElement>): void {
    const ctx = this.shells.get(container.key)?.modeCtx;
    if (ctx) this.shells.get(container.key)!.display.resolved.mode.shown(ctx);
  }

  protected override prefersReducedMotion(): boolean {
    return !!this.document.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  }

  protected transitionPlan(
    container: ContainerState<HTMLElement>,
    phase: 'show' | 'hide',
  ): SplitTransitionPlan<HTMLElement> | null {
    const entry = this.shells.get(container.key);
    const ctx = entry?.modeCtx;
    if (!entry || !ctx) return null;
    const { resolved } = entry.display;
    const engine = this.animationEngineFor(resolved);
    if (!engine) return null;
    const { from, to } = resolved.mode.frames(ctx, phase);
    const push = resolved.layout === 'push';
    return {
      engine,
      context: {
        layout: resolved.layout,
        side: resolved.side,
        size: resolved.size,
        elements: ctx.elements,
        from,
        to,
        properties: {
          host: push && resolved.kind === 'custom' ? axisOf(resolved.side) : null,
          push: push && resolved.kind === 'body' ? `padding-${resolved.side}` : null,
        },
        options: resolved.animation,
      },
    };
  }

  /**
   * Engine of a transition, resolved now: engines registered after the container was set up
   * count. `null` when the container does not animate. An unknown engine name is reported
   * and the transition uses the noop engine.
   */
  protected animationEngineFor(
    resolved: SplitResolvedMode,
  ): SplitAnimationEngine<HTMLElement> | null {
    if (!resolved.animated) return null;
    try {
      return this.animationEngines.resolve(resolved.engine);
    } catch (error) {
      this.reportError(error);
      return this.animationEngines.resolve('none');
    }
  }

  protected destroyTab(handle: unknown): void {
    const h = handle as AngularTabHandle;
    h.view?.destroy(); // also detaches it from the ApplicationRef
    this.detach(h.panel);
    h.containerKey = null;
  }

  protected containerOfTab(handle: unknown): string | null {
    return (handle as AngularTabHandle).containerKey;
  }

  // ------------------------------------------------------------ tabs

  createTab(
    content: SplitContent,
    tab: TabState,
    ref: SplitWindowRef,
    options: SplitAngularTabOptions | undefined,
  ): AngularTabHandle {
    const active = new SplitActiveWindow(ref);
    const panel = this.createElement('div', 'split-tab-panel');
    this.renderer.setAttribute(panel, 'id', `${tab.id}-panel`);
    this.renderer.setAttribute(panel, 'role', 'tabpanel');
    this.renderer.setAttribute(panel, 'aria-labelledby', `${tab.id}-tab`);
    this.setHidden(panel, true);
    const handle: AngularTabHandle = {
      ref,
      panel,
      view: null,
      componentRef: null,
      cd: null,
      active,
      containerKey: null,
    };
    if (!this.isBrowser) return handle;

    const parent = options?.injector ?? this.environmentInjector;
    const environmentInjector = parent.get(EnvironmentInjector, this.environmentInjector);
    const elementInjector = Injector.create({
      providers: [{ provide: SplitActiveWindow, useValue: active }],
      parent,
    });
    if (content instanceof TemplateRef) {
      const context: SplitTemplateContext = { $implicit: active, window: active };
      const view: EmbeddedViewRef<SplitTemplateContext> = content.createEmbeddedView(
        context,
        elementInjector,
      );
      for (const node of view.rootNodes) this.renderer.appendChild(panel, node);
      handle.view = view;
      handle.cd = view;
    } else {
      const componentRef = createComponent(content, { environmentInjector, elementInjector });
      for (const [name, value] of Object.entries(options?.inputs ?? {}))
        componentRef.setInput(name, value);
      this.renderer.appendChild(panel, componentRef.location.nativeElement);
      handle.componentRef = componentRef;
      handle.view = componentRef.hostView;
      handle.cd = componentRef.injector.get(ChangeDetectorRef);
      ref._setComponentInstance(componentRef.instance);
    }
    this.appRef.attachView(handle.view);
    // Inactive until the core activates it.
    handle.cd.detach();
    return handle;
  }

  attach(handle: unknown, container: ContainerState<HTMLElement>): void {
    const h = handle as AngularTabHandle;
    h.containerKey = container.key;
    const content = this.contentElement(container.key);
    if (content) this.renderer.appendChild(content, h.panel);
    h.active.sync();
  }

  move(handle: unknown, to: ContainerState<HTMLElement>): void {
    const h = handle as AngularTabHandle;
    h.containerKey = to.key;
    const content = this.contentElement(to.key);
    if (content) moveNode(content, h.panel, null, this.renderer);
    h.active.sync();
  }

  activate(handle: unknown): void {
    const h = handle as AngularTabHandle;
    this.setHidden(h.panel, false);
    if (!h.cd) return;
    h.cd.reattach();
    h.cd.markForCheck();
    try {
      h.cd.detectChanges();
    } catch (error) {
      console.error('[split-window] erro ao renderizar a aba', error);
    }
  }

  deactivate(handle: unknown): void {
    const h = handle as AngularTabHandle;
    this.setHidden(h.panel, true);
    h.cd?.detach();
  }

  /**
   * `SplitWindowRef.setInputData`: `setInput` for each input the component declares. An
   * inactive tab gets the values when it is activated again.
   */
  setInputs(handle: unknown, inputs: Readonly<Record<string, unknown>>): void {
    const { componentRef } = handle as AngularTabHandle;
    if (!componentRef) return; // template or server
    for (const [name, value] of this.resolveInputParams(inputs, componentRef.componentType)) {
      componentRef.setInput(name, value);
    }
  }

  /**
   * Entries of `data` that are inputs of `componentType`, skipping `undefined` values. Keys
   * may be the property or the template name (alias); the yielded name is always the
   * template name, the one `ComponentRef.setInput` expects.
   */
  protected *resolveInputParams(
    data: Readonly<Record<string, unknown>>,
    componentType: Type<unknown>,
  ): Generator<[name: string, value: unknown]> {
    const names = new Map<string, string>();
    for (const { propName, templateName } of reflectComponentType(componentType)?.inputs ?? []) {
      names.set(propName, templateName);
      names.set(templateName, templateName);
    }
    for (const [key, value] of Object.entries(data)) {
      const name = names.get(key);
      if (value !== undefined && name !== undefined) yield [name, value];
    }
  }

  // ------------------------------------------------------------ full screen

  setExpanded(container: ContainerState<HTMLElement>, expanded: boolean): void {
    const entry = this.shells.get(container.key);
    if (!entry) return;
    entry.expandCleanup?.();
    entry.expandCleanup = null;
    if (expanded) entry.expandCleanup = this.expand(container, entry);
  }

  protected expand(container: ContainerState<HTMLElement>, entry: SplitShellEntry): () => void {
    const win = this.document.defaultView!;
    const options = container.options.expand === false ? {} : (container.options.expand ?? {});
    const { shell } = entry;
    const originalNext = shell.nextSibling;
    let movedToLayer = false;

    const boundsRect = (): SplitRect => {
      const viewport = { x: 0, y: 0, width: win.innerWidth, height: win.innerHeight };
      const bounds = options.bounds ?? 'viewport';
      if (bounds === 'viewport') return viewport;
      if (typeof bounds === 'function') return toRect(bounds());
      const element = typeof bounds === 'string' ? this.document.querySelector(bounds) : bounds;
      return element ? toRect(element.getBoundingClientRect()) : viewport;
    };
    const apply = () => {
      const area = boundsRect();
      const viewport = { width: win.innerWidth, height: win.innerHeight };
      const rect = computeExpandedRect(area, {
        maxWidth: resolveLength(options.maxWidth, 'x', viewport, area),
        maxHeight: resolveLength(options.maxHeight, 'y', viewport, area),
        margin: options.margin,
        align: options.align,
      });
      const styles: Record<string, string> = {
        position: 'fixed',
        left: `${rect.x}px`,
        top: `${rect.y}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      };
      for (const [prop, value] of Object.entries(styles)) {
        this.renderer.setStyle(shell, prop, value, RendererStyleFlags2.DashCase);
      }
      // An ancestor with transform/filter/contain/... makes `fixed` relative to it.
      if (!movedToLayer && !rectsMatch(toRect(shell.getBoundingClientRect()), rect)) {
        moveNode(this.getExpandLayer(), shell, null, this.renderer);
        movedToLayer = true;
      }
    };

    this.renderer.addClass(shell, 'split-container--expanded');
    this.renderer.addClass(entry.home, 'split-host--expanded');
    apply();
    if (!shell.contains(this.document.activeElement)) shell.focus({ preventScroll: true });

    const onResize = () => apply();
    const unlistenResize = this.renderer.listen('window', 'resize', onResize);
    const bounds = options.bounds;
    const boundsElement =
      typeof bounds === 'string' && bounds !== 'viewport'
        ? this.document.querySelector(bounds)
        : bounds instanceof HTMLElement
          ? bounds
          : null;
    const observer =
      boundsElement && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null;
    if (boundsElement) observer?.observe(boundsElement);

    return () => {
      unlistenResize();
      observer?.disconnect();
      this.renderer.removeClass(shell, 'split-container--expanded');
      this.renderer.removeClass(entry.home, 'split-host--expanded');
      for (const prop of ['position', 'left', 'top', 'width', 'height']) {
        this.renderer.removeStyle(shell, prop, RendererStyleFlags2.DashCase);
      }
      if (movedToLayer) {
        moveNode(
          entry.home,
          shell,
          originalNext && originalNext.parentNode === entry.home ? originalNext : null,
          this.renderer,
        );
      }
    };
  }

  private getExpandLayer(): HTMLElement {
    if (!this.expandLayer) {
      this.expandLayer = this.createElement('div', 'split-expand-layer');
      this.renderer.appendChild(this.document.body, this.expandLayer);
    }
    return this.expandLayer;
  }

  // ------------------------------------------------------------ drag and drop

  /**
   * Called from `cdkDragStarted`, which the CDK emits before measuring connected lists:
   * shows the floating zones and connects the source strip to the valid targets.
   */
  startDrag(ref: SplitWindowRef, sourceList: CdkDropList<SplitDropListData>): void {
    const controller = this.controller;
    controller.beginDrag(ref);
    if (controller.getExpandedContainer() !== null) {
      sourceList.connectedTo = [];
      return;
    }
    const targets = controller.getDropTargets(ref);
    const zones = targets
      .filter((t) => !t.container.open)
      .map((t) => this.floatingZone(t.container))
      .filter((z): z is SplitFloatingZone => z !== null);
    this.floatingZones.set(zones);
    this.layerRef?.changeDetectorRef.detectChanges();

    const ids: string[] = [];
    for (const t of targets) {
      if (!t.container.open || !this.shells.has(t.key)) continue;
      ids.push(stripListId(t.key), contentListId(t.key));
    }
    for (const zone of zones) ids.push(floatListId(zone.key));
    sourceList.connectedTo = ids;
  }

  /** Handles a drop on any list of the library and ends the drag. */
  handleDrop(event: CdkDragDrop<SplitDropListData, SplitDropListData, SplitWindowRef>): void {
    const controller = this.controller;
    const ref = event.item.data;
    const target = event.container.data;
    let moved = false;
    if (event.isPointerOverContainer && ref.isOpen) {
      if (target.kind === 'strip') {
        moved = controller.moveTab(ref, target.key, event.currentIndex, 'drag');
      } else if (target.key !== ref.containerKey) {
        moved = controller.moveTab(ref, target.key, undefined, 'drag');
      }
    }
    controller.endDrag(ref, moved);
    this.floatingZones.set([]);
  }

  cancelDrag(): void {
    if (!this.isBrowser) return;
    // Synthetic pointer-up events have no Renderer2 equivalent: dispatched on the document.
    const init = { bubbles: true, cancelable: true, clientX: -10000, clientY: -10000 };
    this.document.dispatchEvent(new MouseEvent('mouseup', init));
    try {
      const touch = new Touch({
        identifier: 0,
        target: this.document.body,
        clientX: -10000,
        clientY: -10000,
      });
      this.document.dispatchEvent(
        new TouchEvent('touchend', { bubbles: true, changedTouches: [touch] }),
      );
    } catch {
      // Touch events are not constructible in this browser
    }
  }

  private floatingZone(container: ContainerState<HTMLElement>): SplitFloatingZone | null {
    const config = this.config;
    const win = this.document.defaultView!;
    const size = {
      width: container.options.closedDropZone?.width ?? config.closedDropZone.width,
      height: container.options.closedDropZone?.height ?? config.closedDropZone.height,
    };
    const host = container.host;
    let hostInfo: { rect: SplitRect; displayed: boolean } | null = null;
    if (host && host.isConnected) {
      const rect = toRect(host.getBoundingClientRect());
      // A collapsed host (push/overlay layouts) counts as not displayed.
      const displayed = host.getClientRects().length > 0 && rect.width > 0 && rect.height > 0;
      if (displayed) this.remember(host);
      hostInfo = { rect, displayed };
    }
    const anchor = container.options.closedDropZoneAnchor;
    const rect = computeClosedDropZoneRect({
      size,
      viewport: { x: 0, y: 0, width: win.innerWidth, height: win.innerHeight },
      bodySide: container.side,
      host: hostInfo,
      lastKnownRect: host ? (this.lastKnownRects.get(host) ?? null) : null,
      anchorRect: anchor?.isConnected ? toRect(anchor.getBoundingClientRect()) : null,
    });
    return rect ? { key: container.key, label: container.label, rect } : null;
  }

  private remember(host: HTMLElement): void {
    if (!host.isConnected || host.getClientRects().length === 0) return;
    const rect = host.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return; // collapsed host
    this.lastKnownRects.set(host, toRect(rect));
  }
}

export const stripListId = (key: string) => `split-strip-${key}`;
export const contentListId = (key: string) => `split-content-${key}`;
export const floatListId = (key: string) => `split-float-${key}`;
