# Navegação centrada na Biblioteca

Status: composição aprovada pelo usuário após a correção do detalhe em contexto e da ampliação separada. Implementação concluída e publicada na release 0.23.0; o usuário confirmou teste em produção com funcionamento correto. O agente não realizou o deploy. Resultados e limites no [plano](plan.md). Base: [análise do Pinterest e do projeto](../../pinterest-ux-review-2026-11-06.md).

## Problema e objetivo

A entrada atual abre Explore e coloca título grande, captura e várias faixas de ferramentas antes das imagens. O usuário quer uma experiência mais próxima da navegação do Pinterest autenticado, priorizando sua Biblioteca ao abrir a página.

A Biblioteca deve parecer um acervo visual pronto para navegar. Busca, captura e organização permanecem próximas, com peso proporcional à frequência de uso. Seguir CONSTITUTION.md e o adendo de biblioteca autenticada de DESIGN.md.

## Fluxos

### Entrar e navegar

1. A raiz abre Biblioteca com todas as imagens visíveis, sem filtros iniciais. Ocultas continuam fora da grade padrão.
2. Navegação persistente oferece Biblioteca e Explorar. Biblioteca é o primeiro destino; Explorar preserva redescoberta e assuntos existentes.
3. No desktop, barra lateral compacta e busca no topo. No celular, busca no topo e navegação inferior com Biblioteca, Explorar e Adicionar.
4. A busca principal indica seu escopo. Na Biblioteca, pesquisa tags e nomes; no assunto, pesquisa naquele assunto; em Explorar, pesquisa assuntos. Uma ação explícita permite buscar na biblioteca inteira ao sair de um assunto.
5. Clicar numa imagem abre o **detalhe em contexto**: imagem em destaque, metadados e imagens relacionadas ao lado e abaixo no desktop, com navegação e busca da aplicação presentes. Clicar nas relacionadas continua essa exploração. No celular, as relacionadas seguem abaixo do detalhe.
6. Um botão **sobre a imagem destacada** abre a **ampliação focada**, ajustada ao viewport sem recorte e sem imagens relacionadas. Essa é uma segunda ação explícita: clicar no cartão da galeria não pula o detalhe intermediário.
7. Fechar a ampliação volta ao mesmo detalhe, preservando imagem, posição e foco no botão de ampliar. Voltar do detalhe restaura o contexto anterior, incluindo a sequência de relacionadas ou a galeria com filtros, scroll e foco. A aplicação já oferece esses dois modos; preservar seu comportamento.

### Adicionar

1. Adicionar abre uma área de captura sob demanda, sem abandonar o acervo. Não iniciar salvamento apenas por abrir.
2. Arquivos, URL direta, página HTML, clipboard e arrastar continuam com seus contratos atuais. Colar em campos editáveis nunca dispara captura global.
3. Arrastar arquivos revela um alvo de soltura. O alvo e os listeners necessários permanecem disponíveis mesmo com a captura recolhida.
4. Captura mantém tags de contexto, seleção de candidatas, progresso, falhas e retry. A seleção de uma página permanece em fluxo normal, fora do cabeçalho fixo.
5. Recolher não descarta escolhas nem encerra trabalho silenciosamente. Enquanto houver lote ativo, manter o progresso visível e impedir fechamento que sugira cancelamento. Uma seleção pendente pode ser reaberta; descartar usa a ação explícita de fechar seleção já existente.
6. Durante seleção de candidatas, Salvar selecionadas é a ação primária e Adicionar tem hierarquia secundária. Mensagens e erros continuam visíveis mesmo com a captura recolhida.

### Filtrar e organizar

