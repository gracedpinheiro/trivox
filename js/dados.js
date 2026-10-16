/* Persistencia local.
   As chaves ja nascem separadas por perfil (at:v1:<perfilId>:<coisa>), entao trocar
   localStorage por um banco na nuvem depois e so reescrever ler/gravar aqui:
   nenhuma tela precisa saber onde o dado mora. */

const Dados = (() => {
  const RAIZ = 'at:v1';
  const K_PERFIS = `${RAIZ}:perfis`;
  const K_ATIVO = `${RAIZ}:perfilAtivo`;

  // ---------- primitivas ----------

  function lerBruto(chave, padrao) {
    try {
      const cru = localStorage.getItem(chave);
      return cru === null ? padrao : JSON.parse(cru);
    } catch (e) {
      console.warn('[dados] falha ao ler', chave, e);
      return padrao;
    }
  }

  let ultimoAlertaCota = 0;
  function gravarBruto(chave, valor) {
    try {
      localStorage.setItem(chave, JSON.stringify(valor));
      return true;
    } catch (e) {
      // cota estourada: avisa em vez de perder o treino em silencio (1x por minuto, nao a cada tecla)
      console.error('[dados] falha ao gravar', chave, e);
      if (Date.now() - ultimoAlertaCota > 60000) {
        ultimoAlertaCota = Date.now();
        alert('Não consegui salvar: o armazenamento do navegador está cheio. Apague fotos antigas ou exporte seus dados em Perfil › Backup.');
      }
      return false;
    }
  }

  function id() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  // ---------- perfis ----------

  function perfis() {
    return lerBruto(K_PERFIS, []);
  }

  function perfilAtivoId() {
    let ativo = lerBruto(K_ATIVO, null);
    const lista = perfis();
    if (!ativo || !lista.some((p) => p.id === ativo)) {
      if (!lista.length) return null;
      ativo = lista[0].id;
      gravarBruto(K_ATIVO, ativo);
    }
    return ativo;
  }

  function criarPerfil(nome) {
    const novo = { id: id(), nome: nome || 'Eu', criadoEm: Date.now() };
    const lista = perfis();
    lista.push(novo);
    gravarBruto(K_PERFIS, lista);
    gravarBruto(K_ATIVO, novo.id);
    return novo;
  }

  function trocarPerfil(pid) {
    if (perfis().some((p) => p.id === pid)) gravarBruto(K_ATIVO, pid);
  }

  // ---------- acesso por perfil ----------

  function chave(nome) {
    const pid = perfilAtivoId();
    if (!pid) throw new Error('nenhum perfil ativo');
    return `${RAIZ}:${pid}:${nome}`;
  }

  // ---------- fotos: IndexedDB, fora da cota do localStorage ----------
  // Cada foto e ~120 KB em texto: 35-40 lotavam os ~5 MB do localStorage e ai nem o treino
  // gravava mais (auditoria 12/10/2026). As duas lojas de foto vivem no IndexedDB, com uma copia
  // em memoria porque as telas desenham de forma sincrona. carregarFotos() roda 1x ao abrir,
  // antes do 1o desenho, e migra o que ainda estiver no localStorage. Sem IndexedDB (ex.: aba
  // privada), tudo continua no localStorage como antes.
  const LOJAS_FOTO = new Set(['fotosEvolucao', 'fotosExercicio']);
  const RE_CHAVE_FOTO = /:(fotosEvolucao|fotosExercicio)$/;
  const memFotos = new Map(); // chave completa -> valor
  let fotosNoBanco = false;
  let bancoFotos = null;

  function abrirBancoFotos() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('trivox-fotos', 1);
      req.onupgradeneeded = () => { req.result.createObjectStore('lojas'); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('Falha ao abrir o banco de fotos.'));
    });
  }

  function gravarFotoNoBanco(k, valor) {
    return new Promise((resolve, reject) => {
      const tx = bancoFotos.transaction('lojas', 'readwrite');
      tx.objectStore('lojas').put(valor, k);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Falha ao salvar a foto.'));
    });
  }

  async function carregarFotos() {
    if (typeof indexedDB === 'undefined') return;
    try {
      bancoFotos = await abrirBancoFotos();
      await new Promise((resolve, reject) => {
        const cur = bancoFotos.transaction('lojas', 'readonly').objectStore('lojas').openCursor();
        cur.onsuccess = (ev) => {
          const c = ev.target.result;
          if (!c) { resolve(); return; }
          memFotos.set(c.key, c.value);
          c.continue();
        };
        cur.onerror = () => reject(cur.error);
      });
      // migracao: so apaga do localStorage depois de gravado no banco
      for (const k of Object.keys(localStorage).filter((x) => RE_CHAVE_FOTO.test(x))) {
        if (!memFotos.has(k)) {
          const v = lerBruto(k, null);
          if (v !== null) { await gravarFotoNoBanco(k, v); memFotos.set(k, v); }
        }
        localStorage.removeItem(k);
      }
      fotosNoBanco = true;
    } catch (e) {
      console.warn('[dados] fotos continuam no localStorage', e);
    }
  }

  /** "Começar do zero": apaga tudo do app neste aparelho (todos os perfis, fotos no IndexedDB e
   *  a configuracao do lembrete do service worker). Videos: Videos.apagarTodos(). */
  async function apagarTudoLocal() {
    for (const k of Object.keys(localStorage)) if (k.startsWith('at:')) localStorage.removeItem(k);
    memFotos.clear();
    if (bancoFotos) {
      await new Promise((resolve) => {
        const tx = bancoFotos.transaction('lojas', 'readwrite');
        tx.objectStore('lojas').clear();
        tx.oncomplete = resolve; tx.onerror = resolve;
      });
    }
    try { await caches.delete('trivox-config'); } catch (e) { /* sem Cache API */ }
  }

  function ler(nome, padrao) {
    if (fotosNoBanco && LOJAS_FOTO.has(nome)) {
      const v = memFotos.get(chave(nome));
      if (v === undefined || v === null) return padrao;
      return Array.isArray(v) ? [...v] : { ...v }; // copia: quem le pode mexer antes de gravar
    }
    return lerBruto(chave(nome), padrao);
  }

  // avisa quem se inscrever (nuvem.js, via app.js) toda vez que uma "loja" muda — dados.js
  // continua sem saber nada de rede, so anuncia. Mantem esta camada pura e testavel offline.
  let _aoSalvar = null;
  const aoSalvar = (callback) => { _aoSalvar = callback; };

  function gravar(nome, valor) {
    let ok;
    if (fotosNoBanco && LOJAS_FOTO.has(nome)) {
      const k = chave(nome);
      memFotos.set(k, valor);
      gravarFotoNoBanco(k, valor).catch((e) => {
        console.error('[dados] falha ao gravar foto', e);
        alert('Não consegui salvar a foto neste aparelho: ' + e.message);
      });
      ok = true;
    } else {
      ok = gravarBruto(chave(nome), valor);
    }
    if (ok && _aoSalvar) _aoSalvar(nome, valor);
    return ok;
  }

  // acesso generico por nome de loja — usado so por exportar/importar (.zip) e pela
  // sincronizacao com a nuvem, que tratam toda loja do mesmo jeito (nome + valor JSON)
  const lerLoja = (nome) => ler(nome, null);
  const gravarLoja = (nome, valor) => gravar(nome, valor);

  // lojas que saem do aparelho (backup .zip e nuvem) — deliberadamente SEM 'spotify' nem
  // qualquer sessao/token: credenciais nunca saem do aparelho, so dado de treino sai.
  const LOJAS_SINCRONIZAVEIS = ['perfil', 'fichas', 'cardios', 'cargas', 'sessoes', 'gam', 'pesos', 'fotosEvolucao', 'fotosExercicio'];

  // treino em andamento: so neste aparelho (fora da nuvem e do backup). Sobrevive a recarregar
  // ou ao iOS fechar o app no meio do treino. Falha de cota aqui nao alerta: e conveniencia.
  const execucaoSalva = () => ler('execucao', null);
  function salvarExecucao(ex) {
    try {
      if (ex) localStorage.setItem(chave('execucao'), JSON.stringify(ex));
      else localStorage.removeItem(chave('execucao'));
    } catch (e) { console.warn('[dados] treino em andamento nao salvo', e); }
  }

  // ---------- perfil (medidas e preferencias) ----------

  const PERFIL_PADRAO = {
    nome: '',
    nascimento: '',       // aaaa-mm-dd
    sexo: '',             // f | m | outro
    peso: null,           // kg — sempre a pesagem mais recente (ver registrarPeso)
    altura: null,         // cm
    foto: null,            // dataURL (jpeg comprimido) — foto de perfil, opcional
    fcRepouso: null,      // bpm, medida deitada ao acordar
    fcMaxMedida: null,    // bpm, se ja fez teste de esforco
    nivel: 'iniciante',   // iniciante | intermediario | avancado (elite antigo = avancado na tela)
    local: 'academia',    // academia | casa (parque antigo ainda aceito)
    freqForca: 3,         // dias/semana de musculacao
    freqCardio: 2,        // dias/semana de aerobico
    diasTreino: [],        // dias da semana com treino previsto, 0=domingo...6=sabado
    objetivo: 'condicionamento', // condicionamento | perda_peso | hipertrofia | 50mais | raquete (antigos forca/resistencia/emagrecimento ainda aceitos)
    equipCasa: null,      // equipamentos que tem em casa (chaves de aparelho; null = padrao de js/programas.js)
    esporte: null,        // 'pickleball' | 'beach_tennis' — so pro objetivo raquete
    objetivos: [],        // 1-2 objetivos de treino + "50mais" opcional; o 1o de treino e o principal (= objetivo)
    esportes: [],         // raquete: 'pickleball' e/ou 'beach_tennis' (antes era um so, em "esporte")
    lembreteHoras: [],    // ate 2 horarios no mesmo dia (antes um so, em "lembreteHora")
    parq: null,           // triagem de saude: { respostas: [true|false|null x7], em } — ver UI.PARQ
    diasJogo: [],         // dias da semana com jogo (0-6) — treino de perna pesado sai desses dias e da vespera
    enfase: 'auto',       // auto | neutra | inferiores | superiores | gluteos
    lembreteAtivo: false, // chamada diaria pro treino (ver js/lembretes.js)
    lembreteHora: '18:00',
    barra: 20,            // kg da barra usada como padrao
    anilhas: [20, 15, 10, 5, 2.5, 1.25],
  };

  const perfil = () => ({ ...PERFIL_PADRAO, ...ler('perfil', {}) });
  const salvarPerfil = (p) => gravar('perfil', { ...perfil(), ...p });

  function idade() {
    const n = perfil().nascimento;
    if (!n) return null;
    const d = new Date(n);
    if (isNaN(d)) return null;
    const hoje = new Date();
    let a = hoje.getFullYear() - d.getFullYear();
    const m = hoje.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && hoje.getDate() < d.getDate())) a--;
    return a >= 0 && a < 120 ? a : null;
  }

  // ---------- fichas de musculacao ----------
  // ficha: { id, nome, obs, criadaEm, exercicios: [ItemFicha] }
  // ItemFicha: { exId, series, reps, rirAlvo, descanso (s), carga (kg|null), obs }

  const fichas = () => ler('fichas', []);
  const salvarFichas = (lista) => gravar('fichas', lista);

  function novaFicha(nome) {
    const f = {
      id: id(), nome: nome || 'Novo treino', obs: '', criadaEm: Date.now(), exercicios: [],
      diaSemana: null,       // 0=domingo...6=sabado, ligado quando vem do gerador automatico
      ultimaVariacaoEm: null, // ver Forca.precisaVariar/variarFicha — evita monotonia
    };
    const lista = fichas();
    lista.push(f);
    salvarFichas(lista);
    return f;
  }

  function acharFicha(fid) {
    return fichas().find((f) => f.id === fid) || null;
  }

  function atualizarFicha(fid, mudancas) {
    const lista = fichas();
    const i = lista.findIndex((f) => f.id === fid);
    if (i < 0) return null;
    lista[i] = { ...lista[i], ...mudancas };
    salvarFichas(lista);
    return lista[i];
  }

  function apagarFicha(fid) {
    salvarFichas(fichas().filter((f) => f.id !== fid));
  }

  function duplicarFicha(fid) {
    const orig = acharFicha(fid);
    if (!orig) return null;
    const copia = {
      ...orig,
      id: id(),
      nome: `${orig.nome} (cópia)`,
      criadaEm: Date.now(),
      exercicios: orig.exercicios.map((e) => ({ ...e })),
    };
    const lista = fichas();
    lista.push(copia);
    salvarFichas(lista);
    return copia;
  }

  // ---------- sessoes de cardio ----------
  // { id, nome, tipo, modalidade, duracao, criadaEm, blocos: [...] }

  const cardios = () => ler('cardios', []);
  const salvarCardios = (lista) => gravar('cardios', lista);

  function salvarCardio(sessao) {
    const lista = cardios();
    const i = lista.findIndex((s) => s.id === sessao.id);
    if (i >= 0) lista[i] = sessao;
    else lista.push({ ...sessao, id: sessao.id || id(), criadaEm: Date.now() });
    salvarCardios(lista);
    return lista;
  }

  const apagarCardio = (cid) => salvarCardios(cardios().filter((s) => s.id !== cid));

  // ---------- historico de cargas ----------
  // { exId: [{ data, carga, reps, rir }] }  — mais recente primeiro

  const cargas = () => ler('cargas', {});

  function registrarCarga(exId, registro) {
    const todas = cargas();
    const serie = todas[exId] || [];
    serie.unshift({ data: Date.now(), ...registro });
    todas[exId] = serie.slice(0, 60);
    gravar('cargas', todas);
    return todas[exId];
  }

  const historicoCarga = (exId) => cargas()[exId] || [];

  // ---------- sessoes de treino executado ----------
  // sessao: { id, tipo: 'forca'|'cardio', data, fichaId, fichaNome, duracaoSeg,
  //           exercicios: [{ exId, nome, sets: [{ carga, reps, rir }] }],  // so em 'forca'
  //           cardioResumo: { nome, modalidade, duracao },                // so em 'cardio'
  //           volumeTotal, xpGanho }
  // mais recente primeiro.

  const sessoes = () => ler('sessoes', []);

  /** Series e cargas da ultima vez que o exercicio foi feito: { data, fichaNome, sets: [{carga, reps, rir}] } ou null. */
  function ultimoRegistro(exId) {
    for (const s of sessoes()) {
      const e = (s.exercicios || []).find((x) => x.exId === exId && (x.sets || []).length);
      if (e) return { data: s.data, fichaNome: s.fichaNome, sets: e.sets };
    }
    // sessoes antigas sem detalhe: cai pro historico de cargas (series do mesmo dia)
    const h = historicoCarga(exId);
    if (!h.length) return null;
    const dia = new Date(h[0].data).toDateString();
    const sets = h.filter((r) => new Date(r.data).toDateString() === dia).reverse();
    return { data: h[0].data, fichaNome: '', sets };
  }

  function registrarSessao(sessao) {
    const lista = sessoes();
    lista.unshift({ id: id(), data: Date.now(), ...sessao });
    return gravar('sessoes', lista.slice(0, 300)); // false = cota cheia, a sessao NAO foi salva
  }

  /** Dias distintos (aaaa-mm-dd, fuso local) em que houve pelo menos 1 sessão. */
  function diasTreinados() {
    const chave = (ts) => new Date(ts).toLocaleDateString('sv-SE'); // aaaa-mm-dd estavel
    return [...new Set(sessoes().map((s) => chave(s.data)))].sort();
  }

  // ---------- peso e bioimpedancia ----------
  // registro: { id, data, peso (kg, obrigatorio),
  //             gordura (%), massaMuscular (kg), agua (%), visceral (nivel), tmb (kcal) — todos opcionais,
  //             so preenche quem tem balanca de bioimpedancia }
  // mais recente primeiro.

  const pesos = () => ler('pesos', []);

  function registrarPeso(registro) {
    if (!(Number(registro.peso) > 0)) throw new Error('Peso precisa ser maior que zero.');
    const lista = pesos();
    const novo = { id: id(), data: Date.now(), ...registro };
    lista.unshift(novo);
    lista.sort((a, b) => b.data - a.data);
    gravar('pesos', lista.slice(0, 500)); // ~10 anos de pesagem semanal, ou ~1,5 ano diaria
    // mantem o "peso atual" do perfil sincronizado com a pesagem mais recente
    if (lista[0].id === novo.id) salvarPerfil({ peso: novo.peso });
    return novo;
  }

  const apagarPeso = (pid) => gravar('pesos', pesos().filter((p) => p.id !== pid));

  // ---------- fotos de evolucao (antes/depois) ----------
  // registro: { id, data, foto (dataURL jpeg comprimido), nota (opcional) } — mais recente primeiro.
  // fica separado da foto de perfil (perfil.foto): perfil e so 1 imagem atual, aqui e um historico.

  const fotosEvolucao = () => ler('fotosEvolucao', []);

  function registrarFotoEvolucao(registro) {
    if (!registro.foto) throw new Error('Foto obrigatória.');
    const lista = fotosEvolucao();
    const novo = { id: id(), data: Date.now(), nota: '', ...registro };
    lista.unshift(novo);
    lista.sort((a, b) => b.data - a.data);
    // fotos pesam muito mais que um numero de peso — teto mais conservador que o de pesos()
    // (ficam no IndexedDB, mas tambem vao inteiras no backup e na nuvem)
    gravar('fotosEvolucao', lista.slice(0, 120));
    return novo;
  }

  const apagarFotoEvolucao = (fid) => gravar('fotosEvolucao', fotosEvolucao().filter((f) => f.id !== fid));

  // ---------- foto personalizada por exercicio ----------
  // substitui a foto pre-cadastrada (ou o pictograma) pela foto real tirada pela propria pessoa,
  // exercicio por exercicio, a medida que ela vai treinando. mapa: { [exId]: { foto, atualizadoEm } }
  // (o video de cada exercicio NAO fica aqui — video pesa MB, nao KB, e vive no IndexedDB via
  // js/videos.js, fora do localStorage)

  const fotosExercicio = () => ler('fotosExercicio', {});

  function salvarFotoExercicio(exId, dataUrl) {
    const mapa = fotosExercicio();
    mapa[exId] = { foto: dataUrl, atualizadoEm: Date.now() };
    gravar('fotosExercicio', mapa);
  }

  function apagarFotoExercicio(exId) {
    const mapa = fotosExercicio();
    delete mapa[exId];
    gravar('fotosExercicio', mapa);
  }

  const fotoExercicio = (exId) => fotosExercicio()[exId]?.foto || null;

  // ---------- gamificacao ----------

  const GAM_PADRAO = { xp: 0, badges: [] };
  const gam = () => ({ ...GAM_PADRAO, ...ler('gam', {}) });
  const salvarGam = (patch) => gravar('gam', { ...gam(), ...patch });

  // ---------- apagar treinos feitos (testes) — perfil, fichas, pesagens e fotos ficam ----------

  /** Apaga um treino do historico: a sessao, as cargas registradas durante ela (mesmos
   *  exercicios, entre o inicio e o fim da sessao) e o XP que ela deu. Conquistas ficam. */
  function apagarSessao(sid) {
    const lista = sessoes();
    const s = lista.find((x) => x.id === sid);
    if (!s) return;
    gravar('sessoes', lista.filter((x) => x.id !== sid));
    const inicio = s.data - (s.duracaoSeg || 0) * 1000 - 5 * 60000; // folga: series antes do cronometro
    const fim = s.data + 60000;
    const todas = cargas();
    let mudou = false;
    for (const { exId } of s.exercicios || []) {
      if (!todas[exId]) continue;
      const resto = todas[exId].filter((r) => r.data < inicio || r.data > fim);
      if (resto.length === todas[exId].length) continue;
      mudou = true;
      if (resto.length) todas[exId] = resto; else delete todas[exId];
    }
    if (mudou) gravar('cargas', todas);
    if (s.xpGanho) salvarGam({ xp: Math.max(0, gam().xp - s.xpGanho) });
  }

  /** Apaga todo o historico de treinos feitos: sessoes, cargas, XP e conquistas. */
  function apagarHistoricoTreinos() {
    gravar('sessoes', []);
    gravar('cargas', {});
    gravar('gam', { ...GAM_PADRAO });
  }

  // ---------- spotify ----------
  // tokens NAO entram no backup exportavel — sao credenciais, nao dado de treino.
  // se o arquivo de backup vazar ou for compartilhado, nao da acesso a conta Spotify de ninguem.

  const SPOTIFY_PADRAO = { clientId: '', accessToken: null, refreshToken: null, expiraEm: 0 };
  const spotify = () => ({ ...SPOTIFY_PADRAO, ...ler('spotify', {}) });
  const salvarSpotify = (patch) => gravar('spotify', { ...spotify(), ...patch });
  const desconectarSpotify = () => gravar('spotify', { ...SPOTIFY_PADRAO, clientId: spotify().clientId });

  // ---------- lembrete de backup ----------
  // so guarda quando foi o ultimo export/import bem sucedido, pra avisar na tela inicial se
  // fizer tempo demais sem backup. Existe por causa de um caso real: dados sumiram sozinhos
  // num iPhone (mesmo dia, mesmo icone, sem nenhuma acao dela) — o navegador/SO pode limpar o
  // armazenamento do site sem aviso, principalmente com pouco espaco livre. Nao tem como o app
  // impedir isso 100% (nao e bug de codigo, e o proprio limite do localStorage), entao a defesa
  // e lembrar com frequencia de tirar uma copia por fora.

  const BACKUP_PADRAO = { ultimoEm: null };
  const backupMeta = () => ({ ...BACKUP_PADRAO, ...ler('backupMeta', {}) });
  const registrarBackupFeito = () => gravar('backupMeta', { ...backupMeta(), ultimoEm: Date.now() });
  /** Ultimo envio para a nuvem que DEU CERTO (o "ultimoEm" acima e de export/login). */
  const registrarEnvioNuvem = () => gravarBruto(chave('backupMeta'), { ...backupMeta(), nuvemOkEm: Date.now() });

  // ---------- backup ----------

  function exportar() {
    const pid = perfilAtivoId();
    const pacote = { app: 'treino', versao: 1, exportadoEm: new Date().toISOString(), perfilId: pid, dados: {} };
    for (const nome of LOJAS_SINCRONIZAVEIS) {
      pacote.dados[nome] = ler(nome, null);
    }
    return pacote;
  }

  // forma de cada loja (lista ou objeto): valida o backup e "zera" a loja que nao veio nele
  const LOJAS_LISTA = new Set(['fichas', 'cardios', 'sessoes', 'pesos', 'fotosEvolucao']);

  /** Lanca erro se o pacote nao for um backup valido — chamado ANTES de perguntar "substituir?". */
  function validarBackup(pacote) {
    if (!pacote || pacote.app !== 'treino' || !pacote.dados || typeof pacote.dados !== 'object') {
      throw new Error('Arquivo não é um backup deste app.');
    }
    for (const nome of LOJAS_SINCRONIZAVEIS) {
      const v = pacote.dados[nome];
      if (v === null || v === undefined) continue;
      const ok = LOJAS_LISTA.has(nome) ? Array.isArray(v) : typeof v === 'object' && !Array.isArray(v);
      if (!ok) throw new Error(`O backup está com "${nome}" num formato que não reconheço.`);
    }
  }

  /** Substitui de verdade: so as lojas de treino (nunca spotify/backupMeta), e a que nao veio no
   *  backup fica vazia — antes, as fotos de quem estava no aparelho ficavam misturadas. */
  function importar(pacote) {
    validarBackup(pacote);
    for (const nome of LOJAS_SINCRONIZAVEIS) {
      let v = pacote.dados[nome];
      if (nome === 'perfil' && v) {
        v = { ...v };
        // lista vinda como null quebrava as telas (p.diasTreino.includes)
        for (const k of ['diasTreino', 'diasJogo', 'equipCasa']) if (v[k] !== undefined && !Array.isArray(v[k])) delete v[k];
      }
      gravar(nome, v ?? (LOJAS_LISTA.has(nome) ? [] : {}));
    }
  }

  // ---------- base de exercicios ----------

  let _exercicios = null;

  async function exercicios() {
    if (_exercicios) return _exercicios;
    const resp = await fetch('./data/exercicios.json');
    if (!resp.ok) throw new Error('Não consegui carregar a base de exercícios.');
    _exercicios = await resp.json();
    return _exercicios;
  }

  const acharExercicio = (exId) => (_exercicios || []).find((e) => e.id === exId) || null;

  return {
    id, perfis, perfilAtivoId, criarPerfil, trocarPerfil,
    perfil, salvarPerfil, idade, PERFIL_PADRAO,
    fichas, novaFicha, acharFicha, atualizarFicha, apagarFicha, duplicarFicha, salvarFichas,
    cardios, salvarCardio, apagarCardio,
    registrarCarga, historicoCarga, ultimoRegistro,
    sessoes, registrarSessao, diasTreinados, apagarSessao, apagarHistoricoTreinos,
    pesos, registrarPeso, apagarPeso,
    fotosEvolucao, registrarFotoEvolucao, apagarFotoEvolucao,
    fotosExercicio, salvarFotoExercicio, apagarFotoExercicio, fotoExercicio,
    gam, salvarGam,
    backupMeta, registrarBackupFeito, registrarEnvioNuvem,
    spotify, salvarSpotify, desconectarSpotify,
    exportar, importar, validarBackup,
    exercicios, acharExercicio,
    aoSalvar, lerLoja, gravarLoja, LOJAS_SINCRONIZAVEIS,
    execucaoSalva, salvarExecucao, carregarFotos, apagarTudoLocal,
  };
})();
