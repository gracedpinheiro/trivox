# 1. Fundação do projeto

**Data:** 16/08/2026

## Pedido

"Vamos recomeçar nosso projeto de app de treino." A pasta `APP TREINO` estava vazia (só um
`index.html` em branco).

## O que foi feito

Análise da pasta `C:\Users\grace\Desktop\APP DE TREINO`, que reunia **9 apps de fitness
anteriores**, todos HTML de arquivo único, criados entre março e julho de 2026, nenhum
consolidado:

| App | O que tinha de bom |
|---|---|
| **X IRON v7** | Base de exercícios rica (musculação + calistenia), engine de força (1RM, platô, deload) |
| **VYRON** | Auth Firebase, PWA completo, gamificação (XP/badges), coach por chat |
| **R2 PRO v5** | Análise de movimento por câmera (MediaPipe) — capacidade única |
| **LOBAS MOTION** | Base de exercícios própria (glúteos, alongamento, equilíbrio) |
| **TRIVOX v7.6** | Relatório de performance, visão computacional leve |

**Lacuna identificada em todos:** nenhum tinha engine aeróbica de verdade (zonas de FC,
Karvonen, modelos de sessão) nem autorregulação por RIR prescrevendo carga.

## Decisões

- **PWA novo consolidado**, não evoluir o X IRON v7 (850 KB em arquivo único, difícil de manter).
- **Uso pessoal agora, estrutura pronta pra multi-usuário depois** — por isso os dados já nascem
  namespaced por perfil (`at:v1:<perfilId>:<coisa>`) mesmo só existindo um perfil hoje.
- Arquitetura sem build, sem Node em produção: `index.html` + `css/` + `js/` por módulo +
  `data/` + `sw.js`, servido por um `servidor.js` local mínimo (só o que já vem no Node).

## Entregue

- Base de **501 exercícios** extraída do X IRON v7 → `data/exercicios.json`.
- `js/dados.js` (persistência), `js/forca.js` (1RM, RIR, platô, volume, deload, anilhas),
  `js/aerobico.js` (zonas de FC por Karvonen, modelos de sessão, progressão, interferência
  força×aeróbico), `js/ui.js` + `js/app.js` (telas e eventos).
- Ícones PWA gerados por código (PNG puro, sem lib).
- 111 testes automatizados (67 de engine + 44 de tela).
