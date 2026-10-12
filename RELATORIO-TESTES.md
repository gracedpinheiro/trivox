# TRIVOX: relatório de auditoria e testes de ponta a ponta

Data: 12/10/2026 · commit auditado: `4090d36` · **nenhum arquivo do app foi alterado** (só este relatório foi criado).

**Quem fez o quê:**
- Painel de saúde: personal trainer, médico do esporte e nutricionista.
- Engenheiro de front-end/PWA: revisão de código.
- QA de ponta a ponta: Playwright + Chromium em 390x844.
- Especialista em acessibilidade e biomecânica: imagens, acessibilidade e layout.

**Onde estão as evidências:**
- Screenshots: `..\trivox-testes\screenshots\`. São 107 com o prefixo `e2e-` e mais os que começam com `img-`, `a11y-` e `layout-`.
- Scripts: `..\trivox-testes\`.
- Dados brutos: `..\trivox-testes\resultados\` e os arquivos `*.json` da mesma pasta.

---

> **Atualização 12/10/2026, depois do OK:** os ciclos 1 a 4 do plano (seção 6) foram aplicados e
> testados. Isso resolve os 3 bloqueantes (B1-B3) e os achados A1, A2, A4-A11, M1-M3, M16 e M17,
> além das correções de uma linha 1-9 e 11. Detalhes em
> [historico/18](historico/18-auditoria-e-correcoes.md). Continuam abertos A3 (fotos no
> localStorage), A12 (triagem), A13-A15 (contraste, teclado, ilustrações) e o restante das médias
> e baixas. **Nada foi commitado.**

## 1. Resumo

1. **Ainda não está pronto para a família.** Há 3 bloqueantes:
   - O coach responde "dor no peito e tontura" com "Precisa de um treino feito".
   - No Perfil, o que se digita no campo seguinte se perde, então o peso fica vazio.
   - O login pelo link do e-mail não restaura a nuvem e ainda sobrescreve as fichas guardadas lá.
2. Há riscos altos de perder treino:
   - Um treino em andamento some se a pessoa sai pela barra de baixo ou se o celular fecha o app.
   - Com o armazenamento cheio, o app mostra "Treino concluído! +XP" e não grava nada. Umas 35-40 fotos já enchem o armazenamento.
3. Na saúde, o gerador está bem para 65+, que não recebe nenhum salto. Mas há falhas:
   - Pessoas de 50-64 anos e com IMC ≥ 30 recebem polichinelo, corda e line hops, porque estão marcados com impacto "médio" na base.
   - "Variar treino" e "Aparelho ocupado" ignoram o perfil: põem máquina em casa e salto para 68 anos.
   - Não há nenhuma triagem de saúde (PAR-Q).
4. O que funciona bem:
   - Variedade de verdade: a sobreposição média entre gerações é de 8%.
   - Aquecimento e alongamento em toda ficha, inclusive as manuais.
   - "Última vez" com os campos já preenchidos.
   - Cronômetro e Tabata no tempo certo.
   - Offline, backup `.zip` e imagem em todas as abas dos 1.535 exercícios.
5. **Proposta:** fazer os ciclos 1 a 3 do plano (seção 6), que somam umas 20 mudanças pequenas. Depois disso o app já pode ir para os primeiros testes com a família. O resto (contraste, ilustrações, triagem) pode vir em seguida.

---

## 2. Achados (ordenados por gravidade)

A coluna "Prova" diz como cada achado foi confirmado:
- **P**: reproduzido por script ou Playwright.
- **C**: verificado no código.
- **?**: plausível, mas não deu para provar aqui.

Os scripts citados estão em `..\trivox-testes\`.

### Bloqueante

| # | Área | arquivo:linha | Como reproduzir | Correção proposta | Prova |
|---|---|---|---|---|---|
| B1 | Saúde / coach | js/gamificacao.js:161-178 | Coach › digitar "estou com dor no peito e tontura" → *"Você não precisa de um treino perfeito hoje. Precisa de um treino feito."* O mesmo acontece com "pressão alta" e "dor no joelho", porque o tema padrão é motivação. | Novo tema `saude`, testado antes dos outros (`dor no peito\|tontura\|desmai\|falta de ar\|palpita\|press[aã]o\|dor (no\|na) (joelho\|ombro\|costas)\|les[aã]o`). Resposta fixa: "Pare o treino. Dor no peito, falta de ar fora do normal, tontura ou palpitação: procure atendimento (SAMU 192)." | P (teste_app_fluxos.js, e2e-06-coach) |
| B2 | Perfil / editor de ficha | js/app.js:1432-1435 | Perfil › digitar o Nome › tocar em Peso › digitar 70: o peso fica vazio. O `change` do Nome redesenha a tela inteira e apaga o campo que acabou de receber o foco. O mesmo acontece em séries e reps na ficha. | Não chamar `UI.render()` no `change` de campo de texto ou número. Atualizar só o trecho derivado (idade/IMC, análise), ou guardar e devolver o foco depois do render. | P (dbg3.js, e2e-01-bug-foco-perfil) |
| B3 | Nuvem | js/app.js:160 | Aparelho limpo › entrar pelo link do e-mail. A sessão já existe quando o app abre (app.js:69), então `jaSincronizou=true` e nada é restaurado. A primeira ficha criada sobe e **apaga as fichas da nuvem**. O login por código não tem esse problema. | Detectar a volta pelo link (`/access_token\|[?&]code=/.test(location.href)` antes de limpar a URL) e, nesse caso, `jaSincronizou=false`. | P com SDK falso (revisao-nuvem.js), C |

### Alta

| # | Área | arquivo:linha | Como reproduzir | Correção proposta | Prova |
|---|---|---|---|---|---|
| A1 | Execução | js/app.js:736-769, js/ui.js:18 | No treino › aba Início: aparece "Treino de hoje feito!" e não há botão para continuar. Treinos › "Treinar" recomeça do zero e as séries somem. Recarregar ou o iOS fechar o app também perde o treino. | Faixa "Treino em andamento › continuar" no Início e em Treinos. Confirmar antes de substituir a execução. Gravar `est.execucao` no localStorage a cada série e oferecer "continuar treino?" ao abrir. | P (f4, e2e-04-exec-*) |
| A2 | Armazenamento cheio | js/app.js:490-523, js/dados.js:249-254 | Encher o localStorage › treinar › Encerrar: aparecem 4 alertas, depois "Treino concluído! +10 XP", mas `sessoes` não muda. Liberar espaço depois não traz a sessão de volta. | `registrarSessao` devolve o retorno de `gravar`. Se falhar: manter a execução, não dar XP e oferecer "Exportar agora". | P (f10, e2e-10-cota-*) |
| A3 | Armazenamento (causa) | js/dados.js:288-324, js/app.js:1177-1241 | Cada foto (evolução ou exercício) ocupa uns 115-130 KB em base64 no localStorage, que tem 5 MB. Com 35-40 fotos não se grava mais nada. Quando falha, a foto escolhida é descartada. Um alerta aparece **a cada tecla** digitada. | Mover as fotos para o IndexedDB, como já é feito com `videos.js`. Até lá: limitar o número de fotos, não descartar `fotoTemp` em caso de falha e mostrar 1 alerta por minuto. | P (f10, revisao-codigo.js) |
| A4 | Nuvem / troca de conta | js/app.js:161-171 | Entra como A, sai, entra como B sem recarregar: os dados de A sobem para a conta de B. Sair menos de 2,5 s depois de uma alteração gera TypeError (app.js:114). | No callback: `if (!sessao) jaSincronizou = false;`. Ao sair, perguntar "apagar os dados deste aparelho?". Na linha 114: `if (sessaoNuvem)`. | P (revisao-nuvem.js) |
| A5 | Saúde / impacto | data/exercicios.json (26 itens) + js/forca.js:357 | Mulher de 58 anos: 23% das fichas têm salto, corrida ou polichinelo (7% já no aquecimento). Homem de 45 anos com IMC 33: 33% (17% no aquecimento). Exemplos: aquecimento "Polichinelo"; "Line Hops"; "Flexão Pliométrica". | Marcar como `alto` o que tem fase de voo (corda, polichinelo, line hops, skipping saltitado, agachamento com salto no TRX, flexão pliométrica). Lista completa em `achados-treino` §3.2. Para quem tem restrição, aquecimento só de impacto baixo. | P (teste_taxas.js) |
| A6 | Variar treino | js/app.js:723 | Perfil casa, 68 anos › "Variar meus treinos": 203 de 465 trocas viraram máquina de academia, e 35 ficaram acima do limite de impacto ou de nível. | Passar `local`, `equipCasa` e `idade` para `variarFicha`. É só uma linha. | P |
| A7 | Aparelho ocupado | js/ui.js:788, 1236; js/forca.js:1076-1113 | 68 anos: "Step Over" → oferece "Agachamento com Salto no TRX". Em casa só com peso do corpo, 21 de 21 listas sugerem equipamento que a pessoa não marcou. | Filtrar `substitutos` pelo perfil: equipamento de casa, idade (impacto e risco), nível e aparelhos excluídos, com o mesmo `ajustesPerfil` do gerador. | P |
| A8 | Aquecimento | js/forca.js:437 e :340 | Em 20-27% dos dias de perna o aquecimento é "Air Bike Só com os Braços" ou "Marcha com Braços Acima". A "Escada de Agilidade" aparece como aquecimento leve. | `forca.js:437`: `&& !/bracos/.test(n)`. `:340`: `escada` → `escada ergometrica\|stairmaster`. | P (teste_fichas.js) |
| A9 | Chão para 65+ | js/forca.js:431, 448, 457, 475 | 14% das fichas de quem tem 68 anos têm item no chão: Child's Pose, alongamento de antebraço ajoelhado, Pancake, Fire Hydrant. O `teste_gerador.js` também avisa: 321 casos. | Para 65+, **excluir** em vez de penalizar, e usar o alongamento em pé de um grupo vizinho. Na base, criar alongamento de antebraço e de adutor em pé. | P (teste_gerador.js) |
| A10 | 65+ e argolas | js/programas.js:698, 707 | 65+, intermediário, academia: "Remada nos Anéis com Pés Elevados" aparece. O código exclui `'aneis'`, mas a chave na base é `'argolas'`. | Trocar `'aneis'` por `'argolas'` nas 2 linhas. | P + C |
| A11 | Raquete | js/forca.js:792-794 × js/programas.js:609-613 | Raquete iniciante na academia: **0 exercício de antebraço na semana**. O corte de vagas tira antebraço e panturrilha justamente do público com mais epicondilite e lesão de Aquiles. | Não cortar as vagas de `prevencao`. Cortar o isolado ou o 2º composto no lugar. | P |
| A12 | Saúde / triagem e aeróbico | js/ui.js:1855, js/ui.js:899 → js/aerobico.js:271-294 | Ninguém responde nenhuma pergunta de saúde. O plano aeróbico do 50+ tem 1 sessão de limiar Z4 por semana. HIIT, 4x4 e Z5 ficam disponíveis para qualquer idade. | PAR-Q curto (7 sim/não) para idade ≥ 50 ou IMC ≥ 30. Se houver algum "sim": aviso médico e HIIT escondido. 50+ com todo o aeróbico em Z2. Atenção: **não** usar `objetivoAerobico` como está, porque manda 50+ para 4x4 em Z5. | P |
| A13 | Contraste | css/estilo.css:147, 183, 186, 203, 310-315 | Branco sobre coral no botão principal: 2,99:1. Branco sobre turquesa: 2,57. Texto branco no cartão de XP/gerador sobre o degradê amarelo: **1,58:1**. Faixas de bpm coloridas: 2,4-3,0. | Fundo mais escuro nos botões (coral #D93A37, turquesa #0A7F74, azul #1A6FD1), mantendo a cor viva no contorno e na sombra. No degradê, texto #24204A. Variáveis `-texto` escuras para texto colorido (as das etiquetas já passam). | P (a11y-contraste.js, layout-01-inicio) |
| A14 | Teclado | js/ui.js:381, 506, 740, 284, 303, 308, 316, 330 | Tab não alcança nenhum exercício da biblioteca ou da ficha, nem as fichas da lista e os cartões. São `div` com `data-acao`. | Trocar por `<button>`, como já foi feito em ui.js:273-279. | P (layout-a11y.js) |
| A15 | Ilustrações | data/figuras_mapa.json / ferramentas/mapear_figuras.py | Cerca de 17 exercícios mostram **outro movimento**: pullover e crucifixo como supino, rosca no TRX como remada, mochila nas costas na rosca e no desenvolvimento. Lista na seção 4. | Corrigir as entradas e regenerar. | P (revisão visual) |

### Média

| # | Área | arquivo:linha | Como reproduzir | Correção proposta | Prova |
|---|---|---|---|---|---|
| M1 | Spotify | js/app.js:541 | **A música não para** (0 pedidos de pausa). Mas, ao abrir "Como executar" e voltar, o widget fica em "Carregando…" para sempre e os botões ⏯/⏭ somem. | `if (alvo.dataset.tela === 'execucao') iniciarSpotify(); else pararSpotify();` | P |
| M2 | Aparelho ocupado | js/app.js:844 | Fazer 2 séries de Remada Curvada › trocar: as 2 séries somem da sessão. | Fechar o item com as séries feitas e inserir o substituto como item novo. | P (f4) |
| M3 | Dados antigos | js/app.js:687-688, 744; js/ui.js:416, 788, 1236, 1760 | `objetivo:'forca'` vira condicionamento (deveria ser hipertrofia) e `local:'parque'` vira academia. As duas trocas ficam **gravadas** no perfil, e nenhum chip aparece marcado. `elite`, fichas sem bloco e backups `.json`/`.zip` antigos funcionam. | Usar `Programas.MAPA_LEGADO` e preservar `parque` (ou migrar para casa de forma explícita). | P (e2e-07-json-antigo-*) |
| M4 | Importar backup | js/dados.js:364-369, js/app.js:1299-1311 | Importar o backup de outra pessoa mistura os dados: as fotos de quem estava no aparelho continuam lá. Um backup com `fichas` que não é lista deixa a tela branca. Primeiro pergunta "substituir?" e só depois diz que o arquivo não é backup. | Limpar as lojas antes, gravar só `LOJAS_SINCRONIZAVEIS` com o tipo conferido e validar o arquivo antes do `confirm`. | P (f7b) + C |
| M5 | XSS (backup ou nuvem) | js/ui.js:144, 857, 1125-1141, 1346, 1387, 1444-1458; `data-id` em 268, 381, 387, 497… | Importar um `.json` com `pesos[0].peso='<img src=x onerror=…>'`: o script rodou 3 vezes. | Passar por `h()` os números vindos do armazenamento e todo `data-id`. | P |
| M6 | Heatmap | js/ui.js:1281 | Treinar hoje › Evolução: aparece "1 dia treinado", mas nenhuma célula fica pintada, porque a grade não inclui a semana atual. | Contar o início a partir do domingo da semana atual. | P (e2e-06-evolucao-heatmap) |
| M7 | Aeróbico | js/app.js:958-986 | "Salvar esta sessão" (que é o plano) dá +140 XP e marca "treino de hoje feito". | Separar "salvar plano" de "registrar que fiz". | P |
| M8 | Platô | js/forca.js:232-255 | Uma única sessão com 4 séries iguais já mostra "Estagnado", porque o histórico é por série. | Agrupar por dia antes de comparar. | P |
| M9 | Nuvem | js/app.js:109-116, ui.js:1572 | Uma falha de rede vai só para o console, sem nova tentativa. O debounce de 2,5 s pode não rodar se o iOS suspender o app. "Última sincronização" mostra a data do backup e não a do envio. Dois aparelhos na mesma conta: vence o último, loja inteira. | Fila de pendentes no localStorage, reenviada no `online` e no `visibilitychange`. Gravar a data real de envio. Documentar "um aparelho por conta". | C / ? |
| M10 | Lembrete | js/lembretes.js:49-58, 363 | `sincronizarComSW` apaga `treinouEm` e `avisadoEm`, então o SW pode notificar mesmo depois do treino. Baixar o `.ics` 2 vezes **duplica** o evento, porque o UID muda a cada download. | Preservar os 2 campos. UID fixo. | P (.ics) + C |
| M11 | Carga inicial | index.html:47-50, js/dados.js:375-381 | Primeira visita em Slow 4G no servidor local sem gzip: 14,3 s em "Carregando…". O json de 1,9 MB só começa a baixar depois do supabase.js da CDN. Com gzip (o GitHub Pages comprime) a estimativa cai para 3,6 s. | `<link rel="preload" href="data/exercicios.json" as="fetch" crossorigin>` e supabase.js com `defer`. | P (f9) |
| M12 | Alarme com a tela apagada | js/app.js:243-326 | Página suspensa: o alarme de 30 s tocou aos 45 s, só quando a página voltou. É limite do navegador; o cálculo do tempo está certo. | Avisar na tela; opcionalmente `navigator.wakeLock` durante o treino. Para lembrete, o `.ics` é o que garante. | P (f5) |
| M13 | Service worker | js/sw.js:51, 66-83 | O cache **não** cresce sem limite: são 1.066 fotos (~39 MB) e não 2.100. Mas cada foto já em cache vai à rede de novo a cada abertura e gasta dados móveis. O pré-cache usa o cache HTTP (max-age=600) e pode misturar versão velha com nova. O comentário diz "network-first", mas o código faz stale-while-revalidate. | `new Request(u, {cache:'reload'})`. Cache-first puro para `data/imagens/` e `fonts/`. Corrigir o comentário. | P (revisao-sw.js) + ? |
| M14 | Gerador / qualidade | js/programas.js:361-386, 426; js/forca.js:790 | 9,4% das vagas de exercício composto recebem um exercício de outro tipo. Exemplos: "Elevação em Y" 3x6-10 como desenvolvimento; "Bird Dog" como remada; "Levantamento Romeno" classificado como agachamento. "Tuck Crunch" e "Skater Squat" são tratados como pliometria. | `romeno\|pull.?through` no padrão de hinge; `tuck jump` em vez de `tuck`; campo `padrao` explícito nos ~70 itens. | P (teste_vagas.js) |
| M15 | Prescrição | js/aerobico.js:30-83; js/gamificacao.js:90-91, 126, 184; js/programas.js:542 | Para 68 anos, a Z2 por Karvonen fica ~25 bpm acima da Z2 por %FCmáx. Os badges de 7 e 30 dias **seguidos** e o "não quebra ela hoje" incentivam treinar sem descanso. O coach fala em RIR 1-2, mas a ficha 50+ prescreve 2-3. Há RIR 0 para 50-64 avançado. | Faixas próprias de FC de reserva. Streak semanal. Ajustar as frases. `rirMin=1` para 50-64. | P |
| M16 | Base / substitutos | js/forca.js:1088-1100 | 14 exercícios sem nenhum substituto e 19 de casa sem substituto de casa. Exemplos: Desenvolvimento Arnold, Sissy Squat, Rotação Externa. A causa são 136 grafias diferentes de músculo, comparadas como texto exato. Também: "Levantamento Terra" → "Corrida na Esteira Desligada". | Comparar por `Programas.grupoMuscular(m)`. Penalizar a troca de força por salto ou corrida. | P (validar_base.js) |
| M17 | Ficha manual | js/app.js:743-746 | Ficha manual de pernas, IMC 33: o aquecimento traz trote e escada de agilidade, porque `completarSessao` não recebe peso nem altura. | Passar `peso`, `altura` e `local` reais. | P |
| M18 | Volume | js/programas.js:540-563 | Hipertrofia iniciante, 3 dias: posterior de coxa com 3 séries por semana e glúteo com 18. O alvo de volume nunca é aplicado. | Garantir ao menos 1 flexão de joelho por semana e equilibrar 1 isolado. | P |
| M19 | Acessibilidade | css/estilo.css:188, 201, 231, 287-298, 408-411; js/ui.js:427-443, 796 | 33 tipos de controle com 35-41px, abaixo de 44. Nenhum `<label>` ligado ao seu campo. O botão "‹" não tem nome. O foco azul tem 2,87:1. A barra fixa cobre o elemento focado. | `min-height:44px` em `.btn-pequeno`, `.chip` e `.midia-aba`. Pôr o input dentro do label. `aria-label="Voltar"`. Foco #1663B8. `scroll-padding-bottom`. | P (layout-a11y.js) |
| M20 | Reduzir movimento | js/figuras.js:2274 | Com "reduzir movimento" a ilustração para, como esperado, mas os quadros quebram de linha (2+1) em 390px. A animação normal não tem botão de pausar. | `flex-wrap:nowrap` com largura calculada. Botão ⏸. | P (a11y-reduzir-*) |
| M21 | Imagens / dados | data/exercicios.json | 8 exercícios de equilíbrio mostram o corpo todo cinza na aba Músculos. Os 4 de escada ergométrica desenham uma **esteira** na aba Aparelho. | Músculos estabilizadores como principais. Aparelho `escada_ergometrica`. | P |
| M22 | Vídeo | js/app.js:1008-1011 | Trocar de aba de mídia deixa "Seu vídeo" em "Carregando…". | Recarregar o vídeo no `midia-aba`. | P |

### Baixa

| # | Área | arquivo:linha | Achado | Correção |
|---|---|---|---|---|
| L1 | Console | js/ui.js:39 | Foram 126 avisos de "The specified value '—' cannot be parsed" em `<input type=number>`. **É o único ruído no console em uso normal** (nenhum pageerror). | Usar `''` no `value` numérico. |
| L2 | Execução | js/ui.js:1101; js/app.js:654 | Digitar 45 na carga › "Como executar" › voltar: o campo volta para 40. O treino e o descanso, esses, ficam intactos. | Guardar o rascunho em `est.execucao`. |
| L3 | Execução | js/app.js:272-339 | Se o descanso da última série acaba com a pessoa em outra aba, o treino se encerra sozinho. | Só finalizar sozinho na tela de execução. |
| L4 | Biblioteca | js/app.js:582-586 | Os filtros continuam ativos na próxima vez que a biblioteca é aberta. | Mostrar o chip "filtros ativos · limpar". |
| L5 | Cronômetro | js/app.js:311-319 | Tabata 20/10×8 termina em 240 s em vez de 230. | Encerrar no fim do último trabalho. |
| L6 | Gerador | js/app.js:701-705 | "Manter e adicionar" 2 vezes deixa duas fichas no mesmo dia. | Avisar o conflito. |
| L7 | Badges / rótulos | js/app.js:365; js/ui.js:288 | "Novo Recorde" já no 1º treino. O nível de XP "Iniciante" se confunde com o nível de treino. | Exigir um recorde anterior > 0. Usar outros nomes para os níveis de XP. |
| L8 | .ics | js/lembretes.js:21-39, 364 | DTSTAMP sem `Z`, sem CRLF no fim, DESCRIPTION com mais de 75 octetos, DTSTART em hoje. | Ajustes no gerador do `.ics`. |
| L9 | Zip | js/zip.js:244-249 | Não confere o CRC (aceitou um arquivo corrompido). Não lê zip compactado por outro programa (a mensagem de erro é clara). | Conferir o CRC. Para deflate: `DecompressionStream('deflate-raw')`. |
| L10 | Exercício inexistente | js/app.js:748-752 | Uma ficha antiga com id que não existe mais aparece como "Exercício" sem imagem. | Avisar e pular o item. |
| L11 | Offline | js/ui.js:84-90 | Miniaturas nunca vistas ficam em branco offline. | Usar `onerror` para mostrar o mapa muscular. |
| L12 | Frases | js/motivacao.js:14, 40, 43; js/aerobico.js:255 | Algumas frases usam gênero fixo ("cansada", "sozinha"). "Remédio sem efeito colateral ruim". | Linguagem neutra; "na dose certa". |
| L13 | Nutrição | js/gamificacao.js:149-163 | Não há conteúdo arriscado. Falta a ressalva de rim na frase de proteína e falta hidratação para quem joga no sol. | 4-5 frases novas no banco (`achados-treino` §5). |
| L14 | Layout | css/estilo.css:406-412 | A aba "Aparelho" fica cortada sem indicar que dá para rolar. A pílula da aba ativa é quase preta (#24204A), o único tom escuro do app. | Quebrar a linha das abas. Pílula ativa em uva. |
| L15 | Dev / ferramentas | servidor.js:13-21; ferramentas/enriquecer_exercicios.py:34, 641 | O servidor não envia `.jpg`/`.woff2` com o tipo certo nem comprime. O `--dry` quebra no Windows por causa do caractere "≥" (cp1252), e o `FEDB` aponta para `/home/claude/...`. | Completar `TIPOS`. Rodar com `PYTHONIOENCODING=utf-8` ou `sys.stdout.reconfigure(encoding='utf-8')`. |
| L16 | Spotify | js/app.js:875-878 | Acessado por `http://IP:8080`, o botão não faz nada, porque `crypto.subtle` não existe nesse contexto e o erro não é tratado. | Usar `.catch` com uma mensagem explicando. |

