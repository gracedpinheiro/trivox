# 7. Hospedagem — GitHub Pages

**Data:** 17/08/2026

## Pedido

"Vamos precisar de GitHub, Supabase, Flutter, ou outro?"

## Diagnóstico

O código só existia no computador da Grace, sem controle de versão (repositório `git` local com
zero commits) e sem backup. Perguntado o plano de uso: **só celular, na academia — sem
computador**. Isso muda o requisito de "GitHub seria bom ter" pra "GitHub Pages é necessário":
hoje o app só funciona no celular se o computador estiver ligado rodando `node servidor.js` na
mesma wifi (`README.md` original). Sem o computador por perto na academia, isso não funciona.

## Decisões

- **GitHub Pages**, não Supabase nem Flutter. O app já é 100% estático (HTML/CSS/JS puro, sem
  build) — GitHub Pages hospeda de graça, sem servidor, sem mudança de arquitetura. Ela acessa a
  URL uma vez com internet, instala na tela de início, e a partir daí funciona offline (o
  service worker já cacheia tudo) — nunca mais precisa do computador ligado.
- **Supabase descartado por ora**: ela usa um único aparelho (o celular), não há necessidade de
  sincronizar dados entre dispositivos nem fazer login. Se um dia ela quiser prescrever pra
  alunos de verdade ou usar computador+celular juntos, aí sim entra Supabase — a estrutura de
  dados (perfis namespaced) já está pronta pra isso desde o ciclo 1.
- **Flutter descartado**: reescreveria o app do zero em outra linguagem, jogando fora todo o
  trabalho em JS, e ela não pediu distribuição nas lojas oficiais.

## Ajuste técnico necessário

`Spotify.redirectUri()` estava fixo em `http://127.0.0.1:PORTA/index.html` (só funciona no
servidor local de desenvolvimento). Corrigido pra detectar o ambiente: continua usando
`127.0.0.1` quando rodando localmente (exigência do próprio Spotify pra apps locais — não aceita
"localhost"), e passa a usar o domínio real (`location.origin` + subpasta) quando hospedado em
qualquer lugar, GitHub Pages incluído. Confirmado que `index.html`, `manifest.json` e `sw.js` já
usavam caminhos relativos — funcionam sob subpasta sem ajuste.

## Entregue

- `.gitignore`, identidade git local configurada, primeiro commit.
- `Spotify.redirectUri()` funciona tanto local quanto hospedado (2 testes novos).
- 300/300 testes passando.

## Pendente

Grace vai criar o repositório em github.com e passar a URL — a partir daí, configuro o remote,
empurro o código e habilito o GitHub Pages.
