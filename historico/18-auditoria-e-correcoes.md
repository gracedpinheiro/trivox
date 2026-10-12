# 18 — Auditoria completa e primeiras correções

**Data:** 12/10/2026

## O que foi pedido
Auditoria de ponta a ponta do app em produção, com especialistas de treino (personal, medicina
esportiva, nutrição) e de sistemas, contra os 13 requisitos do app. Primeiro relatório, depois
correção com OK da Grace. Relatório completo: [RELATORIO-TESTES.md](../RELATORIO-TESTES.md).

## O que foi feito (ciclos 1 a 4 do plano do relatório)
- **Segurança da saúde**
  - O coach ganhou o tema "Sinal de alerta", testado **antes** dos outros. Dor no peito,
    tontura, falta de ar, pressão alta e dor articular respondem "pare e procure atendimento".
    Antes caíam em "precisa de um treino feito".
  - 21 exercícios com fase de voo ou sprint passaram de impacto "médio" para "alto": corda,
    polichinelos, line hops, skipping, flexão pliométrica e sprints. Assim deixam de chegar a
    quem tem 50-64 anos ou IMC ≥ 30. A correção também foi para o
    `enriquecer_exercicios.py` (`IMPACTO_ALTO_REVISAO`), para não se perder numa regeneração.
  - Aquecimento:
    - nada de "Air Bike só com os braços" em dia de perna;
    - impacto baixo para quem tem restrição;
    - polichinelo, skipping e escada de agilidade saíram do "cardio leve".
  - 65+: item no chão fica **fora** do aquecimento e do alongamento (antes só perdia pontos). O
    aviso `chao_65` do teste do gerador zerou: eram 321 casos.
  - 65+ recebia argolas, porque o código excluía `'aneis'` e a chave na base é `'argolas'`.
  - Raquete: as vagas de prevenção (antebraço, panturrilha, manguito) não saem mais no corte do
    iniciante. Sai um isolado, o 3º composto ou a potência.
  - "Levantamento Romeno" passa a ser levantamento de quadril, e não agachamento. "Tuck Crunch"
    e "Skater Squat" não são mais tratados como pliometria.
- **Não perder dado**
  - Digitar campo a campo no Perfil e na ficha não perde mais o que foi digitado. O `change`
    redesenhava a tela antes de o foco chegar no próximo campo. Agora o redesenho é adiado e
    devolve o foco e o cursor.
  - Treino em andamento:
    - fica gravado no aparelho, sem ir para a nuvem nem para o backup;
    - ganha um cartão "Continuar treino" no Início e em Treinos;
    - sobrevive a recarregar a página;
    - "Treinar" na mesma ficha continua do ponto onde parou.
  - Armazenamento cheio: o treino **não** aparece como "concluído" sem ter gravado. Ele continua
    aberto, com um aviso. O alerta de cota aparece no máximo 1 vez por minuto, e não a cada tecla.
  - "Aparelho ocupado" mantém as séries já feitas: o substituto entra como item novo.
- **Nuvem**
  - O login pelo link do e-mail compara e restaura os dados. Antes, a sessão já existia quando
    o app abria, nada era restaurado e a primeira ficha criada sobrescrevia a nuvem.
  - Sair e entrar com outra conta compara de novo.
  - Não há mais TypeError ao sair durante a espera de envio.
  - Envio que falha fica pendente e é reenviado quando a internet volta ou quando o app vai
    para segundo plano. A fila é enviada na hora quando o app é minimizado.
- **Trocas respeitam o perfil**
  - "Aparelho ocupado", "Variar treino" e a lista de alternativas do exercício usam o mesmo
    filtro do gerador (`Forca.filtroPerfil`): local, equipamento de casa, impacto e risco por
    idade e IMC, aparelhos vetados e nível.
  - Os músculos são comparados por grupo (a base tem 136 grafias), então nenhum exercício fica
    mais sem substituto. Eram 14, e 19 de casa sem substituto de casa.
  - `UI.perfilTreino()` é o único lugar que traduz o perfil para o motor:
    - `forca`/`resistencia`/`emagrecimento` viram os objetivos novos (e são migrados no perfil
      ao abrir, importar ou restaurar);
    - `elite` vale como avançado;
    - `parque` continua parque, em vez de virar academia.
  - A ficha manual passa peso e altura, então o IMC alto também vale no aquecimento.
- **Correções de uma linha:** Spotify não fica mais em "Carregando…" ao voltar de "Como
  executar"; `.ics` com UID fixo (não duplica o evento) e DTSTAMP em UTC; pré-cache do service
  worker sem o cache HTTP (`trivox-v31`); o `--dry` do script Python funciona no Windows.

## Testes que fecharam o ciclo
- `teste_gerador.js` OK, sem nenhum aviso; `teste_figuras.js` OK.
- Scripts em `..\trivox-testes`, fora do repositório:
  - `ciclo2.js`: foco, treino em andamento, recarregar, troca e cota cheia;
  - `ciclo3.js`: nuvem com SDK falso;
  - `ciclo4.js` e `ciclo4-ui.js`: trocas, perfil antigo e coach;
  - `teste_taxas.js`: salto em 58 anos de 23% → 3%, IMC 33 de 33% → 4%, chão em 68 anos de 14% → 0%;
  - f4, f6 e f7 sem nenhum erro de console.

## O que ficou para os próximos ciclos (ver plano no relatório)
- 5: fotos no IndexedDB.
- 6: contraste e teclado.
- 7: ilustrações erradas.
- 8: triagem PAR-Q e aeróbico 50+, que **precisa de decisão de escopo**.
- 9: acabamento (heatmap, aeróbico contando como treino, XSS em dados importados etc.).
