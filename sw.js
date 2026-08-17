/* Service worker: deixa o app funcionar sem internet (dentro da academia o sinal cai).
   Estrategia: cache-first para o shell, network-first para o resto. */

const VERSAO = 'trivox-v8';

const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/estilo.css',
  './js/dados.js',
  './js/forca.js',
  './js/aerobico.js',
  './js/gamificacao.js',
  './js/pictogramas.js',
  './js/spotify.js',
  './js/ui.js',
  './js/app.js',
  './data/exercicios.json',
  './icons/icone-192.png',
  './icons/icone-512.png',
];

self.addEventListener('install', (ev) => {
  ev.waitUntil(
    caches.open(VERSAO)
      // addAll falha inteiro se um item falhar; adiciona um a um para ser tolerante
      .then((c) => Promise.allSettled(SHELL.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((chaves) => Promise.all(chaves.filter((k) => k !== VERSAO).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

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
