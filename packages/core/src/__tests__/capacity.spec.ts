import { describe, expect, it } from 'vitest';
import {
  SplitContainerFullError,
  SplitContainerNotFoundError,
  SplitInvalidOptionError,
} from '../errors/errors.js';
import type { SplitTabRejectedEvent } from '../model/types.js';
import { host, setup } from './helpers.js';

function rejections(controller: ReturnType<typeof setup>['controller']) {
  const list: SplitTabRejectedEvent[] = [];
  controller.tabRejected.subscribe((e) => list.push(e));
  return list;
}

describe('maxTabs', () => {
  it('as a number rejects with throw by default', () => {
    const { registry, open, controller } = setup();
    registry.registerContainer('a', host(), { maxTabs: 2 });
    const events = rejections(controller);
    open({ containerKey: 'a' });
    open({ containerKey: 'a' });
    expect(() => open({ containerKey: 'a' })).toThrow(SplitContainerFullError);
    expect(events).toHaveLength(1);
    expect(events[0]!.resolution).toBe('throw');
    expect(events[0]!.context).toMatchObject({ containerKey: 'a', source: 'open' });
    expect(controller.getTabs('a')).toHaveLength(2);
  });

  it('as a function receives the context', () => {
    const { registry, open } = setup();
    const seen: unknown[] = [];
    registry.registerContainer('a', host(), {
      maxTabs: (ctx) => {
        seen.push({ n: ctx.tabs.length, title: ctx.incoming.title, source: ctx.source });
        return ctx.incoming.title === 'big' && ctx.tabs.length >= 1;
      },
    });
    open({ containerKey: 'a', title: 'small' });
    open({ containerKey: 'a', title: 'small' });
    expect(() => open({ containerKey: 'a', title: 'big' })).toThrow(SplitContainerFullError);
    expect(seen).toEqual([
      { n: 0, title: 'small', source: 'open' },
      { n: 1, title: 'small', source: 'open' },
      { n: 2, title: 'big', source: 'open' },
    ]);
  });
});

describe('onFull', () => {
  it('replace-oldest closes the oldest inactive tab with dismiss("replaced")', async () => {
    const { registry, open, labels } = setup();
    registry.registerContainer('a', host(), { maxTabs: 2, onFull: 'replace-oldest' });
    const t1 = open({ containerKey: 'a', title: '1' });
    open({ containerKey: 'a', title: '2' });
    const reasons: unknown[] = [];
    t1.result.catch((r) => reasons.push(r));
    open({ containerKey: 'a', title: '3' });
    await Promise.resolve();
    expect(labels('a')).toEqual(['2', '3']);
    expect(reasons).toEqual(['replaced']);
  });

  it('never replaces the active tab', () => {
    const { registry, open, labels } = setup();
    registry.registerContainer('a', host(), { maxTabs: 2, onFull: 'replace-oldest' });
    const t1 = open({ containerKey: 'a', title: '1' });
    open({ containerKey: 'a', title: '2' });
    t1.activate();
    open({ containerKey: 'a', title: '3' });
    expect(labels('a')).toEqual(['1', '3']);
  });

  it('replace-lru closes the tab activated longest ago', () => {
    const { registry, open, labels } = setup();
    registry.registerContainer('a', host(), { maxTabs: 3, onFull: 'replace-lru' });
    const t1 = open({ containerKey: 'a', title: '1' });
    const t2 = open({ containerKey: 'a', title: '2' });
    const t3 = open({ containerKey: 'a', title: '3' });
    t1.activate();
    t2.activate();
    t3.activate();
    t1.activate();
    // LRU among inactive (2 and 3): 2
    open({ containerKey: 'a', title: '4' });
    expect(labels('a')).toEqual(['1', '3', '4']);
  });

  it('replace-lru treats never-activated tabs as least recently used', () => {
    const { registry, open, labels } = setup();
    registry.registerContainer('a', host(), { maxTabs: 3, onFull: 'replace-lru' });
    open({ containerKey: 'a', title: '1' });
    open({ containerKey: 'a', title: '2', activate: false });
    open({ containerKey: 'a', title: '3', activate: false });
    open({ containerKey: 'a', title: '4' });
    expect(labels('a')).toEqual(['1', '3', '4']);
  });

  it('replace-same-label replaces the oldest tab of the same pair, or rejects', () => {
    const { registry, open, labels } = setup();
    registry.registerContainer('a', host(), {
      maxTabs: 3,
      onFull: 'replace-same-label',
      onReject: 'cancel',
    });
    open({ containerKey: 'a', title: 'X', groupKey: 'g' });
    open({ containerKey: 'a', title: 'X', groupKey: 'g' });
    open({ containerKey: 'a', title: 'Y' });
    // active is Y; X(1) is the oldest same-label tab
    open({ containerKey: 'a', title: 'X', groupKey: 'g' });
    expect(labels('a')).toEqual(['X (2)', 'Y', 'X']);
    const ref = open({ containerKey: 'a', title: 'Z' });
    expect(ref.rejected).toBe(true);
  });

  it('never replaces tabs with canClose or closable: false', () => {
    const { registry, open } = setup();
    registry.registerContainer('a', host(), {
      maxTabs: 3,
      onFull: 'replace-oldest',
      onReject: 'cancel',
    });
    open({ containerKey: 'a', canClose: () => true });
    open({ containerKey: 'a', closable: false });
    open({ containerKey: 'a' });
    expect(open({ containerKey: 'a' }).rejected).toBe(true);
  });

  it('with maxTabs 1 the only tab is active, so pre-defined strategies reject', () => {
    const { registry, open } = setup();
    registry.registerContainer('a', host(), { maxTabs: 1, onFull: 'replace-oldest' });
    open({ containerKey: 'a' });
    expect(() => open({ containerKey: 'a' })).toThrow(SplitContainerFullError);
  });

  it('a custom handler chooses the tab to replace', () => {
    const { registry, open, labels } = setup();
    registry.registerContainer('a', host(), {
      maxTabs: 2,
      onFull: (ctx) => ({ action: 'replace', ref: ctx.tabs.at(-1)! }),
    });
    open({ containerKey: 'a', title: '1' });
    open({ containerKey: 'a', title: '2' });
    open({ containerKey: 'a', title: '3' });
    expect(labels('a')).toEqual(['1', '3']);
  });

  it('a custom handler returning reject, a tab with canClose or a foreign tab rejects', () => {
    const { registry, open } = setup();
    let decision: 'reject' | 'guarded' | 'foreign' = 'reject';
    registry.registerContainer('other', host());
    const foreign = open({ containerKey: 'other' });
    registry.registerContainer('a', host(), {
      maxTabs: 1,
      onReject: 'cancel',
      onFull: (ctx) =>
        decision === 'reject'
          ? { action: 'reject' }
          : { action: 'replace', ref: decision === 'guarded' ? ctx.tabs[0]! : foreign },
    });
    open({ containerKey: 'a', canClose: () => true });
    expect(open({ containerKey: 'a' }).rejected).toBe(true);
    decision = 'guarded';
    expect(open({ containerKey: 'a' }).rejected).toBe(true);
    decision = 'foreign';
    expect(open({ containerKey: 'a' }).rejected).toBe(true);
    expect(foreign.isOpen).toBe(true);
  });
});

