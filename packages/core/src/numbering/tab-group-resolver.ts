/** Smallest positive number not in `used`. */
export function nextOrdinal(used: ReadonlySet<number>): number {
  let n = 1;
  while (used.has(n)) n++;
  return n;
}

/** Label shown in the strip: the first tab of a group + title pair never shows a number. */
export function formatTabLabel(title: string, ordinal: number): string {
  return ordinal === 1 ? title : `${title} (${ordinal})`;
}

/**
 * Numbers in use per group + title, inside one container.
 * Nested maps avoid the collisions a concatenated key ("group::title") would have.
 */
export class TabGroupResolver {
  private readonly used = new Map<string | null, Map<string, Set<number>>>();

  /** Reserves the smallest free number for the pair and returns it. */
  reserve(groupKey: string | null, title: string): number {
    let byTitle = this.used.get(groupKey);
    if (!byTitle) {
      byTitle = new Map();
      this.used.set(groupKey, byTitle);
    }
    let numbers = byTitle.get(title);
    if (!numbers) {
      numbers = new Set();
      byTitle.set(title, numbers);
    }
    const ordinal = nextOrdinal(numbers);
    numbers.add(ordinal);
    return ordinal;
  }

  /** Frees a number. Other tabs keep their numbers. */
  release(groupKey: string | null, title: string, ordinal: number): void {
    const byTitle = this.used.get(groupKey);
    const numbers = byTitle?.get(title);
    if (!byTitle || !numbers) return;
    numbers.delete(ordinal);
    if (numbers.size === 0) byTitle.delete(title);
    if (byTitle.size === 0) this.used.delete(groupKey);
  }

  /** Numbers in use for a pair (for tests and debugging). */
  inUse(groupKey: string | null, title: string): number[] {
    return [...(this.used.get(groupKey)?.get(title) ?? [])].sort((a, b) => a - b);
  }
}
