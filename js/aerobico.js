/* Engine de treino aerobico.
   Nenhum dos apps antigos tinha isso: so havia exercicios marcados como "cardio",
   sem zona, sem progressao e sem controle de carga.

   Base das contas:
   - FCmax por Tanaka (208 - 0,7 x idade): erra menos que a formula 220 - idade,
     que subestima a FCmax de quem passa dos 40
   - Zonas por FC de reserva (Karvonen) quando ha FC de repouso; senao, % da FCmax
   - Carga da sessao pela PSE-sessao de Foster: minutos x PSE(0-10) = unidades arbitrarias
   - Progressao de volume limitada a +10% por semana
   - Distribuicao polarizada: ~80% do tempo em intensidade baixa, ~20% em alta */

const Aerobico = (() => {

  // ---------- frequencia cardiaca ----------

  /** FCmax estimada. Se a pessoa fez teste de esforco, o valor medido sempre vence. */
  function fcMax({ idade, medida }) {
    if (medida && Number(medida) > 0) {
      return { valor: Math.round(Number(medida)), origem: 'medida', aviso: null };
    }
    if (!idade || idade <= 0) return null;
    return {
      valor: Math.round(208 - 0.7 * idade),
      origem: 'estimada',
      aviso: 'Valor estimado por fórmula. A variação entre pessoas da mesma idade chega a 10-12 bpm, então use as zonas como referência e confira com o teste da fala.',
    };
  }

  const ZONAS = [
    {
      n: 1, nome: 'Z1 — Recuperação', faixa: [50, 60], cor: '#5AA9E6',
      sensacao: 'Muito leve. Dá para conversar frases inteiras sem esforço.',
      paraQue: 'Soltar o corpo no dia seguinte ao treino pesado e acelerar a recuperação.',
    },
    {
      n: 2, nome: 'Z2 — Base aeróbica', faixa: [60, 70], cor: '#4CAF7D',
      sensacao: 'Confortável. Você fala frases completas, mas já respira mais fundo.',
      paraQue: 'A base de tudo. É aqui que o coração ganha eficiência e o corpo aprende a usar gordura como combustível. Deve ocupar a maior parte do seu tempo de aeróbico.',
    },
    {
      n: 3, nome: 'Z3 — Moderado', faixa: [70, 80], cor: '#E8B84B',
      sensacao: 'Puxado. Você fala em frases curtas.',
      paraQue: 'Zona intermediária: cansa quase como a Z4 mas rende menos que ela. Use com parcimônia — é onde a maioria das pessoas treina errado, sempre no médio.',
    },
    {
      n: 4, nome: 'Z4 — Limiar', faixa: [80, 90], cor: '#F2762E',
      sensacao: 'Difícil. Só palavras soltas.',
      paraQue: 'Empurra o ponto em que o esforço vira insustentável. Melhora seu ritmo de prova e a tolerância ao acúmulo de lactato.',
    },
    {
      n: 5, nome: 'Z5 — VO₂máx', faixa: [90, 100], cor: '#E03131',
      sensacao: 'Máximo. Não dá para falar.',
      paraQue: 'Aumenta o teto do seu condicionamento. Só em blocos curtos e poucas vezes por semana — é a que mais cobra recuperação.',
    },
  ];

  /**
   * Calcula as zonas em bpm.
   * Com FC de repouso usa Karvonen (FC de reserva), que individualiza melhor.
   */
  function zonas({ fcMaxValor, fcRepouso }) {
    if (!fcMaxValor) return null;
    const rep = Number(fcRepouso) > 0 ? Number(fcRepouso) : null;
    const reserva = rep ? fcMaxValor - rep : null;
    const metodo = rep ? 'karvonen' : 'percentual';

    const calc = (pct) => (rep ? Math.round(rep + (reserva * pct) / 100) : Math.round((fcMaxValor * pct) / 100));

    return {
      metodo,
      fcMax: fcMaxValor,
      fcRepouso: rep,
      reserva,
      explicacao: rep
        ? 'Zonas calculadas por frequência cardíaca de reserva (Karvonen), que considera o seu coração em repouso — mais fiel do que só a porcentagem da máxima.'
        : 'Zonas calculadas por porcentagem da FC máxima. Informe sua FC de repouso no perfil para um cálculo mais individualizado.',
      lista: ZONAS.map((z) => ({
        ...z,
        min: calc(z.faixa[0]),
        max: calc(z.faixa[1]),
      })),
    };
  }

  /** Como medir a FC de repouso direito. */
  const COMO_MEDIR_REPOUSO =
    'Meça deitada, logo ao acordar, antes de levantar: conte os batimentos por 60 segundos. Repita em 3 manhãs e use a média. Café, álcool e noite mal dormida sobem o valor e estragam a medida.';

  /** Teste da fala: serve quando nao ha monitor de frequencia cardiaca. */
  const TESTE_FALA = [
    { zona: 'Z1-Z2', sinal: 'Consegue conversar normalmente, frases inteiras.' },
    { zona: 'Z3', sinal: 'Fala em frases curtas, precisa respirar no meio.' },
    { zona: 'Z4', sinal: 'Só palavras soltas.' },
    { zona: 'Z5', sinal: 'Não consegue falar.' },
  ];

  // ---------- modelos de sessao ----------

  const MODELOS = {
    base: {
      chave: 'base', nome: 'Base aeróbica (Z2)', zonaAlvo: 2, cor: '#4CAF7D',
      objetivo: 'Construir o motor aeróbico e a queima de gordura.',
      montar: ({ minutos }) => [
        { fase: 'Aquecimento', minutos: 8, zona: 1, descricao: 'Progrida do caminhar leve até o ritmo de Z2.' },
        { fase: 'Principal', minutos: Math.max(10, minutos - 13), zona: 2, descricao: 'Ritmo contínuo e confortável. Se estiver ofegante, diminua — a tentação é acelerar, e acelerar aqui estraga o treino.' },
        { fase: 'Volta à calma', minutos: 5, zona: 1, descricao: 'Reduza aos poucos até a respiração normalizar.' },
      ],
    },
    limiar: {
      chave: 'limiar', nome: 'Limiar (Z4)', zonaAlvo: 4, cor: '#F2762E',
      objetivo: 'Elevar o ritmo que você sustenta por muito tempo.',
      montar: ({ minutos }) => {
        const trabalho = Math.max(8, Math.round((minutos - 18) / 2));
        return [
          { fase: 'Aquecimento', minutos: 10, zona: 2, descricao: 'Solte as pernas e chegue no fim já respirando forte.' },
          { fase: 'Bloco 1', minutos: trabalho, zona: 4, descricao: 'Ritmo forte e constante — difícil, mas sustentável até o fim do bloco.' },
          { fase: 'Intervalo', minutos: 4, zona: 1, descricao: 'Trote bem leve ou caminhada.' },
          { fase: 'Bloco 2', minutos: trabalho, zona: 4, descricao: 'Mesmo ritmo do bloco 1. Se cair muito, o primeiro foi rápido demais.' },
          { fase: 'Volta à calma', minutos: 5, zona: 1, descricao: 'Desacelere progressivamente.' },
        ];
      },
    },
    intervalado: {
      chave: 'intervalado', nome: 'Intervalado VO₂ (4x4)', zonaAlvo: 5, cor: '#E03131',
      objetivo: 'Subir o teto do condicionamento (VO₂máx).',
      montar: () => [
        { fase: 'Aquecimento', minutos: 10, zona: 2, descricao: 'Progressivo, terminando já acelerada.' },
        { fase: '4 min forte (1/4)', minutos: 4, zona: 5, descricao: 'Ritmo que você aguentaria uns 6 minutos no máximo.' },
        { fase: 'Recupera', minutos: 3, zona: 1, descricao: 'Bem leve. A recuperação é parte do estímulo.' },
        { fase: '4 min forte (2/4)', minutos: 4, zona: 5, descricao: 'Segure o mesmo ritmo do primeiro.' },
        { fase: 'Recupera', minutos: 3, zona: 1, descricao: 'Bem leve.' },
        { fase: '4 min forte (3/4)', minutos: 4, zona: 5, descricao: 'Aqui começa a doer. Mantenha.' },
        { fase: 'Recupera', minutos: 3, zona: 1, descricao: 'Bem leve.' },
        { fase: '4 min forte (4/4)', minutos: 4, zona: 5, descricao: 'Último. Se sobrar gás, o ritmo estava conservador.' },
        { fase: 'Volta à calma', minutos: 6, zona: 1, descricao: 'Não pare de uma vez.' },
      ],
    },
    hiit: {
      chave: 'hiit', nome: 'HIIT curto (30/30)', zonaAlvo: 5, cor: '#C2255C',
      objetivo: 'Estímulo intenso em pouco tempo.',
      montar: ({ tiros = 12 }) => [
        { fase: 'Aquecimento', minutos: 10, zona: 2, descricao: 'Não pule: entrar frio em tiro é receita de lesão.' },
        { fase: `${tiros} tiros de 30s`, minutos: tiros, zona: 5, descricao: '30 segundos muito forte / 30 segundos bem leve, sem parar entre eles.' },
        { fase: 'Volta à calma', minutos: 6, zona: 1, descricao: 'Leve até a respiração acalmar.' },
      ],
    },
    recuperacao: {
      chave: 'recuperacao', nome: 'Recuperação (Z1)', zonaAlvo: 1, cor: '#5AA9E6',
      objetivo: 'Ativar a circulação sem cobrar nada do corpo.',
      montar: ({ minutos }) => [
        { fase: 'Contínuo leve', minutos: Math.min(minutos, 35), zona: 1, descricao: 'Se em algum momento parecer treino, está forte demais.' },
      ],
    },
  };

  /** Monta a sessao a partir do modelo. */
  function montarSessao({ modelo, minutos = 40, modalidade = 'corrida', tiros = 12, zonasCalc = null }) {
    const m = MODELOS[modelo] || MODELOS.base;
    const blocos = m.montar({ minutos, tiros }).map((b) => {
      const z = zonasCalc ? zonasCalc.lista.find((x) => x.n === b.zona) : null;
      return { ...b, bpm: z ? { min: z.min, max: z.max } : null, zonaNome: (ZONAS.find((x) => x.n === b.zona) || {}).nome };
    });
    return {
      modelo: m.chave,
      nome: m.nome,
      objetivo: m.objetivo,
      cor: m.cor,
      modalidade,
      blocos,
      duracao: blocos.reduce((s, b) => s + b.minutos, 0),
    };
  }

  // ---------- carga e progressao ----------

  /** PSE-sessao (Foster): minutos x esforco percebido de 0 a 10. */
  function cargaSessao(minutos, pse) {
    minutos = Number(minutos) || 0;
    pse = Number(pse) || 0;
    return Math.round(minutos * pse);
  }

  /**
   * Regra dos 10%: subir volume mais rapido que isso e a principal causa
   * de lesao por excesso em quem corre.
   */
  function progressaoSemanal(minutosSemanaAtual, semanaDoCiclo = 1) {
    const atual = Number(minutosSemanaAtual) || 0;
    // toda 4a semana e leve, para o corpo assimilar
    if (semanaDoCiclo % 4 === 0) {
      return {
        minutos: Math.round(atual * 0.6),
        tipo: 'leve',
        motivo: 'Quarta semana do ciclo: corte para ~60% do volume. É na semana leve que a adaptação aparece.',
      };
    }
    return {
      minutos: Math.round(atual * 1.1),
      tipo: 'progressao',
      motivo: 'Aumento de 10% sobre a semana anterior — o teto seguro para não virar lesão por excesso.',
    };
  }

  /** Distribuicao polarizada: a maior parte do tempo tem que ser leve de verdade. */
  function distribuicao(minutosSemana) {
    const total = Number(minutosSemana) || 0;
    return {
      leve: Math.round(total * 0.8),
      intenso: Math.round(total * 0.2),
      explicacao: 'Cerca de 80% do tempo em Z1-Z2 e 20% em Z4-Z5. O erro mais comum é passar a semana inteira na Z3: cansa como treino forte e rende como treino leve.',
    };
  }

  /** Gasto calorico estimado por METs. E estimativa, nao medida. */
  const METS = {
    caminhada: 3.5, caminhada_inclinada: 6.0, corrida_leve: 8.0, corrida_forte: 11.5,
    bike: 7.0, bike_forte: 10.5, eliptico: 5.0, remo: 7.0, natacao: 8.0,
    escada: 9.0, pular_corda: 11.0, danca: 6.0,
  };

  function calorias({ modalidade, minutos, pesoKg }) {
    const met = METS[modalidade];
    if (!met || !pesoKg || !minutos) return null;
    return {
      kcal: Math.round((met * 3.5 * pesoKg / 200) * minutos),
      met,
      aviso: 'Estimativa por METs, com margem de erro de 15-20%. Serve para comparar sessões entre si, não como número exato para dieta.',
    };
  }

  // ---------- combinar forca e aerobico ----------

  /**
   * Efeito de interferencia: aerobico intenso perto do treino de forca
   * atrapalha ganho de forca e massa. Estas sao as regras que resolvem 90% dos casos.
   */
  function ordenarNoDia({ objetivo = 'hipertrofia', intensidadeCardio = 'leve' }) {
    if (intensidadeCardio === 'leve') {
      return {
        ordem: 'tanto faz',
        texto: 'Aeróbico leve (Z1-Z2) não atrapalha a musculação. Pode fazer antes como aquecimento ou depois como volta à calma.',
        risco: 'baixo',
      };
    }
    if (objetivo === 'hipertrofia' || objetivo === 'forca') {
      return {
        ordem: 'força primeiro',
        texto: 'Faça a musculação primeiro. Aeróbico intenso antes derruba a carga que você levanta, e é a carga que dá o estímulo. Se der para separar em períodos diferentes do dia, melhor ainda: 6 horas de intervalo já reduz bastante a interferência.',
        risco: 'alto',
      };
    }
    return {
      ordem: 'aeróbico primeiro',
      texto: 'Como o foco é condicionamento, faça o aeróbico intenso descansada e deixe a musculação depois.',
      risco: 'médio',
    };
  }

  /** Avisa sobre choque entre um dia de cardio intenso e um treino pesado de pernas. */
  function conflitoComPernas({ diasEntre }) {
    if (diasEntre === null || diasEntre === undefined) return null;
    if (diasEntre >= 1) return null;
    return {
      conflito: true,
      texto: 'Tiros intensos e treino pesado de pernas no mesmo dia (ou em dias colados) competem pela mesma recuperação. Deixe pelo menos 24 horas entre os dois, ou coloque o cardio intenso logo depois do treino de pernas, no mesmo dia, para preservar um dia inteiro de descanso.',
    };
  }

  /** Semana pronta conforme frequencia e objetivo. */
  function planoSemanal({ freqCardio = 3, objetivo = 'hipertrofia', minutosBase = 40 }) {
    const sessoes = [];
    const intensasPorObjetivo = { hipertrofia: 1, forca: 1, emagrecimento: 1, resistencia: 2 };
    const maxIntensas = Math.min(intensasPorObjetivo[objetivo] ?? 1, Math.max(1, Math.floor(freqCardio / 2)));

    for (let i = 0; i < freqCardio; i++) {
      if (i < maxIntensas && freqCardio >= 2) {
        sessoes.push({ modelo: objetivo === 'resistencia' ? 'intervalado' : 'limiar', minutos: Math.min(minutosBase, 45) });
      } else {
        sessoes.push({ modelo: 'base', minutos: minutosBase });
      }
    }

    const total = sessoes.reduce((s, x) => s + x.minutos, 0);
    return {
      sessoes,
      minutosTotais: total,
      distribuicao: distribuicao(total),
      nota: objetivo === 'hipertrofia'
        ? 'Com foco em massa muscular, o aeróbico entra em dose baixa e principalmente na Z2: o suficiente para o coração, sem competir com a recuperação da musculação.'
        : objetivo === 'emagrecimento'
        ? 'Para emagrecer, o que mais pesa é o volume total de Z2 na semana, não a intensidade de uma sessão. Constância vence intensidade aqui.'
        : null,
    };
  }

  return {
    fcMax, zonas, ZONAS, COMO_MEDIR_REPOUSO, TESTE_FALA,
    MODELOS, montarSessao,
    cargaSessao, progressaoSemanal, distribuicao, calorias, METS,
    ordenarNoDia, conflitoComPernas, planoSemanal,
  };
})();
