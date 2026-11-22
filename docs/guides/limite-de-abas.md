# Limite de abas

`maxTabs` limita as abas de um container: um número fixo ou uma função `(ctx) => boolean`, chamada a cada abertura ou movimento para o container, que devolve `true` quando o container está cheio para a aba que está chegando. Quando o container está cheio, duas políticas decidem: `onFull` escolhe entre rejeitar a aba nova e substituir uma existente, e `onReject` decide o destino de uma aba rejeitada. As duas aceitam um valor pré-definido ou uma função síncrona.

| `onFull`               | Comportamento                                                                       |
| ---------------------- | ----------------------------------------------------------------------------------- |
| `'reject'` (padrão)    | Recusa a aba nova e aplica `onReject`.                                              |
| `'replace-oldest'`     | Fecha a aba aberta há mais tempo.                                                   |
| `'replace-lru'`        | Fecha a aba ativada pela última vez há mais tempo.                                  |
| `'replace-same-label'` | Fecha a aba mais antiga com o mesmo grupo e título da nova; se não houver, rejeita. |
| função                 | `(ctx) => { action: 'reject' }` ou `{ action: 'replace', ref }`.                    |

| `onReject`           | Comportamento                                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `'throw'` (padrão)   | `open()` lança `SplitContainerFullError`.                                                                         |
| `'redirect-default'` | Abre no container padrão.                                                                                         |
| `'cancel'`           | Não cria o componente; `open()` devolve uma ref com `rejected: true` e `result` rejeitado com `'container-full'`. |
| função               | `(ctx) => { action: 'throw' \| 'cancel' }` ou `{ action: 'redirect', containerKey }`.                             |

## Exemplo

```ts
registry.registerContainer('limitado', host, {
  maxTabs: 3,
  onFull: (ctx) =>
    ctx.source === 'open'
      ? { action: 'replace', ref: ctx.tabs[ctx.tabs.length - 1] } // the newest tab
      : { action: 'reject' },
  onReject: (ctx) => ({ action: 'redirect', containerKey: 'reserva' }),
});

manager.tabRejected.subscribe((e) => console.log(e.resolution, e.redirectTo));

// maxTabs as a function: true = full for the arriving tab
registry.registerContainer('relatorios', host, {
  maxTabs: (ctx) => ctx.tabs.filter((t) => t.title === ctx.incoming.title).length >= 2,
});
```

Tratando a rejeição na abertura:

```ts
try {
  const ref = manager.open(NoteTabComponent, { containerKey: 'limitado', title: 'Relatório' });
  if (ref.rejected) {
    /* onReject: 'cancel' */
  }
} catch (e) {
  // SplitContainerFullError: onReject 'throw' ou cadeia de redirecionamento esgotada
}
```

O contexto (`SplitCapacityContext`) traz `containerKey`, `tabs` (na ordem da barra), `incoming` (opções da aba que chega), `incomingRef` (em movimentos) e `source: 'open' | 'move'`.

## Regras

- A substituição é síncrona: abas com `canClose` nunca são substituídas (e o `canClose` não é chamado). A aba substituída recebe `dismiss('replaced')` sem verificação.
- As estratégias pré-definidas nunca substituem a aba ativa, abas com `canClose` nem abas com `closable: false`. Se nenhuma servir, a aba nova é rejeitada. Com `maxTabs: 1`, elas sempre rejeitam.
- Se uma função de `onFull` devolver uma aba com `canClose`, ou que não está no container, a aba nova é rejeitada.
- Em movimentos (`source: 'move'`), as estratégias pré-definidas só rejeitam; uma função customizada pode decidir diferente.
- Um redirecionamento passa pelas políticas do destino. Um container já tentado na mesma abertura não é tentado de novo; se a cadeia se esgotar (por exemplo, `redirect-default` quando o padrão, explícito ou o primeiro container, é o próprio container cheio), `open()` lança `SplitContainerFullError` com os containers tentados (`triedKeys`).
- Em movimentos, `onReject` não se aplica: o arraste é cancelado e `moveTo()` devolve `false`.
- Toda rejeição dispara `manager.tabRejected` com `context`, `resolution` (`'throw' | 'cancel' | 'redirect' | 'move-refused'`) e `redirectTo`.
- `maxTabs` deve ser inteiro maior que zero; outro valor lança `SplitInvalidOptionError`.

## Links

- Tela de demonstração: [`#/limite`](http://localhost:4200/#/limite)
- Fonte: [apps/demo-angular/src/app/pages/limits.page.ts](../../apps/demo-angular/src/app/pages/limits.page.ts) (o código exibido muda conforme as escolhas da tela; acima, a variante com as funções customizadas)
