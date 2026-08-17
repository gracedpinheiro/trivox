/* Video pessoal por exercicio (a pessoa se filmando fazendo o movimento).
   Fica FORA do localStorage (Dados) de proposito: video pesa MB, nao KB, e o localStorage
   tem cota de poucos MB no total pro app inteiro. IndexedDB aceita Blob nativamente, guarda
   sem converter pra texto, e tem cota muito maior (na pratica, centenas de MB a GBs) — e
   continua 100% local e offline, sem precisar de servidor. */

const Videos = (() => {
  const NOME_BANCO = 'trivox-videos';
  const NOME_STORE = 'porExercicio';

  const suportado = () => typeof indexedDB !== 'undefined';

  let dbPromise = null;
  function abrirBanco() {
    if (!suportado()) return Promise.reject(new Error('Este navegador não suporta armazenar vídeo offline.'));
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(NOME_BANCO, 1);
      req.onupgradeneeded = () => { req.result.createObjectStore(NOME_STORE); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('Falha ao abrir o banco de vídeos.'));
    });
    return dbPromise;
  }

  /** Guarda (ou substitui) o video de um exercicio. `blob` pode ser o File direto do input. */
  function salvarVideo(exId, blob) {
    return abrirBanco().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(NOME_STORE, 'readwrite');
      tx.objectStore(NOME_STORE).put({ blob, atualizadoEm: Date.now() }, exId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Falha ao salvar o vídeo.'));
    }));
  }

  /** Devolve { blob, atualizadoEm } ou null se esse exercicio nao tem video. */
  function lerVideo(exId) {
    return abrirBanco().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(NOME_STORE, 'readonly');
      const req = tx.objectStore(NOME_STORE).get(exId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error || new Error('Falha ao ler o vídeo.'));
    }));
  }

  function apagarVideo(exId) {
    return abrirBanco().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(NOME_STORE, 'readwrite');
      tx.objectStore(NOME_STORE).delete(exId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Falha ao apagar o vídeo.'));
    }));
  }

  return { suportado, salvarVideo, lerVideo, apagarVideo };
})();
