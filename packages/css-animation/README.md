# @split-window/css-animation

Motor de animação CSS do SplitWindow, no estilo do `ngbRunTransition` do ng-bootstrap: alterna classes de estado (`split-enter-from`, `split-showing`, `split-show`, `split-hiding`) no shell e no backdrop e espera o `transitionend`/`animationend`. Sem duração, a transição termina na hora.

```ts
import { SplitCssAnimationEngine } from '@split-window/css-animation';

provideSplitWindows({ animationEngines: { css: new SplitCssAnimationEngine() } });
// ou, numa instância: new SplitCssAnimationEngine({ classes: { show: 'aberto' }, injectStyles: false })
```

- Presets `slide`, `fade`, `scale` e `collapse`, injetados uma vez por documento como a primeira folha de estilo do `<head>`. Cada fase usa o seu preset (`animation.show`/`animation.hide`), marcado no shell como `data-split-animation`.
- `slide` usa `origin` e `distance` (`--split-slide`); `scale` usa `scale` e `origin` (`--split-scale`, `--split-transform-origin`).
- `collapse` é uma cortina: o painel fica parado no lugar final e é revelado a partir da borda do lado do conteúdo, com uma transição inline no shell (`clip-path`, ou `transform` no push custom, em que o host corta o painel), no mesmo ritmo do tamanho do host ou do padding da página (`collapseReveal`).
- Com `fade` e `scale`, os tamanhos do layout (host em `push`, padding da página) não são animados: mudam no início da abertura e no fim do fechamento (`animatesSizes(ctx)`, sobrescrevível).
- Easings (`cubicBezier([...])`, `spring()`, `SPLIT_EASINGS.*`...) são traduzidos para CSS por `translateEasing(easing, ctx)`, que você sobrescreve para tipos próprios.
- Variáveis: `--split-animation-duration`, `--split-animation-easing` (abertura, desacelera), `--split-animation-easing-hide` (fechamento, acelera), `--split-animation-delay`; a opção `easing` da fase define as duas curvas; durante a transição, também `--split-from-*`/`--split-to-*` no shell.
- Tamanho do host (`push` custom) e padding do `pushTarget` (`push` no body) animados com transições inline entre os frames.
- Estenda a classe e sobrescreva `classesFor`, `prepare`, `flipTargets`, `waitFor`, `finish`, `duration`, `easing`, `translateEasing` ou `animatesSizes`.

Veja o guia [Modos e animação](../../docs/guides/modos-e-animacao.md).
