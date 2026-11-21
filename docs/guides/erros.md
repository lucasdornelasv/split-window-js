# Erros

O SplitWindow não cai num container em silêncio: cada situação de configuração tem o seu erro, com uma mensagem em português que diz o que configurar, e os dados da mensagem expostos como propriedades. Todos estendem `SplitWindowError` (e `Error`), têm `name` igual ao nome da classe e são exportados por `@split-window/angular` e `@split-window/core`.

A resolução de container segue `options.containerKey ?? padrão`: chave informada e desconhecida lança `SplitContainerNotFoundError`; sem chave e sem padrão, `SplitNoDefaultContainerError`. Opções são validadas no registro e na abertura, e um valor inválido lança `SplitInvalidOptionError` com o nome da opção e o valor recebido.

## Exemplo

```ts
try {
  manager.open(NoteTabComponent, { containerKey: 'contratos' });
} catch (e) {
  if (e instanceof SplitContainerNotFoundError) {
    console.log(e.containerKey, e.availableKeys);
  }
}

// SplitContainerNotFoundError   unknown key, or a body side that is not enabled
// SplitNoDefaultContainerError  no containerKey and no default container
// SplitContainerFullError       tab limit with onReject: 'throw'
// SplitReservedContainerKeyError registerContainer('body-left', ...)
// SplitDuplicateContainerError  key already registered
// SplitInvalidOptionError       invalid option value
```

| Erro                             | Quando                                                                                     | Propriedades                                        | Mensagem (exemplo)                                                                                                                        |
| -------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `SplitContainerNotFoundError`    | `containerKey` sem container; `moveTo()` ou `setDefaultContainer()` com chave desconhecida | `containerKey`, `availableKeys`, `bodySideDisabled` | Nenhum container configurado com a chave 'contratos'. Containers disponíveis: body-right, esquerdo.                                       |
| `SplitContainerNotFoundError`    | Lado do body não habilitado                                                                | idem, `bodySideDisabled: true`                      | O container 'body-left' não está habilitado. Habilite-o com useBodyContainers().                                                          |
| `SplitNoDefaultContainerError`   | `open()` sem `containerKey` e sem padrão                                                   | `availableKeys`                                     | Nenhum container padrão configurado. Informe containerKey no open() ou defina um padrão com setDefaultContainer() ou useBodyContainers(). |
| `SplitContainerFullError`        | Limite com `onReject: 'throw'`, ou cadeia de redirecionamento esgotada                     | `containerKey`, `triedKeys`                         | O container 'limitado' está cheio. Containers tentados: limitado.                                                                         |
| `SplitReservedContainerKeyError` | `registerContainer`/`unregisterContainer` com chave `body-*`                               | `containerKey`                                      | A chave 'body-top' é reservada para os containers do body. Use useBodyContainers() ou escolha outra chave.                                |
| `SplitDuplicateContainerError`   | `registerContainer` com chave já registrada                                                | `containerKey`                                      | Já existe um container registrado com a chave 'x'. Para trocar o host, desregistre o container antes.                                     |
| `SplitInvalidOptionError`        | Opção com valor inválido                                                                   | `option`, `value`                                   | Valor inválido para 'maxTabs': 0. Esperado: inteiro maior que zero ou função.                                                             |

## Regras

- Exemplos de opções inválidas: chave vazia, `maxTabs` que não é inteiro maior que zero, `onFull`/`onReject` desconhecidos, `size` vazio, `closedDropZone` negativo, `maxWidth` fora de `px`/`vw`/`vh`/`%`, `title` que não é texto, `canClose` que não é função.
- Para trocar o host de um container, chame `unregisterContainer(key)` antes de registrar de novo (as abas recebem `dismiss('container-removed')`).
- Erros de `canClose` (exceção ou Promise rejeitada) não são lançados: a aba fica aberta e o erro vai para o console.
- Operações numa ref já fechada não lançam: `close`, `dismiss` e `moveTo` devolvem `false`, e os setters são ignorados.
- `onReject: 'cancel'` não lança: a ref volta com `rejected: true` e `result` rejeitado com `'container-full'`.

## Links

- Tela de demonstração: [`#/erros`](http://localhost:4200/#/erros)
- Fonte: [apps/demo-angular/src/app/pages/errors.page.ts](../../apps/demo-angular/src/app/pages/errors.page.ts)
- Código: [packages/core/src/errors/errors.ts](../../packages/core/src/errors/errors.ts)
