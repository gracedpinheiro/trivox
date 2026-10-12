/* Mapa muscular — mostra, por imagem, QUAL REGIAO DO CORPO cada exercicio trabalha.
   Dois bonecos (Frente e Costas) em SVG inline, sem rede, sem biblioteca: funciona offline.
   Musculos principais em cor forte, auxiliares em cor clara, resto do corpo neutro.

   Uso:
     MapaMuscular.svg(ex.musculos_primarios, ex.musculos_secundarios, { largura: 240, legenda: true })
     MapaMuscular.miniatura(ex.musculos_primarios)          // ~56px de altura, p/ listas
     MapaMuscular.regioes('Deltóide Anterior')              // ['front-deltoids']
     MapaMuscular.diagnostico('Rotadores externos do ombro')// { regioes, via: 'dicionario'|'fallback'|'nao-muscular'|'vazio' }

   Cores (sobrescreva no CSS do app, ex. em :root):
     --musculo-primario (#FF4D6D)   --musculo-primario-contorno (#E8335A)
     --musculo-secundario (#FFB3C1) --musculo-secundario-contorno (#F590A6)
     --musculo-neutro (#E3E8F4)     --musculo-contorno (#C9D2E6)
     --musculo-texto (#6B7390)

   Regioes (chaves): chest, abs, obliques, biceps, triceps, forearm, neck, head, knees,
   front-deltoids, back-deltoids, trapezius, upper-back, lower-back, gluteal, adductor,
   quadriceps, hamstring, calves, soleus  +  virtuais: tibialis (canela, so frente) e
   abductors (gluteo medio/TFL, desenhado sobre o gluteo nas costas).
   Os poligonos vem do pacote react-body-highlighter (MIT) — ver bloco de dados abaixo. */

