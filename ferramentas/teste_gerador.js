#!/usr/bin/env node
/* Teste do gerador de fichas (js/programas.js + js/forca.js).

   Uso:
     node ferramentas/teste_gerador.js                  # base atual (data/exercicios.json)
     node ferramentas/teste_gerador.js outra/base.json  # outra base
     node ferramentas/teste_gerador.js --sintetico      # base atual + campos novos (local, objetivos,
                                                        # impacto, aparelho) preenchidos a partir da
                                                        # heuristica — exercita o caminho "campo existe"

   Carrega os scripts num contexto vm, do mesmo jeito que o navegador (globais compartilhados).
   Matriz: 5 objetivos x 3 niveis x 2 locais x sexo f/m x idades 30/55/70 x 2-5 dias, e 3 rotacoes.
   Sai com codigo 1 se alguma regra dura falhar. */

const vm = require('vm');
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const args = process.argv.slice(2);
const sintetico = args.includes('--sintetico');
const arqBase = args.find((a) => !a.startsWith('--')) || path.join(RAIZ, 'data/exercicios.json');

const ctx = vm.createContext({ console });
for (const f of ['js/programas.js', 'js/forca.js']) {
  vm.runInContext(fs.readFileSync(path.join(RAIZ, f), 'utf8'), ctx, { filename: f });
}
const P = vm.runInContext('Programas', ctx);
const Forca = vm.runInContext('Forca', ctx);

let base = JSON.parse(fs.readFileSync(arqBase, 'utf8'));
if (!Array.isArray(base)) base = base.exercicios || Object.values(base)[0];
const temCamposNovos = base.some((e) => Array.isArray(e.local) || Array.isArray(e.objetivos) || e.impacto || e.aparelho);

if (sintetico) {
  // preenche os campos novos com a propria heuristica, mas por outro caminho (campo explicito)
  base = base.map((e) => {
    const objs = ['condicionamento', 'perda_peso', 'hipertrofia', '50mais', 'raquete'].filter((o) => P.afinidade(e, o) >= 2);
    return { ...e, local: P.locaisDe(e), objetivos: objs, impacto: P.impactoDe(e), aparelho: P.aparelhoPrincipal(e) };
  });
}
const porId = new Map(base.map((e) => [e.id, e]));

console.log(`Base: ${path.relative(RAIZ, arqBase)} — ${base.length} exercícios — campos novos: ${temCamposNovos ? 'SIM' : 'não'}${sintetico ? ' (+ sintéticos)' : ''}`);

// ---------- matriz ----------
const OBJETIVOS = ['condicionamento', 'perda_peso', 'hipertrofia', '50mais', 'raquete'];
const NIVEIS = ['iniciante', 'intermediario', 'avancado'];
const LOCAIS = ['academia', 'casa'];
const SEXOS = ['f', 'm'];
const IDADES = [30, 55, 70];
const DIAS = { 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5] };
const BLOCOS = new Set(['aquecimento', 'principal', 'equilibrio', 'circuito', 'volta_calma']);
const ORD = { baixo: 0, medio: 1, alto: 2 };

const falhas = [];
const avisos = {};
const avisar = (k, msg) => { (avisos[k] = avisos[k] || []).push(msg); };
const falhar = (cfg, msg) => falhas.push(`${cfg}: ${msg}`);

const est = {
  planos: 0, fichas: 0, itens: 0,
  principalPorFicha: [], totalPorFicha: [],
  repeticoesSemana: 0, slotsSemana: 0,
  jaccard: { '0-1': [], '0-2': [], '1-2': [], '0-3': [], '3-6': [] },
  aparelhosDistintos: [],
  alongamentos: 0, alongamentosNoAlvo: 0, aquecPorFicha: [], voltaPorFicha: [], aproximacao: 0, fichasForca: 0,
  porObjLocal: {},
};

const jac = (a, b) => {
  const A = new Set(a), B = new Set(b);
  const inter = [...A].filter((x) => B.has(x)).length;
  const uni = new Set([...A, ...B]).size;
  return uni ? inter / uni : 0;
};
const principalIds = (fichas) => fichas.flatMap((f) => f.exercicios.filter((e) => e.bloco === 'principal' || e.bloco === 'circuito').map((e) => e.exId));

