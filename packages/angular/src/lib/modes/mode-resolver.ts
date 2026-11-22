import { EnvironmentInjector, Injectable, Injector, inject, type Type } from '@angular/core';
import {
  SPLIT_CONTAINER_LAYOUTS,
  SplitInvalidOptionError,
  normalizeAnimation,
  resolveAnimation,
  toClassList,
  type ContainerState,
  type SplitAnimationInput as CoreAnimationInput,
  type SplitAnimationPhases,
  type SplitBodySide,
  type SplitContainerLayout,
} from '@split-window/core';
import type { SplitAnimationEngineInput } from '../animation/animation-engine';
import { SPLIT_CONTAINER_DEFAULTS, SPLIT_WINDOW_CONFIG, SPLIT_WINDOW_MODES } from '../tokens';
import type { SplitContainerDefaults } from '../types';
import {
  SplitContainerMode,
  DefinedSplitContainerMode,
  InlineSplitContainerMode,
  OverlaySplitContainerMode,
  PushSplitContainerMode,
  mergeModeSettings,
  pickModeSettings,
  type SplitModeDefinition,
  type SplitModeInput,
  type SplitModeResolveContext,
} from './container-mode';

/** Everything the engine needs to render a container in its mode. */
export interface SplitResolvedMode {
  readonly mode: SplitContainerMode;
  readonly kind: 'custom' | 'body';
  readonly layout: SplitContainerLayout;
  readonly side: SplitBodySide;
  readonly size: string | null;
  readonly pushTarget: HTMLElement | string | null;
  readonly hostClass: string[];
  readonly panelClass: string[];
  readonly backdropClass: string[];
  /** Whether the container animates its transitions. */
  readonly animated: boolean;
  /**
   * Chosen animation engine (a name, an instance, a class or a function), or `undefined`
   * for the first registered one. Resolved by `SplitAnimationEngineRegistry` on each
   * transition, so engines registered later count.
   */
  readonly engine: SplitAnimationEngineInput | undefined;
  /** Settings of the show and of the hide. */
  readonly animation: SplitAnimationPhases;
}

const isLayout = (value: unknown): value is SplitContainerLayout =>
  (SPLIT_CONTAINER_LAYOUTS as readonly unknown[]).includes(value);

/**
 * @internal Resolves modes and animations: built-in layouts, registered names, objects,
 * classes (created with DI), instances and functions, merged with the global defaults.
 * The animation engine is only chosen here; `SplitAnimationEngineRegistry` resolves it.
 */
@Injectable()
export class SplitModeResolver {
  private readonly injector = inject(EnvironmentInjector);
  private readonly config = inject(SPLIT_WINDOW_CONFIG);
  private readonly defaults = inject(SPLIT_CONTAINER_DEFAULTS);
  private readonly named = new Map<string, SplitModeInput>(
    (inject(SPLIT_WINDOW_MODES, { optional: true }) ?? []).flatMap((record) =>
      Object.entries(record),
    ),
  );
  private readonly instances = new Map<Type<unknown>, unknown>();
  private readonly builtins: Record<SplitContainerLayout, SplitContainerMode> = {
    inline: new InlineSplitContainerMode(),
    push: new PushSplitContainerMode(),
    overlay: new OverlaySplitContainerMode(),
  };

  /** Names that `mode` accepts. */
  modeNames(): string[] {
    return [...SPLIT_CONTAINER_LAYOUTS, ...this.named.keys()];
  }

  /**
   * Early check of a container's mode, done on registration: unknown names and `inline`
   * on the body. Functions are only checked when they run.
   */
  validate(mode: unknown, kind: 'custom' | 'body', option: string): void {
    if (mode === undefined) return;
    if (typeof mode === 'string') {
      if (!isLayout(mode) && !this.named.has(mode)) this.unknown(option, mode);
      if (kind === 'body' && mode === 'inline') this.inlineOnBody(option);
    } else if (typeof mode === 'object' && mode !== null && !(mode instanceof SplitContainerMode)) {
      const layout = (mode as SplitModeDefinition).layout;
      if (layout !== undefined && !isLayout(layout)) {
        throw new SplitInvalidOptionError(
          `${option}.layout`,
          layout,
          SPLIT_CONTAINER_LAYOUTS.join(' | '),
        );
      }
      if (kind === 'body' && layout === 'inline') this.inlineOnBody(option);
    }
  }

