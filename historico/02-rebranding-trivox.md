# 2. Rebranding TRIVOX

**Data:** 16/08/2026

## Pedido

"Vamos chamá-lo de TRIVOX, inclusive aproveitar a logomarca. Leia a skill."

## O que foi feito

- Encontrada a skill do projeto em `SKILL/SKILL.md` — persona "Tech Lead" (guarda o escopo do
  MVP, questiona scope creep, exige ciclos fechados sem ponta solta). Passou a reger o trabalho
  neste repositório a partir daqui.
- Encontrada a logomarca em `APP DE TREINO/tryvox/TRIVOX/index e logo/` (`logo.png.png` — 1536×1024,
  wordmark com fundo transparente; `icon.png.png` — 1024×1024, ícone "T" metálico em fundo preto
  arredondado).

## Decisões

- **Ícones do PWA** regerados a partir do `icon.png.png` real (redimensionado via
  `System.Drawing`/PowerShell — ferramenta local, não é dependência do app), substituindo o
  placeholder gerado por código do ciclo 1.
- **Cor de destaque** extraída por amostragem de pixel do gradiente da própria logo (628 amostras
  sobre o wordmark, média `#6477C7`), ajustada pra `#4C5FBE` visando contraste de texto em botão.
- Marca aplicada em: `<title>`, `manifest.json`, tela de carregamento, cabeçalho da Início.
- Versão do cache do service worker renovada, pra instalações antigas não ficarem presas ao
  ícone genérico anterior.

## Entregue

Rebranding completo, 44/44 testes de tela mantidos após as mudanças.
