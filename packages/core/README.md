# @split-window/core

Estado e regras do SplitWindow, sem framework e sem DOM: registry de containers, stacks de abas, numeração, resolução de container, políticas de limite, fechamento, regras de arraste, estado de tela cheia, eventos (RxJS) e erros.

Este pacote é para **autores de adaptadores**. Quem usa Angular instala [`@split-window/angular`](../angular/README.md), que reexporta os tipos do core.

```bash
npm install @split-window/core rxjs
```

Única peer dependency: `rxjs` (^7.8).

## O core decide, a engine executa

| Core (`@split-window/core`)                  | Engine (adaptador)                                         |
| -------------------------------------------- | ---------------------------------------------------------- |
| Registry, stacks, ordem das abas e aba ativa | Criar e destruir o conteúdo da aba                         |
| Numeração por grupo + título                 | Renderizar a barra de abas, os botões e a área de conteúdo |
| Resolução de container e erros               | Attach, detach e mover o conteúdo sem destruir             |
| `maxTabs`, `onFull`, `onReject`              | Drag and drop                                              |
| `canClose`, `force` e fechar tudo sequencial | Zonas de soltura e painel flutuante                        |
| Aberto, fechado e expandido                  | Aplicar a tela cheia na tela                               |
| `canMove` e restrição de container expandido | Traduzir cliques e drops em comandos para o core           |

**A engine nunca decide.** No drop, ela pergunta `canDrop(ref, destino)` e, se permitido, chama `moveTab(...)`; o core então chama `engine.move()` para executar. As regras ficam num lugar só e valem para qualquer adaptador.

## Contrato `SplitWindowEngine`

```ts
import type {
  SplitWindowEngine,
  ContainerState,
  TabState,
  SplitWindowRef,
} from '@split-window/core';

interface SplitWindowEngine<TContent, THost, TAdapterOptions> {
  /* ... */
}
```

- `TContent`: o que o `open()` do adaptador aceita (no Angular, `Type<T> | TemplateRef`).
- `THost`: o host de um container (no Angular, `HTMLElement`). O registry também é genérico em `THost`.
- `TAdapterOptions`: opções que só o adaptador entende (no Angular, `inputs` e `injector`). O core repassa sem ler.

| Método                                         | Quando o core chama                                             | O que a engine faz                                                                                                                                             |
| ---------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mountContainer(container)`                    | Primeira aba aberta ou movida para o container                  | Cria o shell. Em containers do body, `container.host` é `null`: a engine cria o host.                                                                          |
| `unmountContainer(container)`                  | Container desregistrado ou lado do body desabilitado            | Destrói o shell (e o host criado por ela).                                                                                                                     |
| `setContainerOpen(container, open)`            | Container abre (recebe aba) ou fecha (`closeWhenEmpty`)         | Mostra ou oculta o shell, sem desmontar.                                                                                                                       |
| `createTab(content, tab, ref, adapterOptions)` | `open()` aceito pelas políticas                                 | Cria o conteúdo e devolve um `TabHandle` opaco. Pode preencher `ref.componentInstance` com `ref._setComponentInstance()`. Se lançar, o core desfaz a abertura. |
| `attach(handle, container, index)`             | Logo após `createTab`                                           | Coloca a aba no container, **inativa**.                                                                                                                        |
| `move(handle, to, index)`                      | `moveTab` aprovado para outro container                         | Move o conteúdo **sem destruir**.                                                                                                                              |
| `activate(handle)` / `deactivate(handle)`      | Troca de aba ativa                                              | Mostra/liga a aba ou oculta/desliga.                                                                                                                           |
| `destroy(handle)`                              | Aba fechada (depois de `closed`/`dismissed`, antes de `hidden`) | Destrói o conteúdo.                                                                                                                                            |
| `setExpanded(container, expanded)`             | `expandContainer` / `restoreContainer`                          | Aplica ou remove a tela cheia.                                                                                                                                 |
| `cancelDrag()`                                 | A expansão mudou durante um arraste                             | Encerra o arraste e devolve a aba à posição original.                                                                                                          |

`TabState` e `ContainerState` são fotos somente leitura (`id`, `title`, `label`, `ordinal`, `closable`, `containerKey`; `key`, `kind`, `side`, `host`, `options`, `label`, `open`, `expanded`, `mounted`).

## `SplitWindowController`

Um controller por aplicação, ligando um registry a uma engine:

```ts
import { SplitContainerRegistry, SplitWindowController } from '@split-window/core';