### Erros óbvios de uma linha (listados, **não aplicados**: esperam o seu OK)

1. `js/programas.js:698` e `:707`: `'aneis'` → `'argolas'`. Resolve o A10.
2. `js/app.js:723`: acrescentar `local: p.local, equipCasa: p.equipCasa, idade: Dados.idade()` em `variarFicha`. Resolve o A6.
3. `js/forca.js:437`: acrescentar `&& !/bracos/.test(n)` ao teste de dia de perna. Resolve parte do A8.
4. `js/app.js:114`: `if (sessaoNuvem) Nuvem.enviarDado(...)`. Resolve o TypeError do A4.
5. `js/app.js:163`: `if (!sessao) jaSincronizou = false;`. Resolve a troca de conta do A4.
6. `js/app.js:541`: `if (alvo.dataset.tela === 'execucao') iniciarSpotify(); else pararSpotify();`. Resolve o M1.
7. `js/app.js:687`: cair em `Programas.MAPA_LEGADO[p.objetivo]` antes de `'condicionamento'`. Resolve parte do M3.
8. `js/lembretes.js:363`: `UID:trivox-treino@trivox`, sem `Date.now()`. Resolve parte do M10.
9. `sw.js:51`: `c.add(new Request(u, { cache: 'reload' }))`. Resolve parte do M13.
10. `js/ui.js:39`: devolver `''` em vez de "—" quando for `value` de input. Resolve o L1.
11. `js/programas.js:383`: acrescentar `|romeno|pull.?through`. `:426`: `tuck` → `tuck jump`. Resolve parte do M14.

