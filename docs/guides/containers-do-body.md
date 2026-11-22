# Containers do body

Os containers do body são até quatro painéis fixos nas bordas da janela, com chaves reservadas: `body-left`, `body-right`, `body-top` e `body-bottom`. Funcionam como o offcanvas do ng-bootstrap: cada um é criado no primeiro `open()` que cair nele, tem a mesma barra de abas dos outros containers e fecha quando fica vazio (`closeWhenEmpty` é `true` por padrão no body).

Nenhum lado vem habilitado. `useBodyContainers()` sem argumentos equivale a `{ right: true, default: 'right' }`. Com um objeto, habilita só os lados informados: `true` usa apenas os `defaults`, e um objeto sobrescreve qualquer opção para aquele lado. As opções aceitas são as de container (exceto `closedDropZoneAnchor`) mais `size` (largura em left/right, altura em top/bottom; padrão `'420px'`) e `backdrop`. `mode: 'push'` faz o painel empurrar a página em vez de abrir por cima (`overlay`, o padrão); veja [Modos e animação](modos-e-animacao.md).

Também dá para ligar direto no provide, sem `provideAppInitializer`: `provideSplitWindows({ bodyContainers: true })` equivale a `useBodyContainers()`, e um objeto é repassado como está. Os padrões de `containerDefaults.body` (modo, animação, `maxTabs`...) valem para os lados ligados das duas formas.

## Exemplo

```ts
provideSplitWindows({
  bodyContainers: true, // only body-right, as the default
  containerDefaults: { body: { mode: 'push', animation: true } },
});
```

```ts
registry.useBodyContainers(); // the same, at run time
```

```ts
registry.useBodyContainers({
  defaults: { maxTabs: 8, onFull: 'replace-lru' },
  left: { size: '320px' },
  right: true,
  top: { size: '30vh' },
  bottom: { size: '35vh', maxTabs: 4, onFull: 'reject', onReject: 'redirect-default' },
  default: 'left',
});
```

```ts
registry.useBodyContainers({
  right: { size: '40vw', backdrop: true },
  default: 'right',
});
```

```ts
registry.useBodyContainers({
  // push: the page gets padding-right while the panel is open; animated
  right: { size: '360px', mode: 'push', animation: true },
  default: 'right',
});
```

Abrindo num lado específico:

```ts
manager.open(NoteTabComponent, { containerKey: 'body-left', title: 'Aba left' });
```

## Regras

- **Reconfiguração:** `useBodyContainers` pode ser chamado de novo, antes ou depois de registrar outros containers. A configuração nova substitui a anterior: lados não informados são desabilitados, e as abas abertas neles recebem `dismiss('container-removed')`.
- Lados mantidos conservam as abas e recebem as opções novas. Um `maxTabs` menor que o número de abas abertas só vale para as próximas chegadas.
- O padrão só muda se `default` for informado. `default` apontando para um lado não habilitado lança `SplitContainerNotFoundError`.
- Desabilitar o lado que é o padrão faz o padrão voltar a ser automático: o primeiro container que restou.
- `mode: 'push'` soma `size` ao padding de `pushTarget` (padrão `document.body`) enquanto o container está aberto e define `--split-body-offset-<lado>` no `<html>`.
- `backdrop: true` bloqueia a página atrás do container enquanto ele está aberto. Clicar no backdrop **não** fecha abas.
- `open()` com `containerKey` de um lado não habilitado lança `SplitContainerNotFoundError` com a mensagem "O container 'body-left' não está habilitado. Habilite-o com useBodyContainers()."
- `registerContainer('body-…')` e `unregisterContainer('body-…')` lançam `SplitReservedContainerKeyError`; os lados só são controlados por `useBodyContainers`.
- Durante um arraste, um container do body fechado aparece como painel flutuante na sua borda da janela.
- O tamanho padrão vem de `bodySize` no `provideSplitWindows()`; a camada usa `--split-body-z-index` e o backdrop `--split-backdrop-bg`.

## Links

- Tela de demonstração: [`#/body`](http://localhost:4200/#/body)
- Fonte: [apps/demo-angular/src/app/pages/body.page.ts](../../apps/demo-angular/src/app/pages/body.page.ts)
