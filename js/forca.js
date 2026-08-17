/* Engine de musculacao.
   Referencias usadas nas contas:
   - 1RM estimado: Epley, Brzycki e Lombardi (media das tres, confiavel ate ~10 reps)
   - Autorregulacao por RIR (reps em reserva) — 1 RIR vale ~3,5% de carga
   - Volume semanal contado em series por grupo muscular, com contagem fracionada
     (musculo primario conta 1 serie, secundario conta 0,5)
   - Dupla progressao: sobe reps ate o topo da faixa, so entao sobe carga */

const Forca = (() => {

  // ---------- 1RM ----------

  /** Estima o 1RM a partir de uma serie levada perto da falha. */
  function umRM(carga, reps, rir = 0) {
    carga = Number(carga); reps = Number(reps);
    if (!(carga > 0) || !(reps > 0)) return null;

    // reps em reserva contam como reps que voce ainda faria
    const repsEfetivas = reps + Math.max(0, Number(rir) || 0);
    if (repsEfetivas === 1) {
      return { valor: carga, epley: carga, brzycki: carga, lombardi: carga, confiavel: true, repsEfetivas };
    }

    const epley = carga * (1 + repsEfetivas / 30);
    const brzycki = repsEfetivas < 37 ? carga * (36 / (37 - repsEfetivas)) : null;
    const lombardi = carga * Math.pow(repsEfetivas, 0.10);

    const validas = [epley, brzycki, lombardi].filter((v) => v && isFinite(v));
    const media = validas.reduce((s, v) => s + v, 0) / validas.length;

    return {
      valor: arredondar(media, 0.5),
      epley: arredondar(epley, 0.5),
      brzycki: brzycki ? arredondar(brzycki, 0.5) : null,
      lombardi: arredondar(lombardi, 0.5),
      confiavel: repsEfetivas <= 10, // acima disso a estimativa erra muito
      repsEfetivas,
    };
  }

  // % do 1RM por numero de reps (tabela classica de Baechle)
  const TABELA_PCT = {
    1: 100, 2: 95, 3: 93, 4: 90, 5: 87, 6: 85, 7: 83, 8: 80,
    9: 77, 10: 75, 11: 72, 12: 70, 13: 68, 14: 66, 15: 65,
    16: 63, 17: 62, 18: 61, 19: 60, 20: 59,
  };

  function percentualPorReps(reps) {
    reps = Math.round(Number(reps) || 0);
    if (reps < 1) return null;
    if (TABELA_PCT[reps]) return TABELA_PCT[reps];
    return reps > 20 ? 55 : null;
  }

  /** Carga de trabalho para um numero-alvo de reps, dado o 1RM. */
  function cargaParaReps(rm, reps, incremento = 1.25) {
    const pct = percentualPorReps(reps);
    if (!rm || !pct) return null;
    return arredondar((rm * pct) / 100, incremento);
  }

  // ---------- prescricao por objetivo ----------

  const OBJETIVOS = {
    forca: {
      nome: 'Força',
      series: [3, 6], reps: [3, 6], rirAlvo: 2, descanso: [180, 300], pct: [85, 92],
      resumo: 'Cargas altas, poucas reps e descanso longo. O descanso não é opcional: é ele que devolve a força para a série seguinte.',
    },
    hipertrofia: {
      nome: 'Hipertrofia',
      series: [3, 4], reps: [6, 12], rirAlvo: 1, descanso: [90, 180], pct: [67, 85],
      resumo: 'A faixa de 6 a 12 reps próxima da falha (RIR 1-2) é o miolo do estímulo. Volume semanal manda mais que a carga de um dia.',
    },
    resistencia: {
      nome: 'Resistência muscular',
      series: [2, 3], reps: [15, 20], rirAlvo: 2, descanso: [30, 60], pct: [50, 65],
      resumo: 'Muitas reps com descanso curto. Serve de base para quem está voltando ou para complementar o aeróbico.',
    },
    emagrecimento: {
      nome: 'Emagrecimento',
      series: [3, 4], reps: [10, 15], rirAlvo: 2, descanso: [45, 90], pct: [60, 75],
      resumo: 'Musculação aqui é para preservar massa magra durante o déficit — o gasto calórico vem principalmente do aeróbico e do dia a dia.',
    },
  };

  /** Sugestao de series/reps/descanso para um exercicio, conforme objetivo e se e composto. */
  function prescrever(objetivo, exercicio) {
    const o = OBJETIVOS[objetivo] || OBJETIVOS.hipertrofia;
    const composto = ehComposto(exercicio);
    const [sMin, sMax] = o.series;
    const [rMin, rMax] = o.reps;
    const [dMin, dMax] = o.descanso;
    return {
      series: composto ? sMax : sMin,
      reps: `${rMin}-${rMax}`,
      repsMin: rMin,
      repsMax: rMax,
      rirAlvo: o.rirAlvo,
      // composto cansa mais o corpo inteiro, entao pede o descanso do topo da faixa
      descanso: composto ? dMax : dMin,
    };
  }

  /** Exercicio composto = move mais de uma articulacao / recruta muitos musculos. */
  function ehComposto(ex) {
    if (!ex) return false;
    const nSec = (ex.musculos_secundarios || []).length;
    const nPri = (ex.musculos_primarios || []).length;
    const catsCompostas = ['pernas', 'costas', 'peito', 'ombros', 'empurrar', 'puxar', 'pernas_cal', 'funcional', 'skills', 'gluteos'];
    return nPri + nSec >= 3 && catsCompostas.includes(ex.categoria);
  }

  // ---------- autorregulacao por RIR ----------

  const PCT_POR_RIR = 3.5; // 1 rep em reserva ~ 3,5% de carga

  /**
   * Olha a ultima execucao e diz o que fazer hoje.
   * historico: [{data, carga, reps, rir}] mais recente primeiro
   * item: {repsMin, repsMax, rirAlvo}
   */
  function sugerirCarga(historico, item, incremento = 1.25) {
    if (!historico || !historico.length) {
      return { carga: null, motivo: 'Primeira vez neste exercício: escolha uma carga que você pare com 2 reps na reserva.', tipo: 'inicio' };
    }

    const ult = historico[0];
    const cargaAnt = Number(ult.carga) || 0;
    const repsFeitas = Number(ult.reps) || 0;
    const rirFeito = ult.rir === null || ult.rir === undefined ? null : Number(ult.rir);
    const rirAlvo = item.rirAlvo ?? 1;
    const repsMax = item.repsMax ?? 12;
    const repsMin = item.repsMin ?? 6;

    if (!cargaAnt) {
      return { carga: null, motivo: 'Sem carga registrada na última sessão.', tipo: 'inicio' };
    }

    // 1) RIR informado manda: e a medida direta de quao perto da falha voce chegou
    if (rirFeito !== null && !isNaN(rirFeito)) {
      const folga = rirFeito - rirAlvo; // positivo = sobrou gas
      if (Math.abs(folga) >= 1) {
        const nova = arredondar(cargaAnt * (1 + (folga * PCT_POR_RIR) / 100), incremento);
        if (nova !== cargaAnt) {
          return {
            carga: nova,
            motivo: folga > 0
              ? `Você parou com ${rirFeito} reps na reserva e o alvo era ${rirAlvo}: sobrou estímulo na mesa, sobe a carga.`
              : `Você chegou mais perto da falha do que o alvo (${rirFeito} vs ${rirAlvo}): alivia a carga para conseguir repetir a qualidade nas próximas séries.`,
            tipo: folga > 0 ? 'subir' : 'baixar',
            delta: arredondar(nova - cargaAnt, 0.01),
          };
        }
      }
    }

    // 2) dupla progressao: bateu o topo da faixa de reps -> sobe carga
    if (repsFeitas >= repsMax) {
      const nova = arredondar(cargaAnt + incrementoPorPorte(cargaAnt, incremento), incremento);
      return {
        carga: nova,
        motivo: `Você fechou ${repsFeitas} reps, o topo da faixa: sobe a carga e volta para o começo da faixa (${repsMin} reps).`,
        tipo: 'subir',
        delta: arredondar(nova - cargaAnt, 0.01),
      };
    }

    // 3) nao alcancou nem o piso da faixa -> carga alta demais
    if (repsFeitas > 0 && repsFeitas < repsMin) {
      const nova = arredondar(cargaAnt * 0.925, incremento);
      return {
        carga: nova,
        motivo: `Você fez ${repsFeitas} reps e o piso da faixa é ${repsMin}: a carga está acima do que sustenta boa execução.`,
        tipo: 'baixar',
        delta: arredondar(nova - cargaAnt, 0.01),
      };
    }

    // 4) dentro da faixa -> mantem e tenta somar reps
    return {
      carga: cargaAnt,
      motivo: `Mantenha ${cargaAnt} kg e tente somar 1 rep em cada série. Só suba a carga quando fechar ${repsMax}.`,
      tipo: 'manter',
      delta: 0,
    };
  }

  /** Salto de carga proporcional: 2,5 kg num supino de 100 kg e diferente de 2,5 kg numa rosca de 10 kg. */
  function incrementoPorPorte(carga, incremento) {
    const salto = carga >= 60 ? 5 : carga >= 25 ? 2.5 : 1.25;
    return Math.max(incremento, salto);
  }

  // ---------- plato ----------

  /** Plato = 4+ sessoes sem a carga nem as reps saírem do lugar. */
  function detectarPlato(historico) {
    if (!historico || historico.length < 4) return { plato: false, sessoes: historico ? historico.length : 0 };
    const recentes = historico.slice(0, 5);
    const cargas = recentes.map((s) => Number(s.carga) || 0);
    const reps = recentes.map((s) => Number(s.reps) || 0);
    const varCarga = Math.max(...cargas) - Math.min(...cargas);
    const varReps = Math.max(...reps) - Math.min(...reps);
    const plato = varCarga <= 2.5 && varReps <= 1;
    return {
      plato,
      sessoes: recentes.length,
      varCarga,
      varReps,
      saida: plato
        ? 'Antes de trocar o exercício, tente nesta ordem: (1) dormir e comer melhor por uma semana, (2) tirar 1 série e subir a intensidade, (3) mudar a faixa de reps, (4) trocar por uma variação do mesmo padrão de movimento.'
        : null,
    };
  }

  // ---------- volume semanal ----------

  // faixas de series semanais por grupo muscular (referencia de hipertrofia)
  const FAIXA_VOLUME = { minimo: 10, otimo: [12, 20], maximo: 22 };

  /**
   * Conta series por musculo na semana. Primario conta 1, secundario conta 0,5.
   * fichas: as fichas que a pessoa treina na semana
   */
  function volumeSemanal(fichas, baseExercicios) {
    const porMusculo = {};
    const soma = (musculo, qtd) => {
      if (!musculo) return;
      porMusculo[musculo] = (porMusculo[musculo] || 0) + qtd;
    };

    for (const ficha of fichas) {
      for (const item of ficha.exercicios || []) {
        const ex = baseExercicios.find((e) => e.id === item.exId);
        if (!ex) continue;
        const series = Number(item.series) || 0;
        (ex.musculos_primarios || []).forEach((m) => soma(m, series));
        (ex.musculos_secundarios || []).forEach((m) => soma(m, series * 0.5));
      }
    }

    return Object.entries(porMusculo)
      .map(([musculo, series]) => ({
        musculo,
        series: Math.round(series * 10) / 10,
        situacao: classificarVolume(series),
      }))
      .sort((a, b) => b.series - a.series);
  }

  function classificarVolume(series) {
    if (series < FAIXA_VOLUME.minimo) return { chave: 'baixo', texto: 'Abaixo do mínimo', cor: 'aviso' };
    if (series > FAIXA_VOLUME.maximo) return { chave: 'alto', texto: 'Acima do que costuma dar para recuperar', cor: 'perigo' };
    return { chave: 'ok', texto: 'Na faixa', cor: 'ok' };
  }

  // ---------- deload ----------

  /** Semana leve a cada 4-6 semanas, ou antes se o corpo pedir. */
  function avaliarDeload({ semanasSeguidas = 0, platosAtivos = 0, pseMedia = null }) {
    const motivos = [];
    if (semanasSeguidas >= 6) motivos.push(`${semanasSeguidas} semanas seguidas sem semana leve`);
    if (platosAtivos >= 2) motivos.push(`${platosAtivos} exercícios estagnados ao mesmo tempo`);
    if (pseMedia !== null && pseMedia >= 8.5) motivos.push(`percepção de esforço média em ${pseMedia.toFixed(1)} de 10`);

    return {
      recomendado: motivos.length > 0,
      motivos,
      comoFazer: 'Mantenha os mesmos exercícios e a mesma carga, mas corte as séries pela metade e pare a 3-4 reps da falha, por uma semana. Não é férias: é o que faz o ganho aparecer.',
    };
  }

  // ---------- gerador automatico de treino por objetivo ----------

  // divisao de treino por dias/semana disponiveis (o "split")
  const SPLITS = {
    1: [{ nome: 'Full Body', cats: ['pernas', 'gluteos', 'peito', 'costas', 'ombros', 'core'] }],
    2: [
      { nome: 'Superior', cats: ['peito', 'costas', 'ombros', 'biceps', 'triceps'] },
      { nome: 'Inferior', cats: ['pernas', 'gluteos', 'core'] },
    ],
    3: [
      { nome: 'Pernas e Glúteos', cats: ['pernas', 'gluteos'] },
      { nome: 'Empurrar — Peito, Ombro e Tríceps', cats: ['peito', 'ombros', 'triceps'] },
      { nome: 'Puxar — Costas e Bíceps', cats: ['costas', 'biceps', 'core'] },
    ],
    4: [
      { nome: 'Peito e Tríceps', cats: ['peito', 'triceps'] },
      { nome: 'Costas e Bíceps', cats: ['costas', 'biceps'] },
      { nome: 'Pernas e Glúteos', cats: ['pernas', 'gluteos'] },
      { nome: 'Ombros e Core', cats: ['ombros', 'core'] },
    ],
    5: [
      { nome: 'Peito', cats: ['peito'] },
      { nome: 'Costas', cats: ['costas'] },
      { nome: 'Pernas e Glúteos', cats: ['pernas', 'gluteos'] },
      { nome: 'Ombros', cats: ['ombros'] },
      { nome: 'Braços e Core', cats: ['biceps', 'triceps', 'core'] },
    ],
  };

  function splitPara(freq) {
    if (freq <= 1) return SPLITS[1];
    if (freq >= 6) return [...SPLITS[5], { nome: 'Full Body Extra', cats: ['funcional', 'core', 'pernas'] }];
    return SPLITS[Math.min(freq, 5)];
  }

  const nivelN = { iniciante: 0, intermediario: 1, avancado: 2, elite: 3 };

  /**
   * Gera um plano completo de fichas a partir do objetivo e do perfil.
   * base: array de exercicios (data/exercicios.json)
   * diasSemana: dias da semana marcados no perfil (0=domingo...6=sabado) — quando informado,
   *             manda mais que freqForca (numero) pra decidir quantas fichas gerar, e cada
   *             ficha sai ja ligada ao dia certo (ver campo diaSemana no retorno).
   * rotacao: inteiro que varia a selecao sem mudar a logica — 0 sempre da o mesmo
   *          resultado (bom pra teste); "gerar novamente" na UI passa outro valor.
   */
  function gerarPlano({ objetivo = 'hipertrofia', nivel = 'iniciante', local = 'academia', freqForca = 3, diasSemana = [], base = [], rotacao = 0 }) {
    const numDias = diasSemana.length || freqForca;
    const dias = splitPara(numDias);
    const uN = nivelN[nivel] ?? 0;
    const casa = local === 'casa' || local === 'parque' || local === 'sem_equip';

    // pool geral: nivel adequado (ate 1 acima do usuario, pra ter margem de progressao)
    let pool = base.filter((e) => (nivelN[e.nivel] ?? 0) <= uN + 1);
    if (casa) {
      // em casa/parque so entra peso corporal e as categorias de calistenia equivalentes
      const catsCal = ['empurrar', 'puxar', 'pernas_cal', 'core_cal', 'skills', 'funcional', 'alongamento', 'mobilidade', 'equilibrio'];
      pool = pool.filter((e) => e.equipamento === 'Peso corporal' || catsCal.includes(e.categoria));
    }

    // equivalencia de categoria quando o pool de academia nao cobre (ex.: sem barra em casa,
    // pernas puxa de pernas_cal tambem)
    const equivalencia = { pernas: ['pernas', 'pernas_cal'], core: ['core', 'core_cal'], peito: ['peito', 'empurrar'], costas: ['costas', 'puxar'] };

    const fichas = dias.map((dia, iDia) => {
      const catsExpandidas = dia.cats.flatMap((c) => equivalencia[c] || [c]);
      const porCategoria = catsExpandidas.map((cat) => {
        const candidatos = pool
          .filter((e) => e.categoria === cat)
          .sort((a, b) => (Forca.ehComposto ? 0 : 0)); // mantem ordem original (mais estaveis pra id)
        // compostos primeiro, isolados depois — dentro de cada grupo, roda pela rotacao
        const compostos = candidatos.filter((e) => ehComposto(e));
        const isolados = candidatos.filter((e) => !ehComposto(e));
        const girar = (lista) => lista.length ? [...lista.slice(rotacao % lista.length), ...lista.slice(0, rotacao % lista.length)] : lista;
        return { cat, compostos: girar(compostos), isolados: girar(isolados) };
      });

      // meta de exercicios no dia: mais grupos musculares = mais exercicios, mas com teto
      const metaTotal = Math.min(8, Math.max(4, catsExpandidas.length * 2 + 2));
      const porGrupo = Math.max(1, Math.round(metaTotal / dia.cats.length));

      const escolhidos = [];
      const usados = new Set();
      for (const grupo of porCategoria) {
        let restam = porGrupo;
        for (const lista of [grupo.compostos, grupo.isolados]) {
          for (const ex of lista) {
            if (restam <= 0) break;
            if (usados.has(ex.id)) continue;
            usados.add(ex.id);
            escolhidos.push(ex);
            restam--;
          }
        }
      }

      const exercicios = escolhidos.map((ex) => {
        const presc = prescrever(objetivo, ex);
        return {
          exId: ex.id, series: presc.series, reps: presc.reps,
          repsMin: presc.repsMin, repsMax: presc.repsMax,
          rirAlvo: presc.rirAlvo, descanso: presc.descanso, carga: null, obs: '',
        };
      });

      return {
        nome: `Treino ${String.fromCharCode(65 + iDia)} — ${dia.nome}`,
        exercicios,
        diaSemana: diasSemana[iDia] ?? null,
      };
    });

    return fichas.filter((f) => f.exercicios.length > 0);
  }

  // ---------- variedade programada (evitar monotonia) ----------
  // treino parado tempo demais sem mudar nada e um motivo classico de desistencia — a ideia
  // aqui nao e mudar tudo toda semana (perde a progressao de carga), e sim trocar uma parte dos
  // exercicios por variacoes de outro aparelho, de tempos em tempos, pra manter o estimulo novo.

  const SEMANAS_PARA_VARIAR = 4; // um mesociclo curto: da pra progredir e nao enjoa

  /** Ha quantas semanas uma ficha esta sem ter os exercicios variados. */
  function semanasSemVariar(ficha, hoje = Date.now()) {
    const desde = ficha.ultimaVariacaoEm || ficha.criadaEm || hoje;
    return Math.floor((hoje - desde) / (7 * 24 * 60 * 60 * 1000));
  }

  /** True se ja faz tempo o bastante pra valer a pena sugerir variar essa ficha. */
  function precisaVariar(ficha, hoje = Date.now()) {
    return semanasSemVariar(ficha, hoje) >= SEMANAS_PARA_VARIAR;
  }

  /**
   * Troca uma fracao dos exercicios da ficha por alternativas de mesmo padrao de movimento em
   * outro aparelho (reaproveita substitutos() — o mesmo motor do "equipamento ocupado", so que
   * aqui e por variedade, nao por necessidade). Prioriza isolados; so mexe em compostos se a
   * fracao pedida for maior que a quantidade de isolados. Historico de carga de cada exercicio
   * fica intacto — e por exId, nao por "posicao na ficha", entao trocar nao apaga nada.
   * rotacao: decide QUAL substituto entra quando ha mais de um candidato — sem random, testavel.
   */
  function variarFicha(ficha, base, { objetivo = 'hipertrofia', fracao = 0.5, rotacao = 0 } = {}) {
    const itens = ficha.exercicios || [];
    const comExercicio = itens.map((item) => ({ item, ex: base.find((e) => e.id === item.exId) })).filter((x) => x.ex);
    const isolados = comExercicio.filter((x) => !ehComposto(x.ex));
    const compostos = comExercicio.filter((x) => ehComposto(x.ex));
    const nTrocar = Math.round(itens.length * fracao);
    const idsParaTrocar = new Set([...isolados, ...compostos].slice(0, nTrocar).map((x) => x.item.exId));

    const exercicios = itens.map((item) => {
      if (!idsParaTrocar.has(item.exId)) return item;
      const exAtual = base.find((e) => e.id === item.exId);
      const opcoes = substitutos(exAtual, base, { limite: 6 });
      if (!opcoes.length) return item; // sem alternativa segura — mantem como esta
      const escolhido = opcoes[rotacao % opcoes.length];
      const presc = prescrever(objetivo, escolhido);
      return {
        exId: escolhido.id, series: presc.series, reps: presc.reps,
        repsMin: presc.repsMin, repsMax: presc.repsMax,
        rirAlvo: presc.rirAlvo, descanso: presc.descanso, carga: null, obs: '',
      };
    });

    const trocados = exercicios.reduce((n, e, i) => n + (e.exId !== itens[i].exId ? 1 : 0), 0);
    return { exercicios, trocados };
  }

  // ---------- substituicao por equipamento ocupado ----------

  // categorias que treinam o mesmo padrao de movimento, mesmo com nome diferente
  // (pra nao sugerir so dentro da mesma categoria exata — puxar e costas sao o mesmo padrao)
  const CATEGORIAS_IRMAS = {
    pernas: ['pernas', 'pernas_cal', 'gluteos'],
    pernas_cal: ['pernas_cal', 'pernas', 'gluteos'],
    gluteos: ['gluteos', 'pernas', 'pernas_cal'],
    costas: ['costas', 'puxar'],
    puxar: ['puxar', 'costas'],
    peito: ['peito', 'empurrar'],
    empurrar: ['empurrar', 'peito'],
    ombros: ['ombros', 'empurrar'],
    core: ['core', 'core_cal'],
    core_cal: ['core_cal', 'core'],
    biceps: ['biceps', 'puxar'],
    triceps: ['triceps', 'empurrar'],
    cardio: ['cardio', 'funcional'],
    mobilidade: ['mobilidade', 'alongamento'],
    alongamento: ['alongamento', 'mobilidade'],
  };

  /**
   * Alternativas pra quando o equipamento do exercicio atual esta ocupado:
   * mesmo padrao de movimento (musculos primarios em comum), equipamento diferente.
   * Ordena por quantos musculos primarios em comum, depois secundarios, depois nivel parecido.
   */
  function substitutos(ex, base, { limite = 4 } = {}) {
    if (!ex) return [];
    const primariosEx = new Set(ex.musculos_primarios || []);
    const secundariosEx = new Set(ex.musculos_secundarios || []);
    const catsAceitas = new Set(CATEGORIAS_IRMAS[ex.categoria] || [ex.categoria]);

    const candidatos = base
      .filter((c) => c.id !== ex.id)
      .filter((c) => catsAceitas.has(c.categoria))
      .filter((c) => c.equipamento !== ex.equipamento) // o ponto todo: outro equipamento
      .map((c) => {
        const comuns = (c.musculos_primarios || []).filter((m) => primariosEx.has(m)).length;
        const comunsSec = (c.musculos_secundarios || []).filter((m) => secundariosEx.has(m)).length;
        return { ex: c, pontos: comuns * 3 + comunsSec + (c.categoria === ex.categoria ? 1 : 0) + (c.nivel === ex.nivel ? 0.5 : 0) };
      })
      .filter((c) => c.pontos >= 3) // pelo menos 1 musculo primario em comum
      .sort((a, b) => b.pontos - a.pontos)
      .slice(0, limite)
      .map((c) => c.ex);

    return candidatos;
  }

  // ---------- anilhas ----------

  /** Quais anilhas por lado para chegar na carga alvo. */
  function anilhas(cargaAlvo, barra = 20, disponiveis = [20, 15, 10, 5, 2.5, 1.25]) {
    cargaAlvo = Number(cargaAlvo) || 0;
    if (cargaAlvo < barra) {
      return { possivel: false, aviso: `A carga (${cargaAlvo} kg) é menor que a barra (${barra} kg).`, porLado: [], total: barra };
    }
    let porLado = (cargaAlvo - barra) / 2;
    const usadas = [];
    for (const a of [...disponiveis].sort((x, y) => y - x)) {
      while (porLado >= a - 1e-9) {
        usadas.push(a);
        porLado = Math.round((porLado - a) * 1000) / 1000;
      }
    }
    const somaLado = usadas.reduce((s, v) => s + v, 0);
    const total = barra + somaLado * 2;
    return {
      possivel: true,
      porLado: usadas,
      total,
      sobra: Math.round(porLado * 1000) / 1000,
      aviso: porLado > 0.01 ? `Com as anilhas disponíveis dá ${total} kg (faltam ${(porLado * 2).toFixed(2)} kg para a carga cheia).` : null,
    };
  }

  // ---------- util ----------

  function arredondar(valor, passo) {
    if (!passo) return Math.round(valor * 100) / 100;
    return Math.round(valor / passo) * passo;
  }

  return {
    umRM, percentualPorReps, cargaParaReps, TABELA_PCT,
    OBJETIVOS, prescrever, ehComposto,
    sugerirCarga, detectarPlato,
    volumeSemanal, FAIXA_VOLUME, classificarVolume,
    avaliarDeload, anilhas, arredondar,
    substitutos, gerarPlano,
    SEMANAS_PARA_VARIAR, semanasSemVariar, precisaVariar, variarFicha,
  };
})();
