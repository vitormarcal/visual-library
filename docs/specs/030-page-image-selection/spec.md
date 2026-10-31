# Salvar imagens de uma página

Status: fluxo confirmado pelo usuário e implementação autorizada em 2026-10-31. Implementada localmente na versão 0.21.0; validação em [plan.md](plan.md). Sem deploy.

## Problema e objetivo

Salvar referências de um post com várias imagens exige abrir ou baixar cada arquivo separadamente. Permitir colar o endereço da página, escolher visualmente as imagens e salvar apenas as selecionadas reforça a curadoria pessoal de CONSTITUTION.md.

Blogs são a prioridade. Twitter e Reddit são casos desejados pelo usuário, sujeitos a avaliação de acesso público; esta primeira versão não promete suporte a essas plataformas.

## Fluxo

1. O usuário cola uma URL na área de captura existente.
2. URLs diretas de imagem continuam salvando imediatamente. Para uma página suportada, a captura apresenta as imagens encontradas para seleção, sem adicionar nenhuma ao acervo.
3. A grade preserva a ordem do artigo e as proporções. Nenhuma imagem começa selecionada. Clicar ou tocar diretamente na imagem abre a visualização em tela cheia, seguindo o padrão da galeria (mesma superfície visual e botão × para fechar), com retorno à mesma seleção e posição. Não há botão textual “Enlarge”; o checkbox separado controla o que será salvo.
4. O usuário seleciona individualmente ou usa “Selecionar todas”. Pode desfazer as escolhas antes de salvar.
5. “Salvar selecionadas (N)” salva somente as escolhidas. Sem seleção, a ação fica indisponível. Fechar a seleção sem salvar não altera a biblioteca.
6. O resultado informa quantas foram salvas, quantas já existiam e quais falharam. Uma falha não impede o restante do lote. As novas imagens aparecem no fluxo normal da biblioteca.

## Regras de descoberta e seleção

- Priorizar imagens do corpo do post, evitando logotipos, ícones e elementos de navegação quando o conteúdo principal puder ser identificado. Não prometer separação perfeita para qualquer site.
- Apresentar uma única candidata para as representações da mesma imagem no HTML, incluindo alternativas de resolução e de carregamento tardio. Isso não autoriza agrupar imagens diferentes por similaridade visual.
- Salvar a maior versão disponível identificada na página para a candidata, sem ampliar artificialmente nem inventar URLs de originais.
- A extração deve reconhecer imagens cujo endereço real está disponível no HTML mesmo quando o endereço inicial é um placeholder.
- O usuário decide o que entra no acervo. Imagens não selecionadas não são salvas nem removidas de uma biblioteca existente.
- Preservar o contexto de tags da captura, informando quais serão aplicadas às imagens novas. Duplicatas seguem as regras atuais e não recebem alterações silenciosas.
- Preservar a origem da página junto à origem da imagem para procedência, sem exigir preenchimento de metadados.

## Experiência e DESIGN.md

- Estender a captura existente, sem uma área permanente de importação ou painel de gerenciamento.
- Exibir a seleção em fluxo normal, fora da parte sticky da captura, sem uma grade grande fixada sobre a biblioteca.
- Usar a grade visual, proporções naturais, espaçamento e componentes definidos em DESIGN.md. Seleção perceptível sem depender apenas de cor; controles com foco visível e alvos de pelo menos 44 px.
- Ampliar e selecionar são ações distintas e acessíveis por teclado. A ampliação preserva o estado das escolhas. Prévias já carregadas permanecem disponíveis ao rolar e são reutilizadas na ampliação, sujeitas ao limite de memória temporária da seleção.
- Manter apenas uma ação primária no contexto da seleção. “Selecionar todas” e fechar são ações secundárias discretas.
- Mostrar descoberta, salvamento, ausência de imagens e falhas com mensagens curtas próximas da captura. Não confundir falha de acesso com página sem imagens.
- Reutilizar a experiência de resultados de lote: falhas permanecem consultáveis e somente as recuperáveis oferecem nova tentativa. Não repetir salvamentos bem-sucedidos ao tentar novamente.
- Não sobrepor operações de captura. A seleção mantém as escolhas após falhas de salvamento; a biblioteca continua utilizável.
- Fechar ou recarregar encerra trabalho pendente; imagens já salvas permanecem. Sem promessa de retomada em segundo plano.

## Escopo e limites

- Uma página pública HTTP/HTTPS por tentativa, com imagens identificáveis no HTML recebido. Sem login no site de origem.
- Preservar as proteções existentes para acesso remoto: destinos públicos, validação em redirecionamentos, formatos aceitos e limite de tamanho por imagem. A descoberta da página não abre acesso a endereços internos.
- A biblioteca e as ações de captura continuam protegidas pelo acesso do dono. Descobrir ou salvar não publica imagens automaticamente.
- Não executar scripts da página, navegar por links, percorrer galerias paginadas ou buscar imagens em posts relacionados.
- Sem extensão de navegador, automação de navegador, cookies de terceiros, quebra de bloqueios, importação de perfis, monitoramento recorrente, filas ou serviço permanente novo.
- Sem tags obrigatórias, edição de imagens, seleção automática por IA ou consolidação de duplicatas durante a captura.
- A funcionalidade amplia explicitamente a fronteira de [003](../003-direct-image-url-saving/spec.md), que excluía páginas HTML, preservando o salvamento direto e o comportamento de lotes de [011](../011-multiple-image-save/spec.md).

## Caso real e critérios de aceitação

Referência fornecida pelo usuário: [Photos of celebrities with black cats — Pulp International](https://pulpinternational.com/pulp/entry/photos-of-celebrities-with-black-cats/). Inspeção do HTML em 2026-10-31 encontrou 30 imagens distintas da série `meow-mix`, com alternativas de resolução, placeholders e cópias em `noscript`, além de imagens de cabeçalho e barra lateral. O conteúdo remoto pode mudar; registrar uma amostra controlada para validação posterior.

- No exemplo, apresentar as 30 fotos do artigo uma vez cada, na ordem do post, sem misturar imagens da barra lateral e o logotipo na seleção principal.
- Nenhuma começa selecionada; escolher duas salva somente as duas. “Selecionar todas” permite salvar o conjunto e desmarcar itens antes da confirmação.
- Ampliar uma candidata e retornar preserva seleção e posição.
- Salvar a maior versão identificada de cada candidata, evitando miniaturas quando houver uma alternativa maior declarada.
- Fechar sem salvar deixa o acervo intacto.
- Um lote misto de novas imagens, duplicatas e falhas apresenta contagens corretas; nova tentativa não repete sucessos.
- URL direta, arquivos locais, clipboard e tags de contexto continuam funcionando.
- Página sem imagens, página indisponível e página que exige login recebem feedback apropriado; endereços internos são recusados.
- Seleção funciona em celular e desktop, por toque e teclado, sem rolagem horizontal, perda de escolhas ou publicação involuntária.
