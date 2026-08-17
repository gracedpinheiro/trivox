# Histórico do projeto TRIVOX

Registro dos ciclos de trabalho, na ordem em que aconteceram, com o que foi decidido e por quê.
Não é um changelog técnico linha a linha (isso o git faz) — é o histórico de **decisões**, pra
quem retomar o projeto (eu, você, ou outro assistente) não precisar redescobrir o raciocínio.

| # | Data | Ciclo | Resumo |
|---|---|---|---|
| 1 | 16/08/2026 | [Fundação do projeto](01-fundacao-do-projeto.md) | Análise dos 9 apps antigos, decisão de consolidar num PWA novo |
| 2 | 16/08/2026 | [Rebranding TRIVOX](02-rebranding-trivox.md) | Nome e logomarca reaproveitados, paleta extraída da logo |
| 3 | 16/08/2026 | [Planilha comparativa](03-planilha-comparativa.md) | Levantamento do que cada app antigo tinha, o que entrou na versão nova |
| 4 | 16/08/2026 | [Ciclo completo de treino](04-ciclo-completo-de-treino.md) | Base de exercícios consolidada, gamificação, execução, evolução, gerador automático |
| 5 | 16/08/2026 | [Integração Spotify](05-integracao-spotify.md) | Música durante o treino via OAuth PKCE |
| 6 | 16/08/2026 | [Perfil, nível e peso](06-perfil-nivel-peso.md) | Dias da semana, bioimpedância, registro de peso ao longo do tempo |
| 7 | 17/08/2026 | [Hospedagem — GitHub Pages](07-hospedagem-github-pages.md) | Uso é só celular na academia, sem computador — decidido GitHub Pages, não Supabase nem Flutter |
| 8 | 17/08/2026 | [Verificação completa](08-verificacao-completa.md) | Teste de integração com cliques reais; achou e corrigiu 1 ineficiência (timer) e 1 inconsistência (limite de peso) |
| 9 | 17/08/2026 | [Fotos reais de exercícios](09-fotos-reais-de-exercicios.md) | Matching automático (PT↔EN) errava demais; curadoria manual entregou 22 exercícios com foto real verificada |
| 10 | 17/08/2026 | [Fonte legível e fotos](10-fonte-legivel-e-fotos.md) | Fontes maiores pra celular; foto de perfil e fotos de evolução (antes/depois) com data automática |
| 11 | 17/08/2026 | [Foto e vídeo por exercício](11-foto-e-video-por-exercicio.md) | Foto real substitui a pré-cadastrada exercício a exercício; vídeo pessoal via IndexedDB, fora do localStorage |
| 12 | 17/08/2026 | [Backup com vídeo](12-backup-com-video.md) | Exportar/Importar vira `.zip` (leitor/escritor próprio, sem dependência) pra levar os vídeos junto |

## Como usar

Cada arquivo documenta um ciclo: o que foi pedido, o que foi decidido (e por quê, quando não era
óbvio), e o que ficou de fora. Ao começar um ciclo novo, vale ler o [README.md](../README.md) do
projeto (o estado atual) e, se for mexer em algo específico, o arquivo do histórico onde aquilo
foi decidido.
