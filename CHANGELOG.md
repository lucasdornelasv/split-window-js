# Changelog

Os pacotes `@split-window/core`, `@split-window/css-animation`, `@split-window/keyframes-animation` e `@split-window/angular` saem juntos, com a mesma versão (semver em lockstep).

## 0.4.0 — 2026-11-21

- Container padrão automático: sem um padrão explícito (`setDefaultContainer`, `splitContainerDefault` ou `default` de `useBodyContainers`), o `open()` sem `containerKey` usa o primeiro container configurado. Desregistrar o padrão ou `setDefaultContainer(null)` voltam a esse padrão automático, e `SplitNoDefaultContainerError` só acontece sem nenhum container. `getDefaultContainer()` devolve o padrão em vigor; novo `hasExplicitDefaultContainer()`.
- `provideSplitWindows({ containerDefaults })` pré-configura os containers: `maxTabs`, `onFull`, `onReject`, `closeWhenEmpty`, `closedDropZone` e `expand` (e `backdrop` no body) entram nas opções de cada container ao registrar, abaixo das opções dele, com `containerDefaults.custom`/`.body` por tipo. Valores inválidos lançam `SplitInvalidOptionError` com o prefixo `containerDefaults.`.
- `provideSplitWindows({ labels })` aceita um objeto ou uma factory executada uma vez num contexto de injeção (`labels: () => ({ defaultTitle: inject(Traducoes).novaAba })`). Novo tipo `SplitLabelsInput`.

## 0.3.0 — 2026-11-21

### Mudanças que quebram compatibilidade

- `@split-window/angular` não tem mais a classe `SplitAnimationEngineRegistry` própria: o token é o `SplitAnimationEngineRegistry` do core (reexportado pelo pacote), fornecido por factory (`splitAnimationEngineRegistryFactory`). `inject(SplitAnimationEngineRegistry)` continua funcionando.
- Removida a opção `provideSplitWindows({ animationEngineRegistry })`. Para personalizar o registro, forneça `{ provide: SplitAnimationEngineRegistry, useFactory }` partindo de `splitAnimationEngineRegistryFactory()`.
- `SplitAnimationEngineEntry` (entradas de `animationEngines` e `provideSplitAnimationEngines`) passa a ser o próprio motor ou uma factory executada uma vez num contexto de injeção, no lugar de uma classe. Troque `{ css: SplitCssAnimationEngine }` por `{ css: new SplitCssAnimationEngine() }` ou `{ css: () => new SplitCssAnimationEngine() }`.
- Classes usadas direto em `animation.engine` são criadas num contexto de injeção (`inject()` funciona sem `@Injectable`).

## 0.2.0 — 2026-11-21

- `SplitWindowRef.setInputData(data)`: atualiza os inputs do conteúdo de uma aba aberta. No Angular, chama `setInput` só nos inputs que o componente declara (nome da propriedade ou alias), ignorando chaves desconhecidas e valores `undefined`. Novo membro opcional `setInputs` no contrato `SplitWindowEngine`.
- `SplitWindowRef.attachTo(subscription)`: liga a aba a uma `Subscription` do RxJS nos dois sentidos (`dismiss` ou `hidden` encerram a subscription; encerrar a subscription com a aba aberta faz `dismiss`) e devolve o vínculo, que pode ser desfeito.
- `SplitWindowRef.asRequest()`: a aba como uma requisição. Emite o resultado do `close` e completa, completa sem valor no `dismiss` ou se a abertura foi rejeitada, e cancelar a inscrição antes faz `dismiss` da aba. Emite no `asapScheduler`.

## 0.1.0 — 2026-11-21

Primeira versão, implementando a Parte 1 do plano (`split-window-plano.md`).

### Modos, animação e arquitetura

