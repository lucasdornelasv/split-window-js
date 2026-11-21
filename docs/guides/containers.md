# Containers

Um container é uma área registrada por chave, ligada a uma div da aplicação em qualquer posição da página. Cada container tem o seu próprio stack de abas e a sua barra. Ele pode ser registrado pelo template, com a diretiva `splitContainer`, ou por código, com `registry.registerContainer(key, host, options)`. O registry só guarda a definição: o shell visual é criado na primeira vez que uma aba é aberta ou movida para o container.

O container de cada `open()` é resolvido em cascata, `options.containerKey ?? padrão`. O padrão é definido por `setDefaultContainer(key)`, pelo input `splitContainerDefault` da diretiva ou pelo `default` de `useBodyContainers`. Uma chave informada que não existe lança `SplitContainerNotFoundError`, em vez de cair no padrão em silêncio.

## Exemplo

```html
<!-- by directive, anywhere in the page -->
<div splitContainer="esquerdo"></div>
<div splitContainer="direito" [splitContainerOptions]="{ label: 'Painel direito' }"></div>
```

```ts
// by code
registry.registerContainer('programatico', hostElement, { maxTabs: 4 });

// open in a container, or in the default one
manager.open(NoteTabComponent, { containerKey: 'esquerdo', title: 'Esquerdo' });
registry.setDefaultContainer('direito');
manager.open(NoteTabComponent); // goes to 'direito'
```

No demo, o container programático é registrado no `ngAfterViewInit` (quando o `viewChild` do host já existe) e desregistrado no `ngOnDestroy`:

```ts
ngAfterViewInit(): void {
  this.registry.registerContainer('programatico', this.host().nativeElement, { maxTabs: 4 });
}

ngOnDestroy(): void {
  this.registry.unregisterContainer('programatico');
}
```

## Regras

- A diretiva registra no `ngOnInit` e desregistra no destroy. Um `open()` no `ngOnInit` de um componente posterior já encontra o container.
- Desregistrar fecha as abas com `dismiss('container-removed')`, sem passar pelo `canClose`. Um container dentro de um `@if` ou de uma rota perde as abas quando o host sai da tela.
- Trocar a chave da diretiva desregistra a antiga e registra a nova. `[splitContainerDefault]="true"` define o padrão; `false` remove o padrão se ele for esse container.
- Registrar uma chave já registrada lança `SplitDuplicateContainerError` (desregistre antes para trocar o host). Chaves `body-*` são reservadas (`SplitReservedContainerKeyError`).
- Desregistrar o container padrão deixa a aplicação sem padrão até um novo `setDefaultContainer`.
- `setDefaultContainer(null)` remove o padrão; `getDefaultContainer()` devolve `null` até ser configurado.
- `label` é o nome exibido na zona de soltura (padrão: a chave). `closeWhenEmpty` é `false` por padrão nos containers da aplicação: sem abas, a barra fica vazia com o texto `labels.emptyContainer`.
- Consultas: `hasContainer(key)`, `getContainerKeys()`, `isContainerOpen(key)`.

## Links

- Tela de demonstração: [`#/containers`](http://localhost:4200/#/containers)
- Fonte: [apps/demo-angular/src/app/pages/containers.page.ts](../../apps/demo-angular/src/app/pages/containers.page.ts)
