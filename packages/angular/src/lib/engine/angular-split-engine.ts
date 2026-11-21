import {
  ApplicationRef,
  ChangeDetectorRef,
  DOCUMENT,
  EnvironmentInjector,
  Injectable,
  Injector,
  PLATFORM_ID,
  TemplateRef,
  createComponent,
  inject,
  signal,
  type ComponentRef,
  type EmbeddedViewRef,
  type ViewRef,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import {
  computeClosedDropZoneRect,
  computeExpandedRect,
  rectsMatch,
  resolveLength,
  type ContainerState,
  type SplitRect,
  type SplitWindowEngine,
  type SplitWindowRef,
  type TabState,
} from '@split-window/core';
import { SplitActiveWindow } from '../active-window/split-active-window';
import type { SplitWindowRuntime } from '../runtime';
import { SplitContainerComponent } from '../shell/split-container.component';
import {
  SplitDropZoneLayerComponent,
  type SplitFloatingZone,
} from '../shell/split-drop-zone-layer.component';
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
}

interface ShellEntry {
  componentRef: ComponentRef<SplitContainerComponent>;
  /** The `split-container` element. */
  shell: HTMLElement;
  /** Element that holds the shell when not expanded (the app host or the body host). */
  home: HTMLElement;
  bodyHost: HTMLElement | null;
  backdrop: HTMLElement | null;
  expandCleanup: (() => void) | null;
}

const hasMoveBefore =
  typeof Element !== 'undefined' && typeof (Element.prototype as any).moveBefore === 'function';

/**
 * Moves a node keeping its state where the browser supports `moveBefore()` (iframes do not
 * reload, videos keep playing, focus is kept). Falls back to `insertBefore`.
 */
export function moveNode(parent: Element, node: Element, before: Node | null = null): void {
  if (node.parentNode === parent && node.nextSibling === before) return;
  if (hasMoveBefore && node.isConnected && parent.isConnected) {
    try {
      (parent as any).moveBefore(node, before);
      return;
    } catch {
      // different documents or a disconnected node: fall back
    }
  }
  parent.insertBefore(node, before);
}

function toRect(rect: DOMRect | SplitRect): SplitRect {
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
}

/**
 * The Angular engine: creates components with `createComponent` attached to the
 * `ApplicationRef`, renders the shells, moves tabs without destroying them and applies
 * full screen. It never decides: it asks the core.
 */
@Injectable()
export class AngularSplitEngine implements SplitWindowEngine<
  SplitContent,
  HTMLElement,
  SplitAngularTabOptions
