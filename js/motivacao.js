/* Motivacao: frase do dia e chamada diaria pro treino.
   Banco de frases proprio (sem IA, offline). A frase muda uma vez por dia (mesma frase o dia
   todo, pra nao parecer aleatorio a cada toque) e e escolhida pelo contexto: objetivo,
   idade, sequencia de dias, ha quanto tempo nao treina, se hoje e dia de treino. */

const Motivacao = (() => {
  const GERAL = [
    'Feito é melhor que perfeito. Bora fazer o de hoje.',
    'Seu eu de daqui a 3 meses vai agradecer o treino de hoje.',
    'Não precisa estar com vontade. Precisa só começar — a vontade vem no aquecimento.',
    'Cada série conta. Literalmente: o app está contando.',
    'Constância vence intensidade. Aparece hoje, que o resto se ajeita.',
    'Dia ruim também vale: treino leve ainda é treino.',
    'Você não treina pra ficar cansada. Treina pra ficar capaz.',
    'Música boa, garrafa d’água e bora!',
    'Músculo não sabe se é segunda ou sexta. Só sabe se você foi.',
    '20 minutos bem feitos valem mais que 1 hora pensando em ir.',
    'Hoje é dia de bater um recorde pequeno — uma rep a mais já é recorde.',
    'Corpo em movimento, cabeça leve.',
    'Quem treina com alegria volta amanhã. Escolha um exercício que você curte.',
    'Seu treino de hoje já está pronto. Só falta você.',
  ];
  const POR_OBJETIVO = {
    hipertrofia: [
      'Músculo cresce no descanso, mas só depois do estímulo. Hoje é dia de estímulo.',
      'Perto da falha, com técnica. É ali que a mágica acontece.',
      'Anota a carga: o que se mede, melhora.',
    ],
    perda_peso: [
      'Cada treino é um voto pro corpo que você quer. Vota hoje.',
      'Não é sobre suar mais, é sobre voltar sempre. Constância queima mais que exagero.',
      'Treino + passos + comida de verdade. Hoje você faz a sua parte do treino.',
    ],
    condicionamento: [
      'Fôlego se constrói igual poupança: um pouquinho todo dia.',
      'Subir a escada sem parar começa no circuito de hoje.',
      'Mais disposição pro dia inteiro: é isso que o treino de hoje te dá.',
    ],
    '50mais': [
      'Força é independência: levantar, carregar, subir escada sozinha. Bora treinar pra isso.',
      'Equilíbrio também se treina — e cada dia conta.',
      'Nunca é tarde pra ficar mais forte. Hoje é um ótimo dia pra provar isso.',
      'Movimento é remédio que não tem efeito colateral ruim.',
    ],
    raquete: [
      'Perna forte e ombro blindado = mais jogo e menos dor. Bora!',
      'O ponto se ganha no deslocamento. O deslocamento se ganha no treino.',
      'Split-step rápido começa com panturrilha forte.',
      'Quem treina fora da quadra joga mais tempo dentro dela.',
    ],
  };
  const SEQUENCIA = [
    '🔥 {n} dias seguidos! Não deixa o fogo apagar.',
    '🔥 Sequência de {n} dias. Você está construindo um hábito de verdade.',
  ];
  const VOLTA = [
    'Faz {n} dias. Sem culpa: hoje é só recomeçar, com um treino mais leve.',
    'Sentimos sua falta! {n} dias longe — que tal 15 minutos hoje?',
  ];
  const DESCANSO = [
    'Hoje é descanso. Alongar e caminhar também contam.',
    'Dia de recuperar: dormir bem é parte do treino.',
  ];

  // numero fixo por dia (aaaa-mm-dd) -> mesma frase o dia inteiro
  function semente(txt) { let h = 7; for (let i = 0; i < txt.length; i++) h = (h * 31 + txt.charCodeAt(i)) >>> 0; return h; }
  const escolher = (lista, chave) => lista[semente(chave) % lista.length];

  /**
   * @param {{objetivo, idade, streak, diasSemTreino, hojeEDiaDeTreino, jaTreinouHoje}} c
   */
  function fraseDoDia(c = {}) {
    const hoje = new Date().toLocaleDateString('sv-SE');
    if (c.jaTreinouHoje) return '✅ Treino feito! Agora é hidratar, comer bem e descansar.';
    if (c.diasSemTreino !== null && c.diasSemTreino >= 4) return escolher(VOLTA, hoje).replace('{n}', c.diasSemTreino);
    if (c.streak >= 3 && c.hojeEDiaDeTreino) return escolher(SEQUENCIA, hoje).replace('{n}', c.streak);
    if (c.hojeEDiaDeTreino === false) return escolher(DESCANSO, hoje);
    const obj = (c.idade >= 50 && !POR_OBJETIVO[c.objetivo]) ? '50mais' : c.objetivo;
    const lista = [...(POR_OBJETIVO[obj] || []), ...(c.idade >= 50 ? POR_OBJETIVO['50mais'] : []), ...GERAL];
    return escolher(lista, hoje + (obj || ''));
  }

  /** Texto da notificacao diaria. */
  function chamada(nome, nomeFicha) {
    const primeiro = (nome || '').split(' ')[0];
    const ops = [
      `${primeiro ? primeiro + ', h' : 'H'}ora do treino! ${nomeFicha ? 'Hoje: ' + nomeFicha + '.' : ''}`,
      `${primeiro ? primeiro + ', s' : 'S'}eu treino está te esperando 💪 ${nomeFicha ? '(' + nomeFicha + ')' : ''}`,
      `Bora treinar${primeiro ? ', ' + primeiro : ''}? É rapidinho e o dia fica melhor.`,
    ];
    return escolher(ops, new Date().toLocaleDateString('sv-SE')).trim();
  }

  return { fraseDoDia, chamada };
})();
