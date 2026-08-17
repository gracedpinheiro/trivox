# 11. Foto e vídeo pessoal por exercício

**Data:** 17/08/2026

## Pedido

> "quero ir substituindo a foto pré-cadastrada por a minha foto real no aparelho, à medida que
> for fazendo o exercício [...] gostaria também de ter uma forma de criar um link para que eu
> pudesse me filmar fazendo o exercício e aí quando quisesse ver como que faz o exercício bastava
> clicar no vídeo."

Duas coisas: (1) substituir a foto de cada exercício pela foto real dela, aos poucos, exercício
por exercício; (2) anexar um vídeo dela mesma fazendo o movimento, pra rever quando precisar.

## Decisão: quem faz o registro é ela, direto no app

Perguntada implicitamente na mensagem ("ou se for possível eu mesmo vou colocando"): construí pra
ela mesma cadastrar direto no app, com a mesma compressão automática que já existe pra foto de
perfil/evolução ([ciclo 10](10-fonte-legivel-e-fotos.md)) — reaproveitei o mesmo
`comprimirImagem()`. Eu inserir as fotos manualmente não escalaria (ela treina na academia, sem
mim por perto) e o app já tinha a infraestrutura pronta.

## Foto: mesmo padrão do ciclo 10, mapeado por exercício

Novo store em `dados.js`, `fotosExercicio` — mapa `{ [exId]: { foto, atualizadoEm } }`. Na tela
do exercício e na tela de execução do treino, a prioridade de exibição passou a ser: **foto
pessoal > foto pré-cadastrada (as 22 do free-exercise-db) > pictograma**. Ou seja, assim que ela
fotografa um exercício, a foto dela substitui visualmente o que tinha antes em toda tela onde
aquele exercício aparece — exatamente o "ir substituindo" pedido.

## Vídeo: por que não pode ser localStorage

Foto comprimida fica na faixa de 30-150KB. Vídeo de celular, mesmo curto, fica na casa dos MB —
um clipe de 10s tranquilamente passa de 10-20MB. O `localStorage` tem cota de poucos MB pro app
inteiro; guardar vídeo ali estouraria a cota em 1 ou 2 clipes.

**Solução:** vídeo vive em **IndexedDB**, banco separado (`js/videos.js`, novo módulo, mesmo
molde do `spotify.js` — um arquivo por preocupação). IndexedDB aceita `Blob`/`File` nativamente
(sem precisar converter pra base64, que infla o tamanho em ~33%) e tem cota ordens de grandeza
maior que localStorage — na prática, centenas de MB a alguns GB, dependendo do aparelho. Continua
100% local e offline, sem servidor.

Consequência aceita e documentada no README: **vídeo não entra no Exportar/Importar** (que só
lida com o JSON do localStorage). Incluir vídeo ali significaria converter pra base64 dentro de
um arquivo JSON gigante — pior em todos os aspectos que deixar o vídeo onde está. Se ela trocar
de aparelho, os vídeos ficam pra trás; fotos e o resto dos dados continuam indo no backup normal.

## O problema técnico: render é síncrono, IndexedDB é assíncrono

Toda tela do app é uma função que devolve uma string HTML (nada de framework/estado reativo).
IndexedDB só responde de forma assíncrona (Promise). Resolvido do mesmo jeito que o widget
"tocando agora" do Spotify já resolvia isso: a tela renderiza um placeholder
(`<div id="video-exercicio">Carregando…</div>`) na hora, e um helper em `app.js`
(`carregarVideoExercicio`) busca no IndexedDB por fora e pinta o resultado por cima quando chega
— sem re-renderizar a tela inteira. Uma checagem por `data-exid` evita pintar a tela errada caso
a pessoa já tenha saído do exercício antes do IndexedDB responder.

Gravação de vídeo em si não usa câmera customizada (`getUserMedia`/`MediaRecorder`) — usa
`<input type="file" accept="video/*">` puro, que no celular já abre a escolha nativa entre
"Câmera" e "Galeria". Mais simples, mais confiável entre navegadores, e evita construir uma UI de
gravação do zero pra um ganho marginal.

## Entregue

- `js/videos.js` (novo) — banco IndexedDB `trivox-videos`, `salvarVideo/lerVideo/apagarVideo`.
- `js/dados.js` — `fotosExercicio`, incluído no backup (`exportar()`/`importar()`).
- `js/ui.js` — foto pessoal com prioridade em `telaExercicio()` e `telaExecucao()`, botões
  trocar/remover foto, card "🎥 Seu vídeo" com placeholder + `renderVideoExercicio()`.
- `js/app.js` — `carregarVideoExercicio()` (ponte assíncrona IndexedDB → DOM, com
  `URL.createObjectURL`/`revokeObjectURL` pra não vazar memória), handlers de trocar/remover foto
  e vídeo por exercício. Aviso (não bloqueante) se o vídeo escolhido passar de 50MB.
- `index.html`/`sw.js` — `js/videos.js` no shell do cache offline; `sw.js` → trivox-v9.
- Testado: 21/21 (lógica de `dados.js`, incluindo `fotosExercicio`).
