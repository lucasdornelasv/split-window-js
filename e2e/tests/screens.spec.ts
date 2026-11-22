import { expect, test, type Page } from '@playwright/test';
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

  test('a tab as a request: setInputData updates it and close emits the result', async ({
    page,
  }) => {
    await gotoPage(page, 'inicio');
    await page.locator('[data-action="open-request"]').click();
    const body = container(page, 'body-right');
    await expect(page.locator('[data-field="request-status"]')).toHaveText('aguardando');
    await expect(body.locator('.note__text')).toHaveText('Aguardando resposta');
    await page.locator('[data-action="update-inputs"]').click();
    await expect(body.locator('.note__text')).toContainText('Atualizado às');
    await body.locator('.note__close').click();
    await expect(page.locator('[data-field="request-result"]')).toHaveText('done');
    await expect(page.locator('[data-field="request-status"]')).toHaveText('concluída');
  });

  test('a tab as a request completes without a value when dismissed', async ({ page }) => {
    await gotoPage(page, 'inicio');
    await page.locator('[data-action="open-request"]').click();
    await container(page, 'body-right').locator('.split-tab__close').click();
    await expect(page.locator('[data-field="request-status"]')).toHaveText('concluída');
    await expect(page.locator('[data-field="request-result"]')).toHaveText('—');
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

test.describe('Modos e animação', () => {
  test('push grows the host and shrinks the content; the last tab stays while it leaves', async ({
    page,
  }) => {
    await gotoPage(page, 'modos');
    const host = page.locator('[data-host="modo-push"]');
    const content = host.locator('xpath=preceding-sibling::div[1]');
    const before = (await content.boundingBox())!.width;
    expect((await host.boundingBox())!.width).toBe(0);
    await page.locator('[data-action="open-push"]').click();
    await expect(container(page, 'modo-push')).toBeVisible();
    await expect.poll(async () => (await host.boundingBox())!.width).toBe(320);
    expect((await content.boundingBox())!.width).toBeLessThan(before);
    // Closing the last tab: the panel animates out with the tab still on screen.
    await container(page, 'modo-push').locator('.split-tab__close').click();
    await expect(container(page, 'modo-push')).toHaveClass(/split-container--leaving/);
    await expect(tabLabels(page, 'modo-push')).toHaveText(['Aba 1']);
    await expect(container(page, 'modo-push')).toBeHidden();
    await expect.poll(async () => (await host.boundingBox())!.width).toBe(0);
  });

  test('overlay floats over the content without taking space', async ({ page }) => {
    await gotoPage(page, 'modos');
    const host = page.locator('[data-host="modo-overlay"]');
    await page.locator('[data-action="open-overlay"]').click();
    await expect(container(page, 'modo-overlay')).toBeVisible();
    expect((await host.boundingBox())!.width).toBe(0);
    await expect
      .poll(async () => (await container(page, 'modo-overlay').boundingBox())!.width)
      .toBe(320);
  });

  test('a body container in push pads the page while open', async ({ page }) => {
    await gotoPage(page, 'body');
    await page.locator('[data-config="push"]').click();
    await page.locator('[data-open-side="right"]').click();
    await expect(page.locator('.split-body-host--right')).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.body).paddingRight))
      .toBe('360px');
    await container(page, 'body-right').locator('.split-tab__close').click();
    await expect(page.locator('.split-body-host--right')).toBeHidden();
    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.body).paddingRight))
      .toBe('0px');
  });

  test('the guide example matches the generated code', async ({ page }) => {
    await gotoPage(page, 'playground');
    await page.locator('[data-edit="body-right"]').click();
    await page.locator('[data-field="animation"]').check();
    await page.locator('[data-field="engine"]').selectOption('css');
    for (const phase of ['show', 'hide']) {
      await page.locator(`[data-field="${phase}-duration"]`).fill('300');
    }
    await page.locator('[data-field="show-preset"]').selectOption('fade');
    await page.locator('[data-field="show-easing"]').selectOption('spring');
    await page.locator('[data-field="hide-preset"]').selectOption('slide');
    await page.locator('[data-field="hide-origin"]').selectOption('bottom');
    await page.locator('[data-field="hide-distance"]').fill('40');
    const code = page.locator('demo-example[data-example="playground"] pre code');
    await expect(code).toContainText("import { spring } from '@split-window/angular';");
    await expect(code).toContainText(
      [
        'registry.useBodyContainers({',
        '  right: {',
        '    animation: {',
        "      engine: 'css',",
        '      duration: 300,',
        '      show: {',
        "        preset: 'fade',",
        '        easing: spring(),',
        '      },',
        '      hide: {',
        "        preset: 'slide',",
        "        origin: 'bottom',",
        '        distance: 40,',
        '      },',
        '    },',
        '  },',
        '});',
      ].join('\n'),
    );
  });

  // collapse: a curtain. The panel stays still in its final place and shows from the edge
  // on the content side; in the body push, the shown part is the space the page gave.
  const collapseCases = [
    ['css', 'body-right', 'push'],
    ['keyframes', 'body-right', 'push'],
    ['css', 'body-right', 'overlay'],
    ['keyframes', 'body-right', 'overlay'],
    ['css', 'direito', 'push'],
    ['css', 'direito', 'overlay'],
  ] as const;
  for (const [engine, key, mode] of collapseCases) {
    test(`collapse reveals the panel like a curtain (${key}, ${mode}, ${engine})`, async ({
      page,
    }) => {
      await gotoPage(page, 'playground');
      if (key === 'direito') await page.locator('[data-enable="direito"]').check();
      await page.locator(`[data-edit="${key}"]`).click();
      await page.locator('[data-field="mode"]').selectOption(mode);
      await page.locator('[data-field="size"]').fill('300px');
      if (key === 'direito') await page.locator('[data-field="closeWhenEmpty"]').check();
      await page.locator('[data-field="animation"]').check();
      await page.locator('[data-field="engine"]').selectOption(engine);
      for (const phase of ['show', 'hide']) {
        await page.locator(`[data-field="${phase}-preset"]`).selectOption('collapse');
        await page.locator(`[data-field="${phase}-duration"]`).fill('800');
      }
      await page.locator('[data-field="target"]').selectOption(key);
      // On every frame: where the panel is, how much of it shows and how much the page moved.
      await page.evaluate((containerKey) => {
        type Sample = { right: number; shown: number; pushed: number };
        const w = window as unknown as { samples: Sample[] };
        w.samples = [];
        const start = parseFloat(getComputedStyle(document.body).paddingRight);
        // A clip-path inset component: px, % of the width or calc(% + px).
        const length = (value: string, width: number) => {
          const percent = /(-?[\d.]+)%/.exec(value);
          const px = /(-?[\d.]+)px/.exec(value);
          return (percent ? (Number(percent[1]) * width) / 100 : 0) + (px ? Number(px[1]) : 0);
        };
        const tick = () => {
          const shell = document.querySelector<HTMLElement>(
            `split-container[data-container-key="${containerKey}"]`,
          );
          // Only during the transitions, so the page stays light.
          if (shell?.classList.contains('split-animating')) {
            const rect = shell.getBoundingClientRect();
            const clip = getComputedStyle(shell).clipPath;
            const parts = clip.startsWith('inset(') ? clip.slice(6, -1).split(/ (?![^(]*\))/) : [];
            // inset(top right bottom left): the left inset hides the content side.
            const hidden = parts.length === 4 ? length(parts[3], rect.width) : 0;
            // A host in push clips the panel itself.
            const host = shell.parentElement!.getBoundingClientRect();
            const clipped = Math.max(
              0,
              Math.min(rect.right, host.right) - Math.max(rect.left, host.left),
            );
            const shown = parts.length === 4 ? rect.width - hidden : Math.min(clipped, rect.width);
            w.samples.push({
              right: rect.right,
              shown,
              pushed: parseFloat(getComputedStyle(document.body).paddingRight) - start,
            });
          }
          requestAnimationFrame(tick);
        };
        tick();
      }, key);
      const shell = container(page, key);
      await page.locator('[data-action="open"]').click();
      await expect(tabLabels(page, key)).toHaveText(['Nova aba']);
      await expect(shell).not.toHaveClass(/split-animating/);
      const openRight = await shell.evaluate((el) => el.getBoundingClientRect().right);
      await page.locator('[data-action="dismiss-all"]').click();
      await expect(shell).toBeHidden();

      const samples = await page.evaluate(
        () =>
          (window as unknown as { samples: { right: number; shown: number; pushed: number }[] })
            .samples,
      );
      const moving = samples.filter((s) => s.shown > 5 && s.shown < 295);
      expect(moving.length).toBeGreaterThan(5);
      // The panel does not move: it is always at its final place.
      for (const s of samples) expect(Math.abs(s.right - openRight)).toBeLessThan(2);
      // In the body push, the shown part is the space the page gave.
      if (key === 'body-right' && mode === 'push') {
        for (const s of moving) expect(Math.abs(s.shown - s.pushed)).toBeLessThan(20);
      }
    });
  }

  test('each phase plays its own preset: fade in, scale out', async ({ page }) => {
    await gotoPage(page, 'playground');
    await page.locator('[data-edit="body-right"]').click();
    await page.locator('[data-field="animation"]').check();
    await page.locator('[data-field="engine"]').selectOption('css');
    await page.locator('[data-field="show-preset"]').selectOption('fade');
    await page.locator('[data-field="hide-preset"]').selectOption('scale');
    await page.locator('[data-field="hide-scale"]').fill('1.3');
    for (const phase of ['show', 'hide']) {
      await page.locator(`[data-field="${phase}-duration"]`).fill('1500');
    }
    const shell = container(page, 'body-right');
    await page.locator('[data-action="open"]').click();
    await expect(shell).toHaveAttribute('data-split-animation', 'fade');
    await expect(shell).toHaveClass(/split-showing/);
    await expect(shell).not.toHaveClass(/split-animating/);
    await page.locator('[data-action="dismiss-all"]').click();
    await expect(shell).toHaveAttribute('data-split-animation', 'scale');
    expect(await shell.evaluate((el) => el.style.getPropertyValue('--split-scale'))).toBe('1.3');
    // Growing toward 1.3: the panel gets wider than its 360px.
    await expect.poll(async () => (await shell.boundingBox())?.width ?? 0).toBeGreaterThan(370);
    await expect(page.locator('.split-body-host--right')).toBeHidden();
  });

  for (const engine of ['css', 'keyframes']) {
    test(`push with fade (${engine}): the page resizes at once on show and after the fade on hide`, async ({
      page,
    }) => {
      await gotoPage(page, 'playground');
      await page.locator('[data-edit="body-right"]').click();
      await page.locator('[data-field="mode"]').selectOption('push');
      await page.locator('[data-field="size"]').fill('300px');
      await page.locator('[data-field="animation"]').check();
      await page.locator('[data-field="engine"]').selectOption(engine);
      for (const phase of ['show', 'hide']) {
        await page.locator(`[data-field="${phase}-preset"]`).selectOption('fade');
        await page.locator(`[data-field="${phase}-duration"]`).fill('600');
      }
      // Samples the padding of the page and the panel visibility on every frame.
      const base = await page.evaluate(() => {
        const w = window as unknown as { samples: { padding: number; open: boolean }[] };
        w.samples = [];
        const tick = () => {
          const host = document.querySelector<HTMLElement>('.split-body-host--right');
          w.samples.push({
            padding: parseFloat(getComputedStyle(document.body).paddingRight),
            open: !!host && host.checkVisibility(),
          });
          requestAnimationFrame(tick);
        };
        tick();
        return w.samples[0].padding;
      });
      const shell = container(page, 'body-right');

      await page.locator('[data-action="open"]').click();
      await expect(tabLabels(page, 'body-right')).toHaveText(['Nova aba']);
      await expect(shell).not.toHaveClass(/split-animating/);
      await page.locator('[data-action="dismiss-all"]').click();
      await expect(page.locator('.split-body-host--right')).toBeHidden();

      const samples = await page.evaluate(
        () => (window as unknown as { samples: { padding: number; open: boolean }[] }).samples,
      );
      // No size in between: while the panel is on screen (fading in or out), the page has
      // its final size; before and after, the original one.
      expect(new Set(samples.map((s) => s.padding))).toEqual(new Set([base, base + 300]));
      expect(samples.filter((s) => s.open).every((s) => s.padding === base + 300)).toBe(true);
      expect(samples.some((s) => s.open)).toBe(true);
      expect(samples.at(-1)).toEqual({ padding: base, open: false });
    });
  }
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
    await expect(log).toContainText('manager.containerStateChanged eventos-b open=true');
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
  const code = (page: Page) => page.locator('demo-example[data-example="playground"] pre code');

  test('each container option changes the selected container and the generated code', async ({
    page,
  }) => {
    await gotoPage(page, 'playground');
    await expect(page.locator('[data-field="editing"]')).toHaveText('esquerdo');
    await page.locator('[data-field="label"]').fill('Meu painel');
    await expect(code(page)).toContainText("label: 'Meu painel'");
    await page.locator('[data-field="maxTabs"]').fill('2');
    await expect(code(page)).toContainText('maxTabs: 2');
    await page.locator('[data-field="onFull"]').selectOption('replace-oldest');
    await expect(code(page)).toContainText("onFull: 'replace-oldest'");
    await page.locator('[data-field="onReject"]').selectOption('cancel');
    await expect(code(page)).toContainText("onReject: 'cancel'");
    await page.locator('[data-field="closeWhenEmpty"]').check();
    await expect(code(page)).toContainText('closeWhenEmpty: true');
    await page.locator('[data-field="size"]').fill('240px');
    await expect(code(page)).toContainText("size: '240px'");
    await page.locator('[data-field="animation"]').check();
    await expect(code(page)).toContainText('animation: true');
    await page.locator('[data-field="engine"]').selectOption('keyframes');
    // Equal in both phases: at the top of animation.
    for (const phase of ['show', 'hide']) {
      await page.locator(`[data-field="${phase}-duration"]`).fill('150');
    }
    await expect(code(page)).toContainText("engine: 'keyframes'");
    await expect(code(page)).toContainText(
      "animation: {\n    engine: 'keyframes',\n    duration: 150,\n  },",
    );
    // Different per phase: fade in, slide out toward the bottom by 40px, scale presets.
    await page.locator('[data-field="show-preset"]').selectOption('fade');
    await page.locator('[data-field="hide-preset"]').selectOption('slide');
    await page.locator('[data-field="hide-origin"]').selectOption('bottom');
    await page.locator('[data-field="hide-distance"]').fill('40');
    await page.locator('[data-field="show-easing"]').selectOption('spring-bouncy');
    await page.locator('[data-field="hide-easing"]').selectOption('cubic');
    await page.locator('[data-field="hide-cubic"]').fill('0.3, 0, 0.2, 1');
    await expect(code(page)).toContainText(
      [
        '    show: {',
        "      preset: 'fade',",
        '      easing: spring({ stiffness: 200, damping: 12 }),',
        '    },',
        '    hide: {',
        "      preset: 'slide',",
        '      easing: cubicBezier([0.3, 0, 0.2, 1]),',
        "      origin: 'bottom',",
        '      distance: 40,',
        '    },',
      ].join('\n'),
    );
    await expect(code(page)).toContainText(
      "import { cubicBezier, spring } from '@split-window/angular';",
    );
    await page.locator('[data-field="hide-cubic"]').fill('2, 0, 0, 1');
    await expect(page.locator('[data-field="error"]')).toContainText('animation.hide.easing');
    await page.locator('[data-field="hide-cubic"]').fill('0.3, 0, 0.2, 1');
    await page.locator('[data-field="show-preset"]').selectOption('scale');
    await page.locator('[data-field="show-scale"]').fill('1.2');
    await page.locator('[data-field="show-origin"]').selectOption('left');
    await expect(code(page)).toContainText("preset: 'scale',");
    await expect(code(page)).toContainText('scale: 1.2,');
    await expect(page.locator('[data-field="error"]')).toHaveCount(0);
    await page.locator('[data-field="panelClass"]').fill('demo-drawer');
    await expect(code(page)).toContainText("panelClass: 'demo-drawer'");
    await page.locator('[data-field="expandMaxWidth"]').fill('60vw');
    await expect(code(page)).toContainText("maxWidth: '60vw'");
    await page.locator('[data-field="expandMargin"]').fill('12');
    await expect(code(page)).toContainText('margin: 12');
    await page.locator('[data-field="expandAlign"]').selectOption('end');
    await expect(code(page)).toContainText("align: 'end'");
    await page.locator('[data-field="dropZoneWidth"]').fill('300');
    await expect(code(page)).toContainText('width: 300');
    await page.locator('[data-field="expand"]').uncheck();
    await expect(code(page)).toContainText('expand: false');

    await page.locator('[data-field="target"]').selectOption('esquerdo');
    await page.locator('[data-field="title"]').fill('Pedido');
    await page.locator('[data-field="groupKey"]').fill('vendas');
    await page.locator('[data-field="text"]').fill('Olá');
    await page.locator('[data-field="activate"]').uncheck();
    await page.locator('[data-field="closable"]').uncheck();
    await page.locator('[data-field="confirmClose"]').check();
    await page.locator('[data-field="lockToContainer"]').check();
    for (const text of [
      "containerKey: 'esquerdo'",
      "title: 'Pedido'",
      "groupKey: 'vendas'",
      "text: 'Olá'",
      'activate: false',
      'closable: false',
      'canClose',
      'canMove',
    ]) {
      await expect(code(page)).toContainText(text);
    }

    await page.locator('[data-action="open-3"]').click();
    // maxTabs 2 + replace-oldest: the oldest inactive tab is replaced
    await expect(tabLabels(page, 'esquerdo')).toHaveCount(2);
    await expect(container(page, 'esquerdo').locator('.split-tab__close')).toHaveCount(0);
    await expect(container(page, 'esquerdo').locator('.split-expand-button')).toHaveCount(0);
    await expect(container(page, 'esquerdo')).toHaveClass(/demo-drawer/);
  });

  test('containers of the page and of the body can be enabled, edited and set as default', async ({
    page,
  }) => {
    await gotoPage(page, 'playground');
    await expect(page.locator('[data-field="effective-default"]')).toHaveText('body-right');

    await page.locator('[data-enable="body-left"]').check();
    await page.locator('[data-edit="body-left"]').click();
    await expect(page.locator('[data-field="editing"]')).toHaveText('body-left');
    await page.locator('[data-field="mode"]').selectOption('push');
    await page.locator('[data-field="size"]').fill('300px');
    await expect(code(page)).toContainText("mode: 'push'");
    await page.locator('[data-default="body-left"]').check();
    await expect(page.locator('[data-field="effective-default"]')).toHaveText('body-left');
    await expect(code(page)).toContainText("registry.setDefaultContainer('body-left')");
    await page.locator('[data-action="open"]').click();
    await expect(tabLabels(page, 'body-left')).toHaveText(['Nova aba']);
    await expect(page.locator('.split-body-host--left')).toBeVisible();

    await page.locator('[data-enable="direito"]').check();
    await expect(code(page)).toContainText("registry.registerContainer('direito', hostDireito");
    await page.locator('[data-field="target"]').selectOption('direito');
    await page.locator('[data-field="title"]').fill('No push');
    await page.locator('[data-action="open"]').click();
    await expect(tabLabels(page, 'direito')).toHaveText(['No push']);

    // Disabling the default goes back to the automatic default.
    await page.locator('[data-enable="body-left"]').uncheck();
    await expect(page.locator('[data-field="effective-default"]')).toHaveText('body-right');
    await expect(page.locator('.split-body-host--left')).toHaveCount(0);
  });

  test('errors are shown on the page', async ({ page }) => {
    await gotoPage(page, 'playground');
    await page.locator('[data-field="maxTabs"]').fill('1');
    await page.locator('[data-field="target"]').selectOption('esquerdo');
    await page.locator('[data-action="open-3"]').click();
    await expect(page.locator('[data-field="error"]')).toContainText('SplitContainerFullError');
  });

  test('reset restores the defaults', async ({ page }) => {
    await gotoPage(page, 'playground');
    await page.locator('[data-field="maxTabs"]').fill('2');
    await page.locator('[data-enable="body-top"]').check();
    await page.locator('[data-action="reset"]').click();
    await expect(code(page)).toContainText(
      "registry.registerContainer('esquerdo', hostEsquerdo, {\n  label: 'Esquerdo',\n  side: 'left',\n});",
    );
    await expect(code(page)).not.toContainText('maxTabs');
    await expect(code(page)).not.toContainText('top');
  });
});
