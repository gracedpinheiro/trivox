/* Service worker: deixa o app funcionar sem internet (dentro da academia o sinal cai).
   Estrategia: cache-first para o shell, network-first para o resto. */

const VERSAO = 'trivox-v31';

// unica excecao de origem externa no cache: o SDK do Supabase (ver js/nuvem.js e index.html).
// sem isso, o app ficaria sem sincronizar na nuvem toda vez que abrisse offline, mesmo depois
// de ja ter carregado once — o resto do app nao depende disso pra funcionar.
const ORIGENS_EXTERNAS_PERMITIDAS = ['https://cdn.jsdelivr.net'];

const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/estilo.css',
  './fonts/baloo-2-latin-700-normal.woff2',
  './fonts/baloo-2-latin-800-normal.woff2',
  './fonts/nunito-latin-400-normal.woff2',
  './fonts/nunito-latin-600-normal.woff2',
  './fonts/nunito-latin-700-normal.woff2',
  './fonts/nunito-latin-800-normal.woff2',
  './js/dados.js',
  './js/programas.js',
  './js/forca.js',
  './js/aerobico.js',
  './js/gamificacao.js',
  './js/pictogramas.js',
  './js/mapa-muscular.js',
  './js/figuras.js',
  './js/alarme.js',
  './js/motivacao.js',
  './js/lembretes.js',
  './js/spotify.js',
  './js/zip.js',
  './js/videos.js',
  './js/nuvem.js',
  './js/ui.js',
  './js/app.js',
  './data/exercicios.json',
  './icons/icone-192.png',
  './icons/icone-512.png',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js',
];

self.addEventListener('install', (ev) => {
  ev.waitUntil(
    caches.open(VERSAO)
      // addAll falha inteiro se um item falhar; adiciona um a um para ser tolerante
      .then((c) => Promise.allSettled(SHELL.map((u) => c.add(new Request(u, { cache: 'reload' })))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    caches.keys()
      // trivox-config guarda a configuracao do lembrete diario (ver js/lembretes.js) — nao apagar
      .then((chaves) => Promise.all(chaves.filter((k) => k !== VERSAO && k !== 'trivox-config').map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const origem = new URL(req.url).origin;
  if (origem !== self.location.origin && !ORIGENS_EXTERNAS_PERMITIDAS.includes(origem)) return;

  ev.respondWith(
    caches.match(req).then((cacheada) => {
      const rede = fetch(req)
        .then((resp) => {
          if (resp && resp.ok) {
            const copia = resp.clone();
            caches.open(VERSAO).then((c) => c.put(req, copia));
          }
          return resp;
        })
        .catch(() => cacheada || Response.error());
      // shell responde do cache na hora e atualiza por tras
      return cacheada || rede;
    })
  );
});

// ---------- chamada diaria pro treino (ver js/lembretes.js, camada 3) ----------
// Android + app instalado: o navegador acorda o service worker de tempos em tempos.
// Se ja passou do horario do lembrete, hoje e dia de treino e ainda nao avisou, notifica.

async function verificarLembrete() {
  const c = await caches.open('trivox-config');
  const r = await c.match('./__lembrete.json');
  if (!r) return;
  const cfg = await r.json();
  if (!cfg.ativo) return;
  const agora = new Date();
  const hoje = agora.toLocaleDateString('sv-SE');
  if (!cfg.dias.includes(agora.getDay()) || cfg.treinouEm === hoje || cfg.avisadoEm === hoje) return;
  const [hh, mm] = String(cfg.hora || '18:00').split(':').map(Number);
  if (agora.getHours() * 60 + agora.getMinutes() < hh * 60 + mm) return;
  await self.registration.showNotification(cfg.titulo || 'Hora do treino 💪', {
    body: cfg.corpo || 'Seu treino de hoje está pronto.', tag: 'lembrete-treino',
    icon: 'icons/icone-192.png', badge: 'icons/icone-192.png', vibrate: [300, 120, 300],
  });
  cfg.avisadoEm = hoje;
  await c.put('./__lembrete.json', new Response(JSON.stringify(cfg), { headers: { 'Content-Type': 'application/json' } }));
}

self.addEventListener('periodicsync', (ev) => {
  if (ev.tag === 'lembrete-treino') ev.waitUntil(verificarLembrete().catch(() => {}));
});

// tocar na notificacao abre (ou traz pra frente) o app
self.addEventListener('notificationclick', (ev) => {
  ev.notification.close();
  ev.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((lista) => {
      const aberto = lista.find((c) => 'focus' in c);
      return aberto ? aberto.focus() : self.clients.openWindow('./');
    })
  );
});
