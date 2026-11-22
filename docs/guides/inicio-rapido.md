# Início rápido

`provideSplitWindows()` registra o `SplitWindowManager` e o `SplitContainerRegistry`. Os dois não são `providedIn: 'root'`: só existem com o provider, e são criados na primeira injeção. Por isso a aplicação pode injetar só o registry (num `provideAppInitializer`, por exemplo) para configurar os containers em tempo de execução, sem instanciar o manager.

Nenhum container existe por padrão. `provideSplitWindows({ bodyContainers: true })` (ou `registry.useBodyContainers()` sem argumentos) é um atalho para `{ right: true, default: 'right' }`: habilita o painel fixo da borda direita (`body-right`), sem limite de abas, e o define como container padrão. A partir daí, `open()` sem `containerKey` abre nele. Sem padrão explícito, o padrão é o primeiro container configurado.

## Exemplo

```ts
// app.config.ts
providers: [
  // only body-right, no tab limit, as the default container
  provideSplitWindows({ bodyContainers: true }),
]

// any component
private manager = inject(SplitWindowManager);

open() {
  const ref = this.manager.open(NoteTabComponent, { title: 'Nota' });
  ref.result.then((value) => console.log('closed with', value), () => {});
}
```

O componente aberto pode injetar `SplitActiveWindow` (como o `NoteTabComponent` do demo, em [shared/tabs.ts](../../apps/demo-angular/src/app/shared/tabs.ts)):

```ts
export class NoteTabComponent {
  readonly window = inject(SplitActiveWindow);
  // template: {{ window.label() }} em {{ window.containerKey() }}
  //           <button (click)="window.close('done')">Fechar pela aba</button>
}
```

## Regras

- Abrir várias vezes com o mesmo título numera as abas: Nota, Nota (2), Nota (3)…
- `result` resolve no `close(valor)` e rejeita no `dismiss(motivo)`. Um tratador vazio já vem anexado, então ignorar `result` não gera "Uncaught (in promise)".
- O container do body é criado no primeiro `open()` e fecha (fica oculto) quando a última aba fecha.
- Sem `provideSplitWindows()`, injetar o manager ou o registry falha com o erro de injeção do Angular.
- Sem `injector` nas opções, o pai da aba é o `EnvironmentInjector` do manager (como no `NgbModal`).
- `ref.setInputData({ ... })` atualiza os inputs do componente aberto: só os que ele declara (pelo nome da propriedade ou pelo alias), ignorando chaves desconhecidas e valores `undefined`.

## A aba como requisição

```ts
const ref = this.manager.open(NoteTabComponent, {
  title: 'Pedido',
  inputs: { text: 'Aguardando' },
});
ref.asRequest<string>().subscribe({
  next: (value) => (this.result = value), // ref.close('done') inside the tab
  complete: () => (this.status = 'finished'), // also on dismiss, with no value
});
ref.setInputData({ text: 'Atualizado' });
```

- `asRequest()` emite o resultado do `close` e completa; no `dismiss` (ou se a abertura foi rejeitada) completa sem valor. As emissões saem no `asapScheduler`.
- Cancelar a inscrição antes da resposta faz `dismiss` da aba (passando pelo `canClose`). Por baixo, é o `ref.attachTo(subscription)`: liga a aba a uma `Subscription` nos dois sentidos (fechar a aba encerra a subscription; encerrar a subscription com a aba aberta faz `dismiss`) e devolve o vínculo, que pode ser desfeito com `unsubscribe()`.
- Numa aba já fechada, `asRequest()` responde a partir do `result`.

## Links

- Tela de demonstração: [`#/inicio`](http://localhost:4200/#/inicio) (rode `npm start`)
- Fonte: [apps/demo-angular/src/app/pages/quick-start.page.ts](../../apps/demo-angular/src/app/pages/quick-start.page.ts)
- Próximo: [Containers](containers.md)
