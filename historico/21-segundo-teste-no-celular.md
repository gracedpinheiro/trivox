# 21 — Segundo teste no celular

**Data:** 12/10/2026

## O que a Grace encontrou e o que foi feito
- **"Sentimos sua falta, 40 dias… que tal 15 minutos?" e uma janela nova ao abrir pelo calendário.**
  - **Causa:** no iPhone o link do evento abre o **Safari**, que guarda dados separados do app
    instalado. No Safari havia dados velhos de um teste de cerca de 40 dias atrás.
  - O `.ics` não tem mais link; a descrição pede para abrir pelo ícone.
  - Quem abre pelo Safari no iPhone vê um aviso explicando isso.
  - A frase de volta não fala mais em "15 minutos".
- **Minha foto durante o treino:** botão "📷 Tirar minha foto neste aparelho" na execução.
- **Spotify ao pular música:** "JSON Parse error". O Spotify passou a responder 200 com um id
  em texto puro; agora isso é aceito como sucesso.
- **Reinstalou e voltou vazio:** apagar o app apaga os dados do aparelho, porque isso é do
  sistema. Com o app vazio, o Início mostra "Já usava o TRIVOX?", com "Entrar na nuvem" e
  "Importar backup".
- **Coach respondia fora do assunto:**
  - Mais palavras de nutrição (tomar, suplemento, creatina, antes/depois do treino…).
  - Dentro do tema, a frase escolhida é a que mais combina com as palavras da pergunta.
  - 3 frases novas: antes do treino, depois do treino e suplementos.
- **Botões do coach encavalados:** viraram uma grade de 2 colunas, com o texto quebrando direito.
- **"RIR" virou "de sobra":** "parar com 2 de sobra", e o campo explica o que é.
- **Fotos no modo avião:**
  - as fotos dos exercícios das fichas ficam guardadas sozinhas (ao abrir e ao gerar o treino);
  - no Perfil há "Baixar todas as fotos" (1066 fotos, cerca de 40 MB, uma vez com Wi-Fi).
- **Boneco:** um boneco único e sem gênero para todo mundo (decisão da Grace), e um pouco
  maior na tela.
- **Tocar na imagem amplia** (foto, como fazer, músculos, aparelho).
- **"Começar do zero"** (Perfil): apaga tudo do aparelho e as linhas da própria conta na nuvem
  (a RLS só permite as próprias), com dupla confirmação. Os backups de teste do computador foram
  apagados.

## Em aberto (precisa de decisão)
- **Qualidade das ilustrações:** em alguns exercícios o boneco vetorial não ensina bem. Para
  melhorar de verdade, é preciso arte nova, por exemplo ilustrações geradas por IA num estilo
  único para os ~360 movimentos, revisadas uma a uma. É um projeto à parte.
- **Foto real do aparelho, sem pessoas:**
  - hoje a aba "Aparelho" é um desenho, e as "Fotos" (free-exercise-db) mostram pessoas
    executando;
  - fotos livres de cada um dos ~60 aparelhos, sem ninguém, precisam ser buscadas e licenciadas
    (Wikimedia/Unsplash) ou fotografadas na academia.

## Testes
- `teste_gerador.js` e `teste_figuras.js` OK.
- Em `..\trivox-testes`, sem erro de console:
  - `ciclo-feedback2.js`: card de recuperar, coach, Spotify em texto, foto na execução, "de
    sobra", 1066 fotos no cache, `.ics` sem link;
  - `ciclo-zerar.js`: ampliar e começar do zero com SDK falso;
  - `ciclo-objetivos`, `ciclo2`, `ciclo89`, `f4`, `f6`, `f7` e `layout-a11y`.
