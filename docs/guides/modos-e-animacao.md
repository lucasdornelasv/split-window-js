# Modos e animação

Todo container tem um **layout**, que diz como ele ocupa espaço:

| Layout    | Containers custom (diretiva / `registerContainer`)                                                                                                             | Containers do body                                                                                                  |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `inline`  | **Padrão.** O painel preenche o host, como sempre foi.                                                                                                         | Inválido (`SplitInvalidOptionError`).                                                                               |
| `push`    | O host ocupa espaço no fluxo e fica com tamanho 0 enquanto o container está fechado. Ao abrir, cresce até `size` (ou o tamanho natural) e empurra os vizinhos. | Soma `size` ao padding do `pushTarget` (padrão: `document.body`) e define `--split-body-offset-<lado>` no `<html>`. |
| `overlay` | O host vira uma âncora sem tamanho, e o painel flutua sobre o conteúdo encostado na borda `side` do host.                                                      | **Padrão.** Painel `fixed` na borda da janela.                                                                      |

`side` (`left`, `right`, `top`, `bottom`) é a borda em que o painel encosta. No body ele vem da chave (`body-right`…); nos containers custom o padrão é `'right'`. `size` é a largura (left/right) ou a altura (top/bottom).

Um **modo** junta o layout com classes, animação e ganchos. Ele pode ser informado de cinco formas:

```ts
// 1. layout pronto
{ mode: 'push', side: 'left', size: '320px' }

// 2. global, registrado por nome
provideSplitWindows({
  modes: { drawer: { extends: 'overlay', size: '300px', panelClass: 'drawer', animation: 'slide' } },
});
{ mode: 'drawer' }

// 3. objeto local, inclusive sobre outro modo
{ mode: { extends: 'drawer', side: 'left', hostClass: 'menu', onShown: (ctx) => {} } }

// 4. classe que estende um modo pronto (criada com DI, pode usar inject())
class CompactPushMode extends PushSplitContainerMode {
  override settings() { return { size: '240px', panelClass: 'compact' }; }
}
{ mode: CompactPushMode }

// 5. função, resolvida ao montar ou reconfigurar o container
{ mode: (ctx) => (ctx.kind === 'body' ? 'push' : 'overlay') }
```

Precedência: `containerDefaults` (e `containerDefaults.custom`/`.body`) < modo < opções do container. O `containerDefaults` também aceita opções de comportamento (`maxTabs`, `onFull`, `onReject`, `closeWhenEmpty`, `closedDropZone`, `expand` e, no body, `backdrop`), que pré-configuram cada container ao ser registrado. Classes (`hostClass`, `panelClass`, `backdropClass`) se somam; os demais valores são substituídos.

## Animação

A animação passa pela engine (`BaseSplitWindowEngine`, no core). Cada transição de abrir/fechar recebe um **motor de animação**, que ganha os elementos, os frames de início e fim (`from`/`to`: retângulo do shell, tamanho do host, valor do push) e avisa a lib com `started()`, `progress()` e o fim da `Promise`.

Os motores ficam em pacotes próprios e são registrados por nome:

```ts
import { CssSplitAnimationEngine } from '@split-window/css-animation';
import { KeyframesSplitAnimationEngine } from '@split-window/keyframes-animation';

provideSplitWindows({
  animationEngines: {
    css: new CssSplitAnimationEngine(),
    keyframes: () => new KeyframesSplitAnimationEngine(),
  },
  containerDefaults: { animation: true }, // global: anima todos com o primeiro motor (css)
});

{ animation: true }                                // primeiro motor registrado
{ animation: { engine: 'keyframes', preset: 'fade', duration: 250 } } // por nome
{ animation: { engine: 'none' } }                  // noop
{ animation: new KeyframesSplitAnimationEngine() } // instância
{ animation: MinhaEngine }                         // classe (criada num contexto de injeção)
{ animation: (ctx) => ctx.elements.shell.animate(...).finished } // função
```

