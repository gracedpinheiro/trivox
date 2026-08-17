# 16. O bug do login mágico (Supabase)

**Data:** 17/08/2026

## O sintoma

Depois de toda a configuração do [ciclo 15](15-nuvem-supabase.md) (SQL, URLs, SMTP), o login por
link mágico simplesmente não "pegava": clicar no link abria o app normalmente, sem erro nenhum,
mas o cartão "Backup na nuvem" continuava mostrando o formulário de e-mail, como se nada tivesse
acontecido. Fechar e abrir o app, recarregar, tentar em outro navegador — nada mudava.

## Investigação — três causas reais, só uma era a raiz

Esse ciclo teve várias pistas verdadeiras que pareciam ser a causa, mas eram só sintomas
adjacentes:

1. **SMTP do Gmail com senha errada** (`535 Username and Password not accepted`, visto direto
   no log de Auth do Supabase). Real, corrigido gerando uma nova senha de app. Sem isso o e-mail
   nem saía — mas depois de corrigido, o problema de login persistiu.
2. **Botão "Reenviar" quebrado** — tentava ler o e-mail de um campo (`#nuvem-email`) que não
   existe mais na tela depois do primeiro envio, falhando silenciosamente com "Digite um e-mail
   válido" sem nunca reenviar nada. Bug real, corrigido (o botão agora carrega o e-mail já
   conhecido consigo). Levantou a suspeita de que ela estivesse clicando em links antigos e já
   usados (esses expiram em um único clique) — plausível, mas não era o problema principal,
   porque o teste seguinte (link novo, um clique só, feito no computador) ainda falhou.
3. **A causa raiz de verdade**, achada com acesso ao DevTools do Chrome (ela testou num
   computador, não só no celular — isso foi decisivo): usando o Console, confirmamos passo a
   passo:
   - `localStorage` tinha a sessão salva (`sb-oreffivhrwprhwigmvxm-auth-token`), com o e-mail
     certo dentro.
   - `Nuvem.sessaoAtual()`, chamada manualmente no Console, achava essa sessão sem problema.
   - Mas `UI.estado.nuvem.sessao` — o que a tela de fato lê pra decidir o que mostrar — vinha
     `undefined`, não a sessão nem `null`.

   Isso isolou o bug num lugar bem específico: alguma coisa entre "a sessão existe e é
   encontrável" e "a tela sabe disso" estava quebrada.

## A causa raiz

Em `js/nuvem.js`:

```js
// ERRADO — so repassava 1 argumento
function aoMudarSessao(callback) {
  const c = cliente();
  if (!c) return;
  c.auth.onAuthStateChange((_evento, sessao) => callback(sessao));
}
```

O SDK do Supabase entrega dois argumentos pro callback de mudança de sessão: `(evento, sessao)`.
Mas essa função só repassava **um** (`callback(sessao)`). Em `app.js`, o callback registrado
esperava dois: `(_evento, sessao) => { ... sessaoNuvem = sessao; ... }`. Como só um argumento foi
passado, o JavaScript encaixou a sessão de verdade no lugar de `_evento`, e `sessao` (o segundo
parâmetro, o que o resto do código realmente usa) virava `undefined` — **toda vez** que o evento
disparava, incluindo logo na inicialização do cliente, que dispara pelo menos uma vez sempre.

Ou seja: a sessão era detectada corretamente (por isso `Nuvem.sessaoAtual()` funcionava sozinha),
mas segundos depois, esse listener disparava e **sobrescrevia** o valor certo por `undefined`,
silenciosamente, sem erro nenhum pra avisar.

Correção: uma linha.

```js
c.auth.onAuthStateChange((evento, sessao) => callback(evento, sessao));
```

## Por que foi tão difícil de achar

- O erro não lançava exceção — `undefined` é um valor JavaScript válido, só "errado" pro que o
  código esperava. Nada aparecia no console por causa disso especificamente.
- O sintoma ("mostra o formulário de novo") tinha três explicações plausíveis igualmente
  prováveis a priori (SMTP, link expirado, bug de renderização) — e duas delas *eram* reais
  problemas, só que secundários. Cada correção real (SMTP, Reenviar) trazia esperança de ter
  resolvido, mas o sintoma persistia porque a causa de fundo continuava lá.
- Só foi possível confirmar com certeza usando o Console do navegador pra inspecionar o estado
  interno do app diretamente (`localStorage`, `Nuvem.sessaoAtual()`, `UI.estado.nuvem`) — sem
  isso, teria continuado sendo adivinhação. O teste ter migrado do celular pro computador (onde
  DevTools é acessível) foi o que destravou a investigação.

## Entregue

- `js/nuvem.js` — `aoMudarSessao` repassa `(evento, sessao)` corretamente.
- `js/app.js` — removido o retry manual e os alertas de diagnóstico temporário (não são mais
  necessários com o bug real corrigido).
- `js/ui.js` / `js/app.js` — corrigido também o bug do botão "Reenviar" (`data-email` no botão
  em vez de depender de um campo que não existe mais naquele estado da tela).
- `sw.js` → trivox-v19.

## Lição pra próxima vez

Quando uma função "repassa" argumentos de um callback pra outro, contar os parênteses não basta
— vale conferir a **aridade** (quantos argumentos) bate dos dois lados. `callback(sessao)` e
`(callback) => (_evento, sessao) => {...}` pareciam compatíveis de relance; só ficou óbvio o
descompasso ao escrever a assinatura completa lado a lado.
