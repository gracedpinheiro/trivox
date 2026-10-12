/* Gera data/ilustracoes/indice.json: exercicio -> ilustracao (imagem gerada por IA, uma por
   movimento + implemento + apoio, igual as chaves de data/figuras_mapa.json).

   Uso:  node ferramentas/indice_ilustracoes.js

   Arquivo de cada combinacao: "<template>__<implemento>__<apoio>.jpg" em data/ilustracoes/.
   Exercicio cuja combinacao ainda nao tem imagem usa a do mesmo movimento (template) com outro
   implemento, se existir; sem nenhuma, o app continua com o boneco vetorial (js/figuras.js). */

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const DIR = path.join(RAIZ, 'data', 'ilustracoes');
const mapa = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data', 'figuras_mapa.json'), 'utf8'));
const base = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data', 'exercicios.json'), 'utf8'));

// implemento "-" (sem implemento padrao) vira "x", para nao colidir com o implemento vazio
const arquivoDe = (chave) => chave.split('|').map((s) => (s === '-' ? 'x' : s)).join('__').replace(/[^a-z0-9_]/gi, '') + '.jpg';
const existentes = new Set(fs.readdirSync(DIR).filter((f) => f.endsWith('.jpg')));

// por template: a primeira imagem existente (qualquer implemento) serve de reserva
const porTemplate = {};
for (const f of existentes) {
  const t = f.split('__')[0];
  if (!porTemplate[t]) porTemplate[t] = f;
}

const indice = {};
let proprias = 0, reserva = 0;
for (const e of base) {
  const x = mapa[e.id];
  if (!x) continue;
  const chave = [x.t, x.p || '', x.a || ''].join('|');
  const f = arquivoDe(chave);
  if (existentes.has(f)) { indice[e.id] = f; proprias++; }
  else if (porTemplate[x.t]) { indice[e.id] = porTemplate[x.t]; reserva++; }
}

fs.writeFileSync(path.join(DIR, 'indice.json'), JSON.stringify(indice));
console.log(`${existentes.size} imagens | exercicios com imagem propria: ${proprias} | com imagem do mesmo movimento: ${reserva} | sem imagem: ${base.length - proprias - reserva}`);
