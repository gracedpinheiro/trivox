/* Chamada diaria pro treino.
   Um PWA sem servidor nao consegue agendar notificacao exata com o app fechado, entao sao
   tres camadas, da mais confiavel pra menos:
   1. Lembrete no CALENDARIO do celular (arquivo .ics com repeticao e alarme) — funciona
      sempre, em qualquer celular, com o app fechado. E o recomendado.
   2. Notificacao do proprio app quando ele esta aberto/em segundo plano e passa do horario.
   3. Android + app instalado: sincronizacao periodica do navegador (periodicsync), que acorda
      o service worker de tempos em tempos e notifica se passou do horario (o navegador decide
      a frequencia — e um bonus, nao garantia). */

const Lembretes = (() => {
  const CACHE_CFG = 'trivox-config';
  const URL_CFG = './__lembrete.json';
  const DIAS_ICS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

  const diasDoLembrete = (p) => (p.diasTreino && p.diasTreino.length ? p.diasTreino : [0, 1, 2, 3, 4, 5, 6]);
  /** Ate 2 horarios no mesmo dia (ex.: 07:00 e 18:00). Perfis antigos so tem lembreteHora. */
  const horasDoLembrete = (p) => (Array.isArray(p.lembreteHoras) && p.lembreteHoras.length ? p.lembreteHoras : [p.lembreteHora || '18:00'])
    .filter((x) => /^\d{1,2}:\d{2}$/.test(x)).slice(0, 2);
  const emMinutos = (hora) => { const [hh, mm] = hora.split(':').map(Number); return hh * 60 + mm; };

  /** Gera e baixa o .ics: um evento de 1h por horario, repetindo nos dias de treino, com alarme. */
  function baixarCalendario(p) {
    const pad = (n) => String(n).padStart(2, '0');
    const local = (x) => `${x.getFullYear()}${pad(x.getMonth() + 1)}${pad(x.getDate())}T${pad(x.getHours())}${pad(x.getMinutes())}00`;
    const marcados = diasDoLembrete(p);
    const dias = marcados.map((i) => DIAS_ICS[i]).join(',');
    const eventos = horasDoLembrete(p).flatMap((hora, i) => {
      const [hh, mm] = hora.split(':').map(Number);
      const d = new Date(); d.setHours(hh, mm, 0, 0);
      // 1o evento num dia marcado (DTSTART fora do BYDAY cria uma ocorrencia extra em varios calendarios)
      while (!marcados.includes(d.getDay())) d.setDate(d.getDate() + 1);
      const fim = new Date(d.getTime() + 60 * 60000);
      return [
        'BEGIN:VEVENT',
        // fixo por horario: baixar de novo ATUALIZA o evento em vez de duplicar
        i ? 'UID:trivox-treino-2@trivox' : 'UID:trivox-treino@trivox',
        `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`, // RFC 5545: em UTC
        `DTSTART:${local(d)}`, `DTEND:${local(fim)}`,
        `RRULE:FREQ=WEEKLY;BYDAY=${dias}`,
        'SUMMARY:💪 Hora do treino — TRIVOX',
        // sem link de proposito: no iPhone o link abre o SAFARI, que guarda dados separados do app
        // instalado (abria "outro TRIVOX", vazio ou com dados velhos). Abrir sempre pelo icone.
        'DESCRIPTION:Abra o TRIVOX pelo ícone na tela de início e comece o treino de hoje.',
        'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Hora do treino!', 'TRIGGER:PT0M', 'END:VALARM',
        'END:VEVENT',
      ];
    });
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//TRIVOX//Treino//PT-BR', 'CALSCALE:GREGORIAN',
      ...eventos,
      'END:VCALENDAR',
    ].join('\r\n') + '\r\n';
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'lembrete-treino-trivox.ics';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  /** Grava a configuracao num cache que o service worker consegue ler (ele nao le localStorage). */
  async function sincronizarComSW(p, extra = {}) {
    try {
      const c = await caches.open(CACHE_CFG);
      // preserva o que o SW ja sabe (treinou hoje / quais horarios ja avisou hoje): sem isso, abrir
      // o app depois do treino apagava o "treinou" e o aviso podia chegar mesmo assim
      const atual = await c.match(URL_CFG).then((r) => (r ? r.json() : {})).catch(() => ({}));
      const horas = horasDoLembrete(p);
      const cfg = {
        treinouEm: atual.treinouEm, avisados: atual.avisados || {},
        ativo: !!p.lembreteAtivo, horas, hora: horas[0], dias: diasDoLembrete(p),
        titulo: 'Hora do treino 💪', corpo: Motivacao.chamada(p.nome, extra.nomeFicha),
        ...extra,
      };
      await c.put(URL_CFG, new Response(JSON.stringify(cfg), { headers: { 'Content-Type': 'application/json' } }));
    } catch (e) { /* sem Cache API: so perde a camada 3 */ }
  }

  async function registrarPeriodico() {
    try {
      const reg = await navigator.serviceWorker?.ready;
      if (!reg || !('periodicSync' in reg)) return false;
      const st = await navigator.permissions.query({ name: 'periodic-background-sync' });
      if (st.state !== 'granted') return false;
      await reg.periodicSync.register('lembrete-treino', { minInterval: 60 * 60 * 1000 });
      return true;
    } catch (e) { return false; }
  }

  /** Chamado ao abrir o app, ao voltar pra ele e a cada minuto com ele aberto.
   *  Cada horario avisa 1x por dia; varios horarios vencidos de uma vez viram 1 aviso so. */
  function verificar({ perfil, jaTreinouHoje, nomeFicha }) {
    const p = perfil;
    if (!p.lembreteAtivo) return null;
    const agora = new Date();
    const hoje = agora.toLocaleDateString('sv-SE');
    if (!diasDoLembrete(p).includes(agora.getDay()) || jaTreinouHoje) return null;
    const minutos = agora.getHours() * 60 + agora.getMinutes();
    let reg = { dia: hoje, horas: [] };
    try {
      const salvo = JSON.parse(localStorage.getItem('at:lembrete-avisos') || 'null');
      if (salvo && salvo.dia === hoje) reg = salvo;
    } catch (e) { /* ok */ }
    const vencidos = horasDoLembrete(p).filter((h) => emMinutos(h) <= minutos && !reg.horas.includes(h));
    if (!vencidos.length) return 'ja-avisado';
    reg.horas.push(...vencidos);
    try { localStorage.setItem('at:lembrete-avisos', JSON.stringify(reg)); } catch (e) { /* ok */ }
    Alarme.notificar('Hora do treino 💪', Motivacao.chamada(p.nome, nomeFicha), { tag: 'lembrete-treino', forcar: true });
    return 'avisado';
  }

  return { baixarCalendario, sincronizarComSW, registrarPeriodico, verificar, diasDoLembrete, horasDoLembrete };
})();