/** Aquecimento no início, volta à calma no fim, >= 2 de cada; alongamento mira o que foi treinado. */
function checarBlocos(cfgTxt, nome, itens, cfg) {
  const aq = itens.filter((e) => e.bloco === 'aquecimento');
  const vc = itens.filter((e) => e.bloco === 'volta_calma');
  est.aquecPorFicha.push(aq.length); est.voltaPorFicha.push(vc.length);
  if (aq.length > 4) falhar(cfgTxt, `${nome}: ${aq.length} itens de aquecimento (máx. 4)`);
  if (aq.length < 2) falhar(cfgTxt, `${nome}: só ${aq.length} itens de aquecimento`);
  if (vc.length < 2) falhar(cfgTxt, `${nome}: só ${vc.length} alongamentos na volta à calma`);
  const iAq = itens.map((e) => e.bloco).lastIndexOf('aquecimento');
  const iVc = itens.map((e) => e.bloco).indexOf('volta_calma');
  if (aq.length && itens.slice(0, aq.length).some((e) => e.bloco !== 'aquecimento')) falhar(cfgTxt, `${nome}: aquecimento não está no início`);
  if (vc.length && itens.slice(-vc.length).some((e) => e.bloco !== 'volta_calma')) falhar(cfgTxt, `${nome}: volta à calma não está no fim`);
  if (iAq > iVc && iVc >= 0) falhar(cfgTxt, `${nome}: ordem de blocos`);
  const treinados = new Set(itens.filter((e) => !e.bloco || e.bloco === 'principal').flatMap((e) => P.gruposDe(porId.get(e.exId) || {})));
  for (const it of vc) {
    const ex = porId.get(it.exId);
    est.alongamentos++;
    if (P.gruposDe(ex).some((g) => treinados.has(g))) est.alongamentosNoAlvo++;
    if (!P.ehAlongamento(ex)) falhar(cfgTxt, `${nome}: volta à calma com não-alongamento ${ex.nome}`);
    if (cfg && cfg.idade >= 65 && P.exigeChao(ex)) avisar('chao_65', `${cfgTxt} ${ex.nome}`);
  }
}