- Cada entrada de `animationEngines` (e de `provideSplitAnimationEngines`) é o próprio motor ou uma factory que o devolve. A factory roda uma vez, num contexto de injeção, quando o registro é criado, então pode usar `inject()`: `pop: () => new PopEngine(inject(POP_CONFIG))`.
- O registro é o `SplitAnimationEngineRegistry` do core, fornecido pela injeção de dependências com a factory `splitAnimationEngineRegistryFactory`. Para registrar depois, em qualquer momento: `inject(SplitAnimationEngineRegistry).register('pop', new PopEngine())`. O motor é resolvido a cada transição, então o registro vale a partir da próxima abertura ou fechamento, inclusive para containers já montados. Para personalizar o registro, forneça o seu provider partindo da factory padrão:

  ```ts
  {
    provide: SplitAnimationEngineRegistry,
    useFactory: () => {
      const registry = splitAnimationEngineRegistryFactory();
      registry.register('pop', new PopEngine());
      return registry;
    },
  }
  ```

- Uma classe usada direto em `animation.engine` (ou em `animation`) é criada num contexto de injeção, então também pode usar `inject()`.
- Sem motor escolhido, vale o **primeiro registrado**. O `NoopSplitAnimationEngine` só é usado quando nenhum motor foi registrado ou quando `'none'` é escolhido. Mesmo sem mover nada, ele passa por `started()` e `progress(1)` de forma síncrona, e os eventos de `containerTransitions` saem do mesmo jeito.
- Com `prefers-reduced-motion: reduce`, o motor é trocado pelo noop (desligue com `respectReducedMotion: false`).
- O padrão é sem animação; `animation: true` (no container ou em `containerDefaults`) liga.

### Abertura e fechamento (`show` e `hide`)

As opções de fase (`preset`, `duration`, `easing`, `delay`, `origin`, `distance`, `scale`) no topo de `animation` valem para as duas fases. `show` (abertura) e `hide` (fechamento) sobrescrevem só a sua fase, com um preset ou um objeto:

```ts
animation: {
  duration: 250,
  show: 'fade', // abre com fade
  hide: { preset: 'slide', origin: 'bottom', distance: 40 }, // sai descendo 40px
}
```

- Na mesma camada, `show`/`hide` vencem as opções do topo. Entre camadas (`containerDefaults` < modo < container), uma opção do topo de uma camada mais alta também substitui a mesma opção de fase de uma camada mais baixa: `animation: 'slide'` no container vence `containerDefaults.animation: { hide: 'fade' }`.
- O motor recebe em `ctx.options` as opções já resolvidas da fase (`ctx.phase`).

### Presets

| Preset     | Efeito                                                                                        | Opções               |
| ---------- | --------------------------------------------------------------------------------------------- | -------------------- |
| `slide`    | entra vindo de `origin` e sai na direção dele                                                 | `origin`, `distance` |
| `scale`    | vai de `scale` ao tamanho natural na abertura e volta no fechamento, ancorado em `origin`     | `scale`, `origin`    |
| `fade`     | só a opacidade                                                                                |                      |
| `collapse` | cortina: o painel fica parado no lugar final e vai aparecendo a partir da borda (veja abaixo) |                      |
| `none`     | nada se mexe naquela fase                                                                     |                      |

- Padrão por layout: `slide` no overlay e no push do body, `collapse` no push custom e `fade` no inline.
- `collapse` é uma cortina: o painel não se move, fica no lugar final e vai aparecendo a partir da borda do lado do conteúdo (num container à direita, da esquerda para a direita do painel, até a borda da janela). No fechamento, o inverso.
  - **overlay** e **inline**: só a revelação (`clip-path` no shell), por cima do conteúdo.
  - **push do body**: o padding da página cresce e a revelação anda no mesmo ritmo (mesma duração, easing e delay), então a parte que aparece é sempre o espaço que a página cedeu.
  - **push custom**: o host cresce de 0 até o `size`, empurra os vizinhos e corta o painel; um `transform` no mesmo ritmo mantém o painel parado no lugar final enquanto o host o revela.
  - A regra fica em `collapseReveal(ctx)` no core, usada pelos dois motores.
- `origin`: no `slide`, o lado de onde o painel vem e para onde vai (padrão: o lado do container; `center` também vale o lado do container). No `scale`, a borda de onde ele cresce e para onde encolhe (padrão: `center`).
- `distance` (`slide`): número em px ou comprimento CSS; porcentagem é do tamanho do painel. Padrão: `'100%'` (sai por inteiro).
- `scale` (`scale`): menor que 1, o painel cresce até o tamanho final; maior que 1, ele encolhe até ele. Padrão: `0.9`.
- Só `slide` e `collapse` animam os tamanhos do layout (o host custom em `push` e o padding da página no push do body). Com `fade` e `scale`, ao abrir a página já encolhe no início, e ao fechar ela só volta ao tamanho normal depois do fim da animação. Cada fase segue o seu preset: abrir com `fade` e fechar com `slide` anima o padding só no fechamento.

