# 17 — Visual alegre, base ampliada e imagem em todo exercício

**Data:** 11–12/10/2026

## O que foi pedido
- Muito mais variação de exercícios, em casa e na academia, pra sempre ter outro aparelho pro
  mesmo músculo e pra trocar a ficha sem cair na rotina.
- Níveis iniciante/intermediário/avançado; objetivos condicionamento, perda de peso,
  hipertrofia, 50+ e raquete (pickleball e beach tennis); homem/mulher, idade e peso.
- Evolução, registro de séries e pesos do último dia, chamada diária, motivação, cronômetro com
  alarme, Spotify.
- **O mais importante:** imagem mostrando a região trabalhada, como fazer e o aparelho, e a foto
  do próprio usuário. Todo exercício com imagem.
- Aquecimento no início e alongamento no fim, de acordo com o grupo muscular do dia.
- Cores: nada escuro — tudo alegre e divertido.
- Tirar o "conselho" (skill LLM Council e o relatório) do projeto.

## O que foi feito
- **Conselho removido**: `SKILL.MD` e `conselho_relatorio.html` apagados.
- **Base**: 563 → 1535 exercícios, escritos por agentes especialistas em paralelo, um por grupo
  muscular, em arquivos de texto revisáveis (`ferramentas/novos_exercicios/`). Campos novos em
  todos: local, objetivos, impacto, aparelho. 106 fichas antigas genéricas reescritas.
- **Imagens**: 689 com foto real (eram 22) — casamento feito por julgamento, não por nome;
  ilustração animada pra todos os 1535 (`js/figuras.js`); mapa muscular frente/costas
  (`js/mapa-muscular.js`); desenho de cada aparelho. A geração de imagem por IA (Algro) estava
  indisponível (assinatura pausada), por isso ilustração vetorial.
- **Gerador** reescrito (`js/programas.js` + `js/forca.js`): 5 objetivos × 3 níveis, casa com
  equipamento marcado, ajustes por idade/sexo/IMC, dias de jogo pra raquete, blocos
  aquecimento → principal → equilíbrio → circuito → alongamento, variedade entre fichas e a cada
  "gerar de novo". Teste: 3600 planos sem violar nenhuma regra.
- **Aquecimento e alongamento por grupo do dia**, também pras fichas manuais (`completarSessao`).
- **Execução**: último treino do exercício, itens por tempo com contagem, pular exercício,
  12 alternativas quando o aparelho está ocupado.
- **Cronômetro com alarme** (timer, cronômetro, intervalado) e descanso com 3-2-1 + alarme +
  vibração + notificação; tempo calculado pelo relógio.
- **Chamada diária**: calendário (.ics), notificação do app, periodic sync no Android.
- **Motivação**: frase do dia por contexto e "missão do dia" na tela inicial.
- **Visual** novo claro e colorido, fontes próprias (offline), ícone novo.

## O que ficou de fora / limites
- Notificação com hora exata e app fechado no iPhone não existe pra PWA sem servidor de push —
  por isso o lembrete pelo calendário é o recomendado.
- Ilustrações são vetoriais (boneco articulado), não fotos; variações finas de pegada usam o mesmo
  desenho.
- Supabase: nenhuma mudança de banco necessária — os campos novos do perfil vão dentro do mesmo
  JSON da loja `perfil`.
