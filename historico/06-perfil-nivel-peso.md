# 6. Perfil, nível e peso

**Data:** 16/08/2026

## Pedido

"Deverá também ter o nível, iniciante, avançado e quantos e quais dias da semana haverá treino,
cadastro com sexo, idade, peso, altura, análise de bioimpedância (se tiver). Informações
editáveis, e controle de evolução de séries, cargas, registro semanal de peso."

## O que já existia (conferido antes de construir)

Sexo, idade (derivada da data de nascimento, não um campo solto), peso e altura já estavam no
Perfil e editáveis. Evolução de séries e cargas já existia desde o ciclo 4 (histórico por
exercício com gráfico + histórico de sessões). O que faltava de fato: nível "elite" no seletor
(existia no resto do código, faltava na tela), dias específicos da semana, bioimpedância, e um
registro de peso ao longo do tempo (só havia um campo único de "peso atual").

## Decisões

- **Dias da semana** (chips D/S/T/Q/Q/S/S) alimentam um aviso na tela Início ("hoje é dia de
  treino"), mas **não sincronizam automaticamente** com os campos numéricos de frequência
  (musculação/aeróbico dias-por-semana) que já existiam — esses continuam controlando quantas
  fichas o gerador automático cria. Decisão deliberada: evitar sincronização mágica escondida
  entre dois conceitos parecidos mas usados por partes diferentes do app.
- **Bioimpedância opcional:** só peso é obrigatório pra registrar uma pesagem; gordura corporal,
  massa muscular, água corporal, gordura visceral e TMB ficam de fora de quem não tem balança
  própria.
- **Peso atual do perfil sincroniza com a pesagem mais recente por data**, não por ordem de
  cadastro — registrar uma pesagem atrasada (de uma data passada) entra no histórico sem
  sobrescrever o peso "atual" exibido em outros lugares do app.

## Entregue

- Campo `diasTreino` e nível "elite" no perfil.
- `Dados.registrarPeso()` / `Dados.pesos()` — histórico de pesagens com bioimpedância opcional.
- Card "Peso & bioimpedância" no Perfil, gráfico de evolução de peso na tela Evolução (SVG puro,
  mesma técnica dos outros gráficos do app).
- 32 testes novos, 298/298 no total do projeto até aqui.
