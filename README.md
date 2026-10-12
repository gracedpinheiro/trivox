# TRIVOX — Treino em casa e na academia

PWA de treino (musculação, condicionamento, aeróbico) para casa e academia. Sem build, sem `node_modules`, sem servidor na nuvem:
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

## ⚠️ Seus dados podem sumir sozinhos — faça backup

Caso real, já aconteceu: cadastro preenchido, primeiro treino feito, saiu do app, voltou horas
depois pelo mesmo ícone — tudo vazio, como se fosse a primeira vez. Não é bug de lógica do app
(não existe nenhum `localStorage.clear()` em lugar nenhum do código); é o navegador/sistema
limpando o armazenamento do site sozinho, sem avisar — mais comum no iPhone, onde dado de site
"salvo na tela de início" não é tão protegido quanto um app de verdade, principalmente com pouco
espaço livre no aparelho.

Três defesas em vigor:
- O app pede ao navegador pra tratar seu armazenamento como persistente (`navigator.storage.persist()`)
  assim que abre — reduz a chance, não garante 100%, principalmente no Safari/iOS
  ([ciclo 13](historico/13-lembrete-de-backup.md)).
- A tela inicial mostra um aviso pra exportar backup se fizer mais de 7 dias (ou nunca) desde o
  último — gera um arquivo fora do navegador ([ciclo 13](historico/13-lembrete-de-backup.md)).
- **Backup automático na nuvem** (Perfil › Backup na nuvem): login por link no e-mail (sem
  senha), e a partir daí os dados sobem sozinhos sempre que mudam. Se o aparelho perder tudo, é
  só entrar de novo com o mesmo e-mail — os dados voltam sozinhos
  ([ciclo 15](historico/15-nuvem-supabase.md)). Essa é a defesa que resolve de verdade; as
  outras duas são reforço.

