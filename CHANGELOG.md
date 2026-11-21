# Changelog

Os pacotes `@split-window/core` e `@split-window/angular` saem juntos, com a mesma versão (semver em lockstep).

## 0.1.0 — não publicada

Primeira versão, implementando a Parte 1 do plano (`split-window-plano.md`).

### @split-window/core

- `SplitContainerRegistry`: containers registrados, containers do body (`useBodyContainers`), container padrão, estado aberto/fechado/expandido e `containerStateChanged`.
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