function validarPlano(cfgTxt, cfg, res) {
  const { fichas, programa } = res;
  const prm = programa.parametros;
  if (!fichas.length) { falhar(cfgTxt, 'nenhuma ficha'); return; }
  if (fichas.length !== cfg.diasSemana.length) avisar('fichas_a_menos', `${cfgTxt}: ${fichas.length}/${cfg.diasSemana.length}`);

  const restrito50 = cfg.objetivo === '50mais' || cfg.idade >= 50;
  for (const f of fichas) {
    est.fichas++;
    if (typeof f.porque !== 'string' || f.porque.length < 20) falhar(cfgTxt, `ficha "${f.nome}" sem "porque"`);
    if (!cfg.diasSemana.includes(f.diaSemana)) falhar(cfgTxt, `diaSemana inválido ${f.diaSemana}`);
    const principal = f.exercicios.filter((e) => e.bloco === 'principal');
    const leve = P.MODELOS[f.modelo].leve;
    est.principalPorFicha.push(principal.length);
    est.totalPorFicha.push(f.exercicios.length);
    if (!leve) {
      if (principal.length < Math.min(prm.ex[0], P.MODELOS[f.modelo].slots.length)) avisar('principal_abaixo_min', `${cfgTxt} ${f.modelo}: ${principal.length} < ${prm.ex[0]}`);
      if (principal.length > prm.ex[1] + 1) falhar(cfgTxt, `${f.modelo}: ${principal.length} exercícios principais > ${prm.ex[1] + 1}`);
    }
    if (principal.length < 3) falhar(cfgTxt, `${f.modelo}: só ${principal.length} exercícios principais`);
    checarBlocos(cfgTxt, f.modelo, f.exercicios, cfg);
    if (!leve && principal.some((e) => e.tipo === 'composto' && !e.tempoSeg)) {
      est.fichasForca++;
      if (principal.some((e) => /aproxima/.test(e.obs || ''))) est.aproximacao++;
      else falhar(cfgTxt, `${f.modelo}: sem nota de aproximação no 1º composto`);
    }
    if (f.exercicios.length > 22) falhar(cfgTxt, `${f.modelo}: ${f.exercicios.length} itens no total`);
    const ids = f.exercicios.map((e) => e.exId);
    if (new Set(ids).size !== ids.length) falhar(cfgTxt, `${f.modelo}: exercício repetido na mesma ficha`);
    est.aparelhosDistintos.push(new Set(principal.map((e) => P.aparelhoPrincipal(porId.get(e.exId)))).size / Math.max(1, principal.length));

    for (const it of f.exercicios) {
      est.itens++;
      const ex = porId.get(it.exId);
      if (!ex) { falhar(cfgTxt, `exId inexistente ${it.exId}`); continue; }
      // formato compatível com ui.js / app.js
      if (!(Number(it.series) >= 1)) falhar(cfgTxt, `${ex.nome}: series ${it.series}`);
      if (typeof it.reps !== 'string' || !it.reps) falhar(cfgTxt, `${ex.nome}: reps "${it.reps}"`);
      if (!(Number(it.descanso) > 0)) falhar(cfgTxt, `${ex.nome}: descanso ${it.descanso}`);
      if (!(it.rirAlvo >= 0 && it.rirAlvo <= 4)) falhar(cfgTxt, `${ex.nome}: rirAlvo ${it.rirAlvo}`);
      if (it.repsMin !== null && !(it.repsMin > 0 && it.repsMax >= it.repsMin)) falhar(cfgTxt, `${ex.nome}: repsMin/Max ${it.repsMin}/${it.repsMax}`);
      if (!('carga' in it) || !('obs' in it)) falhar(cfgTxt, `${ex.nome}: faltam carga/obs`);
      if (!BLOCOS.has(it.bloco)) falhar(cfgTxt, `${ex.nome}: bloco ${it.bloco}`);
      // local
      if (cfg.local === 'casa') {
        if (P.exigeAcademia(ex)) falhar(cfgTxt, `aparelho de academia em casa: ${ex.nome} (${ex.aparelho || ex.equipamento})`);
        if (Array.isArray(ex.local) && !ex.local.includes('casa')) falhar(cfgTxt, `exercício não marcado para casa: ${ex.nome}`);
      }
      // impacto e risco
      const imp = P.impactoDe(ex);
      if (restrito50 && imp === 'alto') falhar(cfgTxt, `impacto alto para 50+/idade ${cfg.idade}: ${ex.nome}`);
      if (cfg.idade >= 65 && imp !== 'baixo') falhar(cfgTxt, `impacto ${imp} para 65+: ${ex.nome}`);
      if (cfg.objetivo === '50mais' && it.bloco === 'circuito' && imp !== 'baixo') falhar(cfgTxt, `circuito não-baixo impacto no 50+: ${ex.nome}`);
      if (restrito50 && P.riscoAlto(ex)) falhar(cfgTxt, `exercício de risco técnico para 50+: ${ex.nome}`);
      if (cfg.imc >= 30 && imp === 'alto') falhar(cfgTxt, `impacto alto com IMC ${cfg.imc}: ${ex.nome}`);
      if (cfg.nivel === 'iniciante' && (P.nivelN[ex.nivel] ?? 0) > 1) falhar(cfgTxt, `exercício ${ex.nivel} para iniciante: ${ex.nome}`);
    }
  }

  // variedade dentro da semana (principal + circuito)
  const ids = principalIds(fichas);
  est.slotsSemana += ids.length;
  est.repeticoesSemana += ids.length - new Set(ids).size;
}

function gerar(cfg, rotacao) {
  return Forca.gerarPrograma({ ...cfg, base, rotacao });
}

