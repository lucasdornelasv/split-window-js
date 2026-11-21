# Eventos

Cada `SplitWindowRef` expõe observables do ciclo de vida da aba e da movimentação. O manager expõe streams globais para quem observa todas as abas (`tabMoved`, `tabRejected`), e também o estado dos containers (`containerStateChanged`) e as transições de abrir/fechar (`containerTransitions`). Os eventos de movimentação disparam tanto no arraste quanto no `moveTo()` programático, porque os dois passam pelo mesmo método.

Todos os observables de uma ref completam depois de `hidden`, então assinaturas na ref não ficam penduradas. Os do manager e do registry completam quando o injector de ambiente é destruído.

## Exemplo

```ts
const ref = manager.open(NoteTabComponent, { containerKey: 'eventos-a' });

ref.activated.subscribe(() => ...);
ref.deactivated.subscribe(() => ...);
ref.titleChanged.subscribe(({ title, label }) => ...);
ref.dragStarted.subscribe(() => ...);
ref.dragEnded.subscribe(({ moved }) => ...);
ref.reordered.subscribe(({ from, to }) => ...);
ref.containerChanged.subscribe(({ fromKey, toKey, index, label }) => ...);
ref.closePrevented.subscribe(({ trigger, reason }) => ...);
ref.closed.subscribe((result) => ...);      // before destroy
ref.dismissed.subscribe((reason) => ...);   // before destroy
ref.hidden.subscribe(() => ...);            // after destroy; every observable completes

manager.tabMoved.subscribe((e) => ...);
manager.tabRejected.subscribe((e) => ...);
manager.containerStateChanged.subscribe(({ key, open, expanded }) => ...);
manager.containerTransitions.subscribe(({ key, phase, state }) => ...);
```

| Evento                      | Onde    | Quando                                             | Payload                                                    |
| --------------------------- | ------- | -------------------------------------------------- | ---------------------------------------------------------- |
| `result`                    | Ref     | Promise: resolve no `close`, rejeita no `dismiss`  | resultado ou motivo                                        |
| `closed` / `dismissed`      | Ref     | Ao fechar, antes de destruir                       | resultado ou motivo                                        |
| `closePrevented`            | Ref     | `canClose` recusou um pedido                       | `{ trigger, reason }`                                      |
| `hidden`                    | Ref     | Depois de destruir                                 | —                                                          |
| `activated` / `deactivated` | Ref     | Ganhou ou perdeu a posição de aba ativa            | —                                                          |
| `titleChanged`              | Ref     | `setTitle()` ou número recalculado ao mover        | `{ title, label }`                                         |
| `dragStarted` / `dragEnded` | Ref     | Início e fim do arraste (válido ou cancelado)      | — / `{ moved }`                                            |
| `reordered`                 | Ref     | Nova posição no mesmo container                    | `{ from, to }`                                             |
| `containerChanged`          | Ref     | Mudou de container                                 | `{ fromKey, toKey, index, label }`                         |
| `tabMoved`                  | Manager | Qualquer `reordered` ou `containerChanged`         | `{ ref, type, fromKey, toKey, fromIndex, toIndex, label }` |
| `tabRejected`               | Manager | Aba recusada por limite                            | `{ context, resolution, redirectTo? }`                     |
| `containerStateChanged`     | Manager | Container aberto, fechado, expandido ou restaurado | `{ key, open, expanded }`                                  |
| `containerTransitions`      | Manager | Transição de abrir/fechar: início, andamento, fim  | `{ key, phase, state, progress? }`                         |

## Regras

- Com animação, `hidden` da última aba de um container `closeWhenEmpty` só emite quando o container termina de sair; `closed`/`dismissed` continuam imediatos.

- Soltar no mesmo lugar, ou fora de uma lista válida, gera só `dragEnded` com `moved: false`.
- Fechar a aba ativa emite `closed`/`dismissed` da aba, `activated` da vizinha e, por último, `hidden`.
- Ao mover para outro container, a ordem é: `titleChanged` (se o rótulo mudou), `containerChanged` e `tabMoved`.
- `tabMoved.type` é `'reordered'` ou `'containerChanged'`. `tabRejected.resolution` é `'throw'`, `'cancel'`, `'redirect'` ou `'move-refused'` (movimentos).
- Uma ref rejeitada por `onReject: 'cancel'` já nasce com `hidden` emitido e os observables completos.
- Dentro do componente, prefira os signals do `SplitActiveWindow` (`containerKey()`, `label()`, `isActive()`), que já seguem esses eventos.

## Links

- Tela de demonstração: [`#/eventos`](http://localhost:4200/#/eventos)
- Fonte: [apps/demo-angular/src/app/pages/events.page.ts](../../apps/demo-angular/src/app/pages/events.page.ts)
