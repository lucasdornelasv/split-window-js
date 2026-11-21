# Abas e numeração

A numeração é calculada por grupo + título, dentro de cada container, como no Explorador de Arquivos: a primeira aba de cada par nunca mostra número, e as seguintes recebem " (2)", " (3)" e assim por diante. Sem `title`, o título é `labels.defaultTitle` ("Nova aba"); sem `groupKey`, a aba fica no grupo default. `ref.title` é o título puro, e `ref.label` é o texto da barra, com o número.

O número é fixado na abertura e não muda quando outras abas fecham: se "Contrato" fechar, "Contrato (2)" continua "(2)". Uma aba nova pega o menor número livre, então depois de fechar "Contrato" a próxima volta a ser "Contrato". Só duas coisas mudam o número de uma aba: o `setTitle()` dela e a troca de container.

## Exemplo

```ts
// numbering per group + title, inside each container
manager.open(NoteTabComponent, { containerKey: 'abas', title: 'Contrato' }); // Contrato
manager.open(NoteTabComponent, { containerKey: 'abas', title: 'Contrato' }); // Contrato (2)
manager.open(NoteTabComponent, { containerKey: 'abas', title: 'Contrato', groupKey: 'B' }); // Contrato
manager.open(NoteTabComponent, { containerKey: 'abas' }); // Nova aba

// open without activating
manager.open(NoteTabComponent, { containerKey: 'abas', activate: false });

// rename: the tab moves to the new pair and gets a new number
ref.setTitle('Proposta');
```

Listar as abas de um container, na ordem da barra:

```ts
const refs = manager.getTabs('abas');
refs.map((ref) => `${ref.label} (grupo ${ref.groupKey ?? 'default'})`);
```

| Abertura                                         | Rótulos                                 |
| ------------------------------------------------ | --------------------------------------- |
| Sem título, 3 vezes                              | Nova aba · Nova aba (2) · Nova aba (3)  |
| "Contrato", 2 vezes                              | Contrato · Contrato (2)                 |
| Títulos diferentes no mesmo grupo                | Sem número                              |
| "Contrato" 1 vez no grupo A e 2 vezes no grupo B | A: Contrato · B: Contrato, Contrato (2) |

## Regras

- `setTitle()` libera o número antigo e calcula um novo no novo título. As outras abas não mudam. Dispara `titleChanged` com `{ title, label }`.
- A contagem é independente por container: mover "Contrato (2)" para outro container pode fazê-la virar "Contrato" lá.
- `activate: false` abre a aba sem ativá-la, **exceto** se o container estiver vazio: a primeira aba sempre fica ativa, para a área de conteúdo nunca ficar em branco.
- `ref.activate()` ativa a aba no container atual. As inativas ficam ocultas, com change detection desligado, sem serem destruídas.
- Fechar a aba ativa ativa a vizinha da direita; sem ela, a da esquerda.
- Dentro do componente, `SplitActiveWindow.setTitle()` e os signals `title()`, `label()` e `isActive()` dão o mesmo controle.

## Links

- Tela de demonstração: [`#/abas`](http://localhost:4200/#/abas)
- Fonte: [apps/demo-angular/src/app/pages/tabs.page.ts](../../apps/demo-angular/src/app/pages/tabs.page.ts)
