# Navegação e exploração no celular

Status: proposta para revisão. Prioridade escolhida pelo usuário: navegar, abrir e explorar imagens. Sem implementação na aplicação nesta etapa.

## Problema

A biblioteca já oferece busca visível, duas colunas e navegação inferior. O detalhe móvel, porém, coloca navegação anterior/próxima, link público, origem, visibilidade e edição de tags antes das relacionadas. Isso aumenta o caminho entre abrir uma imagem e continuar explorando. A saída por × e o retorno por Back têm destinos diferentes, pouco explícitos visualmente.

Esses achados vêm da leitura da implementação, não de medição de uso ou teste em aparelho físico. Referências: CONSTITUTION.md, DESIGN.md e contratos de 031–033.

## Objetivo

Navegar pelo acervo, abrir uma imagem e seguir pelas relacionadas com pouco peso de interface, preservando orientação e retorno. Refinar os fluxos existentes sem criar funcionalidades de organização ou descoberta.

## Composição proposta

### Biblioteca e pastas

- Manter busca no topo, Imagens/Pastas logo abaixo do título compacto, e Biblioteca/Explorar/Adicionar na base.
- Preservar duas colunas em 390 px e proporções naturais das imagens, com gutter de 8 px. Uma coluna quando largura útil ou zoom exigir.
- Dentro de pasta, apresentar retorno explícito a Pastas junto ao título e evitar uma faixa adicional dedicada ao retorno. Nome longo quebra linha sem empurrar ferramentas para fora da tela.
- Estado ativo das abas e navegação inferior é visível sem depender apenas de cor.
- Preservar consultas e posição próprias de Imagens, Pastas e Explorar, inclusive ao tocar novamente no destino atual.

### Abrir e explorar

1. Cartão abre detalhe contextual. Busca e navegação da aplicação permanecem acessíveis.
2. A faixa compacta do detalhe oferece **Voltar à biblioteca/pasta/exploração**, conforme origem, e, depois de abrir relacionadas, **Imagem anterior**. Os dois destinos têm nomes distintos. Em link direto, usar retorno à Biblioteca.
3. Imagem vem primeiro, sem recorte. Botão de ampliar permanece sobre ela, com alvo de 44 px e nome acessível.
4. Abaixo, tags existentes como pistas de navegação e acesso explícito a editar tags. Listas longas mostram até três pistas inicialmente e um botão para revelar as demais; nunca ocultar associações sem indicar que existem outras.
5. Origem, link público e ocultação ficam em **Mais ações**. Cada ação continua alcançável e mantém seus estados, mensagens e contratos atuais. Não colocar edição de tags dentro desse menu.
6. Título curto **Mais da sua biblioteca** sinaliza a continuação da exploração, seguido pelas relacionadas em duas colunas. Preservar a explicação real de conexão de cada imagem e o carregamento existente; não prometer similaridade quando a origem for outra associação.
7. Abrir uma relacionada troca o destaque e inicia esse detalhe no topo. Imagem anterior restaura destaque, posição e foco anteriores. Voltar ao acervo restaura galeria/pasta de origem, filtros, posição e cartão.
8. Ampliação continua como segundo estágio explícito. Fechá-la devolve ao mesmo detalhe, posição e foco. Não adicionar swipe obrigatório ou gestos que disputem a rolagem vertical.

Anterior/próxima do conjunto continuam disponíveis com nomes claros e alvos de 44 px, em composição compacta. A prévia simplifica o conjunto de controles; não autoriza remover funcionalidades existentes.

## Regras e limites

- Tokens, superfícies neutras, vermelho para ação primária e raios existentes. Sem temas novos ou dependências.
- Respeitar safe areas, viewport dinâmica, orientação horizontal e zoom. Cabeçalho e navegação inferior não cobrem imagens, mensagens ou foco.
- Menus fecham com Escape e devolvem foco. Rótulos e estados de carregamento/erro continuam acessíveis por toque e teclado.
- Não iniciar preparo de similares nem mudar ranking por consequência do novo layout.
- Sem alterações em APIs, armazenamento, privacidade, algoritmos, tags gerenciadas, captura ou modelo de pastas. Preservar capas compartilhadas e foco no nome escolhido.
- Desktop mantém a composição com relacionadas ao redor. Ajustes compartilhados só quando necessários à consistência de comportamento.
- Sem release, push ou deploy por consequência desta proposta.

## Critérios de aceite da implementação

- Conferir 320, 390, 430 e 768 px, orientação horizontal e desktop, além de zoom de 200%: sem overflow horizontal ou controles cobertos.
- Na biblioteca de 390 × 844, captura recolhida e sem filtros, primeira linha de imagens até aproximadamente 220 px do topo, conforme DESIGN.md.
- No detalhe, controles de manutenção não aparecem como bloco permanente antes das relacionadas. Comparar posição da primeira relacionada antes/depois com a mesma imagem e mesmas tags; a nova composição deve aproximá-la, sem limitar artificialmente a imagem principal.
- Validar biblioteca → pasta → imagem → relacionada → imagem anterior → ampliação → fechar → voltar à pasta; restaurar busca, filtros, scroll e foco.
- Validar link direto, reload, voltar/avançar do navegador, consulta sem resultados, imagem sem tags, muitas tags, imagem horizontal e vertical, erro de miniatura e carregamento de mais relacionadas.
- Verificar edição de tags, link público, ocultação, anterior/próxima, filtros e captura sem regressão.
- Registrar capturas comparáveis e limites da emulação. Executar testes pertinentes e build depois da implementação.

## Artefato de revisão

[Prévia navegável](interface-preview.html), independente da aplicação, com ilustrações sintéticas. Demonstra biblioteca, pastas, detalhe, relacionadas, ampliação e retorno. Não calcula similaridade, não acessa o acervo e não persiste dados. Não substitui validação da aplicação.

O fluxo local em AI_PRODUCT_WORKFLOW.md determina aprovação da spec antes do plano de implementação. A próxima etapa é revisar esta composição com o usuário.

### Verificação da prévia — 07/11/2026

- Chrome headless: sem overflow horizontal na biblioteca em 320, 390, 430 e 768 px; 12 cartões renderizados. Primeira imagem a aproximadamente 201 px do topo. Captura de 390 × 844 inspecionada visualmente.
- Smoke de interação no navegador passou por Pastas → pasta → imagem → relacionada → imagem anterior → ampliação → fechar → voltar à pasta.
- JavaScript da prévia passou por validação de sintaxe. Não foram executados testes/build da aplicação, pois seu código não foi modificado.
- A prévia simplifica histórico, filtros, persistência de consultas e ações de edição/manutenção. Os critérios da aplicação continuam obrigatórios; o smoke não comprova restauração completa de scroll/foco, histórico nativo, acessibilidade ou comportamento em aparelho físico.
