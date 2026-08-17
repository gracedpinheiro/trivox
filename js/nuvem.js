/* Sincronizacao com a nuvem (Supabase) — copia de seguranca contra perda de dados local.
   Motivo de existir: dados sumiram sozinhos de um iPhone, mesmo dia, mesmo icone salvo na tela
   de inicio (ver historico/13-lembrete-de-backup.md). O app continua 100% funcional offline
   sem isso — a nuvem e so uma copia extra que sincroniza quando ha internet, nunca um
   requisito pra treinar ou ver qualquer tela.

   Diferente do resto do projeto, ESTE arquivo depende de uma biblioteca externa
   (@supabase/supabase-js, via CDN — ver index.html e sw.js, que cacheia o arquivo pra
   continuar funcionando offline depois do primeiro carregamento). Decisao deliberada:
   reimplementar na mao o login por link magico do Supabase seria arriscado demais pra uma
   funcionalidade que existe justamente pra ser confiavel — diferente do Spotify (3 endpoints,
   bem documentados, seguro reimplementar), o login do Supabase tem mais peca movel (renovacao
   de token, estado de sessao) que o SDK oficial ja resolve testado.

   A URL e a chave abaixo NAO sao segredo — sao publicas por design (a "anon key" so abre
   portas que as politicas de RLS no banco permitirem: cada pessoa so ve/edita as proprias
   linhas). Compartilhadas entre todo mundo que usa o app (Grace e a familia) — cada pessoa
   se diferencia pelo PROPRIO login (e-mail), nao por uma chave propria, diferente do Spotify. */

const Nuvem = (() => {
  const SUPABASE_URL = 'https://oreffivhrwprhwigmvxm.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yZWZmaXZocndwcmh3aWdtdnhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5ODMzOTIsImV4cCI6MjEwMjU1OTM5Mn0.ZRpG6sIzf46hUaT1KxWB8QpCz75TqvXTZBw3DUeRaHQ';

  let _cliente = null;

  /** null se a biblioteca ainda nao carregou (ex.: primeiro carregamento sem internet). */
  function cliente() {
    if (_cliente) return _cliente;
    if (typeof supabase === 'undefined') return null;
    _cliente = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return _cliente;
  }

  const disponivel = () => !!cliente();

  /** Mesma URL usada no Spotify: local (127.0.0.1) e hospedado, preservando a subpasta. */
  function redirectUri() {
    if (location.hostname === '127.0.0.1' || location.protocol === 'file:') {
      const porta = location.port ? `:${location.port}` : '';
      return `http://127.0.0.1${porta}/index.html`;
    }
    const pasta = location.pathname.replace(/[^/]*$/, '');
    return `${location.origin}${pasta}index.html`;
  }

  // ---------- login por link magico (sem senha) ----------

  async function enviarLinkLogin(email) {
    const c = cliente();
    if (!c) throw new Error('Sem internet — conecte-se pra fazer login.');
    const { error } = await c.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectUri() } });
    if (error) throw new Error(mensagemErro(error));
  }

  /** Alternativa ao link: o mesmo e-mail traz um codigo de 6 digitos, digitado na mao.
      Existe porque no iOS um link de e-mail sempre abre no Safari, nunca direto num app salvo
      na tela de inicio — o codigo funciona em qualquer lugar, sem depender de abrir o Mail. */
  async function verificarCodigo(email, codigo) {
    const c = cliente();
    if (!c) throw new Error('Sem internet — conecte-se pra confirmar o código.');
    const { error } = await c.auth.verifyOtp({ email, token: codigo, type: 'email' });
    if (error) throw new Error(mensagemErro(error));
  }

  async function sessaoAtual() {
    const c = cliente();
    if (!c) return null;
    const { data } = await c.auth.getSession();
    return data.session || null;
  }

  /** Chamado de novo sempre que a sessao muda (login, logout, token renovado sozinho).
      callback(evento, sessao) — os DOIS argumentos, na mesma ordem que o SDK entrega. */
  function aoMudarSessao(callback) {
    const c = cliente();
    if (!c) return;
    c.auth.onAuthStateChange((evento, sessao) => callback(evento, sessao));
  }

  async function sair() {
    const c = cliente();
    if (!c) return;
    await c.auth.signOut();
  }

  // ---------- sincronizacao de dados ----------
  // uma linha por "loja" (mesmo nome usado no Dados local: perfil, fichas, sessoes...) —
  // espelha 1:1 o que ja existe no localStorage, so trocando onde mora. Video fica de fora
  // por enquanto (pesa MB, precisa de Storage do Supabase, nao so uma tabela — ver historico).

  async function enviarDado(loja, valor, userId) {
    const c = cliente();
    if (!c) throw new Error('sem conexão com a nuvem');
    const { error } = await c
      .from('dados_usuario')
      .upsert({ user_id: userId, loja, valor, atualizado_em: new Date().toISOString() }, { onConflict: 'user_id,loja' });
    if (error) throw new Error(mensagemErro(error));
  }

  /** Busca todas as "lojas" salvas na nuvem pro usuario logado. Devolve { loja: valor }. */
  async function buscarTudo(userId) {
    const c = cliente();
    if (!c) throw new Error('sem conexão com a nuvem');
    const { data, error } = await c.from('dados_usuario').select('loja, valor').eq('user_id', userId);
    if (error) throw new Error(mensagemErro(error));
    const mapa = {};
    (data || []).forEach((linha) => { mapa[linha.loja] = linha.valor; });
    return mapa;
  }

  function mensagemErro(error) {
    const msg = error?.message || String(error);
    if (/rate limit|too many/i.test(msg)) return 'Muitos pedidos de login seguidos — espere alguns minutos e tente de novo.';
    if (/invalid/i.test(msg) && /email/i.test(msg)) return 'E-mail inválido.';
    return msg;
  }

  return {
    disponivel, redirectUri,
    enviarLinkLogin, verificarCodigo, sessaoAtual, aoMudarSessao, sair,
    enviarDado, buscarTudo,
  };
})();
