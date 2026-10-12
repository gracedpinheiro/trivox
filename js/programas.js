/* Programas de treino por OBJETIVO x NIVEL, e a classificacao dos exercicios que o gerador usa.

   Este arquivo e so "conhecimento": parametros, estrutura semanal, filtros por perfil e a leitura
   de cada exercicio (padrao de movimento, aparelho, impacto, local). Quem monta as fichas e
   Forca.gerarPrograma / Forca.gerarPlano (js/forca.js), que consulta este modulo.

   Referencias (detalhes e tabela em ferramentas/programas.md):
   - ACSM Position Stand: Progression Models in Resistance Training for Healthy Adults (2009)
   - ACSM Guidelines for Exercise Testing and Prescription, 11a ed. (2021)
   - ACSM Position Stand: Appropriate Physical Activity Intervention Strategies for Weight Loss (2009)
   - NSCA Essentials of Strength Training and Conditioning, 4a ed. (2016)
   - Fragala et al., NSCA Position Statement: Resistance Training for Older Adults (2019)
   - OMS/WHO Guidelines on Physical Activity and Sedentary Behaviour (2020) — 150-300 min/sem
     moderado, forca >= 2 dias, atividade multicomponente com equilibrio >= 3 dias para 65+
   - Schoenfeld et al. (2017) dose-resposta de volume: 10+ series/musculo/semana
   - Schoenfeld et al. (2016) descanso longo (>= 2 min) em compostos favorece hipertrofia
   - Ellenbecker & Cools (2010) / "Thrower's Ten": manguito rotador e escapula em atletas de raquete
   - Tyler et al. (2010) excentrico de extensores de punho para epicondilite lateral
   - Alfredson (1998) excentrico de panturrilha para tendinopatia do Aquiles
   - Davies, Riemann & Manske (2015) dosagem de pliometria por contatos/sessao */