  /** Resolves the mode, settings and animation of a container. */
  resolve(container: ContainerState<HTMLElement>): SplitResolvedMode {
    const options = container.options as Record<string, unknown>;
    const kind = container.kind;
    const ctx: SplitModeResolveContext = {
      key: container.key,
      kind,
      side: container.side,
      options,
    };
    const defaults: SplitContainerDefaults = mergeDefaults(this.defaults, this.defaults[kind]);
    const input =
      (options['mode'] as SplitModeInput | undefined) ??
      defaults.mode ??
      (kind === 'body' ? 'overlay' : 'inline');
    const mode = this.resolveMode(input, ctx, new Set());
    const layout = mode.layout;
    if (kind === 'body' && layout === 'inline') this.inlineOnBody(`${container.key}.mode`);
    const settings = mergeModeSettings(
      pickModeSettings(defaults),
      mode.settings(),
      pickModeSettings(options),
    );
    const side: SplitBodySide = kind === 'body' ? container.side! : (settings.side ?? 'right');
    let size: string | null = settings.size ?? null;
    if (kind === 'body' || layout === 'overlay') size ??= this.config.bodySize;
    if (layout === 'inline' && kind === 'custom') size = null;
    const animationInput = settings.animation as CoreAnimationInput<HTMLElement> | undefined;
    const animation = normalizeAnimation(animationInput);
    const phases = resolveAnimation(animationInput, { layout, kind, side });
    return {
      mode,
      kind,
      layout,
      side,
      size,
      pushTarget: settings.pushTarget ?? null,
      hostClass: toClassList(settings.hostClass),
      panelClass: toClassList(settings.panelClass),
      backdropClass: toClassList(settings.backdropClass),
      animated: animation.enabled === true,
      engine: animation.engine as SplitAnimationEngineInput | undefined,
      animation: phases,
    };
  }

  /** Resolves any mode input to an instance. */
  resolveMode(
    input: SplitModeInput,
    ctx: SplitModeResolveContext,
    seen: Set<unknown>,
  ): SplitContainerMode {
    if (seen.has(input)) {
      throw new SplitInvalidOptionError('mode', input, 'um modo sem referência circular');
    }
    seen.add(input);
    if (typeof input === 'string') {
      if (isLayout(input)) return this.builtins[input]; // built-in names cannot be replaced
      const named = this.named.get(input);
      if (named === undefined) this.unknown('mode', input);
      return this.resolveMode(named, ctx, seen);
    }
    if (input instanceof SplitContainerMode) return input;
    if (typeof input === 'function') {
      if (input.prototype instanceof SplitContainerMode) {
        return this.instantiate(input as Type<SplitContainerMode>);
      }
      return this.resolveMode(
        (input as (c: SplitModeResolveContext) => SplitModeInput)(ctx),
        ctx,
        seen,
      );
    }
    if (typeof input === 'object' && input !== null) {
      const definition = input as SplitModeDefinition;
      if (definition.layout !== undefined && !isLayout(definition.layout)) {
        throw new SplitInvalidOptionError(
          'mode.layout',
          definition.layout,
          SPLIT_CONTAINER_LAYOUTS.join(' | '),
        );
      }
      const base =
        definition.extends !== undefined
          ? this.resolveMode(definition.extends, ctx, seen)
          : this.builtins[definition.layout ?? (ctx.kind === 'body' ? 'overlay' : 'inline')];
      const delegate =
        definition.layout && definition.layout !== base.layout
          ? this.builtins[definition.layout]
          : base;
      return new DefinedSplitContainerMode(base, delegate, definition);
    }
    throw new SplitInvalidOptionError('mode', input, 'nome de modo, objeto, classe ou função');
  }

  /** Creates (once) a class with dependency injection. */
  instantiate<T>(type: Type<T>): T {
    let instance = this.instances.get(type) as T | undefined;
    if (!instance) {
      instance = Injector.create({
        providers: [{ provide: type, useClass: type }],
        parent: this.injector,
      }).get(type);
      this.instances.set(type, instance);
    }
    return instance;
  }

  private unknown(option: string, name: string): never {
    throw new SplitInvalidOptionError(option, name, this.modeNames().join(' | '));
  }

  private inlineOnBody(option: string): never {
    throw new SplitInvalidOptionError(
      option,
      'inline',
      "'push' ou 'overlay' (inline não vale no body)",
    );
  }
}

function mergeDefaults(
  base: SplitContainerDefaults,
  own: SplitContainerDefaults | undefined,
): SplitContainerDefaults {
  if (!own) return base;
  const merged = mergeModeSettings(pickModeSettings(base), pickModeSettings(own));
  return { ...merged, mode: own.mode ?? base.mode };
}
