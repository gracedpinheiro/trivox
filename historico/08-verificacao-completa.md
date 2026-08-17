# 8. Verificação completa

**Data:** 17/08/2026

## Pedido

"Teste, simule e verifique se tudo está funcionando, sem bugs, sem erros e com eficiência."

## O que mudou na forma de testar

Até aqui, os testes chamavam as funções de tela do `ui.js` diretamente (`UI.render()` com
`UI.estado` montado à mão) — bom pra pegar bug de template, mas nunca exercitava de fato os
manipuladores de clique do `app.js`. Escrito um teste de integração novo que dispara eventos de
verdade (`document.body.addEventListener('click', ...)`) através do `app.js` real, cobrindo o
caminho que faltava: criar ficha por prompt, adicionar exercício, gerar plano automático,
executar um treino do início ao fim (com o cronômetro rodando de verdade via `setInterval`
simulado, não só clicando em "pular"), trocar equipamento no meio do treino, finalizar e
verificar sessão/XP/badge, alternar dia da semana, registrar peso (com validação), coach, export,
e encerrar treino com e sem progresso feito.

## Achados (2 reais, ambos corrigidos)

1. **Ineficiência real:** o cronômetro de descanso chamava `UI.render()` — reconstrução completa
   da tela, incluindo o SVG do pictograma — a cada segundo. Como o descanso dura de 1 a 3 minutos
   e acontece a cada série, isso era dezenas de reconstruções desnecessárias por treino.
   Corrigido: agora só o número do cronômetro é atualizado diretamente
   (`document.getElementById('descanso-timer').textContent = ...`), sem tocar no resto da tela.
   Confirmado por teste: 5 ticks do relógio, zero renders extras.
2. **`registrarPeso` sem limite de crescimento**, diferente de `sessoes` (300) e
   `historicoCarga` (60). Não era um bug com efeito prático perto (levaria anos pra incomodar),
   mas quebrava a consistência do padrão usado no resto do app. Adicionado limite de 500
   registros (~10 anos de pesagem semanal).

## Entregue

- `integracao.js` (teste novo): 47 verificações, todas passando, exercitando o `app.js` real de
  ponta a ponta.
- Suíte completa do projeto: **347/347 testes passando** (8 arquivos de teste).
- As duas correções commitadas e enviadas ao GitHub.
