# @split-window/keyframes-animation

Motor de animação do SplitWindow com a Web Animations API (`element.animate`).

```ts
import { SplitKeyframesAnimationEngine } from '@split-window/keyframes-animation';

provideSplitWindows({ animationEngines: { keyframes: SplitKeyframesAnimationEngine } });

// keyframes próprios numa instância
{ animation: { duration: 250, engine: new SplitKeyframesAnimationEngine({
  show: [{ opacity: 0, transform: 'scale(.95)' }, { opacity: 1, transform: 'none' }],
  hide: (ctx) => [{ opacity: 1 }, { opacity: 0 }],
}) } }
```

- `show`/`hide` animam o shell; `host`, `push` e `backdrop` animam o tamanho do host, o padding do push e o backdrop. Arrays nesses três tocam ao contrário no `hide`.
- Sem keyframes, usa o preset (`slide` a partir dos frames `from`/`to`, `fade`, `collapse`).
- Duração, easing e delay vêm das opções de animação (padrão 200 ms).
- Estenda a classe e sobrescreva `keyframes`, `shellKeyframes` ou `timing`.

Veja o guia [Modos e animação](../../docs/guides/modos-e-animacao.md).