### Presets próprios (`addPreset`)

Cada motor aceita presets com nome, escolhidos em `preset`, `show` e `hide` como os prontos, em qualquer camada. `addPreset(nome, preset)` devolve o próprio motor, para encadear, e os mesmos presets também podem ir no construtor (`{ presets: { pop: ... } }`). Os nomes dos prontos são reservados, e um nome que o motor não conhece gera um erro na transição, que termina sem animação.

```ts
provideSplitWindows({
  animationEngines: {
    css: new CssSplitAnimationEngine().addPreset('pop', {
      variables: { '--pop-scale': '0.92' }, // no shell durante a transição (ou (ctx) => ({ ... }))
      styles: `
        [data-split-animation='pop']:is(.split-showing, .split-hiding) {
          transition-property: opacity, transform;
          transition-duration: var(--split-animation-duration);
          transition-timing-function: var(--split-animation-easing);
        }
        [data-split-animation='pop'].split-hiding {
          transition-timing-function: var(--split-animation-easing-hide);
        }
        [data-split-animation='pop']:is(.split-enter-from, .split-hiding) {
          opacity: 0;
          transform: scale(var(--pop-scale));
        }`,
    }),
    keyframes: new KeyframesSplitAnimationEngine().addPreset('pop', {
      show: [{ opacity: 0, transform: 'scale(0.92)' }, { opacity: 1, transform: 'none' }],
      // sem hide: o show tocado ao contrário
    }),
  },
});

{ animation: { preset: 'pop', duration: 300 } }
{ animation: { engine: 'keyframes', show: 'pop', hide: 'slide' } }
```

| Opção     | CSS                                                                       | Keyframes                                                                         |
| --------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| visual    | `styles`: CSS injetado uma vez por documento, no primeiro uso             | `show`/`hide`: keyframes ou função do contexto (um vale pelo outro, ao contrário) |
| variáveis | `variables`: variáveis CSS no shell, fixas ou função do contexto          | (nas funções de keyframes)                                                        |
| backdrop  | `backdrop`: preset do backdrop (padrão `fade`)                            | `backdrop`: keyframes do backdrop (padrão: fade)                                  |
| tamanhos  | `sizes: true`: anima o host em `push` e o padding da página, como `slide` | `sizes: true`, ou keyframes próprios em `host` e `push`                           |

- Sem `sizes`, o preset próprio se comporta como `fade` e `scale` em relação ao layout: o espaço abre de uma vez no início da abertura e volta no fim do fechamento.
- No CSS, o shell recebe `data-split-animation="<nome>"` e as classes de estado (`split-enter-from`, `split-showing`, `split-show`, `split-hiding`), e o motor espera o `transitionend` das regras do preset. Duração, easing e delay das opções chegam pelas variáveis `--split-animation-*`.
- No keyframes, duração, easing e delay das opções valem para os keyframes do preset.

### Easing

O `easing` é uma descrição que cada motor traduz para o que ele toca. Funções prontas, cada uma com as suas configurações:

```ts
import {
  SPLIT_EASINGS,
  cubicBezier,
  customEasing,
  linear,
  spring,
  steps,
} from '@split-window/angular';

{
  easing: cubicBezier([0.2, 0, 0, 1]);
} // CSS: cubic-bezier(0.2, 0, 0, 1)
{
  easing: SPLIT_EASINGS.easeOut;
} // linear, ease, easeIn, easeOut, easeInOut, decelerate, accelerate
{
  easing: spring({ stiffness: 200, damping: 12 });
} // mola com quique; CSS: linear(...) amostrado
{
  easing: steps(4, 'jump-end');
} // CSS: steps(4, jump-end)
{
  easing: linear([0, [0.8, 0.5], 1]);
} // CSS: linear(0, 0.8 50%, 1)
{
  easing: customEasing((t) => t * t);
} // qualquer curva; CSS: linear(...) amostrado
{
  easing: 'ease-in-out';
} // texto CSS, usado como está
```

