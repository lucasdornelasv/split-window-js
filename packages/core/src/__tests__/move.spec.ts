import { describe, expect, it, vi } from 'vitest';
import { SplitContainerNotFoundError, SplitInvalidOptionError } from '../errors/errors.js';
import type { SplitTabMovedEvent, SplitTabRejectedEvent } from '../model/types.js';
import { host, setup } from './helpers.js';

function ctx() {
  const s = setup();
  s.registry.registerContainer('a', host());
  s.registry.registerContainer('b', host());
  s.registry.setDefaultContainer('a');
  return s;
}

describe('moveTo / moveTab', () => {
  it('reorders inside the container and emits reordered + tabMoved', () => {
    const { open, controller, labels, engine } = ctx();
    const x = open({ title: 'x' });
    open({ title: 'y' });
    open({ title: 'z' });
    const moved: SplitTabMovedEvent[] = [];
    controller.tabMoved.subscribe((e) => moved.push(e));
    const reordered: unknown[] = [];
    x.reordered.subscribe((e) => reordered.push(e));
    engine.reset();
    expect(x.moveTo('a', 2)).toBe(true);
    expect(labels('a')).toEqual(['y', 'z', 'x']);
    expect(reordered).toEqual([{ from: 0, to: 2 }]);
    expect(moved[0]).toMatchObject({
      type: 'reordered',
      fromKey: 'a',
      toKey: 'a',
      fromIndex: 0,
      toIndex: 2,
    });
    expect(engine.callsOf('move')).toHaveLength(0);
    expect(x.moveTo('a', 2)).toBe(false);
    expect(x.moveTo('a')).toBe(false); // already at the end
  });

  it('moves to another container without destroying, recalculating the number', () => {
    const { open, controller, labels, engine, registry } = ctx();
    open({ title: 'Contrato' });
    const second = open({ title: 'Contrato' });
    const changed: unknown[] = [];
    const titles: unknown[] = [];
    second.containerChanged.subscribe((e) => changed.push(e));
    second.titleChanged.subscribe((e) => titles.push(e));
    const moved: SplitTabMovedEvent[] = [];
    controller.tabMoved.subscribe((e) => moved.push(e));
    expect(second.moveTo('b')).toBe(true);
    expect(second.containerKey).toBe('b');
    expect(labels('a')).toEqual(['Contrato']);
    expect(labels('b')).toEqual(['Contrato']);
    expect(changed).toEqual([{ fromKey: 'a', toKey: 'b', index: 0, label: 'Contrato' }]);
    expect(titles).toEqual([{ title: 'Contrato', label: 'Contrato' }]);
    expect(moved[0]).toMatchObject({
      type: 'containerChanged',
      fromKey: 'a',
      toKey: 'b',
      fromIndex: 1,
      toIndex: 0,
    });
    expect(engine.callsOf('destroy')).toHaveLength(0);
    expect(engine.tabs.get(second.id)!.containerKey).toBe('b');
    expect(registry.isContainerOpen('b')).toBe(true);
  });

  it('the moved tab becomes active in the destination; the source activates the neighbor', () => {
    const { open } = ctx();
    const a1 = open({ title: '1' });
    const a2 = open({ title: '2' });
    const b1 = open({ title: 'b', containerKey: 'b' });
    a2.moveTo('b', 0);
    expect(a2.isActive).toBe(true);
    expect(b1.isActive).toBe(false);
    expect(a1.isActive).toBe(true);
  });

  it('moving an inactive tab keeps the active tab of the source', () => {
    const { open } = ctx();
    const a1 = open({ title: '1' });
    const a2 = open({ title: '2' });
    a1.moveTo('b');
    expect(a2.isActive).toBe(true);
    expect(a1.isActive).toBe(true);
  });

  it('closes the source when it becomes empty and has closeWhenEmpty', () => {
    const { registry, open } = setup();
    registry.registerContainer('a', host(), { closeWhenEmpty: true });
    registry.registerContainer('b', host(), { closeWhenEmpty: true });
    const ref = open({ containerKey: 'a' });
    ref.moveTo('b');
    expect(registry.isContainerOpen('a')).toBe(false);
    expect(registry.isContainerOpen('b')).toBe(true);
    ref.moveTo('a');
    expect(registry.isContainerOpen('a')).toBe(true);
    expect(registry.isContainerOpen('b')).toBe(false);
  });

  it('mounts the destination on demand', () => {
    const { open, engine } = ctx();
    const ref = open();
    expect(engine.containers.has('b')).toBe(false);
    ref.moveTo('b');
    expect(engine.containers.get('b')!.mounted).toBe(true);
  });

  it('throws for an unknown key and validates it', () => {
    const { open } = ctx();
    const ref = open();
    expect(() => ref.moveTo('zzz')).toThrow(SplitContainerNotFoundError);
    expect(() => ref.moveTo('')).toThrow(SplitInvalidOptionError);
  });

  it('a full destination refuses the move and fires tabRejected, without onReject', () => {
    const { registry, open, controller } = ctx();
    const onReject = vi.fn(() => ({ action: 'throw' as const }));
    registry.registerContainer('full', host(), { maxTabs: 1, onFull: 'replace-oldest', onReject });
    open({ containerKey: 'full' });
    const ref = open();
    const rejected: SplitTabRejectedEvent[] = [];
    controller.tabRejected.subscribe((e) => rejected.push(e));
    expect(ref.moveTo('full')).toBe(false);
    expect(ref.containerKey).toBe('a');
    expect(rejected[0]).toMatchObject({
      resolution: 'move-refused',
      context: { source: 'move', incomingRef: ref },
    });
    expect(onReject).not.toHaveBeenCalled();
  });

  it('a custom onFull handler can replace a tab on moves', () => {
    const { registry, open, labels } = ctx();
    registry.registerContainer('full', host(), {
      maxTabs: 1,
      onFull: (c) =>
        c.source === 'move' ? { action: 'replace', ref: c.tabs[0]! } : { action: 'reject' },
    });
    open({ containerKey: 'full', title: 'old' });
    const ref = open({ title: 'new' });
    expect(ref.moveTo('full')).toBe(true);
    expect(labels('full')).toEqual(['new']);
  });

  it('canMove vetoes moves and receives the target', () => {
    const { open } = ctx();
    const canMove = vi.fn((t: { containerKey: string; index?: number }) => t.containerKey !== 'b');
    const ref = open({ canMove });
    open();
    expect(ref.moveTo('b', 0)).toBe(false);
    expect(canMove).toHaveBeenLastCalledWith({ containerKey: 'b', index: 0 });
    expect(ref.moveTo('a', 1)).toBe(true);
    ref.setCanMove(null);
    expect(ref.moveTo('b')).toBe(true);
  });

  it('programmatic moves ignore the expanded-container restriction', () => {
    const { registry, open } = ctx();
    const ref = open();
    open({ containerKey: 'b' });
    registry.expandContainer('b');
    expect(ref.moveTo('b')).toBe(true);
  });
});

