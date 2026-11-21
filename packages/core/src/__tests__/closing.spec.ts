import { describe, expect, it, vi } from 'vitest';
import { Subject, of, throwError, EMPTY } from 'rxjs';
import type { SplitCloseContext } from '../model/types.js';
import { deferred, flush, host, setup } from './helpers.js';

function ctx() {
  const s = setup();
  s.registry.registerContainer('a', host());
  s.registry.setDefaultContainer('a');
  return s;
}

describe('close and dismiss', () => {
  it('close resolves result; dismiss rejects it', async () => {
    const { open } = ctx();
    const a = open();
    const b = open();
    expect(await a.close('ok')).toBe(true);
    await expect(a.result).resolves.toBe('ok');
    expect(await b.dismiss('nope')).toBe(true);
    await expect(b.result).rejects.toBe('nope');
  });

  it('emits closed/dismissed before destroy and hidden after, then completes', async () => {
    const { open, engine } = ctx();
    const ref = open();
    const order: string[] = [];
    let completed = false;
    ref.closed.subscribe(() => order.push(`closed:${engine.tabs.get(ref.id)!.destroyed}`));
    ref.hidden.subscribe({
      next: () => order.push(`hidden:${engine.tabs.get(ref.id)!.destroyed}`),
      complete: () => (completed = true),
    });
    await ref.close();
    expect(order).toEqual(['closed:false', 'hidden:true']);
    expect(completed).toBe(true);
  });

  it('closing the active tab activates the right neighbor, else the left one', async () => {
    const { open } = ctx();
    const a = open({ title: 'a' });
    const b = open({ title: 'b' });
    const c = open({ title: 'c' });
    b.activate();
    await b.close();
    expect(c.isActive).toBe(true);
    await c.close();
    expect(a.isActive).toBe(true);
  });

  it('closing an inactive tab keeps the active one', async () => {
    const { open } = ctx();
    const a = open();
    const b = open();
    await a.close();
    expect(b.isActive).toBe(true);
  });

  it('registers tabs by identity: closing one never unregisters another', async () => {
    const { open, controller } = ctx();
    const a = open();
    const b = open();
    await a.close();
    await a.close();
    expect(controller.getTabs('a')).toEqual([b]);
    expect(b.isOpen).toBe(true);
  });

  it('operations on a closed ref do nothing', async () => {
    const { open } = ctx();
    const a = open({ title: 'A' });
    await a.close();
    expect(await a.dismiss()).toBe(false);
    a.setTitle('B');
    a.setClosable(false);
    a.setCanClose(null);
    a.setCanMove(null);
    a.activate();
    expect(a.title).toBe('A');
    expect(a.isActive).toBe(false);
  });

  it('a custom container without closeWhenEmpty stays open when empty', async () => {
    const { open, registry } = ctx();
    const a = open();
    await a.close();
    expect(registry.isContainerOpen('a')).toBe(true);
  });

  it('closeWhenEmpty closes (hides) the container without unregistering; a new tab reopens it', async () => {
    const { registry, open, engine } = setup();
    registry.registerContainer('a', host(), { closeWhenEmpty: true });
    const ref = open({ containerKey: 'a' });
    registry.expandContainer('a');
    await ref.close();
    expect(registry.isContainerOpen('a')).toBe(false);
    expect(registry.isContainerExpanded('a')).toBe(false);
    expect(registry.hasContainer('a')).toBe(true);
    expect(engine.containers.get('a')).toMatchObject({
      mounted: true,
      open: false,
      expanded: false,
    });
    open({ containerKey: 'a' });
    expect(registry.isContainerOpen('a')).toBe(true);
    expect(engine.callsOf('mountContainer')).toHaveLength(1);
  });

  it('unregisterContainer dismisses the tabs with force and unmounts the shell', async () => {
    const { registry, open, engine } = ctx();
    const guard = vi.fn(() => false);
    const ref = open({ canClose: guard });
    registry.unregisterContainer('a');
    await expect(ref.result).rejects.toBe('container-removed');
    expect(guard).not.toHaveBeenCalled();
    expect(engine.containers.get('a')!.mounted).toBe(false);
    expect(registry.getDefaultContainer()).toBeNull();
  });
});

