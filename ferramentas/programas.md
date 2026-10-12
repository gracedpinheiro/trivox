# Programas do gerador de fichas

Fonte da verdade: `js/programas.js` (`Programas.PARAMS`, `MODELOS`, `SPLITS`, `ajustesPerfil`).
Quem monta as fichas: `Forca.gerarPrograma` / `Forca.gerarPlano` em `js/forca.js`.
Teste: `node ferramentas/teste_gerador.js` (e `--sintetico` para exercitar os campos novos da base).

## Parâmetros por objetivo × nível

Séries, RIR e descanso aparecem como **composto / isolado**. Reps como **compostos / isolados**.
Descanso em segundos (vai direto para o cronômetro). Aquecimento em minutos. Volume em séries
por músculo por semana. Ciclo = semanas de progressão + 1 de deload.

| Objetivo | Nível | Exercícios (principal) | Séries | Reps | RIR | Descanso (s) | Aquec. | Equilíbrio | Bloco final | Volume/sem | Ciclo |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Hipertrofia | iniciante | 5-6 | 3 / 2 | 8-12 / 10-15 | 2 / 3 | 90 / 60 | 8 | — | — | 8-12 | 5+1 |
| Hipertrofia | intermediário | 6-7 | 3 / 3 | 6-10 / 10-15 | 1 / 2 | 120 / 75 | 8 | — | — | 12-16 | 4+1 |
| Hipertrofia | avançado | 7-8 | 4 / 3 | 6-10 / 8-15 | 1 / 0 | 150 / 75 | 10 | — | — | 14-20 | 3+1 |
| Condicionamento | iniciante | 4 | 2 / 2 | 10-15 / 12-15 | 3 / 3 | 60 / 45 | 8 | — | intervalado 3 rodadas × 4 ex, 30s/30s | 6-10 | 4+1 |
| Condicionamento | intermediário | 4-5 | 3 / 2 | 8-12 / 12-15 | 2 / 2 | 75 / 45 | 8 | — | intervalado 4 × 5, 40s/20s | 8-12 | 4+1 |
| Condicionamento | avançado | 5 | 4 / 3 | 6-10 / 10-15 | 1 / 2 | 90 / 60 | 10 | — | EMOM 4 × 5, 45s/15s | 10-14 | 3+1 |
| Perda de peso | iniciante | 4 | 2 / 2 | 12-15 / 12-15 | 3 / 3 | 45 / 45 | 8 | — | superséries + intervalado 3 × 4, 30s/30s | 6-10 | 4+1 |
| Perda de peso | intermediário | 6 | 3 / 3 | 10-15 / 12-15 | 2 / 2 | 45 / 45 | 8 | — | superséries + intervalado 3 × 5, 40s/20s | 10-14 | 4+1 |
| Perda de peso | avançado | 6 | 4 / 3 | 8-12 / 12-15 | 1 / 2 | 60 / 45 | 8 | — | superséries + intervalado 4 × 5, 40s/20s | 12-16 | 3+1 |
| Especial 50+ | iniciante | 5-6 | 2 / 2 | 10-15 / 12-15 | 3 / 3 | 90 / 60 | 10 | 2 | — | 6-10 | 4+1 |
| Especial 50+ | intermediário | 6 | 3 / 2 | 8-12 / 10-15 | 2 / 3 | 90 / 60 | 10 | 2 | potência (subida rápida) | 8-12 | 4+1 |
| Especial 50+ | avançado | 6-7 | 3 / 3 | 6-10 / 10-12 | 2 / 2 | 120 / 75 | 10 | 2 | potência (subida rápida) | 10-14 | 4+1 |
| Especial raquete | iniciante | 6 | 2 / 2 | 10-12 / 12-15 | 3 / 3 | 75 / 45 | 10 | — | agilidade sem salto | 6-10 | 3+1 |
| Especial raquete | intermediário | 7 | 3 / 2 | 6-10 / 12-15 | 2 / 3 | 120 / 45 | 10 | — | pliometria baixa, ~60 contatos | 8-12 | 3+1 |
| Especial raquete | avançado | 7-8 | 4 / 3 | 4-8 / 12-15 | 2 / 3 | 150 / 45 | 12 | — | pliometria moderada, ~100 contatos | 10-14 | 3+1 |

