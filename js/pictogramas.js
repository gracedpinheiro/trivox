/* Pictogramas por familia de movimento — usados como "imagem" do exercicio na tela de
   detalhe. Nao existe foto real de exercicio em nenhum dos apps antigos (o unico que
   tentava isso, o LOBAS, chamava um servico externo pra gerar uma caixa colorida com
   texto — nem era foto de verdade, e quebraria o app offline). Isso aqui e leve,
   funciona sem internet, e da uma referencia visual de verdade da execucao.
   Estilo: figura em traco simples (circulo + linhas), currentColor pra herdar a cor do
   card. viewBox 0 0 100 100. */

const Pictogramas = (() => {

  const S = 'fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"';

  const FAMILIAS = {
    agachamento: `<svg viewBox="0 0 100 100" ${S}>
      <circle cx="50" cy="16" r="8" fill="currentColor" stroke="none"/>
      <path d="M50 25 L50 50"/>
      <path d="M38 30 L20 42"/>
      <path d="M62 30 L80 42"/>
      <path d="M50 50 L34 68 L38 90"/>
      <path d="M50 50 L66 68 L62 90"/>
    </svg>`,

    puxar: `<svg viewBox="0 0 100 100" ${S}>
      <circle cx="50" cy="16" r="8" fill="currentColor" stroke="none"/>
      <path d="M50 25 L50 34"/>
      <path d="M20 16 L80 16"/>
      <path d="M35 16 L50 34"/>
      <path d="M65 16 L50 34"/>
      <path d="M50 34 L46 62"/>
      <path d="M46 62 L36 90"/>
      <path d="M46 62 L58 90"/>
    </svg>`,

    empurrar: `<svg viewBox="0 0 100 100" ${S}>
      <circle cx="22" cy="48" r="8" fill="currentColor" stroke="none"/>
      <path d="M30 55 L62 64 L86 70"/>
      <path d="M30 55 L34 86"/>
    </svg>`,

    ombro: `<svg viewBox="0 0 100 100" ${S}>
      <circle cx="50" cy="17" r="8" fill="currentColor" stroke="none"/>
      <path d="M50 26 L48 60"/>
      <path d="M40 34 L22 16"/>
      <path d="M58 34 L76 16"/>
      <path d="M40 34 L58 34"/>
      <path d="M48 60 L38 90"/>
      <path d="M48 60 L60 90"/>
    </svg>`,

    rosca: `<svg viewBox="0 0 100 100" ${S}>
      <circle cx="50" cy="16" r="8" fill="currentColor" stroke="none"/>
      <path d="M50 25 L48 58"/>
      <path d="M48 58 L40 90"/>
      <path d="M48 58 L58 90"/>
      <path d="M42 30 L38 54"/>
      <path d="M58 30 L64 48 L54 34"/>
    </svg>`,

    core: `<svg viewBox="0 0 100 100" ${S}>
      <circle cx="18" cy="52" r="8" fill="currentColor" stroke="none"/>
      <path d="M25 58 L62 66 L88 72"/>
      <path d="M25 58 L27 76 L40 80"/>
    </svg>`,

    cardio: `<svg viewBox="0 0 100 100" ${S}>
      <circle cx="30" cy="18" r="8" fill="currentColor" stroke="none"/>
      <path d="M30 27 L38 52"/>
      <path d="M38 52 L26 74 L34 90"/>
      <path d="M38 52 L62 44 L74 58"/>
      <path d="M30 30 L14 42"/>
      <path d="M30 30 L48 20"/>
    </svg>`,

    alongamento: `<svg viewBox="0 0 100 100" ${S}>
      <circle cx="66" cy="24" r="8" fill="currentColor" stroke="none"/>
      <path d="M62 32 L40 52"/>
      <path d="M40 52 L34 82"/>
      <path d="M40 52 L60 78"/>
      <path d="M62 32 L82 40"/>
      <path d="M62 32 L36 30"/>
    </svg>`,

    equilibrio: `<svg viewBox="0 0 100 100" ${S}>
      <circle cx="48" cy="16" r="8" fill="currentColor" stroke="none"/>
      <path d="M48 25 L46 52"/>
      <path d="M46 52 L50 90"/>
      <path d="M46 52 L64 58 L74 48"/>
      <path d="M48 30 L26 26"/>
      <path d="M48 30 L74 34"/>
    </svg>`,

    funcional: `<svg viewBox="0 0 100 100" ${S}>
      <circle cx="42" cy="20" r="8" fill="currentColor" stroke="none"/>
      <path d="M42 29 L46 54"/>
      <path d="M46 54 L28 66 L20 50"/>
      <path d="M46 54 L70 62 L82 48"/>
      <path d="M42 29 L20 22"/>
      <path d="M42 29 L64 16"/>
    </svg>`,
  };

  // categoria do exercicio -> familia visual
  const CATEGORIA_FAMILIA = {
    pernas: 'agachamento', pernas_cal: 'agachamento', gluteos: 'agachamento',
    costas: 'puxar', puxar: 'puxar', biceps: 'rosca',
    peito: 'empurrar', empurrar: 'empurrar', triceps: 'empurrar',
    ombros: 'ombro',
    core: 'core', core_cal: 'core',
    cardio: 'cardio',
    alongamento: 'alongamento', mobilidade: 'alongamento',
    equilibrio: 'equilibrio',
    funcional: 'funcional', skills: 'funcional',
  };

  const svgPara = (categoria) => FAMILIAS[CATEGORIA_FAMILIA[categoria] || 'funcional'];

  return { FAMILIAS, CATEGORIA_FAMILIA, svgPara };
})();
