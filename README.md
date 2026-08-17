# TRIVOX — Força e Aeróbico

PWA de musculação e treino aeróbico. Sem build, sem `node_modules`, sem servidor na nuvem:
tudo roda no navegador e os dados ficam no aparelho.

> Este README documenta o estado **atual**. Pra entender como e por que ele chegou nesse estado
> — o raciocínio por trás de cada decisão — ver [historico/](historico/).

## Como rodar

```
node servidor.js
```

Depois abra **http://localhost:8080**.

> Não abra o `index.html` com duplo clique. Em `file://` o navegador bloqueia a leitura do
> `data/exercicios.json` e o service worker não registra — o app não carrega.

**No celular, com o computador ligado (mesma rede wi-fi):** descubra o IP do computador com
`ipconfig` e acesse `http://SEU_IP:8080`.

**No celular, sem depender do computador (uso do dia a dia, ex.: na academia):** acesse a versão
hospedada no GitHub Pages (ver [seção abaixo](#hospedagem-no-github-pages)). No Chrome, menu ›
*Instalar app*. No iPhone, Safari › compartilhar › *Adicionar à Tela de Início*. Depois de
instalado uma vez com internet, funciona offline — não precisa mais do computador.

## Hospedagem no GitHub Pages

**No ar:** **https://gracedpinheiro.github.io/trivox/** — repositório em
[github.com/gracedpinheiro/trivox](https://github.com/gracedpinheiro/trivox), publicado via
Settings › Pages › Deploy from a branch › `main` › `/ (root)`. É essa a URL de uso diário, pelo
celular — instala uma vez (Chrome: menu › Instalar app; iPhone: Safari › compartilhar ›
Adicionar à Tela de Início) e funciona offline dali em diante.

Pra atualizar depois de qualquer mudança no código: `git add -A && git commit -m "..." && git push`
— o GitHub Pages redeploya sozinho em 1-2 minutos.

> **Spotify:** se for usar o Spotify tanto localmente (comigo, durante o desenvolvimento) quanto
> na versão hospedada, cadastre **as duas** redirect URIs no painel do Spotify — o app detecta
> sozinho qual usar: `http://127.0.0.1:8080/index.html` (local) e
> `https://gracedpinheiro.github.io/trivox/index.html` (hospedado, a que você usa de verdade).

## Estrutura

| Arquivo | O que faz |
|---|---|
| [index.html](index.html) | Casca do app: só carrega os scripts |
| [js/dados.js](js/dados.js) | Persistência. Chaves já separadas por perfil (`at:v1:<perfilId>:<coisa>`) — trocar por banco na nuvem depois é reescrever só este arquivo |
| [js/forca.js](js/forca.js) | Engine de musculação: 1RM, autorregulação por RIR, platô, volume semanal, deload, anilhas, gerador automático de ficha, substituição por equipamento ocupado |
| [js/aerobico.js](js/aerobico.js) | Engine aeróbica: FCmáx, zonas, modelos de sessão, carga, progressão, interferência com a força |
| [js/gamificacao.js](js/gamificacao.js) | XP, nível, badges, streak e o coach por chat (banco de frases por tema, não é IA) |
| [js/pictogramas.js](js/pictogramas.js) | Ilustrações SVG por padrão de movimento (referência visual do exercício) |
| [js/spotify.js](js/spotify.js) | Controle de música durante o treino — OAuth PKCE, sem client secret |
| [js/ui.js](js/ui.js) | Telas (render por string) |
| [js/app.js](js/app.js) | Eventos, cronômetro de descanso e ligação entre telas e dados |
| [data/exercicios.json](data/exercicios.json) | 563 exercícios, migrados do X IRON v7 + LOBAS MOTION/VYRON |
| [sw.js](sw.js) | Cache offline |
| [servidor.js](servidor.js) | Servidor local, só com o que já vem no Node |

## Marca

Nome e logomarca reaproveitados de `APP DE TREINO/tryvox/TRIVOX/index e logo/` (logo.png.png e
icon.png.png). A paleta é um gradiente vibrante (azul → violeta → rosa) derivado da cor da
logomarca (amostrada por pixel: `#6477C7`), mais uma cor de comemoração (`--festa`, âmbar) para
conquistas e treino concluído.

## De onde veio a base de exercícios

563 exercícios, sem repetição, consolidados de dois apps antigos:
- **X IRON v7** (501): musculação, calistenia (empurrar/puxar/pernas/core), skills, mobilidade, cardio.
- **LOBAS MOTION / VYRON** (+64, mesma base nos dois apps): glúteos isolados, alongamento e
  equilíbrio — três categorias que o X IRON não tinha.

Todos com músculos primários/secundários, instruções passo a passo, erros comuns e nível.
Validado na extração: nenhum id duplicado, nenhum nome duplicado, nenhum exercício sem
instruções ou sem músculo mapeado.

## Decisões de treino embutidas no código

- **1RM** pela média de Epley, Brzycki e Lombardi; marcado como pouco confiável acima de 10 reps.
- **Progressão de carga** por RIR (1 RIR ≈ 3,5% de carga) combinada com dupla progressão:
  sobe reps até o topo da faixa, só então sobe carga. O salto é proporcional ao porte da carga.
- **Volume semanal** contado em séries por músculo, com contagem fracionada (primário 1, auxiliar 0,5).
  Faixa de referência: 10 a 22 séries por semana.
- **FCmáx** por Tanaka (`208 − 0,7 × idade`), não por `220 − idade`, que subestima quem passa dos 40.
  Valor medido em teste de esforço sempre tem prioridade sobre a fórmula.
- **Zonas** por FC de reserva (Karvonen) quando há FC de repouso; senão, % da FCmáx.
- **Progressão de volume aeróbico** limitada a +10% por semana, com a 4ª semana em ~60%.
- **Distribuição polarizada**: ~80% do tempo em Z1-Z2, ~20% em Z4-Z5.
- **Interferência**: com objetivo de força ou hipertrofia, musculação vem antes do aeróbico intenso.
- **Gerador automático de ficha**: escolhe o split pelo nº de dias/semana (1=full body … 5+=bro
  split), filtra por nível e local de treino, prioriza compostos, e usa a mesma engine de
  prescrição do fluxo manual. `rotacao` varia a seleção sem depender de aleatoriedade real —
  resultado reproduzível, mas "gerar de novo" dá variedade.
- **Substituição por equipamento ocupado**: busca exercícios do mesmo padrão de movimento
  (músculos primários em comum, categoria irmã) com equipamento diferente.
- **XP e níveis** reaproveitados do modelo do VYRON (limiares 500/1500/3000 XP). **Badges** (12)
  redesenhados: os do VYRON dependiam de um programa fixo de 12 semanas que este app não tem;
  aqui checam dado real (sessões, streak, recordes, platô quebrado, volume equilibrado).
- **Coach por chat**: banco de frases por tema + palavra-chave, sem IA — funciona offline e sem custo.
- **Imagem do exercício**: nenhum app antigo tinha foto real (o único que tentava, o LOBAS,
  chamava um serviço externo pra gerar uma caixa colorida com texto — nem era foto, e quebraria
  o app offline). Em vez disso, pictogramas SVG por padrão de movimento.

## Spotify — como ativar

É a única parte do app que exige internet e conta própria. Passo a passo (uma vez só):

1. Entre em [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) com sua
   conta Spotify e crie um app (gratuito, é só preencher nome/descrição).
2. Nas configurações do app criado, em **Redirect URIs**, adicione a URI que combina com onde
   você vai usar (pode adicionar as duas, sem problema):
   - `http://127.0.0.1:8080/index.html` — se for usar local, comigo, durante o desenvolvimento.
   - `https://gracedpinheiro.github.io/trivox/index.html` — a versão hospedada, que é a que você
     vai usar no dia a dia pelo celular.
3. Copie o **Client ID** (não precisa do Client Secret — o app usa PKCE, não guarda segredo
   nenhum) e cole em **Perfil › Spotify** no TRIVOX.
4. Toque em "Conectar Spotify" e autorize.

O app detecta sozinho qual das duas URIs usar, conforme onde estiver rodando. Conta Free
consegue ver "tocando agora" durante o treino; pausar/tocar/pular exige Premium (limitação do
Spotify, não do app — a mensagem de erro explica isso quando acontece).

## Perfil, nível e peso

- **Nível**: iniciante, intermediário, avançado ou elite.
- **Dias da semana de treino**: chips de domingo a sábado em Perfil › Treino. Só avisa "hoje é
  dia de treino" na tela inicial — quem decide quantas fichas o gerador automático cria continua
  sendo os campos numéricos de musculação/aeróbico (dias/semana), sem sincronização forçada
  entre os dois pra não criar mágica escondida.
- **Peso & bioimpedância** (Perfil e Evolução): registro de pesagens ao longo do tempo, com
  gráfico de evolução (SVG puro). Peso é obrigatório; gordura corporal, massa muscular, água e
  gordura visceral são opcionais — só pra quem tem balança de bioimpedância. Cada pesagem nova
  atualiza o "peso atual" do perfil automaticamente (a mais recente por data, não por ordem de
  cadastro — registrar uma pesagem atrasada não sobrescreve o peso atual).

## O que ainda não existe

- Multi-usuário para prescrever a alunos (a estrutura de dados já está pronta, falta a nuvem e o login)
- Gráfico de volume semanal (hoje a evolução mostra XP/nível, streak, heatmap de consistência,
  peso e histórico de sessões — falta só o gráfico de barras de volume)
