# @split-window/css-animation

Motor de animação CSS do SplitWindow, no estilo do `ngbRunTransition` do ng-bootstrap: alterna classes de estado (`split-enter-from`, `split-showing`, `split-show`, `split-hiding`) no shell e no backdrop e espera o `transitionend`/`animationend`. Sem duração, a transição termina na hora.

```ts
import { SplitCssAnimationEngine } from '@split-window/css-animation';

provideSplitWindows({ animationEngines: { css: new SplitCssAnimationEngine() } });
// ou, numa instância: new SplitCssAnimationEngine({ classes: { show: 'aberto' }, injectStyles: false })
```

- Presets `slide`, `fade` e `collapse`, injetados uma vez por documento como a primeira folha de estilo do `<head>`.
- Variáveis: `--split-animation-duration`, `--split-animation-easing`, `--split-animation-delay`; durante a transição, `--split-slide` e `--split-from-*`/`--split-to-*` no shell.
- Tamanho do host (`push` custom) e padding do `pushTarget` (`push` no body) animados com transições inline entre os frames.
- Estenda a classe e sobrescreva `classesFor`, `prepare`, `flipTargets`, `waitFor`, `finish`, `duration` ou `easing`.

Veja o guia [Modos e animação](../../docs/guides/modos-e-animacao.md).
