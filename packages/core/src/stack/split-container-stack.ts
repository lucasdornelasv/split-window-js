import type { SplitWindowRef } from '../controller/split-window-ref.js';
import { TabGroupResolver } from '../numbering/tab-group-resolver.js';

/**
 * State of one container: ordered tabs, active tab and numbers in use.
 * Tabs are registered by identity, so closing one tab never unregisters another.
 */
export class SplitContainerStack {
  readonly numbering = new TabGroupResolver();
  private readonly order: SplitWindowRef[] = [];
  private readonly byId = new Map<string, SplitWindowRef>();
  activeId: string | null = null;

  get tabs(): readonly SplitWindowRef[] {
    return this.order;
  }

  get size(): number {
    return this.order.length;
  }

  get active(): SplitWindowRef | null {
    return this.activeId ? (this.byId.get(this.activeId) ?? null) : null;
  }

  has(ref: SplitWindowRef): boolean {
    return this.byId.get(ref.id) === ref;
  }

  indexOf(ref: SplitWindowRef): number {
    return this.order.indexOf(ref);
  }

  /** Inserts at `index` (clamped; default: the end) and returns the final index. */
  insert(ref: SplitWindowRef, index?: number): number {
    const at = clampIndex(index ?? this.order.length, this.order.length);
    this.order.splice(at, 0, ref);
    this.byId.set(ref.id, ref);
    return at;
  }

  /** Removes the tab and returns where it was. Only this tab is touched. */
  remove(ref: SplitWindowRef): { index: number; wasActive: boolean } {
    const index = this.order.indexOf(ref);
    if (index < 0) return { index: -1, wasActive: false };
    this.order.splice(index, 1);
    this.byId.delete(ref.id);
    const wasActive = this.activeId === ref.id;
    if (wasActive) this.activeId = null;
    return { index, wasActive };
  }

  /** Moves a tab inside the stack. Returns the clamped target index. */
  move(ref: SplitWindowRef, toIndex: number): { from: number; to: number } {
    const from = this.order.indexOf(ref);
    const to = clampIndex(toIndex, this.order.length - 1);
    if (from < 0 || from === to) return { from, to: from };
    this.order.splice(from, 1);
    this.order.splice(to, 0, ref);
    return { from, to };
  }

  /** Tab to activate after removing the one at `index`: the right neighbor, else the left one. */
  neighborOf(removedIndex: number): SplitWindowRef | null {
    return this.order[removedIndex] ?? this.order[removedIndex - 1] ?? null;
  }
}

function clampIndex(index: number, max: number): number {
  if (!Number.isFinite(index)) return Math.max(0, max);
  return Math.min(Math.max(0, Math.trunc(index)), Math.max(0, max));
}
