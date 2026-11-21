import { describe, expect, it } from 'vitest';
import {
  DIRECT_DOM_WRITER,
  SplitStyleStash,
  isPromiseLike,
  maxCssTime,
  reflow,
  toClassList,
  transitionTimeMs,
  type SplitComputedTimes,
  type SplitDomWriter,
} from '../utils/index.js';

/** Minimal element with inline styles, classes and attributes. */
function fakeElement() {
  const styles = new Map<string, { value: string; priority: string }>();
  const classes = new Set<string>();
  const attributes = new Map<string, string>();
  return {
    styles,
    classes,
    attributes,
    style: {
      getPropertyValue: (p: string) => styles.get(p)?.value ?? '',
      getPropertyPriority: (p: string) => styles.get(p)?.priority ?? '',
      setProperty: (p: string, v: string | null, priority = '') =>
        void styles.set(p, { value: v ?? '', priority }),
      removeProperty: (p: string) => {
        const old = styles.get(p)?.value ?? '';
        styles.delete(p);
        return old;
      },
    },
    classList: {
      contains: (c: string) => classes.has(c),
      add: (...c: string[]) => c.forEach((x) => classes.add(x)),
      remove: (...c: string[]) => c.forEach((x) => classes.delete(x)),
    },
    getAttribute: (n: string) => attributes.get(n) ?? null,
    setAttribute: (n: string, v: string) => void attributes.set(n, v),
    removeAttribute: (n: string) => void attributes.delete(n),
  };
}

describe('utils', () => {
  it('isPromiseLike', () => {
    expect(isPromiseLike(Promise.resolve())).toBe(true);
    expect(isPromiseLike({ then: () => undefined })).toBe(true);
    expect(isPromiseLike(null)).toBe(false);
    expect(isPromiseLike(undefined)).toBe(false);
    expect(isPromiseLike({})).toBe(false);
  });

  it('SplitStyleStash undoes styles, classes and attributes', () => {
    const el = fakeElement();
    el.style.setProperty('width', '10px', 'important');
    el.classes.add('kept');
    el.attributes.set('data-x', 'old');
    const stash = new SplitStyleStash();
    stash.set(el, 'width', '20px');
    stash.set(el, 'width', '30px');
    stash.set(el, 'height', '5px');
    stash.addClass(el, 'kept', 'added', null, undefined, false, '');
    stash.setAttribute(el, 'data-x', 'new');
    stash.setAttribute(el, 'data-x', 'newer');
    stash.setAttribute(el, 'data-y', 'y');
    expect(el.style.getPropertyValue('width')).toBe('30px');
    expect(el.classes.has('added')).toBe(true);
    stash.restore();
    expect(el.styles.get('width')).toEqual({ value: '10px', priority: 'important' });
    expect(el.styles.has('height')).toBe(false);
    expect([...el.classes]).toEqual(['kept']);
    expect(el.attributes.get('data-x')).toBe('old');
    expect(el.attributes.has('data-y')).toBe(false);
    stash.restore(); // nothing left
  });

  it('SplitStyleStash writes through its writer', () => {
    const el = fakeElement();
    const calls: string[] = [];
    const writer: SplitDomWriter = {
      setStyle: (e, p, v, prio) => {
        calls.push(`style:${p}=${v}${prio ? `!${prio}` : ''}`);
        DIRECT_DOM_WRITER.setStyle(e, p, v, prio);
      },
      removeStyle: (e, p) => {
        calls.push(`unstyle:${p}`);
        DIRECT_DOM_WRITER.removeStyle(e, p);
      },
      addClass: (e, n) => {
        calls.push(`class:${n}`);
        DIRECT_DOM_WRITER.addClass(e, n);
      },
      removeClass: (e, n) => {
        calls.push(`unclass:${n}`);
        DIRECT_DOM_WRITER.removeClass(e, n);
      },
      setAttribute: (e, n, v) => {
        calls.push(`attr:${n}=${v}`);
        DIRECT_DOM_WRITER.setAttribute(e, n, v);
      },
      removeAttribute: (e, n) => {
        calls.push(`unattr:${n}`);
        DIRECT_DOM_WRITER.removeAttribute(e, n);
      },
    };
    const stash = new SplitStyleStash(writer);
    expect(stash.writer).toBe(writer);
    stash.set(el, '--x', '1');
    stash.addClass(el, 'a');
    stash.setAttribute(el, 'data-y', 'y');
    stash.restore();
    expect(calls).toEqual([
      'style:--x=1',
      'class:a',
      'attr:data-y=y',
      'unstyle:--x',
      'unattr:data-y',
      'unclass:a',
    ]);
    expect(new SplitStyleStash().writer).toBe(DIRECT_DOM_WRITER);
  });

  it('toClassList', () => {
    expect(toClassList(undefined)).toEqual([]);
    expect(toClassList(null)).toEqual([]);
    expect(toClassList(' a  b ')).toEqual(['a', 'b']);
    expect(toClassList(['a', 'b c'])).toEqual(['a', 'b', 'c']);
  });

  it('maxCssTime and transitionTimeMs', () => {
    expect(maxCssTime('0.2s, 100ms')).toBe(200);
    expect(maxCssTime('')).toBe(0);
    expect(maxCssTime('x')).toBe(0);
    const times = (patch: Partial<SplitComputedTimes>): SplitComputedTimes => ({
      transitionDuration: '0s',
      transitionDelay: '0s',
      animationName: 'none',
      animationDuration: '0s',
      animationDelay: '0s',
      ...patch,
    });
    const el = (style: SplitComputedTimes | null) => ({
      ownerDocument: { defaultView: style ? { getComputedStyle: () => style } : null },
    });
    expect(transitionTimeMs(el(null))).toBe(0);
    expect(
      transitionTimeMs(el(times({ transitionDuration: '200ms', transitionDelay: '50ms' }))),
    ).toBe(250);
    expect(transitionTimeMs(el(times({ animationName: 'spin', animationDuration: '1s' })))).toBe(
      1000,
    );
    expect(transitionTimeMs(el(times({ animationName: '', animationDuration: '1s' })))).toBe(0);
  });

  it('reflow reads offsetHeight', () => {
    let reads = 0;
    reflow({
      get offsetHeight() {
        reads++;
        return 0;
      },
    });
    expect(reads).toBe(1);
  });
});
