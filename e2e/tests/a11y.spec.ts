import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { container, gotoPage, tabRole } from './helpers';

test.describe('Acessibilidade', () => {
  test('strip roles and attributes', async ({ page }) => {
    await gotoPage(page, 'arraste');
    await page.locator('[data-action="seed"]').click();
    const shell = container(page, 'origem');
    await expect(shell.locator('[role="tablist"]')).toHaveCount(1);
    await expect(shell.locator('[role="tab"]')).toHaveCount(4);
    const active = tabRole(page, 'origem', 'Presa');
    await expect(active).toHaveAttribute('aria-selected', 'true');
    await expect(active).toHaveAttribute('tabindex', '0');
    const panelId = await active.getAttribute('aria-controls');
    await expect(page.locator(`#${panelId}`)).toHaveAttribute('role', 'tabpanel');
    await expect(active).toHaveAttribute('aria-keyshortcuts', 'Delete');
    await expect(shell.locator('.split-close-all-button')).toHaveAttribute(
      'aria-label',
      'Fechar todas as abas',
    );
  });

  test('no axe violations in the library markup', async ({ page }) => {
    await gotoPage(page, 'arraste');
    await page.locator('[data-action="seed"]').click();
    const results = await new AxeBuilder({ page }).include('split-container').analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });

  test('every demo screen loads', async ({ page }) => {
    for (const path of [
      'inicio',
      'containers',
      'body',
      'abas',
      'limite',
      'fechamento',
      'arraste',
      'tela-cheia',
      'eventos',
      'erros',
      'playground',
    ]) {
      await gotoPage(page, path);
      await expect(page.locator(`nav a[data-page="${path}"]`)).toHaveClass(/active/);
    }
  });
});
