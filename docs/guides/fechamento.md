# Fechamento

Cada aba tem um botão de fechar (X), e a barra termina com os botões de tela cheia e de fechar tudo. Todo pedido de fechamento (o X, o fechar tudo, `close()`, `dismiss()` e `dismissAll()`, na ref ou no `SplitActiveWindow`) passa pela verificação `canClose` da aba antes de fechar de fato. A verificação devolve `boolean`, `Promise<boolean>` ou `Observable<boolean>`: `true` fecha, `false` mantém a aba aberta e dispara `closePrevented`. `closable: false` esconde o X e faz o fechar tudo pular a aba; o código ainda pode fechá-la.

O fechar tudo é sequencial: percorre as abas na ordem da barra, fecha na hora as que não têm `canClose` e, ao chegar numa aba com `canClose`, ativa essa aba (para o usuário ver o que está confirmando) e espera a resposta. Com `true` ou `false`, o processo continua nas abas seguintes. No fim, resolve com `{ closed, kept }`.

## Exemplo

```ts
// closable: false hides the X and "close all" skips the tab
manager.open(NoteTabComponent, { title: 'Fixa', closable: false });

// canClose: boolean, Promise or Observable
manager.open(NoteTabComponent, { title: 'Nunca', canClose: () => false });
manager.open(NoteTabComponent, {
  title: 'Confirma',
  canClose: () => confirm.confirm('Fechar esta aba?'),   // Promise<boolean>
});
manager.open(NoteTabComponent, { title: 'Observable', canClose: () => of(true).pipe(delay(300)) });

// from inside the component
constructor() {
  inject(SplitActiveWindow).setCanClose(() => !this.dirty() || this.confirmDiscard());
}

// force skips the check
ref.dismiss('forced', { force: true });

// close all, in sequence, waiting for each confirmation
const { closed, kept } = await manager.dismissAll({ containerKey: 'fechamento' });
```

O guard recebe o contexto `{ ref, trigger, reason }`, com `trigger` em `'tab-button' | 'close-all' | 'close' | 'dismiss'`:

```ts
ref.closePrevented.subscribe(({ trigger }) => console.log('mantida', trigger));
```

## Regras

- **Observable:** vale o primeiro valor. Se completar sem emitir, ou der erro, a aba fica aberta.
- **Promise rejeitada ou exceção:** a aba fica aberta, e o erro vai para o console.
- **Pedido em andamento:** enquanto a verificação de uma aba não termina, novos pedidos para a mesma aba devolvem a mesma promise, sem chamar o `canClose` de novo (não abre dois modais).
- **`force`:** `close(r, { force: true })`, `dismiss(m, { force: true })` e `dismissAll({ force: true })` fecham sem verificação. Um `force` durante uma verificação fecha na hora; o resultado da verificação é ignorado.
- O sistema sempre usa `force`: `unregisterContainer`, lado do body desabilitado (`'container-removed'`) e substituição por `onFull` (`'replaced'`).
- `dismissAll` pula abas com `closable: false` **mesmo com `force`**; elas entram em `kept`. Abas abertas depois do início não entram; abas fechadas por outro caminho durante o processo são puladas.
- Sem `containerKey`, `dismissAll` vale para todos os containers. O botão de fechar tudo de um container fica desabilitado enquanto o processo roda.
- `close()` e `dismiss()` devolvem `Promise<boolean>` (`true` se fechou). Numa ref já fechada, devolvem `false`.
- Ordem dos eventos: `closed`/`dismissed` antes de destruir o componente, `hidden` depois; então todos os observables da ref completam.
- Fechar a aba ativa ativa a vizinha da direita (ou da esquerda). Um container vazio com `closeWhenEmpty` fecha (fica oculto) e continua registrado.
- `setClosable()` e `setCanClose()` (na ref ou no `SplitActiveWindow`) mudam as regras depois da abertura. Teclado: `Delete` numa aba focada equivale ao X.

## Links

- Tela de demonstração: [`#/fechamento`](http://localhost:4200/#/fechamento)
- Fonte: [apps/demo-angular/src/app/pages/closing.page.ts](../../apps/demo-angular/src/app/pages/closing.page.ts) e o `FormTabComponent` em [shared/tabs.ts](../../apps/demo-angular/src/app/shared/tabs.ts)
