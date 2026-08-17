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

  function gravarBruto(chave, valor) {
    try {
      localStorage.setItem(chave, JSON.stringify(valor));
      return true;
    } catch (e) {
      // cota estourada: avisa em vez de perder o treino em silencio
      console.error('[dados] falha ao gravar', chave, e);
      alert('Não consegui salvar: o armazenamento do navegador está cheio. Exporte seus dados em Perfil › Backup.');
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

  const ler = (nome, padrao) => lerBruto(chave(nome), padrao);

  // avisa quem se inscrever (nuvem.js, via app.js) toda vez que uma "loja" muda — dados.js
  // continua sem saber nada de rede, so anuncia. Mantem esta camada pura e testavel offline.
  let _aoSalvar = null;
  const aoSalvar = (callback) => { _aoSalvar = callback; };

  function gravar(nome, valor) {
    const ok = gravarBruto(chave(nome), valor);
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
    nivel: 'iniciante',   // iniciante | intermediario | avancado | elite
    local: 'academia',    // academia | casa | parque
    freqForca: 3,         // dias/semana de musculacao
    freqCardio: 2,        // dias/semana de aerobico
    diasTreino: [],        // dias da semana com treino previsto, 0=domingo...6=sabado
    objetivo: 'hipertrofia', // hipertrofia | forca | resistencia | emagrecimento
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

  function registrarSessao(sessao) {
    const lista = sessoes();
    lista.unshift({ id: id(), data: Date.now(), ...sessao });
    gravar('sessoes', lista.slice(0, 300));
    return lista;
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
    // pra nao estourar a cota do localStorage (ver comprimirImagem em app.js)
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

  // ---------- backup ----------

  function exportar() {
    const pid = perfilAtivoId();
    const pacote = { app: 'treino', versao: 1, exportadoEm: new Date().toISOString(), perfilId: pid, dados: {} };
    for (const nome of LOJAS_SINCRONIZAVEIS) {
      pacote.dados[nome] = ler(nome, null);
    }
    return pacote;
  }

  function importar(pacote) {
    if (!pacote || pacote.app !== 'treino') throw new Error('Arquivo não é um backup deste app.');
    for (const [nome, valor] of Object.entries(pacote.dados || {})) {
      if (valor !== null && valor !== undefined) gravar(nome, valor);
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
    registrarCarga, historicoCarga,
    sessoes, registrarSessao, diasTreinados,
    pesos, registrarPeso, apagarPeso,
    fotosEvolucao, registrarFotoEvolucao, apagarFotoEvolucao,
    fotosExercicio, salvarFotoExercicio, apagarFotoExercicio, fotoExercicio,
    gam, salvarGam,
    backupMeta, registrarBackupFeito,
    spotify, salvarSpotify, desconectarSpotify,
    exportar, importar,
    exercicios, acharExercicio,
    aoSalvar, lerLoja, gravarLoja, LOJAS_SINCRONIZAVEIS,
  };
})();
