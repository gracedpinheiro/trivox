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

  const app = document.getElementById('app');

  // ---------- carrega base e perfil ----------

  try {
    const base = await Dados.exercicios();
    UI.setBase(base);
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

  // Pede ao navegador pra tratar o armazenamento deste site como "persistente" — reduz a chance
  // dele ser limpo automaticamente sob pouco espaço (aconteceu de verdade num iPhone: dados
  // sumiram sozinhos no mesmo dia, mesmo icone, sem nenhuma acao da pessoa). Nao garante 100%,
  // principalmente no Safari/iOS onde o efeito e mais limitado — por isso o lembrete de backup
  // na tela inicial continua sendo a defesa principal, esta e so uma camada a mais.
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }

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

  UI.render();

  // ---------- service worker ----------

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('[sw]', e));
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

  let timerId = null;
  const pararTimer = () => { if (timerId) { clearInterval(timerId); timerId = null; } };

  function iniciarTimer() {
    pararTimer();
    timerId = setInterval(() => {
      const ex = est.execucao;
      if (!ex || !ex.descansando) { pararTimer(); return; }
      ex.segundosRestantes--;
      if (ex.segundosRestantes <= 0) { pararTimer(); terminarDescanso(); return; }
      // atualiza so o numero do cronometro, sem reconstruir a tela inteira a cada segundo
      // (o pictograma SVG e o resto do card nao mudam durante o descanso)
      const el = document.getElementById('descanso-timer');
      if (el) {
        const min = Math.floor(ex.segundosRestantes / 60), seg = ex.segundosRestantes % 60;
        el.textContent = `${min}:${String(seg).padStart(2, '0')}`;
      } else {
        UI.render(); // tela nao esta com o cronometro visivel por algum motivo — reconstroi por seguranca
      }
    }, 1000);
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
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
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

  const detectarRecorde = (itens) => itens.some((i) => i.sets.some((s) => (Number(s.carga) || 0) > (i.recordeAnterior || 0)));
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
  async function restaurarBackupZip(arquivo) {
    const entradas = await Zip.ler(arquivo);
    const entradaJson = entradas.find((e) => e.nome === 'backup.json');
    if (!entradaJson) throw new Error('Esse .zip não tem um backup.json dentro — não parece ser um backup do TRIVOX.');
    const pacote = JSON.parse(new TextDecoder().decode(entradaJson.dados));
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

    if (!itensComSet.length) { est.execucao = null; UI.ir('fichas'); return; }

    const volumeTotal = itensComSet.reduce((s, i) => s + i.sets.reduce((t, st) => t + (Number(st.carga) || 0) * (Number(st.reps) || 0), 0), 0);
    const xpGanho = Gamificacao.xpSessaoForca({ numExercicios: itensComSet.length, duracaoMin: Math.round(duracaoSeg / 60) });

    Dados.registrarSessao({
      tipo: 'forca', fichaId: ex.fichaId, fichaNome: ex.fichaNome, duracaoSeg,
      exercicios: itensComSet.map((i) => ({ exId: i.exId, nome: i.nome, sets: i.sets })),
      volumeTotal, xpGanho,
    });

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
    UI.ir('fichas');
    UI.modalResumoTreino({ xpGanho, novosBadges, nivel: nivelDepois, subiuNivel: nivelDepois.chave !== nivelAntes.chave });
  }

  // ---------- cliques ----------

  document.body.addEventListener('click', (ev) => {
    const alvo = ev.target.closest('[data-acao]');
    if (!alvo) return;
    const acao = alvo.dataset.acao;
    if (acao === 'buscar') return; // input, tratado em outro lugar

    switch (acao) {

      case 'ir':
        if (alvo.dataset.voltar) est.voltarTela = alvo.dataset.voltar;
        pararTimer();
        pararSpotify();
        est.escolhendoPara = null;
        est.limite = 40;
        UI.ir(alvo.dataset.tela);
        break;

      case 'fechar-modal':
        UI.fecharModal();
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
        const presc = Forca.prescrever(p.objetivo, ex);
        const itens = [...(f.exercicios || []), {
          exId: ex.id,
          series: presc.series,
          reps: presc.reps,
          repsMin: presc.repsMin,
          repsMax: presc.repsMax,
          rirAlvo: presc.rirAlvo,
          descanso: presc.descanso,
          carga: null,
          obs: '',
        }];
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
        est.voltarTela = alvo.dataset.voltar || est.tela;
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

      case 'gerar-plano': {
        const p = Dados.perfil();
        const objetivo = document.getElementById('ger-objetivo')?.value || p.objetivo;
        est.gerador.objetivo = objetivo;
        // rotacao varia com quantas fichas ja existem — nao usa random, mas "gerar de novo" muda o resultado
        const rotacao = Dados.fichas().length;
        const planos = Forca.gerarPlano({ objetivo, nivel: p.nivel, local: p.local, freqForca: p.freqForca, base: UI.getBase(), rotacao });
        planos.forEach((pl) => {
          const f = Dados.novaFicha(pl.nome);
          Dados.atualizarFicha(f.id, { exercicios: pl.exercicios });
        });
        UI.fecharModal();
        UI.ir('fichas');
        break;
      }

      // ----- execucao do treino -----

      case 'iniciar-treino': {
        const f = Dados.acharFicha(alvo.dataset.id);
        if (!f || !f.exercicios?.length) break;
        const itens = f.exercicios.map((item) => {
          const ex = UI.getBase().find((e) => e.id === item.exId);
          const historicoAntigo = Dados.historicoCarga(item.exId);
          return {
            exId: item.exId, nome: ex?.nome || 'Exercício', icon: ex?.icon || '',
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
        est.execucao = { fichaId: f.id, fichaNome: f.nome, itens, iEx: 0, descansando: false, segundosRestantes: 0, inicioTs: Date.now() };
        UI.ir('execucao');
        iniciarSpotify();
        break;
      }

      case 'concluir-serie': {
        const ex = est.execucao;
        if (!ex) break;
        const item = ex.itens[ex.iEx];
        const carga = parseFloat(document.getElementById('exec-carga')?.value) || 0;
        const reps = parseInt(document.getElementById('exec-reps')?.value, 10) || 0;
        const rirVal = document.getElementById('exec-rir')?.value;
        const rir = rirVal === '' || rirVal === undefined ? null : parseInt(rirVal, 10);
        item.sets.push({ carga, reps, rir });
        Dados.registrarCarga(item.exId, { carga, reps, rir });
        ex.descansando = true;
        ex.segundosRestantes = item.descansoAlvo;
        iniciarTimer();
        UI.render();
        break;
      }

      case 'ajustar-descanso': {
        const ex = est.execucao;
        if (!ex) break;
        ex.segundosRestantes = Math.max(0, ex.segundosRestantes + Number(alvo.dataset.seg));
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

      case 'confirmar-troca': {
        const ex = est.execucao;
        if (!ex) break;
        const novo = UI.getBase().find((e) => e.id === alvo.dataset.id);
        if (!novo) break;
        const item = ex.itens[ex.iEx];
        const historicoNovo = Dados.historicoCarga(novo.id);
        item.exId = novo.id;
        item.nome = novo.nome;
        item.icon = novo.icon;
        item.sets = [];
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
        if (!feitoAlgo) { pararTimer(); pararSpotify(); est.execucao = null; UI.ir('fichas'); break; }
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
        });
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

      // ----- cardio -----

      case 'salvar-cardio': {
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
            const cabecalho = new Uint8Array(await arq.slice(0, 2).arrayBuffer());
            const ehZip = cabecalho[0] === 0x50 && cabecalho[1] === 0x4B; // assinatura "PK" de .zip
            if (!confirm('Importar vai substituir suas fichas, perfil e histórico atuais. Continuar?')) return;
            if (ehZip) {
              const { totalVideos, restaurados } = await restaurarBackupZip(arq);
              if (totalVideos && restaurados < totalVideos) {
                alert(`Dados restaurados. ${restaurados} de ${totalVideos} vídeo(s) recuperado(s) — os demais não estavam no arquivo.`);
              }
            } else {
              Dados.importar(JSON.parse(await arq.text())); // backup antigo, sem video (compatibilidade)
            }
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

    // spotify: client id
    if (el.id === 'spotify-client-id') {
      Dados.salvarSpotify({ clientId: el.value.trim() });
      return;
    }

    // perfil
    if (el.dataset.perfil) {
      const campo = el.dataset.perfil;
      const numericos = ['peso', 'altura', 'fcRepouso', 'fcMaxMedida', 'freqForca', 'freqCardio', 'barra'];
      const valor = numericos.includes(campo) ? (naoVazio(el.value) === null ? null : Number(el.value)) : el.value;
      Dados.salvarPerfil({ [campo]: valor });
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
      UI.render();
    }
  });

  // ---------- teclado ----------

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') UI.fecharModal();
    if (ev.key === 'Enter' && ev.target.id === 'coach-input') {
      document.querySelector('[data-acao="coach-enviar"]')?.click();
    }
  });
})();
