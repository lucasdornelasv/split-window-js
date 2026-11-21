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
  type SplitAnimationContext,
} from '../animation/animation-engine.js';

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

  it('picks the default preset from the layout', () => {
    expect(defaultAnimationPreset('overlay', 'custom')).toBe('slide');
    expect(defaultAnimationPreset('push', 'body')).toBe('slide');
    expect(defaultAnimationPreset('push', 'custom')).toBe('collapse');
    expect(defaultAnimationPreset('inline', 'custom')).toBe('fade');
  });
});
