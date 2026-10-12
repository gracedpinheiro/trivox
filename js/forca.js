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
  // Objetivos expostos no app (os 5 das diretrizes). Os parametros completos por nivel estao em
  // js/programas.js (Programas.PARAMS); aqui fica o resumo para a interface e a prescricao
  // rapida usada quando a pessoa adiciona um exercicio na mao.

  const OBJETIVOS = {
    condicionamento: { nome: 'Condicionamento físico', series: [2, 4], reps: [8, 15], rirAlvo: 2, descanso: [45, 90], pct: [60, 80],
      resumo: 'Força nos grandes movimentos + circuito metabólico no fim. Melhora fôlego, força e disposição ao mesmo tempo.' },
    perda_peso: { nome: 'Perda de peso', series: [2, 4], reps: [10, 15], rirAlvo: 2, descanso: [45, 60], pct: [60, 75],
      resumo: 'Musculação em superséries para preservar músculo no déficit, e circuito curto para gastar mais. O resultado vem do conjunto treino + alimentação + passos no dia.' },
    hipertrofia: { nome: 'Hipertrofia', series: [3, 4], reps: [6, 12], rirAlvo: 1, descanso: [75, 150], pct: [67, 85],
      resumo: 'Faixas de 6 a 15 reps perto da falha, descanso suficiente e volume semanal crescente. Cada músculo treinado 2x por semana.' },
    '50mais': { nome: 'Especial 50+', series: [2, 3], reps: [8, 15], rirAlvo: 3, descanso: [60, 90], pct: [55, 75],
      resumo: 'Força funcional, equilíbrio e mobilidade, sem saltos. Pensado para autonomia: levantar do chão, subir escada, carregar sacola e não cair.' },
    raquete: { nome: 'Especial raquete (pickleball e beach tennis)', series: [2, 4], reps: [6, 12], rirAlvo: 2, descanso: [45, 150], pct: [65, 85],
      resumo: 'Agilidade lateral, potência de rotação, ombro e cotovelo blindados, panturrilha e Aquiles fortes — sem cansar a perna na véspera do jogo.' },
  };

  // objetivos antigos: continuam funcionando na prescricao manual (perfis ja salvos com eles);
  // no gerador sao mapeados por Programas.normalizarObjetivo (forca -> hipertrofia variante forca,
  // resistencia -> condicionamento, emagrecimento -> perda_peso)
  const OBJETIVOS_LEGADOS = {
    forca: {
      nome: 'Força',
      series: [3, 6], reps: [3, 6], rirAlvo: 2, descanso: [180, 300], pct: [85, 92],
      resumo: 'Cargas altas, poucas reps e descanso longo. O descanso não é opcional: é ele que devolve a força para a série seguinte.',
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

  const temProgramas = () => typeof Programas !== 'undefined';

  /**
   * Sugestao de series/reps/descanso para um exercicio, conforme objetivo e se e composto.
   * opcoes (opcional): { nivel, idade } — com eles usa a tabela completa de Programas.
   */
  function prescrever(objetivo, exercicio, opcoes = {}) {
    const composto = ehComposto(exercicio);
    const legado = OBJETIVOS_LEGADOS[objetivo];
    if (!legado && temProgramas()) {
      const pr = Programas.parametros(objetivo, opcoes.nivel || 'intermediario');
      const aj = Programas.ajustesPerfil({ objetivo, nivel: opcoes.nivel, idade: opcoes.idade });
      const [rMin, rMax] = composto ? pr.reps : pr.repsIso;
      const rmin = Math.max(rMin, aj.repsMin);
      return {
        series: Math.min(composto ? pr.series[0] : pr.series[1], aj.seriesMax),
        reps: `${rmin}-${Math.max(rmin, rMax)}`,
        repsMin: rmin,
        repsMax: Math.max(rmin, rMax),
        rirAlvo: Math.max(composto ? pr.rir[0] : pr.rir[1], aj.rirMin),
        descanso: (composto ? pr.descanso[0] : pr.descanso[1]) + aj.descansoExtra,
      };
    }
    const o = legado || OBJETIVOS[objetivo] || OBJETIVOS.hipertrofia;
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
  // A estrutura (split, series, reps, descanso, blocos) vem de js/programas.js. Aqui fica a
  // escolha dos exercicios: filtra por local/nivel/perfil, encaixa cada "vaga" da sessao num
  // padrao de movimento e escolhe com variedade (sem repetir exercicio na semana quando ha
  // alternativa, variando aparelho, e com `rotacao` trocando de verdade a selecao).

  const nivelN = { iniciante: 0, intermediario: 1, intermediante: 1, avancado: 2, elite: 3 };

  // hash deterministico [0,1): substitui o random, entao o mesmo pedido gera a mesma ficha
  function sorteio(...partes) {
    let h = 2166136261;
    const str = partes.join('|');
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }

  const raizNome = (ex) => Programas.semAcento(ex.nome).replace(/\(.*?\)/g, '').split(/\s+/).filter((w) => w.length > 2).slice(0, 2).join(' ');
  const ORDEM_TIPO = { potencia: 0, agilidade: 1, composto: 2, isolado: 3, prevencao: 4, equilibrio: 5 };
  const SLOTS_CARDIO = new Set(['cardio', 'metabolico', 'agilidade', 'pliometria']);
  const PADROES_COMPOSTOS = new Set(['agachar', 'dobrar_quadril', 'empurrar_h', 'empurrar_v', 'puxar_h', 'puxar_v', 'carregamento', 'gluteo', 'lateral']);
  const FORCA_TIPOS = new Set(['composto', 'isolado', 'prevencao', 'equilibrio']);
  const PESADOS_PERNA = new Set(['INF_A', 'INF_B', 'LEGS', 'R_INF', 'R_COND', 'MC_C']);

  // ---------- aquecimento e volta a calma dirigidos aos grupos do dia ----------
  // Usado pelo gerador e por completarSessao (fichas montadas a mao). Le os musculos primarios do
  // bloco principal, escolhe os 2-4 grupos mais trabalhados e monta:
  //   aquecimento = 1 cardio leve (3-5 min) + ativacao + mobilidade dinamica desses grupos
  //   volta a calma = ~1 alongamento estatico por grupo (30-45s)
  // Regras de idade: so baixo impacto no cardio para quem tem restricao; 65+ evita alongamento
  // que exige deitar/ajoelhar quando existe opcao em pe ou na cadeira.

  const RE_CARDIO_LEVE = /marcha|caminhada|corrida estacionaria|bike|bicicleta|ciclismo|spinning|remo|esteira|step|shadow|escada|polichinelo|elipt|passadas laterais|skipping|toques/;
  const RE_CARDIO_FORTE = /pesad|carga|rucking|treno|sprint|tabata|hiit|amrap|complex|circuito|interval|piramide|burpee|salto|double/;

  // candidatos de aquecimento/alongamento por contexto (base x local x equipamento x teto de nivel)
  const cacheListas = new WeakMap();
  function listasBlocos(base, local, equipCasa, tetoNivel, impCardio) {
    const P = Programas;
    if (!cacheListas.has(base)) cacheListas.set(base, new Map());
    const mapa = cacheListas.get(base);
    const k = [local, (equipCasa || []).join(','), tetoNivel, impCardio].join('|');
    if (mapa.has(k)) return mapa.get(k);
    const ok = base.filter((ex) => (nivelN[ex.nivel] ?? 0) <= tetoNivel && P.impactoDe(ex) === 'baixo' && !P.riscoAlto(ex) && P.disponivel(ex, local, equipCasa));
    const ativ = ok.filter((ex) => !ehComposto(ex) && P.padraoDe(ex) !== 'mobilidade' && P.padraoDe(ex) !== 'alongamento');
    const l = {
      cardios: base.filter((ex) => {
        const n = P.semAcento(ex.nome);
        return (ex.categoria === 'cardio' || P.padraoDe(ex) === 'cardio') && RE_CARDIO_LEVE.test(n) && !RE_CARDIO_FORTE.test(n)
          && (nivelN[ex.nivel] ?? 0) === 0 && P.impactoPermitido(ex, P.menorImpacto(impCardio, 'medio'))
          && !P.ehFormato(ex) && P.disponivel(ex, local, equipCasa);
      }),
      ativOmbro: ativ.filter((ex) => P.tagsDe(ex).has('manguito') || P.tagsDe(ex).has('escapula')),
      ativGluteo: ativ.filter((ex) => P.tagsDe(ex).has('ativacao') && P.gruposDe(ex).includes('gluteos')),
      mobs: ok.filter((ex) => P.ehMobilidadeDinamica(ex)),
      alongs: ok.filter((ex) => P.ehAlongamento(ex)),
    };
    mapa.set(k, l);
    return l;
  }

  /** Grupos trabalhados no bloco principal, do mais para o menos trabalhado. */
  function gruposTreinados(itens, porId) {
    const pontos = {};
    for (const it of itens) {
      const ex = porId.get(it.exId);
      if (!ex) continue;
      const s = Number(it.series) || 1;
      for (const g of Programas.gruposDe(ex)) pontos[g] = (pontos[g] || 0) + s;
      for (const m of ex.musculos_secundarios || []) {
        const g = Programas.grupoMuscular(m);
        if (g) pontos[g] = (pontos[g] || 0) + s * 0.3;
      }
    }
    return Object.entries(pontos).sort((a, b) => b[1] - a[1]);
  }

  function itemBloco(ex, bloco, reps, { tempoSeg = null, obs = '', grupo = null } = {}) {
    return {
      exId: ex.id, series: 1, reps, repsMin: null, repsMax: null, rirAlvo: 4,
      descanso: 15, descansoSeg: 15, carga: null, obs, bloco, tipo: bloco, padrao: Programas.padraoDe(ex),
      ...(tempoSeg ? { tempoSeg } : {}), ...(grupo ? { grupo } : {}),
    };
  }

  /**
   * Monta aquecimento e volta a calma para uma sessao.
   * principal: itens do bloco principal; ctx: { base, porId, local, equipCasa, aj, uN, aquecMin,
   * chave, rotacao, excluir (Set de exId ja na ficha), usadosSemana (Map, opcional) }
   */
  function montarBlocos(principal, ctx) {
    const P = Programas;
    const { base, porId, local, equipCasa, aj, uN, chave, rotacao } = ctx;
    const excluir = new Set(ctx.excluir || []);
    const semana = ctx.usadosSemana || new Map();
    const tetoNivel = Math.min(aj.nivelExMax ?? 3, uN >= 1 ? 1 : 0);
    const idade = aj.idade || 0;

    const ranking = gruposTreinados(principal, porId);
    const treinados = new Set(principal.flatMap((it) => (porId.get(it.exId) ? P.gruposDe(porId.get(it.exId)) : [])));
    const topo = ranking.length ? ranking[0][1] : 0;
    let alvo = ranking.filter(([, v]) => v >= topo * 0.3).map(([g]) => g).slice(0, 4);
    if (alvo.length < 2) alvo = ranking.map(([g]) => g).slice(0, 2);
    const superior = alvo.length ? P.GRUPOS_SUPERIORES.has(alvo[0]) : false;

    const listas = listasBlocos(base, local, equipCasa, tetoNivel, aj.impactoMaxCardio);
    const usar = (ex) => excluir.add(ex.id);
    const ruido = (id, extra) => sorteio(rotacao, chave, extra, id) * 0.9;
    const melhor = (cands, nota, extra) => {
      let top = null, topS = -Infinity;
      for (const ex of cands) {
        if (excluir.has(ex.id)) continue;
        const s = nota(ex) + ruido(ex.id, extra) - (semana.has(ex.id) ? 1.5 : 0);
        if (s > topS) { top = ex; topS = s; }
      }
      return top;
    };
    const notaGrupo = (ex, g) => {
      const gs = P.gruposDe(ex, false);
      if (gs.includes(g)) return 3 + 0.5 * gs.filter((x) => x !== g && treinados.has(x)).length;
      if ((P.GRUPOS_VIZINHOS[g] || []).some((v) => gs.includes(v))) return 1;
      return 0;
    };
    const chaoPenal = (ex) => (P.exigeChao(ex) ? (idade >= 65 ? 4 : idade >= 50 ? 0.5 : 0) : 0);

    // ---- aquecimento ----
    const aquecimento = [];
    const cardio = melhor(listas.cardios, (ex) => {
      const n = P.semAcento(ex.nome);
      return (superior ? /remo|elipt|shadow|polichinelo/.test(n) : /bike|bicicleta|esteira|step|marcha|caminhada|escada/.test(n)) ? 1 : 0;
    }, 'cardio');
    if (cardio) {
      usar(cardio);
      aquecimento.push(itemBloco(cardio, 'aquecimento', '3-5 min leve', { tempoSeg: 240, obs: 'Ritmo em que dá para conversar: só para esquentar.' }));
    }

    const nMob = Math.max(2, Math.min(3, Math.round((ctx.aquecMin || 8) / 3))) + (cardio ? 0 : 1); // bloco total <= 4 itens
    // ativacao: manguito/escapula para dia de superior (ou raquete), gluteo para dia de inferior
    const querManguito = superior || ctx.objetivo === 'raquete';
    const ativs = querManguito ? listas.ativOmbro : listas.ativGluteo;
    const ativ = melhor(ativs, (ex) => (P.MAQUINAS.has(P.aparelhoPrincipal(ex)) ? -1 : 0) - chaoPenal(ex), 'ativ');
    if (ativ) {
      usar(ativ);
      aquecimento.push(itemBloco(ativ, 'aquecimento', '12-15 leve', { obs: 'Ativação: carga leve, sinta o músculo trabalhar.', grupo: querManguito ? 'ombros' : 'gluteos' }));
    }
    const mobs = listas.mobs;
    for (let i = 0; aquecimento.length - (cardio ? 1 : 0) < nMob && i < alvo.length + 3; i++) {
      const g = alvo[i % Math.max(1, alvo.length)];
      const diretos = g ? mobs.filter((e) => notaGrupo(e, g) >= 3 && !excluir.has(e.id)) : [];
      const ex = melhor(diretos.length ? diretos : mobs, (e) => (g ? notaGrupo(e, g) : 0) - chaoPenal(e) * 0.5, `mob${i}`);
      if (!ex) break;
      usar(ex);
      aquecimento.push(itemBloco(ex, 'aquecimento', '8-10 cada lado', { grupo: g || null }));
    }

    // ---- volta a calma ----
    const volta = [];
    const alongs = listas.alongs;
    const cobertos = new Set();
    const addAlong = (ex, g) => {
      usar(ex);
      P.gruposDe(ex).forEach((x) => cobertos.add(x));
      volta.push(itemBloco(ex, 'volta_calma', '30-45s', { tempoSeg: 40, grupo: g, obs: 'Cada lado, se for unilateral. Respire fundo e solte, sem dor.' }));
    };
    for (const g of alvo) {
      if (cobertos.has(g)) continue;
      // so alongamentos que miram o grupo de fato (vizinhos ficam para o fallback abaixo)
      const ex = melhor(alongs.filter((e) => notaGrupo(e, g) >= 3), (e) => notaGrupo(e, g) - chaoPenal(e), `al-${g}`);
      if (ex) addAlong(ex, g);
    }
    // menos de 2: outros grupos treinados, depois vizinhos, depois um geral
    for (const [g] of ranking) {
      if (volta.length >= 2) break;
      if (cobertos.has(g)) continue;
      const ex = melhor(alongs, (e) => notaGrupo(e, g) - chaoPenal(e), `al2-${g}`);
      if (ex && notaGrupo(ex, g) >= 1) addAlong(ex, g);
    }
    while (volta.length < 2) {
      const ex = melhor(alongs, (e) => -chaoPenal(e), `al-geral${volta.length}`);
      if (!ex) break;
      addAlong(ex, null);
    }
    return { aquecimento, volta, grupos: alvo };
  }

  /** Observacao de series de aproximacao no 1o composto do bloco principal (copia o item). */
  function marcarAproximacao(itens, porId) {
    const i = itens.findIndex((it) => {
      if (it.bloco && it.bloco !== 'principal') return false;
      if (it.tempoSeg || it.tipo === 'potencia' || it.tipo === 'agilidade' || it.tipo === 'equilibrio') return false;
      const ex = porId.get(it.exId);
      return ex && (it.tipo === 'composto' || (!it.tipo && ehComposto(ex)));
    });
    if (i < 0 || /aproxima/.test(itens[i].obs || '')) return itens;
    const ex = porId.get(itens[i].exId);
    const corporal = ['peso_corporal', 'colchonete', 'parede', 'cadeira', 'banco'].includes(Programas.aparelhoPrincipal(ex));
    const nota = corporal
      ? 'Antes, faça 1 série leve de aproximação (versão mais fácil, 8-10 reps).'
      : 'Faça 1-2 séries de aproximação leves antes (~50% da carga x 8, ~75% x 3).';
    const copia = itens.slice();
    copia[i] = { ...itens[i], obs: itens[i].obs ? `${nota} ${itens[i].obs}` : nota };
    return copia;
  }

  const cachePorId = new WeakMap();
  const mapaPorId = (base) => {
    if (!cachePorId.has(base)) cachePorId.set(base, new Map(base.map((e) => [e.id, e])));
    return cachePorId.get(base);
  };

  /**
   * Completa QUALQUER ficha (inclusive montada a mao) com aquecimento no inicio e volta a calma
   * no fim, escolhidos pelos grupos musculares dos exercicios dela. Idempotente: se a lista ja
   * tem os dois blocos, devolve a mesma lista. Itens sem `bloco` contam como bloco principal e
   * nao sao alterados (exceto a obs de aproximacao no 1o composto, numa copia).
   */
  function completarSessao(exercicios, { base = [], local = 'academia', idade = null, objetivo = 'hipertrofia', nivel = 'intermediario', equipCasa = null, rotacao = null } = {}) {
    const itens = exercicios || [];
    const temAq = itens.some((it) => it.bloco === 'aquecimento');
    const temVc = itens.some((it) => it.bloco === 'volta_calma');
    if ((temAq && temVc) || !itens.length || !temProgramas()) return itens;
    const porId = mapaPorId(base);
    const { objetivo: obj } = Programas.normalizarObjetivo(objetivo);
    const aj = Programas.ajustesPerfil({ objetivo: obj, nivel, idade });
    const prm = Programas.parametros(obj, nivel);
    const principal = itens.filter((it) => !it.bloco || it.bloco === 'principal' || it.bloco === 'circuito');
    const chave = itens.map((it) => it.exId).join(',');
    const { aquecimento, volta } = montarBlocos(principal.length ? principal : itens, {
      base, porId, local: local === 'academia' ? 'academia' : local === 'parque' ? 'parque' : 'casa', equipCasa, aj,
      uN: Math.min(nivelN[nivel] ?? 1, 3), aquecMin: prm.aquec + aj.aquecExtra, objetivo: obj,
      chave, rotacao: rotacao ?? 0, excluir: new Set(itens.map((it) => it.exId)),
    });
    const meio = temAq ? itens : marcarAproximacao(itens, porId);
    return [...(temAq ? [] : aquecimento), ...meio, ...(temVc ? [] : volta)];
  }

  /**
   * Gera o programa completo. Mesmos parametros de gerarPlano (abaixo) — devolve
   * { fichas, programa } onde programa traz parametros, progressao/deload, aerobico e avisos.
   */
  function gerarPrograma({
    objetivo = 'hipertrofia', nivel = 'iniciante', local = 'academia', freqForca = 3, diasSemana = [],
    base = [], rotacao = 0,
    sexo = null, idade = null, peso = null, altura = null,
    equipCasa = null, diasJogo = [], enfase = null,
  } = {}) {
    if (!temProgramas()) throw new Error('js/programas.js precisa ser carregado antes de js/forca.js');
    const P = Programas;
    const { objetivo: obj, variante } = P.normalizarObjetivo(objetivo);
    const nivelProg = P.nivelPrograma(nivel);
    const uN = Math.min(nivelN[nivel] ?? 0, 3);
    const aj = P.ajustesPerfil({ objetivo: obj, nivel, sexo, idade, peso, altura, enfase });
    const prm = P.parametros(obj, nivelProg, variante);
    rotacao = Math.abs(Math.floor(Number(rotacao) || 0));

    // ajustes de perfil na prescricao
    prm.aquec += aj.aquecExtra;
    prm.equilibrio = Math.max(prm.equilibrio || 0, aj.equilibrioMin);
    if (prm.circuito && (aj.impactoMaxCardio === 'baixo' || (aj.idade && aj.idade >= 65))) {
      prm.circuito.trabalhoSeg = Math.min(prm.circuito.trabalhoSeg, 30);
      prm.circuito.pausaSeg = Math.max(prm.circuito.pausaSeg, 30);
      if (prm.circuito.formato === 'emom') prm.circuito.formato = 'intervalado';
    }

    const localN = local === 'academia' ? 'academia' : local === 'parque' ? 'parque' : 'casa';
    const porId = mapaPorId(base);
    const excluirRisco = aj.excluirRisco || nivelProg === 'iniciante';

    // ---- pool elegivel ----
    const pool = base.filter((ex) => {
      if (!ex || !ex.id) return false;
      const n = nivelN[ex.nivel] ?? 0;
      if (n > uN + 1) return false;                       // ate 1 nivel acima, pra ter margem
      if (n === 3 && uN < 3) return false;                 // elite so pra elite
      if (aj.nivelExMax !== null && n > aj.nivelExMax) return false;
      const p = P.padraoDe(ex);
      if (p === 'pescoco' || p === 'skill' || p === 'trapezio' || p === 'outro') return false;
      if (P.ehFormato(ex)) return false;
      if (excluirRisco && P.riscoAlto(ex)) return false;
      if (aj.excluirAparelhos.length && P.aparelhosDe(ex).some((alts) => alts.every((k) => aj.excluirAparelhos.includes(k)))) return false;
      if (!P.impactoPermitido(ex, aj.impactoMax)) return false;
      return P.disponivel(ex, localN, equipCasa);
    });

    // ---- dias e modelos ----
    const dias = (diasSemana || []).length ? [...diasSemana] : null;
    const numDias = dias ? dias.length : Math.max(1, Number(freqForca) || 3);
    const jogos = new Set((diasJogo || []).map(Number));
    let modelos;
    let statusDia = new Array(numDias).fill('livre');
    if (dias && jogos.size) {
      statusDia = dias.map((d) => (jogos.has(d) ? 'jogo' : jogos.has((d + 1) % 7) ? 'vespera' : 'livre'));
    }
    if (obj === 'raquete' && statusDia.some((s) => s !== 'livre')) {
      // dia de jogo ou vespera: so ativacao; os dias livres recebem o split do numero de dias livres
      const livres = statusDia.filter((s) => s === 'livre').length;
      const fila = livres ? P.estruturaSemanal(obj, nivelProg, livres) : [];
      modelos = statusDia.map((s) => (s === 'livre' ? fila.shift() : 'R_PRE'));
    } else {
      modelos = P.estruturaSemanal(obj, nivelProg, numDias);
      if (statusDia.some((s) => s !== 'livre')) {
        // outros objetivos com dias de jogo marcados: tira treino pesado de perna da vespera/dia de jogo
        for (let i = 0; i < modelos.length; i++) {
          if (statusDia[i] === 'livre' || !PESADOS_PERNA.has(modelos[i])) continue;
          const j = modelos.findIndex((m, k) => statusDia[k] === 'livre' && !PESADOS_PERNA.has(m));
          if (j >= 0) [modelos[i], modelos[j]] = [modelos[j], modelos[i]];
        }
      }
    }

    // ---- estado de variedade da semana ----
    const semana = { usados: new Map(), aparelhos: new Map() };
    const marcar = (mapa, k) => mapa.set(k, (mapa.get(k) || 0) + 1);
    const ocorrencia = {};

    function escolher(slot, sessao, chaveSlot, { cardio = false, filtro = null } = {}) {
      const tentativas = [];
      if (slot.tag) tentativas.push({ alvo: slot.p, tag: slot.tag, fb: 0 });
      tentativas.push({ alvo: slot.p, tag: null, fb: slot.tag ? 0.5 : 0 });
      for (const f of P.FALLBACK[slot.p] || []) tentativas.push({ alvo: f, tag: null, fb: 2 });

      for (const t of tentativas) {
        let cands = pool.filter((ex) => {
          if (sessao.ids.has(ex.id)) return false;
          const tags = P.tagsDe(ex);
          // sessao leve (pre-jogo, vespera, mobilidade): nada de salto nem impacto alto
          if (sessao.leve && (P.impactoDe(ex) === 'alto' || tags.has('pliometria'))) return false;
          if (P.padraoDe(ex) !== t.alvo && !tags.has(t.alvo)) return false;
          if (t.tag && !tags.has(t.tag)) return false;
          const vagaCardio = cardio || SLOTS_CARDIO.has(t.alvo) || slot.tipo === 'agilidade' || slot.tipo === 'potencia';
          if (vagaCardio && !P.impactoPermitido(ex, aj.impactoMaxCardio)) return false;
          // vaga de forca nao recebe salto; e nos objetivos de forca/saude nem exercicio metabolico
          if (!vagaCardio && FORCA_TIPOS.has(slot.tipo)) {
            if (P.impactoDe(ex) === 'alto') return false;
            if (obj !== 'condicionamento' && obj !== 'perda_peso' && (tags.has('metabolico') || tags.has('pliometria'))) return false;
          }
          if (filtro && !filtro(ex)) return false;
          return true;
        });
        if (!cands.length) continue;
        // na semana, so repete exercicio se nao houver nenhuma alternativa
        const naoUsados = cands.filter((ex) => !semana.usados.has(ex.id));
        if (naoUsados.length) cands = naoUsados;

        const pontuados = cands.map((ex) => ({ ex, s: pontuar(ex, t, slot, sessao) })).sort((a, b) => b.s - a.s);
        const melhor = pontuados[0].s;
        let bons = pontuados.filter((c) => c.s >= melhor - 1.5);
        if (bons.length < 3) bons = pontuados.slice(0, Math.min(3, pontuados.length));

        // rotacao: escolhe dentro do grupo "bom" pelo sorteio da rodada, evitando o que as
        // 2 rodadas anteriores teriam escolhido nessa mesma vaga
        const vencedor = (r, lista) => lista.reduce((a, c) => (sorteio(r, chaveSlot, c.ex.id) > sorteio(r, chaveSlot, a.ex.id) ? c : a));
        let lista = bons;
        for (const r of [rotacao - 1, rotacao - 2]) {
          if (r < 0 || lista.length <= 1) continue;
          const anterior = vencedor(r, bons).ex.id;
          const sem = lista.filter((c) => c.ex.id !== anterior);
          if (sem.length) lista = sem;
        }
        return { ex: vencedor(rotacao, lista).ex, fallback: t.fb >= 2 };
      }
      return null;
    }

    function pontuar(ex, t, slot, sessao) {
      let s = P.padraoDe(ex) === t.alvo ? 2 : 1;
      s -= t.fb;
      s += Math.min(3, P.afinidade(ex, obj));
      const d = (nivelN[ex.nivel] ?? 0) - Math.min(uN, 2);
      s += d === 0 ? 1 : d === -1 ? 0.5 : d > 0 ? (nivelProg === 'iniciante' ? -1.5 : -0.7) : -0.5;
      const comp = ehComposto(ex);
      if (slot.tipo === 'composto') s += comp ? 1 : -0.5;
      if (slot.tipo === 'isolado' || slot.tipo === 'prevencao') s += comp ? -0.3 : 0.5;
      if (ex.imagens && ex.imagens.length) s += 0.3;
      const ap = P.aparelhoPrincipal(ex);
      s -= 1.5 * (sessao.aparelhos.get(ap) || 0);
      s -= 0.3 * (semana.aparelhos.get(ap) || 0);
      // na academia, hipertrofia prefere o que da para carregar (barra, halter, maquina, polia)
      if (localN === 'academia' && obj === 'hipertrofia' && ap === 'peso_corporal') s -= slot.tipo === 'composto' ? 2.5 : 0.5;
      // ativacao (monster walk, clamshell) e otima no aquecimento, fraca como exercicio principal
      if (slot.tipo === 'composto' && P.tagsDe(ex).has('ativacao')) s -= 2;
      if (ap === 'treno') s -= 1;
      if (semana.usados.has(ex.id)) s -= 6;
      // duas variacoes do mesmo exercicio na mesma ficha (ex.: dois "Face Pull") nao e variedade
      if (sessao.nomes.has(raizNome(ex))) s -= 1.5;
      return s;
    }

    // ---- prescricao ----
    const lim = (v, a, b) => Math.max(a, Math.min(b, v));
    const fmtReps = (a, b) => (a === b ? `${a}` : `${a}-${b}`);

    function prescreverItem(ex, tipo, leve) {
      const comp = tipo === 'composto' && ehComposto(ex);
      const p = P.padraoDe(ex);
      const tags = P.tagsDe(ex);
      let series, rMin, rMax, rir, desc, tempoSeg = null, obs = '';
      switch (tipo) {
        case 'potencia':
          series = [2, 3, 4][Math.min(uN, 2)];
          if (tags.has('pliometria')) { rMin = 5; rMax = nivelProg === 'avancado' ? 8 : 6; obs = `Pliometria: aterrisse macio e pare se a qualidade cair. Alvo da sessão: ~${prm.contatos || 40} contatos.`; }
          else { rMin = 5; rMax = 6; obs = tags.has('rotacional') ? 'Máxima velocidade, cada lado. A força sai do quadril, não do braço.' : 'Máxima velocidade em cada rep; pare se a velocidade cair.'; }
          rir = 3; desc = 90;
          break;
        case 'agilidade':
          series = [3, 4, 4][Math.min(uN, 2)]; tempoSeg = nivelProg === 'iniciante' ? 20 : 25; rir = 3; desc = 45;
          obs = 'Passos curtos, centro de gravidade baixo, frear com controle.';
          break;
        case 'equilibrio':
          series = aj.idade && aj.idade >= 65 ? 3 : 2; tempoSeg = 30; rir = 3; desc = 30;
          obs = 'Perto de um apoio. Ficou fácil: tire a mão do apoio, depois feche os olhos por alguns segundos.';
          break;
        case 'prevencao':
          series = nivelProg === 'avancado' ? 3 : 2; rMin = 12; rMax = 15; rir = 3; desc = 45;
          if (p === 'panturrilha') obs = 'Desça em 3 segundos (excêntrico): protege o tendão de Aquiles.';
          else if (p === 'antebraco' || tags.has('antebraco')) obs = 'Descida lenta do punho (3s): previne o "cotovelo de tenista".';
          else if (p === 'manguito' || tags.has('manguito')) obs = 'Carga leve, cotovelo junto ao corpo, sem dor.';
          else if (tags.has('ativacao')) obs = 'Ativação: sinta o músculo trabalhar, sem pressa.';
          break;
        case 'composto':
          series = prm.series[0]; [rMin, rMax] = prm.reps; rir = prm.rir[0]; desc = prm.descanso[0];
          if (prm.potencia) obs = 'Suba rápido (1s), desça devagar (3s): treina potência, que é o que mais cai com a idade.';
          break;
        default: // isolado
          series = prm.series[1]; [rMin, rMax] = prm.repsIso; rir = prm.rir[1]; desc = prm.descanso[1];
      }
      if (!comp && tipo === 'composto') { // a vaga pedia composto mas caiu um isolado
        series = prm.series[1]; [rMin, rMax] = prm.repsIso; rir = prm.rir[1]; desc = prm.descanso[1];
      }
      // exercicios por tempo (prancha, isometria, mobilidade) mesmo em vaga de reps
      if (!tempoSeg && /prancha|plank|hold|isometri|wall sit|wall squat|cadeirinha|dead hang|suspens|l-sit|hollow|segurar/.test(P.semAcento(ex.nome))) {
        tempoSeg = nivelProg === 'iniciante' ? 30 : 40;
      }
      if (leve) { series = Math.min(series, 2); rir = Math.max(rir, 3); if (rMin) { rMin = Math.max(rMin, 10); rMax = Math.max(rMax, rMin); } desc = Math.min(desc, 60); }
      series = lim(Math.min(series, aj.seriesMax), 1, 6);
      rir = lim(Math.max(rir, aj.rirMin), 0, 4);
      if (rMin) { rMin = Math.max(rMin, aj.repsMin); rMax = Math.max(rMax, rMin); }
      desc += aj.descansoExtra;
      const item = {
        exId: ex.id, series,
        reps: tempoSeg ? `${tempoSeg}s` + (tags.has('unilateral') || tipo === 'equilibrio' ? ' cada lado' : '') : fmtReps(rMin, rMax),
        repsMin: tempoSeg ? null : rMin, repsMax: tempoSeg ? null : rMax,
        rirAlvo: rir, descanso: desc, descansoSeg: desc, carga: null, obs,
        bloco: 'principal', tipo, padrao: p,
      };
      if (tempoSeg) item.tempoSeg = tempoSeg;
      return item;
    }

    function itemSimples(ex, bloco, reps, tempoSeg) {
      return {
        exId: ex.id, series: 1, reps, repsMin: null, repsMax: null, rirAlvo: 4,
        descanso: 15, descansoSeg: 15, carga: null, obs: '', bloco, tipo: bloco, padrao: P.padraoDe(ex),
        ...(tempoSeg ? { tempoSeg } : {}),
      };
    }

    // ---- monta cada sessao ----
    const fichas = modelos.map((idModelo, iDia) => {
      const modelo = P.MODELOS[idModelo];
      ocorrencia[idModelo] = (ocorrencia[idModelo] || 0) + 1;
      const occ = ocorrencia[idModelo];
      const sessao = { ids: new Set(), aparelhos: new Map(), nomes: new Set(), leve: !!modelo.leve };
      const usar = (ex) => { sessao.ids.add(ex.id); sessao.nomes.add(raizNome(ex)); marcar(sessao.aparelhos, P.aparelhoPrincipal(ex)); marcar(semana.usados, ex.id); marcar(semana.aparelhos, P.aparelhoPrincipal(ex)); };
      const chaveBase = `${obj}|${idModelo}|${occ}`;
      const notasFicha = [];

      // slots do principal, com enfase leve por sexo (so nos objetivos esteticos)
      let slots = modelo.slots.map((s) => ({ ...s }));
      const enfaseAplica = ['hipertrofia', 'perda_peso', 'condicionamento'].includes(obj) && !modelo.leve;
      let enfaseUsada = false;
      if (enfaseAplica && aj.enfase === 'inferiores' && modelo.foco !== 'superior') {
        slots.splice(Math.min(3, slots.length), 0, { p: 'gluteo', tipo: 'isolado', enfase: true });
        enfaseUsada = true;
      } else if (enfaseAplica && aj.enfase === 'superiores' && modelo.foco !== 'inferior') {
        slots.splice(Math.min(4, slots.length), 0, { p: occ % 2 ? 'ombro_lateral' : 'biceps', tipo: 'isolado', enfase: true });
        enfaseUsada = true;
      } else if (enfaseAplica && aj.enfase === 'gluteos' && modelo.foco !== 'superior') {
        slots.splice(Math.min(2, slots.length), 0, { p: 'gluteo', tipo: 'composto', enfase: true });
        enfaseUsada = true;
      }
      // raquete iniciante: pliometria vira agilidade (sem saltos ate ter base)
      if (obj === 'raquete' && prm.pliometria === 'nenhuma') slots = slots.map((s) => (s.p === 'pliometria' ? { p: 'agilidade', tipo: 'agilidade' } : s));

      const nPrincipal = modelo.leve ? slots.length : prm.ex[1];
      // vagas obrigatorias de enfase entram no corte; o resto e por ordem de prioridade
      const cortados = slots.slice(0, nPrincipal);

      // aquecimento (escolhido depois do principal para nao "roubar" exercicios de mobilidade
      // do bloco de equilibrio/mobilidade das sessoes leves) — aqui so reservamos
      const principal = [];
      cortados.forEach((slot, i) => {
        const r = escolher(slot, sessao, `${chaveBase}|p${i}|${slot.p}`);
        if (!r) return;
        usar(r.ex);
        // se a vaga caiu num exercicio de outra natureza (fallback), prescreve pelo que ele e
        let tipo = slot.tipo;
        const tg = P.tagsDe(r.ex);
        if (tipo === 'potencia' && !tg.has('potencia') && !tg.has('pliometria')) tipo = tg.has('agilidade') ? 'agilidade' : ehComposto(r.ex) ? 'composto' : 'isolado';
        if (tipo === 'agilidade' && !tg.has('agilidade') && !tg.has('cardio')) tipo = ehComposto(r.ex) ? 'composto' : 'isolado';
        const item = prescreverItem(r.ex, tipo, modelo.leve);
        if (slot.enfase) item.obs = (item.obs ? item.obs + ' ' : '') + 'Ênfase padrão do perfil — pode trocar.';
        principal.push(item);
      });
      principal.sort((a, b) => ORDEM_TIPO[a.tipo] - ORDEM_TIPO[b.tipo]);

      // superseries (perda de peso): pares A1/A2, B1/B2... descanso curto entre os dois
      if (prm.superserie && !modelo.leve) {
        const pares = principal.filter((it) => it.tipo === 'composto' || it.tipo === 'isolado');
        for (let i = 0; i + 1 < pares.length; i += 2) {
          const letra = String.fromCharCode(65 + i / 2);
          pares[i].superserie = `${letra}1`; pares[i + 1].superserie = `${letra}2`;
          pares[i].descanso = pares[i].descansoSeg = 15;
          pares[i].obs = (pares[i].obs ? pares[i].obs + ' ' : '') + 'Supersérie: faça em seguida o próximo exercício, depois descanse.';
        }
      }

      // equilibrio (50+ e quem tem 50+ em qualquer objetivo)
      const equilibrio = [];
      const jaTemEq = principal.filter((it) => it.tipo === 'equilibrio' && it.padrao === 'equilibrio').length;
      for (let i = jaTemEq; i < prm.equilibrio; i++) {
        const r = escolher({ p: 'equilibrio', tipo: 'equilibrio' }, sessao, `${chaveBase}|eq${i}`);
        if (!r) break;
        usar(r.ex);
        const it = prescreverItem(r.ex, 'equilibrio', false);
        it.bloco = 'equilibrio';
        equilibrio.push(it);
      }

      // circuito / HIIT / metcon
      const circuito = [];
      if (prm.circuito && modelo.circuito) {
        const c = prm.circuito;
        const vagas = modelo.circuito.slice(0, c.n);
        vagas.forEach((p, i) => {
          const r = escolher({ p, tipo: 'circuito' }, sessao, `${chaveBase}|c${i}|${p}`, { cardio: true });
          if (!r) return;
          usar(r.ex);
          circuito.push({
            exId: r.ex.id, series: c.rodadas, reps: `${c.trabalhoSeg}s`, repsMin: null, repsMax: null,
            rirAlvo: 2, descanso: c.pausaSeg, descansoSeg: c.pausaSeg, carga: null,
            obs: c.formato === 'emom' ? `EMOM: comece no início de cada minuto, ${c.trabalhoSeg}s de trabalho e descanse o resto.` : `${c.trabalhoSeg}s de trabalho, ${c.pausaSeg}s de pausa. Ao fim da rodada, ${c.pausaRodadaSeg}s de descanso.`,
            bloco: 'circuito', tipo: 'circuito', padrao: P.padraoDe(r.ex), tempoSeg: c.trabalhoSeg,
            circuito: { formato: c.formato, rodadas: c.rodadas, trabalhoSeg: c.trabalhoSeg, pausaSeg: c.pausaSeg, pausaRodadaSeg: c.pausaRodadaSeg, ordem: i + 1 },
          });
        });
        circuito.forEach((it) => { it.circuito.total = circuito.length; });
      }
      // raquete: o circuito de quadra (R_COND) usa o formato intervalado mesmo sem prm.circuito
      if (!prm.circuito && modelo.circuito && obj === 'raquete') {
        const c = { formato: 'intervalado', rodadas: [3, 4, 5][Math.min(uN, 2)], trabalhoSeg: nivelProg === 'iniciante' ? 20 : 30, pausaSeg: 30, pausaRodadaSeg: 90 };
        if (aj.impactoMaxCardio === 'baixo') c.trabalhoSeg = 20;
        modelo.circuito.slice(0, 4).forEach((p, i) => {
          const r = escolher({ p, tipo: 'circuito' }, sessao, `${chaveBase}|c${i}|${p}`, { cardio: true });
          if (!r) return;
          usar(r.ex);
          circuito.push({
            exId: r.ex.id, series: c.rodadas, reps: `${c.trabalhoSeg}s`, repsMin: null, repsMax: null,
            rirAlvo: 2, descanso: c.pausaSeg, descansoSeg: c.pausaSeg, carga: null,
            obs: `Intervalo de quadra: ${c.trabalhoSeg}s forte (como um ponto longo), ${c.pausaSeg}s de pausa.`,
            bloco: 'circuito', tipo: 'circuito', padrao: P.padraoDe(r.ex), tempoSeg: c.trabalhoSeg,
            circuito: { ...c, ordem: i + 1 },
          });
        });
        circuito.forEach((it) => { it.circuito.total = circuito.length; });
      }

      // aquecimento e volta a calma pelos grupos trabalhados no principal (ver montarBlocos)
      const { aquecimento, volta } = montarBlocos(principal, {
        base, porId, local: localN, equipCasa, aj, uN, aquecMin: prm.aquec, objetivo: obj,
        chave: chaveBase, rotacao, excluir: sessao.ids, usadosSemana: semana.usados,
      });
      [...aquecimento, ...volta].forEach((it) => usar(porId.get(it.exId)));
      const principalMarcado = modelo.leve ? principal : marcarAproximacao(principal, porId);

      const exercicios = [...aquecimento, ...principalMarcado, ...equilibrio, ...circuito, ...volta];
      if (enfaseUsada) notasFicha.push(aj.enfase === 'superiores' ? 'um isolado extra de ombro/braço como ênfase padrão (dá para trocar)' : 'um exercício extra de glúteo como ênfase padrão (dá para trocar)');

      const letra = String.fromCharCode(65 + iDia);
      const repetida = modelos.filter((m) => m === idModelo).length > 1 && !/ [A-C]$/.test(modelo.nome);
      return {
        nome: `Treino ${letra} — ${modelo.nome}${repetida ? ` (${occ})` : ''}`,
        exercicios,
        diaSemana: dias ? dias[iDia] ?? null : null,
        modelo: idModelo,
        objetivo: obj,
        statusDia: statusDia[iDia],
        porque: porQue({ obj, idModelo, modelo, nivelProg, prm, aj, numDias, principal, circuito, status: statusDia[iDia], notas: notasFicha }),
        duracaoMin: estimarMinutos(exercicios, prm),
      };
    });

    return {
      fichas: fichas.filter((f) => f.exercicios.some((e) => e.bloco === 'principal')),
      programa: {
        objetivo: obj, objetivoOriginal: objetivo, variante, nivel: nivelProg, local: localN,
        parametros: prm,
        perfil: { idade: aj.idade, imc: aj.imc, enfase: aj.enfase, impactoMax: aj.impactoMax, impactoMaxCardio: aj.impactoMaxCardio, notas: aj.notas },
        progressao: P.progressao(obj, nivelProg),
        aerobico: P.aerobicoRecomendado(obj, aj.idade),
        modelos,
        poolTamanho: pool.length,
      },
    };
  }

  /** Estimativa simples (min): series x (execucao + descanso) + blocos por tempo. */
  function estimarMinutos(itens, prm) {
    let seg = 0;
    for (const it of itens) {
      const exec = it.tempoSeg || ((it.repsMax || 10) * 3.5);
      seg += (Number(it.series) || 1) * (exec + (Number(it.descanso) || 0));
      if (it.circuito && it.circuito.ordem === it.circuito.total) seg += (it.circuito.rodadas - 1) * it.circuito.pausaRodadaSeg;
    }
    return Math.round(seg / 60);
  }

  const FRASE_MODELO = {
    FB: (n, nivel) => `Corpo inteiro: com ${n} treino${n > 1 ? 's' : ''} na semana, cada músculo é estimulado ${n}x${nivel === 'iniciante' ? ' — a frequência que mais acelera quem está começando' : ''}.`,
    SUP: () => 'Divisão superior/inferior: cada músculo 2x por semana, com volume para crescer e tempo para recuperar.',
    INF: () => 'Divisão superior/inferior: pernas e glúteos com volume próprio, 2x por semana.',
    PPL: () => 'Empurrar/puxar/pernas: mais volume por músculo em cada sessão, com 48-72h para recuperar.',
    MC: () => 'Força primeiro, enquanto você tem energia; o circuito no fim puxa o fôlego.',
    PP: () => 'Superséries economizam tempo e mantêm o coração acelerado; o circuito final aumenta o gasto sem horas de esteira.',
    SR: () => 'Movimentos do dia a dia — sentar e levantar, carregar, empurrar, puxar — com equilíbrio para prevenir quedas, sem saltos.',
    SR_MOB: () => 'Sessão leve de mobilidade e equilíbrio: mantém o corpo solto e o equilíbrio treinado entre os dias de força.',
    R_INF: () => 'Perna unilateral e deslocamento lateral como na quadra, com panturrilha excêntrica para proteger o Aquiles.',
    R_SUP: () => 'Mais puxar do que empurrar, e manguito/antebraço para blindar ombro e cotovelo contra o golpe repetido.',
    R_ROT: () => 'A potência do golpe vem do quadril e do core; treinar rotação tira a sobrecarga do braço.',
    R_FB: () => 'Corpo inteiro para quadra: agilidade, perna unilateral, rotação e a prevenção de ombro, cotovelo e Aquiles.',
    R_COND: () => 'Intervalos curtos imitando os pontos: arrancar, frear e mudar de direção.',
    R_PRE: (n, nivel, status) => status === 'jogo' ? 'Dia de jogo: só ativação, para entrar na quadra aquecido e não cansado.' : status === 'vespera' ? 'Véspera de jogo: só ativação leve, sem cansar as pernas.' : 'Sessão leve de ativação e prevenção.',
  };

  function porQue({ obj, idModelo, modelo, nivelProg, prm, aj, numDias, principal, circuito, status, notas }) {
    const chave = FRASE_MODELO[idModelo] ? idModelo
      : /^FB/.test(idModelo) ? 'FB' : /^SUP/.test(idModelo) ? 'SUP' : /^INF/.test(idModelo) ? 'INF'
        : /^(PUSH|PULL|LEGS)$/.test(idModelo) ? 'PPL' : /^MC/.test(idModelo) ? 'MC' : /^PP/.test(idModelo) ? 'PP' : /^SR/.test(idModelo) ? 'SR' : null;
    const partes = [];
    if (chave) partes.push(FRASE_MODELO[chave](numDias, nivelProg, status));
    const comps = principal.filter((it) => it.tipo === 'composto');
    const comp = comps[0];
    if (comp && !modelo.leve) {
      const desc = Math.max(...comps.map((it) => it.descanso));
      const ss = comps.some((it) => it.superserie) ? ' entre superséries' : '';
      partes.push(`${comp.series}x${comp.reps} nos principais, parando com ${comp.rirAlvo} rep${comp.rirAlvo === 1 ? '' : 's'} de sobra e ${desc}s de descanso${ss}.`);
    }
    if (circuito.length) {
      const c = circuito[0].circuito;
      partes.push(`Circuito: ${c.rodadas} rodadas de ${c.trabalhoSeg}s/${c.pausaSeg}s.`);
    }
    const ajustes = [...aj.notas, ...notas];
    if (ajustes.length) partes.push(`Ajustado: ${ajustes.join('; ')}.`);
    return partes.join(' ');
  }

  /**
   * Gera as fichas a partir do objetivo e do perfil (assinatura antiga preservada).
   * base: array de exercicios (data/exercicios.json)
   * diasSemana: dias da semana marcados no perfil (0=domingo...6=sabado) — quando informado,
   *             manda mais que freqForca, e cada ficha sai ligada ao dia (campo diaSemana).
   * rotacao: inteiro que varia a selecao sem random — 0 sempre da o mesmo resultado (bom pra
   *          teste); "gerar de novo" passa outro valor e a ficha muda de verdade.
   * Novos (opcionais): sexo 'f'|'m'|'outro', idade (anos), peso (kg), altura (cm),
   *   equipCasa (chaves de aparelho que a pessoa tem em casa), diasJogo (0-6, raquete),
   *   enfase ('auto'|'neutra'|'inferiores'|'superiores'|'gluteos').
   * Retorna: [{ nome, exercicios: [ItemFicha], diaSemana, modelo, objetivo, porque, duracaoMin, statusDia }]
   */
  function gerarPlano(opcoes = {}) {
    return gerarPrograma(opcoes).fichas;
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
  function variarFicha(ficha, base, { objetivo = 'hipertrofia', fracao = 0.5, rotacao = 0, local = null, equipCasa = null, idade = null } = {}) {
    const itens = ficha.exercicios || [];
    // so o bloco principal varia (aquecimento/circuito/volta a calma ja mudam no "gerar de novo")
    const principal = (it) => !it.bloco || it.bloco === 'principal';
    const comExercicio = itens.filter(principal).map((item) => ({ item, ex: base.find((e) => e.id === item.exId) })).filter((x) => x.ex);
    const isolados = comExercicio.filter((x) => !ehComposto(x.ex));
    const compostos = comExercicio.filter((x) => ehComposto(x.ex));
    const nTrocar = Math.round(comExercicio.length * fracao);
    const idsParaTrocar = new Set([...isolados, ...compostos].slice(0, nTrocar).map((x) => x.item.exId));
    const naFicha = new Set(itens.map((it) => it.exId));
    const aj = temProgramas() ? Programas.ajustesPerfil({ objetivo, idade }) : null;
    const pode = (c) => {
      if (naFicha.has(c.id)) return false;
      if (!temProgramas()) return true;
      if (local && !Programas.disponivel(c, local, equipCasa)) return false;
      if (aj && !Programas.impactoPermitido(c, aj.impactoMax)) return false;
      if (aj && aj.excluirRisco && Programas.riscoAlto(c)) return false;
      return true;
    };

    const exercicios = itens.map((item) => {
      if (!idsParaTrocar.has(item.exId)) return item;
      const exAtual = base.find((e) => e.id === item.exId);
      const opcoes = substitutos(exAtual, base, { limite: 12 }).filter(pode).slice(0, 6);
      if (!opcoes.length) return item; // sem alternativa segura — mantem como esta
      const escolhido = opcoes[rotacao % opcoes.length];
      naFicha.add(escolhido.id);
      if (item.bloco) {
        // item gerado por programa: mantem a prescricao do programa, troca so o exercicio
        return { ...item, exId: escolhido.id, carga: null, padrao: temProgramas() ? Programas.padraoDe(escolhido) : item.padrao };
      }
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
  function substitutos(ex, base, { limite = 4, local = null } = {}) {
    if (!ex) return [];
    const primariosEx = new Set(ex.musculos_primarios || []);
    const secundariosEx = new Set(ex.musculos_secundarios || []);
    const catsAceitas = new Set(CATEGORIAS_IRMAS[ex.categoria] || [ex.categoria]);
    // "outro equipamento" compara a chave normalizada (aparelho) quando existe — o texto livre
    // de equipamento varia ("Halter", "Halteres", "Halteres + banco") e deixava passar o mesmo aparelho
    const aparelhoDe = (c) => c.aparelho || c.equipamento;
    const nivelN = { iniciante: 0, intermediario: 1, avancado: 2, elite: 3 };

    const candidatos = base
      .filter((c) => c.id !== ex.id)
      .filter((c) => catsAceitas.has(c.categoria) || (c.musculos_primarios || []).some((m) => primariosEx.has(m)))
      .filter((c) => aparelhoDe(c) !== aparelhoDe(ex)) // o ponto todo: outro equipamento
      .filter((c) => !local || !Array.isArray(c.local) || c.local.includes(local))
      .map((c) => {
        const comuns = (c.musculos_primarios || []).filter((m) => primariosEx.has(m)).length;
        const comunsSec = (c.musculos_secundarios || []).filter((m) => secundariosEx.has(m)).length;
        const distNivel = Math.abs((nivelN[c.nivel] ?? 1) - (nivelN[ex.nivel] ?? 1));
        return { ex: c, pontos: comuns * 3 + comunsSec * 0.7 + (c.categoria === ex.categoria ? 1 : 0) + (distNivel === 0 ? 0.6 : distNivel === 1 ? 0.2 : -1)
          // nao trocar exercicio de forca por salto/sprint/cardio (e vice-versa)
          - ((c.impacto === 'alto') !== (ex.impacto === 'alto') ? 2 : 0)
          - ((c.categoria === 'cardio') !== (ex.categoria === 'cardio') ? 2 : 0) };
      })
      .filter((c) => c.pontos >= 3) // pelo menos 1 musculo primario em comum
      .sort((a, b) => b.pontos - a.pontos);

    // variedade: no maximo 2 opcoes por aparelho, pra lista mostrar aparelhos diferentes
    const porAparelho = {};
    const saida = [];
    for (const c of candidatos) {
      const k = aparelhoDe(c.ex);
      if ((porAparelho[k] = (porAparelho[k] || 0) + 1) > 2) continue;
      saida.push(c.ex);
      if (saida.length >= limite) break;
    }
    return saida;
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
    OBJETIVOS, OBJETIVOS_LEGADOS, prescrever, ehComposto,
    sugerirCarga, detectarPlato,
    volumeSemanal, FAIXA_VOLUME, classificarVolume,
    avaliarDeload, anilhas, arredondar,
    substitutos, gerarPlano, gerarPrograma, completarSessao, gruposTreinados,
    SEMANAS_PARA_VARIAR, semanasSemVariar, precisaVariar, variarFicha,
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Forca;
