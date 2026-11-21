import {
  ApplicationRef,
  Component,
  Injector,
  TemplateRef,
  createEnvironmentInjector,
  EnvironmentInjector,
  InjectionToken,
  PLATFORM_ID,
  inject,
  input,
  signal,
  viewChild,
  type OnDestroy,
} from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import {
  SplitActiveWindow,
  SplitContainerDirective,
  SplitContainerRegistry,
  SplitWindowManager,
  provideSplitWindows,
  SplitContainerNotFoundError,
  type SplitWindowRef,
} from '../public-api';
import {
  AngularSplitEngine,
  moveNode,
  type SplitDropListData,
} from './engine/angular-split-engine';
import { SplitWindowController } from './controller/split-window-controller';

const TOKEN = new InjectionToken<string>('TOKEN');

@Component({
  selector: 'split-test-tab',
  template: `<p class="tab-content">{{ name() }} / {{ token }}</p>
    <span class="extra">{{ extra() }}</span>
    <input class="field" />`,
})
class TabComponent implements OnDestroy {
  readonly name = input('default');
  readonly extra = signal('');
  readonly window = inject(SplitActiveWindow);
  readonly token = inject(TOKEN, { optional: true }) ?? 'none';
  static destroyed = 0;
  ngOnDestroy(): void {
    TabComponent.destroyed++;
  }
}

@Component({
  selector: 'split-test-inputs-tab',
  template: `<p class="inputs-content">{{ name() }} / {{ label() }}</p>`,
})
class InputsTabComponent {
  readonly name = input('default');
  // eslint-disable-next-line @angular-eslint/no-input-rename -- the alias is what is tested
  readonly label = input('', { alias: 'tabLabel' });
  readonly extra = signal('');
}

@Component({
  imports: [SplitContainerDirective],
  template: `
    @if (showMain()) {
      <div
        class="main-host"
        splitContainer="main"
        [splitContainerDefault]="true"
        [splitContainerOptions]="options"
      ></div>
    }
    <div class="side-host" [splitContainer]="sideKey()"></div>
    <ng-template #tpl let-win>
      <span class="tpl-content">template in {{ win.containerKey() }}</span>
    </ng-template>
  `,
})
class HostComponent {
  readonly showMain = signal(true);
  readonly sideKey = signal('side');
  readonly options = { maxTabs: 5 };
  readonly tpl = viewChild.required<TemplateRef<unknown>>('tpl');
}

@Component({ selector: 'split-count-tab', template: `<span>{{ check() }}</span>` })
class CountTab {
  static checks = 0;
  check(): string {
    CountTab.checks++;
    return '';
  }
}

