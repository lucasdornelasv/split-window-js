# Guias do SplitWindow

Um guia por tela do app de demonstração. O código de cada guia é o mesmo exibido na tela correspondente (constante `CODE` do arquivo da página), para que guia e demo fiquem alinhados.

Para abrir as telas, rode `npm start` na raiz do repositório e acesse `http://localhost:4200`. O app usa roteamento por hash (`#/inicio`, `#/containers`…).

| Guia                                        | Tela                                                 | Fonte                                                                            | Assunto                                                          |
| ------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| [Início rápido](inicio-rapido.md)           | [`#/inicio`](http://localhost:4200/#/inicio)         | [quick-start.page.ts](../../apps/demo-angular/src/app/pages/quick-start.page.ts) | `provideSplitWindows()`, `useBodyContainers()` e um `open()`     |
| [Containers](containers.md)                 | [`#/containers`](http://localhost:4200/#/containers) | [containers.page.ts](../../apps/demo-angular/src/app/pages/containers.page.ts)   | Diretiva, `registerContainer` e container padrão                 |
| [Containers do body](containers-do-body.md) | [`#/body`](http://localhost:4200/#/body)             | [body.page.ts](../../apps/demo-angular/src/app/pages/body.page.ts)               | Os quatro lados, `defaults`, `size`, `backdrop` e reconfiguração |
| [Modos e animação](modos-e-animacao.md)     | [`#/modos`](http://localhost:4200/#/modos)           | [modes.page.ts](../../apps/demo-angular/src/app/pages/modes.page.ts)             | `inline`/`push`/`overlay`, modos, motores de animação e DI       |
| [Abas e numeração](abas-e-numeracao.md)     | [`#/abas`](http://localhost:4200/#/abas)             | [tabs.page.ts](../../apps/demo-angular/src/app/pages/tabs.page.ts)               | Títulos, grupos, números, `setTitle()` e ativação                |
| [Limite de abas](limite-de-abas.md)         | [`#/limite`](http://localhost:4200/#/limite)         | [limits.page.ts](../../apps/demo-angular/src/app/pages/limits.page.ts)           | `maxTabs`, `onFull` e `onReject`                                 |
| [Fechamento](fechamento.md)                 | [`#/fechamento`](http://localhost:4200/#/fechamento) | [closing.page.ts](../../apps/demo-angular/src/app/pages/closing.page.ts)         | `closable`, `canClose`, `force` e fechar tudo                    |
| [Drag and drop](drag-and-drop.md)           | [`#/arraste`](http://localhost:4200/#/arraste)       | [drag.page.ts](../../apps/demo-angular/src/app/pages/drag.page.ts)               | Reordenar, mover, zonas de soltura e `canMove`                   |
| [Tela cheia](tela-cheia.md)                 | [`#/tela-cheia`](http://localhost:4200/#/tela-cheia) | [fullscreen.page.ts](../../apps/demo-angular/src/app/pages/fullscreen.page.ts)   | `expand`, `bounds`, tamanhos máximos e restrição de arraste      |
| [Eventos](eventos.md)                       | [`#/eventos`](http://localhost:4200/#/eventos)       | [events.page.ts](../../apps/demo-angular/src/app/pages/events.page.ts)           | Eventos da ref e do manager                                      |
| [Erros](erros.md)                           | [`#/erros`](http://localhost:4200/#/erros)           | [errors.page.ts](../../apps/demo-angular/src/app/pages/errors.page.ts)           | Erros de resolução, chaves reservadas e opções inválidas         |
| [Playground](playground.md)                 | [`#/playground`](http://localhost:4200/#/playground) | [playground.page.ts](../../apps/demo-angular/src/app/pages/playground.page.ts)   | Todas as opções, com o código equivalente                        |

Veja também o [README do adaptador Angular](../../packages/angular/README.md) (opções, tema, i18n, teclado) e o [README do core](../../packages/core/README.md) (para autores de adaptadores).
