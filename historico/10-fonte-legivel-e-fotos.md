# 10. Fonte legível e fotos (perfil + evolução)

**Data:** 17/08/2026

## Pedido 1: "a fonte ficou muito pequena quando abro no celular"

## Diagnóstico

O viewport meta (`width=device-width, initial-scale=1`) já estava correto em index.html — não
era o bug clássico de "zoom automático do navegador desktop". O problema era mais simples: vários
textos secundários do app (nav inferior, etiquetas, rótulos, notas) usavam tamanhos de fonte bem
pequenos (10,5px a 13px), que no papel pareciam ok mas na tela física de um celular, com a
densidade de pixel e a distância de leitura do dia a dia (às vezes no meio do treino), ficavam
difíceis de ler.

## Decisão

Aumentei a base (16px → 17px) e escalei praticamente todo tamanho de fonte do app proporcionalmente
— títulos, botões, itens de lista, etiquetas, notas, e principalmente a barra de navegação inferior
(10,5px → 12px, o menor valor do app e o mais crítico por ficar sempre visível). Também adicionei
`text-size-adjust: 100%` no `html, body` — trava extra contra o navegador "encolher" texto sozinho
em colunas estreitas, mesmo não sendo a causa raiz aqui.

## Entregue

`css/estilo.css` — ~20 seletores com font-size ajustado. `sw.js` (VERSAO → trivox-v8) pra o
service worker invalidar o CSS antigo em cache assim que ela recarregar o app.

---

## Pedido 2: foto de perfil + fotos de evolução (antes/depois) com data automática

> "no meu perfil, local para inserir uma foto de perfil e também registrar uma foto de antes de
> depois, quando inserir a foto, registrar a data"

## Decisão de arquitetura

Duas coisas separadas, não uma:
- **Foto de perfil** (`perfil.foto`): uma imagem só, substituível, é identificação — não é dado
  de evolução. Vive dentro do objeto `perfil` já existente, igual `nome`/`peso`/etc.
- **Fotos de evolução** (`fotosEvolucao`): um histórico completo, novo store no mesmo molde de
  `pesos()` — lista com `{ id, data, foto, nota }`, mais recente primeiro, com teto no tamanho da
  lista pra não crescer sem limite.

A data nunca é editável manualmente — é sempre `Date.now()` no momento em que a foto é
confirmada, exatamente como pedido ("quando inserir a foto, registrar a data").

## O problema técnico real: onde a foto mora

Não existe servidor — tudo é `localStorage`, que tem cota (tipicamente 5-10MB por origem, às
vezes menos em navegador mobile). Uma foto direto da câmera de celular vem em geral entre 2-8MB.
Guardar isso cru como base64 estouraria a cota em poucas fotos.

**Solução:** toda foto passa por um canvas antes de virar `dataURL` — redimensiona (maior lado ≤
480px pra foto de perfil, ≤ 900px pra evolução, mantendo proporção) e recomprime como JPEG
(qualidade 0.78-0.82). Resultado prático: a maioria das fotos fica na faixa de 30-150KB em vez de
alguns MB. Com isso, o teto de 120 fotos de evolução (~2 anos de registro semanal) fica dentro de
cota com folga na grande maioria dos aparelhos.

Por isso `fotosEvolucao` tem teto mais conservador (120) que `pesos()` (500) — peso é um número,
foto pesa ordens de grandeza a mais, mesmo comprimida.

## Backup

`fotosEvolucao` entrou na lista de chaves que `Dados.exportar()` inclui — igual peso, sessões
etc. A foto de perfil já vem de brinde, por estar dentro do objeto `perfil`. Consequência aceita:
o arquivo de backup fica maior a partir de agora se ela usar a função (antes era só texto/número,
KBs; com fotos pode chegar a alguns MB) — mas a alternativa (não incluir fotos no backup) significa
perder as fotos se o celular quebrar ou trocar, o que é pior.

## Fluxo na tela

Em **Perfil › Seus dados**: círculo de avatar ao lado do nome, toque abre o seletor de arquivo
(a maioria dos navegadores mobile já oferece "câmera" ou "galeria" nesse seletor nativo, sem
precisar forçar isso no código).

Em **Perfil › Fotos de evolução** (card novo, logo abaixo do de peso): com 2+ fotos, mostra
"antes" (mais antiga) e "atual" (mais recente) lado a lado, mais uma tira horizontal com todas as
fotos por baixo, cada uma com a data. Tocar numa foto abre em tela cheia com opção de apagar.
Botão "Adicionar foto" sempre visível no fim do card.

## Entregue

- `js/dados.js` — `perfil.foto`, `fotosEvolucao()/registrarFotoEvolucao()/apagarFotoEvolucao()`,
  incluído no backup.
- `js/ui.js` — avatar em Perfil › Seus dados, card `telaPerfilFotos()`, modal de confirmação
  (prévia + nota opcional) e modal de visualização/exclusão.
- `js/app.js` — `escolherArquivoImagem()` e `comprimirImagem()` (canvas: redimensiona + JPEG),
  handlers de clique pra trocar/remover foto de perfil e adicionar/ver/apagar foto de evolução.
- Testado: lógica de `dados.js` (obrigatoriedade de foto, nota default, ordenação por data mais
  recente primeiro, teto de 120, presença no backup) — 15/15 passando.