---

## 3. Requisitos 1 a 13

| # | Requisito | Resultado | Evidência |
|---|---|---|---|
| 1 | Variedade e troca por aparelho ocupado | **parcial** | Gerar de novo troca de verdade: sobreposição média de 8% (teste_gerador.js, teste_fichas.js). Mas 14 exercícios não têm substituto, a lista de troca ignora o perfil (A7) e "Variar" põe máquina em casa (A6). Evidência: e2e-04-exec-*, validar_base.js. |
| 2 | Níveis, com elite = avançado | **ok** | `nivel:'elite'` gera 4 fichas em todos os objetivos e locais (teste_fichas.js, e2e-07-json-antigo-gerador). |
| 3 | Os 5 objetivos, com dias de jogo na raquete | **parcial** | Os 5 geram fichas e o dia de jogo e a véspera viram ativação leve (teste_fichas.js, e2e-01-perfil-raquete). Raquete iniciante fica sem antebraço (A11), e o legado `forca` vira condicionamento (M3). |
| 4 | Personalização por sexo, idade e IMC | **parcial** | 65+ sem nenhum salto (ok). Mas 50-64 e IMC ≥ 30 recebem salto (A5) e 65+ recebe argolas (A10). Evidência: teste_taxas.js. |
| 5 | Aquecimento e alongamento | **parcial** | Presentes em 100% das fichas, inclusive as manuais (teste_gerador.js, e2e-03-execucao-aquecimento-auto). Os alongamentos miram o grupo do dia em 99,3% dos casos. Mas há incoerências: aquecimento de braço em dia de perna (A8) e Child's Pose para 65+ (A9). |
| 6 | Imagem em todo exercício | **parcial** | 520 abas abertas em 130 exercícios, nenhuma vazia. 1535/1535 têm ilustração e aparelho. 0 imagem quebrada. "Minha foto" funciona (img-minhafoto-*). Mas cerca de 17 ilustrações mostram o movimento errado (A15), há 8 mapas musculares cinza e 4 escadas desenhadas como esteira (M21). |
| 7 | Último treino com campos preenchidos | **ok** | "Última vez (12/10): 40kg × 10 · 45kg × 10" e campos preenchidos (e2e-04-exec-*). Ressalva: "aparelho ocupado" descarta as séries feitas (M2). |
| 8 | Evolução | **parcial** | Peso, gráfico, fotos antes/depois, XP e histórico funcionam (e2e-06-*). O heatmap não mostra hoje (M6), e as fotos estouram a cota (A3). |
| 9 | Chamada diária | **parcial** | O `.ics` é válido (RRULE e CRLF ok), mas baixar de novo duplica o evento (M10). A notificação foi testada só com uma versão falsa (headless). O periodic sync perde `treinouEm` (M10). Testar no celular (seção 5). |
| 10 | Frase do dia e missão do dia | **ok** | Tela inicial (e2e-01-inicio-apos-perfil, e2e-02-inicio-com-fichas). Ressalva: frases com gênero fixo (L12). |
| 11 | Cronômetro com alarme | **parcial** | Timer, voltas, Tabata, 3-2-1, alarme e vibração funcionam no tempo certo, com erro de ±0,2 s (e2e-05-*). O tempo continua certo depois de pausar. Com a página suspensa, o alarme só toca ao voltar (M12, limite do navegador). |
| 12 | Spotify | **parcial** | A música não para ao abrir "Como executar", mas o widget trava em "Carregando…" (M1). Sem conta real, foi testada só a tela (e2e-11-perfil-spotify). |
| 13 | Visual claro e alegre | **parcial** | 24 telas claras e sem rolagem horizontal a 360px (layout-*). Mas o contraste reprova o AA nos botões e no cartão em degradê (A13), e a pílula da aba ativa é quase preta (L14). |

