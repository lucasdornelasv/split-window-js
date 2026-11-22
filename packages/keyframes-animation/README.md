# @split-window/keyframes-animation

Motor de animação do SplitWindow com a Web Animations API (`element.animate`).

```ts
import { KeyframesSplitAnimationEngine } from '@split-window/keyframes-animation';

provideSplitWindows({ animationEngines: { keyframes: new KeyframesSplitAnimationEngine() } });

// presets próprios, escolhidos por nome como os prontos (addPreset devolve o motor)
new KeyframesSplitAnimationEngine()
  .addPreset('pop', {
    show: [{ opacity: 0, transform: 'scale(.95)' }, { opacity: 1, transform: 'none' }],
  })
  .addPreset('sumir', { hide: (ctx) => [{ opacity: 1 }, { opacity: 0 }] });
// ou: new KeyframesSplitAnimationEngine({ presets: { pop: { ... } } })

{ animation: { engine: 'keyframes', show: 'pop', hide: 'sumir', duration: 250 } }
```

- Num preset, `show`/`hide` animam o shell (sem um deles, o outro toca ao contrário); `host`, `push` e `backdrop` animam o tamanho do host, o padding do push e o backdrop. Arrays nesses três tocam ao contrário no `hide`. `sizes: true` anima o host e o padding pelos frames, como `slide`. Os nomes dos presets prontos são reservados.
- Presets prontos, montados pelas opções da fase: `slide` (`origin`, `distance`), `scale` (`scale`, `origin`), `fade`, `collapse` (cortina: o painel fica parado e é revelado a partir da borda, com `clipPath` no shell ou `transform` no push custom, no ritmo do host ou do padding da página). Com `fade`, `scale` e os presets próprios sem `sizes`, os tamanhos do layout (host em `push`, padding da página) mudam no início da abertura e no fim do fechamento (`animatesSizes(ctx)`, sobrescrevível).
- Duração, easing e delay vêm das opções da fase (padrão 200 ms). Sem `easing`, a abertura desacelera e o fechamento acelera (`defaultEasing(phase)`). Easings (`cubicBezier([...])`, `spring()`...) viram easings CSS em `translateEasing(easing, ctx)`, que você sobrescreve para tipos próprios.
- Estenda a classe e sobrescreva `keyframes`, `shellKeyframes`, `timing`, `translateEasing` ou `animatesSizes`.

Passa por todos os cenários do contrato dos motores (`splitAnimationEngineScenarios`, em `@split-window/core/testing`), os mesmos do outro motor pronto.

Veja o guia [Modos e animação](../../docs/guides/modos-e-animacao.md).
