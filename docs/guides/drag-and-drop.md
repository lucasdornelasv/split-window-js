# Drag and drop

Arraste uma aba pela barra para reordená-la ou movê-la para outro container. Na barra de destino, a aba cai na posição do placeholder; na área de conteúdo, no fim da barra. O arraste usa o `DragDropModule` do Angular CDK e passa sempre pelo mesmo caminho do arraste programático, `ref.moveTo(containerKey, index?)`: o componente não é recriado (sem `ngOnDestroy`), e o seu estado continua.

Durante um arraste, todo container que pode receber a aba vira uma zona de soltura. Um container aberto destaca o contorno. Um container fechado (por `closeWhenEmpty`) aparece como um **painel flutuante** com o seu `label`; soltar ali reabre o container com a aba. A engine nunca decide: ela pergunta `canDrop` ao core, que aplica `maxTabs`, `canMove` e a restrição de container expandido.

## Exemplo

```html
<div splitContainer="origem"></div>
<div splitContainer="destino"></div>
<!-- closes when empty; while closed it shows a floating drop panel -->
<div
  splitContainer="fechavel"
  [splitContainerOptions]="{ closeWhenEmpty: true, label: 'Fechável' }"
></div>
```

```ts
// a tab that cannot leave its container
manager.open(NoteTabComponent, {
  containerKey: 'origem',
  title: 'Presa',
  canMove: (target) => target.containerKey === 'origem',
});

// programmatic move: same method as the drag
ref.moveTo('destino', 0);

manager.tabMoved.subscribe((e) => console.log(e.type, e.fromKey, '->', e.toKey));
```

## Regras

- **Na troca de container:** o número é recalculado no destino e liberado na origem ("Contrato (2)" pode virar "Contrato"); a aba movida fica ativa no destino; se era a ativa na origem, a vizinha é ativada; a origem vazia com `closeWhenEmpty` fecha, mas continua registrada.
- **Destino recusado** (`maxTabs` cheio ou `canMove` falso): a zona não se destaca e a aba volta à posição original. Em movimentos, as estratégias pré-definidas de `onFull` só rejeitam e `onReject` não se aplica.
- **`moveTo(key, index?)`:** sem `index`, vai para o fim. Lança `SplitContainerNotFoundError` para chave desconhecida. Devolve `true` se a aba mudou de lugar; `false` se o destino recusou (dispara `tabRejected` com `'move-refused'`). Abrir ou mover para um container fechado o reabre. Ignora a restrição de container expandido.
- **`canMove(target)`:** `target.index` fica ausente enquanto o cursor passa sobre um destino e presente no drop.
- **Painel flutuante:** tamanho padrão 220 × 120 px (`closedDropZone` no config ou por container). Fica centralizado sobre o host; se o host estiver com `display: none`, usa o último retângulo conhecido; se nunca foi medido, usa `closedDropZoneAnchor`; sem âncora, o container só recebe abas por `moveTo()`. Containers do body: na borda da janela.
- Soltar na área de conteúdo do próprio container de origem é ignorado. Soltar no mesmo lugar ou fora de uma lista gera só `dragEnded` com `moved: false`.
- **Container expandido:** o arraste fica restrito a ele (só reordena). Se a expansão mudar por API durante o arraste, o arraste é cancelado.
- Só a área do título arrasta; o botão de fechar e o conteúdo não iniciam arraste.
- **Teclado:** `Ctrl+Shift+←/→` reordena dentro da barra. Mover para outro container pelo teclado ainda não existe; use `moveTo()`.
- **Fora do Chromium:** sem `Element.moveBefore()` (Chrome 133+), o fallback é `appendChild`: iframes recarregam, vídeos reiniciam e o foco se perde ao mover.
- Eventos: `dragStarted`, `dragEnded`, `reordered` e `containerChanged` na ref; `tabMoved` no manager; `containerStateChanged` no manager.

## Links

- Tela de demonstração: [`#/arraste`](http://localhost:4200/#/arraste)
- Fonte: [apps/demo-angular/src/app/pages/drag.page.ts](../../apps/demo-angular/src/app/pages/drag.page.ts)