Vagas de **prevenção** (manguito, escápula, antebraço, panturrilha/Aquiles, ativação): 2-3 × 12-15,
RIR 3, 45 s, com excêntrico lento. **Potência** (lançamento de medicine ball, pliometria): 2-4 × 5-8,
RIR 3, 90 s, parar quando a velocidade cai. **Agilidade**: 3-4 × 20-25 s, 45 s. **Equilíbrio**: 2-3 × 30 s
de cada lado, 30 s. Objetivo antigo `forca` vira hipertrofia com reps 3-6, RIR 2 e 210 s nos compostos.

## Estrutura semanal (dias → fichas)

| Objetivo | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| Hipertrofia iniciante | Corpo inteiro | CI A/B | CI A/B/C | Sup/Inf ×2 | Sup/Inf ×2 + CI | + CI |
| Hipertrofia intermediário | CI | Sup/Inf | Inf/Sup/CI | Sup/Inf ×2 | Empurrar/Puxar/Pernas + Sup/Inf | PPL ×2 |
| Hipertrofia avançado | CI | Sup/Inf | PPL | Sup/Inf ×2 | PPL + Sup/Inf | PPL ×2 |
| Condicionamento | Força+metcon A | A/B | A/B/Circuito total | repete | repete | repete |
| Perda de peso | Superséries+circuito A | A/B | A/B/Metabólico | repete | repete | repete |
| 50+ | Força funcional A | A/B | A/B/C | A/B/Mobilidade-equilíbrio/C | + Mob | + A + Mob |
| Raquete | CI para quadra | Pernas-agilidade / Ombro-braço | + Rotação-core-equilíbrio | + Condicionamento de quadra | + CI | + Ativação |

Fichas repetidas na semana (ex.: PPL ×2) usam os mesmos padrões de movimento com **exercícios diferentes**.

**Raquete com dias de jogo** (`diasJogo`): dia de jogo e véspera viram "Ativação pré-jogo"
(sem pliometria, sem perna pesada); os dias livres recebem o split do número de dias livres.
Em outros objetivos, treino pesado de perna é trocado de lugar para não cair na véspera/dia de jogo.

## Cada ficha

aquecimento → potência/agilidade → compostos → isolados → prevenção → equilíbrio → circuito →
volta à calma. Toda ficha começa com aquecimento e termina com alongamento, os dois escolhidos
pelos grupos musculares do dia (`montarBlocos` em `js/forca.js`):

- **Grupos do dia**: músculos primários do bloco principal (secundários contam 0,3) viram ~16
  grupos (`Programas.grupoMuscular`); entram os 2-4 mais trabalhados (≥ 30% do mais trabalhado).
- **Aquecimento** (2-4 itens): 1 cardio leve de 3-5 min (remo/elíptico em dia de superior,
  bike/esteira/step em dia de inferior; baixo impacto quando há restrição) + 1 ativação
  (manguito/escápula em dia de superior ou raquete, glúteo em dia de inferior) + mobilidade
  dinâmica mirando os grupos do dia. O 1º composto ganha a obs "Faça 1-2 séries de aproximação
  leves antes" (peso corporal: 1 série de uma versão mais fácil).
- **Volta à calma** (2-4 itens): ~1 alongamento estático de 30-45 s por grupo; só usa
  alongamento de grupo vizinho/geral se não houver um que mire o grupo. 65+ evita alongamento que
  exige deitar ou ajoelhar quando existe opção em pé/cadeira; nível ≤ intermediário e impacto
  baixo sempre; respeita casa/academia e o equipamento de casa.
- **Fichas manuais**: `Forca.completarSessao(exercicios, { base, local, idade, objetivo, nivel,
  equipCasa, rotacao })` faz o mesmo para qualquer lista de itens (itens sem `bloco` contam como
  principal). Idempotente: se já há aquecimento e volta à calma, devolve a mesma lista.

## Ajustes por perfil

