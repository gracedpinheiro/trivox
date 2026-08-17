/* Leitor/escritor minimo de .zip (metodo STORE, sem compressao) — sem dependencia nenhuma.
   Existe so pra uma coisa: o backup (Exportar/Importar) poder levar os videos dos exercicios
   junto com o resto dos dados, num arquivo so. Nao comprime porque video e foto ja vem
   comprimidos (recomprimir de novo so gastaria bateria/tempo por um ganho quase nulo).
   So precisa ler arquivos que o proprio TRIVOX escreveu — por isso nao implementa DEFLATE. */

const Zip = (() => {
  const CRC_TABELA = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABELA[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function concatenar(partes) {
    const total = partes.reduce((s, p) => s + p.length, 0);
    const saida = new Uint8Array(total);
    let o = 0;
    for (const p of partes) { saida.set(p, o); o += p.length; }
    return saida;
  }

  /** arquivos: [{ nome, dados: Uint8Array }] → devolve um Blob (.zip) */
  function criar(arquivos) {
    const enc = new TextEncoder();
    const locais = [];
    const central = [];
    let offset = 0;

    for (const { nome, dados } of arquivos) {
      const nomeBytes = enc.encode(nome);
      const crc = crc32(dados);
      const tam = dados.length;

      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true);
      lh.setUint16(4, 20, true);
      lh.setUint16(6, 0, true);
      lh.setUint16(8, 0, true);   // metodo: 0 = STORE
      lh.setUint16(10, 0, true);
      lh.setUint16(12, 0, true);
      lh.setUint32(14, crc, true);
      lh.setUint32(18, tam, true);
      lh.setUint32(22, tam, true);
      lh.setUint16(26, nomeBytes.length, true);
      lh.setUint16(28, 0, true);
      locais.push(new Uint8Array(lh.buffer), nomeBytes, dados);

      const cd = new DataView(new ArrayBuffer(46));
      cd.setUint32(0, 0x02014b50, true);
      cd.setUint16(4, 20, true);
      cd.setUint16(6, 20, true);
      cd.setUint16(8, 0, true);
      cd.setUint16(10, 0, true);
      cd.setUint16(12, 0, true);
      cd.setUint16(14, 0, true);
      cd.setUint32(16, crc, true);
      cd.setUint32(20, tam, true);
      cd.setUint32(24, tam, true);
      cd.setUint16(28, nomeBytes.length, true);
      cd.setUint16(30, 0, true);
      cd.setUint16(32, 0, true);
      cd.setUint16(34, 0, true);
      cd.setUint16(36, 0, true);
      cd.setUint32(38, 0, true);
      cd.setUint32(42, offset, true);
      central.push(new Uint8Array(cd.buffer), nomeBytes);

      offset += lh.buffer.byteLength + nomeBytes.length + tam;
    }

    const centralBytes = concatenar(central);
    const eocd = new DataView(new ArrayBuffer(22));
    eocd.setUint32(0, 0x06054b50, true);
    eocd.setUint16(4, 0, true);
    eocd.setUint16(6, 0, true);
    eocd.setUint16(8, arquivos.length, true);
    eocd.setUint16(10, arquivos.length, true);
    eocd.setUint32(12, centralBytes.length, true);
    eocd.setUint32(16, offset, true);
    eocd.setUint16(20, 0, true);

    return new Blob([...locais, centralBytes, new Uint8Array(eocd.buffer)], { type: 'application/zip' });
  }

  /** Le um .zip escrito por este mesmo criar() → [{ nome, dados: Uint8Array }] */
  async function ler(arquivoOuBlob) {
    const buf = new Uint8Array(await arquivoOuBlob.arrayBuffer());
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

    let eocdPos = -1;
    for (let i = buf.length - 22; i >= 0; i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocdPos = i; break; }
    }
    if (eocdPos < 0) throw new Error('Arquivo não parece ser um .zip válido.');

    const numEntradas = dv.getUint16(eocdPos + 10, true);
    let pos = dv.getUint32(eocdPos + 16, true);
    const dec = new TextDecoder();
    const saida = [];

    for (let i = 0; i < numEntradas; i++) {
      if (dv.getUint32(pos, true) !== 0x02014b50) throw new Error('Central directory do .zip corrompido.');
      const metodo = dv.getUint16(pos + 10, true);
      const tamanho = dv.getUint32(pos + 20, true);
      const nomeLen = dv.getUint16(pos + 28, true);
      const extraLen = dv.getUint16(pos + 30, true);
      const comentLen = dv.getUint16(pos + 32, true);
      const offsetLocal = dv.getUint32(pos + 42, true);
      const nome = dec.decode(buf.subarray(pos + 46, pos + 46 + nomeLen));

      if (metodo !== 0) throw new Error(`"${nome}" usa um método de compressão que este leitor não entende (só lê .zip criado pelo próprio TRIVOX).`);

      const nomeLenLocal = dv.getUint16(offsetLocal + 26, true);
      const extraLenLocal = dv.getUint16(offsetLocal + 28, true);
      const inicioDados = offsetLocal + 30 + nomeLenLocal + extraLenLocal;
      const dados = buf.slice(inicioDados, inicioDados + tamanho);
      saida.push({ nome, dados });

      pos += 46 + nomeLen + extraLen + comentLen;
    }
    return saida;
  }

  return { criar, ler, crc32 };
})();
