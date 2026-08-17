# 14. Treino no estilo personal: dia certo + variedade programada

**Data:** 17/08/2026

## Pedido

> "o treino deve funcionar como personal que olha meu perfil, meus objetivos e os dias de
> treino para criar treino especial trabalhando todos os grupos musculares na semana. deverá
> mudar o treino e os aparelhos com uma determinada frequência para que não fique monótono e eu
> fique desmotivada."

Pedido feito enquanto ela criava a conta do Supabase (integração de nuvem tratada à parte,
em paralelo — ver histórico mais recente quando publicado).

## O que já existia vs. o que faltava

O gerador automático (`Forca.gerarPlano`) já filtrava por nível/local, priorizava compostos, e o
split por número de dias/semana (`SPLITS`) já cobria bem os grandes grupos musculares — isso já
funcionava. Duas coisas realmente faltavam:

1. **Usar os dias da semana de verdade, não só a contagem.** O perfil já tinha `diasTreino`
   (ex.: segunda/quarta/sexta, do [ciclo 6](06-perfil-nivel-peso.md)), mas o gerador só usava
   `freqForca` (um número) — as fichas geradas não sabiam a que dia pertenciam. Virava "Treino
   A/B/C" solto, sem ligação com o calendário real.
2. **Nenhuma variedade programada.** Existia `rotacao` no gerador (varia só quando a pessoa
   aperta "gerar de novo" manualmente) e `substitutos()` (troca reativa, só quando o equipamento
   está ocupado). Não existia nada que, com o tempo, sugerisse variar os exercícios sozinho —
   exatamente o tipo de estagnação que gera desmotivação e abandono.

## Decisão 1: cada ficha nasce ligada a um dia da semana

`gerarPlano` passou a aceitar `diasSemana` (os índices marcados no perfil) além de `freqForca`.
Quando presente, `diasSemana.length` manda na quantidade de fichas geradas, e cada ficha sai com
um campo novo `diaSemana` (0-6). A tela inicial usa isso pra trocar o aviso genérico "hoje é dia
de treino" por "hoje é dia de Pernas e Glúteos", com botão direto pra começar. Sem dias
marcados, cai pro comportamento antigo (`freqForca`) — compatibilidade preservada, testada
explicitamente.

## Decisão 2: variedade por tempo, não por clique

Nova ideia: cada ficha guarda `ultimaVariacaoEm`. A cada **4 semanas** sem mudar (um mesociclo
curto — dá pra progredir e não enjoa), a tela de Treinos mostra uma sugestão: "Faz X semanas com
os mesmos exercícios — variar?". Ao confirmar, `Forca.variarFicha` troca metade dos exercícios
de cada ficha (isolados primeiro, só mexe em compostos se a fração pedir mais que isso) por uma
alternativa de mesmo padrão de movimento em **outro aparelho** — literalmente reaproveitando a
mesma busca (`substitutos()`) que já existia pra "equipamento ocupado". Mesma ideia, gatilho
diferente: lá é "não posso usar esse aparelho agora", aqui é "já usei esse aparelho tempo
demais".

**Importante:** histórico de carga não se perde. `historicoCarga` é indexado por `exId`, não por
"posição na ficha" — trocar o exercício da vaga 3 da Ficha A não apaga o histórico do exercício
antigo (ele simplesmente para de aparecer nessa ficha) nem inventa histórico falso pro novo (ele
começa do zero, honestamente, porque é a primeira vez que ela faz aquele exercício específico).

## Por que sugestão, não automático

Trocar o treino sozinho, sem avisar, seria confuso — ela abriria o app um dia e os exercícios
teriam mudado sem explicação. Optei por um botão claro ("Variar meus treinos") com o motivo
explícito, o mesmo padrão de UX já usado pro deload (`avaliarDeload`, sugestão com motivos, nunca
automático).

## Rotação sem precisar guardar estado extra

Qual substituto escolher, entre vários candidatos possíveis, muda com o tempo: uso
`Math.floor(Date.now() / (4 semanas em ms))` como semente — um número que só muda a cada ciclo
completo, sem precisar guardar contador em lugar nenhum. Cada ficha soma seu próprio índice a
essa semente, pra não escolher sempre a mesma alternativa em todas as fichas ao mesmo tempo.
Determinístico (mesmo momento = mesmo resultado, testável), mas varia de verdade ciclo a ciclo.

## Entregue

- `js/forca.js` — `gerarPlano` aceita `diasSemana` e devolve `diaSemana` por ficha;
  `SEMANAS_PARA_VARIAR`, `semanasSemVariar()`, `precisaVariar()`, `variarFicha()`.
- `js/dados.js` — `novaFicha` ganha `diaSemana: null` e `ultimaVariacaoEm: null`.
- `js/app.js` — `gerar-plano` passa `diasTreino`; novo handler `variar-treino`.
- `js/ui.js` — tela inicial avisa o treino do dia por nome (com atalho "Começar agora"); tela de
  Treinos sugere variar quando faz 4+ semanas; lista de fichas mostra o dia da semana; texto do
  gerador explica a ligação com os dias marcados no perfil.
- `sw.js` → trivox-v12.
- Testado: 19/19 (geração por dia da semana, cobertura de grupos musculares na semana,
  compatibilidade sem `diasSemana`, `precisaVariar`/`semanasSemVariar`, `variarFicha` —
  quantidade preservada, equipamento realmente muda, prescrição válida, determinístico por
  rotação, e rotações diferentes de fato variam a escolha).
