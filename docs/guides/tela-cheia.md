# Tela cheia

Ao lado do botão de fechar tudo, a barra de abas tem um botão de tela cheia (⤢). Por padrão, ele expande o container para ocupar a janela inteira. A opção de container `expand` limita a expansão a uma área de referência (`bounds`), com tamanhos máximos, margem e alinhamento; `expand: false` esconde o botão. O shell passa a `position: fixed` com o retângulo calculado, acima da página, enquanto o host continua no lugar com o tamanho original, para o layout não pular.

Clicar de novo no botão, apertar Esc (com o foco dentro do container) ou chamar `manager.restoreContainer(key)` restaura. Só um container fica expandido por vez, e enquanto isso o arraste de abas fica restrito a ele.

## Exemplo

```html
// default: the whole window
<div splitContainer="janela"></div>

// limited to a reference area, with max sizes, margin and alignment
<div
  splitContainer="area"
  [splitContainerOptions]="{
  expand: { bounds: '#area-referencia', maxWidth: 640, maxHeight: '80%', margin: 16, align: 'start' }
}"
></div>

// no full screen button
<div splitContainer="sem-expandir" [splitContainerOptions]="{ expand: false }"></div>
```

```ts
// API
manager.expandContainer('janela');
manager.restoreContainer('janela');
manager.containerStateChanged.subscribe(({ key, expanded }) => ...);
```

| Opção de `expand`        | Padrão       | Descrição                                                                              |
| ------------------------ | ------------ | -------------------------------------------------------------------------------------- |
| `bounds`                 | `'viewport'` | Área de referência: `'viewport'`, um `HTMLElement`, um seletor CSS ou `() => DOMRect`. |
| `maxWidth` / `maxHeight` | —            | Número (px) ou texto em `px`, `vw`, `vh` ou `%` (da área de referência).               |
| `margin`                 | `0`          | Espaço livre dentro da área, em px.                                                    |
| `align`                  | `'center'`   | `'center' \| 'start' \| 'end'`: posição na área quando o tamanho máximo é menor.       |
| `restoreOnEscape`        | `true`       | Esc restaura o container.                                                              |

## Regras

- `expandContainer` é ignorado com `expand: false` ou com o container fechado. Expandir um container restaura o que estava expandido.
- Se o container expandido ficar vazio e fechar, ele é restaurado.
- O retângulo é recalculado no `resize` da janela e por um `ResizeObserver` na referência.
- **Ancestral que quebra o `position: fixed`** (`transform`, `filter`, `contain`, `will-change`, `perspective`, `backdrop-filter`, `container-type`): a engine mede o shell e, se a posição não bater, move o shell para uma camada no body enquanto estiver expandido. No demo, o container "transformado" mostra esse caso.
- **Esc** só vale com o foco dentro do shell e se o evento não foi tratado antes (`defaultPrevented`); o Esc que fecha um modal de confirmação aberto pelo `canClose` não restaura o container.
- **Arraste:** com um container expandido, as abas só são reordenadas dentro dele, mesmo que outro container esteja sob o cursor. O botão de tela cheia fica desabilitado durante um arraste; mudar a expansão por API no meio de um arraste o cancela. `moveTo()` continua permitido.
- **Camadas:** o shell expandido usa `--split-expanded-z-index` (1050); a prévia de arraste usa `--split-drag-preview-z-index` (1070), acima dele.
- `isContainerExpanded(key)` consulta o estado; `containerStateChanged` emite `{ key, open, expanded }`.
- Valores inválidos (`maxWidth: '80em'`, `margin: -1`, `align: 'top'`, `bounds: ''`) lançam `SplitInvalidOptionError`.

## Links

- Tela de demonstração: [`#/tela-cheia`](http://localhost:4200/#/tela-cheia)
- Fonte: [apps/demo-angular/src/app/pages/fullscreen.page.ts](../../apps/demo-angular/src/app/pages/fullscreen.page.ts)
