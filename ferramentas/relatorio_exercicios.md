# Relatório — base de exercícios TRIVOX (data/exercicios.json)

Gerado por `ferramentas/enriquecer_exercicios.py` (reprodutível e idempotente). Exercícios novos ficam em
`ferramentas/novos_exercicios/*.txt` (um bloco por exercício); as fichas antigas reescritas ficam em
`ferramentas/novos_exercicios/_correcoes_existentes.txt`. Para regerar: `python3 ferramentas/enriquecer_exercicios.py`
(use `--dry` para só validar e ver as tabelas sem gravar).

## 1. O que havia

- 563 exercícios (499 `x_iron` + 64 `lobas`), 18 categorias.
- Níveis: 276 iniciante, 175 intermediário, 94 avançado, 17 elite e 1 com erro de digitação (`intermediante` em `func_trap_bar_dl`, corrigido).
- Não havia nenhum campo que dissesse **onde** treinar, **para qual objetivo**, o **impacto** ou o **aparelho** em formato padronizado (o `equipamento` era texto livre, com 100+ grafias).
- **106 fichas genéricas** (ids `*_batch3_*` e `func_battle_rope`): instruções do tipo "Execute X com técnica correta", erros comuns iguais em todo o bloco ("Técnica incorreta / Carga excessiva"), progressão apontando para o próprio exercício e músculos errados (ex.: Rosca de Punho marcada como Bíceps, Abdução Lateral como Quadríceps, Copenhagen como Reto Abdominal, Rotação Interna do manguito como Deltóides).
- Mistura de inglês e português nos nomes ("Desenvolvendo com Barra Sentado", "Flexão Explosive", "Flexão Uno Apoio").

## 2. Lacunas encontradas (antes)

Com a classificação aplicada só aos 563 antigos, as células local × nível × objetivo ficaram assim nos pontos fracos:

| célula | antes |
|---|---|
| academia × 50+ × avançado | 6 |
| casa × 50+ × avançado | 6 |
| academia × raquete × avançado | 7 |
| casa × raquete × avançado | 7 |
| casa × perda de peso × avançado | 22 (no limite, pouca variedade real) |

Lacunas qualitativas:
- **Casa**: quase nada usando o que a pessoa tem em casa (cadeira, mochila, toalha, degrau, mini band, bola suíça como resistência).
- **Academia**: faltavam máquinas comuns no Brasil — leg horizontal, glúteo máquina, flexora em pé, desenvolvimento máquina, supino inclinado/declinado máquina, rosca máquina, mergulho máquina, graviton, peck deck invertido, TRX (0 exercícios), bosu, elíptico, esteira inclinada.
- **50+**: só 8 exercícios de equilíbrio; nenhum de levantar/sentar da cadeira, levantar do chão, marcha em tandem, dupla tarefa, prevenção de quedas, pegada ou postura cervical.
- **Raquete**: nenhum split step, deslocamento cruzado, drop step, rotação de manguito a 90° (posição do smash/saque), extensores de punho (epicondilite), excêntrico de Aquiles, aterrissagem/desaceleração, agilidade com reação.
- **Condicionamento**: pouco cardio de baixo impacto alternativo (polichinelo sem salto, kickboxing, circuito na cadeira) e poucos ergômetros.

## 3. O que foi feito

1. **Todos os 563 ids preservados**, com todos os campos originais. Correções de texto: `intermediante`→`intermediario`, 5 nomes corrigidos, 1 erro de digitação nos erros comuns, e progressões autorreferentes substituídas por orientação de sobrecarga.
2. **106 fichas genéricas reescritas** (mesmo id): instruções passo a passo de 4-5 itens, erros comuns específicos, músculos primários/secundários corretos, progressão/regressão reais e, quando fazia sentido, séries/reps adequadas (ex.: isometrias em segundos).
3. **4 campos novos em TODOS os exercícios** (`local`, `objetivos`, `impacto`, `aparelho`), decididos com:
   - `aparelho`: tabela explícita revisada **id por id** para os 563 antigos (sem heurística por palavra-chave).
   - `local`: derivado do aparelho (doméstico barato → casa + academia) e corrigido por listas de exceção revisadas (ex.: exercícios de banco que funcionam com cadeira/sofá entram em casa; supino/crucifixo que exigem banco firme, muscle-up, bandeira humana e pull-up com cinto ficam só academia).
   - `impacto`: baixo por padrão; listas revisadas de médio (corda, polichinelo, balísticos com kettlebell/medicine ball, levantamentos olímpicos, agilidade) e alto (saltos, pliometria, sprints, burpee com salto, palmas).
   - `objetivos`: regras por categoria/padrão de movimento + listas revisadas manualmente (exclusões para 50+, inclusões para raquete, isolados fora de perda de peso etc.).
   - Os exercícios novos já trazem a classificação decidida um a um no próprio arquivo.
4. **230 exercícios novos** (`origem: "trivox_v2"`), todos no esquema completo (4-6 instruções, 2-4 erros comuns, músculos primários e secundários, séries/reps, progressão, regressão quando faz sentido, ícone, `weekUnlock` 1/5/9 conforme nível, `videoUrl: ""`). Todos os músculos usam o **vocabulário que já existia** no arquivo (nenhum nome novo), para o mapa anatômico.

