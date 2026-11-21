import type { SplitWindowRef } from '../controller/split-window-ref.js';
import { SplitInvalidOptionError } from '../errors/errors.js';
import type { ContainerState, SplitCapacityContext } from '../model/types.js';

/** Whether the container is full for the arriving tab. */
export function isFull(container: ContainerState<any>, ctx: SplitCapacityContext): boolean {
  const max = container.options.maxTabs;
  if (max === undefined) return false;
  if (typeof max === 'function') return max(ctx) === true;
  return ctx.tabs.length >= max;
}

function oldestBy(
  refs: readonly SplitWindowRef[],
  key: (ref: SplitWindowRef) => number,
): SplitWindowRef | null {
  let best: SplitWindowRef | null = null;
  for (const ref of refs) {
    if (
      !best ||
      key(ref) < key(best) ||
      (key(ref) === key(best) && ref._state.createdSeq < best._state.createdSeq)
    ) {
      best = ref;
    }
  }
  return best;
}

/**
 * Applies `onFull`. Returns the tab to replace, or `null` when the arriving tab is rejected.
 * Replacement is synchronous: tabs with `canClose` are never replaced. Pre-defined strategies
 * also skip the active tab and tabs with `closable: false`, and only reject on moves.
 */
export function pickReplacement(
  container: ContainerState<any>,
  ctx: SplitCapacityContext,
): SplitWindowRef | null {
  const onFull = container.options.onFull ?? 'reject';
  if (typeof onFull === 'function') {
    const decision = onFull(ctx);
    if (!decision || decision.action !== 'replace') return null;
    const ref = decision.ref;
    if (!ctx.tabs.includes(ref) || ref.hasCanClose || ref === ctx.incomingRef) return null;
    return ref;
  }
  if (onFull === 'reject' || ctx.source === 'move') return null;
  const candidates = ctx.tabs.filter((ref) => !ref.isActive && !ref.hasCanClose && ref.closable);
  switch (onFull) {
    case 'replace-oldest':
      return oldestBy(candidates, (ref) => ref._state.createdSeq);
    case 'replace-lru':
      return oldestBy(candidates, (ref) => ref._state.activatedSeq);
    case 'replace-same-label': {
      const group = ctx.incoming.groupKey ?? null;
      const title = ctx.incoming.title;
      return oldestBy(
        candidates.filter((ref) => ref.groupKey === group && ref.title === title),
        (ref) => ref._state.createdSeq,
      );
    }
  }
}

export type SplitRejectResolution =
  { action: 'throw' } | { action: 'cancel' } | { action: 'redirect'; containerKey: string | null };

/** Applies `onReject`. A redirect to `null` means there is no default container. */
export function resolveReject(
  container: ContainerState<any>,
  ctx: SplitCapacityContext,
  defaultKey: string | null,
): SplitRejectResolution {
  const onReject = container.options.onReject ?? 'throw';
  if (typeof onReject === 'function') {
    const decision = onReject(ctx);
    switch (decision?.action) {
      case 'throw':
      case 'cancel':
        return { action: decision.action };
      case 'redirect':
        if (typeof decision.containerKey !== 'string' || decision.containerKey === '') {
          throw new SplitInvalidOptionError(
            'onReject().containerKey',
            decision.containerKey,
            'chave de container',
          );
        }
        return { action: 'redirect', containerKey: decision.containerKey };
      default:
        throw new SplitInvalidOptionError(
          'onReject()',
          decision,
          "{ action: 'throw' | 'cancel' | 'redirect' }",
        );
    }
  }
  if (onReject === 'redirect-default') return { action: 'redirect', containerKey: defaultKey };
  return { action: onReject };
}