const registry = new SplitContainerRegistry<HTMLElement>();
const engine = new MinhaEngine();
const controller = new SplitWindowController(registry, engine, {
  labels: { defaultTitle: 'Nova aba' }, // SplitWindowConfigInput, opcional
});

registry.registerContainer('direito', document.querySelector('#direito')!, { maxTabs: 5 });
registry.setDefaultContainer('direito');

const ref = controller.open(conteudo, { title: 'Contrato' }, /* adapterOptions */ undefined);
ref.result.then(
  (r) => console.log('fechou com', r),
  () => {},
);

await controller.dismissAll({ containerKey: 'direito' });
controller.destroy(); // completa os observables
```

API pública do controller:

| Membro                                                                        | Descrição                                                                                                             |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `open(content, options?, adapterOptions?)`                                    | Resolve o container, aplica `maxTabs`/`onFull`/`onReject` e pede à engine para criar a aba. Devolve `SplitWindowRef`. |
| `dismissAll(options?)`                                                        | Fechar tudo sequencial. Resolve com `{ closed, kept }`.                                                               |
| `requestTabClose(ref)`                                                        | Pedido de fechamento vindo do X da aba (`trigger: 'tab-button'`); passa pelo `canClose`.                              |
| `hasOpenWindows(key?)`, `getTabs(key)`, `isClosingAll(key)`                   | Consultas.                                                                                                            |
| `getContainerView(key)`                                                       | Foto imutável para renderizar (ver abaixo).                                                                           |
| `canDrop`, `moveTab`, `getDropTargets`, `beginDrag`, `endDrag`, `draggingTab` | Arraste (ver abaixo).                                                                                                 |
| `changes`, `tabMoved`, `tabRejected`                                          | Observables.                                                                                                          |
| `config`, `registry`, `engine`                                                | Configuração mesclada e dependências.                                                                                 |

## Redesenhar: `changes` + `getContainerView`

O contrato não tem um método por propriedade. A engine assina `changes` (emite a chave do container alterado) e lê uma foto imutável:

```ts
controller.changes.subscribe((key) => {
  const view = controller.getContainerView(key); // null se o container não existe mais
  if (!view) return;
  render(view.tabs, view.activeId, {
    closingAll: view.closingAll, // desabilita o botão de fechar tudo
    canExpand: view.canExpand, // false com expand: false
    dragging: view.dragging, // desabilita o botão de tela cheia durante o arraste
    expanded: view.container.expanded,
  });
});
```

Cada `SplitTabView` tem `id`, `title`, `label` (título com número), `closable`, `active` e `ref`.

## Arraste: `canDrop`, `moveTab`, `beginDrag`, `endDrag`

```ts
// início do arraste: emite ref.dragStarted e avisa todos os containers (view.dragging)
controller.beginDrag(ref);

// zonas de soltura: containers (exceto o da aba) que aceitam a aba agora
const targets = controller.getDropTargets(ref);

// enquanto o cursor passa sobre um destino (sem efeitos colaterais)
const ok = controller.canDrop(ref, 'destino'); // source padrão: 'drag'

