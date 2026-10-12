# 19 — Auditoria: ciclos 5 a 9

**Data:** 12/10/2026

## O que foi pedido
Depois de publicar os ciclos 1-4 ([historico/18](18-auditoria-e-correcoes.md)), fazer os ciclos
5 a 9 do plano do [RELATORIO-TESTES.md](../RELATORIO-TESTES.md) e publicar de novo. O ciclo 8
(triagem de saúde) era funcionalidade nova; a Grace incluiu no pedido.

## O que foi feito
- **5. Fotos fora do localStorage.**
  - As lojas `fotosEvolucao` e `fotosExercicio` vivem no IndexedDB (`trivox-fotos`), com uma
    cópia em memória porque as telas desenham de forma síncrona.
  - `Dados.carregarFotos()` roda ao abrir o app e migra as fotos que estavam no localStorage
    (apaga de lá só depois de gravar no banco).
  - Backup, nuvem e telas não mudaram: todos passam por `ler`/`gravar`.
  - Sem IndexedDB, tudo continua como antes.
  - Teste: 62 fotos sem nenhum aviso (antes travava com ~35-40).
- **6. Contraste e acessibilidade.**
  - Tons "fortes" (`--coral-forte` etc.) nos preenchimentos com texto branco e no texto colorido,
    todos com 4,5:1 ou mais. As cores vivas continuam em contorno, sombra e fundo claro.
  - O degradê dos cartões virou coral → magenta → uva, com texto branco legível do começo ao fim.
  - Alvos de toque com no mínimo 44px.
  - Foco visível em azul-forte, e o elemento focado não some atrás da barra de baixo.
  - Abas de mídia quebram linha, e a aba ativa é uva (não mais quase preta).
  - Um passo pós-render (`acessibilidade()` no ui.js) cuida de três coisas: `div` clicável vira
    botão (Tab, Enter e Espaço funcionam), `<label>` fica ligado ao seu campo, e o "‹" se chama
    "Voltar".
  - Com "reduzir movimento", os quadros ficam lado a lado. Fora isso, há um botão "⏸ Parar
    animação".
  - Medição a 360px: 0 alvos pequenos, 0 campos sem nome e 0 rolagem horizontal em 24 telas.
- **7. Ilustrações.**
  - 11 exercícios com movimento errado foram corrigidos nas exceções do
    `ferramentas/mapear_figuras.py`, e o mapa foi regenerado:
    - pullover e crucifixo apareciam como supino;
    - encolhimento aparecia como crucifixo inverso;
    - a mochila estava nas costas;
    - rosca no TRX aparecia como remada.
  - A escada ergométrica ganhou aparelho próprio (`escada_ergometrica`) em vez de esteira.
  - Os 8 exercícios de equilíbrio passaram a ter músculos estabilizadores como principais.
  - A foto de "Corrida na Esteira Desligada" foi retirada (era de corrida normal).
  - As fontes `.txt` e o `enriquecer_exercicios.py` foram atualizados, para não se perder numa
    regeneração.
- **8. Triagem e aeróbico.**
  - PAR-Q+ de 7 perguntas no Perfil, pedido no Início para 50+ ou IMC ≥ 30.
  - Com algum "sim": aviso de liberação médica, e o aeróbico fica só em Z1-Z2.
  - Para 50+ e 65+, limiar, 4x4 e HIIT saem da lista. O plano semanal entende os 5 objetivos
    novos; antes caía nas chaves antigas e mandava limiar Z4 para o 50+.
  - Zonas por FC de reserva com faixas próprias (Z2 de 68 anos: 124-133 → 106-124 bpm).
  - A execução mostra os sinais de parar.
  - A partir dos 50 anos, nunca treinar até a falha (RIR ≥ 1).
- **9. Acabamento.**
  - O heatmap mostra a semana atual.
  - "Fiz esta sessão" do aeróbico pergunta antes de contar como treino.
  - Importar valida antes de perguntar, substitui de verdade (sem misturar fotos) e só grava
    as lojas de treino.
  - XSS: números e ids vindos de backup ou da nuvem passam por `h()`.
  - O platô é medido por dia de treino, não por série.
  - O json começa a baixar junto com o HTML (`preload`).
  - O service worker usa cache puro para fotos e fontes (`trivox-v32`).
  - O vídeo não trava mais em "Carregando…" ao trocar de aba de mídia.
  - Campos numéricos vazios não geram mais aviso de "—".
  - A carga digitada não se perde ao abrir "Como executar".
  - O fim automático do treino não arrasta a pessoa de tela.
  - O Tabata termina na última rodada (230 s, e não 240).
  - "Novo Recorde" não aparece mais no primeiro treino.
  - `.zip` lê arquivo compactado por outros programas e confere o CRC.
  - `.ics` com DTSTART num dia marcado e CRLF no fim.
  - O lembrete do service worker não esquece "treinou hoje".
  - Exercício que saiu da base fica fora do treino, com aviso.
  - Miniatura que não carrega offline vira o mapa muscular.
  - Frases com gênero neutro.
  - Erro do Spotify fora de https agora aparece.
  - "Último envio para a nuvem" mostra a data real, mais um aviso de pendências.
  - A tela fica acesa durante o treino (Wake Lock), para o alarme do descanso não atrasar.

## Testes
- `teste_gerador.js` OK, sem nenhum aviso; `teste_figuras.js` e `teste_mapa_muscular.js` OK.
- No navegador (`..\trivox-testes`): `ciclo2`, `ciclo3`, `ciclo4-ui`, `ciclo5`, `ciclo89`, `f4`,
  `f5`, `f6`, `f7`, `f8c`, `f10` e `layout-a11y`, sem erro de console.
  - No f8 (offline) só falham as fotos nunca vistas, o que é esperado.
  - O f10 foi ajustado: agora "Treinar" na mesma ficha continua o treino aberto.

## Ficou de fora (decisão de escopo)
- ~30 ilustrações sem o implemento desenhado (o movimento está certo).
- Campo `padrao` explícito na base (M14).
- Equilíbrio automático de volume semanal (M18).
- Streak por semana (M15).
- Chip "filtros ativos" na biblioteca (L4).
- Aviso de dia repetido no "Manter e adicionar" (L6).
- Nomes dos níveis de XP (L7).
