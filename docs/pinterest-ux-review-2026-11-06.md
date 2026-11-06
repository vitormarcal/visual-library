# Navegação centrada na biblioteca — análise e proposta

Data: 06/11/2026. Status: proposta para discussão; interface e comportamento não alterados.

## Direção recomendada

Abrir o acervo completo em Biblioteca, com busca no topo, navegação persistente compacta e imagens imediatamente abaixo dos filtros ativos. Explorar continua disponível como forma de redescobrir o próprio acervo. Adicionar imagens permanece fácil, mas a superfície de captura deixa de ocupar permanentemente o primeiro plano.

Interpretação de “priorizar a biblioteca”: a entrada inicial deve abrir as imagens salvas do usuário, em vez da seleção de redescoberta de Explore. Não implica substituir a galeria por pastas nem criar coleções nesta entrega.

## Evidências e limites

- Leitura de `CONSTITUTION.md`, `DESIGN.md`, `AI_PRODUCT_WORKFLOW.md`, backlog e implementação de navegação, galeria, captura, busca, seleção e visualizador. Consultados os registros de navegação persistente e a avaliação local de desempenho de 03/11.
- Pinterest autenticado inspecionado diretamente com Playwright: feed inicial, Salvos/Pastas, Salvos/Pins, sugestões de busca, resultados para “architecture”, hover de cartão e detalhe de um pin. Viewport desktop de 1440 × 1000.
- Na primeira rodada, ambas as abas de Salvos mostraram estados vazios. Depois que o usuário salvou pins e criou uma pasta, uma segunda rodada inspecionou Salvos preenchido, a pasta pessoal “monogatari” com 11 pins, sua busca, modo Organizar, detalhe de um pin salvo e a grade geral de Pins. As criações foram feitas pelo usuário; a inspeção não criou, salvou, editou, reordenou ou removeu conteúdo.
- A [página oficial de criação de pastas](https://create.pinterest.com/product-features/how-to-create-boards/), incluindo sua imagem de interface, complementa agora a observação direta de uma pasta preenchida, em vez de substituí-la.
- Capturas privadas da inspeção em `/tmp/visual-library-pinterest-review/`; não adicionadas ao repositório. Não foi realizada nova inspeção autenticada da aplicação Visual Library no navegador: o diagnóstico atual usa o código e distingue as medições históricas abaixo.
- Também inspecionado o feed web em viewport de 390 × 844, no mesmo navegador desktop: duas colunas e barra lateral preservada. Isso não equivale à análise do aplicativo móvel ou de um navegador com user-agent de celular. A navegação inferior sugerida abaixo é uma adaptação para o projeto, não um comportamento observado nessa sessão.

## O que o Pinterest autenticado faz

### Navegação e busca

A interface observada usa uma barra lateral de aproximadamente 72 px com ícones e tooltips. Busca e conta ocupam o topo. O feed começa por volta de 144 px do topo; a busca fica disponível sem um grande título de apresentação ou formulário de criação acima das imagens.

Em Salvos, a mesma posição de busca muda o placeholder para “Pesquisar seus Pins”. A página apresenta as abas Pins e Pastas, com seleção por sublinhado discreto. Organizar e Criar ficam em uma faixa de ações. O caminho para a biblioteca tem identidade própria, distinta do feed de recomendações.

Ao digitar uma consulta, sugestões aparecem temporariamente. Nos resultados, refinamentos ficam em uma faixa horizontal acima da grade. Isso concentra controles perto da busca, em vez de espalhá-los por várias seções permanentes.

### Imagens e ações

No desktop observado, a grade usa cinco colunas, cartões com cerca de 250 px, cantos arredondados e proporções variadas, incluindo paisagens. Alguns cartões têm título e menu abaixo da imagem; outros têm apenas menu. No hover analisado apareceu uma ação contextual sobre a imagem. Não se deve assumir que toda ação aparece sempre ou que o hover é suficiente para dispositivos de toque.

O detalhe mantém busca e navegação da aplicação. Uma imagem grande ocupa a esquerda do cartão; ações e informações ficam à direita; conteúdo relacionado continua ao lado e abaixo. A ampliação é uma ação distinta da abertura do detalhe. O projeto já tem essa distinção e já dispõe de conteúdo relacionado, portanto não precisa reconstruir o visualizador para iniciar esta evolução.

### O que aproveitar

- Navegação persistente com pouco peso visual.
- Busca com posição estável e escopo compreensível.
- Separação clara entre explorar e acessar o que foi salvo.
- Ações contextuais, com controles de manutenção fora da navegação principal.
- Continuidade entre grade, detalhe, relacionados e retorno.

Não se propõem publicidade, seguidores, comentários, mensagens, recomendações externas ou métricas sociais. A constituição define uma biblioteca pessoal.

## Complemento: biblioteca e pasta preenchidas

Segunda rodada em 06/11, depois das criações do usuário. Viewport de 1440 × 1000; sem alteração do conteúdo da conta.

### Salvos tem duas formas de percorrer o mesmo acervo

Em **Pins**, a tela mostrou uma grade geral com 15 links de imagem renderizados nesta rodada. As 11 imagens da pasta também estavam presentes nessa grade. A contagem descreve o conteúdo renderizado, não uma auditoria do total armazenado na conta. A grade geral usou sete colunas mais compactas, enquanto a pasta usou cinco: nem todas as superfícies do Pinterest adotam a mesma densidade.

Em **Pastas**, apareceu o cartão “monogatari” com uma composição de três imagens: uma maior à esquerda e duas menores à direita. Nome, contagem de 11 pins e atividade recente ficam abaixo; um cadeado sobre a capa comunica a privacidade. Existe um cartão separado de criação. Abaixo, uma seção “Ideias não organizadas” mostra imagens fora da pasta e oferece Organizar.

Implicação: uma pasta tem identidade visual e curadoria próprias. Não é apenas uma tag com outro nome. Se o projeto adotar coleções no futuro, a estrutura natural é Biblioteca → Imagens / Coleções, mantendo Explorar como destino de redescoberta. A preferência atual de abrir Biblioteca pode ser atendida pela grade completa sem exigir a implementação de coleções.

### A pasta tem contexto e ferramentas próprios

“monogatari” mostra título, condição privada, contagem e menu de ações. Organizar, Mais ideias e Colagem são ações explícitas. Um botão flutuante de adicionar aparece próximo à parte inferior.

Há **duas buscas simultâneas**: “Pesquisar seus Pins” no topo e “Pesquisar nesta pasta” acima da grade. Na busca interna por “Hanekawa”, a grade passou a mostrar três imagens e o endereço observado permaneceu o da pasta. A pesquisa refinou o conteúdo sem sair visualmente daquele contexto. Não foi verificada a persistência desse texto após recarga.

Isso qualifica a observação anterior sobre a posição estável da busca: o Pinterest a mantém, mas adiciona outra para o escopo local. Para o projeto, recomendo uma única busca com escopo visível (“Na biblioteca” ou “Neste assunto”; “Nesta coleção” caso coleções existam). Uma ação explícita deve permitir ampliar para a biblioteca inteira. Essa simplificação é uma recomendação para o produto, não uma reprodução literal do concorrente.

O cabeçalho da pasta observado empurra o início das imagens para aproximadamente 480 px do topo, contra cerca de 328 px na grade geral de Pins e 144 px no feed. Portanto, a proposta de imagens começando até cerca de 180 px no desktop é uma meta própria para a biblioteca, não uma medida típica de todas as telas do Pinterest. Copiar o cabeçalho de pasta inteiro contrariaria a prioridade de conteúdo solicitada.

### Organizar é um modo explícito

Abrir Organizar troca a superfície por “Selecionar e reordenar”, com retorno claro, instrução de seleção, Marcar tudo e controles de operação na parte inferior. Os cartões exibem indicadores de arraste. A inspeção não selecionou, moveu, arrastou ou excluiu pins.

O princípio útil é separar contemplação e manutenção. O projeto já tem modo Selecionar e ações de tags em lote; deve reforçar esse modo, mostrando ferramentas quando necessárias, sem copiar operações de pasta ou reordenação que ainda não existem no produto.

### Detalhe preserva a relação com a pasta

O pin aberto a partir da pasta mostrou “monogatari” no seletor próximo de Salvar, link de origem e descrição, além da imagem e da ampliação. O retorno pelo navegador levou novamente à pasta. A inspeção não acionou Salvar nem modificou o destino.

No projeto, o equivalente imediato é manter o assunto/filtros de origem e oferecer retorno previsível. Se coleções forem introduzidas, sua associação deve aparecer no detalhe e usar uma ação com significado claro, como “Adicionar à coleção”; a biblioteca não precisa exibir “Salvar” para algo já salvo.

### Ajuste na recomendação

1. Manter a primeira entrega concentrada em Biblioteca como entrada, busca contextual, captura recolhida e espaço para imagens.
2. Adotar a separação entre navegar e organizar, aproveitando o modo de seleção existente.
3. Registrar **Coleções** como evolução concreta a discutir após essa entrega: capas compostas, contagem e entrada própria dentro da Biblioteca são referências agora observadas diretamente. Tags continuam associações pessoais; não viram pastas automaticamente.
4. Não importar a seção “não organizadas” como obrigação de classificar todas as imagens. No projeto, salvar sem tags ou coleção deve continuar sendo um fluxo completo e válido.
5. Não implementar favoritos, colagens, colaboração ou novas modalidades de privacidade por terem aparecido nessa referência.

Capturas adicionais privadas em `/tmp/visual-library-pinterest-review/`: `saved-populated.png`, `board-populated.png`, `board-organize.png`, `board-search.png`, `saved-pin-detail.png` e `all-saved-pins.png`.

## Diagnóstico do projeto atual

| Área | Evidência atual | Efeito |
| --- | --- | --- |
| Entrada | `parseLibraryDestination()` resolve `/` para `explore`; serialização de Explore também usa `/` | O primeiro contato prioriza redescoberta, não o acervo completo |
| Ordem | Explore aparece antes de Library na navegação | A hierarquia reforça a entrada secundária como principal |
| Cabeçalho | Título usa `clamp(32px, 5vw, 54px)`, seguido de navegação e resumo | Ocupa espaço semelhante ao de uma apresentação, antes da atividade principal |
| Captura | `SaveDropzone` aparece acima de todas as telas exceto duplicatas; sticky no desktop, mínimo de 88 px | Upload acompanha a navegação com mais destaque que a busca |
| Controles | Ocultas, modos de busca, busca, sugestões, todas as tags e seleção são blocos sucessivos | A grade começa depois de uma pilha de ferramentas |
| Manutenção | Duplicatas, acesso e saída dividem a navegação com Biblioteca | Operações ocasionais têm peso próximo ao da navegação cotidiana |
| Mobile | Galeria cai para uma coluna até 420 px | Em 390 px, pouca variedade visual cabe na tela |
| Carregamento | `loadImages()` inicia em `onMounted`; `Promise.all` aguarda imagens e tags antes de atribuir as imagens | A galeria depende da conclusão dos dois pedidos, mesmo que as imagens já tenham chegado |
| Estado inicial | Carregamento usa texto; a grade só monta depois da lista | Falta uma estrutura visual reservada para o conteúdo inicial |
| Cartões | `Remove` surge diretamente sobre a imagem no hover | A ação de manutenção recebe destaque em uma atividade de contemplação |

Arquivos centrais: `app/components/LibraryApp.vue`, `app/utils/library-navigation.ts`, `app/composables/useLibraryNavigation.ts`, `app/components/SaveDropzone.module.css`, `app/components/GalleryTagFilters.vue`, `app/components/GalleryGrid.module.css` e `app/components/LightboxViewer.module.css`.

A escolha anterior de abrir em Explore está registrada no plano de navegação persistente como solicitação do usuário. A proposta atual revê essa decisão à luz da preferência expressa agora.

Já estão bem alinhados: canvas branco, vermelho `#e60023`, superfícies neutras, busca arredondada, cartões de 16 px, masonry, proporções preservadas, miniaturas e histórico com restauração de contexto. A principal lacuna é a composição da página e sua hierarquia.

A avaliação local de 03/11 já registrava controles empurrando a galeria móvel para o fim da primeira tela. Após a reconexão do cabo, o enlace passou a 1 Gb/s e as imagens da primeira tela de Library desktop apareceram em 0,670–0,808 s naquele ensaio. Portanto, não cabe atribuir o problema atual ao antigo enlace de 10 Mb/s nem apresentar esses números como medições desta revisão. Referência: `docs/performance/2026-11-03-local-images.md`.

## Proposta de experiência

### 1. Biblioteca como entrada

- `/` abre Biblioteca e destaca esse destino na navegação.
- Explore permanece acessível por `?view=explore`, com seus assuntos e redescoberta.
- `?view=library` continua válido; links com busca, tags, imagem, seleção de redescoberta, similares e duplicatas preservam seus significados.
- Rever parser e serializador juntos: mudar somente o fallback faria links limpos de Explore abrirem a Biblioteca.
- Voltar de um detalhe restaura filtros, posição e foco. Abrir um link direto mantém o contexto indicado pelo endereço.

### 2. Estrutura desktop inspirada na interface autenticada

Proposta de composição, não reprodução literal:

```text
┌────────┬─────────────────────────────────────────────────────────────┐
│ Marca  │ [ Buscar na biblioteca                         ] [+ Adicionar]│
│        ├─────────────────────────────────────────────────────────────┤
│ Acervo │ Biblioteca               [Filtros] [Selecionar] [Mais ⋯]     │
│ Explorar│ [apenas filtros ativos e sugestões contextuais]             │
│        │                                                             │
│        │       Masonry das imagens salvas                            │
│        │                                                             │
│ Ajustes│                                                             │
└────────┴─────────────────────────────────────────────────────────────┘
```

Barra lateral estreita no desktop com Biblioteca, Explorar e utilidades no rodapé. Cada ícone tem nome acessível, tooltip e estado ativo distinguível sem depender só de cor. Cabeçalho de cerca de 64–72 px com busca de 48 px e uma única ação primária. Título compacto de 22–28 px; estatísticas discretas, com tamanho em disco transferido para informações da biblioteca.

Manter inicialmente a largura de conteúdo prevista em `DESIGN.md`, próxima de 1280 px. A barra lateral deve ser considerada no cálculo. A expansão para telas ultralargas pode ser discutida depois; não é necessária para obter a nova hierarquia.

### 3. Captura sob demanda, preservando rapidez

“Adicionar” expande uma área compacta de captura, com arquivos, URL e tags opcionais. Sem wizard. A seleção de imagens de uma página continua no fluxo da página e mantém escolhas, resultados e retries.

Arrastar arquivos sobre a biblioteca revela a área de soltura; colar imagem ou URL continua disponível fora de campos editáveis. Eventos globais não devem interceptar edição de busca/tags. Fechar a área devolve foco ao acionador. Durante captura ou lote, progresso e falhas permanecem visíveis; trocar de tela não perde o trabalho.

É necessário retirar os listeners globais de dentro de uma eventual área desmontada, ou mantê-los ativos na camada da biblioteca. Apenas esconder/desmontar `SaveDropzone` sem esse cuidado poderia quebrar o fluxo atual de colar e arrastar.

### 4. Busca e ferramentas com menos faixas

- Uma busca principal por tela, na mesma posição: biblioteca, assuntos ou similares conforme o contexto. Não adicionar uma segunda busca equivalente abaixo.
- Na Biblioteca, busca normal por tags e nome permanece padrão. Busca por conteúdo fica em opções explícitas, preservando a indicação experimental quando ativada.
- Sugestões de tags aparecem ao focar/digitar. Filtros ativos ficam visíveis e removíveis abaixo da busca; o limite atual de três continua.
- “Todas as tags”, imagens ocultas e duplicatas ficam em controles secundários claramente nomeados. Duplicatas continua acessível em poucos passos, com URL direta preservada.
- “Selecionar” inicia o modo existente; ações de lote aparecem nesse modo. Não criar uma segunda interface de organização.
- Conta, acesso e saída ficam em Ajustes/menu, preservando seu feedback de erro.

### 5. Mobile com imagens na primeira tela

Proposta a validar: busca visível no topo, Biblioteca e Explorar em navegação inferior compacta, e Adicionar como ação de fácil alcance. Nenhuma barra lateral em 390 px. Reservar safe areas e espaço para a navegação inferior não cobrir a última imagem.

Usar duas colunas na largura de 390 px, com gutter de 8 px e margens pequenas. Preservar proporções; em telas muito estreitas ou com zoom, permitir uma coluna conforme a largura útil. Busca e navegação devem continuar legíveis com fonte ampliada. Metas de toque de pelo menos 44 × 44 px, inclusive nos menus dos cartões.

A [referência oficial de boards](https://create.pinterest.com/product-features/how-to-create-boards/) documenta duas colunas como padrão móvel e alternativas larga/compacta. Isso sustenta testar duas colunas; não exige criar um seletor de densidade nesta etapa.

### 6. Carregar primeiro o conteúdo útil

Renderizar a estrutura da Biblioteca imediatamente depois da autenticação, reservando espaço para os primeiros cartões. Não mostrar Explore temporariamente antes do destino correto.

Desacoplar a conclusão da carga de tags da liberação da galeria. A biblioteca pode mostrar imagens enquanto sugestões de tags terminam de carregar ou falham. Priorizar as miniaturas visíveis, mantendo carregamento adiado das demais e dimensões reservadas. Não carregar originais para preencher a grade.

No visualizador, avaliar miniatura como prévia até o original estar pronto e evitar ampliação desnecessária de arquivos pequenos. São melhorias adicionais; a hierarquia da página inicial deve ser entregue antes.

Paginação, compressão e redução do payload ficam condicionadas a nova medição. Não introduzir infraestrutura ou uma reescrita da consulta apenas para acompanhar a mudança visual.

### 7. Cartões e detalhe

Mover Remover para “Mais ações”, acessível por teclado e toque. O clique principal continua abrindo a imagem, e Selecionar continua alternando a seleção apenas no modo correspondente. Não adicionar “Salvar” a uma imagem já pertencente à biblioteca.

Preservar o visualizador atual e sua ampliação. Uma evolução posterior pode colocar metadados ao lado da imagem no desktop, mas só se houver benefício concreto. A versão observada do Pinterest dedica grande área a comentários; copiar essa área criaria vazio ou funcionalidades fora da missão.

## Ajustes necessários no DESIGN.md

O documento é a referência vigente, mas declara que não analisou a interface autenticada e contém generalizações que esta inspeção não sustenta. Antes de implementar, propor um adendo de biblioteca autenticada com precedência explícita sobre trechos de marketing:

1. Barra lateral desktop e busca persistente; remover login/signup como modelo da navegação da biblioteca.
2. Títulos de produto compactos; títulos de 44–70 px ficam restritos a eventual marketing.
3. Duas colunas móveis como proposta a validar, substituindo a regra atual de uma coluna em até 480 px para a biblioteca.
4. Paisagens continuam aceitas e sem recorte. O próprio documento contradiz “never landscape” ao admitir paisagens adiante.
5. Legendas e menus abaixo da imagem podem ser opcionais. A proibição absoluta de metadados abaixo não descreve o Pinterest autenticado observado; não é motivo para adicionar legendas desnecessárias ao projeto.
6. Hover, foco, toque, loading e erros precisam de regras explícitas. O trecho que exclui hover da documentação deixa uma lacuna para ações contextuais.
7. Contratos de acessibilidade devem exigir área real de interação de 44 px; 40 px visuais só são aceitáveis se a área acionável for efetivamente maior.

Manter tokens existentes de cor, espaçamento e raios. Não há necessidade de adquirir Pin Sans ou introduzir outra biblioteca de componentes. Não copiar chips coloridos ou mais ícones apenas por estarem presentes no concorrente.

## Ordem sugerida e critérios de aceite

**Primeira entrega:** entrada em Biblioteca, nova hierarquia de navegação/busca, captura recolhida, controles secundários agrupados e duas colunas móveis. Atualizar o contrato visual junto dessa entrega. Sem coleções novas ou reconstrução do viewer.

**Segunda entrega:** remover dependência de tags para exibir imagens, reservar estrutura de loading e medir a entrada. Melhorar a prévia do visualizador se a espera continuar perceptível.

**Depois do uso:** reavaliar se faltam coleções intencionais. Os assuntos de Explore são derivados de tags; não devem ser renomeados para Pastas, pois isso confundiria conceitos que a constituição distingue.

Critérios propostos para validar a implementação:

- Abrir `/` ou recarregá-la leva à Biblioteca; `/?view=explore` continua abrindo Explore, e links existentes preservam seus destinos.
- Em 1440 × 1000, primeira linha de imagens começa até cerca de 180 px do topo, com captura recolhida e sem filtros ativos. Em 390 × 844, até cerca de 220 px, com duas colunas. São metas de layout, não medições atuais.
- Navegação, busca e captura funcionam por teclado; menus não dependem de hover; não há overflow horizontal nem conteúdo encoberto pelas barras.
- Retorno do viewer e do navegador mantém contexto, scroll e foco; links diretos e abertura em outra aba continuam válidos.
- Arrastar, colar, salvar URL, selecionar imagens de página, salvar lote e retentar falhas continuam disponíveis; navegação não apaga trabalho ativo.
- Falha ou lentidão de tags não bloqueia imagens já recebidas. Loading reserva espaço e não provoca saltos grandes na grade.
- Comparar desktop e mobile antes/depois com o mesmo conjunto de imagens e rede. Registrar início da grade, tempo da primeira imagem, imagens visíveis e deslocamento de layout.
- Testar parser/serializador e regressões dos destinos; executar os checks do projeto quando houver código alterado. Esta análise documental não executou testes de implementação.

## Fontes públicas complementares

- [O que é o Pinterest](https://help.pinterest.com/en/guide/all-about-pinterest): descoberta visual e salvamento em pastas.
- [Organizar pastas](https://help.pinterest.com/en/article/organize-your-boards): acesso por Salvos, ordenação e contexto de organização.
- [Criar pastas](https://create.pinterest.com/product-features/how-to-create-boards/): exemplos visuais, relação entre pins e pastas e densidade móvel.

As observações da sessão autenticada descrevem a versão entregue à conta nesta data; não pressupõem uma interface idêntica para todas as contas ou testes do Pinterest.
