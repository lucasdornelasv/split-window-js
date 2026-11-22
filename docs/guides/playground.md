# Playground

O playground monta, numa tela só, qualquer combinação de containers e de opções. Ele tem sete containers de exemplo:

- três da página: `esquerdo`, `direito` e `inferior`, em hosts ao lado e abaixo de um "conteúdo da página", para ver `push` e `overlay` em ação;
- os quatro do body: `body-left`, `body-right`, `body-top` e `body-bottom`.

Cada container pode ser ativado ou desativado, escolhido como padrão e editado individualmente. As mudanças valem na hora:

- os containers do body são reconfigurados com `useBodyContainers()`, e as abas abertas neles continuam;
- um container da página é registrado de novo, e as abas dele recebem `dismiss('container-removed')`;
- o padrão é aplicado com `setDefaultContainer()`. "Automático" volta ao padrão automático, o primeiro container configurado, e a tela mostra o padrão em vigor.

As opções de abertura valem para o próximo `open()`. A tela mostra o código equivalente, pronto para copiar, com só as opções diferentes do padrão da biblioteca. Os erros (`SplitInvalidOptionError`, `SplitContainerFullError`...) aparecem na própria página.

As opções globais do `provideSplitWindows()` (`labels`, `bodySize`, `containerDefaults`, `animationEngines`, `modes`...) só valem na inicialização. Por isso o código mostra a configuração do app de demonstração, que registra os motores `css` e `keyframes` (os dois com o preset próprio `pop`, de [pop-preset.ts](../../apps/demo-angular/src/app/shared/pop-preset.ts)) e o modo `drawer` usados nos campos.

## Exemplo

Com os valores iniciais (`esquerdo` e `body-right` ativos), o código gerado é:

```ts
// app.config.ts of the demo (global options are set at startup)
provideSplitWindows({
  bodyContainers: true,
  animationEngines: {
    css: new CssSplitAnimationEngine().addPreset('pop', POP_CSS_PRESET),
    keyframes: new KeyframesSplitAnimationEngine().addPreset('pop', POP_KEYFRAMES_PRESET),
  },
  modes: {
    drawer: {
      extends: 'overlay',
      size: '300px',
      panelClass: 'demo-drawer',
      animation: { preset: 'slide', duration: 260 },
    },
  },
});

// body containers (sides not given are disabled)
registry.useBodyContainers({
  right: true,
});

// containers of the page
registry.registerContainer('esquerdo', hostEsquerdo, {
  label: 'Esquerdo',
  side: 'left',
});

// no explicit default: the first configured container is the default

const ref = manager.open(NoteTabComponent);
```

Ativando `body-left` em `push` e como padrão, e abrindo com título e confirmação, a parte do body e da abertura muda para:

```ts
registry.useBodyContainers({
  left: {
    mode: 'push',
    size: '300px',
  },
  right: true,
});

// ...

registry.setDefaultContainer('body-left');

const ref = manager.open(NoteTabComponent, {
  title: 'Pedido',
  canClose: () => confirm('Fechar esta aba?'),
});
```

Ligando a animação do `body-right` com o motor `css`, 300 ms nas duas fases, abertura com `fade` e `spring()`, e fechamento com `slide` descendo 40px, o código do body fica assim (com o import dos easings no topo):

```ts
import { spring } from '@split-window/angular';

// ...

registry.useBodyContainers({
  right: {
    animation: {
      engine: 'css',
      duration: 300,
      show: {
        preset: 'fade',
        easing: spring(),
      },
      hide: {
        preset: 'slide',
        origin: 'bottom',
        distance: 40,
      },
    },
  },
});
```

## Campos

