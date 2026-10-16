# 25 — Aparelho ocupado: fazer depois ou trocar

**Data:** 16/10/2026

## O que foi pedido
No meio do treino, com o aparelho ocupado e sem poder esperar, a Grace quis duas coisas:
1. Trocar o exercício por outro do mesmo grupo muscular.
2. Fazer o próximo exercício e voltar no que estava ocupado quando ele desocupar.

## Situação antes
- **A troca já respeitava o músculo.** `Forca.substitutos` só sugere exercícios com pelo
  menos um grupo muscular principal em comum, com outro equipamento e dentro do perfil. Isso
  não estava claro na tela.
- **Não havia como voltar.** "Pular exercício" só avançava, e o exercício pulado ficava sem
  fazer.

## O que foi feito
- **O botão "Aparelho ocupado"** abre um modal com as duas saídas:
  - **"Fazer depois"** (ação `fazer-depois` no `app.js`):
    - o exercício vai para o fim do próprio bloco (o principal continua antes do alongamento);
    - o treino segue no próximo exercício;
    - as séries já feitas vão junto, então ele volta na série em que parou;
    - na volta, a tela mostra "você deixou este para depois".
    - O botão só aparece se ainda houver outro exercício no mesmo bloco.
  - **"Ou troque por outro do mesmo músculo":** a lista de antes, agora dizendo quais músculos
    ela mantém (por exemplo, "Trabalham Peitoral Maior, com outro equipamento").
- **"Pular exercício" continua igual,** para quando não vai dar para fazer mesmo.

## Testes
- `..\trivox-testes\ciclo-fazer-depois.js`, teste novo:
  - o supino, adiado com 1 série feita, vai para o fim do bloco principal com a série
    guardada, e o treino segue na remada;
  - quando o supino volta, aparece o aviso;
  - no último exercício do bloco não há "Fazer depois";
  - a troca lista 12 opções do mesmo músculo;
  - nenhum erro na página.
- Seguem passando: `teste_gerador`, `teste_app_fluxos`, `layout-a11y`, `ciclo-feedback2`,
  `ciclo-ultima-vez`, `ciclo2`, `f4`, `f6` e `f7`.
