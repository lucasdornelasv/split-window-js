import { expect, test } from '@playwright/test';
import { container, dragTab, gotoPage, tab, tabLabels, tabRole } from './helpers';

test.describe('Drag and drop', () => {
  test.beforeEach(async ({ page }) => {
    await gotoPage(page, 'arraste');
    await page.locator('[data-action="seed"]').click();
    await expect(tabLabels(page, 'origem')).toHaveText(['Alfa', 'Beta', 'Gama', 'Presa']);
  });

  test('reorders inside the strip', async ({ page }) => {
    await dragTab(page, tab(page, 'origem', 'Alfa'), tab(page, 'origem', 'Gama'), {
      offset: { x: 30, y: 0 },
    });
    await expect(tabLabels(page, 'origem')).toHaveText(['Beta', 'Gama', 'Alfa', 'Presa']);
    await expect(page.locator('[data-log="moves"]')).toContainText(
      'Alfa: reordered origem[0] -> origem[2]',
    );
  });

  test('moves to another container keeping the component state', async ({ page }) => {
    await tab(page, 'origem', 'Beta').click();
    const panel = container(page, 'origem').locator('.split-tab-panel:not([hidden])');
    await panel.locator('.note__increment').click();
    await panel.locator('.note__increment').click();
    await panel.locator('.note__input').fill('estado preservado');
    await dragTab(page, tab(page, 'origem', 'Beta'), tab(page, 'destino', 'Delta'));
    await expect(tabLabels(page, 'destino')).toContainText(['Beta']);
    await expect(tabLabels(page, 'origem')).toHaveText(['Alfa', 'Gama', 'Presa']);
    const moved = container(page, 'destino').locator('.split-tab-panel:not([hidden])');
    await expect(moved.locator('.note__count')).toHaveText('2');
    await expect(moved.locator('.note__input')).toHaveValue('estado preservado');
    await expect(moved.locator('.note__container')).toHaveText('destino');
    await expect(tabRole(page, 'destino', 'Beta')).toHaveAttribute('aria-selected', 'true');
  });

  test('a drop on the content area goes to the end of the strip', async ({ page }) => {
    await dragTab(
      page,
      tab(page, 'origem', 'Alfa'),
      container(page, 'destino').locator('.split-content'),
    );
    await expect(tabLabels(page, 'destino')).toHaveText(['Delta', 'Alfa']);
  });

  test('a drop in an invalid place cancels', async ({ page }) => {
    await dragTab(page, tab(page, 'origem', 'Alfa'), page.locator('h1'));
    await expect(tabLabels(page, 'origem')).toHaveText(['Alfa', 'Beta', 'Gama', 'Presa']);
  });

  test('canMove refuses other containers', async ({ page }) => {
    await dragTab(page, tab(page, 'origem', 'Presa'), tab(page, 'destino', 'Delta'));
    await expect(tabLabels(page, 'origem')).toContainText(['Presa']);
    await expect(tabLabels(page, 'destino')).toHaveText(['Delta']);
  });

  test('a closed container shows a floating drop zone and reopens with the tab', async ({
    page,
  }) => {
    // open and close the closable container so it is closed (closeWhenEmpty)
    await page.locator('[data-action="open-closable"]').click();
    await container(page, 'fechavel').locator('.split-tab__close').click();
    await expect(container(page, 'fechavel')).toBeHidden();

    const zone = page.locator('.split-drop-zone[data-container-key="fechavel"]');
    await dragTab(page, tab(page, 'origem', 'Gama'), page.locator('[data-host="fechavel"]'), {
      beforeDrop: async () => {
        await expect(zone).toBeVisible();
        await expect(zone).toContainText('Fechável');
      },
    });
    await expect(container(page, 'fechavel')).toBeVisible();
    await expect(tabLabels(page, 'fechavel')).toHaveText(['Gama']);
    await expect(page.locator('.split-drop-zone')).toHaveCount(0);
  });

  test('programmatic moveTo uses the same path', async ({ page }) => {
    await page.locator('[data-action="move-first"]').click();
    await expect(tabLabels(page, 'destino')).toHaveText(['Alfa', 'Delta']);
    await expect(page.locator('[data-log="moves"]')).toContainText(
      'Alfa: containerChanged origem[0] -> destino[0]',
    );
  });

  test('keyboard: arrows move focus and activate; Ctrl+Shift+arrow reorders', async ({ page }) => {
    await tab(page, 'origem', 'Alfa').click();
    await page.keyboard.press('ArrowRight');
    await expect(tabRole(page, 'origem', 'Beta')).toHaveAttribute('aria-selected', 'true');
    await expect(tabRole(page, 'origem', 'Beta')).toBeFocused();
    await page.keyboard.press('Control+Shift+ArrowLeft');
    await expect(tabLabels(page, 'origem')).toHaveText(['Beta', 'Alfa', 'Gama', 'Presa']);
    await page.keyboard.press('End');
    await expect(tabRole(page, 'origem', 'Presa')).toHaveAttribute('aria-selected', 'true');
  });
});