| arquivo | prefixo | qtd | foco |
|---|---|---|---|
| casa.txt | `casa_` | 56 | cadeira, degrau, mochila, toalha, elástico, mini band, halteres, kettlebell, bola suíça, parede |
| academia.txt | `acad_` | 47 | máquinas/polias que faltavam, Smith, TRX, landmine, bosu, unilaterais, variações de pegada |
| s50.txt | `s50_` | 42 | força funcional, equilíbrio estático/dinâmico, quedas, marcha, pegada, postura, levantar do chão |
| raquete.txt | `rq_` | 49 | split step, agilidade (cones/escada), manguito a 90°, punho/antebraço, Aquiles, pliometria, desaceleração, rotação |
| condicionamento.txt | `hiit_` | 36 | HIIT, baixo impacto, kickboxing, complexos, ergômetros, AMRAP, Tabata |

- 67 novos com `fedb_id` (equivalente exato no free-exercise-db: mesmo movimento e mesmo equipamento; na dúvida, não foi colocado).
- Distribuição de nível dos novos: maioria iniciante/intermediário, com avançados em todos os blocos para não faltar progressão.

### Chaves de `aparelho` novas (5, além da lista fechada)

| chave | uso |
|---|---|
| `maquina_abdominal` | abdominal na máquina, rotação de tronco na máquina |
| `maquina_bracos` | tríceps máquina, rosca máquina, mergulho máquina |
| `pneu` | virada de pneu, marretadas |
| `saco_areia` | sandbag, atlas stone, objeto pesado, saco de pancadas |
| `hand_grip` | hand grip, bolinha de apertar, wrist roller |

Decisões de mapeamento a revisar na arte: "Bastão/PVC" (`mo_shoulder_cir`) → `elastico` (mesma função); "Barra T" → `landmine`; trap bar/safety bar/yoke/correntes → `barra`; GHR → `banco_romano`; graviton → `barra_fixa`; bola de tênis/reação → `raquete`.

## 4. Tabelas de contagem

<!-- TABELAS:INICIO -->
## Totais

- Total: **1535** exercícios (563 antigos preservados + 972 novos `trivox_v2`)


## Local × nível (elite contado à parte)

| local | iniciante | intermediario | avancado | elite | total |
|---|---|---|---|---|---|
| academia | 617 | 559 | 261 | 17 | 1454 |
| casa | 469 | 305 | 131 | 13 | 918 |

## Objetivo × nível

| objetivo | iniciante | intermediario | avancado | elite | total |
|---|---|---|---|---|---|
| condicionamento | 508 | 426 | 203 | 17 | 1154 |
| perda_peso | 222 | 262 | 122 | 0 | 606 |
| hipertrofia | 345 | 395 | 182 | 8 | 930 |
| 50mais | 549 | 141 | 20 | 0 | 710 |
| raquete | 250 | 232 | 77 | 0 | 559 |

## Células local × nível × objetivo (avançado inclui elite; meta ≥ 15)

| local | objetivo | iniciante | intermediario | avancado |
|---|---|---|---|---|
| academia | condicionamento | 464 | 409 | 210 |
| academia | perda_peso | 205 | 251 | 116 |
| academia | hipertrofia | 320 | 377 | 181 |
| academia | 50mais | 504 | 137 | 18 |
| academia | raquete | 234 | 226 | 74 |
| casa | condicionamento | 397 | 271 | 129 |
| casa | perda_peso | 147 | 162 | 63 |
| casa | hipertrofia | 189 | 180 | 86 |
| casa | 50mais | 383 | 78 | 20 |
| casa | raquete | 205 | 150 | 57 |

## Impacto

| impacto | qtd |
|---|---|
| baixo | 1363 |
| medio | 123 |
| alto | 49 |

## Aparelho

| aparelho | qtd | | aparelho | qtd |
|---|---|---|---|---|
| halteres | 180 | | hack | 10 |
| peso_corporal | 174 | | panturrilha_maquina | 10 |
| barra | 117 | | foam_roller | 9 |
| colchonete | 111 | | mesa_flexora | 9 |
| polia | 97 | | paralelas | 9 |
| elastico | 85 | | saco_areia | 9 |
| kettlebell | 75 | | treno | 9 |
| parede | 49 | | corda_naval | 8 |
| barra_fixa | 41 | | corda_pular | 8 |
| bola_suica | 34 | | supino_maquina | 8 |
| cadeira | 30 | | barra_ez | 7 |
| smith | 30 | | bosu | 7 |
| trx | 29 | | cadeira_extensora | 6 |
| crossover | 27 | | caixa_pliometrica | 6 |
| landmine | 27 | | maquina_bracos | 6 |
| medicine_ball | 27 | | remada_baixa | 6 |
| banco | 26 | | gluteo_maquina | 5 |
| degrau_step | 24 | | remo_ergometro | 5 |
| mochila | 22 | | voador_peck_deck | 5 |
| cones | 20 | | cadeira_abdutora | 4 |
| toalha | 19 | | escada_agilidade | 4 |
| mini_band | 16 | | hand_grip | 4 |
| argolas | 14 | | raquete | 4 |
| leg_press | 13 | | remada_maquina | 4 |
| puxador_pulley | 13 | | roda_abdominal | 4 |
| anilha | 12 | | eliptico | 3 |
| banco_inclinado | 12 | | pneu | 3 |
| banco_romano | 12 | | cadeira_adutora | 2 |
| esteira | 11 | | desenvolvimento_maquina | 2 |
| bicicleta | 10 | | maquina_abdominal | 2 |