- Layouts `inline`, `push` e `overlay` para qualquer container, com `side`, `size` e `pushTarget`. Modos globais (`modes`, `provideSplitModes`), locais (objeto com `extends` e ganchos), por classe (`SplitContainerMode` e subclasses, criadas com DI) e por função. Classes custom com `hostClass`, `panelClass` e `backdropClass`; `containerDefaults` global e por tipo.
- Contrato de animação no core (`SplitAnimationEngine`, `SplitAnimationContext`, `SplitAnimationEngineRegistry`, `NoopSplitAnimationEngine`) e `BaseSplitWindowEngine`, que aplica as transições pela engine. Motores registrados por nome (`animationEngines`, `provideSplitAnimationEngines`): sem escolha, vale o primeiro; o noop só sem motores ou com `'none'`, emitindo os eventos de forma síncrona.
- Novos pacotes `@split-window/css-animation` (classes de estado e `transitionend`, presets injetados) e `@split-window/keyframes-animation` (Web Animations).
- Com `closeWhenEmpty`, a última aba fica na tela enquanto o container sai e é destruída no fim; `hidden` espera, `closed`/`dismissed` não.
- O registry passa a guardar só configuração: `expandContainer`, `restoreContainer`, `isContainerOpen`, `isContainerExpanded`, `getExpandedContainer` e `containerStateChanged` ficam no controller e no `SplitWindowManager`. Novo evento `containerTransitions`.
- Angular: `SplitWindowController` injetável, engine e controller substituíveis por subclasses (`provideSplitWindows({ engine, controller })`); `SplitWindowRuntime` removido.
- `SplitAnimationEngineRegistry` injetável (substituível com `provideSplitWindows({ animationEngineRegistry })`): motores podem ser registrados a qualquer momento e são resolvidos a cada transição.
- `AngularSplitEngine` escreve no DOM pelo `Renderer2` (criação, inserção e remoção de elementos, classes, atributos, estilos, `hidden` e o listener de resize da tela cheia). O `SplitStyleStash` recebe um `SplitDomWriter` plugável; o Angular usa `rendererDomWriter`, então os estilos dos modos (`ctx.styles`) também passam pelo renderer.
- Utilitários compartilhados no core (`isPromiseLike`, `SplitStyleStash`, `toClassList`, `maxCssTime`, `transitionTimeMs`, `reflow`).

### @split-window/core

- `SplitContainerRegistry`: configuração dos containers (registrados, do body com `useBodyContainers`, container padrão).
- `SplitWindowController`: abertura com resolução de container e erros explícitos, numeração por grupo + título, políticas de limite (`maxTabs`, `onFull`, `onReject`), `canClose` com `boolean`/`Promise`/`Observable`, `force`, fechar tudo sequencial, movimentação sem destruir (`moveTab`, `canDrop`), restrição de arraste com container expandido e eventos.
- `SplitWindowRef` com `close`, `dismiss`, `activate`, `moveTo`, `setTitle`, `setClosable`, `setCanClose`, `setCanMove` e os eventos de ciclo de vida e de movimentação.
- Contrato `SplitWindowEngine` e engine falsa em `@split-window/core/testing`.
- Funções puras de geometria: retângulo da tela cheia e posição do painel flutuante.
- Validação das opções com `SplitInvalidOptionError`.

### @split-window/angular

- `provideSplitWindows`, `SplitWindowManager`, `SplitContainerRegistry`, `SplitActiveWindow` e a diretiva `splitContainer`.
- `AngularSplitEngine`: componentes e templates anexados ao `ApplicationRef`, change detection desligado nas abas inativas, movimentação com `moveBefore()` e fallback.
- Shell com barra de abas (roles WAI-ARIA, teclado), botões de fechar, tela cheia e fechar tudo; containers do body com `size` e `backdrop`.
- Drag and drop com o Angular CDK: reordenar, mover entre containers, área de conteúdo como zona de soltura e painéis flutuantes para containers fechados.
- Tela cheia com `bounds`, `maxWidth`, `maxHeight`, `margin`, `align`, Esc no shell e camada no body quando um ancestral quebra o `position: fixed`.
- Estilos com variáveis CSS e textos traduzíveis pelo `SplitWindowConfig`.
- Funciona com e sem zone.js, e no servidor (SSR) sem tocar em APIs do navegador.