**Testes existentes:**
- `teste_gerador.js`: OK, nenhuma regra dura violada, em 1 min 43 s. Deixou 1 aviso: `chao_65`, com 321 casos de Child's Pose para 65+ (é o A9).
- `teste_figuras.js`: OK (1535 exercícios, 361/368 templates, 60 aparelhos).
- `teste_mapa_muscular.js`: TUDO OK. Avisa que 8 exercícios de equilíbrio não têm músculo principal pintado (é o M21).
- `enriquecer_exercicios.py --dry`: só roda com `PYTHONIOENCODING=utf-8` (L15). O `/home/claude/ext/fedb.json` **não existe aqui**, então a checagem de `fedb_id` foi pulada. O resto confere: 1535 exercícios e todas as 30 células com ≥ 15 exercícios.

**Base de exercícios** (validar_base.js):
- 0 ids ou nomes duplicados.
- 0 campos obrigatórios faltando.
- 0 valores inválidos em `local`, `objetivos`, `impacto` e `aparelho`.
- 0 imagens apontando para arquivo inexistente (689 exercícios com foto, nenhum arquivo sobrando).
- 14 exercícios sem substituto e 19 de casa sem substituto de casa (M16).
- 26 itens com impacto marcado errado (A5).
- 55 instruções telegráficas (lista em `achados-treino` §3.4). Exemplos: `at_cable_curl`, `ca_step_aerobics`, `pu_close_neutral`, `comp_front_squat`.
- Músculo primário errado: nenhum na amostra de 70. Os problemas reais são de categoria e de vocabulário.

