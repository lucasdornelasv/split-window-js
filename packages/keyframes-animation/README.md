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
- Sem keyframes, usa o preset (`slide` a partir dos frames `from`/`to`, `fade`, `collapse`). Com `fade`, os tamanhos do layout (host em `push`, padding da página) só animam se você passar keyframes `host`/`push`; senão mudam no início da abertura e no fim do fechamento (`animatesSizes(ctx)`, sobrescrevível).
- Duração, easing e delay vêm das opções de animação (padrão 200 ms). Sem `easing`, a abertura desacelera e o fechamento acelera (`defaultEasing(phase)`).
- Estenda a classe e sobrescreva `keyframes`, `shellKeyframes` ou `timing`.

Veja o guia [Modos e animação](../../docs/guides/modos-e-animacao.md).
