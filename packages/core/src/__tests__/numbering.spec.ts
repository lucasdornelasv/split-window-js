import { describe, expect, it } from 'vitest';
import { TabGroupResolver, formatTabLabel, nextOrdinal } from '../numbering/tab-group-resolver.js';
import { setup, host } from './helpers.js';

describe('nextOrdinal / formatTabLabel', () => {
  it.each([
    [[], 1],
    [[1], 2],
    [[1, 2, 3], 4],
    [[2, 3], 1],
    [[1, 3], 2],
  ])('used %j -> %i', (used, expected) => {
    expect(nextOrdinal(new Set(used))).toBe(expected);
  });

  it('never shows number 1', () => {
    expect(formatTabLabel('Contrato', 1)).toBe('Contrato');
    expect(formatTabLabel('Contrato', 2)).toBe('Contrato (2)');
  });
});

describe('TabGroupResolver', () => {
  it('reserves the smallest free number and releases it', () => {
    const r = new TabGroupResolver();
    expect(r.reserve(null, 'A')).toBe(1);
    expect(r.reserve(null, 'A')).toBe(2);
    r.release(null, 'A', 1);
    expect(r.reserve(null, 'A')).toBe(1);
    expect(r.inUse(null, 'A')).toEqual([1, 2]);
  });

  it('keeps groups apart without key collisions', () => {
    const r = new TabGroupResolver();
    expect(r.reserve('a::b', 'c')).toBe(1);
    expect(r.reserve('a', 'b::c')).toBe(1);
    expect(r.reserve(null, 'x')).toBe(1);
    expect(r.reserve('x', 'x')).toBe(1);
  });

  it('ignores releases of unknown pairs', () => {
    const r = new TabGroupResolver();
    r.release('g', 't', 1);
    r.reserve('g', 't');
    r.release('g', 'other', 1);
    expect(r.inUse('g', 't')).toEqual([1]);
  });
});

describe('numbering in containers (spec table)', () => {
  function ctx() {
    const s = setup();
    s.registry.registerContainer('c', host());
    s.registry.registerContainer('d', host());
    s.registry.setDefaultContainer('c');
    return s;
  }

  it('no group and no title, 3 times', () => {
    const { open, labels } = ctx();
    open();
    open();
    open();
    expect(labels('c')).toEqual(['Nova aba', 'Nova aba (2)', 'Nova aba (3)']);
  });

  it('title "Contrato", no group, 2 times', () => {
    const { open, labels } = ctx();
    open({ title: 'Contrato' });
    open({ title: 'Contrato' });
    expect(labels('c')).toEqual(['Contrato', 'Contrato (2)']);
  });

  it('different titles in the same group have no number', () => {
    const { open, labels } = ctx();
    open({ title: 'A', groupKey: 'g' });
    open({ title: 'B', groupKey: 'g' });
    expect(labels('c')).toEqual(['A', 'B']);
  });

  it('"Contrato" once in group A and twice in group B', () => {
    const { open, labels } = ctx();
    open({ title: 'Contrato', groupKey: 'A' });
    open({ title: 'Contrato', groupKey: 'B' });
    open({ title: 'Contrato', groupKey: 'B' });
    expect(labels('c')).toEqual(['Contrato', 'Contrato', 'Contrato (2)']);
  });

  it('counts are independent per container', () => {
    const { open, labels } = ctx();
    open({ title: 'X' });
    open({ title: 'X', containerKey: 'd' });
    expect(labels('c')).toEqual(['X']);
    expect(labels('d')).toEqual(['X']);
  });

  it('a number does not change when another tab closes; a new tab takes the smallest free one', async () => {
    const { open, labels } = ctx();
    const first = open({ title: 'Contrato' });
    open({ title: 'Contrato' });
    await first.close();
    expect(labels('c')).toEqual(['Contrato (2)']);
    open({ title: 'Contrato' });
    expect(labels('c')).toEqual(['Contrato (2)', 'Contrato']);
  });

  it('setTitle moves the tab to another pair and leaves the others alone', () => {
    const { open, labels } = ctx();
    open({ title: 'A' });
    const b = open({ title: 'A' });
    open({ title: 'A' });
    open({ title: 'B' });
    const events: unknown[] = [];
    b.titleChanged.subscribe((e) => events.push(e));
    b.setTitle('B');
    expect(labels('c')).toEqual(['A', 'B (2)', 'A (3)', 'B']);
    expect(events).toEqual([{ title: 'B', label: 'B (2)' }]);
    open({ title: 'A' });
    expect(labels('c')).toEqual(['A', 'B (2)', 'A (3)', 'B', 'A (2)']);
  });

  it('setTitle with the same title does nothing', () => {
    const { open } = ctx();
    const a = open({ title: 'A' });
    const events: unknown[] = [];
    a.titleChanged.subscribe((e) => events.push(e));
    a.setTitle('A');
    expect(events).toEqual([]);
  });

  it('uses the configured default title', () => {
    const s = setup({ labels: { defaultTitle: 'New tab' } });
    s.registry.registerContainer('c', host());
    expect(s.open({ containerKey: 'c' }).label).toBe('New tab');
  });
});
