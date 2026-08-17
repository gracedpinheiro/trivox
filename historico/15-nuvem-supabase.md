# 15. Backup automático na nuvem (Supabase)

**Data:** 17/08/2026

## Pedido

> "se usássemos o flutter ou supabase e cloudflare, seria mais seguro e mais fácil para não ter
> que ficar logando?"

Pergunta direta consequência do [ciclo 13](13-lembrete-de-backup.md) (perda de dados real no
iPhone). Depois de explicar as opções, ela confirmou Supabase — e emendou um requisito
importante: **"poderei logar com três contas diferentes? três celular, meu, minha filha e meu
filho"**.

## As três opções, e por que Supabase

- **Cloudflare sozinho**: não resolve nada aqui — só seria hospedagem, papel que o GitHub Pages
  já cumpre de graça.
- **Flutter (app nativo)**: resolveria a causa raiz (armazenamento protegido pelo SO, não
  "dado de site"), mas custo desproporcional — reescrever ~4.800 linhas, toolchain nativo, conta
  de desenvolvedor Apple paga, revisão de loja a cada atualização. Descartado por ora.
- **Supabase**: ataca a causa raiz (dado mora num banco, não só no aparelho) com custo pequeno
  — só exige algum tipo de login pra saber de quem é o dado.

## O trade-off do login, resolvido

A pergunta ("...para não ter que ficar logando?") tinha uma tensão real: nuvem de verdade exige
alguma forma de login, não tem como ter as duas coisas. Resolvido com **link mágico por e-mail**
(sem senha) — login **uma vez só**; depois disso a sessão persiste sozinha. Não é "ficar
logando", é logar uma vez.

## Multiusuário: a estrutura já estava pronta pra isso

Boa notícia confirmada nesse ciclo: `perfilId` já isolava dados localmente desde o
[ciclo 1](01-fundacao-do-projeto.md) ("preparado pra crescer"). No Supabase, isolar por pessoa é
ainda mais direto — cada `user_id` (da própria autenticação) já separa os dados via RLS, imposto
pelo banco, não pelo app. Diferença importante em relação ao Spotify: lá, cada pessoa precisa
criar o **próprio app** no painel do Spotify (por causa do limite de 25 contas em modo
Development). Aqui, só Grace cria o projeto Supabase (a infraestrutura); a filha e o filho só
entram com o próprio e-mail — nenhuma conta Supabase própria necessária.

## Decisão técnica: usar o SDK oficial, não reimplementar na mão

Todo o resto do projeto evita dependência externa (Spotify incluso: 3 endpoints bem
documentados, seguro reimplementar via `fetch` puro). Cheguei a desenhar a integração do
Supabase do mesmo jeito, mas ao tentar confirmar o formato exato dos endpoints REST de
autenticação (envio de link mágico, renovação de sessão), a documentação pública é
SDK-primeiro — os detalhes internos do protocolo HTTP não são garantidos nem bem documentados
pra uso direto. Reimplementar às cegas uma peça cujo *propósito inteiro* é ser a rede de
segurança contra perda de dados seria arriscar exatamente o que estamos tentando evitar.

**Decisão:** usar `@supabase/supabase-js` oficial, carregado via CDN (jsdelivr) e cacheado pelo
`sw.js` pra continuar funcionando offline depois do primeiro carregamento — única exceção
"sem dependência" do projeto inteiro, deliberada e documentada. Verifiquei antes de usar: o
arquivo UMD existe (`dist/umd/supabase.js`, ~207KB) e expõe `window.supabase.createClient(...)`
— conferido direto no arquivo real, não por lembrança.

## Um problema descoberto a tempo: limite de e-mail do Supabase

Ao pesquisar antes de implementar, achei que o servidor de e-mail padrão/compartilhado do
Supabase manda só **2 e-mails por hora** — inviável pra 3 pessoas testando no mesmo dia, e a
própria documentação diz que não é pra uso real. Sem SMTP próprio, ela e os filhos passariam
raiva tentando logar e não recebendo o link.