---

## 4. Exercícios com imagem ou ilustração errada

**Movimento errado (corrigir primeiro):**

| id | nome | aba | problema |
|---|---|---|---|
| cb3_pullover_bola_suica | Pullover com Halter na Bola Suíça | Como fazer | mostra supino |
| pt3_bola_crucifixo | Crucifixo com Halteres na Bola Suíça | Como fazer | mostra supino |
| pt3_crucifixo_chao_garrafas | Crucifixo no Chão com Garrafas | Como fazer | mostra supino no chão |
| om3_encolh_inclinado | Encolhimento com Peito Apoiado no Banco Inclinado | Como fazer | mostra crucifixo inverso |
| cm3_inclinacao_banco_romano | Flexão Lateral no Banco Romano | Como fazer | mostra extensão lombar |
| om3_posterior_iso_parede | Pressão Isométrica dos Cotovelos na Parede | Como fazer | mostra crucifixo inverso sentado |
| cm3_rolo_gluteo | Liberação de Glúteo no Foam Roller | Como fazer | rolo sob a panturrilha |
| cb3_rosca_mochila | Rosca com Mochila | Como fazer | mochila nas costas, mãos vazias |
| om3_desenv_mochila | Desenvolvimento com Mochila | Como fazer | mochila nas costas |
| cm3_trx_abdominal_reverso | Abdominal Reverso Suspenso no TRX | Como fazer | mountain climber no chão, sem TRX |
| pt3_trx_crucifixo | Crucifixo no TRX | Como fazer | mostra flexão |
| om3_posterior_trx | Crucifixo Inverso no TRX (T) | Como fazer | mostra remada |
| cb3_rosca_trx | Rosca no TRX | Como fazer | mostra remada |
| cb3_rosca_corporal_smith | Rosca Corporal no Smith | Como fazer | mostra remada, sem a barra |
| cm3_ponte_rotacao | Ponte Torácica com Rotação | Como fazer | falta a ponte |
| sr3_panturrilha_elastico | Flexão Plantar Sentado com Elástico | Como fazer | desenha máquina de panturrilha |
| om3_frontal_inclinado | Elevação Frontal Deitado no Banco Inclinado | Como fazer | em pé, sem banco |
| fn_deadmill_sprint | Corrida na Esteira Desligada | Fotos | foto de corrida normal na esteira |
| cf3_stairmaster_continuo, _lateral, _degrau_duplo, _tiros | Escada ergométrica (4) | Aparelho | desenha esteira |
| s50_caminhada_tandem, s50_dupla_tarefa, sr3_marcha_re, sr3_passo_reativo, sr3_marcha_giro_cabeca, sr3_olhos_fechados_unipodal, sr3_unipodal_bola_parede, sr3_reacao_bola_parede | Equilíbrio (8) | Músculos | corpo todo cinza |