const t0 = Date.now();
for (const objetivo of OBJETIVOS) for (const nivel of NIVEIS) for (const local of LOCAIS)
  for (const sexo of SEXOS) for (const idade of IDADES) for (const nd of Object.keys(DIAS)) {
    const cfg = { objetivo, nivel, local, sexo, idade, diasSemana: DIAS[nd], freqForca: Number(nd) };
    const cfgTxt = `${objetivo}/${nivel}/${local}/${sexo}/${idade}a/${nd}d`;
    const planos = {};
    for (const r of [0, 1, 2, 3, 6]) {
      try {
        planos[r] = gerar(cfg, r);
      } catch (e) {
        falhar(cfgTxt, `rotacao ${r} quebrou: ${e.stack}`);
        continue;
      }
      est.planos++;
      if (r <= 2) validarPlano(`${cfgTxt}/r${r}`, cfg, planos[r]);
    }
    if (planos[0] && planos[1] && planos[2]) {
      const [a, b, c] = [0, 1, 2].map((r) => principalIds(planos[r].fichas));
      est.jaccard['0-1'].push(jac(a, b)); est.jaccard['0-2'].push(jac(a, c)); est.jaccard['1-2'].push(jac(b, c));
      // o app hoje passa rotacao = numero de fichas existentes (0, 3, 6...)
      est.jaccard['0-3'].push(jac(a, principalIds(planos[3].fichas)));
      est.jaccard['3-6'].push(jac(principalIds(planos[3].fichas), principalIds(planos[6].fichas)));
      const k = `${objetivo}/${local}`;
      (est.porObjLocal[k] = est.porObjLocal[k] || []).push(jac(a, b));
    }
  }