- `spring()` toca na `duration` configurada: a curva é o movimento da mola até parar, escalado para a duração. Padrões: `stiffness: 170`, `damping: 26` (sem quique), `mass: 1`, `velocity: 0`.
- Os motores CSS e keyframes traduzem com `easingToCss(easing)`. Um motor que calcula os quadros sozinho usa `toEasingFunction(easing)`, que devolve `(progresso) => valor`.
- Um tipo próprio (`{ type: 'elastic', ... }`) é aceito na validação; o motor traduz sobrescrevendo `translateEasing(easing, ctx)` (CSS e keyframes). Sem tradução, a transição relata o erro.
- Sem `easing`, a abertura desacelera (`SPLIT_DEFAULT_EASING` = `SPLIT_EASINGS.decelerate`) e o fechamento acelera (`SPLIT_DEFAULT_HIDE_EASING` = `SPLIT_EASINGS.accelerate`). Assim o painel só some de vez no fim da duração, junto com o que vem depois (a página voltando ao tamanho no `push`).
- `duration`, `easing` e `delay` valem para todos os motores. O motor CSS também lê `--split-animation-duration`, `--split-animation-easing` (abertura), `--split-animation-easing-hide` (fechamento) e `--split-animation-delay`.

### Motor CSS (`@split-window/css-animation`)

No estilo do `ngbRunTransition`: adiciona `split-enter-from` → `split-showing` → `split-show` ao abrir e `split-hiding` ao fechar, no shell e no backdrop, e espera o `transitionend`/`animationend` (com timeout pela duração computada). Sem duração, termina na hora. Os presets são injetados uma vez no `<head>`, como a primeira folha de estilo, para que o CSS da app vença. Cada fase marca o shell com o seu preset (`data-split-animation`) e grava `--split-slide`, `--split-scale` e `--split-transform-origin`. Para um visual próprio, use `panelClass` e escreva regras para as classes de estado, ou estenda a classe (`classesFor`, `prepare`, `flipTargets`, `waitFor`, `finish`, `duration`, `easing`, `translateEasing`, `animatesSizes`).

### Motor de keyframes (`@split-window/keyframes-animation`)

Usa a Web Animations API. Os keyframes vêm do construtor (`show`, `hide`, `host`, `push`, `backdrop`; arrays ou funções que recebem o contexto) ou do preset da fase. Estenda e sobrescreva `keyframes`, `shellKeyframes`, `timing`, `translateEasing` ou `animatesSizes`.

## Fechamento com `closeWhenEmpty`

Com duas abas, fechar uma faz ela sumir na hora. Ao fechar a **última**, o container começa a sair primeiro: a aba continua na tela (a barra fica congelada e o shell recebe `inert`), e só é destruída quando a animação termina. `closed`/`dismissed` são imediatos; `hidden` espera o fim. Se uma aba for aberta durante a saída, a saída é cancelada e a aba fechada é destruída na hora.

## Eventos

```ts
manager.containerTransitions.subscribe(({ key, phase, state, progress }) => ...);
// phase: 'show' | 'hide'; state: 'start' | 'running' | 'done' | 'cancelled'
```

## Engine e controller customizados

Tudo é provider. Para trocar a engine ou o controller por uma subclasse:

```ts
@Injectable()
class MinhaEngine extends AngularSplitEngine {
  protected override enter(container: ContainerState<HTMLElement>) {
    super.enter(container);
    // ...
  }
}

provideSplitWindows({ engine: MinhaEngine, controller: MeuController });
```

## Regras

- `inline` no body lança `SplitInvalidOptionError`, e nomes de modo desconhecidos lançam no registro do container. Nomes de motor não: o motor pode ser registrado depois. Se o nome ainda não existir na hora da transição, o erro vai para o console e a transição usa o noop.
- O host de um container `push`/`overlay` é estilizado (tamanho 0, `flex: 0 0 auto`, `position: relative` se estático) assim que o controller existe. Os estilos são desfeitos ao desregistrar.
- No `push` do body, layouts com filhos em `height: 100vh` não encolhem com o padding: aponte `pushTarget` para o shell da app ou use `var(--split-body-offset-right)` nos elementos `fixed`.
- Tela cheia funciona em qualquer layout: os estilos inline da expansão prevalecem e são removidos ao restaurar.

## Links

- Tela de demonstração: [`#/modos`](http://localhost:4200/#/modos)
- Fonte: [apps/demo-angular/src/app/pages/modes.page.ts](../../apps/demo-angular/src/app/pages/modes.page.ts)
