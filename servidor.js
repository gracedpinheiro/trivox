/* Servidor local minimo, so com o que ja vem no Node.
   Serve para duas coisas: o navegador nao bloquear a leitura do exercicios.json
   e o service worker poder registrar (ele so funciona em http, nunca em file://).

   Uso:  node servidor.js       depois abra  http://localhost:8080          */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORTA = process.env.PORTA || 8080;
const RAIZ = __dirname;

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
};

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const alvo = path.normalize(path.join(RAIZ, url === '/' ? 'index.html' : url));

  // impede sair da pasta do app via ../
  if (!alvo.startsWith(RAIZ)) {
    res.writeHead(403).end('Fora do diretório do app');
    return;
  }

  fs.readFile(alvo, (erro, conteudo) => {
    if (erro) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Não encontrado: ' + url);
      return;
    }
    res.writeHead(200, {
      'Content-Type': TIPOS[path.extname(alvo).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    }).end(conteudo);
  });
}).listen(PORTA, () => {
  console.log(`\n  App de treino rodando em  http://localhost:${PORTA}\n`);
  console.log('  No celular, na mesma rede wi-fi, use o IP deste computador');
  console.log(`  (ex.: http://192.168.0.10:${PORTA}) — descubra com "ipconfig".\n`);
  console.log('  Ctrl+C para parar.\n');
});