Sem domínio próprio (usa `github.io` e `supabase.co`, não dá pra verificar domínio em serviços
tipo Resend/SES sem DNS próprio), a solução mais simples e gratuita foi **SMTP do Gmail** — usa
o e-mail que ela já tem, com uma App Password (não precisa ativar nada pago nem configurar DNS).
Documentado passo a passo no README.

## Modelo de dados

Uma tabela só, `dados_usuario`, espelhando 1:1 as mesmas "lojas" que já existem no
`localStorage` (`perfil`, `fichas`, `sessoes`...) — `{ user_id, loja, valor jsonb,
atualizado_em }`, chave primária composta, RLS restringindo cada operação a `auth.uid() =
user_id`. Reaproveitei a MESMA lista de lojas (`Dados.LOJAS_SINCRONIZAVEIS`) que já existia pro
backup `.zip` — antes cada mecanismo tinha sua própria lista hardcoded (risco de uma desatualizar
sem a outra); agora as duas leem da mesma fonte.

**Vídeo ficou de fora deste ciclo**, deliberadamente — pesa MB, precisaria do Supabase Storage
(bucket de arquivo, não uma tabela), e o objetivo aqui era cobrir o cenário que realmente
aconteceu (perfil, fichas e fotos, não vídeo). Continua coberto pelo backup `.zip` manual.

## Como a sincronização funciona

- `dados.js` ganhou um hook (`aoSalvar`) que avisa sempre que qualquer "loja" é gravada — sem
  saber nada de rede, só anuncia. `app.js` se inscreve nesse hook e enfileira um envio pra nuvem
  (com debounce de 2,5s por loja, pra não martelar a rede a cada tecla digitada).
- No login (detectado por transição null→sessão, não a cada abertura do app — evita perguntar
  toda vez): compara o que existe na nuvem com o que existe localmente.
  - Nuvem tem dado, local vazio → restaura da nuvem sozinho, sem perguntar (é exatamente o
    cenário do [ciclo 13](13-lembrete-de-backup.md)).
  - Os dois têm dado → pergunta qual usar (não decide por conta própria com risco de apagar
    algo).
  - Só local tem dado → sobe pra nuvem, semeando a conta.
- Login/sincronização também conta como "existe cópia por fora" pro lembrete de backup do
  [ciclo 13](13-lembrete-de-backup.md) — os dois mecanismos compartilham o mesmo sinal.

## Entregue

- `js/nuvem.js` (novo) — wrapper fino sobre o SDK do Supabase: login por link mágico, sessão,
  logout, `enviarDado`/`buscarTudo` (uma linha por loja).
- `js/dados.js` — `aoSalvar` (hook), `lerLoja`/`gravarLoja` (acesso genérico por nome),
  `LOJAS_SINCRONIZAVEIS` (fonte única, reaproveitada por `exportar()`).
- `js/app.js` — sessão carregada antes do 1º render (evita "piscar"); fila de envio com
  debounce; decisão nuvem-vs-local no login; handlers de login/logout.
- `js/ui.js` — card "☁️ Backup na nuvem" em Perfil (login/aguardando e-mail/conectado).
- `index.html`/`sw.js` — SDK do Supabase via CDN, cacheado offline; `sw.js` → trivox-v14.
- `README.md` — seção de setup completa (SQL, URL config, SMTP do Gmail) pra continuidade futura.
- Testado: 29/29 no total do projeto (7 novos: hook `aoSalvar` dispara nas lojas certas,
  `lerLoja`/`gravarLoja` fazem round-trip correto, `LOJAS_SINCRONIZAVEIS` inclui as lojas de
  treino e exclui `spotify`, `exportar()` cobre exatamente a lista canônica). Confirmado também,
  fora do código: projeto Supabase respondendo de verdade (chave anônima válida, servidor de
  autenticação saudável) antes de considerar o ciclo pronto.
