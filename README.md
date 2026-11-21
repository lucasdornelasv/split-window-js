# SplitWindow

Biblioteca de abas em containers, no estilo das abas de um navegador desktop: numeração por grupo + título, reordenação e movimentação entre containers por arraste sem destruir o componente, tela cheia e fechamento com confirmação.

- **Core independente de framework** (`@split-window/core`): estado e regras (registry, stacks, numeração, limites, fechamento, arraste, tela cheia, eventos RxJS e erros). Não cria nada na tela.
- **Adaptador Angular** (`@split-window/angular`): API no formato do `NgbOffcanvas`/`NgbModal`, `open(content, options)` devolve uma ref, com a diferença de que existem **vários containers registrados por chave**, cada um com seu stack de abas: divs da aplicação em qualquer posição da página ou painéis fixos nas bordas da janela.

## Pacotes

| Pacote                                                                        | Conteúdo                                                                                                                                                | Peer dependencies                                          |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| [`@split-window/core`](packages/core/README.md)                               | Estado, regras e contrato `SplitWindowEngine` para adaptadores. Inclui `@split-window/core/testing` (engine falsa).                                     | `rxjs`                                                     |
| [`@split-window/angular`](packages/angular/README.md)                         | `provideSplitWindows`, `SplitWindowManager`, `SplitContainerRegistry`, `SplitActiveWindow`, diretiva `splitContainer`, shell e drag and drop com o CDK. | `@angular/core`, `@angular/common`, `@angular/cdk`, `rxjs` |
| [`@split-window/css-animation`](packages/css-animation/README.md)             | Motor de animação por classes de estado e `transitionend`.                                                                                              | —                                                          |
| [`@split-window/keyframes-animation`](packages/keyframes-animation/README.md) | Motor de animação com Web Animations (keyframes).                                                                                                       | —                                                          |

Os pacotes são versionados juntos (mesma versão).

## Instalação

```bash
npm install @split-window/angular @split-window/core @angular/cdk
```

## Configuração mínima

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

```ts
// qualquer componente
import { SplitWindowManager } from '@split-window/angular';

export class NotasComponent {
  private readonly manager = inject(SplitWindowManager);

  open() {
    const ref = this.manager.open(NoteTabComponent, { title: 'Nota' });
    ref.result.then(
      (value) => console.log('closed with', value),
      () => {},
    );
  }
}
```

Abrir três vezes gera as abas "Nota", "Nota (2)" e "Nota (3)" no painel da direita. Dentro do componente aberto, injete `SplitActiveWindow` para fechar, renomear ou acompanhar o container atual.

## Guias

Um guia por tela do app de demonstração ([índice](docs/guides/README.md)):

| Guia                                                    | Demo           |
| ------------------------------------------------------- | -------------- |
| [Início rápido](docs/guides/inicio-rapido.md)           | `#/inicio`     |
| [Containers](docs/guides/containers.md)                 | `#/containers` |
| [Containers do body](docs/guides/containers-do-body.md) | `#/body`       |
| [Abas e numeração](docs/guides/abas-e-numeracao.md)     | `#/abas`       |
| [Limite de abas](docs/guides/limite-de-abas.md)         | `#/limite`     |
| [Fechamento](docs/guides/fechamento.md)                 | `#/fechamento` |
| [Drag and drop](docs/guides/drag-and-drop.md)           | `#/arraste`    |
| [Tela cheia](docs/guides/tela-cheia.md)                 | `#/tela-cheia` |
| [Eventos](docs/guides/eventos.md)                       | `#/eventos`    |
| [Erros](docs/guides/erros.md)                           | `#/erros`      |
| [Playground](docs/guides/playground.md)                 | `#/playground` |

Referência da API do core: `npm run docs:api` (gera `docs/api`). A especificação completa está em [split-window-plano.md](split-window-plano.md).

## Desenvolvimento

O repositório usa **npm workspaces** (`packages/core`, `packages/angular` e `e2e`) com o Angular CLI; o app de demonstração fica em `apps/demo-angular`.

```bash
npm install
```

| Comando                                            | O que faz                                                                                                                                                   |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm start`                                        | Sobe o app de demonstração (`ng serve demo-angular`), em `http://localhost:4200`.                                                                           |
| `npm run build`                                    | Compila o core (`tsc`), o adaptador Angular (ng-packagr) e o app de demonstração. Também: `build:core`, `build:angular`, `build:demo`.                      |
| `npm test`                                         | Testes do core (Vitest, sem DOM) e do adaptador Angular (zoneless).                                                                                         |
| `npm run test:core` / `npm run test:core:coverage` | Só o core, com ou sem cobertura.                                                                                                                            |
| `npm run test:angular`                             | Só o adaptador Angular, zoneless (`ng test angular --watch=false`).                                                                                         |
| `npm run test:angular -- -c zone`                  | Adaptador Angular com `zone.js`.                                                                                                                            |
| `npm run e2e`                                      | Playwright em Chromium, Firefox e WebKit sobre o app de demonstração (sobe o servidor na porta 4300). Rode `npx playwright install` antes, na primeira vez. |
| `npm run lint`                                     | ESLint (`eslint .`).                                                                                                                                        |
| `npm run format` / `npm run format:check`          | Prettier.                                                                                                                                                   |
| `npm run typecheck`                                | `tsc --noEmit` no core, no adaptador e no app.                                                                                                              |
| `npm run docs:api`                                 | Referência da API do core com TypeDoc, em `docs/api`.                                                                                                       |

Os testes end-to-end usam só roles e atributos `data-*`; `DEMO_URL` (ou `DEMO_COMMAND` e `DEMO_PORT`) permite rodá-los contra outro servidor.

## Publicação

Os pacotes são publicados no npm na organização [`@split-window`](https://www.npmjs.com/org/split-window), todos com a mesma versão.

1. `npm run version:set -- 0.2.0`, atualize o `CHANGELOG.md` e rode `npm install`.
2. Faça o commit, crie a tag `v0.2.0` e envie: `git push origin main --tags`.
3. O workflow [release.yml](.github/workflows/release.yml) roda lint, typecheck, testes e builds e publica com provenance (`npm run release`), na ordem core → motores de animação → Angular. Tags com sufixo (`v0.2.0-beta.1`) vão para a dist-tag `next`.

Autenticação do workflow, uma das duas:

- **Token**: crie no npmjs.com um _granular access token_ com escrita no escopo `@split-window` e salve como secret `NPM_TOKEN` no repositório (**Settings → Secrets and variables → Actions**). Funciona desde a primeira publicação.
- **Trusted publishing** (sem segredo guardado): em cada pacote no npmjs.com, em **Settings → Trusted publishing**, cadastre o repositório `lucasdornelasv/split-window-js` e o workflow `release.yml`. O pacote precisa existir, então serve a partir da segunda versão (a primeira vai pelo token ou à mão). Quando os dois estão disponíveis, vale o trusted publishing, e o secret pode ser apagado.

Publicação manual: `npm login`, os builds (`npm run build:core && npm run build:engines && npm run build:angular`) e `npm run release` (ou `npm run release -- --dry-run` para conferir). O `@split-window/angular` sai de `packages/angular/dist`; publicar direto de `packages/angular` é bloqueado. Versões que já estão no npm são puladas, então dá para rodar de novo depois de uma falha.
