# 3. Planilha comparativa

**Data:** 16/08/2026

## Pedido

"Faça uma planilha das diferenças, o que uma tem que a outra não tem e o que você colocou na
versão nova. Compare todos os app de treino pra fazer a planilha."

## O que foi feito

Levantamento sistemático (grep + leitura de trechos) de X IRON v7, VYRON, R2 PRO v5, LOBAS
MOTION e TRIVOX v7.6, comparados contra o app novo em 10 blocos: identidade, base de exercícios,
montagem de ficha, prescrição/autorregulação, aeróbico, gamificação, execução/histórico,
recursos especiais, nuvem/conta, PWA/offline, marca.

## Achados principais

- **Nenhum dos 5 apps antigos tinha engine aeróbica real** nem RIR prescrevendo carga — únicos
  no app novo.
- **VYRON** é disparado o mais forte em gamificação (121 menções a badges, XP, coach por chat).
- **R2 PRO v5** é o único com análise de movimento por câmera (MediaPipe) — capacidade única,
  não migrada (fora de escopo por pedido explícito da Grace no ciclo seguinte).
- O app novo é o único **modular** (arquivos separados); os outros são HTML único de até 2,4 MB.
- Onde o app novo perdia pros antigos, na época: sem execução de treino, sem cronômetro de
  descanso, sem gráfico de evolução — motivou o ciclo 4.

## Entregue

[`comparativo-apps-treino.csv`](../comparativo-apps-treino.csv) — 75 linhas × 7 colunas, abre
direto no Excel (BOM UTF-8, separador `;`).
