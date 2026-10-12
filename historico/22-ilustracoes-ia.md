# 22 — Ilustrações por IA no "Como fazer"

**Data:** 12/10/2026

## O que foi pedido
A Grace achou que, em alguns exercícios, o boneco vetorial não ensinava bem. Ela escolheu
ilustrações geradas por IA num estilo único ("1-b") e pediu o maior número possível, de
preferência todas.

## O que foi feito
- **Imagens geradas no Canva**, todas com a mesma referência de estilo:
  - atleta jovem e sem gênero, camiseta coral, short verde-azulado e fundo azul-claro;
  - dois quadros por imagem, posição inicial → final.
- **Uma imagem por combinação de movimento + implemento + apoio**, as mesmas chaves de
  `data/figuras_mapa.json`. Os 361 movimentos principais vêm primeiro.
- **Já estão no app 317 imagens** (`data/ilustracoes/`, 1280x720, cerca de 50 KB cada):
  - 1021 dos 1535 exercícios têm imagem própria;
  - 441 usam a imagem do mesmo movimento com outro implemento;
  - 73 seguem com o boneco animado.
- **`ferramentas/indice_ilustracoes.js`** gera `data/ilustracoes/indice.json`, o mapa
  exercício → arquivo.
- **No app:**
  - a aba "Como fazer" mostra a ilustração com a legenda "posição inicial → final";
  - sem ilustração, a aba continua com o boneco;
  - a imagem entra no cache offline, no "Baixar todas as fotos" e nas fotos das fichas;
  - o service worker trata os jpgs como imutáveis (VERSAO `trivox-v36`).
- **Revisão:** cada imagem foi olhada antes de entrar. Algumas mostram o movimento, mas
  podem ser refeitas: patinador, step down, transferência de peso, caranguejo e tibial com
  elástico.

## Em aberto
- Continuar a partir do item #322. As 5 imagens já aprovadas e ainda não exportadas são:
  supino na bola, agachamento com rotação, oito com a raquete, escada ergométrica e bike em pé.
- Variações de implemento: hoje usam a imagem do movimento-base.
- Fotos dos aparelhos sem pessoas (pedido do teste no celular): ainda depende de decisão.

## Testes
- `teste_gerador`, `teste_figuras`, `teste_mapa_muscular`, `teste_fichas` e
  `teste_app_fluxos` OK.
- Navegador (`..\trivox-testes`), sem erro de console:
  - `ciclo-feedback2`, `ciclo-zerar`, `ciclo-objetivos`, `ciclo2`, `ciclo89`, `f4`, `f6`,
    `f7`;
  - `layout-a11y`: 0 estouros;
  - `ilus-check`: a ilustração carrega a 1280 px.
