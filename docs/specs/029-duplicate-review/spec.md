# Revisão de possíveis duplicatas

Status: após avaliação e planejamento visual, o usuário autorizou revisar contra DESIGN.md e implementar. Integração local concluída e validada em 2026-10-30, sem deploy ou remoções no acervo real. A avaliação abaixo preserva o histórico; a interface aprovada está em `ux-review.md` e os resultados técnicos em `plan.md`.

## Problema e objetivo

A prevenção atual por SHA-256 reconhece arquivos com bytes idênticos. Cópias recomprimidas, redimensionadas ou com pequenas alterações podem ser salvas novamente. Encontrar essas candidatas e permitir comparação visual ajuda a reduzir redundância no acervo de referências.

## Experiência proposta

- Uma entrada discreta permite revisar possíveis duplicatas, sem interromper captura ou navegação.
- Apresentar as candidatas juntas, preservando proporções e permitindo ampliar cada imagem.
- Reunir candidatas em grupos para evitar repetir a mesma imagem em vários pares. O grupo organiza a revisão; não afirma que todos os membros sejam cópias entre si.
- O usuário pode manter todas ou escolher quais descartar explicitamente. Similaridade nunca constitui autorização de exclusão.
- Se apenas uma imagem for mantida, preservar nela a união das tags das imagens descartadas.
- Com várias mantidas, indicar uma delas para receber tags e links públicos das removidas; as outras mantidas conservam suas tags e publicações. Nenhuma tag é descartada silenciosamente.
- Absorver os links públicos na imagem mantida, preservando as URLs existentes. Não revogar links como efeito colateral da consolidação nem reativar links anteriormente revogados.
- Remover o limite de quantidade de tags por imagem, conforme autorizado pelo usuário, mantendo normalização, unicidade e validação de cada nome. A regra vale também nos demais fluxos de tags.
- Informar quando não houver candidatas e distinguir esse estado de análise pendente ou indisponível.
- Tratar resultados como sugestões: imagens diferentes de um mesmo personagem, assunto ou composição não são necessariamente duplicatas.
- Diferenças de expressão facial, direção do rosto ou posição de membros representam imagens distintas para esta revisão, mesmo quando o restante da composição é parecido.

## Primeira etapa

Preparar avaliação local de pares candidatos antes de integrar ações de descarte. Usar como referência a configuração real do Mordor; registrar modelo, processamento e distância empregados. Conferir cópias recomprimidas/redimensionadas, alterações pequenas e referências diferentes visualmente próximas. Produzir relatório privado com previews para julgamento, sem alterar originais ou metadados.

O valor observado no Immich serve como ponto de partida experimental; não presume qualidade equivalente com outro encoder. A escolha entre reaproveitar vetores e gerar novos depende de verificar a compatibilidade do modelo e do processamento.

## Limites

Somente imagens visíveis nesta primeira proposta. Sem exclusão automática, bloqueio de upload por similaridade, reorganização automática, substituição da busca por conteúdo ou do ranking de See similar. Sem implantação, alteração de versão, novo serviço permanente ou banco vetorial nesta etapa.

Na integração autorizada, links públicos são absorvidos mantendo suas URLs; a remoção é definitiva, com confirmação inline explícita e sem lixeira fictícia. Referências de aplicações não são migradas e mantêm a imagem protegida neste fluxo. A avaliação inicial não executou exclusões nem consolidações.

## Aceitação

- Relatório permite inspecionar pares candidatos e identificar falsos positivos; ausência de julgamento humano não conta como confirmação de qualidade.
- Cópias e imagens apenas relacionadas são avaliadas separadamente.
- Resultados não incluem ocultas e não dependem de tags para determinar similaridade.
- Registrar cobertura de imagens analisadas, falhas, custo e configuração, sem confundir falha de análise com ausência de duplicatas.
- Nenhuma alteração no acervo durante a avaliação; nenhuma promessa de equivalência ao Immich antes de comparação.

## Planejamento da interface

O usuário solicitou planejar a apresentação antes de implementar, incluindo sugestão de uma ou várias imagens a manter/remover e absorção de tags. Acrescentou que links públicos devem ser absorvidos e o limite de tags aumentado ou removido. A proposta em [ux-review.md](ux-review.md) foi aprovada pelo pedido de implementação: um grupo por vez, sugestões técnicas explicáveis, escolhas reversíveis antes da confirmação e destino explícito de tags e links. A implementação não autoriza executar descartes no acervo real sem a confirmação do usuário na interface.
