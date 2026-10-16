/* Telas do app. Render por string + delegacao de eventos:
   sem framework, sem build, e ainda assim cada tela fica isolada numa funcao. */

const UI = (() => {
  const app = () => document.getElementById('app');

  const estado = {
    tela: 'inicio',
    fichaId: null,
    escolhendoPara: null,      // id da ficha esperando um exercicio da biblioteca
    busca: '',
    filtro: { categoria: '', nivel: '', equipamento: '', local: '', objetivo: '' },
    limite: 40,
    cardio: { modelo: 'base', minutos: 40, modalidade: 'corrida', tiros: 12 },
    exercicioId: null,          // exercicio aberto na tela de detalhe
    midiaAba: null,             // aba de imagem escolhida (fotos/como/musculos/aparelho) — volta ao padrao ao trocar de exercicio
    voltarTela: 'biblioteca',   // pra onde o botao "voltar" da tela de detalhe leva
    execucao: null,             // sessao de treino em andamento (ver criarExecucao)
    coach: { mensagens: [] },
    gerador: { objetivo: null },
    sessaoExpandida: null,       // id da sessao aberta no historico da tela de evolucao
    fotoTemp: null,              // dataURL de foto de evolucao escolhida, aguardando confirmacao no modal
    nuvem: { sessao: null, linkEnviadoPara: null, pendentes: 0 }, // ver js/nuvem.js — sessao do Supabase, espelhada aqui pra tela ler
    crono: { modo: 'timer', total: 60, rodando: false, ate: 0, pausadoRestante: null, inicio: 0, acumulado: 0, voltas: [],
      intervalo: { trabalho: 40, descanso: 20, rodadas: 8, fase: 'trabalho', rodada: 1 } },
  };

  let BASE = [];               // base de exercicios carregada

  // ---------- utilitarios ----------

  /** Escapa texto antes de jogar no HTML — o usuario digita nomes de ficha. */
  function h(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  const num = (v) => (v === null || v === undefined || v === '' ? '—' : v);
  // em <input type=number> o "—" gera aviso no console e o campo fica estranho: vazio e o certo
  const numCampo = (v) => (v === null || v === undefined || v === '' ? '' : h(v));

  // ---------- triagem de saude (PAR-Q+, perguntas gerais) ----------
  // 1 minuto, pedida no Inicio para quem tem 50+ ou IMC >= 30. Algum "sim": aviso de liberacao
  // medica e o aerobico fica so em Z1-Z2 (Aerobico.soLeve). Nao e diagnostico, e triagem.
  const PARQ = [
    'Algum médico já disse que você tem problema de coração ou pressão alta?',
    'Você sente dor no peito em repouso, no dia a dia ou quando faz atividade física?',
    'Você perde o equilíbrio por tontura ou desmaiou nos últimos 12 meses?',
    'Você já recebeu diagnóstico de outra doença crônica (como diabetes, doença nos rins ou no pulmão)?',
    'Você toma remédio para alguma doença crônica?',
    'Você tem problema de osso, articulação ou coluna que pode piorar com atividade física?',
    'Algum médico já disse que você só deve fazer atividade física com supervisão?',
  ];
  const parqRespostas = (p) => (p.parq && Array.isArray(p.parq.respostas) ? p.parq.respostas : []);
  const parqRespondido = (p) => PARQ.every((_, i) => typeof parqRespostas(p)[i] === 'boolean');
  const parqTemSim = (p) => parqRespostas(p).some((r) => r === true);
  function precisaParq(p, idade) {
    const imc = p.peso && p.altura ? p.peso / Math.pow(p.altura / 100, 2) : 0;
    return !parqRespondido(p) && ((idade || 0) >= 50 || imc >= 30);
  }
  const SINAIS_PARAR = 'Pare na hora se sentir dor ou aperto no peito, falta de ar fora do normal, tontura ou palpitação — e procure atendimento (SAMU 192).';

  /** Tira acentos para a busca: quem digita no celular escreve "gluteo", não "glúteo". */
  const semAcento = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  function minutosTexto(m) {
    if (m < 60) return `${m} min`;
    const hh = Math.floor(m / 60), mm = m % 60;
    return mm ? `${hh}h${String(mm).padStart(2, '0')}` : `${hh}h`;
  }

  const NOME_CATEGORIA = {
    pernas: 'Pernas', costas: 'Costas', peito: 'Peito', ombros: 'Ombros',
    biceps: 'Bíceps', triceps: 'Tríceps', core: 'Core', cardio: 'Cardio',
    funcional: 'Funcional', mobilidade: 'Mobilidade', skills: 'Skills',
    empurrar: 'Empurrar (calistenia)', puxar: 'Puxar (calistenia)',
    pernas_cal: 'Pernas (calistenia)', core_cal: 'Core (calistenia)',
    gluteos: 'Glúteos', alongamento: 'Alongamento', equilibrio: 'Equilíbrio',
  };

  const NOME_NIVEL = { iniciante: 'Iniciante', intermediario: 'Intermediário', avancado: 'Avançado', elite: 'Elite' };

  // indice 0 = domingo, igual ao Date.getDay() do JS
  const DIAS_SEMANA = [
    { curta: 'D', nome: 'Domingo' }, { curta: 'S', nome: 'Segunda' }, { curta: 'T', nome: 'Terça' },
    { curta: 'Q', nome: 'Quarta' }, { curta: 'Q', nome: 'Quinta' }, { curta: 'S', nome: 'Sexta' }, { curta: 'S', nome: 'Sábado' },
  ];

  const NOME_OBJETIVO_CURTO = {
    condicionamento: 'Condicionamento', perda_peso: 'Perda de peso', hipertrofia: 'Hipertrofia',
    '50mais': 'Especial 50+', raquete: 'Raquete',
  };
  const NOME_BLOCO = {
    aquecimento: 'Aquecimento', principal: 'Treino principal', equilibrio: 'Equilíbrio',
    circuito: 'Circuito', volta_calma: 'Alongamento final',
  };
  const ORDEM_BLOCO = ['aquecimento', 'principal', 'equilibrio', 'circuito', 'volta_calma'];
  const blocoDe = (item) => item.bloco || 'principal';
  /** Itens "simples" (aquecimento, alongamento, equilibrio, por tempo): sem carga/RIR na execucao. */
  const ehItemSimples = (item) => ['aquecimento', 'volta_calma', 'equilibrio'].includes(item.bloco) || (!!item.tempoSeg && item.bloco !== 'principal');
  const nivelTela = (n) => (n === 'elite' ? 'avancado' : n);
  const nomeAparelho = (k) => ((typeof Figuras !== 'undefined') && Figuras.APARELHOS && Figuras.APARELHOS[k]) || k || '';

  // ilustracao gerada por IA (data/ilustracoes/indice.json: exId -> arquivo), inicio -> fim
  let ILUSTRACOES = {};
  const ilustracaoDe = (exId) => (ILUSTRACOES[exId] ? `data/ilustracoes/${ILUSTRACOES[exId]}` : null);

  /** Miniatura pra listas: foto real (ou a do usuario) se tiver; senao o mapa muscular pequeno. */
  function thumbExercicio(e) {
    if (!e) return '🏋️';
    const foto = Dados.fotoExercicio(e.id) || (e.imagens && e.imagens[0]);
    const mapa = (typeof MapaMuscular !== 'undefined') ? MapaMuscular.miniatura(e.musculos_primarios || [], e.musculos_secundarios || []) : '';
    // offline, foto nunca vista nao carrega: troca pelo mapa muscular em vez de ficar em branco
    if (foto) return `<img src="${h(foto)}" alt="" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden>${mapa}</span>`;
    if (mapa) return mapa;
    return h(e.icon || '🏋️');
  }

  /**
   * Bloco de imagens do exercicio, em abas:
   *  - "Como fazer": ilustracao animada (todo exercicio tem — js/figuras.js)
   *  - "Fotos": fotos reais de inicio/fim do movimento (quando existem)
   *  - "Músculos": mapa do corpo frente/costas com a regiao trabalhada (js/mapa-muscular.js)
   *  - "Aparelho": desenho do equipamento
   *  - "Minha foto": foto que o proprio usuario tirou
   */
  function midiaExercicio(e, { compacto = false } = {}) {
    const fotoPropria = Dados.fotoExercicio(e.id);
    const temFotos = !!(e.imagens && e.imagens.length);
    const abas = [];
    if (fotoPropria) abas.push(['minha', 'Minha foto']);
    if (temFotos) abas.push(['fotos', 'Fotos']);
    abas.push(['como', 'Como fazer']);
    abas.push(['musculos', 'Músculos']);
    if (e.aparelho) abas.push(['aparelho', 'Aparelho']);
    const escolhida = estado.midiaAba && abas.some(([k]) => k === estado.midiaAba) ? estado.midiaAba : abas[0][0];
    const reduzSistema = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    let palco = '', legenda = '';
    if (escolhida === 'minha') {
      palco = `<img src="${h(fotoPropria)}" alt="${h(e.nome)}" style="object-fit:cover;max-height:340px">`;
      legenda = 'sua foto';
    } else if (escolhida === 'como' && ilustracaoDe(e.id)) {
      palco = `<img src="${h(ilustracaoDe(e.id))}" alt="${h(e.nome)}: posição inicial e final" loading="lazy" style="background:#F2F7FF">`;
      legenda = 'posição inicial → final';
    } else if (escolhida === 'como') {
      // estado.animacaoParada: botao "parar animacao" (WCAG 2.2.2); sem ele, segue o sistema
      const parada = estado.animacaoParada || reduzSistema;
      palco = (typeof Figuras !== 'undefined') ? Figuras.svg(e, { largura: compacto ? 320 : 380, quadros: parada || undefined }) : Pictogramas.svgPara(e.categoria);
      legenda = parada ? 'posições do movimento, da inicial à final' : 'ilustração animada do movimento';
    } else if (escolhida === 'fotos') {
      palco = `<div class="fotos">${e.imagens.map((img) => `<img src="${h(img)}" alt="${h(e.nome)}" loading="lazy">`).join('')}</div>`;
      legenda = e.imagens.length > 1 ? 'início e fim do movimento' : 'referência de execução';
    } else if (escolhida === 'musculos') {
      palco = MapaMuscular.svg(e.musculos_primarios || [], e.musculos_secundarios || [], { largura: compacto ? 230 : 280, legenda: true });
      legenda = (e.musculos_primarios || []).join(', ');
    } else if (escolhida === 'aparelho') {
      palco = Figuras.aparelho(e.aparelho, { largura: compacto ? 200 : 240 });
      legenda = e.equipamento || nomeAparelho(e.aparelho);
    }
    return `
      <div class="cartao midia ${compacto ? 'midia-compacta' : ''}">
        <div class="midia-abas" role="tablist">
          ${abas.map(([k, rot]) => `<button class="midia-aba ${k === escolhida ? 'ativo' : ''}" role="tab" aria-selected="${k === escolhida}" data-acao="midia-aba" data-aba="${k}">${rot}</button>`).join('')}
        </div>
        <div class="midia-palco" data-acao="ampliar-midia" aria-label="Ampliar imagem" style="cursor:zoom-in;${compacto ? 'min-height:150px' : ''}">${palco}</div>
        ${legenda ? `<div class="midia-legenda">${h(legenda)} · toque para ampliar</div>` : '<div class="midia-legenda">toque para ampliar</div>'}
        ${escolhida === 'como' && !reduzSistema && !ilustracaoDe(e.id) ? `<button class="btn btn-pequeno btn-fantasma" data-acao="alternar-animacao" style="margin-top:4px">${estado.animacaoParada ? 'Animar' : 'Parar animação'}</button>` : ''}
      </div>`;
  }

  /** "Última vez": series e cargas registradas no ultimo treino desse exercicio. */
  function ultimoTreinoHtml(exId) {
    const u = Dados.ultimoRegistro(exId);
    if (!u || !u.sets.length) return '';
    const data = new Date(u.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    return `<div class="ultimo-treino"><div class="rotulo">Última vez · ${data}</div>${resumoSeries(u.sets)}</div>`;
  }

  /** "3 séries de 8 reps com 40 kg" quando todas iguais; senao "3 séries: 40 kg × 8, 40 kg × 8, 37,5 kg × 7". */
  function resumoSeries(sets) {
    const n = sets.length;
    const kg = (c) => h(String(c).replace('.', ',')); // 42,5 kg
    const txt = (st) => `${st.carga ? kg(st.carga) + ' kg × ' : ''}${h(st.reps)}${st.carga ? '' : ' reps'}`;
    const iguais = sets.every((st) => String(st.carga) === String(sets[0].carga) && String(st.reps) === String(sets[0].reps));
    if (iguais) return `<b>${n} série${n === 1 ? '' : 's'}</b> de ${h(sets[0].reps)} reps${sets[0].carga ? ` com ${kg(sets[0].carga)} kg` : ''}`;
    return `<b>${n} séries:</b> ${sets.map(txt).join(', ')}`;
  }

  // ---------- modal ----------

  function abrirModal(html) {
    fecharModal();
    const fundo = document.createElement('div');
    fundo.className = 'modal-fundo';
    fundo.id = 'modal-fundo';
    fundo.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><div class="modal-alca"></div>${html}</div>`;
    acessibilidade(fundo);
    fundo.addEventListener('click', (ev) => { if (ev.target === fundo) fecharModal(); });
    document.body.appendChild(fundo);
  }

  function fecharModal() {
    document.getElementById('modal-fundo')?.remove();
  }

  // ---------- navegacao ----------

  function ir(tela, extra = {}) {
    estado.tela = tela;
    Object.assign(estado, extra);
    fecharModal();
    window.scrollTo(0, 0);
    render();
  }

  // icones de traco (24x24, cor do texto), no lugar de emoji na barra de baixo e nos atalhos
  const ICONES = {
    inicio: '<path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"/>',
    fichas: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 9h6M9 13h6M9 17h3"/>',
    cardio: '<path d="M3 12h4l2-5 4 10 2-5h6"/>',
    evolucao: '<path d="M4 19h16"/><path d="M5 15l4.5-4.5 3.5 3L19 7"/><path d="M15 7h4v4"/>',
    perfil: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c1-3.6 3.8-5.5 7-5.5s6 1.9 7 5.5"/>',
    relogio: '<circle cx="12" cy="13" r="7.5"/><path d="M12 9.5V13l2.5 2M10 3h4"/>',
    haltere: '<path d="M6.5 8v8M17.5 8v8M3.5 10v4M20.5 10v4M6.5 12h11"/>',
    conversa: '<path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-4 3.5V16H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/>',
  };
  const icone = (nome) => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${ICONES[nome]}</svg>`;

  const ABAS = [
    { chave: 'inicio', nome: 'Início' },
    { chave: 'fichas', nome: 'Treinos' },
    { chave: 'cardio', nome: 'Aeróbico' },
    { chave: 'evolucao', nome: 'Evolução' },
    { chave: 'perfil', nome: 'Perfil' },
  ];

  function renderNav() {
    const mapa = {
      ficha: 'fichas', execucao: 'fichas',
      biblioteca: estado.escolhendoPara ? 'fichas' : '',
      exercicio: ABAS.some((a) => a.chave === estado.voltarTela) ? estado.voltarTela : '',
      coach: 'evolucao',
      cronometro: estado.execucao ? 'fichas' : 'inicio',
    };
    const ativo = mapa[estado.tela] !== undefined ? mapa[estado.tela] : estado.tela;
    document.getElementById('nav').innerHTML = ABAS.map((a) => `
      <button data-acao="ir" data-tela="${a.chave}" class="${ativo === a.chave ? 'ativo' : ''}">
        <span class="ic">${icone(a.chave)}</span>${a.nome}
      </button>`).join('');
  }

  // ---------- tela: inicio ----------

  /** Cartao "treino em andamento" (Inicio e Treinos): sem ele, sair pela barra de baixo no meio
   *  do treino nao tinha caminho de volta e "Treinar" de novo zerava as series. */
  function cartaoTreinoEmAndamento() {
    const ex = estado.execucao;
    if (!ex) return '';
    const feitas = ex.itens.reduce((s, i) => s + (i.sets || []).length, 0);
    return `
      <div class="cartao c-coral">
        <div class="rotulo" style="color:var(--destaque)">Treino em andamento</div>
        <h2 style="margin:2px 0 4px">${h(ex.fichaNome)}</h2>
        <div class="pequeno apagado">Exercício ${ex.iEx + 1} de ${ex.itens.length} · ${feitas} série(s) registrada(s)</div>
        <button class="btn btn-largo btn-principal" data-acao="ir" data-tela="execucao" style="margin-top:12px">Continuar treino</button>
        <button class="btn btn-largo" data-acao="encerrar-treino-confirma" style="margin-top:8px">Encerrar treino</button>
      </div>`;
  }

  /** iPhone/iPad no Safari (nao no app instalado): os dados ficam separados dos do app. */
  function abertoNoNavegadorIphone() {
    const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const instalado = navigator.standalone === true || (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches);
    return ios && !instalado;
  }

  function telaInicio() {
    const p = Dados.perfil();
    const fichas = Dados.fichas();
    const idade = Dados.idade();
    const fm = Aerobico.fcMax({ idade, medida: p.fcMaxMedida });
    const z = fm ? Aerobico.zonas({ fcMaxValor: fm.valor, fcRepouso: p.fcRepouso }) : null;

    const totalEx = fichas.reduce((s, f) => s + (f.exercicios || []).length, 0);
    const totalSeries = fichas.reduce(
      (s, f) => s + (f.exercicios || []).reduce((t, e) => t + (Number(e.series) || 0), 0), 0
    );

    const perfilIncompleto = !p.nascimento || !p.peso;

    const vol = Forca.volumeSemanal(fichas, BASE);
    const abaixo = vol.filter((v) => v.situacao.chave === 'baixo' && v.series >= 4).length;
    const acima = vol.filter((v) => v.situacao.chave === 'alto').length;

    const gam = Dados.gam();
    const nivel = Gamificacao.nivelPorXP(gam.xp);
    const diasTreinados = Dados.diasTreinados();
    const streak = Gamificacao.calcularStreak(diasTreinados);

    const hojeNum = new Date().getDay();
    const hojeChave = new Date().toLocaleDateString('sv-SE');
    const hojeEDiaDeTreino = p.diasTreino.includes(hojeNum);
    const jaTreinouHoje = diasTreinados.includes(hojeChave);
    // se a ficha de hoje veio do gerador automatico, ela ja sabe seu proprio dia da semana —
    // da pra nomear o treino de hoje em vez de so avisar "e dia de treino"
    const fichaDeHoje = fichas.find((f) => f.diaSemana === hojeNum && (f.exercicios || []).length) || null;
    const nomeFichaHoje = fichaDeHoje ? fichaDeHoje.nome.replace(/^Treino \w+ — /, '') : '';
    // sem ficha marcada pra hoje: sugere a ficha com treino feita ha mais tempo (rodizio natural)
    const comTreino = fichas.filter((f) => (f.exercicios || []).length);
    const ultimaVez = (f) => (Dados.sessoes().find((ss) => ss.fichaId === f.id)?.data) || 0;
    const fichaParaHoje = fichaDeHoje || (comTreino.length ? [...comTreino].sort((a, b) => ultimaVez(a) - ultimaVez(b))[0] : null);
    const itensMissao = fichaParaHoje ? fichaParaHoje.exercicios.filter((it) => blocoDe(it) === 'principal') : [];
    const nPrincipal = itensMissao.length;
    const exMissao = itensMissao.length ? BASE.find((e) => e.id === itensMissao[0].exId) : null;
    const diasSemTreino = diasTreinados.length ? Math.floor((Date.now() - new Date(diasTreinados[diasTreinados.length - 1] + 'T12:00:00').getTime()) / 86400000) : null;

    // lembrete de backup: so incomoda se ja existe algo real pra perder, e so quando faz
    // tempo demais (ou nunca foi feito) — ver nota em Dados.registrarBackupFeito
    const backup = Dados.backupMeta();
    const diasSemBackup = backup.ultimoEm ? Math.floor((Date.now() - backup.ultimoEm) / 86400000) : null;
    const temDadosDeVerdade = !!p.nome || fichas.length > 0 || Dados.sessoes().length > 0;
    const precisaLembrarBackup = temDadosDeVerdade && (backup.ultimoEm === null || diasSemBackup >= 7);

    return `
      <div class="marca-topo"><img src="icons/icone-192.png" alt=""><span>TRIVOX</span></div>
      <div class="topo" style="margin-bottom:8px"><h1>Olá${p.nome ? ', ' + h(p.nome.split(' ')[0]) : ''}</h1></div>
      <p class="frase" style="margin-bottom:16px">${h(Motivacao.fraseDoDia({ objetivo: p.objetivo, idade, streak: streak.atual, diasSemTreino, hojeEDiaDeTreino: p.diasTreino.length ? hojeEDiaDeTreino : null, jaTreinouHoje }))}</p>

      ${!temDadosDeVerdade ? `
        <div class="cartao c-azul">
          <h2 style="margin-bottom:4px">Já usava o TRIVOX?</h2>
          <p class="pequeno">Apagar o app (ou trocar de celular) apaga os dados deste aparelho. Para trazer tudo de volta:</p>
          <button class="btn btn-largo btn-principal" data-acao="ir-nuvem">Entrar na nuvem com meu e-mail</button>
          <button class="btn btn-largo" data-acao="importar" style="margin-top:8px">Importar meu backup (.zip)</button>
          <p class="pequeno apagado" style="margin-top:8px">Primeira vez aqui? É só preencher o Perfil e montar o treino.</p>
        </div>` : ''}
      ${abertoNoNavegadorIphone() ? `
        <div class="nota atencao"><strong>Você abriu pelo Safari</strong>No iPhone, o Safari guarda dados separados do app instalado. Para ver seus treinos, abra o TRIVOX pelo ícone na tela de início. Ainda não instalou? Compartilhar › Adicionar à Tela de Início.</div>` : ''}
      ${precisaParq(p, idade) ? `
        <div class="nota atencao">
          <strong>Antes de treinar: 7 perguntas de saúde</strong>
          Leva 1 minuto e deixa o treino mais seguro para você.
          <div style="margin-top:10px"><button class="btn btn-pequeno btn-principal" data-acao="ir" data-tela="perfil">Responder agora</button></div>
        </div>` : ''}
      ${parqTemSim(p) ? `<div class="nota atencao"><strong>Fale com seu médico</strong>Pela triagem de saúde, procure liberação médica antes de aumentar a intensidade. Até lá, o aeróbico fica só em zona leve.</div>` : ''}

      ${precisaLembrarBackup ? `
        <div class="nota atencao">
          <strong>Faça backup dos seus dados</strong>
          ${backup.ultimoEm ? `Já fazem ${diasSemBackup} dias desde o último backup.` : 'Você ainda não fez nenhum backup.'}
          Seus dados ficam só neste aparelho — o navegador pode limpar esse espaço sozinho (mais comum no iPhone), sem avisar, e tudo se perde de uma vez.
          <div style="margin-top:10px"><button class="btn btn-pequeno btn-principal" data-acao="exportar">Exportar agora</button></div>
        </div>` : ''}

      ${cartaoTreinoEmAndamento()}
      ${fichaParaHoje && !jaTreinouHoje && !estado.execucao ? `
        <div class="cartao c-turquesa missao">
          <div style="display:flex;gap:12px;align-items:center">
            <div style="flex:1;min-width:0">
              <div class="rotulo" style="color:var(--destaque)">${hojeEDiaDeTreino && fichaDeHoje ? 'Treino de hoje' : 'Próximo treino'}</div>
              <h2 style="margin:2px 0 4px">${h(fichaParaHoje.nome.replace(/^Treino \w+ — /, ''))}</h2>
              <div class="pequeno apagado">${nPrincipal} exercícios · ~${estimarDuracao(fichaParaHoje.exercicios)}</div>
            </div>
            ${exMissao && (typeof Figuras !== 'undefined') ? `<div class="missao-figura">${Figuras.svg(exMissao, { largura: 120 })}</div>` : ''}
          </div>
          <button class="btn btn-largo btn-principal" data-acao="iniciar-treino" data-id="${h(fichaParaHoje.id)}" style="margin-top:12px">Começar agora</button>
        </div>` : ''}
      ${jaTreinouHoje ? `<div class="nota festa"><strong>Treino de hoje feito!</strong>Mandou bem. Descanse e volte forte amanhã.</div>` : ''}

      <div class="grade-3" style="margin-bottom:14px">
        <button class="cartao clicavel atalho" data-acao="ir-cronometro">
          ${icone('relogio')}<span>Cronômetro</span>
        </button>
        <button class="cartao clicavel atalho" data-acao="ir" data-tela="biblioteca" data-voltar="inicio">
          ${icone('haltere')}<span>${BASE.length} exercícios</span>
        </button>
        <button class="cartao clicavel atalho" data-acao="ir" data-tela="coach">
          ${icone('conversa')}<span>Coach</span>
        </button>
      </div>

      <div class="cartao clicavel" data-acao="ir" data-tela="evolucao">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="flex:1;min-width:0">
            <div class="rotulo">Nível</div>
            <div style="font-weight:600;font-size:16px">${h(nivel.nome)}${streak.atual >= 2 ? ` · ${streak.atual} dias seguidos` : ''}</div>
            <div class="barra-fundo" style="margin-top:8px"><div class="barra-frente" style="width:${nivel.progresso}%;background:var(--destaque)"></div></div>
            <div class="pequeno apagado" style="margin-top:6px">${nivel.proximo ? `${gam.xp} XP · faltam ${nivel.faltam} para ${h(nivel.proximo.nome)}` : `${gam.xp} XP · nível máximo!`}</div>
          </div>
        </div>
      </div>

      ${perfilIncompleto ? `
        <div class="nota">
          <strong>Complete seu perfil</strong>
          Sem data de nascimento e peso eu não consigo calcular suas zonas de frequência cardíaca nem estimar gasto calórico.
          <div style="margin-top:10px"><button class="btn btn-pequeno btn-principal" data-acao="ir" data-tela="perfil">Preencher agora</button></div>
        </div>` : ''}

      <div class="grade">
        <div class="cartao clicavel" data-acao="ir" data-tela="fichas">
          <div class="rotulo">Fichas</div>
          <div class="numerao">${fichas.length}</div>
          <div class="pequeno apagado">${totalEx} exercício${totalEx === 1 ? '' : 's'}</div>
        </div>
        <div class="cartao clicavel" data-acao="ir" data-tela="fichas">
          <div class="rotulo">Séries/semana</div>
          <div class="numerao">${totalSeries}</div>
          <div class="pequeno apagado">somando as fichas</div>
        </div>
      </div>

      ${fichas.length ? `
        <div class="cartao clicavel" data-acao="volume">
          <div class="cartao-titulo"><h3>Volume por músculo</h3><span class="apagado">›</span></div>
          ${acima ? `<span class="etiqueta perigo">${acima} acima da faixa</span> ` : ''}
          ${abaixo ? `<span class="etiqueta aviso">${abaixo} abaixo do mínimo</span> ` : ''}
          ${!acima && !abaixo ? `<span class="etiqueta ok">Distribuição equilibrada</span>` : ''}
          <div class="pequeno apagado" style="margin-top:8px">Toque para ver músculo a músculo.</div>
        </div>` : `
        <div class="vazio">
          <div class="vazio-icone">${icone('fichas')}</div>
          <p>Você ainda não tem nenhuma ficha.</p>
          <button class="btn btn-principal" data-acao="nova-ficha">Montar meu primeiro treino</button>
        </div>`}

      ${z ? `
        <div class="cartao clicavel" data-acao="ir" data-tela="cardio">
          <div class="cartao-titulo"><h3>Sua zona de base (Z2)</h3><span class="apagado">›</span></div>
          <div class="numerao" style="color:var(--ok)">${z.lista[1].min}–${z.lista[1].max} <span style="font-size:15px;color:var(--apagado)">bpm</span></div>
          <div class="pequeno apagado">É nessa faixa que deve ficar a maior parte do seu aeróbico.</div>
        </div>` : ''}

    `;
  }

  // ---------- tela: fichas ----------

  function telaFichas() {
    const fichas = Dados.fichas();

    // sugestao de variedade: olha a ficha com treino que esta ha mais tempo sem variar
    // os exercicios — evita monotonia (ver Forca.precisaVariar/variarFicha)
    const fichasComTreino = fichas.filter((f) => (f.exercicios || []).length > 0);
    const maisParada = fichasComTreino.length
      ? fichasComTreino.reduce((a, b) => (Forca.semanasSemVariar(b) > Forca.semanasSemVariar(a) ? b : a))
      : null;
    const semanasParada = maisParada ? Forca.semanasSemVariar(maisParada) : 0;
    const sugerirVariar = maisParada && Forca.precisaVariar(maisParada);

    return `
      <div class="topo">
        <h1>Treinos</h1>
        <button class="btn btn-pequeno btn-principal" data-acao="nova-ficha">+ Nova</button>
      </div>
      ${cartaoTreinoEmAndamento()}

      <div class="cartao clicavel cartao-gradiente" data-acao="abrir-gerador">
        <div style="display:flex;align-items:center;gap:12px">
          <div>
            <div style="font-weight:600">Gerar treino automático</div>
            <div class="pequeno apagado">Escolha o objetivo — eu monto as fichas pra você</div>
          </div>
        </div>
      </div>

      ${sugerirVariar ? `
        <div class="nota atencao">
          <strong>Hora de variar</strong>
          Faz ${semanasParada} semanas com os mesmos exercícios — trocar parte deles por variações em outro aparelho muda o estímulo e ajuda a não enjoar, sem perder o objetivo nem o histórico de carga.
          <div style="margin-top:10px"><button class="btn btn-pequeno btn-principal" data-acao="variar-treino">Variar meus treinos</button></div>
        </div>` : ''}

      ${fichas.length ? fichas.map((f) => {
        const n = (f.exercicios || []).length;
        const series = (f.exercicios || []).reduce((s, e) => s + (Number(e.series) || 0), 0);
        const diaTxt = (f.diaSemana !== null && f.diaSemana !== undefined) ? DIAS_SEMANA[f.diaSemana].nome : null;
        return `
          <div class="item" data-acao="abrir-ficha" data-id="${h(f.id)}">
            <div class="item-icone">${icone('fichas')}</div>
            <div class="item-corpo">
              <div class="item-nome">${h(f.nome)}</div>
              <div class="item-sub">${diaTxt ? `${diaTxt} · ` : ''}${n} exercício${n === 1 ? '' : 's'} · ${series} série${series === 1 ? '' : 's'}</div>
            </div>
            ${n ? `<button class="btn btn-pequeno btn-principal" data-acao="iniciar-treino" data-id="${h(f.id)}">Treinar</button>` : ''}
            <div class="item-fim">›</div>
          </div>`;
      }).join('') : `
        <div class="vazio">
          <div class="vazio-icone">${icone('fichas')}</div>
          <p>Nenhuma ficha ainda.</p>
          <p class="pequeno">Uma ficha é um dia de treino: "Pernas", "Peito e tríceps", "Full body A".</p>
          <button class="btn btn-principal" data-acao="nova-ficha">Criar ficha manualmente</button>
        </div>`}

      ${fichas.length ? `
        <button class="btn btn-largo" data-acao="volume" style="margin-top:10px">Ver volume semanal por músculo</button>` : ''}
    `;
  }

  /** Modal de configuracao do gerador automatico. */
  /** Grade de objetivos grandes, com icone (usada no gerador e no perfil). */
  /** Varios objetivos: ate 2 de treino (dividem os dias da semana) + "Especial 50+", que soma com
   *  qualquer um como camada de seguranca. Tocar marca/desmarca; sempre sobra pelo menos 1. */
  function opcoesObjetivo(lista, acao) {
    const treinos = lista.filter((k) => k !== '50mais');
    return `<div class="opcoes">${Object.keys(NOME_OBJETIVO_CURTO).map((k) => {
      const ativo = lista.includes(k);
      const ordem = ativo && k !== '50mais' && treinos.length > 1 ? (treinos[0] === k ? 'principal' : '2º objetivo') : '';
      return `
      <button class="opcao ${ativo ? 'ativo' : ''}" data-acao="${acao}" data-valor="${k}" aria-pressed="${ativo}">
        <b>${h(NOME_OBJETIVO_CURTO[k])}</b>${ordem ? `<span class="sub">${ordem}</span>` : ''}
      </button>`;
    }).join('')}</div>
      <p class="pequeno apagado" style="margin-top:6px">Toque para marcar ou desmarcar. Até 2 objetivos de treino (os dias da semana se dividem entre eles); "Especial 50+" soma com qualquer um e deixa o treino mais seguro.</p>
      ${lista.map((k) => Forca.OBJETIVOS[k]?.resumo ? `<p class="pequeno apagado" style="margin-top:4px"><b>${h(NOME_OBJETIVO_CURTO[k] || k)}:</b> ${h(Forca.OBJETIVOS[k].resumo)}</p>` : '').join('')}`;
  }

  /** Marca/desmarca um objetivo na lista. Terceiro objetivo de treino troca o 2º. */
  function alternarObjetivo(lista, k) {
    let l = [...lista];
    if (l.includes(k)) {
      l = l.filter((x) => x !== k);
      return l.length ? l : [k]; // precisa de pelo menos 1
    }
    if (k !== '50mais') {
      const treinos = l.filter((x) => x !== '50mais');
      if (treinos.length >= 2) l = l.filter((x) => x !== treinos[1]);
    }
    return [...l, k];
  }
  const principalDe = (lista) => lista.find((x) => x !== '50mais') || lista[0] || 'condicionamento';
  const esportesDe = (p) => (Array.isArray(p.esportes) && p.esportes.length ? p.esportes : p.esporte ? [p.esporte] : []);

  /** Perfil pronto para o motor de treino, com os valores antigos traduzidos: objetivo legado
   *  (forca, resistencia, emagrecimento) pelo MAPA_LEGADO, elite = avancado, e "parque" continua
   *  parque (o motor sabe o que tem numa praca) em vez de virar academia. */
  function perfilTreino() {
    const p = Dados.perfil();
    const traduz = (o) => (Forca.OBJETIVOS[o] ? o : (typeof Programas !== 'undefined' && Programas.MAPA_LEGADO[o]) || null);
    let objetivos = [...new Set((Array.isArray(p.objetivos) && p.objetivos.length ? p.objetivos : [p.objetivo]).map(traduz).filter(Boolean))];
    if (!objetivos.length) objetivos = ['condicionamento'];
    return {
      objetivo: principalDe(objetivos), objetivos,
      mais50: objetivos.includes('50mais') && objetivos.length > 1, // 50+ como camada de seguranca
      nivel: p.nivel === 'elite' ? 'avancado' : p.nivel || 'iniciante',
      local: ['casa', 'parque'].includes(p.local) ? p.local : 'academia',
      equipCasa: p.equipCasa, idade: Dados.idade(), peso: p.peso, altura: p.altura,
    };
  }

  /** Modal de configuracao do gerador automatico. */
  function modalGerador() {
    const p = Dados.perfil();
    const g = estado.gerador;
    const pt = perfilTreino();
    const objs = g.objetivos || pt.objetivos;
    const local = g.local || pt.local;
    const nivel = g.nivel || nivelTela(p.nivel);
    const temDias = p.diasTreino.length > 0;
    const diasTxt = temDias
      ? `${p.diasTreino.length} dia${p.diasTreino.length === 1 ? '' : 's'} (${[...p.diasTreino].sort().map((d) => DIAS_SEMANA[d].nome).join(', ')})`
      : `${p.freqForca} dias por semana`;
    const idade = Dados.idade();
    abrirModal(`
      <h2>Montar meu treino</h2>
      <p class="pequeno apagado">Escolha e eu monto as fichas da semana, cada uma com aquecimento no começo e alongamento no fim, pros músculos do dia.</p>
      <div class="campo"><label>Objetivo</label>${opcoesObjetivo(objs, 'ger-objetivo')}</div>
      <div class="campo"><label>Onde vai treinar</label>
        <div class="chips">
          <button class="chip ${local === 'academia' ? 'ativo' : ''}" data-acao="ger-local" data-valor="academia">Academia</button>
          <button class="chip ${local === 'casa' ? 'ativo' : ''}" data-acao="ger-local" data-valor="casa">Casa</button>
        </div>
      </div>
      <div class="campo"><label>Nível</label>
        <div class="chips">
          ${['iniciante', 'intermediario', 'avancado'].map((n) => `<button class="chip ${nivel === n ? 'ativo' : ''}" data-acao="ger-nivel" data-valor="${n}">${NOME_NIVEL[n]}</button>`).join('')}
        </div>
      </div>
      <p class="pequeno apagado">Dias: ${diasTxt}${idade ? ` · ${idade} anos` : ''}${p.sexo ? ` · ${p.sexo === 'f' ? 'mulher' : p.sexo === 'm' ? 'homem' : ''}` : ''}${p.peso ? ` · ${h(p.peso)} kg` : ''}. ${!temDias ? 'Marque os dias em Perfil › Treino pra cada ficha sair ligada ao dia certo.' : ''}${!idade || !p.sexo ? ' Complete idade e sexo no Perfil pra personalizar ainda mais.' : ''}</p>
      ${local === 'casa' ? `<p class="pequeno apagado">Em casa eu uso o que você marcou em Perfil › Equipamentos em casa.</p>` : ''}
      ${Dados.fichas().length ? `
        <div class="campo"><label>As fichas que você já tem</label>
          <div class="chips">
            <button class="chip ${g.substituir !== false ? 'ativo' : ''}" data-acao="ger-substituir" data-valor="1">Trocar pelas novas</button>
            <button class="chip ${g.substituir === false ? 'ativo' : ''}" data-acao="ger-substituir" data-valor="0">Manter e adicionar</button>
          </div>
          <p class="pequeno apagado" style="margin-top:6px">Seu histórico de cargas fica guardado de qualquer jeito.</p>
        </div>` : ''}
      <button class="btn btn-largo btn-principal" data-acao="gerar-plano" style="margin-top:6px">Gerar minhas fichas</button>
      <button class="btn btn-largo btn-fantasma" data-acao="fechar-modal" style="margin-top:8px">Cancelar</button>
    `);
  }

  // ---------- tela: editor de ficha ----------

  function telaFicha() {
    const f = Dados.acharFicha(estado.fichaId);
    if (!f) return telaFichas();

    const p = Dados.perfil();
    const itens = f.exercicios || [];
    const series = itens.reduce((s, e) => s + (Number(e.series) || 0), 0);
    const tempo = estimarDuracao(itens);

    return `
      <div class="topo">
        <button class="voltar" data-acao="ir" data-tela="fichas">‹</button>
        <h1>Editar ficha</h1>
      </div>

      <div class="cartao">
        <div class="campo">
          <label for="ficha-nome">Nome da ficha</label>
          <input id="ficha-nome" value="${h(f.nome)}" data-campo="nome" placeholder="Ex.: Treino A — Pernas">
        </div>
        <div class="campo" style="margin-bottom:0">
          <label for="ficha-obs">Observações</label>
          <textarea id="ficha-obs" data-campo="obs" placeholder="Lembretes: aquecer o quadril antes, não travar joelho...">${h(f.obs || '')}</textarea>
        </div>
      </div>

      <div class="grade-3">
        <div class="cartao" style="text-align:center">
          <div class="rotulo">Exercícios</div><div class="numerao">${itens.length}</div>
        </div>
        <div class="cartao" style="text-align:center">
          <div class="rotulo">Séries</div><div class="numerao">${series}</div>
        </div>
        <div class="cartao" style="text-align:center">
          <div class="rotulo">Duração</div><div class="numerao" style="font-size:20px">${tempo}</div>
        </div>
      </div>

      <div class="cartao-titulo" style="margin-top:18px">
        <h2>Exercícios</h2>
        <button class="btn btn-pequeno btn-principal" data-acao="add-exercicio" data-id="${h(f.id)}">+ Adicionar</button>
      </div>

      ${itens.length ? ORDEM_BLOCO.filter((b) => itens.some((it) => blocoDe(it) === b)).map((b) => `
        <div class="bloco-titulo bloco-${b}"><span class="bolinha"></span>${NOME_BLOCO[b]}</div>
        ${itens.map((item, i) => [item, i]).filter(([item]) => blocoDe(item) === b).map(([item, i]) => {
        const ex = BASE.find((e) => e.id === item.exId);
        if (ehItemSimples(item)) {
          return `
          <div class="item" data-acao="ver-exercicio" data-id="${h(ex ? ex.id : '')}" data-voltar="ficha">
            <div class="item-icone">${thumbExercicio(ex)}</div>
            <div class="item-corpo">
              <div class="item-nome">${ex ? h(ex.nome) : 'Exercício removido'}</div>
              <div class="item-sub">${h(item.reps || (item.tempoSeg ? item.tempoSeg + 's' : ''))}${item.grupo ? ' · ' + h(item.grupo) : ''}</div>
            </div>
            <button class="btn btn-pequeno btn-fantasma" data-acao="remover-item" data-i="${i}" aria-label="Remover">✕</button>
          </div>`;
        }
        const sug = Forca.sugerirCarga(Dados.historicoCarga(item.exId), item, 1.25);
        return `
          <div class="cartao">
            <div class="cartao-titulo">
              <div style="display:flex;gap:10px;align-items:center;min-width:0"><div class="item-icone">${thumbExercicio(ex)}</div><h3 style="margin:0">${ex ? h(ex.nome) : '<span class="apagado">Exercício removido da base</span>'}</h3></div>
              <div style="display:flex;gap:6px;flex-shrink:0">
                ${i > 0 ? `<button class="btn btn-pequeno btn-fantasma" data-acao="mover" data-i="${i}" data-dir="-1" title="Subir" aria-label="Subir">↑</button>` : ''}
                ${i < itens.length - 1 ? `<button class="btn btn-pequeno btn-fantasma" data-acao="mover" data-i="${i}" data-dir="1" title="Descer" aria-label="Descer">↓</button>` : ''}
              </div>
            </div>

            ${ex ? `<div class="etiquetas" style="margin-bottom:12px">
              ${(ex.musculos_primarios || []).map((m) => `<span class="etiqueta destaque">${h(m)}</span>`).join('')}
              <span class="etiqueta">${h(nomeAparelho(ex.aparelho) || ex.equipamento)}</span>
              ${item.superserie ? `<span class="etiqueta uva">Superset ${h(item.superserie)}</span>` : ''}
            </div>` : ''}
            ${item.obs ? `<p class="pequeno apagado" style="margin-top:-4px">${h(item.obs)}</p>` : ''}
            ${ultimoTreinoHtml(item.exId)}

            <div class="campos-lado-3">
              <div class="campo">
                <label>Séries</label>
                <input type="number" inputmode="numeric" min="1" max="10" value="${numCampo(item.series)}" data-item="${i}" data-prop="series">
              </div>
              <div class="campo">
                <label>Reps</label>
                <input value="${h(item.reps || '')}" data-item="${i}" data-prop="reps" placeholder="8-12">
              </div>
              <div class="campo">
                <label>Descanso</label>
                <input type="number" inputmode="numeric" step="15" value="${numCampo(item.descanso)}" data-item="${i}" data-prop="descanso">
              </div>
            </div>

            <div class="campos-lado">
              <div class="campo">
                <label>Reps de sobra (alvo)</label>
                <select data-item="${i}" data-prop="rirAlvo">
                  ${[0, 1, 2, 3, 4].map((r) => `<option value="${r}" ${Number(item.rirAlvo) === r ? 'selected' : ''}>${r} — ${['até a falha', 'quase falha', 'sobra 2', 'sobra 3', 'sobra 4'][r]}</option>`).join('')}
                </select>
              </div>
              <div class="campo">
                <label>Carga (kg)</label>
                <input type="number" inputmode="decimal" step="1.25" value="${numCampo(item.carga)}" data-item="${i}" data-prop="carga" placeholder="—">
              </div>
            </div>

            ${sug.carga !== null && sug.tipo !== 'inicio' ? `
              <div class="nota ${sug.tipo === 'baixar' ? 'atencao' : ''}" style="margin-bottom:10px">
                <strong>Sugestão para hoje: ${h(sug.carga)} kg</strong>${h(sug.motivo)}
                <div style="margin-top:8px"><button class="btn btn-pequeno" data-acao="aplicar-sug" data-item="${i}" data-carga="${h(sug.carga)}">Usar ${h(sug.carga)} kg</button></div>
              </div>` : ''}

            <div class="linha-btn">
              ${ex ? `<button class="btn btn-pequeno" data-acao="ver-exercicio" data-id="${h(ex.id)}">Como executar</button>` : ''}
              <button class="btn btn-pequeno btn-perigo" data-acao="remover-item" data-i="${i}">Remover</button>
            </div>
          </div>`;
      }).join('')}`).join('') : `
        <div class="vazio">
          <div class="vazio-icone">🏋️</div>
          <p>Ficha vazia.</p>
          <button class="btn btn-principal" data-acao="add-exercicio" data-id="${h(f.id)}">Escolher exercícios</button>
        </div>`}

      ${itens.length ? `
        <div class="cartao">
          <div class="cartao-titulo"><h3>Análise desta ficha</h3></div>
          ${analiseFicha(f, p)}
        </div>` : ''}

      <div class="linha-btn" style="margin-top:6px">
        <button class="btn" data-acao="duplicar-ficha" data-id="${h(f.id)}">Duplicar</button>
        <button class="btn btn-perigo" data-acao="apagar-ficha" data-id="${h(f.id)}">Apagar ficha</button>
      </div>
    `;
  }

  /** Estimativa de duracao: series x (tempo de execucao + descanso). */
  function estimarDuracao(itens) {
    let seg = 0;
    for (const item of itens) {
      const s = Number(item.series) || 0;
      if (item.circuito || item.tempoSeg) { seg += Math.max(1, s) * ((Number(item.tempoSeg) || 40) + (item.bloco === 'principal' ? Number(item.descanso) || 30 : 10)); continue; }
      const descanso = Number(item.descanso) || 90;
      const repsMax = Number(String(item.reps || '10').split('-').pop()) || 10;
      seg += s * (repsMax * 3.5 + descanso); // ~3,5s por repeticao controlada
    }
    const min = Math.round(seg / 60);
    return min ? minutosTexto(min) : '—';
  }

  /** Comentario de personal sobre a ficha: equilibrio, ordem e volume. */
  function analiseFicha(f, p) {
    const itens = f.exercicios || [];
    const notas = [];

    const exs = itens.map((i) => BASE.find((e) => e.id === i.exId)).filter(Boolean);
    const compostos = exs.filter((e) => Forca.ehComposto(e));

    // ordem: composto pesado deve vir antes do isolado
    const primeiroIsolado = exs.findIndex((e) => !Forca.ehComposto(e));
    const ultimoComposto = exs.map((e) => Forca.ehComposto(e)).lastIndexOf(true);
    if (primeiroIsolado >= 0 && ultimoComposto > primeiroIsolado) {
      notas.push({
        tipo: 'atencao',
        titulo: 'Ordem dos exercícios',
        texto: `${h(exs[ultimoComposto].nome)} é um exercício composto e está depois de um isolado. Compostos pedem o corpo descansado — coloque-os no começo da ficha.`,
      });
    }

    // séries da ficha
    const totalSeries = itens.reduce((s, e) => s + (Number(e.series) || 0), 0);
    if (totalSeries > 28) {
      notas.push({
        tipo: 'atencao',
        titulo: 'Ficha longa',
        texto: `${totalSeries} séries num treino só. Acima de ~25 séries as últimas rendem pouco, porque você já chega nelas cansada. Considere dividir em dois dias.`,
      });
    }

    // equilibrio empurrar x puxar
    const empurra = exs.filter((e) => ['peito', 'ombros', 'triceps', 'empurrar'].includes(e.categoria)).length;
    const puxa = exs.filter((e) => ['costas', 'biceps', 'puxar'].includes(e.categoria)).length;
    if (empurra >= 2 && puxa === 0) {
      notas.push({
        tipo: 'atencao',
        titulo: 'Só empurrar',
        texto: 'A ficha tem exercícios de empurrar e nenhum de puxar. No médio prazo isso puxa os ombros para frente e cobra postura. Inclua ao menos uma remada ou puxada.',
      });
    }

    // RIR muito agressivo
    const naFalha = itens.filter((i) => Number(i.rirAlvo) === 0).length;
    if (naFalha > 2) {
      notas.push({
        tipo: 'atencao',
        titulo: 'Falha demais',
        texto: `${naFalha} exercícios até a falha. Falha cobra caro na recuperação e rende pouco a mais. Reserve para o último exercício isolado da ficha.`,
      });
    }

    // descanso curto em composto
    const curtos = itens.filter((i, idx) => exs[idx] && Forca.ehComposto(exs[idx]) && Number(i.descanso) < 90);
    if (curtos.length) {
      notas.push({
        tipo: 'atencao',
        titulo: 'Descanso curto em composto',
        texto: `${curtos.length} exercício(s) composto(s) com menos de 90s de descanso. Aqui o descanso curto não acelera o resultado: só derruba a carga da série seguinte.`,
      });
    }

    if (!notas.length) {
      notas.push({
        tipo: 'ok',
        titulo: 'Ficha bem montada',
        texto: `${compostos.length} exercício(s) composto(s) na frente, volume dentro do razoável e descansos coerentes.`,
      });
    }

    return notas.map((n) => `
      <div class="nota ${n.tipo === 'ok' ? 'neutra' : 'atencao'}">
        <strong>${n.tipo === 'ok' ? '✓ ' : ''}${h(n.titulo)}</strong>${n.texto}
      </div>`).join('');
  }

  // ---------- tela: biblioteca ----------

  function telaBiblioteca() {
    const escolhendo = !!estado.escolhendoPara;
    const cats = [...new Set(BASE.map((e) => e.categoria))].sort();
    const equips = [...new Set(BASE.map((e) => e.aparelho || e.equipamento))].sort((a, b) => nomeAparelho(a).localeCompare(nomeAparelho(b), 'pt-BR'));

    const filtrados = BASE.filter((e) => {
      const b = semAcento(estado.busca.trim());
      if (b) {
        const alvo = semAcento(`${e.nome} ${(e.musculos_primarios || []).join(' ')} ${(e.musculos_secundarios || []).join(' ')} ${e.equipamento} ${nomeAparelho(e.aparelho)} ${NOME_CATEGORIA[e.categoria] || e.categoria}`);
        // toda palavra digitada precisa aparecer: "supino inclinado" nao traz supino reto
        if (!b.split(/\s+/).every((termo) => alvo.includes(termo))) return false;
      }
      if (estado.filtro.categoria && e.categoria !== estado.filtro.categoria) return false;
      if (estado.filtro.nivel && nivelTela(e.nivel) !== estado.filtro.nivel) return false;
      if (estado.filtro.equipamento && (e.aparelho || e.equipamento) !== estado.filtro.equipamento) return false;
      if (estado.filtro.local && !(e.local || []).includes(estado.filtro.local)) return false;
      if (estado.filtro.objetivo && !(e.objetivos || []).includes(estado.filtro.objetivo)) return false;
      return true;
    });

    const mostrar = filtrados.slice(0, estado.limite);

    return `
      <div class="topo">
        ${escolhendo ? `<button class="voltar" data-acao="cancelar-escolha">‹</button>` : ''}
        <h1>${escolhendo ? 'Escolher exercício' : 'Exercícios'}</h1>
      </div>

      <div class="busca">
        <input id="campo-busca" value="${h(estado.busca)}" placeholder="Buscar: glúteo, supino, elástico..." data-acao="buscar" autocomplete="off">
        <div class="filtros">
          <select data-filtro="categoria" aria-label="Grupo muscular">
            <option value="">Todos os grupos</option>
            ${cats.map((c) => `<option value="${h(c)}" ${estado.filtro.categoria === c ? 'selected' : ''}>${h(NOME_CATEGORIA[c] || c)}</option>`).join('')}
          </select>
          <select data-filtro="local" aria-label="Local">
            <option value="">Casa e academia</option>
            <option value="casa" ${estado.filtro.local === 'casa' ? 'selected' : ''}>Em casa</option>
            <option value="academia" ${estado.filtro.local === 'academia' ? 'selected' : ''}>Na academia</option>
          </select>
          <select data-filtro="objetivo" aria-label="Objetivo">
            <option value="">Todos os objetivos</option>
            ${Object.entries(NOME_OBJETIVO_CURTO).map(([k, v]) => `<option value="${k}" ${estado.filtro.objetivo === k ? 'selected' : ''}>${v}</option>`).join('')}
          </select>
          <select data-filtro="nivel" aria-label="Nível">
            <option value="">Todos os níveis</option>
            ${['iniciante', 'intermediario', 'avancado'].map((k) => `<option value="${k}" ${estado.filtro.nivel === k ? 'selected' : ''}>${NOME_NIVEL[k]}</option>`).join('')}
          </select>
          <select data-filtro="equipamento" aria-label="Equipamento">
            <option value="">Todo equipamento</option>
            ${equips.map((c) => `<option value="${h(c)}" ${estado.filtro.equipamento === c ? 'selected' : ''}>${h(nomeAparelho(c))}</option>`).join('')}
          </select>
        </div>
        <div class="pequeno apagado" style="padding-top:6px">${filtrados.length} de ${BASE.length} exercícios</div>
      </div>

      ${mostrar.map((e) => `
        <div class="item" data-acao="${escolhendo ? 'escolher-exercicio' : 'ver-exercicio'}" data-id="${h(e.id)}">
          <div class="item-icone">${thumbExercicio(e)}</div>
          <div class="item-corpo">
            <div class="item-nome">${h(e.nome)}</div>
            <div class="item-sub">${h((e.musculos_primarios || []).join(', '))} · ${h(nomeAparelho(e.aparelho) || e.equipamento)}</div>
          </div>
          <div class="item-fim">${escolhendo ? '+' : '›'}</div>
        </div>`).join('')}

      ${filtrados.length > mostrar.length ? `
        <button class="btn btn-largo" data-acao="mais" style="margin-top:8px">
          Mostrar mais (${filtrados.length - mostrar.length} restantes)
        </button>` : ''}

      ${!filtrados.length ? `<div class="vazio"><div class="vazio-icone">🔍</div><p>Nenhum exercício com esses filtros.</p></div>` : ''}
    `;
  }

  /** Grafico de linha simples em SVG puro — sem lib nenhuma, so markup. */
  function graficoLinha(valores, { largura = 300, altura = 90, cor = 'var(--destaque-clara)' } = {}) {
    if (!valores || valores.length < 2) return '';
    const min = Math.min(...valores), max = Math.max(...valores);
    const folga = (max - min) * 0.15 || 1;
    const topo = max + folga, base = min - folga;
    const pad = 6;
    const pontos = valores.map((v, i) => {
      const x = pad + (i / (valores.length - 1)) * (largura - pad * 2);
      const y = pad + (1 - (v - base) / (topo - base)) * (altura - pad * 2);
      return [x, y];
    });
    const linha = pontos.map((p) => p.join(',')).join(' ');
    const area = `${pad},${altura - pad} ${linha} ${largura - pad},${altura - pad}`;
    const pontosSvg = pontos.map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="${cor}"/>`).join('');
    return `<svg viewBox="0 0 ${largura} ${altura}" style="width:100%;height:${altura}px;overflow:visible">
      <polygon points="${area}" fill="${cor}" opacity="0.12"/>
      <polyline points="${linha}" fill="none" stroke="${cor}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      ${pontosSvg}
    </svg>`;
  }

  /** Tela de detalhe do exercicio — imagem (pictograma), execucao, erros, historico. */
  function telaExercicio() {
    const e = BASE.find((x) => x.id === estado.exercicioId);
    if (!e) return telaBiblioteca();
    const p = Dados.perfil();
    const presc = Forca.prescrever(p.objetivo, e);
    const hist = Dados.historicoCarga(e.id);
    const plato = Forca.detectarPlato(hist);
    const subs = Forca.substitutos(e, BASE, { limite: 10, perfil: perfilTreino() });

    const cronologico = [...hist].reverse();
    const grafico = cronologico.length >= 2 ? graficoLinha(cronologico.map((r) => Number(r.carga) || 0)) : '';
    const fotoPropria = Dados.fotoExercicio(e.id);

    return `
      <div class="topo">
        <button class="voltar" data-acao="ir" data-tela="${estado.voltarTela}">‹</button>
        <h1>${h(e.nome)}</h1>
      </div>

      ${midiaExercicio(e)}

      <div class="linha-btn" style="margin-bottom:14px">
        <button class="btn btn-pequeno" data-acao="trocar-foto-exercicio" data-id="${h(e.id)}">${fotoPropria ? 'Trocar minha foto' : 'Usar minha foto'}</button>
        ${fotoPropria ? `<button class="btn btn-pequeno btn-fantasma" data-acao="remover-foto-exercicio" data-id="${h(e.id)}">Remover</button>` : ''}
      </div>
      ${ultimoTreinoHtml(e.id)}

      ${Videos.suportado() ? `
        <div class="cartao">
          <div class="cartao-titulo"><h3>Seu vídeo</h3></div>
          <div id="video-exercicio" data-exid="${h(e.id)}">
            <p class="pequeno apagado">Carregando…</p>
          </div>
        </div>` : ''}

      <div class="etiquetas" style="margin-bottom:14px">
        <span class="etiqueta destaque">${h(NOME_CATEGORIA[e.categoria] || e.categoria)}</span>
        <span class="etiqueta">${h(NOME_NIVEL[e.nivel] || e.nivel)}</span>
        <span class="etiqueta">${h(e.equipamento)}</span>
        ${(e.local || []).map((l) => `<span class="etiqueta ${l === 'casa' ? 'turquesa' : 'azul'}">${l === 'casa' ? 'Casa' : 'Academia'}</span>`).join('')}
        ${Forca.ehComposto(e) ? '<span class="etiqueta ok">Composto</span>' : '<span class="etiqueta">Isolado</span>'}
        ${e.impacto === 'alto' ? '<span class="etiqueta aviso">Impacto alto</span>' : ''}
      </div>
      ${(e.objetivos || []).length ? `<div class="etiquetas" style="margin:-6px 0 14px">${e.objetivos.map((o) => `<span class="etiqueta uva">${h(NOME_OBJETIVO_CURTO[o] || o)}</span>`).join('')}</div>` : ''}

      <div class="cartao">
        <div class="rotulo">Músculos trabalhados</div>
        <p style="margin:6px 0 0"><strong>Principais:</strong> ${h((e.musculos_primarios || []).join(', '))}</p>
        ${(e.musculos_secundarios || []).length ? `<p class="pequeno apagado" style="margin:4px 0 0"><strong>Auxiliares:</strong> ${h(e.musculos_secundarios.join(', '))}</p>` : ''}
      </div>

      <div class="cartao">
        <div class="rotulo">Sugestão para o seu objetivo (${h(Forca.OBJETIVOS[p.objetivo]?.nome || '')})</div>
        <p style="margin:8px 0 0"><strong>${presc.series} séries × ${h(presc.reps)} reps</strong> · parar com ${presc.rirAlvo} de sobra · descanso ${presc.descanso}s</p>
      </div>

      <h3 style="margin-top:18px">Como executar</h3>
      <ol class="passos">${(e.instrucoes || []).map((i) => `<li>${h(i)}</li>`).join('')}</ol>

      ${(e.erros_comuns || []).length ? `
        <div class="nota atencao" style="margin-top:16px">
          <strong>Erros comuns a evitar</strong>
          <ul class="lista" style="margin-top:6px">${e.erros_comuns.map((i) => `<li>${h(i)}</li>`).join('')}</ul>
        </div>` : ''}

      ${e.proxima_progressao ? `<div class="nota"><strong>Próxima progressão</strong>${h(e.proxima_progressao)}</div>` : ''}
      ${e.regressao ? `<div class="nota neutra"><strong>Variante mais fácil</strong>${h(e.regressao)}</div>` : ''}

      ${hist.length ? `
        <div class="cartao">
          <div class="cartao-titulo"><h3>Evolução de carga</h3></div>
          ${grafico || '<p class="pequeno apagado">Mais uma sessão registrada e o gráfico aparece aqui.</p>'}
        </div>
        <h3 style="margin-top:18px">Histórico</h3>
        ${hist.slice(0, 8).map((r) => `
          <div class="item" style="cursor:default">
            <div class="item-corpo">
              <div class="item-nome">${h(r.carga)} kg × ${h(r.reps)} reps</div>
              <div class="item-sub">${new Date(r.data).toLocaleDateString('pt-BR')}${r.rir !== null && r.rir !== undefined ? ` · ${h(r.rir)} de sobra` : ''}</div>
            </div>
          </div>`).join('')}
        ${plato.plato ? `<div class="nota atencao"><strong>Estagnado</strong>${h(plato.saida)}</div>` : ''}` : ''}

      ${subs.length ? `
        <div class="cartao" style="margin-top:18px">
          <div class="cartao-titulo"><h3>Equipamento ocupado?</h3></div>
          <p class="pequeno apagado">Outros exercícios que trabalham o mesmo músculo com outro equipamento${p.local === 'casa' ? ' (dá pra fazer em casa)' : ''}:</p>
          ${subs.map((s) => `
            <div class="item" data-acao="ver-exercicio" data-id="${h(s.id)}" data-voltar="${h(estado.voltarTela)}">
              <div class="item-icone">${thumbExercicio(s)}</div>
              <div class="item-corpo">
                <div class="item-nome">${h(s.nome)}</div>
                <div class="item-sub">${h(nomeAparelho(s.aparelho) || s.equipamento)} · ${h(NOME_NIVEL[s.nivel] || s.nivel)}</div>
              </div>
              <div class="item-fim">›</div>
            </div>`).join('')}
        </div>` : ''}
    `;
  }

  // ---------- tela: cardio ----------

  function telaCardio() {
    const p = Dados.perfil();
    const idade = Dados.idade();
    const fm = Aerobico.fcMax({ idade, medida: p.fcMaxMedida });

    if (!fm) {
      return `
        <div class="topo"><h1>Aeróbico</h1></div>
        <div class="nota">
          <strong>Informe sua data de nascimento</strong>
          As zonas de frequência cardíaca dependem da sua idade. Sem isso não dá para prescrever intensidade com segurança.
          <div style="margin-top:10px"><button class="btn btn-pequeno btn-principal" data-acao="ir" data-tela="perfil">Ir para o perfil</button></div>
        </div>`;
    }

    const z = Aerobico.zonas({ fcMaxValor: fm.valor, fcRepouso: p.fcRepouso });
    const pt = perfilTreino();
    // 50+/65+ ou "sim" na triagem: so sessoes leves na lista (intervalado/HIIT/limiar somem)
    const objAerobico = pt.objetivos.includes('50mais') ? '50mais' : pt.objetivo;
    const leve = Aerobico.soLeve({ objetivo: objAerobico, idade, restricao: parqTemSim(p) });
    const modelos = Object.values(Aerobico.MODELOS).filter((m) => !leve || !Aerobico.MODELOS_INTENSOS.includes(m.chave));
    if (!modelos.some((m) => m.chave === estado.cardio.modelo)) estado.cardio.modelo = 'base';
    const sessao = Aerobico.montarSessao({ ...estado.cardio, zonasCalc: z });
    const plano = Aerobico.planoSemanal({ freqCardio: p.freqCardio, objetivo: objAerobico, minutosBase: 40, idade, restricao: parqTemSim(p) });
    const cal = Aerobico.calorias({ modalidade: estado.cardio.modalidade, minutos: sessao.duracao, pesoKg: p.peso });
    const ordem = Aerobico.ordenarNoDia({ objetivo: pt.objetivo, intensidadeCardio: sessao.blocos.some((b) => b.zona >= 4) ? 'intensa' : 'leve' });

    return `
      <div class="topo"><h1>Aeróbico</h1></div>

      <div class="cartao">
        <div class="cartao-titulo"><h2>Suas zonas</h2><span class="etiqueta">FCmáx ${fm.valor} bpm</span></div>
        <p class="pequeno apagado">${h(z.explicacao)}</p>
        ${z.lista.map((zn) => `
          <div class="zona" style="border-left-color:${zn.cor}">
            <div class="zona-corpo">
              <div class="zona-nome">${h(zn.nome)}</div>
              <div class="zona-desc">${h(zn.sensacao)}</div>
            </div>
            <div class="zona-bpm" style="color:${zn.corTexto || zn.cor}">${zn.min}–${zn.max}<br><span>bpm</span></div>
          </div>`).join('')}
        ${fm.aviso ? `<div class="nota atencao" style="margin-top:10px"><strong>Atenção</strong>${h(fm.aviso)}</div>` : ''}
        ${!p.fcRepouso ? `
          <div class="nota neutra">
            <strong>Melhore o cálculo</strong>${h(Aerobico.COMO_MEDIR_REPOUSO)}
            <div style="margin-top:8px"><button class="btn btn-pequeno" data-acao="ir" data-tela="perfil">Informar FC de repouso</button></div>
          </div>` : ''}
        <button class="btn btn-largo btn-pequeno" data-acao="teste-fala" style="margin-top:8px">Não tenho monitor cardíaco</button>
      </div>

      <div class="cartao">
        <div class="cartao-titulo"><h2>Montar sessão</h2></div>
        <div class="campos-lado">
          <div class="campo">
            <label>Tipo de treino</label>
            <select data-cardio="modelo">
              ${modelos.map((m) => `<option value="${m.chave}" ${estado.cardio.modelo === m.chave ? 'selected' : ''}>${h(m.nome)}</option>`).join('')}
            </select>
          </div>
          <div class="campo">
            <label>Modalidade</label>
            <select data-cardio="modalidade">
              ${Object.keys(Aerobico.METS).map((m) => `<option value="${m}" ${estado.cardio.modalidade === m ? 'selected' : ''}>${h(m.replace(/_/g, ' '))}</option>`).join('')}
            </select>
          </div>
        </div>
        ${['base', 'limiar', 'recuperacao'].includes(estado.cardio.modelo) ? `
          <div class="campo">
            <label>Duração alvo: ${estado.cardio.minutos} min</label>
            <input type="range" min="20" max="90" step="5" value="${estado.cardio.minutos}" data-cardio="minutos">
          </div>` : ''}
        ${estado.cardio.modelo === 'hiit' ? `
          <div class="campo">
            <label>Número de tiros: ${estado.cardio.tiros}</label>
            <input type="range" min="6" max="20" step="1" value="${estado.cardio.tiros}" data-cardio="tiros">
          </div>` : ''}

        ${leve ? `<p class="pequeno apagado">Treinos intensos (limiar, 4x4, HIIT) ficam fora ${parqTemSim(p) ? 'até a liberação médica (triagem de saúde)' : 'para a sua idade/objetivo'}: o ganho de saúde vem do volume em zona leve.</p>` : ''}
        <div class="nota" style="margin-top:4px"><strong>${h(sessao.nome)} · ${minutosTexto(sessao.duracao)}</strong>${h(sessao.objetivo)}</div>

        ${sessao.blocos.map((b) => `
          <div class="bloco">
            <div class="bloco-tempo">${b.minutos}′</div>
            <div class="bloco-corpo">
              <div class="bloco-fase">${h(b.fase)} <span class="etiqueta" style="margin-left:4px">${b.bpm ? `${b.bpm.min}–${b.bpm.max} bpm` : h(b.zonaNome)}</span></div>
              <div class="bloco-desc">${h(b.descricao)}</div>
            </div>
          </div>`).join('')}

        ${cal ? `<div class="pequeno apagado" style="margin-top:12px">≈ ${cal.kcal} kcal · ${h(cal.aviso)}</div>` : ''}

        <button class="btn btn-largo btn-principal" data-acao="salvar-cardio" style="margin-top:12px">Fiz esta sessão</button>
        <p class="pequeno apagado" style="margin-top:6px">Toque depois de treinar: entra no histórico, no XP e na sequência.</p>
      </div>

      <div class="cartao">
        <div class="cartao-titulo"><h2>Sua semana</h2><span class="etiqueta">${p.freqCardio}× por semana</span></div>
        <p class="pequeno apagado">${h(plano.distribuicao.explicacao)}</p>
        <div class="grade" style="margin:12px 0">
          <div><div class="rotulo">Leve (Z1-Z2)</div><div class="numerao" style="font-size:22px;color:var(--ok)">${plano.distribuicao.leve} min</div></div>
          <div><div class="rotulo">Intenso (Z4-Z5)</div><div class="numerao" style="font-size:22px;color:var(--destaque)">${plano.distribuicao.intenso} min</div></div>
        </div>
        ${plano.sessoes.map((s, i) => `
          <div class="item" style="cursor:default">
            <div class="item-icone">${i + 1}</div>
            <div class="item-corpo">
              <div class="item-nome">${h(Aerobico.MODELOS[s.modelo].nome)}</div>
              <div class="item-sub">${s.minutos} min · ${h(Aerobico.MODELOS[s.modelo].objetivo)}</div>
            </div>
          </div>`).join('')}
        ${plano.nota ? `<div class="nota neutra">${h(plano.nota)}</div>` : ''}
      </div>

      <div class="cartao">
        <div class="cartao-titulo"><h3>Aeróbico + musculação no mesmo dia</h3></div>
        <div class="nota ${ordem.risco === 'alto' ? 'atencao' : 'neutra'}">
          <strong>${h(ordem.ordem)}</strong>${h(ordem.texto)}
        </div>
        <p class="pequeno apagado">${h(Aerobico.conflitoComPernas({ diasEntre: 0 }).texto)}</p>
      </div>

      ${Dados.cardios().length ? `
        <div class="cartao">
          <div class="cartao-titulo"><h3>Sessões salvas</h3></div>
          ${Dados.cardios().map((s) => `
            <div class="item" style="cursor:default">
              <div class="item-icone">❤️</div>
              <div class="item-corpo">
                <div class="item-nome">${h(s.nome)}</div>
                <div class="item-sub">${h(s.modalidade)} · ${minutosTexto(s.duracao)}</div>
              </div>
              <button class="btn btn-pequeno btn-perigo" data-acao="apagar-cardio" data-id="${h(s.id)}">×</button>
            </div>`).join('')}
        </div>` : ''}
    `;
  }

  // ---------- tela: execucao do treino ----------

  /** Anel do cronometro (SVG): fracao 0..1 do tempo que falta. */
  function anelTempo(restante, total, idEl, cor = 'var(--coral)') {
    const r = 100, c = 2 * Math.PI * r;
    const frac = total > 0 ? Math.max(0, Math.min(1, restante / total)) : 0;
    const min = Math.floor(restante / 60), seg = restante % 60;
    return `
      <div class="anel">
        <svg viewBox="0 0 230 230" aria-hidden="true">
          <circle cx="115" cy="115" r="${r}" fill="none" style="stroke:var(--cartao-alto)" stroke-width="10"/>
          <circle id="${idEl}-anel" cx="115" cy="115" r="${r}" fill="none" stroke="${cor}" stroke-width="10" stroke-linecap="round"
            stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - frac)).toFixed(1)}" data-c="${c.toFixed(1)}" data-total="${total}"/>
        </svg>
        <div class="relogio ${restante <= 3 ? 'acabando' : ''}" id="${idEl}" role="timer" aria-live="off">${min}:${String(seg).padStart(2, '0')}</div>
      </div>`;
  }

  function telaExecucao() {
    const ex = estado.execucao;
    if (!ex) return telaFichas();
    const item = ex.itens[ex.iEx];
    if (!item) return telaFichas(); // seguranca, nao deveria acontecer

    const dadosEx = BASE.find((x) => x.id === item.exId);
    const serieAtual = item.sets.length + 1;
    const progressoPct = Math.round(((ex.iEx + (item.sets.length / Math.max(1, item.seriesAlvo))) / ex.itens.length) * 100);
    const bloco = item.bloco || 'principal';

    const spotifyConectado = !!Dados.spotify().refreshToken;
    const blocoSpotify = spotifyConectado
      ? `<div class="cartao"><div id="spotify-widget"><div class="pequeno apagado" style="text-align:center;padding:6px 0">Carregando…</div></div></div>`
      : `<button class="btn btn-largo btn-fantasma pequeno" data-acao="ir" data-tela="perfil" style="margin-top:4px">Ligar o Spotify pra treinar com música</button>`;

    const topo = `
      <div class="topo">
        <button class="voltar" data-acao="encerrar-treino-confirma" aria-label="Sair do treino">‹</button>
        <h1 style="font-size:24px">${h(ex.fichaNome)}</h1>
        <button class="btn btn-pequeno" data-acao="ir-cronometro" aria-label="Cronômetro">⏱️</button>
      </div>
      <div class="barra-fundo" style="margin-bottom:12px"><div class="barra-frente" style="width:${progressoPct}%;background:var(--gradiente)"></div></div>
      <div class="bloco-titulo bloco-${bloco}" style="margin-top:0"><span class="bolinha"></span>${NOME_BLOCO[bloco] || 'Treino'} <span class="apagado pequeno" style="font-weight:500">· ${ex.iEx + 1} de ${ex.itens.length}</span></div>`;

    if (ex.descansando) {
      const restante = Math.max(0, Math.ceil((ex.fimDescanso - Date.now()) / 1000));
      const proxima = item.sets.length >= item.seriesAlvo ? (ex.itens[ex.iEx + 1] || null) : item;
      const exProx = proxima ? BASE.find((x) => x.id === proxima.exId) : null;
      return `
        ${topo}
        <div class="cartao" style="text-align:center;padding:22px 16px">
          <h2 style="margin-bottom:12px">Descansando</h2>
          ${anelTempo(restante, ex.descansoTotal || item.descansoAlvo, 'descanso-timer')}
          <div class="linha-btn" style="margin-top:18px">
            <button class="btn" data-acao="ajustar-descanso" data-seg="-15">−15s</button>
            <button class="btn btn-principal" data-acao="pular-descanso">Pular</button>
            <button class="btn" data-acao="ajustar-descanso" data-seg="15">+15s</button>
          </div>
        </div>
        <div class="item" style="cursor:default">
          <div class="item-icone">${thumbExercicio(exProx)}</div>
          <div class="item-corpo"><div class="rotulo">Próximo</div><div class="item-nome">${exProx ? h(exProx.nome) : 'Fim do treino 🎉'}</div></div>
        </div>
        ${blocoSpotify}
      `;
    }

    const midia = dadosEx ? midiaExercicio(dadosEx, { compacto: true }) : '';

    // ----- aquecimento / alongamento / equilibrio: sem carga, so fazer (com tempo, se houver) -----
    if (ehItemSimples(item)) {
      const temTempo = !!item.tempoSeg;
      const rodando = ex.timerItem && ex.timerItem.ate > Date.now();
      const restante = rodando ? Math.ceil((ex.timerItem.ate - Date.now()) / 1000) : (item.tempoSeg || 0);
      // acao primeiro (pedido da Grace no teste do celular: marcar sem rolar), imagem depois
      return `
        ${topo}
        <div class="cartao" style="text-align:center">
          <h2 style="margin-bottom:4px">${h(item.nome)}</h2>
          <div class="pequeno apagado" style="margin-bottom:12px">${h(item.repsTexto || '')}${item.seriesAlvo > 1 ? ` · ${item.seriesAlvo} vezes` : ''}${item.grupo ? ` · ${h(item.grupo)}` : ''}</div>
          ${temTempo ? anelTempo(restante, item.tempoSeg, 'item-timer', 'var(--coral)') : ''}
          <div class="linha-btn" style="margin-top:14px">
            ${temTempo && !rodando ? `<button class="btn btn-turquesa" data-acao="iniciar-tempo-item">Iniciar ${item.tempoSeg >= 60 ? Math.round(item.tempoSeg / 60) + ' min' : item.tempoSeg + 's'}</button>` : ''}
            <button class="btn btn-principal" data-acao="concluir-simples">✓ Feito</button>
          </div>
          <button class="btn btn-largo btn-fantasma" data-acao="pular-exercicio" style="margin-top:8px">Pular este</button>
        </div>
        ${midia}
        ${blocoSpotify}
      `;
    }

    const ultimo = Dados.ultimoRegistro(item.exId);
    const ultimoSet = ultimo && ultimo.sets[item.sets.length] ? ultimo.sets[item.sets.length] : (ultimo && ultimo.sets[ultimo.sets.length - 1]);
    // rascunho: o que a pessoa digitou antes de abrir "Como executar"/cronometro volta igual
    const ultimaSug = item.rascunho ? item.rascunho : item.sets.length
      ? item.sets[item.sets.length - 1]
      : { carga: item.cargaSugerida?.carga ?? (ultimoSet ? ultimoSet.carga : ''), reps: ultimoSet ? ultimoSet.reps : item.repsAlvoMin, rir: item.rirAlvo };

    // ordem pensada para o meio do treino: o que se toca a cada serie (campos + Concluir) fica
    // logo abaixo do topo, sem rolar; ultima vez, dicas e imagens vem depois
    return `
      ${topo}

      <div class="cartao">
        <h2 style="margin-bottom:2px;text-align:center">${h(item.nome)}</h2>
        <div class="pequeno apagado" style="text-align:center;margin-bottom:8px">Série ${serieAtual} de ${item.seriesAlvo}${item.adiado ? ' · você deixou este para depois' : ''}</div>
        <div class="rotulo">Alvo: ${item.repsAlvoMin}-${item.repsAlvoMax} reps · parar com ${item.rirAlvo} de sobra · descanso ${item.descansoAlvo}s</div>
        <div style="margin-top:8px">${ultimoTreinoHtml(item.exId)}</div>
        <div class="campos-lado-3" style="margin-top:10px">
          <div class="campo">
            <label for="exec-carga">Carga (kg)</label>
            <input type="number" inputmode="decimal" step="1.25" id="exec-carga" value="${h(ultimaSug.carga)}">
          </div>
          <div class="campo">
            <label for="exec-reps">Reps</label>
            <input type="number" inputmode="numeric" id="exec-reps" value="${h(ultimaSug.reps)}">
          </div>
          <div class="campo">
            <label for="exec-rir">De sobra</label>
            <input type="number" inputmode="numeric" id="exec-rir" value="${h(ultimaSug.rir)}">
          </div>
        </div>
        <p class="pequeno apagado" style="margin:0 0 8px">"De sobra" = quantas repetições você ainda conseguiria fazer no fim da série.</p>
        <button class="btn btn-largo btn-principal" data-acao="concluir-serie" style="margin-top:4px">✓ Concluir série</button>
      </div>

      ${item.sets.length ? `
        <div class="etiquetas" style="margin-bottom:12px">
          ${item.sets.map((st, i) => `<span class="etiqueta ok">Série ${i + 1}: ${h(st.carga)}kg × ${h(st.reps)}</span>`).join('')}
        </div>` : ''}

      ${item.obs ? `<div class="nota neutra">${h(item.obs)}</div>` : ''}
      ${item.cargaSugerida?.motivo ? `<div class="nota"><strong>${item.cargaSugerida.carga !== null ? h(item.cargaSugerida.carga) + ' kg' : 'Sugestão'}</strong>${h(item.cargaSugerida.motivo)}</div>` : ''}

      ${midia}

      <div class="linha-btn">
        <button class="btn" data-acao="ver-exercicio" data-id="${h(item.exId)}" data-voltar="execucao">Como executar</button>
        <button class="btn" data-acao="trocar-equipamento">Aparelho ocupado</button>
      </div>
      <button class="btn btn-largo" data-acao="trocar-foto-exercicio" data-id="${h(item.exId)}" style="margin-top:8px">${Dados.fotoExercicio(item.exId) ? 'Trocar minha foto neste aparelho' : 'Tirar minha foto neste aparelho'}</button>
      <button class="btn btn-largo btn-fantasma" data-acao="pular-exercicio" style="margin-top:8px">Pular exercício</button>
      <p class="pequeno apagado" style="margin-top:10px">${h(SINAIS_PARAR)}</p>

      ${blocoSpotify}
    `;
  }

  // ---------- tela: cronometro (timer com alarme, cronometro e intervalado) ----------

  function telaCronometro() {
    const c = estado.crono;
    const voltar = estado.execucao ? 'execucao' : 'inicio';
    const abas = [['timer', 'Timer'], ['cronometro', 'Cronômetro'], ['intervalo', 'Intervalado']];
    let corpo = '';
    if (c.modo === 'timer') {
      const rodando = c.rodando;
      const restante = rodando ? Math.max(0, Math.ceil((c.ate - Date.now()) / 1000)) : (c.pausadoRestante ?? c.total);
      corpo = `
        ${anelTempo(restante, c.total, 'crono-visor')}
        <div class="chips" style="justify-content:center;margin:16px 0 6px">
          ${[30, 45, 60, 90, 120, 180, 300].map((sg) => `<button class="chip ${c.total === sg ? 'ativo' : ''}" data-acao="crono-preset" data-seg="${sg}">${sg < 60 ? sg + 's' : (sg / 60) + ' min'}</button>`).join('')}
        </div>
        <div class="linha-btn" style="margin-top:10px">
          <button class="btn" data-acao="crono-ajustar" data-seg="-10">−10s</button>
          ${rodando ? `<button class="btn btn-festa" data-acao="crono-pausar">Pausar</button>` : `<button class="btn btn-principal" data-acao="crono-iniciar">Iniciar</button>`}
          <button class="btn" data-acao="crono-ajustar" data-seg="10">+10s</button>
        </div>
        <button class="btn btn-largo btn-fantasma" data-acao="crono-zerar" style="margin-top:8px">Zerar</button>`;
    } else if (c.modo === 'cronometro') {
      const decorrido = (c.acumulado || 0) + (c.rodando ? Date.now() - c.inicio : 0);
      corpo = `
        <div class="relogio" id="crono-visor" style="text-align:center;margin:30px 0">${formatarMs(decorrido)}</div>
        <div class="linha-btn">
          ${c.rodando ? `<button class="btn btn-festa" data-acao="crono-pausar">Pausar</button><button class="btn" data-acao="crono-volta">Volta</button>` : `<button class="btn btn-principal" data-acao="crono-iniciar">${decorrido ? 'Continuar' : 'Iniciar'}</button>`}
        </div>
        <button class="btn btn-largo btn-fantasma" data-acao="crono-zerar" style="margin-top:8px">Zerar</button>
        ${(c.voltas || []).length ? `<div class="cartao" style="margin-top:14px">${c.voltas.map((v, i) => `<div class="bloco"><div class="bloco-tempo">${c.voltas.length - i}</div><div class="bloco-corpo"><div class="bloco-fase">${formatarMs(v)}</div></div></div>`).join('')}</div>` : ''}`;
    } else {
      const iv = c.intervalo;
      const rodando = c.rodando;
      const fase = iv.fase || 'trabalho';
      const total = fase === 'trabalho' ? iv.trabalho : iv.descanso;
      const restante = rodando ? Math.max(0, Math.ceil((c.ate - Date.now()) / 1000)) : (c.pausadoRestante ?? iv.trabalho);
      corpo = `
        <div class="centro" style="margin-bottom:8px"><span class="etiqueta ${fase === 'trabalho' ? 'destaque' : 'turquesa'}" style="font-size:16px">${fase === 'trabalho' ? 'Trabalho' : 'Descanso'} · rodada ${iv.rodada || 1} de ${iv.rodadas}</span></div>
        ${anelTempo(restante, total, 'crono-visor', fase === 'trabalho' ? 'var(--coral)' : 'var(--turquesa)')}
        ${!rodando ? `
        <div class="campos-lado-3" style="margin-top:16px">
          <div class="campo"><label>Trabalho (s)</label><input type="number" inputmode="numeric" value="${iv.trabalho}" data-crono="trabalho"></div>
          <div class="campo"><label>Descanso (s)</label><input type="number" inputmode="numeric" value="${iv.descanso}" data-crono="descanso"></div>
          <div class="campo"><label>Rodadas</label><input type="number" inputmode="numeric" value="${iv.rodadas}" data-crono="rodadas"></div>
        </div>
        <div class="chips" style="margin-bottom:10px">
          <button class="chip" data-acao="crono-iv-preset" data-t="20" data-d="10" data-r="8">Tabata 20/10 ×8</button>
          <button class="chip" data-acao="crono-iv-preset" data-t="40" data-d="20" data-r="10">HIIT 40/20 ×10</button>
          <button class="chip" data-acao="crono-iv-preset" data-t="30" data-d="30" data-r="8">Leve 30/30 ×8</button>
        </div>` : ''}
        <div class="linha-btn" style="margin-top:10px">
          ${rodando ? `<button class="btn btn-festa" data-acao="crono-pausar">Pausar</button>` : `<button class="btn btn-principal" data-acao="crono-iniciar">Iniciar</button>`}
        </div>
        <button class="btn btn-largo btn-fantasma" data-acao="crono-zerar" style="margin-top:8px">Zerar</button>`;
    }
    return `
      <div class="topo">
        <button class="voltar" data-acao="ir" data-tela="${voltar}">‹</button>
        <h1>Cronômetro</h1>
        <button class="btn btn-pequeno" data-acao="som-toggle" aria-label="Som do alarme">${Alarme.somLigado() ? '🔔' : '🔕'}</button>
      </div>
      <div class="midia-abas" style="margin-bottom:16px">
        ${abas.map(([k, rot]) => `<button class="midia-aba ${c.modo === k ? 'ativo' : ''}" data-acao="crono-modo" data-modo="${k}">${rot}</button>`).join('')}
      </div>
      <div class="cartao" style="padding:20px 16px">${corpo}</div>
      <p class="pequeno apagado centro">O alarme toca e vibra no fim${Alarme.permissao() === 'granted' ? ', e avisa por notificação se a tela estiver em outro app' : ''}. Deixe o volume ligado.</p>
      ${Alarme.permissao() === 'default' ? `<button class="btn btn-largo" data-acao="pedir-notificacao">Permitir avisos de fim de tempo</button>` : ''}
    `;
  }

  function formatarMs(ms) {
    const total = Math.floor(ms / 100);
    const dec = total % 10, s = Math.floor(total / 10) % 60, m = Math.floor(total / 600);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}<span style="font-size:0.5em">.${dec}</span>`;
  }

  function modalTrocarEquipamento() {
    const ex = estado.execucao;
    if (!ex) return;
    const item = ex.itens[ex.iEx];
    const dadosEx = BASE.find((x) => x.id === item.exId);
    const p = Dados.perfil();
    const subs = Forca.substitutos(dadosEx, BASE, { limite: 12, perfil: perfilTreino() });
    // "fazer depois" so faz sentido se ainda ha outro exercicio no mesmo bloco pra fazer antes
    const bloco = item.bloco || 'principal';
    const podeAdiar = ex.itens.slice(ex.iEx + 1).some((it) => (it.bloco || 'principal') === bloco);
    const musculos = (dadosEx?.musculos_primarios || []).slice(0, 3).join(', ');
    abrirModal(`
      <h2>Aparelho ocupado?</h2>
      ${podeAdiar ? `
        <button class="btn btn-largo btn-principal" data-acao="fazer-depois">Fazer depois</button>
        <p class="pequeno apagado" style="margin-top:6px">Você segue para o próximo exercício e este volta no fim do ${h((NOME_BLOCO[bloco] || 'treino').toLowerCase())}, quando o aparelho já deve estar livre.</p>` : ''}
      <h3 style="margin-top:16px">Ou troque por outro do mesmo músculo</h3>
      <p class="pequeno apagado">${musculos ? `Trabalham ${h(musculos)}, com outro equipamento.` : 'Mesmo músculo, outro equipamento.'} Suas cargas de cada exercício ficam guardadas separadas.</p>
      ${subs.length ? subs.map((s) => `
        <div class="item" data-acao="confirmar-troca" data-id="${h(s.id)}">
          <div class="item-icone">${thumbExercicio(s)}</div>
          <div class="item-corpo"><div class="item-nome">${h(s.nome)}</div><div class="item-sub">${h(nomeAparelho(s.aparelho) || s.equipamento)} · ${h((s.musculos_primarios || []).slice(0, 2).join(', '))}</div></div>
          <div class="item-fim">›</div>
        </div>`).join('') : '<p class="apagado">Não achei alternativa com outro equipamento pra esse exercício.</p>'}
      <button class="btn btn-largo" data-acao="fechar-modal" style="margin-top:10px">Cancelar</button>
    `);
  }

  /** Resumo festivo ao terminar o treino. */
  function modalResumoTreino({ xpGanho, novosBadges, nivel, subiuNivel }) {
    abrirModal(`
      <div class="centro" style="padding:8px 0 4px">
        <h2>Treino concluído</h2>
        <p class="apagado">Mandou bem. Descanse e volte forte.</p>
      </div>
      <div class="cartao cartao-gradiente centro">
        <div class="rotulo">Experiência ganha</div>
        <div class="numerao" style="font-size:34px">+${xpGanho} XP</div>
        ${subiuNivel ? `<div class="pequeno" style="margin-top:4px">${nivel.icon} Novo nível: ${h(nivel.nome)}!</div>` : ''}
      </div>
      ${novosBadges.length ? `
        <h3>Novo${novosBadges.length > 1 ? 's' : ''} badge${novosBadges.length > 1 ? 's' : ''}!</h3>
        ${novosBadges.map((b) => `
          <div class="item" style="cursor:default">
            <div class="item-icone" style="font-size:30px">${b.icon}</div>
            <div class="item-corpo"><div class="item-nome">${h(b.nome)}</div><div class="item-sub">${h(b.desc)}</div></div>
          </div>`).join('')}` : ''}
      <button class="btn btn-largo btn-principal" data-acao="fechar-resumo-treino" style="margin-top:14px">Show de bola</button>
    `);
  }

  // ---------- tela: evolucao ----------

  /** Evolucao: cada exercicio ja feito, uma vez so, com as series da ultima vez (mais recente
   *  primeiro). Os 8 primeiros ficam a vista; o resto num "Ver todos" que abre sem recarregar. */
  function cartaoUltimaVezPorExercicio(sessoes) {
    const vistos = new Set();
    const lista = [];
    for (const s of sessoes) {
      for (const ex of s.exercicios || []) {
        if (vistos.has(ex.exId) || !(ex.sets || []).length) continue;
        vistos.add(ex.exId);
        lista.push({ ex, data: s.data });
      }
    }
    if (!lista.length) return '';
    const linha = ({ ex, data }) => `
      <button class="item" data-acao="ver-exercicio" data-id="${h(ex.exId)}" data-voltar="evolucao" style="width:100%;text-align:left;font:inherit;color:inherit">
        <div class="item-corpo">
          <div class="item-nome">${h(ex.nome)}</div>
          <div class="pequeno apagado">${new Date(data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} · ${resumoSeries(ex.sets)}</div>
        </div>
      </button>`;
    return `
      <div class="cartao">
        <div class="cartao-titulo"><h3>Última vez em cada exercício</h3></div>
        <p class="pequeno apagado">Séries, repetições e peso do último treino de cada um.</p>
        ${lista.slice(0, 8).map(linha).join('')}
        ${lista.length > 8 ? `<details><summary class="btn btn-largo" style="list-style:none">Ver todos (${lista.length})</summary><div style="margin-top:8px">${lista.slice(8).map(linha).join('')}</div></details>` : ''}
      </div>`;
  }

  function heatmapDias(dias, semanas = 12) {
    const set = new Set(dias);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    // a ultima coluna e a semana de HOJE (antes a grade terminava antes dela e o treino de hoje
    // nao aparecia); conta por data de calendario, sem somar ms (horario de verao)
    const inicio = new Date(hoje);
    inicio.setDate(hoje.getDate() - hoje.getDay() - (semanas - 1) * 7);

    const colunas = [];
    for (let sem = 0; sem < semanas; sem++) {
      const dias7 = [];
      for (let d = 0; d < 7; d++) {
        const dt = new Date(inicio);
        dt.setDate(inicio.getDate() + sem * 7 + d);
        const chave = dt.toLocaleDateString('sv-SE');
        const treinou = set.has(chave);
        const futuro = dt > hoje;
        dias7.push(`<div title="${chave}" style="width:11px;height:11px;border-radius:3px;background:${futuro ? 'transparent' : treinou ? 'var(--destaque-clara)' : 'var(--cartao-alto)'}"></div>`);
      }
      colunas.push(`<div style="display:flex;flex-direction:column;gap:3px">${dias7.join('')}</div>`);
    }
    return `<div style="display:flex;gap:3px;overflow-x:auto;padding-bottom:4px">${colunas.join('')}</div>`;
  }

  function telaEvolucao() {
    const gam = Dados.gam();
    const nivel = Gamificacao.nivelPorXP(gam.xp);
    const dias = Dados.diasTreinados();
    const streak = Gamificacao.calcularStreak(dias);
    const sessoes = Dados.sessoes();
    const pesos = Dados.pesos();

    return `
      <div class="marca-topo"><img src="icons/icone-192.png" alt=""><span>TRIVOX</span></div>
      <div class="topo"><h1>Evolução</h1></div>

      <div class="cartao">
        <div style="display:flex;align-items:center;gap:14px">
          <div style="flex:1">
            <div class="rotulo">Nível</div>
            <div style="font-weight:600;font-size:18px">${h(nivel.nome)}</div>
            <div class="barra-fundo" style="margin-top:8px"><div class="barra-frente" style="width:${nivel.progresso}%;background:var(--destaque)"></div></div>
            <div class="pequeno apagado" style="margin-top:6px">${nivel.proximo ? `${gam.xp} XP · faltam ${nivel.faltam} para ${h(nivel.proximo.nome)}` : `${gam.xp} XP · nível máximo!`}</div>
          </div>
        </div>
      </div>

      <div class="grade">
        <div class="cartao">
          <div class="numerao" style="font-size:26px">${streak.atual}</div>
          <div class="rotulo">dias seguidos</div>
        </div>
        <div class="cartao">
          <div class="numerao" style="font-size:26px">${streak.maximo}</div>
          <div class="rotulo">recorde de streak</div>
        </div>
      </div>

      ${cartaoUltimaVezPorExercicio(sessoes)}

      <div class="cartao">
        <div class="cartao-titulo"><h3>Consistência</h3></div>
        ${heatmapDias(dias)}
        <div class="pequeno apagado" style="margin-top:6px">${dias.length} dia${dias.length === 1 ? '' : 's'} treinados nos últimos ~3 meses</div>
      </div>

      <div class="cartao">
        <div class="cartao-titulo"><h3>Peso</h3><button class="btn btn-pequeno" data-acao="abrir-registrar-peso">+ Registrar</button></div>
        ${pesos.length >= 2 ? graficoLinha([...pesos].reverse().map((p) => Number(p.peso) || 0), { cor: 'var(--destaque-clara)' }) : ''}
        ${pesos.length ? `
          <div class="pequeno apagado" style="margin-top:8px">
            Última: ${pesos[0].peso}kg em ${new Date(pesos[0].data).toLocaleDateString('pt-BR')}
            ${pesos.length >= 2 ? (() => {
              const dif = Math.round((pesos[0].peso - pesos[pesos.length - 1].peso) * 10) / 10;
              return ` · ${dif > 0 ? '+' : ''}${dif}kg desde o primeiro registro`;
            })() : ''}
          </div>` : `<p class="apagado pequeno">Nenhuma pesagem registrada ainda.</p>`}
      </div>

      <div class="cartao">
        <div class="cartao-titulo"><h3>Badges</h3><span class="pequeno apagado">${gam.badges.length}/${Gamificacao.BADGES.length}</span></div>
        <div class="grade-3">
          ${Gamificacao.BADGES.map((b) => {
            const on = gam.badges.includes(b.id);
            return `<div class="cartao" style="text-align:center;padding:12px 6px;margin-bottom:0;opacity:${on ? 1 : 0.35}">
              <div style="font-size:26px">${b.icon}</div>
              <div class="pequeno" style="margin-top:4px;font-weight:600">${h(b.nome)}</div>
            </div>`;
          }).join('')}
        </div>
      </div>


      <div class="cartao">
        <div class="cartao-titulo"><h3>Histórico de treinos</h3></div>
        <p class="pequeno apagado">Cada treino, com todas as séries. Toque para abrir.</p>
        ${sessoes.length ? sessoes.slice(0, 20).map((s) => {
          const aberta = estado.sessaoExpandida === s.id;
          return `
          <div class="item" data-acao="expandir-sessao" data-id="${h(s.id)}" style="flex-direction:column;align-items:stretch">
            <div style="display:flex;align-items:center;gap:12px;width:100%">
              <div class="item-icone">${icone(s.tipo === 'cardio' ? 'cardio' : 'haltere')}</div>
              <div class="item-corpo">
                <div class="item-nome">${h(s.fichaNome)}</div>
                <div class="item-sub">${new Date(s.data).toLocaleDateString('pt-BR')} · ${minutosTexto(Math.round((s.duracaoSeg || 0) / 60))}${s.xpGanho ? ` · +${s.xpGanho} XP` : ''}</div>
              </div>
              <div class="item-fim">${aberta ? '▲' : '▼'}</div>
            </div>
            ${aberta ? `
              <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--borda);width:100%">
                ${(s.exercicios || []).map((ex) => `
                  <div style="margin-bottom:8px">
                    <div class="pequeno" style="font-weight:700">${h(ex.nome)}</div>
                    <div class="etiquetas" style="margin-top:4px">
                      ${ex.sets.map((set, i) => `<span class="etiqueta">S${i + 1}: ${h(set.carga)}kg×${h(set.reps)}${set.rir !== null && set.rir !== undefined ? ` (${h(set.rir)} de sobra)` : ''}</span>`).join('')}
                    </div>
                  </div>`).join('')}
                ${s.cardioResumo ? `<div class="pequeno apagado">${h(s.cardioResumo.nome)} · ${h(s.cardioResumo.modalidade)}</div>` : ''}
                <button class="btn btn-pequeno btn-perigo" data-acao="apagar-sessao" data-id="${h(s.id)}" style="margin-top:6px">Apagar este treino</button>
              </div>` : ''}
          </div>`;
        }).join('') : '<p class="apagado pequeno">Termine um treino pra começar seu histórico.</p>'}
      </div>
    `;
  }

  // ---------- tela: coach ----------

  function telaCoach() {
    const p = Dados.perfil();
    const streak = Gamificacao.calcularStreak(Dados.diasTreinados());

    return `
      <div class="topo">
        <button class="voltar" data-acao="ir" data-tela="evolucao">‹</button>
        <h1>Coach</h1>
      </div>
      <p class="pequeno apagado">Não é IA — são as mesmas dicas que um personal repetiria, organizadas por tema. Sem internet, sem custo, sempre disponível.</p>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:4px 0 14px">
        ${Object.entries(Gamificacao.COACH_TEMAS).map(([k, t]) => `<button class="btn btn-pequeno" data-acao="coach-tema" data-tema="${k}" style="white-space:normal;line-height:1.2;text-align:center">${t.icon} ${h(t.nome.replace(/^\S+\s/, ''))}</button>`).join('')}
      </div>

      <div id="coach-lista">
        ${estado.coach.mensagens.length ? estado.coach.mensagens.map((m) => `
          <div class="nota ${m.de === 'user' ? 'neutra' : ''}" style="${m.de === 'user' ? 'text-align:right' : ''}">
            ${m.de === 'coach' ? `<strong>${m.icon} ${h(m.temaNome)}</strong>` : ''}
            ${h(m.texto)}
          </div>`).join('') : '<p class="apagado pequeno">Escolha um tema acima ou escreva sua dúvida abaixo.</p>'}
      </div>

      <div class="campo" style="margin-top:8px">
        <div style="display:flex;gap:8px">
          <input id="coach-input" placeholder="Pergunte algo..." data-perfil-nome="${h(p.nome)}" data-streak="${streak.atual}">
          <button class="btn btn-principal" data-acao="coach-enviar">Enviar</button>
        </div>
      </div>
    `;
  }

  /** Card de peso e bioimpedância no Perfil: historico + atalho pra registrar pesagem nova. */
  function telaPerfilPeso() {
    const registros = Dados.pesos();
    const ultimo = registros[0] || null;

    return `
      <div class="cartao">
        <div class="cartao-titulo"><h2>Peso & bioimpedância</h2></div>
        ${ultimo ? `
          <div class="grade" style="margin-bottom:10px">
            <div>
              <div class="rotulo">Última pesagem</div>
              <div class="numerao" style="font-size:26px">${h(ultimo.peso)} <span style="font-size:14px;color:var(--apagado)">kg</span></div>
              <div class="pequeno apagado">${new Date(ultimo.data).toLocaleDateString('pt-BR')}</div>
            </div>
            ${ultimo.gordura ? `<div><div class="rotulo">Gordura corporal</div><div class="numerao" style="font-size:26px">${h(ultimo.gordura)}<span style="font-size:14px;color:var(--apagado)">%</span></div></div>` : ''}
          </div>
          ${(ultimo.massaMuscular || ultimo.agua || ultimo.visceral || ultimo.tmb) ? `
            <div class="etiquetas" style="margin-bottom:10px">
              ${ultimo.massaMuscular ? `<span class="etiqueta">Massa muscular: ${h(ultimo.massaMuscular)}kg</span>` : ''}
              ${ultimo.agua ? `<span class="etiqueta">Água: ${h(ultimo.agua)}%</span>` : ''}
              ${ultimo.visceral ? `<span class="etiqueta">Gordura visceral: ${h(ultimo.visceral)}</span>` : ''}
              ${ultimo.tmb ? `<span class="etiqueta">TMB: ${ultimo.tmb}kcal</span>` : ''}
            </div>` : ''}
          ${registros.length > 1 ? `
            <div class="pequeno apagado" style="margin-bottom:10px">
              ${registros.slice(1, 5).map((r) => `${h(r.peso)}kg em ${new Date(r.data).toLocaleDateString('pt-BR')}`).join(' · ')}
            </div>` : ''}
        ` : `
          <p class="pequeno apagado">Registre sua pesagem pra acompanhar a evolução ao longo do tempo. Se tiver balança de bioimpedância, os campos extras (gordura, massa muscular, água, visceral) são opcionais.</p>
        `}
        <button class="btn btn-largo btn-principal" data-acao="abrir-registrar-peso">Registrar pesagem</button>
      </div>`;
  }

  /** Card de fotos de evolucao (antes/depois) no Perfil: comparativo + tira de miniaturas. */
  function telaPerfilFotos() {
    const fotos = Dados.fotosEvolucao(); // mais recente primeiro
    const antes = fotos[fotos.length - 1] || null;
    const atual = fotos[0] || null;

    return `
      <div class="cartao">
        <div class="cartao-titulo"><h2>Fotos de evolução</h2></div>
        ${fotos.length ? `
          ${fotos.length >= 2 ? `
            <div class="grade" style="margin-bottom:10px">
              <div>
                <img src="${h(antes.foto)}" alt="Antes" style="width:100%;aspect-ratio:3/4;object-fit:cover;border-radius:12px;cursor:pointer" data-acao="ver-foto-evolucao" data-id="${h(antes.id)}">
                <div class="pequeno apagado centro" style="margin-top:4px">Antes · ${new Date(antes.data).toLocaleDateString('pt-BR')}</div>
              </div>
              <div>
                <img src="${h(atual.foto)}" alt="Atual" style="width:100%;aspect-ratio:3/4;object-fit:cover;border-radius:12px;cursor:pointer" data-acao="ver-foto-evolucao" data-id="${h(atual.id)}">
                <div class="pequeno apagado centro" style="margin-top:4px">Atual · ${new Date(atual.data).toLocaleDateString('pt-BR')}</div>
              </div>
            </div>` : ''}
          ${fotos.length > 1 ? `
            <div style="display:flex;gap:8px;overflow-x:auto;padding:2px 0 10px;scrollbar-width:none">
              ${fotos.map((f) => `
                <div data-acao="ver-foto-evolucao" data-id="${h(f.id)}" style="flex-shrink:0;width:64px;cursor:pointer">
                  <img src="${h(f.foto)}" alt="" style="width:64px;height:64px;object-fit:cover;border-radius:10px;border:1px solid var(--borda)">
                  <div class="pequeno apagado centro" style="font-size:11px;margin-top:2px">${new Date(f.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</div>
                </div>`).join('')}
            </div>` : ''}
        ` : `
          <p class="pequeno apagado">Registre fotos ao longo do tempo pra ver sua evolução lado a lado — cada foto guarda a data automaticamente.</p>
        `}
        <button class="btn btn-largo btn-principal" data-acao="abrir-foto-evolucao">Adicionar foto</button>
      </div>`;
  }

  /** Modal de confirmacao apos escolher a foto: mostra preview, deixa anotar algo opcional, e so ai salva com a data de hoje. */
  function modalRegistrarFotoEvolucao() {
    const dataUrl = estado.fotoTemp;
    if (!dataUrl) return;
    abrirModal(`
      <h2>Nova foto — ${new Date().toLocaleDateString('pt-BR')}</h2>
      <img src="${h(dataUrl)}" alt="Prévia" style="width:100%;border-radius:14px;margin-bottom:12px">
      <p class="pequeno apagado">A data de hoje é registrada automaticamente.</p>
      <div class="campo"><label>Nota (opcional)</label><input id="foto-nota" placeholder="ex.: em jejum, pós-treino..."></div>
      <button class="btn btn-largo btn-principal" data-acao="salvar-foto-evolucao">Salvar</button>
      <button class="btn btn-largo btn-fantasma" data-acao="cancelar-foto-evolucao" style="margin-top:8px">Cancelar</button>
    `);
  }

  /** Modal de visualizacao de uma foto ja registrada, com opcao de apagar. */
  function modalVerFotoEvolucao(fid) {
    const f = Dados.fotosEvolucao().find((x) => x.id === fid);
    if (!f) return;
    abrirModal(`
      <h2>${new Date(f.data).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</h2>
      <img src="${h(f.foto)}" alt="" style="width:100%;border-radius:14px;margin-bottom:10px">
      ${f.nota ? `<p class="pequeno apagado">${h(f.nota)}</p>` : ''}
      <button class="btn btn-largo btn-perigo" data-acao="apagar-foto-evolucao" data-id="${h(f.id)}">Apagar</button>
      <button class="btn btn-largo btn-fantasma" data-acao="fechar-modal" style="margin-top:8px">Fechar</button>
    `);
  }

  function modalRegistrarPeso() {
    const p = Dados.perfil();
    const hoje = new Date().toLocaleDateString('sv-SE');
    abrirModal(`
      <h2>Registrar pesagem</h2>
      <div class="campos-lado">
        <div class="campo">
          <label>Peso (kg) *</label>
          <input type="number" inputmode="decimal" step="0.1" id="peso-valor" value="${numCampo(p.peso)}" placeholder="obrigatório">
        </div>
        <div class="campo">
          <label>Data</label>
          <input type="date" id="peso-data" value="${hoje}">
        </div>
      </div>
      <p class="pequeno apagado">Os campos abaixo são opcionais — só preencha se sua balança medir bioimpedância.</p>
      <div class="campos-lado">
        <div class="campo"><label>Gordura corporal (%)</label><input type="number" inputmode="decimal" step="0.1" id="peso-gordura"></div>
        <div class="campo"><label>Massa muscular (kg)</label><input type="number" inputmode="decimal" step="0.1" id="peso-massa"></div>
      </div>
      <div class="campos-lado">
        <div class="campo"><label>Água corporal (%)</label><input type="number" inputmode="decimal" step="0.1" id="peso-agua"></div>
        <div class="campo"><label>Gordura visceral</label><input type="number" inputmode="numeric" id="peso-visceral"></div>
      </div>
      <div class="campo"><label>TMB — taxa metabólica basal (kcal)</label><input type="number" inputmode="numeric" id="peso-tmb"></div>
      <button class="btn btn-largo btn-principal" data-acao="salvar-peso" style="margin-top:4px">Salvar</button>
      <button class="btn btn-largo btn-fantasma" data-acao="fechar-modal" style="margin-top:8px">Cancelar</button>
    `);
  }

  /** Card de nuvem no Perfil: login por link magico + status da sincronizacao automatica.
      Existe por causa de uma perda de dados real (ver historico/13) — diferente do backup em
      .zip (manual), aqui a copia sobe sozinha sempre que algo muda, contanto que haja login. */
  function telaPerfilNuvem() {
    const sessao = estado.nuvem.sessao;

    if (sessao) {
      const backup = Dados.backupMeta();
      return `
        <div class="cartao">
          <div class="cartao-titulo"><h2>Backup na nuvem</h2><span class="etiqueta ok">Conectado</span></div>
          <p class="pequeno apagado">Conta: <strong>${h(sessao.user.email)}</strong>. Seus dados sobem sozinhos pra nuvem sempre que mudam — se este aparelho perder tudo, é só entrar de novo com o mesmo e-mail pra recuperar.</p>
          ${backup.nuvemOkEm ? `<p class="pequeno apagado">Último envio para a nuvem: ${new Date(backup.nuvemOkEm).toLocaleString('pt-BR')}</p>` : ''}
          ${estado.nuvem.pendentes ? `<div class="nota atencao"><strong>Esperando internet</strong>${estado.nuvem.pendentes} parte(s) dos seus dados ainda não subiram. Sobem sozinhas quando a conexão voltar.</div>` : ''}
          <button class="btn btn-largo btn-perigo" data-acao="nuvem-sair">Sair desta conta</button>
        </div>`;
    }

    if (estado.nuvem.linkEnviadoPara) {
      return `
        <div class="cartao">
          <div class="cartao-titulo"><h2>Backup na nuvem</h2></div>
          <div class="nota">
            <strong>Verifique seu e-mail</strong>
            Mandei um código de acesso pra <strong>${h(estado.nuvem.linkEnviadoPara)}</strong>. Toque no link do e-mail (funciona no Safari), <strong>ou</strong> digite abaixo o código que veio na mensagem — use o código se estiver no ícone salvo na tela de início, onde o link não abre direto.
          </div>
          <div class="campo">
            <label>Código do e-mail</label>
            <input id="nuvem-codigo" inputmode="numeric" maxlength="12" placeholder="000000" autocomplete="one-time-code">
          </div>
          <button class="btn btn-largo btn-principal" data-acao="nuvem-confirmar-codigo" data-email="${h(estado.nuvem.linkEnviadoPara)}">Confirmar código</button>
          <button class="btn btn-largo" data-acao="nuvem-enviar-link" data-email="${h(estado.nuvem.linkEnviadoPara)}" style="margin-top:8px">Reenviar</button>
        </div>`;
    }

    return `
      <div class="cartao">
        <div class="cartao-titulo"><h2>Backup na nuvem</h2></div>
        <p class="pequeno apagado">Uma cópia de segurança automática, separada deste aparelho. Cada pessoa da família usa o próprio e-mail — ninguém vê o treino de ninguém.</p>
        <div class="campo">
          <label>Seu e-mail</label>
          <input id="nuvem-email" type="email" placeholder="seu@email.com" autocomplete="email">
        </div>
        <button class="btn btn-largo btn-principal" data-acao="nuvem-enviar-link">Enviar link de login</button>
        <p class="pequeno apagado" style="margin-top:8px">Sem senha — só um link no e-mail, uma vez só. Continua funcionando offline sem isso; é uma camada extra de segurança.</p>
      </div>`;
  }

  function telaPerfilSpotify() {
    const sp = Dados.spotify();
    const conectado = Spotify.tokenValido(sp) || !!sp.refreshToken;

    if (conectado) {
      return `
        <div class="cartao">
          <div class="cartao-titulo"><h2>Spotify</h2><span class="etiqueta ok">Conectado</span></div>
          <p class="pequeno apagado">Durante o treino, controle a música direto na tela de execução.</p>
          <button class="btn btn-largo btn-perigo" data-acao="spotify-desconectar">Desconectar</button>
        </div>`;
    }

    return `
      <div class="cartao">
        <div class="cartao-titulo"><h2>Spotify</h2></div>
        <p class="pequeno apagado">Toque música sem sair da tela de treino. É a única parte do app que precisa de internet — o resto continua funcionando offline.</p>
        <div class="nota neutra">
          <strong>Antes de conectar, uma vez só:</strong>
          1. Entre em <strong>developer.spotify.com/dashboard</strong> com sua conta Spotify e crie um app (gratuito).<br>
          2. Em "Redirect URIs", adicione exatamente:<br>
          <code style="user-select:all">${h(Spotify.redirectUri())}</code><br>
          3. Copie o <strong>Client ID</strong> do app criado e cole abaixo.
        </div>
        <div class="campo">
          <label>Client ID</label>
          <input id="spotify-client-id" value="${h(sp.clientId)}" placeholder="Cole aqui o Client ID" autocomplete="off">
        </div>
        <button class="btn btn-largo btn-principal" data-acao="spotify-conectar">Conectar Spotify</button>
        <p class="pequeno apagado" style="margin-top:8px">Conta Free consegue ver "tocando agora"; pausar, tocar e pular exigem Spotify Premium.</p>
      </div>`;
  }

  /** Widget de "tocando agora" — chamado de novo (fora do render principal) quando os dados chegam. */
  function renderSpotifyWidget(info) {
    const el = document.getElementById('spotify-widget');
    if (!el) return;
    if (!info) {
      el.innerHTML = `<div class="pequeno apagado" style="text-align:center;padding:6px 0">Nada tocando agora — abra o Spotify e toque algo.</div>`;
      return;
    }
    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px">
        ${info.capa ? `<img src="${h(info.capa)}" alt="" style="width:44px;height:44px;border-radius:8px;flex-shrink:0">` : '<div style="width:44px;height:44px;border-radius:8px;background:var(--cartao-alto);flex-shrink:0"></div>'}
        <div style="flex:1;min-width:0">
          <div class="item-nome" style="font-size:14px">${h(info.musica)}</div>
          <div class="item-sub">${h(info.artista)}</div>
        </div>
        <button class="btn btn-pequeno" data-acao="spotify-anterior">⏮</button>
        <button class="btn btn-pequeno btn-principal" data-acao="${info.tocando ? 'spotify-pausar' : 'spotify-tocar'}">${info.tocando ? '⏸' : '▶'}</button>
        <button class="btn btn-pequeno" data-acao="spotify-proxima">⏭</button>
      </div>`;
  }

  /** Card de video do exercicio — chamado de fora (app.js) quando o IndexedDB responde,
      igual renderSpotifyWidget. Confere data-exid pra nao pintar por cima da tela errada
      se a pessoa ja tiver saido do exercicio antes do IndexedDB responder. */
  function renderVideoExercicio(exId, videoUrl) {
    const el = document.getElementById('video-exercicio');
    if (!el || el.dataset.exid !== exId) return;
    if (videoUrl) {
      el.innerHTML = `
        <video src="${videoUrl}" controls playsinline style="width:100%;border-radius:12px;background:#000"></video>
        <div class="linha-btn" style="margin-top:8px">
          <button class="btn btn-pequeno" data-acao="trocar-video-exercicio" data-id="${h(exId)}">Trocar vídeo</button>
          <button class="btn btn-pequeno btn-perigo" data-acao="apagar-video-exercicio" data-id="${h(exId)}">Remover</button>
        </div>`;
    } else {
      el.innerHTML = `
        <p class="pequeno apagado">Grave (ou escolha da galeria) um vídeo curto seu fazendo este exercício — fica salvo só no aparelho, pra rever quando quiser. Um clipe de 5-15s já basta.</p>
        <button class="btn btn-largo btn-principal" data-acao="trocar-video-exercicio" data-id="${h(exId)}">Adicionar vídeo</button>`;
    }
  }

  // ---------- tela: perfil ----------

  function telaPerfil() {
    const p = Dados.perfil();
    const pt = perfilTreino();
    const idade = Dados.idade();
    const imc = p.peso && p.altura ? (p.peso / Math.pow(p.altura / 100, 2)) : null;

    return `
      <div class="topo"><h1>Perfil</h1></div>

      <div class="cartao">
        <div class="cartao-titulo"><h2>Seus dados</h2></div>
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px">
          <div data-acao="trocar-foto-perfil" style="cursor:pointer;flex-shrink:0;width:64px;height:64px;border-radius:50%;overflow:hidden;background:var(--gradiente-suave);border:1px solid var(--borda);display:flex;align-items:center;justify-content:center">
            ${p.foto ? `<img src="${h(p.foto)}" alt="Foto de perfil" style="width:100%;height:100%;object-fit:cover">` : '<span style="font-size:24px">📷</span>'}
          </div>
          <div>
            <button class="btn btn-pequeno" data-acao="trocar-foto-perfil">${p.foto ? 'Trocar foto' : 'Adicionar foto'}</button>
            ${p.foto ? `<button class="btn btn-pequeno btn-fantasma" data-acao="remover-foto-perfil" style="margin-left:6px">Remover</button>` : ''}
          </div>
        </div>
        <div class="campo">
          <label>Nome</label>
          <input value="${h(p.nome)}" data-perfil="nome" placeholder="Como quer ser chamada">
        </div>
        <div class="campos-lado">
          <div class="campo">
            <label>Data de nascimento</label>
            <input type="date" value="${h(p.nascimento)}" data-perfil="nascimento">
          </div>
          <div class="campo">
            <label>Sexo</label>
            <select data-perfil="sexo">
              <option value="" ${!p.sexo ? 'selected' : ''}>—</option>
              <option value="f" ${p.sexo === 'f' ? 'selected' : ''}>Mulher</option>
              <option value="m" ${p.sexo === 'm' ? 'selected' : ''}>Homem</option>
              <option value="outro" ${p.sexo === 'outro' ? 'selected' : ''}>Prefiro não dizer</option>
            </select>
          </div>
        </div>
        <div class="campos-lado">
          <div class="campo">
            <label>Peso (kg)</label>
            <input type="number" inputmode="decimal" step="0.1" value="${numCampo(p.peso)}" data-perfil="peso">
          </div>
          <div class="campo">
            <label>Altura (cm)</label>
            <input type="number" inputmode="numeric" value="${numCampo(p.altura)}" data-perfil="altura">
          </div>
        </div>
        ${idade !== null || imc ? `
          <div class="etiquetas">
            ${idade !== null ? `<span class="etiqueta">${idade} anos</span>` : ''}
            ${imc ? `<span class="etiqueta">IMC ${imc.toFixed(1)}</span>` : ''}
          </div>
          ${imc ? `<p class="pequeno apagado" style="margin-top:8px">O IMC não distingue músculo de gordura — em quem treina, ele costuma superestimar. Use como referência grosseira, não como meta.</p>` : ''}` : ''}
      </div>

      ${telaPerfilPeso()}

      ${telaPerfilFotos()}

      <div class="cartao">
        <div class="cartao-titulo"><h2>Coração</h2></div>
        <div class="campos-lado">
          <div class="campo">
            <label>FC de repouso (bpm)</label>
            <input type="number" inputmode="numeric" value="${numCampo(p.fcRepouso)}" data-perfil="fcRepouso" placeholder="ex.: 62">
          </div>
          <div class="campo">
            <label>FC máx medida (bpm)</label>
            <input type="number" inputmode="numeric" value="${numCampo(p.fcMaxMedida)}" data-perfil="fcMaxMedida" placeholder="se fez teste">
          </div>
        </div>
        <p class="pequeno apagado">${h(Aerobico.COMO_MEDIR_REPOUSO)}</p>
      </div>

      <div class="cartao">
        <div class="cartao-titulo"><h2>Saúde antes de treinar</h2></div>
        <p class="pequeno apagado">Triagem rápida (PAR-Q+). Não é diagnóstico: serve para saber quando procurar o médico antes de puxar mais forte.</p>
        ${PARQ.map((q, i) => {
          const r = parqRespostas(p)[i];
          return `<div class="campo"><div style="font-weight:700;margin-bottom:6px">${i + 1}. ${h(q)}</div>
            <div class="chips">
              <button class="chip ${r === true ? 'ativo' : ''}" data-acao="parq" data-i="${i}" data-valor="1" aria-pressed="${r === true}">Sim</button>
              <button class="chip ${r === false ? 'ativo' : ''}" data-acao="parq" data-i="${i}" data-valor="0" aria-pressed="${r === false}">Não</button>
            </div></div>`;
        }).join('')}
        ${parqTemSim(p) ? `<div class="nota atencao"><strong>Procure liberação médica</strong>Com pelo menos um "sim", converse com seu médico antes de aumentar a intensidade. Enquanto isso, o aeróbico fica só em zona leve (Z1-Z2) e vale treinar com carga moderada.</div>`
          : parqRespondido(p) ? `<div class="nota festa"><strong>Tudo certo</strong>Nenhum sinal de alerta. Se algo mudar na sua saúde, responda de novo.</div>` : ''}
      </div>

      <div class="cartao">
        <div class="cartao-titulo"><h2>Treino</h2></div>
        <div class="campo"><label>Objetivo</label>${opcoesObjetivo(pt.objetivos, 'perfil-objetivo')}</div>
        <div class="campo"><label>Nível</label>
          <div class="chips">
            ${['iniciante', 'intermediario', 'avancado'].map((n) => `<button class="chip ${nivelTela(p.nivel) === n ? 'ativo' : ''}" data-acao="perfil-chip" data-campo="nivel" data-valor="${n}">${NOME_NIVEL[n]}</button>`).join('')}
          </div>
        </div>
        <div class="campo"><label>Onde treina</label>
          <div class="chips">
            <button class="chip ${p.local !== 'casa' ? 'ativo' : ''}" data-acao="perfil-chip" data-campo="local" data-valor="academia">Academia</button>
            <button class="chip ${p.local === 'casa' ? 'ativo' : ''}" data-acao="perfil-chip" data-campo="local" data-valor="casa">Casa</button>
          </div>
        </div>
        ${p.local === 'casa' && (typeof Programas !== 'undefined') && Programas.EQUIP_CASA_OPCOES ? `
        <div class="campo"><label>Equipamentos que você tem em casa</label>
          <div class="chips">
            ${Programas.EQUIP_CASA_OPCOES.filter((o) => !(Programas.SEMPRE_EM_CASA || []).includes(o.chave)).map((o) => {
              const lista = p.equipCasa || Programas.EQUIP_CASA_PADRAO || [];
              return `<button class="chip ${lista.includes(o.chave) ? 'ativo' : ''}" data-acao="toggle-equip-casa" data-valor="${o.chave}">${h(o.rotulo || o.nome || o.chave)}</button>`;
            }).join('')}
          </div>
          <p class="pequeno apagado" style="margin-top:6px">Peso do corpo, parede, cadeira, colchonete e toalha todo mundo tem — já conto com eles.</p>
        </div>` : ''}
        ${pt.objetivos.includes('raquete') ? `
        <div class="campo"><label>Qual esporte (um, os dois ou nenhum)</label>
          <div class="chips">
            <button class="chip ${esportesDe(p).includes('pickleball') ? 'ativo' : ''}" data-acao="toggle-esporte" data-valor="pickleball" aria-pressed="${esportesDe(p).includes('pickleball')}">Pickleball</button>
            <button class="chip ${esportesDe(p).includes('beach_tennis') ? 'ativo' : ''}" data-acao="toggle-esporte" data-valor="beach_tennis" aria-pressed="${esportesDe(p).includes('beach_tennis')}">Beach tennis</button>
          </div>
        </div>
        <div class="campo"><label>Dias de jogo</label>
          <div class="chips">
            ${DIAS_SEMANA.map((d, i) => `<button class="chip ${(p.diasJogo || []).includes(i) ? 'ativo' : ''}" data-acao="toggle-dia-jogo" data-dia="${i}" aria-label="${d.nome}">${d.nome.slice(0, 3)}</button>`).join('')}
          </div>
          <p class="pequeno apagado" style="margin-top:6px">Nesses dias e na véspera o treino vira ativação leve — perna descansada pro jogo.</p>
        </div>` : ''}
        <div class="campos-lado">
          <div class="campo">
            <label>Musculação (dias/sem)</label>
            <input type="number" inputmode="numeric" min="1" max="7" value="${numCampo(p.freqForca)}" data-perfil="freqForca">
          </div>
          <div class="campo">
            <label>Aeróbico (dias/sem)</label>
            <input type="number" inputmode="numeric" min="0" max="7" value="${numCampo(p.freqCardio)}" data-perfil="freqCardio">
          </div>
        </div>
        <div class="campo" style="margin-bottom:0">
          <label>Em quais dias da semana</label>
          <div class="chips">
            ${DIAS_SEMANA.map((d, i) => `<button class="chip ${p.diasTreino.includes(i) ? 'ativo' : ''}" data-acao="toggle-dia-treino" data-dia="${i}" aria-label="${d.nome}">${d.nome.slice(0, 3)}</button>`).join('')}
          </div>
          <p class="pequeno apagado" style="margin-top:8px">${p.diasTreino.length ? `${p.diasTreino.length} dia${p.diasTreino.length === 1 ? '' : 's'} por semana — o gerador liga cada ficha a um desses dias.` : 'Marque os dias em que pretende treinar.'}</p>
        </div>
      </div>

      <div class="cartao">
        <div class="cartao-titulo"><h2>Aparência</h2></div>
        <div class="chips">
          ${[['dia', 'Dia'], ['noite', 'Noite'], ['auto', 'Automático']].map(([v, nome]) => `<button class="chip ${temaEscolhido() === v ? 'ativo' : ''}" data-acao="tema" data-valor="${v}" aria-pressed="${temaEscolhido() === v}">${nome}</button>`).join('')}
        </div>
        <p class="pequeno apagado" style="margin-top:8px">Fundo claro, fundo escuro, ou seguir o tema do celular. Vale para este aparelho.</p>
      </div>

      <div class="cartao c-sol">
        <div class="cartao-titulo"><h2>Chamada pro treino</h2></div>
        <p class="pequeno">Um lembrete todo dia de treino, no horário que você escolher — dá para ter 2 no mesmo dia e mudar quando quiser.</p>
        ${Lembretes.horasDoLembrete(p).map((hora, i) => `
          <div class="campo">
            <label for="lembrete-hora-${i}">${i ? '2º horário' : 'Horário'}</label>
            <div style="display:flex;gap:8px;align-items:center">
              <input type="time" id="lembrete-hora-${i}" value="${h(hora)}" data-lembrete-hora="${i}">
              ${i ? `<button class="btn btn-pequeno btn-fantasma" data-acao="remover-hora-lembrete" data-i="${i}" aria-label="Tirar o 2º horário">✕</button>` : ''}
            </div>
          </div>`).join('')}
        ${Lembretes.horasDoLembrete(p).length < 2 ? `<button class="btn btn-pequeno" data-acao="adicionar-hora-lembrete" style="margin-bottom:10px">+ 2º horário no mesmo dia</button>` : ''}
        <button class="btn btn-largo ${p.lembreteAtivo ? 'btn-turquesa' : ''}" data-acao="toggle-lembrete" style="margin-bottom:10px">${p.lembreteAtivo ? '✓ Lembrete ligado (toque para desligar)' : 'Ligar lembrete'}</button>
        <button class="btn btn-largo btn-festa" data-acao="lembrete-calendario">Colocar no calendário do celular</button>
        <p class="pequeno apagado" style="margin-top:8px">O calendário avisa mesmo com o app fechado — é o jeito mais garantido. ${Alarme.permissao() === 'granted' ? 'As notificações do app também estão permitidas.' : Alarme.permissao() === 'default' ? '' : ''}</p>
        ${Alarme.permissao() === 'default' ? `<button class="btn btn-largo" data-acao="pedir-notificacao">Permitir notificações do app</button>` : ''}
      </div>

      ${telaPerfilNuvem()}

      ${telaPerfilSpotify()}

      <div class="cartao">
        <div class="cartao-titulo"><h2>Apagar treinos feitos</h2></div>
        <p class="pequeno apagado">Bom para limpar treinos de teste. Apaga o histórico de treinos, as cargas registradas, o XP e as conquistas${estado.nuvem.sessao ? ' (aqui e na nuvem)' : ''}. Seu perfil, fichas, pesagens e fotos ficam. Para apagar um treino só, abra ele em Evolução › Histórico.</p>
        <button class="btn btn-largo btn-perigo" data-acao="apagar-historico">Apagar todos os treinos feitos</button>
      </div>

      <div class="cartao">
        <div class="cartao-titulo"><h2>Começar do zero</h2></div>
        <p class="pequeno apagado">Apaga tudo deste aparelho — perfil, fichas, histórico, fotos e vídeos${estado.nuvem.sessao ? ' — e também da sua conta na nuvem' : ''}. Não dá para desfazer: exporte um backup antes se quiser guardar algo.</p>
        <button class="btn btn-largo btn-perigo" data-acao="zerar-tudo">Apagar tudo e começar do zero</button>
      </div>

      <div class="cartao">
        <div class="cartao-titulo"><h2>Fotos sem internet</h2></div>
        <p class="pequeno apagado">As fotos dos exercícios das suas fichas já ficam guardadas sozinhas. Para ter as fotos de todos os exercícios no modo avião, baixe tudo uma vez com Wi-Fi (cerca de 40 MB).</p>
        <button class="btn btn-largo" data-acao="baixar-fotos" id="btn-baixar-fotos">Baixar todas as fotos</button>
      </div>

      <div class="cartao">
        <div class="cartao-titulo"><h2>Backup manual</h2></div>
        <p class="pequeno apagado">Além da nuvem acima, um arquivo <code>.zip</code> com tudo dentro (inclusive fotos e vídeos por exercício) — útil pra guardar uma cópia à parte.</p>
        <div class="linha-btn">
          <button class="btn" data-acao="exportar">Exportar</button>
          <button class="btn" data-acao="importar">Importar</button>
        </div>
      </div>

      <div class="cartao">
        <div class="cartao-titulo"><h3>Calculadoras</h3></div>
        <div class="linha-btn">
          <button class="btn btn-pequeno" data-acao="calc-1rm">Carga máxima</button>
          <button class="btn btn-pequeno" data-acao="calc-anilhas">Montar a barra</button>
        </div>
      </div>

      <p class="pequeno apagado centro" style="margin-top:20px">
        Este app organiza treino, não substitui avaliação médica.<br>
        Se você tem alguma condição cardíaca, dor persistente ou está há muito tempo parada, procure um médico antes de começar.
      </p>
    `;
  }

  // ---------- modais de calculadora ----------

  function modal1RM() {
    abrirModal(`
      <h2>Carga máxima (1RM)</h2>
      <p class="pequeno apagado">Estima a carga máxima para uma repetição a partir de uma série que você já fez. Média de três fórmulas (Epley, Brzycki e Lombardi).</p>
      <div class="campos-lado-3">
        <div class="campo"><label>Carga (kg)</label><input type="number" inputmode="decimal" id="rm-carga" data-calc="1rm" step="1.25"></div>
        <div class="campo"><label>Reps</label><input type="number" inputmode="numeric" id="rm-reps" data-calc="1rm"></div>
        <div class="campo"><label>Reps de sobra</label><input type="number" inputmode="numeric" id="rm-rir" data-calc="1rm" value="0"></div>
      </div>
      <div id="rm-saida"></div>
      <button class="btn btn-largo" data-acao="fechar-modal" style="margin-top:12px">Fechar</button>
    `);
  }

  function calcular1RM() {
    const carga = parseFloat(document.getElementById('rm-carga')?.value);
    const reps = parseInt(document.getElementById('rm-reps')?.value, 10);
    const rir = parseInt(document.getElementById('rm-rir')?.value, 10) || 0;
    const saida = document.getElementById('rm-saida');
    if (!saida) return;

    const r = Forca.umRM(carga, reps, rir);
    if (!r) { saida.innerHTML = ''; return; }

    const pcts = [95, 90, 85, 80, 75, 70];
    saida.innerHTML = `
      <div class="cartao" style="text-align:center">
        <div class="rotulo">1RM estimado</div>
        <div class="numerao" style="color:var(--destaque);font-size:36px">${r.valor} kg</div>
        <div class="pequeno apagado">Epley ${r.epley} · Brzycki ${r.brzycki ?? '—'} · Lombardi ${r.lombardi}</div>
      </div>
      ${!r.confiavel ? `<div class="nota atencao"><strong>Estimativa pouco confiável</strong>Com ${r.repsEfetivas} repetições efetivas a margem de erro cresce muito. Use uma série de até 10 reps para estimar melhor.</div>` : ''}
      <h3 style="margin-top:14px">Cargas de trabalho</h3>
      ${pcts.map((pct) => {
        const reps = Object.entries(Forca.TABELA_PCT).find(([, v]) => v === pct)?.[0];
        return `<div class="item" style="cursor:default">
          <div class="item-corpo"><div class="item-nome">${Forca.arredondar((r.valor * pct) / 100, 1.25)} kg</div>
          <div class="item-sub">${pct}% do 1RM${reps ? ` · ~${reps} reps` : ''}</div></div>
        </div>`;
      }).join('')}
    `;
  }

  function modalAnilhas() {
    const p = Dados.perfil();
    abrirModal(`
      <h2>Montar a barra</h2>
      <p class="pequeno apagado">Diz quais anilhas colocar em cada lado da barra para chegar no peso que você quer.</p>
      <div class="campos-lado">
        <div class="campo"><label>Carga alvo (kg)</label><input type="number" inputmode="decimal" id="an-carga" data-calc="anilhas" step="1.25"></div>
        <div class="campo"><label>Barra (kg)</label><input type="number" inputmode="decimal" id="an-barra" data-calc="anilhas" value="${p.barra}"></div>
      </div>
      <div id="an-saida"></div>
      <button class="btn btn-largo" data-acao="fechar-modal" style="margin-top:12px">Fechar</button>
    `);
  }

  function calcularAnilhas() {
    const alvo = parseFloat(document.getElementById('an-carga')?.value);
    const barra = parseFloat(document.getElementById('an-barra')?.value) || 20;
    const saida = document.getElementById('an-saida');
    if (!saida) return;
    if (!alvo) { saida.innerHTML = ''; return; }

    const r = Forca.anilhas(alvo, barra, Dados.perfil().anilhas);
    if (!r.possivel) { saida.innerHTML = `<div class="nota atencao">${h(r.aviso)}</div>`; return; }

    const contagem = {};
    r.porLado.forEach((a) => { contagem[a] = (contagem[a] || 0) + 1; });

    saida.innerHTML = `
      <div class="cartao" style="text-align:center">
        <div class="rotulo">Por lado</div>
        <div class="numerao" style="color:var(--destaque);font-size:24px">
          ${Object.entries(contagem).map(([kg, n]) => `${n}× ${kg}`).join(' + ') || 'só a barra'}
        </div>
        <div class="pequeno apagado">Total na barra: ${r.total} kg</div>
      </div>
      ${r.aviso ? `<div class="nota atencao">${h(r.aviso)}</div>` : ''}
    `;
  }

  function modalVolume() {
    const fichas = Dados.fichas();
    const vol = Forca.volumeSemanal(fichas, BASE);
    const max = Math.max(...vol.map((v) => v.series), Forca.FAIXA_VOLUME.maximo);

    abrirModal(`
      <h2>Volume semanal por músculo</h2>
      <p class="pequeno apagado">Séries semanais somando todas as fichas, contando o músculo principal como 1 série e o auxiliar como meia. Faixa de referência para hipertrofia: ${Forca.FAIXA_VOLUME.otimo[0]} a ${Forca.FAIXA_VOLUME.otimo[1]} séries por semana.</p>
      ${vol.length ? vol.map((v) => {
        const cor = v.situacao.cor === 'ok' ? 'var(--ok)' : v.situacao.cor === 'aviso' ? 'var(--aviso)' : 'var(--perigo)';
        return `
          <div style="margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;align-items:baseline">
              <strong style="font-size:14px">${h(v.musculo)}</strong>
              <span class="pequeno" style="color:${cor}">${v.series} séries</span>
            </div>
            <div class="barra-fundo"><div class="barra-frente" style="width:${Math.min(100, (v.series / max) * 100)}%;background:${cor}"></div></div>
          </div>`;
      }).join('') : '<p class="apagado">Adicione exercícios às fichas para ver o volume.</p>'}
      <div class="nota neutra" style="margin-top:14px">
        <strong>Como ler isto</strong>
        Músculo abaixo de ${Forca.FAIXA_VOLUME.minimo} séries tende a manter, não a crescer. Acima de ${Forca.FAIXA_VOLUME.maximo}, o limite deixa de ser o estímulo e passa a ser a sua recuperação — mais séries ali só acumulam fadiga.
      </div>
      <button class="btn btn-largo" data-acao="fechar-modal">Fechar</button>
    `);
  }

  function modalTesteFala() {
    abrirModal(`
      <h2>Sem monitor cardíaco?</h2>
      <p>O teste da fala funciona bem e não custa nada. Ele mede o mesmo que a frequência cardíaca tenta medir: o quanto você está perto do seu limite.</p>
      ${Aerobico.TESTE_FALA.map((t) => `
        <div class="item" style="cursor:default">
          <div class="item-icone">🗣️</div>
          <div class="item-corpo"><div class="item-nome">${h(t.zona)}</div><div class="item-sub" style="white-space:normal">${h(t.sinal)}</div></div>
        </div>`).join('')}
      <div class="nota neutra">
        <strong>Na prática</strong>
        Se você consegue manter uma conversa durante quase todo o treino, está na Z2 — e é ali que a maior parte do seu aeróbico deve acontecer.
      </div>
      <button class="btn btn-largo" data-acao="fechar-modal">Fechar</button>
    `);
  }

  // ---------- render ----------

  /** Acessibilidade depois de cada desenho (auditoria 12/10/2026), num lugar so em vez de em
   *  cada template: div clicavel vira botao para teclado/leitor de tela, cada <label> de .campo
   *  aponta para o seu campo, campo so com placeholder ganha nome, e o "‹" ganha "Voltar". */
  let idCampo = 0;
  function acessibilidade(raiz) {
    raiz.querySelectorAll('[data-acao]:not(button):not(a):not(input):not(select):not(textarea)').forEach((el) => {
      el.setAttribute('role', 'button');
      el.tabIndex = 0;
    });
    raiz.querySelectorAll('.campo').forEach((c) => {
      const rot = c.querySelector(':scope > label');
      const campo = c.querySelector('input, select, textarea');
      if (!rot || !campo || rot.htmlFor) return;
      if (!campo.id) campo.id = `campo-${++idCampo}`;
      rot.htmlFor = campo.id;
    });
    raiz.querySelectorAll('input[placeholder]:not([aria-label]), textarea[placeholder]:not([aria-label])').forEach((el) => {
      if (!el.labels || !el.labels.length) el.setAttribute('aria-label', el.placeholder);
    });
    raiz.querySelectorAll('button.voltar:not([aria-label])').forEach((b) => b.setAttribute('aria-label', 'Voltar'));
  }

  // ---------- tema (dia / noite / automatico) ----------
  // preferencia do APARELHO (nao do perfil): fica em localStorage fora das chaves "at:", entao
  // nao vai pro backup nem pra nuvem e sobrevive ao "Comecar do zero". O index.html le a mesma
  // chave antes de pintar a tela, pra nao piscar claro ao abrir no tema noite.
  const CHAVE_TEMA = 'trivox-tema';
  const temaEscolhido = () => { try { return localStorage.getItem(CHAVE_TEMA) || 'dia'; } catch (e) { return 'dia'; } };
  const escuroNoSistema = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;

  function aplicarTema() {
    const escolhido = temaEscolhido();
    const tema = escolhido === 'auto' ? (escuroNoSistema && escuroNoSistema.matches ? 'noite' : 'dia') : escolhido;
    document.documentElement.dataset.tema = tema;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = tema === 'noite' ? '#111214' : '#F6F6F3';
  }

  function escolherTema(valor) {
    try { localStorage.setItem(CHAVE_TEMA, valor); } catch (e) { /* sem armazenamento: vale so ate fechar */ }
    aplicarTema();
  }

  // no automatico, acompanha o celular trocando de claro para escuro com o app aberto
  if (escuroNoSistema && escuroNoSistema.addEventListener) escuroNoSistema.addEventListener('change', () => { if (temaEscolhido() === 'auto') aplicarTema(); });

  function render() {
    const telas = {
      inicio: telaInicio,
      fichas: telaFichas,
      ficha: telaFicha,
      biblioteca: telaBiblioteca,
      exercicio: telaExercicio,
      execucao: telaExecucao,
      evolucao: telaEvolucao,
      coach: telaCoach,
      cardio: telaCardio,
      perfil: telaPerfil,
      cronometro: telaCronometro,
    };
    app().innerHTML = (telas[estado.tela] || telaInicio)();
    acessibilidade(app());
    renderNav();
  }

  return {
    estado, render, ir, h, aplicarTema, escolherTema, temaEscolhido, abrirModal, fecharModal, perfilTreino, PARQ, alternarObjetivo, principalDe, esportesDe,
    modal1RM, modalAnilhas, modalVolume, modalTesteFala,
    modalGerador, modalTrocarEquipamento, modalResumoTreino, modalRegistrarPeso,
    modalRegistrarFotoEvolucao, modalVerFotoEvolucao,
    calcular1RM, calcularAnilhas, renderSpotifyWidget, renderVideoExercicio,
    setBase: (b) => { BASE = b; }, getBase: () => BASE, minutosTexto, formatarMs,
    setIlustracoes: (m) => { ILUSTRACOES = m || {}; }, ilustracaoDe, urlsIlustracoes: () => [...new Set(Object.values(ILUSTRACOES))].map((f) => `data/ilustracoes/${f}`),
  };
})();
