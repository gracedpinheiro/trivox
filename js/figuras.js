/* Figuras — ilustracao vetorial ANIMADA de COMO cada exercicio e feito + ilustracao do APARELHO.
   Tudo gerado por codigo (SVG + SMIL), sem rede e sem biblioteca: funciona offline.

   Uso:
     Figuras.svg(exercicio, { largura: 280, genero: 'm'|'f', quadros })
        -> string <svg> animada (boneco + aparelho), role="img" e aria-label em portugues.
           quadros: true  -> quadros-chave lado a lado (posicao inicial -> final), sem animacao
           quadros: false -> sempre anima | ausente -> segue prefers-reduced-motion do sistema
     Figuras.aparelho('leg_press', { largura: 200 })  -> <figure> com ilustracao estatica do aparelho + legenda
     Figuras.temImagem(exercicio)                      -> true (sempre ha template; no pior caso heuristica por categoria)
     Figuras.carregar([url])                           -> Promise. O mapa ja vem embutido (resolve na hora);
                                                          com url, recarrega um JSON no formato de data/figuras_mapa.json
     Figuras.template(exercicio)                       -> { t, p, a, m, via } usado (debug)
     Figuras.svgTemplate('agachamento', { p, a, quadros, largura })  -> desenha um template direto (demos/testes)
     Figuras.TEMPLATES / APARELHOS / PROPS / CENARIOS  -> catalogos

   Como funciona:
     - Boneco articulado: angulos absolutos de cada segmento (0 = apontando para baixo, + = para a frente),
       cinematica direta, ou alvo de mao/pe resolvido por IK de 2 ossos. Vista lateral (padrao, olhando
       para a direita) e frontal. Roupa: camiseta coral + short turquesa (ou legging roxa, genero 'f').
     - Cada template de movimento tem 2-4 quadros-chave; o motor interpola (angulos ou alvos de IK),
       gera ~5 amostras por transicao e anima o atributo "d" de cada <path> com <animate> (SMIL).
     - Props (aparelhos) sao funcoes que desenham a partir das articulacoes de cada amostra, entao
       halter/barra/cabo/elastico acompanham as maos e os pes; maquinas tem partes fixas e moveis.
     - O mapa exercicio -> template vem de ferramentas/mapear_figuras.py (data/figuras_mapa.json) e
       fica embutido no bloco <MAPA-GERADO> abaixo (formato compacto).

   Cores: tema claro e alegre (coral, turquesa, amarelo-sol, roxo, azul, verde). */

const Figuras = (() => {
  'use strict';

  // ------------------------------------------------------------------ paleta
  const C = {
    pele: '#F5C6A0', pele2: '#E6AC84', cabelo: '#8A5534', olho: '#33364D', bochecha: '#FF8FA3',
    camisa: '#FF6B6B', camisa2: '#EC5757', short: '#12C2B9', short2: '#0DA79F',
    legging: '#A855F7', legging2: '#9333EA', tenis: '#3B82F6', tenis2: '#2F6FDB',
    fundo: '#F2F8FF', chao: '#DCEAFB', chao2: '#C9DCF5', sol: '#FFF1C7',
    metal: '#AAB6C8', metal2: '#8794AA', metal3: '#D3DBE7', aco: '#9AA6BA',
    roxo: '#8B5CF6', roxo2: '#B9A2FB', coral: '#FF6B6B', coral2: '#FFA3A3', turq: '#12C2B9', turq2: '#8BE3DE',
    amarelo: '#FFC93C', amarelo2: '#FFE08A', azul: '#3B82F6', azul2: '#93C5FD', verde: '#22C55E', verde2: '#86EFAC',
    estofado: '#3B82F6', estofado2: '#5B9BFA', madeira: '#F4B66A', madeira2: '#E39C4A',
    parede: '#FBE3CF', parede2: '#F5CFAF', tapete: '#FFB4C6', pneu: '#5B6478', pneu2: '#7C8699',
  };

  // ------------------------------------------------------------------ medidas do boneco
  const D = { tronco: 46, pesc: 6, cab: 12, braco: 27, ante: 24, mao: 4.6, coxa: 36, perna: 36, pe: 13 };
  const ANTE_IK = D.ante + 4;           // cotovelo -> centro da mao
  const G = 180;                        // linha do chao
  const TZ = 176;                       // altura do tornozelo com o pe no chao

  // ------------------------------------------------------------------ vetores
  const R = Math.PI / 180;
  const dir = a => ({ x: Math.sin(a * R), y: Math.cos(a * R) });          // 0 = baixo, 90 = frente
  const ang = v => Math.atan2(v.x, v.y) / R;
  const V = (x, y) => ({ x, y });
  const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
  const mul = (a, k) => ({ x: a.x * k, y: a.y * k });
  const mix = (a, b, u) => ({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u });
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const perp = v => ({ x: -v.y, y: v.x });
  const norm = v => { const l = Math.hypot(v.x, v.y) || 1; return { x: v.x / l, y: v.y / l }; };
  const lerp = (a, b, u) => a + (b - a) * u;
  const lerpAng = (a, b, u) => { let d = ((b - a + 540) % 360) - 180; return a + d * u; };
  const f = n => { const r = Math.round(n * 10) / 10; return (r === 0 ? 0 : r).toString(); };
  const P = p => f(p.x) + ' ' + f(p.y);

  // IK de 2 ossos. s=+1 dobra para "a frente" da direcao A->T (joelho), s=-1 para tras (cotovelo).
  function ik(A, T, L1, L2, s) {
    const dx = T.x - A.x, dy = T.y - A.y, d0 = Math.hypot(dx, dy) || 0.001;
    const d = Math.min(Math.max(d0, Math.abs(L1 - L2) + 0.01), L1 + L2 - 0.01);
    const ux = dx / d0, uy = dy / d0;
    const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    return { meio: V(A.x + ux * a + uy * h * s, A.y + uy * a - ux * h * s), fim: V(A.x + ux * d, A.y + uy * d) };
  }

  // ------------------------------------------------------------------ construtor de formas
  // camadas: 0 fundo | 1 membros do lado de la | 2 meio | 3 corpo | 4 membros do lado de ca | 5 frente
  const CAM = { fundo: 0, atras: 1, meio: 2, corpo: 3, perto: 4, frente: 5 };
  function Cena() {
    this.cam = [[], [], [], [], [], []];
    this.bb = [Infinity, Infinity, -Infinity, -Infinity];
  }
  Cena.prototype._bb = function (pts, pad) {
    const b = this.bb;
    for (const p of pts) {
      if (p.x - pad < b[0]) b[0] = p.x - pad; if (p.y - pad < b[1]) b[1] = p.y - pad;
      if (p.x + pad > b[2]) b[2] = p.x + pad; if (p.y + pad > b[3]) b[3] = p.y + pad;
    }
  };
  Cena.prototype.add = function (cam, d, at, pts, pad) {
    this.cam[typeof cam === 'number' ? cam : CAM[cam]].push({ d, at });
    if (pts) this._bb(pts, pad || 0);
  };
  // capsula (membro, barra, cabo)
  Cena.prototype.cap = function (a, b, w, cor, cam, op) {
    this.add(cam, `M${P(a)}L${P(b)}`, `fill="none" stroke="${cor}" stroke-width="${w}" stroke-linecap="round"${op ? ` opacity="${op}"` : ''}`, [a, b], w / 2);
  };
  Cena.prototype.linha = function (pts, w, cor, cam, extra) {
    this.add(cam, 'M' + pts.map(P).join('L'), `fill="none" stroke="${cor}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${extra || ''}`, pts, w / 2);
  };
  Cena.prototype.curva = function (a, c1, c2, b, w, cor, cam, extra) {
    this.add(cam, `M${P(a)}C${P(c1)} ${P(c2)} ${P(b)}`, `fill="none" stroke="${cor}" stroke-width="${w}" stroke-linecap="round"${extra || ''}`, [a, b, mix(c1, c2, .5)], w / 2);
  };
  Cena.prototype.circ = function (c, r, cor, cam, extra) {
    this.add(cam, `M${f(c.x - r)} ${f(c.y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`, `fill="${cor}"${extra || ''}`, [c], r);
  };
  Cena.prototype.anel = function (c, r, w, cor, cam) {
    this.add(cam, `M${f(c.x - r)} ${f(c.y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`, `fill="none" stroke="${cor}" stroke-width="${w}"`, [c], r + w / 2);
  };
  Cena.prototype.elipse = function (c, rx, ry, cor, cam, extra) {
    this.add(cam, `M${f(c.x - rx)} ${f(c.y)}a${f(rx)} ${f(ry)} 0 1 0 ${f(2 * rx)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-2 * rx)} 0Z`, `fill="${cor}"${extra || ''}`, [V(c.x - rx, c.y - ry), V(c.x + rx, c.y + ry)], 0);
  };
  // poligono com cantos arredondados (raio = rr)
  Cena.prototype.poli = function (pts, cor, cam, rr, extra) {
    const at = rr ? `fill="${cor}" stroke="${cor}" stroke-width="${2 * rr}" stroke-linejoin="round"` : `fill="${cor}"`;
    this.add(cam, 'M' + pts.map(P).join('L') + 'Z', at + (extra || ''), pts, rr || 0);
  };
  // retangulo arredondado alinhado aos eixos
  Cena.prototype.ret = function (x, y, w, h, r, cor, cam, extra) {
    r = Math.min(r, w / 2, h / 2);
    this.add(cam, `M${f(x + r)} ${f(y)}H${f(x + w - r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + w)} ${f(y + r)}V${f(y + h - r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + w - r)} ${f(y + h)}H${f(x + r)}A${f(r)} ${f(r)} 0 0 1 ${f(x)} ${f(y + h - r)}V${f(y + r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + r)} ${f(y)}Z`,
      `fill="${cor}"${extra || ''}`, [V(x, y), V(x + w, y + h)], 0);
  };
  // retangulo orientado: centro c, eixo u (unitario), comprimento L, largura W, raio r
  Cena.prototype.oret = function (c, u, L, W, r, cor, cam, extra) {
    const n = perp(u), a = L / 2 - r, b = W / 2 - r;
    const pts = [add(add(c, mul(u, a)), mul(n, b)), add(add(c, mul(u, a)), mul(n, -b)), add(add(c, mul(u, -a)), mul(n, -b)), add(add(c, mul(u, -a)), mul(n, b))];
    this.poli(pts, cor, cam, r, extra);
  };

  // ------------------------------------------------------------------ resolucao das poses
  // Pose (quadro-chave), vista lateral:
  //   q:[x,y] quadril | t: inclinacao do tronco (0 em pe, + para a frente, -90 deitado de costas)
  //   h: cabeca relativa ao tronco | e: subir/descer ombros (encolhimento)
  //   P:[pe1,pe2] alvo do tornozelo (IK) | C:[[coxa,perna],..] angulos (FK) | sP:[s1,s2] lado do joelho
  //   M:[mao1,mao2] alvo da mao (IK) — [x,y] mundo, {t:[u,v]} no referencial do tronco, {j:'t1',d:[dx,dy]}
  //   B:[[braco,antebraco],..] angulos (FK) | sM:[..] lado do cotovelo | f:[pe1,pe2] angulo do pe
  //   zB/zC: encurtamento (perspectiva) de bracos/pernas | pu: angulo do punho
  // indice 0 = lado de ca (perto), 1 = lado de la. Ausente no lado 1 -> copia o lado 0.
  // Vista frontal: mesmos campos; t = inclinacao lateral; angulos + = para fora; tz encurta o tronco.

  function eixoTronco(q, t) { const up = dir(180 - t); return { up, fw: V(-up.y, up.x) }; }

  function alvo(spec, J, ref) {
    if (Array.isArray(spec)) return V(spec[0], spec[1]);
    if (spec.t) return add(add(J.q, mul(ref.up, spec.t[0])), mul(ref.fw, spec.t[1]));
    if (spec.j) return add(J[spec.j], V(spec.d ? spec.d[0] : 0, spec.d ? spec.d[1] : 0));
    if (spec.o) return add(J.om, V(spec.o[0], spec.o[1]));
    return V(0, 0);
  }

  function resolver(K, vista) {
    return vista === 'frente' ? resolverFrente(K) : resolverLado(K);
  }

  function resolverLado(K) {
    const J = { vista: 'lado', K };
    J.q = V(K.q[0], K.q[1]);
    J.t = K.t || 0;
    const ax = eixoTronco(J.q, J.t);
    J.up = ax.up; J.fw = ax.fw;
    J.om = add(add(J.q, mul(J.up, D.tronco)), mul(J.up, K.e || 0));
    const ha = J.t + (K.h || 0);
    J.hu = dir(180 - ha); J.hf = V(-J.hu.y, J.hu.x);
    J.cab = add(J.om, mul(J.hu, D.pesc + D.cab));
    J.pesc = add(J.om, mul(J.hu, D.pesc));
    // pernas
    for (let i = 0; i < 2; i++) {
      const k = i + 1, z = K.zC ? (K.zC[i] ?? K.zC[0]) : 1;
      const L1 = D.coxa * z, L2 = D.perna * z;
      const modo = K._pm[i];
      let jo, to;
      if (modo.ik) {
        const T = alvo(modo.T, J, ax);
        const r = ik(J.q, T, L1, L2, modo.s);
        jo = r.meio; to = r.fim;
      } else {
        jo = add(J.q, mul(dir(modo.A[0]), L1)); to = add(jo, mul(dir(modo.A[1]), L2));
      }
      J['j' + k] = jo; J['t' + k] = to;
      const canela = ang(sub(to, jo));
      let pa = K.f && K.f[i] != null ? K.f[i] : (K.f && K.f[0] != null && K.f.length === 1 ? K.f[0] : null);
      if (pa == null) {
        pa = canela + 90;
        const ponta = add(to, mul(dir(pa), D.pe));
        if (to.y > TZ - 6 && ponta.y > to.y + 1) pa = 90;           // pe apoiado no chao fica chato
      }
      J['pa' + k] = pa;
      J['d' + k] = add(to, mul(dir(pa), D.pe - 2));
      J['cl' + k] = add(to, mul(dir(pa), -3));
    }
    // bracos
    for (let i = 0; i < 2; i++) {
      const k = i + 1, z = K.zB ? (K.zB[i] ?? K.zB[0]) : 1;
      const L1 = D.braco * z, L2 = ANTE_IK * z;
      const modo = K._bm[i];
      let co, m;
      if (modo.ik) {
        const T = alvo(modo.T, J, ax);
        const r = ik(J.om, T, L1, L2, modo.s);
        co = r.meio; m = r.fim;
      } else {
        co = add(J.om, mul(dir(modo.A[0]), L1)); m = add(co, mul(dir(modo.A[1]), L2));
      }
      J['co' + k] = co; J['m' + k] = m;
      const fa = ang(sub(m, co));
      J['fa' + k] = fa;
      J['p' + k] = add(co, mul(dir(fa), D.ante * z));
      J['pu' + k] = fa + (K.pu ? (K.pu[i] ?? K.pu[0]) : 0);
    }
    J.om1 = J.om2 = J.om; J.q1 = J.q2 = J.q;
    return J;
  }

  function resolverFrente(K) {
    const J = { vista: 'frente', K };
    J.q = V(K.q[0], K.q[1]);
    J.t = K.t || 0;
    const up = V(Math.sin(J.t * R), -Math.cos(J.t * R)), rt = V(Math.cos(J.t * R), Math.sin(J.t * R));
    J.up = up; J.rt = rt;
    const tz = K.tz || 1;
    J.om = add(J.q, mul(up, D.tronco * tz));
    const ha = J.t + (K.h || 0);
    J.hu = V(Math.sin(ha * R), -Math.cos(ha * R));
    const e = K.e || 0;
    J.cab = add(add(J.om, mul(J.hu, D.pesc + D.cab - (K.hd || 0))), mul(up, e * .5));
    J.pesc = add(J.om, mul(J.hu, D.pesc));
    J.q1 = add(J.q, mul(rt, 8)); J.q2 = add(J.q, mul(rt, -8));
    J.om1 = add(add(J.om, mul(rt, 14)), mul(up, -3 + e)); J.om2 = add(add(J.om, mul(rt, -14)), mul(up, -3 + e));
    const ax = { up, fw: rt };
    for (let i = 0; i < 2; i++) {
      const k = i + 1, sg = i === 0 ? 1 : -1;
      const zc = K.zC ? (K.zC[i] ?? K.zC[0]) : 1;
      const L1 = D.coxa * (K.cz ? (K.cz[i] ?? K.cz[0]) : zc), L2 = D.perna * (K.pz ? (K.pz[i] ?? K.pz[0]) : zc);
      const modo = K._pm[i], base = J['q' + k];
      let jo, to;
      if (modo.ik) {
        const r = ik(base, alvo(modo.T, J, ax), L1, L2, modo.s * sg);
        jo = r.meio; to = r.fim;
      } else {
        const d1 = dir(modo.A[0]), d2 = dir(modo.A[1]);
        jo = add(base, V(sg * d1.x * L1, d1.y * L1)); to = add(jo, V(sg * d2.x * L2, d2.y * L2));
      }
      J['j' + k] = jo; J['t' + k] = to;
      J['d' + k] = add(to, V(sg * 4, 3)); J['cl' + k] = to;
    }
    for (let i = 0; i < 2; i++) {
      const k = i + 1, sg = i === 0 ? 1 : -1;
      const L1 = D.braco * (K.zB ? (K.zB[i] ?? K.zB[0]) : 1), L2 = ANTE_IK * (K.za ? (K.za[i] ?? K.za[0]) : (K.zB ? (K.zB[i] ?? K.zB[0]) : 1));
      const modo = K._bm[i], base = J['om' + k];
      let co, m;
      if (modo.ik) {
        const r = ik(base, alvo(modo.T, J, ax), L1, L2, modo.s * sg);
        co = r.meio; m = r.fim;
      } else {
        const d1 = dir(modo.A[0]), d2 = dir(modo.A[1]);
        co = add(base, V(sg * d1.x * L1, d1.y * L1)); m = add(co, V(sg * d2.x * L2, d2.y * L2));
      }
      J['co' + k] = co; J['m' + k] = m;
      const fa = ang(sub(m, co));
      J['fa' + k] = fa; J['pu' + k] = fa;
      J['p' + k] = add(co, mul(norm(sub(m, co)), Math.max(0, dist(m, co) - 4)));
    }
    return J;
  }

  // normaliza um quadro-chave: decide modo (IK/FK) de cada membro e preenche o lado 1
  function normalizar(K0, vista) {
    const K = Object.assign({}, K0);
    const fr = vista === 'frente';
    const membro = (alvos, angs, sinais, i, defIK, sDef) => {
      const T = alvos && alvos[i], A = angs && angs[i];
      const s = sinais && sinais[i] != null ? sinais[i] : (sinais && sinais.length === 1 ? sinais[0] : sDef);
      if (T) return { ik: true, T, s };
      if (A) return { ik: false, A, s };
      return null;
    };
    const pm = [membro(K.P, K.C, K.sP, 0, 1, 1), membro(K.P, K.C, K.sP, 1, 1, 1)];
    const bm = [membro(K.M, K.B, K.sM, 0, 1, fr ? 1 : -1), membro(K.M, K.B, K.sM, 1, 1, fr ? 1 : -1)];
    const padraoP = fr ? { ik: false, A: [3, 0], s: 1 } : { ik: false, A: [0, 0], s: 1 };
    const padraoB = fr ? { ik: false, A: [8, 4], s: 1 } : { ik: false, A: [-4, 4], s: -1 };
    if (!pm[0]) pm[0] = padraoP;
    if (!bm[0]) bm[0] = padraoB;
    const espelho = (m, dx) => {
      if (fr) return m.ik ? { ik: true, T: espelhaFrente(m.T, K), s: m.s } : m;
      if (!m.ik) return { ik: false, A: [m.A[0] - 2.5, m.A[1] - 2.5], s: m.s };
      if (Array.isArray(m.T)) return { ik: true, T: [m.T[0] + dx, m.T[1]], s: m.s };
      if (m.T.t) return { ik: true, T: { t: [m.T.t[0], m.T.t[1] + dx] }, s: m.s };
      if (m.T.j) return { ik: true, T: { j: m.T.j.replace('1', '2'), d: m.T.d }, s: m.s };
      return m;
    };
    if (!pm[1]) pm[1] = espelho(pm[0], -4);
    if (!bm[1]) bm[1] = espelho(bm[0], -3);
    K._pm = pm; K._bm = bm;
    return K;
  }
  function espelhaFrente(T, K) {
    if (Array.isArray(T)) return [2 * K.q[0] - T[0], T[1]];
    if (T.t) return { t: [T.t[0], -T.t[1]] };
    if (T.j) return { j: T.j.replace('1', '2'), d: T.d ? [-T.d[0], T.d[1]] : undefined };
    return T;
  }

  // interpola dois quadros normalizados
  function interpolar(A, B, u, vista) {
    const K = { q: [lerp(A.q[0], B.q[0], u), lerp(A.q[1], B.q[1], u)] };
    for (const c of ['t', 'h', 'e', 'tz', 'hd']) if (A[c] != null || B[c] != null) K[c] = lerp(A[c] ?? (c === 'tz' ? 1 : 0), B[c] ?? (c === 'tz' ? 1 : 0), u);
    for (const c of ['f', 'zB', 'zC', 'za', 'cz', 'pz', 'pu']) {
      if (A[c] || B[c]) {
        const a = A[c] || B[c], b = B[c] || A[c];
        K[c] = [0, 1].map(i => {
          const x = a[i] ?? a[0], y = b[i] ?? b[0];
          return x == null || y == null ? (x ?? y) : lerp(x, y, u);
        });
      }
    }
    const JA = A._J, JB = B._J;
    const misturaMembro = (ma, mb, i, tipo) => {
      if (ma.ik && mb.ik && mesmoTipo(ma.T, mb.T)) return { ik: true, T: misturaAlvo(ma.T, mb.T, u), s: ma.s };
      const aa = angulosDe(JA, tipo, i), ab = angulosDe(JB, tipo, i);
      return { ik: false, A: [lerpAng(aa[0], ab[0], u), lerpAng(aa[1], ab[1], u)], s: ma.s };
    };
    K._pm = [0, 1].map(i => misturaMembro(A._pm[i], B._pm[i], i, 'p'));
    K._bm = [0, 1].map(i => misturaMembro(A._bm[i], B._bm[i], i, 'b'));
    return K;
  }
  function mesmoTipo(a, b) {
    if (Array.isArray(a)) return Array.isArray(b);
    if (a.t) return !!b.t; if (a.o) return !!b.o;
    if (a.j) return !!b.j && a.j === b.j;
    return false;
  }
  function misturaAlvo(a, b, u) {
    if (Array.isArray(a)) return [lerp(a[0], b[0], u), lerp(a[1], b[1], u)];
    if (a.t) return { t: [lerp(a.t[0], b.t[0], u), lerp(a.t[1], b.t[1], u)] };
    if (a.o) return { o: [lerp(a.o[0], b.o[0], u), lerp(a.o[1], b.o[1], u)] };
    if (a.j) return { j: a.j, d: [lerp(a.d ? a.d[0] : 0, b.d ? b.d[0] : 0, u), lerp(a.d ? a.d[1] : 0, b.d ? b.d[1] : 0, u)] };
    return a;
  }
  // angulos (absolutos, sentido do desenho) de um membro ja resolvido; na frente, convertidos para "para fora"
  function angulosDe(J, tipo, i) {
    const k = i + 1;
    const [a, b, c] = tipo === 'p' ? [J['q' + k], J['j' + k], J['t' + k]] : [J['om' + k], J['co' + k], J['m' + k]];
    let a1 = ang(sub(b, a)), a2 = ang(sub(c, b));
    if (J.vista === 'frente' && i === 1) { a1 = -a1; a2 = -a2; }
    return [a1, a2];
  }

  // ------------------------------------------------------------------ desenho do boneco
  // Boneco unico e sem genero em todo o app (pedido da Grace, out/2026): cabelo curto, camiseta e
  // bermuda servem para todo mundo. A variante 'f' fica so para as demos (genero: 'f' explicito).
  function roupa(o) {
    const fem = o.genero === 'f';
    return {
      fem,
      perna: fem ? C.legging : C.short, perna2: fem ? C.legging2 : C.short2,
      camisa: o.corCamisa || C.camisa, camisa2: o.corCamisa2 || C.camisa2,
    };
  }

  function membroLado(S, a, b, w, cor, cam) { S.cap(a, b, w, cor, cam); }

  function bracoLado(S, J, k, cam, sombra, ro) {
    const pele = sombra ? C.pele2 : C.pele, cam1 = sombra ? C.camisa2 : ro.camisa;
    const om = J.om, co = J['co' + k], p = J['p' + k], m = J['m' + k];
    membroLado(S, om, co, 10.5, pele, cam);
    S.cap(om, mix(om, co, .42), 12, sombra ? ro.camisa2 : ro.camisa, cam);       // manga
    membroLado(S, co, p, 9, pele, cam);
    const pu = dir(J['pu' + k]);
    S.cap(sub(m, mul(pu, 1.2)), add(m, mul(pu, 1.6)), 9.2, pele, cam);           // mao
  }

  function pernaLado(S, J, k, cam, sombra, ro) {
    const pele = sombra ? C.pele2 : C.pele;
    const q = J.q, jo = J['j' + k], to = J['t' + k];
    const corP = sombra ? ro.perna2 : ro.perna;
    if (ro.fem) {
      // visual jovem e esportivo (pedido da Grace): bermuda de ciclista, perna a mostra
      S.cap(q, jo, 13.5, pele, cam);
      S.cap(jo, to, 10.5, pele, cam);
      S.cap(q, mix(q, jo, .66), 15, corP, cam);
    } else {
      S.cap(q, jo, 14, pele, cam);
      S.cap(jo, to, 11, pele, cam);
      S.cap(q, mix(q, jo, .55), 16, corP, cam);                                    // short
    }
    const pd = dir(J['pa' + k]);
    const cl = add(to, mul(pd, -3)), pt = add(to, mul(pd, D.pe - 2.5));
    S.cap(cl, pt, 8.6, sombra ? C.tenis2 : C.tenis, cam);
    const n = perp(pd), s = sub(V(0, 0), n);
    S.cap(add(cl, mul(s, 2.6)), add(pt, mul(s, 2.6)), 3.2, '#FFFFFF', cam);       // sola
  }

  function cabecaLado(S, J, ro, cam) {
    const c = J.cab, u = J.hu, fw = J.hf;
    S.cap(J.om, J.pesc, 9, C.pele2, cam);                                         // pescoco
    if (ro.fem) { const r0 = add(add(c, mul(fw, -9)), mul(u, 9)); S.cap(r0, add(add(c, mul(fw, -19)), mul(u, 0)), 6.5, C.cabelo, cam); S.circ(r0, 3.4, C.amarelo, cam); } // rabo de cavalo alto
    S.circ(add(add(c, mul(fw, -2.2)), mul(u, 1.8)), 12.6, C.cabelo, cam);
    S.circ(add(add(c, mul(fw, 1)), mul(u, -0.8)), 11.3, C.pele, cam);
    S.circ(add(add(c, mul(fw, 3.5)), mul(u, 8.8)), 5.2, C.cabelo, cam);            // franja
    S.circ(add(c, mul(fw, -1.5)), 2.6, C.pele2, cam);                             // orelha
    S.circ(add(add(c, mul(fw, 6.6)), mul(u, 1.6)), 1.75, C.olho, cam);
    S.circ(add(add(c, mul(fw, 5.6)), mul(u, -3.6)), 2.4, C.bochecha, cam, ' opacity=".6"');
    const s1 = add(add(c, mul(fw, 8.4)), mul(u, -4.6)), s2 = add(add(c, mul(fw, 10.6)), mul(u, -3));
    S.curva(s1, add(s1, mul(u, -1.2)), add(s2, mul(u, -1.6)), s2, 1.4, C.olho, cam);
  }

  function troncoLado(S, J, ro, cam) {
    const q = J.q, up = J.up, fw = J.fw;
    const T = (u, v) => add(add(q, mul(up, u)), mul(fw, v));
    // camiseta
    S.poli([T(4, -9), T(24, -10), T(46, -8), T(49, 1), T(45, 8), T(32, 10), T(16, 8), T(4, 8)], ro.camisa, cam, 4.5);
    // short / cos da legging
    S.poli([T(-6, -10), T(9, -10.5), T(9, 9.5), T(-6, 9.5)], ro.perna, cam, 4);
    S.cap(T(9, -12), T(9, 11), 3, ro.fem ? C.roxo2 : C.turq2, cam);              // cos
  }

  function desenharLado(S, J, o) {
    const ro = roupa(o);
    const um = !o.ocultaLado2;
    if (um) { bracoLado(S, J, 2, 'atras', true, ro); pernaLado(S, J, 2, 'atras', true, ro); }
    troncoLado(S, J, ro, 'corpo');
    cabecaLado(S, J, ro, 'corpo');
    pernaLado(S, J, 1, 'perto', false, ro);
    bracoLado(S, J, 1, 'perto', false, ro);
  }

  // vista frontal
  function desenharFrente(S, J, o) {
    const ro = roupa(o);
    const up = J.up, rt = J.rt, q = J.q, tz = J.K.tz || 1;
    const T = (u, v) => add(add(q, mul(up, u * tz)), mul(rt, v));
    for (const k of [1, 2]) {
      const sg = k === 1 ? 1 : -1;
      const b = J['q' + k], jo = J['j' + k], to = J['t' + k];
      S.cap(b, jo, ro.fem ? 13.5 : 14.5, C.pele, 'atras'); S.cap(jo, to, ro.fem ? 10.5 : 11.5, C.pele, 'atras');
      S.elipse(add(to, V(sg * 2.5, 3.5)), 7, 4.6, C.tenis, 'atras');
      S.elipse(add(to, V(sg * 2.5, 6.4)), 6.4, 1.6, '#FFFFFF', 'atras');
    }
    // short
    for (const k of [1, 2]) S.cap(J['q' + k], mix(J['q' + k], J['j' + k], ro.fem ? .66 : .5), ro.fem ? 15.5 : 16.5, ro.perna, 'meio');
    S.poli([T(-6, -12), T(-6, 12), T(10, 12.5), T(10, -12.5)], ro.perna, 'meio', 4);
    // camiseta
    S.poli([T(4, -12), T(4, 12), T(26, 13), T(44, 14.5), T(44, -14.5), T(26, -13)], ro.camisa, 'corpo', 5);
    S.cap(T(9, -15), T(9, 15), 3, ro.fem ? C.roxo2 : C.turq2, 'corpo');
    // pescoco e cabeca
    S.cap(J.om, J.pesc, 9, C.pele2, 'corpo');
    const c = J.cab, hu = J.hu, hr = V(-hu.y, hu.x);
    if (ro.fem) S.circ(add(c, mul(hu, 13)), 6.5, C.cabelo, 'corpo');
    S.circ(add(c, mul(hu, 2)), 12.8, C.cabelo, 'corpo');
    S.circ(add(c, mul(hu, -1.2)), 11.6, C.pele, 'corpo');
    S.poli([add(c, add(mul(hu, 11), mul(hr, -9))), add(c, add(mul(hu, 11), mul(hr, 9))), add(c, add(mul(hu, 5), mul(hr, 6))), add(c, add(mul(hu, 6.5), mul(hr, -7)))], C.cabelo, 'corpo', 2.5);
    for (const s of [-1, 1]) {
      S.circ(add(add(c, mul(hr, s * 4.4)), mul(hu, 0.6)), 1.75, C.olho, 'corpo');
      S.circ(add(add(c, mul(hr, s * 6.8)), mul(hu, -3.6)), 2.3, C.bochecha, 'corpo', ' opacity=".6"');
    }
    const s1 = add(add(c, mul(hr, -3)), mul(hu, -4.4)), s2 = add(add(c, mul(hr, 3)), mul(hu, -4.4));
    S.curva(s1, add(s1, mul(hu, -2.4)), add(s2, mul(hu, -2.4)), s2, 1.4, C.olho, 'corpo');
    for (const k of [1, 2]) {
      const om = J['om' + k], co = J['co' + k], p = J['p' + k], m = J['m' + k];
      S.cap(om, co, 10.5, C.pele, 'perto');
      S.cap(om, mix(om, co, .4), 12.5, ro.camisa, 'perto');
      S.cap(co, p, 9, C.pele, 'perto');
      S.circ(m, 4.8, C.pele, 'perto');
    }
  }

  // ------------------------------------------------------------------ registro de props e templates
  const PROPS = {};      // id -> function(S, J, ctx, opts)
  const TPL = {};        // id -> template
  const NOMES_TPL = {};

  // ===================================================================================== PROPS
  // ctx: { tpl, p (implemento), v (vista), J0 (juntas da 1a amostra), fase (0..1), o (opcoes) }

  // ---- implementos de mao
  function placa(S, c, r, cor, cor2, cam) {
    S.circ(c, r, cor, cam);
    S.circ(c, r * .66, cor2, cam);
    S.circ(c, r * .2, C.metal3, cam);
  }
  function maoMeio(J) { return J.vista === 'frente' ? mix(J.m1, J.m2, .5) : J.m1; }

  PROPS.barra = (S, J, ctx) => {
    if (J.vista === 'frente') {
      const a = J.m2, b = J.m1, u = norm(sub(b, a));
      const ea = sub(a, mul(u, 30)), eb = add(b, mul(u, 30));
      S.cap(ea, eb, 3.6, C.aco, 'frente');
      for (const [e, s] of [[ea, -1], [eb, 1]]) {
        S.oret(sub(e, mul(u, s * 7)), u, 6, 34, 2.5, C.roxo, 'frente');
        S.oret(sub(e, mul(u, s * 12)), u, 5, 26, 2, C.coral, 'frente');
      }
      return;
    }
    placa(S, J.m1, ctx.tpl.placa || 16, C.roxo, C.roxo2, 'frente');
  };
  PROPS.barra_ez = PROPS.barra;
  PROPS.bastao = (S, J) => {
    if (J.vista === 'frente') {
      const u = norm(sub(J.m1, J.m2));
      S.cap(sub(J.m2, mul(u, 26)), add(J.m1, mul(u, 26)), 3.4, C.madeira2, 'frente');
    } else S.circ(J.m1, 3.2, C.madeira2, 'frente');
  };

  function halter(S, c, u, cam, cor) {
    // u = direcao do cabo
    S.cap(sub(c, mul(u, 8)), add(c, mul(u, 8)), 3.2, C.aco, cam);
    S.oret(add(c, mul(u, 8.5)), u, 5.5, 13, 2.2, cor || C.amarelo, cam);
    S.oret(sub(c, mul(u, 8.5)), u, 5.5, 13, 2.2, cor || C.amarelo, cam);
  }
  function eixoHalter(J, k) {
    if (J.vista === 'frente') return V(1, 0);
    const fa = J['fa' + k];
    return dir(fa + 90);
  }
  PROPS.halteres = (S, J, ctx) => {
    const so1 = ctx.tpl.uni || ctx.p === 'halter';
    halter(S, J.m1, eixoHalter(J, 1), J.vista === 'frente' ? 'frente' : 'frente', C.amarelo);
    if (!so1) halter(S, J.m2, eixoHalter(J, 2), J.vista === 'frente' ? 'frente' : 'meio', '#F0B420');
  };
  PROPS.halter = (S, J, ctx) => {
    if (ctx.tpl.goblet) { halter(S, add(maoMeio(J), V(0, 3)), V(0, 1), 'frente', C.amarelo); return; }
    halter(S, J.m1, eixoHalter(J, 1), 'frente', C.amarelo);
  };

  function kettlebell(S, m, d, cam, cor) {
    const c = add(m, mul(d, 10.5));
    S.anel(add(m, mul(d, 3.5)), 4.6, 2.6, C.metal2, cam);
    S.circ(c, 8.2, cor || C.turq, cam);
    S.circ(add(c, mul(perp(d), -2.5)), 2.4, C.turq2, cam);
    S.cap(add(c, mul(d, 7)), add(add(c, mul(d, 7)), mul(perp(d), 0.1)), 4, cor || C.turq, cam);
  }
  PROPS.kettlebell = (S, J, ctx) => {
    const t = ctx.tpl;
    const both = t.duplo || ctx.p === 'kettlebells';
    const dirKB = k => t.kbBalanco ? norm(sub(J['m' + k], J['co' + k])) : V(0, 1);
    if (t.goblet && !both) { kettlebell(S, maoMeio(J), V(0, 1), 'frente'); return; }
    kettlebell(S, J.m1, dirKB(1), 'frente');
    if (both || (!t.uni && J.vista === 'frente')) kettlebell(S, J.m2, dirKB(2), J.vista === 'frente' ? 'frente' : 'meio', '#0FAFA6');
  };
  PROPS.kettlebells = PROPS.kettlebell;

  PROPS.medicine_ball = (S, J, ctx) => {
    const c = ctx.bola || add(maoMeio(J), J.vista === 'frente' ? V(0, -2) : mul(dir(J.fa1 + 90), 0));
    S.circ(c, 11, C.verde, 'frente');
    S.curva(add(c, V(-11, 0)), add(c, V(-4, -6)), add(c, V(4, 6)), add(c, V(11, 0)), 1.6, C.verde2, 'frente');
    S.circ(add(c, V(-4, -4.5)), 2.6, C.verde2, 'frente', ' opacity=".8"');
  };
  PROPS.anilha = (S, J, ctx) => {
    const c = maoMeio(J);
    if (J.vista === 'frente' || ctx.tpl.anilhaFace) { placa(S, c, 14, C.roxo, C.roxo2, 'frente'); return; }
    const u = dir(J.fa1 + 90);
    S.oret(c, u, 30, 6, 2.8, C.roxo, 'frente');
  };
  PROPS.saco_areia = (S, J) => {
    const c = add(maoMeio(J), V(0, 2));
    S.oret(c, V(1, 0), 30, 18, 7, C.amarelo, 'frente');
    S.cap(add(c, V(-8, -2)), add(c, V(8, -2)), 2, C.madeira2, 'frente');
  };
  PROPS.mochila = (S, J, ctx) => {
    if (ctx.tpl.mochila === 'mao') {
      const c = add(maoMeio(J), V(0, 6));
      S.oret(c, V(0, 1), 22, 18, 6, C.azul, 'frente');
      S.oret(add(c, V(0, 4)), V(0, 1), 9, 12, 3, C.azul2, 'frente');
      S.anel(add(c, V(0, -12)), 3.5, 2, C.azul, 'frente');
      return;
    }
    if (J.vista === 'frente') { // alcas sobre os ombros
      S.cap(add(J.om1, V(-3, 0)), add(J.om1, V(-4, 20)), 3, C.azul, 'frente');
      S.cap(add(J.om2, V(3, 0)), add(J.om2, V(4, 20)), 3, C.azul, 'frente');
      return;
    }
    const T = (u, v) => add(add(J.q, mul(J.up, u)), mul(J.fw, v));
    S.poli([T(16, -12), T(42, -12), T(42, -24), T(18, -25)], C.azul, 'meio', 5);
    S.poli([T(22, -24), T(34, -24), T(34, -28), T(22, -28)], C.azul2, 'meio', 2.5);
    S.cap(T(45, -6), T(28, 6), 3, C.azul, 'corpo');
  };
  PROPS.raquete = (S, J) => {
    const m = J.m1, u = dir(J.pu1);
    const cabo = add(m, mul(u, 9)), cab = add(m, mul(u, 22));
    S.cap(sub(m, mul(u, 2)), cabo, 4, C.azul, 'frente');
    S.oret(cab, u, 26, 22, 10, C.amarelo, 'frente');
    S.oret(cab, u, 18, 14, 6.5, C.amarelo2, 'frente');
  };
  PROPS.hand_grip = (S, J) => {
    const m = J.m1, u = dir(J.pu1);
    S.cap(add(m, mul(perp(u), 4)), add(add(m, mul(perp(u), 4)), mul(u, 10)), 3, C.coral, 'frente');
    S.cap(add(m, mul(perp(u), -4)), add(add(m, mul(perp(u), -4)), mul(u, 10)), 3, C.coral, 'frente');
    S.anel(add(m, mul(u, -3)), 2.5, 1.5, C.metal2, 'frente');
  };
  PROPS.bola_tenis = (S, J, ctx) => { const c = ctx.bolinha || add(J.m1, V(0, -6)); S.circ(c, 4.2, '#C6F432', 'frente'); };

  // cabos: polia, elastico, trx, toalha
  function pontoCabo(J, ctx) {
    const a = ctx.tpl.cabo;
    if (!a) return null;
    if (a === 'pe') return add(J.d1, V(-2, 2));
    if (a === 'pe2') return add(J.d2, V(-2, 2));
    if (typeof a === 'object' && a.j) return add(J[a.j], V(a.d[0], a.d[1]));
    return V(a[0], a[1]);
  }
  function maosCabo(J, ctx) {
    if (ctx.tpl.caboEm) { const k = ctx.tpl.caboEm; return [add(J[k], V(0, k[0] === 't' ? -3 : 0))]; }
    if (ctx.tpl.uni) return [J.m1];
    if (J.vista === 'frente') return ctx.tpl.caboDuplo ? [J.m1, J.m2] : [mix(J.m1, J.m2, .5)];
    return [J.m1];
  }
  function torre(S, x, y, cam, ladoEsq) {
    const top = Math.min(y - 14, 40);
    S.ret(x - 6, top, 12, G - top, 4, C.metal3, cam);
    S.ret(x - 9, G - 6, 18, 6, 3, C.metal, cam);
    S.ret(x - 4.5, top + 30, 9, Math.min(46, G - top - 40), 2, C.coral2, cam);
    for (let i = 0; i < 4; i++) S.cap(V(x - 4, top + 34 + i * 9), V(x + 4, top + 34 + i * 9), 1.2, C.coral, cam);
  }
  function roldana(S, c, cam) { S.circ(c, 5.2, C.metal2, cam); S.circ(c, 2, C.metal3, cam); }
  PROPS.polia = (S, J, ctx) => {
    const cb = ctx.tpl.cabo, J0 = ctx.J0 || J;
    let a = pontoCabo(J, ctx);
    if (!a) a = add(J0.m1, V(60, 0));
    if (cb === 'pe' || cb === 'pe2' || (cb && cb.j)) a = J.vista === 'frente' ? V(J0.q.x - 66, G - 10) : V(J0.t1.x + 56, G - 10);
    torre(S, a.x, a.y, 'fundo');
    roldana(S, a, 'fundo');
    for (const m of maosCabo(J, ctx)) {
      S.cap(a, m, 1.8, C.metal2, 'meio');
      S.cap(add(m, V(-3.5, 0)), add(m, V(3.5, 0)), 3.6, C.metal2, 'frente');
    }
  };
  PROPS.crossover = (S, J, ctx) => {
    const a = pontoCabo(J, ctx);
    if (J.vista === 'frente' && ctx.tpl.caboDuplo) {
      const y = a ? a.y : 40, dx = ctx.tpl.torreDx || 70, cx = J.J0q ? J.J0q.x : J.q.x;
      for (const [k, s] of [[1, 1], [2, -1]]) {
        const p = V(cx + s * dx, y);
        torre(S, p.x, p.y, 'fundo'); roldana(S, p, 'fundo');
        S.cap(p, J['m' + k], 1.8, C.metal2, 'meio');
      }
      return;
    }
    PROPS.polia(S, J, ctx);
  };
  // batente de porta / poste onde o elastico ou a toalha ficam presos (estatico)
  function porta(S, a, ctx) {
    if (a.y > G - 14) { S.ret(a.x - 5, G - 8, 10, 8, 2, C.metal2, 'fundo'); return; }
    const top = Math.min(a.y - 40, 20), dx = a.x > (ctx.J0 ? ctx.J0.q.x : 100) ? 1 : -1;
    S.ret(dx > 0 ? a.x - 1 : a.x - 15, top, 16, G - top, 3, C.parede, 'fundo');
    S.ret(a.x - 3, top, 6, G - top, 2, C.parede2, 'fundo');
    S.circ(V(a.x + dx * 10, (a.y + G) / 2 + 6), 2.4, C.amarelo, 'fundo');
  }
  PROPS.elastico = (S, J, ctx) => {
    const a = pontoCabo(J, ctx);
    if (!a) {    // elastico entre as maos
      if (J.vista === 'frente') S.curva(J.m2, add(J.m2, V(4, 6)), add(J.m1, V(-4, 6)), J.m1, 3.4, C.coral, 'frente');
      else S.circ(J.m1, 4, C.coral, 'frente');
      return;
    }
    if (!ctx.tpl.caboPe && ctx.tpl.cabo !== 'pe' && ctx.tpl.cabo !== 'pe2' && !(ctx.tpl.cabo && ctx.tpl.cabo.j)) { porta(S, a, ctx); S.circ(a, 3.4, C.metal2, 'fundo'); }
    for (const m of maosCabo(J, ctx)) {
      const mm = mix(a, m, .5);
      S.curva(a, mm, mm, m, 3.6, C.coral, 'meio');
      S.cap(add(m, V(-3, 0)), add(m, V(3, 0)), 4, C.amarelo, 'frente');
    }
  };
  PROPS.toalha = (S, J, ctx) => {
    if (ctx.tpl.desliza) { const k = ctx.tpl.desliza; S.oret(add(J['t' + k], V(4, 4.5)), V(1, 0), 20, 3.5, 1.5, C.amarelo, 'frente'); return; }
    const a = pontoCabo(J, ctx);
    if (a) { if (!(ctx.tpl.cabo && ctx.tpl.cabo.j) && ctx.tpl.cabo !== 'pe') porta(S, a, ctx); for (const m of maosCabo(J, ctx)) S.cap(a, m, 6, C.amarelo, 'meio'); return; }
    if (J.vista === 'frente') { S.curva(J.m2, add(J.m2, V(3, 8)), add(J.m1, V(-3, 8)), J.m1, 6, C.amarelo, 'frente'); return; }
    S.oret(add(J.m1, V(0, 9)), V(0, 1), 18, 7, 2.5, C.amarelo, 'frente');
  };
  PROPS.trx = (S, J, ctx) => {
    const a = pontoCabo(J, ctx) || add(J.om, V(40, -90));
    S.poli([add(a, V(-5, -4)), add(a, V(5, -4)), add(a, V(0, 4))], C.metal2, 'fundo', 1.5);
    const alvos = ctx.tpl.trxPe ? [add(J.t1, V(2, 0)), add(J.t2, V(2, 0))] : maosCabo(J, ctx);
    for (const m of alvos) {
      const mid = mix(a, m, .75);
      S.cap(a, mid, 3.4, C.amarelo, 'meio');
      S.cap(mid, m, 3.4, '#E8A912', 'meio');
      S.cap(add(m, V(-3, 0)), add(m, V(3, 0)), 4, C.metal2, 'frente');
    }
  };
  PROPS.mini_band = (S, J, ctx) => {
    const onde = ctx.tpl.band || 'joelho';
    const pts = onde === 'tornozelo' ? [J.t1, J.t2] : onde === 'punho' ? [J.p1, J.p2] : [J.j1, J.j2];
    if (J.vista === 'frente') {
      const [a, b] = pts;
      S.curva(a, add(a, V(0, -2)), add(b, V(0, -2)), b, 3.6, C.coral, 'frente');
      S.curva(a, add(a, V(0, 3)), add(b, V(0, 3)), b, 2.4, C.coral2, 'frente');
    } else {
      const c = onde === 'joelho' ? mix(J.q, J.j1, .8) : onde === 'punho' ? J.p1 : add(J.t1, V(0, -5));
      S.elipse(c, 3, 8.5, C.coral, 'frente');
    }
  };
  PROPS.landmine = (S, J, ctx) => {
    const piv = ctx.tpl.lm ? V(ctx.tpl.lm[0], ctx.tpl.lm[1]) : V((J.J0m1 || J.m1).x + 95, G - 3);
    const m = maoMeio(J), u = norm(sub(m, piv));
    const ponta = add(m, mul(u, ctx.tpl.lmPonta ?? 8));
    S.ret(piv.x - 7, G - 6, 14, 6, 2, C.metal2, 'fundo');
    S.cap(piv, ponta, 4, C.aco, 'meio');
    S.oret(sub(ponta, mul(u, 12)), u, 5, 26, 2, C.roxo, 'meio');
  };
  PROPS.corda_naval = (S, J, ctx) => {
    const m = maoMeio(J), fim = V(m.x + 120, G - 4), fs = ctx.fase * Math.PI * 2;
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const u = i / 10, p = mix(m, fim, u);
      pts.push(add(p, V(0, Math.sin(fs * 2 - u * 9) * 9 * (1 - u * .6))));
    }
    S.linha(pts, 4.5, C.turq, 'meio');
    S.ret(fim.x - 4, fim.y - 6, 8, 10, 2, C.metal2, 'fundo');
  };
  PROPS.corda_pular = (S, J, ctx) => {
    const a = J.m2, b = J.m1, fs = ctx.fase * Math.PI * 2, y = Math.cos(fs);
    const base = mix(a, b, .5);
    const ext = y > 0 ? (G + 2 - base.y) : (J.cab.y - 26 - base.y);
    const cy = base.y + ext * Math.abs(y) * 1.25 + (y > 0 ? 6 : -2);
    S.curva(a, V(a.x - 6, cy), V(b.x + 6, cy), b, 2.2, C.roxo, 'frente');
    for (const m of [a, b]) S.cap(add(m, V(0, -3)), add(m, V(0, 5)), 4, C.amarelo, 'frente');
  };
  PROPS.smith = (S, J, ctx) => {
    if (J.vista === 'frente') {
      const J0 = ctx.J0, xa = J0.m2.x - 24, xb = J0.m1.x + 24;
      for (const x of [xa, xb]) S.ret(x - 3, -20, 6, G + 20, 2, C.metal, 'fundo');
      S.ret(xa - 8, -26, xb - xa + 16, 7, 3, C.metal2, 'fundo');
      const y = mix(J.m1, J.m2, .5).y;
      S.cap(V(xa - 6, y), V(xb + 6, y), 3.6, C.aco, 'frente');
      for (const x of [xa - 8, xb + 8]) S.oret(V(x, y), V(1, 0), 6, 26, 2.5, C.roxo, 'frente');
      return;
    }
    const x = (J.J0m1 || J.m1).x;
    S.ret(x - 3, 18, 6, G - 18, 2, C.metal, 'fundo');
    S.ret(x - 14, 14, 28, 6, 3, C.metal2, 'fundo');
    S.ret(x - 16, G - 5, 32, 5, 2, C.metal2, 'fundo');
    placa(S, J.m1, 13, C.roxo, C.roxo2, 'frente');
  };

  // ---- cenario
  const CENA = {};
  CENA.banco = (S, o) => {   // o: x0,x1,y (topo do estofado)
    const y = o.y ?? 140, x0 = o.x0 ?? 40, x1 = o.x1 ?? 140, cam = o.cam || 'fundo';
    S.ret(x0, y, x1 - x0, 9, 4.5, C.estofado, cam);
    S.ret(x0 + 3, y + 1.5, x1 - x0 - 6, 3, 1.5, C.estofado2, cam);
    const pe = (x) => { S.ret(x - 3.5, y + 9, 7, G - y - 9, 2, C.metal, cam); S.ret(x - 10, G - 5, 20, 5, 2.5, C.metal2, cam); };
    pe(x0 + 14); pe(x1 - 14);
  };
  CENA.banco_inclinado = (S, o) => {  // assento + encosto inclinado; o: x (quadril), y (assento), ang (graus do encosto, 0=vertical)
    const x = o.x ?? 100, y = o.y ?? 140, a = o.ang ?? 45, Lc = o.L ?? 70, cam = o.cam || 'fundo';
    const u = V(-Math.sin(a * R), -Math.cos(a * R));     // encosto sobe para tras (esquerda)
    const base = V(x + (o.dx ?? 2), y + 4);
    S.ret(x - 6, y, 34, 9, 4.5, C.estofado, cam);
    S.oret(add(base, mul(u, Lc / 2)), u, Lc, 10, 4.5, C.estofado, cam);
    S.ret(x - 2, y + 9, 7, G - y - 9, 2, C.metal, cam);
    const topo = add(base, mul(u, Lc * .8));
    S.cap(add(topo, V(0, 4)), V(topo.x, G - 3), 6, C.metal, cam);
    S.ret(Math.min(topo.x, x) - 10, G - 5, Math.abs(topo.x - x) + 30, 5, 2.5, C.metal2, cam);
  };
  CENA.banco_declinado = (S, o) => {
    const x0 = o.x0 ?? 40, x1 = o.x1 ?? 140, y0 = o.y0 ?? 150, y1 = o.y1 ?? 122, cam = o.cam || 'fundo';
    const a = V(x0, y0), b = V(x1, y1), u = norm(sub(b, a));
    S.oret(mix(a, b, .5), u, dist(a, b), 9, 4.5, C.estofado, cam);
    S.cap(V(x0 + 12, y0 + 4), V(x0 + 12, G - 3), 6, C.metal, cam);
    S.cap(V(x1 - 12, y1 + 6), V(x1 - 12, G - 3), 6, C.metal, cam);
    S.ret(x0, G - 5, x1 - x0, 5, 2.5, C.metal2, cam);
    S.circ(V(x1 + 6, y1 + 26), 5.5, C.estofado2, cam);
  };
  CENA.cadeira = (S, o) => {  // o: x (centro do assento), y (assento), costas: -1 (encosto a esquerda) | 1
    const x = o.x ?? 100, y = o.y ?? 136, s = o.costas ?? -1, cam = o.cam || 'fundo', w = 34;
    S.ret(x - w / 2, y, w, 6, 3, C.madeira, cam);
    S.cap(V(x - w / 2 + 3, y + 4), V(x - w / 2 + 3, G - 1), 4.5, C.madeira2, cam);
    S.cap(V(x + w / 2 - 3, y + 4), V(x + w / 2 - 3, G - 1), 4.5, C.madeira2, cam);
    if (s) { const xe = x + s * (w / 2 - 2); S.cap(V(xe, y + 2), V(xe + s * 3, y - 44), 4.5, C.madeira2, cam); S.oret(V(xe + s * 2.5, y - 36), V(0, 1), 18, 8, 3, C.madeira, cam); }
  };
  CENA.degrau = (S, o) => {
    const x0 = o.x0 ?? 90, x1 = o.x1 ?? 140, y = o.y ?? 158, cam = o.cam || 'fundo';
    S.ret(x0, y, x1 - x0, G - y, 4, C.turq, cam);
    S.ret(x0, y, x1 - x0, 5, 3, C.turq2, cam);
  };
  CENA.caixa = (S, o) => {
    const x0 = o.x0 ?? 120, x1 = o.x1 ?? 160, y = o.y ?? 130, cam = o.cam || 'fundo';
    S.ret(x0, y, x1 - x0, G - y, 3, C.madeira, cam);
    S.ret(x0 + 5, y + 6, x1 - x0 - 10, G - y - 12, 2, C.madeira2, cam, ' opacity=".35"');
  };
  CENA.parede = (S, o) => {
    const x = o.x ?? 150, s = o.lado ?? 1, cam = o.cam || 'fundo', top = o.top ?? 14;
    const x0 = s > 0 ? x : x - 22;
    S.ret(x0, top, 22, G - top, 2, C.parede, cam);
    S.cap(V(s > 0 ? x + 1 : x - 1, top), V(s > 0 ? x + 1 : x - 1, G), 2.5, C.parede2, cam);
  };
  CENA.colchonete = (S, o) => {
    const x0 = o.x0 ?? 30, x1 = o.x1 ?? 170;
    S.ret(x0, G - 4, x1 - x0, 6, 3, C.tapete, o.cam || 'fundo');
  };
  CENA.bola_suica = (S, o) => {
    const c = V(o.x ?? 100, o.y ?? (G - (o.r ?? 28))), r = o.r ?? 28, cam = o.cam || 'fundo';
    S.circ(c, r, C.roxo, cam);
    S.curva(add(c, V(-r, 0)), add(c, V(-r * .4, r * .3)), add(c, V(r * .4, r * .3)), add(c, V(r, 0)), 2, C.roxo2, cam);
    S.circ(add(c, V(-r * .42, -r * .42)), r * .18, '#FFFFFF', cam, ' opacity=".45"');
  };
  CENA.bosu = (S, o) => {
    const x = o.x ?? 100, cam = o.cam || 'fundo';
    S.add(cam, `M${f(x - 26)} ${G - 3}A26 18 0 0 1 ${f(x + 26)} ${G - 3}Z`, `fill="${C.azul}"`, [V(x - 26, G - 21), V(x + 26, G)], 0);
    S.ret(x - 28, G - 5, 56, 5, 2.5, C.metal2, cam);
  };
  CENA.foam_roller = (S, o) => {
    const c = V(o.x ?? 100, o.y ?? G - 8), cam = o.cam || 'fundo';
    S.circ(c, 8, C.turq, cam); S.circ(c, 3.5, C.turq2, cam);
  };
  CENA.barra_fixa = (S, o) => {  // vista lateral: barra de topo (x,y). frente: barra larga
    const x = o.x ?? 100, y = o.y ?? 20, cam = o.cam || 'fundo';
    if (o.frente) {
      const w = o.w ?? 120;
      S.cap(V(x - w / 2, y), V(x + w / 2, y), 4.5, C.aco, cam);
      for (const s of [-1, 1]) S.cap(V(x + s * (w / 2 - 4), y - 6), V(x + s * (w / 2 - 4), G), 6, C.metal, cam);
      return;
    }
    S.cap(V(x - 30, y - 3), V(x - 30, G), 6, C.metal3, 'fundo');
    S.cap(V(x - 30, y - 3), V(x, y), 4, C.metal3, 'fundo');
    S.circ(V(x, y), 3.6, C.aco, cam);
  };
  CENA.paralelas = (S, o) => {
    const x0 = o.x0 ?? 70, x1 = o.x1 ?? 140, y = o.y ?? 110, cam = o.cam || 'fundo';
    S.cap(V(x0, y), V(x1, y), 5, C.aco, cam);
    for (const x of [x0 + 8, x1 - 8]) S.cap(V(x, y), V(x, G - 2), 6, C.metal, cam);
  };
  CENA.argolas = (S, o, J) => {
    const top = o.top ?? 0;
    for (const k of (o.um ? [1] : [1, 2])) {
      const m = J['m' + k], a = V(m.x + (o.dx ?? 0), top);
      S.cap(a, add(m, V(0, -5)), 2.4, C.amarelo, k === 1 ? 'meio' : 'fundo');
      S.anel(add(m, V(0, 1)), 6, 3, C.madeira2, k === 1 ? 'frente' : 'meio');
    }
  };
  CENA.cones = (S, o) => {
    for (const x of (o.xs || [40, 170])) {
      S.poli([V(x - 8, G - 2), V(x + 8, G - 2), V(x + 1.5, G - 22), V(x - 1.5, G - 22)], '#FF8A3D', o.cam || 'fundo', 1.5);
      S.cap(V(x - 5.5, G - 10), V(x + 5.5, G - 10), 2.4, '#FFFFFF', o.cam || 'fundo');
      S.ret(x - 11, G - 3, 22, 3, 1.5, '#FF8A3D', o.cam || 'fundo');
    }
  };
  CENA.escada_agilidade = (S, o) => {
    const x0 = o.x0 ?? 20, x1 = o.x1 ?? 190;
    S.cap(V(x0, G - 1), V(x1, G - 1), 2, C.amarelo, 'fundo');
    S.cap(V(x0 + 8, G + 4), V(x1 - 8, G + 4), 2, C.amarelo, 'fundo');
    for (let x = x0 + 4; x <= x1; x += 24) S.cap(V(x, G - 1), V(x + 4, G + 4), 2.2, C.amarelo, 'fundo');
  };
  CENA.esteira = (S, o) => {
    const x0 = o.x0 ?? 40, x1 = o.x1 ?? 165, cam = o.cam || 'fundo';
    S.ret(x0, G - 14, x1 - x0, 12, 6, C.metal, cam);
    S.ret(x0 + 6, G - 15, x1 - x0 - 12, 4, 2, C.azul, cam);
    S.circ(V(x0 + 8, G - 8), 4, C.metal2, cam); S.circ(V(x1 - 8, G - 8), 4, C.metal2, cam);
    S.cap(V(x1 - 8, G - 12), V(x1 - 2, 70), 5, C.metal, cam);
    S.oret(V(x1 - 4, 66), norm(V(-1, -0.6)), 22, 9, 3, C.turq, cam);
    S.cap(V(x1 - 10, 92), V(x1 - 44, 96), 4, C.metal2, cam);
  };
  CENA.parede_alvo = CENA.parede;
  CENA.trx = (S, o, J) => {     // alca do TRX segurando o pe de tras (bulgaro/afundo suspenso)
    const k = o.pe || 2, t = J['t' + k], a = V(t.x + 6, -14);
    S.poli([add(a, V(-5, -4)), add(a, V(5, -4)), add(a, V(0, 4))], C.metal2, 'fundo', 1.5);
    S.cap(a, add(t, V(1, -4)), 3.4, C.amarelo, 'meio');
    S.cap(add(t, V(-4, -1)), add(t, V(5, -1)), 4, C.metal2, 'meio');
  };

  // ---- maquinas (desenho estatico + partes moveis presas as juntas)
  const MAQ = {};
  function pilha(S, x, top, cam) {
    S.ret(x - 9, top, 18, G - top, 4, C.metal3, cam);
    S.ret(x - 6.5, top + 34, 13, Math.min(42, G - top - 44), 2, C.coral2, cam);
    for (let i = 0; i < 4; i++) S.cap(V(x - 5, top + 38 + i * 9), V(x + 5, top + 38 + i * 9), 1.3, C.coral, cam);
    S.ret(x - 13, G - 6, 26, 6, 3, C.metal, cam);
  }
  function almofada(S, c, u, L, W, cam) { S.oret(c, u, L, W, Math.min(W, L) / 2 - .5, C.estofado, cam); }
  function rolo(S, c, cam) { S.circ(c, 6.5, C.estofado, cam); S.circ(c, 2.4, C.estofado2, cam); }
  function pegador(S, m, cam) { S.circ(m, 4.2, C.metal2, cam); }

  // ---------------------------------------------------------------- maquinas
  // assinatura: (S, opcoes, J, ctx). Partes fixas usam ctx.J0 (1a amostra); partes moveis usam J.
  const Q = (J, u, v) => add(add(J.q, mul(J.up, u)), mul(J.fw, v));   // ponto no referencial do tronco
  MAQ.leg_press = (S, o, J, ctx) => {
    const J0 = ctx.J0, q = J0.q, rd = norm(V(1, -1)), tg = V(-rd.y, rd.x);
    almofada(S, Q(J0, 26, -14), J0.up, 58, 10, 'fundo');
    almofada(S, add(q, V(-4, 13)), norm(V(1, .25)), 30, 10, 'fundo');
    const r0 = add(q, V(16, 10)), r1 = add(r0, mul(rd, 136));
    S.cap(r0, r1, 6, C.metal, 'fundo');
    S.cap(V(q.x - 30, G - 3), V(r1.x + 6, G - 3), 6, C.metal2, 'fundo');
    S.cap(V(q.x - 20, q.y + 10), V(q.x - 20, G - 3), 6, C.metal, 'fundo');
    S.cap(r1, V(r1.x, G - 3), 6, C.metal, 'fundo');
    const t = mix(J.t1, J.t2, .5), c = add(t, mul(rd, 7));
    S.oret(add(c, mul(rd, 14)), rd, 18, 30, 5, C.metal3, 'meio');
    placa(S, add(c, mul(rd, 18)), 12, C.roxo, C.roxo2, 'meio');
    S.oret(c, tg, 44, 7, 3, C.estofado, 'frente');
    S.cap(add(q, V(10, 6)), add(q, V(14, -2)), 4, C.metal2, 'perto');
  };
  MAQ.hack = (S, o, J, ctx) => {
    const J0 = ctx.J0, rd = norm(V(.45, -.89));
    const base = add(Q(J0, 0, -26), mul(rd, -40));
    S.cap(base, add(base, mul(rd, 170)), 7, C.metal, 'fundo');
    S.cap(V(base.x, base.y), V(base.x, G - 3), 6, C.metal, 'fundo');
    S.ret(J0.t1.x - 22, G - 8, 50, 8, 3, C.metal2, 'fundo');
    S.cap(add(base, V(0, 2)), V(J0.t1.x + 24, G - 4), 6, C.metal2, 'fundo');
    S.cap(add(Q(J, 24, -21), mul(J.up, 0)), add(Q(J, 24, -21), V(-8, 4)), 5, C.metal, 'meio');
    almofada(S, Q(J, 24, -15), J.up, 56, 10, 'meio');
    almofada(S, add(J.om, add(mul(J.up, 4), mul(J.fw, 2))), J.fw, 14, 9, 'frente');
  };
  MAQ.extensora = (S, o, J, ctx) => {
    const J0 = ctx.J0, q = J0.q, kn = J0.j1;
    pilha(S, q.x - 34, 40, 'fundo');
    S.ret(q.x - 10, q.y + 9, kn.x - q.x + 6, 10, 5, C.estofado, 'fundo');
    almofada(S, Q(J0, 26, -14), J0.up, 50, 10, 'fundo');
    S.cap(V(q.x - 2, q.y + 18), V(q.x - 2, G - 3), 7, C.metal, 'fundo');
    S.ret(q.x - 26, G - 6, kn.x - q.x + 40, 6, 3, C.metal2, 'fundo');
    const sd = norm(sub(J.t1, J.j1)), fr = V(sd.y, -sd.x);
    const rc = add(add(J.t1, mul(fr, -1)), mul(sd, -3));
    const frente = o.tras ? sub(rc, mul(fr, 14)) : add(rc, mul(fr, 10));
    S.cap(kn, frente, 4, C.metal2, 'meio');
    rolo(S, frente, 'frente');
    S.circ(kn, 4.5, C.metal2, 'meio');
  };
  MAQ.flexora = (S, o, J, ctx) => {
    const J0 = ctx.J0, y = o.y ?? 134;
    S.ret(o.x0 ?? 30, y, (o.x1 ?? 160) - (o.x0 ?? 30), 10, 5, C.estofado, 'fundo');
    S.cap(V((o.x1 ?? 160) - 20, y + 8), V((o.x1 ?? 160) - 20, G - 3), 7, C.metal, 'fundo');
    S.cap(V((o.x0 ?? 30) + 22, y + 8), V((o.x0 ?? 30) + 22, G - 3), 7, C.metal, 'fundo');
    S.ret((o.x0 ?? 30) + 8, G - 6, (o.x1 ?? 160) - (o.x0 ?? 30) - 16, 6, 3, C.metal2, 'fundo');
    const kn = J0.j1, sd = norm(sub(J.t1, J.j1)), fr = V(sd.y, -sd.x);
    const rc = add(add(J.t1, mul(fr, -9)), mul(sd, -2));
    S.cap(add(kn, V(0, 10)), rc, 4, C.metal2, 'fundo');
    rolo(S, rc, 'frente');
  };
  MAQ.flexora_sentada = (S, o, J, ctx) => {
    const J0 = ctx.J0, q = J0.q, kn = J0.j1;
    pilha(S, q.x - 34, 40, 'fundo');
    S.ret(q.x - 10, q.y + 9, kn.x - q.x + 6, 10, 5, C.estofado, 'fundo');
    almofada(S, Q(J0, 26, -14), J0.up, 50, 10, 'fundo');
    S.cap(V(q.x - 2, q.y + 18), V(q.x - 2, G - 3), 7, C.metal, 'fundo');
    S.ret(q.x - 26, G - 6, kn.x - q.x + 40, 6, 3, C.metal2, 'fundo');
    almofada(S, add(mix(J0.q, J0.j1, .7), V(0, -11)), V(1, 0), 22, 8, 'frente');
    const sd = norm(sub(J.t1, J.j1)), fr = V(sd.y, -sd.x);
    const rc = add(add(J.t1, mul(fr, -9)), mul(sd, -3));
    S.cap(kn, rc, 4, C.metal2, 'meio');
    rolo(S, rc, 'frente');
  };
  MAQ.puxador = (S, o, J, ctx) => {     // vista frontal, sentado
    const J0 = ctx.J0, x = J0.q.x, top = o.top ?? -20;
    S.ret(x - 7, top, 14, G - top, 4, C.metal3, 'fundo');
    roldana(S, V(x, top + 6), 'fundo');
    S.ret(x - 22, J0.q.y + 8, 44, 9, 4.5, C.estofado, 'fundo');
    S.ret(x - 4, J0.q.y + 17, 8, G - J0.q.y - 17, 2, C.metal, 'fundo');
    S.ret(x - 28, G - 6, 56, 6, 3, C.metal2, 'fundo');
    almofada(S, add(mix(J0.q1, J0.j1, .9), V(0, -9)), V(1, 0), 16, 8, 'frente');
    almofada(S, add(mix(J0.q2, J0.j2, .9), V(0, -9)), V(1, 0), 16, 8, 'frente');
    const c = mix(J.m1, J.m2, .5);
    S.cap(V(x, top + 6), add(c, V(0, -2)), 1.8, C.metal2, 'meio');
    const u = norm(sub(J.m1, J.m2));
    const a = sub(J.m2, mul(u, 16)), b = add(J.m1, mul(u, 16));
    S.linha([add(a, V(-4, 8)), a, b, add(b, V(4, 8))], 3.6, C.aco, 'frente');
  };
  MAQ.remada_baixa = (S, o, J, ctx) => {
    const J0 = ctx.J0, q = J0.q, x1 = o.x1 ?? 190, yp = o.yp ?? 140;
    S.ret(x1 - 7, 60, 14, G - 60, 4, C.metal3, 'fundo');
    roldana(S, V(x1 - 2, yp), 'fundo');
    S.ret(q.x - 26, q.y + 10, 46, 8, 4, C.estofado, 'fundo');
    S.ret(q.x - 30, G - 6, x1 - q.x + 38, 6, 3, C.metal2, 'fundo');
    S.cap(V(q.x - 4, q.y + 16), V(q.x - 4, G - 4), 6, C.metal, 'fundo');
    const pe = mix(J0.t1, J0.t2, .5);
    S.oret(add(pe, V(9, -2)), norm(V(.35, -1)), 28, 6, 3, C.metal, 'fundo');
    S.cap(V(x1 - 2, yp), J.m1, 1.8, C.metal2, 'meio');
    S.linha([add(J.m1, V(-2, -5)), add(J.m1, V(4, 0)), add(J.m1, V(-2, 5))], 3, C.metal2, 'frente');
  };
  MAQ.remada_maquina = (S, o, J, ctx) => {
    const J0 = ctx.J0, q = J0.q;
    S.ret(q.x - 20, q.y + 9, 40, 9, 4.5, C.estofado, 'fundo');
    S.cap(V(q.x, q.y + 16), V(q.x, G - 3), 6, C.metal, 'fundo');
    const peito = Q(J0, 36, 14);
    almofada(S, add(peito, V(9, 0)), V(0, 1), 30, 9, 'frente');
    S.cap(add(peito, V(14, 0)), V(peito.x + 24, G - 3), 6, C.metal, 'fundo');
    S.ret(q.x - 26, G - 6, peito.x - q.x + 60, 6, 3, C.metal2, 'fundo');
    const piv = V(peito.x + 40, o.pivY ?? 30);
    S.cap(piv, V(piv.x, G - 3), 7, C.metal3, 'fundo');
    S.cap(piv, J.m1, 4, C.metal2, 'fundo');
    pegador(S, J.m1, 'frente');
  };
  MAQ.alavanca = (S, o, J, ctx) => {    // supino/desenvolvimento/remada articulada sentado (lateral)
    const J0 = ctx.J0, q = J0.q;
    S.ret(q.x - 16, q.y + 9, 34, 9, 4.5, C.estofado, 'fundo');
    almofada(S, Q(J0, 28, -14), J0.up, 56, 10, 'fundo');
    S.cap(V(q.x - 4, q.y + 16), V(q.x - 4, G - 3), 6, C.metal, 'fundo');
    const piv = V(o.px ?? q.x - 20, o.py ?? 20);
    S.cap(V(piv.x, piv.y), V(piv.x, G - 3), 7, C.metal3, 'fundo');
    S.ret(Math.min(piv.x, q.x) - 20, G - 6, Math.abs(piv.x - q.x) + 70, 6, 3, C.metal2, 'fundo');
    if (o.pilha) pilha(S, piv.x - 26, 60, 'fundo');
    S.cap(piv, J.m1, 4.5, C.metal2, 'fundo');
    S.circ(piv, 5, C.metal2, 'fundo');
    pegador(S, J.m1, 'frente');
  };
  MAQ.peck_deck = (S, o, J, ctx) => {   // frontal, sentado
    const J0 = ctx.J0, x = J0.q.x;
    S.ret(x - 20, J0.om.y - 14, 40, J0.q.y - J0.om.y + 18, 8, C.estofado, 'fundo');
    S.ret(x - 22, J0.q.y + 8, 44, 9, 4.5, C.estofado, 'fundo');
    S.ret(x - 4, J0.q.y + 17, 8, G - J0.q.y - 17, 2, C.metal, 'fundo');
    S.ret(x - 74, 8, 148, 7, 3.5, C.metal3, 'fundo');
    for (const s of [-1, 1]) S.ret(x + s * 70 - 4, 8, 8, G - 8, 3, C.metal3, 'fundo');
    S.ret(x - 80, G - 6, 160, 6, 3, C.metal2, 'fundo');
    for (const k of [1, 2]) {
      const m = J['m' + k];
      S.cap(V(m.x, 15), add(m, V(0, -4)), 3, C.metal2, 'fundo');
      almofada(S, m, V(0, 1), o.pad ? 26 : 12, 8, 'frente');
    }
  };
  MAQ.banco_romano = (S, o, J, ctx) => {
    const J0 = ctx.J0, q = J0.q, a = J0.t1;
    const u = norm(sub(q, a));
    S.cap(add(a, V(-6, 6)), add(q, mul(u, 6)), 7, C.metal, 'fundo');
    S.cap(add(q, V(4, 6)), V(q.x + 4, G - 3), 6, C.metal, 'fundo');
    S.ret(a.x - 16, G - 6, q.x - a.x + 34, 6, 3, C.metal2, 'fundo');
    almofada(S, add(q, add(mul(u, 4), mul(V(u.y, -u.x), -12))), u, 28, 10, 'frente');
    rolo(S, add(a, mul(V(u.y, -u.x), 9)), 'frente');
    S.oret(add(a, V(2, 6)), norm(V(1, -1)), 18, 5, 2, C.metal2, 'fundo');
  };
  MAQ.panturrilha_maquina = (S, o, J, ctx) => {
    const J0 = ctx.J0, x = J0.q.x - 34;
    S.ret(x - 6, 16, 12, G - 16, 4, C.metal3, 'fundo');
    S.ret(x - 12, G - 6, 90, 6, 3, C.metal2, 'fundo');
    S.ret(J0.t1.x - 12, (o.y ?? 158), 32, G - (o.y ?? 158), 3, C.metal, 'fundo');
    S.cap(V(x, J.om.y - 10), add(J.om, V(-2, -9)), 5, C.metal2, 'fundo');
    almofada(S, add(J.om, V(1, -8)), V(1, 0), 22, 9, 'frente');
  };
  MAQ.panturrilha_sentada = (S, o, J, ctx) => {
    const J0 = ctx.J0, q = J0.q;
    S.ret(q.x - 18, q.y + 9, 36, 9, 4.5, C.estofado, 'fundo');
    S.cap(V(q.x, q.y + 16), V(q.x, G - 3), 6, C.metal, 'fundo');
    S.ret(q.x - 24, G - 6, J0.t1.x - q.x + 50, 6, 3, C.metal2, 'fundo');
    S.ret(J0.t1.x - 4, (o.yp ?? 166), 26, G - (o.yp ?? 166), 3, C.metal, 'fundo');
    const k = add(J.j1, V(-5, -10));
    almofada(S, k, V(1, 0), 24, 9, 'frente');
    S.cap(add(k, V(10, 0)), V(J0.t1.x + 18, G - 3), 5, C.metal2, 'meio');
  };
  MAQ.scott = (S, o, J, ctx) => {
    const J0 = ctx.J0, a = J0.om, b = J0.co1, u = norm(sub(b, a)), n = V(u.y, -u.x);
    const c = add(mix(a, b, .62), mul(n, -7));
    almofada(S, c, u, 34, 10, 'frente');
    S.cap(add(c, mul(n, -5)), V(c.x + 6, G - 3), 6, C.metal, 'fundo');
    S.ret(J0.q.x - 18, J0.q.y + 9, 36, 9, 4.5, C.estofado, 'fundo');
    S.cap(V(J0.q.x, J0.q.y + 16), V(J0.q.x, G - 3), 6, C.metal, 'fundo');
    S.ret(J0.q.x - 24, G - 6, c.x - J0.q.x + 44, 6, 3, C.metal2, 'fundo');
  };
  MAQ.abdutora = (S, o, J, ctx) => {   // frontal, sentado
    const J0 = ctx.J0, x = J0.q.x;
    S.ret(x - 22, J0.om.y - 12, 44, J0.q.y - J0.om.y + 14, 8, C.estofado, 'fundo');
    S.ret(x - 30, J0.q.y + 8, 60, 9, 4.5, C.estofado, 'fundo');
    S.ret(x - 5, J0.q.y + 17, 10, G - J0.q.y - 17, 2, C.metal, 'fundo');
    S.ret(x - 50, G - 6, 100, 6, 3, C.metal2, 'fundo');
    for (const k of [1, 2]) {
      const sg = k === 1 ? 1 : -1, jo = J['j' + k];
      const c = add(jo, V(sg * (o.dentro ? -9 : 9), -2));
      almofada(S, c, V(0, 1), 22, 7, 'frente');
      S.cap(add(c, V(0, 10)), V(c.x, G - 4), 3.5, C.metal2, 'meio');
    }
    for (const k of [1, 2]) S.ret(J0['t' + k].x - 9, G - 9, 18, 4, 2, C.metal, 'meio');
  };
  MAQ.gluteo_maquina = (S, o, J, ctx) => {
    const J0 = ctx.J0, x = J0.om.x + 22;
    S.ret(x - 6, 30, 12, G - 30, 4, C.metal3, 'fundo');
    almofada(S, add(J0.om, V(14, 6)), V(0, 1), 30, 9, 'fundo');
    S.ret(J0.q.x - 30, G - 6, x - J0.q.x + 40, 6, 3, C.metal2, 'fundo');
    const piv = add(J0.q, V(0, 10));
    S.cap(V(piv.x, piv.y), V(piv.x + 6, G - 4), 6, C.metal, 'fundo');
    S.cap(V(x, 64), add(J0.om, V(18, 6)), 5, C.metal3, 'fundo');
    S.circ(piv, 5, C.metal2, 'meio');
    S.cap(piv, add(J.t1, V(0, -4)), 4, C.metal2, 'meio');
    almofada(S, add(J.t1, V(4, -6)), V(0, 1), 18, 8, 'frente');
  };
  MAQ.maquina_abdominal = (S, o, J, ctx) => {
    const J0 = ctx.J0, q = J0.q;
    S.ret(q.x - 16, q.y + 9, 36, 9, 4.5, C.estofado, 'fundo');
    almofada(S, Q(J0, 28, -14), J0.up, 50, 10, 'fundo');
    S.cap(V(q.x - 2, q.y + 16), V(q.x - 2, G - 3), 6, C.metal, 'fundo');
    const piv = Q(J0, 46, -18);
    S.cap(V(q.x - 26, 30), V(q.x - 26, G - 3), 7, C.metal3, 'fundo');
    S.cap(V(q.x - 26, 32), piv, 5, C.metal3, 'fundo');
    almofada(S, Q(J, 40, 14), J.up, 18, 8, 'frente');
    S.ret(q.x - 36, G - 6, 80, 6, 3, C.metal2, 'fundo');
  };
  MAQ.bicicleta = (S, o, J, ctx) => {
    const J0 = ctx.J0, cc = V(o.cx, o.cy);
    const sel = add(J0.q, V(-2, 10));
    S.cap(cc, sel, 6, C.azul, 'fundo');
    S.cap(cc, V(o.gx ?? cc.x + 40, o.gy ?? cc.y + 6), 6, C.azul, 'fundo');
    const gui = o.guidao ? V(o.guidao[0], o.guidao[1]) : add(J0.m1, V(2, 4));
    S.cap(V(o.gx ?? cc.x + 40, o.gy ?? cc.y + 6), gui, 6, C.azul, 'fundo');
    S.ret(sel.x - 12, sel.y - 2, 24, 7, 3.5, C.metal2, 'fundo');
    S.cap(add(gui, V(-6, 0)), add(gui, V(6, 0)), 5, C.metal2, 'fundo');
    S.circ(V(o.gx ?? cc.x + 40, o.gy ?? cc.y + 6), 16, C.metal3, 'fundo');
    S.circ(V(o.gx ?? cc.x + 40, o.gy ?? cc.y + 6), 7, C.metal, 'fundo');
    S.ret(Math.min(sel.x, cc.x) - 30, G - 6, 120, 6, 3, C.metal2, 'fundo');
    S.cap(V(cc.x - 26, G - 4), V(cc.x - 6, cc.y), 6, C.azul, 'fundo');
    S.circ(cc, 6, C.metal2, 'meio');
    for (const k of [2, 1]) {
      const pe = add(J['t' + k], V(4, 3));
      S.cap(cc, pe, 3.6, C.metal2, k === 1 ? 'perto' : 'meio');
    }
  };
  MAQ.eliptico = (S, o, J, ctx) => {
    const J0 = ctx.J0, fw = V(o.fx ?? 176, o.fy ?? 120);
    S.circ(fw, 18, C.metal3, 'fundo'); S.circ(fw, 7, C.metal, 'fundo');
    S.ret(20, G - 6, 180, 6, 3, C.metal2, 'fundo');
    S.cap(V(fw.x, fw.y + 10), V(fw.x, G - 4), 7, C.metal, 'fundo');
    const piv = V(fw.x - 8, o.py ?? 30);
    S.cap(piv, V(fw.x - 4, fw.y), 6, C.metal, 'fundo');
    for (const k of [2, 1]) {
      const pe = add(J['t' + k], V(2, 5));
      S.cap(pe, fw, 4, C.metal2, k === 1 ? 'perto' : 'meio');
      S.oret(add(pe, V(2, 1)), V(1, 0), 22, 5, 2.5, C.azul, k === 1 ? 'perto' : 'meio');
      S.cap(piv, J['m' + k], 4, C.metal2, k === 1 ? 'frente' : 'fundo');
    }
  };
  MAQ.remo = (S, o, J, ctx) => {
    const J0 = ctx.J0, y = o.y ?? 158;
    S.cap(V(30, y + 6), V(176, y + 6), 6, C.metal, 'fundo');
    S.cap(V(36, y + 8), V(36, G - 3), 6, C.metal2, 'fundo');
    S.cap(V(178, y + 4), V(178, G - 3), 6, C.metal2, 'fundo');
    S.circ(V(186, y - 14), 20, C.metal3, 'fundo'); S.circ(V(186, y - 14), 8, C.turq, 'fundo');
    const pe = mix(J0.t1, J0.t2, .5);
    S.oret(add(pe, V(7, 0)), norm(V(.4, -1)), 26, 6, 3, C.metal2, 'fundo');
    S.ret(J.q.x - 14, y - 2, 28, 7, 3.5, C.estofado, 'fundo');
    S.cap(V(176, y - 18), J.m1, 1.8, C.metal2, 'meio');
    S.cap(add(J.m1, V(0, -5)), add(J.m1, V(0, 5)), 3.6, C.metal2, 'frente');
  };
  MAQ.treno = (S, o, J, ctx) => {
    const m = J.m1, base = o.base ?? G - 10, x = m.x + (o.dx ?? 6);
    S.ret(x - 6, base - 4, 52, 12, 4, C.metal2, 'meio');
    S.cap(V(x - 10, G - 2), V(x + 50, G - 2), 3, C.metal, 'meio');
    placa(S, V(x + 26, base - 12), 11, C.roxo, C.roxo2, 'meio');
    if (!o.semPostes) { S.cap(add(m, V(2, 0)), V(x, base), 5, C.metal, 'meio'); }
  };
  MAQ.treno_corda = (S, o, J, ctx) => {
    const x = o.x ?? 190, sx = x;
    S.ret(sx - 4, G - 16, 44, 12, 4, C.metal2, 'fundo');
    placa(S, V(sx + 18, G - 24), 10, C.roxo, C.roxo2, 'fundo');
    S.curva(J.m1, mix(J.m1, V(sx, G - 10), .4), add(mix(J.m1, V(sx, G - 10), .7), V(0, 8)), V(sx, G - 10), 3, C.madeira2, 'meio');
  };
  MAQ.pneu_chao = (S, o) => {
    const x = o.x ?? 150, w = o.w ?? 60;
    S.ret(x - w / 2, G - 18, w, 18, 8, C.pneu, 'fundo');
    S.ret(x - w / 2 + 8, G - 15, w - 16, 5, 2.5, C.pneu2, 'fundo');
  };
  MAQ.pneu_virando = (S, o, J) => {   // pneu girando no pe de apoio, preso nas maos
    const piv = V(o.px ?? 196, G), m = mix(J.m1, J.m2 || J.m1, .5), u = norm(sub(m, piv));
    const L = dist(m, piv) + 6, c = add(piv, mul(u, L / 2));
    S.oret(c, u, L, 22, 9, C.pneu, 'meio');
    S.oret(c, u, L - 16, 8, 3, C.pneu2, 'meio');
  };
  MAQ.marreta = (S, o, J) => {
    const m = J.m1, u = dir(J.fa1), cab = add(m, mul(u, 34));
    S.cap(sub(m, mul(u, 6)), cab, 3.4, C.madeira2, 'frente');
    S.oret(cab, perp(u), 16, 9, 2.5, C.metal2, 'frente');
  };
  MAQ.graviton = (S, o, J, ctx) => {
    const J0 = ctx.J0;
    S.ret(J0.t1.x - 30, J.t1.y + 8, 40, 8, 4, C.estofado, 'meio');
    S.cap(V(J0.t1.x - 34, J.t1.y + 14), V(J0.t1.x - 34, G - 3), 5, C.metal, 'fundo');
  };
  MAQ.mesa = (S, o) => {
    const x0 = o.x0 ?? 50, x1 = o.x1 ?? 130, y = o.y ?? 100;
    S.ret(x0, y - 6, x1 - x0, 8, 3, C.madeira, 'fundo');
    for (const x of [x0 + 6, x1 - 6]) S.cap(V(x, y), V(x, G - 2), 5, C.madeira2, 'fundo');
  };
  MAQ.cadeira_capitao = (S, o, J, ctx) => {
    const J0 = ctx.J0, co = J0.co1;
    S.oret(add(co, V(8, 7)), V(1, 0), 30, 7, 3.5, C.estofado, 'meio');
    almofada(S, add(J0.q, V(-15, -22)), V(0, 1), 70, 9, 'fundo');
    S.cap(V(co.x + 18, co.y + 10), V(co.x + 18, G - 3), 6, C.metal, 'fundo');
    S.cap(V(J0.q.x - 22, 20), V(J0.q.x - 22, G - 3), 6, C.metal, 'fundo');
    S.ret(J0.q.x - 34, G - 6, co.x - J0.q.x + 64, 6, 3, C.metal2, 'fundo');
  };
  MAQ.desenv_frente = (S, o, J, ctx) => {  // banco com encosto visto de frente
    const J0 = ctx.J0, x = J0.q.x;
    S.ret(x - 20, J0.om.y - 16, 40, J0.q.y - J0.om.y + 18, 8, C.estofado, 'fundo');
    S.ret(x - 26, J0.q.y + 8, 52, 9, 4.5, C.estofado, 'fundo');
    S.ret(x - 4, J0.q.y + 17, 8, G - J0.q.y - 17, 2, C.metal, 'fundo');
    S.ret(x - 30, G - 6, 60, 6, 3, C.metal2, 'fundo');
  };
  MAQ.parede_fundo = (S, o) => {           // painel de parede atras (vista frontal)
    S.ret(o.x0 ?? 40, o.y0 ?? 0, (o.x1 ?? 160) - (o.x0 ?? 40), G - (o.y0 ?? 0), 6, C.parede, 'fundo');
  };
  MAQ.roda = (S, o, J) => {
    const c = add(J.vista === 'frente' ? mix(J.m1, J.m2, .5) : J.m1, V(0, 1));
    S.circ(c, 9, C.coral, 'frente'); S.circ(c, 4, C.coral2, 'frente');
    S.cap(add(c, V(-9, 0)), add(c, V(9, 0)), 3, C.metal2, 'frente');
  };
  MAQ.bola_pes = (S, o, J) => {           // bola suica rolando sob os pes/canelas
    const r = o.r ?? 24, c = V(J.t1.x + (o.dx ?? 2), G - r);
    CENA.bola_suica(S, { x: c.x, y: c.y, r, cam: 'fundo' });
  };
  MAQ.rolo_sob = (S, o, J) => {           // foam roller sob uma junta (rola junto)
    const p = J[o.j || 'q'], c = V(p.x + (o.dx ?? 0), G - 8);
    CENA.foam_roller(S, { x: c.x, y: c.y, cam: 'fundo' });
  };
  MAQ.bola_parede = (S, o, J, ctx) => {    // bola arremessada contra a parede
    const fs = ctx.fase, alto = o.alto ?? 30;
    const c = mix(J.m1, V(o.x ?? 190, alto), Math.max(0, Math.sin(fs * Math.PI * 2)) * (o.k ?? 0.8));
    S.circ(c, 10, C.verde, 'frente');
  };
  MAQ.cones_frente = (S, o) => CENA.cones(S, o);
  Object.assign(CENA, MAQ);

  // ---------------------------------------------------------------- pegadas (bracos por implemento)
  const PG = {   // lateral
    costas: { M: [{ t: [47, -12] }], sM: [1] },
    rack: { M: [{ t: [44, 14] }], sM: [1] },
    goblet: { M: [{ t: [32, 17] }], sM: [-1] },
    peito: { M: [{ t: [38, 15] }], sM: [-1] },
    lado: { B: [[-3, 0]] },
    frente: { B: [[86, 88]] },
    cima: { B: [[172, 176]] },
    cintura: { M: [{ t: [6, 10] }], sM: [-1] },
    cruzado: { M: [{ t: [34, 13] }], sM: [-1] },
  };
  const PGF = {  // frontal
    costas: { M: [{ t: [46, 26] }], sM: [1] },
    rack: { M: [{ t: [40, 8] }], sM: [1] },
    goblet: { M: [{ t: [30, 4] }], sM: [1] },
    peito: { M: [{ t: [34, 5] }], sM: [1] },
    lado: { B: [[6, 3]] },
    baixo: { M: [{ t: [-18, 4] }], sM: [1] },
    frente: { B: [[20, 20]] },
    cima: { B: [[165, 170]] },
    cintura: { M: [{ t: [4, 15] }], sM: [1] },
  };
  const GRUPO = { barra: 'barra', barra_ez: 'barra', smith: 'barra', bastao: 'barra', halteres: 'halteres', halter: 'halter',
    kettlebell: 'kb', kettlebells: 'kb', medicine_ball: 'bola', anilha: 'bola', saco_areia: 'bola', mochila: 'mochila',
    elastico: 'cabo', polia: 'cabo', crossover: 'cabo', toalha: 'cabo', trx: 'trx', landmine: 'kb', raquete: 'raquete', hand_grip: 'halter' };
  function pegaDe(tpl, p, vista) {
    const pg = tpl.pg; if (!pg) return null;
    let e;
    if (p) {
      const g = GRUPO[p] || p;
      e = pg[p] ?? pg[g];
      if (e === undefined && g === 'halter') e = pg.kb ?? pg.halteres;
      if (e === undefined && (g === 'kb' || g === 'bola')) e = pg.halter ?? pg.kb ?? pg.bola;
      if (e === undefined && g === 'halteres') e = pg.halter;
      if (e === undefined && g === 'trx') e = pg.cabo;
    }
    if (e === undefined) e = pg._;
    if (e == null) return null;
    if (typeof e === 'string') return { nome: e, spec: (vista === 'frente' ? PGF : PG)[e] };
    return { nome: e.nome || 'custom', spec: e };
  }

  // ---------------------------------------------------------------- ajudantes de autoria
  const EP = o => Object.assign({ q: [100, 104], t: 2, P: [[103, TZ], [97, TZ]] }, o);   // em pe
  // corpo reto apoiado no tornozelo A ate o ombro S (IK quadril). s=1 quadril "para cima/frente"
  function linha(A, S, s, extra) {
    const r = ik(V(A[0], A[1]), V(S[0], S[1]), D.coxa + D.perna - .5, D.tronco, s ?? 1);
    const q = r.meio, sh = r.fim;
    return Object.assign({ q: [q.x, q.y], t: Math.atan2(sh.x - q.x, -(sh.y - q.y)) / R, P: [[A[0], A[1]]] }, extra);
  }
  // quadril q e ombro S -> {q,t}
  function tronco(q, S, extra) { return Object.assign({ q, t: Math.atan2(S[0] - q[0], -(S[1] - q[1])) / R }, extra); }
  // ombro fixo S e angulo t -> {q,t}
  function porOmbro(S, t, extra) { const u = dir(180 - t); return Object.assign({ q: [S[0] - u.x * D.tronco, S[1] - u.y * D.tronco], t }, extra); }
  const deitado = (qx, yApoio, extra) => Object.assign({ q: [qx, yApoio - 13], t: -90 }, extra);   // de costas, cabeca a esquerda

  // ---------------------------------------------------------------- TEMPLATES
  // campos: n (nome), v ('lado'|'frente'), k (quadros), dur (s), lin (sem suavizar), pausa, cena, pg (pegadas),
  //         cabo (ancora do cabo/elastico), uni, goblet, kbBalanco, tapete, extra(S,J,ctx)
  function T(id, n, def) { def.n = n; TPL[id] = def; NOMES_TPL[id] = n; }

  // ===== PERNAS
  const pgAgach = { barra: 'costas', halteres: 'lado', kb: 'goblet', bola: 'goblet', mochila: 'frente', cabo: 'peito', trx: { B: [[72, 80]] }, landmine: 'goblet', _: 'frente' };
  T('agachamento', 'Agachamento', { k: [EP({ t: 4 }), EP({ q: [80, 140], t: 40 })], pg: pgAgach, cabo: 'pe', dur: 2.6 });
  T('agachamento_frontal', 'Agachamento frontal', { k: [EP({ t: 3 }), EP({ q: [86, 142], t: 22 })], pg: { barra: 'rack', kb: 'rack', halteres: 'rack', _: 'rack' }, duplo: true, dur: 2.6 });
  T('agachamento_overhead', 'Agachamento overhead', { k: [EP({ t: 2 }), EP({ q: [84, 142], t: 24 })], pg: { _: { B: [[168, 172]] } }, dur: 2.8 });
  T('agachamento_sumo', 'Agachamento sumô', { v: 'frente', k: [{ q: [100, 106], P: [[126, TZ]] }, { q: [100, 138], P: [[126, TZ]] }],
    pg: { kb: 'baixo', halter: 'baixo', halteres: 'baixo', bola: 'goblet', barra: 'costas', landmine: 'goblet', _: { M: [{ t: [30, 4] }], sM: [1] } }, goblet: true, dur: 2.6 });
  T('agachamento_isometrico', 'Agachamento isométrico', { k: [EP({ q: [84, 136], t: 34 }), EP({ q: [84, 133], t: 33 })], pg: pgAgach, dur: 3 });
  T('agachamento_profundo', 'Agachamento profundo (mobilidade)', { k: [EP({ q: [92, 154], t: 22, M: [{ t: [34, 18] }] }), EP({ q: [92, 152], t: 18, M: [{ t: [36, 18] }] })], pg: { kb: 'goblet' }, dur: 3.4 });
  T('agachamento_rotacao', 'Agachamento profundo com rotação', { k: [EP({ q: [92, 154], t: 24, M: [{ t: [36, 18] }] }), EP({ q: [92, 154], t: 24, B: [[180, 180], [40, 20]], h: -20 })], dur: 3.2 });
  T('agachamento_salto', 'Agachamento com salto', { k: [EP({ q: [82, 136], t: 36, B: [[-40, -30]] }), EP({ q: [100, 84], t: 2, P: [[103, 158], [97, 158]], f: [40, 40], B: [[160, 165]] })], pg: { halteres: 'lado' }, dur: 1.4 });
  T('agachamento_pulso', 'Agachamento com pulsos', { k: [EP({ q: [80, 140], t: 40, B: [[86, 88]] }), EP({ q: [82, 132], t: 36, B: [[86, 88]] })], dur: 0.9 });
  T('agachamento_parede', 'Agachamento na parede', {
    k: [{ q: [74, 136], t: 0, P: [[114, TZ], [110, TZ]], M: [{ j: 'j1', d: [-4, -9] }] }, { q: [74, 133], t: 0, P: [[114, TZ], [110, TZ]], M: [{ j: 'j1', d: [-4, -9] }] }],
    cena: [['parede', { x: 60, lado: -1 }]], dur: 3 });
  T('agachamento_bola_parede', 'Agachamento com bola na parede', {
    k: [{ q: [86, 106], t: 0, P: [[104, TZ], [100, TZ]], M: [{ t: [30, 14] }] }, { q: [84, 140], t: 0, P: [[110, TZ], [106, TZ]], M: [{ t: [30, 14] }] }],
    extra: (S, J) => { CENA.parede(S, { x: 46, lado: -1 }); CENA.bola_suica(S, { x: J.q.x - 30, y: J.q.y - 22, r: 18, cam: 'fundo' }); }, dur: 2.8 });
  T('sissy', 'Sissy squat', { k: [EP({ t: 0, B: [[80, 84]] }), { q: [86, 128], t: -32, P: [[103, TZ - 4], [97, TZ - 4]], f: [55, 55], B: [[80, 84]] }], dur: 2.6 });
  T('pistol', 'Agachamento unilateral (pistol)', { k: [{ q: [100, 104], t: 2, P: [[103, TZ]], C: [null, [40, 10]], B: [[80, 84]] }, { q: [82, 148], t: 34, P: [[103, TZ]], C: [null, [88, 88]], B: [[88, 90]] }], dur: 2.8 });
  T('pistol_apoio', 'Agachamento unilateral com apoio', { k: [{ q: [96, 104], t: 2, P: [[99, TZ]], C: [null, [40, 10]], M: [[146, 96]] }, { q: [80, 146], t: 32, P: [[99, TZ]], C: [null, [80, 80]], M: [[146, 104]] }],
    cena: [['cadeira', { id: 'apoio', x: 158, y: 136, costas: -1 }]], dur: 2.8 });
  T('shrimp', 'Agachamento camarão', { k: [{ q: [100, 104], t: 2, P: [[103, TZ]], C: [null, [-20, -120]], B: [[80, 84]] }, { q: [84, 146], t: 34, P: [[103, TZ]], C: [null, [-10, -95]], B: [[88, 90]] }], dur: 2.8 });
  T('afundo', 'Afundo (avanço)', { k: [{ q: [100, 108], t: 2, P: [[120, TZ], [78, 170]], f: [null, 52] }, { q: [98, 140], t: 2, P: [[122, TZ], [70, 168]], f: [null, 45] }],
    pg: { barra: 'costas', halteres: 'lado', kb: 'goblet', bola: 'goblet', mochila: 'cintura', cabo: 'peito', _: 'cintura' }, cabo: 'pe', dur: 2.6 });
  T('afundo_reverso', 'Afundo reverso', { k: [EP({ t: 2, P: [[104, TZ], [100, TZ]] }), { q: [100, 140], t: 4, P: [[124, TZ], [72, 168]], f: [null, 45] }],
    pg: { barra: 'costas', halteres: 'lado', kb: 'goblet', bola: 'goblet', mochila: 'cintura', cabo: 'peito', trx: { B: [[60, 80]] }, _: 'cintura' }, cabo: [176, 150], dur: 2.6 });
  T('afundo_caminhando', 'Passada (afundo caminhando)', {
    k: [{ q: [92, 140], t: 4, P: [[116, TZ], [64, 168]], f: [null, 45] }, { q: [120, 108], t: 2, P: [[124, TZ], [118, 150]], C: [null, null] }, { q: [138, 140], t: 4, P: [[162, TZ], [110, 168]], f: [null, 45] }],
    pg: { barra: 'costas', halteres: 'lado', kb: 'goblet', bola: 'goblet', _: 'cintura' }, dur: 3 });
  T('afundo_salto', 'Afundo com salto', { k: [{ q: [98, 140], t: 2, P: [[122, TZ], [70, 168]], f: [null, 45], B: [[30, 80], [-30, 20]] }, { q: [100, 96], t: 2, P: [[110, 162], [88, 160]], f: [50, 45], B: [[-30, 20], [30, 80]] }, { q: [100, 140], t: 2, P: [[76, 168], [124, TZ]], f: [45, null], B: [[-30, 20], [30, 80]] }, { q: [100, 96], t: 2, P: [[110, 162], [88, 160]], f: [50, 45] }], dur: 1.6 });
  T('bulgaro', 'Agachamento búlgaro', {
    k: [{ q: [104, 106], t: 4, P: [[124, TZ], [60, 128]], f: [null, -100] }, { q: [96, 140], t: 12, P: [[124, TZ], [60, 128]], f: [null, -100] }],
    cena: [['banco', { id: 'apoio', x0: 14, x1: 74, y: 134, x: 46 }]], pg: { barra: 'costas', halteres: 'lado', kb: 'goblet', bola: 'goblet', mochila: 'cintura', cabo: 'peito', _: 'cintura' }, cabo: 'pe', dur: 2.8 });
  T('afundo_lateral', 'Afundo lateral', { v: 'frente', k: [{ q: [100, 106], P: [[122, TZ], [78, TZ]] }, { q: [80, 134], t: -4, P: [[136, TZ], [70, TZ]] }],
    pg: { kb: 'goblet', halter: 'goblet', halteres: 'lado', bola: 'goblet', barra: 'costas', landmine: 'goblet', trx: { B: [[30, 20]] }, _: { M: [{ t: [30, 4] }], sM: [1] } }, goblet: true, dur: 2.8 });
  T('afundo_cruzado', 'Afundo cruzado (curtsy)', { v: 'frente', k: [{ q: [100, 106], P: [[110, TZ], [90, TZ]] }, { q: [104, 134], P: [[114, TZ], [128, 168]] }],
    pg: { halteres: 'lado', kb: 'goblet', _: 'cintura' }, dur: 2.6 });
  T('step_up', 'Subida no step/banco', {
    k: [{ q: [94, 106], t: 6, P: [[126, 146], [90, TZ]] }, { q: [124, 74], t: 2, P: [[128, 146], [120, 146]] }],
    cena: [['degrau', { id: 'apoio', x0: 112, x1: 168, y: 150 }]], pg: { barra: 'costas', halteres: 'lado', kb: 'goblet', bola: 'goblet', mochila: 'cintura', _: { B: [[20, 40], [-20, 10]] } }, dur: 2.6 });
  T('step_up_joelho', 'Subida no step com joelho alto', {
    k: [{ q: [94, 106], t: 6, P: [[126, 146], [90, TZ]], B: [[-30, 10], [30, 80]] }, { q: [126, 74], t: 2, P: [[128, 146]], C: [null, [80, 0]], B: [[40, 100], [-30, 10]] }],
    cena: [['degrau', { id: 'apoio', x0: 112, x1: 168, y: 150 }]], dur: 1.8 });
  T('step_lateral', 'Subida lateral no step', { v: 'frente', k: [{ q: [96, 104], P: [[124, 148], [92, TZ]] }, { q: [124, 72], P: [[130, 148], [118, 148]] }],
    cena: [['degrau', { id: 'apoio', x0: 108, x1: 164, y: 152 }]], pg: { halteres: 'lado', kb: 'goblet', _: 'cintura' }, dur: 2.6 });
  T('step_down', 'Descida excêntrica do degrau', { k: [{ q: [112, 76], t: 2, P: [[116, 146]], C: [null, [16, 6]] }, { q: [100, 98], t: 14, P: [[116, 146]], C: [null, [16, 4]], B: [[70, 80]] }],
    cena: [['degrau', { id: 'apoio', x0: 100, x1: 150, y: 150 }]], dur: 2.8 });
  T('leg_press', 'Leg press', {
    k: [{ q: [70, 140], t: -58, P: [[115, 95]], f: [225], M: [{ t: [6, 8] }] }, { q: [70, 140], t: -58, P: [[98, 112]], f: [225], M: [{ t: [6, 8] }] }],
    cena: [['leg_press', {}]], dur: 2.8 });
  T('hack', 'Hack squat', { k: [{ q: [104, 104], t: -14, P: [[118, TZ - 6]], f: [100], M: [{ o: [8, -6] }] }, { q: [86, 140], t: -14, P: [[118, TZ - 6]], f: [100], M: [{ o: [8, -6] }] }],
    cena: [['hack', {}]], extra: (S, J, ctx) => {}, dur: 2.8 });
  T('agachamento_maquina_deitado', 'Agachamento na máquina reclinada', { k: [{ q: [80, 140], t: -60, P: [[146, 124]], f: [190], M: [{ t: [6, 8] }] }, { q: [92, 132], t: -60, P: [[146, 124]], f: [190], M: [{ t: [6, 8] }] }],
    extra: (S, J, ctx) => { almofada(S, Q(J, 24, -14), J.up, 56, 10, 'fundo'); S.cap(V(40, 170), V(150, 110), 6, C.metal, 'fundo'); S.oret(V(152, 128), norm(V(1, .3)), 40, 7, 3, C.estofado, 'fundo'); }, dur: 2.8 });
  T('extensora', 'Cadeira extensora', { k: [{ q: [92, 122], t: -8, C: [[90, 2]], M: [{ t: [2, 10] }] }, { q: [92, 122], t: -8, C: [[90, 84]], M: [{ t: [2, 10] }] }], cena: [['extensora', {}]], dur: 2.6 });
  T('extensao_joelho_sentado', 'Extensão de joelho sentado', { k: [{ q: [90, 124], t: -4, C: [[90, 2], [90, 2]], M: [{ t: [2, 12] }] }, { q: [90, 124], t: -4, C: [[90, 84], [90, 2]], M: [{ t: [2, 12] }] }],
    cena: [['cadeira', { id: 'apoio', x: 96, y: 136, costas: -1 }]], cabo: { j: 't2', d: [0, 4] }, caboEm: 't1', dur: 2.6 });
  T('flexora_deitado', 'Mesa flexora', { k: [{ q: [80, 121], t: 92, h: -10, C: [[-92, -90]], M: [[150, 140]] }, { q: [80, 121], t: 92, h: -10, C: [[-92, -168]], M: [[150, 140]] }], cena: [['flexora', { y: 133, x0: 24, x1: 158 }]], dur: 2.6 });
  T('flexora_sentado', 'Cadeira flexora', { k: [{ q: [92, 122], t: -8, C: [[90, 82]], M: [{ t: [2, 10] }] }, { q: [92, 122], t: -8, C: [[90, -8]], M: [{ t: [2, 10] }] }], cena: [['flexora_sentada', {}]], dur: 2.6 });
  T('flexora_em_pe', 'Flexora em pé', { k: [{ q: [96, 104], t: 10, P: [[100, TZ], [96, TZ]], M: [[146, 100]] }, { q: [96, 104], t: 10, C: [[-6, -110]], P: [null, [96, TZ]], M: [[146, 100]] }],
    cena: [['parede', { id: 'apoio', x: 150, lado: 1 }]], cabo: [150, 170], caboEm: 't1', dur: 2.4 });
  T('flexora_bola', 'Flexora deitado com os pés na bola', { k: [porOmbro([58, 168], -100, { P: [[156, 150]], M: [[96, 176]], sM: [1] }), porOmbro([58, 168], -116, { P: [[128, 148]], M: [[96, 176]], sM: [1] })],
    extra: (S, J) => CENA.bola_suica(S, { x: J.t1.x + 8, y: G - 22, r: 22, cam: 'fundo' }), tapete: true, dur: 2.6 });
  T('flexora_deslizante', 'Flexora deslizante', { k: [porOmbro([58, 168], -96, { P: [[168, TZ]], M: [[96, 176]], sM: [1] }), porOmbro([58, 168], -114, { P: [[130, TZ]], M: [[96, 176]], sM: [1] })], desliza: 1, tapete: true, dur: 2.6 });
  T('stiff', 'Stiff / levantamento romeno', { k: [EP({ t: 2 }), EP({ q: [72, 114], t: 78, P: [[103, TZ], [97, TZ]] })],
    pg: { barra: { B: [[0, 0]] }, halteres: { B: [[0, 0]] }, kb: { B: [[0, 0]] }, bola: { B: [[0, 0]] }, mochila: 'costas', cabo: { B: [[0, 0]] }, landmine: { B: [[0, 0]] }, _: { B: [[0, 0]] } }, cabo: [170, 172], dur: 2.8 });
  T('stiff_unilateral', 'Stiff unilateral', { k: [{ q: [100, 104], t: 2, P: [[103, TZ]], C: [null, [-4, -8]], B: [[0, 0]] }, { q: [88, 106], t: 82, P: [[103, TZ]], C: [null, [-82, -86]], B: [[0, 0]] }],
    pg: { _: { B: [[0, 0]] }, mochila: 'costas' }, uni: true, dur: 2.8 });
  T('terra', 'Levantamento terra', { k: [{ q: [72, 132], t: 56, P: [[103, TZ], [97, TZ]], M: [[110, 162]], pausa: 1 }, EP({ t: 0, M: [[104, 114]] })],
    pg: null, placa: 17, cabo: [190, 172], dur: 2.8 });
  T('terra_sumo', 'Levantamento terra sumô', { v: 'frente', k: [{ q: [100, 140], P: [[130, TZ]], M: [[108, 162]], sM: [1] }, { q: [100, 106], P: [[130, TZ]], M: [[108, 118]], sM: [1] }], dur: 2.8 });
  T('bom_dia', 'Bom dia (good morning)', { k: [EP({ t: 2 }), EP({ q: [76, 110], t: 82 })], pg: { barra: 'costas', mochila: 'costas', kb: 'goblet', cabo: 'peito', _: 'costas' }, cabo: 'pe', dur: 2.8 });
  T('bom_dia_sentado', 'Bom dia sentado', { k: [{ q: [96, 128], t: 0, C: [[90, 0]] }, { q: [96, 128], t: 70, C: [[90, 0]] }], pg: { _: 'costas' }, cena: [['banco', { x0: 70, x1: 124, y: 140 }]], dur: 2.8 });
  T('hip_thrust', 'Elevação pélvica (hip thrust)', {
    k: [porOmbro([66, 126], -40, { P: [[130, TZ]], h: 20 }), porOmbro([66, 126], -96, { P: [[130, TZ]], h: 40 })],
    cena: [['banco', { id: 'apoio', x0: 16, x1: 70, y: 134 }]], pg: { barra: { M: [{ t: [-2, 18] }], sM: [-1] }, smith: { M: [{ t: [-2, 18] }], sM: [-1] }, halteres: { M: [{ t: [0, 16] }] }, kb: { M: [{ t: [0, 16] }] }, mochila: { M: [{ t: [0, 16] }] }, landmine: { M: [{ t: [0, 16] }] }, cabo: { M: [{ t: [0, 16] }] }, _: { M: [[56, 140]], sM: [1] } },
    placa: 15, cabo: [190, 172], lm: [14, 177], dur: 2.6 });
  T('ponte', 'Ponte de glúteo', { k: [porOmbro([58, 168], -88, { P: [[128, TZ]], M: [[96, 176]], sM: [1] }), porOmbro([58, 168], -116, { P: [[128, TZ]], M: [[96, 176]], sM: [1] })],
    pg: { barra: { M: [{ t: [-2, 18] }] }, halteres: { M: [{ t: [0, 16] }] }, kb: { M: [{ t: [0, 16] }] }, bola: { M: [{ t: [0, 16] }] }, mochila: { M: [{ t: [0, 16] }] } }, tapete: true, dur: 2.4 });
  T('ponte_unilateral', 'Ponte unilateral', { k: [porOmbro([58, 168], -88, { P: [[128, TZ]], C: [null, [130, 120]], M: [[96, 176]], sM: [1] }), porOmbro([58, 168], -116, { P: [[128, TZ]], C: [null, [115, 115]], M: [[96, 176]], sM: [1] })], tapete: true, dur: 2.4 });
  T('ponte_pes_elevados', 'Ponte com pés elevados', { k: [porOmbro([58, 168], -86, { P: [[124, 136]], f: [170], M: [[96, 176]], sM: [1] }), porOmbro([58, 168], -108, { P: [[124, 136]], f: [170], M: [[96, 176]], sM: [1] })],
    cena: [['cadeira', { id: 'apoio', x: 138, y: 140, costas: 1 }]], tapete: true, dur: 2.4 });
  T('ponte_bola_ombros', 'Ponte com ombros na bola', { k: [porOmbro([66, 128], -40, { P: [[130, TZ]], M: [{ t: [40, 12] }] }), porOmbro([66, 128], -94, { P: [[130, TZ]], M: [{ t: [40, 12] }] })],
    cena: [['bola_suica', { id: 'apoio', x: 52, r: 26 }]], dur: 2.6 });
  T('coice', 'Coice em 4 apoios', {
    k: [{ q: [78, 136], t: 72, h: 10, C: [[0, -90], [3, -90]], M: [[123, TZ]] }, { q: [78, 136], t: 72, h: 0, C: [[-100, 178], [3, -90]], M: [[123, TZ]] }],
    tapete: true, cabo: [24, 170], caboEm: 't1', band: 'joelho', dur: 2.2 });
  T('coice_estendido', 'Extensão de quadril em 4 apoios', {
    k: [{ q: [78, 136], t: 72, h: 10, C: [[0, -90], [3, -90]], M: [[123, TZ]] }, { q: [78, 136], t: 72, C: [[-96, -92], [3, -90]], M: [[123, TZ]] }], tapete: true, cabo: [24, 170], caboEm: 't1', dur: 2.2 });
  T('coice_em_pe', 'Coice em pé', { k: [{ q: [100, 104], t: 18, P: [[103, TZ], [100, TZ]], M: [[150, 92]] }, { q: [100, 104], t: 22, C: [[-42, -34]], P: [null, [100, TZ]], M: [[150, 92]] }],
    cena: [['parede', { id: 'apoio', x: 156, lado: 1 }]], cabo: [168, 172], caboEm: 't1', dur: 2.2 });
  T('coice_maquina', 'Glúteo na máquina (coice)', { k: [{ q: [96, 104], t: 24, P: [[100, TZ], [96, TZ]], M: [[140, 76]] }, { q: [96, 104], t: 26, C: [[-44, -30]], P: [null, [96, TZ]], M: [[140, 76]] }],
    cena: [['gluteo_maquina', {}]], dur: 2.2 });
  T('abducao_em_pe', 'Abdução de quadril em pé', { v: 'frente', k: [{ q: [100, 104], C: [[3, 0], [2, 0]] }, { q: [98, 104], t: -4, C: [[40, 40], [2, 0]] }],
    pg: { _: 'cintura' }, cabo: [36, 172], caboEm: 't1', band: 'tornozelo', dur: 2.2 });
  T('aducao_em_pe', 'Adução de quadril em pé', { v: 'frente', k: [{ q: [100, 104], C: [[32, 32], [2, 0]] }, { q: [100, 104], C: [[-12, -12], [2, 0]] }], pg: { _: 'cintura' }, cabo: [172, 172], caboEm: 't1', dur: 2.2 });
  T('abducao_deitado', 'Abdução deitado de lado', { v: 'frente', k: [{ q: [100, 163], t: 90, P: [[28, 172], [30, 158]], M: [[170, 174], [128, 172]] }, { q: [100, 163], t: 90, P: [[28, 172], [40, 122]], M: [[170, 174], [128, 172]] }],
    tapete: true, band: 'tornozelo', dur: 2.2 });
  T('concha', 'Concha (clamshell)', { v: 'frente', k: [{ q: [100, 163], t: 90, P: [[54, 172], [56, 158]], cz: [.62], pz: [.6], M: [[170, 174], [128, 172]] }, { q: [100, 163], t: 90, P: [[54, 172], [62, 136]], cz: [.62], pz: [.6], M: [[170, 174], [128, 172]] }],
    tapete: true, band: 'joelho', dur: 2.2 });
  T('aducao_deitado', 'Adução deitado de lado', { v: 'frente', k: [{ q: [100, 163], t: 90, P: [[28, 172], [62, 142]], cz: [1, .7], pz: [1, .7], M: [[170, 174], [128, 172]] }, { q: [100, 163], t: 90, P: [[28, 160], [62, 142]], cz: [1, .7], pz: [1, .7], M: [[170, 174], [128, 172]] }], tapete: true, dur: 2.2 });
  T('copenhagen', 'Prancha Copenhagen', { v: 'frente', k: [{ q: [100, 146], t: 74, P: [[40, 132], [38, 160]], B: [[0, 0], [10, 10]], zB: [1], za: [.3, 1] }, { q: [100, 138], t: 78, P: [[40, 132], [40, 132]], B: [[0, 0], [10, 10]], za: [.3, 1] }],
    extra: (S) => CENA.banco(S, { x0: 18, x1: 62, y: 136 }), tapete: true, dur: 2.6 });
  T('cadeira_abdutora', 'Cadeira abdutora', { v: 'frente', k: [{ q: [100, 122], C: [[12, 2]], cz: [.6], M: [{ t: [10, 18] }] }, { q: [100, 122], C: [[48, 10]], cz: [.6], M: [{ t: [10, 18] }] }], cena: [['abdutora', {}]], dur: 2.4 });
  T('cadeira_adutora', 'Cadeira adutora', { v: 'frente', k: [{ q: [100, 122], C: [[48, 10]], cz: [.6], M: [{ t: [10, 18] }] }, { q: [100, 122], C: [[12, 2]], cz: [.6], M: [{ t: [10, 18] }] }], cena: [['abdutora', { dentro: true }]], dur: 2.4 });
  T('abducao_sentado', 'Abdução sentado', { v: 'frente', k: [{ q: [100, 124], C: [[10, 2]], cz: [.55], M: [{ t: [6, 18] }] }, { q: [100, 124], C: [[42, 8]], cz: [.55], M: [{ t: [6, 18] }] }],
    extra: (S, J, ctx) => MAQ.desenv_frente(S, {}, J, ctx), band: 'joelho', dur: 2.2 });
  T('aducao_sentado', 'Adução isométrica sentado', { v: 'frente', k: [{ q: [100, 124], C: [[14, 2]], cz: [.55], M: [{ t: [6, 18] }] }, { q: [100, 124], C: [[10, 2]], cz: [.55], M: [{ t: [6, 18] }] }],
    extra: (S, J, ctx) => { MAQ.desenv_frente(S, {}, J, ctx); S.circ(mix(J.j1, J.j2, .5), 6, C.amarelo, 'frente'); }, dur: 2.2 });
  T('panturrilha_pe', 'Elevação de panturrilha em pé', { k: [{ q: [100, 88], t: 2, P: [[103, 154], [97, 154]], f: [112, 112] }, { q: [100, 76], t: 2, P: [[103, 142], [97, 142]], f: [52, 52] }],
    cena: [['degrau', { id: 'apoio', x0: 96, x1: 150, y: 160 }], ['parede', { x: 154, lado: 1 }]], pg: { barra: 'costas', halteres: 'lado', kb: 'lado', mochila: 'cintura', cabo: 'peito', _: { M: [[152, 92]] } }, cabo: 'pe', dur: 1.8 });
  T('panturrilha_chao', 'Elevação de panturrilha', { k: [EP({ t: 2 }), EP({ q: [100, 92], P: [[103, 164], [97, 164]], f: [48, 48] })], pg: { halteres: 'lado', kb: 'lado', mochila: 'cintura', _: { M: [[150, 96]] } }, cena: [['parede', { x: 154, lado: 1 }]], dur: 1.6 });
  T('panturrilha_maquina', 'Panturrilha na máquina em pé', { k: [{ q: [100, 88], t: 2, P: [[103, 154], [97, 154]], f: [112, 112], M: [{ o: [-4, -2] }] }, { q: [100, 76], t: 2, P: [[103, 142], [97, 142]], f: [52, 52], M: [{ o: [-4, -2] }] }],
    cena: [['panturrilha_maquina', { y: 160 }]], dur: 1.8 });
  T('panturrilha_sentado', 'Panturrilha sentado', { k: [{ q: [80, 128], t: 0, P: [[118, 160]], f: [104], M: [{ j: 'j1', d: [-6, -10] }] }, { q: [80, 128], t: 0, P: [[118, 152]], f: [55], M: [{ j: 'j1', d: [-6, -10] }] }],
    cena: [['panturrilha_sentada', {}]], pg: { halteres: { M: [{ j: 'j1', d: [0, -10] }] }, kb: { M: [{ j: 'j1', d: [0, -10] }] }, mochila: { M: [{ j: 'j1', d: [0, -10] }] } }, dur: 1.8 });
  T('panturrilha_leg_press', 'Panturrilha no leg press', { k: [{ q: [70, 140], t: -58, P: [[116, 94]], f: [235], M: [{ t: [6, 8] }] }, { q: [70, 140], t: -58, P: [[118, 92]], f: [195], M: [{ t: [6, 8] }] }], cena: [['leg_press', {}]], dur: 1.8 });
  T('tibial', 'Elevação de ponta de pé (tibial)', { k: [{ q: [80, 104], t: -6, P: [[112, TZ], [108, TZ]], f: [90, 90] }, { q: [80, 104], t: -6, P: [[112, TZ], [108, TZ]], f: [128, 128] }],
    cena: [['parede', { id: 'apoio', x: 64, lado: -1 }]], dur: 1.6 });
  T('tibial_sentado', 'Dorsiflexão sentado', { k: [{ q: [80, 128], t: 0, P: [[118, 168]], f: [80], M: [{ j: 'j1', d: [-6, -10] }] }, { q: [80, 128], t: 0, P: [[118, 168]], f: [132], M: [{ j: 'j1', d: [-6, -10] }] }],
    cena: [['cadeira', { id: 'apoio', x: 82, y: 140, costas: -1 }]], cabo: [170, 170], caboEm: 'd1', dur: 1.8 });
  T('tornozelo', 'Mobilidade de tornozelo', { k: [{ q: [96, 126], t: 0, P: [[118, 168]], f: [70], M: [{ j: 'j1', d: [-6, -10] }] }, { q: [96, 126], t: 0, P: [[118, 168]], f: [130], M: [{ j: 'j1', d: [-6, -10] }] }],
    cena: [['cadeira', { id: 'apoio', x: 96, y: 138, costas: -1 }]], dur: 2 });
  T('nordico', 'Nórdico', { k: [{ q: [90, 136], t: 0, C: [[0, -90]], M: [{ t: [30, 20] }] }, { q: [117.6, 148.9], t: 50, C: [[-50, -90]], M: [{ t: [36, 24] }] }],
    extra: (S, J) => rolo(S, add(J.t1, V(2, -9)), 'frente'), tapete: true, dur: 3 });
  T('extensao_lombar', 'Extensão lombar no banco romano', { k: [{ q: [100, 120], t: 140, P: [[52, 168]], M: [{ t: [38, 14] }] }, { q: [100, 120], t: 48, P: [[52, 168]], M: [{ t: [38, 14] }] }],
    cena: [['banco_romano', {}]], pg: { _: { M: [{ t: [38, 14] }] } }, dur: 2.8 });
  T('ghd_abdominal', 'Abdominal no GHD', { k: [{ q: [100, 116], t: -60, P: [[160, 138]], C: [null, null], M: [{ t: [40, 14] }] }, { q: [100, 116], t: 0, P: [[160, 138]], M: [{ t: [40, 14] }] }],
    extra: (S, J) => { almofada(S, add(J.q, V(4, 12)), V(1, 0), 30, 10, 'fundo'); S.cap(V(104, 128), V(104, G - 3), 6, C.metal, 'fundo'); rolo(S, add(J.t1, V(-2, 9)), 'frente'); S.ret(70, G - 6, 110, 6, 3, C.metal2, 'fundo'); }, dur: 2.8 });
  T('hiper_reversa', 'Hiperextensão reversa', { k: [{ q: [84, 112], t: 92, C: [[-12, -12]], M: [[150, 132]] }, { q: [84, 112], t: 92, C: [[-86, -88]], M: [[150, 132]] }],
    cena: [['banco', { id: 'apoio', x0: 74, x1: 164, y: 124 }]], dur: 2.4 });
  T('fire_hydrant', 'Fire hydrant (abdução em 4 apoios)', { k: [{ q: [78, 136], t: 72, h: 10, C: [[0, -90], [3, -90]], M: [[123, TZ]] }, { q: [78, 136], t: 72, C: [[-30, -105], [3, -90]], zC: [.78, 1], M: [[123, TZ]] }], tapete: true, band: 'joelho', dur: 2 });
  T('elevacao_quadril_degrau', 'Elevação de quadril no degrau (hip hike)', { v: 'frente', k: [{ q: [100, 88], t: 0, P: [[108, 154], [92, 162]], M: [{ t: [4, 15] }] }, { q: [100, 84], t: 4, P: [[108, 154], [90, 150]], M: [{ t: [4, 15] }] }],
    cena: [['degrau', { x0: 96, x1: 130, y: 160 }]], dur: 2 });

  // ===== PEITO / EMPURRAR
  const banco = { id: 'apoio', x0: 36, x1: 142, y: 138 };
  T('supino', 'Supino reto', { k: [deitado(118, 138, { P: [[148, TZ]], M: [[78, 74]], h: -6 }), deitado(118, 138, { P: [[148, TZ]], M: [[84, 110]], h: -6 })], cena: [['banco', banco]], p: 'barra', dur: 2.6 });
  T('supino_inclinado', 'Supino inclinado', { k: [{ q: [104, 128], t: -50, P: [[146, TZ]], M: [[74, 46]] }, { q: [104, 128], t: -50, P: [[146, TZ]], M: [[84, 86]] }],
    cena: [['banco_inclinado', { x: 100, y: 140, ang: 50, L: 74, dx: -2 }]], p: 'barra', dur: 2.6 });
  T('supino_declinado', 'Supino declinado', { k: [{ q: [118, 116], t: -104, P: [[150, 152]], M: [[82, 78]] }, { q: [118, 116], t: -104, P: [[150, 152]], M: [[86, 116]] }],
    cena: [['banco_declinado', { x0: 34, x1: 146, y0: 150, y1: 126 }]], p: 'barra', dur: 2.6 });
  T('supino_chao', 'Supino no chão', { k: [deitado(118, G, { P: [[146, TZ]], M: [[74, 116]] }), deitado(118, G, { P: [[146, TZ]], M: [[80, 152]], sM: [1] })], tapete: true, p: 'halteres', dur: 2.6 });
  T('crucifixo', 'Crucifixo', { k: [deitado(118, 138, { P: [[148, TZ]], M: [[73, 150]], zB: [.56] }), deitado(118, 138, { P: [[148, TZ]], M: [[76, 76]], zB: [1] })], cena: [['banco', banco]], p: 'halteres', cabo: [72, 176], dur: 2.8 });
  T('crucifixo_inclinado', 'Crucifixo inclinado', { k: [{ q: [104, 128], t: -50, P: [[146, TZ]], M: [[69, 118]], zB: [.55] }, { q: [104, 128], t: -50, P: [[146, TZ]], M: [[76, 48]] }],
    cena: [['banco_inclinado', { x: 100, y: 140, ang: 50, L: 74, dx: -2 }]], p: 'halteres', cabo: [66, 176], dur: 2.8 });
  T('pullover', 'Pullover', { k: [deitado(118, 138, { P: [[148, TZ]], B: [[178, 182]] }), deitado(118, 138, { P: [[148, TZ]], B: [[-98, -100]] })], cena: [['banco', banco]], p: 'halter', goblet: false, dur: 2.8 });
  T('pullover_chao', 'Pullover deitado no chão', { k: [deitado(118, G, { P: [[146, TZ]], B: [[178, 182]] }), deitado(118, G, { P: [[146, TZ]], B: [[-92, -92]] })], tapete: true, dur: 2.8 });
  T('flexao', 'Flexão de braços', { k: [linha([20, 172], [124, 122], -1, { M: [[128, TZ]] }), linha([20, 172], [134, 160], -1, { M: [[128, TZ]] })], dur: 2.2 });
  T('flexao_joelhos', 'Flexão com joelhos apoiados', {
    k: [{ q: [87.5, 150], t: 52.5, C: [[-52, -140]], M: [[130, TZ]] }, { q: [94.6, 166.7], t: 81.6, C: [[-81.5, -140]], M: [[130, TZ]] }], tapete: true, dur: 2.2 });
  T('flexao_inclinada', 'Flexão inclinada (mãos elevadas)', { k: [linha([40, 172], [124, 92], -1, { M: [[132, 138]] }), linha([40, 172], [140, 120], -1, { M: [[132, 138]] })],
    cena: [['banco', { id: 'apoio', x0: 116, x1: 176, y: 140 }]], dur: 2.2 });
  T('flexao_declinada', 'Flexão declinada (pés elevados)', { k: [linha([36, 128], [130, 124], -1, { M: [[134, TZ]], f: [0] }), linha([36, 128], [140, 160], -1, { M: [[134, TZ]], f: [0] })],
    cena: [['banco', { id: 'apoio', x0: 14, x1: 58, y: 136 }]], dur: 2.2 });
  T('flexao_parede', 'Flexão na parede', { k: [linha([70, TZ], [126, 66], -1, { M: [[146, 70]] }), linha([70, TZ], [134, 66], -1, { M: [[146, 70]], f: [70] })],
    cena: [['parede', { id: 'apoio', x: 150, lado: 1 }]], dur: 2.2 });
  T('flexao_explosiva', 'Flexão explosiva', { k: [linha([20, 172], [134, 160], -1, { M: [[128, TZ]] }), linha([20, 172], [120, 110], -1, { M: [[132, 150]] })], dur: 1.2 });
  T('flexao_diamante', 'Flexão diamante', { k: [linha([20, 172], [124, 122], -1, { M: [[124, TZ]] }), linha([20, 172], [132, 158], -1, { M: [[124, TZ]], sM: [1] })], dur: 2.2 });
  T('pike_pushup', 'Pike push-up', { k: [linha([50, 172], [112, 124], 1, { M: [[132, TZ]] }), linha([50, 172], [122, 150], 1, { M: [[132, TZ]], h: 10 })], dur: 2.4 });
  T('hspu', 'Flexão em parada de mão', { k: [{ q: [100, 76], t: 180, C: [[180, 180]], f: [180, 180], M: [[98, TZ]] }, { q: [100, 104], t: 180, C: [[180, 180]], f: [180, 180], M: [[92, TZ]] }],
    cena: [['parede', { id: 'apoio', x: 112, lado: 1, top: -10 }]], dur: 2.6 });
  T('parada_mao', 'Parada de mão', { k: [{ q: [100, 76], t: 180, C: [[180, 180]], f: [180, 180], M: [[98, TZ]] }, { q: [100, 76], t: 182, C: [[182, 176]], f: [180, 180], M: [[98, TZ]] }], cena: [['parede', { id: 'apoio', x: 112, lado: 1, top: -10 }]], dur: 3 });
  T('wall_walk', 'Escalada na parede', { k: [linha([50, 150], [140, 122], -1, { M: [[144, TZ]], f: [-90] }), { q: [68, 75], t: 180, C: [[180, 180]], f: [180], M: [[68, TZ]] }],
    cena: [['parede', { x: 46, lado: -1, top: -10 }]], dur: 3.2 });
  T('mergulho', 'Mergulho nas paralelas', { k: [{ q: [104, 98], t: 6, C: [[8, -40]], M: [[110, 104]] }, { q: [100, 128], t: 20, C: [[14, -36]], M: [[112, 104]] }], cena: [['paralelas', { id: 'apoio', x0: 74, x1: 154, y: 108 }]], dur: 2.4 });
  T('mergulho_banco', 'Tríceps no banco (mergulho)', { k: [{ q: [96, 120], t: 4, P: [[150, TZ]], M: [[84, 132]] }, { q: [94, 148], t: 10, P: [[150, TZ]], M: [[84, 132]] }], cena: [['banco', { id: 'apoio', x0: 30, x1: 90, y: 134 }]], dur: 2.2 });
  T('crossover', 'Crossover (crucifixo no cabo)', { v: 'frente', k: [{ q: [100, 104], M: [[150, 60]], sM: [1] }, { q: [100, 104], M: [[106, 118]], sM: [1] }], p: 'crossover', caboDuplo: true, cabo: [0, 36], torreDx: 76, dur: 2.6 });
  T('crossover_baixo', 'Crossover de baixo para cima', { v: 'frente', k: [{ q: [100, 104], M: [[150, 140]], sM: [1] }, { q: [100, 104], M: [[106, 74]], sM: [1] }], p: 'crossover', caboDuplo: true, cabo: [0, 168], torreDx: 76, dur: 2.6 });
  T('crossover_medio', 'Crossover na altura do peito', { v: 'frente', k: [{ q: [100, 104], M: [[156, 84]], sM: [1] }, { q: [100, 104], M: [[106, 88]], zB: [.6], sM: [1] }], p: 'crossover', caboDuplo: true, cabo: [0, 84], torreDx: 76, dur: 2.6 });
  T('peck_deck', 'Voador (peck deck)', { v: 'frente', k: [{ q: [100, 126], C: [[14, 4]], cz: [.55], M: [[158, 82]], sM: [1] }, { q: [100, 126], C: [[14, 4]], cz: [.55], M: [[107, 86]], zB: [.6], sM: [1] }], cena: [['peck_deck', {}]], dur: 2.6 });
  T('voador_inverso', 'Crucifixo inverso na máquina', { v: 'frente', k: [{ q: [100, 126], C: [[14, 4]], cz: [.55], M: [[107, 86]], zB: [.6], sM: [1] }, { q: [100, 126], C: [[14, 4]], cz: [.55], M: [[160, 80]], sM: [1] }], cena: [['peck_deck', {}]], dur: 2.6 });
  T('supino_maquina', 'Supino na máquina', { k: [{ q: [86, 126], t: -8, C: [[88, 0]], M: [[116, 80]] }, { q: [86, 126], t: -8, C: [[88, 0]], M: [[146, 78]] }], cena: [['alavanca', { px: 150, py: 20, pilha: false }]], dur: 2.4 });
  T('supino_em_pe', 'Supino em pé (cabo/elástico)', { k: [{ q: [100, 104], t: 8, P: [[118, TZ], [80, TZ]], M: [{ t: [38, 16] }] }, { q: [100, 104], t: 10, P: [[118, TZ], [80, TZ]], M: [{ t: [40, 54] }] }],
    p: 'elastico', cabo: [40, 70], dur: 2.2 });
  T('passe_peito', 'Arremesso de peito', { k: [{ q: [96, 108], t: 10, P: [[118, TZ], [80, TZ]], M: [{ t: [36, 18] }] }, { q: [100, 104], t: 12, P: [[118, TZ], [84, TZ]], M: [{ t: [40, 56] }] }],
    p: 'medicine_ball', cena: [['parede', { x: 186, lado: 1 }]], dur: 1.4 });
  T('aperto_palmas', 'Aperto isométrico de palmas', { k: [EP({ M: [{ t: [36, 18] }] }), EP({ M: [{ t: [36, 17] }], e: 1 })], dur: 2 });
  T('svend', 'Svend press', { k: [EP({ M: [{ t: [36, 16] }] }), EP({ M: [{ t: [38, 52] }] })], p: 'anilha', anilhaFace: false, dur: 2.2 });

  // ===== OMBROS
  T('desenvolvimento', 'Desenvolvimento (em pé)', { v: 'frente', k: [{ q: [100, 104], M: [[124, 58]], sM: [1] }, { q: [100, 104], M: [[112, 2]], sM: [1] }], p: 'halteres', cabo: 'pe', caboDuplo: true, dur: 2.4 });
  T('desenvolvimento_sentado', 'Desenvolvimento sentado', { v: 'frente', k: [{ q: [100, 126], C: [[16, 4]], cz: [.55], M: [[124, 80]], sM: [1] }, { q: [100, 126], C: [[16, 4]], cz: [.55], M: [[112, 24]], sM: [1] }],
    extra: (S, J, ctx) => MAQ.desenv_frente(S, {}, J, ctx), p: 'halteres', dur: 2.4 });
  T('desenvolvimento_maquina', 'Desenvolvimento na máquina', { v: 'frente', k: [{ q: [100, 126], C: [[16, 4]], cz: [.55], M: [[126, 80]], sM: [1] }, { q: [100, 126], C: [[16, 4]], cz: [.55], M: [[116, 26]], sM: [1] }],
    extra: (S, J, ctx) => { MAQ.desenv_frente(S, {}, J, ctx); for (const k of [1, 2]) { const m = J['m' + k], s = k === 1 ? 1 : -1; S.cap(V(m.x + s * 16, 150), m, 4, C.metal2, 'fundo'); pegador(S, m, 'frente'); } }, dur: 2.4 });
  T('desenvolvimento_unilateral', 'Desenvolvimento unilateral', { v: 'frente', k: [{ q: [100, 104], M: [[124, 58]], B: [null, [6, 3]], sM: [1] }, { q: [100, 104], M: [[112, 2]], B: [null, [6, 3]], sM: [1] }], uni: true, p: 'halter', dur: 2.4 });
  T('desenvolvimento_ajoelhado', 'Desenvolvimento meio ajoelhado', { k: [{ q: [96, 134], t: 2, P: [[124, TZ], [62, 172]], f: [null, -20], M: [{ t: [44, 12] }], sM: [1] }, { q: [96, 134], t: 4, P: [[124, TZ], [62, 172]], f: [null, -20], B: [[172, 176]] }], uni: true, p: 'kettlebell', lm: [210, 177], tapete: true, dur: 2.4 });
  T('push_press', 'Push press', { k: [{ q: [96, 112], t: 6, P: [[103, TZ], [97, TZ]], M: [{ t: [44, 14] }], sM: [1] }, EP({ t: 0, B: [[176, 178]], pausa: 1 })], pg: null, p: 'barra', dur: 2 });
  T('landmine_press', 'Landmine press', { k: [EP({ t: 8, P: [[110, TZ], [86, TZ]], M: [{ t: [44, 12] }], sM: [1] }), EP({ t: 10, P: [[110, TZ], [86, TZ]], B: [[140, 140]] })], p: 'landmine', lm: [214, 177], dur: 2.4 });
  T('elevacao_lateral', 'Elevação lateral', { v: 'frente', k: [{ q: [100, 104], B: [[10, 6]] }, { q: [100, 104], B: [[86, 92]] }], p: 'halteres', cabo: 'pe', caboDuplo: true, dur: 2.4 });
  T('elevacao_lateral_uni', 'Elevação lateral unilateral', { v: 'frente', k: [{ q: [100, 104], B: [[10, 6], [6, 3]] }, { q: [100, 104], B: [[86, 92], [6, 3]] }], uni: true, p: 'polia', cabo: [36, 172], dur: 2.4 });
  T('elevacao_y', 'Elevação em Y', { v: 'frente', k: [{ q: [100, 104], B: [[14, 10]] }, { q: [100, 104], B: [[146, 150]] }], p: 'halteres', dur: 2.6 });
  T('elevacao_frontal', 'Elevação frontal', { k: [EP({ B: [[-3, 0]] }), EP({ B: [[92, 94]] })], p: 'halteres', cabo: [86, 174], dur: 2.4 });
  T('elevacao_frontal_alt', 'Elevação frontal alternada', { k: [EP({ B: [[-3, 0], [92, 94]] }), EP({ B: [[92, 94], [-3, 0]] })], p: 'halteres', dur: 2.4 });
  T('crucifixo_inverso', 'Crucifixo inverso (posterior)', { v: 'frente', k: [{ q: [100, 108], tz: .48, hd: 12, P: [[110, TZ]], B: [[8, 4]] }, { q: [100, 108], tz: .48, hd: 12, P: [[110, TZ]], B: [[84, 88]] }], p: 'halteres', cabo: [0, 172], caboDuplo: true, dur: 2.4 });
  T('crucifixo_inverso_deitado', 'Crucifixo inverso no banco inclinado', { v: 'frente', k: [{ q: [100, 116], tz: .5, hd: 12, P: [[114, TZ]], B: [[8, 4]] }, { q: [100, 116], tz: .5, hd: 12, P: [[114, TZ]], B: [[84, 88]] }],
    extra: (S, J, ctx) => { S.ret(84, 112, 32, 26, 9, C.estofado, 'meio'); S.ret(97, 136, 6, G - 136, 2, C.metal, 'fundo'); S.ret(80, G - 6, 40, 6, 3, C.metal2, 'fundo'); }, p: 'halteres', dur: 2.4 });
  T('remada_alta', 'Remada alta', { v: 'frente', k: [{ q: [100, 104], M: [[106, 122]], sM: [1] }, { q: [100, 104], M: [[110, 52]], sM: [1] }], p: 'barra', cabo: [100, 176], dur: 2.4 });
  T('encolhimento', 'Encolhimento de ombros', { v: 'frente', k: [{ q: [100, 104], B: [[6, 3]] }, { q: [100, 104], B: [[6, 3]], e: -7 }], p: 'halteres', dur: 1.8 });
  T('encolhimento_acima', 'Encolhimento com braços acima da cabeça', { v: 'frente', k: [{ q: [100, 104], B: [[160, 165]] }, { q: [100, 104], B: [[160, 165]], e: -7 }], p: 'barra', dur: 1.8 });
  T('face_pull', 'Face pull', { k: [EP({ t: -4, P: [[110, TZ], [88, TZ]], M: [[154, 56]] }), EP({ t: -4, P: [[110, TZ], [88, TZ]], M: [[116, 44]], sM: [1] })], p: 'polia', cabo: [178, 46], dur: 2.4 });
  T('rotacao_externa', 'Rotação externa de ombro', { v: 'frente', k: [{ q: [100, 104], B: [[4, 10], [6, 3]], za: [.32, 1] }, { q: [100, 104], B: [[4, 88], [6, 3]] }], uni: true, p: 'elastico', cabo: [40, 86], dur: 2.2 });
  T('rotacao_interna', 'Rotação interna de ombro', { v: 'frente', k: [{ q: [100, 104], B: [[4, 80], [6, 3]] }, { q: [100, 104], B: [[4, -14], [6, 3]], za: [.4, 1] }], uni: true, p: 'elastico', cabo: [176, 86], dur: 2.2 });
  T('rotacao_externa_90', 'Rotação externa a 90°', { v: 'frente', k: [{ q: [100, 104], B: [[90, 100], [6, 3]], za: [.3, 1] }, { q: [100, 104], B: [[90, 180], [6, 3]] }], uni: true, p: 'elastico', cabo: [176, 20], dur: 2.2 });
  T('rotacao_deitado', 'Rotação de ombro deitado de lado', { v: 'frente', k: [{ q: [100, 163], t: 90, P: [[28, 172], [30, 158]], M: [[170, 174]], B: [null, [70, -10]], za: [1, .35] }, { q: [100, 163], t: 90, P: [[28, 172], [30, 158]], M: [[170, 174]], B: [null, [70, 70]] }], uni: true, tapete: true, dur: 2.2 });
  T('diagonal', 'Diagonal de ombro (saque)', { v: 'frente', k: [{ q: [100, 104], M: [[80, 126]], B: [null, [6, 3]], sM: [1] }, { q: [100, 104], B: [[150, 160], [6, 3]] }], uni: true, p: 'elastico', cabo: [70, 176], dur: 2 });
  T('halo', 'Halo', { v: 'frente', k: [{ q: [100, 104], M: [[104, 70], [96, 70]] }, { q: [100, 104], M: [[128, 34], [118, 40]] }, { q: [100, 104], M: [[104, 12], [96, 12]] }, { q: [100, 104], M: [[82, 40], [72, 34]] }], p: 'kettlebell', goblet: true, lin: true, dur: 2.8 });
  T('serratil', 'Protração escapular (soco para o teto)', { k: [deitado(118, G, { P: [[146, TZ]], B: [[180, 180]] }), deitado(118, G, { P: [[146, TZ]], B: [[180, 180]], e: 5 })], tapete: true, dur: 1.8 });
  T('wall_slide', 'Deslizamento na parede', { v: 'frente', k: [{ q: [100, 104], M: [[130, 56]], sM: [1] }, { q: [100, 104], B: [[155, 165]] }], extra: (S, J, ctx) => MAQ.parede_fundo(S, { x0: 50, x1: 150 }), band: 'punho', dur: 2.6 });
  T('anjo_parede', 'Anjo na parede', { v: 'frente', k: [{ q: [100, 104], M: [[134, 50]], sM: [1] }, { q: [100, 104], B: [[150, 160]] }], extra: (S, J, ctx) => MAQ.parede_fundo(S, { x0: 50, x1: 150 }), dur: 2.6 });
  T('ytw', 'Y-T-W deitado', { k: [{ q: [80, 167], t: 90, h: -6, C: [[-90, -90]], B: [[60, 60]] }, { q: [80, 167], t: 90, h: -12, C: [[-90, -90]], B: [[118, 118]] }], tapete: true, dur: 2.4 });

  // ===== COSTAS
  T('barra_fixa', 'Barra fixa', { v: 'frente', k: [{ q: [100, 83], P: [[104, 154]], sM: [-1], M: [[132, -12]] }, { q: [100, 50], P: [[104, 120]], sM: [-1], M: [[132, -12]], h: -4 }],
    cena: [['barra_fixa', { x: 100, y: -12, frente: true, w: 130 }]], dur: 2.6 });
  T('barra_fixa_supinada', 'Barra fixa supinada (chin-up)', { v: 'frente', k: [{ q: [100, 81], P: [[104, 152]], sM: [-1], M: [[118, -12]] }, { q: [100, 46], P: [[104, 116]], sM: [-1], M: [[118, -12]] }],
    cena: [['barra_fixa', { x: 100, y: -12, frente: true, w: 130 }]], dur: 2.6 });
  T('pendurado', 'Suspensão na barra', { v: 'frente', k: [{ q: [100, 83], P: [[104, 154]], sM: [-1], M: [[126, -12]] }, { q: [100, 78], P: [[104, 149]], sM: [-1], M: [[126, -12]], e: -5 }],
    cena: [['barra_fixa', { x: 100, y: -12, frente: true, w: 130 }]], dur: 2.4 });
  T('muscle_up', 'Muscle-up', { v: 'frente', k: [{ q: [100, 83], P: [[104, 154]], sM: [-1], M: [[124, -12]] }, { q: [100, 40], P: [[104, 110]], sM: [-1], M: [[124, -12]] }, { q: [100, -6], P: [[104, 64]], sM: [-1], M: [[118, -12]], sM: [-1] }],
    cena: [['barra_fixa', { x: 100, y: -12, frente: true, w: 130 }]], dur: 3 });
  T('front_lever', 'Front lever', { k: [{ q: [146, 74], t: -90, C: [[90, 90]], f: [180], M: [[100, 20]] }, { q: [146, 78], t: -94, C: [[94, 94]], f: [180], M: [[100, 20]] }], cena: [['barra_fixa', { x: 100, y: 20 }]], dur: 3 });
  T('puxada', 'Puxada (pulldown)', { v: 'frente', k: [{ q: [100, 130], C: [[14, 4]], cz: [.55], sM: [-1], M: [[142, 24]], h: -4 }, { q: [100, 130], C: [[14, 4]], cz: [.55], sM: [-1], M: [[136, 74]], h: -8 }], cena: [['puxador', {}]], dur: 2.6 });
  T('puxada_fechada', 'Puxada com pegada fechada', { v: 'frente', k: [{ q: [100, 130], C: [[14, 4]], cz: [.55], sM: [-1], M: [[110, 24]] }, { q: [100, 130], C: [[14, 4]], cz: [.55], sM: [-1], M: [[106, 76]] }], cena: [['puxador', {}]], dur: 2.6 });
  T('puxada_unilateral', 'Puxada unilateral', { v: 'frente', k: [{ q: [100, 134], C: [[14, 4]], cz: [.4], M: [[120, 24]], B: [null, [6, 3]] }, { q: [100, 134], C: [[14, 4]], cz: [.4], M: [[122, 80]], B: [null, [6, 3]] }], uni: true, p: 'polia', cabo: [124, 6], dur: 2.4 });
  T('remada_curvada', 'Remada curvada', { k: [{ q: [80, 118], t: 65, P: [[104, TZ], [98, TZ]], M: [{ t: [24.5, 46.7] }] }, { q: [80, 118], t: 65, P: [[104, TZ], [98, TZ]], M: [{ t: [20, 15] }] }], p: 'barra', lm: [12, 177], lmPonta: 6, dur: 2.4 });
  T('remada_unilateral', 'Remada unilateral apoiada', {
    k: [{ q: [70, 107], t: 88, C: [null, [0, -90]], P: [[78, TZ]], M: [[116, 162], [118, 148]] }, { q: [70, 107], t: 88, C: [null, [0, -90]], P: [[78, TZ]], M: [{ t: [16, 12] }, [118, 148]] }],
    cena: [['banco', { id: 'apoio', x0: 50, x1: 136, y: 150 }]], uni: true, p: 'halter', dur: 2.4 });
  T('remada_sentada', 'Remada sentada no cabo', { k: [{ q: [74, 156], t: 18, P: [[146, 162], [140, 164]], M: [[170, 132]] }, { q: [74, 156], t: -6, P: [[146, 162], [140, 164]], M: [{ t: [20, 16] }] }], cena: [['remada_baixa', { yp: 136 }]], dur: 2.4 });
  T('remada_sentada_chao', 'Remada sentada no chão (elástico)', { k: [{ q: [74, 166], t: 16, C: [[90, 88], [90, 88]], M: [[136, 160]] }, { q: [74, 166], t: -6, C: [[90, 88], [90, 88]], M: [{ t: [20, 16] }] }], p: 'elastico', cabo: { j: 'd1', d: [2, -2] }, tapete: true, dur: 2.4 });
  T('remada_maquina', 'Remada na máquina', { k: [{ q: [84, 128], t: 2, C: [[90, 0]], M: [[140, 92]] }, { q: [84, 128], t: 2, C: [[90, 0]], M: [{ t: [26, 14] }] }], cena: [['remada_maquina', {}]], dur: 2.4 });
  T('remada_invertida', 'Remada invertida', { k: [linha([196, 172], [80, 155], 1, { M: [[82, 100]] }), linha([196, 172], [92, 124], 1, { M: [[82, 100]], sM: [1] })], cena: [['barra_fixa', { id: 'apoio', x: 82, y: 100 }]], dur: 2.4 });
  T('remada_trx', 'Remada no TRX', { k: [linha([150, TZ], [68, 94], 1, { M: [[106, 58]], f: [150] }), linha([150, TZ], [100, 70], 1, { M: [[118, 52]], sM: [1], f: [150] })], p: 'trx', cabo: [176, 0], dur: 2.4 });
  T('remada_em_pe', 'Remada em pé (cabo/elástico)', { k: [EP({ t: 8, P: [[112, TZ], [86, TZ]], M: [[152, 74]] }), EP({ t: 4, P: [[112, TZ], [86, TZ]], M: [{ t: [30, 10] }] })], p: 'elastico', cabo: [184, 74], dur: 2.4 });
  T('remada_afundo', 'Remada unilateral em base de afundo', { k: [{ q: [96, 120], t: 10, P: [[124, TZ], [64, 170]], f: [null, 45], M: [[152, 82]], B: [null, [20, 40]] }, { q: [96, 120], t: 6, P: [[124, TZ], [64, 170]], f: [null, 45], M: [{ t: [28, 10] }], B: [null, [20, 40]] }], uni: true, p: 'elastico', cabo: [186, 82], dur: 2.4 });
  T('pulldown_estendido', 'Pulldown de braços estendidos', { k: [EP({ t: 22, P: [[110, TZ], [96, TZ]], B: [[150, 152]] }), EP({ t: 22, P: [[110, TZ], [96, TZ]], B: [[2, 2]] })], p: 'polia', cabo: [176, 10], dur: 2.4 });
  T('pulldown_ajoelhado', 'Puxada ajoelhado na polia alta', { k: [{ q: [100, 136], t: 4, C: [[0, -90]], B: [[166, 170]] }, { q: [100, 136], t: 4, C: [[0, -90]], M: [{ t: [34, 10] }] }], p: 'polia', cabo: [120, 4], tapete: true, dur: 2.4 });
  T('superman', 'Superman', { k: [{ q: [82, 167], t: 90, h: -4, C: [[-90, -90]], B: [[88, 88]] }, { q: [82, 167], t: 80, h: -16, C: [[-78, -78]], B: [[76, 76]] }], tapete: true, dur: 2.2 });
  T('nadador', 'Nadador (swimmer)', { k: [{ q: [82, 167], t: 84, h: -12, C: [[-84, -84], [-90, -90]], B: [[84, 84], [-96, -96]] }, { q: [82, 167], t: 84, h: -12, C: [[-90, -90], [-84, -84]], B: [[-96, -96], [84, 84]] }], tapete: true, dur: 1.6 });
  T('bird_dog', 'Bird dog', { k: [{ q: [78, 136], t: 72, h: 10, C: [[0, -90], [3, -90]], M: [[123, TZ]] }, { q: [78, 136], t: 74, C: [[0, -90], [-90, -90]], B: [[96, 96]], M: [null, [123, TZ]] }], tapete: true, dur: 2.6 });
  T('cobra', 'Cobra / extensão no chão', { k: [{ q: [82, 168], t: 90, h: -6, C: [[-90, -90]], M: [[132, TZ]] }, { q: [82, 168], t: 50, h: -20, C: [[-90, -90]], M: [[128, TZ]] }], tapete: true, dur: 2.6 });
  T('esfinge', 'Esfinge', { k: [{ q: [80, 168], t: 66, h: -16, C: [[-90, -90]], B: [[0, 90]] }, { q: [80, 168], t: 64, h: -20, C: [[-90, -90]], B: [[0, 90]] }], tapete: true, dur: 3 });

  // ===== BRACOS
  T('rosca', 'Rosca bíceps', { k: [EP({ B: [[-4, -2]] }), EP({ B: [[2, 148]] })], p: 'halteres', cabo: [150, 172], dur: 2.2 });
  T('rosca_alternada', 'Rosca alternada', { k: [EP({ B: [[-4, -2], [2, 148]] }), EP({ B: [[2, 148], [-4, -2]] })], p: 'halteres', dur: 2.2 });
  T('rosca_scott', 'Rosca Scott', { k: [{ q: [80, 128], t: 12, C: [[88, 0]], B: [[48, 36]] }, { q: [80, 128], t: 12, C: [[88, 0]], B: [[48, 158]] }], cena: [['scott', {}]], p: 'barra', dur: 2.2 });
  T('rosca_concentrada', 'Rosca concentrada', { k: [{ q: [84, 130], t: 36, P: [[124, TZ], [118, TZ]], B: [[-6, -4]] }, { q: [84, 130], t: 36, P: [[124, TZ], [118, TZ]], B: [[-6, 150]], B2: 0 }],
    cena: [['banco', { id: 'apoio', x0: 56, x1: 110, y: 140 }]], p: 'halter', uni: true, dur: 2.2 });
  T('rosca_inclinada', 'Rosca no banco inclinado', { k: [{ q: [104, 128], t: -46, P: [[146, TZ]], B: [[-10, -10]] }, { q: [104, 128], t: -46, P: [[146, TZ]], B: [[-10, 140]] }],
    cena: [['banco_inclinado', { id: 'apoio', x: 100, y: 140, ang: 46, L: 74, dx: -2 }]], p: 'halteres', dur: 2.2 });
  T('rosca_spider', 'Rosca spider / deitado de bruços', { k: [{ q: [88, 112], t: 46, P: [[96, TZ], [92, TZ]], B: [[0, 0]] }, { q: [88, 112], t: 46, P: [[96, TZ], [92, TZ]], B: [[0, 150]] }],
    extra: (S, J, ctx) => { almofada(S, Q(ctx.J0, 26, 16), ctx.J0.up, 60, 10, 'fundo'); S.cap(V(ctx.J0.q.x + 6, 130), V(ctx.J0.q.x + 6, G - 3), 6, C.metal, 'fundo'); }, p: 'halteres', dur: 2.2 });
  T('rosca_punho', 'Rosca de punho', { k: [{ q: [80, 128], t: 30, C: [[88, 0], [88, 0]], M: [{ j: 'j1', d: [12, -6] }], pu: [-40] }, { q: [80, 128], t: 30, C: [[88, 0], [88, 0]], M: [{ j: 'j1', d: [12, -6] }], pu: [40] }],
    cena: [['banco', { id: 'apoio', x0: 58, x1: 108, y: 140 }]], p: 'halteres', dur: 1.6 });
  T('rosca_punho_pe', 'Flexão de punho em pé', { k: [EP({ B: [[-4, -2]], pu: [-40] }), EP({ B: [[-4, -2]], pu: [40] })], p: 'barra', dur: 1.6 });
  T('pegada', 'Pegada (segurar/apertar)', { k: [EP({ B: [[30, 80]] }), EP({ B: [[30, 80]], pu: [76] })], p: 'hand_grip', dur: 1.4 });
  T('segurar', 'Sustentação com carga', { k: [EP({ B: [[-2, 0]] }), EP({ B: [[-2, 0]], e: -2 })], p: 'halteres', dur: 2 });
  T('suspensao', 'Suspensão (pegada)', { v: 'frente', k: [{ q: [100, 83], P: [[104, 154]], sM: [-1], M: [[120, -12]] }, { q: [100, 83], P: [[104, 154]], sM: [-1], M: [[120, -12]], h: 4 }], cena: [['barra_fixa', { x: 100, y: -12, frente: true, w: 130 }]], dur: 2.4 });
  T('triceps_pulley', 'Tríceps na polia', { k: [EP({ t: 10, B: [[-8, 128]] }), EP({ t: 10, B: [[-8, -6]] })], p: 'polia', cabo: [140, 22], dur: 2.2 });
  T('triceps_testa', 'Tríceps testa', { k: [deitado(118, 138, { P: [[148, TZ]], B: [[190, 186]] }), deitado(118, 138, { P: [[148, TZ]], B: [[190, 292]] })], cena: [['banco', banco]], p: 'barra', dur: 2.2 });
  T('triceps_frances', 'Tríceps francês', { k: [EP({ B: [[176, 178]] }), EP({ B: [[174, -12]] })], p: 'halter', goblet: false, dur: 2.2 });
  T('triceps_frances_cabo', 'Tríceps acima da cabeça no cabo', { k: [EP({ t: 30, P: [[118, TZ], [86, TZ]], B: [[150, 50]] }), EP({ t: 30, P: [[118, TZ], [86, TZ]], B: [[150, 150]] })], p: 'polia', cabo: [26, 40], dur: 2.2 });
  T('triceps_coice', 'Tríceps coice', { k: [{ q: [80, 118], t: 70, P: [[104, TZ], [98, TZ]], B: [[-70, 0]] }, { q: [80, 118], t: 70, P: [[104, TZ], [98, TZ]], B: [[-70, -72]] }], p: 'halteres', cabo: [176, 150], dur: 2.2 });
  T('triceps_maquina', 'Tríceps na máquina', { k: [{ q: [86, 126], t: -2, C: [[88, 0]], B: [[0, 110]] }, { q: [86, 126], t: -2, C: [[88, 0]], B: [[0, 4]] }], cena: [['alavanca', { px: 140, py: 140 }]], dur: 2.2 });
  T('flexao_esfinge', 'Flexão esfinge', { k: [linha([20, 172], [118, 146], -1, { B: [[0, 90]] }), linha([20, 172], [124, 122], -1, { M: [[136, TZ]] })], dur: 2.2 });

  // ===== CORE
  T('prancha', 'Prancha', { k: [linha([12, 172], [124, 145], -1, { B: [[0, 90]] }), linha([12, 172], [124, 143], -1, { B: [[0, 90]], h: 4 })], tapete: true, dur: 3 });
  T('prancha_alta', 'Prancha alta', { k: [linha([20, 172], [124, 122], -1, { M: [[128, TZ]] }), linha([20, 172], [124, 120], -1, { M: [[128, TZ]], h: 4 })], tapete: true, dur: 3 });
  T('prancha_toque', 'Prancha com toque no ombro', { k: [linha([20, 172], [124, 122], -1, { M: [[128, TZ], { o: [8, -2] }] }), linha([20, 172], [124, 122], -1, { M: [{ o: [8, -2] }, [126, TZ]] })], tapete: true, dur: 1.8 });
  T('prancha_lateral', 'Prancha lateral', { v: 'frente', k: [{ q: [128, 145], t: -72, P: [[196, 168], [196, 175]], B: [[150, 160], [0, 0]], za: [1, .25] }, { q: [128, 147], t: -71, P: [[196, 168], [196, 175]], B: [[150, 160], [0, 0]], za: [1, .25] }], tapete: true, dur: 3 });
  T('prancha_lateral_quadril', 'Prancha lateral com elevação de quadril', { v: 'frente', k: [{ q: [128, 158], t: -62, P: [[196, 168], [196, 175]], M: [{ t: [6, 14] }], B: [null, [0, 0]], za: [1, .25] }, { q: [128, 145], t: -72, P: [[196, 168], [196, 175]], M: [{ t: [6, 14] }], B: [null, [0, 0]], za: [1, .25] }], tapete: true, dur: 2.4 });
  T('prancha_lateral_joelhos', 'Prancha lateral nos joelhos', { v: 'frente', k: [{ q: [128, 156], t: -64, P: [[172, 172], [172, 176]], cz: [1], pz: [.5], M: [{ t: [6, 14] }], B: [null, [0, 0]], za: [1, .25] }, { q: [128, 147], t: -72, P: [[172, 172], [172, 176]], pz: [.5], M: [{ t: [6, 14] }], B: [null, [0, 0]], za: [1, .25] }], tapete: true, dur: 2.4 });
  T('prancha_estrela', 'Prancha lateral com abdução', { v: 'frente', k: [{ q: [128, 145], t: -72, P: [[196, 168], [196, 175]], B: [[150, 160], [0, 0]], za: [1, .25] }, { q: [128, 145], t: -72, P: [[192, 130], [196, 175]], B: [[150, 160], [0, 0]], za: [1, .25] }], tapete: true, dur: 2.2 });
  T('prancha_urso', 'Prancha do urso', { k: [{ q: [80, 128], t: 72, h: 10, C: [[0, -66], [3, -66]], f: [0], M: [[124, TZ]] }, { q: [80, 128], t: 72, h: 10, C: [[0, -66], [3, -66]], f: [0], M: [[124, TZ]], e: 2 }], tapete: true, dur: 2.6 });
  T('urso_toque', 'Prancha do urso com toque no ombro', { k: [{ q: [80, 128], t: 72, h: 10, C: [[0, -66], [3, -66]], f: [0], M: [[124, TZ], { o: [8, -2] }] }, { q: [80, 128], t: 72, h: 10, C: [[0, -66], [3, -66]], f: [0], M: [{ o: [8, -2] }, [122, TZ]] }], tapete: true, dur: 1.8 });
  T('abdominal', 'Abdominal (crunch)', { k: [deitado(110, G, { P: [[138, TZ]], M: [{ j: 'cab', d: [-3, 2] }], h: 0, t: -91 }), deitado(110, G, { P: [[138, TZ]], M: [{ j: 'cab', d: [-3, 2] }], h: 22, t: -62 })], tapete: true, dur: 2 });
  T('abdominal_bracos', 'Abdominal com braços estendidos', { k: [deitado(110, G, { P: [[138, TZ]], B: [[-90, -90]], t: -91 }), deitado(110, G, { P: [[138, TZ]], B: [[-130, -130]], h: 18, t: -62 })], tapete: true, dur: 2 });
  T('sit_up', 'Abdominal completo (sit-up)', { k: [deitado(110, G, { P: [[136, TZ]], M: [{ t: [38, 12] }], t: -91 }), deitado(110, G, { P: [[136, TZ]], M: [{ t: [38, 12] }], h: 10, t: -16 })], tapete: true, dur: 2.4 });
  T('abdominal_infra', 'Abdominal infra (reverso)', { k: [porOmbro([60, 167], -90, { C: [[180, 92]], B: [[94, 92]] }), porOmbro([60, 167], -106, { C: [[214, 140]], B: [[94, 92]] })], tapete: true, dur: 2 });
  T('elevacao_pernas', 'Elevação de pernas deitado', { k: [deitado(104, G, { C: [[97, 97]], f: [180], B: [[94, 92]] }), deitado(104, G, { C: [[180, 180]], f: [270], B: [[94, 92]] })], tapete: true, dur: 2.2 });
  T('flutter', 'Flutter kicks / tesoura', { k: [deitado(104, G, { C: [[104, 104], [118, 118]], f: [180], B: [[94, 92]], h: 12, t: -86 }), deitado(104, G, { C: [[118, 118], [104, 104]], f: [180], B: [[94, 92]], h: 12, t: -86 })], tapete: true, dur: .9 });
  T('bicicleta_abdominal', 'Abdominal bicicleta', { k: [deitado(108, G, { C: [[200, 110], [100, 100]], M: [{ j: 'cab', d: [-3, 2] }], h: 20, t: -66 }), deitado(108, G, { C: [[100, 100], [200, 110]], M: [{ j: 'cab', d: [-3, 2] }], h: 20, t: -66 })], tapete: true, dur: 1.4 });
  T('dead_bug', 'Dead bug', { k: [deitado(108, G, { C: [[180, 90], [180, 90]], B: [[180, 180], [180, 180]] }), deitado(108, G, { C: [[180, 90], [100, 100]], B: [[-100, -100], [180, 180]] })], tapete: true, dur: 2.4 });
  T('hollow', 'Hollow body', { k: [deitado(108, G, { C: [[104, 104]], B: [[-108, -108]], t: -78, h: 12 }), deitado(108, G - 4, { C: [[112, 112]], B: [[-118, -118]], t: -70, h: 12 })], tapete: true, dur: 1.6 });
  T('v_up', 'V-up (canivete)', { k: [deitado(108, G, { C: [[96, 96]], f: [180], B: [[-96, -96]] }), deitado(108, G, { C: [[148, 148]], B: [[132, 132]], t: -38, h: 10 })], tapete: true, dur: 2 });
  T('v_sit', 'V-sit (sustentação)', { k: [deitado(108, G, { C: [[140, 140]], B: [[120, 120]], t: -42, h: 10 }), deitado(108, G, { C: [[144, 144]], B: [[124, 124]], t: -40, h: 10 })], tapete: true, dur: 3 });
  T('canivete_lateral', 'Canivete lateral', { v: 'frente', k: [{ q: [100, 164], t: 90, P: [[28, 172], [30, 158]], M: [[170, 174], { j: 'cab', d: [0, -4] }] }, { q: [100, 164], t: 74, P: [[28, 172], [40, 130]], M: [[170, 174], { j: 'cab', d: [0, -4] }] }], tapete: true, dur: 2 });
  T('russian_twist', 'Russian twist', { v: 'frente', k: [{ q: [100, 166], t: 6, C: [[160, 6]], cz: [.5], pz: [.8], M: [[128, 140], [118, 142]] }, { q: [100, 166], t: -6, C: [[160, 6]], cz: [.5], pz: [.8], M: [[82, 142], [72, 140]] }], tapete: true, dur: 1.6 });
  T('rotacao_cabo', 'Rotação de tronco (cabo/elástico)', { v: 'frente', k: [{ q: [100, 104], P: [[122, TZ]], M: [[146, 72], [138, 74]] }, { q: [100, 104], P: [[122, TZ]], M: [[62, 72], [54, 74]] }], p: 'polia', cabo: [190, 72], dur: 2.2 });
  T('woodchop', 'Wood chop (alto para baixo)', { v: 'frente', k: [{ q: [100, 104], P: [[124, TZ]], M: [[150, 28], [140, 34]] }, { q: [96, 116], t: -6, P: [[124, TZ]], M: [[64, 130], [56, 124]] }], p: 'polia', cabo: [190, 20], dur: 2.2 });
  T('lift', 'Lift diagonal (baixo para alto)', { v: 'frente', k: [{ q: [96, 116], t: -6, P: [[124, TZ]], M: [[64, 132], [56, 126]] }, { q: [100, 104], P: [[124, TZ]], M: [[150, 30], [140, 36]] }], p: 'polia', cabo: [14, 172], dur: 2.2 });
  T('pallof', 'Pallof press', { k: [EP({ P: [[112, TZ], [90, TZ]], M: [{ t: [38, 15] }] }), EP({ P: [[112, TZ], [90, TZ]], M: [{ t: [40, 52] }] })], p: 'polia', cabo: [96, 70], dur: 2.4 });
  T('flexao_lateral', 'Flexão lateral do tronco', { v: 'frente', k: [{ q: [100, 104], t: 10, B: [[0, 0]], M: [null, { t: [42, -24] }] }, { q: [100, 104], t: -14, B: [[0, 0]], M: [null, { t: [42, -24] }] }], uni: true, p: 'halter', dur: 2.2 });
  T('inclinacao_lateral', 'Inclinação lateral', { v: 'frente', k: [{ q: [100, 104], t: 0, B: [[160, 170], [6, 3]] }, { q: [100, 104], t: -20, B: [[150, 160], [6, 3]] }], dur: 2.8 });
  T('windmill', 'Windmill', { v: 'frente', k: [{ q: [100, 104], P: [[128, TZ]], B: [[180, 180], [6, 3]] }, { q: [108, 112], t: -52, P: [[128, TZ]], B: [[180, 180]], M: [null, { j: 't2', d: [4, -16] }] }], uni: true, p: 'kettlebell', dur: 3 });
  T('crunch_polia', 'Abdominal ajoelhado na polia', { k: [{ q: [110, 136], t: 10, C: [[0, -90]], M: [{ j: 'cab', d: [8, 4] }] }, { q: [106, 136], t: 74, h: 24, C: [[0, -90]], M: [{ j: 'cab', d: [8, 4] }] }], p: 'polia', cabo: [150, 24], tapete: true, dur: 2.2 });
  T('crunch_maquina', 'Abdominal na máquina', { k: [{ q: [90, 124], t: -6, C: [[88, 0]], M: [{ t: [38, 14] }] }, { q: [90, 124], t: 34, h: 10, C: [[88, 0]], M: [{ t: [38, 14] }] }], cena: [['maquina_abdominal', {}]], dur: 2.2 });
  T('elevacao_joelhos_suspenso', 'Elevação de joelhos suspenso', { k: [{ q: [100, 100], t: 0, C: [[0, 0]], M: [[100, 0]] }, { q: [102, 98], t: -6, C: [[96, 0]], M: [[100, 0]] }], cena: [['barra_fixa', { x: 100, y: 0 }]], dur: 2.2 });
  T('elevacao_pernas_suspenso', 'Elevação de pernas suspenso', { k: [{ q: [100, 100], t: 0, C: [[0, 0]], M: [[100, 0]] }, { q: [104, 96], t: -14, C: [[150, 150]], M: [[100, 0]] }], cena: [['barra_fixa', { x: 100, y: 0 }]], dur: 2.4 });
  T('elevacao_joelhos_paralelas', 'Elevação de joelhos na cadeira do capitão', { k: [{ q: [100, 100], t: 0, C: [[0, 0]], B: [[0, 90]] }, { q: [100, 100], t: -4, C: [[96, 0]], B: [[0, 90]] }], cena: [['cadeira_capitao', {}]], dur: 2.2 });
  T('roda_abdominal', 'Roda abdominal', { k: [{ q: [86, 140], t: 50, C: [[-27, -90]], M: [[124, 171]] }, { q: [103.8, 159.7], t: 82, C: [[-70, -90]], M: [[192, 171]] }], cena: [['roda', {}]], tapete: true, dur: 2.8 });
  T('mountain_climber', 'Mountain climber', { k: [linha([30, 172], [124, 122], -1, { M: [[128, TZ]], C: [[80, -26], null], P: [null, [30, 172]] }), linha([30, 172], [124, 122], -1, { M: [[128, TZ]], P: [[30, 172], null], C: [null, [80, -26]] })], dur: .9, lin: true });
  T('mountain_climber_cruzado', 'Mountain climber cruzado', { k: [linha([30, 172], [124, 122], -1, { M: [[128, TZ]], C: [[76, -26], null], P: [null, [30, 172]], zC: [.85, 1] }), linha([30, 172], [124, 122], -1, { M: [[128, TZ]], P: [[30, 172], null], C: [null, [76, -26]], zC: [1, .85] })], dur: 1.1, lin: true });
  T('canivete_bola', 'Canivete com pés na bola', { k: [linha([28, 128], [128, 122], -1, { M: [[132, TZ]], f: [0] }), linha([70, 136], [126, 122], 1, { M: [[132, TZ]], f: [20] })], extra: (S, J) => CENA.bola_suica(S, { x: J.t1.x - 2, y: J.t1.y + 26, r: 22, cam: 'fundo' }), dur: 2.4 });
  T('pike_suspenso', 'Pike com pés suspensos/deslizantes', { k: [linha([28, 166], [128, 122], -1, { M: [[132, TZ]], f: [0] }), linha([76, 168], [126, 124], 1, { M: [[132, TZ]], f: [10] })], dur: 2.4 });
  T('prancha_pes_elevados', 'Prancha com pés elevados', { k: [linha([30, 136], [124, 145], -1, { B: [[0, 90]], f: [0] }), linha([30, 136], [124, 143], -1, { B: [[0, 90]], f: [0] })], cena: [['banco', { id: 'apoio', x0: 6, x1: 50, y: 140 }]], dur: 3 });
  T('prancha_bola', 'Prancha com antebraços na bola', { k: [linha([16, 172], [118, 112], -1, { B: [[-6, 86]] }), linha([16, 172], [118, 110], -1, { B: [[-6, 86]] })], extra: (S, J) => CENA.bola_suica(S, { x: J.co1.x + 12, y: J.co1.y + 30, r: 26, cam: 'fundo' }), dur: 3 });
  T('l_sit', 'L-sit', { k: [{ q: [100, 141], t: -2, C: [[90, 90]], f: [180], M: [[100, 151]] }, { q: [100, 139], t: -4, C: [[92, 92]], f: [180], M: [[100, 151]] }], cena: [['paralelas', { x0: 76, x1: 124, y: 154 }]], dur: 3 });
  T('dragon_flag', 'Dragon flag', { k: [porOmbro([60, 126], -150, { C: [[150, 150]], M: [[38, 132]] }), porOmbro([60, 126], -104, { C: [[104, 104]], M: [[38, 132]] })], cena: [['banco', { x0: 30, x1: 130, y: 138 }]], dur: 3 });
  T('stir_pot', 'Stir the pot', { k: [linha([16, 172], [118, 112], -1, { B: [[-6, 86]] }), linha([16, 172], [122, 110], -1, { B: [[2, 92]] }), linha([16, 172], [116, 108], -1, { B: [[-10, 82]] })], extra: (S, J, ctx) => CENA.bola_suica(S, { x: ctx.J0.co1.x + 12, y: ctx.J0.co1.y + 30, r: 26, cam: 'fundo' }), dur: 2.4, lin: true });
  T('vacuum', 'Vácuo abdominal', { k: [EP({ M: [{ t: [6, 10] }] }), EP({ M: [{ t: [6, 10] }], e: 1, h: 4 })], dur: 3 });
  T('prancha_reversa', 'Prancha reversa', { k: [{ q: [96, 132], t: -100, P: [[166, TZ]], f: [150], M: [[62, TZ]], sM: [1] }, { q: [96, 130], t: -102, P: [[166, TZ]], f: [150], M: [[62, TZ]], sM: [1] }], tapete: true, dur: 3 });

  // ===== CARDIO / FUNCIONAL
  const corridaK = (amp, y, tq) => [
    { q: [100, y], t: tq, C: [[30 * amp, 8 * amp], [-26 * amp, -70 * amp]], B: [[-36 * amp, 50], [40 * amp, 120]] },
    { q: [100, y - 5], t: tq, C: [[-4, -50 * amp], [60 * amp, -6]], B: [[0, 70], [0, 70]] },
    { q: [100, y], t: tq, C: [[-26 * amp, -70 * amp], [30 * amp, 8 * amp]], B: [[40 * amp, 120], [-36 * amp, 50]] },
    { q: [100, y - 5], t: tq, C: [[60 * amp, -6], [-4, -50 * amp]], B: [[0, 70], [0, 70]] },
  ];
  T('corrida', 'Corrida', { k: corridaK(1, 106, 10), dur: .8, lin: true, passos: 4, pausa: 0 });
  T('corrida_esteira', 'Corrida na esteira', { k: corridaK(1, 94, 8), cena: [['esteira', { x0: 36, x1: 172 }]], dur: .8, lin: true, passos: 4, pausa: 0, solo: G - 14 });
  T('caminhada', 'Caminhada', { k: [
    { q: [100, 105], t: 2, C: [[22, 18], [-18, -20]], B: [[-20, -10], [22, 40]] },
    { q: [100, 104], t: 2, C: [[0, -12], [6, 2]], B: [[0, 6], [0, 6]] },
    { q: [100, 105], t: 2, C: [[-18, -20], [22, 18]], B: [[22, 40], [-20, -10]] },
    { q: [100, 104], t: 2, C: [[6, 2], [0, -12]], B: [[0, 6], [0, 6]] }], dur: 1.4, lin: true, passos: 4, pausa: 0 });
  T('caminhada_esteira', 'Caminhada na esteira', { k: [
    { q: [100, 93], t: 6, C: [[22, 18], [-18, -20]], B: [[-20, -10], [22, 40]] },
    { q: [100, 92], t: 6, C: [[0, -12], [6, 2]], B: [[0, 6], [0, 6]] },
    { q: [100, 93], t: 6, C: [[-18, -20], [22, 18]], B: [[22, 40], [-20, -10]] },
    { q: [100, 92], t: 6, C: [[6, 2], [0, -12]], B: [[0, 6], [0, 6]] }], cena: [['esteira', { x0: 36, x1: 172 }]], dur: 1.4, lin: true, passos: 4, pausa: 0 });
  T('caminhada_carga', 'Caminhada com carga', { k: [
    { q: [100, 105], t: 2, C: [[20, 16], [-16, -18]], B: [[-2, 0]] },
    { q: [100, 104], t: 2, C: [[0, -12], [6, 2]], B: [[-2, 0]] },
    { q: [100, 105], t: 2, C: [[-16, -18], [20, 16]], B: [[-2, 0]] },
    { q: [100, 104], t: 2, C: [[6, 2], [0, -12]], B: [[-2, 0]] }], pg: { kb: 'lado', halteres: 'lado', halter: 'lado', bola: 'goblet', mochila: 'lado', barra: 'costas', _: 'lado' }, mochila: 'mao', dur: 1.4, lin: true, passos: 4, pausa: 0 });
  T('caminhada_acima', 'Caminhada com carga acima da cabeça', { k: [
    { q: [100, 105], t: 2, C: [[20, 16], [-16, -18]], B: [[176, 178], [-2, 0]] },
    { q: [100, 104], t: 2, C: [[0, -12], [6, 2]], B: [[176, 178], [-2, 0]] },
    { q: [100, 105], t: 2, C: [[-16, -18], [20, 16]], B: [[176, 178], [-2, 0]] },
    { q: [100, 104], t: 2, C: [[6, 2], [0, -12]], B: [[176, 178], [-2, 0]] }], uni: true, p: 'kettlebell', dur: 1.4, lin: true, passos: 4, pausa: 0 });
  T('caminhada_tandem', 'Caminhada calcanhar-ponta', { k: [{ q: [100, 104], t: 2, P: [[112, TZ], [99, TZ]], B: [[70, 76], [-70, -66]] }, { q: [104, 104], t: 2, P: [[112, TZ]], C: [null, [12, -30]], B: [[70, 76], [-70, -66]] }, { q: [112, 104], t: 2, P: [[126, TZ], [112, TZ]], B: [[70, 76], [-70, -66]] }], dur: 2.4 });
  T('caminhada_lateral', 'Caminhada lateral', { v: 'frente', k: [{ q: [100, 104], P: [[112, TZ], [88, TZ]] }, { q: [108, 105], P: [[132, TZ], [88, TZ]] }, { q: [118, 104], P: [[132, TZ], [106, TZ]] }], pg: { _: 'cintura' }, band: 'tornozelo', dur: 1.8 });
  T('marcha', 'Marcha (joelho alto)', { k: [{ q: [100, 104], t: 2, C: [[80, 0], [0, 0]], B: [[-30, 0], [40, 110]] }, { q: [100, 104], t: 2, C: [[0, 0], [80, 0]], B: [[40, 110], [-30, 0]] }], dur: 1.4 });
  T('skipping', 'Skipping (joelho alto)', { k: [{ q: [100, 100], t: 2, C: [[92, -4], [-2, -6]], f: [null, 50], B: [[-40, 40], [50, 130]] }, { q: [100, 100], t: 2, C: [[-2, -6], [92, -4]], f: [50, null], B: [[50, 130], [-40, 40]] }], dur: .6, pausa: 0 });
  T('anfersen', 'Calcanhar no glúteo', { k: [{ q: [100, 102], t: 6, C: [[-6, -150], [4, 0]], B: [[-30, 60], [30, 120]] }, { q: [100, 102], t: 6, C: [[4, 0], [-6, -150]], B: [[30, 120], [-30, 60]] }], dur: .6, pausa: 0 });
  T('marcha_sentado', 'Marcha sentado', { k: [{ q: [86, 126], t: -2, C: [[64, -6], [90, 0]], B: [[-30, 30], [30, 100]] }, { q: [86, 126], t: -2, C: [[90, 0], [64, -6]], B: [[30, 100], [-30, 30]] }],
    cena: [['cadeira', { id: 'apoio', x: 88, y: 138, costas: -1 }]], dur: 1.4 });
  T('boxe_sentado', 'Socos sentado', { k: [{ q: [86, 126], t: -2, C: [[90, 0]], B: [[90, 90], [40, 160]] }, { q: [86, 126], t: -2, C: [[90, 0]], B: [[40, 160], [90, 90]] }], cena: [['cadeira', { id: 'apoio', x: 88, y: 138, costas: -1 }]], dur: .9 });
  T('polichinelo', 'Polichinelo', { v: 'frente', k: [{ q: [100, 104], C: [[3, 0]], B: [[8, 4]] }, { q: [100, 98], C: [[20, 18]], B: [[160, 166]] }], dur: 1 });
  T('polichinelo_baixo', 'Polichinelo sem salto', { v: 'frente', k: [{ q: [100, 104], C: [[3, 0]], B: [[8, 4]] }, { q: [100, 104], C: [[3, 0], [24, 22]], B: [[160, 166]] }, { q: [100, 104], C: [[3, 0]], B: [[8, 4]] }, { q: [100, 104], C: [[24, 22], [3, 0]], B: [[160, 166]] }], dur: 2 });
  T('polichinelo_frontal', 'Polichinelo frontal (seal jack)', { v: 'frente', k: [{ q: [100, 104], C: [[3, 0]], B: [[90, 90]], za: [.4], zB: [.5] }, { q: [100, 98], C: [[20, 18]], B: [[88, 90]] }], dur: 1 });
  T('squat_jack', 'Agachamento com polichinelo', { v: 'frente', k: [{ q: [100, 100], C: [[3, 0]], M: [{ t: [30, 6] }] }, { q: [100, 132], P: [[128, TZ]], M: [{ t: [30, 6] }] }], dur: 1.1 });
  T('salto_estrela', 'Salto estrela', { v: 'frente', k: [{ q: [100, 132], P: [[112, TZ]], B: [[20, 10]] }, { q: [100, 86], C: [[30, 30]], B: [[140, 145]] }], dur: 1.2 });
  T('burpee', 'Burpee', { k: [
    EP({ B: [[-4, -2]] }),
    { q: [84, 148], t: 50, P: [[103, TZ], [97, TZ]], M: [[128, TZ]] },
    linha([28, 172], [124, 122], -1, { M: [[128, TZ]] }),
    { q: [84, 148], t: 50, P: [[103, TZ], [97, TZ]], M: [[128, TZ]] },
    { q: [100, 86], t: 0, P: [[103, 158], [97, 158]], f: [40, 40], B: [[170, 175]] }], qd: [1, 2, 4], dur: 3.2, pausa: 0 });
  T('squat_thrust', 'Squat thrust', { k: [
    { q: [84, 148], t: 50, P: [[103, TZ], [97, TZ]], M: [[128, TZ]] },
    linha([28, 172], [124, 122], -1, { M: [[128, TZ]] })], dur: 1.6 });
  T('burpee_inclinado', 'Burpee inclinado (apoio elevado)', { k: [EP({ B: [[-4, -2]] }), linha([50, 172], [126, 96], -1, { M: [[132, 136]] })], cena: [['cadeira', { id: 'apoio', x: 146, y: 138, costas: 1 }]], dur: 2.4 });
  T('inchworm', 'Inchworm (lagarta)', { k: [EP({ B: [[-4, -2]] }), { q: [96, 104], t: 140, P: [[103, TZ], [97, TZ]], M: [[124, TZ]] }, linha([100, 172], [194, 122], -1, { M: [[198, TZ]] }), { q: [96, 104], t: 140, P: [[103, TZ], [97, TZ]], M: [[124, TZ]] }], dur: 4 });
  T('pular_corda', 'Pular corda', { v: 'frente', k: [{ q: [100, 102], C: [[2, 0]], f: [0], M: [[126, 110]], sM: [1] }, { q: [100, 94], C: [[2, 0]], M: [[126, 104]], sM: [1] }], p: 'corda_pular', dur: .7, lin: true });
  T('skater', 'Salto patinador (skater)', { v: 'frente', k: [{ q: [122, 128], t: -10, P: [[128, TZ], [104, 156]], B: [[40, 30], [-20, -10]] }, { q: [78, 128], t: 10, P: [[96, 156], [72, TZ]], B: [[-20, -10], [40, 30]] }], dur: 1.4 });
  T('deslocamento_lateral', 'Deslocamento lateral (shuffle)', { v: 'frente', k: [{ q: [96, 126], P: [[128, TZ], [70, TZ]], M: [{ t: [26, 24] }] }, { q: [112, 122], P: [[136, TZ], [96, TZ]], M: [{ t: [26, 24] }] }],
    cena: [['cones', { xs: [30, 180] }]], dur: .9 });
  T('salto_lateral', 'Saltos laterais', { v: 'frente', k: [{ q: [80, 116], P: [[90, TZ], [72, TZ]], M: [{ t: [26, 20] }] }, { q: [100, 96], P: [[110, 160], [92, 160]], M: [{ t: [30, 24] }] }, { q: [120, 116], P: [[128, TZ], [110, TZ]], M: [{ t: [26, 20] }] }, { q: [100, 96], P: [[110, 160], [92, 160]], M: [{ t: [30, 24] }] }],
    cena: [['cones', { xs: [100] }]], dur: 1.6, pausa: 0 });
  T('pes_rapidos', 'Pés rápidos', { k: [{ q: [96, 118], t: 22, P: [[110, TZ - 6], [92, TZ]], f: [60, null], B: [[40, 100], [20, 90]] }, { q: [96, 118], t: 22, P: [[110, TZ], [92, TZ - 6]], f: [null, 60], B: [[20, 90], [40, 100]] }], dur: .5, pausa: 0 });
  T('escada_agilidade', 'Escada de agilidade', { k: [{ q: [80, 110], t: 12, C: [[40, -10], [-14, -28]], B: [[-30, 40], [40, 110]] }, { q: [104, 108], t: 12, C: [[-14, -28], [40, -10]], B: [[40, 110], [-30, 40]] }, { q: [128, 110], t: 12, C: [[40, -10], [-14, -28]], B: [[-30, 40], [40, 110]] }],
    cena: [['escada_agilidade', {}]], dur: 1.2, lin: true });
  T('split_step', 'Split step (prontidão)', { v: 'frente', k: [{ q: [100, 104], P: [[112, TZ]], M: [{ t: [28, 22] }, { t: [30, -10] }] }, { q: [100, 96], P: [[112, 166]], M: [{ t: [28, 22] }, { t: [30, -10] }] }, { q: [100, 124], P: [[128, TZ]], M: [{ t: [28, 24] }, { t: [30, -10] }] }], p: 'raquete', dur: 1.4 });
  T('salto', 'Salto vertical', { k: [EP({ q: [82, 136], t: 36, B: [[-40, -30]] }), EP({ q: [100, 74], t: 2, P: [[103, 148], [97, 148]], f: [40, 40], B: [[170, 172]] })], dur: 1.4 });
  T('salto_caixa', 'Salto na caixa (box jump)', { k: [EP({ q: [74, 136], t: 36, P: [[90, TZ], [86, TZ]], B: [[-40, -30]] }), { q: [128, 96], t: 30, P: [[146, 126], [142, 126]], B: [[60, 80]] }], cena: [['caixa', { id: 'apoio', x0: 122, x1: 176, y: 130 }]], dur: 1.8 });
  T('salto_grupado', 'Salto grupado', { k: [EP({ q: [86, 128], t: 24, B: [[-30, -20]] }), { q: [100, 70], t: 6, C: [[110, -20]], B: [[60, 120]] }], dur: 1.2 });
  T('salto_distancia', 'Salto em distância', { k: [EP({ q: [70, 136], t: 40, P: [[90, TZ], [84, TZ]], B: [[-50, -40]] }), { q: [116, 82], t: 10, C: [[60, -40], [40, -50]], B: [[150, 160]] }, EP({ q: [150, 136], t: 36, P: [[172, TZ], [166, TZ]], B: [[70, 80]] })], dur: 2 });
  T('salto_unipodal', 'Salto unipodal com estabilização', { k: [{ q: [96, 128], t: 26, P: [[103, TZ]], C: [null, [-10, -60]], B: [[-30, -10]] }, { q: [102, 88], t: 4, P: [[105, 160]], C: [null, [20, -40]], B: [[100, 110]] }], dur: 1.6 });
  T('pogo', 'Saltos pogo', { k: [EP({ q: [100, 102], P: [[103, TZ - 2], [97, TZ - 2]], f: [60, 60], B: [[20, 40]] }), EP({ q: [100, 90], P: [[103, 162], [97, 162]], f: [40, 40], B: [[30, 60]] })], dur: .55, pausa: 0 });
  T('bike', 'Bicicleta ergométrica', { k: () => {
    const cx = 116, cy = 152, r = 13, ks = [];
    for (let i = 0; i < 8; i++) {
      const a = i * 45 * R;
      ks.push({ q: [88, 104], t: 34, P: [[cx + r * Math.sin(a), cy - r * Math.cos(a)], [cx - r * Math.sin(a), cy + r * Math.cos(a)]], f: [96 + 14 * Math.sin(a), 96 - 14 * Math.sin(a)], M: [[146, 86]] });
    }
    return ks; }, cena: [['bicicleta', { cx: 116, cy: 152, gx: 160, gy: 140, guidao: [148, 90] }]], dur: 1.1, lin: true, passos: 2, pausa: 0 });
  T('bike_em_pe', 'Bike em pé (subida)', { k: () => {
    const cx = 116, cy = 152, r = 13, ks = [];
    for (let i = 0; i < 8; i++) {
      const a = i * 45 * R;
      ks.push({ q: [106, 92], t: 30, P: [[cx + r * Math.sin(a), cy - r * Math.cos(a)], [cx - r * Math.sin(a), cy + r * Math.cos(a)]], f: [80, 80], M: [[150, 88]] });
    }
    return ks; }, cena: [['bicicleta', { cx: 116, cy: 152, gx: 160, gy: 140, guidao: [150, 92] }]], dur: 1.2, lin: true, passos: 2, pausa: 0 });
  T('bike_reclinada', 'Bicicleta horizontal', { k: () => {
    const cx = 154, cy = 142, r = 12, ks = [];
    for (let i = 0; i < 8; i++) {
      const a = i * 45 * R;
      ks.push({ q: [82, 138], t: -24, P: [[cx + r * Math.sin(a), cy - r * Math.cos(a)], [cx - r * Math.sin(a), cy + r * Math.cos(a)]], f: [170, 170], M: [{ t: [4, 12] }] });
    }
    return ks; }, extra: (S, J, ctx) => { almofada(S, Q(ctx.J0, 24, -14), ctx.J0.up, 52, 10, 'fundo'); S.ret(66, 146, 36, 9, 4.5, C.estofado, 'fundo'); S.ret(40, G - 6, 140, 6, 3, C.metal2, 'fundo'); S.cap(V(84, 150), V(84, G - 3), 6, C.metal, 'fundo'); S.cap(V(84, 160), V(154, 142), 6, C.azul, 'fundo'); S.circ(V(154, 142), 5, C.metal2, 'meio'); for (const k of [2, 1]) S.cap(V(154, 142), J['t' + k], 3.4, C.metal2, k === 1 ? 'perto' : 'meio'); }, dur: 1.2, lin: true, passos: 2, pausa: 0 });
  T('eliptico', 'Elíptico', { k: () => {
    const ks = [];
    for (let i = 0; i < 6; i++) {
      const a = i * 60 * R;
      ks.push({ q: [96, 92], t: 6, P: [[100 + 18 * Math.sin(a), 162 - 7 * Math.cos(a)], [100 - 18 * Math.sin(a), 162 + 7 * Math.cos(a)]], f: [90, 90], M: [[128 + 10 * Math.sin(a), 70], [128 - 10 * Math.sin(a), 70]] });
    }
    return ks; }, cena: [['eliptico', { fx: 176, fy: 128, py: 34 }]], dur: 1.4, lin: true, passos: 3, pausa: 0 });
  T('remo', 'Remo ergômetro', { k: [{ q: [96, 150], t: 26, P: [[150, 158]], f: [60], M: [[172, 122]] }, { q: [60, 150], t: -24, P: [[150, 158]], f: [64], M: [{ t: [36, 16] }] }], cena: [['remo', { y: 158 }]], dur: 2.2 });
  T('escada_ergometrica', 'Escada ergométrica', { k: [{ q: [100, 92], t: 10, P: [[118, 146], [98, 164]], M: [[140, 80]] }, { q: [102, 88], t: 10, P: [[116, 160], [104, 146]], M: [[140, 80]] }],
    extra: (S, J, ctx) => { for (let i = 0; i < 4; i++) S.ret(82 + i * 18, 136 + i * 0 + (i % 2) * 14, 40, 6, 3, C.metal3, 'fundo'); S.cap(V(150, 180), V(150, 66), 6, C.metal, 'fundo'); S.cap(V(150, 74), V(130, 82), 5, C.metal2, 'fundo'); S.ret(70, G - 12, 100, 12, 5, C.metal, 'fundo'); }, dur: 1.2 });
  T('corda_naval', 'Corda naval', { k: [{ q: [88, 130], t: 30, P: [[110, TZ], [92, TZ]], M: [{ t: [30, 34] }, { t: [16, 30] }] }, { q: [88, 130], t: 30, P: [[110, TZ], [92, TZ]], M: [{ t: [16, 30] }, { t: [30, 34] }] }], p: 'corda_naval', dur: .7 });
  T('corda_naval_dupla', 'Corda naval (batida dupla)', { k: [{ q: [88, 128], t: 26, P: [[110, TZ], [92, TZ]], M: [{ t: [44, 34] }] }, { q: [86, 136], t: 36, P: [[110, TZ], [92, TZ]], M: [{ t: [12, 32] }] }], p: 'corda_naval', dur: .9 });
  T('kb_swing', 'Kettlebell swing', { k: [{ q: [72, 116], t: 72, P: [[103, TZ], [97, TZ]], B: [[-28, -24]] }, EP({ t: -2, B: [[90, 90]] })], p: 'kettlebell', kbBalanco: true, dur: 1.6 });
  T('kb_swing_americano', 'Kettlebell swing americano', { k: [{ q: [72, 116], t: 72, P: [[103, TZ], [97, TZ]], B: [[-28, -24]] }, EP({ t: -4, B: [[172, 174]] })], p: 'kettlebell', kbBalanco: true, dur: 1.8 });
  T('treno', 'Empurrar trenó', { k: [{ q: [96, 112], t: 52, P: [[124, TZ], [62, 170]], f: [null, 40], M: [[150, 98]] }, { q: [96, 112], t: 52, P: [[124, 166], [74, TZ]], f: [40, null], C: [[60, -20], null], M: [[150, 98]] }], cena: [['treno', {}]], dur: 1.2 });
  T('treno_puxar', 'Arrastar trenó', { k: [{ q: [96, 112], t: -20, P: [[124, TZ], [76, TZ]], M: [{ t: [30, 26] }] }, { q: [90, 112], t: -22, P: [[110, TZ], [70, TZ]], M: [{ t: [26, 22] }] }], cena: [['treno_corda', { x: 176 }]], dur: 1.4 });
  T('carregamento_abraco', 'Caminhada abraçando carga', { k: [{ q: [100, 106], t: -4, C: [[20, 16], [-16, -18]], M: [{ t: [26, 22] }] }, { q: [100, 106], t: -4, C: [[-16, -18], [20, 16]], M: [{ t: [26, 22] }] }], p: 'saco_areia', dur: 1.4 });
  T('clean', 'Clean (arranco ao peito)', { k: [{ q: [74, 130], t: 54, P: [[103, TZ], [97, TZ]], M: [[112, 162]] }, EP({ t: -4, P: [[103, 168], [97, 168]], f: [50, 50], M: [[104, 112]] }), EP({ q: [94, 120], t: 10, M: [{ t: [44, 14] }], sM: [1] })], p: 'barra', placa: 17, dur: 2.4 });
  T('thruster', 'Thruster', { k: [EP({ q: [84, 142], t: 22, M: [{ t: [44, 14] }], sM: [1] }), EP({ t: 0, B: [[176, 178]] })], p: 'barra', dur: 2 });
  T('snatch', 'Snatch (arranco)', { k: [{ q: [72, 130], t: 56, P: [[103, TZ], [97, TZ]], M: [[112, 162]] }, EP({ t: -2, P: [[103, 168], [97, 168]], f: [50, 50], B: [[0, 0]] }), EP({ q: [92, 128], t: 12, B: [[170, 174]] })], p: 'barra', placa: 17, dur: 2.4 });
  T('slam', 'Slam (arremesso no chão)', { k: [EP({ t: -6, P: [[103, 170], [97, 170]], f: [50, 50], B: [[172, 176]] }), { q: [82, 132], t: 52, P: [[103, TZ], [97, TZ]], M: [[124, 164]] }], p: 'medicine_ball', dur: 1.4 });
  T('wall_ball', 'Wall ball', { k: [EP({ q: [84, 140], t: 26, M: [{ t: [34, 18] }] }), EP({ t: 0, B: [[160, 165]] })], p: 'medicine_ball', cena: [['parede', { x: 166, lado: 1, top: -10 }]], dur: 2 });
  T('arremesso_cima', 'Arremesso acima da cabeça', { k: [EP({ P: [[118, TZ], [84, TZ]], t: -10, B: [[190, 230]] }), EP({ P: [[118, TZ], [84, TZ]], t: 10, B: [[130, 130]] })], p: 'medicine_ball', cena: [['parede', { x: 180, lado: 1, top: -10 }]], dur: 1.4 });
  T('arremesso_tras', 'Arremesso para trás', { k: [{ q: [84, 136], t: 40, P: [[103, TZ], [97, TZ]], M: [[118, 156]] }, EP({ t: -24, P: [[103, 170], [97, 170]], f: [50, 50], B: [[200, 210]] })], p: 'medicine_ball', dur: 1.6 });
  T('arremesso_rotacional', 'Arremesso rotacional', { v: 'frente', k: [{ q: [96, 116], t: -6, P: [[124, TZ]], M: [[64, 126], [56, 120]] }, { q: [100, 106], P: [[124, TZ]], M: [[150, 74], [140, 78]] }], p: 'medicine_ball', dur: 1.6 });
  T('turkish', 'Levantamento turco (Turkish get-up)', { k: [
    deitado(110, G, { P: [[136, TZ]], C: [null, [94, 94]], B: [[180, 180], [-140, -150]] }),
    { q: [104, 162], t: -40, C: [[84, 0], [94, 94]], B: [[180, 180]], M: [null, [72, TZ]] },
    { q: [100, 134], t: 0, P: [[124, TZ], [64, 172]], f: [null, -20], B: [[180, 180], [-20, -10]] },
    EP({ B: [[180, 180], [-6, 0]] })], uni: true, p: 'kettlebell', dur: 5 });
  T('virada_pneu', 'Virada de pneu', { k: [{ q: [80, 140], t: 54, P: [[100, TZ], [94, TZ]], M: [[126, 168]] }, EP({ t: 8, P: [[110, TZ], [94, TZ]], M: [[136, 70]] })], cena: [['pneu_virando', { px: 200 }]], dur: 2.6 });
  T('marreta', 'Marretada no pneu', { k: [EP({ t: -6, P: [[110, TZ], [88, TZ]], B: [[200, 230]] }), EP({ q: [94, 116], t: 40, P: [[110, TZ], [88, TZ]], B: [[66, 76]] })], cena: [['pneu_chao', { x: 168, w: 56 }], ['marreta', {}]], uni: true, dur: 1.4 });
  T('boxe', 'Boxe (socos)', { k: [{ q: [96, 108], t: 8, P: [[114, TZ], [84, TZ]], B: [[92, 92], [30, 150]] }, { q: [96, 108], t: 8, P: [[114, TZ], [84, TZ]], B: [[30, 150], [92, 92]] }], dur: .8 });
  T('chute', 'Chute frontal', { k: [{ q: [96, 106], t: 6, P: [[106, TZ], [88, TZ]], B: [[30, 150], [20, 150]] }, { q: [92, 104], t: -14, P: [null, [88, TZ]], C: [[96, 94]], B: [[30, 150], [20, 150]] }], dur: 1.1 });
  T('joelhada', 'Joelhada', { k: [{ q: [96, 106], t: 6, P: [[106, TZ], [88, TZ]], B: [[110, 120], [100, 120]] }, { q: [96, 104], t: 2, C: [[96, -10]], P: [null, [92, TZ]], B: [[30, 10], [20, 10]] }], dur: 1 });
  T('caranguejo', 'Caminhada do caranguejo', { k: [{ q: [96, 132], t: -100, P: [[150, TZ], [138, TZ]], f: [92, 92], M: [[66, TZ], [54, TZ]], sM: [1] }, { q: [104, 130], t: -98, P: [[138, TZ], [154, TZ]], f: [92, 92], M: [[54, TZ], [70, TZ]], sM: [1] }], tapete: true, dur: 1.2 });
  T('engatinhar_urso', 'Bear crawl', { k: [{ q: [80, 128], t: 72, C: [[10, -60], [-10, -70]], f: [0], M: [[122, TZ], [112, TZ]] }, { q: [86, 128], t: 72, C: [[-10, -70], [10, -60]], f: [0], M: [[118, TZ], [130, TZ]] }], tapete: true, dur: 1.2 });
  T('levantar_chao', 'Levantar do chão', { k: [
    { q: [96, 166], t: -10, C: [[88, -10], [86, -12]], M: [[70, TZ]], sM: [1] },
    { q: [100, 136], t: 4, P: [[124, TZ], [64, 172]], f: [null, -20], M: [{ j: 'j1', d: [-4, -8] }] },
    EP({ B: [[-4, -2]] })], dur: 3.6 });
  T('sentar_levantar', 'Sentar e levantar da cadeira', { k: [{ q: [78, 126], t: 24, P: [[106, TZ], [100, TZ]], B: [[84, 86]] }, EP({ q: [96, 104], P: [[106, TZ], [100, TZ]], B: [[40, 40]] })],
    cena: [['cadeira', { id: 'apoio', x: 80, y: 138, costas: -1 }]], pg: { kb: 'goblet', halter: 'goblet', halteres: 'goblet', mochila: 'goblet', _: { B: [[84, 86]] } }, dur: 2.6 });
  T('agachamento_banco', 'Agachamento até o banco', { k: [{ q: [80, 128], t: 30, P: [[108, TZ], [102, TZ]], B: [[84, 86]] }, EP({ q: [100, 104], P: [[108, TZ], [102, TZ]], B: [[40, 40]] })],
    cena: [['banco', { id: 'apoio', x0: 50, x1: 98, y: 136 }]], pg: { kb: 'goblet', halter: 'goblet', halteres: 'lado', barra: 'costas', _: { B: [[84, 86]] } }, dur: 2.6 });
  T('agachamento_mini', 'Mini agachamento com apoio', { k: [EP({ q: [96, 104], P: [[100, TZ], [94, TZ]], M: [[150, 98]] }), EP({ q: [88, 124], t: 22, P: [[100, TZ], [94, TZ]], M: [[150, 100]] })],
    cena: [['cadeira', { id: 'apoio', x: 164, y: 138, costas: -1 }]], dur: 2.4 });

  // ===== EQUILIBRIO / 50+
  T('equilibrio', 'Equilíbrio unipodal', { k: [{ q: [100, 104], t: 2, P: [[103, TZ]], C: [null, [60, -20]], B: [[70, 80], [-60, -40]] }, { q: [101, 104], t: 4, P: [[103, TZ]], C: [null, [64, -16]], B: [[60, 70], [-50, -30]] }], pg: { halter: { B: [[-2, 0]] }, halteres: { B: [[-2, 0]] } }, dur: 3 });
  T('equilibrio_apoio', 'Equilíbrio unipodal com apoio', { k: [{ q: [96, 104], t: 2, P: [[99, TZ]], C: [null, [50, -20]], M: [[146, 96]] }, { q: [97, 104], t: 4, P: [[99, TZ]], C: [null, [56, -16]], M: [[146, 96]] }], cena: [['cadeira', { id: 'apoio', x: 158, y: 136, costas: -1 }]], dur: 3 });
  T('tandem', 'Equilíbrio em tandem', { k: [{ q: [104, 104], t: 2, P: [[114, TZ], [100, TZ]], B: [[60, 70], [-50, -40]] }, { q: [105, 104], t: 4, P: [[114, TZ], [100, TZ]], B: [[70, 80], [-40, -30]] }], dur: 3 });
  T('alcance', 'Alcance funcional', { k: [EP({ B: [[60, 70]] }), EP({ q: [92, 104], t: 20, P: [[103, TZ], [97, TZ]], f: [70, 70], B: [[90, 92]] })], dur: 2.6 });
  T('relogio', 'Relógio de equilíbrio', { k: [{ q: [100, 106], t: 6, P: [[103, TZ]], C: [null, [50, 50]], B: [[60, 60], [-30, -20]] }, { q: [100, 108], t: 4, P: [[103, TZ]], C: [null, [-40, -40]], B: [[60, 60], [-30, -20]] }], dur: 2.6 });
  T('aviao_quadril', 'Avião de quadril', { k: [{ q: [96, 106], t: 80, P: [[103, TZ]], C: [null, [-80, -80]], B: [[-20, 0], [30, 20]] }, { q: [96, 106], t: 80, P: [[103, TZ]], C: [null, [-70, -70]], zC: [1, .7], B: [[-20, 0], [20, 10]] }], dur: 2.6 });
  T('transferencia_peso', 'Transferência de peso', { v: 'frente', k: [{ q: [90, 105], t: -3, P: [[114, TZ], [86, TZ]], M: [{ t: [6, 15] }] }, { q: [110, 105], t: 3, P: [[114, TZ], [86, TZ]], M: [{ t: [6, 15] }] }], dur: 2.4 });
  T('passo_cruzado', 'Passo cruzado lateral', { v: 'frente', k: [{ q: [96, 104], P: [[110, TZ], [86, TZ]], B: [[40, 30]] }, { q: [106, 106], P: [[110, TZ], [122, 172]], B: [[40, 30]] }, { q: [118, 104], P: [[136, TZ], [122, TZ]], B: [[40, 30]] }], dur: 1.8 });
  T('obstaculos', 'Marcha sobre obstáculos', { k: [{ q: [90, 104], t: 2, C: [[60, -10], [0, 0]], B: [[-20, 0], [20, 40]] }, { q: [110, 104], t: 2, C: [[0, 0], [60, -10]], B: [[20, 40], [-20, 0]] }], cena: [['cones', { xs: [128] }]], dur: 2 });

  // ===== RAQUETE
  T('forehand', 'Golpe de forehand', { v: 'frente', k: [{ q: [100, 112], t: 6, P: [[128, TZ]], M: [[160, 112], { t: [30, -16] }] }, { q: [100, 112], t: -6, P: [[128, TZ]], M: [[66, 46], { t: [26, 14] }] }], p: 'raquete', uni: true, dur: 1.6 });
  T('backhand', 'Golpe de backhand', { v: 'frente', k: [{ q: [100, 112], t: -6, P: [[128, TZ]], M: [[74, 106], { t: [26, -10] }] }, { q: [100, 112], t: 6, P: [[128, TZ]], M: [[160, 54], { t: [26, -16] }] }], p: 'raquete', uni: true, dur: 1.6 });
  T('smash', 'Smash / saque', { k: [{ q: [96, 104], t: -10, P: [[112, TZ], [80, TZ]], B: [[170, 320], [120, 130]] }, { q: [100, 106], t: 14, P: [[116, TZ], [88, TZ]], B: [[100, 90], [-10, 0]] }], p: 'raquete', uni: true, dur: 1.4 });
  T('voleio', 'Voleio na parede', { k: [{ q: [96, 112], t: 16, P: [[114, TZ], [80, TZ]], B: [[70, 130], [40, 120]] }, { q: [96, 112], t: 16, P: [[114, TZ], [80, TZ]], B: [[90, 100], [40, 120]] }], p: 'raquete', uni: true, cena: [['parede', { x: 176, lado: 1 }]], dur: .9 });
  T('oito_raquete', 'Oito com a raquete', { k: [EP({ B: [[40, 80]], pu: [60] }), EP({ B: [[40, 80]], pu: [120] })], p: 'raquete', uni: true, dur: 1.4 });
  T('reacao_bola', 'Reação com bola', { k: [{ q: [92, 116], t: 26, P: [[112, TZ], [84, TZ]], B: [[70, 110], [40, 100]] }, { q: [96, 124], t: 34, P: [[118, TZ], [84, TZ]], M: [[134, 150]], B: [null, [40, 100]] }], p: 'bola_tenis', bolinha: null, dur: 1.4 });

  // ===== MOBILIDADE / ALONGAMENTO
  T('gato_camelo', 'Gato-camelo', { k: [{ q: [78, 134], t: 76, h: 30, C: [[0, -90], [3, -90]], M: [[123, TZ]], e: 4 }, { q: [78, 138], t: 70, h: -24, C: [[0, -90], [3, -90]], M: [[123, TZ]], e: -2 }], tapete: true, dur: 3 });
  T('postura_crianca', 'Postura da criança', { k: [{ q: [74, 152], t: 104, h: 6, C: [[52, -90]], B: [[96, 96]] }, { q: [72, 153], t: 106, h: 6, C: [[54, -90]], B: [[95, 95]] }], tapete: true, dur: 3.4 });
  T('alongamento_posterior', 'Alongamento posterior em pé', { k: [EP({ B: [[-4, -2]] }), EP({ q: [86, 106], t: 120, P: [[103, TZ], [97, TZ]], M: [{ j: 'd1', d: [2, -8] }] })], dur: 3.4 });
  T('alongamento_posterior_sentado', 'Alongamento posterior sentado', { k: [{ q: [80, 166], t: 0, C: [[90, 90], [90, 90]], f: [180], B: [[80, 84]] }, { q: [80, 166], t: 64, h: 10, C: [[90, 90], [90, 90]], f: [180], M: [{ j: 'd1', d: [-2, -4] }] }], tapete: true, dur: 3.4 });
  T('alongamento_posterior_deitado', 'Alongamento posterior deitado', { k: [deitado(106, G, { C: [[150, 150], [94, 94]], M: [{ j: 't1', d: [4, -2] }] }), deitado(106, G, { C: [[176, 176], [94, 94]], M: [{ j: 't1', d: [4, -2] }] })], p: 'elastico', cabo: { j: 'd1', d: [2, -3] }, tapete: true, dur: 3 });
  T('alongamento_posterior_cadeira', 'Alongamento posterior sentado na cadeira', { k: [{ q: [86, 126], t: 0, C: [[88, 0], [90, 70]], f: [null, 160], M: [{ j: 'j2', d: [0, -10] }] }, { q: [86, 126], t: 40, C: [[88, 0], [90, 70]], f: [null, 160], M: [{ j: 'j2', d: [8, -8] }] }],
    cena: [['cadeira', { id: 'apoio', x: 88, y: 138, costas: -1 }]], dur: 3.2 });
  T('alongamento_quadriceps', 'Alongamento de quadríceps em pé', { k: [{ q: [100, 104], t: 2, C: [[-6, -166]], P: [null, [98, TZ]], M: [{ j: 't1', d: [0, -2] }], B: [null, [60, 70]] }, { q: [100, 104], t: 4, C: [[-12, -170]], P: [null, [98, TZ]], M: [{ j: 't1', d: [0, -2] }], B: [null, [64, 74]] }], dur: 3.2 });
  T('alongamento_quadriceps_deitado', 'Alongamento de quadríceps deitado', { v: 'lado', k: [{ q: [80, 167], t: 90, h: -6, C: [[-90, 30], [-90, -90]], M: [{ j: 't1', d: [0, -2] }], B: [null, [80, 80]] }, { q: [80, 167], t: 90, h: -6, C: [[-96, 20], [-90, -90]], M: [{ j: 't1', d: [0, -2] }], B: [null, [80, 80]] }], tapete: true, dur: 3 });
  T('afundo_ajoelhado', 'Alongamento do flexor do quadril (meio ajoelhado)', { k: [{ q: [96, 136], t: 0, P: [[126, TZ], [62, 172]], f: [null, -20], M: [{ t: [4, 10] }] }, { q: [108, 138], t: -6, P: [[126, TZ], [62, 172]], f: [null, -20], B: [[176, 178], [-4, 0]] }], tapete: true, dur: 3.2 });
  T('couch_stretch', 'Couch stretch', { k: [{ q: [96, 136], t: 0, P: [[126, TZ], [56, 120]], f: [null, 180], M: [{ t: [4, 10] }] }, { q: [100, 136], t: -8, P: [[126, TZ], [56, 120]], f: [null, 180], M: [{ t: [4, 10] }] }], cena: [['parede', { x: 36, lado: -1 }]], tapete: true, dur: 3.2 });
  T('worlds_greatest', "World's greatest stretch", { k: [{ q: [96, 140], t: 50, P: [[124, TZ], [52, 166]], f: [null, 40], M: [[108, TZ], [110, TZ]] }, { q: [96, 140], t: 50, h: -30, P: [[124, TZ], [52, 166]], f: [null, 40], B: [[170, 172]], M: [null, [108, TZ]] }], dur: 3.2 });
  T('alongamento_peitoral', 'Alongamento de peitoral', { k: [EP({ t: 0, P: [[112, TZ], [90, TZ]], M: [[146, 50]], sM: [1] }), EP({ t: 2, q: [104, 104], P: [[112, TZ], [90, TZ]], M: [[146, 50]], sM: [1] })], cena: [['parede', { id: 'apoio', x: 150, lado: 1 }]], dur: 3.2 });
  T('alongamento_peitoral_costas', 'Alongamento de peitoral com mãos atrás', { v: 'frente', k: [{ q: [100, 104], M: [[126, 34]], sM: [1] }, { q: [100, 104], M: [[134, 38]], sM: [1], h: -4 }], dur: 3 });
  T('ombro_cruzado', 'Alongamento de ombro cruzado', { v: 'frente', k: [{ q: [100, 104], M: [[78, 76], { j: 'co1', d: [2, 2] }], za: [1, .7] }, { q: [100, 104], M: [[74, 74], { j: 'co1', d: [2, 2] }], za: [1, .7] }], dur: 3 });
  T('triceps_acima', 'Alongamento de tríceps acima da cabeça', { v: 'frente', k: [{ q: [100, 104], B: [[168, -20]], M: [null, { j: 'co1', d: [-2, -2] }] }, { q: [100, 104], t: -4, B: [[172, -16]], M: [null, { j: 'co1', d: [-2, -2] }] }], dur: 3 });
  T('toalha_costas', 'Alongamento de ombro com toalha', { v: 'frente', k: [{ q: [100, 104], B: [[172, -10], [20, 150]] }, { q: [100, 104], B: [[170, -4], [16, 140]] }], p: 'toalha', dur: 3 });
  T('alongamento_panturrilha', 'Alongamento de panturrilha na parede', { k: [linha([60, TZ], [126, 60], -1, { P: [[60, TZ], [112, TZ]], M: [[148, 64]] }), linha([60, TZ], [130, 62], -1, { P: [[60, TZ], [112, TZ]], M: [[148, 64]] })], cena: [['parede', { id: 'apoio', x: 152, lado: 1 }]], dur: 3.2 });
  T('alongamento_panturrilha_degrau', 'Alongamento de panturrilha no degrau', { k: [{ q: [100, 92], t: 4, P: [[103, 158], [97, 158]], f: [112, 112], M: [[150, 90]] }, { q: [100, 94], t: 4, P: [[103, 160], [97, 158]], f: [124, 112], M: [[150, 90]] }], cena: [['degrau', { id: 'apoio', x0: 96, x1: 140, y: 162 }], ['parede', { x: 156, lado: 1 }]], dur: 3 });
  T('gluteo_sentado', 'Alongamento de glúteo sentado (figura 4)', { k: [{ q: [86, 126], t: 0, C: [[60, -60], [88, 0]], M: [{ j: 'j1', d: [-2, -8] }] }, { q: [86, 126], t: 34, C: [[60, -60], [88, 0]], M: [{ j: 'j1', d: [-2, -8] }] }], cena: [['cadeira', { id: 'apoio', x: 88, y: 138, costas: -1 }]], dur: 3.2 });
  T('gluteo_deitado', 'Alongamento de glúteo deitado', { k: [deitado(106, G, { C: [[170, 80], [140, 20]], M: [{ j: 'j2', d: [-2, 2] }] }), deitado(106, G, { C: [[184, 90], [154, 30]], M: [{ j: 'j2', d: [-2, 2] }] })], tapete: true, dur: 3 });
  T('joelhos_peito', 'Joelhos ao peito', { k: [deitado(106, G, { C: [[190, 110]], M: [{ j: 'j1', d: [2, 6] }] }), deitado(106, G, { C: [[205, 120]], M: [{ j: 'j1', d: [2, 6] }] })], tapete: true, dur: 3 });
  T('pombo', 'Postura do pombo', { k: [{ q: [96, 158], t: 6, C: [[84, -96], [-84, -90]], zC: [.8, 1], M: [[120, TZ]] }, { q: [96, 160], t: 72, h: 10, C: [[84, -96], [-84, -90]], zC: [.8, 1], B: [[92, 92]] }], tapete: true, dur: 3.4 });
  T('borboleta', 'Borboleta / adutores', { v: 'frente', k: [{ q: [100, 166], C: [[100, 40]], cz: [.9], pz: [.8], M: [{ j: 't1', d: [-8, -4] }] }, { q: [100, 166], C: [[108, 44]], cz: [.9], pz: [.8], M: [{ j: 't1', d: [-8, -4] }], tz: .85 }], tapete: true, dur: 3 });
  T('sapo', 'Alongamento do sapo', { v: 'frente', k: [{ q: [100, 146], tz: .45, C: [[100, 0]], cz: [.6], pz: [.25], M: [[124, TZ]] }, { q: [100, 150], tz: .42, C: [[104, 0]], cz: [.6], pz: [.25], M: [[124, TZ]] }], tapete: true, dur: 3 });
  T('pancake', 'Pancake (afastamento sentado)', { v: 'frente', k: [{ q: [100, 166], C: [[72, 72]], f: [0], B: [[40, 30]] }, { q: [100, 170], tz: .5, C: [[72, 72]], B: [[30, 20]] }], tapete: true, dur: 3.2 });
  T('torcao_deitado', 'Torção de coluna deitado', { k: [deitado(106, G, { C: [[170, 92]], B: [[-90, -90]] }), deitado(106, G, { C: [[120, 60]], zC: [.6], B: [[-90, -90]], h: -20 })], tapete: true, dur: 3.2 });
  T('rotacao_toracica', 'Rotação torácica', { k: [{ q: [78, 136], t: 72, h: 10, C: [[0, -90], [3, -90]], M: [{ j: 'cab', d: [0, 6] }, [123, TZ]] }, { q: [78, 136], t: 72, h: -30, C: [[0, -90], [3, -90]], B: [[180, 180]], M: [null, [123, TZ]] }], tapete: true, dur: 3 });
  T('livro_aberto', 'Livro aberto (open book)', { v: 'frente', k: [{ q: [100, 160], t: 90, P: [[54, 172], [56, 158]], cz: [.62], pz: [.6], B: [[90, 90], [-90, -90]] }, { q: [100, 160], t: 90, P: [[54, 172], [56, 158]], cz: [.62], pz: [.6], B: [[90, 90], [180, 180]] }], tapete: true, dur: 3 });
  T('rotacao_sentado', 'Rotação de tronco sentado', { v: 'frente', k: [{ q: [100, 128], C: [[16, 4]], cz: [.55], M: [{ t: [34, 18] }, { t: [34, -6] }], h: 14 }, { q: [100, 128], C: [[16, 4]], cz: [.55], M: [{ t: [34, 6] }, { t: [34, -18] }], h: -14 }],
    cena: [['cadeira', { id: 'apoio', x: 100, y: 140, costas: 0 }]], dur: 3 });
  T('rotacao_em_pe', 'Rotação de tronco em pé', { v: 'frente', k: [{ q: [100, 104], P: [[118, TZ]], M: [{ t: [34, 30] }, { t: [34, -4] }], h: 12 }, { q: [100, 104], P: [[118, TZ]], M: [{ t: [34, 4] }, { t: [34, -30] }], h: -12 }], dur: 2.6 });
  T('pescoco', 'Mobilidade do pescoço', { v: 'frente', k: [{ q: [100, 104], h: -24, M: [{ t: [4, 15] }] }, { q: [100, 104], h: 24, M: [{ t: [4, 15] }] }], dur: 3.2 });
  T('queixo', 'Retração cervical (queixo para trás)', { k: [EP({ h: -8, M: [{ t: [6, 10] }] }), EP({ h: 8, M: [{ t: [6, 10] }] })], dur: 2.4 });
  T('circulos_bracos', 'Círculos de braços', { v: 'frente', k: [{ q: [100, 104], B: [[78, 78]] }, { q: [100, 104], B: [[90, 90]], za: [1] }, { q: [100, 104], B: [[100, 100]] }, { q: [100, 104], B: [[90, 90]] }], lin: true, dur: 1.2, passos: 3, pausa: 0 });
  T('cars_ombro', 'Rotação de ombro (CARs)', { k: [EP({ B: [[-4, -2], [-4, -2]] }), EP({ B: [[90, 92], [-4, -2]] }), EP({ B: [[180, 180], [-4, -2]] }), EP({ B: [[270, 270], [-4, -2]] })], lin: true, dur: 3.2, passos: 4, pausa: 0 });
  T('dislocate', 'Deslocamento de ombros com bastão', { k: [EP({ B: [[20, 20]] }), EP({ B: [[180, 180]] }), EP({ B: [[-30, -30]] }), EP({ B: [[180, 180]] })], p: 'bastao', dur: 3.2 });
  T('balanco_perna', 'Balanço de perna', { k: [{ q: [96, 104], t: 2, C: [[-34, -30]], P: [null, [96, TZ]], M: [[146, 96]], B: [null, [10, 20]] }, { q: [96, 104], t: -4, C: [[60, 56]], P: [null, [96, TZ]], M: [[146, 96]], B: [null, [10, 20]] }], cena: [['parede', { x: 152, lado: 1 }]], dur: 1.6 });
  T('cars_quadril', 'Círculos de quadril em pé', { k: [{ q: [96, 104], t: 4, C: [[80, -10]], P: [null, [96, TZ]], M: [[146, 96]] }, { q: [96, 104], t: 4, C: [[50, -20]], zC: [.7], P: [null, [96, TZ]], M: [[146, 96]] }, { q: [96, 104], t: 6, C: [[-20, -100]], P: [null, [96, TZ]], M: [[146, 96]] }], cena: [['parede', { x: 152, lado: 1 }]], dur: 3 });
  T('circulo_quadril', 'Rotação de quadril', { v: 'frente', k: [{ q: [92, 104], P: [[116, TZ]], M: [{ t: [4, 15] }] }, { q: [100, 100], P: [[116, TZ]], M: [{ t: [4, 15] }] }, { q: [108, 104], P: [[116, TZ]], M: [{ t: [4, 15] }] }, { q: [100, 108], P: [[116, TZ]], M: [{ t: [4, 15] }] }], lin: true, dur: 2.4, pausa: 0 });
  T('quatro_apoios_circulos', 'Círculos de quadril em 4 apoios', { k: [{ q: [78, 136], t: 72, C: [[0, -90], [3, -90]], M: [[123, TZ]] }, { q: [78, 136], t: 72, C: [[60, -40], [3, -90]], zC: [.8, 1], M: [[123, TZ]] }, { q: [78, 136], t: 72, C: [[-60, -100], [3, -90]], M: [[123, TZ]] }], tapete: true, dur: 3 });
  T('sentado_90_90', 'Mobilidade 90/90', { k: [{ q: [100, 166], t: 0, C: [[88, 90], [-88, -90]], zC: [.62, .62], B: [[30, 70]] }, { q: [100, 166], t: 24, C: [[88, 90], [-88, -90]], zC: [.62, .62], M: [[136, TZ]] }], tapete: true, dur: 3.2 });
  T('respiracao', 'Respiração diafragmática', { k: [deitado(106, G, { P: [[134, TZ]], M: [{ t: [18, 14] }, { t: [36, 14] }] }), deitado(106, G, { P: [[134, TZ]], M: [{ t: [18, 18] }, { t: [36, 15] }], e: 1 })], tapete: true, dur: 4 });
  T('bascula', 'Báscula pélvica', { k: [deitado(106, G, { P: [[134, TZ]], M: [[96, 176]], sM: [1] }), deitado(106, G - 2, { P: [[134, TZ]], M: [[96, 176]], t: -96 })], tapete: true, dur: 2.6 });
  T('extensao_toracica', 'Extensão torácica', { k: [porOmbro([78, 148], -80, { P: [[146, TZ]], M: [{ j: 'cab', d: [-4, 2] }] }), porOmbro([78, 148], -96, { P: [[146, TZ]], B: [[-110, -110]], h: -20 })], extra: (S, J, ctx) => CENA.foam_roller(S, { x: 82, y: G - 8 }), tapete: true, dur: 3 });
  T('extensao_toracica_cadeira', 'Extensão torácica na cadeira', { k: [{ q: [96, 124], t: 0, C: [[88, 0]], M: [{ j: 'cab', d: [-4, 2] }] }, { q: [96, 124], t: -22, h: -16, C: [[88, 0]], M: [{ j: 'cab', d: [-4, 2] }] }], cena: [['cadeira', { id: 'apoio', x: 98, y: 136, costas: -1 }]], dur: 3 });
  T('rolo_costas', 'Liberação no rolo (costas)', { k: [porOmbro([70, 160], -72, { P: [[150, TZ]], M: [{ j: 'cab', d: [-4, 2] }] }), porOmbro([86, 160], -72, { P: [[166, TZ]], M: [{ j: 'cab', d: [-4, 2] }] })], extra: (S, J, ctx) => CENA.foam_roller(S, { x: 92, y: G - 8 }), dur: 2.6 });
  T('rolo_coxa', 'Liberação no rolo (coxa)', { k: [{ q: [84, 156], t: 80, C: [[-80, -86], [-80, -86]], B: [[0, 90]] }, { q: [100, 156], t: 80, C: [[-80, -86], [-80, -86]], B: [[0, 90]] }], extra: (S, J, ctx) => CENA.foam_roller(S, { x: 64, y: G - 8 }), dur: 2.6 });
  T('rolo_panturrilha', 'Liberação no rolo (pernas)', { k: [{ q: [80, 164], t: -24, C: [[90, 92], [92, 94]], f: [180], M: [[56, TZ]], sM: [1] }, { q: [64, 164], t: -24, C: [[90, 92], [92, 94]], f: [180], M: [[40, TZ]], sM: [1] }], extra: (S, J, ctx) => CENA.foam_roller(S, { x: 134, y: G - 8 }), dur: 2.6 });
  T('jefferson', 'Jefferson curl', { k: [EP({ B: [[-2, 0]] }), EP({ q: [92, 104], t: 140, h: 30, B: [[0, 0]] })], cena: [['degrau', { x0: 82, x1: 126, y: 164 }]], dur: 3.4 });
  T('agachamento_toalha', 'Agachamento segurando na porta', { k: [EP({ q: [96, 104], M: [[150, 82]] }), EP({ q: [76, 150], t: 20, M: [[150, 86]] })], p: 'toalha', cabo: [164, 84], cena: [['parede', { x: 164, lado: 1 }]], dur: 2.8 });

  // ===== complementos para a base
  T('tke', 'Extensão terminal de joelho (TKE)', { k: [{ q: [98, 110], t: 6, P: [[108, TZ], [94, TZ]], M: [{ t: [6, 10] }] }, EP({ P: [[108, TZ], [94, TZ]], M: [{ t: [6, 10] }] })], p: 'elastico', cabo: [176, 140], caboEm: 'j1', dur: 2 });
  T('flexora_brucos', 'Flexora deitado de bruços', { k: [{ q: [80, 167], t: 90, h: -12, C: [[-90, -90]], M: [[138, 170]] }, { q: [80, 167], t: 90, h: -12, C: [[-90, -164]], M: [[138, 170]] }], p: 'elastico', cabo: [8, 172], caboEm: 't1', tapete: true, dur: 2.4 });
  T('flexora_cadeira', 'Flexora sentado (cadeira)', { k: [{ q: [90, 124], t: -4, C: [[90, 84], [90, 2]], M: [{ t: [2, 12] }] }, { q: [90, 124], t: -4, C: [[90, -10], [90, 2]], M: [{ t: [2, 12] }] }],
    cena: [['cadeira', { id: 'apoio', x: 96, y: 136, costas: -1 }]], p: 'elastico', cabo: [180, 150], caboEm: 't1', dur: 2.4 });
  T('nordico_reverso', 'Nórdico reverso', { k: [{ q: [90, 136], t: 0, C: [[0, -90]], M: [{ t: [34, 18] }] }, { q: [66.9, 144.4], t: -40, C: [[40, -90]], M: [{ t: [34, 18] }] }], tapete: true, dur: 2.8 });
  T('ponte_completa', 'Ponte completa', { k: [tronco([106, 150], [62, 166], { P: [[146, TZ]], M: [[52, TZ]], sM: [1] }), tronco([104, 118], [60, 126], { P: [[146, TZ]], M: [[52, TZ]], sM: [1], h: -20 })], tapete: true, dur: 3 });
  T('agachamento_ajoelhado', 'Agachamento ajoelhado', { k: [{ q: [68, 150], t: 22, C: [[52, -90]] }, { q: [96, 136], t: 0, C: [[0, -90]] }], pg: { barra: 'costas', halteres: 'lado', kb: 'goblet', _: 'cintura' }, tapete: true, dur: 2.4 });
  T('supino_bola', 'Supino na bola suíça', { k: [porOmbro([66, 128], -94, { P: [[130, TZ]], M: [[74, 74]] }), porOmbro([66, 128], -94, { P: [[130, TZ]], M: [[80, 112]] })], cena: [['bola_suica', { id: 'apoio', x: 52, r: 26 }]], p: 'halteres', dur: 2.6 });
  T('trx_frente', 'Flexão / crucifixo inclinado no TRX', { k: [linha([60, TZ], [116, 80], -1, { M: [[148, 92]] }), linha([60, TZ], [128, 104], -1, { M: [[142, 98]] })], p: 'trx', cabo: [18, -8], dur: 2.4 });
  T('pull_apart', 'Abertura com elástico (pull apart)', { v: 'frente', k: [{ q: [100, 104], B: [[90, 90]], zB: [.42] }, { q: [100, 104], B: [[88, 90]] }], p: 'elastico', dur: 2 });
  T('remada_apoiada', 'Remada com apoio no peito', { k: [{ q: [88, 112], t: 46, P: [[96, TZ], [92, TZ]], B: [[0, 0]] }, { q: [88, 112], t: 46, P: [[96, TZ], [92, TZ]], M: [{ t: [22, 4] }] }],
    extra: (S, J, ctx) => { almofada(S, Q(ctx.J0, 26, 16), ctx.J0.up, 60, 10, 'fundo'); S.cap(V(ctx.J0.q.x + 6, 130), V(ctx.J0.q.x + 6, G - 3), 6, C.metal, 'fundo'); S.ret(ctx.J0.q.x - 20, G - 6, 60, 6, 3, C.metal2, 'fundo'); }, p: 'halteres', dur: 2.2 });
  T('remada_renegade', 'Remada renegade', { k: [linha([22, 172], [124, 120], -1, { P: [[22, 172], [34, 172]], M: [[128, TZ], [122, TZ]] }), linha([22, 172], [124, 118], -1, { P: [[22, 172], [34, 172]], M: [{ t: [30, 6] }, [122, TZ]] })], p: 'halteres', dur: 2 });
  T('extensao_bola', 'Extensão lombar na bola', { k: [{ q: [98, 124], t: 140, P: [[46, TZ], [40, TZ]], f: [0, 0], M: [{ t: [38, 14] }] }, { q: [98, 124], t: 58, P: [[46, TZ], [40, TZ]], f: [0, 0], M: [{ t: [38, 14] }] }],
    cena: [['bola_suica', { id: 'apoio', x: 100, r: 24 }]], dur: 2.6 });
  T('planche', 'Planche / apoio grupado', { k: [{ q: [74, 132], t: 80, C: [[66, -64]], f: [0], M: [[110, TZ]] }, { q: [78, 128], t: 84, C: [[70, -60]], f: [0], M: [[112, TZ]] }], dur: 3 });

  // generico (ultimo recurso)
  T('generico', 'Exercício', { k: [EP({ B: [[-4, -2]] }), EP({ B: [[60, 70]] })], dur: 2.4 });

  // ---------------------------------------------------------------- render
  function desenharCena(S, e, J, ctx) {
    if (typeof e === 'function') return e(S, J, ctx);
    let [nome, o] = e;
    if (o && o.id === 'apoio' && ctx.a && CENA[ctx.a]) nome = ctx.a;
    const fn = CENA[nome];
    if (fn) fn(S, o || {}, J, ctx);
  }

  function preparar(tid, p, a) {
    const tpl0 = TPL[tid] || TPL.generico, vista = tpl0.v || 'lado';
    const pega = pegaDe(tpl0, p, vista);
    const tpl = Object.assign({}, tpl0, pega && pega.nome === 'goblet' ? { goblet: true } : null, pega && pega.nome === 'baixo' ? { goblet: true } : null);
    let ks = typeof tpl.k === 'function' ? tpl.k(p) : tpl.k;
    ks = ks.map(K => normalizar(pega && pega.spec && !K.M && !K.B ? Object.assign({}, pega.spec, K) : K, vista));
    for (const K of ks) K._J = resolver(K, vista);
    const seq = [], n = ks.length, N = tpl.passos || 5;
    for (let i = 0; i < n; i++) {
      const A = ks[i], hold = A.pausa ?? tpl.pausa ?? 1;
      for (let h = 0; h <= hold; h++) seq.push(A._J);
      if (n === 1) break;
      const B = ks[(i + 1) % n];
      for (let s = 1; s < N; s++) {
        let u = s / N; if (!tpl.lin) u = u * u * (3 - 2 * u);
        seq.push(resolver(interpolar(A, B, u, vista), vista));
      }
    }
    if (n > 1) seq.push(ks[0]._J);
    return { tpl, vista, ks, seq };
  }

  const CENA_EXTRA = { cones: { xs: [36, 176] }, escada_agilidade: {}, colchonete: {}, parede: { x: 176, lado: 1 } };
  function cenaDe(prep, J, i, o, ctxBase) {
    const { tpl, vista, seq } = prep;
    const S = new Cena();
    const J0 = seq[0];
    J.J0m1 = J0.m1; J.J0q = J0.q;
    const ctx = Object.assign({ tpl, v: vista, J0, fase: i / Math.max(1, seq.length - 1), o }, ctxBase);
    if (tpl.tapete) {
      const pts = ['q', 'om', 'cab', 'j1', 'j2', 't1', 't2', 'm1', 'm2', 'd1', 'd2'].map(k => J0[k]).filter(Boolean);
      CENA.colchonete(S, { x0: Math.min(...pts.map(p => p.x)) - 16, x1: Math.max(...pts.map(p => p.x)) + 16 });
    }
    for (const e of tpl.cena || []) desenharCena(S, e, J, ctx);
    if (ctx.a && CENA_EXTRA[ctx.a] && !(tpl.cena || []).some(e => Array.isArray(e) && e[1] && e[1].id === 'apoio')) CENA[ctx.a](S, CENA_EXTRA[ctx.a], J, ctx);
    const p = ctxBase.p;
    if (p && PROPS[p]) PROPS[p](S, J, ctx);
    if (tpl.extra) tpl.extra(S, J, ctx);
    if (!o.semFigura) (vista === 'frente' ? desenharFrente : desenharLado)(S, J, o);
    return S;
  }

  function caixa(bb) {
    let [x0, y0, x1, y1] = bb;
    y1 = Math.max(y1, G + 10) + 4; y0 -= 8; x0 -= 10; x1 += 10;
    let w = x1 - x0, h = y1 - y0;
    const AR = 4 / 3;
    if (w / h < AR) { const nw = h * AR; x0 -= (nw - w) / 2; w = nw; }
    else { const nh = w / AR; y0 -= (nh - h) * .7; h = nh; }
    return [x0, y0, w, h];
  }
  function uniao(a, b) { return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]; }

  function montar(tid, p, a, o) {
    const prep = preparar(tid, p, a);
    const ctxBase = { p, a };
    const cenas = prep.seq.map((J, i) => cenaDe(prep, J, i, o, ctxBase));
    const base = cenas[0];
    const ok = cenas.every(c => c.cam.every((l, i) => l.length === base.cam[i].length));
    let bb = base.bb; for (const c of cenas) bb = uniao(bb, c.bb);
    const vb = caixa(bb);
    const dur = prep.tpl.dur || 2.4;
    let anim = '';
    for (let L = 0; L < 6; L++) for (let j = 0; j < base.cam[L].length; j++) {
      const s0 = base.cam[L][j];
      if (!ok) { anim += `<path d="${s0.d}" ${s0.at}/>`; continue; }
      const vals = cenas.map(c => c.cam[L][j].d);
      if (vals.every(v => v === s0.d)) anim += `<path d="${s0.d}" ${s0.at}/>`;
      else anim += `<path d="${s0.d}" ${s0.at}><animate attributeName="d" dur="${dur}s" repeatCount="indefinite" values="${vals.join(';')}"/></path>`;
    }
    // quadros-chave estaticos (para reduzir movimento)
    const idxK = []; let i = 0;
    for (const K of prep.ks) { idxK.push(prep.seq.indexOf(K._J)); }
    const amostras = cenas.map(c => { let s = ''; for (let L = 0; L < 6; L++) for (const sh of c.cam[L]) s += `<path d="${sh.d}" ${sh.at}/>`; return s; });
    const quadros = escolherQuadros(prep).map(i => idxK[i]).map(ix => { const c = cenas[ix]; let s = ''; for (let L = 0; L < 6; L++) for (const sh of c.cam[L]) s += `<path d="${sh.d}" ${sh.at}/>`; return s; });
    if (!ok && typeof console !== 'undefined') console.warn('Figuras: numero de formas variou em', tid, p);
    return { vb, anim, quadros, amostras, tpl: prep.tpl };
  }

  // quadros-chave mostrados no modo "reduzir movimento": todos ate 3; ciclos longos (corrida, bike) viram 2-3
  function escolherQuadros(prep) {
    const n = prep.ks.length, t = prep.tpl;
    if (t.qd) return t.qd;
    if (n <= 3) return [...Array(n).keys()];
    if (t.lin) return [0, Math.round(n / 2)];
    return [0, Math.round(n / 3), Math.round(2 * n / 3)];
  }

  // ---------------------------------------------------------------- SVG final
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function svgDe(vb, conteudo, larg, label, espelhar, decorativo) {
    const [x, y, w, h] = vb;
    const hp = Math.round(larg * h / w);
    const g = espelhar ? `<g transform="matrix(-1 0 0 1 ${f(2 * x + w)} 0)">${conteudo}</g>` : conteudo;
    const rotulo = decorativo ? 'aria-hidden="true" focusable="false"' : `role="img" aria-label="${esc(label)}"`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(x)} ${f(y)} ${f(w)} ${f(h)}" width="${larg}" height="${hp}" ${rotulo} style="display:block;max-width:100%;height:auto;border-radius:16px">` +
      (decorativo ? '' : `<title>${esc(label)}</title>`) +
      `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${C.fundo}"/>` +
      `<circle cx="${f(x + w * .84)}" cy="${f(y + h * .2)}" r="${f(h * .15)}" fill="${C.sol}"/>` +
      `<rect x="${f(x)}" y="${G}" width="${f(w)}" height="${f(y + h - G)}" fill="${C.chao}"/>` +
      `<path d="M${f(x)} ${G}H${f(x + w)}" stroke="${C.chao2}" stroke-width="2"/>` + g + '</svg>';
  }

  const CACHE = new Map();
  function obter(tid, p, a, o) {
    const k = [tid, p || '', a || '', o.genero || '', o.semFigura ? 1 : 0].join('|');
    let r = CACHE.get(k);
    if (!r) { r = montar(tid, p, a, o); CACHE.set(k, r); if (CACHE.size > 400) CACHE.delete(CACHE.keys().next().value); }
    return r;
  }

  function reduzMovimento() {
    try { return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }

  // ---------------------------------------------------------------- aparelhos (ilustracao estatica)
  const NOME_AP = {
    halteres: 'Halteres', peso_corporal: 'Peso corporal', barra: 'Barra com anilhas', colchonete: 'Colchonete', polia: 'Polia (cabo)',
    elastico: 'Elástico de resistência', kettlebell: 'Kettlebell', parede: 'Parede', barra_fixa: 'Barra fixa', bola_suica: 'Bola suíça',
    smith: 'Máquina Smith', cadeira: 'Cadeira', trx: 'TRX (fita de suspensão)', landmine: 'Landmine', crossover: 'Crossover',
    medicine_ball: 'Medicine ball', banco: 'Banco reto', degrau_step: 'Degrau / step', mochila: 'Mochila com peso', cones: 'Cones',
    toalha: 'Toalha', mini_band: 'Mini band', argolas: 'Argolas', leg_press: 'Leg press 45°', puxador_pulley: 'Puxador (pulley)',
    banco_romano: 'Banco romano', banco_inclinado: 'Banco inclinado', anilha: 'Anilha', esteira: 'Esteira', escada_ergometrica: 'Escada ergométrica',
    panturrilha_maquina: 'Máquina de panturrilha', hack: 'Hack', bicicleta: 'Bicicleta ergométrica', mesa_flexora: 'Mesa flexora',
    paralelas: 'Paralelas', treno: 'Trenó', saco_areia: 'Saco de areia', foam_roller: 'Rolo de liberação (foam roller)',
    corda_naval: 'Corda naval', corda_pular: 'Corda de pular', supino_maquina: 'Supino na máquina', barra_ez: 'Barra W (EZ)',
    bosu: 'Bosu', cadeira_extensora: 'Cadeira extensora', remada_baixa: 'Remada baixa (polia)', caixa_pliometrica: 'Caixa pliométrica',
    maquina_bracos: 'Máquina de braços', voador_peck_deck: 'Voador (peck deck)', remo_ergometro: 'Remo ergômetro',
    gluteo_maquina: 'Máquina de glúteo', cadeira_abdutora: 'Cadeira abdutora', remada_maquina: 'Remada na máquina',
    escada_agilidade: 'Escada de agilidade', roda_abdominal: 'Roda abdominal', hand_grip: 'Hand grip', raquete: 'Raquete',
    pneu: 'Pneu', eliptico: 'Elíptico', cadeira_adutora: 'Cadeira adutora', maquina_abdominal: 'Máquina abdominal',
    desenvolvimento_maquina: 'Desenvolvimento na máquina',
  };
  // aparelho da base -> implemento desenhado na mao (os demais sao cenario/maquina do proprio template)
  const AP_PROP = { halteres: 'halteres', barra: 'barra', barra_ez: 'barra_ez', kettlebell: 'kettlebell', elastico: 'elastico',
    mini_band: 'mini_band', polia: 'polia', crossover: 'crossover', trx: 'trx', landmine: 'landmine', medicine_ball: 'medicine_ball',
    anilha: 'anilha', mochila: 'mochila', toalha: 'toalha', saco_areia: 'saco_areia', smith: 'smith', corda_naval: 'corda_naval',
    corda_pular: 'corda_pular', raquete: 'raquete', hand_grip: 'hand_grip' };

  const AP_TPL = { leg_press: 'leg_press', hack: 'hack', cadeira_extensora: 'extensora', mesa_flexora: 'flexora_deitado',
    puxador_pulley: 'puxada', remada_baixa: 'remada_sentada', supino_maquina: 'supino_maquina', maquina_bracos: 'rosca_scott',
    voador_peck_deck: 'peck_deck', remo_ergometro: 'remo', gluteo_maquina: 'coice_maquina', cadeira_abdutora: 'cadeira_abdutora',
    cadeira_adutora: 'cadeira_adutora', remada_maquina: 'remada_maquina', maquina_abdominal: 'crunch_maquina',
    panturrilha_maquina: 'panturrilha_maquina', banco_romano: 'extensao_lombar', bicicleta: 'bike', eliptico: 'eliptico',
    escada_ergometrica: 'escada_ergometrica',
    desenvolvimento_maquina: 'desenvolvimento_maquina' };

  const AP_DES = {
    halteres: S => { halter(S, V(82, G - 6.5), V(1, 0), 'frente'); halter(S, V(118, G - 6.5), V(1, 0), 'frente', '#F0B420'); halter(S, V(100, G - 19.5), V(1, 0), 'frente', C.coral); },
    barra: S => { S.cap(V(24, G - 17), V(176, G - 17), 4, C.aco, 'frente'); for (const x of [44, 156]) { S.oret(V(x, G - 17), V(1, 0), 7, 34, 2.5, C.roxo, 'frente'); S.oret(V(x + (x < 100 ? 8 : -8), G - 17), V(1, 0), 6, 26, 2, C.coral, 'frente'); } },
    barra_ez: S => { S.linha([V(24, G - 17), V(66, G - 17), V(76, G - 23), V(88, G - 13), V(100, G - 23), V(112, G - 13), V(124, G - 23), V(134, G - 17), V(176, G - 17)], 4, C.aco, 'frente'); for (const x of [44, 156]) S.oret(V(x, G - 17), V(1, 0), 7, 30, 2.5, C.roxo, 'frente'); },
    kettlebell: S => { kettlebell(S, V(88, G - 21), V(0, 1), 'frente'); kettlebell(S, V(116, G - 21), V(0, 1), 'frente', C.coral); },
    medicine_ball: S => PROPS.medicine_ball(S, { vista: 'lado', m1: V(100, G - 11), fa1: 0 }, { bola: V(100, G - 11) }),
    anilha: S => { placa(S, V(92, G - 17), 17, C.roxo, C.roxo2, 'frente'); placa(S, V(116, G - 12), 12, C.coral, C.coral2, 'frente'); },
    elastico: S => { S.curva(V(50, G - 40), V(80, G - 10), V(120, G - 10), V(150, G - 40), 4, C.coral, 'frente'); for (const x of [50, 150]) S.cap(V(x - 6, G - 44), V(x + 6, G - 44), 5, C.amarelo, 'frente'); S.cap(V(50, G - 44), V(50, G - 40), 2, C.metal2, 'frente'); S.cap(V(150, G - 44), V(150, G - 40), 2, C.metal2, 'frente'); },
    mini_band: S => { S.add('frente', `M70 ${G - 14}a30 12 0 1 0 60 0a30 12 0 1 0 -60 0Z`, `fill="none" stroke="${C.coral}" stroke-width="6"`, [V(64, G - 32), V(136, G)], 0); S.add('frente', `M78 ${G - 34}a22 9 0 1 0 44 0a22 9 0 1 0 -44 0Z`, `fill="none" stroke="${C.turq}" stroke-width="5"`, [V(74, G - 46), V(126, G - 22)], 0); },
    mochila: S => { S.oret(V(100, G - 22), V(0, 1), 44, 36, 10, C.azul, 'frente'); S.oret(V(100, G - 14), V(0, 1), 16, 24, 5, C.azul2, 'frente'); S.anel(V(100, G - 47), 6, 3, C.azul, 'frente'); },
    toalha: S => { S.ret(60, G - 14, 80, 14, 4, C.amarelo, 'frente'); S.ret(64, G - 24, 72, 11, 4, C.turq, 'frente'); S.cap(V(70, G - 8), V(130, G - 8), 2, C.amarelo2, 'frente'); },
    saco_areia: S => { S.oret(V(100, G - 15), V(1, 0), 76, 30, 12, C.amarelo, 'frente'); for (const x of [80, 120]) S.anel(V(x, G - 32), 5, 3, C.madeira2, 'frente'); S.cap(V(72, G - 16), V(128, G - 16), 2, C.madeira2, 'frente'); },
    raquete: S => { const m = V(76, G - 8), u = norm(V(1, -0.5)); PROPS.raquete(S, { m1: m, pu1: ang(u) }); S.circ(V(150, G - 5), 5, '#C6F432', 'frente'); },
    hand_grip: S => { S.oret(V(86, G - 26), norm(V(-.3, 1)), 44, 9, 4.5, C.coral, 'frente'); S.oret(V(114, G - 26), norm(V(.3, 1)), 44, 9, 4.5, C.coral, 'frente'); S.add('frente', `M92 ${G - 50}q8 -14 16 0`, `fill="none" stroke="${C.metal2}" stroke-width="3"`, [V(92, G - 58), V(108, G - 50)], 0); },
    corda_pular: S => { S.curva(V(56, G - 48), V(40, G + 4), V(160, G + 4), V(144, G - 48), 2.6, C.roxo, 'frente'); for (const x of [56, 144]) S.oret(V(x, G - 56), V(0, 1), 18, 6, 3, C.amarelo, 'frente'); },
    corda_naval: S => { const pts = []; for (let i = 0; i <= 12; i++) pts.push(V(30 + i * 12, G - 10 - Math.sin(i * .9) * 8)); S.linha(pts, 6, C.turq, 'frente'); S.ret(166, G - 18, 14, 18, 3, C.metal2, 'frente'); },
    foam_roller: S => { S.oret(V(100, G - 12), V(1, 0), 90, 24, 11, C.turq, 'frente'); S.elipse(V(145, G - 12), 5, 12, C.turq2, 'frente'); for (const x of [72, 92, 112]) S.cap(V(x, G - 22), V(x, G - 2), 2.4, C.turq2, 'frente'); },
    bola_suica: S => CENA.bola_suica(S, { x: 100, r: 34, cam: 'frente' }),
    bosu: S => CENA.bosu(S, { x: 100, cam: 'frente' }),
    cones: S => CENA.cones(S, { xs: [70, 100, 130], cam: 'frente' }),
    escada_agilidade: S => { const y0 = G - 2, y1 = G + 6; for (const [a, b] of [[V(30, y0), V(170, y0)], [V(22, y1), V(178, y1)]]) S.cap(a, b, 2.4, C.amarelo, 'frente'); for (let i = 0; i < 7; i++) S.cap(V(34 + i * 22, y0), V(28 + i * 24, y1), 2.4, C.amarelo, 'frente'); },
    caixa_pliometrica: S => CENA.caixa(S, { x0: 70, x1: 130, y: 128, cam: 'frente' }),
    degrau_step: S => CENA.degrau(S, { x0: 60, x1: 140, y: 160, cam: 'frente' }),
    banco: S => CENA.banco(S, { x0: 40, x1: 160, y: 140, cam: 'frente' }),
    banco_inclinado: S => CENA.banco_inclinado(S, { x: 110, y: 140, ang: 45, L: 76, cam: 'frente' }),
    cadeira: S => CENA.cadeira(S, { x: 100, y: 136, costas: -1, cam: 'frente' }),
    parede: S => { CENA.parede(S, { x: 70, lado: 1, top: 40, cam: 'frente' }); S.ret(70, 40, 70, G - 40, 2, C.parede, 'frente'); S.ret(70, G - 8, 70, 8, 1, C.parede2, 'frente'); },
    colchonete: S => { S.ret(40, G - 6, 110, 6, 3, C.tapete, 'frente'); S.circ(V(152, G - 9), 9, C.tapete, 'frente'); S.circ(V(152, G - 9), 4, '#FF8FB1', 'frente'); },
    barra_fixa: S => CENA.barra_fixa(S, { x: 100, y: 70, frente: true, w: 110, cam: 'frente' }),
    paralelas: S => CENA.paralelas(S, { x0: 50, x1: 150, y: 120, cam: 'frente' }),
    argolas: S => { for (const x of [78, 122]) { S.cap(V(x, 40), V(x, 124), 3, C.amarelo, 'frente'); S.anel(V(x, 132), 8, 4, C.madeira2, 'frente'); } S.cap(V(60, 40), V(140, 40), 5, C.metal, 'frente'); },
    trx: S => { S.poli([V(94, 38), V(106, 38), V(100, 48)], C.metal2, 'frente', 2); for (const x of [84, 116]) { S.cap(V(100, 46), V(x, 120), 4, C.amarelo, 'frente'); S.cap(V(x, 118), V(x, 132), 4, '#E8A912', 'frente'); S.cap(V(x - 6, 134), V(x + 6, 134), 5, C.metal2, 'frente'); } },
    landmine: S => { S.ret(32, G - 8, 22, 8, 3, C.metal2, 'frente'); S.cap(V(44, G - 6), V(166, G - 40), 5, C.aco, 'frente'); S.oret(V(150, G - 36), norm(V(122, -34)), 7, 32, 2.5, C.roxo, 'frente'); },
    polia: S => { torre(S, 100, 60, 'frente'); roldana(S, V(100, 60), 'frente'); S.cap(V(100, 60), V(140, 130), 2, C.metal2, 'frente'); S.cap(V(134, 132), V(146, 132), 4, C.metal2, 'frente'); },
    crossover: S => { for (const x of [40, 160]) { torre(S, x, 40, 'frente'); roldana(S, V(x, 44), 'frente'); } S.ret(36, 26, 128, 7, 3, C.metal3, 'frente'); S.cap(V(40, 44), V(84, 110), 2, C.metal2, 'frente'); S.cap(V(160, 44), V(116, 110), 2, C.metal2, 'frente'); S.circ(V(84, 112), 4, C.metal2, 'frente'); S.circ(V(116, 112), 4, C.metal2, 'frente'); },
    smith: S => { for (const x of [50, 150]) S.ret(x - 4, 30, 8, G - 30, 3, C.metal, 'frente'); S.ret(40, 24, 120, 8, 3, C.metal2, 'frente'); S.cap(V(36, 92), V(164, 92), 4, C.aco, 'frente'); for (const x of [36, 164]) S.oret(V(x, 92), V(1, 0), 7, 30, 2.5, C.roxo, 'frente'); S.ret(36, G - 6, 128, 6, 3, C.metal2, 'frente'); },
    treno: S => { S.ret(54, G - 18, 92, 14, 5, C.metal2, 'frente'); S.cap(V(46, G - 2), V(154, G - 2), 3, C.metal, 'frente'); placa(S, V(100, G - 30), 14, C.roxo, C.roxo2, 'frente'); for (const x of [62, 80]) S.cap(V(x, G - 16), V(x - 6, G - 74), 5, C.metal, 'frente'); },
    pneu: S => { S.ret(36, G - 28, 128, 28, 12, C.pneu, 'frente'); S.ret(48, G - 23, 104, 7, 3.5, C.pneu2, 'frente'); S.ret(60, G - 12, 80, 5, 2.5, C.pneu2, 'frente'); },
    roda_abdominal: S => { S.circ(V(100, G - 18), 18, C.coral, 'frente'); S.circ(V(100, G - 18), 8, C.coral2, 'frente'); S.cap(V(66, G - 18), V(134, G - 18), 5, C.metal2, 'frente'); for (const x of [66, 134]) S.cap(V(x, G - 18), V(x + (x < 100 ? -8 : 8), G - 18), 8, C.azul, 'frente'); },
    esteira: S => CENA.esteira(S, { x0: 30, x1: 170, cam: 'frente' }),
  };

  function aparelho(chave, o = {}) {
    const larg = o.largura || 200;
    const nome = NOME_AP[chave] || (chave ? String(chave).replace(/_/g, ' ') : 'Aparelho');
    let vb, corpo;
    if (chave === 'peso_corporal' || (!AP_DES[chave] && !AP_TPL[chave])) {
      const r = obter('polichinelo', null, null, { genero: o.genero });
      vb = r.vb; corpo = r.quadros[1];
    } else if (AP_TPL[chave]) {
      const r = obter(AP_TPL[chave], null, null, { semFigura: true });
      vb = r.vb; corpo = r.quadros[0];
    } else {
      const S = new Cena();
      AP_DES[chave](S);
      const b = S.bb;
      const cx = (b[0] + b[2]) / 2, mh = 46;
      if (b[3] - b[1] < mh) b[1] = b[3] - mh;
      if (b[2] - b[0] < mh * 1.2) { b[0] = cx - mh * .6; b[2] = cx + mh * .6; }
      vb = caixa(b);
      corpo = S.cam.map(l => l.map(s => `<path d="${s.d}" ${s.at}/>`).join('')).join('');
    }
    const tam = Math.max(11, Math.round(larg / 15));
    return `<figure class="figura-aparelho" style="margin:0;display:inline-flex;flex-direction:column;align-items:center;gap:6px;max-width:100%">` +
      svgDe(vb, corpo, larg, `Aparelho: ${nome}`) +
      `<figcaption style="font-weight:700;font-size:${tam}px;color:#3D4060;text-align:center">${esc(nome)}</figcaption></figure>`;
  }

  // ---------------------------------------------------------------- mapa exercicio -> template
  // <MAPA-GERADO> (nao edite a mao — rode ferramentas/mapear_figuras.py)
  const MAPA_T = 'abdominal abdominal_bracos abdominal_infra abducao_deitado abducao_em_pe abducao_sentado aducao_deitado aducao_em_pe aducao_sentado afundo afundo_ajoelhado afundo_caminhando afundo_cruzado afundo_lateral afundo_reverso afundo_salto agachamento agachamento_ajoelhado agachamento_banco agachamento_bola_parede agachamento_frontal agachamento_isometrico agachamento_maquina_deitado agachamento_mini agachamento_overhead agachamento_parede agachamento_profundo agachamento_pulso agachamento_rotacao agachamento_salto agachamento_sumo agachamento_toalha alcance alongamento_panturrilha alongamento_panturrilha_degrau alongamento_peitoral alongamento_peitoral_costas alongamento_posterior alongamento_posterior_cadeira alongamento_posterior_deitado alongamento_posterior_sentado alongamento_quadriceps alongamento_quadriceps_deitado anfersen anjo_parede aperto_palmas arremesso_cima arremesso_rotacional arremesso_tras aviao_quadril backhand balanco_perna barra_fixa barra_fixa_supinada bascula bicicleta_abdominal bike bike_em_pe bike_reclinada bird_dog bom_dia bom_dia_sentado borboleta boxe boxe_sentado bulgaro burpee burpee_inclinado cadeira_abdutora cadeira_adutora caminhada caminhada_acima caminhada_carga caminhada_esteira caminhada_lateral caminhada_tandem canivete_bola canivete_lateral caranguejo carregamento_abraco cars_ombro cars_quadril chute circulo_quadril circulos_bracos clean coice coice_em_pe coice_maquina concha copenhagen corda_naval corda_naval_dupla corrida corrida_esteira couch_stretch crossover crossover_baixo crossover_medio crucifixo crucifixo_inclinado crucifixo_inverso crucifixo_inverso_deitado crunch_maquina crunch_polia dead_bug desenvolvimento desenvolvimento_ajoelhado desenvolvimento_maquina desenvolvimento_sentado desenvolvimento_unilateral deslocamento_lateral diagonal dislocate dragon_flag elevacao_frontal elevacao_joelhos_paralelas elevacao_joelhos_suspenso elevacao_lateral elevacao_lateral_uni elevacao_pernas elevacao_pernas_suspenso elevacao_quadril_degrau elevacao_y eliptico encolhimento encolhimento_acima engatinhar_urso equilibrio escada_agilidade escada_ergometrica esfinge extensao_bola extensao_joelho_sentado extensao_lombar extensao_toracica extensao_toracica_cadeira extensora face_pull fire_hydrant flexao flexao_declinada flexao_diamante flexao_esfinge flexao_explosiva flexao_inclinada flexao_joelhos flexao_lateral flexao_parede flexora_bola flexora_brucos flexora_cadeira flexora_deitado flexora_deslizante flexora_em_pe flexora_sentado flutter forehand front_lever gato_camelo ghd_abdominal gluteo_deitado gluteo_sentado hack halo hip_thrust hiper_reversa hollow hspu inchworm inclinacao_lateral jefferson joelhada joelhos_peito kb_swing kb_swing_americano l_sit landmine_press leg_press levantar_chao lift livro_aberto marcha marcha_sentado marreta mergulho mergulho_banco mountain_climber mountain_climber_cruzado muscle_up nadador nordico nordico_reverso obstaculos oito_raquete ombro_cruzado pallof pancake panturrilha_chao panturrilha_leg_press panturrilha_maquina panturrilha_pe panturrilha_sentado parada_mao passe_peito passo_cruzado peck_deck pegada pendurado pes_rapidos pescoco pike_pushup pike_suspenso pistol pistol_apoio planche pogo polichinelo polichinelo_baixo polichinelo_frontal pombo ponte ponte_bola_ombros ponte_completa ponte_pes_elevados ponte_unilateral postura_crianca prancha prancha_alta prancha_bola prancha_estrela prancha_lateral prancha_lateral_joelhos prancha_lateral_quadril prancha_pes_elevados prancha_reversa prancha_toque prancha_urso pular_corda pull_apart pulldown_ajoelhado pulldown_estendido pullover pullover_chao push_press puxada puxada_fechada puxada_unilateral quatro_apoios_circulos queixo reacao_bola relogio remada_afundo remada_alta remada_apoiada remada_curvada remada_em_pe remada_invertida remada_maquina remada_renegade remada_sentada remada_sentada_chao remada_trx remada_unilateral remo respiracao roda_abdominal rolo_costas rolo_coxa rolo_panturrilha rosca rosca_alternada rosca_concentrada rosca_inclinada rosca_punho rosca_punho_pe rosca_scott rosca_spider rotacao_cabo rotacao_deitado rotacao_em_pe rotacao_externa rotacao_externa_90 rotacao_interna rotacao_sentado rotacao_toracica russian_twist salto salto_caixa salto_distancia salto_estrela salto_grupado salto_lateral salto_unipodal sapo segurar sentado_90_90 sentar_levantar serratil shrimp sissy sit_up skater skipping slam snatch split_step squat_jack squat_thrust step_down step_lateral step_up step_up_joelho stiff stiff_unilateral stir_pot superman supino supino_bola supino_chao supino_declinado supino_em_pe supino_inclinado supino_maquina svend tandem terra terra_sumo thruster tibial tibial_sentado tke toalha_costas torcao_deitado tornozelo transferencia_peso treno treno_puxar triceps_acima triceps_coice triceps_frances triceps_frances_cabo triceps_maquina triceps_pulley triceps_testa trx_frente turkish urso_toque v_sit v_up vacuum virada_pneu voador_inverso voleio wall_ball wall_slide wall_walk windmill woodchop worlds_greatest ytw'.split(' ');
  const MAPA_RAW = `pe_agachu:g,barra;pe_agach_bul:1t,halteres;pe_leg_press:4y;pe_stiff:8p,barra;pe_hip_thrust:4l,barra;pe_cadeira_ext:3t;pe_mesa_flex:48;pe_pantu:5k
pe_pantu_sent:5m;pe_agach_sum:u,halter;pe_agach_salto:t;pe_hack_squat:4j;pe_adut_maq:1x;pe_abd_maq:1w;pe_terra_rom:8p,barra;pe_glute_kick:2f,polia
co_terra:92,barra;co_remada_c:73;co_puxada_f:6t;co_remada_h:78;co_remada_hal:7b;co_pull_over:6q;co_puxada_supinada:6u;co_remada_maq:76
co_remada_cavalinho:73,landmine;co_face_pull:3u;co_ext_lombar:3q;co_bom_dia:1o,barra;pe_supino_r:8t;pe_supino_inc:8y;pe_supino_dec:8w;pe_supino_hal:8t,halteres
pe_crucifixo:2r;pe_crucifixo_inc:2s;pe_mergulho:55;pe_crossover:2o;pe_peck_deck:5q;at_rosca_d:7i,barra;at_rosca_m:7i;at_rosca_concentrada:7k
at_rosca_scott:7o,barra_ez;at_rosca_cabo:7i,polia;at_rosca_inclinada:7l;tr_triceps_p:9j;tr_triceps_t:9k,barra_ez;tr_triceps_frances:9g;tr_kickback:9f,halter;tr_mergulho_banco:56,,banco
tr_triceps_cabo_corda:9j;om_elev_lat:3a;om_dev_front:2y;om_dev_arnold:2y;om_rem_alt:71;om_elev_front:37;om_bird_row:2t;om_trap_encolher:3h
ab_prancha:6b;ab_crunch:0;ab_leg_raise:3c;ab_crunch_obliquo:0;ab_russian_twist:7y;ab_abdominal_maq:2v;ab_prancha_lat:6f;ab_dead_bug:2x
ab_vacuum:9q;cal_flex_j:42;cal_flex:3w;cal_flex_diamante:3y;cal_flex_larga:3w;cal_flex_elevada:3x;cal_pike:5v;cal_pike_elev:5v
cal_archer_pu:3w;cal_one_arm:3w;cal_hspu_neg:4o;cal_hspu:4o;cal_dead_hang:5s;cal_scap_pull:5s;cal_pull_neg:1g;cal_chin_up:1h
cal_pull_up:1g;cal_pull_neutro:1g;cal_pull_com_peso:1g;cal_archer_pull:1g;cal_muscle_up:59;cal_one_arm_pull:1g;cal_agach_corp:g;cal_agach_split:9
cal_fenda:9;cal_step_up:8n,,degrau;cal_shrimp_sq:8b;cal_pistol:5x;cal_nordic:5b;cal_glute_bridge:65;cal_hollow:4n;cal_hollow_rock:4n
cal_lsit:4w;cal_dragon:36;cal_front_lev:4e;cal_tuck_fl:4e;cal_wall_hs:5n;cal_free_hs:5n;cal_tuck_planche:5z;cal_planche_neg:5z
cal_human_flag:4e;cal_back_lever:4e;func_burpee:1u;func_mountain_climb:57;func_box_jump:80,,caixa;func_kettlebell_swing:4u;func_farmers_walk:20,halteres;func_clean:2d
func_thruster:94,halteres;func_turkish_getup:9m;func_battle_rope:2j;func_sled_push:9c;func_pull_sled:9d;mobi_dislocate:35;mobi_hip_circle:2b;mobi_ankle_mob:9a
mobi_jefferson_curl:4r,halter;mobi_deep_squat:q;mobi_thoracic:7x;aquec_pular_corda:6m;aquec_agil_ladder:3l;cardio_corrida_est:2l;cardio_jumping_jack:61;cardio_sprint_30:2l
func_rdl_halter:8p,halteres;func_agach_goblet:g,kettlebell;func_waiter_carry:1z;func_push_press:6s;func_med_ball_slam:8g;func_tire_flip:9r;func_wall_ball:9u;func_band_pull_apart:6n
func_single_leg_rdl:8q,halter;func_broad_jump:81;at_rosca_zottman:7j;at_rosca_21:7i,barra;at_rosca_banco_incl:7l;at_chin_up_close:1h;tr_close_bench:8t;tr_triceps_maq:9i
tr_overhead_cabo:9h;om_lateral_cabo:3b;om_press_plate:2y,anilha;om_land_mine_press:4x;ab_crunch_polia:2w;ab_wheel:7e;ab_pallof_press:5g;pe_supino_hal_inc:8y,halteres
pe_flexao_aneis:3w;pe_step_up_halteres:8n,halteres,banco;pe_fenda_hal:9,halteres;pe_sissy_squat:8c;pe_wall_sit:p;co_serrote:7b;co_pull_lat_maq:6t;cal_ring_dips:55,,argolas
cal_ring_row:75,,argolas;pe_svend_press:90;pe_cable_fly_high:2o;pe_cable_fly_low:2p;pe_machine_chest_press:8z;pe_floor_press:8v;pe_dips_bar:55;pe_incline_cable_fly:2s,polia
co_t_bar_row:73,landmine;co_meadow_row:73,landmine;co_seal_row:72;co_rack_pull:92,barra;co_cable_row_wide:78;co_shrug_bar:3h,barra;co_bent_over_lat:2t;co_superman:8s
co_bird_dog:1n;pe_split_squat_bar:g,barra;pe_safety_squat:g,barra;pe_box_squat:i,barra,caixa;pe_pause_squat:g,barra;pe_romanian_dl:8p,barra;pe_deficit_dl:92,barra;pe_leg_ext_uni:3t
pe_lying_curl:48;pe_seated_leg_curl:4b;pe_calf_donkey:5k;pe_leg_press_wide:4y;pe_smith_squat:g,smith;pe_glute_bridge_single:69;pe_cable_hip_ext:2f,polia;om_behind_neck:2y,barra
om_face_pull_rope:3u;om_lateral_lean:3b,halter;om_upright_cable:71,polia;om_w_raise:3f;om_cuban_press:71,halteres;at_reverse_curl:7i,barra;at_spider_curl:7p;at_drag_curl:7i,barra
at_cable_curl:7i,polia;at_chin_hang:1h;tr_dips_weighted:55;tr_reverse_pushdown:9j;tr_single_arm_overhead:9g;tr_jm_press:9k;tr_cable_overhead:9h;ab_cable_crunch:2w
ab_side_bend:43;ab_windmill:9x;ab_hanging_knee:39;ab_toes_to_bar:3d;ab_cable_woodchop:9y;ab_stability_ball_crunch:0;ab_plank_to_pushup:3z;func_sumo_dl:93,barra
func_trap_bar_dl:92,barra;func_barbell_row:73;func_clean_jerk:2d;func_tire_carry:27;func_sled_row:9d;func_yoke_carry:20,barra;cal_commando_pull:1g;cal_inverted_row:75
cal_australian_row:75;cal_wide_pull:1g;cal_pseudo_planche:3w;cal_spiderman_push:3w;cal_ring_pushup:41;cal_clap_pushup:40;cal_crow_stand:5z;cal_advanced_tuck:5z
cal_maltese:4e;mobi_cat_cow:4f;mobi_world_greatest:9z;mobi_hip_flexor_stretch:a;mobi_pigeon_pose:64;mobi_90_90:88;mobi_shoulder_dislocate:35;mobi_leg_swings:1f
mobi_spinal_twist:99;cond_rowing_machine:7c;cond_assault_bike:1k;cond_jump_rope_du:6m;cond_sled_sprint:9c;cond_clean_complex:2d;cal_cossack_squat:d;cal_squat_180:t
cal_plyometric_lunge:f;cal_step_up_jump:8n,,degrau;cal_planche_pushup:3w;cal_v_sit:9o;func_snat:8h;func_paused_deadlift:92,barra;func_atlas_stone:2d,saco_areia;neck_flexion:6x
neck_lateral:5u;act_glute_activation:4,mini_band;act_band_walk:22,mini_band;act_rotator_cuff:7t;act_thoracic_ext:3r;comp_muscle_snatch:8h;comp_zercher_squat:k,barra;comp_front_squat:k,barra
comp_push_jerk:6s;comp_hang_clean:2d;mobi_pec_stretch:z;mobi_lat_stretch:4q,barra;mobi_quad_stretch:15;mobi_hamstring_progressive:11;mobi_wall_ankle:9a;mobi_thoracic_rotation_wall:7s
pe_chest_dip_rings:3x;pe_low_incline:8y,halteres;pe_dumbbell_pullover_ext:6q;pe_360_fly:2o;pe_bench_with_pause:8t;co_chest_supported_row:72;co_incline_row:72,barra;co_lat_pulldown_close:6u
co_back_extension_ball:3o,,bola_suica;co_ring_row_feet_elevated:75,,argolas;om_pike_pushup_wall:5v;om_bottoms_up_kb:32,kettlebell;om_trap_raise:3f;om_empty_can:3f;om_seated_db_press:31;om_db_lateral_seated:3a
at_band_curl:7i,elastico;at_bayesian_curl:7i,polia;at_chin_eccentric:1h;at_band_assisted_chin:1h;tr_board_press:8t;tr_triceps_pushdown_v:9j;tr_rolling_ext:9k,halteres;tr_diamond_pushup_slow:3y
cal_nordic_hold:5b;cal_standing_hip_circle:29;cal_bear_crawl:3j;cal_pistol_box:5y,,banco;cal_reverse_plank:6j;cal_stir_pot:8r;cal_skin_cat:4e;cal_flag_negativo:4e
func_jump_squats_weight:t,halteres;func_power_clean_from_hang:2d;func_kb_press:32,kettlebell;func_box_step_over:8n,,caixa;func_sandbag_carry:27;func_kb_snatch:8h,kettlebell;cond_hiit_sprint:2l;cond_farmers_singles:20,kettlebell
cond_prowler:9c;cond_vertimax:7z;mobi_frog_stretch:86;mobi_couch_stretch:2n;mobi_wrist_series:4f;mobi_thoracic_foam:3r;mobi_ankle_circles:9a;func_single_leg_press:4y
func_seated_calf:5m;func_hip_hinge:8p,-;func_goblet_squat_pause:g,kettlebell;ab_rollout_barbell:7e;ab_suitcase_crunch:9p;ab_landmine_rotation:7q,-;pe_batch3_0:8t,halter;pe_batch3_1:5q
pe_batch3_2:3x;pe_batch3_3:8x,polia;pe_batch3_4:8z;pe_batch3_5:41,,bola_suica;pe_batch3_6:8y,smith;pe_batch3_7:2p;pe_batch3_8:2q;pe_batch3_9:8t
co_batch3_0:73,halteres;co_batch3_1:6t;co_batch3_2:71,kettlebell;co_batch3_3:6p;co_batch3_4:73;co_batch3_5:3o,,bola_suica;co_batch3_6:6o,elastico;co_batch3_7:77
co_batch3_8:3u,halteres;co_batch3_9:73,smith;co_batch3_10:7b;co_batch3_11:6v;pe_batch3_extra_0:u,kettlebell;pe_batch3_extra_1:o,barra;pe_batch3_extra_2:8q,halter;pe_batch3_extra_3:g,polia
pe_batch3_extra_4:p;pe_batch3_extra_5:t;pe_batch3_extra_6:97;pe_batch3_extra_7:5c;pe_batch3_extra_8:g,barra;pe_batch3_extra_9:5b;pe_batch3_extra_10:4y;pe_batch3_extra_11:5k
om_batch3_0:31,barra;om_batch3_1:6s,kettlebell;om_batch3_2:71,kettlebell;om_batch3_3:3a;om_batch3_4:a0;om_batch3_5:6k;om_batch3_6:5v;om_batch3_7:3b
om_batch3_8:7r,halter;om_batch3_9:7r,halter;at_batch3_0:7j;at_batch3_1:7i,barra_ez;at_batch3_2:7i,polia;at_batch3_3:7m;at_batch3_4:7i;at_batch3_5:7i,barra
at_batch3_6:7j,polia;tr_batch3_0:9f,halter;tr_batch3_1:8z;tr_batch3_2:9j;tr_batch3_3:9j,elastico;tr_batch3_4:9j;tr_batch3_5:9k,halteres;tr_batch3_6:8v,halter
ab_batch3_0:6k;ab_batch3_1:57;ab_batch3_2:2;ab_batch3_3:3c;ab_batch3_4:9p;ab_batch3_5:6c;ab_batch3_6:4g;ab_batch3_7:4x
ab_batch3_8:7s,medicine_ball;ab_batch3_9:2i;func_batch3_0:2d,saco_areia;func_batch3_2:8g;func_batch3_3:1r,saco_areia;func_batch3_4:8n,halteres,banco;func_batch3_5:1b;func_batch3_6:7q
func_batch3_7:6s;func_batch3_8:71,kettlebell;func_batch3_9:2y,barra;func_batch3_10:9d;func_batch3_11:54;func_batch3_12:5r;func_batch3_13:5r,-;func_batch3_14:20,barra
cal_push_batch3_0:40;cal_push_batch3_1:3w;cal_push_batch3_2:3x;cal_push_batch3_3:4o;cal_push_batch3_4:41,,bola_suica;cal_push_batch3_5:3w;cal_push_batch3_6:3w;cal_push_batch3_7:3w
cond_batch3_0:1k;cond_batch3_1:1r;cond_batch3_3:33;cond_batch3_4:1u;cond_batch3_5:4u;cond_batch3_6:7c;cond_batch3_7:6m;cal_legs_batch3_0:l
cal_legs_batch3_1:3;cal_legs_batch3_2:29;cal_legs_batch3_3:69;cal_legs_batch3_4:d;cal_legs_batch3_5:8c;cal_legs_batch3_6:1t,,banco;cal_legs_batch3_7:5y,trx;pu_close_neutral:1h
pu_l_sit_pull:1g;pu_typewriter:1g;pu_neg_archer:1g;pu_explosive_pull:1g;pu_band_pull:1g;pu_gironda_sternum:1g;pu_mixed_grip:1g;sk_flag_tuck:4e
sk_straddle_planche:5z;sk_full_planche:5z;sk_handstand_wall:5n;sk_frog_stand:5z;sk_hs_pushup_wall:4o,,parede;sk_front_lever_adv:4e;cc_back_lever_tuck:4e;cc_ab_rollout_standing:7e
cc_planche_lean_adv:5z;mo_bretzel:88;mo_shinbox:88;mo_shoulder_cir:35;mo_thoracic_opener:51;mo_neck_stretch:5u;fn_renegade_row:77;fn_single_leg_dl_kb:8q,kettlebell
fn_overhead_squat:o,barra;fn_jump_rope_complex:6m;fn_cable_chop:9y;fn_deadmill_sprint:2m;fn_grip_hang_towel:5s;fn_tgu_light:9m;pu_towel_pullup:1g;pu_ring_muscle_up:59
pu_false_grip:1g;co_rotary_torso:7w;co_flutter_kicks:4c;co_scissor_kicks:4c;co_ab_wheel_knees:7e;pe_loaded_stretch:2r;pe_flat_band_press:8t;bi_prone_incline_curl:7p
bi_pinwheel_curl:7j;om_partial_lat_raise:3a;om_band_pull_loop:3f,elastico;pl_back_squat_highbar:g,barra;pl_back_squat_lowbar:g,barra;pl_quad_extension_drop:3t;pl_hip_flexor_raise:52;fn_bear_complex:2d
fn_kb_complex:4u;fn_sprint_resistance:2l,elastico;ca_circuit_bodyweight:1u;ca_step_aerobics:8o;ca_lateral_shuffles:33;co_prone_cobra:8s;co_snatch_high_pull:71;tr_band_pushdown:9j,elastico
tr_lying_db_extension:9k,halteres;fn_medball_chest_pass:5o;fn_overhead_carry:1z;fn_box_lateral_jump:84;ca_air_bike_intervals:1k;co_lat_shrug:6t;pl_single_leg_calf:5l,,degrau;ab_slider_pike:5w
pe_hs_press_parallel:5v;sk_ring_support:55,,argolas;sk_hs_balance_drill:5n;lb_hk1:4j;lb_af1:9;lb_af2:1t,halteres,banco;lb_cf1:4b;lb_pa2:5m
lb_wb1:p;lb_ps1:b;lb_sq1:5y;lb_hp1:4l,barra;lb_gl1:4l,barra;lb_gl2:65;lb_gl3:1w;lb_gl4:4,mini_band
lb_gl5:2f,polia;lb_gl6:2f,elastico;lb_gl7:8n,halteres,banco;lb_gl8:22,mini_band;lb_gl9:2h,mini_band;lb_gl10:3v;lb_gl11:4l;lb_gl12:d
lb_gl13:8p,halteres;lb_co5:6q;lb_co8:1o,barra;lb_co9:73,landmine;lb_co10:74;lb_co11:6u;lb_om1:2y;lb_om4:3h
lb_om5:2y;lb_om7:2t;lb_om8:7t;lb_br1:7i,barra;lb_br2:7j;lb_br7:56,,banco;lb_br8:9g;lb_cr1:6b
lb_cr6:3c;lb_cr8:4n;lb_cr10:0;lb_cr11:1j;lb_cr12:7e;lb_mob1:2b;lb_mob3:28;lb_mob6:88
lb_mob7:4f;lb_al1:14;lb_al2:a;lb_al3:z,,parede;lb_al4:15;lb_al5:x,,parede;lb_al6:4h;lb_al7:6a
lb_al8:4q;lb_al9:5f;lb_al10:99;lb_eq1:3k;lb_eq2:8q,halter;lb_eq3:3k;lb_eq4:3k,halter;lb_eq5:4
lb_eq6:5y,,cadeira;lb_eq7:3k;lb_eq8:52;acad_leg_press_horizontal:4y;acad_leg_press_pes_juntos:4y;acad_panturrilha_leg_press:5j;acad_hack_reverso:4j;acad_smith_afundo:9,smith
acad_smith_hip_thrust:4l,smith;acad_smith_stiff:8p,smith;acad_gluteo_maquina:2g;acad_flexora_em_pe:4a;acad_pull_through:4u,polia;acad_abdutora_inclinada:1w;acad_adutor_cabo:7,polia;acad_panturrilha_smith:5l,smith
acad_agach_landmine:g,landmine;acad_supino_maq_inclinado:8z;acad_supino_smith_reto:8t,smith;acad_crossover_unilateral:2o;acad_supino_cabo_pe:8x,polia;acad_supino_neutro:8t,halteres;acad_supino_declinado_maq:8z;acad_mergulho_maquina:55
acad_rosca_maquina:7o,-;acad_rosca_martelo_corda:7i,polia;acad_triceps_testa_polia:9k,polia;acad_triceps_coice_cabo:9f,polia;acad_remada_baixa_unilateral:78;acad_remada_alta_maquina:76;acad_barra_graviton:1g;acad_hiperextensao_gluteo:3q
acad_desenv_maquina:30;acad_desenv_smith:31,smith;acad_crucifixo_inverso_maq:9s;acad_crucifixo_inverso_cabo:2t,crossover;acad_y_raise_cabo:3f,crossover;acad_rotacao_externa_cabo:7t,polia;acad_rotacao_interna_cabo:7v,polia;acad_elev_joelhos_paralelas:38
acad_abdominal_declinado:8d;acad_trx_remada:7a;acad_trx_agach:g,trx;acad_trx_flexao:9l;acad_trx_fallout:9l;acad_trx_y:3f,trx;acad_trx_bulgaro:1t,trx,trx;acad_bosu_agach:g
acad_landmine_afundo:e,landmine;acad_rosca_scott_unilateral:7o,halter;casa_agach_mochila:g,mochila;casa_afundo_reverso:e;casa_bom_dia_elastico:1o,elastico;casa_ponte_cadeira:68,,cadeira;casa_hip_thrust_sofa:4l,mochila,cadeira;casa_flexora_toalha:49,toalha
casa_flexora_bola:45;casa_tibial_parede:95;casa_agach_mini_band:g,mini_band;casa_ponte_abducao:65,mini_band;casa_goblet_afundo_reverso:e,kettlebell;casa_step_up_lateral:8m,,degrau;casa_agach_bola_parede:j;casa_flexao_inclinada:41,,cadeira
casa_flexao_mochila:3w,-;casa_supino_elastico:8x;casa_crucifixo_elastico:2q,elastico;casa_remada_toalha_porta:74,toalha;casa_remada_mochila:73,mochila;casa_remada_gorila:73,kettlebells;casa_pulldown_elastico:6p,elastico;casa_desenv_elastico:2y,elastico
casa_elev_lateral_elastico:3a,elastico;casa_halo_kb:4k;casa_rosca_martelo_cruzada:7j;casa_triceps_toalha:9g,toalha;casa_triceps_elastico_overhead:9g,elastico;casa_canivete_bola:24;casa_prancha_bola:6d;casa_bear_hold:6l
casa_toque_calcanhar:0;casa_pallof_elastico:5g,elastico;casa_prancha_lateral_quadril:6h;casa_dead_bug_bola:2x;casa_kb_clean_press:2d,kettlebell;casa_snatch_halter:8h,halter;casa_man_maker:1u,halteres;casa_devil_press:1u,halteres
casa_inchworm:4p;casa_squat_thrust:8k;casa_kb_figura8:4u;casa_afundo_passagem_kb:9,kettlebell;casa_skater_squat:8b;casa_frog_pump:65;casa_step_down:8l,,degrau;casa_flexao_pes_bola:3x,,bola_suica
casa_flexao_hindu:5v;casa_dive_bomber:5v;casa_agach_frontal_2kb:k,kettlebells;casa_terra_kb:92,kettlebell;casa_face_pull_elastico:3u,elastico;casa_afundo_cruzado:c,-;casa_ponte_unilateral_mochila:4l,mochila,cadeira;casa_agach_salto_lateral:33
casa_bulgaro_cadeira_mochila:1t,mochila,cadeira;casa_prancha_lateral_remada:6f,kettlebell;hiit_polichinelo_baixo:62;hiit_skipping:8f;hiit_anfersen:17;hiit_burpee_lateral:1u;hiit_plank_jack:6c;hiit_polichinelo_cruzado:61
hiit_squat_jack:8j;hiit_salto_estrela:82;hiit_sprawl:8k;hiit_soco_agach:r;hiit_joelhada_soco:4s;hiit_kb_swing_americano:4v;hiit_complexo_halteres:94,halteres;hiit_corda_naval_lateral:2j
hiit_eliptico:3g;hiit_esteira_inclinada:21;hiit_esteira_intervalos:2m;hiit_caranguejo:26;hiit_mountain_cruzado:58;hiit_kb_swing_unilateral:4u;hiit_toques_degrau:8o;hiit_fast_feet:5t
hiit_agach_pulso:r;hiit_afundo_joelho:e;hiit_step_joelho:8o,,degrau;hiit_salto_sapo:81;hiit_burpee_box_over:1u;hiit_v_up:9p;hiit_prancha_sobe_desce:3z;hiit_patinador_baixo:8e
hiit_marcha_bracos:52;hiit_remo_piramide:7c;hiit_bike_tabata:1k;hiit_circuito_cadeira:89;hiit_amrap_corpo:1u;hiit_kb_clean_squat:2d,kettlebell;rq_split_step:8i,-;rq_split_step_reacao:8i,-
rq_shuffle_cones:33;rq_crossover_step:5p;rq_drop_step:5t;rq_escada_icky:3l;rq_escada_lateral:3l;rq_estrela_cones:33;rq_t_test:2l,,cones;rq_kitchen_drill:5t
rq_mb_scoop:1b;rq_mb_smash:1a;rq_re_90_elastico:7u;rq_ri_90_elastico:7u;rq_d2_elastico:34;rq_serratil_parede:9v,mini_band;rq_flexao_plus:3w;rq_extensao_punho:7m,halter
rq_tyler_twist:5r,-;rq_pronacao_supinacao:7m,halter;rq_desvio_radial_ulnar:7m,halter;rq_shadow_swing:4d;rq_forehand_elastico:4d,elastico;rq_panturrilha_excentrica:5l,,degrau;rq_soleo_joelho_flexionado:5i,halter;rq_pogo:60
rq_cone_hops:84;rq_skater:8e;rq_aterrissagem:7z;rq_frenagem_3_passos:2l,,cones;rq_salto_smash:7z;rq_tuck_jump:83;rq_salto_unipodal_stick:85;rq_copenhagen_curto:2i
rq_afundo_lateral_dink:d,raquete;rq_afundo_rotacional:9,medicine_ball;rq_cabo_lift:50;rq_pallof_meio_ajoelhado:5g;rq_thread_needle:6f;rq_star_plank:6e;rq_open_book:51;rq_sleeper:7r
rq_remada_rotacional_trx:7a;rq_band_walk_atletica:22,mini_band;rq_reacao_bola:6y;rq_bosu_lancamento:3k;rq_pro_agility:2l,,cones;rq_agach_espanhol:g,elastico;rq_hip_airplane:1d;s50_sentar_levantar:89,,cadeira
s50_sentar_levantar_halter:89,halter;s50_flexao_parede:44,,parede;s50_remada_elastico_sentado:79;s50_marcha_sentado:53;s50_extensao_joelho_sentado:3p,elastico;s50_panturrilha_apoio:5i;s50_extensao_quadril_apoio:2f,,cadeira;s50_tandem:91
s50_caminhada_tandem:23;s50_relogio_equilibrio:6z;s50_passo_lateral:22;s50_subida_escada:8n,,degrau;s50_levantar_do_chao:4z;s50_rotacao_tronco_sentado:7w;s50_anjo_parede:18;s50_chin_tuck:6x
s50_torcao_toalha:5r,-;s50_aperto_bolinha:5r;s50_prancha_parede:44;s50_bascula_pelvica:1i;s50_alongamento_posterior_cadeira:12,,cadeira;s50_circulos_bracos:2c;s50_bicicleta_horizontal:1m;s50_caminhada_ritmada:1y
s50_passo_cruzado:5p;s50_obstaculos:5d;s50_olhos_fechados:91;s50_alcance_funcional:w;s50_rosca_sentado:7i;s50_ponta_calcanhar:1y;s50_respiracao:7d;s50_transferencia_peso:9b
s50_sentar_levantar_unipodal:89;s50_step_up_halteres_pausa:8n,halteres,degrau;s50_farmer_tandem:23;s50_equilibrio_almofada:3k;s50_avanco_apoio:9;s50_abducao_sentado_elastico:5,mini_band;s50_marcha_mala:20,kettlebell;s50_dupla_tarefa:5d
s50_levantar_chao_sem_maos:4z;sr3_leg_press_excentrico:4y;sr3_agach_halter_banco:i,halteres;sr3_agach_pendulo:4j;sr3_split_squat_halteres:9,halteres;sr3_afundo_reverso_trx:e,trx;sr3_extensora_isometrica:3t;sr3_abducao_pe_cabo:4,polia
sr3_aducao_bola_joelhos:8;sr3_aducao_deitado:6;sr3_afundo_lateral_kb:d,kettlebell;sr3_afundo_lateral_toalha:d,toalha;sr3_afundo_lateral_landmine:d,landmine;sr3_cossack_trx:d,trx;sr3_elevacao_pelvica_maquina:4l,-;sr3_ponte_bola_suica:66,,bola_suica
sr3_flexora_elastico_sentado:47;sr3_terra_cabo:92,polia;sr3_rdl_kickstand:8p,halter;sr3_mesa_flexora_uni_exc:48;sr3_terra_uni_landmine:8q,landmine;sr3_panturrilha_sentado_halter:5m,halter,cadeira;sr3_panturrilha_elastico:96,elastico,cadeira;sr3_dorsiflexao_elastico:96,elastico
sr3_inversao_eversao:9a,elastico;sr3_marcha_re:1y;sr3_passo_reativo:9;sr3_marcha_giro_cabeca:1y;sr3_olhos_fechados_unipodal:3k;sr3_unipodal_bola_parede:3k;sr3_bosu_unipodal:5y;sr3_pallof_unipodal:5g,elastico
sr3_flexao_quadril_elastico:52;sr3_remada_articulada_uni:76;sr3_puxada_ajoelhado_uni:6o;sr3_remada_corda_rosto:3u;sr3_remada_cadeira_halteres:73,halteres;sr3_remada_elastico_afundo:70;sr3_retracao_banco_inclinado:72;sr3_crucifixo_inverso_inclinado:2u
sr3_scaption:3f;sr3_passaro_rot_externa:2u;sr3_rot_externa_isometrica_parede:7t,-;sr3_rot_externa_sentado_joelho:7u,halter;sr3_d2_cabo:34,polia;sr3_d2_extensao_elastico:34;sr3_rot_externa_exc_cabo:7u,polia;sr3_arremesso_9090_parede:1a
sr3_drop_catch_prono:a0,medicine_ball;sr3_serratil_punch:8a,halter;sr3_landmine_ajoelhado:2z,landmine;sr3_desenv_cabo_sentado:31,crossover;sr3_elev_lateral_cabo_sentado:3a,crossover;sr3_supino_inc_neutro:8y,halteres;sr3_supino_bola_suica:8u,,bola_suica;sr3_supino_cabo_uni_afundo:8x,polia
sr3_plate_pinch:87,anilha;sr3_rosca_punho_cabo:7m,polia;sr3_rosca_inversa_cabo:7i,polia;sr3_ext_punho_exc_elastico:7m,-;sr3_rosca_martelo_toalha:7i;sr3_extensores_dedos:5r,-;sr3_rosca_punho_costas:7n;sr3_carry_bottoms_up:20,kettlebell
sr3_farmer_sacolas:20,mochila;sr3_rucking_mochila:1y,mochila;sr3_shot_put_mb:5o;sr3_arremesso_ajoelhado:1b;sr3_arremesso_tras:1c;sr3_passe_peito_deitado:8v,medicine_ball;sr3_rotacao_cabo_peito:7q;sr3_backhand_elastico:1e,elastico
sr3_pallof_deslocamento:5g;sr3_passe_rotacional_costas:7s,medicine_ball;sr3_dead_bug_elastico:2x,elastico;sr3_chop_elastico_ajoelhado:9y,elastico;sr3_prancha_lateral_joelhos:6g;sr3_rotacao_bola_suica:7s,-;sr3_carioca:5p;sr3_backpedal:2l,,cones
sr3_drill_z:2l,,cones;sr3_amarelinha_escada:3l;sr3_hop_lateral_unipodal:84;sr3_shuffle_resistido:33;sr3_barreiras_lateral:84;sr3_drop_saida_lateral:7z;sr3_saltitos_linha:84;sr3_skipping_rapido:8f
sr3_cone_unico:5t;sr3_bounding_diagonal:81;sr3_reacao_bola_parede:6y;sr3_voleio_parede:9t;sr3_split_step_afundo:d,raquete;sr3_passo_arremesso_mb:1b;sr3_landmine_rotacional:4x;sr3_step_up_lateral_halteres:8m,halteres,banco
sr3_joelho_peito_caminhando:52;sr3_frankenstein:52;sr3_portao_quadril:29;sr3_agach_rotacao_toracica:s;sr3_mobilidade_punho_raquete:5e;cf3_stairmaster_continuo:3m;cf3_stairmaster_lateral:3m;cf3_stairmaster_degrau_duplo:3m
cf3_stairmaster_tiros:3m;cf3_esteira_zona2:2m;cf3_esteira_de_costas:21;cf3_esteira_lateral_inclinada:21;cf3_esteira_hill_sprint:2m;cf3_bike_zona2:1k;cf3_bike_subida_em_pe:1l;cf3_bike_unilateral:1k
cf3_airbike_bracos:1k;cf3_airbike_emom:1k;cf3_eliptico_re:3g;cf3_eliptico_sem_maos:3g;cf3_remo_pick_drill:7c;cf3_remo_pausa:7c;cf3_polia_ski:6p,crossover;cf3_corda_naval_slam:2k
cf3_corda_naval_circulos:2k;cf3_corda_naval_sentado:2j;cf3_corda_naval_polichinelo:2j;cf3_corda_naval_afundo:2j;cf3_corda_corrida:6m;cf3_corda_esqui:6m;cf3_corda_cruzada:6m;cf3_corda_imaginaria:6m,-
cf3_corda_unipodal:6m;cf3_treno_lateral:9d;cf3_treno_costas:9d;cf3_treno_urso:9d;cf3_treno_press:9c;cf3_kb_swing_duplo:4u,kettlebells;cf3_kb_swing_troca:4u;cf3_kb_dead_clean:2d,kettlebell
cf3_kb_clean_jerk:2d,kettlebell;cf3_kb_thruster:94,kettlebell;cf3_kb_rack_carry:20,kettlebells;cf3_kb_carry_misto:20,kettlebells;cf3_kb_pirate_ships:7s,kettlebell;cf3_kb_dead_stop_swing:4u;cf3_kb_afundo_press:e,kettlebell;cf3_halter_clean:2d,halteres
cf3_halter_burpee_terra:1u,halteres;cf3_halter_swing:4u,halter;cf3_halter_thruster_unilateral:94,halter;cf3_halter_afundo_rosca_press:9,halteres;cf3_halter_step_press:8n,halteres;cf3_socos_halteres:1r,halteres;cf3_landmine_thruster:94,landmine;cf3_landmine_clean_press:4x
cf3_barra_thruster:94;cf3_burpee_sobre_barra:1u,barra;cf3_mb_slam_lateral:8g;cf3_mb_burpee_slam:1u,medicine_ball;cf3_mb_wall_ball_sentado:1a;cf3_sandbag_clean:2d,saco_areia;cf3_sandbag_ombro:2d,saco_areia;cf3_bear_hug_carry:27
cf3_rucking:1y,mochila;cf3_carry_galoes:20,saco_areia;cf3_carry_anilhas_pinca:20,anilha;cf3_burpee_cadeira:1v,,cadeira;cf3_burpee_parede:44;cf3_burpee_tuck:1u;cf3_burpee_unilateral:1u;cf3_burpee_barra_fixa:1u
cf3_burpee_step:1u;cf3_mountain_banco:57;cf3_mountain_toalha:57;cf3_mountain_trx:57;cf3_mountain_bola:57;cf3_bear_crawl_lateral:3j;cf3_inchworm_flexao:4p;cf3_caranguejo_toque:26
cf3_joelho_cotovelo_pe:4s;cf3_socos_sentado:1s;cf3_chute_frontal:2a;cf3_seal_jack:63;cf3_split_jump:f;cf3_carioca:5p;cf3_wall_drill:2l,,parede;cf3_shuttle_run:2l,,cones
cf3_zigue_zague_cones:2l,,cones;cf3_miniband_polichinelo:61,mini_band;cf3_elastico_thruster:94,elastico;cf3_elastico_agach_remada:g,elastico;cf3_trx_agach_salto:t,trx;cf3_bosu_burpee:1u;cf3_polia_sprint:2l,polia;cm3_crunch_polia_sentado:2w
cm3_crunch_polia_em_pe:2w;cm3_crunch_polia_torcao:2w;cm3_abdominal_reverso_polia:2,polia;cm3_crunch_anilha_peito:0,-;cm3_abdominal_reverso_declinado:2;cm3_crunch_bosu:0;cm3_trx_abdominal_reverso:5w;cm3_trx_pike:5w
cm3_rollout_barra_banco:7e;cm3_hollow_anilha:4n;cm3_dragon_flag_negativo:36;cm3_joelhos_obliquos_barra:39;cm3_limpador_barra:3d;cm3_elev_joelhos_obliqua_paralelas:38;cm3_crunch_bracos_acima:1;cm3_crunch_pernas_bola:0
cm3_crunch_pernas_cadeira:0;cm3_tuck_crunch:9p;cm3_sit_up_parcial:8d;cm3_janda_sit_up:8d;cm3_sit_up_sapo:8d;cm3_crunch_mochila:0,-;cm3_crunch_medicine_ball:1,medicine_ball;cm3_recolhimento_sentado_chao:9p
cm3_recolhimento_sentado_banco:9p;cm3_rollout_bola:6d;cm3_body_saw_toalha:6b;cm3_prancha_rkc:6b;cm3_prancha_pes_elevados:6i,,degrau;cm3_prancha_bosu:6d;cm3_prancha_pes_trx:6i,,trx;cm3_dead_bug_elastico:2x,elastico
cm3_dead_bug_kettlebell:2x,kettlebell;cm3_lsit_grupado_halteres:4w;cm3_limpador_chao:99;cm3_russian_twist_polia:7q;cm3_russian_twist_anilha:7y,anilha;cm3_rotacao_barra_sentado:7w,barra;cm3_judo_flip_polia:9y;cm3_woodchop_halter:9y,halter
cm3_woodchop_elastico:9y,elastico;cm3_lift_elastico:50,elastico;cm3_medball_full_twist:7s,medicine_ball;cm3_inclinacao_polia_alta:4q,-;cm3_inclinacao_barra:4q,-;cm3_inclinacao_bola:25;cm3_inclinacao_banco_romano:43,-;cm3_inclinacao_elastico:4q,-
cm3_crunch_obliquo_declinado:0;cm3_canivete_lateral:25;cm3_windmill_halter:9x,halter;cm3_bent_press:9x;cm3_prancha_lateral_trx:6f,trx;cm3_pallof_acima_cabeca:5g;cm3_pallof_passo_lateral:5g,elastico;cm3_prancha_urso_toque:9n
cm3_marretada_pneu:54;cm3_slam_unilateral:8g;cm3_arremesso_deitado:1,medicine_ball;cm3_hiper_reversa_banco:4m;cm3_ext_lombar_anilha:3q;cm3_ext_lombar_isometrica:3q;cm3_ext_lombar_chao_sofa:8s;cm3_superman_alternado:8s
cm3_bird_dog_banco:1n;cm3_bom_dia_sentado:1p,barra;cm3_groiner:9z;cm3_circulos_quadril_quatro_apoios:6w;cm3_cars_quadril:29;cm3_frog_rock:86;cm3_mob_flexor_elastico:a;cm3_agachamento_kettlebell_mob:q,kettlebell
cm3_pancake:5h;cm3_toracica_banco:6a;cm3_toracica_cadeira:3s,,cadeira;cm3_rotacao_bastao_pe:7s,polia;cm3_ponte_rotacao:7x;cm3_ponte_completa:67;cm3_cars_ombro:28;cm3_wall_slide_mini_band:9v,mini_band
cm3_alongamento_toalha_costas:98;cm3_skin_cat_parcial:4e;cm3_tornozelo_elastico:9a,elastico;cm3_tornozelo_kettlebell:9a,kettlebell;cm3_tibial_ajoelhado:6a;cm3_panturrilha_degrau:y;cm3_soleo_aquiles:x;cm3_peitoral_bola:z
cm3_peitoral_atras_cabeca:10;cm3_deltoide_anterior_sentado:10;cm3_triceps_acima:9e;cm3_biceps_parede:z,,parede;cm3_antebraco_ajoelhado:4f;cm3_pescoco_lateral:5u;cm3_latissimo_parede:4q;cm3_costas_abraco:5f
cm3_joelhos_peito:4t;cm3_lombar_cadeira:12;cm3_abdomen_cobra_parcial:3n;cm3_lateral_cadeira:4q;cm3_posterior_elastico:13;cm3_posterior_degrau:11;cm3_quadriceps_lado:16;cm3_gluteo_sentado:4i,,colchonete
cm3_gluteo_cadeira:4i,,cadeira;cm3_adutor_borboleta_deitada:1q;cm3_banda_it_pe:4q;cm3_rolo_quadriceps:7g;cm3_rolo_panturrilha:7h;cm3_rolo_latissimo:7f;cm3_rolo_banda_it:7g;cm3_rolo_isquiotibiais:7h
cm3_rolo_gluteo:7h;cm3_rolo_adutor:7g;cb3_puxada_corda_pulley:6u;cb3_puxada_pausa_peito:6t;cb3_puxada_excentrica_lenta:6t;cb3_puxada_amplitude_total:6t;cb3_puxada_articulada_unilateral:6v,-;cb3_puxada_unilateral_elastico_ajoelhado:6o,elastico
cb3_remada_alta_ajoelhado_polia:6o;cb3_remada_alta_unilateral_ajoelhado:6o;cb3_pulldown_corda:6p;cb3_pulldown_unilateral_cabo:6p;cb3_pulldown_banco_inclinado:6p;cb3_pullover_barra_banco:6q,barra,banco;cb3_pullover_kettlebell_chao:6r,kettlebell;cb3_pullover_mochila_chao:6r,mochila
cb3_pullover_bola_suica:6q,,bola_suica;cb3_barra_pes_cadeira:1g;cb3_pullup_pausa_90:1g;cb3_arrasto_toalhas_chao:5a;cb3_puxada_crossover_ajoelhado:6o,crossover;cb3_puxada_isometrica_toalha:6o,toalha;cb3_remada_curvada_supinada:73;cb3_remada_pendlay:73
cb3_remada_landmine_unilateral_ajoelhado:7b,landmine;cb3_remada_dois_halteres_pronada:73,halteres;cb3_remada_halteres_neutra:73,halteres;cb3_remada_kettlebell_unilateral:7b,kettlebell;cb3_remada_kettlebell_alternada:73,kettlebells;cb3_remada_baixa_pausa:78;cb3_remada_baixa_supinada:78;cb3_remada_polia_rotacao:70,polia
cb3_remada_t_deitado:72,landmine;cb3_remada_smith_unilateral:73,smith;cb3_remada_invertida_smith:75;cb3_remada_invertida_mesa:75,,mesa;cb3_remada_unilateral_trx:7a;cb3_remada_aberta_trx:7a;cb3_remada_elastico_rotacao:74;cb3_remada_mochila_unilateral:7b,mochila,cadeira
cb3_remada_garrafas:73,halteres;cb3_remada_isometrica_toalha:79,toalha;cb3_scap_row_trx:7a;cb3_y_banco_inclinado:2u;cb3_depressao_escapular_pulley:6t;cb3_y_elastico_em_pe:3f,elastico;cb3_extensao_lombar_isometrica:3q;cb3_extensao_lombar_anilha:3q
cb3_nadador_deitado:5a;cb3_good_morning_sentado:1p,barra;cb3_rosca_barra_aberta:7i,barra;cb3_rosca_barra_fechada:7i,barra;cb3_rosca_spider_barra_w:7p,barra_ez;cb3_rosca_scott_maquina:7o,-;cb3_rosca_scott_cabo:7o,polia;cb3_rosca_deitado_cabo:7i,polia
cb3_rosca_polia_alta_deitado:7i,polia;cb3_rosca_concentrada_em_pe:7k;cb3_rosca_deitado_banco_reto:7l;cb3_rosca_rotacao_externa:7i;cb3_rosca_kettlebell:7i,kettlebell;cb3_rosca_mochila:7i,saco_areia;cb3_rosca_toalha_isometrica:7i,toalha;cb3_rosca_bayesiana_elastico:7i,elastico
cb3_rosca_trx:7i,trx;cb3_rosca_toalha_macaneta:7i,toalha;cb3_rosca_corporal_smith:7a,-;cb3_rosca_excentrica_lenta:7i;cb3_rosca_maquina_unilateral:7o,-;cb3_rosca_landmine:7i,landmine;cb3_rosca_martelo_inclinada:7l,,banco_inclinado;cb3_rosca_scott_martelo:7o,halter
cb3_rosca_martelo_elastico:7i,elastico;cb3_rosca_inversa_scott_w:7o,barra_ez;cb3_rosca_inversa_cabo:7i,polia;cb3_rosca_inversa_halteres:7i;cb3_rosca_inversa_elastico:7i,elastico;cb3_rosca_inversa_anilha:7i,anilha;cb3_rosca_zottman_scott:7o,halter;cb3_rosca_martelo_toalha_kettlebell:7i,kettlebell
cb3_rosca_punho_barra_banco:7m,barra,banco;cb3_extensao_punho_barra_banco:7m,barra,banco;cb3_rosca_punho_atras_costas:7n;cb3_rosca_dedos_barra:7m,barra;cb3_rosca_punho_cabo:7m,polia;cb3_pinca_anilhas:87,anilha;cb3_bottoms_up_kettlebell:87,kettlebell;cb3_suspensao_unilateral:5s
cb3_rolo_punho_caseiro:5r,-;cb3_extensao_dedos_elastico:5r,-;cb3_extensao_punho_elastico:7m,elastico;cb3_remada_toalha_halter:7b;cb3_sustentacao_barra_grossa:87,barra;gp3_ponte_barra_chao:65,barra;gp3_hip_thrust_maquina:4l,-;gp3_hip_thrust_pausa:4l,barra
gp3_hip_thrust_kb:4l,kettlebell;gp3_hip_thrust_landmine:4l,landmine;gp3_hip_thrust_polia:4l,polia;gp3_hip_thrust_b_stance:4l,barra;gp3_hip_thrust_smith_unilateral:4l,smith;gp3_coice_smith:2e,smith;gp3_coice_halter_joelho:2e,halter;gp3_coice_polia_4apoios:2e,polia
gp3_gluteo_multi_hip_extensao:2g;gp3_hiper_reversa:4m;gp3_hiper_reversa_banco:4m;gp3_hiperext_45_unilateral:3q;gp3_hiperext_isometrica:3q;gp3_flutter_pronado:4m;gp3_agach_ajoelhado_barra:h,barra;gp3_frog_pump_halter:65,halteres
gp3_hiper_reversa_bola:4m,,bola_suica;gp3_ponte_trx:68,trx;gp3_ponte_smith_chao:65,smith;gp3_kickback_polia_diagonal:2f,polia;gp3_bulgaro_inclinado:1t,halteres,banco;gp3_afundo_reverso_inclinado:e,halteres;gp3_leg_press_pes_altos:4y;gp3_coice_4apoios:2e
gp3_coice_mini_band:2e,mini_band;gp3_ponte_bola_ombros:66,,bola_suica;gp3_ponte_elastico_quadril:65,-;gp3_ponte_isometrica:65;gp3_ponte_pes_parede:68,,parede;gp3_ponte_unilateral_degrau:68,,degrau;gp3_ponte_halter_quadril:65,halter;gp3_hip_thrust_sofa_elastico:4l,-,cadeira
gp3_extensao_quadril_prona:8s;gp3_pull_through_elastico:4u,elastico;gp3_stiff_halteres:8p,halteres;gp3_stiff_base_aberta:8p,barra;gp3_romeno_deficit:8p,barra;gp3_bom_dia_sentado:1p,barra;gp3_bom_dia_pinos:1o,barra;gp3_romeno_pegada_arranco:8p,barra
gp3_stiff_polia:8p,polia;gp3_stiff_unilateral_polia:8q,polia;gp3_romeno_2kb:8p,kettlebells;gp3_romeno_landmine_unilateral:8q,landmine;gp3_romeno_tempo_halteres:8p,halteres;gp3_romeno_kickstand:8p,halteres;gp3_romeno_hexagonal:8p,barra;gp3_stiff_smith_unilateral:8q,smith
gp3_mesa_flexora_unilateral:48;gp3_cadeira_flexora_inclinada:4b;gp3_flexora_excentrica:48;gp3_flexora_polia_em_pe:4a,polia;gp3_flexora_halter_deitado:46,halter;gp3_flexora_trx:49,-;gp3_nordico_elastico:5b;gp3_ghr_natural:5b
gp3_bom_dia_kb:1o,kettlebell;gp3_flexora_bola_unilateral:45;gp3_flexora_toalha_unilateral:49,toalha;gp3_flexora_elastico_brucos:46;gp3_ponte_isquios_estendida:65;gp3_ponte_unilateral_cadeira:68,,cadeira;gp3_stiff_mochila:8p,mochila;gp3_stiff_unilateral_parede:8q,halter
gp3_bom_dia_mochila:1o,mochila;gp3_stiff_elastico:8p,elastico;gp3_aducao_elastico:7,elastico;gp3_aducao_sentado_squeeze:8;gp3_ponte_squeeze:65;gp3_copenhagen_dinamico:2i;gp3_sumo_smith:u,smith;gp3_cadeira_adutora_inclinada:1x
gp3_sumo_halter_steps:u,halter;gp3_afundo_lateral_goblet:d,halter;gp3_cossack_kb:d,kettlebell;gp3_sumo_landmine:u,landmine;gp3_afundo_lateral_trx:d,trx;gp3_abducao_polia_em_pe:4,polia;gp3_abducao_multi_hip:4,-;gp3_abducao_elastico_em_pe:4,mini_band
gp3_abducao_deitado_halter:3,halter;gp3_concha_reversa:2h;gp3_fire_hydrant_mini_band:3v,mini_band;gp3_hip_hike:3e;gp3_prancha_lateral_joelhos_abducao:6g;gp3_hip_airplane_assistido:1d;gp3_abducao_isometrica_parede:4,-;gp3_prancha_lateral_concha:6g,mini_band
gp3_circulos_4apoios:6w;gp3_abdutora_3_angulos:1w;gp3_afundo_cruzado_halteres:c,halteres;gp3_abducao_bola_suica:4,-;gp3_clam_halter:2h;om3_lateral_maquina:3a,-;om3_lateral_cabo_sentado:3b;om3_lateral_cabo_atras:3b
om3_lateral_crossover_cruzada:3a,crossover;om3_lateral_inclinado_lado:3b,halter;om3_lateral_peito_apoiado:2u;om3_lateral_pausa:3a;om3_lateral_um_e_meio:3a;om3_lu_raise:3f;om3_lateral_landmine:3b,-;om3_lateral_trx:3a,trx
om3_lateral_garrafas:3a;om3_abducao_iso_parede:3a,-;om3_lateral_mini_band:3a,mini_band;om3_remada_alta_smith_uni:71,smith;om3_remada_alta_halteres:71,halteres;om3_lateral_frontal_alternada:3a;om3_frontal_cabo:37,polia;om3_frontal_anilha:37,anilha
om3_frontal_inclinado:37;om3_frontal_elastico:37,elastico;om3_desenv_polia_sentado:31,crossover;om3_desenv_militar_pe:2y,barra;om3_desenv_uni_halter_pe:32;om3_desenv_neutro:2y;om3_desenv_meio_ajoelhado_kb:2z;om3_landmine_meio_ajoelhado:2z,landmine
om3_jammer_unilateral:4x;om3_bradford_press:2y,barra;om3_z_press:31;om3_desenv_gangorra_kb:32,kettlebells;om3_desenv_2kb:2y,kettlebells;om3_desenv_mochila:2y,saco_areia;om3_pike_deficit:5v;om3_posterior_polia_curvado:2t,crossover
om3_remada_corda_posterior:3u;om3_posterior_banco_inclinado:2u;om3_posterior_uni_brucos:2u,halter;om3_posterior_testa_banco:2u;om3_remada_posterior_barra:73;om3_posterior_elastico_ancorado:2t,elastico;om3_posterior_trx:7a;om3_posterior_iso_parede:18
om3_posterior_bola:2u;om3_re_90_cabo:7u,polia;om3_re_brucos_90:a0,halteres;om3_re_iso_batente:7t,-;om3_re_bilateral_elastico:7t;om3_kb_bottoms_up_carry:20,kettlebell;om3_full_can:3f;om3_d1_elastico:4d,elastico
om3_re_passo_lateral_cabo:7t,polia;om3_prancha_lateral_re:6f,halter;om3_bola_parede_circulos:9v,medicine_ball;om3_protracao_halteres:8a,halteres;om3_protracao_smith:8a,-;om3_soco_cabo:8x,polia;om3_prancha_protracao:6b;om3_parede_rolo:9v
om3_urso_protracao:6l;om3_flexao_plus_trx:9l;om3_encolh_smith_atras:3h,smith;om3_encolh_polia:3h,polia;om3_encolh_maq_panturrilha:3h,-;om3_encolh_barra_atras:3h,barra;om3_encolh_inclinado:3h;om3_encolh_mochila:3h,mochila
om3_encolh_overhead:3i;om3_encolh_explosivo:3h,barra;om3_y_bola:a0;om3_retracao_cadeira:7w;om3_depressao_cadeira:56,,cadeira;om3_mergulho_escapular:55;om3_navios_piratas_kb:7s,kettlebell;om3_arremesso_medball_cabeca:1a
om3_crucifixo_isometrico:3a;om3_wall_walk:9w;om3_bananeira_toque_ombro:5n;pt3_supino_pegada_aberta:8t;pt3_supino_guilhotina:8t;pt3_spoto_press:8t;pt3_supino_maq_descida_lenta:8z;pt3_supino_maq_unilateral:8z
pt3_supino_cabo_sentado:8z;pt3_crucifixo_cabo_banco_reto:2r,polia;pt3_crossover_polia_media:2q;pt3_cruz_ferro_cabo:2o;pt3_crossover_ajoelhado:2o;pt3_crucifixo_unilateral_halter:2r,halter;pt3_peck_deck_unilateral:5q;pt3_peck_deck_pausa:5q
pt3_hex_press:8t,halteres;pt3_bola_crucifixo:2r,,bola_suica;pt3_around_the_world:2r;pt3_supino_chao_kb_unilateral:8v,kettlebell;pt3_supino_chao_kb_alternado:8v,kettlebells;pt3_supino_kb_fundo_cima:8t,kettlebell;pt3_supino_landmine_duas_maos:4x;pt3_trx_crucifixo:9l
pt3_mergulho_graviton:55;pt3_supino_dec_smith:8w,smith;pt3_crucifixo_declinado:2r;pt3_mergulho_cadeiras:56,,cadeira;pt3_supino_inc_unilateral:8y,halter;pt3_crucifixo_inc_rotacao:2s;pt3_supino_inc_cabo:8y,polia;pt3_supino_supinado_halter:8t,halteres
pt3_supino_invertido_barra:8t;pt3_crossover_baixo_unilateral:2p;pt3_supino_inc_maq_unilateral:8z;pt3_triceps_pulley_supinado_uni:9j;pt3_triceps_cabo_ajoelhado:9h;pt3_triceps_cabo_inclinado:9k,polia;pt3_triceps_cruzado_polia:9j,crossover;pt3_triceps_overhead_uni_polia_baixa:9h
pt3_triceps_corda_pausa:9j;pt3_triceps_testa_atras_cabeca:9k;pt3_triceps_testa_declinado:9k,barra_ez,banco;pt3_triceps_testa_inclinado:9k,,banco_inclinado;pt3_triceps_testa_pronado:9k,halteres;pt3_triceps_testa_uni_supinado:9k,halter;pt3_triceps_coice_sentado:9f;pt3_supino_fechado_ez:8t,barra_ez
pt3_supino_fechado_smith:8t,smith;pt3_floor_press_barra:8v,barra;pt3_triceps_smith_peso_corporal:3z;pt3_triceps_trx:3z;pt3_triceps_landmine:9g,landmine;pt3_mergulho_banco_carga:56,anilha;pt3_paralela_triceps:55;pt3_triceps_frances_kb:9g,kettlebell
pt3_halo_kb_triceps:4k;pt3_triceps_testa_elastico:9k,elastico;pt3_triceps_coice_elastico:9f,elastico;pt3_triceps_testa_kb_chao:9k,kettlebell;pt3_flexao_inclinada_fechada:41,,cadeira;pt3_flexao_inclinada_supinada:41,,banco;pt3_flexao_relogio:3w;pt3_flexao_prancha_lateral:6f
pt3_flexao_negativa:3w;pt3_aperto_isometrico_palmas:19;pt3_limpador_isometrico:3w;pt3_flexao_toalha_deslizante:3w;pt3_flexao_elastico:3w,-;pt3_supino_chao_galoes:8v;pt3_crucifixo_chao_garrafas:2r,,colchonete;pt3_crucifixo_elastico_baixo_cima:2p,elastico
pt3_crucifixo_elastico_cima_baixo:2o,elastico;pt3_supino_inc_elastico:8x;pt3_supino_elastico_uni_afundo:8x;pt3_flexao_maos_bola:41,,bola_suica;pt3_flexao_plio_kb:40;pt3_flexao_desnivelada:3w;pt3_flexao_explosiva_parede:44,,parede;pt3_flexao_parede_fechada:44,,parede
pt3_extensao_triceps_mesa:3z;pt3_flexao_esfinge:3z;pt3_triceps_frances_mochila:9g,mochila;pt3_triceps_coice_garrafa:9f;pt3_triceps_isometrico_mesa:9j,-;pt3_flexao_diamante_joelhos:42;pt3_flexao_fechada:3y;pt3_mb_peito_3_apoios:5o
pt3_mb_arremesso_deitado:8v,medicine_ball;pt3_mb_unilateral_passada:5o;pt3_supino_cabo_rotacao:8x,polia;qp3_hack_base_fechada:4j;qp3_hack_unilateral:4j;qp3_hack_pausa:4j;qp3_pendulo:4j;qp3_agach_maquina_deitado:m
qp3_hack_barra:92,barra;qp3_leg_press_excentrico:4y;qp3_leg_press_vertical:4y;qp3_leg_press_smith:4y;qp3_leg_press_horiz_uni:4y;qp3_extensora_isometria:3t;qp3_extensora_excentrica:3t;qp3_extensao_polia:3p,polia
qp3_tke_polia:97,polia;qp3_extensao_halter_banco:3p,-;qp3_sissy_banco:8c;qp3_sissy_anilha:8c,anilha;qp3_agach_smith_frontal:k,smith;qp3_bulgaro_smith:1t,smith;qp3_pistol_smith:5x,smith;qp3_frankenstein:k,barra
qp3_agach_base_fechada:g,barra;qp3_agach_base_aberta:g,barra;qp3_agach_barra_elasticos:g,barra;qp3_afundo_barra:9,barra;qp3_passada_barra:b,barra;qp3_step_up_barra:8n,barra,degrau;qp3_afundo_reverso_deficit:e,barra;qp3_afundo_polia:e,polia
qp3_bulgaro_polia:1t,polia;qp3_landmine_hack:g,landmine;qp3_bosu_afundo:9;qp3_agach_halteres_lado:g,halteres;qp3_agach_frontal_halteres:k,halteres;qp3_agach_cyclist:k,halteres;qp3_afundo_reverso_halteres:e,halteres;qp3_passada_halteres:b,halteres
qp3_step_up_lateral_halteres:8m,halteres,degrau;qp3_kb_pistol:5x,kettlebell;qp3_kb_rack_unilateral:k,kettlebell;qp3_agach_elastico:g,elastico;qp3_agach_toalha_porta:v;qp3_extensao_joelho_elastico:3p,elastico;qp3_step_up_cruzado:8n,,degrau;qp3_step_up_alto_mochila:8n,mochila,cadeira
qp3_petersen_step_up:8n,,degrau;qp3_agach_unilat_bola:j;qp3_bulgaro_bola:1t,,bola_suica;qp3_afundo_deslizante:e,toalha;qp3_wall_sit_unilateral:p;qp3_afundo_pulsos:9;qp3_afundo_isometrico:9;qp3_agach_ponta_pes:g
qp3_mini_agach_cadeira:n;qp3_pant_barra_pe:5l,barra;qp3_pant_rocking:5i,barra;qp3_pant_barra_sentado:5m,barra,banco;qp3_pant_calf_press:5k;qp3_pant_maquina_unilateral:5k;qp3_pant_sentado_pausa:5m;qp3_pant_soleo_smith:5m,-
qp3_pant_hack:5k;qp3_pant_leg_press_uni:5j;qp3_pant_polia:5l,polia;qp3_pant_trx:5i,trx;qp3_pant_halteres_degrau:5l,halteres,degrau;qp3_pant_sobre_halter:5i,-;qp3_pant_elastico:5i,elastico;qp3_pant_caminhada_ponta:20,halteres
qp3_pant_kb_unilateral:5l,kettlebell,degrau;qp3_pant_mochila:5l,mochila,degrau;qp3_pant_sentado_mochila:5m,mochila,cadeira;qp3_pant_cadeirinha:p;qp3_pant_isometrica_unipodal:5i;qp3_pant_donkey_casa:5l,,degrau;qp3_pogo_unilateral:60;qp3_tibial_elastico:96,elastico
qp3_tibial_kb:96,-,banco;qp3_tibial_polia:96,polia;qp3_tibial_smith:95,-;qp3_tibial_anilha:96,-,banco;qp3_tibial_calcanhar_halteres:20,halteres;qp3_tibial_sentado_mochila:96,mochila,cadeira;qp3_tibial_degrau:95`;
  // </MAPA-GERADO>
  const MAPA = {};
  for (const r of MAPA_RAW.split(/[;\n]/)) {
    if (!r) continue;
    const [id, v] = r.split(':'), [ti, p, a, m] = v.split(',');
    MAPA[id] = [MAPA_T[parseInt(ti, 36)], p || '', a || '', m || ''].join('|');
  }

  const CAT_TPL = { pernas: 'agachamento', pernas_cal: 'agachamento', gluteos: 'ponte', costas: 'remada_curvada', puxar: 'barra_fixa',
    peito: 'supino', empurrar: 'flexao', ombros: 'desenvolvimento', biceps: 'rosca', triceps: 'triceps_pulley', core: 'prancha',
    core_cal: 'prancha', cardio: 'corrida', funcional: 'burpee', mobilidade: 'gato_camelo', alongamento: 'alongamento_posterior',
    equilibrio: 'equilibrio', skills: 'parada_mao' };
  function heuristica(ex) {
    const t = (ex && CAT_TPL[ex.categoria]) || 'generico';
    const p = ex && AP_PROP[ex.aparelho] || TPL[t].p || null;
    return { t, p, a: null, m: null, via: 'heuristica' };
  }
  function mapear(ex) {
    const id = ex && typeof ex === 'object' ? ex.id : ex;
    const s = id != null ? MAPA[id] : null;
    if (s) {
      const [t, p, a, m] = s.split('|');
      if (TPL[t]) return { t, p: p === '-' ? null : (p || TPL[t].p || null), a: a || null, m: m || null, via: 'mapa' };
    }
    return heuristica(typeof ex === 'object' ? ex : null);
  }

  // ---------------------------------------------------------------- API
  function svg(ex, o = {}) {
    const m = mapear(ex);
    const larg = o.largura || 280;
    const r = obter(m.t, m.p, m.a, { genero: o.genero });
    const nome = ex && ex.nome ? ex.nome : NOMES_TPL[m.t];
    const ap = ex && ex.aparelho && ex.aparelho !== 'peso_corporal' && NOME_AP[ex.aparelho] ? `, com ${NOME_AP[ex.aparelho].toLowerCase()}` : '';
    const label = `Como fazer ${nome}: ilustração do movimento (${NOMES_TPL[m.t].toLowerCase()})${ap}.`;
    const esp = m.m === 'espelhar';
    if (o.quadros ?? reduzMovimento()) {
      const n = r.quadros.length, gap = 18;
      const lq = Math.max(64, Math.floor((larg - gap * (n - 1)) / n));
      return `<div class="figura-exercicio figura-quadros" role="img" aria-label="${esc(label + ' Sequência de posições, da inicial à final.')}" style="display:flex;align-items:center;justify-content:center;gap:2px;flex-wrap:nowrap;width:100%;max-width:${larg}px">` +
        // lado a lado sempre: cada quadro encolhe junto (antes quebrava linha em 390px)
        r.quadros.map((q, i) => (i ? `<span aria-hidden="true" style="flex:0 0 auto;color:${C.coral};font-weight:800;font-size:20px;width:${gap - 2}px;text-align:center">→</span>` : '') +
          `<span style="flex:1 1 0;min-width:0;display:flex">${svgDe(r.vb, q, lq, '', esp, true).replace('<svg ', '<svg style="width:100%;height:auto" ')}</span>`).join('') + '</div>';
    }
    return svgDe(r.vb, r.anim, larg, label, esp).replace('<svg ', '<svg class="figura-exercicio" ');
  }
  function svgTemplate(tid, o = {}) {
    const r = obter(tid, o.p || (TPL[tid] && TPL[tid].p) || null, o.a || null, { genero: o.genero });
    if (o.amostras) return r.amostras.map(q => svgDe(r.vb, q, o.largura || 100, '', o.espelhar, true)).join('');
    if (o.quadros) return r.quadros.map(q => svgDe(r.vb, q, o.largura || 140, NOMES_TPL[tid] || tid, o.espelhar, true)).join('');
    return svgDe(r.vb, r.anim, o.largura || 240, NOMES_TPL[tid] || tid, o.espelhar);
  }

  return {
    svg,
    aparelho,
    temImagem: ex => !!(ex && (typeof ex === 'string' || ex.id || ex.categoria)),
    carregar: (url) => {
      if (!url || typeof fetch !== 'function') return Promise.resolve(Object.keys(MAPA).length);
      return fetch(url).then(r => r.json()).then(j => {
        for (const [id, v] of Object.entries(j)) MAPA[id] = [v.t, v.p || '', v.a || '', v.m || ''].join('|');
        CACHE.clear();
        return Object.keys(MAPA).length;
      });
    },
    template: mapear,
    svgTemplate,
    TEMPLATES: NOMES_TPL,
    APARELHOS: NOME_AP,
    PROPS: Object.keys(PROPS),
    CENARIOS: Object.keys(CENA),
    _tpl: TPL,
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Figuras;
