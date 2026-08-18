/* Telas do app. Render por string + delegacao de eventos:
   sem framework, sem build, e ainda assim cada tela fica isolada numa funcao. */

const UI = (() => {
  const app = () => document.getElementById('app');

  const estado = {
    tela: 'inicio',
    fichaId: null,
    escolhendoPara: null,      // id da ficha esperando um exercicio da biblioteca
    busca: '',
    filtro: { categoria: '', nivel: '', equipamento: '' },
    limite: 40,
    cardio: { modelo: 'base', minutos: 40, modalidade: 'corrida', tiros: 12 },
    exercicioId: null,          // exercicio aberto na tela de detalhe
    voltarTela: 'biblioteca',   // pra onde o botao "voltar" da tela de detalhe leva
    execucao: null,             // sessao de treino em andamento (ver criarExecucao)
    coach: { mensagens: [] },
    gerador: { objetivo: null },
    sessaoExpandida: null,       // id da sessao aberta no historico da tela de evolucao
    fotoTemp: null,              // dataURL de foto de evolucao escolhida, aguardando confirmacao no modal
    nuvem: { sessao: null, linkEnviadoPara: null }, // ver js/nuvem.js — sessao do Supabase, espelhada aqui pra tela ler
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

  // ---------- modal ----------

  function abrirModal(html) {
    fecharModal();
    const fundo = document.createElement('div');
    fundo.className = 'modal-fundo';
    fundo.id = 'modal-fundo';
    fundo.innerHTML = `<div class="modal"><div class="modal-alca"></div>${html}</div>`;
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

  const ABAS = [
    { chave: 'inicio', ic: '🏠', nome: 'Início' },
    { chave: 'fichas', ic: '📋', nome: 'Treinos' },
    { chave: 'cardio', ic: '❤️', nome: 'Aeróbico' },
    { chave: 'evolucao', ic: '📈', nome: 'Evolução' },
    { chave: 'perfil', ic: '👤', nome: 'Perfil' },
  ];

  function renderNav() {
    const mapa = {
      ficha: 'fichas', execucao: 'fichas',
      biblioteca: estado.escolhendoPara ? 'fichas' : '',
      exercicio: ABAS.some((a) => a.chave === estado.voltarTela) ? estado.voltarTela : '',
      coach: 'evolucao',
    };
    const ativo = mapa[estado.tela] !== undefined ? mapa[estado.tela] : estado.tela;
    document.getElementById('nav').innerHTML = ABAS.map((a) => `
      <button data-acao="ir" data-tela="${a.chave}" class="${ativo === a.chave ? 'ativo' : ''}">
        <span class="ic">${a.ic}</span>${a.nome}
      </button>`).join('');
  }

  // ---------- tela: inicio ----------

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

    // lembrete de backup: so incomoda se ja existe algo real pra perder, e so quando faz
    // tempo demais (ou nunca foi feito) — ver nota em Dados.registrarBackupFeito
    const backup = Dados.backupMeta();
    const diasSemBackup = backup.ultimoEm ? Math.floor((Date.now() - backup.ultimoEm) / 86400000) : null;
    const temDadosDeVerdade = !!p.nome || fichas.length > 0 || Dados.sessoes().length > 0;
    const precisaLembrarBackup = temDadosDeVerdade && (backup.ultimoEm === null || diasSemBackup >= 7);

    return `
      <div class="marca-topo"><img src="icons/icone-192.png" alt=""><span>TRIVOX</span></div>
      <div class="topo"><h1>Olá${p.nome ? ', ' + h(p.nome.split(' ')[0]) : ''}</h1></div>

      ${precisaLembrarBackup ? `
        <div class="nota atencao">
          <strong>⚠️ Faça backup dos seus dados</strong>
          ${backup.ultimoEm ? `Já fazem ${diasSemBackup} dias desde o último backup.` : 'Você ainda não fez nenhum backup.'}
          Seus dados ficam só neste aparelho — o navegador pode limpar esse espaço sozinho (mais comum no iPhone), sem avisar, e tudo se perde de uma vez.
          <div style="margin-top:10px"><button class="btn btn-pequeno btn-principal" data-acao="exportar">Exportar agora</button></div>
        </div>` : ''}

      ${hojeEDiaDeTreino ? `
        <div class="nota ${jaTreinouHoje ? 'neutra' : 'festa'}">
          <strong>${jaTreinouHoje ? '✅ Treino de hoje já feito' : `💪 Hoje é dia de treino${nomeFichaHoje ? ': ' + h(nomeFichaHoje) : '!'}`}</strong>
          ${jaTreinouHoje ? 'Mandou bem. Descanse e volte forte amanhã.' : (fichaDeHoje ? '' : 'Bora nessa — dá uma olhada nas suas fichas.')}
          ${(!jaTreinouHoje && fichaDeHoje) ? `<div style="margin-top:10px"><button class="btn btn-pequeno btn-principal" data-acao="iniciar-treino" data-id="${fichaDeHoje.id}">Começar agora</button></div>` : ''}
        </div>` : ''}

      <div class="cartao clicavel cartao-gradiente" data-acao="ir" data-tela="evolucao">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="font-size:34px">${nivel.icon}</div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:800;font-size:16px">${h(nivel.nome)}${streak.atual >= 2 ? ` · 🔥 ${streak.atual} dias` : ''}</div>
            <div class="barra-fundo" style="margin-top:6px"><div class="barra-frente" style="width:${nivel.progresso}%;background:rgba(255,255,255,0.85)"></div></div>
            <div class="pequeno" style="margin-top:4px;opacity:0.85">${nivel.proximo ? `${gam.xp} XP · faltam ${nivel.faltam} para ${h(nivel.proximo.nome)}` : `${gam.xp} XP · nível máximo!`}</div>
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
          <div class="vazio-icone">📋</div>
          <p>Você ainda não tem nenhuma ficha.</p>
          <button class="btn btn-principal" data-acao="nova-ficha">Montar meu primeiro treino</button>
        </div>`}

      ${z ? `
        <div class="cartao clicavel" data-acao="ir" data-tela="cardio">
          <div class="cartao-titulo"><h3>Sua zona de base (Z2)</h3><span class="apagado">›</span></div>
          <div class="numerao" style="color:#4CAF7D">${z.lista[1].min}–${z.lista[1].max} <span style="font-size:15px;color:var(--apagado)">bpm</span></div>
          <div class="pequeno apagado">É nessa faixa que deve ficar a maior parte do seu aeróbico.</div>
        </div>` : ''}

      <div class="grade">
        <div class="cartao clicavel" data-acao="ir" data-tela="biblioteca" data-voltar="inicio">
          <div style="font-size:26px">🏋️</div>
          <div style="font-weight:700;margin-top:6px">Exercícios</div>
          <div class="pequeno apagado">${BASE.length} no acervo</div>
        </div>
        <div class="cartao clicavel" data-acao="ir" data-tela="coach">
          <div style="font-size:26px">🐺</div>
          <div style="font-weight:700;margin-top:6px">Coach</div>
          <div class="pequeno apagado">Tire uma dúvida</div>
        </div>
      </div>

      <div class="cartao">
        <div class="cartao-titulo"><h3>Calculadoras</h3></div>
        <div class="linha-btn">
          <button class="btn btn-pequeno" data-acao="calc-1rm">1RM</button>
          <button class="btn btn-pequeno" data-acao="calc-anilhas">Anilhas</button>
        </div>
      </div>
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

      <div class="cartao clicavel cartao-gradiente" data-acao="abrir-gerador">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="font-size:30px">✨</div>
          <div>
            <div style="font-weight:800">Gerar treino automático</div>
            <div class="pequeno" style="opacity:0.9">Escolha o objetivo — eu monto as fichas pra você</div>
          </div>
        </div>
      </div>

      ${sugerirVariar ? `
        <div class="nota atencao">
          <strong>🔄 Hora de variar</strong>
          Faz ${semanasParada} semanas com os mesmos exercícios — trocar parte deles por variações em outro aparelho muda o estímulo e ajuda a não enjoar, sem perder o objetivo nem o histórico de carga.
          <div style="margin-top:10px"><button class="btn btn-pequeno btn-principal" data-acao="variar-treino">Variar meus treinos</button></div>
        </div>` : ''}

      ${fichas.length ? fichas.map((f) => {
        const n = (f.exercicios || []).length;
        const series = (f.exercicios || []).reduce((s, e) => s + (Number(e.series) || 0), 0);
        const diaTxt = (f.diaSemana !== null && f.diaSemana !== undefined) ? DIAS_SEMANA[f.diaSemana].nome : null;
        return `
          <div class="item" data-acao="abrir-ficha" data-id="${f.id}">
            <div class="item-icone">📋</div>
            <div class="item-corpo">
              <div class="item-nome">${h(f.nome)}</div>
              <div class="item-sub">${diaTxt ? `${diaTxt} · ` : ''}${n} exercício${n === 1 ? '' : 's'} · ${series} série${series === 1 ? '' : 's'}</div>
            </div>
            ${n ? `<button class="btn btn-pequeno btn-principal" data-acao="iniciar-treino" data-id="${f.id}">Treinar</button>` : ''}
            <div class="item-fim">›</div>
          </div>`;
      }).join('') : `
        <div class="vazio">
          <div class="vazio-icone">📋</div>
          <p>Nenhuma ficha ainda.</p>
          <p class="pequeno">Uma ficha é um dia de treino: "Pernas", "Peito e tríceps", "Full body A".</p>
          <button class="btn btn-principal" data-acao="nova-ficha">Criar ficha manualmente</button>
        </div>`}

      ${fichas.length ? `
        <button class="btn btn-largo" data-acao="volume" style="margin-top:10px">Ver volume semanal por músculo</button>` : ''}
    `;
  }

  /** Modal de configuracao do gerador automatico. */
  function modalGerador() {
    const p = Dados.perfil();
    const obj = estado.gerador.objetivo || p.objetivo;
    const temDias = p.diasTreino.length > 0;
    const diasTxt = temDias
      ? `${p.diasTreino.length} dia${p.diasTreino.length === 1 ? '' : 's'} (${[...p.diasTreino].sort().map((d) => DIAS_SEMANA[d].nome).join(', ')})`
      : `${p.freqForca} dias`;
    abrirModal(`
      <h2>✨ Gerar treino automático</h2>
      <p class="pequeno apagado">Eu monto as fichas usando seu nível (${NOME_NIVEL[p.nivel] || p.nivel}), onde você treina (${p.local === 'academia' ? 'academia' : p.local === 'casa' ? 'casa' : 'parque'}) e ${diasTxt} — tudo do seu perfil. Trabalho todos os grupos musculares principais na semana, distribuídos entre os dias. Pode ajustar depois de gerado.</p>
      ${!temDias ? `<p class="pequeno apagado">Dica: marque os dias certos em Perfil › Treino e cada ficha já sai ligada ao dia da semana — a tela inicial avisa "hoje é dia de X" sozinha.</p>` : ''}
      <div class="campo">
        <label>Objetivo</label>
        <select id="ger-objetivo">
          ${Object.entries(Forca.OBJETIVOS).map(([k, v]) => `<option value="${k}" ${obj === k ? 'selected' : ''}>${h(v.nome)}</option>`).join('')}
        </select>
      </div>
      <p class="pequeno apagado" id="ger-resumo">${h(Forca.OBJETIVOS[obj]?.resumo || '')}</p>
      ${Dados.fichas().length ? `<div class="nota atencao"><strong>Atenção</strong>Isso adiciona fichas novas às que você já tem — não apaga nada.</div>` : ''}
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
        <button class="btn btn-pequeno btn-principal" data-acao="add-exercicio" data-id="${f.id}">+ Adicionar</button>
      </div>

      ${itens.length ? itens.map((item, i) => {
        const ex = BASE.find((e) => e.id === item.exId);
        const sug = Forca.sugerirCarga(Dados.historicoCarga(item.exId), item, 1.25);
        return `
          <div class="cartao">
            <div class="cartao-titulo">
              <h3>${ex ? h(ex.icon) + ' ' + h(ex.nome) : '<span class="apagado">Exercício removido da base</span>'}</h3>
              <div style="display:flex;gap:6px;flex-shrink:0">
                ${i > 0 ? `<button class="btn btn-pequeno btn-fantasma" data-acao="mover" data-i="${i}" data-dir="-1" title="Subir">↑</button>` : ''}
                ${i < itens.length - 1 ? `<button class="btn btn-pequeno btn-fantasma" data-acao="mover" data-i="${i}" data-dir="1" title="Descer">↓</button>` : ''}
              </div>
            </div>

            ${ex ? `<div class="etiquetas" style="margin-bottom:12px">
              ${(ex.musculos_primarios || []).map((m) => `<span class="etiqueta destaque">${h(m)}</span>`).join('')}
              <span class="etiqueta">${h(ex.equipamento)}</span>
            </div>` : ''}

            <div class="campos-lado-3">
              <div class="campo">
                <label>Séries</label>
                <input type="number" inputmode="numeric" min="1" max="10" value="${num(item.series)}" data-item="${i}" data-prop="series">
              </div>
              <div class="campo">
                <label>Reps</label>
                <input value="${h(item.reps || '')}" data-item="${i}" data-prop="reps" placeholder="8-12">
              </div>
              <div class="campo">
                <label>Descanso</label>
                <input type="number" inputmode="numeric" step="15" value="${num(item.descanso)}" data-item="${i}" data-prop="descanso">
              </div>
            </div>

            <div class="campos-lado">
              <div class="campo">
                <label>RIR alvo</label>
                <select data-item="${i}" data-prop="rirAlvo">
                  ${[0, 1, 2, 3, 4].map((r) => `<option value="${r}" ${Number(item.rirAlvo) === r ? 'selected' : ''}>${r} — ${['até a falha', 'quase falha', 'sobra 2', 'sobra 3', 'sobra 4'][r]}</option>`).join('')}
                </select>
              </div>
              <div class="campo">
                <label>Carga (kg)</label>
                <input type="number" inputmode="decimal" step="1.25" value="${num(item.carga)}" data-item="${i}" data-prop="carga" placeholder="—">
              </div>
            </div>

            ${sug.carga !== null && sug.tipo !== 'inicio' ? `
              <div class="nota ${sug.tipo === 'baixar' ? 'atencao' : ''}" style="margin-bottom:10px">
                <strong>Sugestão para hoje: ${sug.carga} kg</strong>${h(sug.motivo)}
                <div style="margin-top:8px"><button class="btn btn-pequeno" data-acao="aplicar-sug" data-item="${i}" data-carga="${sug.carga}">Usar ${sug.carga} kg</button></div>
              </div>` : ''}

            <div class="linha-btn">
              ${ex ? `<button class="btn btn-pequeno" data-acao="ver-exercicio" data-id="${ex.id}">Como executar</button>` : ''}
              <button class="btn btn-pequeno btn-perigo" data-acao="remover-item" data-i="${i}">Remover</button>
            </div>
          </div>`;
      }).join('') : `
        <div class="vazio">
          <div class="vazio-icone">🏋️</div>
          <p>Ficha vazia.</p>
          <button class="btn btn-principal" data-acao="add-exercicio" data-id="${f.id}">Escolher exercícios</button>
        </div>`}

      ${itens.length ? `
        <div class="cartao">
          <div class="cartao-titulo"><h3>Análise desta ficha</h3></div>
          ${analiseFicha(f, p)}
        </div>` : ''}

      <div class="linha-btn" style="margin-top:6px">
        <button class="btn" data-acao="duplicar-ficha" data-id="${f.id}">Duplicar</button>
        <button class="btn btn-perigo" data-acao="apagar-ficha" data-id="${f.id}">Apagar ficha</button>
      </div>
    `;
  }

  /** Estimativa de duracao: series x (tempo de execucao + descanso). */
  function estimarDuracao(itens) {
    let seg = 0;
    for (const item of itens) {
      const s = Number(item.series) || 0;
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
        <strong>${n.tipo === 'ok' ? '✓ ' : '⚠ '}${h(n.titulo)}</strong>${n.texto}
      </div>`).join('');
  }

  // ---------- tela: biblioteca ----------

  function telaBiblioteca() {
    const escolhendo = !!estado.escolhendoPara;
    const cats = [...new Set(BASE.map((e) => e.categoria))].sort();
    const equips = [...new Set(BASE.map((e) => e.equipamento))].sort();

    const filtrados = BASE.filter((e) => {
      const b = semAcento(estado.busca.trim());
      if (b) {
        const alvo = semAcento(`${e.nome} ${(e.musculos_primarios || []).join(' ')} ${(e.musculos_secundarios || []).join(' ')} ${e.equipamento} ${NOME_CATEGORIA[e.categoria] || e.categoria}`);
        // toda palavra digitada precisa aparecer: "supino inclinado" nao traz supino reto
        if (!b.split(/\s+/).every((termo) => alvo.includes(termo))) return false;
      }
      if (estado.filtro.categoria && e.categoria !== estado.filtro.categoria) return false;
      if (estado.filtro.nivel && e.nivel !== estado.filtro.nivel) return false;
      if (estado.filtro.equipamento && e.equipamento !== estado.filtro.equipamento) return false;
      return true;
    });

    const mostrar = filtrados.slice(0, estado.limite);

    return `
      <div class="topo">
        ${escolhendo ? `<button class="voltar" data-acao="cancelar-escolha">‹</button>` : ''}
        <h1>${escolhendo ? 'Escolher exercício' : 'Exercícios'}</h1>
      </div>

      <div class="busca">
        <input id="campo-busca" value="${h(estado.busca)}" placeholder="Buscar por nome ou músculo..." data-acao="buscar" autocomplete="off">
        <div class="filtros">
          <select data-filtro="categoria">
            <option value="">Todos os grupos</option>
            ${cats.map((c) => `<option value="${h(c)}" ${estado.filtro.categoria === c ? 'selected' : ''}>${h(NOME_CATEGORIA[c] || c)}</option>`).join('')}
          </select>
          <select data-filtro="nivel">
            <option value="">Todos os níveis</option>
            ${Object.entries(NOME_NIVEL).map(([k, v]) => `<option value="${k}" ${estado.filtro.nivel === k ? 'selected' : ''}>${v}</option>`).join('')}
          </select>
          <select data-filtro="equipamento">
            <option value="">Todo equipamento</option>
            ${equips.map((c) => `<option value="${h(c)}" ${estado.filtro.equipamento === c ? 'selected' : ''}>${h(c)}</option>`).join('')}
          </select>
        </div>
        <div class="pequeno apagado" style="padding-top:6px">${filtrados.length} de ${BASE.length} exercícios</div>
      </div>

      ${mostrar.map((e) => `
        <div class="item" data-acao="${escolhendo ? 'escolher-exercicio' : 'ver-exercicio'}" data-id="${h(e.id)}">
          <div class="item-icone">${h(e.icon || '🏋️')}</div>
          <div class="item-corpo">
            <div class="item-nome">${h(e.nome)}</div>
            <div class="item-sub">${h((e.musculos_primarios || []).join(', '))} · ${h(e.equipamento)}</div>
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
    const subs = Forca.substitutos(e, BASE);

    const cronologico = [...hist].reverse();
    const grafico = cronologico.length >= 2 ? graficoLinha(cronologico.map((r) => Number(r.carga) || 0)) : '';
    const fotoPropria = Dados.fotoExercicio(e.id);

    return `
      <div class="topo">
        <button class="voltar" data-acao="ir" data-tela="${estado.voltarTela}">‹</button>
        <h1>${h(e.nome)}</h1>
      </div>

      ${fotoPropria ? `
        <div class="cartao" style="padding:8px">
          <img src="${h(fotoPropria)}" alt="${h(e.nome)}" style="width:100%;border-radius:10px;aspect-ratio:850/567;object-fit:cover">
          <div class="pequeno apagado" style="text-align:center;margin-top:6px">sua foto</div>
        </div>` : (e.imagens && e.imagens.length) ? `
        <div class="cartao" style="padding:8px">
          <div style="display:flex;gap:6px">
            ${e.imagens.map((img) => `<img src="${h(img)}" alt="${h(e.nome)}" loading="lazy" style="flex:1;min-width:0;border-radius:10px;aspect-ratio:850/567;object-fit:cover">`).join('')}
          </div>
          <div class="pequeno apagado" style="text-align:center;margin-top:6px">${e.imagens.length > 1 ? 'início e fim do movimento' : 'referência de execução'}</div>
        </div>` : `
        <div class="cartao" style="text-align:center;background:var(--gradiente-suave)">
          <div style="width:130px;height:130px;margin:0 auto;color:var(--destaque-clara)">${Pictogramas.svgPara(e.categoria)}</div>
          <div class="pequeno apagado">${h(e.icon || '')} referência de movimento — não é uma foto</div>
        </div>`}

      <div class="linha-btn" style="margin-bottom:14px">
        <button class="btn btn-pequeno" data-acao="trocar-foto-exercicio" data-id="${h(e.id)}">${fotoPropria ? '📷 Trocar minha foto' : '📷 Usar minha foto'}</button>
        ${fotoPropria ? `<button class="btn btn-pequeno btn-fantasma" data-acao="remover-foto-exercicio" data-id="${h(e.id)}">Remover</button>` : ''}
      </div>

      ${Videos.suportado() ? `
        <div class="cartao">
          <div class="cartao-titulo"><h3>🎥 Seu vídeo</h3></div>
          <div id="video-exercicio" data-exid="${h(e.id)}">
            <p class="pequeno apagado">Carregando…</p>
          </div>
        </div>` : ''}

      <div class="etiquetas" style="margin-bottom:14px">
        <span class="etiqueta destaque">${h(NOME_CATEGORIA[e.categoria] || e.categoria)}</span>
        <span class="etiqueta">${h(NOME_NIVEL[e.nivel] || e.nivel)}</span>
        <span class="etiqueta">${h(e.equipamento)}</span>
        ${Forca.ehComposto(e) ? '<span class="etiqueta ok">Composto</span>' : '<span class="etiqueta">Isolado</span>'}
      </div>

      <div class="cartao">
        <div class="rotulo">Músculos trabalhados</div>
        <p style="margin:6px 0 0"><strong>Principais:</strong> ${h((e.musculos_primarios || []).join(', '))}</p>
        ${(e.musculos_secundarios || []).length ? `<p class="pequeno apagado" style="margin:4px 0 0"><strong>Auxiliares:</strong> ${h(e.musculos_secundarios.join(', '))}</p>` : ''}
      </div>

      <div class="cartao">
        <div class="rotulo">Sugestão para o seu objetivo (${h(Forca.OBJETIVOS[p.objetivo]?.nome || '')})</div>
        <p style="margin:8px 0 0"><strong>${presc.series} séries × ${presc.reps} reps</strong> · RIR ${presc.rirAlvo} · descanso ${presc.descanso}s</p>
      </div>

      <h3 style="margin-top:18px">Como executar</h3>
      <ol class="passos">${(e.instrucoes || []).map((i) => `<li>${h(i)}</li>`).join('')}</ol>

      ${(e.erros_comuns || []).length ? `
        <div class="nota atencao" style="margin-top:16px">
          <strong>⚠ Erros comuns a evitar</strong>
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
              <div class="item-nome">${r.carga} kg × ${r.reps} reps</div>
              <div class="item-sub">${new Date(r.data).toLocaleDateString('pt-BR')}${r.rir !== null && r.rir !== undefined ? ` · RIR ${r.rir}` : ''}</div>
            </div>
          </div>`).join('')}
        ${plato.plato ? `<div class="nota atencao"><strong>⚠ Estagnado</strong>${h(plato.saida)}</div>` : ''}` : ''}

      ${subs.length ? `
        <div class="cartao" style="margin-top:18px">
          <div class="cartao-titulo"><h3>🔁 Equipamento ocupado?</h3></div>
          <p class="pequeno apagado">Alternativas que trabalham o mesmo músculo com outro equipamento:</p>
          ${subs.map((s) => `
            <div class="item" data-acao="ver-exercicio" data-id="${s.id}" data-voltar="${estado.voltarTela}">
              <div class="item-icone">${h(s.icon || '🏋️')}</div>
              <div class="item-corpo">
                <div class="item-nome">${h(s.nome)}</div>
                <div class="item-sub">${h(s.equipamento)}</div>
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
    const sessao = Aerobico.montarSessao({ ...estado.cardio, zonasCalc: z });
    const plano = Aerobico.planoSemanal({ freqCardio: p.freqCardio, objetivo: p.objetivo, minutosBase: 40 });
    const cal = Aerobico.calorias({ modalidade: estado.cardio.modalidade, minutos: sessao.duracao, pesoKg: p.peso });
    const ordem = Aerobico.ordenarNoDia({ objetivo: p.objetivo, intensidadeCardio: sessao.blocos.some((b) => b.zona >= 4) ? 'intensa' : 'leve' });

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
            <div class="zona-bpm" style="color:${zn.cor}">${zn.min}–${zn.max}<br><span>bpm</span></div>
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
              ${Object.values(Aerobico.MODELOS).map((m) => `<option value="${m.chave}" ${estado.cardio.modelo === m.chave ? 'selected' : ''}>${h(m.nome)}</option>`).join('')}
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

        <button class="btn btn-largo btn-principal" data-acao="salvar-cardio" style="margin-top:12px">Salvar esta sessão</button>
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
              <button class="btn btn-pequeno btn-perigo" data-acao="apagar-cardio" data-id="${s.id}">×</button>
            </div>`).join('')}
        </div>` : ''}
    `;
  }

  // ---------- tela: execucao do treino ----------

  function telaExecucao() {
    const ex = estado.execucao;
    if (!ex) return telaFichas();
    const item = ex.itens[ex.iEx];
    if (!item) return telaFichas(); // seguranca, nao deveria acontecer

    const dadosEx = BASE.find((x) => x.id === item.exId);
    const serieAtual = item.sets.length + 1;
    const progressoPct = Math.round(((ex.iEx + (item.sets.length / item.seriesAlvo)) / ex.itens.length) * 100);

    const spotifyConectado = !!Dados.spotify().refreshToken;
    const blocoSpotify = spotifyConectado
      ? `<div class="cartao"><div id="spotify-widget"><div class="pequeno apagado" style="text-align:center;padding:6px 0">Carregando…</div></div></div>`
      : '';

    if (ex.descansando) {
      const min = Math.floor(ex.segundosRestantes / 60), seg = ex.segundosRestantes % 60;
      const proxima = item.sets.length >= item.seriesAlvo ? (ex.itens[ex.iEx + 1] || null) : item;
      return `
        <div class="topo">
          <button class="voltar" data-acao="encerrar-treino-confirma">‹</button>
          <h1>Descansando</h1>
        </div>
        <div class="cartao" style="text-align:center;padding:36px 16px">
          <div class="rotulo">Próximo</div>
          <div style="font-weight:700;margin-bottom:18px">${proxima ? h(BASE.find((x) => x.id === proxima.exId)?.nome || '') : 'Fim do treino 🎉'}</div>
          <div id="descanso-timer" style="font-size:56px;font-weight:800;letter-spacing:-0.02em" class="texto-gradiente">${min}:${String(seg).padStart(2, '0')}</div>
          <div class="linha-btn" style="margin-top:22px">
            <button class="btn" data-acao="ajustar-descanso" data-seg="-15">−15s</button>
            <button class="btn btn-principal" data-acao="pular-descanso">Pular</button>
            <button class="btn" data-acao="ajustar-descanso" data-seg="15">+15s</button>
          </div>
        </div>
        ${blocoSpotify}
      `;
    }

    const ultimaSug = item.sets.length
      ? item.sets[item.sets.length - 1]
      : { carga: item.cargaSugerida?.carga ?? '', reps: item.repsAlvoMin, rir: item.rirAlvo };

    return `
      <div class="topo">
        <button class="voltar" data-acao="encerrar-treino-confirma">‹</button>
        <h1>${h(ex.fichaNome)}</h1>
      </div>

      <div class="barra-fundo" style="margin-bottom:16px"><div class="barra-frente" style="width:${progressoPct}%;background:var(--gradiente)"></div></div>

      <div class="cartao" style="text-align:center;background:var(--gradiente-suave)">
        ${(() => {
          const fotoPropria = dadosEx ? Dados.fotoExercicio(dadosEx.id) : null;
          const src = fotoPropria || dadosEx?.imagens?.[0];
          return src
            ? `<img src="${h(src)}" alt="" style="width:100%;max-width:220px;border-radius:12px;aspect-ratio:850/567;object-fit:cover">`
            : `<div style="width:100px;height:100px;margin:0 auto;color:var(--destaque-clara)">${dadosEx ? Pictogramas.svgPara(dadosEx.categoria) : ''}</div>`;
        })()}
        <h2 style="margin-top:4px">${dadosEx ? h(dadosEx.icon || '') + ' ' : ''}${h(item.nome)}</h2>
        <div class="pequeno">Exercício ${ex.iEx + 1} de ${ex.itens.length} · Série ${serieAtual} de ${item.seriesAlvo}</div>
      </div>

      ${item.cargaSugerida?.motivo ? `<div class="nota"><strong>${item.cargaSugerida.carga !== null ? item.cargaSugerida.carga + ' kg' : 'Sugestão'}</strong>${h(item.cargaSugerida.motivo)}</div>` : ''}

      <div class="cartao">
        <div class="rotulo">Alvo: ${item.repsAlvoMin}-${item.repsAlvoMax} reps · RIR ${item.rirAlvo} · descanso ${item.descansoAlvo}s</div>
        <div class="campos-lado-3" style="margin-top:10px">
          <div class="campo">
            <label>Carga (kg)</label>
            <input type="number" inputmode="decimal" step="1.25" id="exec-carga" value="${ultimaSug.carga}">
          </div>
          <div class="campo">
            <label>Reps</label>
            <input type="number" inputmode="numeric" id="exec-reps" value="${ultimaSug.reps}">
          </div>
          <div class="campo">
            <label>RIR</label>
            <input type="number" inputmode="numeric" id="exec-rir" value="${ultimaSug.rir}">
          </div>
        </div>
        <button class="btn btn-largo btn-principal" data-acao="concluir-serie" style="margin-top:4px">✓ Concluir série</button>
      </div>

      ${item.sets.length ? `
        <div class="etiquetas" style="margin-bottom:12px">
          ${item.sets.map((s, i) => `<span class="etiqueta ok">Série ${i + 1}: ${s.carga}kg × ${s.reps}</span>`).join('')}
        </div>` : ''}

      <div class="linha-btn">
        <button class="btn" data-acao="ver-exercicio" data-id="${item.exId}" data-voltar="execucao">Como executar</button>
        <button class="btn" data-acao="trocar-equipamento">🔁 Equip. ocupado</button>
      </div>

      ${blocoSpotify}
    `;
  }

  function modalTrocarEquipamento() {
    const ex = estado.execucao;
    if (!ex) return;
    const item = ex.itens[ex.iEx];
    const dadosEx = BASE.find((x) => x.id === item.exId);
    const subs = Forca.substitutos(dadosEx, BASE);
    abrirModal(`
      <h2>🔁 Trocar por outro equipamento</h2>
      ${subs.length ? subs.map((s) => `
        <div class="item" data-acao="confirmar-troca" data-id="${s.id}">
          <div class="item-icone">${h(s.icon || '🏋️')}</div>
          <div class="item-corpo"><div class="item-nome">${h(s.nome)}</div><div class="item-sub">${h(s.equipamento)}</div></div>
          <div class="item-fim">›</div>
        </div>`).join('') : '<p class="apagado">Não achei alternativa com outro equipamento pra esse exercício.</p>'}
      <button class="btn btn-largo" data-acao="fechar-modal" style="margin-top:10px">Cancelar</button>
    `);
  }

  /** Resumo festivo ao terminar o treino. */
  function modalResumoTreino({ xpGanho, novosBadges, nivel, subiuNivel }) {
    abrirModal(`
      <div class="centro" style="padding:8px 0 4px">
        <div style="font-size:52px">🎉</div>
        <h2 class="texto-gradiente">Treino concluído!</h2>
        <p class="apagado">Mandou bem. Descanse e volte forte.</p>
      </div>
      <div class="cartao cartao-gradiente centro">
        <div class="rotulo" style="color:rgba(255,255,255,0.85)">Experiência ganha</div>
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

  function heatmapDias(dias, semanas = 12) {
    const set = new Set(dias);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    // volta ate o domingo da primeira semana visivel
    const inicio = new Date(hoje.getTime() - (semanas * 7 - 1) * 864e5);
    inicio.setDate(inicio.getDate() - inicio.getDay());

    const colunas = [];
    for (let sem = 0; sem < semanas; sem++) {
      const dias7 = [];
      for (let d = 0; d < 7; d++) {
        const dt = new Date(inicio.getTime() + (sem * 7 + d) * 864e5);
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

      <div class="cartao cartao-gradiente">
        <div style="display:flex;align-items:center;gap:14px">
          <div style="font-size:40px">${nivel.icon}</div>
          <div style="flex:1">
            <div style="font-weight:800;font-size:18px">${h(nivel.nome)}</div>
            <div class="barra-fundo" style="margin-top:6px"><div class="barra-frente" style="width:${nivel.progresso}%;background:rgba(255,255,255,0.85)"></div></div>
            <div class="pequeno" style="margin-top:4px;opacity:0.85">${nivel.proximo ? `${gam.xp} XP · faltam ${nivel.faltam} para ${h(nivel.proximo.nome)}` : `${gam.xp} XP · nível máximo!`}</div>
          </div>
        </div>
      </div>

      <div class="grade">
        <div class="cartao" style="text-align:center">
          <div style="font-size:26px">🔥</div>
          <div class="numerao" style="font-size:24px">${streak.atual}</div>
          <div class="rotulo">dias seguidos</div>
        </div>
        <div class="cartao" style="text-align:center">
          <div style="font-size:26px">🏆</div>
          <div class="numerao" style="font-size:24px">${streak.maximo}</div>
          <div class="rotulo">recorde de streak</div>
        </div>
      </div>

      <div class="cartao">
        <div class="cartao-titulo"><h3>Consistência</h3></div>
        ${heatmapDias(dias)}
        <div class="pequeno apagado" style="margin-top:6px">${dias.length} dia${dias.length === 1 ? '' : 's'} treinados nos últimos ~3 meses</div>
      </div>

      <div class="cartao">
        <div class="cartao-titulo"><h3>⚖️ Peso</h3><button class="btn btn-pequeno" data-acao="abrir-registrar-peso">+ Registrar</button></div>
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
        ${sessoes.length ? sessoes.slice(0, 20).map((s) => {
          const aberta = estado.sessaoExpandida === s.id;
          return `
          <div class="item" data-acao="expandir-sessao" data-id="${s.id}" style="flex-direction:column;align-items:stretch">
            <div style="display:flex;align-items:center;gap:12px;width:100%">
              <div class="item-icone">${s.tipo === 'cardio' ? '❤️' : '🏋️'}</div>
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
                      ${ex.sets.map((set, i) => `<span class="etiqueta">S${i + 1}: ${set.carga}kg×${set.reps}${set.rir !== null && set.rir !== undefined ? ` (RIR ${set.rir})` : ''}</span>`).join('')}
                    </div>
                  </div>`).join('')}
                ${s.cardioResumo ? `<div class="pequeno apagado">${h(s.cardioResumo.nome)} · ${h(s.cardioResumo.modalidade)}</div>` : ''}
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
        <h1>🐺 Coach</h1>
      </div>
      <p class="pequeno apagado">Não é IA — são as mesmas dicas que um personal repetiria, organizadas por tema. Sem internet, sem custo, sempre disponível.</p>

      <div class="filtros" style="padding:4px 0 14px">
        ${Object.entries(Gamificacao.COACH_TEMAS).map(([k, t]) => `<button class="btn btn-pequeno" data-acao="coach-tema" data-tema="${k}">${t.icon} ${t.nome.replace(/^\S+\s/, '')}</button>`).join('')}
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
        <div class="cartao-titulo"><h2>⚖️ Peso & bioimpedância</h2></div>
        ${ultimo ? `
          <div class="grade" style="margin-bottom:10px">
            <div>
              <div class="rotulo">Última pesagem</div>
              <div class="numerao" style="font-size:26px">${ultimo.peso} <span style="font-size:14px;color:var(--apagado)">kg</span></div>
              <div class="pequeno apagado">${new Date(ultimo.data).toLocaleDateString('pt-BR')}</div>
            </div>
            ${ultimo.gordura ? `<div><div class="rotulo">Gordura corporal</div><div class="numerao" style="font-size:26px">${ultimo.gordura}<span style="font-size:14px;color:var(--apagado)">%</span></div></div>` : ''}
          </div>
          ${(ultimo.massaMuscular || ultimo.agua || ultimo.visceral || ultimo.tmb) ? `
            <div class="etiquetas" style="margin-bottom:10px">
              ${ultimo.massaMuscular ? `<span class="etiqueta">Massa muscular: ${ultimo.massaMuscular}kg</span>` : ''}
              ${ultimo.agua ? `<span class="etiqueta">Água: ${ultimo.agua}%</span>` : ''}
              ${ultimo.visceral ? `<span class="etiqueta">Gordura visceral: ${ultimo.visceral}</span>` : ''}
              ${ultimo.tmb ? `<span class="etiqueta">TMB: ${ultimo.tmb}kcal</span>` : ''}
            </div>` : ''}
          ${registros.length > 1 ? `
            <div class="pequeno apagado" style="margin-bottom:10px">
              ${registros.slice(1, 5).map((r) => `${r.peso}kg em ${new Date(r.data).toLocaleDateString('pt-BR')}`).join(' · ')}
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
        <div class="cartao-titulo"><h2>📸 Fotos de evolução</h2></div>
        ${fotos.length ? `
          ${fotos.length >= 2 ? `
            <div class="grade" style="margin-bottom:10px">
              <div>
                <img src="${h(antes.foto)}" alt="Antes" style="width:100%;aspect-ratio:3/4;object-fit:cover;border-radius:12px;cursor:pointer" data-acao="ver-foto-evolucao" data-id="${antes.id}">
                <div class="pequeno apagado centro" style="margin-top:4px">Antes · ${new Date(antes.data).toLocaleDateString('pt-BR')}</div>
              </div>
              <div>
                <img src="${h(atual.foto)}" alt="Atual" style="width:100%;aspect-ratio:3/4;object-fit:cover;border-radius:12px;cursor:pointer" data-acao="ver-foto-evolucao" data-id="${atual.id}">
                <div class="pequeno apagado centro" style="margin-top:4px">Atual · ${new Date(atual.data).toLocaleDateString('pt-BR')}</div>
              </div>
            </div>` : ''}
          ${fotos.length > 1 ? `
            <div style="display:flex;gap:8px;overflow-x:auto;padding:2px 0 10px;scrollbar-width:none">
              ${fotos.map((f) => `
                <div data-acao="ver-foto-evolucao" data-id="${f.id}" style="flex-shrink:0;width:64px;cursor:pointer">
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
      <h2>📸 Nova foto — ${new Date().toLocaleDateString('pt-BR')}</h2>
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
      <button class="btn btn-largo btn-perigo" data-acao="apagar-foto-evolucao" data-id="${f.id}">Apagar</button>
      <button class="btn btn-largo btn-fantasma" data-acao="fechar-modal" style="margin-top:8px">Fechar</button>
    `);
  }

  function modalRegistrarPeso() {
    const p = Dados.perfil();
    const hoje = new Date().toLocaleDateString('sv-SE');
    abrirModal(`
      <h2>⚖️ Registrar pesagem</h2>
      <div class="campos-lado">
        <div class="campo">
          <label>Peso (kg) *</label>
          <input type="number" inputmode="decimal" step="0.1" id="peso-valor" value="${num(p.peso)}" placeholder="obrigatório">
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
          <div class="cartao-titulo"><h2>☁️ Backup na nuvem</h2><span class="etiqueta ok">Conectado</span></div>
          <p class="pequeno apagado">Logada como <strong>${h(sessao.user.email)}</strong>. Seus dados sobem sozinhos pra nuvem sempre que mudam — se este aparelho perder tudo, é só entrar de novo com o mesmo e-mail pra recuperar.</p>
          ${backup.ultimoEm ? `<p class="pequeno apagado">Última sincronização: ${new Date(backup.ultimoEm).toLocaleString('pt-BR')}</p>` : ''}
          <button class="btn btn-largo btn-perigo" data-acao="nuvem-sair">Sair desta conta</button>
        </div>`;
    }

    if (estado.nuvem.linkEnviadoPara) {
      return `
        <div class="cartao">
          <div class="cartao-titulo"><h2>☁️ Backup na nuvem</h2></div>
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
        <div class="cartao-titulo"><h2>☁️ Backup na nuvem</h2></div>
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
          <div class="cartao-titulo"><h2>🎵 Spotify</h2><span class="etiqueta ok">Conectado</span></div>
          <p class="pequeno apagado">Durante o treino, controle a música direto na tela de execução.</p>
          <button class="btn btn-largo btn-perigo" data-acao="spotify-desconectar">Desconectar</button>
        </div>`;
    }

    return `
      <div class="cartao">
        <div class="cartao-titulo"><h2>🎵 Spotify</h2></div>
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
        <button class="btn btn-largo btn-principal" data-acao="trocar-video-exercicio" data-id="${h(exId)}">🎥 Adicionar vídeo</button>`;
    }
  }

  // ---------- tela: perfil ----------

  function telaPerfil() {
    const p = Dados.perfil();
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
              <option value="f" ${p.sexo === 'f' ? 'selected' : ''}>Feminino</option>
              <option value="m" ${p.sexo === 'm' ? 'selected' : ''}>Masculino</option>
              <option value="outro" ${p.sexo === 'outro' ? 'selected' : ''}>Outro</option>
            </select>
          </div>
        </div>
        <div class="campos-lado">
          <div class="campo">
            <label>Peso (kg)</label>
            <input type="number" inputmode="decimal" step="0.1" value="${num(p.peso)}" data-perfil="peso">
          </div>
          <div class="campo">
            <label>Altura (cm)</label>
            <input type="number" inputmode="numeric" value="${num(p.altura)}" data-perfil="altura">
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
            <input type="number" inputmode="numeric" value="${num(p.fcRepouso)}" data-perfil="fcRepouso" placeholder="ex.: 62">
          </div>
          <div class="campo">
            <label>FC máx medida (bpm)</label>
            <input type="number" inputmode="numeric" value="${num(p.fcMaxMedida)}" data-perfil="fcMaxMedida" placeholder="se fez teste">
          </div>
        </div>
        <p class="pequeno apagado">${h(Aerobico.COMO_MEDIR_REPOUSO)}</p>
      </div>

      <div class="cartao">
        <div class="cartao-titulo"><h2>Treino</h2></div>
        <div class="campo">
          <label>Objetivo</label>
          <select data-perfil="objetivo">
            ${Object.entries(Forca.OBJETIVOS).map(([k, v]) => `<option value="${k}" ${p.objetivo === k ? 'selected' : ''}>${h(v.nome)}</option>`).join('')}
          </select>
          <p class="pequeno apagado" style="margin-top:6px">${h(Forca.OBJETIVOS[p.objetivo]?.resumo || '')}</p>
        </div>
        <div class="campos-lado">
          <div class="campo">
            <label>Nível</label>
            <select data-perfil="nivel">
              ${['iniciante', 'intermediario', 'avancado', 'elite'].map((n) => `<option value="${n}" ${p.nivel === n ? 'selected' : ''}>${NOME_NIVEL[n]}</option>`).join('')}
            </select>
          </div>
          <div class="campo">
            <label>Onde treina</label>
            <select data-perfil="local">
              <option value="academia" ${p.local === 'academia' ? 'selected' : ''}>Academia</option>
              <option value="casa" ${p.local === 'casa' ? 'selected' : ''}>Casa</option>
              <option value="parque" ${p.local === 'parque' ? 'selected' : ''}>Parque / ar livre</option>
            </select>
          </div>
        </div>
        <div class="campos-lado">
          <div class="campo">
            <label>Musculação (dias/sem)</label>
            <input type="number" inputmode="numeric" min="1" max="7" value="${num(p.freqForca)}" data-perfil="freqForca">
          </div>
          <div class="campo">
            <label>Aeróbico (dias/sem)</label>
            <input type="number" inputmode="numeric" min="0" max="7" value="${num(p.freqCardio)}" data-perfil="freqCardio">
          </div>
        </div>
        <div class="campo" style="margin-bottom:0">
          <label>Em quais dias da semana</label>
          <div class="linha-btn" style="flex-wrap:wrap">
            ${DIAS_SEMANA.map((d, i) => `
              <button class="btn btn-pequeno ${p.diasTreino.includes(i) ? 'btn-principal' : ''}" data-acao="toggle-dia-treino" data-dia="${i}" style="flex:0 0 auto;min-width:44px">${d.curta}</button>
            `).join('')}
          </div>
          <p class="pequeno apagado" style="margin-top:8px">${p.diasTreino.length ? `${p.diasTreino.length} dia${p.diasTreino.length === 1 ? '' : 's'} por semana. Isso só avisa "hoje é dia de treino" na tela inicial — quem decide quantas fichas o gerador cria são os números de musculação/aeróbico acima.` : 'Marque os dias em que pretende treinar — aparece um lembrete na tela inicial.'}</p>
        </div>
      </div>

      ${telaPerfilNuvem()}

      ${telaPerfilSpotify()}

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
          <button class="btn btn-pequeno" data-acao="calc-1rm">1RM</button>
          <button class="btn btn-pequeno" data-acao="calc-anilhas">Anilhas</button>
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
      <h2>Calculadora de 1RM</h2>
      <p class="pequeno apagado">Estima a carga máxima para uma repetição a partir de uma série que você já fez. Média de três fórmulas (Epley, Brzycki e Lombardi).</p>
      <div class="campos-lado-3">
        <div class="campo"><label>Carga (kg)</label><input type="number" inputmode="decimal" id="rm-carga" data-calc="1rm" step="1.25"></div>
        <div class="campo"><label>Reps</label><input type="number" inputmode="numeric" id="rm-reps" data-calc="1rm"></div>
        <div class="campo"><label>RIR</label><input type="number" inputmode="numeric" id="rm-rir" data-calc="1rm" value="0"></div>
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
      <h2>Anilhas por lado</h2>
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
    };
    app().innerHTML = (telas[estado.tela] || telaInicio)();
    renderNav();
  }

  return {
    estado, render, ir, h, abrirModal, fecharModal,
    modal1RM, modalAnilhas, modalVolume, modalTesteFala,
    modalGerador, modalTrocarEquipamento, modalResumoTreino, modalRegistrarPeso,
    modalRegistrarFotoEvolucao, modalVerFotoEvolucao,
    calcular1RM, calcularAnilhas, renderSpotifyWidget, renderVideoExercicio,
    setBase: (b) => { BASE = b; }, getBase: () => BASE, minutosTexto,
  };
})();
