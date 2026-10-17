# Feature: galeria por similaridade visual

Status: V1 implementada após aprovação dos resultados da segunda rodada pelo usuário. Método selecionado: combinação com 65% paleta, 20% embedding médio da imagem inteira e 15% distribuição espacial de cores. Navegação em [discovery.md](discovery.md); implementação e validação em [plan.md](plan.md).

## Problema e objetivo

Tags são pistas pessoais úteis, mas não conectam todas as imagens que se parecem. O usuário precisa partir de uma referência salva e descobrir outras imagens visualmente próximas, inclusive sem tags compartilhadas.

Oferecer exploração visual contínua e simples, preservando a biblioteca como ferramenta de curadoria pessoal. Cor, composição e objetos são dimensões a avaliar; a primeira entrega não promete equivalência de pose, reconhecimento de identidade ou precisão para cada dimensão.

A preferência inicial por paleta motivou uma segunda rodada, cujos resultados o usuário aprovou para V1. Adotar a combinação selecionada no relatório: 65% paleta, 20% embedding médio da imagem inteira e 15% distribuição espacial de cores. A análise considera a imagem inteira ajustada a quadrado, conforme a variante avaliada; pode distorcer proporções. Cor é o sinal predominante e pode conectar assuntos diferentes. Reconhecimento de objetos, posição ou pose exata não são promessas desta entrega.

## Fluxo proposto

1. Abrir uma imagem visível no visualizador existente e escolher “Ver similares”. A ação não deve descartar uma edição de tags em andamento.
2. Abrir uma galeria de similares com pequena referência visual à imagem de origem e retorno explícito ao contexto anterior. Busca e filtros anteriores permanecem guardados, sem restringir silenciosamente os similares.
3. Exibir primeiro os resultados mais próximos e acrescentar os seguintes durante a rolagem, com carregamento limitado e fim explícito quando não houver mais resultados.
4. Abrir um resultado no visualizador existente. Fechar recupera a mesma galeria, referência, posição e foco.
5. Abrir resultados ou usar setas não muda a referência. Escolher “Ver similares” em outra imagem abre uma nova galeria baseada nela.
6. Voltar permite recuperar a galeria anterior. O fluxo não deve exigir desfazer cada imagem examinada para sair de uma galeria.

## Escopo e regras

- A referência é uma imagem já salva e visível. Imagens ocultas ficam fora desta descoberta, inclusive como referência em endereços antigos. Sua recuperação continua no fluxo explícito da Library.
- Considerar candidatos do acervo visível completo, independentemente de busca, assunto e tags da origem.
- Excluir a própria referência e cartões duplicados. Não usar tags ou nomes como requisito para participar.
- Apresentar um único ranking inicial. Não exigir que o usuário selecione cor, objeto, modelo ou pesos.
- Identificar o contexto como “Similar images”, acompanhando o idioma atual da interface, com referência visível e indicação discreta de aparência e cores. Não expor nomes de modelos, pesos ou seletor de métodos no produto.
- Manter ordem estável durante o carregamento de uma galeria, sem saltos ou repetições entre lotes. Novas imagens ou processamento adicional podem aparecer ao atualizar/reabrir, sem reordenar silenciosamente o que já foi visto.
- Uma biblioteca finita não deve se tornar um feed infinito artificial. Não completar resultados indisponíveis com imagens aleatórias ou relacionadas por tags sob o rótulo de similares.
- As conexões existentes por tags continuam identificadas como tais. Similaridade visual não gera nem altera tags, coleções, visibilidade ou arquivos originais.
- O preparo para similaridade não deve atrasar a confirmação de um upload ou bloquear a navegação habitual. Imagens novas podem ficar disponíveis para similaridade posteriormente.
- A galeria de similares não herda tags para uploads a partir da referência ou dos resultados. Captura continua usando somente o contexto explícito definido em 018.

## Navegação e alterações do acervo

