# @split-window/keyframes-animation

Motor de animação do SplitWindow com a Web Animations API (`element.animate`).

```ts
import { SplitKeyframesAnimationEngine } from '@split-window/keyframes-animation';

provideSplitWindows({ animationEngines: { keyframes: new SplitKeyframesAnimationEngine() } });

// keyframes próprios numa instância
{ animation: { duration: 250, engine: new SplitKeyframesAnimationEngine({
  show: [{ opacity: 0, transform: 'scale(.95)' }, { opacity: 1, transform: 'none' }],
  hide: (ctx) => [{ opacity: 1 }, { opacity: 0 }],
}) } }
```

- `show`/`hide` animam o shell; `host`, `push` e `backdrop` animam o tamanho do host, o padding do push e o backdrop. Arrays nesses três tocam ao contrário no `hide`.
- Sem keyframes, usa o preset da fase: `slide` (`origin`, `distance`), `scale` (`scale`, `origin`), `fade`, `collapse` (cortina: o painel fica parado e é revelado a partir da borda, com `clipPath` no shell ou `transform` no push custom, no ritmo do host ou do padding da página). Com `fade` e `scale`, os tamanhos do layout (host em `push`, padding da página) só animam se você passar keyframes `host`/`push`; senão mudam no início da abertura e no fim do fechamento (`animatesSizes(ctx)`, sobrescrevível).
- Duração, easing e delay vêm das opções da fase (padrão 200 ms). Sem `easing`, a abertura desacelera e o fechamento acelera (`defaultEasing(phase)`). Easings (`cubicBezier([...])`, `spring()`...) viram easings CSS em `translateEasing(easing, ctx)`, que você sobrescreve para tipos próprios.
- Estenda a classe e sobrescreva `keyframes`, `shellKeyframes`, `timing`, `translateEasing` ou `animatesSizes`.

Veja o guia [Modos e animação](../../docs/guides/modos-e-animacao.md).
