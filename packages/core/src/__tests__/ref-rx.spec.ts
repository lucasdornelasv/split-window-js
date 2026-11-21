import { describe, expect, it } from 'vitest';
import { Subscription, firstValueFrom, lastValueFrom, toArray } from 'rxjs';
import { SplitInvalidOptionError } from '../errors/errors.js';
import { flush, host, setup } from './helpers.js';

function ctx() {
  const s = setup();
  s.registry.registerContainer('a', host());
  s.registry.setDefaultContainer('a');
  return s;
}

describe('attachTo', () => {
  it('unsubscribing the subscription dismisses the tab', async () => {
    const { open } = ctx();
    const ref = open();
    const subscription = new Subscription();
    ref.attachTo(subscription);
    subscription.unsubscribe();
    expect(ref.isOpen).toBe(false);
    await expect(ref.result).rejects.toBeUndefined();
  });

  it('dismissing the tab unsubscribes the subscription', async () => {
    const { open } = ctx();
    const ref = open();
    const subscription = new Subscription();
    ref.attachTo(subscription);
    await ref.dismiss('x');
    expect(subscription.closed).toBe(true);
  });

  it('closing the tab unsubscribes the subscription once the tab is hidden', async () => {
    const { open, engine } = ctx();
    engine.deferDestroy = true; // the container animates out: hidden comes later
    const ref = open();
    const subscription = new Subscription();
    ref.attachTo(subscription);
    await ref.close('ok');
    expect(subscription.closed).toBe(false);
    engine.finishDestroys();
    await flush();
    expect(subscription.closed).toBe(true);
    await expect(ref.result).resolves.toBe('ok');
  });

  it('the returned link undoes the tie', async () => {
    const { open } = ctx();
    const a = open();
    const b = open();
    const first = new Subscription();
    const second = new Subscription();
    a.attachTo(first).unsubscribe();
    b.attachTo(second).unsubscribe();
    first.unsubscribe();
    expect(a.isOpen).toBe(true);
    await b.dismiss();
    expect(second.closed).toBe(false);
  });

  it('the tab stays open when canClose refuses the dismiss', async () => {
    const { open } = ctx();
    const ref = open({ canClose: () => false });
    const subscription = new Subscription();
    ref.attachTo(subscription);
    subscription.unsubscribe();
    await flush();
    expect(ref.isOpen).toBe(true);
  });

  it('a closed subscription dismisses the tab; a finished tab ends the subscription', async () => {
    const { open } = ctx();
    const a = open();
    const closed = new Subscription();
    closed.unsubscribe();
    a.attachTo(closed);
    expect(a.isOpen).toBe(false);

    const b = open();
    await b.close();
    const subscription = new Subscription();
    b.attachTo(subscription);
    expect(subscription.closed).toBe(true);
  });

  it('requires a subscription', () => {
    const { open } = ctx();
    const ref = open();
    expect(() => ref.attachTo(undefined as never)).toThrow(SplitInvalidOptionError);
    expect(() => ref.attachTo({} as never)).toThrow(SplitInvalidOptionError);
  });
});

describe('asRequest', () => {
  it('emits the close result and completes, asynchronously', async () => {
    const { open } = ctx();
    const ref = open();
    const values: unknown[] = [];
    const request = lastValueFrom(ref.asRequest<string>().pipe(toArray()));
    ref.asRequest().subscribe((value) => values.push(value));
    const closing = ref.close('ok');
    expect(values).toEqual([]); // asapScheduler
    await closing;
    expect(await request).toEqual(['ok']);
    expect(values).toEqual(['ok']);
  });

  it('completes without a value on dismiss', async () => {
    const { open } = ctx();
    const ref = open();
    const request = lastValueFrom(ref.asRequest().pipe(toArray()));
    await ref.dismiss('no');
    expect(await request).toEqual([]);
  });

  it('unsubscribing before the answer dismisses the tab', async () => {
    const { open } = ctx();
    const ref = open();
    const subscription = ref.asRequest().subscribe();
    expect(ref.isOpen).toBe(true);
    subscription.unsubscribe();
    expect(ref.isOpen).toBe(false);
    await expect(ref.result).rejects.toBeUndefined();
  });

  it('answers from the result when the tab is already closed or rejected', async () => {
    const { open, registry } = ctx();
    const ref = open();
    await ref.close('done');
    expect(await firstValueFrom(ref.asRequest())).toBe('done');

    registry.registerContainer('full', host(), {
      maxTabs: 1,
      onFull: 'replace-oldest',
      onReject: 'cancel',
    });
    open({ containerKey: 'full', closable: false });
    const rejected = open({ containerKey: 'full' });
    expect(rejected.rejected).toBe(true);
    expect(await lastValueFrom(rejected.asRequest().pipe(toArray()))).toEqual([]);
  });
});
