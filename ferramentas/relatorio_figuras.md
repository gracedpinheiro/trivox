# Relatório — ilustrações vetoriais dos exercícios (`js/figuras.js`)

Gerado por código, sem rede e sem IA de imagem: boneco articulado (cinemática direta + IK de 2 ossos) com roupa colorida, aparelhos desenhados e animação SMIL em loop entre 2–4 quadros-chave. Com `prefers-reduced-motion` (ou `{quadros:true}`) mostra as posições lado a lado, sem animar. Tema claro: coral, turquesa, amarelo-sol, roxo, azul e verde.

## Números

| item | valor |
|---|---|
| exercícios na base | 1535 (689 com foto real, 846 sem foto) |
| exercícios mapeados para um template | **1535 (100%)** |
| caem no template `generico` | **0** |
| caem no fallback por categoria | 0 (a heurística por categoria só age em exercício novo, fora do mapa) |
| templates de movimento | 368 (361 usados pela base; 7 reservas/variantes) |
| vista lateral / frontal (exercícios) | 1181 / 354 |
| exercícios com implemento na mão diferente do padrão do template (`p`) | 541 |
| exercícios com apoio trocado (`a`: cadeira, bola, step, TRX…) | 100 |
| implementos de mão (props) | 24 |
| cenários / máquinas | 54 |
| ilustrações de aparelho (`Figuras.aparelho`) | 60 — todas as chaves do campo `aparelho` |
| `js/figuras.js` | **223 KB** (código 180 KB + mapa embutido 43 KB) |
| `data/figuras_mapa.json` | 89 KB (fonte canônica, legível) |
| SVG animado médio por exercício | ~15 KB de string (cache interno por template+implemento) |

## API

```js
Figuras.svg(exercicio, { largura: 280, genero: "m"|"f", quadros: true|false })  // string <svg> animada (role="img", aria-label pt-BR)
                                                                       // quadros ausente -> segue prefers-reduced-motion
Figuras.aparelho("leg_press", { largura: 200 })   // <figure> com SVG estático + <figcaption> "Leg press 45°"
Figuras.temImagem(exercicio)                       // true (sempre há template)
Figuras.carregar([url])                            // Promise; o mapa já vem embutido. Com url, recarrega um JSON no formato do figuras_mapa.json
Figuras.template(exercicio)                        // {t, p, a, m, via:"mapa"|"heuristica"} (debug)
Figuras.TEMPLATES / Figuras.APARELHOS / Figuras.PROPS / Figuras.CENARIOS
```

**Decisão sobre o mapa:** embutido no JS (bloco `<MAPA-GERADO>`, formato compacto: índice do template em base 36 + implemento + apoio), porque ficou bem abaixo de 150 KB e assim `Figuras.svg()` funciona de forma síncrona, offline e sem corrida com o primeiro render. `data/figuras_mapa.json` continua sendo gerado (é a fonte legível) e `Figuras.carregar(url)` permite trocar o mapa sem rebuild. Exercício que não estiver no mapa (ex.: criado depois) cai numa heurística por `categoria` + `aparelho`.

**Formato do `figuras_mapa.json`:** `{ "pe_agachu": { "t": "agachamento", "p": "barra", "v": "lado" }, ... }` — `t` template, `p` implemento na mão (ausente = padrão do template; `"-"` = nenhum), `a` apoio/cenário trocado, `v` vista, `m` reservado ("espelhar").

**Integração sugerida (ui.js):** no detalhe do exercício, `Figuras.svg(ex, {largura: 300, genero: perfil.sexo === "mulher" ? "f" : "m"})` ao lado do `MapaMuscular.svg(...)`; quando houver foto real, mostrar a foto e oferecer a ilustração como alternativa (aba "Animação"). Na tela de aparelhos/filtros: `Figuras.aparelho(ex.aparelho)`. Incluir `js/figuras.js` no `index.html` e no cache do `sw.js`.

## Como regenerar / testar

```
python3 ferramentas/mapear_figuras.py              # regras + exceções manuais -> data/figuras_mapa.json + bloco no js
python3 ferramentas/mapear_figuras.py --revisar costas   # lista id | nome | aparelho -> template, por categoria
node ferramentas/teste_figuras.js                  # 1535 exercícios + 60 aparelhos; falha se alguma animação quebrar
abrir ferramentas/demo_figuras.html (file://)      # grade com 67 exercícios + todos os aparelhos; botões animação/quadros e boneco/boneca
```

Mapeamento: regras ordenadas por nome/categoria/equipamento (`template()`), implemento por `aparelho` + pistas no nome, apoio por pistas no nome, e um dicionário `EXC` com ~850 correções manuais revisadas categoria por categoria (ex.: "Rosca Martelo na Corda" → `rosca` + `polia`; "Búlgaro na Cadeira com Mochila" → `bulgaro` + `mochila` + apoio `cadeira`).

## Screenshots (verificação visual)

- `ferramentas/demo_figuras_exercicios_1.png`, `_2.png`, `_3.png` — 67 exercícios em modo quadros (posição inicial → final)
- `ferramentas/demo_figuras_animado.png` — mesma grade capturada durante a animação
- `ferramentas/demo_figuras_feminino.png` — variante `genero:"f"` (legging + rabo de cavalo)
- `ferramentas/demo_figuras_aparelhos.png` — as 60 ilustrações de aparelho

## Implementos de mão (props)

`barra`, `barra_ez`, `bastao`, `halteres`, `halter`, `kettlebell`, `kettlebells`, `medicine_ball`, `anilha`, `saco_areia`, `mochila`, `raquete`, `hand_grip`, `bola_tenis`, `polia`, `crossover`, `elastico`, `toalha`, `trx`, `mini_band`, `landmine`, `corda_naval`, `corda_pular`, `smith`

## Cenários e máquinas

`banco`, `banco_inclinado`, `banco_declinado`, `cadeira`, `degrau`, `caixa`, `parede`, `colchonete`, `bola_suica`, `bosu`, `foam_roller`, `barra_fixa`, `paralelas`, `argolas`, `cones`, `escada_agilidade`, `esteira`, `parede_alvo`, `trx`, `leg_press`, `hack`, `extensora`, `flexora`, `flexora_sentada`, `puxador`, `remada_baixa`, `remada_maquina`, `alavanca`, `peck_deck`, `banco_romano`, `panturrilha_maquina`, `panturrilha_sentada`, `scott`, `abdutora`, `gluteo_maquina`, `maquina_abdominal`, `bicicleta`, `eliptico`, `remo`, `treno`, `treno_corda`, `pneu_chao`, `pneu_virando`, `marreta`, `graviton`, `mesa`, `cadeira_capitao`, `desenv_frente`, `parede_fundo`, `roda`, `bola_pes`, `rolo_sob`, `bola_parede`, `cones_frente`

## Templates e quantos exercícios usam cada um

