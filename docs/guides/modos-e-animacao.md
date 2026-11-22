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
class CompactPushMode extends SplitPushMode {
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
import { SplitCssAnimationEngine } from '@split-window/css-animation';
import { SplitKeyframesAnimationEngine } from '@split-window/keyframes-animation';

provideSplitWindows({
  animationEngines: {
    css: new SplitCssAnimationEngine(),
    keyframes: () => new SplitKeyframesAnimationEngine(),
  },
  containerDefaults: { animation: true }, // global: anima todos com o primeiro motor (css)
});

{ animation: true }                                // primeiro motor registrado
{ animation: { engine: 'keyframes', preset: 'fade', duration: 250 } } // por nome
{ animation: { engine: 'none' } }                  // noop
{ animation: new SplitKeyframesAnimationEngine({ show: [...], hide: [...] }) } // instância
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
- `preset`: `slide` (padrão de overlay e do push no body), `collapse` (padrão do push custom: só o tamanho do host), `fade` (padrão do inline) ou `none`. Só `slide` e `collapse` animam os tamanhos do layout (o host custom em `push` e o padding da página no push do body). Com `fade`, só a opacidade do painel muda: ao abrir, a página já encolhe no início, e ao fechar ela só volta ao tamanho normal depois do fim do fade. Keyframes `host`/`push` passados ao `SplitKeyframesAnimationEngine` tocam com qualquer preset.
- `duration`, `easing` e `delay` valem para todos os motores. O motor CSS também lê `--split-animation-duration`, `--split-animation-easing`, `--split-animation-easing-hide` e `--split-animation-delay`.
- Sem `easing`, a abertura desacelera (`SPLIT_DEFAULT_EASING`, `cubic-bezier(0.2, 0, 0, 1)`) e o fechamento acelera (`SPLIT_DEFAULT_HIDE_EASING`, `cubic-bezier(0.4, 0, 1, 1)`). Assim o painel só some de vez no fim da duração, junto com o que vem depois (a página voltando ao tamanho no `push`). Com `easing`, a mesma curva vale para os dois.
- Com `prefers-reduced-motion: reduce`, o motor é trocado pelo noop (desligue com `respectReducedMotion: false`).
- O padrão é sem animação; `animation: true` (no container ou em `containerDefaults`) liga.

### Motor CSS (`@split-window/css-animation`)

No estilo do `ngbRunTransition`: adiciona `split-enter-from` → `split-showing` → `split-show` ao abrir e `split-hiding` ao fechar, no shell e no backdrop, e espera o `transitionend`/`animationend` (com timeout pela duração computada). Sem duração, termina na hora. Os presets são injetados uma vez no `<head>`, como a primeira folha de estilo, para que o CSS da app vença. Para um visual próprio, use `panelClass` e escreva regras para as classes de estado, ou estenda a classe (`classesFor`, `prepare`, `flipTargets`, `waitFor`, `finish`, `duration`).

### Motor de keyframes (`@split-window/keyframes-animation`)

Usa a Web Animations API. Os keyframes vêm do construtor (`show`, `hide`, `host`, `push`, `backdrop`; arrays ou funções que recebem o contexto) ou do preset. Estenda e sobrescreva `keyframes`, `shellKeyframes` ou `timing`.

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
