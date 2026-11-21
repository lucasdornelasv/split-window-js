# @split-window/angular

Adaptador Angular do SplitWindow: abas em containers, com a API do `NgbOffcanvas`/`NgbModal` (`open(content, options)` devolve uma ref) e vários containers registrados por chave. Inclui barra de abas, numeração, drag and drop com o Angular CDK, tela cheia e containers fixos nas bordas da janela.

Requer Angular 22. Peer dependencies: `@angular/core`, `@angular/common`, `@angular/cdk` e `rxjs`. Não depende de ng-bootstrap nem de Bootstrap.

## Instalação

```bash
npm install @split-window/angular @split-window/core @angular/cdk
```

Importe tudo de `@split-window/angular`: o pacote reexporta os tipos e erros do core.

## Configuração

`provideSplitWindows()` registra o `SplitWindowManager` e o `SplitContainerRegistry`. Eles **não** são `providedIn: 'root'`: sem o provider, injetar qualquer um deles ou usar a diretiva falha com o erro de injeção do Angular. Nenhum container existe por padrão.

```ts
// app.config.ts
import { inject, provideAppInitializer, type ApplicationConfig } from '@angular/core';
import { SplitContainerRegistry, provideSplitWindows } from '@split-window/angular';

export const appConfig: ApplicationConfig = {
  providers: [
    provideSplitWindows(),
    provideAppInitializer(() => {
      // só body-right, sem limite de abas, como container padrão
      inject(SplitContainerRegistry).useBodyContainers();
    }),
  ],
};
```

O registry pode ser injetado sozinho na inicialização, sem criar o manager.

## Abrir um componente ou template

```ts
import { SplitWindowManager } from '@split-window/angular';

export class ContratosComponent {
  private readonly manager = inject(SplitWindowManager);

  abrir(id: number) {
    const ref = this.manager.open(ContratoDetalheComponent, {
      title: 'Contrato',
      inputs: { id }, // setInput no componente
      containerKey: 'direito', // sem valor: container padrão
    });
    ref.result.then(
      (valor) => console.log('fechou com', valor),
      () => {},
    );
  }
}
```

Um `TemplateRef` recebe o `SplitActiveWindow` como `$implicit` e como `window`:

```html
<ng-template #nota let-win>
  <p>{{ win.label() }} em {{ win.containerKey() }}</p>
  <button (click)="win.close('ok')">Fechar</button>
</ng-template>
```

```ts
readonly nota = viewChild.required<TemplateRef<unknown>>('nota');
abrirNota() { this.manager.open(this.nota(), { title: 'Nota' }); }
```

### `SplitWindowManager`

| Membro                                           | Descrição                                                                     |
| ------------------------------------------------ | ----------------------------------------------------------------------------- |
| `open(content, options?)`                        | Abre um componente (`Type<T>`) ou `TemplateRef`. Devolve `SplitWindowRef<T>`. |
| `dismissAll({ containerKey?, reason?, force? })` | Fechar tudo sequencial. Resolve com `{ closed, kept }`.                       |
| `hasOpenWindows(containerKey?)`                  | Se há abas abertas (num container ou em qualquer um).                         |
| `getTabs(containerKey)`                          | Abas de um container, na ordem da barra.                                      |
| `registry`                                       | O mesmo `SplitContainerRegistry` injetável.                                   |
| `tabMoved`, `tabRejected`                        | Eventos globais de movimentação e de rejeição por limite.                     |

## Opções de abertura (`SplitWindowOptions`)

