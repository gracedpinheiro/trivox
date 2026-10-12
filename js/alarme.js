/* Alarme sonoro + vibracao + notificacao — usado pelo descanso entre series e pelo cronometro.
   Som gerado na hora com Web Audio (sem arquivo de audio pra baixar, funciona offline).
   iPhone/Safari so libera audio depois de um toque do usuario: destravar() e chamado no
   primeiro toque em qualquer botao (ver app.js). */

const Alarme = (() => {
  let ctx = null;
  const somLigado = () => { try { return localStorage.getItem('at:som') !== 'off'; } catch (e) { return true; } };
  const ligarSom = (on) => { try { localStorage.setItem('at:som', on ? 'on' : 'off'); } catch (e) { /* sem storage, segue */ } };

  function destravar() {
    try {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      // um "clique" mudo ja destrava o audio no iOS
      const o = ctx.createOscillator(); const g = ctx.createGain();
      g.gain.value = 0; o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.01);
    } catch (e) { /* navegador sem Web Audio: segue so com vibracao */ }
  }

  /** Toca uma sequencia de notas: [[freqHz, duracaoSeg], ...]. */
  function tocar(notas, volume = 0.35) {
    if (!somLigado()) return;
    try {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      let t = ctx.currentTime + 0.02;
      notas.forEach(([f, d]) => {
        if (f > 0) {
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.type = 'triangle'; o.frequency.value = f;
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(volume, t + 0.015);
          g.gain.exponentialRampToValueAtTime(0.0001, t + d);
          o.connect(g); g.connect(ctx.destination);
          o.start(t); o.stop(t + d + 0.02);
        }
        t += d + 0.04;
      });
    } catch (e) { /* sem audio */ }
  }

  const vibrar = (padrao) => { try { if (navigator.vibrate) navigator.vibrate(padrao); } catch (e) { /* ok */ } };

  /** Bip curto da contagem regressiva (3, 2, 1). */
  const tique = () => { tocar([[880, 0.09]], 0.25); vibrar(40); };

  /** Alarme de fim: tres notas subindo, repetidas — da pra ouvir com fone e musica tocando. */
  function fim() {
    tocar([[660, 0.14], [880, 0.14], [1175, 0.3], [0, 0.12], [660, 0.14], [880, 0.14], [1175, 0.3]], 0.45);
    vibrar([300, 120, 300, 120, 500]);
  }

  /** Bip de troca (intervalado: trabalho -> descanso). */
  const troca = () => { tocar([[1046, 0.12], [1318, 0.2]], 0.4); vibrar([150, 80, 150]); };

  // ---------- notificacoes do sistema ----------

  const notificacaoSuportada = () => 'Notification' in window;
  const permissao = () => (notificacaoSuportada() ? Notification.permission : 'unsupported');

  async function pedirPermissao() {
    if (!notificacaoSuportada()) return 'unsupported';
    if (Notification.permission !== 'default') return Notification.permission;
    try { return await Notification.requestPermission(); } catch (e) { return 'denied'; }
  }

  /** Mostra notificacao (via service worker quando existe: funciona no Android com o app em 2o plano). */
  async function notificar(titulo, corpo, { tag = 'trivox', forcar = false } = {}) {
    if (permissao() !== 'granted') return false;
    // com a tela do app aberta e visivel, o som/aviso na tela ja basta — so notifica se pedido
    if (!forcar && document.visibilityState === 'visible') return false;
    const opcoes = { body: corpo, tag, renotify: true, icon: 'icons/icone-192.png', badge: 'icons/icone-192.png', vibrate: [300, 120, 300] };
    try {
      const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
      if (reg && reg.showNotification) { await reg.showNotification(titulo, opcoes); return true; }
      new Notification(titulo, opcoes); return true;
    } catch (e) { return false; }
  }

  return { destravar, tique, fim, troca, vibrar, somLigado, ligarSom, permissao, pedirPermissao, notificar, notificacaoSuportada };
})();
