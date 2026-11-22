import { describe, expect, it, vi } from 'vitest';
import {
  NoopSplitAnimationEngine,
  SplitAnimationEngine,
  SplitFunctionAnimationEngine,
  defaultAnimationPreset,
  isAnimationEngine,
  isAnimationEngineClass,
  mergeAnimation,
  normalizeAnimation,
  collapseReveal,
  presetAnimatesSizes,
  resolveAnimation,
  scaleTransformOrigin,
  slideTransform,
  validateAnimation,
  type SplitAnimationContext,
} from '../animation/animation-engine.js';
import { SPLIT_EASINGS, spring } from '../animation/easing.js';

class CustomEngine extends SplitAnimationEngine {
  animate(): void {}
}

const ctx = {} as SplitAnimationContext;

describe('animation engines', () => {
  it('the noop engine goes through every step synchronously and cleanup does nothing', () => {
    const engine = new NoopSplitAnimationEngine();
    const steps: string[] = [];
    const noopCtx = {
      started: () => steps.push('started'),
      progress: (value: number) => steps.push(`progress:${value}`),
    } as unknown as SplitAnimationContext;
    expect(engine.animate(noopCtx)).toBeUndefined();
    expect(steps).toEqual(['started', 'progress:1']);
    expect(() => engine.cleanup(ctx)).not.toThrow();
  });

  it('a function engine calls the function', async () => {
    const fn = vi.fn(() => Promise.resolve());
    await new SplitFunctionAnimationEngine(fn).animate(ctx);
    expect(fn).toHaveBeenCalledWith(ctx);
  });

  it('tells engines, engine classes and functions apart', () => {
    expect(isAnimationEngine(new CustomEngine())).toBe(true);
    expect(isAnimationEngine({ animate: () => undefined })).toBe(true);
    expect(isAnimationEngine(null)).toBe(false);
    expect(isAnimationEngine(() => undefined)).toBe(false);
    expect(isAnimationEngineClass(CustomEngine)).toBe(true);
    expect(isAnimationEngineClass(function plain() {})).toBe(false);
    expect(isAnimationEngineClass(() => undefined)).toBe(false);
    expect(isAnimationEngineClass(new CustomEngine())).toBe(false);
  });

  it('normalizes every animation input to options', () => {
    const engine = new CustomEngine();
    const fn = () => undefined;
    expect(normalizeAnimation(undefined)).toEqual({});
    expect(normalizeAnimation(true)).toEqual({ enabled: true });
    expect(normalizeAnimation(false)).toEqual({ enabled: false });
    expect(normalizeAnimation('none')).toEqual({ enabled: false });
    expect(normalizeAnimation('fade')).toEqual({ enabled: true, preset: 'fade' });
    expect(normalizeAnimation(engine)).toEqual({ enabled: true, engine });
    expect(normalizeAnimation(CustomEngine)).toEqual({ enabled: true, engine: CustomEngine });
    expect(normalizeAnimation(fn)).toEqual({ enabled: true, engine: fn });
    expect(normalizeAnimation({ duration: 100 })).toEqual({ enabled: true, duration: 100 });
    expect(normalizeAnimation({ enabled: false, duration: 100 })).toEqual({
      enabled: false,
      duration: 100,
    });
  });

  it('merges inputs, the second winning key by key', () => {
    expect(mergeAnimation({ duration: 100, preset: 'slide' }, 'fade')).toEqual({
      enabled: true,
      duration: 100,
      preset: 'fade',
    });
    expect(mergeAnimation(true, false)).toEqual({ enabled: false });
    expect(mergeAnimation(undefined, undefined)).toEqual({});
  });

  it('normalizes and merges the phases; a shared option of a higher layer wins', () => {
    expect(normalizeAnimation({ show: 'fade', hide: { preset: 'slide' } })).toEqual({
      enabled: true,
      show: { preset: 'fade' },
      hide: { preset: 'slide' },
    });
    expect(mergeAnimation({ hide: 'fade', duration: 100 }, { show: { scale: 1.2 } })).toEqual({
      enabled: true,
      duration: 100,
      show: { scale: 1.2 },
      hide: { preset: 'fade' },
    });
    // The container's preset replaces the default of the hide phase.
    expect(mergeAnimation({ hide: 'fade' }, 'slide')).toEqual({ enabled: true, preset: 'slide' });
    expect(mergeAnimation({ hide: { preset: 'fade', duration: 50 } }, 'slide')).toEqual({
      enabled: true,
      preset: 'slide',
      hide: { duration: 50 },
    });
  });

  it('resolves the settings of each phase with the defaults', () => {
    const target = { layout: 'overlay', kind: 'body', side: 'right' } as const;
    const phases = resolveAnimation(
      {
        duration: 300,
        easing: SPLIT_EASINGS.ease,
        show: 'fade',
        hide: { preset: 'scale', scale: 1.1, origin: 'top' },
      },
      target,
    );
    expect(phases.show).toEqual({
      preset: 'fade',
      duration: 300,
      easing: SPLIT_EASINGS.ease,
      delay: undefined,
      origin: 'right',
      distance: '100%',
      scale: 0.9,
      respectReducedMotion: true,
    });
    expect(phases.hide).toMatchObject({ preset: 'scale', scale: 1.1, origin: 'top' });
    expect(resolveAnimation(true, target).hide).toMatchObject({ preset: 'slide', origin: 'right' });
    expect(resolveAnimation('scale', target).show.origin).toBe('center');
    expect(resolveAnimation({ origin: 'center', distance: 40 }, target).show).toMatchObject({
      origin: 'right',
      distance: 40,
    });
    expect(
      resolveAnimation(
        { respectReducedMotion: false },
        { ...target, layout: 'push', kind: 'custom' },
      ).show,
    ).toMatchObject({ preset: 'collapse', respectReducedMotion: false });
  });

  it('builds the transforms of slide and scale', () => {
    expect(slideTransform('right', '100%')).toBe('translateX(100%)');
    expect(slideTransform('left', '100%')).toBe('translateX(-100%)');
    expect(slideTransform('top', 40)).toBe('translateY(-40px)');
    expect(slideTransform('bottom', '2rem')).toBe('translateY(2rem)');
    expect(slideTransform('left', '-10px')).toBe('translateX(10px)');
    expect(slideTransform('top', 'var(--x)')).toBe('translateY(calc(-1 * (var(--x))))');
    expect(slideTransform('center', 10)).toBe('none');
    expect(scaleTransformOrigin('left')).toBe('left center');
    expect(scaleTransformOrigin('bottom')).toBe('center bottom');
    expect(scaleTransformOrigin('center')).toBe('center');
    const collapse = { preset: 'collapse' as const };
    const none = { host: null, push: null };
    // overlay, inline and body push: a clip-path from the edge at the side
    expect(
      collapseReveal({ options: collapse, layout: 'overlay', side: 'right', properties: none }),
    ).toEqual({
      property: 'clip-path',
      closed: 'inset(0px 0px 0px 100%)',
      open: 'inset(0px 0px 0px 0px)',
    });
    const clip = (side: 'left' | 'top' | 'bottom', layout: 'inline' | 'push') =>
      collapseReveal({
        options: collapse,
        layout,
        side,
        properties: { host: null, push: layout === 'push' ? `padding-${side}` : null },
      })?.closed;
    expect(clip('left', 'push')).toBe('inset(0px 100% 0px 0px)');
    expect(clip('top', 'inline')).toBe('inset(0px 0px 100% 0px)');
    expect(clip('bottom', 'inline')).toBe('inset(100% 0px 0px 0px)');
    // custom push: the host clips; a transform keeps the panel still
    expect(
      collapseReveal({
        options: collapse,
        layout: 'push',
        side: 'right',
        properties: { host: 'width', push: null },
      }),
    ).toEqual({ property: 'transform', closed: 'translateX(-100%)', open: 'none' });
    expect(
      collapseReveal({
        options: { preset: 'slide' },
        layout: 'overlay',
        side: 'right',
        properties: none,
      }),
    ).toBeNull();
    expect(presetAnimatesSizes('slide')).toBe(true);
    expect(presetAnimatesSizes('collapse')).toBe(true);
    expect(presetAnimatesSizes('fade')).toBe(false);
    expect(presetAnimatesSizes('scale')).toBe(false);
  });

  it('validates the animation option', () => {
    const ok = [
      undefined,
      true,
      'scale',
      () => undefined,
      new CustomEngine(),
      { show: 'fade', hide: { preset: 'slide', origin: 'bottom', distance: '2rem' } },
      { easing: spring(), scale: 1.2, duration: 0, delay: 10, enabled: true },
      { easing: 'ease-in' },
    ];
    for (const value of ok) expect(() => validateAnimation('a', value)).not.toThrow();
    const bad: [unknown, string][] = [
      ['zoom', 'a'],
      [3, 'a'],
      [{ preset: 'zoom' }, 'a.preset'],
      [{ duration: -1 }, 'a.duration'],
      [{ delay: 'x' }, 'a.delay'],
      [{ easing: '' }, 'a.easing'],
      [{ easing: { type: '' } }, 'a.easing'],
      [{ origin: 'middle' }, 'a.origin'],
      [{ distance: -2 }, 'a.distance'],
      [{ distance: ' ' }, 'a.distance'],
      [{ scale: 0 }, 'a.scale'],
      [{ enabled: 'yes' }, 'a.enabled'],
      [{ show: 3 }, 'a.show'],
      [{ show: 'zoom' }, 'a.show.preset'],
      [{ hide: { scale: -1 } }, 'a.hide.scale'],
    ];
    for (const [value, option] of bad) {
      expect(() => validateAnimation('a', value), option).toThrow(
        expect.objectContaining({ option }),
      );
    }
  });

  it('picks the default preset from the layout', () => {
    expect(defaultAnimationPreset('overlay', 'custom')).toBe('slide');
    expect(defaultAnimationPreset('push', 'body')).toBe('slide');
    expect(defaultAnimationPreset('push', 'custom')).toBe('collapse');
    expect(defaultAnimationPreset('inline', 'custom')).toBe('fade');
  });
});