| Opção          | Tipo                                            | Padrão                               | Descrição                                                                                        |
| -------------- | ----------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `containerKey` | `string`                                        | container padrão                     | Container de destino. Chave desconhecida lança `SplitContainerNotFoundError`.                    |
| `title`        | `string`                                        | `labels.defaultTitle` (`'Nova aba'`) | Título; a numeração é por grupo + título.                                                        |
| `groupKey`     | `string`                                        | grupo default                        | Separa a numeração.                                                                              |
| `activate`     | `boolean`                                       | `true`                               | Ativa a aba. A primeira aba de um container vazio é sempre ativada.                              |
| `closable`     | `boolean`                                       | `true`                               | `false` esconde o X e o fechar tudo pula a aba. O código ainda pode fechá-la.                    |
| `canClose`     | `SplitCloseGuard`                               | —                                    | Verificação a cada pedido de fechamento: `boolean`, `Promise<boolean>` ou `Observable<boolean>`. |
| `canMove`      | `(target: { containerKey; index? }) => boolean` | —                                    | Veta movimentos. `index` fica ausente durante o arraste.                                         |
| `inputs`       | `Record<string, unknown>`                       | —                                    | Inputs aplicados com `setInput` no componente.                                                   |
| `injector`     | `Injector`                                      | `EnvironmentInjector` do manager     | Injector pai da aba. Passe `inject(Injector)` para herdar providers de quem abre.                |

Os valores padrão de `activate` e `closable` podem ser trocados no `provideSplitWindows({ activate, closable })`.

## `SplitWindowRef`

`id`, `result` (resolve no `close`, rejeita no `dismiss`), `rejected`, `componentInstance`, `containerKey`, `title`, `label`, `groupKey`, `closable`, `isActive`, `isOpen`; métodos `close(result?, { force? })`, `dismiss(reason?, { force? })`, `activate()`, `moveTo(key, index?)`, `setTitle()`, `setClosable()`, `setCanClose()`, `setCanMove()`; eventos descritos no [guia de eventos](../../docs/guides/eventos.md).

## `SplitActiveWindow`

Injetado no componente (ou no contexto do template) aberto como aba:

```ts
export class ContratoDetalheComponent {
  private readonly window = inject(SplitActiveWindow);
  readonly form = inject(FormBuilder).group({ nome: [''] });

  constructor() {
    this.window.setCanClose(() => !this.form.dirty || confirm('Descartar as alterações?'));
  }

  salvar() {
    this.window.setTitle(`Contrato ${this.form.value.nome}`);
    this.window.close('salvo');
  }
}
```

| Membro                                         | Descrição                                                                               |
| ---------------------------------------------- | --------------------------------------------------------------------------------------- |
| `containerKey`, `title`, `label`, `isActive`   | Signals. O container é um signal porque a aba pode mudar de container depois de criada. |
| `close()`, `dismiss()`                         | Mesmo comportamento da ref (passam pelo `canClose`, salvo com `force`).                 |
| `setTitle()`, `setClosable()`, `setCanClose()` | Mesmo comportamento da ref.                                                             |
| `ref`                                          | A `SplitWindowRef` da aba.                                                              |

Não guarde no construtor valores que dependem do container: depois de mover, eles ficariam desatualizados. Leia `containerKey()`.

## Diretiva `splitContainer`

```html
<div
  splitContainer="direito"
  [splitContainerDefault]="true"
  [splitContainerOptions]="{ maxTabs: 5 }"
></div>
```

- Registra o host no `ngOnInit` e desregistra no destroy. Desregistrar fecha as abas com `dismiss('container-removed')`, sem `canClose`: um container dentro de um `@if` ou de uma rota perde as abas quando sai da tela.
- `splitContainerDefault` define (ou remove) o container padrão.
- `splitContainerOptions` é lido no registro. Trocar a chave desregistra a antiga e registra a nova.
- Por código: `registry.registerContainer(key, element, options)`.

Opções de container (`maxTabs`, `onFull`, `onReject`, `closeWhenEmpty`, `label`, `closedDropZone`, `closedDropZoneAnchor`, `expand`) estão nos [guias](../../docs/guides/README.md).

## Tema: CSS custom properties

Todas as cores, tamanhos e camadas são variáveis. Os padrões ficam em `:where(:root)`, com especificidade zero: qualquer seletor da aplicação vence, independentemente da ordem das folhas de estilo. Sobrescreva em `:root` para a aplicação toda, ou num ancestral para um container só (os containers do body ficam direto no `body`).

```css
:root {
  --split-tab-active-indicator: #8250df;
  --split-tab-height: 32px;
}
```