| template | nome | vista | exercícios | exemplos |
|---|---|---|---:|---|
| `rosca` | Rosca bíceps | lado | 36 | Rosca Direta; Rosca Martelo |
| `agachamento` | Agachamento | lado | 26 | Agachamento Livre; Agachamento Corporal |
| `barra_fixa` | Barra fixa | frente | 20 | Pull-up Negativo; Pull-up (Barra Fixa) |
| `flexao` | Flexão de braços | lado | 20 | Flexão de Braços; Flexão Larga |
| `remada_curvada` | Remada curvada | lado | 20 | Remada Curvada; Remada Cavalinho |
| `stiff` | Stiff / levantamento romeno | lado | 19 | Stiff; Terra Romeno |
| `supino` | Supino reto | lado | 19 | Supino Reto; Supino com Halteres |
| `burpee` | Burpee | lado | 16 | Burpee; Tabata de Burpees |
| `elevacao_lateral` | Elevação lateral | frente | 16 | Elevação Lateral; Elevação Lateral Sentado |
| `hip_thrust` | Elevação pélvica (hip thrust) | lado | 16 | Hip Thrust; Hip Thrust Barra |
| `afundo` | Afundo (avanço) | lado | 15 | Split Squat; Avanço (Lunge) |
| `clean` | Clean (arranco ao peito) | lado | 15 | Power Clean; Arranque e Arremesso |
| `caminhada_carga` | Caminhada com carga | lado | 14 | Farmers Walk; Yoke Carry |
| `triceps_testa` | Tríceps testa | lado | 14 | Tríceps Testa; JM Press |
| `corrida` | Corrida | lado | 13 | Corrida Estacionária; Sprint de 30m |
| `desenvolvimento` | Desenvolvimento (em pé) | frente | 13 | Desenvolvimento; Desenvolvimento Arnold |
| `step_up` | Subida no step/banco | lado | 13 | Step Up; Step Up com Halteres |
| `afundo_lateral` | Afundo lateral | frente | 12 | Cossack Squat; Matriz de Afundos (Lunge Matrix) |
| `leg_press` | Leg press | lado | 12 | Leg Press 45°; Leg Press Pegada Ampla |
| `ponte` | Ponte de glúteo | lado | 12 | Ponte de Glúteo; Glute Bridge |
| `triceps_pulley` | Tríceps na polia | lado | 12 | Tríceps Pulley; Tríceps Corda |
| `abdominal` | Abdominal (crunch) | lado | 11 | Crunch; Crunch Oblíquo |
| `afundo_reverso` | Afundo reverso | lado | 11 | Afundo Reverso no Landmine; Afundo Reverso |
| `front_lever` | Front lever | lado | 11 | Front Lever; Tuck Front Lever |
| `kb_swing` | Kettlebell swing | lado | 11 | Kettlebell Swing; AMRAP com Kettlebell |
| `rosca_punho` | Rosca de punho | lado | 11 | Rosca de Punho (Flexão de Punho); Extensão de Punho com Halter (Prevenção de Epicondilite) |
| `elevacao_y` | Elevação em Y | frente | 10 | W Raise; Elevação Y (Trapézio Inferior) |
| `abducao_em_pe` | Abdução de quadril em pé | frente | 9 | Ativação do Glúteo; Abdução com Elástico |
| `bulgaro` | Agachamento búlgaro | lado | 9 | Agachamento Búlgaro; Búlgaro com Salto |
| `crucifixo_inverso_deitado` | Crucifixo inverso no banco inclinado | frente | 9 | Crucifixo Inverso Deitado no Banco Inclinado; Crucifixo Inverso com Rotação Externa |
| `encolhimento` | Encolhimento de ombros | frente | 9 | Encolhimento de Ombros; Encolhimento com Barra |
| `extensao_lombar` | Extensão lombar no banco romano | lado | 9 | Extensão Lombar; Extensão de Quadril no Banco Romano (Foco Glúteo) |
| `mergulho` | Mergulho nas paralelas | lado | 9 | Paralela (Dips); Dips nos Anéis |
| `panturrilha_pe` | Elevação de panturrilha em pé | lado | 9 | Panturrilha Unilateral; Panturrilha em Pé no Smith |
| `panturrilha_sentado` | Panturrilha sentado | lado | 9 | Panturrilha Sentado; Elevação de Panturrilha Sentado |
| `pular_corda` | Pular corda | frente | 9 | Pular Corda; Double Under |
| `remada_alta` | Remada alta | frente | 9 | Remada Alta; Remada Alta no Cabo |
| `rosca_scott` | Rosca Scott | lado | 9 | Rosca Scott; Rosca na Máquina |
| `stiff_unilateral` | Stiff unilateral | lado | 9 | RDL Unilateral; Stiff Unilateral |
| `supino_chao` | Supino no chão | lado | 9 | Supino no Chão; Supino no Chão Unilateral |
| `supino_maquina` | Supino na máquina | lado | 9 | Supino na Máquina; Supino na Máquina Convergente |
| `agachamento_frontal` | Agachamento frontal | lado | 8 | Agachamento Zercher; Front Squat |
| `bike` | Bicicleta ergométrica | lado | 8 | Assault Bike; Bicicleta Indoor (Spinning) |
| `equilibrio` | Equilíbrio unipodal | lado | 8 | Equilíbrio Unilateral; Step Balance |
| `hack` | Hack squat | lado | 8 | Hack Squat; Hack Machine |
| `inclinacao_lateral` | Inclinação lateral | frente | 8 | Alongamento de Latíssimo; Lateral do Tronco |
| `pegada` | Pegada (segurar/apertar) | lado | 8 | Treino de Pegada com Hand Grip; Rolo de Punho (Wrist Roller) |
| `pike_pushup` | Pike push-up | lado | 8 | Pike Push-up; Pike Push-up Elevado |
| `planche` | Planche / apoio grupado | lado | 8 | Tuck Planche; Planche Lean |
| `puxada` | Puxada (pulldown) | frente | 8 | Puxada Frontal; Puxada Máquina |
| `remada_trx` | Remada no TRX | lado | 8 | Remada no TRX; Remada Rotacional no TRX |
| `rotacao_em_pe` | Rotação de tronco em pé | frente | 8 | Rotação Torácica na Parede; Rotação Torácica com Bola |
| `supino_em_pe` | Supino em pé (cabo/elástico) | lado | 8 | Supino Isométrico no Cabo; Supino em Pé no Cabo |
| `terra` | Levantamento terra | lado | 8 | Levantamento Terra; Rack Pull |
| `triceps_frances` | Tríceps francês | lado | 8 | Tríceps Francês; Tríceps Francês Unilateral |
| `crossover` | Crossover (crucifixo no cabo) | frente | 7 | Crossover; Fly de Cabo Alto |
| `crucifixo_inverso` | Crucifixo inverso (posterior) | frente | 7 | Pássaro (Posterior); Extensão Lateral Curvada |
| `elevacao_lateral_uni` | Elevação lateral unilateral | frente | 7 | Elevação Lateral no Cabo; Elevação Lateral Inclinada |
| `flexao_inclinada` | Flexão inclinada (mãos elevadas) | lado | 7 | Flexão nos Anéis Inclinada; Flexão Archer na Bola |
| `mountain_climber` | Mountain climber | lado | 7 | Mountain Climber; Mountain Climber Lento |
| `pallof` | Pallof press | lado | 7 | Pallof Press; Pallof Press com Elástico |
| `panturrilha_chao` | Elevação de panturrilha | lado | 7 | Elevação de Panturrilha com Joelho Flexionado (Sóleo); Elevação de Calcanhares com Apoio |
| `pulldown_ajoelhado` | Puxada ajoelhado na polia alta | lado | 7 | Puxada com Elástico; Puxada Unilateral Ajoelhado na Polia Alta |
| `remada_unilateral` | Remada unilateral apoiada | lado | 7 | Remada Unilateral; Serrote (Remada Haltere) |
| `rotacao_externa` | Rotação externa de ombro | frente | 7 | Rotação Interna e Externa de Ombro; Rotação Externa |
| `supino_inclinado` | Supino inclinado | lado | 7 | Supino Inclinado; Supino com Halteres Inclinado |
| `thruster` | Thruster | lado | 7 | Thruster; Complexo com Halteres (Remada-Clean-Press-Agachamento) |
| `barra_fixa_supinada` | Barra fixa supinada (chin-up) | frente | 6 | Chin-up; Chin-up Pegada Fechada |
| `bom_dia` | Bom dia (good morning) | lado | 6 | Bom Dia (Good Morning); Good Morning |
| `caminhada` | Caminhada | lado | 6 | Caminhada Rápida (Treino de Marcha); Caminhada na Ponta dos Pés e nos Calcanhares |
| `coice_em_pe` | Coice em pé | lado | 6 | Glúteo no Cabo; Extensão de Quadril no Cabo |
| `crucifixo` | Crucifixo | lado | 6 | Crucifixo; Crucifixo com Carga Passiva |
| `desenvolvimento_sentado` | Desenvolvimento sentado | frente | 6 | Desenvolvimento Sentado com Halteres; Desenvolvimento com Barra Sentado |
| `deslocamento_lateral` | Deslocamento lateral (shuffle) | frente | 6 | Circuito de Agilidade; Passadas Laterais |
| `extensora` | Cadeira extensora | lado | 6 | Cadeira Extensora; Extensora Unilateral |
| `face_pull` | Face pull | lado | 6 | Face Pull; Face Pull com Corda |
| `flexao_esfinge` | Flexão esfinge | lado | 6 | Prancha para Flexão; Prancha Sobe e Desce (Up-Down) |
| `landmine_press` | Landmine press | lado | 6 | Landmine Press; Landmine Press Anti-rotação |
| `marcha` | Marcha (joelho alto) | lado | 6 | Elevação de Quadril com Cabo; Marcha com Joelho Alto |
| `panturrilha_maquina` | Panturrilha na máquina em pé | lado | 6 | Panturrilha em Pé; Panturrilha Donkey |
| `prancha_lateral` | Prancha lateral | frente | 6 | Prancha Lateral; Prancha Lateral com Remada no Kettlebell |
| `pulldown_estendido` | Pulldown de braços estendidos | lado | 6 | Pulldown de Braços Estendidos; Pulldown de Braços Estendidos com Elástico |
| `remada_invertida` | Remada invertida | lado | 6 | Remada nos Anéis; Remada Invertida |
| `roda_abdominal` | Roda abdominal | lado | 6 | Ab Wheel; Ab Wheel com Barra |
| `rosca_alternada` | Rosca alternada | lado | 6 | Rosca Zottman; Rosca Alternada em Pé |
| `tibial_sentado` | Dorsiflexão sentado | lado | 6 | Dorsiflexão com Elástico (Tibial Anterior); Dorsiflexão com Elástico (Tibial) |
| `tornozelo` | Mobilidade de tornozelo | lado | 6 | Mobilidade de Tornozelo; Mobilidade de Tornozelo na Parede |
| `treno_puxar` | Arrastar trenó | lado | 6 | Arrasto de Trenó; Remada no Trenó |
| `triceps_coice` | Tríceps coice | lado | 6 | Tríceps Coice; Tríceps Coice Inclinado |
| `v_up` | V-up (canivete) | lado | 6 | Suitcase Crunch; Abdominal V com Torção |
| `woodchop` | Wood chop (alto para baixo) | frente | 6 | Wood Chop no Cabo; Chop no Cabo |
| `agachamento_parede` | Agachamento na parede | lado | 5 | Cadeirinha (Wall Sit); Agachamento na Parede (Wall Squat) |
| `agachamento_salto` | Agachamento com salto | lado | 5 | Agachamento com Salto; Agachamento com Giro 180° |
| `agachamento_sumo` | Agachamento sumô | frente | 5 | Agachamento Sumô; Agachamento Sumô com Kettlebell |
| `coice` | Coice em 4 apoios | lado | 5 | Coice no Smith (Glúteo em 4 Apoios); Coice com Halter na Dobra do Joelho |
| `corda_naval` | Corda naval | lado | 5 | Battle Rope; Corda Naval: Ondas Laterais |
| `crunch_polia` | Abdominal ajoelhado na polia | lado | 5 | Crunch na Polia; Crunch Cabo Avançado |
| `dead_bug` | Dead bug | lado | 5 | Dead Bug; Dead Bug com Bola Suíça |
| `elevacao_frontal` | Elevação frontal | lado | 5 | Elevação Frontal; Elevação Frontal no Cabo |
| `flexao_declinada` | Flexão declinada (pés elevados) | lado | 5 | Flexão com Pés Elevados; Flexão com Anel de Ginástica Declinado |
| `flexao_parede` | Flexão na parede | lado | 5 | Flexão na Parede; Prancha Inclinada na Parede |
| `flexora_deitado` | Mesa flexora | lado | 5 | Mesa Flexora; Mesa Flexora Deitado |
| `hiper_reversa` | Hiperextensão reversa | lado | 5 | Hiperextensão Reversa no Banco; Hiperextensão Reversa |
| `mergulho_banco` | Tríceps no banco (mergulho) | lado | 5 | Tríceps no Banco; Tríceps Banco |
| `nordico` | Nórdico | lado | 5 | Nordic Curl; Nordic Curl Isométrico |
| `parada_mao` | Parada de mão | lado | 5 | Bananeira na Parede; Bananeira Livre |
| `pistol_apoio` | Agachamento unilateral com apoio | lado | 5 | Pistol Squat Assistido na Caixa; Pistol Squat com TRX |
| `ponte_pes_elevados` | Ponte com pés elevados | lado | 5 | Ponte de Glúteo com Pés na Cadeira; Ponte com Pés no TRX |
| `prancha` | Prancha | lado | 5 | Prancha; Prancha Frontal |
| `remada_apoiada` | Remada com apoio no peito | lado | 5 | Seal Row; Remada com Apoio no Peito |
| `remada_sentada` | Remada sentada no cabo | lado | 5 | Remada Baixa; Remada Aberta no Cabo |
| `remo` | Remo ergômetro | lado | 5 | Remo Ergômetro; Sprint no Remo Ergômetro |
| `rotacao_externa_90` | Rotação externa a 90° | frente | 5 | Rotação Externa a 90° com Elástico; Rotação Interna a 90° com Elástico |
| `salto_lateral` | Saltos laterais | frente | 5 | Salto Lateral na Caixa; Saltos Laterais sobre Cones |
| `superman` | Superman | lado | 5 | Superman; Cobra Pronada |
| `alongamento_peitoral` | Alongamento de peitoral | lado | 4 | Alongamento de Peitoral; Peitoral na Parede |
| `arremesso_cima` | Arremesso acima da cabeça | lado | 4 | Arremesso Unilateral Acima da Cabeça (Simulação de Smash); Arremesso 90/90 de Bola Leve na Parede |
| `arremesso_rotacional` | Arremesso rotacional | frente | 4 | Arremesso Rotacional com Medicine Ball; Arremesso Rotacional Baixo (Scoop Toss) |
| `cadeira_abdutora` | Cadeira abdutora | frente | 4 | Abdução de Quadril; Abdução de Quadril Máquina |
| `caminhada_lateral` | Caminhada lateral | frente | 4 | Monster Walk com Elástico; Monster Walk |
| `cars_quadril` | Círculos de quadril em pé | lado | 4 | Círculo de Quadril em Pé; Círculos de Quadril Unipodal |
| `corrida_esteira` | Corrida na esteira | lado | 4 | Corrida na Esteira Desligada; Corrida Intervalada na Esteira |
| `crossover_baixo` | Crossover de baixo para cima | frente | 4 | Fly de Cabo Baixo; Crossover Baixo Cruzado |
| `desenvolvimento_unilateral` | Desenvolvimento unilateral | frente | 4 | Press com Kettlebell Invertido; Press com Kettlebell |
| `escada_agilidade` | Escada de agilidade | lado | 4 | Escada de Agilidade; Escada de Agilidade: Icky Shuffle |
| `escada_ergometrica` | Escada ergométrica | lado | 4 | Escada Ergométrica Contínua (Stairmaster); Escada Ergométrica com Subida Lateral |
| `extensao_joelho_sentado` | Extensão de joelho sentado | lado | 4 | Extensão de Joelho Sentado; Extensão de Joelho na Polia Baixa |
| `gato_camelo` | Gato-camelo | lado | 4 | Gato-Camelo; Série de Mobilidade de Pulsos |
| `hollow` | Hollow body | lado | 4 | Hollow Body Hold; Hollow Body Rock |
| `hspu` | Flexão em parada de mão | lado | 4 | HSPU Negativo; Handstand Push-up |
| `passe_peito` | Arremesso de peito | lado | 4 | Arremesso de Peito com Medicine Ball; Arremesso Tipo Peso (Shot Put) com Medicine Ball |
| `passo_cruzado` | Passo cruzado lateral | frente | 4 | Passo Cruzado de Recuperação (Crossover Step); Passo Cruzado (Grapevine) com Apoio |
| `peck_deck` | Voador (peck deck) | frente | 4 | Peck Deck; Fly na Máquina Inclinado |
| `pendurado` | Suspensão na barra | frente | 4 | Dead Hang; Scapular Pull-up |
| `pes_rapidos` | Pés rápidos | lado | 4 | Pés Rápidos (Fast Feet); Drop Step e Recuo para o Lob |
| `pullover` | Pullover | lado | 4 | Pull-Over; Pull-Over com Extensão de Tríceps |
| `push_press` | Push press | lado | 4 | Push Press; Push Jerk |
| `puxada_fechada` | Puxada com pegada fechada | frente | 4 | Puxada Supinada; Puxada Fechada no Triângulo |
| `rosca_inclinada` | Rosca no banco inclinado | lado | 4 | Rosca Inclinada; Rosca Banco Inclinado Bilateral |
| `rotacao_cabo` | Rotação de tronco (cabo/elástico) | frente | 4 | Rotação com Landmine; Pallof Press Rotacional |
| `rotacao_sentado` | Rotação de tronco sentado | frente | 4 | Rotação de Tronco na Máquina; Rotação de Tronco Sentado |
| `salto` | Salto vertical | lado | 4 | Salto Vertical Máximo; Aterrissagem Controlada (Drop and Stick) |
| `segurar` | Sustentação com carga | lado | 4 | Pinça com Anilhas (Plate Pinch); Pinça de Anilhas |
| `sentado_90_90` | Mobilidade 90/90 | lado | 4 | Mobilidade 90/90; Bretzel |
| `sentar_levantar` | Sentar e levantar da cadeira | lado | 4 | Circuito de Baixo Impacto na Cadeira; Sentar e Levantar da Cadeira |
| `sissy` | Sissy squat | lado | 4 | Sissy Squat; Sissy Squat Assistido |
| `sit_up` | Abdominal completo (sit-up) | lado | 4 | Abdominal no Banco Declinado; Abdominal 3/4 (Sit-Up Parcial) |
| `slam` | Slam (arremesso no chão) | lado | 4 | Medicine Ball Slam; Slam Ball Acima da Cabeça |
| `snatch` | Snatch (arranco) | lado | 4 | Snatch; Muscle Snatch |
| `treno` | Empurrar trenó | lado | 4 | Empurrão de Trenó; Sprint com Trenó |
| `triceps_frances_cabo` | Tríceps acima da cabeça no cabo | lado | 4 | Tríceps Francês no Cabo; Tríceps no Cabo Acima da Cabeça |
| `trx_frente` | Flexão / crucifixo inclinado no TRX | lado | 4 | Flexão no TRX; Fallout no TRX |
| `wall_slide` | Deslizamento na parede | frente | 4 | Deslizamento na Parede com Elástico (Serrátil); Deslizamento na Parede com Mini Band |
| `ytw` | Y-T-W deitado | lado | 4 | Y-T-W Deitado; Solta e Pega a Bola Deitado de Bruços (Ombro 90/90) |
| `abdominal_bracos` | Abdominal com braços estendidos | lado | 3 | Crunch com Braços Estendidos Acima da Cabeça; Crunch com Medicine Ball Estendida |
| `abdominal_infra` | Abdominal infra (reverso) | lado | 3 | Abdominal Reverso no Banco; Abdominal Reverso na Polia Baixa |
| `afundo_ajoelhado` | Alongamento do flexor do quadril (meio ajoelhado) | lado | 3 | Alongamento do Flexor do Quadril; Flexor de Quadril |
| `afundo_caminhando` | Passada (afundo caminhando) | lado | 3 | Passada Alternada; Passada com Barra (Afundo Caminhando) |
| `bom_dia_sentado` | Bom dia sentado | lado | 3 | Bom Dia Sentado com Barra; Good Morning Sentado com Barra |
| `boxe` | Boxe (socos) | lado | 3 | Treino no Saco de Pancadas; Boxe de Sombra (Shadow Boxing) |
| `caminhada_esteira` | Caminhada na esteira | lado | 3 | Caminhada Inclinada na Esteira; Caminhada de Costas na Esteira Inclinada |
| `carregamento_abraco` | Caminhada abraçando carga | lado | 3 | Carregamento de Objeto Pesado; Carregamento de Saco de Areia |
| `concha` | Concha (clamshell) | frente | 3 | Clamshell; Concha Reversa (Rotação Interna Deitado) |
| `copenhagen` | Prancha Copenhagen | frente | 3 | Prancha Copenhagen; Adução Copenhagen Curta |
| `crossover_medio` | Crossover na altura do peito | frente | 3 | Chest Fly Isométrico; Crucifixo em Pé com Elástico |
| `crucifixo_inclinado` | Crucifixo inclinado | lado | 3 | Crucifixo Inclinado; Crucifixo Inclinado no Cabo |
| `desenvolvimento_ajoelhado` | Desenvolvimento meio ajoelhado | lado | 3 | Desenvolvimento Landmine Meio-Ajoelhado Unilateral; Desenvolvimento Meio Ajoelhado com Kettlebell |
| `diagonal` | Diagonal de ombro (saque) | frente | 3 | Diagonal D2 com Elástico (Saque/Smash); Diagonal D2 no Cabo (Movimento de Saque) |
| `dislocate` | Deslocamento de ombros com bastão | lado | 3 | Dislocate com Elástico; Dislocação de Ombros |
| `elevacao_pernas` | Elevação de pernas deitado | lado | 3 | Elevação de Pernas; Descida de Pernas (Leg Lowering) |
| `eliptico` | Elíptico | lado | 3 | Elíptico Intervalado; Elíptico de Ré (Pedalada Reversa) |
| `flexao_diamante` | Flexão diamante | lado | 3 | Flexão Diamante; Flexão Diamante Isométrica |
| `flexao_explosiva` | Flexão explosiva | lado | 3 | Flexão com Palmas; Flexão Explosiva na Caixa |
| `flexora_deslizante` | Flexora deslizante | lado | 3 | Flexora Deslizante com Toalha; Flexora no TRX |
| `flexora_sentado` | Cadeira flexora | lado | 3 | Mesa Flexora Sentado; Cadeira Flexora |
| `forehand` | Golpe de forehand | frente | 3 | Golpes de Sombra com Raquete; Forehand com Elástico |
| `pescoco` | Mobilidade do pescoço | frente | 3 | Flexão Lateral de Pescoço; Série de Mobilidade Cervical |
| `pistol` | Agachamento unilateral (pistol) | lado | 3 | Pistol Squat; Agachamento Unilateral no Smith (Pistol no Smith) |
| `polichinelo` | Polichinelo | frente | 3 | Polichinelo; Polichinelo Cruzado |
| `postura_crianca` | Postura da criança | lado | 3 | Child's Pose; Extensão Torácica com Cotovelos no Banco |
| `prancha_bola` | Prancha com antebraços na bola | lado | 3 | Prancha com Antebraços na Bola Suíça; Rollout na Bola Suíça |
| `prancha_lateral_joelhos` | Prancha lateral nos joelhos | frente | 3 | Prancha Lateral com Joelhos Apoiados; Prancha Lateral nos Joelhos com Abdução |
| `remada_em_pe` | Remada em pé (cabo/elástico) | lado | 3 | Remada Elástico; Remada com Toalha na Porta |
| `remada_maquina` | Remada na máquina | lado | 3 | Remada na Máquina; Remada Alta na Máquina (High Row) |
| `rolo_coxa` | Liberação no rolo (coxa) | lado | 3 | Liberação de Quadríceps no Foam Roller; Liberação de Trato Iliotibial no Foam Roller |
| `rolo_panturrilha` | Liberação no rolo (pernas) | lado | 3 | Liberação de Panturrilha no Foam Roller; Liberação de Isquiotibiais no Foam Roller |
| `rosca_spider` | Rosca spider / deitado de bruços | lado | 3 | Rosca Spider; Rosca Deitado de Bruços |
| `rotacao_deitado` | Rotação de ombro deitado de lado | frente | 3 | Rotação Interna de Ombro Deitado; Rotação Externa de Ombro Deitado |
| `salto_distancia` | Salto em distância | lado | 3 | Salto em Distância; Salto do Sapo |
| `serratil` | Protração escapular (soco para o teto) | lado | 3 | Soco para o Teto com Halter (Serrátil); Protração Escapular Deitado com Halteres |
| `step_lateral` | Subida lateral no step | frente | 3 | Step-Up Lateral no Degrau; Step-Up Lateral com Halteres no Banco Alto |
| `step_up_joelho` | Subida no step com joelho alto | lado | 3 | Step Aeróbico; Toques Rápidos no Degrau |
| `supino_bola` | Supino na bola suíça | lado | 3 | Supino com Halteres na Bola Suíça; Pullover com Halter Apoiado na Bola Suíça |
| `tibial` | Elevação de ponta de pé (tibial) | lado | 3 | Elevação de Ponta de Pé na Parede (Tibial); Elevação de Ponta de Pé no Smith (Tibial) |
| `torcao_deitado` | Torção de coluna deitado | lado | 3 | Torção Espinhal; Coluna em Rotação Deitada |
| `windmill` | Windmill | frente | 3 | Windmill; Windmill com Halter |
| `abducao_deitado` | Abdução deitado de lado | frente | 2 | Abdução Lateral Deitado; Abdução Deitado de Lado com Halter |
| `aducao_em_pe` | Adução de quadril em pé | frente | 2 | Adução em Pé no Cabo; Adução em Pé com Elástico |
| `aducao_sentado` | Adução isométrica sentado | frente | 2 | Adução Isométrica Sentado com Almofada entre os Joelhos; Adução Isométrica Sentado com Almofada |
| `afundo_cruzado` | Afundo cruzado (curtsy) | frente | 2 | Afundo Cruzado (Curtsy Lunge); Afundo Cruzado com Halteres |
| `afundo_salto` | Afundo com salto | lado | 2 | Fenda Pliométrica; Afundo com Salto Alternado (Split Jump) |
| `agachamento_banco` | Agachamento até o banco | lado | 2 | Agachamento na Caixa; Agachamento com Halteres até o Banco |
| `agachamento_bola_parede` | Agachamento com bola na parede | lado | 2 | Agachamento com Bola Suíça na Parede; Agachamento Unilateral com Bola Suíça na Parede |
| `agachamento_overhead` | Agachamento overhead | lado | 2 | Agachamento Overhead; Agachamento com Barra Overhead |
| `agachamento_profundo` | Agachamento profundo (mobilidade) | lado | 2 | Deep Squat Hold; Mobilidade de Agachamento Profundo com Kettlebell |
| `agachamento_pulso` | Agachamento com pulsos | lado | 2 | Agachamento com Socos; Agachamento com Pulsos (Squat Pulse) |
| `alongamento_panturrilha` | Alongamento de panturrilha na parede | lado | 2 | Panturrilha na Parede; Alongamento de Sóleo e Tendão de Aquiles |
| `alongamento_peitoral_costas` | Alongamento de peitoral com mãos atrás | frente | 2 | Alongamento de Peitoral com Mãos Atrás da Cabeça; Alongamento de Deltóide Anterior Sentado |
| `alongamento_posterior` | Alongamento posterior em pé | lado | 2 | Progressão de Isquiotibiais; Alongamento de Posterior com Calcanhar no Degrau |
| `alongamento_posterior_cadeira` | Alongamento posterior sentado na cadeira | lado | 2 | Alongamento de Posterior Sentado na Cadeira; Alongamento Lombar Sentado na Cadeira |
| `alongamento_quadriceps` | Alongamento de quadríceps em pé | lado | 2 | Alongamento de Quadríceps; Quadríceps em Pé |
| `aviao_quadril` | Avião de quadril | lado | 2 | Avião de Quadril (Hip Airplane); Avião de Quadril Assistido na Parede |
| `bird_dog` | Bird dog | lado | 2 | Bird Dog; Bird Dog no Banco |
| `cadeira_adutora` | Cadeira adutora | frente | 2 | Adução de Quadril; Cadeira Adutora com Tronco Inclinado |
| `caminhada_acima` | Caminhada com carga acima da cabeça | lado | 2 | Waiter Carry; Overhead Carry |
| `caminhada_tandem` | Caminhada calcanhar-ponta | lado | 2 | Caminhada Calcanhar-Ponta; Caminhada com Carga em Linha (Farmer em Tandem) |
| `canivete_lateral` | Canivete lateral | frente | 2 | Inclinação Lateral na Bola Suíça; Canivete Lateral |
| `caranguejo` | Caminhada do caranguejo | lado | 2 | Caminhada do Caranguejo; Caranguejo com Toque no Pé (Crab Toe Touch) |
| `cars_ombro` | Rotação de ombro (CARs) | lado | 2 | Mobilidade de Ombro; CARs de Ombro (Rotação Articular Controlada) |
| `circulo_quadril` | Rotação de quadril | frente | 2 | Rotação de Quadril; Mobilidade de Quadril (Círculos) |
| `coice_maquina` | Glúteo na máquina (coice) | lado | 2 | Glúteo na Máquina (Coice); Extensão de Quadril em Pé na Máquina Multi-Hip |
| `corda_naval_dupla` | Corda naval (batida dupla) | lado | 2 | Corda Naval: Batida Dupla (Slam); Corda Naval: Círculos para Fora |
| `dragon_flag` | Dragon flag | lado | 2 | Dragon Flag; Dragon Flag Negativo no Banco |
| `elevacao_joelhos_paralelas` | Elevação de joelhos na cadeira do capitão | lado | 2 | Elevação de Joelhos nas Paralelas (Cadeira do Capitão); Elevação de Joelhos Oblíqua nas Paralelas |
| `elevacao_joelhos_suspenso` | Elevação de joelhos suspenso | lado | 2 | Elevação de Joelhos Suspensa; Elevação de Joelhos Oblíqua Suspensa |
| `elevacao_pernas_suspenso` | Elevação de pernas suspenso | lado | 2 | Pés à Barra; Limpador de Para-brisa Suspenso na Barra |
| `engatinhar_urso` | Bear crawl | lado | 2 | Bear Crawl; Bear Crawl Lateral |
| `extensao_bola` | Extensão lombar na bola | lado | 2 | Extensão Lombar na Bola Suíça; Hiperextensão na Bola Suíça |
| `extensao_toracica` | Extensão torácica | lado | 2 | Extensão Torácica na Bola; Extensão Torácica no Foam Roller |
| `fire_hydrant` | Fire hydrant (abdução em 4 apoios) | lado | 2 | Fire Hydrant; Fire Hydrant com Mini Band |
| `flexao_joelhos` | Flexão com joelhos apoiados | lado | 2 | Flexão no Joelho; Flexão Diamante nos Joelhos |
| `flexora_bola` | Flexora deitado com os pés na bola | lado | 2 | Flexora na Bola Suíça; Flexora na Bola Suíça Unilateral |
| `flexora_brucos` | Flexora deitado de bruços | lado | 2 | Flexora Deitado com Halter; Flexora Deitado de Bruços com Elástico |
| `flexora_em_pe` | Flexora em pé | lado | 2 | Flexora em Pé Unilateral; Flexora em Pé na Polia |
| `flutter` | Flutter kicks / tesoura | lado | 2 | Flutter Kicks; Tesoura |
| `gluteo_sentado` | Alongamento de glúteo sentado (figura 4) | lado | 2 | Alongamento de Glúteo Sentado com Perna Cruzada; Alongamento de Glúteo na Cadeira (Figura 4) |
| `halo` | Halo | frente | 2 | Halo com Kettlebell; Halo com Kettlebell e Extensão de Tríceps |
| `inchworm` | Inchworm (lagarta) | lado | 2 | Inchworm (Lagarta); Inchworm com Flexão |
| `joelhada` | Joelhada | lado | 2 | Joelhada e Soco Cruzado (Kickboxing Cardio); Joelho ao Cotovelo em Pé |
| `l_sit` | L-sit | lado | 2 | L-Sit; L-Sit Grupado Apoiado em Halteres |
| `levantar_chao` | Levantar do chão | lado | 2 | Levantar do Chão com Segurança; Sentar e Levantar do Chão sem as Mãos |
| `lift` | Lift diagonal (baixo para alto) | frente | 2 | Lift Diagonal no Cabo (Baixo para Alto); Lift Diagonal com Elástico (Baixo para Alto) |
| `livro_aberto` | Livro aberto (open book) | frente | 2 | Abertura Torácica no Chão; Livro Aberto (Open Book Torácico) |
| `marreta` | Marretada no pneu | lado | 2 | Marretadas no Pneu; Marretada no Pneu |
| `muscle_up` | Muscle-up | frente | 2 | Muscle-up; Muscle-up nos Anéis |
| `nadador` | Nadador (swimmer) | lado | 2 | Puxada Deslizante no Chão com Toalhas; Nadador Deitado (Swimmer) |
| `obstaculos` | Marcha sobre obstáculos | lado | 2 | Marcha com Ultrapassagem de Obstáculos; Marcha com Dupla Tarefa (Cognitivo-Motora) |
| `ombro_cruzado` | Alongamento de ombro cruzado | frente | 2 | Ombros Cruzado; Alongamento de Costas Médias (Abraço) |
| `panturrilha_leg_press` | Panturrilha no leg press | lado | 2 | Panturrilha no Leg Press; Panturrilha Unilateral no Leg Press |
| `pike_suspenso` | Pike com pés suspensos/deslizantes | lado | 2 | Pike com Slider; Pike no TRX |
| `pogo` | Saltos pogo | lado | 2 | Saltos Pogo (Tornozelo Reativo); Saltos Pogo Unilaterais |
| `ponte_bola_ombros` | Ponte com ombros na bola | lado | 2 | Ponte de Glúteo com Ombros na Bola Suíça; Ponte com Ombros na Bola Suíça |
| `ponte_unilateral` | Ponte unilateral | lado | 2 | Ponte de Glúteo Unilateral; Ponte com Marcha |
| `prancha_alta` | Prancha alta | lado | 2 | Prancha com Abertura de Pés (Plank Jack Lento); Prancha com Polichinelo (Plank Jack) |
| `prancha_pes_elevados` | Prancha com pés elevados | lado | 2 | Prancha com Pés Elevados no Degrau; Prancha com Pés no TRX |
| `prancha_toque` | Prancha com toque no ombro | lado | 2 | Prancha com Toque no Ombro; Prancha com Alcance |
| `prancha_urso` | Prancha do urso | lado | 2 | Prancha do Urso (Bear Hold); Urso Isométrico com Protração e Alcance |
| `pullover_chao` | Pullover deitado no chão | lado | 2 | Pullover com Kettlebell Deitado no Chão; Pullover com Mochila Deitado no Chão |
| `puxada_unilateral` | Puxada unilateral | frente | 2 | Puxada Unilateral no Cabo; Puxada Articulada Unilateral |
| `quatro_apoios_circulos` | Círculos de quadril em 4 apoios | lado | 2 | Círculos de Quadril em Quatro Apoios; Círculos de Quadril em 4 Apoios |
| `queixo` | Retração cervical (queixo para trás) | lado | 2 | Flexão de Pescoço; Retração Cervical (Queixo para Trás) |
| `reacao_bola` | Reação com bola | lado | 2 | Reação com Bola (Drop and Catch); Reação com Bola na Parede (Pegar no Quique) |
| `remada_afundo` | Remada unilateral em base de afundo | lado | 2 | Remada Unilateral com Elástico em Base de Afundo; Remada Unilateral em Pé na Polia com Rotação |
| `remada_renegade` | Remada renegade | lado | 2 | Remada Renegade; Remada Renegade com Push-up |
| `remada_sentada_chao` | Remada sentada no chão (elástico) | lado | 2 | Remada Sentada com Elástico; Remada Isométrica com Toalha nos Pés |
| `rosca_concentrada` | Rosca concentrada | lado | 2 | Rosca Concentrada; Rosca Concentrada em Pé (Tronco Inclinado) |
| `rosca_punho_pe` | Flexão de punho em pé | lado | 2 | Flexão de Punho com Barra Atrás do Corpo; Rosca de Punho com Barra Atrás das Costas |
| `rotacao_toracica` | Rotação torácica | lado | 2 | Rotação Torácica; Ponte Torácica com Rotação |
| `russian_twist` | Russian twist | frente | 2 | Russian Twist; Russian Twist com Anilha |
| `sapo` | Alongamento do sapo | frente | 2 | Alongamento do Sapo; Balanço do Sapo (Frog Rock) |
| `shrimp` | Agachamento camarão | lado | 2 | Shrimp Squat; Agachamento Patinador (Skater Squat) |
| `skater` | Salto patinador (skater) | frente | 2 | Patinador sem Salto (Baixo Impacto); Salto Patinador (Skater) |
| `skipping` | Skipping (joelho alto) | lado | 2 | Skipping Alto (High Knees); Skipping Saltitado Rápido (Fast Skip) |
| `split_step` | Split step (prontidão) | frente | 2 | Split Step (Passo de Prontidão); Split Step com Reação a Estímulo |
| `squat_thrust` | Squat thrust | lado | 2 | Squat Thrust (Burpee sem Salto); Sprawl |
| `supino_declinado` | Supino declinado | lado | 2 | Supino Declinado; Supino Declinado no Smith |
| `tandem` | Equilíbrio em tandem | lado | 2 | Equilíbrio em Tandem (Pé à Frente do Pé); Equilíbrio com Olhos Fechados (Pés Juntos) |
| `tke` | Extensão terminal de joelho (TKE) | lado | 2 | Extensão Terminal de Joelho (TKE); Extensão Terminal de Joelho na Polia (TKE) |
| `turkish` | Levantamento turco (Turkish get-up) | lado | 2 | Turkish Get-Up; Turkish Get-Up Leve |
| `worlds_greatest` | World's greatest stretch | lado | 2 | World's Greatest Stretch; Groiner (Avanço com Mãos no Chão) |
| `abducao_sentado` | Abdução sentado | frente | 1 | Abdução de Quadril Sentado com Elástico |
| `aducao_deitado` | Adução deitado de lado | frente | 1 | Adução de Quadril Deitado de Lado |
| `agachamento_ajoelhado` | Agachamento ajoelhado | lado | 1 | Agachamento Ajoelhado com Barra |
| `agachamento_isometrico` | Agachamento isométrico | lado | 1 | Agachamento Isométrico |
| `agachamento_maquina_deitado` | Agachamento na máquina reclinada | lado | 1 | Agachamento na Máquina Deitado (Agachamento Reclinado) |
| `agachamento_mini` | Mini agachamento com apoio | lado | 1 | Mini Agachamento com Apoio na Cadeira |
| `agachamento_rotacao` | Agachamento profundo com rotação | lado | 1 | Agachamento Profundo com Rotação Torácica |
| `agachamento_toalha` | Agachamento segurando na porta | lado | 1 | Agachamento Profundo Segurando Toalha na Porta |
| `alcance` | Alcance funcional | lado | 1 | Alcance Funcional à Frente |
| `alongamento_panturrilha_degrau` | Alongamento de panturrilha no degrau | lado | 1 | Alongamento de Panturrilha no Degrau |
| `alongamento_posterior_deitado` | Alongamento posterior deitado | lado | 1 | Alongamento de Posterior com Elástico Deitado |
| `alongamento_posterior_sentado` | Alongamento posterior sentado | lado | 1 | Alongamento Posterior de Coxa |
| `alongamento_quadriceps_deitado` | Alongamento de quadríceps deitado | lado | 1 | Alongamento de Quadríceps Deitado de Lado |
| `anfersen` | Calcanhar no glúteo | lado | 1 | Anfersen (Calcanhar no Glúteo) |
| `anjo_parede` | Anjo na parede | frente | 1 | Anjo na Parede (Wall Angel) |
| `aperto_palmas` | Aperto isométrico de palmas | lado | 1 | Aperto Isométrico de Palmas |
| `arremesso_tras` | Arremesso para trás | lado | 1 | Arremesso para Trás por Cima da Cabeça |
| `backhand` | Golpe de backhand | frente | 1 | Backhand com Elástico |
| `balanco_perna` | Balanço de perna | lado | 1 | Balanço de Pernas |
| `bascula` | Báscula pélvica | lado | 1 | Báscula Pélvica Deitado |
| `bicicleta_abdominal` | Abdominal bicicleta | lado | 1 | Bicicleta Abdominal |
| `bike_em_pe` | Bike em pé (subida) | lado | 1 | Bike Indoor: Subida em Pé com Carga Alta |
| `bike_reclinada` | Bicicleta horizontal | lado | 1 | Bicicleta Ergométrica Horizontal |
| `borboleta` | Borboleta / adutores | frente | 1 | Alongamento de Adutores Deitado (Borboleta Deitada) |
| `boxe_sentado` | Socos sentado | lado | 1 | Boxe Sentado na Cadeira |
| `burpee_inclinado` | Burpee inclinado (apoio elevado) | lado | 1 | Burpee Inclinado na Cadeira (sem Salto) |
| `canivete_bola` | Canivete com pés na bola | lado | 1 | Canivete na Bola Suíça |
| `chute` | Chute frontal | lado | 1 | Chute Frontal Alternado (Cardio Kickboxing) |
| `circulos_bracos` | Círculos de braços | frente | 1 | Círculos de Braços |
| `couch_stretch` | Couch stretch | lado | 1 | Couch Stretch |
| `crunch_maquina` | Abdominal na máquina | lado | 1 | Abdominal na Máquina |
| `desenvolvimento_maquina` | Desenvolvimento na máquina | frente | 1 | Desenvolvimento na Máquina |
| `elevacao_quadril_degrau` | Elevação de quadril no degrau (hip hike) | frente | 1 | Elevação de Quadril no Degrau (Hip Hike) |
| `encolhimento_acima` | Encolhimento com braços acima da cabeça | frente | 1 | Encolhimento com Braços Acima da Cabeça |
| `esfinge` | Esfinge | lado | 1 | Alongamento de Abdômen em Esfinge |
| `extensao_toracica_cadeira` | Extensão torácica na cadeira | lado | 1 | Extensão Torácica na Cadeira |
| `flexao_lateral` | Flexão lateral do tronco | frente | 1 | Flexão Lateral com Halter |
| `flexora_cadeira` | Flexora sentado (cadeira) | lado | 1 | Flexora Sentado com Elástico |
| `ghd_abdominal` | Abdominal no GHD | lado | 1 | Abdominal no GHD |
| `gluteo_deitado` | Alongamento de glúteo deitado | lado | 1 | Piriformis Stretch |
| `jefferson` | Jefferson curl | lado | 1 | Jefferson Curl |
| `joelhos_peito` | Joelhos ao peito | lado | 1 | Joelhos ao Peito Deitado |
| `kb_swing_americano` | Kettlebell swing americano | lado | 1 | Kettlebell Swing Americano |
| `marcha_sentado` | Marcha sentado | lado | 1 | Marcha Sentada na Cadeira |
| `mountain_climber_cruzado` | Mountain climber cruzado | lado | 1 | Mountain Climber Cruzado |
| `nordico_reverso` | Nórdico reverso | lado | 1 | Nórdico Reverso |
| `oito_raquete` | Oito com a raquete | lado | 1 | Oito com a Raquete (Mobilidade de Punho e Antebraço) |
| `pancake` | Pancake (afastamento sentado) | frente | 1 | Alongamento Pancake (Afastamento Sentado) |
| `polichinelo_baixo` | Polichinelo sem salto | frente | 1 | Polichinelo sem Salto (Baixo Impacto) |
| `polichinelo_frontal` | Polichinelo frontal (seal jack) | frente | 1 | Polichinelo Frontal (Seal Jack) |
| `pombo` | Postura do pombo | lado | 1 | Posição do Pombo |
| `ponte_completa` | Ponte completa | lado | 1 | Ponte Completa (Wheel Pose) |
| `prancha_estrela` | Prancha lateral com abdução | frente | 1 | Prancha Lateral com Abdução (Star Plank) |
| `prancha_lateral_quadril` | Prancha lateral com elevação de quadril | frente | 1 | Prancha Lateral com Elevação de Quadril |
| `prancha_reversa` | Prancha reversa | lado | 1 | Prancha Reversa |
| `pull_apart` | Abertura com elástico (pull apart) | frente | 1 | Band Pull Apart |
| `relogio` | Relógio de equilíbrio | lado | 1 | Relógio de Equilíbrio (Alcance Unipodal) |
| `respiracao` | Respiração diafragmática | lado | 1 | Respiração Diafragmática |
| `rolo_costas` | Liberação no rolo (costas) | lado | 1 | Liberação de Latíssimo no Foam Roller |
| `rotacao_interna` | Rotação interna de ombro | frente | 1 | Rotação Interna no Cabo |
| `salto_caixa` | Salto na caixa (box jump) | lado | 1 | Box Jump |
| `salto_estrela` | Salto estrela | frente | 1 | Salto Estrela |
| `salto_grupado` | Salto grupado | lado | 1 | Salto Grupado (Tuck Jump) |
| `salto_unipodal` | Salto unipodal com estabilização | lado | 1 | Salto Unipodal com Estabilização |
| `squat_jack` | Agachamento com polichinelo | frente | 1 | Agachamento com Polichinelo (Squat Jack) |
| `step_down` | Descida excêntrica do degrau | lado | 1 | Step Down (Descida Excêntrica no Degrau) |
| `stir_pot` | Stir the pot | lado | 1 | Stir the Pot |
| `svend` | Svend press | lado | 1 | Svend Press |
| `terra_sumo` | Levantamento terra sumô | frente | 1 | Terra Sumô |
| `toalha_costas` | Alongamento de ombro com toalha | frente | 1 | Alongamento de Ombro com Toalha nas Costas |
| `transferencia_peso` | Transferência de peso | frente | 1 | Transferência de Peso (Frente-Trás e Lateral) |
| `triceps_acima` | Alongamento de tríceps acima da cabeça | frente | 1 | Alongamento de Tríceps Acima da Cabeça |
| `triceps_maquina` | Tríceps na máquina | lado | 1 | Tríceps na Máquina |
| `urso_toque` | Prancha do urso com toque no ombro | lado | 1 | Prancha do Urso com Toque no Ombro |
| `v_sit` | V-sit (sustentação) | lado | 1 | V-Sit |
| `vacuum` | Vácuo abdominal | lado | 1 | Vacuum Abdominal |
| `virada_pneu` | Virada de pneu | lado | 1 | Virada de Pneu |
| `voador_inverso` | Crucifixo inverso na máquina | frente | 1 | Crucifixo Inverso no Peck Deck |
| `voleio` | Voleio na parede | lado | 1 | Voleio Rápido na Parede com Raquete |
| `wall_ball` | Wall ball | lado | 1 | Wall Ball |
| `wall_walk` | Escalada na parede | lado | 1 | Escalada na Parede (Wall Walk) |
| `cobra` | Cobra / extensão no chão | lado | 0 |  |
| `coice_estendido` | Extensão de quadril em 4 apoios | lado | 0 |  |
| `elevacao_frontal_alt` | Elevação frontal alternada | lado | 0 |  |
| `equilibrio_apoio` | Equilíbrio unipodal com apoio | lado | 0 |  |
| `generico` | Exercício | lado | 0 |  |
| `smash` | Smash / saque | lado | 0 |  |
| `suspensao` | Suspensão (pegada) | frente | 0 |  |

## Exercícios no template genérico

Nenhum. (`generico` existe só como último recurso para exercícios futuros sem categoria conhecida.)

## Limitações conhecidas

- O boneco tem tronco rígido: flexão de coluna (abdominal, gato-camelo, Jefferson curl) é sugerida pelo giro do tronco no quadril e pela cabeça.
- Movimentos fora do plano da vista (rotação de tronco, abdução deitado, crucifixo deitado) usam escorço (membro encurtado) ou vista frontal; ficam legíveis, mas são aproximações.
- Algumas variações finas compartilham template (ex.: pegada aberta/fechada/neutra, pausa, tempo excêntrico, unilateral em máquinas) — a diferença fica no nome/instruções.
- Dois-três quadros por exercício; exercícios longos (burpee, turkish get-up, inchworm) usam 3–4.

