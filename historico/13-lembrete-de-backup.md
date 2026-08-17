# 13. Lembrete de backup (depois de perda de dados real no iPhone)

**Data:** 17/08/2026

## O que aconteceu

> "eu preenchi todo meu cadastro, fiz meus primeiros treinos e sai do aplicativo no celular,
> depois quando entrei novamente, tudo tinha sumido como se fosse a primeira vez, tendo que
> preencher os dados novamente"

Perda de dados real, não hipotética — no dia seguinte ao [relatório do Conselho de IA](../conselho_relatorio.html)
ter apontado esse exato risco como o maior do projeto.

## Diagnóstico

Perguntei o essencial antes de sair mexendo no código: mesmo ícone da tela de início nas duas
vezes (não é confusão entre o link local de desenvolvimento e o hospedado), iPhone, poucas horas
entre uma abertura e outra — não uma semana. Isso descarta duas hipóteses técnicas que eu
levantei primeiro:
- **Origem diferente** (ex.: ela ter usado `http://127.0.0.1:8080` numa sessão e o link do GitHub
  Pages noutra — cada origem tem armazenamento próprio, sem relação) — descartado, mesmo ícone.
- **Purga de 7 dias do Safari** (ITP limpa `localStorage` de site não visitado há 7+ dias, mesmo
  instalado na tela de início) — descartado, foram poucas horas.

Conferi o código: não existe nenhum `localStorage.clear()`, `indexedDB.deleteDatabase()` nem
troca de nome de chave em lugar nenhum do projeto — não é bug de lógica nossa.

Sobrou a explicação mais provável e menos controlável: no iPhone, dado de site "salvo na tela de
início" ainda usa o mesmo armazenamento do WebKit/Safari por baixo — não é tão protegido quanto
um app nativo de verdade — e o sistema pode limpar isso sozinho sob pressão de espaço, mudança de
configuração de privacidade, ou política própria do iOS, sem aviso nenhum pro usuário. Ironia
pontual: os recursos mais recentes (foto de perfil, fotos de evolução, foto/vídeo por exercício)
aumentaram exatamente o tipo de ocupação de espaço que torna essa limpeza mais provável.

## Decisão: não dá pra eliminar o risco, dá pra mitigar e forçar o hábito de backup

Duas camadas, nenhuma sozinha resolve 100%:

1. **`navigator.storage.persist()`** no boot do app — pede ao navegador pra marcar a origem como
   "importante", reduzindo a chance de limpeza automática. Efeito parcial e não garantido,
   principalmente no Safari/iOS (é mais efetivo no Android/Chrome). Mesmo assim, custo zero de
   implementar, então entra como camada extra.

2. **Lembrete de backup na tela inicial** — a defesa que funciona de verdade, porque gera uma
   cópia fora do navegador. Novo store `backupMeta` (`dados.js`) guarda quando foi o último
   export/import bem-sucedido. Se nunca fez backup, ou já fazem 7+ dias, a tela inicial mostra um
   aviso com botão direto pra exportar — só aparece se já existe algo real pra perder (nome
   preenchido, ficha criada, ou sessão registrada), pra não incomodar no primeiro uso vazio.

## Por que 7 dias, e por que não interromper com um modal obrigatório

7 dias é arbitrário mas razoável: frequência de quem treina algumas vezes por semana, sem virar
alarme diário. Optei pelo aviso na tela inicial (visível, mas dispensável) em vez de um modal
bloqueante porque o objetivo é criar hábito, não fricção — um modal que interrompe toda vez que
abre o app é o tipo de coisa que faz gente desistir de um app (ela já tem 9 anteriores
abandonados).

## Entregue

- `js/dados.js` — `backupMeta`/`registrarBackupFeito()`.
- `js/ui.js` — aviso condicional no topo da tela inicial, com botão "Exportar agora".
- `js/app.js` — `navigator.storage.persist()` no boot; `exportar`/`importar` chamam
  `registrarBackupFeito()` ao concluir (importar também conta — prova que existe cópia por fora).
- `sw.js` → trivox-v11.
- README: nova seção `⚠️ Seus dados podem sumir sozinhos — faça backup`, logo depois da seção de
  hospedagem, documentando o caso real e as duas defesas.
- Testado: 23/23 (inclui `backupMeta`/`registrarBackupFeito`).

## O que isso não resolve

Se os dados já sumiram antes desse ciclo existir, não tem recuperação — não existia backup pra
restaurar. A partir de agora, com o lembrete ativo, o cenário de "preencher tudo de novo do zero"
só deve se repetir se ela ignorar o aviso por muito tempo seguido.
