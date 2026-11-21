# Playground

O playground reúne num formulário todas as opções de container e de abertura. Cada mudança nas opções de container reaplica a configuração: o container `playground` é desregistrado e registrado de novo (as abas dele recebem `dismiss('container-removed')`). As opções de abertura valem para o próximo `open()`. A tela mostra o código equivalente, pronto para copiar, e exibe os erros (`SplitInvalidOptionError`, `SplitContainerFullError`) na própria página.

O código é gerado pela função `playgroundCode(state)` da página, a partir de `containerOptions(state)` e `openOptions(state)`. Só as opções diferentes do padrão aparecem.

## Exemplo

Com os valores iniciais, o código gerado é:

```ts
registry.registerContainer('playground', host, {});

manager.open(NoteTabComponent, {
  containerKey: 'playground',
});
```

Com `maxTabs: 3`, `onFull: 'replace-oldest'`, `expand.maxWidth: 60vw`, título "Contrato", `closable` desmarcado e as duas verificações ligadas:

```ts
registry.registerContainer('playground', host, {
  maxTabs: 3,
  onFull: 'replace-oldest',
  expand: {
    maxWidth: '60vw',
  },
});

manager.open(NoteTabComponent, {
  containerKey: 'playground',
  title: 'Contrato',
  closable: false,
  canClose: () => confirm('Fechar esta aba?'),
  canMove: (target) => target.containerKey === 'playground',
});
```

## Campos

| Grupo     | Campo                                                | Opção                                                       |
| --------- | ---------------------------------------------------- | ----------------------------------------------------------- |
| Container | maxTabs                                              | `maxTabs` (vazio: sem limite)                               |
| Container | onFull / onReject                                    | `onFull`, `onReject` (estratégias pré-definidas)            |
| Container | label                                                | `label`                                                     |
| Container | closeWhenEmpty                                       | `closeWhenEmpty`                                            |
| Container | expand, expand.maxWidth, expand.margin, expand.align | `expand: false` ou `{ maxWidth, margin, align }`            |
| Abertura  | title, groupKey                                      | `title`, `groupKey`                                         |
| Abertura  | activate, closable                                   | `activate`, `closable`                                      |
| Abertura  | canClose com confirm()                               | `canClose: () => confirm('Fechar esta aba?')`               |
| Abertura  | canMove só no playground                             | `canMove: (target) => target.containerKey === 'playground'` |

## Regras

- `expand.maxWidth` aceita só dígitos (vira número em px) ou texto em `px`, `vw`, `vh` ou `%`; outro valor mostra o `SplitInvalidOptionError` e o container fica sem registro até corrigir.
- Com `maxTabs` e `onReject: 'throw'`, abrir além do limite mostra o `SplitContainerFullError`. Com `'cancel'`, a tela avisa que a aba foi cancelada (`ref.rejected`).
- `redirect-default` usa o container padrão da aplicação (no demo, `body-right`).
- As funções `onFull`/`onReject` customizadas não estão no playground; veja o guia [Limite de abas](limite-de-abas.md).
- "Restaurar padrões" volta ao estado inicial e reaplica o container.

## Links

- Tela de demonstração: [`#/playground`](http://localhost:4200/#/playground)
- Fonte: [apps/demo-angular/src/app/pages/playground.page.ts](../../apps/demo-angular/src/app/pages/playground.page.ts)