const Programas = (() => {

  const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  // ---------- niveis e objetivos ----------

  const NIVEIS = ['iniciante', 'intermediario', 'avancado'];
  const nivelN = { iniciante: 0, intermediario: 1, intermediante: 1, avancado: 2, elite: 3 };
  /** Elite continua existindo nos dados, mas o programa trata como avancado. */
  const nivelPrograma = (n) => (n === 'elite' ? 'avancado' : NIVEIS.includes(n) ? n : 'iniciante');

  const OBJETIVOS = {
    condicionamento: {
      nome: 'Condicionamento físico',
      resumo: 'Força nos grandes movimentos + circuito metabólico no fim. Melhora fôlego, força e disposição ao mesmo tempo.',
    },
    perda_peso: {
      nome: 'Perda de peso',
      resumo: 'Musculação em superséries para preservar músculo no déficit, e circuito curto para gastar mais. O resultado vem do conjunto treino + alimentação + passos no dia.',
    },
    hipertrofia: {
      nome: 'Hipertrofia',
      resumo: 'Faixas de 6 a 15 reps perto da falha, descanso suficiente e volume semanal crescente. Cada músculo treinado 2x por semana.',
    },
    '50mais': {
      nome: 'Especial 50+',
      resumo: 'Força funcional, equilíbrio e mobilidade, sem saltos. Pensado para autonomia: levantar do chão, subir escada, carregar sacola e não cair.',
    },
    raquete: {
      nome: 'Especial raquete (pickleball e beach tennis)',
      resumo: 'Agilidade lateral, potência de rotação, ombro e cotovelo blindados, panturrilha e Aquiles fortes — sem cansar a perna na véspera do jogo.',
    },
  };

  // objetivos antigos do app -> novos (compatibilidade com perfis ja salvos)
  const MAPA_LEGADO = {
    forca: 'hipertrofia',          // mantem a variante "forca" (reps baixas) dentro de hipertrofia
    resistencia: 'condicionamento',
    emagrecimento: 'perda_peso',
    perca_peso: 'perda_peso',
    perda_de_peso: 'perda_peso',
    condicionamento_fisico: 'condicionamento',
    '50+': '50mais',
    senior: '50mais',
    pickleball: 'raquete',
    beach_tennis: 'raquete',
    beachtennis: 'raquete',
  };

  function normalizarObjetivo(o) {
    if (OBJETIVOS[o]) return { objetivo: o, variante: null };
    const novo = MAPA_LEGADO[o];
    if (novo) return { objetivo: novo, variante: o === 'forca' ? 'forca' : null };
    return { objetivo: 'hipertrofia', variante: null };
  }

  /** Para js/aerobico.js, que ainda fala os nomes antigos. */
  function objetivoAerobico(o) {
    const { objetivo } = normalizarObjetivo(o);
    return { condicionamento: 'resistencia', perda_peso: 'emagrecimento', hipertrofia: 'hipertrofia', '50mais': 'resistencia', raquete: 'resistencia' }[objetivo];
  }

  // ---------- aparelhos ----------
  // Chaves canonicas = as do campo `aparelho` de data/exercicios.json. Exercicios sem o campo
  // (base antiga) tem o texto de `equipamento` traduzido para essas chaves: cada exercicio pede
  // 1+ aparelhos ("Banco + halteres" pede os dois) e cada pedido pode ter alternativas
  // ("Peso corporal ou halteres").

  // Opcoes de "o que voce tem em casa" (para a tela de perfil). Ordem = ordem sugerida na UI.
  const EQUIP_CASA_OPCOES = [
    { chave: 'halteres', nome: 'Halteres' },
    { chave: 'kettlebell', nome: 'Kettlebell' },
    { chave: 'elastico', nome: 'Elástico / faixa longa' },
    { chave: 'mini_band', nome: 'Mini band (faixa curta)' },
    { chave: 'banco', nome: 'Banco ou sofá firme' },
    { chave: 'degrau_step', nome: 'Step ou degrau de escada' },
    { chave: 'cadeira', nome: 'Cadeira firme' },
    { chave: 'colchonete', nome: 'Colchonete / tapete' },
    { chave: 'toalha', nome: 'Toalha' },
    { chave: 'mochila', nome: 'Mochila com peso (livros, garrafas)' },
    { chave: 'bola_suica', nome: 'Bola suíça' },
    { chave: 'barra_fixa', nome: 'Barra fixa de porta' },
    { chave: 'trx', nome: 'Fita de suspensão (TRX)' },
    { chave: 'corda_pular', nome: 'Corda de pular' },
    { chave: 'cones', nome: 'Cones ou marcadores' },
    { chave: 'escada_agilidade', nome: 'Escada de agilidade' },
    { chave: 'roda_abdominal', nome: 'Roda abdominal' },
    { chave: 'foam_roller', nome: 'Rolo de liberação (foam roller)' },
    { chave: 'hand_grip', nome: 'Hand grip' },
    { chave: 'medicine_ball', nome: 'Medicine ball' },
    { chave: 'saco_areia', nome: 'Saco de areia (sandbag)' },
    { chave: 'argolas', nome: 'Argolas de ginástica' },
    { chave: 'paralelas', nome: 'Paralelas' },
    { chave: 'bosu', nome: 'Bosu' },
    { chave: 'raquete', nome: 'Raquete (pickleball / beach tennis)' },
    { chave: 'bicicleta', nome: 'Bicicleta ergométrica' },
    { chave: 'esteira', nome: 'Esteira' },
    { chave: 'eliptico', nome: 'Elíptico' },
    { chave: 'remo_ergometro', nome: 'Remo ergométrico' },
    { chave: 'barra', nome: 'Barra olímpica e anilhas' },
  ];

  // sempre disponiveis em qualquer casa (nao precisam ser marcados)
  const SEMPRE_EM_CASA = ['peso_corporal', 'parede', 'colchonete', 'cadeira', 'toalha'];
  // o que se assume ter em casa quando o perfil nao diz (barato e comum)
  const EQUIP_CASA_PADRAO = ['peso_corporal', 'parede', 'colchonete', 'cadeira', 'toalha', 'banco', 'degrau_step', 'mochila', 'elastico', 'mini_band', 'halteres', 'cones'];
  // parque (local antigo): barras e bancos de praca, sem halter
  const EQUIP_PARQUE = ['peso_corporal', 'parede', 'banco', 'degrau_step', 'barra_fixa', 'paralelas', 'barra_baixa', 'cones', 'elastico'];

  // nomes antigos (desta versao do app ou digitados) -> chave canonica
  const ALIAS = {
    aneis: 'argolas', rolo_espuma: 'foam_roller', rolo: 'foam_roller', bike: 'bicicleta', battle_rope: 'corda_naval',
    pegada: 'hand_grip', gripper: 'hand_grip', banco_ajustavel: 'banco_inclinado', step: 'degrau_step', degrau: 'degrau_step',
    caixa: 'caixa_pliometrica', miniband: 'mini_band', halter: 'halteres', haltere: 'halteres', elastico_longo: 'elastico',
    sandbag: 'saco_areia', fita_suspensao: 'trx', corda: 'corda_pular', bola_medicinal: 'medicine_ball', strongman: 'pneu',
    cabo: 'polia', bastao: 'toalha', // bastao/cabo de vassoura: qualquer casa tem; trata como item trivial
  };
  const canon = (k) => ALIAS[k] || k;

  // substitutos aceitaveis em casa: quem tem o da direita consegue fazer o exercicio da esquerda
  const EQUIVALE = {
    kettlebell: ['halteres'], mini_band: ['elastico'], saco_areia: ['mochila'], mochila: ['saco_areia', 'halteres'],
    banco: ['cadeira'], degrau_step: ['banco'], escada_agilidade: ['cones'], cones: ['escada_agilidade'],
  };

  // aparelhos que so existem na academia (o teste "nenhuma maquina em casa" usa esta lista;
  // em casa so entram se a pessoa marcar que tem — ex.: bicicleta, esteira)
  const SO_ACADEMIA = new Set([
    'maquina', 'polia', 'crossover', 'smith', 'leg_press', 'hack', 'puxador_pulley', 'panturrilha_maquina', 'supino_maquina',
    'mesa_flexora', 'cadeira_extensora', 'cadeira_abdutora', 'cadeira_adutora', 'remada_baixa', 'remada_maquina',
    'voador_peck_deck', 'maquina_bracos', 'maquina_abdominal', 'gluteo_maquina', 'desenvolvimento_maquina', 'banco_romano',
    'landmine', 'treno', 'pneu', 'corda_naval', 'remo_ergometro', 'bicicleta', 'esteira', 'eliptico',
    'barra', 'barra_ez', 'anilha', 'banco_inclinado', 'caixa_pliometrica', 'barra_baixa', 'barra_vertical', 'cinto',
  ]);
  // so academia E tipicamente maquina (o teste de "nenhuma maquina em casa" usa este)
  const MAQUINAS = new Set([...SO_ACADEMIA].filter((k) => !['barra', 'barra_ez', 'anilha', 'banco_inclinado', 'caixa_pliometrica', 'barra_baixa', 'barra_vertical', 'cinto', 'landmine', 'corda_naval', 'pneu', 'treno'].includes(k)));
  // raros mesmo em academia comum no Brasil: nao entram no gerador automatico
  const RAROS = new Set(['strongman', 'barra_vertical']);
  const CONHECIDOS = new Set([...SO_ACADEMIA, ...EQUIP_CASA_OPCOES.map((o) => o.chave), ...SEMPRE_EM_CASA, 'strongman']);

  const TOKENS = [
    [/^(peso corporal|chao|apoio|corpo)$/, 'peso_corporal'],
    [/^(parede|moldura|sofa|parede ou moldura)$/, 'parede'],
    [/foam|rolo/, 'foam_roller'],
    [/bastao|pvc|vassoura/, 'toalha'],
    [/toalha na barra/, 'barra_fixa'],
    [/toalha|slider/, 'toalha'],
    [/mini.?band/, 'mini_band'],
    [/elastic|banda|super.?band/, 'elastico'],
    [/kettlebell/, 'kettlebell'],
    [/halter|dumbbell|anilha leve/, 'halteres'],
    [/bola suica|fitball|bola de pilates/, 'bola_suica'],
    [/medicine|bola de medicina|slam ball|med ball/, 'medicine_ball'],
    [/battle rope|corda naval/, 'corda_naval'],
    [/corda de pular|^corda$|pular/, 'corda_pular'],
    [/escada de agilidade/, 'escada_agilidade'],
    [/^cones?$|agilidade/, 'cones'],
    [/banco inclinado|banco ajustavel/, 'banco_inclinado'],
    [/banco scott|scott/, 'maquina'],
    [/banco romano/, 'banco_romano'],
    [/^(step|degrau)$/, 'degrau_step'],
    [/^(caixa|plataforma)$/, 'caixa_pliometrica'],
    [/^cadeira$/, 'cadeira'],
    [/^banco$/, 'banco'],
    [/barra fixa|barra horizontal|pegada neutra|pull.?up bar/, 'barra_fixa'],
    [/barra vertical/, 'barra_vertical'],
    [/barra baixa/, 'barra_baixa'],
    [/paralela/, 'paralelas'],
    [/^(aneis|argolas|aneis de ginastica)$/, 'argolas'],
    [/smith/, 'smith'],
    [/remo|maquina de remo/, 'remo_ergometro'],
    [/bike|bicicleta|spinning/, 'bicicleta'],
    [/esteira/, 'esteira'],
    [/maquina|ghr|viking|leg press|barra t$/, 'maquina'],
    [/polia|cabo|crossover/, 'polia'],
    [/treno|prowler/, 'treno'],
    [/sandbag|saco de areia/, 'saco_areia'],
    [/pneu|marreta|atlas|yoke|objeto pesado|corrente|saco de pancada/, 'strongman'],
    [/gripper|wrist roller|hand grip/, 'hand_grip'],
    [/roda abdominal|ab wheel/, 'roda_abdominal'],
    [/cinto/, 'cinto'],
    [/^(anilha|anilhas)$/, 'anilha'],
    [/ez/, 'barra_ez'],
    [/trap bar|hex bar|safety bar|barra/, 'barra'],
    [/suporte|fixacao|tabua/, null], // acessorio da barra, nao conta como pedido separado
  ];

  const cacheReq = new Map();

  /** Lista de pedidos de aparelho: [[alternativas], [alternativas]...]. */
  function aparelhosDe(ex) {
    if (!ex) return [['desconhecido']];
    const chave = ex.id + '|' + ex.equipamento + '|' + (ex.aparelho || '');
    if (cacheReq.has(chave)) return cacheReq.get(chave);
    let req;
    if (ex.aparelho) {
      // campo novo: uma chave so (aceita tambem os nomes antigos via ALIAS)
      req = [[normalizarToken(ex.aparelho, ex) || 'desconhecido']];
    } else {
      const txt = semAcento(ex.equipamento);
      const combinaCorda = /polia|treno/.test(txt);
      req = txt.split('+').map((parte) => parte.trim()).filter(Boolean).map((parte) => {
        const alts = parte.split(/\/|\bou\b|,/).map((a) => a.trim()).filter(Boolean)
          .map((a) => (combinaCorda && /^corda$/.test(a) ? null : normalizarToken(a, ex)))
          .filter((a) => a !== null);
        return alts;
      }).filter((alts) => alts.length);
      if (!req.length) req = [['peso_corporal']];
    }
    cacheReq.set(chave, req);
    return req;
  }

  function normalizarToken(t, ex) {
    t = semAcento(t).trim();
    if (!t) return 'peso_corporal';
    const direto = canon(t.replace(/[\s-]+/g, '_'));
    if (CONHECIDOS.has(direto)) return direto;
    t = t.replace(/_/g, ' ');
    if (t === 'barra' && ex && ex.categoria === 'puxar') return 'barra_fixa';
    for (const [re, k] of TOKENS) if (re.test(t)) return k;
    if (/^maquina|^aparelho|cadeira (extensora|flexora|abdutora|adutora)|leg|hack|pec deck|voador|graviton/.test(t)) return 'maquina';
    return direto || 'desconhecido'; // chave nova que eu nao conheco: devolve como veio
  }

  /** Normaliza a lista do perfil (aceita nomes antigos) e soma o que toda casa tem. */
  const cacheEquip = new Map();
  function normalizarEquipCasa(lista, local) {
    const chave = (lista || []).join(',') + '|' + local;
    if (!cacheEquip.has(chave)) cacheEquip.set(chave, montarEquipCasa(lista, local));
    return cacheEquip.get(chave);
  }
  function montarEquipCasa(lista, local) {
    const base = lista && lista.length ? lista : (local === 'parque' ? EQUIP_PARQUE : EQUIP_CASA_PADRAO);
    return new Set([...SEMPRE_EM_CASA, ...base.map((k) => canon(semAcento(k).replace(/[\s-]+/g, '_')))]);
  }

  /** Chave do aparelho principal (para variar aparelho dentro da semana). */
  function aparelhoPrincipal(ex) {
    const req = aparelhosDe(ex);
    const triviais = ['peso_corporal', 'banco', 'parede', 'colchonete', 'cadeira'];
    const naoTriviais = req.map((alts) => alts[0]).filter((k) => !triviais.includes(k));
    return naoTriviais[0] || req[0][0];
  }

  function locaisDe(ex) {
    if (Array.isArray(ex.local) && ex.local.length) return ex.local;
    const req = aparelhosDe(ex);
    const casaOk = req.every((alts) => alts.some((k) => !SO_ACADEMIA.has(k) && CONHECIDOS.has(k)));
    return casaOk ? ['academia', 'casa'] : ['academia'];
  }

  /** O exercicio pode ser feito com o que a pessoa tem nesse local? */
  function disponivel(ex, local, equipCasa) {
    const casa = local !== 'academia';
    const req = aparelhosDe(ex);
    if (!casa) {
      if (Array.isArray(ex.local) && ex.local.length && !ex.local.includes('academia')) return false;
      return !req.some((alts) => alts.every((k) => RAROS.has(k)));
    }
    const marcadoCasa = Array.isArray(ex.local) && ex.local.length;
    if (marcadoCasa && !ex.local.includes('casa')) return false;
    const tem = normalizarEquipCasa(equipCasa, local);
    const temK = (k) => tem.has(k) || (EQUIVALE[k] || []).some((e) => tem.has(e));
    return req.every((alts) => alts.some((k) => {
      if (temK(k)) return true;
      // aparelho que eu nao conheco, mas a base marcou como "casa": confia no dado
      return !CONHECIDOS.has(k) && marcadoCasa && ex.local.includes('casa');
    }));
  }

  /** Usado no teste: alguma exigencia do exercicio e maquina/aparelho tipico de academia? */
  function exigeAcademia(ex, { soMaquinas = false } = {}) {
    const lista = soMaquinas ? MAQUINAS : SO_ACADEMIA;
    return aparelhosDe(ex).some((alts) => alts.every((k) => lista.has(k)));
  }

  // ---------- leitura do exercicio: impacto, risco, padrao, tags ----------

  const RE_ALTO = /\b(salto|saltos|saltando|jump|jumps|pliometric\w*|burpees?|sprints?|double under|bound\w*|hops?|skaters?|polichinelos?|jumping jacks?|pular|clap|palmas|explosiv\w*|tabata de burpees|split jump|vertimax|broad)\b/;
  const RE_MEDIO = /\b(corrida|correr|mountain climbers?|escalador|battle rope|slam|swing|shuffles?|passadas laterais|agilidade|step aerobico|shadow boxing|thruster|wall ball|heavy bag|saco de pancadas|joelho alto|hiit|amrap|sprint com resistencia|esteira desligada|complex)\b/;
  const RE_OLIMPICO = /\b(clean|snatch|arranque|arremesso|jerk|power clean|bear complex|complex com barra|high pull)\b/;
  const RE_INVERTIDO = /bananeira|handstand|hspu|planche|human flag|front lever|back lever|maltes|skin the cat|one arm|crow|corvo|frog stand|l-sit pull|typewriter|muscle.?up/;

  // entradas da base que sao FORMATOS de treino, nao exercicios (o gerador monta os proprios circuitos)
  const RE_FORMATO = /^circuito|tabata|amrap|hiit de|intervals?\b|\bcomplex\b|- circuito/;
  const ehFormato = (ex) => RE_FORMATO.test(semAcento(ex.nome));

  function impactoDe(ex) {
    if (ex.impacto) return ex.impacto;
    const n = semAcento(ex.nome);
    // "sprint" no remo/bike e intenso, mas sem impacto articular
    const ap = aparelhoPrincipal(ex);
    if (ap === 'remo_ergometro' || ap === 'bike') return 'baixo';
    if (RE_ALTO.test(n)) return 'alto';
    if (RE_MEDIO.test(n)) return 'medio';
    return 'baixo';
  }

  /** Complexidade/risco tecnico alto (para 50+ e iniciantes): olimpicos, invertidos, skills. */
  function riscoAlto(ex) {
    const n = semAcento(ex.nome);
    return ex.categoria === 'skills' || RE_OLIMPICO.test(n) || RE_INVERTIDO.test(n) || ex.nivel === 'elite';
  }

  const cachePadrao = new Map();

  /** Padrao de movimento — base da estrutura das fichas (mais preciso que a categoria). */
  function padraoDe(ex) {
    if (ex.padrao) return ex.padrao;
    if (cachePadrao.has(ex.id)) return cachePadrao.get(ex.id);
    const p = calcularPadrao(ex);
    cachePadrao.set(ex.id, p);
    return p;
  }

  function calcularPadrao(ex) {
    const n = semAcento(ex.nome);
    const c = ex.categoria;
    const has = (re) => re.test(n);
    if (/pescoco|neck/.test(n)) return 'pescoco';
    if (c === 'mobilidade') return 'mobilidade';
    if (c === 'alongamento') return 'alongamento';
    if (c === 'equilibrio') return 'equilibrio';
    if (has(/rotacao (externa|interna)|manguito|cuban|rotator|diagonal d2|\bd2\b|serratil|protracao|flexao plus/)) return 'manguito';
    if (has(/punho|wrist|grip training|gripper|hand grip|dead hang na toalha|pronacao|supinacao|desvio radial|ulnar|tyler/)) return 'antebraco';
    if (has(/forehand|backhand|golpes? de sombra|shadow swing/)) return 'rotacional';
    if (has(/panturr|calf|gemeos|soleo/)) return 'panturrilha';
    if (c === 'skills') return 'skill';
    if (c === 'cardio') return has(/agilidade|cones|shuffle|passadas laterais|escada|split step|crossover step|drop step|spider|t-test|kitchen|pro agility|frenagem|reacao|fast feet|pes rapidos/) ? 'agilidade' : (has(/farmer/) ? 'carregamento' : 'cardio');
    if (c === 'biceps') return 'biceps';
    if (c === 'triceps') return has(/mergulho|dips?\b|supino fechado|close.?grip|floor press|diamante|flexao/) ? 'empurrar_h' : 'triceps';
    if (c === 'core' || c === 'core_cal') return has(/copenhag/) ? 'adutor' : 'core';
    if (c === 'peito' || c === 'empurrar') {
      if (has(/desenvolvimento|press militar|militar|pike|hspu|handstand|overhead|arnold/)) return 'empurrar_v';
      if (has(/crucifixo|fly|peck|pec deck|voador|crossover/)) return 'peito_iso';
      if (has(/pull.?over/)) return 'puxar_v';
      return 'empurrar_h';
    }
    if (c === 'ombros') {
      if (has(/face pull|pull apart|posterior|invertid|reverse|y-t-w|ytw|crucifixo inverso|\b[wyt] raise/)) return 'ombro_posterior';
      if (has(/remada alta|upright/)) return 'ombro_lateral';
      if (has(/encolh|shrug/)) return 'trapezio';
      if (has(/elevacao lateral|lateral raise|lateral/)) return 'ombro_lateral';
      if (has(/elevacao frontal|frontal/)) return 'ombro_lateral';
      if (has(/landmine/)) return 'empurrar_v';
      return 'empurrar_v';
    }
    if (c === 'costas' || c === 'puxar') {
      if (has(/face pull|pull apart/)) return 'ombro_posterior';
      if (has(/remada alta|upright/)) return 'ombro_lateral';
      if (has(/lateral curvad|bent.?over lat|crucifixo invertido|reverse fly/)) return 'ombro_posterior';
      if (has(/terra|deadlift|good morning|bom dia|hiperextens|superman|lombar|rack pull|extensao lombar|back extension/)) return 'dobrar_quadril';
      if (has(/encolh|shrug/)) return 'trapezio';
      if (has(/remada|row|australian|invertid|inverted/)) return 'puxar_h';
      if (has(/puxada|pulldown|barra fixa|pull.?up|chin|graviton|pull.?over|lat|dead hang|scapular/)) return 'puxar_v';
      return 'puxar_h';
    }
    if (c === 'pernas' || c === 'pernas_cal' || c === 'gluteos') {
      if (has(/abdu|clamshell|fire hydrant|monster|lateral walk/)) return 'gluteo';
      if (has(/adu[cç]|adutor|copenhag/)) return 'adutor';
      if (has(/stiff|rdl|terra|flexora|nordic|good morning|bom dia|leg curl|hip hinge|romanian|romeno|pull.?through|mesa flexora|ghr|glute.?ham/)) return 'dobrar_quadril';
      if (has(/hip thrust|elevacao pelvica|ponte|bridge|kickback|gluteo|coice|frog pump/)) return 'gluteo';
      if (has(/lateral|cossack/)) return 'lateral';
      return 'agachar';
    }
    if (c === 'funcional') {
      if (has(/monster|band walk|lateral walk/)) return 'gluteo';
      if (has(/farmer|carry|carregamento|yoke|suitcase|waiter/)) return 'carregamento';
      if (has(/rotational|rotacional|chop|pallof|throw|arremesso de peito/)) return 'rotacional';
      if (has(/swing|rdl|terra|hinge|deadlift|single leg|unilateral com kettlebell/)) return 'dobrar_quadril';
      if (has(/goblet|thruster|wall ball|agach|step|squat/)) return 'agachar';
      if (has(/burpee|mountain|battle|slam|jump|salto|sprint|corda|pneu|marreta|bag|tug|treno|sled|prowler/)) return 'metabolico';
      if (has(/press|jerk/)) return 'empurrar_v';
      if (has(/row|remada/)) return 'puxar_h';
      if (has(/pull apart/)) return 'ombro_posterior';
      if (has(/glute|gluteo|monster|band walk/)) return 'gluteo';
      if (has(/get.?up/)) return 'core';
      if (has(/clean|snatch|high pull|complex/)) return 'potencia';
      return 'metabolico';
    }
    return 'outro';
  }

  const cacheTags = new Map();

  /** Etiquetas extras que os programas especiais usam (raquete, 50+, circuitos). */
  function tagsDe(ex) {
    if (cacheTags.has(ex.id)) return cacheTags.get(ex.id);
    const n = semAcento(ex.nome);
    const p = padraoDe(ex);
    const t = new Set(Array.isArray(ex.tags) ? ex.tags : []);
    t.add(p);
    const imp = impactoDe(ex);
    const semSalto = /sem salto|baixo impacto/.test(n);
    if (/unilateral|bulgar|afundo|passada|lunge|step.?up|step over|single.?leg|pistol|cossack|split|1-arm|uma perna|alternad|fenda/.test(n)) t.add('unilateral');
    if (p === 'lateral' || p === 'adutor' || /lateral|cossack|shuffle|skater|patinador|monster|abdu|copenhag|squat lateral/.test(n) && ['agachar', 'gluteo', 'lateral', 'adutor', 'agilidade', 'cardio', 'metabolico', 'equilibrio'].includes(p)) t.add('lateral');
    if (p === 'rotacional' || /rotac|chop|pallof|russian|twist|giro|lenhador|woodch|landmine rot|throw/.test(n) && ['core', 'rotacional', 'metabolico', 'potencia'].includes(p)) t.add('rotacional');
    if (p === 'manguito' || /face pull|y-t-w|cuban|rotacao externa/.test(n)) t.add('manguito');
    if (p === 'ombro_posterior' || /face pull|pull apart|y-t-w|crucifixo invertido|posterior/.test(n)) t.add('escapula');
    if (p === 'antebraco' || /farmer|toalha|wrist|punho/.test(n)) t.add('antebraco');
    if (p === 'agilidade' || /agilidade|cones|escada|shuffle|split step|reacao/.test(n)) t.add('agilidade');
    // pliometria = salto de verdade: impacto alto em qualquer padrao de perna/deslocamento, ou nome de salto
    if (!semSalto && (imp === 'alto' && ['agachar', 'metabolico', 'cardio', 'lateral', 'agilidade', 'potencia', 'dobrar_quadril', 'gluteo', 'panturrilha', 'equilibrio'].includes(p)
      || /\b(saltos?|hops?|pogo|jumps?|skater(?! squat)|bounds?|pliometric\w*|drop jump|tuck jump)\b/.test(n))) t.add('pliometria');
    if (!semSalto && /throw|arremesso|slam|swing|clean|snatch|jerk|explosiv|salto|jump|push press|smash/.test(n)) t.add('potencia');
    if (p === 'metabolico' || p === 'cardio' || /burpee|mountain|battle|slam|swing|thruster|wall ball|jumping|polichinelo|corrida|kettlebell complex|amrap/.test(n)) t.add('metabolico');
    if (['cardio', 'agilidade'].includes(p)) t.add('cardio');
    if (p === 'carregamento') t.add('antebraco');
    if (/sentar e levantar|sit.?to.?stand|levantar do chao|get.?up|goblet|step.?up|farmer/.test(n)) t.add('funcional_diario');
    if (/prancha|plank|pallof|dead bug|bird dog|farmer|suitcase|carry/.test(n)) t.add('anti_movimento');
    if (/ativa[cç][aã]o|activation|band walk|monster|clamshell|pull apart|abducao com elastico|fire hydrant|kickback com elastico/.test(n)) t.add('ativacao');
    cacheTags.set(ex.id, t);
    return t;
  }

  /** Afinidade do exercicio com o objetivo: usa o campo novo quando existe, senao heuristica. */
  function afinidade(ex, objetivo) {
    if (Array.isArray(ex.objetivos) && ex.objetivos.length) return ex.objetivos.includes(objetivo) ? 3 : 0;
    const p = padraoDe(ex);
    const t = tagsDe(ex);
    const imp = impactoDe(ex);
    const musc = ['agachar', 'dobrar_quadril', 'empurrar_h', 'empurrar_v', 'puxar_h', 'puxar_v', 'gluteo', 'panturrilha', 'ombro_lateral', 'ombro_posterior', 'biceps', 'triceps', 'peito_iso', 'adutor', 'core'];
    switch (objetivo) {
      case 'hipertrofia':
        return musc.includes(p) && ex.categoria !== 'funcional' ? 2 : musc.includes(p) ? 1 : 0;
      case 'condicionamento':
      case 'perda_peso':
        return (t.has('metabolico') ? 2 : 0) + (['agachar', 'dobrar_quadril', 'puxar_h', 'empurrar_h', 'carregamento'].includes(p) ? 1 : 0) + (ex.categoria === 'funcional' ? 1 : 0);
      case '50mais':
        return (imp === 'baixo' ? 1 : 0) + (riscoAlto(ex) ? -3 : 0) + (t.has('funcional_diario') || p === 'carregamento' || p === 'equilibrio' ? 2 : 0) + (t.has('unilateral') ? 0.5 : 0) + ((nivelN[ex.nivel] ?? 0) <= 1 ? 0.5 : 0);
      case 'raquete':
        return ['lateral', 'rotacional', 'manguito', 'escapula', 'antebraco', 'agilidade', 'unilateral'].reduce((s, k) => s + (t.has(k) ? 1 : 0), 0) + (p === 'panturrilha' ? 2 : 0);
      default:
        return 0;
    }
  }

  // ---------- grupos musculares (aquecimento e alongamento dirigidos) ----------
  // Os nomes de musculo da base sao livres ("Deltóide Anterior", "Peitoral Superior"...). Aqui
  // viram ~16 grupos, que e a granularidade de um alongamento/mobilidade.

  const REGRAS_GRUPO = [
    [/peitoral|peito/, 'peito'],
    [/manguito|supraespin|infraespin|subescap|redondo menor|rotadores externos|capsula/, 'ombros'],
    [/deltoide|ombro|escapul|serratil|elevador da escapula/, 'ombros'],
    [/trapezio superior|cervica|pescoco|escalen|esternocleido/, 'pescoco'],
    [/latissimo|dorsa|romboide|trapezio|redondo maior|costas/, 'costas'],
    [/triceps/, 'triceps'],
    [/biceps femoral/, 'posterior'],
    [/biceps|braquial(?!rr)|^braquial$/, 'biceps'],
    [/antebraco|braquiorradial|pulso|dedos|punho/, 'antebraco'],
    [/coluna toracica|^toracica|intercosta/, 'toracica'],
    [/eretor|lombar|quadrado lombar|core posterior|^coluna/, 'lombar'],
    [/obliquo|reto abdominal|transverso|^core|abdom|assoalho/, 'core'],
    [/psoas|iliopsoas|flexores do quadril|hip flexor|reto femoral|rotadores|piriforme|^quadril|tensor|it band/, 'quadril'],
    [/quadriceps/, 'quadriceps'],
    [/isquio|posterior/, 'posterior'],
    [/gluteo|abdutor/, 'gluteos'],
    [/adutor/, 'adutores'],
    [/panturr|gastrocn|soleo|tibial|tornozelo|peroneo|aquiles/, 'panturrilha'],
  ];
  const cacheGrupo = new Map();

  /** Nome de musculo -> grupo (ou null para "Cardio", "Full Body", "Equilíbrio"...). */
  function grupoMuscular(musculo) {
    const m = semAcento(musculo).trim();
    if (cacheGrupo.has(m)) return cacheGrupo.get(m);
    let g = null;
    for (const [re, k] of REGRAS_GRUPO) if (re.test(m)) { g = k; break; }
    cacheGrupo.set(m, g);
    return g;
  }

  /** Grupos dos musculos primarios de um exercicio (secundarios=true inclui os auxiliares). */
  function gruposDe(ex, secundarios = false) {
    const lista = [...(ex.musculos_primarios || []), ...(secundarios ? ex.musculos_secundarios || [] : [])];
    return [...new Set(lista.map(grupoMuscular).filter(Boolean))];
  }

  // grupos "vizinhos": a mobilidade/alongamento de um ajuda o outro (usado so como 2a opcao)
  const GRUPOS_VIZINHOS = {
    peito: ['ombros', 'toracica'], costas: ['toracica', 'ombros'], ombros: ['toracica', 'peito', 'costas'],
    biceps: ['antebraco', 'ombros'], triceps: ['ombros'], antebraco: ['biceps'], pescoco: ['ombros', 'costas'],
    toracica: ['costas', 'ombros'], lombar: ['quadril', 'posterior'], core: ['lombar', 'quadril'],
    quadriceps: ['quadril', 'panturrilha'], posterior: ['lombar', 'quadril'], gluteos: ['quadril'],
    adutores: ['quadril'], quadril: ['gluteos', 'adutores', 'quadriceps'], panturrilha: ['posterior'],
  };
  const GRUPOS_SUPERIORES = new Set(['peito', 'costas', 'ombros', 'biceps', 'triceps', 'antebraco', 'pescoco', 'toracica']);

  // alongamento estatico (volta a calma) x mobilidade dinamica (aquecimento)
  const RE_ALONGAMENTO = /alongamento|stretch|pose|pombo|sapo|couch|child|pancake|sleeper|joelhos ao peito|figura 4|borboleta|esfinge|liberacao|foam roller/;
  const RE_DINAMICO = /circulo|rotacao|cars|balanco|swing|gato|cat.?cow|dislocat|anjo|wall slide|deslizamento|world|groiner|caminhada|frankenstein|portao|mobilidade|open book|livro aberto|leg swing|bretzel|shin box|90.?90|oito com|frog rock|agachamento profundo/;
  const RE_CHAO = /deitad|ajoelhad|quatro apoios|no chao|pombo|sapo|child|borboleta|esfinge|cobra|prancha|pancake|90.?90|shin box|bretzel|frog|ponte|foam roller|liberacao/;

  function ehAlongamento(ex) {
    const n = semAcento(ex.nome);
    if (ex.categoria === 'alongamento') return true;
    return ex.categoria === 'mobilidade' && RE_ALONGAMENTO.test(n) && !RE_DINAMICO.test(n.replace(/alongamento/g, ''));
  }
  function ehMobilidadeDinamica(ex) {
    if (ex.categoria !== 'mobilidade') return false;
    const n = semAcento(ex.nome);
    return !ehAlongamento(ex) || RE_DINAMICO.test(n);
  }
  /** Exige deitar/ajoelhar (transicao para o chao) — evitar para 65+ quando houver opcao. */
  function exigeChao(ex) {
    return RE_CHAO.test(semAcento(ex.nome)) || aparelhoPrincipal(ex) === 'colchonete' || aparelhoPrincipal(ex) === 'foam_roller';
  }

  // ---------- parametros por objetivo x nivel ----------
  // ex: [min, max] exercicios do bloco principal; series [composto, isolado]; reps/repsIso [min,max];
  // rir [composto, isolado]; descanso [composto, isolado] em segundos; aquec/voltaCalma em minutos;
  // equilibrio: n exercicios de equilibrio por sessao; circuito: null ou formato do bloco final;
  // volume: series/musculo/semana alvo; ciclo: semanas ate o deload (inclusive).

  const PARAMS = {
    hipertrofia: {
      iniciante: { ex: [5, 6], series: [3, 2], reps: [8, 12], repsIso: [10, 15], rir: [2, 3], descanso: [90, 60], aquec: 8, voltaCalma: 1, equilibrio: 0, circuito: null, volume: [8, 12], ciclo: 6 },
      intermediario: { ex: [6, 7], series: [3, 3], reps: [6, 10], repsIso: [10, 15], rir: [1, 2], descanso: [120, 75], aquec: 8, voltaCalma: 1, equilibrio: 0, circuito: null, volume: [12, 16], ciclo: 5 },
      avancado: { ex: [7, 8], series: [4, 3], reps: [6, 10], repsIso: [8, 15], rir: [1, 0], descanso: [150, 75], aquec: 10, voltaCalma: 1, equilibrio: 0, circuito: null, volume: [14, 20], ciclo: 4 },
    },
    condicionamento: {
      iniciante: { ex: [4, 4], series: [2, 2], reps: [10, 15], repsIso: [12, 15], rir: [3, 3], descanso: [60, 45], aquec: 8, voltaCalma: 2, equilibrio: 0, circuito: { formato: 'intervalado', n: 4, rodadas: 3, trabalhoSeg: 30, pausaSeg: 30, pausaRodadaSeg: 60 }, volume: [6, 10], ciclo: 5 },
      intermediario: { ex: [4, 5], series: [3, 2], reps: [8, 12], repsIso: [12, 15], rir: [2, 2], descanso: [75, 45], aquec: 8, voltaCalma: 2, equilibrio: 0, circuito: { formato: 'intervalado', n: 5, rodadas: 4, trabalhoSeg: 40, pausaSeg: 20, pausaRodadaSeg: 60 }, volume: [8, 12], ciclo: 5 },
      avancado: { ex: [5, 5], series: [4, 3], reps: [6, 10], repsIso: [10, 15], rir: [1, 2], descanso: [90, 60], aquec: 10, voltaCalma: 2, equilibrio: 0, circuito: { formato: 'emom', n: 5, rodadas: 4, trabalhoSeg: 45, pausaSeg: 15, pausaRodadaSeg: 60 }, volume: [10, 14], ciclo: 4 },
    },
    perda_peso: {
      iniciante: { ex: [4, 4], series: [2, 2], reps: [12, 15], repsIso: [12, 15], rir: [3, 3], descanso: [45, 45], aquec: 8, voltaCalma: 2, equilibrio: 0, superserie: true, circuito: { formato: 'intervalado', n: 4, rodadas: 3, trabalhoSeg: 30, pausaSeg: 30, pausaRodadaSeg: 60 }, volume: [6, 10], ciclo: 5 },
      intermediario: { ex: [6, 6], series: [3, 3], reps: [10, 15], repsIso: [12, 15], rir: [2, 2], descanso: [45, 45], aquec: 8, voltaCalma: 2, equilibrio: 0, superserie: true, circuito: { formato: 'intervalado', n: 5, rodadas: 3, trabalhoSeg: 40, pausaSeg: 20, pausaRodadaSeg: 60 }, volume: [10, 14], ciclo: 5 },
      avancado: { ex: [6, 6], series: [4, 3], reps: [8, 12], repsIso: [12, 15], rir: [1, 2], descanso: [60, 45], aquec: 8, voltaCalma: 2, equilibrio: 0, superserie: true, circuito: { formato: 'intervalado', n: 5, rodadas: 4, trabalhoSeg: 40, pausaSeg: 20, pausaRodadaSeg: 60 }, volume: [12, 16], ciclo: 4 },
    },
    '50mais': {
      iniciante: { ex: [5, 6], series: [2, 2], reps: [10, 15], repsIso: [12, 15], rir: [3, 3], descanso: [90, 60], aquec: 10, voltaCalma: 2, equilibrio: 2, circuito: null, volume: [6, 10], ciclo: 5 },
      intermediario: { ex: [6, 6], series: [3, 2], reps: [8, 12], repsIso: [10, 15], rir: [2, 3], descanso: [90, 60], aquec: 10, voltaCalma: 2, equilibrio: 2, potencia: true, circuito: null, volume: [8, 12], ciclo: 5 },
      avancado: { ex: [6, 7], series: [3, 3], reps: [6, 10], repsIso: [10, 12], rir: [2, 2], descanso: [120, 75], aquec: 10, voltaCalma: 2, equilibrio: 2, potencia: true, circuito: null, volume: [10, 14], ciclo: 5 },
    },
    raquete: {
      iniciante: { ex: [6, 6], series: [2, 2], reps: [10, 12], repsIso: [12, 15], rir: [3, 3], descanso: [75, 45], aquec: 10, voltaCalma: 2, equilibrio: 0, pliometria: 'nenhuma', contatos: 0, circuito: null, volume: [6, 10], ciclo: 4 },
      intermediario: { ex: [7, 7], series: [3, 2], reps: [6, 10], repsIso: [12, 15], rir: [2, 3], descanso: [120, 45], aquec: 10, voltaCalma: 2, equilibrio: 0, pliometria: 'baixa', contatos: 60, circuito: null, volume: [8, 12], ciclo: 4 },
      avancado: { ex: [7, 8], series: [4, 3], reps: [4, 8], repsIso: [12, 15], rir: [2, 3], descanso: [150, 45], aquec: 12, voltaCalma: 2, equilibrio: 0, pliometria: 'moderada', contatos: 100, circuito: null, volume: [10, 14], ciclo: 4 },
    },
  };

  // variante "forca" (objetivo antigo) dentro de hipertrofia: reps baixas e descanso longo nos compostos
  const VARIANTE_FORCA = { reps: [3, 6], rir: [2, 2], descanso: [210, 90] };

  function parametros(objetivo, nivel, variante) {
    const o = normalizarObjetivo(objetivo);
    const base = PARAMS[o.objetivo][nivelPrograma(nivel)];
    const p = JSON.parse(JSON.stringify(base));
    if ((variante || o.variante) === 'forca') Object.assign(p, VARIANTE_FORCA);
    return p;
  }

  // ---------- modelos de sessao ----------
  // slot: { p: padrao ou etiqueta, tipo: 'composto'|'isolado'|'prevencao'|'potencia'|'agilidade'|'equilibrio', tag?: exige etiqueta }
  const S = (p, tipo = 'composto', extra = {}) => ({ p, tipo, ...extra });

  const MODELOS = {
    // ---- hipertrofia ----
    FB_A: { nome: 'Corpo inteiro A', foco: 'inteiro', slots: [S('agachar'), S('empurrar_h'), S('puxar_v'), S('dobrar_quadril'), S('empurrar_v'), S('puxar_h'), S('gluteo', 'isolado'), S('core', 'isolado'), S('ombro_lateral', 'isolado')] },
    FB_B: { nome: 'Corpo inteiro B', foco: 'inteiro', slots: [S('dobrar_quadril'), S('empurrar_v'), S('puxar_h'), S('agachar', 'composto', { tag: 'unilateral' }), S('empurrar_h'), S('puxar_v'), S('panturrilha', 'isolado'), S('core', 'isolado'), S('biceps', 'isolado')] },
    FB_C: { nome: 'Corpo inteiro C', foco: 'inteiro', slots: [S('agachar'), S('puxar_h'), S('empurrar_h'), S('gluteo'), S('puxar_v'), S('ombro_lateral', 'isolado'), S('triceps', 'isolado'), S('core', 'isolado')] },
    SUP_A: { nome: 'Superior A — peito, costas e ombros', foco: 'superior', slots: [S('empurrar_h'), S('puxar_v'), S('empurrar_v'), S('puxar_h'), S('ombro_lateral', 'isolado'), S('biceps', 'isolado'), S('triceps', 'isolado'), S('ombro_posterior', 'isolado')] },
    SUP_B: { nome: 'Superior B — costas, peito e braços', foco: 'superior', slots: [S('puxar_h'), S('empurrar_h'), S('puxar_v'), S('empurrar_v'), S('peito_iso', 'isolado'), S('ombro_posterior', 'isolado'), S('triceps', 'isolado'), S('biceps', 'isolado')] },
    INF_A: { nome: 'Inferior A — quadríceps e glúteos', foco: 'inferior', slots: [S('agachar'), S('dobrar_quadril'), S('agachar', 'composto', { tag: 'unilateral' }), S('gluteo', 'isolado'), S('panturrilha', 'isolado'), S('core', 'isolado'), S('adutor', 'isolado'), S('agachar', 'isolado')] },
    INF_B: { nome: 'Inferior B — posterior e glúteos', foco: 'inferior', slots: [S('dobrar_quadril'), S('agachar'), S('gluteo'), S('agachar', 'composto', { tag: 'unilateral' }), S('panturrilha', 'isolado'), S('core', 'isolado'), S('dobrar_quadril', 'isolado'), S('adutor', 'isolado')] },
    PUSH: { nome: 'Empurrar — peito, ombro e tríceps', foco: 'superior', slots: [S('empurrar_h'), S('empurrar_v'), S('empurrar_h'), S('ombro_lateral', 'isolado'), S('peito_iso', 'isolado'), S('triceps', 'isolado'), S('triceps', 'isolado'), S('core', 'isolado')] },
    PULL: { nome: 'Puxar — costas e bíceps', foco: 'superior', slots: [S('puxar_v'), S('puxar_h'), S('puxar_h'), S('ombro_posterior', 'isolado'), S('biceps', 'isolado'), S('biceps', 'isolado'), S('puxar_v'), S('core', 'isolado')] },
    LEGS: { nome: 'Pernas e glúteos', foco: 'inferior', slots: [S('agachar'), S('dobrar_quadril'), S('agachar', 'composto', { tag: 'unilateral' }), S('gluteo'), S('adutor', 'isolado'), S('panturrilha', 'isolado'), S('core', 'isolado'), S('dobrar_quadril', 'isolado')] },

    // ---- condicionamento / perda de peso: forca nos grandes padroes + circuito ----
    MC_A: { nome: 'Força + metcon A', foco: 'inteiro', slots: [S('agachar'), S('puxar_h'), S('empurrar_h'), S('dobrar_quadril'), S('carregamento'), S('core', 'isolado')], circuito: ['metabolico', 'agachar', 'puxar_h', 'core', 'cardio'] },
    MC_B: { nome: 'Força + metcon B', foco: 'inteiro', slots: [S('dobrar_quadril'), S('empurrar_v'), S('puxar_v'), S('agachar', 'composto', { tag: 'unilateral' }), S('core', 'isolado'), S('carregamento')], circuito: ['cardio', 'dobrar_quadril', 'empurrar_h', 'metabolico', 'core'] },
    MC_C: { nome: 'Circuito total', foco: 'inteiro', slots: [S('agachar', 'composto', { tag: 'unilateral' }), S('puxar_h'), S('empurrar_h'), S('gluteo'), S('core', 'isolado'), S('carregamento')], circuito: ['metabolico', 'lateral', 'empurrar_v', 'dobrar_quadril', 'cardio', 'core'] },
    PP_A: { nome: 'Superséries + circuito A', foco: 'inteiro', slots: [S('agachar'), S('puxar_h'), S('empurrar_h'), S('dobrar_quadril'), S('gluteo', 'isolado'), S('core', 'isolado')], circuito: ['cardio', 'agachar', 'metabolico', 'core', 'lateral'] },
    PP_B: { nome: 'Superséries + circuito B', foco: 'inteiro', slots: [S('dobrar_quadril'), S('puxar_v'), S('agachar', 'composto', { tag: 'unilateral' }), S('empurrar_v'), S('ombro_lateral', 'isolado'), S('core', 'isolado')], circuito: ['metabolico', 'dobrar_quadril', 'empurrar_h', 'cardio', 'core'] },
    PP_C: { nome: 'Metabólico corpo inteiro', foco: 'inteiro', slots: [S('agachar'), S('puxar_h'), S('gluteo'), S('empurrar_h'), S('carregamento'), S('core', 'isolado')], circuito: ['cardio', 'lateral', 'metabolico', 'puxar_h', 'core'] },

    // ---- 50+ ----
    SR_A: { nome: 'Força funcional A', foco: 'inteiro', slots: [S('agachar'), S('empurrar_h'), S('puxar_h'), S('dobrar_quadril'), S('carregamento'), S('panturrilha', 'isolado'), S('core', 'isolado')] },
    SR_B: { nome: 'Força funcional B', foco: 'inteiro', slots: [S('agachar', 'composto', { tag: 'unilateral' }), S('puxar_v'), S('empurrar_v'), S('gluteo'), S('ombro_posterior', 'isolado'), S('core', 'isolado'), S('carregamento')] },
    SR_C: { nome: 'Força funcional C', foco: 'inteiro', slots: [S('dobrar_quadril'), S('puxar_h'), S('empurrar_h'), S('lateral'), S('panturrilha', 'isolado'), S('manguito', 'prevencao'), S('core', 'isolado')] },
    SR_MOB: { nome: 'Mobilidade, equilíbrio e core', foco: 'inteiro', leve: true, slots: [S('equilibrio', 'equilibrio'), S('mobilidade', 'equilibrio'), S('gluteo', 'isolado'), S('core', 'isolado'), S('equilibrio', 'equilibrio'), S('mobilidade', 'equilibrio'), S('ombro_posterior', 'prevencao')] },

    // ---- raquete ----
    R_INF: { nome: 'Pernas, agilidade e Aquiles', foco: 'inferior', slots: [S('pliometria', 'potencia'), S('agilidade', 'agilidade'), S('agachar', 'composto', { tag: 'unilateral' }), S('dobrar_quadril'), S('lateral'), S('panturrilha', 'prevencao'), S('adutor', 'prevencao'), S('core', 'isolado', { tag: 'anti_movimento' })] },
    R_SUP: { nome: 'Ombro blindado e braço forte', foco: 'superior', slots: [S('rotacional', 'potencia'), S('puxar_h'), S('empurrar_h'), S('puxar_v'), S('manguito', 'prevencao'), S('ombro_posterior', 'prevencao'), S('antebraco', 'prevencao'), S('core', 'isolado')] },
    R_ROT: { nome: 'Rotação, core e equilíbrio', foco: 'inteiro', slots: [S('rotacional', 'potencia'), S('agachar'), S('dobrar_quadril', 'composto', { tag: 'unilateral' }), S('rotacional', 'isolado'), S('equilibrio', 'equilibrio'), S('manguito', 'prevencao'), S('antebraco', 'prevencao'), S('panturrilha', 'prevencao')] },
    R_FB: { nome: 'Corpo inteiro para quadra', foco: 'inteiro', slots: [S('agilidade', 'agilidade'), S('agachar', 'composto', { tag: 'unilateral' }), S('puxar_h'), S('lateral'), S('rotacional', 'potencia'), S('manguito', 'prevencao'), S('antebraco', 'prevencao'), S('panturrilha', 'prevencao')] },
    R_COND: { nome: 'Condicionamento de quadra', foco: 'inteiro', slots: [S('agilidade', 'agilidade'), S('lateral'), S('agachar'), S('puxar_h'), S('core', 'isolado'), S('panturrilha', 'prevencao')], circuito: ['agilidade', 'lateral', 'cardio', 'rotacional', 'core'] },
    R_PRE: { nome: 'Ativação pré-jogo', foco: 'inteiro', leve: true, slots: [S('gluteo', 'prevencao', { tag: 'ativacao' }), S('manguito', 'prevencao'), S('ombro_posterior', 'prevencao'), S('agilidade', 'agilidade'), S('core', 'isolado', { tag: 'anti_movimento' }), S('panturrilha', 'prevencao')] },
  };

  // estrutura semanal: objetivo -> nivel -> dias -> modelos (6 = teto; 7 dias repete o ciclo)
  const SPLITS = {
    hipertrofia: {
      iniciante: { 1: ['FB_A'], 2: ['FB_A', 'FB_B'], 3: ['FB_A', 'FB_B', 'FB_C'], 4: ['SUP_A', 'INF_A', 'SUP_B', 'INF_B'], 5: ['SUP_A', 'INF_A', 'FB_C', 'SUP_B', 'INF_B'], 6: ['SUP_A', 'INF_A', 'FB_C', 'SUP_B', 'INF_B', 'FB_A'] },
      intermediario: { 1: ['FB_A'], 2: ['SUP_A', 'INF_A'], 3: ['INF_A', 'SUP_A', 'FB_C'], 4: ['SUP_A', 'INF_A', 'SUP_B', 'INF_B'], 5: ['PUSH', 'PULL', 'LEGS', 'SUP_B', 'INF_B'], 6: ['PUSH', 'PULL', 'LEGS', 'PUSH', 'PULL', 'LEGS'] },
      avancado: { 1: ['FB_A'], 2: ['SUP_A', 'INF_A'], 3: ['PUSH', 'PULL', 'LEGS'], 4: ['SUP_A', 'INF_A', 'SUP_B', 'INF_B'], 5: ['PUSH', 'PULL', 'LEGS', 'SUP_B', 'INF_B'], 6: ['PUSH', 'PULL', 'LEGS', 'PUSH', 'PULL', 'LEGS'] },
    },
    condicionamento: { todos: { 1: ['MC_A'], 2: ['MC_A', 'MC_B'], 3: ['MC_A', 'MC_B', 'MC_C'], 4: ['MC_A', 'MC_B', 'MC_C', 'MC_A'], 5: ['MC_A', 'MC_B', 'MC_C', 'MC_A', 'MC_B'], 6: ['MC_A', 'MC_B', 'MC_C', 'MC_A', 'MC_B', 'MC_C'] } },
    perda_peso: { todos: { 1: ['PP_A'], 2: ['PP_A', 'PP_B'], 3: ['PP_A', 'PP_B', 'PP_C'], 4: ['PP_A', 'PP_B', 'PP_C', 'PP_A'], 5: ['PP_A', 'PP_B', 'PP_C', 'PP_A', 'PP_B'], 6: ['PP_A', 'PP_B', 'PP_C', 'PP_A', 'PP_B', 'PP_C'] } },
    '50mais': { todos: { 1: ['SR_A'], 2: ['SR_A', 'SR_B'], 3: ['SR_A', 'SR_B', 'SR_C'], 4: ['SR_A', 'SR_B', 'SR_MOB', 'SR_C'], 5: ['SR_A', 'SR_B', 'SR_MOB', 'SR_C', 'SR_MOB'], 6: ['SR_A', 'SR_B', 'SR_MOB', 'SR_C', 'SR_A', 'SR_MOB'] } },
    raquete: { todos: { 1: ['R_FB'], 2: ['R_INF', 'R_SUP'], 3: ['R_INF', 'R_SUP', 'R_ROT'], 4: ['R_INF', 'R_SUP', 'R_COND', 'R_ROT'], 5: ['R_INF', 'R_SUP', 'R_COND', 'R_ROT', 'R_FB'], 6: ['R_INF', 'R_SUP', 'R_COND', 'R_ROT', 'R_FB', 'R_PRE'] } },
  };

  function estruturaSemanal(objetivo, nivel, dias) {
    const o = normalizarObjetivo(objetivo).objetivo;
    const tab = SPLITS[o][nivelPrograma(nivel)] || SPLITS[o].todos;
    const n = Math.max(1, Math.round(dias) || 1);
    const base = tab[Math.min(n, 6)];
    const out = [];
    for (let i = 0; i < n; i++) out.push(base[i % base.length]);
    return out;
  }

  // se o padrao do slot nao tem candidato (ex.: puxada vertical em casa sem barra), tenta estes
  const FALLBACK = {
    puxar_v: ['puxar_h', 'ombro_posterior'], puxar_h: ['puxar_v', 'ombro_posterior'],
    empurrar_v: ['empurrar_h', 'ombro_lateral'], empurrar_h: ['empurrar_v', 'triceps'],
    agachar: ['gluteo', 'lateral', 'dobrar_quadril'], dobrar_quadril: ['gluteo', 'agachar'], gluteo: ['dobrar_quadril', 'agachar'],
    panturrilha: ['agachar'], ombro_lateral: ['empurrar_v', 'ombro_posterior'], ombro_posterior: ['manguito', 'puxar_h'],
    manguito: ['ombro_posterior', 'escapula'], antebraco: ['carregamento', 'biceps'], carregamento: ['antebraco', 'core'],
    rotacional: ['core'], lateral: ['adutor', 'gluteo', 'agachar'], adutor: ['lateral', 'gluteo'],
    agilidade: ['lateral', 'cardio'], pliometria: ['agilidade', 'potencia', 'lateral'], potencia: ['rotacional', 'metabolico', 'dobrar_quadril'],
    metabolico: ['cardio', 'agachar'], cardio: ['metabolico', 'agilidade'], equilibrio: ['unilateral', 'core'],
    biceps: ['puxar_h'], triceps: ['empurrar_h'], peito_iso: ['empurrar_h'], core: ['anti_movimento'],
    mobilidade: ['alongamento'], alongamento: ['mobilidade'], unilateral: ['agachar'],
  };

  // ---------- perfil: idade, sexo, IMC ----------

  /**
   * Transforma o perfil em restricoes e enfases. Tudo aqui e ajuste de seguranca ou preferencia
   * padrao — nunca tira um grupo muscular inteiro da semana.
   */
  function ajustesPerfil({ objetivo, nivel, sexo, idade, peso, altura, enfase } = {}) {
    const o = normalizarObjetivo(objetivo).objetivo;
    const idadeN = Number(idade) || null;
    const imc = peso && altura ? Number(peso) / Math.pow(Number(altura) / 100, 2) : null;
    const a = {
      idade: idadeN, imc: imc ? Math.round(imc * 10) / 10 : null,
      impactoMax: 'alto',           // alto | medio | baixo
      impactoMaxCardio: 'alto',     // so para circuito/cardio/pliometria/agilidade
      excluirRisco: false,          // olimpicos, invertidos, skills
      excluirAparelhos: [],         // ex.: barra fixa/argolas para 65+ (suspender o proprio peso)
      nivelExMax: null,             // teto de nivel do exercicio
      aquecExtra: 0,
      equilibrioMin: 0,
      rirMin: 0,
      repsMin: 0,
      seriesMax: 99,
      descansoExtra: 0,
      enfase: 'neutra',
      notas: [],
    };

    // 50+ (OMS 2020 / NSCA 2019): sem saltos, mais aquecimento, equilibrio sempre presente
    // impacto "medio" = sem fase de voo (corrida estacionaria, swing, escalador); "alto" = saltos
    if (o === '50mais' || (idadeN && idadeN >= 50)) {
      a.impactoMax = 'medio';
      a.impactoMaxCardio = 'medio';
      a.excluirRisco = true;
      a.equilibrioMin = Math.max(a.equilibrioMin, 1);
      if (o !== '50mais') {
        a.aquecExtra += 3;
        a.notas.push('sem saltos e com equilíbrio por causa da idade');
      }
    }
    // o programa 50+ em si e de baixo impacto no cardio, mesmo para quem tem 50 e poucos anos
    if (o === '50mais') {
      a.impactoMaxCardio = 'baixo';
      // no 50+ o exercicio fica no nivel da pessoa (sem a margem de +1 dos outros objetivos)
      a.nivelExMax = Math.min(a.nivelExMax ?? 3, nivelN[nivel] ?? 0);
      if (nivelPrograma(nivel) === 'iniciante') a.excluirAparelhos = ['barra_fixa', 'argolas', 'paralelas'];
    }
    // hipertrofia e perda de peso nao ganham nada com skills/olimpicos/muscle-up: so risco
    if (o === 'hipertrofia' || o === 'perda_peso') a.excluirRisco = true;

    if (idadeN && idadeN >= 65) {
      a.impactoMax = 'baixo';
      a.impactoMaxCardio = 'baixo';
      a.nivelExMax = Math.min(1, nivelN[nivel] ?? 0); // sem margem acima do nivel da pessoa
      a.excluirAparelhos = ['barra_fixa', 'argolas', 'paralelas'];
      a.aquecExtra += 2;
      a.equilibrioMin = 2;        // OMS: multicomponente com equilibrio para 65+
      a.rirMin = 2;
      a.repsMin = 8;
      a.seriesMax = 3;
      a.descansoExtra = 15;
      a.notas.push('versão mais conservadora para 65+');
    } else if (idadeN && idadeN >= 50) {
      a.descansoExtra = 15;
      if (nivelPrograma(nivel) === 'iniciante') a.rirMin = 2;
    }
    if (idadeN && idadeN < 18) {
      a.rirMin = Math.max(a.rirMin, 2);
      a.excluirRisco = true;
      a.notas.push('ajustado para adolescente: técnica antes de carga');
    }

    // IMC alto: articulacoes agradecem menos impacto no cardio/pliometria (ACSM 2009 perda de peso)
    if (a.imc && a.imc >= 30) {
      a.impactoMaxCardio = menorImpacto(a.impactoMaxCardio, 'medio');
      a.impactoMax = menorImpacto(a.impactoMax, 'medio');
      a.notas.push('cardio de baixo impacto para poupar joelhos e tornozelos');
    }
    if (a.imc && a.imc >= 35) a.impactoMaxCardio = 'baixo';

    // Sexo: so muda a ENFASE PADRAO (preferencia mais comum relatada em academia), nao a fisiologia
    // do treino — homens e mulheres respondem ao treino de forca com a mesma logica de
    // series/reps/RIR. Na pratica troca 1 slot por sessao (um isolado de superior por um de
    // gluteo, ou o contrario). Nada e excluido, e quem quiser outra enfase passa `enfase`.
    if (enfase && enfase !== 'auto') a.enfase = enfase;
    else if (sexo === 'f') a.enfase = 'inferiores';
    else if (sexo === 'm') a.enfase = 'superiores';
    return a;
  }

  const ORDEM_IMP = { baixo: 0, medio: 1, alto: 2 };
  const menorImpacto = (x, y) => (ORDEM_IMP[x] <= ORDEM_IMP[y] ? x : y);
  const impactoPermitido = (ex, max) => ORDEM_IMP[impactoDe(ex)] <= ORDEM_IMP[max];

  // ---------- progressao e deload ----------

  function progressao(objetivo, nivel) {
    const o = normalizarObjetivo(objetivo).objetivo;
    const n = nivelPrograma(nivel);
    const ciclo = PARAMS[o][n].ciclo;
    const semanas = [];
    for (let s = 1; s <= ciclo; s++) semanas.push(progressaoSemana(o, n, s));
    return { ciclo, semanas, deload: TEXTO_DELOAD[o] };
  }

  const TEXTO_DELOAD = {
    hipertrofia: 'Semana leve: mesmos exercícios e cargas, metade das séries, parando 3-4 reps antes da falha.',
    condicionamento: 'Semana leve: circuito com 1 rodada a menos e força com metade das séries.',
    perda_peso: 'Semana leve: mantém a frequência (o hábito importa), corta 1/3 do volume e o circuito vira caminhada rápida.',
    '50mais': 'Semana leve: mesmas sessões, 1 série a menos e mais tempo de mobilidade. Mantém o equilíbrio todos os dias.',
    raquete: 'Semana leve (casar com torneio se houver): metade do volume, sem pliometria, mantém manguito e panturrilha.',
  };

  /** O que muda na semana s do ciclo (1-based). Deload sempre na ultima semana do ciclo. */
  function progressaoSemana(objetivo, nivel, s) {
    const o = normalizarObjetivo(objetivo).objetivo;
    const n = nivelPrograma(nivel);
    const ciclo = PARAMS[o][n].ciclo;
    const sem = ((s - 1) % ciclo) + 1;
    if (sem === ciclo) return { semana: sem, tipo: 'deload', seriesFator: 0.5, rirDelta: 2, texto: TEXTO_DELOAD[o] };
    const textos = {
      hipertrofia: n === 'iniciante'
        ? 'Some 1-2 reps por série até o topo da faixa; bateu o topo em todas as séries, sobe a carga (dupla progressão).'
        : sem === ciclo - 1 ? 'Semana de pico: +1 série nos compostos, mesma faixa de reps.' : 'Dupla progressão: +1 rep por série, depois +2-5% de carga.',
      condicionamento: sem === 1 ? 'Aprenda os movimentos do circuito e anote as rodadas.' : `Circuito: +5s de trabalho ou 1 rodada a mais (semana ${sem}). Força: dupla progressão.`,
      perda_peso: sem === 1 ? 'Ritmo confortável, foco em completar.' : `Diminua 5-10s de descanso entre superséries ou some 1 rodada no circuito (semana ${sem}).`,
      '50mais': sem <= 2 ? 'Técnica e controle: só sobe a carga quando as reps saírem fáceis e sem dor.' : 'Some carga pequena (0,5-1 kg) ou 2 reps; no equilíbrio, tire o apoio ou feche os olhos por 5s.',
      raquete: sem === 1 ? 'Base: técnica e excêntrico controlado (3s na descida da panturrilha e do punho).' : `Mais potência: +1 série nos lançamentos e ${n === 'iniciante' ? 'agilidade' : 'pliometria'} um pouco mais rápida (semana ${sem}).`,
    };
    return { semana: sem, tipo: 'progressao', seriesFator: 1, rirDelta: 0, texto: textos[o] };
  }

  /** Recomendacao aerobica semanal (alem das fichas), por objetivo — OMS 2020 / ACSM. */
  function aerobicoRecomendado(objetivo, idade) {
    const o = normalizarObjetivo(objetivo).objetivo;
    const base = {
      hipertrofia: { minutos: [90, 150], texto: '90-150 min/semana de aeróbico leve (zona 2) ajudam a recuperar sem atrapalhar o ganho de massa.' },
      condicionamento: { minutos: [150, 300], texto: '150-300 min/semana de aeróbico moderado, com 1 sessão intervalada.' },
      perda_peso: { minutos: [200, 300], texto: '200-300 min/semana de atividade moderada (caminhada rápida conta) e 8-10 mil passos/dia.' },
      '50mais': { minutos: [150, 300], texto: '150-300 min/semana de aeróbico moderado (OMS), de preferência caminhada, bike ou hidroginástica.' },
      raquete: { minutos: [90, 150], texto: 'Os jogos já contam como aeróbico intervalado; complete com 1-2 sessões leves de 30 min.' },
    }[o];
    if (idade && idade >= 65) return { ...base, texto: base.texto + ' Inclua equilíbrio em pelo menos 3 dias.' };
    return base;
  }

  return {
    NIVEIS, nivelN, nivelPrograma,
    OBJETIVOS, MAPA_LEGADO, normalizarObjetivo, objetivoAerobico,
    PARAMS, parametros, MODELOS, SPLITS, estruturaSemanal, FALLBACK,
    aparelhosDe, aparelhoPrincipal, locaisDe, disponivel, exigeAcademia, SO_ACADEMIA, MAQUINAS,
    EQUIP_CASA_OPCOES, EQUIP_CASA_PADRAO, SEMPRE_EM_CASA, normalizarEquipCasa,
    menorImpacto, impactoDe, impactoPermitido, riscoAlto, ehFormato, padraoDe, tagsDe, afinidade, semAcento,
    grupoMuscular, gruposDe, GRUPOS_VIZINHOS, GRUPOS_SUPERIORES, ehAlongamento, ehMobilidadeDinamica, exigeChao,
    ajustesPerfil, progressao, progressaoSemana, aerobicoRecomendado,
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Programas;
