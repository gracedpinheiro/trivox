# 23 — Visual sóbrio

**Data:** 16/10/2026

## O que foi pedido
A Grace achou o visual infantilizado e poluído. Ela pediu algo menos poluído e mais
sofisticado.

## O que foi feito
- **Continua claro**, porque no ciclo 17 ela pediu "nada escuro". Agora o fundo é off-white
  quente, os cartões são brancos com borda fina e quase sem sombra, e o texto é grafite.
- **Uma cor de destaque:** o coral do logo, em botões principais, barras de progresso e no
  ícone da aba ativa.
  - As cores vivas saíram dos fundos de cartão e das abas.
  - Elas aparecem só pequenas e com significado: filete à esquerda dos avisos, bolinha dos
    blocos do treino, zonas de frequência e o anel do intervalado (trabalho/descanso).
- **Fonte do sistema** (SF no iPhone, Roboto no Android) no lugar de Baloo 2 e Nunito, que são
  arredondadas e infantis. A pasta `fonts/` saiu do projeto e do cache offline.
- **Barra de baixo fixa**, com ícones de traço desenhados em SVG (`icone()` no `ui.js`) no
  lugar dos emojis. A aba ativa fica em grafite, sem a pílula colorida.
- **Emojis decorativos** saíram do começo de títulos, avisos, botões e abas. Ficam só nas
  conquistas (badges), que são parte da gamificação.
- **Tela inicial:** os atalhos ganharam ícones de traço. O cartão de nível deixou de ser em
  degradê e virou um cartão branco com barra coral. Saíram o 👋 e o confete do fundo.
- **Cronômetro:** número em peso leve e anel mais fino.
- **Fotos e ilustrações** dos exercícios não mudaram.
- **Service worker:** VERSAO `trivox-v38`, e `theme-color` / manifest com a cor de fundo nova.

## Testes
- Rodaram sem erro:
  - `teste_gerador`, `teste_figuras`, `teste_mapa_muscular`, `teste_fichas` e
    `teste_app_fluxos`;
  - no navegador, `ilus-check`, `ciclo-feedback2`, `ciclo-zerar`, `ciclo-objetivos`, `ciclo2`,
    `ciclo89`, `f4`, `f6` e `f7`.
- `layout-a11y`: 0 estouros em 360 px e nenhum erro de console. As fotos de antes ficaram em
  `..\trivox-testes\screenshots\antes\`.
- Contraste das cores novas conferido: texto sobre fundo com 4,5:1 ou mais.
  - O `a11y-contraste.js` ainda compara as cores antigas, que estão fixas no próprio script.
