# 9. Fotos reais de exercícios

**Data:** 17/08/2026

## Pedido

"E o Spotify e as imagens dos exercícios?" — seguido de, quando perguntado se os pictogramas
resolviam ou se ela queria foto real: **"quero foto/ilustração real por exercício"**.

## Fonte

[free-exercise-db](https://github.com/yuhonas/free-exercise-db) — banco público (licença
Unlicense/domínio público, uso livre sem exigir crédito), 873 exercícios em inglês, cada um com
2 fotos reais (início e fim do movimento). Baixado e hospedado **dentro do próprio app**
(`data/imagens/`), não como link externo — mantém o app funcionando offline.

## O problema real: casar nome em português com nome em inglês

Tentativa 1 (musculo + equipamento + palavra-chave do nome, score ≥ 4): 528 de 563 aceitos —
mas a amostra revelou erros sérios. Ex.: "Hollow Body Hold" casou com "Close-Grip Push-Up",
"Copenhagen Plank" com "3/4 Sit-Up" — exercícios completamente diferentes.

Tentativa 2 (exige pelo menos 1 termo do nome batendo, score ≥ 6): 263 aceitos — melhor, mas
ainda com um padrão sistemático de erro: dezenas de variantes diferentes de "Rosca" (Scott,
Direta, 21, Martelo, Zottman, Concentrada...) todas caindo na mesma foto genérica de
"Alternate Hammer Curl"; dezenas de variantes de pull-up todas em "V-Bar Pullup" (equipamento
específico que a maioria nem usa); "Prancha Frontal" caindo em "Push Up to Side Plank"
(exercício dinâmico, não estático).

**Decisão:** descartar o matching automático em massa. Mostrar a foto errada é pior que manter
o pictograma — o pictograma já avisa "referência, não é foto"; uma foto real errada parece
precisa e engana sobre a execução correta, o que é um risco de verdade numa dica de exercício.

## Solução: curadoria manual

Revisão item a item da lista completa de 263 candidatos, aceitando só pares onde o nome PT e o
nome EN são **a mesma execução específica** (não só a mesma família de movimento). Resultado:
**22 exercícios com foto real verificada**, entre eles os mais comuns/fundamentais: Agachamento
Livre, Levantamento Terra, Stiff, Supino Reto, Leg Press 45°, Hip Thrust Barra, Face Pull, Bom
Dia, Superman, Handstand Push-up, Arnold Press, Farmers Walk, Box Jump, entre outros.

Os outros 541 continuam com pictograma — não é uma lacuna, é a escolha certa dado que não havia
como confirmar a correspondência com segurança.

## Entregue

- `data/imagens/` — 44 fotos (22 exercícios × 2 fotos, início/fim do movimento), ~2,6 MB total.
- Nome, instruções, músculos e erros comuns continuam 100% em português, vindos da nossa base —
  só a imagem veio da fonte externa.
- Tela de exercício e tela de execução mostram a foto real quando existe, pictograma quando não.
- Bug de layout encontrado e corrigido: as 2 fotos lado a lado estouravam o card (`width:100%`
  em cada uma, quando deveria ser `flex:1`).
- 352/352 testes passando no total do projeto.

## Se quiser ampliar depois

Duas rotas: (1) eu revisar mais candidatos da lista de 263 manualmente — trabalho lento, uns
poucos por vez, mas seguro; (2) fotos/vídeos tirados por você mesma nos exercícios que usa mais
— mais fiel ainda que banco de terceiros, e um toque pessoal que nenhum concorrente tem.