| Variável                       | Padrão                              |
| ------------------------------ | ----------------------------------- |
| `--split-bg`                   | `#ffffff`                           |
| `--split-fg`                   | `#1f2328`                           |
| `--split-muted-fg`             | `#59636e`                           |
| `--split-border`               | `#d1d9e0`                           |
| `--split-strip-bg`             | `#f6f8fa`                           |
| `--split-tab-bg`               | `transparent`                       |
| `--split-tab-hover-bg`         | `#eaeef2`                           |
| `--split-tab-active-bg`        | `#ffffff`                           |
| `--split-tab-active-indicator` | `#0969da`                           |
| `--split-focus-ring`           | `#0969da`                           |
| `--split-drop-highlight`       | `#0969da`                           |
| `--split-drop-zone-bg`         | `rgba(9, 105, 218, 0.08)`           |
| `--split-backdrop-bg`          | `rgba(0, 0, 0, 0.32)`               |
| `--split-radius`               | `6px`                               |
| `--split-tab-height`           | `36px`                              |
| `--split-tab-max-width`        | `220px`                             |
| `--split-font`                 | `inherit`                           |
| `--split-body-z-index`         | `1040`                              |
| `--split-expanded-z-index`     | `1050`                              |
| `--split-drop-zone-z-index`    | `1060`                              |
| `--split-drag-preview-z-index` | `1070`                              |
| `--split-shadow`               | `0 8px 24px rgba(31, 35, 40, 0.18)` |

O tamanho de cada container do body vem da opção `size` (padrão `bodySize: '420px'` no config).

## Textos e i18n

```ts
provideSplitWindows({
  labels: {
    defaultTitle: 'New tab',
    emptyContainer: 'No open tabs',
  },
});
```

| Chave de `labels` | Padrão                   | Onde aparece                   |
| ----------------- | ------------------------ | ------------------------------ |
| `defaultTitle`    | `'Nova aba'`             | Título de `open()` sem `title` |
| `emptyContainer`  | `'Nenhuma aba aberta'`   | Área de conteúdo vazia         |
| `closeTab`        | `'Fechar aba'`           | Rótulo acessível do X da aba   |
| `closeAll`        | `'Fechar todas as abas'` | Botão de fechar tudo           |
| `expand`          | `'Tela cheia'`           | Botão de tela cheia            |
| `restore`         | `'Restaurar tamanho'`    | Botão de restaurar             |
| `tabList`         | `'Abas'`                 | Rótulo da `tablist`            |

Outras chaves do config: `activate` (`true`), `closable` (`true`), `closedDropZone` (`{ width: 220, height: 120 }`) e `bodySize` (`'420px'`).

## Teclado

A barra segue o padrão WAI-ARIA de abas, com ativação automática (roles `tablist`, `tab` e `tabpanel`).

| Tecla (com foco numa aba)                  | Ação                                                                   |
| ------------------------------------------ | ---------------------------------------------------------------------- |
| `←` / `→`                                  | Ativa a aba anterior / seguinte (circular)                             |
| `Home` / `End`                             | Ativa a primeira / última aba                                          |
| `Enter` / `Espaço`                         | Ativa a aba                                                            |
| `Delete`                                   | Fecha a aba (se `closable`), passando pelo `canClose`                  |
| `Ctrl+Shift+←` / `Ctrl+Shift+→`            | Move a aba uma posição na barra                                        |
| `Esc` (foco dentro do container expandido) | Restaura o tamanho (desligue com `expand: { restoreOnEscape: false }`) |

Mover uma aba para outro container pelo teclado ainda não é suportado; use `ref.moveTo()`.

## SSR

O adaptador roda no servidor sem erro: `window`, `document`, `ResizeObserver` e `moveBefore()` só são usados no navegador. No servidor a engine não monta shells, não cria componentes de aba e não mede nada.

## Limitação conhecida: mover fora do Chromium

Mover uma aba (arraste ou `moveTo()`) usa `Element.moveBefore()` quando o navegador o suporta (Chrome 133+), o que preserva o estado do DOM. Nos demais (Firefox, Safari), o fallback é `appendChild`: **iframes recarregam, vídeos reiniciam e o foco se perde** quando a aba muda de container. O componente Angular em si não é recriado (sem `ngOnDestroy`), então o estado do componente é mantido.

## Guias

Veja [docs/guides](../../docs/guides/README.md) e o app de demonstração (`npm start` na raiz).