describe('onReject', () => {
  it('cancel returns a rejected ref whose result rejects with container-full', async () => {
    const { registry, open, engine, controller } = setup();
    registry.registerContainer('a', host(), { maxTabs: 1, onReject: 'cancel' });
    open({ containerKey: 'a' });
    const events = rejections(controller);
    engine.reset();
    const ref = open({ containerKey: 'a' });
    expect(ref.rejected).toBe(true);
    expect(ref.isOpen).toBe(false);
    expect(ref.containerKey).toBeNull();
    await expect(ref.result).rejects.toBe('container-full');
    expect(engine.callsOf('createTab')).toHaveLength(0);
    expect(events[0]!.resolution).toBe('cancel');
    expect(await ref.close()).toBe(false);
    expect(ref.moveTo('a')).toBe(false);
  });

  it('redirect-default opens in the default container, through its policies', () => {
    const { registry, open, controller } = setup();
    registry.useBodyContainers();
    registry.registerContainer('a', host(), { maxTabs: 1, onReject: 'redirect-default' });
    const events = rejections(controller);
    open({ containerKey: 'a' });
    const ref = open({ containerKey: 'a' });
    expect(ref.containerKey).toBe('body-right');
    expect(events[0]).toMatchObject({ resolution: 'redirect', redirectTo: 'body-right' });
  });

  it('redirect-default without a default container ends the chain with SplitContainerFullError', () => {
    const { registry, open } = setup();
    registry.registerContainer('a', host(), { maxTabs: 1, onReject: 'redirect-default' });
    open({ containerKey: 'a' });
    expect(() => open({ containerKey: 'a' })).toThrow(SplitContainerFullError);
  });

  it('a redirect chain never tries a container twice', () => {
    const { registry, open } = setup();
    registry.registerContainer('a', host(), {
      maxTabs: 1,
      onReject: () => ({ action: 'redirect', containerKey: 'b' }),
    });
    registry.registerContainer('b', host(), {
      maxTabs: 1,
      onReject: () => ({ action: 'redirect', containerKey: 'a' }),
    });
    open({ containerKey: 'a' });
    open({ containerKey: 'b' });
    try {
      open({ containerKey: 'a' });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(SplitContainerFullError);
      expect((e as SplitContainerFullError).triedKeys).toEqual(['a', 'b']);
    }
  });

  it('a handler can redirect to a body side, throw or cancel', () => {
    const { registry, open } = setup();
    registry.useBodyContainers({ bottom: true });
    let action: 'redirect' | 'throw' | 'cancel' = 'redirect';
    registry.registerContainer('a', host(), {
      maxTabs: 1,
      onReject: () =>
        action === 'redirect' ? { action, containerKey: 'body-bottom' } : { action },
    });
    open({ containerKey: 'a' });
    expect(open({ containerKey: 'a' }).containerKey).toBe('body-bottom');
    action = 'throw';
    expect(() => open({ containerKey: 'a' })).toThrow(SplitContainerFullError);
    action = 'cancel';
    expect(open({ containerKey: 'a' }).rejected).toBe(true);
  });

  it('a handler redirecting to an unknown container throws SplitContainerNotFoundError', () => {
    const { registry, open } = setup();
    registry.registerContainer('a', host(), {
      maxTabs: 1,
      onReject: () => ({ action: 'redirect', containerKey: 'zzz' }),
    });
    open({ containerKey: 'a' });
    expect(() => open({ containerKey: 'a' })).toThrow(SplitContainerNotFoundError);
  });

  it('an invalid handler result throws SplitInvalidOptionError', () => {
    const { registry, open } = setup();
    registry.registerContainer('a', host(), {
      maxTabs: 1,
      onReject: () => ({ action: 'nope' }) as never,
    });
    registry.registerContainer('b', host(), {
      maxTabs: 1,
      onReject: () => ({ action: 'redirect', containerKey: '' }),
    });
    open({ containerKey: 'a' });
    open({ containerKey: 'b' });
    expect(() => open({ containerKey: 'a' })).toThrow(SplitInvalidOptionError);
    expect(() => open({ containerKey: 'b' })).toThrow(SplitInvalidOptionError);
  });
});