| Grupo      | Campo                                                      | Opção                                                               |
| ---------- | ---------------------------------------------------------- | ------------------------------------------------------------------- |
| Containers | Ativo                                                      | `useBodyContainers({ <lado>: ... })` ou `registerContainer(key, …)` |
| Containers | Padrão                                                     | `setDefaultContainer(key)`, ou automático                           |
| Opções     | label                                                      | `label`                                                             |
| Opções     | mode                                                       | `inline` (só página), `push`, `overlay`, `drawer` (modo global)     |
| Opções     | side                                                       | `side` (só página; no body vem da chave)                            |
| Opções     | size                                                       | `size`                                                              |
| Opções     | maxTabs, onFull, onReject                                  | `maxTabs`, `onFull`, `onReject` (estratégias pré-definidas)         |
| Opções     | closeWhenEmpty                                             | `closeWhenEmpty` (padrão `true` no body, `false` na página)         |
| Opções     | animation, animation.engine                                | `animation: true` ou `{ engine, ... }`                              |
| Opções     | animation.show / animation.hide: preset, duration, delay   | `show`/`hide` (iguais nas duas fases: no topo de `animation`)       |
| Opções     | easing (por fase)                                          | `SPLIT_EASINGS.*`, `spring()`, `cubicBezier([...])`                 |
| Opções     | origin, distance (slide), scale (scale)                    | `origin`, `distance`, `scale`                                       |
| Opções     | panelClass                                                 | `panelClass` (ex.: `demo-drawer`)                                   |
| Opções     | backdrop                                                   | `backdrop` (só body)                                                |
| Opções     | expand, expand.maxWidth, expand.margin, expand.align       | `expand: false` ou `{ maxWidth, margin, align }`                    |
| Opções     | closedDropZone.width / height                              | `closedDropZone`                                                    |
| Abertura   | containerKey                                               | `containerKey` (vazio: o padrão)                                    |
| Abertura   | title, groupKey                                            | `title`, `groupKey`                                                 |
| Abertura   | inputs.text                                                | `inputs: { text }` do `NoteTabComponent`                            |
| Abertura   | activate, closable                                         | `activate`, `closable`                                              |
| Abertura   | canClose com confirm() / canMove só no container de origem | `canClose`, `canMove`                                               |
| Ações      | open(), Abrir 3, dismissAll(), Restaurar padrões           | `manager.open()`, `manager.dismissAll()`                            |

## Regras

- O estado e as funções que geram as opções e o código ficam em [playground.model.ts](../../apps/demo-angular/src/app/pages/playground.model.ts): `containerOptions(key, config)`, `bodyConfig(state)`, `openOptions(state)` e `playgroundCode(state)`.
- `mode: 'inline'` fica desabilitado nos containers do body, que não aceitam esse layout.
- Desativar o container padrão faz o padrão voltar ao automático.
- O campo `preset` traz os prontos e o `pop`, preset próprio registrado com `addPreset` nos dois motores do app.
- Cada fase tem o seu bloco (`animation.show` e `animation.hide`). `origin` e `distance` aparecem para `slide` (e para o preset do layout); `scale` e `origin`, para `scale`. Pontos inválidos em `cubicBezier([...])` mostram o `SplitInvalidOptionError` de `animation.<fase>.easing`.
- `expand.maxWidth` aceita só dígitos (vira número em px) ou texto em `px`, `vw`, `vh` ou `%`. Outro valor mostra o `SplitInvalidOptionError`, e o container fica sem registro até a correção.
- Com `maxTabs` e `onReject: 'throw'`, abrir além do limite mostra o `SplitContainerFullError`. Com `'cancel'`, a tela avisa que a aba foi cancelada (`ref.rejected`).
- As funções `onFull`/`onReject` customizadas não estão no playground; veja o guia [Limite de abas](limite-de-abas.md).
- Sair da tela desregistra os containers da página e volta os do body à configuração do app (`body-right` como padrão).

## Links

- Tela de demonstração: [`#/playground`](http://localhost:4200/#/playground)
- Fonte: [playground.page.ts](../../apps/demo-angular/src/app/pages/playground.page.ts) e [playground.model.ts](../../apps/demo-angular/src/app/pages/playground.model.ts)