**Falta o implemento ou a variação (o movimento base está certo):**
- Sem a cadeira, a parede ou o banco:
  - cm3_lateral_cadeira
  - cm3_latissimo_parede
  - cm3_banda_it_pe
  - cm3_toracica_banco
  - cm3_crunch_pernas_cadeira
  - sr3_rot_externa_isometrica_parede
- Sem o implemento:
  - cm3_prancha_bosu (desenhada sobre bola suíça)
  - gp3_abducao_multi_hip
  - om3_encolh_maq_panturrilha
  - qp3_tibial_anilha
  - cb3_rolo_punho_caseiro
  - sr3_rotacao_bola_suica
  - fn_box_lateral_jump (um cone no lugar da caixa)
  - cf3_burpee_barra_fixa
- Mostram só a 1ª parte do exercício combinado:
  - cf3_halter_afundo_rosca_press
  - cf3_halter_step_press
  - cf3_elastico_agach_remada
  - cf3_corda_naval_polichinelo
  - cf3_corda_naval_afundo
- Movimento ou posição diferente do nome:
  - casa_prancha_lateral_remada (o kettlebell sobe na vertical, não há remada)
  - qp3_hack_barra (barra na frente)
  - om3_encolh_barra_atras (barra na frente)
  - sr3_rosca_punho_costas (implemento na frente)
  - qp3_pant_donkey_casa (tronco ereto)
  - qp3_pant_cadeirinha (sem a flexão plantar)
  - gp3_concha_reversa (desenha a concha normal)
  - om3_re_bilateral_elastico (unilateral)
