/* Ligacao entre as telas e os dados.
   Toda interacao passa por delegacao de eventos: os handlers ficam aqui,
   o HTML so declara data-acao / data-campo. */

(async function iniciar() {
  // O Spotify exige redirect_uri em 127.0.0.1 (nao aceita "localhost"). Se a pagina foi aberta
  // por localhost:8080, normaliza pra 127.0.0.1:8080 ANTES de qualquer coisa — assim o
  // localStorage (onde fica o verificador do PKCE) e sempre da mesma origem, do inicio ao fim
  // do login. Sem isso, o login quebraria silenciosamente pra quem digita "localhost" na barra.
  if (location.hostname === 'localhost') {
    location.replace(location.href.replace('//localhost', '//127.0.0.1'));
    return;
  }

  UI.aplicarTema(); // tema + cor da barra do celular

  const app = document.getElementById('app');

  // ---------- carrega base e perfil ----------

  try {
    const base = await Dados.exercicios();
    UI.setBase(base);
    // ilustracoes geradas (uma por movimento): sem o indice, "Como fazer" usa o boneco vetorial
    try { UI.setIlustracoes(await fetch('./data/ilustracoes/indice.json').then((r) => (r.ok ? r.json() : {}))); } catch (e) { /* offline sem cache: boneco */ }
  } catch (e) {
    app.innerHTML = `
      <div class="nota atencao" style="margin-top:40px">
        <strong>Não consegui carregar a base de exercícios</strong>
        ${location.protocol === 'file:'
          ? 'O navegador bloqueia leitura de arquivos locais quando a página é aberta com duplo clique. Rode <code>node servidor.js</code> na pasta do app e abra <code>http://localhost:8080</code>.'
          : 'Verifique se o arquivo data/exercicios.json está na pasta.'}
      </div>`;
    console.error(e);
    return;
  }

  if (!Dados.perfilAtivoId()) Dados.criarPerfil('Eu');
  await Dados.carregarFotos(); // fotos no IndexedDB (migra as antigas do localStorage)

  /** Perfis e backups antigos: objetivo legado (forca, resistencia, emagrecimento) vira o novo
   *  de vez, para os chips do Perfil e do gerador mostrarem o certo. "elite" e "parque" o motor
   *  ja entende (ver UI.perfilTreino) — ficam como estao. */
  function migrarPerfilAntigo() {
    const p = Dados.perfil();
    const novo = !Forca.OBJETIVOS[p.objetivo] && Programas.MAPA_LEGADO[p.objetivo];
    if (novo) Dados.salvarPerfil({ objetivo: novo });
  }
  migrarPerfilAntigo();

  // Pede ao navegador pra tratar o armazenamento deste site como "persistente" — reduz a chance
  // dele ser limpo automaticamente sob pouco espaço (aconteceu de verdade num iPhone: dados
  // sumiram sozinhos no mesmo dia, mesmo icone, sem nenhuma acao da pessoa). Nao garante 100%,
  // principalmente no Safari/iOS onde o efeito e mais limitado — por isso o lembrete de backup
  // na tela inicial continua sendo a defesa principal, esta e so uma camada a mais.
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }

  // volta do link de login da nuvem (o SDK le e limpa o #access_token sozinho ao iniciar):
  // precisa ser lido ANTES, senao o app acha que "ja estava logado" e nao restaura nada
  const veioDoLinkNuvem = /access_token=|token_hash=/.test(location.hash + location.search);

  // ---------- volta do login do Spotify ----------

  const callback = Spotify.lerCallback();
  if (callback) {
    Spotify.limparUrl();
    const sp = Dados.spotify();
    if (callback.erro) {
      Dados.salvarSpotify({ pkceVerificador: null, pkceEstado: null });
    } else if (callback.state !== sp.pkceEstado) {
      console.warn('[spotify] state nao bate, ignorando callback');
    } else {
      try {
        const tokens = await Spotify.trocarCodigoPorToken({ clientId: sp.clientId, code: callback.code, verificador: sp.pkceVerificador });
        Dados.salvarSpotify({ ...tokens, pkceVerificador: null, pkceEstado: null });
      } catch (e) {
        alert('Não consegui conectar ao Spotify: ' + e.message);
      }
    }
  }

  // ---------- nuvem (Supabase): sessao ja existente, antes do 1o desenho pra nao "piscar" ----------

  let sessaoNuvem = null;
  if (Nuvem.disponivel()) {
    try { sessaoNuvem = await Nuvem.sessaoAtual(); } catch (e) { console.warn('[nuvem] sessao', e); }
  }
  UI.estado.nuvem.sessao = sessaoNuvem;

  // treino que estava em andamento quando o app fechou/recarregou: volta para "continuar"
  UI.estado.execucao = Dados.execucaoSalva();

  UI.render();

  // ---------- chamada diaria pro treino (ver js/lembretes.js) ----------

  function checarLembrete() {
    try {
      const hoje = new Date().toLocaleDateString('sv-SE');
      const ficha = Dados.fichas().find((f) => f.diaSemana === new Date().getDay() && (f.exercicios || []).length);
      Lembretes.verificar({ perfil: Dados.perfil(), jaTreinouHoje: Dados.diasTreinados().includes(hoje), nomeFicha: ficha ? ficha.nome : '' });
    } catch (e) { console.warn('[lembrete]', e); }
  }
  setTimeout(checarLembrete, 3000);
  setInterval(checarLembrete, 60000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checarLembrete();
      // voltou pro app: o loop de tempo recalcula pelo horario (descanso/cronometro certos)
      if (est.execucao?.descansando || est.execucao?.timerItem || est.crono.rodando) { garantirLoop(); tick(); }
    }
  });
  if (Dados.perfil().lembreteAtivo) Lembretes.sincronizarComSW(Dados.perfil());

  // ---------- service worker ----------

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('[sw]', e));
  }

  // ---------- nuvem (Supabase): sincronizacao continua ----------
  // 100% opcional — sem login, nada aqui roda, e o app funciona exatamente como antes.
  // Existe so pra nao repetir a perda de dados do historico/13: quando ha login, toda vez que
  // uma "loja" e salva localmente, sobe uma copia pra nuvem tambem (com debounce, pra nao
  // martelar a rede a cada tecla digitada).

  const filaPushNuvem = new Map(); // loja -> timeoutId

  const pendentesNuvem = new Set(); // lojas cujo envio falhou (sem rede): reenviadas quando der

  /** Sobe o valor ATUAL da loja (nao o da hora em que entrou na fila). */
  function enviarLojaAgora(loja) {
    if (!sessaoNuvem) return; // saiu da conta durante a espera
    Nuvem.enviarDado(loja, Dados.lerLoja(loja), sessaoNuvem.user.id)
      .then(() => {
        pendentesNuvem.delete(loja);
        UI.estado.nuvem.pendentes = pendentesNuvem.size;
        Dados.registrarEnvioNuvem();
      })
      .catch((e) => {
        pendentesNuvem.add(loja);
        UI.estado.nuvem.pendentes = pendentesNuvem.size;
        console.warn('[nuvem] falha ao enviar', loja, e);
      });
  }

  function enfileirarPushNuvem(loja) {
    if (!sessaoNuvem) return;
    clearTimeout(filaPushNuvem.get(loja));
    filaPushNuvem.set(loja, setTimeout(() => {
      filaPushNuvem.delete(loja);
      enviarLojaAgora(loja);
    }, 2500));
  }

  /** Esvazia a fila na hora: o app indo para segundo plano (o iOS pode suspender antes dos
   *  2,5 s) e a internet voltando (reenvia o que falhou). */
  function esvaziarFilaNuvem() {
    for (const [loja, t] of filaPushNuvem) { clearTimeout(t); filaPushNuvem.delete(loja); enviarLojaAgora(loja); }
    for (const loja of [...pendentesNuvem]) enviarLojaAgora(loja);
  }
  document.addEventListener('visibilitychange', esvaziarFilaNuvem);
  window.addEventListener('online', esvaziarFilaNuvem);

  Dados.aoSalvar((loja, valor) => {
    if (Dados.LOJAS_SINCRONIZAVEIS.includes(loja)) enfileirarPushNuvem(loja, valor);
  });

  /** So roda 1x por login de verdade (nao a cada abertura do app) — decide entre nuvem e local
   *  sem apagar nada por acidente. Ver historico/15 pra o raciocinio completo. */
  async function sincronizarAoLogar(sessao) {
    try {
      const remoto = await Nuvem.buscarTudo(sessao.user.id);
      const remotoTemDados = !!(remoto.perfil?.nome || remoto.fichas?.length || remoto.sessoes?.length);
      const p = Dados.perfil();
      const localTemDados = !!(p.nome || Dados.fichas().length || Dados.sessoes().length);

      const restaurarDaNuvem = () => {
        Dados.LOJAS_SINCRONIZAVEIS.forEach((loja) => {
          if (remoto[loja] !== undefined) Dados.gravarLoja(loja, remoto[loja]);
        });
        migrarPerfilAntigo();
      };
      const semearNuvem = () => {
        Dados.LOJAS_SINCRONIZAVEIS.forEach((loja) => enfileirarPushNuvem(loja, Dados.lerLoja(loja)));
      };

      if (remotoTemDados && !localTemDados) {
        restaurarDaNuvem();
        alert('Encontrei seus dados salvos na nuvem — restaurei tudo aqui.');
      } else if (remotoTemDados && localTemDados) {
        if (confirm('Encontrei dados salvos na nuvem de uma sessão anterior.\n\nUsar os dados da nuvem? Isso substitui o que está neste aparelho agora.\n\n(Cancelar mantém o que está aqui e atualiza a nuvem com isso.)')) {
          restaurarDaNuvem();
        } else {
          semearNuvem();
        }
      } else if (!remotoTemDados && localTemDados) {
        semearNuvem();
      }
      Dados.registrarBackupFeito(); // login com sincronizacao tambem conta como "ha copia por fora"
      UI.render();
    } catch (e) {
      console.warn('[nuvem] falha ao sincronizar apos login', e);
    }
  }

  if (Nuvem.disponivel()) {
    let jaSincronizou = !!sessaoNuvem; // ja carregou logada: nao repete a comparacao agora...
    // ...exceto se acabou de voltar do link do e-mail: ai e um login de verdade (aparelho novo,
    // dados apagados) e precisa comparar/restaurar ja, antes de qualquer gravacao local subir
    if (sessaoNuvem && veioDoLinkNuvem) sincronizarAoLogar(sessaoNuvem);
    Nuvem.aoMudarSessao((_evento, sessao) => {
      const tinhaAntes = !!sessaoNuvem;
      sessaoNuvem = sessao;
      UI.estado.nuvem.sessao = sessao;
      if (!sessao) jaSincronizou = false; // saiu: o proximo login (mesmo outra conta) compara de novo
      if (sessao && !tinhaAntes && !jaSincronizou) {
        jaSincronizou = true;
        sincronizarAoLogar(sessao);
      } else {
        UI.render();
      }
    });
  }

  // ---------- helpers ----------

  const est = UI.estado;

  function fichaAtual() {
    return Dados.acharFicha(est.fichaId);
  }

  function atualizarItem(indice, mudancas) {
    const f = fichaAtual();
    if (!f) return;
    const itens = [...f.exercicios];
    if (!itens[indice]) return;
    itens[indice] = { ...itens[indice], ...mudancas };
    Dados.atualizarFicha(f.id, { exercicios: itens });
  }

  const naoVazio = (v) => (v === '' || v === null || v === undefined ? null : v);

  // ---------- fotos (perfil e evolucao) ----------
  // guardadas como dataURL direto no localStorage — nao ha servidor. Por isso toda foto
  // passa por um redimensionamento + compressao antes de salvar (senao a cota estoura rapido).

  function escolherArquivoImagem() {
    return new Promise((resolve) => {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = 'image/*';
      inp.addEventListener('change', () => resolve(inp.files?.[0] || null), { once: true });
      inp.click();
    });
  }

  /** Redimensiona (maior lado <= maxLado) e recomprime como JPEG antes de virar dataURL. */
  function comprimirImagem(arquivo, { maxLado = 800, qualidade = 0.78 } = {}) {
    return new Promise((resolve, reject) => {
      if (!arquivo || !arquivo.type.startsWith('image/')) { reject(new Error('Selecione um arquivo de imagem.')); return; }
      const leitor = new FileReader();
      leitor.onerror = () => reject(new Error('Não consegui ler esse arquivo.'));
      leitor.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Não consegui abrir essa imagem.'));
        img.onload = () => {
          let w = img.naturalWidth, h = img.naturalHeight;
          if (Math.max(w, h) > maxLado) {
            const escala = maxLado / Math.max(w, h);
            w = Math.round(w * escala);
            h = Math.round(h * escala);
          }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', qualidade));
        };
        img.src = leitor.result;
      };
      leitor.readAsDataURL(arquivo);
    });
  }

  // ---------- cronometro de descanso ----------
  // um setInterval so, guardado aqui fora do UI (que so cuida de render).

  // Um loop so (4x por segundo) cuida de tudo que tem tempo: descanso entre series, exercicio
  // por tempo (aquecimento/alongamento) e a tela de cronometro. Tudo e calculado pelo HORARIO
  // de termino (Date.now), nao contando ticks — assim, se o celular travar a tela ou o navegador
  // pausar o app em segundo plano, ao voltar o tempo esta certo e o alarme dispara na hora.
  // O loop se desliga sozinho quando nada esta contando.

  let loopId = null;
  const bipado = {}; // evita bipar duas vezes no mesmo segundo
  const garantirLoop = () => { if (!loopId) loopId = setInterval(tick, 250); };
  const iniciarTimer = garantirLoop;
  const pararTimer = () => {}; // compatibilidade: navegar nao para mais o descanso

  function contagem(chave, r) {
    if (r >= 1 && r <= 3 && bipado[chave] !== r) { bipado[chave] = r; Alarme.tique(); }
  }

  /** Atualiza so o numero e o anel do relogio, sem redesenhar a tela. */
  function atualizarVisor(id, restante, total) {
    const el = document.getElementById(id);
    if (!el) return;
    const min = Math.floor(restante / 60), seg = restante % 60;
    el.textContent = `${min}:${String(seg).padStart(2, '0')}`;
    el.classList.toggle('acabando', restante <= 3);
    const anel = document.getElementById(id + '-anel');
    if (anel && total) {
      const c = Number(anel.dataset.c);
      anel.setAttribute('stroke-dashoffset', (c * (1 - Math.max(0, Math.min(1, restante / total)))).toFixed(1));
    }
  }

  function tick() {
    let algo = false;
    const agora = Date.now();
    const ex = est.execucao;

    if (ex && ex.descansando) {
      algo = true;
      const r = Math.ceil((ex.fimDescanso - agora) / 1000);
      if (r <= 0) {
        Alarme.fim();
        Alarme.notificar('Descanso acabou ⏱️', 'Bora pra próxima série 💪', { tag: 'descanso' });
        terminarDescanso();
      } else { contagem('descanso', r); atualizarVisor('descanso-timer', r, ex.descansoTotal); }
    }

    if (ex && ex.timerItem) {
      algo = true;
      const r = Math.ceil((ex.timerItem.ate - agora) / 1000);
      if (r <= 0) {
        ex.timerItem = null;
        Alarme.fim();
        Alarme.notificar('Tempo! ⏱️', 'Pode passar pro próximo.', { tag: 'item' });
        if (est.tela === 'execucao') UI.render();
      } else { contagem('item', r); atualizarVisor('item-timer', r, ex.timerItem.total); }
    }

    const c = est.crono;
    if (c.rodando) {
      algo = true;
      if (c.modo === 'cronometro') {
        const el = document.getElementById('crono-visor');
        if (el) el.innerHTML = UI.formatarMs((c.acumulado || 0) + agora - c.inicio);
      } else {
        const r = Math.ceil((c.ate - agora) / 1000);
        const iv = c.intervalo;
        const totalFase = c.modo === 'timer' ? c.total : (iv.fase === 'trabalho' ? iv.trabalho : iv.descanso);
        if (r > 0) { contagem('crono', r); atualizarVisor('crono-visor', r, totalFase); }
        else if (c.modo === 'timer') {
          c.rodando = false; c.pausadoRestante = null;
          Alarme.fim();
          Alarme.notificar('Tempo esgotado ⏱️', 'Seu timer terminou.', { tag: 'crono' });
          if (est.tela === 'cronometro') UI.render();
        } else {
          // intervalado: trabalho -> descanso -> proxima rodada
          if (iv.fase === 'trabalho' && iv.descanso > 0 && iv.rodada < iv.rodadas) {
            iv.fase = 'descanso'; c.ate = agora + iv.descanso * 1000; Alarme.troca();
          } else if (iv.rodada >= iv.rodadas) {
            c.rodando = false; c.pausadoRestante = null; iv.fase = 'trabalho'; iv.rodada = 1;
            Alarme.fim();
            Alarme.notificar('Intervalado concluído 🎉', 'Mandou bem!', { tag: 'crono' });
          } else {
            iv.rodada++; iv.fase = 'trabalho'; c.ate = agora + iv.trabalho * 1000; Alarme.troca();
          }
          if (est.tela === 'cronometro') UI.render();
        }
      }
    }

    if (!algo) { clearInterval(loopId); loopId = null; }
  }

  /** Fim do descanso: avanca pro proximo set ou proximo exercicio; se acabou tudo, finaliza. */
  function terminarDescanso() {
    const ex = est.execucao;
    if (!ex) return;
    ex.descansando = false;
    const item = ex.itens[ex.iEx];
    if (item.sets.length >= item.seriesAlvo) {
      if (ex.iEx + 1 >= ex.itens.length) { finalizarTreino(); return; }
      ex.iEx++;
    }
    Dados.salvarExecucao(ex);
    if (est.tela === 'execucao') UI.render();
  }

  /** Avanca pro proximo item do treino (ou finaliza, se era o ultimo). */
  function proximoItem() {
    const ex = est.execucao;
    if (!ex) return;
    ex.timerItem = null;
    ex.descansando = false;
    if (ex.iEx + 1 >= ex.itens.length) { finalizarTreino(); return; }
    ex.iEx++;
    Dados.salvarExecucao(ex);
    window.scrollTo(0, 0);
    UI.render();
  }

  /** Maior numero de sessoes feitas numa mesma semana (semana comecando domingo). */
  function calcularMaxSessoesSemana(sessoes) {
    const porSemana = {};
    sessoes.forEach((s) => {
      const d = new Date(s.data);
      const inicioAno = new Date(d.getFullYear(), 0, 1);
      const chave = `${d.getFullYear()}-${Math.floor((Math.floor((d - inicioAno) / 864e5) + inicioAno.getDay()) / 7)}`;
      porSemana[chave] = (porSemana[chave] || 0) + 1;
    });
    return Math.max(0, ...Object.values(porSemana));
  }

  const detectarRecorde = (itens) => itens.some((i) => i.recordeAnterior > 0 && i.sets.some((s) => (Number(s.carga) || 0) > i.recordeAnterior));
  const detectarQuebraPlato = (itens) => itens.some((i) => i.platoAntes && i.sets.some((s) => (Number(s.carga) || 0) > (i.ultimaCargaAntes || 0)));

  // ---------- spotify ----------

  /** Devolve um access token valido, renovando com o refresh token se tiver vencido. */
  async function tokenSpotifyValido() {
    const sp = Dados.spotify();
    if (!sp.accessToken) return null;
    if (Spotify.tokenValido(sp)) return sp.accessToken;
    if (!sp.refreshToken) return null;
    try {
      const novos = await Spotify.renovarToken({ clientId: sp.clientId, refreshToken: sp.refreshToken });
      Dados.salvarSpotify(novos);
      return novos.accessToken;
    } catch (e) {
      console.warn('[spotify] falha ao renovar token', e);
      return null;
    }
  }

  let spotifyIntervalo = null;
  const pararSpotify = () => { if (spotifyIntervalo) { clearInterval(spotifyIntervalo); spotifyIntervalo = null; } };

  async function atualizarTocandoAgora() {
    const token = await tokenSpotifyValido();
    const el = document.getElementById('spotify-widget');
    if (!token || !el) return;
    try {
      const info = await Spotify.tocandoAgora(token);
      UI.renderSpotifyWidget(info);
    } catch (e) {
      // silencioso — nao interrompe o treino por causa de musica
      console.warn('[spotify]', e.message);
    }
  }

  function iniciarSpotify() {
    pararSpotify();
    if (!Dados.spotify().refreshToken) return;
    atualizarTocandoAgora();
    spotifyIntervalo = setInterval(atualizarTocandoAgora, 15000);
  }

  // ---------- video do exercicio ----------
  // IndexedDB e assincrono; a tela ja renderiza um placeholder (ver ui.js) e este helper
  // preenche por cima quando o video chega, igual o widget do Spotify.

  let videoObjectUrlAtual = null;

  function carregarVideoExercicio(exId) {
    if (!Videos.suportado()) return;
    Videos.lerVideo(exId).then((registro) => {
      if (videoObjectUrlAtual) { URL.revokeObjectURL(videoObjectUrlAtual); videoObjectUrlAtual = null; }
      if (registro && registro.blob) {
        videoObjectUrlAtual = URL.createObjectURL(registro.blob);
        UI.renderVideoExercicio(exId, videoObjectUrlAtual);
      } else {
        UI.renderVideoExercicio(exId, null);
      }
    }).catch((e) => {
      console.warn('[video]', e);
      UI.renderVideoExercicio(exId, null);
    });
  }

  // ---------- backup (.zip = dados em json + videos) ----------
  // video nao cabe dentro do json (pesa MB, e base64 ainda infla ~33% em cima disso), entao o
  // backup vira um .zip: backup.json (mesma estrutura de sempre) + videos/<exId>.<ext> por
  // fora. Sem compressao real (metodo STORE) porque video/foto ja vem comprimido — recomprimir
  // de novo so gastaria bateria por um ganho quase nulo. Ver js/zip.js.

  const EXT_POR_TIPO_VIDEO = { 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm', 'video/x-matroska': 'mkv', 'video/3gpp': '3gp' };
  const extensaoVideo = (tipo) => EXT_POR_TIPO_VIDEO[tipo] || 'bin';

  /** Monta o pacote (dados + manifesto de video) e devolve o .zip pronto pra baixar. */
  async function montarBackupZip() {
    const pacote = Dados.exportar();
    const videos = Videos.suportado() ? await Videos.listarTodos() : [];

    pacote.videos = {};
    const arquivos = [];
    for (const v of videos) {
      const nomeArquivo = `videos/${v.exId}.${extensaoVideo(v.blob.type)}`;
      pacote.videos[v.exId] = { arquivo: nomeArquivo, tipo: v.blob.type || 'video/mp4', atualizadoEm: v.atualizadoEm };
      arquivos.push({ nome: nomeArquivo, dados: new Uint8Array(await v.blob.arrayBuffer()) });
    }

    arquivos.unshift({ nome: 'backup.json', dados: new TextEncoder().encode(JSON.stringify(pacote, null, 2)) });
    return Zip.criar(arquivos);
  }

  /** Le um .zip de backup e restaura dados + videos. Devolve quantos videos vieram e quantos existiam no manifesto. */
  /** Le o arquivo (.zip novo ou .json antigo) e valida, SEM gravar nada: assim um arquivo errado
   *  e recusado antes da pergunta "vai substituir seus dados?". */
  async function lerBackup(arquivo) {
    const cabecalho = new Uint8Array(await arquivo.slice(0, 2).arrayBuffer());
    const ehZip = cabecalho[0] === 0x50 && cabecalho[1] === 0x4B; // assinatura "PK" de .zip
    let pacote, entradas = [];
    if (ehZip) {
      entradas = await Zip.ler(arquivo);
      const entradaJson = entradas.find((e) => e.nome === 'backup.json');
      if (!entradaJson) throw new Error('Esse .zip não tem um backup.json dentro — não parece ser um backup do TRIVOX.');
      pacote = JSON.parse(new TextDecoder().decode(entradaJson.dados));
    } else {
      pacote = JSON.parse(await arquivo.text()); // backup antigo, sem video (compatibilidade)
    }
    Dados.validarBackup(pacote);
    return { pacote, entradas };
  }

  async function restaurarBackup({ pacote, entradas }) {
    Dados.importar(pacote);

    const manifesto = pacote.videos || {};
    let restaurados = 0;
    for (const [exId, info] of Object.entries(manifesto)) {
      const entradaVideo = entradas.find((e) => e.nome === info.arquivo);
      if (!entradaVideo) continue;
      await Videos.salvarVideo(exId, new Blob([entradaVideo.dados], { type: info.tipo || 'video/mp4' }));
      restaurados++;
    }
    return { totalVideos: Object.keys(manifesto).length, restaurados };
  }

  /** Fecha a sessao: grava historico, calcula XP, checa badges, mostra o resumo. */
  function finalizarTreino() {
    pararTimer();
    pararSpotify();
    const ex = est.execucao;
    if (!ex) return;
    const itensComSet = ex.itens.filter((i) => i.sets.length);
    const duracaoSeg = Math.max(1, Math.round((Date.now() - ex.inicioTs) / 1000));

    if (!itensComSet.length) { est.execucao = null; Dados.salvarExecucao(null); UI.ir('fichas'); return; }

    const volumeTotal = itensComSet.reduce((s, i) => s + i.sets.reduce((t, st) => t + (Number(st.carga) || 0) * (Number(st.reps) || 0), 0), 0);
    const xpGanho = Gamificacao.xpSessaoForca({ numExercicios: itensComSet.length, duracaoMin: Math.round(duracaoSeg / 60) });

    const salvou = Dados.registrarSessao({
      tipo: 'forca', fichaId: ex.fichaId, fichaNome: ex.fichaNome, duracaoSeg,
      exercicios: itensComSet.map((i) => ({ exId: i.exId, nome: i.nome, sets: i.sets })),
      volumeTotal, xpGanho,
    });
    if (!salvou) {
      // armazenamento cheio: o treino continua aberto (nada de "concluido" sem ter gravado)
      ex.descansando = false;
      ex.timerItem = null;
      if (est.tela !== 'execucao') UI.ir('execucao'); else UI.render();
      alert('O treino NÃO foi salvo: o armazenamento está cheio. Ele continua aberto aqui. Apague fotos antigas (Perfil › Fotos de evolução) ou exporte um backup, e toque em ‹ (sair do treino) de novo.');
      return;
    }

    const gamAntes = Dados.gam();
    const novoXp = gamAntes.xp + xpGanho;
    const nivelAntes = Gamificacao.nivelPorXP(gamAntes.xp);
    const nivelDepois = Gamificacao.nivelPorXP(novoXp);

    const sessoes = Dados.sessoes();
    const fichas = Dados.fichas();
    const streak = Gamificacao.calcularStreak(Dados.diasTreinados());
    const vol = Forca.volumeSemanal(fichas, UI.getBase());

    const ctx = {
      totalSessoes: sessoes.length,
      totalForca: sessoes.filter((s) => s.tipo === 'forca').length,
      totalCardio: sessoes.filter((s) => s.tipo === 'cardio').length,
      maxSessoesSemana: calcularMaxSessoesSemana(sessoes),
      streakMaximo: streak.maximo,
      temRecorde: detectarRecorde(itensComSet),
      quebrouPlato: detectarQuebraPlato(itensComSet),
      volumeEquilibrado: vol.length > 0 && vol.every((v) => v.situacao.chave === 'ok'),
      totalFichas: fichas.length,
    };
    const novosBadges = Gamificacao.avaliarBadges(ctx, gamAntes.badges);
    Dados.salvarGam({ xp: novoXp, badges: [...gamAntes.badges, ...novosBadges.map((b) => b.id)] });

    est.execucao = null;
    Dados.salvarExecucao(null);
    Lembretes.sincronizarComSW(Dados.perfil(), { treinouEm: new Date().toLocaleDateString('sv-SE') });
    if (est.tela === 'execucao') UI.ir('fichas'); else UI.render();
    UI.modalResumoTreino({ xpGanho, novosBadges, nivel: nivelDepois, subiuNivel: nivelDepois.chave !== nivelAntes.chave });
  }

  // ---------- fotos para usar sem internet ----------
  // O service worker guarda cada foto que passa por ele; aqui so pedimos as fotos antes de a
  // pessoa precisar (no modo aviao so aparecia o que ja tinha sido visto). 4 por vez.
  async function baixarFotos(urls, aoAvancar = () => {}) {
    let feitas = 0, falhas = 0, i = 0;
    const proximo = async () => {
      while (i < urls.length) {
        const u = urls[i++];
        try { const r = await fetch(u); if (!r.ok) falhas++; } catch (e) { falhas++; }
        aoAvancar(++feitas);
      }
    };
    await Promise.all([proximo(), proximo(), proximo(), proximo()]);
    return falhas;
  }

  /** Fotos dos exercicios das fichas (e dos substitutos imediatos) — automatico, com internet. */
  function guardarFotosDasFichas() {
    if (!navigator.onLine || !('serviceWorker' in navigator)) return;
    const porId = new Map(UI.getBase().map((e) => [e.id, e]));
    const urls = new Set();
    for (const f of Dados.fichas()) for (const it of f.exercicios || []) {
      (porId.get(it.exId)?.imagens || []).forEach((u) => urls.add(u));
      const ilus = UI.ilustracaoDe(it.exId);
      if (ilus) urls.add(ilus);
    }
    if (urls.size) baixarFotos([...urls]);
  }
  setTimeout(guardarFotosDasFichas, 8000);

  // ---------- cliques ----------

  let audioDestravado = false;
  document.body.addEventListener('click', (ev) => {
    if (!audioDestravado) { audioDestravado = true; Alarme.destravar(); }
    const alvo = ev.target.closest('[data-acao]');
    if (!alvo) return;
    const acao = alvo.dataset.acao;
    if (acao === 'buscar') return; // input, tratado em outro lugar

    // rascunho dos campos da serie: sair para "Como executar" ou o cronometro nao perde o digitado
    if (est.tela === 'execucao' && est.execucao && document.getElementById('exec-carga')) {
      const it = est.execucao.itens[est.execucao.iEx];
      const v = (id) => document.getElementById(id)?.value ?? '';
      if (it) it.rascunho = { carga: v('exec-carga'), reps: v('exec-reps'), rir: v('exec-rir') };
    }

    switch (acao) {

      case 'ir':
        if (alvo.dataset.voltar) est.voltarTela = alvo.dataset.voltar;
        pararTimer();
        // voltando para o treino (do "Como executar" ou do cartao "continuar"): religa musica e relogio
        if (alvo.dataset.tela === 'execucao') {
          iniciarSpotify();
          if (est.execucao?.descansando || est.execucao?.timerItem) garantirLoop();
        } else {
          pararSpotify();
        }
        est.escolhendoPara = null;
        est.limite = 40;
        UI.ir(alvo.dataset.tela);
        break;

      case 'fechar-modal':
        UI.fecharModal();
        break;

      case 'ampliar-midia':
        UI.abrirModal(`<div class="midia-ampliada">${alvo.innerHTML}</div>
          <button class="btn btn-largo btn-principal" data-acao="fechar-modal">Fechar</button>`);
        break;

      case 'zerar-tudo': {
        const naNuvem = !!sessaoNuvem;
        if (!confirm(`Apagar TUDO deste aparelho${naNuvem ? ' e da sua conta na nuvem' : ''}? Perfil, fichas, histórico, fotos e vídeos. Não dá para desfazer.`)) break;
        if (!confirm('Tem certeza? Esta é a última confirmação.')) break;
        (async () => {
          try {
            for (const [, t] of filaPushNuvem) clearTimeout(t); // nada pendente sobe de volta
            filaPushNuvem.clear();
            if (naNuvem) {
              await Nuvem.apagarMeusDados(sessaoNuvem.user.id);
              await Nuvem.sair();
            }
            await Dados.apagarTudoLocal();
            await Videos.apagarTodos().catch(() => {});
            est.execucao = null;
            location.reload();
          } catch (e) {
            alert('Não consegui apagar tudo: ' + e.message + (naNuvem ? ' (confira a internet: a nuvem precisa estar acessível).' : ''));
          }
        })();
        break;
      }

      case 'alternar-animacao':
        est.animacaoParada = !est.animacaoParada;
        UI.render();
        break;

      // ----- fichas -----

      case 'nova-ficha': {
        const nome = prompt('Nome da ficha:', `Treino ${String.fromCharCode(65 + Dados.fichas().length)}`);
        if (nome === null) break;
        const f = Dados.novaFicha(nome.trim() || 'Novo treino');
        UI.ir('ficha', { fichaId: f.id });
        break;
      }

      case 'abrir-ficha':
        UI.ir('ficha', { fichaId: alvo.dataset.id });
        break;

      case 'duplicar-ficha': {
        const copia = Dados.duplicarFicha(alvo.dataset.id);
        if (copia) UI.ir('ficha', { fichaId: copia.id });
        break;
      }

      case 'apagar-ficha': {
        const f = Dados.acharFicha(alvo.dataset.id);
        if (f && confirm(`Apagar a ficha "${f.nome}"? Isso não pode ser desfeito.`)) {
          Dados.apagarFicha(f.id);
          UI.ir('fichas');
        }
        break;
      }

      // ----- exercicios dentro da ficha -----

      case 'add-exercicio':
        est.busca = '';
        est.limite = 40;
        UI.ir('biblioteca', { escolhendoPara: alvo.dataset.id });
        break;

      case 'cancelar-escolha': {
        const fid = est.escolhendoPara;
        est.escolhendoPara = null;
        UI.ir('ficha', { fichaId: fid });
        break;
      }

      case 'escolher-exercicio': {
        const fid = est.escolhendoPara;
        const f = Dados.acharFicha(fid);
        const ex = UI.getBase().find((e) => e.id === alvo.dataset.id);
        if (!f || !ex) break;

        // ja entra com series/reps/descanso sugeridos pelo objetivo do perfil
        const p = Dados.perfil();
        const presc = Forca.prescrever(p.objetivo, ex, { nivel: p.nivel, idade: Dados.idade() });
        const atuais = [...(f.exercicios || [])];
        const posFim = atuais.findIndex((it) => ['circuito', 'volta_calma'].includes(it.bloco));
        const novoItem = {
          exId: ex.id,
          series: presc.series,
          reps: presc.reps,
          repsMin: presc.repsMin,
          repsMax: presc.repsMax,
          rirAlvo: presc.rirAlvo,
          descanso: presc.descanso,
          carga: null,
          obs: '',
          ...(atuais.some((it) => it.bloco) ? { bloco: 'principal' } : {}),
        };
        if (posFim >= 0) atuais.splice(posFim, 0, novoItem); else atuais.push(novoItem);
        const itens = atuais;
        Dados.atualizarFicha(fid, { exercicios: itens });
        est.escolhendoPara = null;
        UI.ir('ficha', { fichaId: fid });
        break;
      }

      case 'remover-item': {
        const f = fichaAtual();
        if (!f) break;
        const i = Number(alvo.dataset.i);
        const itens = f.exercicios.filter((_, idx) => idx !== i);
        Dados.atualizarFicha(f.id, { exercicios: itens });
        UI.render();
        break;
      }

      case 'mover': {
        const f = fichaAtual();
        if (!f) break;
        const i = Number(alvo.dataset.i);
        const j = i + Number(alvo.dataset.dir);
        const itens = [...f.exercicios];
        if (j < 0 || j >= itens.length) break;
        [itens[i], itens[j]] = [itens[j], itens[i]];
        Dados.atualizarFicha(f.id, { exercicios: itens });
        UI.render();
        break;
      }

      case 'aplicar-sug':
        atualizarItem(Number(alvo.dataset.item), { carga: Number(alvo.dataset.carga) });
        UI.render();
        break;

      case 'ver-exercicio':
        if (!alvo.dataset.id) break;
        est.voltarTela = alvo.dataset.voltar || est.tela;
        est.midiaAba = null;
        UI.ir('exercicio', { exercicioId: alvo.dataset.id });
        carregarVideoExercicio(alvo.dataset.id);
        break;

      case 'mais':
        est.limite += 40;
        UI.render();
        break;

      // ----- gerador automatico de ficha -----

      case 'abrir-gerador':
        UI.modalGerador();
        break;

      case 'ger-objetivo':
        est.gerador.objetivos = UI.alternarObjetivo(est.gerador.objetivos || UI.perfilTreino().objetivos, alvo.dataset.valor);
        UI.modalGerador();
        break;

      case 'ger-local': case 'ger-nivel': {
        est.gerador[acao.replace('ger-', '')] = alvo.dataset.valor;
        UI.modalGerador();
        break;
      }

      case 'ger-substituir':
        est.gerador.substituir = alvo.dataset.valor === '1';
        UI.modalGerador();
        break;

      case 'gerar-plano': {
        const p = Dados.perfil();
        const g = est.gerador;
        const pt = UI.perfilTreino();
        const objetivos = g.objetivos || pt.objetivos;
        const local = g.local || pt.local;
        const nivel = g.nivel || pt.nivel;
        // "gerar de novo" sempre muda: contador que so cresce (melhor variedade que contar fichas)
        let rotacao = 0;
        try { rotacao = Number(localStorage.getItem('at:rotacao') || 0) + 1; localStorage.setItem('at:rotacao', String(rotacao)); } catch (e) { rotacao = Date.now() % 97; }
        const planos = Forca.gerarPlano({
          objetivos, nivel, local, freqForca: p.freqForca,
          diasSemana: p.diasTreino, base: UI.getBase(), rotacao,
          sexo: p.sexo, idade: Dados.idade(), peso: p.peso, altura: p.altura,
          equipCasa: p.equipCasa, diasJogo: p.diasJogo, enfase: p.enfase,
        });
        if (!planos.length) { alert('Não consegui montar fichas com essas opções. Tente outro local ou nível.'); break; }
        Dados.salvarPerfil({ objetivos, objetivo: UI.principalDe(objetivos), local, nivel });
        if (g.substituir !== false) Dados.fichas().forEach((f) => Dados.apagarFicha(f.id));
        planos.forEach((pl) => {
          const f = Dados.novaFicha(pl.nome);
          Dados.atualizarFicha(f.id, { exercicios: pl.exercicios, diaSemana: pl.diaSemana, obs: pl.porque || '', objetivo: pl.objetivo, ultimaVariacaoEm: Date.now() });
        });
        est.gerador = { objetivo: null };
        setTimeout(guardarFotosDasFichas, 1000);
        UI.fecharModal();
        UI.ir('fichas');
        break;
      }

      case 'variar-treino': {
        const fichas = Dados.fichas();
        // muda a cada ciclo de SEMANAS_PARA_VARIAR sem precisar guardar contador nenhum —
        // so olha quantos ciclos ja se passaram desde o epoch. Cada ficha usa um deslocamento
        // diferente pra nao trocar sempre pelo mesmo substituto quando ha mais de uma opcao.
        const msPorCiclo = Forca.SEMANAS_PARA_VARIAR * 7 * 24 * 60 * 60 * 1000;
        const cicloAtual = Math.floor(Date.now() / msPorCiclo);
        let totalTrocado = 0;
        fichas.forEach((f, i) => {
          if (!(f.exercicios || []).length) return;
          const { exercicios, trocados } = Forca.variarFicha(f, UI.getBase(), { ...UI.perfilTreino(), rotacao: cicloAtual + i });
          Dados.atualizarFicha(f.id, { exercicios, ultimaVariacaoEm: Date.now() });
          totalTrocado += trocados;
        });
        alert(totalTrocado > 0
          ? `Troquei ${totalTrocado} exercício${totalTrocado === 1 ? '' : 's'} por variações em outro aparelho — mesmo objetivo, estímulo novo. Confira nas fichas.`
          : 'Não encontrei variações seguras pra trocar agora — seus treinos continuam como estavam.');
        UI.render();
        break;
      }

      // ----- execucao do treino -----

      case 'iniciar-treino': {
        const f = Dados.acharFicha(alvo.dataset.id);
        if (!f || !f.exercicios?.length) break;
        // ja tem treino aberto: a mesma ficha so continua; outra ficha pergunta antes de descartar
        const aberto = est.execucao;
        if (aberto && aberto.itens.some((i) => i.sets.length || i.feito)) {
          if (aberto.fichaId === f.id) { UI.ir('execucao'); iniciarSpotify(); break; }
          if (!confirm(`Você tem um treino em andamento (${aberto.fichaNome}). Começar outro descarta as séries que não foram salvas. Continuar?`)) break;
        }
        // ficha montada a mao: ganha aquecimento no inicio e alongamento no fim, pros musculos do dia
        let lista = f.exercicios;
        try {
          // com 2 objetivos, cada ficha sabe o seu (aquecimento/alongamento no estilo dela)
          lista = Forca.completarSessao(f.exercicios, { base: UI.getBase(), ...UI.perfilTreino(), ...(f.objetivo ? { objetivo: f.objetivo } : {}) }) || f.exercicios;
        } catch (e) { console.warn('[treino] completarSessao', e); }
        // ficha antiga com exercicio que saiu da base: fica de fora (antes virava "Exercicio" sem imagem)
        const existe = new Set(UI.getBase().map((e) => e.id));
        const faltando = lista.filter((it) => !existe.has(it.exId)).length;
        lista = lista.filter((it) => existe.has(it.exId));
        if (!lista.length) { alert('Os exercícios desta ficha não existem mais na base. Monte a ficha de novo.'); break; }
        if (faltando) alert(`${faltando} exercício(s) desta ficha não existem mais na base e ficaram de fora do treino.`);
        const itens = lista.map((item) => {
          const ex = UI.getBase().find((e) => e.id === item.exId);
          const historicoAntigo = Dados.historicoCarga(item.exId);
          return {
            exId: item.exId, nome: ex?.nome || 'Exercício', icon: ex?.icon || '',
            bloco: item.bloco || 'principal', tempoSeg: item.tempoSeg || null, grupo: item.grupo || '',
            obs: item.obs || '', repsTexto: item.reps || '', superserie: item.superserie || null,
            seriesAlvo: Number(item.series) || 3,
            repsAlvoMin: item.repsMin || 8, repsAlvoMax: item.repsMax || 12,
            rirAlvo: item.rirAlvo ?? 1, descansoAlvo: Number(item.descanso) || 90,
            cargaSugerida: Forca.sugerirCarga(historicoAntigo, item),
            recordeAnterior: Math.max(0, ...historicoAntigo.map((h) => Number(h.carga) || 0)),
            platoAntes: Forca.detectarPlato(historicoAntigo).plato,
            ultimaCargaAntes: historicoAntigo.length ? (Number(historicoAntigo[0].carga) || 0) : 0,
            sets: [],
          };
        });
        est.execucao = { fichaId: f.id, fichaNome: f.nome, itens, iEx: 0, descansando: false, fimDescanso: 0, descansoTotal: 0, timerItem: null, inicioTs: Date.now() };
        est.midiaAba = null;
        UI.ir('execucao');
        iniciarSpotify();
        break;
      }

      case 'iniciar-tempo-item': {
        const ex = est.execucao;
        const item = ex && ex.itens[ex.iEx];
        if (!item || !item.tempoSeg) break;
        ex.timerItem = { ate: Date.now() + item.tempoSeg * 1000, total: item.tempoSeg };
        garantirLoop();
        UI.render();
        break;
      }

      case 'concluir-simples': {
        const ex = est.execucao;
        if (!ex) break;
        ex.itens[ex.iEx].feito = true;
        est.midiaAba = null;
        proximoItem();
        break;
      }

      case 'pular-exercicio':
        est.midiaAba = null;
        proximoItem();
        break;

      case 'concluir-serie': {
        const ex = est.execucao;
        if (!ex) break;
        const item = ex.itens[ex.iEx];
        const carga = parseFloat(document.getElementById('exec-carga')?.value) || 0;
        const reps = parseInt(document.getElementById('exec-reps')?.value, 10) || 0;
        const rirVal = document.getElementById('exec-rir')?.value;
        const rir = rirVal === '' || rirVal === undefined ? null : parseInt(rirVal, 10);
        item.sets.push({ carga, reps, rir });
        delete item.rascunho;
        Dados.registrarCarga(item.exId, { carga, reps, rir });
        ex.descansando = true;
        ex.descansoTotal = item.descansoAlvo;
        ex.fimDescanso = Date.now() + item.descansoAlvo * 1000;
        est.midiaAba = null;
        iniciarTimer();
        UI.render();
        break;
      }

      case 'ajustar-descanso': {
        const ex = est.execucao;
        if (!ex) break;
        const seg = Number(alvo.dataset.seg);
        ex.fimDescanso = Math.max(Date.now(), ex.fimDescanso + seg * 1000);
        ex.descansoTotal = Math.max(5, ex.descansoTotal + seg);
        UI.render();
        break;
      }

      case 'pular-descanso':
        pararTimer();
        terminarDescanso();
        break;

      case 'trocar-equipamento':
        UI.modalTrocarEquipamento();
        break;

      case 'fazer-depois': {
        // aparelho ocupado: o exercicio vai para o fim do proprio bloco (o principal continua
        // antes do alongamento) e o treino segue no proximo; series ja feitas vao junto
        const ex = est.execucao;
        if (!ex) break;
        const item = ex.itens[ex.iEx];
        const bloco = item.bloco || 'principal';
        let fim = ex.iEx;
        for (let i = ex.iEx + 1; i < ex.itens.length; i++) if ((ex.itens[i].bloco || 'principal') === bloco) fim = i;
        if (fim === ex.iEx) break;
        ex.itens.splice(ex.iEx, 1);
        ex.itens.splice(fim, 0, item); // depois da remocao, "fim" e a posicao logo apos o ultimo do bloco
        item.adiado = true;
        ex.timerItem = null;
        ex.descansando = false;
        est.midiaAba = null;
        Dados.salvarExecucao(ex);
        UI.fecharModal();
        window.scrollTo(0, 0);
        UI.render();
        break;
      }

      case 'confirmar-troca': {
        const ex = est.execucao;
        if (!ex) break;
        const novo = UI.getBase().find((e) => e.id === alvo.dataset.id);
        if (!novo) break;
        let item = ex.itens[ex.iEx];
        if (item.sets.length) {
          // series ja feitas continuam na sessao; o substituto entra logo depois com as que faltam
          const novoItem = { ...item, feito: false, seriesAlvo: Math.max(1, item.seriesAlvo - item.sets.length) };
          item.seriesAlvo = item.sets.length;
          ex.itens.splice(ex.iEx + 1, 0, novoItem);
          ex.iEx++;
          item = novoItem;
        }
        const historicoNovo = Dados.historicoCarga(novo.id);
        item.exId = novo.id;
        item.nome = novo.nome;
        item.icon = novo.icon;
        item.sets = [];
        delete item.rascunho; // a carga digitada era do exercicio anterior
        item.cargaSugerida = Forca.sugerirCarga(historicoNovo, item);
        item.recordeAnterior = Math.max(0, ...historicoNovo.map((h) => Number(h.carga) || 0));
        item.platoAntes = Forca.detectarPlato(historicoNovo).plato;
        item.ultimaCargaAntes = historicoNovo.length ? (Number(historicoNovo[0].carga) || 0) : 0;
        UI.fecharModal();
        UI.render();
        break;
      }

      case 'encerrar-treino-confirma': {
        const ex = est.execucao;
        const feitoAlgo = ex && ex.itens.some((i) => i.sets.length);
        if (!feitoAlgo) {
          if (ex && ex.itens.some((i) => i.feito) && !confirm('Sair do treino? Nenhuma série foi registrada ainda.')) break;
          pararSpotify(); est.execucao = null; UI.ir('fichas'); break;
        }
        if (confirm('Encerrar o treino agora? O que já foi feito fica salvo.')) finalizarTreino();
        break;
      }

      case 'fechar-resumo-treino':
        UI.fecharModal();
        break;

      // ----- spotify -----

      case 'spotify-conectar': {
        const clientId = document.getElementById('spotify-client-id')?.value?.trim();
        if (!clientId) { alert('Cole o Client ID do seu app do Spotify antes de conectar.'); break; }
        Dados.salvarSpotify({ clientId });
        Spotify.urlLogin(clientId).then(({ url, verificador, estado }) => {
          Dados.salvarSpotify({ pkceVerificador: verificador, pkceEstado: estado });
          location.href = url;
        }).catch((e) => alert('Não consegui abrir o login do Spotify (ele só funciona no endereço https do app ou em 127.0.0.1): ' + e.message));
        break;
      }

      case 'spotify-desconectar':
        Dados.desconectarSpotify();
        UI.render();
        break;

      case 'spotify-tocar': case 'spotify-pausar': case 'spotify-proxima': case 'spotify-anterior': {
        const acoes = { 'spotify-tocar': Spotify.tocar, 'spotify-pausar': Spotify.pausar, 'spotify-proxima': Spotify.proxima, 'spotify-anterior': Spotify.anterior };
        tokenSpotifyValido().then((token) => {
          if (!token) { alert('Conecte o Spotify no Perfil primeiro.'); return; }
          acoes[acao](token).then(() => setTimeout(atualizarTocandoAgora, 500)).catch((e) => alert(e.message));
        });
        break;
      }

      // ----- nuvem (backup automatico) -----

      case 'nuvem-enviar-link': {
        if (!Nuvem.disponivel()) { alert('Sem conexão agora — tente de novo com internet.'); break; }
        // "Reenviar" nao tem mais o campo de e-mail na tela (ja foi enviado antes) — usa o
        // e-mail guardado no proprio botao nesse caso; no primeiro envio, le do campo mesmo.
        const email = (alvo.dataset.email || document.getElementById('nuvem-email')?.value || '').trim();
        if (!email || !email.includes('@')) { alert('Digite um e-mail válido.'); break; }
        Nuvem.enviarLinkLogin(email).then(() => {
          est.nuvem.linkEnviadoPara = email;
          UI.render();
        }).catch((e) => alert(e.message));
        break;
      }

      case 'nuvem-confirmar-codigo': {
        if (!Nuvem.disponivel()) { alert('Sem conexão agora — tente de novo com internet.'); break; }
        const email = alvo.dataset.email;
        const codigo = document.getElementById('nuvem-codigo')?.value?.trim();
        if (!codigo || codigo.length < 4) { alert('Digite o código que veio no e-mail.'); break; }
        // sucesso: o listener aoMudarSessao (ja registrado) atualiza a tela sozinho
        Nuvem.verificarCodigo(email, codigo).catch((e) => alert(e.message));
        break;
      }

      case 'nuvem-sair':
        if (confirm('Sair da conta na nuvem? Os dados continuam aqui no aparelho — só para de sincronizar.')) {
          Nuvem.sair();
        }
        break;

      // ----- coach -----

      case 'coach-tema': {
        const streak = Gamificacao.calcularStreak(Dados.diasTreinados());
        const r = Gamificacao.responderCoach(alvo.dataset.tema, { streak: streak.atual });
        est.coach.mensagens.push({ de: 'coach', ...r });
        UI.render();
        break;
      }

      case 'coach-enviar': {
        const inp = document.getElementById('coach-input');
        const texto = inp?.value?.trim();
        if (!texto) break;
        est.coach.mensagens.push({ de: 'user', texto });
        const streak = Gamificacao.calcularStreak(Dados.diasTreinados());
        const r = Gamificacao.responderCoach(texto, { streak: streak.atual });
        est.coach.mensagens.push({ de: 'coach', ...r });
        UI.render();
        break;
      }

      // ----- evolucao -----

      case 'expandir-sessao':
        est.sessaoExpandida = est.sessaoExpandida === alvo.dataset.id ? null : alvo.dataset.id;
        UI.render();
        break;

      case 'tema':
        UI.escolherTema(alvo.dataset.valor);
        UI.render();
        break;

      case 'apagar-sessao':
        if (!confirm('Apagar este treino do histórico? As cargas registradas nele e o XP que ele deu também saem. Não dá para desfazer.')) break;
        Dados.apagarSessao(alvo.dataset.id);
        est.sessaoExpandida = null;
        UI.render();
        break;

      case 'apagar-historico':
        if (!confirm('Apagar TODOS os treinos feitos? Saem o histórico, as cargas registradas, o XP e as conquistas. Perfil, fichas, pesagens e fotos ficam. Não dá para desfazer.')) break;
        Dados.apagarHistoricoTreinos();
        est.sessaoExpandida = null;
        UI.render();
        break;

      // ----- cardio -----

      case 'salvar-cardio': {
        // registra uma sessao FEITA (conta XP e "treino de hoje") — por isso pergunta antes
        if (!confirm('Registrar que você fez esta sessão de aeróbico hoje?')) break;
        const p = Dados.perfil();
        const fm = Aerobico.fcMax({ idade: Dados.idade(), medida: p.fcMaxMedida });
        const z = fm ? Aerobico.zonas({ fcMaxValor: fm.valor, fcRepouso: p.fcRepouso }) : null;
        const s = Aerobico.montarSessao({ ...est.cardio, zonasCalc: z });
        Dados.salvarCardio({ id: Dados.id(), ...s });

        // conta pra gamificacao junto com as sessoes de forca — streak e badges nao diferenciam
        const xpGanho = Gamificacao.xpSessaoCardio({ duracaoMin: s.duracao });
        Dados.registrarSessao({
          tipo: 'cardio', fichaNome: s.nome, duracaoSeg: s.duracao * 60,
          cardioResumo: { nome: s.nome, modalidade: s.modalidade }, xpGanho,
        });
        const gamAntes = Dados.gam();
        Dados.salvarGam({ xp: gamAntes.xp + xpGanho });
        Lembretes.sincronizarComSW(p, { treinouEm: new Date().toLocaleDateString('sv-SE') });
        const sessoes = Dados.sessoes();
        const novosBadges = Gamificacao.avaliarBadges({
          totalSessoes: sessoes.length, totalForca: sessoes.filter((x) => x.tipo === 'forca').length,
          totalCardio: sessoes.filter((x) => x.tipo === 'cardio').length,
          maxSessoesSemana: calcularMaxSessoesSemana(sessoes),
          streakMaximo: Gamificacao.calcularStreak(Dados.diasTreinados()).maximo,
          temRecorde: false, quebrouPlato: false,
          volumeEquilibrado: false, totalFichas: Dados.fichas().length,
        }, gamAntes.badges);
        if (novosBadges.length) Dados.salvarGam({ badges: [...gamAntes.badges, ...novosBadges.map((b) => b.id)] });

        UI.render();
        if (novosBadges.length) UI.modalResumoTreino({ xpGanho, novosBadges, nivel: Gamificacao.nivelPorXP(Dados.gam().xp), subiuNivel: false });
        break;
      }

      case 'apagar-cardio':
        Dados.apagarCardio(alvo.dataset.id);
        UI.render();
        break;

      case 'teste-fala':
        UI.modalTesteFala();
        break;

      // ----- calculadoras -----

      case 'calc-1rm': UI.modal1RM(); break;
      case 'calc-anilhas': UI.modalAnilhas(); break;
      case 'volume': UI.modalVolume(); break;

      // ----- perfil: dias de treino e peso -----

      // ----- imagens do exercicio -----

      case 'midia-aba':
        est.midiaAba = alvo.dataset.aba;
        UI.render();
        if (est.tela === 'exercicio') carregarVideoExercicio(est.exercicioId); // o card de video reseta no render
        break;

      // ----- cronometro -----

      case 'ir-cronometro':
        UI.ir('cronometro');
        garantirLoop();
        break;

      case 'crono-modo': {
        const c = est.crono;
        if (c.rodando && !confirm('Parar o que está contando e trocar de modo?')) break;
        Object.assign(c, { modo: alvo.dataset.modo, rodando: false, pausadoRestante: null, acumulado: 0, voltas: [] });
        c.intervalo.fase = 'trabalho'; c.intervalo.rodada = 1;
        UI.render();
        break;
      }

      case 'crono-preset':
        Object.assign(est.crono, { total: Number(alvo.dataset.seg), rodando: false, pausadoRestante: null });
        UI.render();
        break;

      case 'crono-iv-preset':
        Object.assign(est.crono.intervalo, { trabalho: Number(alvo.dataset.t), descanso: Number(alvo.dataset.d), rodadas: Number(alvo.dataset.r), fase: 'trabalho', rodada: 1 });
        est.crono.pausadoRestante = null;
        UI.render();
        break;

      case 'crono-ajustar': {
        const c = est.crono;
        const seg = Number(alvo.dataset.seg);
        if (c.rodando) c.ate = Math.max(Date.now() + 1000, c.ate + seg * 1000);
        else if (c.pausadoRestante !== null) c.pausadoRestante = Math.max(1, c.pausadoRestante + seg);
        else c.total = Math.max(5, c.total + seg);
        UI.render();
        break;
      }

      case 'crono-iniciar': {
        const c = est.crono;
        const agora = Date.now();
        if (c.modo === 'cronometro') { c.inicio = agora; }
        else if (c.modo === 'timer') { c.ate = agora + (c.pausadoRestante ?? c.total) * 1000; }
        else {
          const iv = c.intervalo;
          const dur = c.pausadoRestante ?? (iv.fase === 'trabalho' ? iv.trabalho : iv.descanso);
          c.ate = agora + dur * 1000;
          if (c.pausadoRestante === null) Alarme.troca();
        }
        c.rodando = true; c.pausadoRestante = null;
        garantirLoop();
        UI.render();
        break;
      }

      case 'crono-pausar': {
        const c = est.crono;
        if (!c.rodando) break;
        if (c.modo === 'cronometro') c.acumulado = (c.acumulado || 0) + Date.now() - c.inicio;
        else c.pausadoRestante = Math.max(1, Math.ceil((c.ate - Date.now()) / 1000));
        c.rodando = false;
        UI.render();
        break;
      }

      case 'crono-volta': {
        const c = est.crono;
        c.voltas = [((c.acumulado || 0) + Date.now() - c.inicio), ...(c.voltas || [])];
        UI.render();
        break;
      }

      case 'crono-zerar':
        Object.assign(est.crono, { rodando: false, pausadoRestante: null, acumulado: 0, voltas: [] });
        est.crono.intervalo.fase = 'trabalho'; est.crono.intervalo.rodada = 1;
        UI.render();
        break;

      case 'som-toggle':
        Alarme.ligarSom(!Alarme.somLigado());
        if (Alarme.somLigado()) Alarme.tique();
        UI.render();
        break;

      case 'pedir-notificacao':
        Alarme.pedirPermissao().then(() => { Lembretes.registrarPeriodico(); UI.render(); });
        break;

      // ----- perfil: objetivo, nivel, local, casa, raquete, lembrete -----

      case 'perfil-objetivo': {
        const objetivos = UI.alternarObjetivo(UI.perfilTreino().objetivos, alvo.dataset.valor);
        Dados.salvarPerfil({ objetivos, objetivo: UI.principalDe(objetivos) });
        UI.render();
        break;
      }

      case 'toggle-esporte': {
        const atual = UI.esportesDe(Dados.perfil());
        const k = alvo.dataset.valor;
        const esportes = atual.includes(k) ? atual.filter((x) => x !== k) : [...atual, k];
        Dados.salvarPerfil({ esportes, esporte: esportes[0] || null });
        UI.render();
        break;
      }

      case 'adicionar-hora-lembrete':
      case 'remover-hora-lembrete': {
        const horas = [...Lembretes.horasDoLembrete(Dados.perfil())];
        if (acao === 'adicionar-hora-lembrete') horas.push(horas[0] === '07:00' ? '19:00' : '07:00');
        else horas.splice(Number(alvo.dataset.i), 1);
        Dados.salvarPerfil({ lembreteHoras: horas, lembreteHora: horas[0] });
        Lembretes.sincronizarComSW(Dados.perfil());
        UI.render();
        break;
      }

      case 'perfil-chip':
        Dados.salvarPerfil({ [alvo.dataset.campo]: alvo.dataset.valor });
        UI.render();
        break;

      case 'parq': {
        const respostas = [...((Dados.perfil().parq || {}).respostas || [])];
        while (respostas.length < UI.PARQ.length) respostas.push(null);
        respostas[Number(alvo.dataset.i)] = alvo.dataset.valor === '1';
        Dados.salvarPerfil({ parq: { respostas, em: Date.now() } });
        UI.render();
        break;
      }

      case 'toggle-equip-casa': {
        const p = Dados.perfil();
        const atual = p.equipCasa || ((typeof Programas !== 'undefined') && Programas.EQUIP_CASA_PADRAO) || [];
        const k = alvo.dataset.valor;
        Dados.salvarPerfil({ equipCasa: atual.includes(k) ? atual.filter((x) => x !== k) : [...atual, k] });
        UI.render();
        break;
      }

      case 'toggle-dia-jogo': {
        const dia = Number(alvo.dataset.dia);
        const dj = Dados.perfil().diasJogo || [];
        Dados.salvarPerfil({ diasJogo: dj.includes(dia) ? dj.filter((d) => d !== dia) : [...dj, dia].sort() });
        UI.render();
        break;
      }

      case 'toggle-lembrete': {
        const ligar = !Dados.perfil().lembreteAtivo;
        Dados.salvarPerfil({ lembreteAtivo: ligar });
        if (ligar) Alarme.pedirPermissao().then(() => { Lembretes.registrarPeriodico(); UI.render(); });
        Lembretes.sincronizarComSW(Dados.perfil());
        UI.render();
        break;
      }

      case 'ir-nuvem':
        // abre o Perfil ja rolado ate o login da nuvem
        UI.ir('perfil');
        setTimeout(() => document.querySelector('[data-acao="nuvem-sair"], #nuvem-email, input[type="email"]')?.scrollIntoView({ block: 'center' }), 50);
        break;

      case 'baixar-fotos': {
        const todas = [...new Set([...UI.getBase().flatMap((e) => e.imagens || []), ...UI.urlsIlustracoes()])];
        alvo.disabled = true;
        baixarFotos(todas, (feitas) => { alvo.textContent = `Baixando… ${feitas} de ${todas.length}`; })
          .then((falhas) => {
            alvo.disabled = false;
            alvo.textContent = falhas ? `Faltaram ${falhas} — toque para tentar de novo` : '✓ Todas as fotos guardadas';
          });
        break;
      }

      case 'lembrete-calendario':
        Lembretes.baixarCalendario(Dados.perfil());
        break;

      case 'toggle-dia-treino': {
        const dia = Number(alvo.dataset.dia);
        const p = Dados.perfil();
        const dias = p.diasTreino.includes(dia) ? p.diasTreino.filter((d) => d !== dia) : [...p.diasTreino, dia].sort();
        Dados.salvarPerfil({ diasTreino: dias });
        UI.render();
        break;
      }

      case 'abrir-registrar-peso':
        UI.modalRegistrarPeso();
        break;

      case 'salvar-peso': {
        const peso = parseFloat(document.getElementById('peso-valor')?.value);
        if (!(peso > 0)) { alert('Informe um peso válido.'); break; }
        const dataStr = document.getElementById('peso-data')?.value;
        const opcional = (id) => { const v = parseFloat(document.getElementById(id)?.value); return isNaN(v) ? null : v; };
        const registro = {
          peso,
          data: dataStr ? new Date(dataStr + 'T12:00:00').getTime() : Date.now(),
          gordura: opcional('peso-gordura'),
          massaMuscular: opcional('peso-massa'),
          agua: opcional('peso-agua'),
          visceral: opcional('peso-visceral'),
          tmb: opcional('peso-tmb'),
        };
        Dados.registrarPeso(registro);
        UI.fecharModal();
        UI.render();
        break;
      }

      // ----- perfil: fotos -----

      case 'trocar-foto-perfil':
        escolherArquivoImagem().then((arq) => {
          if (!arq) return;
          return comprimirImagem(arq, { maxLado: 480, qualidade: 0.82 }).then((dataUrl) => {
            Dados.salvarPerfil({ foto: dataUrl });
            UI.render();
          });
        }).catch((e) => alert(e.message));
        break;

      case 'remover-foto-perfil':
        if (confirm('Remover a foto de perfil?')) { Dados.salvarPerfil({ foto: null }); UI.render(); }
        break;

      case 'abrir-foto-evolucao':
        escolherArquivoImagem().then((arq) => {
          if (!arq) return;
          return comprimirImagem(arq, { maxLado: 900, qualidade: 0.78 }).then((dataUrl) => {
            est.fotoTemp = dataUrl;
            UI.modalRegistrarFotoEvolucao();
          });
        }).catch((e) => alert(e.message));
        break;

      case 'salvar-foto-evolucao': {
        if (!est.fotoTemp) { UI.fecharModal(); break; }
        const nota = document.getElementById('foto-nota')?.value.trim() || '';
        Dados.registrarFotoEvolucao({ foto: est.fotoTemp, nota });
        est.fotoTemp = null;
        UI.fecharModal();
        UI.render();
        break;
      }

      case 'cancelar-foto-evolucao':
        est.fotoTemp = null;
        UI.fecharModal();
        break;

      case 'ver-foto-evolucao':
        UI.modalVerFotoEvolucao(alvo.dataset.id);
        break;

      case 'apagar-foto-evolucao':
        if (confirm('Apagar esta foto de evolução?')) {
          Dados.apagarFotoEvolucao(alvo.dataset.id);
          UI.fecharModal();
          UI.render();
        }
        break;

      // ----- foto e video pessoal do exercicio -----

      case 'trocar-foto-exercicio': {
        const exId = alvo.dataset.id;
        escolherArquivoImagem().then((arq) => {
          if (!arq) return;
          return comprimirImagem(arq, { maxLado: 900, qualidade: 0.8 }).then((dataUrl) => {
            Dados.salvarFotoExercicio(exId, dataUrl);
            UI.render();
            carregarVideoExercicio(exId); // o card de video reseta no re-render; recarrega por cima
          });
        }).catch((e) => alert(e.message));
        break;
      }

      case 'remover-foto-exercicio':
        if (confirm('Remover sua foto e voltar à foto/pictograma padrão deste exercício?')) {
          Dados.apagarFotoExercicio(alvo.dataset.id);
          UI.render();
          carregarVideoExercicio(alvo.dataset.id);
        }
        break;

      case 'trocar-video-exercicio': {
        const exId = alvo.dataset.id;
        const inp = document.createElement('input');
        inp.type = 'file';
        inp.accept = 'video/*';
        inp.addEventListener('change', () => {
          const arq = inp.files?.[0];
          if (!arq) return;
          if (!arq.type.startsWith('video/')) { alert('Selecione um arquivo de vídeo.'); return; }
          const tamanhoMB = arq.size / (1024 * 1024);
          if (tamanhoMB > 50 && !confirm(`Esse vídeo tem ${tamanhoMB.toFixed(0)}MB — bem mais pesado que o normal (um clipe de 5-15s costuma bastar). Salvar mesmo assim?`)) return;
          Videos.salvarVideo(exId, arq).then(() => carregarVideoExercicio(exId))
            .catch((e) => alert('Não consegui salvar o vídeo: ' + e.message));
        }, { once: true });
        inp.click();
        break;
      }

      case 'apagar-video-exercicio':
        if (confirm('Apagar este vídeo?')) {
          Videos.apagarVideo(alvo.dataset.id).then(() => carregarVideoExercicio(alvo.dataset.id))
            .catch((e) => alert(e.message));
        }
        break;

      // ----- backup -----

      case 'exportar':
        montarBackupZip().then((blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `treino-backup-${new Date().toISOString().slice(0, 10)}.zip`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          Dados.registrarBackupFeito();
          UI.render(); // some com o lembrete de backup na hora, sem esperar reabrir o app
        }).catch((e) => alert('Não consegui gerar o backup: ' + e.message));
        break;

      case 'importar': {
        const inp = document.createElement('input');
        inp.type = 'file';
        inp.accept = '.zip,.json,application/zip,application/json';
        inp.addEventListener('change', async () => {
          const arq = inp.files?.[0];
          if (!arq) return;
          try {
            const lido = await lerBackup(arq);
            if (!confirm('Importar vai substituir suas fichas, perfil, histórico e fotos atuais. Continuar?')) return;
            const { totalVideos, restaurados } = await restaurarBackup(lido);
            if (totalVideos && restaurados < totalVideos) {
              alert(`Dados restaurados. ${restaurados} de ${totalVideos} vídeo(s) recuperado(s) — os demais não estavam no arquivo.`);
            }
            migrarPerfilAntigo();
            Dados.registrarBackupFeito(); // importar prova que existe copia por fora — conta como backup em dia
            UI.ir('inicio');
          } catch (e) {
            alert('Não consegui ler esse arquivo: ' + e.message);
          }
        });
        inp.click();
        break;
      }
    }
    // treino em andamento sempre gravado (ou apagado) depois de qualquer acao
    Dados.salvarExecucao(est.execucao);
    manterTelaAcesa(precisaTelaAcesa());
  });

  // tela acesa durante o treino: com ela apagada o navegador congela o app e o alarme do
  // descanso so toca quando a pessoa volta (auditoria 12/10/2026). O sistema solta sozinho se o
  // app sair da frente; volta a pedir ao reabrir.
  let wakeLock = null;
  // treino aberto na tela, ou cronometro/descanso rodando na tela do cronometro
  const precisaTelaAcesa = () => (!!est.execucao && est.tela === 'execucao') || (!!est.crono.rodando && est.tela === 'cronometro');
  async function manterTelaAcesa(ligar) {
    try {
      if (ligar && !wakeLock && 'wakeLock' in navigator) {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      } else if (!ligar && wakeLock) {
        await wakeLock.release();
        wakeLock = null;
      }
    } catch (e) { /* sem suporte ou economia de bateria: segue sem */ }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') manterTelaAcesa(precisaTelaAcesa());
  });

  // ---------- digitacao (salva sem re-renderizar, para nao perder o foco) ----------

  document.body.addEventListener('input', (ev) => {
    const el = ev.target;

    // busca na biblioteca: re-renderiza e devolve o cursor ao campo
    if (el.dataset.acao === 'buscar') {
      est.busca = el.value;
      est.limite = 40;
      UI.render();
      const novo = document.getElementById('campo-busca');
      if (novo) {
        novo.focus();
        novo.setSelectionRange(novo.value.length, novo.value.length);
      }
      return;
    }

    // calculadoras recalculam ao vivo
    if (el.dataset.calc === '1rm') { UI.calcular1RM(); return; }
    if (el.dataset.calc === 'anilhas') { UI.calcularAnilhas(); return; }

    // nome e observacoes da ficha
    if (el.dataset.campo) {
      const f = fichaAtual();
      if (f) Dados.atualizarFicha(f.id, { [el.dataset.campo]: el.value });
      return;
    }

    // campos de um exercicio da ficha
    if (el.dataset.item !== undefined && el.dataset.prop) {
      const prop = el.dataset.prop;
      let valor = el.value;
      if (['series', 'descanso', 'carga', 'rirAlvo'].includes(prop)) valor = naoVazio(valor) === null ? null : Number(valor);
      const mudancas = { [prop]: valor };
      // reps vem como texto "8-12": guarda tambem os limites, que a progressao usa
      if (prop === 'reps') {
        const partes = String(valor).split('-').map((n) => parseInt(n, 10)).filter((n) => !isNaN(n));
        if (partes.length) {
          mudancas.repsMin = partes[0];
          mudancas.repsMax = partes[partes.length - 1];
        }
      }
      atualizarItem(Number(el.dataset.item), mudancas);
      return;
    }

    // cronometro intervalado: trabalho / descanso / rodadas
    if (el.dataset.crono) {
      const v = Math.max(el.dataset.crono === 'descanso' ? 0 : 1, parseInt(el.value, 10) || 0);
      est.crono.intervalo[el.dataset.crono] = v;
      est.crono.pausadoRestante = null;
      return;
    }

    // spotify: client id
    if (el.id === 'spotify-client-id') {
      Dados.salvarSpotify({ clientId: el.value.trim() });
      return;
    }

    // chamada pro treino: ate 2 horarios
    if (el.dataset.lembreteHora !== undefined) {
      if (!/^\d{1,2}:\d{2}$/.test(el.value)) return;
      const horas = [...Lembretes.horasDoLembrete(Dados.perfil())];
      horas[Number(el.dataset.lembreteHora)] = el.value;
      Dados.salvarPerfil({ lembreteHoras: horas, lembreteHora: horas[0] });
      Lembretes.sincronizarComSW(Dados.perfil());
      return;
    }

    // perfil
    if (el.dataset.perfil) {
      const campo = el.dataset.perfil;
      const numericos = ['peso', 'altura', 'fcRepouso', 'fcMaxMedida', 'freqForca', 'freqCardio', 'barra'];
      const valor = numericos.includes(campo) ? (naoVazio(el.value) === null ? null : Number(el.value)) : el.value;
      Dados.salvarPerfil({ [campo]: valor });
      if (campo === 'lembreteHora') Lembretes.sincronizarComSW(Dados.perfil());
      return;
    }

    // sliders do cardio: atualiza o rotulo na hora
    if (el.dataset.cardio && el.type === 'range') {
      est.cardio[el.dataset.cardio] = Number(el.value);
      const rotulo = el.closest('.campo')?.querySelector('label');
      if (rotulo) {
        rotulo.textContent = el.dataset.cardio === 'minutos'
          ? `Duração alvo: ${el.value} min`
          : `Número de tiros: ${el.value}`;
      }
    }
  });

  // ---------- selects, sliders soltos e saida de campo ----------

  /** Seletor estavel de um campo, para achar o "mesmo" campo depois de um render. */
  function seletorDoCampo(el) {
    if (!el || el === document.body || !el.matches('input, select, textarea')) return null;
    const d = el.dataset;
    if (el.id) return `#${CSS.escape(el.id)}`;
    if (d.perfil) return `[data-perfil="${CSS.escape(d.perfil)}"]`;
    if (d.prop && d.item !== undefined) return `[data-item="${CSS.escape(d.item)}"][data-prop="${CSS.escape(d.prop)}"]`;
    if (d.campo) return `[data-campo="${CSS.escape(d.campo)}"]`;
    return null;
  }

  /** O change dispara ao sair do campo, ANTES do foco chegar no proximo. Redesenhar ali
   *  trocava o proximo campo por um novo e o que a pessoa digitava nele se perdia (auditoria
   *  12/10/2026). Por isso: redesenha no tique seguinte e devolve foco e cursor a quem tem. */
  let renderAdiado = null;
  function renderMantendoFoco() {
    clearTimeout(renderAdiado);
    renderAdiado = setTimeout(() => {
      const ativo = document.activeElement;
      const sel = seletorDoCampo(ativo);
      let cursor = null;
      try { cursor = ativo.selectionStart; } catch (e) { /* number/select nao tem cursor */ }
      UI.render();
      const novo = sel && document.querySelector(sel);
      if (!novo) return;
      novo.focus({ preventScroll: true });
      try { if (cursor !== null) novo.setSelectionRange(cursor, cursor); } catch (e) { /* idem */ }
    }, 0);
  }

  document.body.addEventListener('change', (ev) => {
    const el = ev.target;

    if (el.id === 'ger-objetivo') {
      est.gerador.objetivo = el.value;
      const resumo = document.getElementById('ger-resumo');
      if (resumo) resumo.textContent = Forca.OBJETIVOS[el.value]?.resumo || '';
      return;
    }

    if (el.dataset.filtro) {
      est.filtro[el.dataset.filtro] = el.value;
      est.limite = 40;
      UI.render();
      return;
    }

    if (el.dataset.cardio) {
      const v = el.type === 'range' || el.dataset.cardio === 'minutos' || el.dataset.cardio === 'tiros'
        ? Number(el.value) : el.value;
      est.cardio[el.dataset.cardio] = v;
      UI.render();
      return;
    }

    // select de RIR e campos numericos da ficha: re-renderiza para atualizar a analise
    if ((el.dataset.item !== undefined && el.dataset.prop) || el.dataset.perfil) {
      renderMantendoFoco();
    }
  });

  // ---------- teclado ----------

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') UI.fecharModal();
    // div/span com data-acao (cartoes, itens da lista) acionam com Enter/Espaco como um botao
    if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.getAttribute?.('role') === 'button' && ev.target.dataset.acao) {
      ev.preventDefault();
      ev.target.click();
    }
    if (ev.key === 'Enter' && ev.target.id === 'coach-input') {
      document.querySelector('[data-acao="coach-enviar"]')?.click();
    }
  });
})();
