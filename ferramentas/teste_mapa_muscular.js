#!/usr/bin/env node
/* Teste do js/mapa-muscular.js:  node ferramentas/teste_mapa_muscular.js
   - carrega o modulo como no navegador (script global, via vm)
   - todo nome de musculo de data/exercicios.json precisa resolver sem excecao
   - lista os que caem em fallback (palavra-chave), nao-muscular (sem pintura, de proposito)
     e vazio (nao reconhecido -> falha)
   - testa variantes que outros agentes podem usar e a geracao de SVG de todos os exercicios */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAIZ = path.join(__dirname, '..');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(RAIZ, 'js/mapa-muscular.js'), 'utf8') + '\nthis.MapaMuscular = MapaMuscular;', ctx);
const M = ctx.MapaMuscular;

let falhas = 0;
const ok = (cond, msg) => { if (!cond) { falhas++; console.log('  FALHA:', msg); } };

// 1) todos os nomes da base
const base = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data/exercicios.json'), 'utf8'));
const exercicios = Array.isArray(base) ? base : (base.exercicios || Object.values(base));
const usos = new Map();
for (const e of exercicios) for (const campo of ['musculos_primarios', 'musculos_secundarios'])
  for (const m of e[campo] || []) usos.set(m, (usos.get(m) || 0) + 1);

const porVia = { dicionario: [], fallback: [], 'nao-muscular': [], vazio: [] };
for (const nome of [...usos.keys()].sort((a, b) => a.localeCompare(b, 'pt'))) {
  let d;
  try { d = M.diagnostico(nome); } catch (err) { ok(false, `excecao em "${nome}": ${err.message}`); continue; }
  porVia[d.via].push(`${nome} (${usos.get(nome)}x) -> ${d.regioes.join(', ') || '-'}`);
  for (const r of d.regioes) ok(M.REGIOES.includes(r), `"${nome}" -> regiao inexistente "${r}"`);
}
console.log(`\nExercicios na base: ${exercicios.length}`);
console.log(`Nomes distintos de musculo: ${usos.size}`);
for (const [via, itens] of Object.entries(porVia)) {
  console.log(`\n[${via}] ${itens.length}`);
  if (via !== 'dicionario') itens.forEach(i => console.log('   ', i));
}
ok(porVia.vazio.length === 0, `${porVia.vazio.length} nome(s) da base sem regiao reconhecida`);

// 2) variantes esperadas (vocabulario de novos exercicios)
const esperados = {
  'Rotadores externos do ombro': 'back-deltoids', 'Tibial anterior': 'tibialis', 'Glúteo médio': 'abductors',
  'Flexores do punho': 'forearm', 'Adutores': 'adductor', 'Abdutores': 'abductors', 'Serrátil': 'obliques',
  'Romboides': 'upper-back', 'Eretores da espinha': 'lower-back', 'Deltoide anterior': 'front-deltoids',
  'deltóides posteriores': 'back-deltoids', 'GLUTEOS': 'gluteal', 'Quadriceps femoral': 'quadriceps',
  'Isquiotibiais (posterior de coxa)': 'hamstring', 'Bíceps femoral': 'hamstring', 'Panturrilhas': 'calves',
  'Antebraço': 'forearm', 'Manguito rotador': 'back-deltoids', 'Trapézio superior': 'trapezius',
  'Oblíquos internos': 'obliques', 'Peitoral maior (porção clavicular)': 'chest', 'Core': 'abs',
  'Glúteo máximo e médio': 'gluteal', 'Corpo inteiro': 'quadriceps', 'Latíssimo do dorso': 'upper-back',
  'Músculos do pescoço': 'neck', 'Extensores do punho': 'forearm', 'Flexores do quadril': 'quadriceps',
  'Gastrocnêmio e sóleo': 'soleus', 'Rotadores internos do ombro': 'front-deltoids', 'Reto abdominal': 'abs',
  'Deltoide lateral': 'front-deltoids', 'Tríceps braquial': 'triceps', 'Sóleo': 'soleus',
};
console.log('\nVariantes:');
for (const [nome, reg] of Object.entries(esperados)) {
  const d = M.diagnostico(nome);
  const passou = d.regioes.includes(reg);
  ok(passou, `"${nome}" deveria incluir ${reg}, veio [${d.regioes}] via ${d.via}`);
  if (passou) console.log(`   ok  ${nome} -> ${d.regioes.join(', ')} (${d.via})`);
}
for (const nome of ['Cardiovascular', 'Sistema cardiovascular', 'Coração', 'Cardio', 'Equilíbrio']) {
  const d = M.diagnostico(nome);
  ok(d.regioes.length === 0 && d.via === 'nao-muscular', `"${nome}" deveria ser nao-muscular, veio ${d.via}`);
}
for (const lixo of [null, undefined, '', '   ', 42, 'xyz qualquer']) {
  try { ok(Array.isArray(M.regioes(lixo)), `regioes(${lixo}) nao retornou array`); }
  catch (err) { ok(false, `regioes(${JSON.stringify(lixo)}) lancou ${err.message}`); }
}

// 3) SVG de todos os exercicios
let semPintura = [];
for (const e of exercicios) {
  try {
    const html = M.svg(e.musculos_primarios, e.musculos_secundarios, { legenda: true });
    const mini = M.miniatura(e.musculos_primarios);
    ok(html.includes('role="img"') && html.includes('aria-label='), `svg sem acessibilidade: ${e.nome}`);
    ok(/<svg[\s\S]*<svg/.test(html), `svg sem as duas vistas: ${e.nome}`);
    ok(mini.includes('height="56"'), `miniatura com altura errada: ${e.nome}`);
    const pintados = (html.match(/--musculo-primario,#FF4D6D\);stroke/g) || []).length;
    if (!pintados) semPintura.push(`${e.nome} [${(e.musculos_primarios || []).join(', ')}]`);
  } catch (err) { ok(false, `svg("${e.nome}") lancou ${err.message}`); }
}
console.log(`\nExercicios sem nenhum musculo PRINCIPAL pintado: ${semPintura.length}`);
semPintura.forEach(s => console.log('   ', s));
ok(M.svg([], []).includes('role="img"'), 'svg vazio');
ok(M.svg(null, undefined).includes('não informado'), 'svg(null) sem rotulo');

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO OK');
process.exit(falhas ? 1 : 0);
