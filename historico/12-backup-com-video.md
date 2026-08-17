# 12. Backup levando os vídeos junto

**Data:** 17/08/2026

## Pedido

Depois do [ciclo 11](11-foto-e-video-por-exercicio.md) (vídeo pessoal por exercício, guardado em
IndexedDB, de propósito fora do backup por pesar demais), perguntei se ela queria que o vídeo
fosse incluído mesmo assim. Resposta: **"sim que que os vídeos vão junto"**.

## O problema de novo: vídeo não cabe num .json

Um backup até então era só `JSON.stringify()` de tudo. Vídeo é `Blob` binário — pra entrar num
`.json` precisaria virar base64 (texto), o que infla o tamanho em ~33% em cima de um arquivo que
já é MB por natureza. Um backup com poucos vídeos já viraria uma string gigante que o navegador
teria que montar inteira em memória de uma vez (`JSON.stringify` de uma string de dezenas de MB).
Funciona, mas é claramente o formato errado pra esse tipo de dado.

## Decisão: backup vira um `.zip`

`backup.json` (a mesma estrutura de sempre — perfil, fichas, histórico, fotos) mais uma pasta
`videos/<exId>.<extensão>` com cada vídeo como arquivo binário de verdade, sem conversão pra
texto. Sem biblioteca externa: escrevi um leitor/escritor de `.zip` do zero em `js/zip.js`
(método STORE — sem compressão, porque vídeo e foto já vêm comprimidos; recomprimir de novo só
gastaria bateria por um ganho quase nulo).

Formato ZIP escolhido (em vez de inventar um formato próprio) porque é aberto, documentado, e
qualquer computador consegue abrir com o que já tem instalado — se um dia ela quiser dar uma
olhada manual no backup, não precisa do TRIVOX pra isso.

## Compatibilidade com backups antigos

Quem tinha exportado um `.json` antes desse ciclo continua conseguindo importar normalmente — o
importador lê os 2 primeiros bytes do arquivo (assinatura `PK` = zip) pra decidir se trata como
`.zip` novo ou `.json` antigo. Backup antigo não tem vídeo pra restaurar (nunca teve), mas o
resto (perfil, fichas, histórico, fotos) volta igual.

## Validação

`js/zip.js` foi testado com round-trip (criar → ler, conteúdo e bytes binários idênticos,
inclusive com 20 arquivos simultâneos pra garantir que o offset acumulado de cada entrada não
desalinha) — 13/13 testes. Além do teste próprio, validado com ferramenta **externa**: o `.zip`
gerado foi extraído com sucesso pelo `Expand-Archive` do .NET (implementação de ZIP independente
da nossa) — prova de que o arquivo é um `.zip` de verdade, não só algo que o nosso próprio leitor
entende.

## Entregue

- `js/zip.js` (novo) — `Zip.criar()`/`Zip.ler()`, sem dependência.
- `js/videos.js` — `listarTodos()` (cursor no IndexedDB, usado só no export).
- `js/app.js` — `montarBackupZip()`/`restaurarBackupZip()`; `exportar` agora baixa `.zip`;
  `importar` detecta `.zip` vs `.json` pela assinatura do arquivo, não pela extensão (mais
  confiável em seletor de arquivo de celular).
- `js/ui.js` — texto do card de Backup atualizado.
- `index.html`/`sw.js` — `js/zip.js` no shell offline; `sw.js` → trivox-v10.
- Testado: 13/13 (round-trip do zip, incl. validação binária e com ferramenta externa).
