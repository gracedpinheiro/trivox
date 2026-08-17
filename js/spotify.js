/* Integracao com Spotify — controle de reprodução durante o treino.
   Fluxo: Authorization Code com PKCE (cliente publico, sem client secret — o app roda
   100% no navegador, nao ha onde guardar um secret com seguranca).

   Isso e a UNICA parte do app que exige internet e uma conta Spotify. O resto continua
   funcionando 100% offline. Tambem exige que a propria Grace registre um app gratuito em
   developer.spotify.com/dashboard (o Client ID e por conta, ninguem mais consegue gerar
   um pra ela) e cadastre la a URI de redirecionamento exata que REDIRECT_URI define abaixo.

   Limitacao real do Spotify, nao deste codigo: pausar/tocar/pular exige Spotify Premium.
   Conta Free consegue ver "tocando agora", mas os botoes de controle voltam 403. */

const Spotify = (() => {

  const AUTORIZAR_URL = 'https://accounts.spotify.com/authorize';
  const TOKEN_URL = 'https://accounts.spotify.com/api/token';
  const API = 'https://api.spotify.com/v1';

  const ESCOPOS = [
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing',
  ].join(' ');

  /** URI de redirecionamento: precisa ser cadastrada, EXATAMENTE assim, no painel do Spotify.
   *  Local (servidor.js): 127.0.0.1 e nao "localhost" — e a unica forma que o Spotify aceita
   *  pra apps rodando local. Hospedado (GitHub Pages ou qualquer outro): usa o dominio real,
   *  preservando a subpasta (ex.: username.github.io/trivox/ nao pode virar so github.io/). */
  function redirectUri() {
    if (location.hostname === '127.0.0.1' || location.protocol === 'file:') {
      const porta = location.port ? `:${location.port}` : '';
      return `http://127.0.0.1${porta}/index.html`;
    }
    const pasta = location.pathname.replace(/[^/]*$/, '');
    return `${location.origin}${pasta}index.html`;
  }

  // ---------- PKCE ----------

  function base64url(buffer) {
    const bytes = new Uint8Array(buffer);
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function gerarVerificador() {
    const bytes = new Uint8Array(64);
    crypto.getRandomValues(bytes);
    return base64url(bytes.buffer);
  }

  async function gerarDesafio(verificador) {
    const dados = new TextEncoder().encode(verificador);
    const hash = await crypto.subtle.digest('SHA-256', dados);
    return base64url(hash);
  }

  // ---------- login ----------

  /** Monta a URL de autorização e devolve junto o verificador (guardar antes de redirecionar). */
  async function urlLogin(clientId) {
    const verificador = gerarVerificador();
    const desafio = await gerarDesafio(verificador);
    const estado = gerarVerificador().slice(0, 16);
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri(),
      code_challenge_method: 'S256',
      code_challenge: desafio,
      scope: ESCOPOS,
      state: estado,
    });
    return { url: `${AUTORIZAR_URL}?${params}`, verificador, estado };
  }

  /** Le ?code=...&state=... da URL atual, se houver (chamado no boot do app). */
  function lerCallback() {
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    const state = params.get('state');
    const erro = params.get('error');
    if (!code && !erro) return null;
    return { code, state, erro };
  }

  /** Tira o ?code=... da barra de endereco sem recarregar a pagina. */
  function limparUrl() {
    const url = new URL(location.href);
    url.search = '';
    history.replaceState({}, '', url);
  }

  /** Troca o code por tokens. */
  async function trocarCodigoPorToken({ clientId, code, verificador }) {
    const resp = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri(),
        code_verifier: verificador,
      }),
    });
    if (!resp.ok) throw new Error(await mensagemErro(resp));
    const j = await resp.json();
    return paraTokens(j);
  }

  async function renovarToken({ clientId, refreshToken }) {
    const resp = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });
    if (!resp.ok) throw new Error(await mensagemErro(resp));
    const j = await resp.json();
    // o Spotify as vezes nao devolve um refresh_token novo — mantem o antigo nesse caso
    return { ...paraTokens(j), refreshToken: j.refresh_token || refreshToken };
  }

  function paraTokens(resposta) {
    return {
      accessToken: resposta.access_token,
      refreshToken: resposta.refresh_token,
      expiraEm: Date.now() + (resposta.expires_in - 30) * 1000, // 30s de folga
    };
  }

  const tokenValido = (tokens) => !!(tokens && tokens.accessToken && tokens.expiraEm > Date.now());

  // ---------- player ----------

  async function chamar(caminho, { metodo = 'GET', accessToken, corpo }) {
    const resp = await fetch(`${API}${caminho}`, {
      method: metodo,
      headers: { Authorization: `Bearer ${accessToken}`, ...(corpo ? { 'Content-Type': 'application/json' } : {}) },
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    if (resp.status === 204 || resp.status === 202) return null; // sucesso sem corpo
    if (!resp.ok) throw new Error(await mensagemErro(resp));
    const texto = await resp.text();
    return texto ? JSON.parse(texto) : null;
  }

  async function tocandoAgora(accessToken) {
    const j = await chamar('/me/player/currently-playing', { accessToken });
    if (!j || !j.item) return null;
    return {
      musica: j.item.name,
      artista: (j.item.artists || []).map((a) => a.name).join(', '),
      capa: j.item.album?.images?.[2]?.url || j.item.album?.images?.[0]?.url || null,
      tocando: j.is_playing,
      progressoMs: j.progress_ms,
      duracaoMs: j.item.duration_ms,
    };
  }

  const pausar = (accessToken) => chamar('/me/player/pause', { metodo: 'PUT', accessToken });
  const tocar = (accessToken) => chamar('/me/player/play', { metodo: 'PUT', accessToken });
  const proxima = (accessToken) => chamar('/me/player/next', { metodo: 'POST', accessToken });
  const anterior = (accessToken) => chamar('/me/player/previous', { metodo: 'POST', accessToken });

  /** Traduz os erros mais comuns pra algo que a Grace entenda sem saber o que e um HTTP 403. */
  async function mensagemErro(resp) {
    if (resp.status === 403) return 'Esse controle exige Spotify Premium. Sua conta free consegue ver "tocando agora", mas pausar/pular/tocar precisa de Premium.';
    if (resp.status === 404) return 'Não achei nenhum aparelho com Spotify aberto agora. Abra o Spotify no celular ou computador e toque alguma música antes.';
    if (resp.status === 401) return 'Sessão do Spotify expirada. Conecte de novo.';
    try {
      const j = await resp.json();
      return j.error?.message || j.error_description || `Erro do Spotify (${resp.status})`;
    } catch {
      return `Erro do Spotify (${resp.status})`;
    }
  }

  return {
    redirectUri, urlLogin, lerCallback, limparUrl,
    trocarCodigoPorToken, renovarToken, tokenValido,
    tocandoAgora, pausar, tocar, proxima, anterior,
    gerarVerificador, gerarDesafio, // exportado pra teste
  };
})();
