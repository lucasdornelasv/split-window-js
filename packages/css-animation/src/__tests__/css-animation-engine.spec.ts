import { afterEach, describe, expect, it } from 'vitest';
import type { SplitAnimationContext, SplitAnimationFrame } from '@split-window/core';
import {
  SPLIT_CSS_ANIMATION_STYLE_ID,
  SplitCssAnimationEngine,
  type SplitCssAnimationClasses,
} from '../index.js';

const frame = (patch: Partial<SplitAnimationFrame> = {}): SplitAnimationFrame => ({
  rect: { x: 0, y: 0, width: 100, height: 100 },
  opacity: 1,
  hostSize: null,
  push: null,
  ...patch,
});

function context(patch: Partial<SplitAnimationContext<HTMLElement>> = {}) {
  const shell = document.createElement('div');
  const host = document.createElement('div');
  document.body.append(host);
  host.append(shell);
  const abort = new AbortController();
  const events: string[] = [];
  const ctx: SplitAnimationContext<HTMLElement> = {
    phase: 'show',
    container: {} as never,
    layout: 'overlay',
    side: 'right',
    size: '300px',
    elements: { shell, host, backdrop: null, pushTarget: null },
    from: frame({ rect: { x: 100, y: 0, width: 100, height: 100 } }),
    to: frame(),
    properties: { host: null, push: null },
    options: { preset: 'slide', respectReducedMotion: true },
    reducedMotion: false,
    signal: abort.signal,
    started: () => events.push('started'),
    progress: () => undefined,
    ...patch,
  };
  return { ctx, shell, host, abort, events };
}

afterEach(() => {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
});

describe('SplitCssAnimationEngine', () => {
  it('injects the preset styles once and ends at once without a duration', () => {
    const engine = new SplitCssAnimationEngine();
    const { ctx, shell, events } = context();
    shell.style.transitionDuration = '0s';
    expect(engine.animate(ctx)).toBeUndefined();
    expect(document.querySelectorAll(`#${SPLIT_CSS_ANIMATION_STYLE_ID}`)).toHaveLength(1);
    engine.animate(context().ctx);
    expect(document.querySelectorAll(`#${SPLIT_CSS_ANIMATION_STYLE_ID}`)).toHaveLength(1);
    expect(events).toEqual(['started']);
    expect(shell.classList).toContain('split-show');
    expect(shell.getAttribute('data-split-animation')).toBe('slide');
    expect(shell.style.getPropertyValue('--split-slide')).toBe('translateX(100%)');
    engine.cleanup(ctx);
    expect(shell.getAttribute('data-split-animation')).toBeNull();
    expect(shell.classList).toContain('split-show');
  });

  it('waits for transitionend, then sets the show class', async () => {
    const engine = new SplitCssAnimationEngine({ injectStyles: false });
    const { ctx, shell } = context();
    shell.style.transitionDuration = '5s';
    const done = engine.animate(ctx);
    expect(done).toBeInstanceOf(Promise);
    expect(shell.classList).toContain('split-showing');
    shell.dispatchEvent(new Event('transitionend'));
    await done;
    expect(shell.classList).toContain('split-show');
    expect(shell.classList).not.toContain('split-showing');
    expect(document.getElementById(SPLIT_CSS_ANIMATION_STYLE_ID)).toBeNull();
  });

  it('a hide uses the hiding class and cleanup removes the state classes', async () => {
    const engine = new SplitCssAnimationEngine();
    const { ctx, shell } = context({ phase: 'hide' });
    shell.classList.add('split-show');
    shell.style.transitionDuration = '5s';
    const done = engine.animate(ctx);
    expect(shell.classList).toContain('split-hiding');
    expect(shell.classList).not.toContain('split-show');
    shell.dispatchEvent(new Event('animationend'));
    await done;
    engine.cleanup(ctx);
    expect(shell.classList).not.toContain('split-hiding');
  });

  it('an abort resolves at once and skips the show class', async () => {
    const engine = new SplitCssAnimationEngine();
    const { ctx, shell, abort } = context();
    shell.style.transitionDuration = '5s';
    const done = engine.animate(ctx);
    abort.abort();
    await done;
    expect(shell.classList).not.toContain('split-show');
  });

  it('animates the host size and the push padding with inline transitions', () => {
    const engine = new SplitCssAnimationEngine();
    const target = document.createElement('main');
    const { ctx, host } = context({
      layout: 'push',
      options: { preset: 'collapse', duration: 300, easing: 'linear', respectReducedMotion: true },
      from: frame({ hostSize: '0px', push: '0px' }),
      to: frame({ hostSize: '300px', push: '300px' }),
      properties: { host: 'width', push: 'padding-right' },
    });
    const withTarget = { ...ctx, elements: { ...ctx.elements, pushTarget: target } };
    target.style.paddingRight = 'calc(0px + 300px)';
    const before = target.style.paddingRight;
    void engine.animate(withTarget);
    expect(host.style.width).toBe('300px');
    expect(host.style.transition).toContain('width 300ms linear');
    expect(target.style.paddingRight).toBe('300px');
    engine.cleanup(withTarget);
    expect(host.style.width).toBe('');
    expect(host.style.transition).toBe('');
    expect(target.style.paddingRight).toBe(before);
  });

  it('marks the backdrop and lets subclasses change the classes', () => {
    class Custom extends SplitCssAnimationEngine {
      protected override classesFor(): SplitCssAnimationClasses {
        return { ...this.classes, showing: 'mine' };
      }
    }
    const backdrop = document.createElement('div');
    const { ctx, shell } = context();
    shell.style.transitionDuration = '5s';
    const withBackdrop = { ...ctx, elements: { ...ctx.elements, backdrop } };
    void new Custom({ classes: { show: 'open' } }).animate(withBackdrop);
    expect(shell.classList).toContain('mine');
    expect(backdrop.classList).toContain('mine');
    expect(backdrop.getAttribute('data-split-animation')).toBe('fade');
  });
});
