# 5. Integração Spotify

**Data:** 16/08/2026

## Pedido

"Coloque integração com Spotify pra músicas." Seguido de: "se for necessário colocamos online"
(reconhecendo de antemão que isso quebra a premissa de app 100% offline nessa tela específica).

## Decisões

- **OAuth Authorization Code + PKCE**, sem client secret — o app é 100% client-side, não há onde
  guardar um segredo com segurança. Client ID é público, cada usuário registra o próprio app
  gratuito em developer.spotify.com.
- **Redirect URI fixo em `http://127.0.0.1:8080/index.html`** — o Spotify exige `127.0.0.1`
  literal, não aceita `localhost`. Bug real identificado e corrigido: se a Grace abrisse o app
  por `localhost:8080`, o Spotify redirecionaria pra `127.0.0.1:8080` — origem diferente do
  ponto de vista do navegador, então o `localStorage` (onde fica o verificador do PKCE) não se
  enxergaria entre as duas. Resolvido normalizando a URL automaticamente no boot do app.
- **Tokens não entram no backup exportável** — são credenciais, não dado de treino. Se o arquivo
  de backup for compartilhado, não vaza acesso à conta Spotify de ninguém. Só o Client ID
  (público) entra no export.
- **Controle de reprodução exige Spotify Premium** (limitação do Spotify, não do app) — conta
  Free só vê "tocando agora". Erros 403/404/401 traduzidos pra mensagem em português explicando
  a causa, em vez de mostrar código HTTP.

## Entregue

- `js/spotify.js` — PKCE, login, troca/renovação de token, controle de player, tradução de erros.
- Card "Spotify" no Perfil (instruções de setup + conectar/desconectar) e widget "tocando agora"
  na tela de execução (play/pause/skip).
- 49 testes (35 de módulo + 14 de UI), incluindo teste do redirect URI batendo com a porta certa.

## O que a Grace ainda precisa fazer

Criar um app gratuito em developer.spotify.com/dashboard, cadastrar a redirect URI acima, colar
o Client ID em Perfil › Spotify. Passo a passo completo no
[README](../README.md#spotify--como-ativar).
