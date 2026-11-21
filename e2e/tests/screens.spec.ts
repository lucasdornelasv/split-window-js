import { expect, test } from '@playwright/test';
import { container, gotoPage, tab, tabLabels, tabRole } from './helpers';

test.describe('Início rápido', () => {
  test('opens tabs in body-right with numbering', async ({ page }) => {
    await gotoPage(page, 'inicio');
    await page.locator('[data-action="open-note"]').click();
    await page.locator('[data-action="open-note"]').click();
    await expect(page.locator('.split-body-host--right')).toBeVisible();
    await expect(tabLabels(page, 'body-right')).toHaveText(['Nota', 'Nota (2)']);
    await expect(tabRole(page, 'body-right', 'Nota (2)')).toHaveAttribute('aria-selected', 'true');
  });

  test('the body container closes when its last tab closes', async ({ page }) => {
    await gotoPage(page, 'inicio');
    await page.locator('[data-action="open-note"]').click();
    await container(page, 'body-right').locator('.split-tab__close').click();
    await expect(page.locator('.split-body-host--right')).toBeHidden();
  });
});

test.describe('Containers', () => {
  test('opens in each container and in the default one', async ({ page }) => {
    await gotoPage(page, 'containers');
    await page.locator('[data-action="open-left"]').click();
    await page.locator('[data-action="open-right"]').click();
    await page.locator('[data-action="open-code"]').click();
    await expect(tabLabels(page, 'esquerdo')).toHaveText(['esquerdo']);
    await expect(tabLabels(page, 'direito')).toHaveText(['direito']);
    await expect(tabLabels(page, 'programatico')).toHaveText(['programatico']);
    await page.locator('[data-field="default"]').selectOption('esquerdo');
    await page.locator('[data-action="open-default"]').click();
    await expect(tabLabels(page, 'esquerdo')).toHaveText(['esquerdo', 'Padrão']);
  });
});

test.describe('Containers do body', () => {
  test('reconfigures the sides and the default', async ({ page }) => {
    await gotoPage(page, 'body');
    await expect(page.locator('[data-open-side="left"]')).toBeDisabled();
    await page.locator('[data-config="full"]').click();
    await expect(page.locator('[data-field="default"]')).toHaveText('body-left');
    await page.locator('[data-open-side="bottom"]').click();
    await page.locator('[data-open-side="left"]').click();
    await expect(page.locator('.split-body-host--left')).toBeVisible();
    await expect(page.locator('.split-body-host--bottom')).toBeVisible();
    // back to the minimal config: left and bottom are disabled and their tabs dismissed.
    // The body-left panel now covers the buttons, as a fixed side panel does.
    await page.locator('[data-config="minimal"]').dispatchEvent('click');
    await expect(page.locator('.split-body-host--left')).toHaveCount(0);
    await expect(page.locator('[data-open-side="left"]')).toBeDisabled();
  });

  test('backdrop', async ({ page }) => {
    await gotoPage(page, 'body');
    await page.locator('[data-config="backdrop"]').click();
    await page.locator('[data-open-side="right"]').click();
    await expect(page.locator('.split-body-backdrop')).toBeVisible();
  });
});

test.describe('Abas e numeração', () => {
  test('numbers per group and title, renames and keeps numbers when others close', async ({
    page,
  }) => {
    await gotoPage(page, 'abas');
    const open = page.locator('[data-action="open"]');
    await open.click();
    await open.click();
    await page.locator('[data-field="group"]').fill('B');
    await open.click();
    await expect(tabLabels(page, 'abas')).toHaveText(['Contrato', 'Contrato (2)', 'Contrato']);
    await tab(page, 'abas', 'Contrato').first().locator('.split-tab__close').click();
    await expect(tabLabels(page, 'abas')).toHaveText(['Contrato (2)', 'Contrato']);
    await page.locator('[data-ref="Contrato (2)"] [data-action="rename"]').click();
    await expect(tabLabels(page, 'abas')).toHaveText(['Proposta', 'Contrato']);
  });

  test('activate: false keeps the current tab', async ({ page }) => {
    await gotoPage(page, 'abas');
    await page.locator('[data-action="open"]').click();
    await page.locator('[data-field="activate"]').uncheck();
    await page.locator('[data-action="open"]').click();
    await expect(tabRole(page, 'abas', 'Contrato')).toHaveAttribute('aria-selected', 'true');
    await expect(tabRole(page, 'abas', 'Contrato (2)')).toHaveAttribute('aria-selected', 'false');
  });
});

