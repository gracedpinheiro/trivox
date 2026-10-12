#!/usr/bin/env node
/* Extrai os poligonos SVG do corpo (frente/costas) do pacote npm react-body-highlighter (MIT)
   e embute em js/mapa-muscular.js, entre os marcadores
     // <DADOS-GERADOS> ... // </DADOS-GERADOS>
   O resto do modulo (mapeamento PT -> regiao, renderizacao) e escrito a mao e nao e tocado.

   Uso:  node ferramentas/extrair_mapa_muscular.js [caminho/do/pacote]
         (padrao: /home/claude/ext/package)

   Ajustes feitos na extracao (documentados tambem no arquivo gerado):
   - Na vista de FRENTE o pacote chama de "abductors" o poligono da parte INTERNA da coxa
     (virilha) — anatomicamente sao os ADUTORES. Renomeado para "adductor", que e o mesmo nome
     usado pelo pacote na vista de costas. Assim "adductor" existe nas duas vistas.
   - "left-soleus" e "right-soleus" (costas) viram uma unica regiao "soleus".
   - Coordenadas arredondadas para 2 casas (o desenho nao muda; o arquivo fica ~40% menor). */

const fs = require('fs');
const path = require('path');

const PACOTE = process.argv[2] || '/home/claude/ext/package';
const DESTINO = path.join(__dirname, '..', 'js', 'mapa-muscular.js');

const assets = fs.readFileSync(path.join(PACOTE, 'src/assets/index.ts'), 'utf8');
const metadata = fs.readFileSync(path.join(PACOTE, 'src/component/metadata.ts'), 'utf8');
const licenca = fs.readFileSync(path.join(PACOTE, 'LICENSE'), 'utf8').trim();
const pkg = JSON.parse(fs.readFileSync(path.join(PACOTE, 'package.json'), 'utf8'));

// MuscleType.CONSTANTE -> 'nome-da-regiao'
const tipos = {};
for (const m of metadata.matchAll(/^\s*([A-Z_]+):\s*'([a-z-]+)'/gm)) tipos[m[1]] = m[2];

const RENOMEAR = {
  frente: { abductors: 'adductor' },
  costas: { 'left-soleus': 'soleus', 'right-soleus': 'soleus' },
};

function extrairVista(nomeExport, vista) {
  const ini = assets.indexOf(`export const ${nomeExport}`);
  if (ini < 0) throw new Error(`Nao achei ${nomeExport} no pacote`);
  const fimProx = assets.indexOf('export const', ini + 10);
  const bloco = assets.slice(ini, fimProx < 0 ? undefined : fimProx);
  const saida = {};
  const re = /muscle:\s*MuscleType\.([A-Z_]+)\s*,\s*svgPoints:\s*\[([\s\S]*?)\]/g;
  for (const m of bloco.matchAll(re)) {
    let regiao = tipos[m[1]];
    if (!regiao) throw new Error(`MuscleType desconhecido: ${m[1]}`);
    regiao = RENOMEAR[vista][regiao] || regiao;
    const polys = [...m[2].matchAll(/'([^']+)'/g)].map(p =>
      p[1].trim().split(/\s+/).map(n => +(+n).toFixed(2)).join(' '));
    (saida[regiao] = saida[regiao] || []).push(...polys);
  }
  return saida;
}

const dados = { frente: extrairVista('anteriorData', 'frente'), costas: extrairVista('posteriorData', 'costas') };

let maxY = 0;
for (const v of Object.values(dados)) for (const ps of Object.values(v)) for (const p of ps) {
  const nums = p.split(' ').map(Number);
  for (let i = 1; i < nums.length; i += 2) maxY = Math.max(maxY, nums[i]);
}

const comentarioLicenca = licenca.split('\n').map(l => `   ${l}`.trimEnd()).join('\n');
const bloco = `// <DADOS-GERADOS> (nao edite a mao — rode ferramentas/extrair_mapa_muscular.js)
  /* Poligonos do corpo extraidos de ${pkg.name}@${pkg.version} (src/assets/index.ts).
${comentarioLicenca}
  */
  const ALTURA_MAX = ${Math.ceil(maxY)};
  const POLIGONOS = ${JSON.stringify(dados, null, 0)
    .replace(/\],"/g, '],\n    "')
    .replace(/\},"costas"/, '},\n  "costas"')};
  // </DADOS-GERADOS>`;

const atual = fs.readFileSync(DESTINO, 'utf8');
const re = /\/\/ <DADOS-GERADOS>[\s\S]*?\/\/ <\/DADOS-GERADOS>/;
if (!re.test(atual)) throw new Error('Marcadores <DADOS-GERADOS> nao encontrados em ' + DESTINO);
fs.writeFileSync(DESTINO, atual.replace(re, () => bloco));

const contar = v => Object.entries(dados[v]).map(([k, ps]) => `${k}(${ps.length})`).join(' ');
console.log('frente:', contar('frente'));
console.log('costas:', contar('costas'));
console.log('altura max:', maxY, '->', DESTINO);