> {
  private readonly appRef = inject(ApplicationRef);
  private readonly environmentInjector = inject(EnvironmentInjector);
  private readonly document = inject(DOCUMENT);
  readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private runtime: SplitWindowRuntime | null = null;
  private readonly shells = new Map<string, ShellEntry>();
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

  /** @internal */
  connect(runtime: SplitWindowRuntime): void {
    this.runtime = runtime;
  }

  /** @internal */
  disconnect(): void {
    for (const key of [...this.shells.keys()]) this.destroyShell(key);
    this.layerRef?.destroy();
    this.layerRef = null;
    this.expandLayer?.remove();
    this.hostObserver?.disconnect();
    this.runtime = null;
  }

  private get rt(): SplitWindowRuntime {
    if (!this.runtime)
      throw new Error('[split-window] engine used before provideSplitWindows() wiring');
    return this.runtime;
  }

  // ------------------------------------------------------------ containers

  mountContainer(container: ContainerState<HTMLElement>): void {
    if (!this.isBrowser || this.shells.has(container.key)) return;
    let home: HTMLElement;
    let bodyHost: HTMLElement | null = null;
    let backdrop: HTMLElement | null = null;
    if (container.kind === 'body') {
      bodyHost = this.document.createElement('div');
      bodyHost.className = `split-body-host split-body-host--${container.side}`;
      bodyHost.hidden = true;
      if (container.options.backdrop) {
        backdrop = this.document.createElement('div');
        backdrop.className = 'split-body-backdrop';
        backdrop.hidden = true;
        this.document.body.appendChild(backdrop);
      }
      this.document.body.appendChild(bodyHost);
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
    shell.hidden = true;
    home.appendChild(shell);
    this.appRef.attachView(componentRef.hostView);
    componentRef.changeDetectorRef.detectChanges();
    this.shells.set(container.key, {
      componentRef,
      shell,
      home,
      bodyHost,
      backdrop,
      expandCleanup: null,
    });
    this.applyBodyOptions(container);
    this.ensureLayer();
  }

  unmountContainer(container: ContainerState<HTMLElement>): void {
    this.destroyShell(container.key);
  }

  setContainerOpen(container: ContainerState<HTMLElement>, open: boolean): void {
    const entry = this.shells.get(container.key);
    if (!entry) return;
    entry.shell.hidden = !open;
    if (entry.bodyHost) entry.bodyHost.hidden = !open;
    this.applyBodyOptions(container);
    if (entry.backdrop) entry.backdrop.hidden = !open;
  }

  /** Re-applies size and backdrop of a body container (after a reconfiguration). */
  applyBodyOptions(container: ContainerState<HTMLElement>): void {
    const entry = this.shells.get(container.key);
    if (!entry?.bodyHost) return;
    entry.bodyHost.style.setProperty(
      '--split-body-size',
      container.options.size ?? this.rt.config.bodySize,
    );
    if (container.options.backdrop && !entry.backdrop) {
      entry.backdrop = this.document.createElement('div');
      entry.backdrop.className = 'split-body-backdrop';
      this.document.body.insertBefore(entry.backdrop, entry.bodyHost);
    } else if (!container.options.backdrop && entry.backdrop) {
      entry.backdrop.remove();
      entry.backdrop = null;
    }
    if (entry.backdrop) entry.backdrop.hidden = !container.open;
  }

  /** Content element of a mounted container. */
  contentElement(key: string): HTMLElement | null {
    return this.shells.get(key)?.componentRef.instance.contentElement() ?? null;
  }

  /** Shell element of a mounted container. */
  shellElement(key: string): HTMLElement | null {
    return this.shells.get(key)?.shell ?? null;
  }

  private destroyShell(key: string): void {
    const entry = this.shells.get(key);
    if (!entry) return;
    entry.expandCleanup?.();
    this.hostObserver?.unobserve(entry.home);
    entry.componentRef.destroy();
    entry.shell.remove();
    entry.bodyHost?.remove();
    entry.backdrop?.remove();
    this.shells.delete(key);
  }

  private ensureLayer(): void {
    if (this.layerRef) return;
    this.layerRef = createComponent(SplitDropZoneLayerComponent, {
      environmentInjector: this.environmentInjector,
    });
    this.document.body.appendChild(this.layerRef.location.nativeElement);
    this.appRef.attachView(this.layerRef.hostView);
  }

  // ------------------------------------------------------------ tabs

  createTab(
    content: SplitContent,
    tab: TabState,
    ref: SplitWindowRef,
    options: SplitAngularTabOptions | undefined,
  ): AngularTabHandle {
    const active = new SplitActiveWindow(ref);
    const panel = this.document.createElement('div');
    panel.className = 'split-tab-panel';
    panel.id = `${tab.id}-panel`;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', `${tab.id}-tab`);
    panel.hidden = true;
    const handle: AngularTabHandle = {
      ref,
      panel,
      view: null,
      componentRef: null,
      cd: null,
      active,
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
      for (const node of view.rootNodes) panel.appendChild(node);
      handle.view = view;
      handle.cd = view;
    } else {
      const componentRef = createComponent(content, { environmentInjector, elementInjector });
      for (const [name, value] of Object.entries(options?.inputs ?? {}))
        componentRef.setInput(name, value);
      panel.appendChild(componentRef.location.nativeElement);
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
    const content = this.contentElement(container.key);
    if (content) content.appendChild(h.panel);
    h.active.sync();
  }

  move(handle: unknown, to: ContainerState<HTMLElement>): void {
    const h = handle as AngularTabHandle;
    const content = this.contentElement(to.key);
    if (content) moveNode(content, h.panel);
    h.active.sync();
  }

  activate(handle: unknown): void {
    const h = handle as AngularTabHandle;
    h.panel.hidden = false;
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
    h.panel.hidden = true;
    h.cd?.detach();
  }

  destroy(handle: unknown): void {
    const h = handle as AngularTabHandle;
    h.view?.destroy(); // also detaches it from the ApplicationRef
    h.panel.remove();
  }

  // ------------------------------------------------------------ full screen

  setExpanded(container: ContainerState<HTMLElement>, expanded: boolean): void {
    const entry = this.shells.get(container.key);
    if (!entry) return;
    entry.expandCleanup?.();
    entry.expandCleanup = null;
    if (expanded) entry.expandCleanup = this.expand(container, entry);
  }

  private expand(container: ContainerState<HTMLElement>, entry: ShellEntry): () => void {
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
      Object.assign(shell.style, {
        position: 'fixed',
        left: `${rect.x}px`,
        top: `${rect.y}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      });
      // An ancestor with transform/filter/contain/... makes `fixed` relative to it.
      if (!movedToLayer && !rectsMatch(toRect(shell.getBoundingClientRect()), rect)) {
        moveNode(this.getExpandLayer(), shell);
        movedToLayer = true;
      }
    };

    shell.classList.add('split-container--expanded');
    entry.home.classList.add('split-host--expanded');
    apply();
    if (!shell.contains(this.document.activeElement)) shell.focus({ preventScroll: true });

    const onResize = () => apply();
    win.addEventListener('resize', onResize);
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
      win.removeEventListener('resize', onResize);
      observer?.disconnect();
      shell.classList.remove('split-container--expanded');
      entry.home.classList.remove('split-host--expanded');
      for (const prop of ['position', 'left', 'top', 'width', 'height'] as const)
        shell.style[prop] = '';
      if (movedToLayer) {
        moveNode(
          entry.home,
          shell,
          originalNext && originalNext.parentNode === entry.home ? originalNext : null,
        );
      }
    };
  }

  private getExpandLayer(): HTMLElement {
    if (!this.expandLayer) {
      this.expandLayer = this.document.createElement('div');
      this.expandLayer.className = 'split-expand-layer';
      this.document.body.appendChild(this.expandLayer);
    }
    return this.expandLayer;
  }

  // ------------------------------------------------------------ drag and drop

  /**
   * Called from `cdkDragStarted`, which the CDK emits before measuring connected lists:
   * shows the floating zones and connects the source strip to the valid targets.
   */
  startDrag(ref: SplitWindowRef, sourceList: CdkDropList<SplitDropListData>): void {
    const { controller, registry } = this.rt;
    controller.beginDrag(ref);
    const expanded = registry.getExpandedContainer();
    if (expanded !== null) {
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
    const { controller } = this.rt;
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
    const { config } = this.rt;
    const win = this.document.defaultView!;
    const size = {
      width: container.options.closedDropZone?.width ?? config.closedDropZone.width,
      height: container.options.closedDropZone?.height ?? config.closedDropZone.height,
    };
    const host = container.host;
    let hostInfo: { rect: SplitRect; displayed: boolean } | null = null;
    if (host && host.isConnected) {
      const displayed = host.getClientRects().length > 0;
      if (displayed) this.remember(host);
      hostInfo = { rect: toRect(host.getBoundingClientRect()), displayed };
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
    this.lastKnownRects.set(host, toRect(rect));
  }
}

export const stripListId = (key: string) => `split-strip-${key}`;
export const contentListId = (key: string) => `split-content-${key}`;
export const floatListId = (key: string) => `split-float-${key}`;
