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

  /** Gera e baixa o .ics: evento de 1h repetindo nos dias de treino, com alarme na hora. */
  function baixarCalendario(p) {
    const [hh, mm] = (p.lembreteHora || '18:00').split(':').map(Number);
    const d = new Date(); d.setHours(hh, mm, 0, 0);
    // 1o evento num dia marcado (DTSTART fora do BYDAY cria uma ocorrencia extra em varios calendarios)
    const marcados = diasDoLembrete(p);
    while (!marcados.includes(d.getDay())) d.setDate(d.getDate() + 1);
    const pad = (n) => String(n).padStart(2, '0');
    const local = (x) => `${x.getFullYear()}${pad(x.getMonth() + 1)}${pad(x.getDate())}T${pad(x.getHours())}${pad(x.getMinutes())}00`;
    const fim = new Date(d.getTime() + 60 * 60000);
    const dias = diasDoLembrete(p).map((i) => DIAS_ICS[i]).join(',');
    const url = location.href.split('#')[0].split('?')[0];
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//TRIVOX//Treino//PT-BR', 'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      'UID:trivox-treino@trivox', // fixo: baixar de novo ATUALIZA o evento em vez de duplicar
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`, // RFC 5545: em UTC
      `DTSTART:${local(d)}`, `DTEND:${local(fim)}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${dias}`,
      'SUMMARY:💪 Hora do treino — TRIVOX',
      'DESCRIPTION:Abra o TRIVOX e comece o treino de hoje.',
      `URL:${url}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Hora do treino!', 'TRIGGER:PT0M', 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR',
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
      // preserva o que o SW ja sabe (treinou hoje / ja avisou hoje): sem isso, abrir o app depois
      // do treino apagava o "treinou" e o aviso podia chegar mesmo assim
      const atual = await c.match(URL_CFG).then((r) => (r ? r.json() : {})).catch(() => ({}));
      const cfg = {
        treinouEm: atual.treinouEm, avisadoEm: atual.avisadoEm,
        ativo: !!p.lembreteAtivo, hora: p.lembreteHora || '18:00', dias: diasDoLembrete(p),
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

  /** Chamado ao abrir o app, ao voltar pra ele e a cada minuto com ele aberto. */
  function verificar({ perfil, jaTreinouHoje, nomeFicha }) {
    const p = perfil;
    if (!p.lembreteAtivo) return null;
    const agora = new Date();
    const hoje = agora.toLocaleDateString('sv-SE');
    if (!diasDoLembrete(p).includes(agora.getDay()) || jaTreinouHoje) return null;
    const [hh, mm] = (p.lembreteHora || '18:00').split(':').map(Number);
    if (agora.getHours() * 60 + agora.getMinutes() < hh * 60 + mm) return null;
    let ultimo = null;
    try { ultimo = localStorage.getItem('at:lembrete-ultimo'); } catch (e) { /* ok */ }
    if (ultimo === hoje) return 'ja-avisado';
    try { localStorage.setItem('at:lembrete-ultimo', hoje); } catch (e) { /* ok */ }
    Alarme.notificar('Hora do treino 💪', Motivacao.chamada(p.nome, nomeFicha), { tag: 'lembrete-treino', forcar: true });
    return 'avisado';
  }

  return { baixarCalendario, sincronizarComSW, registrarPeriodico, verificar, diasDoLembrete };
})();