test.describe('Limite de abas', () => {
  test('throw by default, then replace-oldest', async ({ page }) => {
    await gotoPage(page, 'limite');
    const open = page.locator('[data-action="open"]');
    for (let i = 0; i < 3; i++) await open.click();
    await open.click();
    await expect(page.locator('[data-field="error"]')).toContainText('SplitContainerFullError');
    await expect(page.locator('[data-log="rejected"]')).toContainText('limitado: throw (open)');

    await page.locator('[data-field="on-full"]').selectOption('replace-oldest');
    for (let i = 0; i < 4; i++) await open.click();
    await expect(tabLabels(page, 'limitado')).toHaveText([
      'Relatório (2)',
      'Relatório (3)',
      'Relatório',
    ]);
  });

  test('redirect-default sends the tab to the default container', async ({ page }) => {
    await gotoPage(page, 'limite');
    await page.locator('[data-field="on-reject"]').selectOption('redirect-default');
    const open = page.locator('[data-action="open"]');
    for (let i = 0; i < 4; i++) await open.click();
    await expect(tabLabels(page, 'reserva')).toHaveText(['Relatório']);
    await expect(page.locator('[data-log="rejected"]')).toContainText('redirect -> reserva');
  });

  test('cancel returns a rejected ref', async ({ page }) => {
    await gotoPage(page, 'limite');
    await page.locator('[data-field="on-reject"]').selectOption('cancel');
    const open = page.locator('[data-action="open"]');
    for (let i = 0; i < 4; i++) await open.click();
    await expect(page.locator('[data-field="error"]')).toContainText('cancelada');
  });
});

test.describe('Fechamento', () => {
  test('closable:false has no X; canClose false keeps the tab', async ({ page }) => {
    await gotoPage(page, 'fechamento');
    await page.locator('[data-action="open-pinned"]').click();
    await page.locator('[data-action="open-never"]').click();
    await expect(tab(page, 'fechamento', 'Fixa').locator('.split-tab__close')).toHaveCount(0);
    await tab(page, 'fechamento', 'Nunca').locator('.split-tab__close').click();
    await expect(tabLabels(page, 'fechamento')).toHaveText(['Fixa', 'Nunca']);
    await expect(page.locator('[data-log="closing"]')).toContainText(
      'Nunca: closePrevented (tab-button)',
    );
  });

  test('confirmation dialog: No keeps, Yes closes', async ({ page }) => {
    await gotoPage(page, 'fechamento');
    await page.locator('[data-action="open-confirm"]').click();
    const close = tab(page, 'fechamento', 'Confirma').locator('.split-tab__close');
    await close.click();
    await page.locator('dialog.demo-confirm [data-answer="no"]').click();
    await expect(tabLabels(page, 'fechamento')).toHaveText(['Confirma']);
    await close.click();
    await page.locator('dialog.demo-confirm [data-answer="yes"]').click();
    await expect(tabLabels(page, 'fechamento')).toHaveCount(0);
  });

  test('close all waits for a confirmation in the middle and continues', async ({ page }) => {
    await gotoPage(page, 'fechamento');
    await page.locator('[data-action="open-observable"]').click();
    await page.locator('[data-action="open-confirm"]').click();
    await page.locator('[data-action="open-pinned"]').click();
    await page.locator('[data-action="open-observable"]').click();
    await container(page, 'fechamento').locator('.split-close-all-button').click();
    await expect(container(page, 'fechamento').locator('.split-close-all-button')).toBeDisabled();
    // the tab awaiting confirmation is active
    await expect(tabRole(page, 'fechamento', 'Confirma')).toHaveAttribute('aria-selected', 'true');
    await page.locator('dialog.demo-confirm [data-answer="no"]').click();
    await expect(tabLabels(page, 'fechamento')).toHaveText(['Confirma', 'Fixa']);
  });

  test('a dirty form asks before closing; force skips the check', async ({ page }) => {
    await gotoPage(page, 'fechamento');
    await page.locator('[data-action="open-form"]').click();
    await container(page, 'fechamento').locator('.form-tab__input').fill('abc');
    await tab(page, 'fechamento', 'Formulário').locator('.split-tab__close').click();
    await expect(page.locator('dialog.demo-confirm')).toBeVisible();
    await page.locator('dialog.demo-confirm [data-answer="no"]').click();
    await page.locator('[data-action="force"]').click();
    await expect(tabLabels(page, 'fechamento')).toHaveCount(0);
  });
});