- Variações de ponte e coice sem a bola ou o elástico, e com o joelho errado:
  - gp3_ponte_isquios_estendida
  - gp3_ponte_squeeze
  - gp3_hip_thrust_sofa_elastico
  - lb_gl6
- Outros:
  - mobi_lat_stretch (barra com anilhas)
  - cm3_rotacao_bastao_pe (polia no lugar do bastão)
  - pe_hs_press_parallel (sem as paralelas)
  - om3_lateral_peito_apoiado
  - pt3_mb_unilateral_passada
- Nome a corrigir: cb3_remada_alta_ajoelhado_polia e acad_remada_alta_maquina. O exercício é uma puxada alta, então "Remada Alta" confunde.

**Foto real com implemento diferente do nome** (só o implemento muda):
- Kettlebell no lugar de halter: func_thruster, tr_batch3_6, func_single_leg_rdl, lb_eq2, pe_batch3_extra_2.
- Barra no lugar de halter: lb_gl13.
- Halter no lugar de kettlebell: pe_batch3_extra_0.
- Pegadores de farmer no lugar da barra hexagonal: func_batch3_14.
- Sem o elástico: lb_gl6.
- Elástico no lugar do cabo: pl_hip_flexor_raise.

As outras ~60 fotos revisadas batem com o nome. As evidências estão nas folhas de contato `img-folha-sus-01..07`, `img-folha-amo-01..09` e `img-fotos-01..06`.

---

## 5. Roteiro de teste no celular (você faz)

Antes de começar, abra o app instalado com internet uma vez e confira se o perfil está preenchido. Use **uma ficha de teste**, não a sua ficha real.

