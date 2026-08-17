/* Engine de gamificacao: XP, nivel, badges, sequencia de dias e o coach por chat.
   Modelo (formula de XP e faixas de nivel) reaproveitado do VYRON, que ja tinha isso
   afinado. Os badges foram redesenhados: os do VYRON checavam a semana de um programa
   fixo de calistenia de 12 semanas que este app não tem — aqui checam dado real que
   o TRIVOX guarda (sessões, streak, cargas, volume).
   O coach não é IA: é o mesmo modelo do VYRON, banco de frases por tema + palavra-chave.
   Isso evita depender de internet ou de uma API paga — e o app continua funcionando
   offline, que é premissa do projeto. */

const Gamificacao = (() => {

  // ---------- XP e nivel ----------

  // limiares reaproveitados do VYRON (ja testados por ela em produção)
  const NIVEIS = [
    { chave: 'iniciante', nome: 'Iniciante', icon: '🌱', xpMin: 0 },
    { chave: 'intermediario', nome: 'Intermediário', icon: '⚡', xpMin: 500 },
    { chave: 'avancado', nome: 'Avançado', icon: '🔥', xpMin: 1500 },
    { chave: 'elite', nome: 'Elite', icon: '👑', xpMin: 3000 },
  ];

  function nivelPorXP(xp) {
    xp = Number(xp) || 0;
    let atual = NIVEIS[0];
    for (const n of NIVEIS) if (xp >= n.xpMin) atual = n;
    const i = NIVEIS.indexOf(atual);
    const proximo = NIVEIS[i + 1] || null;
    return {
      ...atual,
      xp,
      proximo,
      faltam: proximo ? proximo.xpMin - xp : 0,
      progresso: proximo ? Math.round(((xp - atual.xpMin) / (proximo.xpMin - atual.xpMin)) * 100) : 100,
    };
  }

  /** XP de uma sessão de força: mesma fórmula do VYRON (exercícios×10 + minutos). */
  function xpSessaoForca({ numExercicios = 0, duracaoMin = 0 }) {
    return Math.round(numExercicios * 10 + duracaoMin);
  }

  /** Sessão de cardio não tem "exercícios": pontua por minuto, um pouco mais que força
   *  por minuto equivalente, pra compensar não ter esse termo. */
  function xpSessaoCardio({ duracaoMin = 0 }) {
    return Math.round(duracaoMin * 5);
  }

  // ---------- streak (sequencia de dias treinados) ----------

  /**
   * dias: array de strings 'aaaa-mm-dd' (ja deduplicadas), ordenadas crescente.
   * Conta streak atual (termina hoje ou ontem — treinar ontem ainda mantém a sequência
   * viva até o fim do dia de hoje) e o maior streak já alcançado.
   */
  function calcularStreak(dias, hoje = new Date()) {
    if (!dias || !dias.length) return { atual: 0, maximo: 0 };
    const hojeStr = hoje.toLocaleDateString('sv-SE');
    const ontemStr = new Date(hoje.getTime() - 864e5).toLocaleDateString('sv-SE');
    const set = new Set(dias);

    let maximo = 0, corrente = 0, anterior = null;
    for (const d of dias) {
      const dt = new Date(d + 'T00:00:00');
      if (anterior && (dt - anterior) === 864e5) corrente++;
      else corrente = 1;
      maximo = Math.max(maximo, corrente);
      anterior = dt;
    }

    // streak atual: anda pra tras a partir de hoje (ou ontem) enquanto o dia existir no set
    let atual = 0;
    let cursor = set.has(hojeStr) ? hojeStr : (set.has(ontemStr) ? ontemStr : null);
    if (cursor) {
      let cursorDt = new Date(cursor + 'T00:00:00');
      while (set.has(cursorDt.toLocaleDateString('sv-SE'))) {
        atual++;
        cursorDt = new Date(cursorDt.getTime() - 864e5);
      }
    }

    return { atual, maximo };
  }

  // ---------- badges ----------
  // check(ctx) recebe um resumo pronto (veja avaliarBadges) — nada de recalcular tudo em cada badge.

  const BADGES = [
    { id: 'primeiro_treino', icon: '🌱', nome: 'Primeiro Passo', desc: 'Complete a sua primeira sessão de treino', check: (c) => c.totalSessoes >= 1 },
    { id: 'semana_completa', icon: '⭐', nome: 'Semana Completa', desc: '4 sessões de treino em uma mesma semana', check: (c) => c.maxSessoesSemana >= 4 },
    { id: 'dedicado', icon: '🏃', nome: 'Dedicado', desc: '7 dias seguidos treinando', check: (c) => c.streakMaximo >= 7 },
    { id: 'consistencia', icon: '🎯', nome: 'Consistência', desc: '30 dias seguidos treinando', check: (c) => c.streakMaximo >= 30 },
    { id: 'dez_treinos', icon: '🏋️', nome: 'Pegando o Ritmo', desc: '10 sessões de força completadas', check: (c) => c.totalForca >= 10 },
    { id: 'veterano', icon: '🎖️', nome: 'Veterano', desc: '50 sessões de força completadas', check: (c) => c.totalForca >= 50 },
    { id: 'recorde', icon: '📈', nome: 'Novo Recorde', desc: 'Bata seu recorde de carga em algum exercício', check: (c) => c.temRecorde },
    { id: 'quebra_plato', icon: '💥', nome: 'Quebrou o Platô', desc: 'Suba a carga depois de 4+ sessões estagnado num exercício', check: (c) => c.quebrouPlato },
    { id: 'aerobico_5', icon: '❤️', nome: 'Aeróbico em Dia', desc: '5 sessões de aeróbico registradas', check: (c) => c.totalCardio >= 5 },
    { id: 'equilibrado', icon: '⚖️', nome: 'Equilibrado', desc: 'Volume semanal sem nenhum músculo fora da faixa recomendada', check: (c) => c.volumeEquilibrado },
    { id: 'tres_fichas', icon: '📋', nome: 'Ficha Redonda', desc: 'Monte 3 fichas de treino diferentes', check: (c) => c.totalFichas >= 3 },
    { id: 'lenda', icon: '👑', nome: 'LENDA TRIVOX', desc: 'Desbloqueie todos os outros badges', check: (c) => c.badgesAntes >= 11 },
  ];

  /**
   * Confere quais badges novos foram desbloqueados.
   * ctx: { totalSessoes, totalForca, totalCardio, maxSessoesSemana, streakMaximo,
   *        temRecorde, quebrouPlato, volumeEquilibrado, totalFichas }
   * jaTinha: array de ids ja desbloqueados antes.
   */
  function avaliarBadges(ctx, jaTinha = []) {
    const antes = new Set(jaTinha);
    const ctxCompleto = { ...ctx, badgesAntes: antes.size };
    const novos = [];
    for (const b of BADGES) {
      if (!antes.has(b.id) && b.check(ctxCompleto)) novos.push(b);
    }
    return novos;
  }

  // ---------- coach (banco de frases por tema + palavra-chave, sem IA) ----------

  const COACH_TEMAS = {
    treino: {
      nome: '💪 Dica de treino', icon: '💪',
      frases: [
        'Progressão importa mais que a série perfeita: se hoje você fez 1 rep a mais que semana passada, já valeu.',
        'Exercício composto primeiro, isolado depois. A ordem errada rouba força justamente do que mais cansa.',
        'RIR 1-2 na maior parte das séries é o ponto ideal: perto da falha sem quebrar a técnica.',
        'Descanso curto não é disciplina, é carga desperdiçada. Composto pesado pede 90-180s.',
        'Se três semanas seguidas você não sobe nem carga nem reps em algo, isso é platô — hora de mudar uma variável.',
      ],
    },
    motivacao: {
      nome: '🔥 Motivação', icon: '🔥',
      frases: [
        'Ninguém sente vontade todo dia. Quem é consistente treina mesmo sem vontade — a vontade vem depois, no meio do treino.',
        'Você não precisa de um treino perfeito hoje. Precisa de um treino feito.',
        'Comparar com seu treino de 3 meses atrás, não com o de outra pessoa.',
        'Um dia ruim de treino ainda bate um dia sem treino.',
      ],
    },
    recuperacao: {
      nome: '😴 Recuperação', icon: '😴',
      frases: [
        'O músculo cresce no descanso, não na academia. Treino é o estímulo; sono e comida são a resposta.',
        'Dor que não passa em 3-4 dias, ou dor articular (não muscular), merece atenção — não é "só treinar mesmo assim".',
        'Dormir menos de 7h prejudica a recuperação de carga tanto quanto pular um treino.',
        'Uma semana de deload a cada 4-6 semanas não é frescura: é o que evita platô e lesão por acúmulo.',
      ],
    },
    nutricao: {
      nome: '🥗 Nutrição', icon: '🥗',
      frases: [
        'Para ganhar força e massa, 1,6-2,2g de proteína por kg de peso corporal é a faixa que a maioria dos estudos sustenta.',
        'Treino sem comer o suficiente é treino que não vira resultado — o corpo não tem matéria-prima pra reconstruir.',
        'Não existe alimento mágico pré-treino. O que importa é a rotina dos outros dias.',
        'Para emagrecer sem perder força, corte devagar: 300-500 kcal abaixo da manutenção é suficiente.',
      ],
    },
  };

  // palavras-chave -> tema, pra quando a pessoa digita livre em vez de escolher o botao
  const PALAVRAS_TEMA = [
    [/dorm|sono|descans|recup|dolorid|dor muscular/i, 'recuperacao'],
    [/prote|caloria|dieta|comer|nutri|macro|emagre/i, 'nutricao'],
    [/desanim|cansad[ao] de|sem vontade|desist|motiva/i, 'motivacao'],
    [/plato|estagn|carga|serie|repeti[cç][aã]o|treino/i, 'treino'],
  ];

  function temaPorTexto(texto) {
    for (const [re, tema] of PALAVRAS_TEMA) if (re.test(texto)) return tema;
    return null;
  }

  /**
   * Responde uma pergunta livre ou um tema escolhido por botão.
   * contexto (opcional): { nome, streak, nivel } — personaliza um toque a resposta.
   */
  function responderCoach(entrada, contexto = {}) {
    const tema = COACH_TEMAS[entrada] ? entrada : (temaPorTexto(entrada) || 'motivacao');
    const banco = COACH_TEMAS[tema];
    const frase = banco.frases[Math.floor(seed(entrada) % banco.frases.length)];

    let extra = '';
    if (tema === 'motivacao' && contexto.streak >= 3) {
      extra = ` Você está numa sequência de ${contexto.streak} dias — não quebra ela hoje.`;
    }

    return { tema, temaNome: banco.nome, icon: banco.icon, texto: frase + extra };
  }

  /** Hash simples e determinístico — mesma pergunta sempre cai na mesma frase nesta sessão. */
  function seed(texto) {
    let h = 0;
    for (let i = 0; i < texto.length; i++) h = (h * 31 + texto.charCodeAt(i)) >>> 0;
    // varia um pouco por minuto, pra nao ficar sempre identico em perguntas repetidas
    return h + Math.floor(Date.now() / 60000);
  }

  return {
    NIVEIS, nivelPorXP, xpSessaoForca, xpSessaoCardio,
    calcularStreak,
    BADGES, avaliarBadges,
    COACH_TEMAS, responderCoach, temaPorTexto,
  };
})();