// no drop
let moved = false;
if (controller.canDrop(ref, 'destino', index)) {
  moved = controller.moveTab(ref, 'destino', index, 'drag');
}
controller.endDrag(ref, moved); // emite ref.dragEnded({ moved })
```

- `canDrop` aplica `canMove`, `maxTabs` (com `source: 'move'`; só aceita se houver espaço ou substituição) e, para `source: 'drag'`, a restrição de container expandido: com um container expandido, só se reordena dentro dele.
- `moveTab(ref, key, index?, source = 'api')` reordena no mesmo container ou move para outro sem destruir, recalcula o número no destino, ativa a aba movida, fecha a origem vazia com `closeWhenEmpty` e emite `reordered`/`containerChanged`, `titleChanged` (se o rótulo mudou) e `tabMoved`. Devolve `true` se a aba mudou de lugar. Se o destino recusar por limite, emite `tabRejected` com `resolution: 'move-refused'`.
- Se a expansão mudar durante o arraste, o core chama `engine.cancelDrag()` e recusa o drop seguinte.
- `ref.moveTo()` usa o mesmo caminho com `source: 'api'` (sem a restrição de container expandido).

## Funções puras de geometria

A engine mede o DOM e aplica o resultado; o cálculo fica no core.

| Função                                                                                     | Uso                                                                                                           |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `resolveLength(value, axis, viewport, area)`                                               | Converte `number` ou `'px' \| 'vw' \| 'vh' \| '%'` em px. Lança `SplitInvalidOptionError` para outro formato. |
| `computeExpandedRect(area, { maxWidth, maxHeight, margin, align })`                        | Retângulo do container expandido dentro da área de referência.                                                |
| `computeClosedDropZoneRect({ size, viewport, bodySide, host, lastKnownRect, anchorRect })` | Posição do painel flutuante de um container fechado, ou `null` (sem zona; só recebe por `moveTo()`).          |
| `centerOn(cx, cy, size)`, `clampToViewport(rect, viewport)`, `rectsMatch(a, b, tol?)`      | Auxiliares. `rectsMatch` serve para detectar um ancestral que quebra o `position: fixed`.                     |

```ts
import { computeExpandedRect, resolveLength } from '@split-window/core';

const viewport = { width: innerWidth, height: innerHeight };
const area = { x: 0, y: 0, ...viewport };
const rect = computeExpandedRect(area, {
  maxWidth: resolveLength('90vw', 'x', viewport, area),
  margin: 16,
  align: 'center',
});
```

## Testes: `@split-window/core/testing`

`FakeSplitEngine` é uma engine em memória que registra cada chamada. Serve para testar o core e para testar o controller de um adaptador novo antes de ter UI.

```ts
import { SplitContainerRegistry, SplitWindowController } from '@split-window/core';
import { FakeSplitEngine } from '@split-window/core/testing';

const registry = new SplitContainerRegistry();
const engine = new FakeSplitEngine();
const controller = new SplitWindowController(registry, engine);
registry.registerContainer('a', {});
registry.setDefaultContainer('a');

const ref = controller.open('conteúdo', { title: 'Contrato' });
expect(engine.sequence(ref.id)).toEqual(['createTab', 'attach', 'activate']);
expect(engine.containers.get('a')).toMatchObject({ mounted: true, open: true });
```

| Membro               | Descrição                                                               |
| -------------------- | ----------------------------------------------------------------------- |
| `calls`              | Todas as chamadas `{ method, target, index?, value? }`, em ordem.       |
| `callsOf(method)`    | Chamadas de um método.                                                  |
| `sequence(target?)`  | Nomes dos métodos chamados, opcionalmente só para uma aba ou container. |
| `tabs`, `containers` | Estado em memória (`FakeTab`, `FakeContainer`).                         |
| `cancelDragCount`    | Quantas vezes `cancelDrag()` foi chamado.                               |
| `failNextCreate`     | Atribua um `Error` para o próximo `createTab` lançar.                   |
| `reset()`            | Limpa `calls`.                                                          |

## Erros

Todos estendem `SplitWindowError`: `SplitContainerNotFoundError`, `SplitNoDefaultContainerError`, `SplitContainerFullError`, `SplitReservedContainerKeyError`, `SplitDuplicateContainerError` e `SplitInvalidOptionError`. Veja o [guia de erros](../../docs/guides/erros.md).

## Referência da API

Gerada com TypeDoc a partir dos comentários do código: `npm run docs:api` na raiz do repositório (saída em `docs/api`).