describe('canDrop and drags', () => {
  it('applies canMove, maxTabs and the existence of the target', () => {
    const { registry, open, controller } = ctx();
    registry.registerContainer('full', host(), { maxTabs: 1 });
    open({ containerKey: 'full' });
    const ref = open({ canMove: (t) => t.containerKey !== 'b' });
    expect(controller.canDrop(ref, 'a')).toBe(true);
    expect(controller.canDrop(ref, 'b')).toBe(false);
    expect(controller.canDrop(ref, 'full')).toBe(false);
    expect(controller.canDrop(ref, 'missing')).toBe(false);
  });

  it('with an expanded container, drags only reorder inside it', () => {
    const { registry, open, controller } = ctx();
    const inA = open();
    open();
    const inB = open({ containerKey: 'b' });
    registry.expandContainer('a');
    expect(controller.canDrop(inA, 'a')).toBe(true);
    expect(controller.canDrop(inA, 'b')).toBe(false);
    expect(controller.canDrop(inB, 'b')).toBe(false);
    expect(controller.canDrop(inB, 'a')).toBe(false);
    expect(controller.moveTab(inA, 'b', 0, 'drag')).toBe(false);
    expect(controller.moveTab(inB, 'a', 0, 'drag')).toBe(false);
    expect(controller.moveTab(inA, 'a', 1, 'drag')).toBe(true);
    expect(controller.canDrop(inA, 'b', undefined, 'api')).toBe(true);
  });

  it('getDropTargets lists the other containers that accept the tab', () => {
    const { registry, open, controller } = ctx();
    registry.registerContainer('full', host(), { maxTabs: 1 });
    open({ containerKey: 'full' });
    const ref = open();
    expect(controller.getDropTargets(ref).map((t) => t.key)).toEqual(['b']);
  });

  it('beginDrag/endDrag emit dragStarted/dragEnded and expose the dragging state', () => {
    const { open, controller } = ctx();
    const ref = open();
    const events: unknown[] = [];
    ref.dragStarted.subscribe(() => events.push('start'));
    ref.dragEnded.subscribe((e) => events.push(e));
    controller.beginDrag(ref);
    expect(controller.draggingTab).toBe(ref);
    expect(controller.getContainerView('a')!.dragging).toBe(true);
    controller.endDrag(open(), true); // another ref: ignored
    controller.endDrag(ref, false);
    expect(controller.draggingTab).toBeNull();
    expect(events).toEqual(['start', { moved: false }]);
  });

  it('changing the expansion during a drag cancels it and ignores the next drop', () => {
    const { registry, open, controller, engine } = ctx();
    const ref = open();
    open({ containerKey: 'b' });
    controller.beginDrag(ref);
    registry.expandContainer('b');
    expect(engine.cancelDragCount).toBe(1);
    registry.restoreContainer('b');
    expect(controller.canDrop(ref, 'b')).toBe(false);
    expect(controller.moveTab(ref, 'b', 0, 'drag')).toBe(false);
    controller.endDrag(ref, false);
    expect(controller.canDrop(ref, 'b')).toBe(true);
  });

  it('closed refs cannot be dropped or moved', async () => {
    const { open, controller } = ctx();
    const ref = open();
    await ref.close();
    expect(controller.canDrop(ref, 'b')).toBe(false);
    expect(controller.moveTab(ref, 'b')).toBe(false);
  });

  it('moving to a container being dragged to with a missing target returns false', () => {
    const { open, controller } = ctx();
    const ref = open();
    expect(controller.moveTab(ref, 'missing', 0, 'drag')).toBe(false);
  });
});

describe('expansion with the engine', () => {
  it('calls setExpanded on mounted containers and emits changes', () => {
    const { registry, open, engine, controller } = ctx();
    open();
    const changes: string[] = [];
    controller.changes.subscribe((k) => changes.push(k));
    registry.expandContainer('a');
    registry.restoreContainer('a');
    expect(engine.callsOf('setExpanded').map((c) => c.value)).toEqual([true, false]);
    expect(changes).toEqual(['a', 'a']);
  });

  it('body reconfiguration of a kept side emits a change', () => {
    const { registry, open, controller } = setup();
    registry.useBodyContainers();
    open();
    const changes: string[] = [];
    controller.changes.subscribe((k) => changes.push(k));
    registry.useBodyContainers({ right: { size: '50vw' } });
    expect(changes).toEqual(['body-right']);
  });
});
