# Início rápido

`provideSplitWindows()` registra o `SplitWindowManager` e o `SplitContainerRegistry`. Os dois não são `providedIn: 'root'`: só existem com o provider, e são criados na primeira injeção. Por isso a aplicação pode injetar só o registry num `provideAppInitializer` para configurar os containers, sem instanciar o manager.

Nenhum container existe por padrão. `useBodyContainers()` sem argumentos é um atalho para `useBodyContainers({ right: true, default: 'right' })`: habilita o painel fixo da borda direita (`body-right`), sem limite de abas, e o define como container padrão. A partir daí, `open()` sem `containerKey` abre nele.

## Exemplo

```ts
// app.config.ts
providers: [
  provideSplitWindows(),
  provideAppInitializer(() => {
    // only body-right, no tab limit, as the default container
    inject(SplitContainerRegistry).useBodyContainers();
  }),
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

## Links

- Tela de demonstração: [`#/inicio`](http://localhost:4200/#/inicio) (rode `npm start`)
- Fonte: [apps/demo-angular/src/app/pages/quick-start.page.ts](../../apps/demo-angular/src/app/pages/quick-start.page.ts)
- Próximo: [Containers](containers.md)