- Filtros ativos aparecem sob a busca, com remoção individual e Limpar filtros. Sugestões aparecem ao interagir com a busca, sem várias faixas permanentes.
- Filtros abre acesso a tags; o limite atual de três e a identidade dos assuntos são preservados.
- A busca por conteúdo permanece disponível em opções de busca, mantendo ativação explícita, indicação experimental e estados existentes de preparo/erro. Não iniciar preparo automaticamente.
- Selecionar ativa o modo de seleção existente, com contagem e ações de tags em lote. Sair não muda imagens. Selecionar não abre o visualizador.
- Imagens ocultas, revisão de duplicatas e informações da biblioteca ficam em Mais; acesso e saída ficam em Ajustes. Todas as ações permanecem identificáveis e acessíveis em até dois acionamentos a partir da tela principal.
- A remoção de imagem fica em Mais ações do cartão, acessível por toque e teclado. Preservar o contrato de remoção existente; esta entrega não cria lixeira ou altera retenção.

## Regras visuais e responsivas

- Busca de 48 px; cabeçalho de aproximadamente 64–72 px; título de 22–28 px. Sem título de apresentação grande na biblioteca.
- Superfície branca, cores e raios existentes, imagens sem padding interno, proporções naturais e gutter de 8 px. Sem novos temas ou dependências visuais.
- Manter largura de conteúdo próxima de 1280 px, considerando a barra lateral no espaço disponível. Ajustar número de colunas à largura útil, não à viewport isoladamente.
- Em 390 px, duas colunas com margens de 12–16 px. Em larguras úteis muito estreitas ou com zoom, uma coluna é permitida para legibilidade.
- Navegação inferior respeita safe areas e não cobre os últimos cartões. Cabeçalho fixo não esconde foco ou mensagens.
- Estado ativo perceptível por forma/indicador e texto acessível. Tooltips complementam nomes acessíveis; não substituem rótulos de navegação no celular.
- Alvos reais de pelo menos 44 × 44 px; foco visível. Ações do cartão acessíveis sem hover. Menus fecham com Escape e devolvem foco ao acionador; overlays contêm foco quando modais.

## Carregamento e continuidade

Depois da autenticação, montar diretamente a estrutura do destino solicitado, sem passagem temporária por Explore. Reservar espaço para cartões durante o carregamento e manter a navegação utilizável. Continuar usando miniaturas na grade e dimensões conhecidas para estabilidade.

Esta entrega não promete nova paginação ou tempos de rede. Desacoplar carga de tags da galeria e melhorar a prévia do original no viewer são a próxima etapa de desempenho, salvo se algum ajuste for indispensável à nova composição.

## Endereços e compatibilidade

- `/` passa a significar Biblioteca. `?view=library` continua válido.
- Explore passa a ser sempre serializado explicitamente com `?view=explore`; preservar seleção de redescoberta e seus links.
- Links existentes com q, tag e image sem view continuam em Biblioteca.
- Preservar assuntos, similares, duplicatas, ocultas, busca por conteúdo, links diretos de imagem e páginas de acesso/compartilhamento. Não ampliar filtros inválidos silenciosamente.
- Preservar voltar/avançar nativos, abrir em outra aba e restauração de contexto. Não substituir deep links pelo novo padrão da raiz.

## Escopo e não objetivos

Recompor superfícies e navegação existentes. Não criar coleções/pastas, favoritos, colagens, colaboração, feed externo, opções de densidade, novas classificações ou reordenação manual. Assuntos continuam derivados de tags e não recebem o nome de Pastas.

Não reescrever o visualizador, autenticação, APIs ou armazenamento. Não alterar privacidade, dados de produção, versão ou deploy por consequência desta spec. Rótulos do protótipo estão em português para revisão; tradução completa do produto não é parte desta entrega.

## Critérios de aceite

