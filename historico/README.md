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
| 13 | 17/08/2026 | [Lembrete de backup](13-lembrete-de-backup.md) | Perda de dados real no iPhone (mesmo dia, mesmo ícone); `persist()` + aviso na tela inicial se fizer 7+ dias sem backup |
| 14 | 17/08/2026 | [Treino tipo personal](14-treino-tipo-personal.md) | Ficha ligada ao dia da semana certo; variedade programada a cada 4 semanas pra não enjoar |
| 15 | 17/08/2026 | [Nuvem (Supabase)](15-nuvem-supabase.md) | Login por link mágico, multiusuário real (família), backup automático — SDK oficial via CDN, única exceção de dependência do projeto |
| 16 | 17/08/2026 | [Bug do login mágico](16-bug-do-login-magico.md) | Sessão existia mas a tela não via — callback repassando argumento errado; achado via DevTools |
| 17 | 12/10/2026 | [Visual alegre e base ampliada](17-visual-alegre-e-base-ampliada.md) | 1535 exercícios, imagem em todos, gerador por objetivo/idade/sexo, aquecimento e alongamento do dia, cronômetro com alarme, chamada diária, visual claro |
| 18 | 12/10/2026 | [Auditoria e correções](18-auditoria-e-correcoes.md) | Auditoria com especialistas; corrigidos coach com sintoma, impacto para 50+/IMC alto, perda de digitação e de treino em andamento, login da nuvem pelo link, trocas sem filtro de perfil |
| 19 | 12/10/2026 | [Auditoria: ciclos 5 a 9](19-auditoria-ciclos-5-a-9.md) | Fotos no IndexedDB, contraste AA e teclado, ilustrações corrigidas, triagem PAR-Q e aeróbico 50+ leve, acabamento (heatmap, importar, zip, .ics, XSS) |
| 20 | 12/10/2026 | [Pedidos do teste no celular](20-pedidos-do-teste-no-celular.md) | Vários objetivos ao mesmo tempo, esportes desmarcáveis, 2 horários de lembrete, "Concluir série" sem rolar |
| 21 | 12/10/2026 | [Segundo teste no celular](21-segundo-teste-no-celular.md) | Calendario abria o Safari (dados separados), Spotify, foto na execucao, coach, "de sobra", fotos offline, boneco sem genero, ampliar imagem, comecar do zero |
| 22 | 12/10/2026 | [Ilustrações por IA](22-ilustracoes-ia.md) | "Como fazer" com imagem gerada no Canva (início → fim): 529 imagens, 1534 dos 1535 exercícios cobertos |
| 23 | 16/10/2026 | [Visual sóbrio](23-visual-sobrio.md) | Menos infantil: off-white, borda fina, uma cor de destaque (coral do logo), fonte do sistema, ícones de traço no lugar de emoji |
| 24 | 16/10/2026 | ["Última vez" e apagar treinos](24-ultima-vez-e-apagar-treinos.md) | Séries, reps e peso da última vez no treino, no exercício e em Evolução; apagar 1 treino ou todos sem perder perfil e fichas; calculadoras renomeadas |
| 25 | 16/10/2026 | [Aparelho ocupado](25-aparelho-ocupado-fazer-depois.md) | "Fazer depois" manda o exercício pro fim do bloco e volta nele; troca deixa claro que mantém o mesmo músculo |
| 26 | 16/10/2026 | [Tema dia e noite](26-tema-dia-e-noite.md) | Perfil › Aparência: Dia, Noite ou Automático (segue o celular); escolha do aparelho, sem piscar ao abrir |

## Como usar

Cada arquivo documenta um ciclo: o que foi pedido, o que foi decidido (e por quê, quando não era
óbvio), e o que ficou de fora. Ao começar um ciclo novo, vale ler o [README.md](../README.md) do
projeto (o estado atual) e, se for mexer em algo específico, o arquivo do histórico onde aquilo
foi decidido.
