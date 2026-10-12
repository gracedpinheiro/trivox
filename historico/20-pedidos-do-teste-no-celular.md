# 20 — Pedidos do teste no celular

**Data:** 12/10/2026

## O que foi pedido (teste da Grace no iPhone)
Os itens 1 a 3 e 5 a 7 do roteiro passaram. No item 4 (alarme com a tela bloqueada) o som não
toca. Pedidos novos:
- poder escolher mais de um tipo de treino (raquete + hipertrofia, 50+ + condicionamento...);
- escolher os dois esportes ou só um, e conseguir desmarcar (antes, depois de escolher não dava);
- alterar qualquer dado do perfil a qualquer momento;
- trocar a chamada pro treino e ter dois horários no mesmo dia;
- "Concluir série" mais para cima, sem precisar rolar.

## O que foi decidido e feito
- **Vários objetivos** (`perfil.objetivos`; `perfil.objetivo` continua sendo o principal, para
  todo o resto do app não mudar):
  - **Até 2 objetivos de treino.** Os dias da semana se dividem entre eles, alternando
    (`Forca.gerarPrograma` recebe `objetivos`). Com raquete, dia de jogo e véspera ficam sempre
    com a raquete, que vira ativação leve. Assim não cai perna pesada da hipertrofia antes do
    jogo.
  - **"Especial 50+"** soma com qualquer um sem dividir a semana. É uma camada de segurança
    (`mais50` em `ajustesPerfil`): o programa é o do outro objetivo com as regras do 50+.
  - Tocar marca e desmarca. Um 3º objetivo de treino troca o 2º, e sempre sobra pelo menos 1.
  - Cada ficha guarda o próprio objetivo; o aquecimento e o alongamento seguem o dela.
- **Esportes**: `perfil.esportes` (lista). Um, os dois ou nenhum, sempre desmarcável.
- **Lembrete**: `perfil.lembreteHoras` (até 2):
  - a página, o service worker e o `.ics` (um evento por horário, com UID fixo) avisam cada
    horário 1x por dia;
  - horários editáveis a qualquer hora.
- **Execução**: o cartão com nome, campos e "Concluir série" (ou "Feito") fica logo abaixo do
  topo. "Última vez", dicas e imagens vêm depois. Medido em 390x844: o botão fica visível sem
  rolar.
- **Alarme com o iPhone bloqueado**: é limite do iOS. Com a tela bloqueada, ele congela o app
  instalado e nenhum código roda até a pessoa voltar. O que existe:
  - a tela não apaga sozinha durante o treino e, agora, também com o cronômetro rodando
    (Wake Lock);
  - o lembrete diário vai pelo calendário (`.ics`), que toca com o app fechado.
  - Para tocar com a tela bloqueada de verdade, seria preciso notificação push vinda de um
    servidor. Fica como ideia futura.

## Testes
- `ferramentas/teste_gerador.js` OK (o combinador mantém a variante "forca" dos perfis antigos).
- `..\trivox-testes\ciclo-objetivos.js`:
  - objetivos marcar/desmarcar/trocar;
  - esportes os dois/nenhum;
  - 2 horários, `.ics` com 2 eventos e o service worker com os 2;
  - gerador raquete + hipertrofia + 50+;
  - "Concluir série" e "Feito" sem rolar.
- Regressão: `ciclo2`, `ciclo4-ui`, `ciclo5`, `ciclo89`, `f4` a `f7` e `layout-a11y`, sem erro.