- Raiz abre Biblioteca; links e histórico seguem os contratos acima, com testes de parser/serializador cobrindo a troca do padrão.
- Com captura recolhida e sem filtros, a grade começa até aproximadamente 180 px do topo em 1440 × 1000 e 220 px em 390 × 844. Confirmar em navegador com dados controlados.
- Duas colunas em 390 px, sem overflow horizontal; verificar também 320 px, tablet, desktop e zoom de 200%.
- Biblioteca, Explorar, busca, filtros, seleção, menus e captura funcionam por teclado e toque. Escape, retorno de foco e estados de erro são verificados.
- URL, arquivos, colar, drag-and-drop, seleção de página, progresso e retry preservam o fluxo existente; navegar não descarta trabalho ativo.
- Visualizador e retorno preservam filtros, foco e scroll; tags continuam opcionais.
- Verificar os dois passos separadamente: galeria → detalhe com relacionadas → ampliação focada → mesmo detalhe → origem. O primeiro clique não abre um modal isolado. No desktop, imagens relacionadas ficam visíveis nas laterais do destaque; no celular, abaixo dele.
- Busca por conteúdo, ocultas, duplicatas, acesso e saída continuam alcançáveis e com seus estados reais.
- Comparar capturas antes/depois e registrar início da grade, imagens visíveis, carregamento e deslocamento de layout. Executar testes pertinentes e build quando a aplicação for implementada.

## Protótipo de revisão

[Abrir interface-preview.html](interface-preview.html). Artefato independente, com ilustrações sintéticas, busca, filtros, seleção, navegação, captura demonstrativa, detalhe com imagens relacionadas e ampliação focada separada. Não usa o acervo privado, não autentica e não salva nada. As ações simplificadas ilustram hierarquia e transições, sem afirmar que os contratos reais de upload, APIs ou acessibilidade da aplicação já foram implementados.

Revisar a composição antes de escrever o plano de implementação. O protótipo não substitui os critérios acima.

### Verificação do protótipo — 06/11/2026

- Chrome headless com Playwright: grade com 12 ilustrações; busca por “montanhas” retorna uma; filtros por arte retornam três; assunto arquitetura retorna quatro. Entrada em Explorar, abertura de assunto, seleção individual, menu de cartão e saída da seleção verificados.
- Detalhe fecha devolvendo foco ao cartão; menu fecha com Escape devolvendo foco ao acionador. Captura abre e fecha no desktop e em viewport móvel.
- Sem overflow horizontal em 1440, 768, 390 e 320 px. Grade começa a 152 px no desktop de 1440 × 1000 e 144 px em 390 × 844; são resultados do protótipo com dados sintéticos. Em 390 px, duas colunas.
- Capturas desktop e móvel inspecionadas. Nenhuma exceção JavaScript na primeira rodada. Corrigida durante o smoke a transição de assunto que perdia o filtro ao trocar o hash; nova rodada passou.
- Não executados testes/build da aplicação, pois seu código não foi alterado. Não constitui auditoria completa de acessibilidade, simulação de backend ou validação dos fluxos reais de captura.

### Correção do detalhe após revisão do usuário

O primeiro protótipo usava um diálogo isolado e não demonstrava o passo intermediário existente na aplicação. Corrigido para detalhe em fluxo com imagens do acervo nas laterais e abaixo, navegação entre elas e botão sobre a imagem para abrir a ampliação focada separadamente. As ilustrações relacionadas são demonstrações de composição, não resultados de similaridade calculada.

Playwright verificou que clicar no cartão não abre modal, que há 11 imagens navegáveis ao redor/abaixo, que a ampliação abre somente pelo botão e que Escape restaura o foco nesse botão sem sair do detalhe. Abrir relacionada, voltar ao destaque anterior, voltar à galeria e avançar pelo histórico passaram; o foco retornou ao cartão de origem. Busca a partir do detalhe retorna à grade com a consulta aplicada.

Capturas desktop e móvel inspecionadas. No mobile, corrigida a ordem para mostrar primeiro o detalhe e depois as relacionadas. Sem overflow em 1440, 768, 390 e 320 px; nenhuma exceção JavaScript na rodada dos dois passos. Os resultados anteriores de fechamento do detalhe referiam-se ao modal substituído; a navegação atual usa histórico e retorno ao contexto.
