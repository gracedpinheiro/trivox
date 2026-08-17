# 4. Ciclo completo de treino

**Data:** 16/08/2026

## Pedido

Uma sequência de mensagens no mesmo ciclo: "o mais completo, mas por enquanto sem análise de
movimento; pegue todos os exercícios de cada app sem repetir; coloque a gamificação (XP, badges,
coach); telas com imagem do exercício, como executar e erros; cronômetro de descanso, gráfico de
evolução, histórico de cargas e séries" — seguido, ainda no mesmo ciclo, de três pedidos
adicionais: "equipamento ocupado → oferecer alternativa", "capacidade de gerar ficha por
objetivo (perda de peso, ganho de massa, condicionamento)" e "app mais alegre e inspirador, pode
mudar as cores".

## Pesquisa antes de construir

- **`getExercisePhotoUrl` do LOBAS** chamava `via.placeholder.com` (caixa colorida com texto) —
  não era foto de verdade, e dependeria de internet. Descartado como referência.
- **`askCoach` do VYRON** não é IA — é banco de frases por palavra-chave/regex. Replicado nesse
  molde: funciona offline, sem custo, sem API.
- **VYRON e LOBAS compartilham a mesma base de exercícios** (confirmado: os 100 exercícios do
  LOBAS aparecem 100% dentro do VYRON) — tratados como uma fonte só na hora de consolidar.

## Decisões

- **Imagem do exercício:** como não existe foto real em nenhum app antigo, optei por
  **pictogramas SVG por padrão de movimento** (~10 poses, conferidas visualmente via screenshot
  headless antes de aplicar — duas precisaram de retrabalho, uma tinha um bug visual de um path
  de comprimento zero).
- **Badges:** os 12 do VYRON checavam a semana de um programa fixo de calistenia de 12 semanas
  que este app não tem. Redesenhados pra checar dado real (sessões, streak, recordes de carga,
  platô quebrado, volume equilibrado, nº de fichas).
- **XP e níveis:** limiares (500/1.500/3.000) reaproveitados direto do VYRON, já testados em
  produção por ela.
- **Gerador automático de ficha:** split por nº de dias/semana (1=full body … 5+=bro split),
  filtra por nível e local, prioriza compostos, usa a mesma engine de prescrição do fluxo
  manual. Parâmetro `rotacao` varia a seleção sem depender de aleatoriedade real (resultado
  reproduzível, mas "gerar de novo" dá variedade).
- **Substituição por equipamento ocupado:** busca por músculos primários em comum + categoria
  irmã + equipamento diferente.
- **Cores mais alegres:** mantive o fundo escuro (prático pra academia, uma mão só, qualquer
  luz) mas troquei o azul metálico por um **gradiente vibrante azul→violeta→rosa**, mais uma cor
  de comemoração (âmbar) pra conquistas e treino concluído.
- **Spotify** (pedido no mesmo ciclo) foi **adiado pro ciclo 5** deliberadamente — Pilar 3 da
  skill (fechar ciclos antes de abrir outro). Bloqueio real também: precisa que a Grace crie um
  app em developer.spotify.com primeiro.

## Base de exercícios

**563 exercícios, sem repetição** — 501 do X IRON + 64 novos do LOBAS/VYRON (glúteos isolados,
alongamento, equilíbrio: três categorias que o X IRON não tinha). Achadas e corrigidas 2
duplicatas internas do próprio X IRON ("Kettlebell Complex" e "Step Aeróbico" apareciam 2x cada).

## Bug de ferramenta, não de app

Suspeitei de um bug real de CSS (botões cortados nas telas Fichas/Treinos) via screenshot
headless do Edge. Investigação mostrou que era o próprio `--window-size` do Edge headless não
sendo respeitado (viewport real ficava ~500px mesmo pedindo 430px) — confirmado com uma página de
debug medindo `window.innerWidth`. Resolvido usando um iframe de largura fixa como moldura de
teste. O CSS nunca teve o bug.

## Entregue

- `js/gamificacao.js` (XP, nível, badges, streak, coach), `js/pictogramas.js` (10 SVGs).
- Telas novas: exercício (dedicada, era modal), execução (com cronômetro), evolução (XP, streak,
  heatmap, badges, histórico de sessões), coach.
- Nav reorganizada: 🏠 Início · 📋 Treinos · ❤️ Aeróbico · 📈 Evolução · 👤 Perfil (Exercícios e
  Coach viraram cards na Início, pra não estourar 5 abas).
- 217 testes (67+59+44+47), todos passando.