### iPhone (Safari, app na tela de início)
1. **Alarme com a tela apagada:**
   - Cronômetro › Timer › 30 s › Iniciar › bloqueie a tela.
   - Aos 30 s, anote se tocou, vibrou ou não fez nada. O esperado no iOS é **não** tocar.
   - Desbloqueie: o alarme deve tocar na hora e o visor mostrar 0:00.
   - Repita com o app aberto e a tela ligada: precisa tocar 3-2-1 e o alarme.
2. **Descanso no treino:** comece um treino › conclua 1 série › troque para outro app por 1 minuto › volte. O descanso tem que estar com o tempo certo.
3. **Notificação:**
   - Perfil › Chamada pro treino › ativar e permitir.
   - O iPhone só permite notificação de site com o app **instalado** (iOS 16.4+).
   - Anote se apareceu o pedido de permissão.
4. **.ics:**
   - Perfil › "colocar no calendário" › abrir com o Calendário › Adicionar todos.
   - Confira o horário, os dias da semana e o alarme.
   - Baixe **de novo** e veja se o evento duplicou (deve duplicar hoje, achado M10).
5. **Spotify:**
   - Com o Spotify tocando, comece um treino › veja "tocando agora".
   - Abra "Como executar" › volte. A música continua? O widget ficou em "Carregando…" (M1)?
   - Com Premium, teste ⏯ e ⏭.
6. **Câmera:** Biblioteca › um exercício › "Usar minha foto" › Tirar foto. A foto aparece na aba "📷 Minha foto" e durante o treino.
7. **Nuvem por código:** use **um e-mail de teste**, não o da família.
   - Perfil › Backup na nuvem › e-mail › digite o código de 8 dígitos.
   - Crie uma ficha › espere 5 s › apague o app.
   - Reinstale › entre de novo **por código**. A ficha tem que voltar.
   - **Não** teste pelo link do e-mail num aparelho com dados reais antes de corrigir o B3.

### Android (Chrome, app instalado)
1. **Alarme com a tela apagada:** igual ao iPhone. No Android costuma tocar com atraso de alguns segundos; anote quantos.
2. **Notificação:**
   - Ative a chamada e permita.
   - Com o descanso rodando, saia do app: ao acabar o descanso deve vir a notificação "descanso acabou".
3. **Periodic sync:**
   - Ative a chamada para um horário daqui a 1-2 h e feche o app (não force a parada).
   - O Chrome só dispara com o app instalado e usado com frequência, e pode atrasar horas.
   - Anote se chegou e a que horas.
4. **.ics:** baixe › abra com o Google Agenda › confira a repetição semanal e o alarme.
5. **Spotify, câmera e nuvem por código:** os mesmos passos 5, 6 e 7 do iPhone.
6. **Offline:** abra 3 exercícios com foto › modo avião › feche e abra o app. Ele tem que abrir e as 3 fotos têm que aparecer.

Anote para cada item: ok / não ok / o que apareceu, de preferência com um print.

---

## 6. Plano de correção (ciclos pequenos, cada um testável sozinho)

| Ciclo | O que entra | Como testar |
|---|---|---|
| **1. Segurança da saúde** | B1 (tema saúde no coach), A10 (argolas), A8 (aquecimento de braço), A9 (chão excluído para 65+), A5 (impacto dos 26 itens na base + aquecimento de impacto baixo), A11 (raquete mantém antebraço e panturrilha) | `teste_gerador.js` sem o aviso `chao_65`; `teste_taxas.js` com 0% de salto em 58a e IMC 33; perguntar "dor no peito" ao coach |
| **2. Não perder dado** | B2 (o `change` não redesenha), A1 (treino em andamento: continuar + guardar no localStorage), A2 (não "concluir" se não gravou), M2 (aparelho ocupado mantém as séries) | Preencher o perfil digitando direto; sair no meio do treino e voltar; recarregar no meio do treino; f10 com a cota cheia |
| **3. Nuvem segura** | B3 (login por link), A4 (troca de conta e TypeError), M9 (fila de reenvio) | `revisao-nuvem.js` (SDK falso) + teste no celular com e-mail de teste |
| **4. Trocas respeitam o perfil** | A6 (variar, uma linha), A7 (substitutos filtrados), M3 (forca/parque), M16 (músculo por grupo), M17 (ficha manual com IMC) | `teste_app_fluxos.js`, `validar_base.js` (0 sem substituto) |
| **5. Fotos fora do localStorage** | A3: fotos de evolução e de exercício no IndexedDB, com migração das atuais e a exportação no `.zip` | Salvar 60 fotos sem erro; exportar/importar o `.zip` |
| **6. Contraste e acessibilidade** | A13, A14, M19, M20, L14 | `a11y-contraste.js` e `layout-a11y.js` sem nada reprovado |
| **7. Ilustrações e base** | A15 + seção 4 (mapear_figuras.py), M21, M14, instruções telegráficas | `teste_figuras.js` + nova folha de contato revisada |
| **8. Triagem e aeróbico 50+** | A12 (PAR-Q curto, aeróbico 50+ em Z2, HIIT escondido), M15 | **Precisa da sua decisão de escopo antes**: é funcionalidade nova, não correção |
| **9. Acabamento** | M1, M4-M8, M10-M13, M22, os achados de baixa e as frases de nutrição | Repetir os fluxos e2e (`f1.js` a `f10.js`) |

Sugestão: os ciclos 1 a 3 antes de entregar para a família, e o 4 logo depois.