describe('@split-window/angular', () => {
  let fixture: ComponentFixture<HostComponent>;
  let manager: SplitWindowManager;
  let registry: SplitContainerRegistry;

  async function stable() {
    fixture.detectChanges();
    TestBed.tick();
    await fixture.whenStable();
  }

  const mainHost = () => fixture.nativeElement.querySelector('.main-host') as HTMLElement;
  const sideHost = () => fixture.nativeElement.querySelector('.side-host') as HTMLElement;
  const tabsIn = (host: HTMLElement) =>
    [...host.querySelectorAll('[role="tab"]')].map((el) => el.textContent!.trim());

  beforeEach(async () => {
    TabComponent.destroyed = 0;
    TestBed.configureTestingModule({ providers: [provideSplitWindows()] });
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges(); // needed with zone.js; harmless without it
    await fixture.whenStable();
    manager = TestBed.inject(SplitWindowManager);
    registry = TestBed.inject(SplitContainerRegistry);
  });

  afterEach(() => {
    document
      .querySelectorAll('.split-body-host, .split-body-backdrop')
      .forEach((el) => el.remove());
  });

  describe('providers', () => {
    it('without provideSplitWindows() injection fails', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({});
      expect(() => TestBed.inject(SplitWindowManager)).toThrow(/No provider/);
      expect(() => TestBed.inject(SplitContainerRegistry)).toThrow(/No provider/);
    });

    it('on the server, opens tabs without rendering or touching browser APIs', async () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [provideSplitWindows(), { provide: PLATFORM_ID, useValue: 'server' }],
      });
      const reg = TestBed.inject(SplitContainerRegistry);
      reg.useBodyContainers();
      const ref = TestBed.inject(SplitWindowManager).open(TabComponent);
      expect(ref.isOpen).toBe(true);
      expect(ref.componentInstance).toBeUndefined();
      expect(document.querySelector('.split-body-host')).toBeNull();
      TestBed.inject(SplitWindowManager).expandContainer('body-right');
      expect(await ref.close()).toBe(true);
    });

    it('manager.registry is the injectable singleton', () => {
      expect(manager.registry).toBe(registry);
    });

    it('the registry can be used without the manager', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ providers: [provideSplitWindows()] });
      const reg = TestBed.inject(SplitContainerRegistry);
      reg.useBodyContainers();
      expect(reg.getDefaultContainer()).toBe('body-right');
    });
  });

  describe('directive', () => {
    it('registers the containers in ngOnInit with options and default', () => {
      expect(registry.getContainerKeys().sort()).toEqual(['main', 'side']);
      expect(registry.getDefaultContainer()).toBe('main');
      expect(registry._get('main')!.options.maxTabs).toBe(5);
    });

    it('unregisters on destroy, dismissing the tabs', async () => {
      const ref = manager.open(TabComponent);
      fixture.componentInstance.showMain.set(false);
      await stable();
      expect(registry.hasContainer('main')).toBe(false);
      await expect(ref.result).rejects.toBe('container-removed');
      expect(TabComponent.destroyed).toBe(1);
    });

    it('re-registers when the key changes', async () => {
      fixture.componentInstance.sideKey.set('other');
      await stable();
      expect(registry.hasContainer('side')).toBe(false);
      expect(registry.hasContainer('other')).toBe(true);
    });
  });

  describe('open', () => {
    it('creates the component in the container with inputs and SplitActiveWindow', async () => {
      const ref = manager.open(TabComponent, { title: 'Contrato', inputs: { name: 'abc' } });
      await stable();
      expect(ref.containerKey).toBe('main');
      expect(ref.componentInstance).toBeInstanceOf(TabComponent);
      expect(ref.componentInstance!.window.ref).toBe(ref);
      expect(ref.componentInstance!.window.containerKey()).toBe('main');
      expect(ref.componentInstance!.window.isActive()).toBe(true);
      expect(mainHost().querySelector('.tab-content')!.textContent).toContain('abc / none');
      expect(tabsIn(mainHost())).toEqual(['Contrato']);
    });

    it('setInputData sets declared inputs by property or alias and ignores the rest', async () => {
      const ref = manager.open(InputsTabComponent, { inputs: { name: 'abc' } });
      await stable();
      ref.setInputData({ name: 'def', tabLabel: 'L', unknown: 1, extra: 'x' });
      await stable();
      const content = mainHost().querySelector('.inputs-content')!;
      expect(content.textContent).toBe('def / L');
      ref.setInputData({ name: undefined, label: 'M' }); // undefined is skipped
      await stable();
      expect(content.textContent).toBe('def / M');
    });

    it('setInputData on an inactive tab renders when it is activated', async () => {
      const a = manager.open(InputsTabComponent);
      manager.open(TabComponent);
      await stable();
      a.setInputData({ name: 'later' });
      await stable();
      a.activate();
      await stable();
      expect(mainHost().querySelector('.inputs-content')!.textContent).toBe('later / ');
    });

    it('setInputData on a template does nothing', async () => {
      const ref = manager.open(fixture.componentInstance.tpl(), { containerKey: 'main' });
      await stable();
      expect(() => ref.setInputData({ name: 'x' })).not.toThrow();
    });

    it('uses the given injector as parent', async () => {
      const injector = Injector.create({
        providers: [{ provide: TOKEN, useValue: 'from-injector' }],
      });
      manager.open(TabComponent, { injector });
      await stable();
      expect(mainHost().querySelector('.tab-content')!.textContent).toContain('from-injector');
    });

    it('accepts an environment injector', async () => {
      const env = createEnvironmentInjector(
        [{ provide: TOKEN, useValue: 'env' }],
        TestBed.inject(EnvironmentInjector),
      );
      manager.open(TabComponent, { injector: env });
      await stable();
      expect(mainHost().querySelector('.tab-content')!.textContent).toContain('env');
    });

    it('opens a template with the active window in the context', async () => {
      const ref = manager.open(fixture.componentInstance.tpl(), {
        containerKey: 'side',
        title: 'T',
      });
      await stable();
      expect(ref.componentInstance).toBeUndefined();
      expect(sideHost().querySelector('.tpl-content')!.textContent).toContain('template in side');
    });

    it('throws the core errors', () => {
      expect(() => manager.open(TabComponent, { containerKey: 'nope' })).toThrow(
        SplitContainerNotFoundError,
      );
    });

    it('keyboard: arrows activate, Delete closes, Ctrl+Shift+arrows reorder', async () => {
      const a = manager.open(TabComponent, { title: 'A' });
      const b = manager.open(TabComponent, { title: 'B' });
      await stable();
      const tabA = mainHost().querySelector(`#${a.id}-tab`) as HTMLElement;
      const key = (el: HTMLElement, init: KeyboardEventInit) =>
        el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init }));
      key(tabA, { key: 'ArrowRight' });
      expect(b.isActive).toBe(true);
      key(tabA, { key: 'Home' });
      expect(a.isActive).toBe(true);
      key(tabA, { key: 'ArrowRight', ctrlKey: true, shiftKey: true });
      await stable();
      expect(tabsIn(mainHost())).toEqual(['B', 'A']);
      key(mainHost().querySelector(`#${a.id}-tab`) as HTMLElement, { key: 'Delete' });
      await stable();
      expect(a.isOpen).toBe(false);
    });

    it('renders numbered labels, roles and aria attributes', async () => {
      const a = manager.open(TabComponent, { title: 'Contrato' });
      const b = manager.open(TabComponent, { title: 'Contrato' });
      await stable();
      expect(tabsIn(mainHost())).toEqual(['Contrato', 'Contrato (2)']);
      const tabs = mainHost().querySelectorAll('[role="tab"]');
      expect(tabs[0]!.getAttribute('aria-selected')).toBe('false');
      expect(tabs[1]!.getAttribute('aria-selected')).toBe('true');
      expect(tabs[1]!.getAttribute('aria-controls')).toBe(`${b.id}-panel`);
      const panel = mainHost().querySelector(`#${a.id}-panel`) as HTMLElement;
      expect(panel.getAttribute('role')).toBe('tabpanel');
      expect(panel.hidden).toBe(true);
      expect(mainHost().querySelector('[role="tablist"]')).not.toBeNull();
    });

    it('a reactivated tab keeps its rendered content (regression: detachView emptied panels)', async () => {
      const a = manager.open(TabComponent, { inputs: { name: 'first' } });
      manager.open(TabComponent, { inputs: { name: 'second' } });
      await stable();
      a.activate();
      await stable();
      const panel = mainHost().querySelector(`#${a.id}-panel`) as HTMLElement;
      expect(panel.hidden).toBe(false);
      expect(panel.querySelector('.tab-content')!.textContent).toContain('first');
    });

    it('inactive tabs are not checked; activation renders pending changes', async () => {
      const a = manager.open(TabComponent);
      manager.open(TabComponent);
      await stable();
      const panel = mainHost().querySelector(`#${a.id}-panel`) as HTMLElement;
      a.componentInstance!.extra.set('changed while inactive');
      await stable();
      expect(panel.hidden).toBe(true);
      expect(panel.querySelector('.extra')!.textContent).toBe('');
      a.activate();
      await stable();
      expect(panel.hidden).toBe(false);
      expect(panel.querySelector('.extra')!.textContent).toBe('changed while inactive');
    });

    it('with many tabs, an application tick only checks the active one', async () => {
      for (let i = 0; i < 100; i++) manager.open(CountTab, { containerKey: 'side' });
      await stable();
      CountTab.checks = 0;
      // With zone.js (`-c zone`) the tick is global and would check every attached view;
      // inactive tabs are detached, so only the active one runs its template.
      TestBed.inject(ApplicationRef).tick();
      expect(CountTab.checks).toBeLessThanOrEqual(2);
      expect(manager.getTabs('side')).toHaveLength(100);
    });

    it('activating a tab by click shows its panel and hides the other', async () => {
      const a = manager.open(TabComponent);
      const b = manager.open(TabComponent);
      await stable();
      (mainHost().querySelector(`#${a.id}-tab`) as HTMLElement).click();
      await stable();
      expect(a.isActive).toBe(true);
      expect((mainHost().querySelector(`#${a.id}-panel`) as HTMLElement).hidden).toBe(false);
      expect((mainHost().querySelector(`#${b.id}-panel`) as HTMLElement).hidden).toBe(true);
    });
  });

  describe('closing', () => {
    it('close destroys the component and removes the panel', async () => {
      const ref = manager.open(TabComponent);
      await stable();
      expect(await ref.close('ok')).toBe(true);
      await stable();
      expect(TabComponent.destroyed).toBe(1);
      expect(mainHost().querySelector('.tab-content')).toBeNull();
      expect(tabsIn(mainHost())).toEqual([]);
    });

    it('the X button goes through canClose; closable:false hides it', async () => {
      let allow = false;
      const ref = manager.open(TabComponent, { canClose: () => allow });
      manager.open(TabComponent, { closable: false });
      await stable();
      const closeButtons = mainHost().querySelectorAll('.split-tab__close');
      expect(closeButtons).toHaveLength(1);
      (closeButtons[0] as HTMLElement).click();
      await stable();
      expect(ref.isOpen).toBe(true);
      allow = true;
      (closeButtons[0] as HTMLElement).click();
      await stable();
      expect(ref.isOpen).toBe(false);
    });

    it('SplitActiveWindow can close and rename its own tab', async () => {
      const ref = manager.open(TabComponent);
      await stable();
      const win = ref.componentInstance!.window;
      win.setTitle('Renamed');
      await stable();
      expect(win.label()).toBe('Renamed');
      expect(tabsIn(mainHost())).toEqual(['Renamed']);
      win.setClosable(false);
      await stable();
      expect(mainHost().querySelector('.split-tab__close')).toBeNull();
      win.setCanClose(() => false);
      expect(await win.close()).toBe(false);
      expect(await win.dismiss('x', { force: true })).toBe(true);
    });

    it('the close-all button closes every closable tab', async () => {
      manager.open(TabComponent);
      manager.open(TabComponent);
      const kept = manager.open(TabComponent, { closable: false });
      await stable();
      (mainHost().querySelector('.split-close-all-button') as HTMLButtonElement).click();
      await stable();
      expect(manager.getTabs('main')).toEqual([kept]);
    });

    it('dismissAll and hasOpenWindows delegate to the core', async () => {
      manager.open(TabComponent);
      expect(manager.hasOpenWindows('main')).toBe(true);
      const result = await manager.dismissAll();
      expect(result.closed).toHaveLength(1);
      expect(manager.hasOpenWindows()).toBe(false);
    });
  });

  describe('moving', () => {
    it('moveTo moves the element without destroying the component', async () => {
      const ref = manager.open(TabComponent, { title: 'Doc' });
      await stable();
      const input = mainHost().querySelector('.field') as HTMLInputElement;
      input.value = 'typed';
      const instance = ref.componentInstance;
      const moved: unknown[] = [];
      ref.containerChanged.subscribe((e) => moved.push(e));
      expect(ref.moveTo('side')).toBe(true);
      await stable();
      expect(TabComponent.destroyed).toBe(0);
      expect(ref.componentInstance).toBe(instance);
      expect(sideHost().querySelector('.field')).toBe(input);
      expect(input.value).toBe('typed');
      expect(instance!.window.containerKey()).toBe('side');
      expect(tabsIn(sideHost())).toEqual(['Doc']);
      expect(tabsIn(mainHost())).toEqual([]);
      expect(moved).toEqual([{ fromKey: 'main', toKey: 'side', index: 0, label: 'Doc' }]);
    });

    it('a drop on a strip asks the core and moves the tab', async () => {
      const ref = manager.open(TabComponent);
      await stable();
      const engine = TestBed.inject(AngularSplitEngine);
      const controller = TestBed.inject(SplitWindowController);
      const ended: unknown[] = [];
      ref.dragEnded.subscribe((e) => ended.push(e));
      controller.beginDrag(ref);
      engine.handleDrop(dropEvent(ref, { key: 'side', kind: 'strip' }, 0, true));
      expect(ref.containerKey).toBe('side');
      expect(ended).toEqual([{ moved: true }]);
      controller.beginDrag(ref);
      engine.handleDrop(dropEvent(ref, { key: 'main', kind: 'content' }, 0, false));
      expect(ref.containerKey).toBe('side');
      expect(ended.at(-1)).toEqual({ moved: false });
      controller.beginDrag(ref);
      engine.handleDrop(dropEvent(ref, { key: 'side', kind: 'content' }, 0, true));
      expect(ended.at(-1)).toEqual({ moved: false });
    });

    it('startDrag shows floating zones for closed containers and connects the lists', async () => {
      registry.registerContainer('closed', document.createElement('div'), {
        closedDropZoneAnchor: mainHost(),
      });
      const ref = manager.open(TabComponent);
      manager.open(TabComponent, { containerKey: 'side' });
      await stable();
      const engine = TestBed.inject(AngularSplitEngine);
      const list = { connectedTo: [] as string[] } as never;
      engine.startDrag(ref, list);
      expect((list as { connectedTo: string[] }).connectedTo).toEqual([
        'split-strip-side',
        'split-content-side',
        'split-float-closed',
      ]);
      expect(
        document.querySelector('.split-drop-zone[data-container-key="closed"]'),
      ).not.toBeNull();
      engine.handleDrop(dropEvent(ref, { key: 'main', kind: 'strip' }, 0, false));
      await stable();
      expect(document.querySelector('.split-drop-zone')).toBeNull();
    });

    it('startDrag with an expanded container connects nothing', async () => {
      const ref = manager.open(TabComponent);
      manager.open(TabComponent, { containerKey: 'side' });
      await stable();
      manager.expandContainer('main');
      const engine = TestBed.inject(AngularSplitEngine);
      const list = { connectedTo: ['x'] as string[] } as never;
      engine.startDrag(ref, list);
      expect((list as { connectedTo: string[] }).connectedTo).toEqual([]);
    });

    it('moveNode falls back to insertBefore', () => {
      const parent = document.createElement('div');
      const node = document.createElement('span');
      moveNode(parent, node);
      expect(node.parentNode).toBe(parent);
      moveNode(parent, node); // already there
      expect(parent.childNodes).toHaveLength(1);
    });
  });

  describe('full screen', () => {
    it('the button expands and Esc restores', async () => {
      manager.open(TabComponent);
      await stable();
      const button = mainHost().querySelector('.split-expand-button') as HTMLButtonElement;
      button.click();
      await stable();
      expect(manager.isContainerExpanded('main')).toBe(true);
      const shell = document.querySelector(
        'split-container[data-container-key="main"]',
      ) as HTMLElement;
      expect(shell.classList).toContain('split-container--expanded');
      expect(shell.style.position).toBe('fixed');
      // jsdom measures every rectangle as 0x0, so the measured position never matches the
      // computed one and the shell goes to the body layer, as with a transformed ancestor.
      expect(shell.parentElement!.classList).toContain('split-expand-layer');
      shell.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await stable();
      expect(manager.isContainerExpanded('main')).toBe(false);
      expect(shell.style.position).toBe('');
      expect(shell.parentElement).toBe(mainHost());
    });

    it('expand: false hides the button', async () => {
      registry.registerContainer(
        'noexp',
        document.body.appendChild(document.createElement('div')),
        {
          expand: false,
        },
      );
      manager.open(TabComponent, { containerKey: 'noexp' });
      await stable();
      expect(
        document.querySelector('[data-container-key="noexp"] .split-expand-button'),
      ).toBeNull();
    });
  });

  describe('body containers', () => {
    it('are created on first use as fixed panels and hidden when empty', async () => {
      registry.useBodyContainers({ left: { size: '300px', backdrop: true } });
      const ref = manager.open(TabComponent, { containerKey: 'body-left' });
      await stable();
      const host = document.querySelector('.split-body-host--left') as HTMLElement;
      expect(host).not.toBeNull();
      expect(host.hidden).toBe(false);
      expect(host.style.getPropertyValue('--split-body-size')).toBe('300px');
      expect((document.querySelector('.split-body-backdrop') as HTMLElement).hidden).toBe(false);
      await ref.close();
      await stable();
      expect(host.hidden).toBe(true);
      expect(manager.isContainerOpen('body-left')).toBe(false);
      registry.useBodyContainers({ right: true });
      expect(document.querySelector('.split-body-host--left')).toBeNull();
    });
  });
});

function dropEvent(
  ref: SplitWindowRef,
  target: SplitDropListData,
  currentIndex: number,
  isPointerOverContainer: boolean,
) {
  return {
    item: { data: ref },
    container: { data: target },
    previousContainer: { data: { key: ref.containerKey, kind: 'strip' } },
    currentIndex,
    previousIndex: 0,
    isPointerOverContainer,
  } as never;
}
