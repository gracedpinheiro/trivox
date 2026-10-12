# Relatório: fotos reais de execução (free-exercise-db)

Fonte: [free-exercise-db](https://github.com/yuhonas/free-exercise-db), domínio público (Unlicense).
Mapa: `data/mapa_fedb.json` ({id_trivox: fedb_id}). Fotos: `data/imagens/fedb/<fedb_id>_0.jpg` e `_1.jpg` (início e fim do movimento), com no máximo 600 px e qualidade 78.
Para reaplicar em exercícios novos: `python3 ferramentas/baixar_fotos_fedb.py <mapa.json>` (baixa só o que falta).

## Resultado

- **361 de 563 exercícios associados** (64%). Eles usam **256 exercícios distintos do fedb**, ou seja, 512 JPGs e cerca de 17,8 MB.
- Os 22 exercícios que já tinham foto foram confirmados e também estão no mapa.
- Cada associação foi revisada manualmente, por categoria. Só entrou quando o movimento e o tipo de equipamento eram os mesmos.
- A mesma foto só se repete entre exercícios que são, na prática, o mesmo movimento. Exemplos: Remada Unilateral, Serrote e Kroc Row; Romeno e RDL; Face Pull e Face Pull com corda; Rosca Direta, Rosca 21 e Rosca com Barra.

| Categoria | Com foto | Total |
|---|---|---|
| pernas | 50 | 63 |
| funcional | 57 | 76 |
| costas | 36 | 48 |
| core | 31 | 44 |
| peito | 28 | 36 |
| bíceps | 28 | 30 |
| ombros | 27 | 39 |
| tríceps | 24 | 29 |
| puxar | 17 | 25 |
| empurrar | 12 | 23 |
| pernas_cal | 11 | 24 |
| mobilidade | 9 | 35 |
| cardio | 9 | 25 |
| glúteos | 8 | 13 |
| alongamento | 8 | 10 |
| equilíbrio | 2 | 8 |
| skills | 3 | 22 |
| core_cal | 1 | 13 |

## Sem foto: 202 exercícios, e por quê

1. **Skills e core de calistenia** (cerca de 30): planche, front lever, back lever, human flag, L-sit, V-sit, dragon flag, hollow body, crow e frog stand, bananeira livre e muscle-up na barra. O fedb não tem nenhum desses.
2. **Mobilidade e alongamento** (cerca de 28): 90/90, pombo, shin box, bretzel, couch stretch, sapo, deslocamento de ombro com bastão, mobilidade de tornozelo na parede, rotação torácica, foam roller torácico, peitoral na parede e quadríceps em pé. O fedb tem poucos alongamentos, e boa parte deles usa faixa ou parceiro.
3. **Cardio e condicionamento** (cerca de 16): burpee, polichinelo, corrida estacionária, sprints, escada de agilidade, cones, shadow boxing, step aeróbico, assault/air bike, circuitos, complexes e AMRAP. São exercícios sem equivalente ou que são protocolos, e não um movimento único.
4. **Variações com elástico** (cerca de 12): puxada, remada sentada, pushdown, rosca e abdução com elástico. O fedb só tem o movimento no cabo ou com peso livre, e o equipamento é diferente.
5. **Variações específicas sem par fiel** (cerca de 115): seal row, Krueger row, W/Y/T raises, Prone Y-T-W, empty can, Bayesian curl, Cable Squat, TKE, Reverse Nordic, wall sit, pistol assistido, cossack, shrimp, flexão no joelho, flexão archer, pike push-up, Copenhagen plank, clamshell, fire hydrant, wall ball, waiter e overhead carry, Viking press, safety bar e outros. Também ficaram de fora os itens "batch3" genéricos, como "Calf Raises com Variações" e "Chest Fly Isométrico", porque não dá para escolher uma imagem única para eles.

Esses exercícios continuam com o pictograma. Mostrar uma foto errada seria pior.

## 10 associações difíceis que rejeitei

| Exercício TRIVOX | Candidato no fedb | Por que rejeitei |
|---|---|---|
| Assault Bike / Air Bike (Intervals) | `Air_Bike` | No fedb, "Air Bike" é o abdominal bicicleta deitado, não o ergômetro. Era exatamente esse tipo de erro que o casamento automático cometia. Usei a foto no **lb_cr11 Bicicleta Abdominal**. |
| Flutter Kicks (deitado de costas) | `Flutter_Kicks` | No fedb, o exercício é feito de bruços sobre o banco, com extensão de quadril. É o movimento oposto. |
| Mobilidade 90/90 / Hip 90/90 | `90_90_Hamstring` | É um alongamento de posteriores deitado, não a rotação de quadril sentado. |
| Jefferson Curl | `Jefferson_Squats` | É um agachamento com a barra entre as pernas, e não a flexão da coluna vértebra por vértebra. |
| Empty Can | `Dumbbell_Scaption` | O plano escapular é o mesmo, mas a scaption é feita com o polegar para cima. O polegar para baixo é justamente o que define o Empty Can. |
| High Pull para Snatch | `Snatch_Pull` | O snatch pull termina na extensão com encolhimento, e a barra não sobe até o peito como no high pull. |
| Fire Hydrant | `Hip_Circles_prone` | A posição em quatro apoios é a mesma, mas o exercício é uma circundução, e não uma abdução lateral. |
| Elevação de Joelhos Suspensa | `Hanging_Leg_Raise` / `Knee_Hip_Raise_On_Parallel_Bars` | O primeiro é feito com as pernas estendidas, e o segundo na cadeira romana. Nenhum dos dois mostra a elevação de joelhos na barra. (O `Hanging_Pike` ficou só para Pés à Barra.) |
| Muscle-up na barra fixa / One Arm Pull-up | `Muscle_Up` / `One_Arm_Chin-Up` | O muscle-up do fedb é nas argolas, e por isso ficou só no **Muscle-up nos Anéis**. O one-arm do fedb usa uma toalha como assistência, então não é a barra com um braço. |
| Agachamento com Salto e Peso (halteres) / Polichinelo | `Weighted_Jump_Squat` / `Star_Jump` | O primeiro é com barra nas costas, outro equipamento. O Star Jump é um salto vertical em estrela, e não o polichinelo. |

Outras rejeições que vale registrar: Remada Alta com Kettlebell não virou `Kettlebell_Sumo_High_Pull`, que é balístico e com base sumô. Carregamento de Saco de Areia não virou `Sandbag_Load`, que é um levantamento até a plataforma. Remada Aberta no Cabo não virou `Seated_Cable_Rows`, porque a pegada em V muda o padrão de cotovelo.

## Observações para a integração

- O campo `imagens` em `data/exercicios.json` não foi alterado. Quem cuida do JSON pode montar o caminho com `data/imagens/fedb/<mapa[id]>_0.jpg` e `_1.jpg`.
- As fotos antigas em `data/imagens/<id>_*.jpg` (22) podem ser substituídas pelas da pasta fedb, porque são o mesmo exercício.
- As fotos do fedb são de academia e têm fundo escuro ou vermelho. Num layout claro, vale colocá-las num card com borda arredondada e um fundo suave.
