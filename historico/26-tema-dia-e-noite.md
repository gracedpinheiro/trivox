# 26 — Tema dia e noite

**Data:** 16/10/2026

## O que foi pedido
A Grace pediu a opção de fundo dia e fundo noite. Isso muda o "nada escuro" do ciclo 17, que
era a única opção até aqui.

## O que foi feito
- **Perfil › Aparência** tem três botões: **Dia** (padrão), **Noite** e **Automático**, que
  segue o tema do celular e troca junto se o celular mudar com o app aberto.
- **A escolha é do aparelho, não do perfil.**
  - Fica em `localStorage` na chave `trivox-tema`, fora das chaves `at:`.
  - Não vai para o backup nem para a nuvem e continua depois do "Começar do zero".
- **Sem piscar:** um script curto no `<head>` do `index.html` aplica o tema antes de desenhar
  a tela. A troca de tema fica em `ui.js` (`aplicarTema` / `escolherTema`), que também troca a
  `theme-color`, a cor da barra do celular.
- **Cores do tema noite:** um bloco `:root[data-tema="noite"]` no `estilo.css` que só redefine
  as variáveis.
  - Fundo `#111214`, cartões `#1A1B1F` e texto `#EDEDEA`.
  - O botão principal continua coral com texto branco.
  - Textos coloridos (rótulos, etiquetas, avisos) usam tons mais claros.
  - O mapa muscular usa tons escuros.
  - O "Automático" é resolvido no JS, então as cores não se repetem num `@media`.
- **Cores fixas trocadas por variáveis:** barra de baixo, chip e aba ativos (texto na cor do
  fundo) e trilho do anel do cronômetro.
- **Ilustrações, fotos e o boneco animado** têm fundo próprio e ficam iguais nos dois temas.
- **Service worker:** VERSAO `trivox-v39`.

## Testes
- `..\trivox-testes\ciclo-tema.js`, teste novo:
  - o padrão é Dia, mesmo com o celular no escuro;
  - Noite troca o fundo e a `theme-color`;
  - Automático segue o celular;
  - a escolha continua depois de recarregar;
  - nenhum texto abaixo de 4,5:1 de contraste no tema noite (Início, Treinos, Evolução,
    Perfil);
  - nenhum erro na página.
  - Fotos das telas no escuro: `screenshots\tema-noite-*.png`.
- Seguem passando, no tema dia:
  - `teste_gerador`, `teste_figuras`, `teste_mapa_muscular`, `teste_fichas` e
    `teste_app_fluxos`;
  - `layout-a11y`, `ilus-check`, `ciclo-ultima-vez`, `ciclo-fazer-depois`, `ciclo-feedback2`,
    `ciclo-zerar`, `ciclo-objetivos`, `ciclo2`, `ciclo89`, `f4`, `f6` e `f7`.