test.describe('Eventos', () => {
  test('logs ref, manager and registry events', async ({ page }) => {
    await gotoPage(page, 'eventos');
    await page.locator('[data-action="open"]').click();
    await page.locator('[data-action="rename"]').click();
    await page.locator('[data-action="move"]').click();
    const log = page.locator('[data-log="events"]');
    // "activated" of the first open fires before the screen subscribes; the move activates it again
    await expect(log).toContainText('ref Renomeada 2 activated');
    await expect(log).toContainText('titleChanged Renomeada 2');
    await expect(log).toContainText('containerChanged eventos-a->eventos-b');
    await expect(log).toContainText('manager.tabMoved Renomeada 2 containerChanged');
    await expect(log).toContainText('registry.containerStateChanged eventos-b open=true');
  });
});

test.describe('Erros', () => {
  const cases = [
    [
      'not-found',
      'SplitContainerNotFoundError',
      "Nenhum container configurado com a chave 'contratos'",
    ],
    ['body-disabled', 'SplitContainerNotFoundError', "O container 'body-left' não está habilitado"],
    ['no-default', 'SplitNoDefaultContainerError', 'Nenhum container padrão configurado'],
    ['reserved', 'SplitReservedContainerKeyError', 'reservada'],
    ['invalid', 'SplitInvalidOptionError', 'maxTabs'],
  ] as const;
  for (const [id, name, message] of cases) {
    test(`${id} -> ${name}`, async ({ page }) => {
      await gotoPage(page, 'erros');
      await page.locator(`[data-error="${id}"]`).click();
      await expect(page.locator('[data-field="error-name"]')).toHaveText(name);
      await expect(page.locator('[data-field="error-message"]')).toContainText(message);
    });
  }
});

test.describe('Playground', () => {
  test('each field changes the container and the generated code', async ({ page }) => {
    await gotoPage(page, 'playground');
    const code = page.locator('demo-example[data-example="playground"] pre code');
    await page.locator('[data-field="maxTabs"]').fill('2');
    await expect(code).toContainText('maxTabs: 2');
    await page.locator('[data-field="onFull"]').selectOption('replace-oldest');
    await expect(code).toContainText("onFull: 'replace-oldest'");
    await page.locator('[data-field="onReject"]').selectOption('cancel');
    await expect(code).toContainText("onReject: 'cancel'");
    await page.locator('[data-field="label"]').fill('Meu painel');
    await expect(code).toContainText("label: 'Meu painel'");
    await page.locator('[data-field="closeWhenEmpty"]').check();
    await expect(code).toContainText('closeWhenEmpty: true');
    await page.locator('[data-field="expandMaxWidth"]').fill('60vw');
    await expect(code).toContainText("maxWidth: '60vw'");
    await page.locator('[data-field="expandMargin"]').fill('12');
    await expect(code).toContainText('margin: 12');
    await page.locator('[data-field="expandAlign"]').selectOption('end');
    await expect(code).toContainText("align: 'end'");
    await page.locator('[data-field="expand"]').uncheck();
    await expect(code).toContainText('expand: false');
    await page.locator('[data-field="title"]').fill('Pedido');
    await expect(code).toContainText("title: 'Pedido'");
    await page.locator('[data-field="groupKey"]').fill('vendas');
    await expect(code).toContainText("groupKey: 'vendas'");
    await page.locator('[data-field="activate"]').uncheck();
    await expect(code).toContainText('activate: false');
    await page.locator('[data-field="closable"]').uncheck();
    await expect(code).toContainText('closable: false');
    await page.locator('[data-field="confirmClose"]').check();
    await expect(code).toContainText('canClose');
    await page.locator('[data-field="lockToContainer"]').check();
    await expect(code).toContainText('canMove');

    const open = page.locator('[data-action="open"]');
    await open.click();
    await open.click();
    await open.click();
    // maxTabs 2 + replace-oldest: the oldest inactive tab is replaced
    await expect(tabLabels(page, 'playground')).toHaveCount(2);
    await expect(container(page, 'playground').locator('.split-tab__close')).toHaveCount(0);
    await expect(container(page, 'playground').locator('.split-expand-button')).toHaveCount(0);
  });

  test('reset restores the defaults', async ({ page }) => {
    await gotoPage(page, 'playground');
    await page.locator('[data-field="maxTabs"]').fill('2');
    await page.locator('[data-action="reset"]').click();
    await expect(page.locator('demo-example[data-example="playground"] pre code')).toContainText(
      "registerContainer('playground', host, {})",
    );
  });
});