Chaves da lista que não aparecem em nenhum exercício: —

## Novos por categoria

pernas: 143, ombros: 106, funcional: 102, core: 85, cardio: 79, gluteos: 73, costas: 72, pernas_cal: 62, peito: 55, biceps: 55, triceps: 39, mobilidade: 35, alongamento: 28, equilibrio: 20, empurrar: 14, core_cal: 3, puxar: 1

## Novos com fedb_id: 331


Todas as 30 células local × nível × objetivo têm ≥ 15 exercícios.
<!-- TABELAS:FIM -->

## 5. Observações profissionais

**Como o app deve usar os campos**
- `50mais` = seguro para iniciantes acima de 50 anos (baixo impacto, sem salto, sem inversão, sem carga axial pesada). Nos exercícios **avançados** marcados `50mais` (19), a leitura é "adequado para o praticante 50+ já treinado". Nenhum exercício de impacto médio/alto tem `50mais` (a validação do script garante isso para impacto alto).
- `impacto` não é dificuldade: ele mede choque/aterrissagem. Para fichas 50+, perda de peso com sobrepeso, ou dor articular, filtre `impacto == "baixo"`.
- `elite` continua no arquivo (17 exercícios). Nas tabelas acima elite está somado ao avançado nas células; se o app expuser só 3 níveis, recomendo tratar elite como avançado **com desbloqueio extra** (são skills de calistenia).
- A célula "50+ avançado" é naturalmente menor (17-19); as demais têm muito mais de 15.

**Exercícios antigos que considero arriscados para iniciantes 50+ (ficaram SEM `50mais`)**
- Carga axial pesada / coluna flexionada sob carga: agachamento livre e variações com barra, levantamento terra e variações, stiff/terra romeno com barra, bom dia (barra e Good Morning), remada curvada com barra, cavalinho/T-bar, rack pull, Jefferson curl.
- Ombro em posição de impacto subacromial: remada alta (barra, cabo, kettlebell), desenvolvimento atrás da nuca, Arnold press, mergulho em paralelas e tríceps no banco/cadeira, dislocate com bastão/elástico.
- Inversões/cabeça abaixo do coração: pike push-up (todas), flexão declinada, HSPU, bananeira.
- Flexão de coluna repetida (osteopenia/osteoporose): crunch e variações, abdominal na máquina/polia, russian twist, V-crunch, abdominal reverso, elevação de pernas, flutter/tesoura, hollow.
- Outros: pull-up/chin-up e negativos (para iniciante 50+, prefira puxada no pulley ou graviton), sissy squat, cossack, pombo, sapo e couch stretch (torção/flexão extrema de joelho), supino reto/inclinado/declinado com barra sem auxiliar.

**Inconsistências antigas que mantive (para não quebrar histórico), mas que valem atenção**
- Duplicatas de movimento com ids diferentes: Wall Sit / Cadeirinha / Wall Squat; Monster Walk ×2; Extensão Lombar na Bola ×2; Hip Thrust ×4; Afundo búlgaro ×2; Pullover ×2; Remada T-bar ×2; Prancha ×2; Cat-Cow ×2. O app pode agrupar por `aparelho` + padrão para evitar que a mesma ficha repita "o mesmo exercício com outro nome".
- `lb_cr12` (Rollout, avançado) estava com `weekUnlock: 1` e alguns intermediários com `weekUnlock: 1` (vindos da origem `lobas`). Não alterei porque pode ser intencional nessa origem; sugiro revisar.
- `cal_nordic` e `pe_batch3_extra_7` (nórdicos) são ótimos para prevenção, mas causam muita dor muscular tardia: introduzir com volume baixo (2×3).

**Raquete — orientações para montar fichas**
- Beach tennis (areia, muitos saltos, smash): priorizar `rq_re_90_elastico`, `rq_d2_elastico`, `rq_panturrilha_excentrica`, `rq_pogo`, `rq_salto_smash`, `rq_aterrissagem`, `rq_mb_smash` e mobilidade torácica.
- Pickleball (deslocamentos curtos, joelho baixo, punho): `rq_split_step`, `rq_kitchen_drill`, `rq_afundo_lateral_dink`, `rq_shuffle_cones`, `rq_extensao_punho`, `rq_tyler_twist`, `rq_pronacao_supinacao`, `rq_agach_espanhol` (tendão patelar).
- Pliometria (impacto alto) no máximo 2x/semana, sempre depois do aquecimento e antes da força; em 50+ substituir por `rq_aterrissagem` e pelas versões sem salto.