test.describe('Tela cheia', () => {
  test.beforeEach(async ({ page }) => {
    await gotoPage(page, 'tela-cheia');
    await page.locator('[data-action="seed"]').click();
  });

  test('expands to the window and Esc restores', async ({ page }) => {
    const shell = container(page, 'janela');
    await shell.locator('.split-expand-button').click();
    const viewport = page.viewportSize()!;
    await expect(shell).toHaveClass(/split-container--expanded/);
    const box = (await shell.boundingBox())!;
    expect(Math.round(box.width)).toBe(viewport.width);
    expect(Math.round(box.height)).toBe(viewport.height);
    await page.keyboard.press('Escape');
    await expect(shell).not.toHaveClass(/split-container--expanded/);
    const host = (await page.locator('[data-host="janela"]').boundingBox())!;
    const restored = (await shell.boundingBox())!;
    expect(Math.abs(restored.width - host.width)).toBeLessThan(2);
  });

  test('bounds, maxWidth, margin and align', async ({ page }) => {
    const shell = container(page, 'area');
    await shell.locator('.split-expand-button').click();
    const area = (await page.locator('#area-referencia').boundingBox())!;
    const box = (await shell.boundingBox())!;
    expect(Math.round(box.x)).toBe(Math.round(area.x + 16));
    expect(Math.round(box.y)).toBe(Math.round(area.y + 16));
    expect(Math.round(box.width)).toBe(Math.min(640, Math.round(area.width - 32)));
    // '80%' is relative to the whole reference area, capped by the area minus the margin
    expect(Math.round(box.height)).toBe(Math.round(Math.min(area.height * 0.8, area.height - 32)));
  });

  test('one container expanded at a time', async ({ page }) => {
    await page.locator('[data-action="expand-api"]').click();
    await expect(container(page, 'janela')).toHaveClass(/split-container--expanded/);
    await page.keyboard.press('Escape');
    await container(page, 'area').locator('.split-expand-button').click();
    await page.evaluate(() => {
      // expanding by API restores the expanded one
      (document.querySelector('[data-action="expand-api"]') as HTMLButtonElement).click();
    });
    await expect(container(page, 'janela')).toHaveClass(/split-container--expanded/);
    await expect(container(page, 'area')).not.toHaveClass(/split-container--expanded/);
  });

  test('expand: false has no button', async ({ page }) => {
    await expect(container(page, 'sem-expandir').locator('.split-expand-button')).toHaveCount(0);
  });

  test('a transformed ancestor sends the shell to the body layer', async ({ page }) => {
    const shell = container(page, 'transformado');
    await shell.locator('.split-expand-button').click();
    await expect(
      page.locator('.split-expand-layer split-container[data-container-key="transformado"]'),
    ).toHaveCount(1);
    const box = (await shell.boundingBox())!;
    expect(Math.round(box.x)).toBe(0);
    expect(Math.round(box.y)).toBe(0);
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-host="transformado"] split-container')).toHaveCount(1);
  });

  test('while expanded, a drop over a covered container does not move the tab', async ({
    page,
  }) => {
    const shell = container(page, 'janela');
    await shell.locator('.split-expand-button').click();
    // the "area" container is right under the expanded shell
    const areaHost = (await page.locator('[data-host="area"]').boundingBox())!;
    await dragTab(page, tab(page, 'janela', 'janela'), { x: areaHost.x + 40, y: areaHost.y + 60 });
    await expect(tabLabels(page, 'janela')).toHaveCount(2);
    await expect(tabLabels(page, 'area')).toHaveCount(2);
    await expect(page.locator('.split-drop-zone')).toHaveCount(0);
  });

  test('the full screen button is disabled during a drag', async ({ page }) => {
    const shell = container(page, 'janela');
    await dragTab(page, tab(page, 'janela', 'janela'), page.locator('h1'), {
      beforeDrop: async () => {
        await expect(shell.locator('.split-expand-button')).toBeDisabled();
      },
    });
    await expect(shell.locator('.split-expand-button')).toBeEnabled();
  });
});