// ---------- casos especiais ----------
function caso(nome, fn) {
  try { fn(); } catch (e) { falhas.push(`[${nome}] ${e.stack}`); }
}
caso('deterministico', () => {
  const cfg = { objetivo: 'hipertrofia', nivel: 'intermediario', local: 'academia', diasSemana: [1, 3, 5], base, rotacao: 4 };
  const a = JSON.stringify(Forca.gerarPlano(cfg)), b = JSON.stringify(Forca.gerarPlano(cfg));
  if (a !== b) throw new Error('mesma rotacao gerou fichas diferentes');
});
caso('assinatura antiga', () => {
  const f = Forca.gerarPlano({ objetivo: 'hipertrofia', nivel: 'iniciante', local: 'academia', freqForca: 3, diasSemana: [], base, rotacao: 0 });
  if (!Array.isArray(f) || f.length !== 3) throw new Error(`esperava 3 fichas, veio ${f.length}`);
  if (f.some((x) => x.diaSemana !== null)) throw new Error('sem diasSemana o diaSemana deve ser null');
});
caso('objetivos legados', () => {
  for (const o of ['forca', 'resistencia', 'emagrecimento', 'qualquer_coisa']) {
    const f = Forca.gerarPlano({ objetivo: o, nivel: 'intermediario', local: 'academia', freqForca: 3, base });
    if (!f.length) throw new Error(`${o}: sem fichas`);
    const p = Forca.prescrever(o, base[0]);
    if (!p.series || !p.reps) throw new Error(`${o}: prescrever falhou`);
  }
  const forca = Forca.gerarPrograma({ objetivo: 'forca', nivel: 'avancado', base, freqForca: 3 });
  if (forca.programa.parametros.reps[1] > 6) throw new Error('variante forca não aplicou reps baixas');
  for (const o of Object.keys(Forca.OBJETIVOS)) if (!Forca.prescrever(o, base[0], { nivel: 'iniciante', idade: 70 }).reps) throw new Error(`prescrever ${o}`);
});
caso('elite e parque', () => {
  const f = Forca.gerarPlano({ objetivo: 'hipertrofia', nivel: 'elite', local: 'parque', freqForca: 4, base });
  if (f.length !== 4) throw new Error(`elite/parque: ${f.length} fichas`);
});
caso('raquete dias de jogo', () => {
  const r = Forca.gerarPrograma({ objetivo: 'raquete', nivel: 'avancado', local: 'academia', diasSemana: [1, 2, 4, 5], diasJogo: [3, 6], base, sexo: 'm', idade: 35 });
  for (const f of r.fichas) {
    const esperado = [2, 5].includes(f.diaSemana) ? 'vespera' : 'livre';
    if (f.statusDia !== esperado) throw new Error(`dia ${f.diaSemana}: status ${f.statusDia}`);
    if (esperado === 'vespera') {
      if (f.modelo !== 'R_PRE') throw new Error(`véspera com ${f.modelo}`);
      const plio = f.exercicios.filter((e) => P.tagsDe(porId.get(e.exId)).has('pliometria'));
      if (plio.length) throw new Error(`véspera com pliometria: ${plio.map((e) => e.exId)}`);
    }
  }
  const h = Forca.gerarPrograma({ objetivo: 'hipertrofia', nivel: 'intermediario', diasSemana: [1, 2, 4, 5], diasJogo: [6], base });
  const sexta = h.fichas.find((f) => f.diaSemana === 5);
  if (/INF|LEGS/.test(sexta.modelo)) throw new Error(`hipertrofia com jogo sábado: perna pesada na sexta (${sexta.modelo})`);
});
caso('IMC alto', () => {
  for (const o of OBJETIVOS) for (const local of LOCAIS) {
    const cfg = { objetivo: o, nivel: 'intermediario', local, sexo: 'f', idade: 35, peso: 110, altura: 165, diasSemana: [1, 3, 5] };
    const r = Forca.gerarPrograma({ ...cfg, base });
    validarPlano(`${o}/${local}/IMC40`, { ...cfg, imc: 40 }, r);
    for (const it of r.fichas.flatMap((f) => f.exercicios).filter((e) => e.bloco === 'circuito')) {
      if (P.impactoDe(porId.get(it.exId)) !== 'baixo') throw new Error(`IMC 40, circuito com impacto: ${porId.get(it.exId).nome}`);
    }
  }
});
caso('ênfase por sexo é leve', () => {
  const f = Forca.gerarPrograma({ objetivo: 'hipertrofia', nivel: 'intermediario', local: 'academia', diasSemana: [1, 3, 5], sexo: 'f', base });
  const m = Forca.gerarPrograma({ objetivo: 'hipertrofia', nivel: 'intermediario', local: 'academia', diasSemana: [1, 3, 5], sexo: 'm', base });
  const conta = (r, pads) => r.fichas.flatMap((x) => x.exercicios).filter((e) => e.bloco === 'principal' && pads.includes(e.padrao)).length;
  const sup = ['empurrar_h', 'empurrar_v', 'puxar_h', 'puxar_v', 'ombro_lateral', 'biceps', 'triceps', 'peito_iso', 'ombro_posterior'];
  const inf = ['agachar', 'dobrar_quadril', 'gluteo', 'panturrilha', 'adutor', 'lateral'];
  if (conta(f, sup) < 6 || conta(m, inf) < 5) throw new Error(`ênfase excluiu demais: f sup=${conta(f, sup)} m inf=${conta(m, inf)}`);
  if (!(conta(f, ['gluteo']) > conta(m, ['gluteo']))) throw new Error('ênfase f não aumentou glúteo');
});
caso('variarFicha respeita casa', () => {
  const [f] = Forca.gerarPlano({ objetivo: 'hipertrofia', nivel: 'intermediario', local: 'casa', freqForca: 1, base });
  const { exercicios } = Forca.variarFicha(f, base, { objetivo: 'hipertrofia', local: 'casa', fracao: 1, rotacao: 1 });
  for (const it of exercicios) if (P.exigeAcademia(porId.get(it.exId))) throw new Error(`variarFicha pôs ${porId.get(it.exId).nome} em casa`);
  if (exercicios.length !== f.exercicios.length) throw new Error('variarFicha mudou o número de itens');
});
caso('equipCasa: chaves reais e apelidos antigos', () => {
  const chaves = P.EQUIP_CASA_OPCOES.map((o) => o.chave);
  const reais = new Set(base.map((e) => e.aparelho).filter(Boolean));
  if (reais.size) {
    const fora = chaves.filter((k) => !reais.has(k));
    if (fora.length) avisar('equipCasa_sem_exercicio', fora.join(', '));
  }
  // so peso corporal: nada que peça halter/elastico
  const r = Forca.gerarPrograma({ objetivo: 'hipertrofia', nivel: 'intermediario', local: 'casa', diasSemana: [1, 3, 5], equipCasa: ['peso_corporal'], base });
  for (const it of r.fichas.flatMap((f) => f.exercicios)) {
    const ex = porId.get(it.exId);
    const req = P.aparelhosDe(ex);
    // banco aceita cadeira firme (que toda casa tem) — equivalência documentada em programas.js
    if (!req.every((alts) => alts.some((k) => P.SEMPRE_EM_CASA.includes(k) || k === 'banco'))) throw new Error(`só peso corporal, mas veio ${ex.nome} (${req})`);
  }
  // apelidos antigos aceitos: aneis -> argolas, bike -> bicicleta, rolo_espuma -> foam_roller
  const tem = P.normalizarEquipCasa(['aneis', 'bike', 'rolo_espuma', 'step'], 'casa');
  for (const k of ['argolas', 'bicicleta', 'foam_roller', 'degrau_step']) if (!tem.has(k)) throw new Error(`apelido não virou ${k}`);
  // quem marca bicicleta em casa pode receber exercicio de bicicleta marcado para casa
  const r2 = Forca.gerarPrograma({ objetivo: 'condicionamento', nivel: 'intermediario', local: 'casa', diasSemana: [1, 3, 5], equipCasa: [...P.EQUIP_CASA_PADRAO, 'bike', 'aneis'], base });
  if (!r2.fichas.length) throw new Error('sem fichas com equipCasa ampliado');
});
caso('sessões leves sem salto (todas as vésperas)', () => {
  for (const n of NIVEIS) for (const local of LOCAIS) for (let rot = 0; rot < 6; rot++) {
    const r = Forca.gerarPrograma({ objetivo: 'raquete', nivel: n, local, diasSemana: [0, 1, 2, 3, 4, 5], diasJogo: [2, 6], base, rotacao: rot });
    for (const f of r.fichas.filter((x) => P.MODELOS[x.modelo].leve)) {
      for (const it of f.exercicios) {
        const ex = porId.get(it.exId);
        if (P.impactoDe(ex) === 'alto' || P.tagsDe(ex).has('pliometria')) throw new Error(`${n}/${local}/r${rot} ${f.nome}: ${ex.id} ${ex.nome}`);
      }
    }
  }
});
caso('completarSessao: ficha manual peito+tríceps e pernas', () => {
  const acha = (re, cat) => base.find((e) => re.test(P.semAcento(e.nome)) && (!cat || e.categoria === cat));
  const manual = (exs) => exs.map((e) => ({ exId: e.id, series: 3, reps: '8-12', rirAlvo: 1, descanso: 90, carga: null, obs: '' }));
  const peito = manual([acha(/^supino reto/), acha(/crucifixo/, 'peito'), acha(/triceps pulley|triceps na polia|triceps corda/), acha(/frances/, 'triceps')].filter(Boolean));
  const pernas = manual([acha(/^agachamento livre/), acha(/leg press/), acha(/cadeira extensora/), acha(/mesa flexora/), acha(/panturrilha em pe/)].filter(Boolean));
  if (peito.length < 3 || pernas.length < 4) throw new Error('não achei os exercícios da ficha manual');
  for (const [nome, ficha, esperados] of [['peito+tríceps', peito, ['peito', 'triceps']], ['pernas', pernas, ['quadriceps', 'posterior', 'panturrilha']]]) {
    for (const opts of [{ local: 'academia', idade: 35 }, { local: 'casa', idade: 70, objetivo: '50mais', nivel: 'iniciante' }]) {
      const r = Forca.completarSessao(ficha, { base, ...opts });
      const tag = `${nome}/${opts.local}/${opts.idade}`;
      checarBlocos(`[completarSessao ${tag}]`, nome, r, opts);
      const meio = r.filter((e) => !e.bloco);
      if (meio.length !== ficha.length || meio.some((e, i) => e.exId !== ficha[i].exId)) throw new Error(`${tag}: alterou os itens da ficha`);
      if (ficha.some((e) => e.obs)) throw new Error(`${tag}: mutou a ficha original`);
      if (!/aproxima/.test(meio[0].obs)) throw new Error(`${tag}: sem aproximação no 1º composto`);
      const gruposVc = new Set(r.filter((e) => e.bloco === 'volta_calma').flatMap((e) => P.gruposDe(porId.get(e.exId))));
      const cobre = esperados.filter((g) => gruposVc.has(g));
      if (cobre.length < 2) throw new Error(`${tag}: alongamentos cobrem só ${cobre} de ${esperados} — ${r.filter((e) => e.bloco === 'volta_calma').map((e) => porId.get(e.exId).nome)}`);
      if (opts.local === 'casa') for (const it of r) if (it.bloco && P.exigeAcademia(porId.get(it.exId))) throw new Error(`${tag}: ${porId.get(it.exId).nome} em casa`);
      if (opts.idade >= 65) for (const it of r.filter((e) => e.bloco)) if (P.impactoDe(porId.get(it.exId)) !== 'baixo') throw new Error(`${tag}: impacto em ${porId.get(it.exId).nome}`);
      if (Forca.completarSessao(r, { base, ...opts }) !== r) throw new Error(`${tag}: não é idempotente`);
      console.log(`  completarSessao ${tag}: ${r.filter((e) => e.bloco === 'aquecimento').map((e) => porId.get(e.exId).nome).join(', ')} || ${r.filter((e) => e.bloco === 'volta_calma').map((e) => porId.get(e.exId).nome).join(', ')}`);
    }
  }
  if (Forca.completarSessao([], { base }).length !== 0) throw new Error('lista vazia');
});
caso('progressão e deload', () => {
  for (const o of OBJETIVOS) for (const n of NIVEIS) {
    const pr = P.progressao(o, n);
    if (pr.semanas[pr.semanas.length - 1].tipo !== 'deload') throw new Error(`${o}/${n}: última semana não é deload`);
  }
});

