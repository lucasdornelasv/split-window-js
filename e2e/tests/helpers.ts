import { expect, type Locator, type Page } from '@playwright/test';

/** Opens a demo page. */
export async function gotoPage(page: Page, path: string): Promise<void> {
  await page.goto(`/#/${path}`);
  await expect(page.locator(`demo-example`).first()).toBeVisible();
}

/** The shell of a container. */
export function container(page: Page, key: string): Locator {
  return page.locator(`split-container[data-container-key="${key}"]`);
}

/** Tab labels of a container, in strip order. */
export function tabLabels(page: Page, key: string): Locator {
  return container(page, key).locator('[role="tab"]');
}

/** A tab of a container by its exact label: the draggable item with the tab and its close button. */
export function tab(page: Page, key: string, label: string): Locator {
  return container(page, key).locator('.split-tab:not(.cdk-drag-placeholder)', {
    has: page.locator('[role="tab"]', { hasText: new RegExp(`^\\s*${escape(label)}\\s*$`) }),
  });
}

/** The element with `role="tab"` of a tab. */
export function tabRole(page: Page, key: string, label: string): Locator {
  return tab(page, key, label).locator('[role="tab"]');
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

type Point = { x: number; y: number };

async function center(locator: Locator): Promise<Point> {
  const box = await locator.boundingBox();
  if (!box) throw new Error('element without a box');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/**
 * Real pointer drag, the way a user does it: press on the tab label, pass the CDK drag
 * threshold, move in steps and release.
 */
export async function dragTab(
  page: Page,
  source: Locator,
  target: Locator | Point,
  options: { offset?: Point; beforeDrop?: () => Promise<void> } = {},
): Promise<void> {
  const handle = source.locator('[role="tab"]');
  const from = await center(handle);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 12, from.y + 4, { steps: 4 });
  const to = 'x' in target ? target : await center(target);
  const dest = { x: to.x + (options.offset?.x ?? 0), y: to.y + (options.offset?.y ?? 0) };
  await page.mouse.move(dest.x, dest.y, { steps: 20 });
  await page.mouse.move(dest.x + 2, dest.y + 1, { steps: 2 });
  if (options.beforeDrop) await options.beforeDrop();
  await page.mouse.up();
  // CDK animates the drop
  await page.waitForTimeout(350);
}