| Condição | Ajuste |
|---|---|
| Objetivo 50+ ou idade ≥ 50 | sem impacto alto (saltos), sem olímpicos/invertidos/skills, ≥ 1 exercício de equilíbrio por ficha, +3 min de aquecimento (fora do 50+), +15 s de descanso, iniciante com RIR ≥ 2 |
| Objetivo 50+ | cardio/circuito só baixo impacto; exercícios no nível da pessoa (sem margem +1); iniciante sem barra fixa/argolas/paralelas |
| Idade ≥ 65 | só baixo impacto; exercícios até o nível da pessoa (máx. intermediário); sem barra fixa/argolas/paralelas; 2 de equilíbrio (3 × 30 s); RIR ≥ 2; reps ≥ 8; ≤ 3 séries; circuito ≤ 30 s de trabalho |
| Idade < 18 | RIR ≥ 2, sem exercícios de risco técnico |
| IMC ≥ 30 | sem impacto alto em nenhum bloco |
| IMC ≥ 35 | cardio/circuito só baixo impacto |
| Sexo f (padrão) | +1 vaga de glúteo nas fichas de corpo inteiro/inferior (hipertrofia, perda de peso, condicionamento) |
| Sexo m (padrão) | +1 isolado de ombro/braço nas fichas de corpo inteiro/superior (mesmos objetivos) |
| `enfase` explícita | `neutra`, `inferiores`, `superiores`, `gluteos` substitui o padrão por sexo |

A ênfase por sexo é só uma **preferência padrão**: troca uma vaga por ficha e nunca tira um
grupo muscular. A fisiologia do treino de força (séries, reps, RIR) é a mesma para homens e mulheres.

## Equipamento em casa (`equipCasa`)

Chaves = as do campo `aparelho` de `data/exercicios.json` (lista com rótulos em
`Programas.EQUIP_CASA_OPCOES`). Sempre disponíveis, sem marcar: peso corporal, parede,
colchonete, cadeira, toalha. Padrão quando o perfil não diz: + banco, degrau/step, mochila,
elástico, mini band, halteres, cones. Equivalências: kettlebell ← halteres; mini band ← elástico;
saco de areia ↔ mochila; banco ← cadeira; step ← banco; escada de agilidade ↔ cones.
Nomes antigos continuam aceitos (`aneis`→`argolas`, `rolo_espuma`→`foam_roller`, `bike`→`bicicleta`,
`battle_rope`→`corda_naval`, `pegada`→`hand_grip`, `step`→`degrau_step`...). Aparelho de academia
(máquinas, polia, esteira, bicicleta...) só entra em casa se a pessoa marcar que tem.

Sessões leves (ativação pré-jogo/véspera, mobilidade 50+) nunca recebem exercício de impacto
alto nem pliometria (saltos pogo, hops em cones, skater etc.).

## Progressão e deload

`Programas.progressao(objetivo, nivel)` devolve o texto por semana do ciclo. Resumo: hipertrofia
por dupla progressão (+reps até o topo da faixa, depois +2-5% de carga; intermediário/avançado
com +1 série nos compostos na semana de pico); condicionamento e perda de peso progridem densidade
(+5 s de trabalho, −5-10 s de descanso ou +1 rodada); 50+ sobe 0,5-1 kg ou 2 reps e tira o apoio
no equilíbrio; raquete sobe potência e pliometria. O deload é sempre a última semana do ciclo:
metade das séries e RIR +2 (raquete: sem pliometria; 50+: mantém o equilíbrio).

## Referências

- ACSM. Progression Models in Resistance Training for Healthy Adults. *Med Sci Sports Exerc*, 2009.
- ACSM. Appropriate Physical Activity Intervention Strategies for Weight Loss and Prevention of Weight Regain. *Med Sci Sports Exerc*, 2009.
- ACSM's Guidelines for Exercise Testing and Prescription, 11ª ed., 2021.
- NSCA. Essentials of Strength Training and Conditioning, 4ª ed., 2016.
- Fragala MS et al. Resistance Training for Older Adults: NSCA Position Statement. *J Strength Cond Res*, 2019.
- WHO. Guidelines on Physical Activity and Sedentary Behaviour, 2020.
- Schoenfeld BJ et al. Dose-response relationship between weekly resistance training volume and increases in muscle mass. *J Sports Sci*, 2017.
- Schoenfeld BJ et al. Longer interset rest periods enhance muscle strength and hypertrophy. *J Strength Cond Res*, 2016.
- Ellenbecker TS, Cools A. Rehabilitation of shoulder impingement syndrome and rotator cuff injuries. *Br J Sports Med*, 2010.
- Tyler TF et al. Addition of isolated wrist extensor eccentric exercise for chronic lateral epicondylosis. *J Shoulder Elbow Surg*, 2010.
- Alfredson H et al. Heavy-load eccentric calf muscle training for chronic Achilles tendinosis. *Am J Sports Med*, 1998.
- Davies G, Riemann BL, Manske R. Current concepts of plyometric exercise. *Int J Sports Phys Ther*, 2015.
