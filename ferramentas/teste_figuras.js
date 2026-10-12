#!/usr/bin/env node
/* Teste do js/figuras.js:  node ferramentas/teste_figuras.js
   - carrega o modulo como no navegador (script global, via vm)
   - todo exercicio de data/exercicios.json precisa: estar no mapa embutido, ter template existente,
     gerar SVG animado e em quadros, sem aviso de "numero de formas variou" (animacao quebrada)
   - todo valor do campo "aparelho" precisa ter ilustracao com legenda
   - data/figuras_mapa.json e o mapa embutido no js precisam concordar */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAIZ = path.join(__dirname, '..');
const avisos = [];
const ctx = { console: { warn: (...a) => avisos.push(a.join(' ')), log: console.log, error: console.error } };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(RAIZ, 'js/figuras.js'), 'utf8') + '\nthis.Figuras = Figuras;', ctx);
const F = ctx.Figuras;

let falhas = 0;
const ok = (cond, msg) => { if (!cond) { falhas++; console.log('  FALHA:', msg); } };

const base = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data/exercicios.json'), 'utf8'));
const mapaJson = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data/figuras_mapa.json'), 'utf8'));

const porTemplate = {};
let bytes = 0;
const t0 = Date.now();
for (const e of base) {
  const m = F.template(e);
  ok(m.via === 'mapa', `${e.id} fora do mapa (via ${m.via})`);
  ok(F.TEMPLATES[m.t], `${e.id}: template inexistente ${m.t}`);
  ok(mapaJson[e.id] && mapaJson[e.id].t === m.t, `${e.id}: json e js discordam`);
  ok(F.temImagem(e), `${e.id}: temImagem false`);
  const s = F.svg(e, { largura: 240 });
  ok(s.startsWith('<svg') && s.includes('aria-label="Como fazer'), `${e.id}: svg animado invalido`);
  const q = F.svg(e, { quadros: true });
  ok(q.includes('figura-quadros') && (q.match(/<svg/g) || []).length >= 1, `${e.id}: quadros invalidos`);
  bytes += s.length;
  porTemplate[m.t] = (porTemplate[m.t] || 0) + 1;
}
ok(avisos.length === 0, 'avisos de animacao: ' + avisos.slice(0, 5).join(' | '));

const aparelhos = [...new Set(base.map(e => e.aparelho))];
for (const a of aparelhos) {
  const s = F.aparelho(a, { largura: 160 });
  ok(s.includes('<figcaption') && F.APARELHOS[a], `aparelho sem ilustracao/nome: ${a}`);
}

ok(F.template({ id: 'nao_existe', categoria: 'costas', aparelho: 'halteres' }).t === 'remada_curvada', 'fallback por categoria');

console.log(`exercicios: ${base.length} | templates usados: ${Object.keys(porTemplate).length}/${Object.keys(F.TEMPLATES).length} | ` +
  `aparelhos: ${aparelhos.length} | svg medio: ${Math.round(bytes / base.length)} bytes | ${Date.now() - t0} ms`);
console.log(falhas ? `${falhas} falha(s)` : 'OK');
process.exit(falhas ? 1 : 0);