const MapaMuscular = (() => {

  // <DADOS-GERADOS> (nao edite a mao — rode ferramentas/extrair_mapa_muscular.js)
  /* Poligonos do corpo extraidos de react-body-highlighter@2.0.5 (src/assets/index.ts).
   MIT License

   Copyright (c) 2020 GV79

   Permission is hereby granted, free of charge, to any person obtaining a copy
   of this software and associated documentation files (the "Software"), to deal
   in the Software without restriction, including without limitation the rights
   to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   copies of the Software, and to permit persons to whom the Software is
   furnished to do so, subject to the following conditions:

   The above copyright notice and this permission notice shall be included in all
   copies or substantial portions of the Software.

   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
   SOFTWARE.
  */
  const ALTURA_MAX = 220;
  const POLIGONOS = {"frente":{"chest":["51.84 41.63 51.02 55.1 57.96 57.96 67.76 55.51 70.61 47.35 62.04 41.63","29.8 46.53 31.43 55.51 40.82 57.96 48.16 55.1 47.76 42.04 37.55 42.04"],
    "obliques":["68.57 63.27 67.35 57.14 58.78 59.59 60 64.08 60.41 83.27 65.71 78.78 66.53 69.8","33.88 78.37 33.06 71.84 31.02 63.27 32.24 57.14 40.82 59.18 39.18 63.27 39.18 83.67"],
    "abs":["56.33 59.18 57.96 64.08 58.37 77.96 58.37 92.65 56.33 98.37 55.1 104.08 51.43 107.76 51.02 84.49 50.61 67.35 51.02 57.14","43.67 58.78 48.57 57.14 48.98 67.35 48.57 84.49 48.16 107.35 44.49 103.67 40.82 91.43 40.82 78.37 41.22 64.49"],
    "biceps":["16.73 68.16 17.96 71.43 22.86 66.12 28.98 53.88 27.76 49.39 20.41 55.92","71.43 49.39 70.2 54.69 76.33 66.12 81.63 71.84 82.86 68.98 78.78 55.51"],
    "triceps":["69.39 55.51 69.39 61.63 75.92 72.65 77.55 70.2 75.51 67.35","22.45 69.39 29.8 55.51 29.8 60.82 22.86 73.06"],
    "neck":["55.51 23.67 50.61 33.47 50.61 39.18 61.63 40 70.61 44.9 69.39 36.73 63.27 35.1 58.37 30.61","28.98 44.9 30.2 37.14 36.33 35.1 41.22 30.2 44.49 24.49 48.98 33.88 48.57 39.18 37.96 39.59"],
    "front-deltoids":["78.37 53.06 79.59 47.76 79.18 41.22 75.92 37.96 71.02 36.33 72.24 42.86 71.43 47.35","28.16 47.35 21.22 53.06 20 47.76 20.41 40.82 24.49 37.14 28.57 37.14 26.94 43.27"],
    "head":["42.45 2.86 40 11.84 42.04 19.59 46.12 23.27 49.8 25.31 54.69 22.45 57.55 19.18 59.18 10.2 57.14 2.45 49.8 0"],
    "adductor":["52.65 110.2 54.29 124.9 60 110.2 62.04 100 64.9 94.29 60 92.65 56.73 104.49","47.76 110.61 44.9 125.31 42.04 115.92 40.41 113.06 39.59 107.35 37.96 102.45 34.69 93.88 39.59 92.24 41.63 99.18 43.67 105.31"],
    "quadriceps":["34.69 98.78 37.14 108.16 37.14 127.76 34.29 137.14 31.02 132.65 29.39 120 28.16 111.43 29.39 100.82 32.24 94.69","63.27 105.71 64.49 100 66.94 94.69 70.2 101.22 71.02 111.84 68.16 133.06 65.31 137.55 62.45 128.57 62.04 111.43","38.78 129.39 38.37 112.24 41.22 118.37 44.49 129.39 42.86 135.1 40 146.12 36.33 146.53 35.51 140","59.59 145.71 55.51 128.98 60.82 113.88 61.22 130.2 64.08 139.59 62.86 146.53","32.65 138.37 26.53 145.71 25.71 136.73 25.71 127.35 26.94 114.29 29.39 133.47","71.84 113.06 73.88 124.08 73.88 140.41 72.65 145.71 66.53 138.37 70.2 133.47"],
    "knees":["33.88 140 34.69 143.27 35.51 147.35 36.33 151.02 35.1 156.73 29.8 156.73 27.35 152.65 27.35 147.35 30.2 144.08","65.71 140 72.24 147.76 72.24 152.24 69.8 157.14 64.9 156.73 62.86 151.02"],
    "calves":["71.43 160.41 73.47 153.47 76.73 161.22 79.59 167.76 78.37 187.76 79.59 195.51 74.69 195.51","24.9 194.69 27.76 164.9 28.16 160.41 26.12 154.29 24.9 157.55 22.45 161.63 20.82 167.76 22.04 188.16 20.82 195.51","72.65 195.1 69.8 159.18 65.31 158.37 64.08 162.45 64.08 165.31 65.71 177.14","35.51 158.37 35.92 162.45 35.92 166.94 35.1 172.24 35.1 176.73 32.24 182.04 30.61 187.35 26.94 194.69 27.35 187.76 28.16 180.41 28.57 175.51 28.98 169.8 29.8 164.08 30.2 158.78"],
    "forearm":["6.12 88.57 10.2 75.1 14.69 70.2 16.33 74.29 19.18 73.47 4.49 97.55 0 100","84.49 69.8 83.27 73.47 80 73.06 95.1 98.37 100 100.41 93.47 89.39 89.8 76.33","77.55 72.24 77.55 77.55 80.41 84.08 85.31 89.8 92.24 101.22 94.69 99.59","6.94 101.22 13.47 90.61 18.78 84.08 21.63 77.14 21.22 71.84 4.9 98.78"]},
  "costas":{"head":["50.64 0 45.96 0.85 40.85 5.53 40.43 12.77 45.11 20 55.74 20 59.15 13.62 59.57 4.68 55.74 1.28"],
    "trapezius":["44.68 21.7 47.66 21.7 47.23 38.3 47.66 64.68 38.3 53.19 35.32 40.85 31.06 36.6 39.15 33.19 43.83 27.23","52.34 21.7 55.74 21.7 56.6 27.23 60.85 32.77 68.94 36.6 64.68 40.43 61.7 53.19 52.34 64.68 53.19 38.3"],
    "back-deltoids":["29.36 37.02 22.98 39.15 17.45 44.26 18.3 53.62 24.26 49.36 27.23 46.38","71.06 37.02 78.3 39.57 82.55 44.68 81.7 53.62 74.89 48.94 72.34 45.11"],
    "upper-back":["31.06 38.72 28.09 48.94 28.51 55.32 34.04 75.32 47.23 71.06 47.23 66.38 36.6 54.04 33.62 41.28","68.94 38.72 71.91 49.36 71.49 56.17 65.96 75.32 52.77 71.06 52.77 66.38 63.4 54.47 66.38 41.7"],
    "triceps":["26.81 49.79 17.87 55.74 14.47 72.34 16.6 81.7 21.7 63.83 26.81 55.74","73.62 50.21 82.13 55.74 85.96 73.19 83.4 82.13 77.87 62.98 73.19 55.74","26.81 58.3 26.81 68.51 22.98 75.32 19.15 77.45 22.55 65.53","72.77 58.3 77.02 64.68 80.43 77.45 76.6 75.32 72.77 68.94"],
    "lower-back":["47.66 72.77 34.47 77.02 35.32 83.4 49.36 102.13 46.81 82.98","52.34 72.77 65.53 77.02 64.68 83.4 50.64 102.13 53.19 83.83"],
    "forearm":["86.38 75.74 91.06 83.4 93.19 94.04 100 106.38 96.17 104.26 88.09 89.36 84.26 83.83","13.62 75.74 8.94 83.83 6.81 93.62 0 106.38 3.83 104.26 12.34 88.51 15.74 82.98","81.28 79.57 77.45 77.87 79.15 84.68 91.06 103.83 93.19 108.94 94.47 104.68","18.72 79.57 22.13 77.87 20.85 84.26 9.36 102.98 6.81 108.51 5.11 104.68"],
    "gluteal":["44.68 99.57 30.21 108.51 29.79 118.72 31.49 125.96 47.23 121.28 49.36 114.89","55.32 99.15 51.06 114.47 52.34 120.85 68.09 125.96 69.79 119.15 69.36 108.51"],
    "adductor":["48.09 122.98 44.68 122.98 41.28 125.53 45.11 144.26 48.51 135.74 48.94 129.36","51.91 122.55 55.74 123.4 59.15 125.96 54.89 144.26 51.91 136.17 51.06 129.36"],
    "hamstring":["28.94 122.13 31.06 129.36 36.6 125.96 35.32 135.32 34.47 150.21 29.36 158.3 28.94 146.81 27.66 141.28 27.23 131.49","71.49 121.7 69.36 128.94 63.83 125.96 65.53 136.6 66.38 150.21 71.06 158.3 71.49 147.66 72.77 142.13 73.62 131.91","38.72 125.53 44.26 145.96 40.43 166.81 36.17 152.77 37.02 135.32","61.7 125.53 63.4 136.17 64.26 153.19 60 166.81 56.17 146.38"],
    "knees":["34.47 153.19 31.06 159.15 33.62 166.38 37.45 162.55","66.38 153.62 62.98 162.98 66.81 166.38 69.36 159.15"],
    "calves":["29.36 160.43 28.51 167.23 24.68 179.57 23.83 192.77 25.53 197.02 28.51 193.19 29.79 180 31.91 171.06 31.91 166.81","37.45 165.11 35.32 167.66 33.19 171.91 31.06 180.43 30.21 191.91 34.04 200 38.72 190.64 39.15 168.94","62.98 165.11 61.28 168.51 61.7 190.64 66.38 199.57 70.64 191.91 68.94 179.57 66.81 170.21","70.64 160.43 72.34 168.51 75.74 179.15 76.6 192.77 74.47 196.6 72.34 193.62 70.64 179.57 68.09 168.09"],
    "soleus":["28.51 195.74 30.21 195.74 33.62 201.7 30.64 220 28.51 213.62 26.81 198.3","69.79 195.74 71.91 195.74 73.62 198.3 71.91 213.19 70.21 219.57 67.23 202.13"]}};
  // </DADOS-GERADOS>

  /* Regioes "virtuais": nao tem poligono proprio, pintam poligonos de outra regiao
     apenas na vista indicada. */
  const VIRTUAIS = {
    tibialis: { frente: ['calves'] },          // tibial anterior: canela, so visivel de frente
    abductors: { costas: ['gluteal'] },        // gluteo medio/minimo + TFL: lateral/alto do quadril
  };

  const CORPO_INTEIRO = ['chest', 'abs', 'obliques', 'front-deltoids', 'back-deltoids', 'biceps',
    'triceps', 'trapezius', 'upper-back', 'lower-back', 'gluteal', 'quadriceps', 'hamstring',
    'adductor', 'calves'];
  const CORE = ['abs', 'obliques', 'lower-back'];
  const DELTOIDES = ['front-deltoids', 'back-deltoids'];
  const MANGUITO = ['back-deltoids', 'upper-back'];
  const PERNAS = ['quadriceps', 'hamstring', 'gluteal', 'adductor', 'calves'];
  const FLEXORES_QUADRIL = ['quadriceps', 'adductor'];
  const NAO_MUSCULAR = null; // marcador: nome valido, mas nao e regiao do corpo (ex. Cardio)

  /* ---------- normalizacao ---------- */
  const semAcento = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  const singular = w => {
    if (w.length > 4 && /[r]es$/.test(w)) return w.slice(0, -2);    // adutores -> adutor
    if (w.length > 3 && /s$/.test(w) && !/ss$/.test(w)) return w.slice(0, -1); // gluteos -> gluteo
    return w;
  };
  function normalizar(nome) {
    return semAcento(String(nome == null ? '' : nome)).toLowerCase()
      .replace(/\([^)]*\)/g, ' ')        // "Quadríceps (VMO)" -> "quadriceps"
      .replace(/[^a-z0-9/+,&]+/g, ' ')
      .replace(/\s+/g, ' ').trim()
      .split(' ').map(singular).join(' ');
  }

  /* ---------- dicionario explicito (chaves passam por normalizar()) ---------- */
  const DIC_BRUTO = {
    // peito
    'Peitoral': ['chest'], 'Peitoral Maior': ['chest'], 'Peitoral Menor': ['chest'],
    'Peitoral Superior': ['chest'], 'Peitoral Médio': ['chest'], 'Peitoral Inferior': ['chest'],
    'Peitoral Interno': ['chest'], 'Peitoral Externo': ['chest'], 'Peitoral Completo': ['chest'],
    'Peito': ['chest'], 'Peitorais': ['chest'],
    // ombro
    'Deltóide Anterior': ['front-deltoids'], 'Deltoide Frontal': ['front-deltoids'],
    'Deltóide Posterior': ['back-deltoids'], 'Posterior': ['back-deltoids'], // na base: "Posterior" = deltoide posterior (remadas)
    'Deltóide Medial': DELTOIDES, 'Deltóide Médio': DELTOIDES, 'Deltóide Lateral': DELTOIDES,
    'Deltóide Anterior e Lateral': DELTOIDES, 'Deltóide': DELTOIDES, 'Deltóides': DELTOIDES,
    'Deltóide Completo': DELTOIDES, 'Ombro': DELTOIDES, 'Ombros': DELTOIDES,
    'Estabilizadores do Ombro': ['front-deltoids', 'back-deltoids', 'upper-back'],
    'Manguito Rotador': MANGUITO, 'Manguito': MANGUITO, 'Rotadores externos': MANGUITO,
    'Rotadores Externos do Ombro': MANGUITO, 'Rotadores Internos do Ombro': ['front-deltoids', 'chest'],
    'Infraespinal': MANGUITO, 'Infraespinhal': MANGUITO, 'Infraespinhoso': MANGUITO,
    'Supraespinal': ['trapezius', 'back-deltoids'], 'Supraespinhoso': ['trapezius', 'back-deltoids'],
    'Subescapular': ['front-deltoids', 'upper-back'], 'Redondo Menor': MANGUITO,
    'Redondo Maior': ['upper-back'],
    // costas
    'Latíssimo': ['upper-back'], 'Latíssimo Externo': ['upper-back'], 'Latíssimo do Dorso': ['upper-back'],
    'Grande Dorsal': ['upper-back'], 'Dorsal': ['upper-back'], 'Dorsais': ['upper-back'],
    'Costas': ['upper-back', 'lower-back', 'trapezius'], 'Costas médias': ['upper-back', 'trapezius'],
    'Costas Superiores': ['upper-back', 'trapezius'],
    'Rombóides': ['upper-back', 'trapezius'], 'Romboides': ['upper-back', 'trapezius'],
    'Trapézio': ['trapezius'], 'Trapézio Superior': ['trapezius'],
    'Trapézio Médio': ['trapezius', 'upper-back'], 'Trapézio Inferior': ['trapezius', 'upper-back'],
    'Elevador da Escápula': ['trapezius', 'neck'], 'Escapular': ['trapezius', 'upper-back'],
    'Escápulas': ['trapezius', 'upper-back'],
    'Coluna Torácica': ['upper-back'], 'Torácica': ['upper-back'],
    'Coluna': ['upper-back', 'lower-back'], 'Coluna completa': ['upper-back', 'lower-back', 'neck'],
    'Coluna Lombar': ['lower-back'], 'Lombar': ['lower-back'], 'Lombares': ['lower-back'],
    'Quadrado Lombar': ['lower-back', 'obliques'],
    'Eretor da Espinha': ['lower-back'], 'Eretores da Espinha': ['lower-back'],
    'Eretores': ['lower-back'], 'Eretor': ['lower-back'],
    'Core Posterior': ['lower-back', 'gluteal'],
    // pescoco
    'Esternocleidomastóideo': ['neck'], 'Escalenos': ['neck'], 'Flexores do Pescoço': ['neck'],
    'Músculos Cervicais': ['neck'], 'Core Cervical': ['neck'], 'Pescoço': ['neck'],
    // braco
    'Bíceps': ['biceps'], 'Biceps': ['biceps'], 'Bíceps Braquial': ['biceps'],
    'Cabeça Longa do Bíceps': ['biceps'], 'Cabeça Curta do Bíceps': ['biceps'],
    'Braquial': ['biceps'], 'Braquiorradial': ['forearm'],
    'Tríceps': ['triceps'], 'Tríceps Longo': ['triceps'], 'Tríceps Lateral': ['triceps'],
    'Tríceps Medial': ['triceps'],
    'Antebraço': ['forearm'], 'Antebraços': ['forearm'], 'Pulsos': ['forearm'], 'Punho': ['forearm'],
    'Flexores do Pulso': ['forearm'], 'Extensores do Pulso': ['forearm'],
    'Flexores do Punho': ['forearm'], 'Extensores do Punho': ['forearm'],
    'Flexores dos Dedos': ['forearm'], 'Extensor dos Dedos': ['forearm'], 'Pegada': ['forearm'],
    'Braços': ['biceps', 'triceps', 'forearm'],
    // core
    'Core': CORE, 'Core Completo': CORE, 'Estabilizadores': CORE, 'Tronco': CORE,
    'Core Rotacional': ['obliques', 'abs'], 'Oblíquos': ['obliques'],
    'Reto Abdominal': ['abs'], 'Reto Abdominal Inferior': ['abs'], 'Abdômen': ['abs'],
    'Abdominais': ['abs'], 'Abdominal': ['abs'],
    'Transverso Abdominal': ['abs', 'obliques'], 'Transverso': ['abs', 'obliques'],
    'Serrátil': ['obliques'], 'Serrátil Anterior': ['obliques'], 'Intercostais': ['obliques'],
    // quadril / gluteo
    'Glúteos': ['gluteal'], 'Glúteo Máximo': ['gluteal'], 'Glúteos Máximo': ['gluteal'],
    'Glúteo': ['gluteal'],
    'Glúteo Médio': ['abductors'], 'Glúteos Médio': ['abductors'], 'Glúteo Mínimo': ['abductors'],
    'Abdutores': ['abductors'], 'Abdutores do Quadril': ['abductors'],
    'Tensor': ['abductors'], 'Tensor da Fáscia Lata': ['abductors'], 'TFL': ['abductors'],
    'IT Band': ['abductors', 'quadriceps'], 'Banda Iliotibial': ['abductors', 'quadriceps'],
    'Trato Iliotibial': ['abductors', 'quadriceps'],
    'Piriforme': ['gluteal'], 'Rotadores do Quadril': ['gluteal'], 'Rotadores': ['gluteal'], // na base: Hip 90/90
    'Estabilizadores do Quadril': ['gluteal', 'abductors'], 'Quadril': ['gluteal', 'adductor'],
    'Adutores': ['adductor'], 'Adutor': ['adductor'], 'Adutores do Quadril': ['adductor'],
    'Flexores do Quadril': FLEXORES_QUADRIL, 'Hip Flexors': FLEXORES_QUADRIL,
    'Iliopsoas': FLEXORES_QUADRIL, 'Psoas': FLEXORES_QUADRIL,
    // pernas
    'Quadríceps': ['quadriceps'], 'Reto Femoral': ['quadriceps'], 'Vasto Medial': ['quadriceps'],
    'Vasto Lateral': ['quadriceps'],
    'Isquiotibiais': ['hamstring'], 'Bíceps Femoral': ['hamstring'], 'Posterior de Coxa': ['hamstring'],
    'Panturrilha': ['calves'], 'Panturrilhas': ['calves'], 'Gastrocnêmio': ['calves'],
    'Sóleo': ['calves', 'soleus'], 'Perôneos': ['calves'], 'Fibulares': ['calves'],
    'Tibial': ['tibialis'], 'Tibial Anterior': ['tibialis'],
    'Tornozelo': ['calves', 'soleus'], 'Ligamentos do tornozelo': ['calves', 'soleus'],
    'Pernas': PERNAS, 'Joelhos': ['knees'], 'Joelho': ['knees'],
    // corpo inteiro
    'Full Body': CORPO_INTEIRO, 'Corpo inteiro': CORPO_INTEIRO, 'Corpo todo': CORPO_INTEIRO,
    // nao sao regioes do corpo -> sem pintura, sem erro
    'Cardio': NAO_MUSCULAR, 'Cardiovascular': NAO_MUSCULAR, 'Sistema cardiovascular': NAO_MUSCULAR,
    'Coração': NAO_MUSCULAR, 'Metabolismo': NAO_MUSCULAR, 'Coordenação': NAO_MUSCULAR, 'Assoalho Pélvico': NAO_MUSCULAR,
    'Equilíbrio': NAO_MUSCULAR, 'Potência': NAO_MUSCULAR, 'Agilidade': NAO_MUSCULAR,
    'Cápsula Articular': NAO_MUSCULAR, 'Mobilidade': NAO_MUSCULAR, 'Flexibilidade': NAO_MUSCULAR,
    'Resistência': NAO_MUSCULAR, 'Propriocepção': NAO_MUSCULAR, 'Respiração': NAO_MUSCULAR,
  };
  const DIC = {};
  for (const [k, v] of Object.entries(DIC_BRUTO)) DIC[normalizar(k)] = v;

  /* ---------- fallback por palavra-chave (ordem importa: especifico antes do generico) ---------- */
  const REGRAS = [
    [/\bbicep femoral|isquio|posterior d[ae] coxa|hamstring|semitendin|semimembran/, ['hamstring']],
    [/\bcadeia posterior/, ['hamstring', 'gluteal', 'lower-back']],
    [/\breto femoral|\bvasto|quadricep|anterior d[ae] coxa|\bquad\b/, ['quadriceps']],
    [/flexor do quadril|iliopsoa|\bpsoa|\biliaco|hip flexor/, FLEXORES_QUADRIL],
    [/rotador.*quadril|piriforme|obturador|estabilizador.*quadril/, ['gluteal']],
    [/\btensor|iliotibial|\bit band|\btfl\b|abdutor|gluteo medio|gluteo minimo|\babductor/, ['abductors']],
    [/\badutor|pectineo|\bgracil|virilha|\badductor/, ['adductor']],
    [/glute|nadega|bumbum/, ['gluteal']],
    [/tibial|canela|\bshin/, ['tibialis']],
    [/\bsoleo/, ['calves', 'soleus']],
    [/panturrilha|gastrocnem|\bgemeo|perone|fibular|\bcalf|\bcalve|tornozelo|aquiles/, ['calves']],
    [/\bjoelho/, ['knees']],
    [/\bcoxa|\bperna|membro inferior|lower body|\bleg\b/, PERNAS],
    [/full body|corpo (inteiro|todo|completo)|total body|global/, CORPO_INTEIRO],
    [/esternocleido|escaleno|cervical|pescoco|\bneck/, ['neck']],
    [/elevador da escapula/, ['trapezius', 'neck']],
    [/trapezio (medio|inferior)/, ['trapezius', 'upper-back']],
    [/trapezio|\btrap\b|\btraps\b/, ['trapezius']],
    [/romboide|rhomboid/, ['upper-back', 'trapezius']],
    [/manguito|\brotador|infraespin|supraespin|subescapular|redondo menor|rotator cuff/, MANGUITO],
    [/redondo maior|latissimo|grande dorsal|\bdorsa|\blat\b|\blats\b/, ['upper-back']],
    [/deltoide anterior|ombro anterior|front delt|deltoide frontal/, ['front-deltoids']],
    [/deltoide posterior|ombro posterior|rear delt/, ['back-deltoids']],
    [/deltoide|\bombro|\bdelt|shoulder/, DELTOIDES],
    [/serratil|intercost/, ['obliques']],
    [/peitoral|\bpeito|\bchest|\bpec/, ['chest']],
    [/eretor|lombar|paravertebra|multifido|lower back/, ['lower-back']],
    [/escapul/, ['trapezius', 'upper-back']],
    [/toracic|\bcosta|\bdorso|upper back|\bback\b/, ['upper-back']],
    [/coluna|espinha|vertebr/, ['upper-back', 'lower-back']],
    [/core posterior/, ['lower-back', 'gluteal']],
    [/obliquo|rotacional|oblique/, ['obliques']],
    [/reto abdominal|transverso|abdom|\babs\b/, ['abs']],
    [/\bcore|estabilizador|\btronco/, CORE],
    [/tricep/, ['triceps']],
    [/bicep|\bbraquial\b/, ['biceps']],
    [/antebraco|braquiorradial|\bpunho|\bpulso|\bdedo|forearm|\bgrip|\bmao\b/, ['forearm']],
    [/\bbraco|\barm\b/, ['biceps', 'triceps', 'forearm']],
    [/quadril|\bhip\b/, ['gluteal', 'adductor']],
  ];
  const NAO_MUSCULAR_RE = /cardio|coraca|metabol|coordenac|equilibri|potencia|agilidade|respira|pulmo|capsula|ligamento|articula|propriocep|mobilidade|flexibilidade|resistencia|explosa|velocidade|reflexo|postura|condicionamento|aerobi/;

  /* Resolve um nome -> { regioes, via }. Nunca lanca excecao. */
  const cache = new Map();
  function diagnostico(nome) {
    const n = normalizar(nome);
    if (cache.has(n)) return cache.get(n);
    let r;
    if (!n) r = { regioes: [], via: 'vazio' };
    else if (n in DIC) r = DIC[n] === NAO_MUSCULAR ? { regioes: [], via: 'nao-muscular' } : { regioes: DIC[n].slice(), via: 'dicionario' };
    else {
      // nome composto: "Deltóide Anterior e Lateral", "Glúteos / Isquios", "Core + Ombros"
      const partes = n.split(/\s*(?:\be\b|\/|\+|,|&)\s*/).filter(Boolean);
      if (partes.length > 1) {
        const prefixo = partes[0].split(' ')[0];
        const set = new Set(); let algum = false;
        for (const p of partes) {
          let d = resolverSimples(p);
          if (!d.regioes.length && !p.startsWith(prefixo)) d = resolverSimples(prefixo + ' ' + p);
          if (d.regioes.length) algum = true;
          d.regioes.forEach(x => set.add(x));
        }
        r = algum ? { regioes: [...set], via: 'fallback' } : resolverSimples(n);
      } else r = resolverSimples(n);
    }
    cache.set(n, r);
    return r;
  }
  function resolverSimples(n) {
    if (n in DIC) return DIC[n] === NAO_MUSCULAR ? { regioes: [], via: 'nao-muscular' } : { regioes: DIC[n].slice(), via: 'dicionario' };
    for (const [re, regs] of REGRAS) if (re.test(n)) return { regioes: regs.slice(), via: 'fallback' };
    if (NAO_MUSCULAR_RE.test(n)) return { regioes: [], via: 'nao-muscular' };
    return { regioes: [], via: 'vazio' };
  }
  const regioes = nome => diagnostico(nome).regioes;

  /* ---------- renderizacao ---------- */
  const VISTAS = [['frente', 'Frente'], ['costas', 'Costas']];
  const VB_H = ALTURA_MAX + 6;
  const VIEWBOX = `-3 -3 106 ${VB_H}`;

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const lista = arr => (Array.isArray(arr) ? arr : arr ? [arr] : []).filter(x => x != null && String(x).trim());

  // conjunto de regioes "fisicas" acesas em cada vista
  function acender(nomes) {
    const porVista = { frente: new Set(), costas: new Set() };
    for (const nome of lista(nomes)) for (const reg of regioes(nome)) {
      if (VIRTUAIS[reg]) {
        for (const [v, alvos] of Object.entries(VIRTUAIS[reg])) alvos.forEach(a => porVista[v].add(a));
      } else for (const v of Object.keys(porVista)) if (POLIGONOS[v][reg]) porVista[v].add(reg);
    }
    return porVista;
  }

  const ESTILO = {
    p: 'fill:var(--musculo-primario,#FF4D6D);stroke:var(--musculo-primario-contorno,#E8335A)',
    s: 'fill:var(--musculo-secundario,#FFB3C1);stroke:var(--musculo-secundario-contorno,#F590A6)',
    n: 'fill:var(--musculo-neutro,#E3E8F4);stroke:var(--musculo-contorno,#C9D2E6)',
  };

  function desenharVista(vista, acesos, attrs) {
    const { p, s } = acesos;
    let polys = '';
    for (const [reg, lista_] of Object.entries(POLIGONOS[vista])) {
      const tipo = p[vista].has(reg) ? 'p' : s[vista].has(reg) ? 's' : 'n';
      for (const pts of lista_) polys += `<polygon points="${pts}" style="${ESTILO[tipo]}" data-regiao="${reg}"/>`;
    }
    return `<svg viewBox="${VIEWBOX}" ${attrs} xmlns="http://www.w3.org/2000/svg"><g stroke-width="0.7" stroke-linejoin="round">${polys}</g></svg>`;
  }

  function rotulo(prim, sec) {
    const P = lista(prim), S = lista(sec).filter(x => !P.includes(x));
    let t = 'Músculos trabalhados';
    if (P.length) t += `. Principais: ${P.join(', ')}`;
    if (S.length) t += `. Auxiliares: ${S.join(', ')}`;
    if (!P.length && !S.length) t += ': não informado';
    return t + '.';
  }

  function svg(primarios, secundarios, opcoes) {
    const o = opcoes || {};
    const largura = Math.max(80, +o.largura || 240);
    const gap = Math.round(largura * 0.06);
    const w = (largura - gap) / 2;
    const h = Math.round(w * VB_H / 106);
    const acesos = { p: acender(primarios), s: acender(secundarios) };
    const fonte = Math.max(10, Math.round(largura / 20));
    const txt = 'color:var(--musculo-texto,#6B7390)';

    const figuras = VISTAS.map(([v, nome]) => `
      <div style="display:flex;flex-direction:column;align-items:center;gap:4px;width:${w}px">
        ${desenharVista(v, acesos, `width="${w}" height="${h}" aria-hidden="true" focusable="false" style="display:block;overflow:visible"`)}
        <span style="font-size:${fonte}px;font-weight:600;letter-spacing:.02em;${txt}">${nome}</span>
      </div>`).join('');

    let legenda = '';
    if (o.legenda) {
      const ponto = (cor, borda) => `<span style="display:inline-block;width:.8em;height:.8em;border-radius:50%;background:${cor};border:1px solid ${borda};margin-right:.35em;vertical-align:-.08em"></span>`;
      legenda = `
      <div aria-hidden="true" style="display:flex;justify-content:center;gap:1.1em;margin-top:8px;font-size:${fonte}px;${txt}">
        <span>${ponto('var(--musculo-primario,#FF4D6D)', 'var(--musculo-primario-contorno,#E8335A)')}Principal</span>
        <span>${ponto('var(--musculo-secundario,#FFB3C1)', 'var(--musculo-secundario-contorno,#F590A6)')}Auxiliar</span>
      </div>`;
    }

    return `<div class="mapa-muscular" role="img" aria-label="${esc(rotulo(primarios, secundarios))}" style="display:inline-flex;flex-direction:column;align-items:center;max-width:100%">
      <div style="display:flex;gap:${gap}px;justify-content:center">${figuras}
      </div>${legenda}
    </div>`;
  }

  function miniatura(primarios, secundarios) {
    const acesos = { p: acender(primarios), s: acender(secundarios) };
    const conta = v => [...acesos.p[v]].reduce((n, r) => n + POLIGONOS[v][r].length, 0);
    const vista = conta('costas') > conta('frente') ? 'costas' : 'frente';
    const h = 56, w = Math.round(h * 106 / VB_H);
    const label = esc(`${rotulo(primarios, secundarios)} Vista de ${vista}.`);
    return desenharVista(vista, acesos,
      `class="mapa-muscular-mini" width="${w}" height="${h}" role="img" aria-label="${label}" style="display:inline-block;vertical-align:middle"`);
  }

  const REGIOES = [...new Set([...Object.keys(POLIGONOS.frente), ...Object.keys(POLIGONOS.costas), ...Object.keys(VIRTUAIS)])];

  return { svg, miniatura, regioes, diagnostico, normalizar, REGIOES, POLIGONOS, VIRTUAIS };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = MapaMuscular;