describe('canClose', () => {
  it('receives the context and keeps the tab open on false, emitting closePrevented', async () => {
    const { open } = ctx();
    const seen: SplitCloseContext[] = [];
    const ref = open({ canClose: (c) => (seen.push(c), false) });
    const prevented: unknown[] = [];
    ref.closePrevented.subscribe((e) => prevented.push(e));
    expect(await ref.close('r')).toBe(false);
    expect(ref.isOpen).toBe(true);
    expect(seen[0]).toMatchObject({ ref, trigger: 'close', reason: 'r' });
    expect(prevented).toEqual([{ trigger: 'close', reason: 'r' }]);
    await ref.dismiss('x');
    expect(seen[1]!.trigger).toBe('dismiss');
  });

  it('accepts true synchronously', async () => {
    const { open } = ctx();
    const ref = open({ canClose: () => true });
    const promise = ref.close();
    expect(ref.isOpen).toBe(false);
    expect(await promise).toBe(true);
  });

  it('accepts a Promise', async () => {
    const { open } = ctx();
    const d = deferred<boolean>();
    const ref = open({ canClose: () => d.promise });
    const promise = ref.close();
    expect(ref.isOpen).toBe(true);
    d.resolve(true);
    expect(await promise).toBe(true);
    expect(ref.isOpen).toBe(false);
  });

  it('accepts an Observable: first value counts', async () => {
    const { open } = ctx();
    const subject = new Subject<boolean>();
    const ref = open({ canClose: () => subject });
    const promise = ref.close();
    subject.next(false);
    subject.next(true);
    expect(await promise).toBe(false);
    expect(ref.isOpen).toBe(true);
    ref.setCanClose(() => of(true));
    expect(await ref.close()).toBe(true);
  });

  it('an Observable that completes without a value, or errors, keeps the tab open', async () => {
    const { open } = ctx();
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const a = open({ canClose: () => EMPTY });
    expect(await a.close()).toBe(false);
    const b = open({ canClose: () => throwError(() => new Error('x')) });
    expect(await b.close()).toBe(false);
    expect(errors).toHaveBeenCalledTimes(1);
    errors.mockRestore();
  });

  it('a rejected Promise or an exception keeps the tab open and logs the error', async () => {
    const { open } = ctx();
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const a = open({ canClose: () => Promise.reject(new Error('x')) });
    expect(await a.close()).toBe(false);
    const b = open({
      canClose: () => {
        throw new Error('y');
      },
    });
    expect(await b.close()).toBe(false);
    const c = open({ canClose: () => 'yes' as never });
    expect(await c.close()).toBe(false);
    expect(errors).toHaveBeenCalledTimes(2);
    errors.mockRestore();
  });

  it('repeated requests while a check runs do not call the guard again', async () => {
    const { open } = ctx();
    const d = deferred<boolean>();
    const guard = vi.fn(() => d.promise);
    const ref = open({ canClose: guard });
    const p1 = ref.close();
    const p2 = ref.dismiss();
    expect(p2).toBe(p1);
    d.resolve(true);
    expect(await p1).toBe(true);
    expect(guard).toHaveBeenCalledTimes(1);
    await expect(ref.result).resolves.toBeUndefined();
  });

  it('force skips the guard, even while a check runs', async () => {
    const { open } = ctx();
    const d = deferred<boolean>();
    const guard = vi.fn(() => d.promise);
    const ref = open({ canClose: guard });
    const pending = ref.close('a');
    expect(await ref.dismiss('forced', { force: true })).toBe(true);
    await expect(ref.result).rejects.toBe('forced');
    d.resolve(false);
    expect(await pending).toBe(true);
    const other = open({ canClose: guard });
    expect(await other.close(1, { force: true })).toBe(true);
    expect(guard).toHaveBeenCalledTimes(1);
  });

  it('the tab button goes through canClose with trigger tab-button', async () => {
    const { open, controller } = ctx();
    const triggers: string[] = [];
    const ref = open({ canClose: (c) => (triggers.push(c.trigger), true) });
    expect(await controller.requestTabClose(ref)).toBe(true);
    expect(triggers).toEqual(['tab-button']);
  });

  it('destroy is only called after canClose approves', async () => {
    const { open, engine } = ctx();
    const d = deferred<boolean>();
    const ref = open({ canClose: () => d.promise });
    const p = ref.close();
    await flush();
    expect(engine.callsOf('destroy')).toHaveLength(0);
    d.resolve(true);
    await p;
    expect(engine.callsOf('destroy')).toHaveLength(1);
  });
});

describe('dismissAll', () => {
  it('closes in order, skips closable:false, waits for confirmations and continues', async () => {
    const { open, controller } = ctx();
    const plain = open({ title: 'plain' });
    const pinned = open({ title: 'pinned', closable: false });
    const d1 = deferred<boolean>();
    const d2 = deferred<boolean>();
    const refuses = open({ title: 'refuses', canClose: () => d1.promise });
    const accepts = open({ title: 'accepts', canClose: () => d2.promise });
    const after = open({ title: 'after' });

    const promise = controller.dismissAll({ containerKey: 'a', reason: 'all' });
    expect(plain.isOpen).toBe(false);
    expect(controller.isClosingAll('a')).toBe(true);
    expect(controller.getContainerView('a')!.closingAll).toBe(true);
    // the tab awaiting confirmation is activated
    expect(refuses.isActive).toBe(true);
    // tabs opened during the process do not enter
    const late = open({ title: 'late' });
    d1.resolve(false);
    await flush();
    expect(accepts.isActive).toBe(true);
    d2.resolve(true);
    const result = await promise;
    expect(result.closed).toEqual([plain, accepts, after]);
    expect(result.kept).toEqual([pinned, refuses]);
    expect(late.isOpen).toBe(true);
    expect(controller.isClosingAll('a')).toBe(false);
    await expect(plain.result).rejects.toBe('all');
  });

  it('with force closes without guards but still skips closable:false', async () => {
    const { open, controller } = ctx();
    const guard = vi.fn(() => false);
    const a = open({ canClose: guard });
    const b = open({ closable: false });
    const result = await controller.dismissAll({ force: true });
    expect(result.closed).toEqual([a]);
    expect(result.kept).toEqual([b]);
    expect(guard).not.toHaveBeenCalled();
  });

  it('without containerKey covers every container; tabs closed meanwhile are skipped', async () => {
    const { registry, open, controller } = ctx();
    registry.registerContainer('b', host());
    const d = deferred<boolean>();
    const a1 = open({ canClose: () => d.promise });
    const a2 = open();
    const b1 = open({ containerKey: 'b' });
    const promise = controller.dismissAll();
    await a2.close(undefined, { force: true });
    d.resolve(true);
    const result = await promise;
    expect(result.closed).toEqual([a1, b1]);
    expect(controller.hasOpenWindows()).toBe(false);
  });

  it('throws for an unknown container', async () => {
    const { controller } = ctx();
    await expect(controller.dismissAll({ containerKey: 'zzz' })).rejects.toThrow(/zzz/);
  });
});
