# Busca por conteúdo experimental

Autorizada pelo usuário em 2026-10-24, após avaliação integral de 876 imagens e revisão dos resultados. A avaliação mostrou utilidade para reencontrar itens, com qualidade irregular; esta entrega é um teste de uso opcional, não aprovação geral do encoder.

## Experiência

- Library visível oferece dois modos: `Tags and filename` (padrão atual) e `Content · experimental`.
- No modo por conteúdo, descrever uma imagem e pressionar Enter ou Search. Digitar não inicia inferência.
- Filtrar por até três tags existentes antes de escolher os resultados. Não misturar scores lexicais e semânticos.
- Resultado finito de até 24 imagens, com miniaturas e viewer existentes. Sem scores de confiança ou promessa de que todo resultado seja relevante.
- Abrir/fechar, anterior/próximo, tags, similares, links, reload e histórico preservam o contexto. Ordem permanece estável enquanto o usuário navega nos resultados já recebidos; atualizar a busca é explícito.
- Primeira ativação apresenta `Prepare content search`, explicando que baixa um modelo local uma vez. Preparo mostra progresso e permite continuar usando a biblioteca.
- Depois de ativar, índice e pesos persistem; novas imagens visíveis entram no preparo sem esperar no upload. Captura via share, assets e visibilidade acompanham o mesmo fluxo.
- Falha de modelo/indexação oferece retry e preserva busca tradicional, captura, tags e navegação. Imagens incompatíveis não impedem preparar as demais.
- Busca vazia não executa inferência. Enquanto prepara ou falha, não apresentar ausência de resultados como se fosse resposta completa.

## Limites

Somente Library visível nesta versão; assuntos, Explore e imagens ocultas mantêm busca habitual. Sem tagging, histórico de consultas persistido, sugestões automáticas, tradução automática, aprendizado de comportamento, novo banco ou serviço externo. Texto e imagens permanecem no servidor; somente pesos/configurações são baixados.

Um primeiro download de aproximadamente 412 MB e cerca de 1,1 GiB de RSS observados no experimento justificam ativação explícita. O servidor web não carrega modelo nativo. Não processar o acervo de produção nem fazer deploy nesta implementação; testar com dados isolados.

## Aceite

Biblioteca tradicional funciona antes/depois de ativar e quando modelo falha. Query só executa após submit; respostas antigas não substituem outra consulta. Filtros precedem top 24; ocultas, removidas e hashes/fingerprints obsoletos não entram. Reinício reaproveita índice/pesos. Retry não repete descritores válidos; exclusão limpa derivados. Upload não aguarda inferência. Navegação e teclado preservam o lote e retorno. Validar HTTP/lifecycle com banco temporário, inferência real sem rede com pesos pré-cacheados, build, Docker e navegador desktop/mobile.