// ---------- relatorio ----------
const media = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
const pct = (v) => `${(v * 100).toFixed(1)}%`;
const dist = (a) => { const c = {}; a.forEach((v) => { c[v] = (c[v] || 0) + 1; }); return Object.entries(c).sort((x, y) => x[0] - y[0]).map(([k, v]) => `${k}:${v}`).join(' '); };

console.log(`\n${est.planos} planos gerados (${est.fichas} fichas validadas, ${est.itens} itens) em ${Date.now() - t0} ms`);
console.log(`Exercícios no bloco principal por ficha: ${dist(est.principalPorFicha)}`);
console.log(`Itens totais por ficha (com aquecimento/circuito/volta à calma): min ${Math.min(...est.totalPorFicha)}, média ${media(est.totalPorFicha).toFixed(1)}, máx ${Math.max(...est.totalPorFicha)}`);
console.log(`Repetição de exercício entre fichas da mesma semana (principal+circuito): ${est.repeticoesSemana}/${est.slotsSemana} = ${pct(est.repeticoesSemana / est.slotsSemana)}`);
console.log(`Aparelhos distintos / exercícios na ficha (principal): média ${pct(media(est.aparelhosDistintos))}`);
console.log('Sobreposição entre rotações (Jaccard dos exercícios da semana; 0% = totalmente diferente):');
for (const [k, v] of Object.entries(est.jaccard)) console.log(`  rotacao ${k}: média ${pct(media(v))}, pior ${pct(Math.max(...v))}`);
console.log('  rotacao 0-1 por objetivo/local:', Object.entries(est.porObjLocal).map(([k, v]) => `${k} ${pct(media(v))}`).join(' | '));
const pctAlvo = est.alongamentosNoAlvo / Math.max(1, est.alongamentos);
console.log(`Aquecimento por ficha: ${dist(est.aquecPorFicha)} | volta à calma por ficha: ${dist(est.voltaPorFicha)}`);
console.log(`Alongamentos que miram um grupo treinado no principal: ${est.alongamentosNoAlvo}/${est.alongamentos} = ${pct(pctAlvo)}`);
console.log(`Fichas de força com nota de aproximação no 1º composto: ${est.aproximacao}/${est.fichasForca}`);
if (pctAlvo < 0.7) falhas.push(`alongamentos no alvo abaixo de 70% (${pct(pctAlvo)})`);
for (const [k, v] of Object.entries(avisos)) {
  console.log(`AVISO ${k}: ${v.length} caso(s). Ex.: ${v.slice(0, 4).join(' ; ')}`);
}
if (media(est.jaccard['0-1']) > 0.4) falhas.push(`rotacao 0 x 1 parecida demais (${pct(media(est.jaccard['0-1']))})`);
if (est.repeticoesSemana / est.slotsSemana > 0.05) falhas.push(`repetição na semana alta (${pct(est.repeticoesSemana / est.slotsSemana)})`);

if (falhas.length) {
  console.log(`\nFALHAS (${falhas.length}):`);
  falhas.slice(0, 40).forEach((f) => console.log('  - ' + f));
  process.exit(1);
}
console.log('\nOK — nenhuma regra dura violada.');
