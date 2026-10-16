# 24 — "Última vez" por exercício e apagar treinos de teste

**Data:** 16/10/2026

## O que foi pedido
1. Saber, em cada exercício, quantas séries, quantas repetições e qual peso foram usados da
   última vez.
2. Apagar os treinos feitos durante os testes sem precisar começar um perfil novo.
3. Trocar os nomes das calculadoras "1RM" e "Anilhas", que não diziam para que serviam.

## O que foi feito
- **"Última vez" mais legível** (`resumoSeries` no `ui.js`):
  - séries iguais: "3 séries de 8 reps com 40 kg";
  - séries diferentes: "3 séries: 40 kg × 8, 40 kg × 8, 37,5 kg × 7";
  - peso com vírgula.
- **Onde aparece:**
  - **No treino:** dentro do cartão da série, logo acima dos campos de carga e repetições.
    Antes ficava abaixo das dicas. O "Concluir série" continua visível sem rolar a 360x740.
  - **Na tela do exercício:** abaixo das imagens.
  - **Em Evolução:** cartão novo, "Última vez em cada exercício", logo abaixo do nível.
    - Lista cada exercício já feito, uma vez só, do mais recente para o mais antigo.
    - Os 8 primeiros ficam à vista; o resto fica em "Ver todos".
    - Tocar num exercício abre a tela dele.
  - **Na edição da ficha:** continua como antes.
- **Apagar um treino:** no Histórico de Evolução, abra o treino e toque em "Apagar este
  treino".
  - Saem a sessão, as cargas registradas nela e o XP que ela deu (`Dados.apagarSessao`).
  - As conquistas ficam.
- **Apagar todos os treinos feitos:** cartão novo no Perfil, acima de "Começar do zero"
  (`Dados.apagarHistoricoTreinos`).
  - Saem as sessões, as cargas, o XP e as conquistas.
  - Ficam o perfil, as fichas, as pesagens e as fotos.
- **Na nuvem:** apagar aqui também apaga lá. A sincronização sobe cada parte dos dados
  inteira, então o treino apagado não volta.
- **Calculadoras:** "1RM" virou "Carga máxima" e "Anilhas" virou "Montar a barra". O modal de
  montar a barra ganhou uma frase explicando o que ele faz.
- **Acabamento do ciclo 23:**
  - os ícones do Histórico viraram ícones de traço;
  - o botão verde "Iniciar" do aquecimento ficou num tom claro, para não competir com o botão
    principal.

## Testes
- `..\trivox-testes\ciclo-ultima-vez.js`, teste novo:
  - os textos de "última vez" no cartão de Evolução e no detalhe do exercício;
  - os nomes novos das calculadoras;
  - apagar 1 treino: só as cargas dele saem e o XP volta de 110 para 50;
  - apagar todos: perfil e ficha ficam;
  - nenhum erro na página.
- Seguem passando:
  - `teste_gerador`, `teste_figuras`, `teste_mapa_muscular`, `teste_fichas` e
    `teste_app_fluxos`;
  - `layout-a11y` (0 estouros), `ilus-check`, `ciclo-feedback2`, `ciclo-zerar`,
    `ciclo-objetivos`, `ciclo2`, `ciclo89`, `f4`, `f6` e `f7`.