- Identificar a referência no endereço da galeria. Reload e entrada direta recuperam essa referência; endereço com visualizador também identifica a imagem examinada.
- Abrir o visualizador cria uma camada sobre a galeria; Voltar nativo fecha essa camada primeiro. Setas e relacionadas mantêm a regra de uma única entrada do visualizador definida em 013.
- “Ver similares” em uma imagem diferente cria um novo destino de galeria. O retorno recupera o contexto anterior conhecido, inclusive a imagem aberta de onde se partiu. Não confundir isso com o Back temporário de conexões dentro do visualizador.
- Setas seguem os resultados da galeria de similares já disponíveis; não mudam a referência nem saltam para ordem cronológica. Uma imagem alcançada fora desses resultados por conexões de tags mantém as regras de 010.
- Entrada direta sem contexto anterior oferece retorno seguro à Library; não tenta reconstruir um percurso desconhecido.
- Se referência for excluída ou ocultada, apresentar indisponibilidade e saída válida; não escolher outra automaticamente. Resultados excluídos/ocultados deixam de ser elegíveis.
- Requisições atrasadas de uma referência anterior não substituem a galeria atual. Operações de tags, exclusão e visibilidade continuam vinculadas à imagem original.

## Estados e apresentação

- Reutilizar a masonry, proporções naturais, carregamento progressivo e tokens de DESIGN.md: cartões com cantos de 16px, superfícies neutras e controles discretos.
- Manter a referência pequena e reconhecível, sem ocupar o espaço principal da galeria. Não mostrar percentuais, vetores, nomes de modelos ou justificativas inventadas por cartão.
- Distinguir carregamento, preparo ainda pendente, ausência de resultados e falha recuperável. Mensagens curtas, com saída e retry quando pertinente; sem painel de processamento.
- Se apenas parte da biblioteca estiver disponível, indicar discretamente que os resultados ainda são parciais. Uma falha de análise não torna o original indisponível para uso normal.
- Falha ao carregar o próximo lote preserva os cartões já vistos e permite tentar novamente. Não mover o foco ao acrescentar resultados.
- Usar links e controles acessíveis por teclado, foco visível, alvos de pelo menos 44px e nenhuma ação dependente só de hover. Preservar reduced motion e evitar overflow no celular.

## Fora do escopo

Tags automáticas, descrição automática, reconhecimento de pessoas, busca por texto livre no conteúdo visual, upload externo para consulta, busca na internet, imagens geradas, taxonomias, controles de pesos, seleção de modelos, histórico permanente, novo sistema de coleções e expansão da API pública de assets.

Não exigir GPU, serviços pagos ou envio de imagens a terceiros para o fluxo inicial. Mecanismo, armazenamento de derivados e rotina de preparo estão documentados no plano. O modelo pode ser baixado no primeiro preparo e fica disponível no volume local para usos posteriores.

## Critérios de aceitação

- Uma referência encontra resultados sem depender de tags ou nomes, incluindo candidatos de outros assuntos.
- Abrir B numa galeria baseada em A mantém A como referência; somente “Ver similares” em B abre a galeria de B.
- Fechar o visualizador recupera a mesma galeria. Voltar entre galerias restaura o contexto conhecido e não mistura o histórico temporário de relacionadas.
- Reload, entrada direta e nova aba identificam referência e imagem corretamente; referência ausente/oculta produz recuperação explícita.
- Carregamento gradual não repete cartões nem reordena os já apresentados; falhas preservam resultados e o fim da lista é reconhecível.
- Referência e resultados respeitam visibilidade. Edições e exclusões não deixam uma tela sem saída, e respostas antigas não mudam outro destino.
- Captura, tags relacionadas e navegação habitual continuam funcionais sem depender do preparo da similaridade.
- Teclado e celular permitem completar o percurso com foco e rolagem previsíveis.
- Os dois relatórios de 20 referências foram apresentados e o usuário aprovou a segunda rodada para V1. Preservar a combinação selecionada e verificar a paridade com o experimento, incluindo imagens sem tags e assuntos diferentes. A aprovação não comprova qualidade universal para todo o acervo ou precisão de pose/objetos.
- Medir no Mordor tempo de preparo, memória de pico e tempo de consulta com quantidade de imagens registrada. Validar concorrência limitada sem falhas de memória ou degradação perceptível dos fluxos usuais. Limites numéricos e método ficam no plano com base no experimento, sem promessas prévias de velocidade.

## Limites das mudanças

Esta proposta acrescenta um fluxo explícito de similaridade às fronteiras de 008/010, sem redefinir “relacionadas por tags”. Estende os destinos persistentes de 013 somente para identificar a referência e sua galeria. O carregamento gradual dos resultados é específico desta feature; não exige paginar todas as telas existentes de 017.

O pedido atual substitui o adiamento especulativo de similaridade no backlog por discovery ativo. A direção e o plano precederam a implementação conforme AI_PRODUCT_WORKFLOW.md. Esta V1 não foi publicada automaticamente em produção.
