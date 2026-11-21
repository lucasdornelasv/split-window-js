import { describe, expect, it, vi } from 'vitest';
import {
  SplitContainerNotFoundError,
  SplitInvalidOptionError,
  SplitNoDefaultContainerError,
} from '../errors/errors.js';
import { host, setup } from './helpers.js';

describe('open', () => {
  it('without containerKey and without default throws SplitNoDefaultContainerError', () => {
    const { open } = setup();
    expect(() => open()).toThrow(SplitNoDefaultContainerError);
  });

  it('with an unknown containerKey throws, without falling back to the default', () => {
    const { registry, open } = setup();
    registry.useBodyContainers();
    expect(() => open({ containerKey: 'contratos' })).toThrow(SplitContainerNotFoundError);
  });

  it('uses the default container from useBodyContainers()', () => {
    const { registry, open } = setup();
    registry.useBodyContainers();
    const ref = open();
    expect(ref.containerKey).toBe('body-right');
  });

  it('validates the options', () => {
    const { registry, open } = setup();
    registry.useBodyContainers();
    expect(() => open({ title: 5 as never })).toThrow(SplitInvalidOptionError);
    expect(() => open({ containerKey: '' })).toThrow(SplitInvalidOptionError);
    expect(() => open({ canClose: 'x' as never })).toThrow(SplitInvalidOptionError);
    expect(() => open({ activate: 'yes' as never })).toThrow(SplitInvalidOptionError);
    expect(() => open(null as never)).toThrow(SplitInvalidOptionError);
  });

  it('mounts and opens the container on the first tab, then creates, attaches and activates', () => {
    const { registry, open, engine, controller } = setup();
    registry.registerContainer('a', host());
    expect(controller.isContainerOpen('a')).toBe(false);
    const ref = open({ containerKey: 'a' });
    expect(engine.sequence()).toEqual([
      'mountContainer',
      'createTab',
      'attach',
      'setContainerOpen',
      'activate',
    ]);
    expect(controller.isContainerOpen('a')).toBe(true);
    expect(ref.isActive).toBe(true);
    expect(ref.componentInstance).toEqual({ content: 'content' });
    open({ containerKey: 'a' });
    expect(engine.callsOf('mountContainer')).toHaveLength(1);
  });

  it('passes adapter options to the engine', () => {
    const { registry, controller, engine } = setup();
    registry.registerContainer('a', host());
    const ref = controller.open('c', { containerKey: 'a' }, { inputs: { x: 1 } });
    expect(engine.tabs.get(ref.id)!.adapterOptions).toEqual({ inputs: { x: 1 } });
  });

  it('activate: false keeps the current tab, but the first tab of an empty container is activated', () => {
    const { registry, open } = setup();
    registry.registerContainer('a', host());
    const first = open({ containerKey: 'a', activate: false });
    expect(first.isActive).toBe(true);
    const second = open({ containerKey: 'a', activate: false });
    expect(second.isActive).toBe(false);
    expect(first.isActive).toBe(true);
  });

  it('activation deactivates the previous tab and emits events', () => {
    const { registry, open, engine } = setup();
    registry.registerContainer('a', host());
    const a = open({ containerKey: 'a' });
    const events: string[] = [];
    a.deactivated.subscribe(() => events.push('a-off'));
    const b = open({ containerKey: 'a' });
    b.activated.subscribe(() => events.push('b-on'));
    a.activate();
    b.activate();
    b.activate(); // already active
    // a-off when b opens; b-on was subscribed after b opened; a-off + b-on on b.activate()
    expect(events).toEqual(['a-off', 'a-off', 'b-on']);
    expect(engine.tabs.get(a.id)!.active).toBe(false);
    expect(engine.tabs.get(b.id)!.active).toBe(true);
  });

  it('rolls back when the engine fails to create the tab', () => {
    const { registry, open, engine, controller, labels } = setup();
    registry.registerContainer('a', host());
    engine.failNextCreate = new Error('boom');
    expect(() => open({ containerKey: 'a', title: 'X' })).toThrow('boom');
    expect(controller.hasOpenWindows('a')).toBe(false);
    open({ containerKey: 'a', title: 'X' });
    expect(labels('a')).toEqual(['X']);
  });

  it('closable defaults to the config', () => {
    const s = setup({ closable: false });
    s.registry.registerContainer('a', host());
    expect(s.open({ containerKey: 'a' }).closable).toBe(false);
    expect(s.open({ containerKey: 'a', closable: true }).closable).toBe(true);
  });

  it('hasOpenWindows and getContainerView', () => {
    const { registry, open, controller } = setup();
    registry.registerContainer('a', host());
    registry.registerContainer('b', host(), { expand: false, label: 'Bê' });
    expect(controller.hasOpenWindows()).toBe(false);
    expect(controller.getContainerView('missing')).toBeNull();
    const ref = open({ containerKey: 'a', title: 'T' });
    expect(controller.hasOpenWindows()).toBe(true);
    expect(controller.hasOpenWindows('a')).toBe(true);
    expect(controller.hasOpenWindows('b')).toBe(false);
    expect(controller.hasOpenWindows('missing')).toBe(false);
    const view = controller.getContainerView('a')!;
    expect(view.activeId).toBe(ref.id);
    expect(view.canExpand).toBe(true);
    expect(view.tabs).toEqual([
      { id: ref.id, title: 'T', label: 'T', closable: true, active: true, ref },
    ]);
    const viewB = controller.getContainerView('b')!;
    expect(viewB.canExpand).toBe(false);
    expect(viewB.container.label).toBe('Bê');
    expect(viewB.tabs).toEqual([]);
  });

  it('emits changes for the container', () => {
    const { registry, open, controller } = setup();
    registry.registerContainer('a', host());
    const changes = vi.fn();
    controller.changes.subscribe(changes);
    const ref = open({ containerKey: 'a' });
    changes.mockClear();
    ref.setClosable(false);
    ref.setClosable(false); // unchanged
    ref.setCanClose(() => true);
    expect(changes).toHaveBeenCalledTimes(2);
    expect(changes).toHaveBeenCalledWith('a');
    expect(() => ref.setCanClose('x' as never)).toThrow(SplitInvalidOptionError);
    expect(() => ref.setTitle(1 as never)).toThrow(SplitInvalidOptionError);
  });

  it('ids are unique', () => {
    const { registry, open } = setup();
    registry.useBodyContainers();
    const ids = new Set([open().id, open().id, open().id]);
    expect(ids.size).toBe(3);
  });

  it('destroy completes the controller observables', () => {
    const { controller } = setup();
    let completed = 0;
    controller.changes.subscribe({ complete: () => completed++ });
    controller.tabMoved.subscribe({ complete: () => completed++ });
    controller.tabRejected.subscribe({ complete: () => completed++ });
    controller.destroy();
    expect(completed).toBe(3);
  });
});