**Ainda assim, backup manual não é opcional pra quem usa isso de verdade.** Perfil › Backup
manual › Exportar, e guarde o arquivo `.zip` em algum lugar fora do navegador de vez em quando —
mandar pra você mesma por e-mail já resolve. A nuvem cobre os dados de treino; o `.zip` é a
única cópia que também leva os vídeos por exercício (a nuvem ainda não sincroniza vídeo — ver
["o que ainda não existe"](#o-que-ainda-não-existe)).

## Estrutura

| Arquivo | O que faz |
|---|---|
| [index.html](index.html) | Casca do app: só carrega os scripts |
| [js/dados.js](js/dados.js) | Persistência. Chaves já separadas por perfil (`at:v1:<perfilId>:<coisa>`) |
| [js/programas.js](js/programas.js) | Regras de treino por objetivo × nível (séries, reps, descanso, RIR, blocos, progressão, deload) e ajustes por idade, sexo e IMC — ver [ferramentas/programas.md](ferramentas/programas.md) |
| [js/forca.js](js/forca.js) | Engine de musculação: 1RM, RIR, platô, volume, gerador de fichas (`gerarPlano`), aquecimento/alongamento por grupo do dia (`completarSessao`), troca por aparelho ocupado (`substitutos`), variação a cada 4 semanas |
| [js/aerobico.js](js/aerobico.js) | Engine aeróbica: FCmáx, zonas, modelos de sessão |
| [js/gamificacao.js](js/gamificacao.js) | XP, nível, badges, streak e o coach por chat (banco de frases, não é IA) |
| [js/motivacao.js](js/motivacao.js) | Frase do dia (muda 1x por dia, pelo contexto: objetivo, idade, sequência, dias parado) e texto da chamada diária |
| [js/figuras.js](js/figuras.js) | Ilustração animada de **todo** exercício (boneco/boneca + aparelho, 368 movimentos) e desenho de cada aparelho (60) — vetorial, offline |
| [js/mapa-muscular.js](js/mapa-muscular.js) | Corpo de frente e costas com a região trabalhada pintada (desenho do react-body-highlighter, MIT) |
| [js/alarme.js](js/alarme.js) | Som (Web Audio, sem arquivo), vibração e notificação — descanso, cronômetro, lembrete |
| [js/lembretes.js](js/lembretes.js) | Chamada diária pro treino: arquivo de calendário (.ics), notificação do app e sincronização periódica (Android) |
| [js/pictogramas.js](js/pictogramas.js) | Pictogramas antigos (reserva, se a ilustração não carregar) |
| [js/spotify.js](js/spotify.js) | Música durante o treino — OAuth PKCE, sem client secret |
| [js/videos.js](js/videos.js) | Vídeo pessoal por exercício — IndexedDB |
| [js/zip.js](js/zip.js) | Leitor/escritor de `.zip` sem dependência — backup |
| [js/nuvem.js](js/nuvem.js) | Login por link/código + sincronização automática com o Supabase |
| [js/ui.js](js/ui.js) | Telas (render por string) |
| [js/app.js](js/app.js) | Eventos, relógio único (descanso, tempo por exercício, cronômetro) e ligação entre telas e dados |
| [data/exercicios.json](data/exercicios.json) | 1535 exercícios (ver abaixo) |
| [data/imagens/fedb/](data/imagens/fedb/) | Fotos reais de execução (free-exercise-db, domínio público), reduzidas |
| [fonts/](fonts/) | Baloo 2 e Nunito (OFL), servidas pelo próprio app — funcionam offline |
| [ferramentas/](ferramentas/) | Scripts que geram/validam a base, as fotos e as ilustrações, e os testes (`node ferramentas/teste_*.js`) |
| [sw.js](sw.js) | Cache offline + lembrete em segundo plano |
| [servidor.js](servidor.js) | Servidor local, só com o que já vem no Node |

## Visual

Claro, alegre e divertido (out/2026 — antes era escuro). Fundo céu claro, cartões brancos com
contorno e sombra sólida colorida ("brinquedo de academia"), cores com papel fixo: coral = ação,
turquesa = treino/ok, sol = conquista, uva = evolução, azul = informação. Cada aba da barra de
baixo tem a sua cor. Títulos em Baloo 2, texto em Nunito. Ícone: o símbolo da logomarca TRIVOX
em branco sobre gradiente coral → sol.

## De onde veio a base de exercícios

**1535 exercícios** (eram 563). Os 563 originais (X IRON v7 + LOBAS/VYRON) mantêm os mesmos ids —
o histórico de carga depende disso. 106 fichas antigas genéricas foram reescritas. Os 972 novos
foram escritos por especialistas (em [ferramentas/novos_exercicios/](ferramentas/novos_exercicios/),
formato texto, convertidos por `python3 ferramentas/enriquecer_exercicios.py`), pensando em:
sempre haver outro exercício pro mesmo músculo quando o aparelho está ocupado, casa com
variação de verdade (cadeira, degrau, mochila, toalha, elástico, halteres...), 50+ e raquete.

Todo exercício tem agora: `local` (casa/academia), `objetivos` (condicionamento, perda_peso,
hipertrofia, 50mais, raquete), `impacto` (baixo/médio/alto) e `aparelho` (chave normalizada,
60 tipos). Todas as combinações local × nível × objetivo têm pelo menos 15 exercícios.
Relatório: [ferramentas/relatorio_exercicios.md](ferramentas/relatorio_exercicios.md).

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
- **Gerador automático de ficha**: escolhe o split pelos dias da semana marcados no perfil
  (Perfil › Treino) — cada ficha sai já ligada a um dia específico (a tela inicial passa a
  avisar "hoje é dia de X", com botão direto pra começar). Sem dias marcados, cai pro número
  de dias/semana (1=full body … 5+=bro split). Filtra por nível e local de treino, prioriza
  compostos, cobre os grandes grupos musculares dentro da semana, e usa a mesma engine de
  prescrição do fluxo manual. `rotacao` varia a seleção sem depender de aleatoriedade real —
  resultado reproduzível, mas "gerar de novo" dá variedade.
- **Variedade programada (evitar monotonia)**: a cada 4 semanas sem mudar nada, a tela de
  Treinos sugere "variar" — troca metade dos exercícios (isolados primeiro) por alternativas de
  mesmo padrão de movimento em **outro aparelho** (reaproveita a mesma busca da substituição por
  equipamento ocupado), sem perder o objetivo prescrito nem o histórico de carga de cada
  exercício (fica por `exId`, não por posição na ficha). É sugestão, não automático — um botão,
  não uma surpresa.
- **Substituição por equipamento ocupado**: busca exercícios do mesmo padrão de movimento
  (músculos primários em comum, categoria irmã) com equipamento diferente.
- **XP e níveis** reaproveitados do modelo do VYRON (limiares 500/1500/3000 XP). **Badges** (12)
  redesenhados: os do VYRON dependiam de um programa fixo de 12 semanas que este app não tem;
  aqui checam dado real (sessões, streak, recordes, platô quebrado, volume equilibrado).
- **Coach por chat**: banco de frases por tema + palavra-chave, sem IA — funciona offline e sem custo.
- **Imagem do exercício**: ver "Imagens dos exercícios" abaixo.

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

**Importante:** o Client ID é por app registrado no Spotify, não por pessoa. Se outra pessoa for
usar o TRIVOX com o próprio Spotify, ela precisa criar o **próprio app** e usar o **próprio
Client ID** — o seu fica restrito a você. Além disso, enquanto o app estiver em modo
"Development" no painel do Spotify (padrão, gratuito), só até 25 contas especificamente
liberadas por você em Settings › User Management conseguem conectar.

## Backup na nuvem — como ativar (Supabase)

Configuração feita **uma vez só**, por quem administra o projeto (não por cada pessoa da
família — cada uma só precisa logar com o próprio e-mail dentro do app, sem mexer em painel
nenhum).

1. Projeto criado em [supabase.com](https://supabase.com) (plano free permite 2 projetos ativos
   por organização). URL e chave anônima (`anon key`) já estão em `js/nuvem.js` — são públicas
   por design, protegidas pelas políticas de RLS no banco, não por segredo.
2. No **SQL Editor** do painel Supabase, rodar uma vez:
   ```sql
   create table public.dados_usuario (
     user_id uuid references auth.users on delete cascade not null,
     loja text not null,
     valor jsonb not null,
     atualizado_em timestamptz not null default now(),
     primary key (user_id, loja)
   );

   alter table public.dados_usuario enable row level security;

   create policy "cada um ve so o proprio" on public.dados_usuario
     for select using (auth.uid() = user_id);
   create policy "cada um grava so o proprio" on public.dados_usuario
     for insert with check (auth.uid() = user_id);
   create policy "cada um atualiza so o proprio" on public.dados_usuario
     for update using (auth.uid() = user_id);
   create policy "cada um apaga so o proprio" on public.dados_usuario
     for delete using (auth.uid() = user_id);
   ```
   Uma linha por "loja" (mesmo nome usado no `localStorage`: `perfil`, `fichas`, `sessoes`...),
   isolada por `user_id` — cada pessoa só vê as próprias linhas, imposto pelo banco, não pelo app.
3. Em **Authentication › URL Configuration**:
   - **Site URL**: `https://gracedpinheiro.github.io/trivox/index.html`
   - **Redirect URLs**, adicionar as duas: a mesma acima e `http://127.0.0.1:8080/index.html`
     (mesma lógica do Spotify — local e hospedado).
4. **Importante — limite de e-mail padrão do Supabase**: o servidor de e-mail compartilhado
   (usado por padrão) só manda **2 e-mails por hora**, inviável até pra 3 pessoas testando no
   mesmo dia. Configurar SMTP próprio em **Authentication › Emails › SMTP Settings**, usando o
   Gmail (gratuito, sem domínio próprio necessário):
   - Ativar verificação em 2 etapas na conta Google, se ainda não tiver.
   - Gerar uma **App Password** em [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords).
   - Host: `smtp.gmail.com` · Porta: `587` · Usuário: seu e-mail Gmail · Senha: a App Password
     gerada · Remetente: o mesmo e-mail.

Depois disso, qualquer pessoa (Grace, filha, filho...) abre o TRIVOX, vai em **Perfil › Backup
na nuvem**, digita o próprio e-mail, recebe um link (sem senha) e pronto — dali em diante os
dados dela sobem sozinhos sempre que mudam, isolados dos demais.

## Imagens dos exercícios

**Todo exercício tem imagem.** Na tela do exercício (e durante o treino) há abas:
- **Fotos** — foto real de início e fim do movimento: 689 exercícios, do
  [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (domínio público), associadas
  uma a uma por especialista (só quando é o mesmo movimento com o mesmo equipamento) e guardadas
  dentro do app (`data/imagens/fedb/`, ~38 MB, baixadas sob demanda e cacheadas).
- **Como fazer** — ilustração animada do movimento com o aparelho (todos os 1535), boneca ou
  boneco conforme o sexo do perfil ([js/figuras.js](js/figuras.js)).
- **Músculos** — corpo de frente e costas com a região trabalhada (principal e auxiliar).
- **Aparelho** — desenho do equipamento usado.
- **Minha foto** — a foto que a pessoa tirou (abaixo).

Não havia gerador de imagem por IA disponível nesta rodada; as ilustrações são vetoriais, feitas
por código. Se no futuro houver fotos/vídeos melhores, basta preencher `imagens` no json.

### Sua própria foto e vídeo por exercício

Em qualquer exercício (tela de detalhe), dá pra substituir a foto pré-cadastrada (ou o
pictograma) pela **sua foto real** — toque em "Usar minha foto"/"Trocar minha foto". Fica
salva só nesse aparelho, comprimida automaticamente, e passa a aparecer ali (inclusive durante o
treino, na tela de execução) até você trocar de novo.

Também dá pra anexar um **vídeo curto seu** fazendo o movimento — toque em "Adicionar vídeo" na
tela do exercício, grave ou escolha da galeria. Na próxima vez que quiser lembrar como faz,
é só abrir o exercício e tocar em ▶. Um clipe de 5-15s de uma repetição limpa já é suficiente.

Vídeo fica guardado separado das fotos (em IndexedDB, não localStorage) porque pesa muito mais.
Ainda assim, **o vídeo vai junto no backup**: Perfil › Backup › Exportar agora baixa um `.zip`
(não mais `.json`) com `backup.json` (perfil, fichas, histórico, fotos) mais uma pasta `videos/`
com cada vídeo. É um `.zip` de verdade — dá pra abrir num computador com qualquer
descompactador. Importar aceita tanto esse `.zip` novo quanto um `.json` antigo (backup feito
antes desse recurso existir) — nesse caso só não tem vídeo pra restaurar, o resto volta normal.

## Perfil, objetivo e treino

- **Objetivos**: condicionamento físico, perda de peso, hipertrofia, especial 50+ e especial raquete
  (pickleball/beach tennis — com dias de jogo: nesses dias e na véspera a ficha vira ativação leve).
- **Nível**: iniciante, intermediário ou avançado (o "elite" antigo vale como avançado).
- **Onde treina**: academia ou casa; em casa, a pessoa marca os equipamentos que tem.
- **Sexo, idade e peso/altura** personalizam o gerador: 50+ e 65+ ficam sem salto e com mais
  equilíbrio; IMC alto evita impacto; sexo só muda a ênfase padrão (nunca exclui nada).
- **Toda ficha** começa com aquecimento e termina com alongamento dos músculos do dia — inclusive
  as montadas à mão (o app completa ao começar o treino).
- **Último treino**: em cada exercício aparece "Última vez: 20kg × 12 · 22kg × 10..." e os
  campos já vêm com esses valores.
- **Aparelho ocupado**: até 12 alternativas pro mesmo músculo, em aparelhos diferentes, com as
  mesmas regras do gerador (em casa só o que dá com o equipamento marcado; idade e IMC limitam
  impacto e risco). As séries já feitas do exercício trocado continuam no treino.
- **Treino em andamento**: fica salvo no aparelho; saindo da tela, Início e Treinos mostram
  "Continuar treino" (também depois de fechar o app).
- **Cronômetro** (Início ou ⏱️ no treino): timer com alarme, cronômetro com voltas e
  intervalado (Tabata/HIIT). Descanso entre séries com contagem 3-2-1, alarme, vibração e
  notificação. O tempo é calculado pelo relógio, então continua certo se a tela apagar.
- **Chamada diária** (Perfil › Chamada pro treino): horário + botão "colocar no calendário do
  celular" (o mais garantido: avisa com o app fechado), notificação do app e, no Android com o
  app instalado, aviso em segundo plano.
- **Motivação**: frase do dia na tela inicial e "missão do dia" com o treino de hoje.
- **Dias da semana de treino**: chips em Perfil › Treino; o gerador liga cada ficha a um dia.
- **Peso & bioimpedância** (Perfil e Evolução): registro de pesagens ao longo do tempo, com
  gráfico de evolução (SVG puro). Peso é obrigatório; gordura corporal, massa muscular, água e
  gordura visceral são opcionais — só pra quem tem balança de bioimpedância. Cada pesagem nova
  atualiza o "peso atual" do perfil automaticamente (a mais recente por data, não por ordem de
  cadastro — registrar uma pesagem atrasada não sobrescreve o peso atual).
- **Foto de perfil**: uma foto só, editável a qualquer hora, em Perfil › Seus dados (círculo ao
  lado do nome). Puramente identificação — não entra no histórico de evolução.
- **Fotos de evolução (antes/depois)**: histórico de fotos em Perfil › Fotos de evolução. Ao
  escolher uma foto (galeria ou câmera), o app registra a **data de hoje automaticamente** — não
  tem campo de data pra editar, é sempre "agora". Com 2+ fotos, mostra a mais antiga e a mais
  recente lado a lado ("antes"/"atual"), mais uma tira com todas as fotos por baixo; tocar numa
  foto abre ela em tela cheia com opção de apagar. Toda foto (perfil e evolução) é redimensionada
  e recomprimida em JPEG no aparelho antes de salvar (maior lado ≤ 480px pra foto de perfil, ≤
  900px pra evolução) — sem isso a cota do localStorage estoura rápido com fotos de celular
  direto da câmera, que costumam vir na casa dos 3-5MB cada.

## O que ainda não existe

- **Vídeo não sincroniza pra nuvem** — só o `.zip` do backup manual leva vídeo (ver
  [ciclo 15](historico/15-nuvem-supabase.md)). Foto, perfil, fichas, histórico e peso sincronizam
  sozinhos; vídeo precisaria do Supabase Storage (bucket de arquivos), deixado pra depois.
- Tela dedicada pra comparar treino entre pessoas da família (hoje cada login só vê o próprio
  dado — é o esperado, mas nada mostra "como está indo todo mundo" pra quem administra).
- Gráfico de volume semanal (hoje a evolução mostra XP/nível, streak, heatmap de consistência,
  peso e histórico de sessões — falta só o gráfico de barras de volume)
