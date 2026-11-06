# Plano — navegação centrada na Biblioteca

Status: implementação autorizada e concluída localmente em 06/11/2026 após aprovação da composição e dos dois passos de visualização. Escopo na [spec](spec.md). Sem mudança de versão, dados de produção ou deploy.

## Base e cuidados encontrados no código

- `LibraryApp.vue` concentra destinos, dados, captura, filtros, seleção e viewer. Preservar essas fontes de estado; não criar um router ou store paralelo.
- `library-navigation.ts` interpreta a raiz como Explore e também serializa Explore como raiz. Alterar ambos no mesmo passo.
- `useLibraryNavigation.ts` preserva snapshots, posição, foco, contexto de Explore e origem de similares/duplicatas. `library-history.client.ts` captura history.state antes da inicialização do Nuxt. Manter o mecanismo existente.
- `SaveDropzone.vue` recebe paste/drop na própria superfície, não por listeners globais. Ao recolher essa superfície, a nova composição precisa oferecer os atalhos na camada da biblioteca; não presumir que eles já existem globalmente.
- Estado de captura e progresso pertence a `LibraryApp.vue`; `PageImageSelection` tem sua própria seleção e prévias. Não desmontá-la ao recolher a entrada de captura ou ao trocar de destino.
- `GalleryTagFilters.vue` contém busca, modos, sugestões e todas as tags. `TagExploreGrid.vue` contém outra busca para assuntos. Reorganizar a apresentação sem manter dois campos equivalentes na mesma tela.
- `LightboxViewer.vue` já separa detalhe com relacionadas e ampliação, com restauração de foco. `LightboxViewer.module.css` já distribui relacionadas nas laterais e abaixo. O protótipo não deve substituir essa implementação.

## 1. Trocar a entrada padrão preservando endereços

Em `app/utils/library-navigation.ts`:

- Interpretar ausência de view como Biblioteca; continuar aceitando view=library e links antigos com critérios.
- Serializar Explore explicitamente como view=explore, inclusive sem consulta. Biblioteca limpa pode usar `/`; manter seus critérios quando presentes.
- Preservar parâmetros de outros fluxos, hash, validação e os contratos de seleção, assunto, similares, duplicatas, ocultas e busca por conteúdo.

Revisar URLs literais na aplicação e testes, sem substituir indiscriminadamente toda referência a `/`. Ajustar `tests/library-navigation.test.ts` e cobrir os dois defaults, roundtrips, links antigos e refinamentos. Os testes atuais que esperam Explore na raiz precisam refletir a decisão nova.

## 2. Recompor navegação e busca

Em `LibraryApp.vue` e seus estilos:

- Organizar a superfície em barra lateral desktop, cabeçalho de busca, conteúdo e navegação inferior móvel, conforme o protótipo aprovado.
- Usar os métodos e links de `useLibraryNavigation` nos acionadores. Biblioteca vem primeiro, com estado ativo acessível; relacionados mantêm o destino de origem ativo.
- Colocar Adicionar no cabeçalho desktop e na navegação móvel. Ajustes contém acesso e saída; Mais contém ocultas, duplicatas e informações. Reaproveitar `LibraryAccessControls.vue`, preservando estado de erro e busy.
- Usar componentes pequenos específicos apenas onde evitarem duplicar controles desktop/mobile ou isolar menus acessíveis. Não criar um sistema genérico de layouts, menus ou ícones.
- Limitar título a 22–28 px; manter contagem discreta e mover peso em disco para informações. Retirar a faixa permanente de ocultas da entrada padrão.

Adaptar `GalleryTagFilters.vue` e `TagExploreGrid.vue` para que busca e refinamentos possam ocupar a nova composição. A mesma query, filtros por ID e eventos atuais continuam comandando os resultados. Se necessário, separar um campo de busca específico e manter a lógica de tags no componente atual; não duplicar seu estado.

Sugestões aparecem sob demanda, com foco e fechamento previsíveis. Filtros ativos continuam em fluxo normal abaixo do cabeçalho. Todas as tags e opções de modo usam uma superfície secundária. Busca por conteúdo continua explícita e preserva preparo/erro/submit; não converter a consulta submetida em busca automática.

Nas telas de assunto, mostrar escopo e ação para ampliar a busca à Biblioteca. Em similares e duplicatas, não inventar uma busca local que suas APIs não suportam: uma busca no cabeçalho deve indicar que consulta a Biblioteca e levar a ela explicitamente.

## 3. Captura sob demanda sem perder ações

Manter `SaveDropzone.vue` montado, com visibilidade da área de entrada controlada e progresso/erros fora da região recolhível quando necessário. Usar expansão em fluxo da página, evitando um modal longo contendo candidatas.

- Adicionar expande e foca a captura. Fechar recolhe quando não houver operação ativa; retorno ao acionador precisa funcionar no desktop e no mobile.
- Implementar recebimento de paste/drop na camada da biblioteca para funcionar com a entrada recolhida. Ignorar inputs, textarea, contenteditable e eventos já tratados. Aceitar drag somente de arquivos, sem interceptar seleção de texto ou navegação por links.
- Reutilizar parsing/validação de arquivos e URLs, `handleSave`, `handleSaveUrl` e bloqueios de operação existentes. Evitar que handlers locais e da camada pai processem o mesmo evento duas vezes.
- Em descoberta ou salvamento, manter progresso visível; recusar novas operações com a mensagem atual, sem sobrepor requisições.
- `PageImageSelection` fica fora do sticky, preservando escolhas e prévias ao navegar. Fechar seleção continua uma ação explícita; recolher a entrada não equivale a descartar seleção.
- Ao concluir, exibir aviso/resultados e falhas sem roubar scroll/foco. Retry só reenvia falhas recuperáveis; o seletor de arquivos continua utilizável após erros.
- Rever `closePageCapture` e seletores de foco que hoje supõem captura permanentemente visível. Nenhum foco deve voltar a um elemento oculto.

Se handlers de transferência forem extraídos para reaproveitamento, usar utilitário específico de captura, sem um mecanismo genérico de eventos.

## 4. Galeria, seleção e menus

Em `GalleryGrid.vue` e `GalleryGrid.module.css`:

- Manter masonry, miniaturas, dimensões e clique principal. Duas colunas em 390 px; permitir uma em largura útil muito pequena. Dimensionar a grade pelo espaço disponível após a barra lateral.
- Colocar Remover em Mais ações do cartão, mantendo o handler e o contrato de remoção existentes. Menu deve funcionar por toque, teclado e Escape, sem depender de hover.
- Preservar `data-lightbox-open-id`, links reais e abertura em outra aba. Em seleção, o cartão continua selecionando, sem abrir o detalhe.
- Manter `GalleryBulkTags.vue` e os estados atuais de busy/erro. Reposicionar o acionador Selecionar e mostrar operações de lote somente no modo ativo.

Menus secundários devem preservar foco, fechar ao sair e respeitar viewport. Não introduzir confirmação ou exclusão diferente da atual por efeito da mudança visual.

## 5. Preservar detalhe e ampliação

Integrar o viewer existente à nova moldura visual. Verificar o empilhamento e os offsets de `LightboxViewer.module.css` para que a navegação e a busca permaneçam presentes no detalhe sem cobrir imagem, botões ou relacionadas. Não transplantar o layout simplificado do HTML de revisão.

- Clique no cartão abre detalhe, com relacionadas ao lado e abaixo no desktop; no mobile, abaixo.
- Botão sobre a imagem abre a ampliação existente. Só essa superfície ocupa o viewport com foco exclusivo na imagem.
- Escape fecha a camada mais interna: primeiro ampliação, depois detalhe. Fechar ampliação preserva scroll e devolve foco ao botão.
- Navegar por relacionadas mantém o histórico atual do viewer; voltar à galeria restaura filtros, posição e cartão.
- Usar busca a partir do detalhe deve refinar um destino válido de Biblioteca, fechando o viewer pelo mecanismo existente. Evitar pushState manual ou uma segunda pilha de histórico.

Não mudar algoritmos de relacionados, similares ou carregamento dos originais nesta entrega.

## 6. Estados iniciais e responsividade

Reservar uma estrutura visual estável durante a carga inicial e renderizar diretamente a tela pedida após autenticação. Reutilizar dimensões conhecidas e lazy loading atual. Tratar falhas de carga com ação de retry visível.

Rever padding de `.page`/conteúdo e os breakpoints para considerar a barra lateral. No mobile, reservar altura da navegação inferior e safe areas; garantir que os últimos cartões e menus permaneçam alcançáveis. Manter foco visível sob o cabeçalho sticky, inclusive ao restaurar posição.

Não ampliar este passo para paginação, compressão, novo cache ou mudança do modelo de imagens. Desacoplar a carga de tags do primeiro conteúdo fica para a entrega de desempenho, conforme a spec.

## 7. Verificação e entrega local

Usar armazenamento temporário com imagens e tags de fixture. Não autenticar por redefinição da senha do dono nem fazer upload/exclusão no acervo real. Preservar os arquivos de avaliação locais já presentes em `docs/performance/`.

Checks automatizados:

- Testes de navegação ajustados, incluindo raiz, Explore explícito e roundtrips dos demais destinos.
- Regressões pertinentes de viewer-history, image-upload, page-image-selection, busca e visibilidade, usando os testes existentes. Acrescentar casos apenas para comportamento novo ou risco real, como não capturar paste em campos editáveis e não processar duas vezes uma transferência.
- `npm test`, `npm run build` e `git diff --check`. Investigar falhas; não atualizar snapshots/expectativas apenas para mascarar regressões.

Smoke Playwright na aplicação implementada:

- Desktop 1440 × 1000; mobile 390 × 844; larguras 320 e 768; zoom equivalente a 200%. Conferir primeira linha da grade, número de colunas, overflow, safe areas e última imagem.
- Busca normal, filtros combinados, sugestões, assunto, ampliação do escopo e modo experimental sem preparo automático.
- Arquivos, URL direta, página HTML, paste fora/dentro de campos, drop com captura recolhida, lote, falha e retry. Mudar de destino com seleção pendente deve preservar trabalho.
- Card → detalhe → relacionada → voltar → ampliação → fechar → galeria. Conferir navegação/relacionadas presentes, foco, scroll e contexto, além de links diretos, recarga, voltar/avançar e outra aba.
- Seleção e tags em lote; imagens ocultas, duplicatas, informações, acesso e saída. Menus e overlays por teclado, Escape e toque.
- Estados vazio, carregando, erro e captura ocupada; ausência de exceções JavaScript e de requisições inesperadas aos originais na grade.

Inspecionar capturas desktop/mobile e registrar resultados reais neste plano. A aprovação do protótipo não equivale à aprovação visual automática da aplicação final.

## Limites da entrega

Sem novas dependências planejadas, migração, coleções, tradução integral, mudança de versão ou publicação. Ao terminar, fornecer resumo das alterações, evidências de validação e limitações restantes. Deploy permanece fora deste plano.

## Resultado da implementação e validação — 06/11/2026

### Alterações entregues

- Raiz abre Library; Explore é serializado com view=explore. Library limpa usa a raiz, enquanto links refinados continuam explícitos para preservar contratos de compartilhamento. Adicionado teste de raiz, URL de Explore e roundtrip de link legado com busca, tag e imagem.
- Barra lateral no desktop, cabeçalho com busca e navegação inferior no mobile. Título compacto e contagem discreta; armazenamento e total de tags ficam em informações. Ocultas, duplicatas e informações ficam em Mais; acesso e saída, em Ajustes.
- `LibraryIcon.vue`, `LibraryMenu.vue` e `LibrarySearch.vue` isolam os ícones, a superfície de opções e o campo de busca. Continuam usando queries, destinos e eventos existentes; sem dependência nova. Menus fecham com Escape/saída e retornam foco; opções mais longas usam dialog nativo.
- Filtros e busca experimental foram reposicionados em diálogo, mantendo estados e contratos. Filtros ativos ficam visíveis na página. Explore usa a busca do cabeçalho; assuntos têm escopo explícito e ação para buscar na biblioteca inteira. Em similares/duplicatas, o cabeçalho indica busca na biblioteca com Enter.
- Captura permanece montada, recolhida por padrão, com URL explícita além do seletor de arquivos. Paste/drop fora dos campos passam pela camada da biblioteca; campos editáveis preservam colagem normal, inclusive o novo campo de URL. Handlers locais e globais não duplicam o envio.
- Captura, seleção de página e resultados sobrevivem às trocas de tela. Progresso aparece no acionador fixo e na captura; falhas e retry permanecem acessíveis quando recolhida. Retry reabre a superfície. Abrir captura traz seus controles à vista, cancela restauração de scroll concorrente e usa a posição relativa também no mobile. Fechar retorna ao acionador visível.
- Seleção em lote mantém o componente existente. Remover passou ao menu do cartão. Grade mantém miniaturas/proporções e tem duas colunas em 390 px; há placeholders estáveis na carga inicial.
- O visualizador existente foi preservado, incluindo distribuição de relacionadas e seu histórico. Detalhe é uma região contextual com cabeçalho e navegação acessíveis; conteúdo da galeria atrás dele fica inert. A ampliação usa dialog nativo para ocupar o viewport, conter foco e tornar o restante da aplicação inerte enquanto aberta. Escape e foco de retorno foram preservados.
- Corrigida uma disputa de histórico detectada na repetição de reload/fechar: o popstate agora prioriza a URL da entrada capturada em event.state, em vez de reler uma location que o Nuxt pode ter substituído pela URL de saída. Isso evita reabrir a imagem ao tentar fechá-la.

### Evidências

- `npm test`: 86 testes passaram, sem skips. `npm run build`: passou. `git diff --check`: passou. Sem alteração em package.json/package-lock.json.
- `DESIGN.md` lintado com a ferramenta indicada no próprio documento: saída sem erros, com 18 warnings e um info nos tokens/componentes existentes. Nenhum token foi alterado nesta entrega.
- Playwright com Chrome headless e biblioteca temporária criada em `/tmp/visual-library-031-app-iT1Tbe/`, inicialmente com 24 PNGs sintéticos, tags e sessão próprios. Uploads, tags e remoção de teste ocorreram somente nessa fixture. Não houve autenticação, importação ou remoção no acervo real.
- Primeira imagem da grade a 152 px do topo em 1440 × 1000 e 144 px em 390 × 844, sem captura/status ativos. Duas colunas no mobile. Status temporário de resultado acrescenta uma faixa; a grade permaneceu dentro da meta de 220 px na rodada após retry.
- Verificados filtros, busca, proteção de paste em busca e campo de URL, seleção/tags em lote, um único envio por drop, remoção no menu, ocultas, duplicatas, informações e Ajustes.
- Verificados detalhe com relacionadas, navegação entre imagens, retorno, ampliação/fechamento, foco e busca a partir do detalhe. Capturas desktop/mobile inspecionadas. Sem overflow horizontal em 320, 390, 768, 1440 e 1920 px; viewport de 720 px usado como aproximação de largura útil em zoom. Isso não substitui validação em celular físico ou auditoria completa de zoom/acessibilidade.
- Captura HTML e prévias usaram respostas de transporte controladas no navegador: escolhas permaneceram ao recolher e mudar para Explore. Os testes HTTP existentes continuam cobrindo o backend real de descoberta, segurança e salvamento. Arquivo duplicado usou o backend real da fixture; uma resposta 503 controlada validou retry da captura recolhida sem reenvio extra.
- Reload do detalhe e retorno com foco/scroll passaram. Depois da correção de popstate, cinco repetições consecutivas passaram; um sexto caso simulou deliberadamente a troca da URL pela URL de saída antes do listener e confirmou que a entrada capturada prevalece. A rodada completa final também passou sem exceções JavaScript.

Scripts, logs e capturas de avaliação ficaram em `/tmp/visual-library-031-*.mjs`, `/tmp/visual-library-031-*.log` e no diretório da fixture. A instância local da fixture pode ser usada para revisão visual, sem apontar para o armazenamento do projeto.

### Limites e trabalho fora do escopo

- Não foi adicionada ferramenta de typecheck ao projeto. Uma verificação adicional com vue-tsc/TypeScript temporários, após regenerar tipos do Nuxt, não ficou limpa: apontou inferência recursiva de rotas em ApplicationTokensPage, chaves opcionais de CSS modules, tipagem de middleware e tipos de Node importados por módulos do servidor. Esses padrões já existem nos trechos correspondentes; não se apresenta essa verificação como aprovada nem se amplia a entrega para uma migração de tipagem.
- O processo local em Node 26 registrou avisos/erros de FileHandle na coleta de streams cancelados durante rodadas repetidas de reload. As rotas de arquivos não foram alteradas; isso não foi corrigido ou apresentado como validação do ciclo de vida de streams. Os smokes funcionais finais passaram.
- Modelo de similaridade não foi preparado na fixture. A composição do detalhe foi validada com relacionados/fallback existentes, sem avaliar ranking ou desempenho de inferência.
- Mantidos fora: coleções, redesenho de metadados do viewer, prévia progressiva do original, paginação, desacoplamento da carga de tags, tradução completa, mudança de versão e deploy.

### Preparação da release 0.23.0

Após concluir a implementação, o usuário solicitou avançar a versão e fazer a release. package.json e package-lock.json foram sincronizados em 0.23.0. O build Docker passou; o contêiner da imagem final foi validado com setup/login, upload de uma fixture, entrada na Library, detalhe/ampliação, retorno e captura em 390 px, sem exceções JavaScript. Armazenamento isolado em volume anônimo do contêiner, removido ao encerrar a avaliação. Distribuição segue `make release VERSION=0.23.0`, com tags de imagem 0.23.0 e latest. Instalação em produção permanece separada da publicação da imagem. Notas em [0.23.0](../../releases/0.23.0.md).

### Publicação e confirmação em produção

- Código enviado para main no commit `dd98413` (`feat: prioritize library navigation in v0.23.0`).
- `make release VERSION=0.23.0` concluído. Tags remotas 0.23.0 e latest conferidas com o mesmo digest: `sha256:d162f4c5ac4ffa03f02d27f004c605ecd94944be42064c64d7c38afb81d9d2b6`.
- O usuário confirmou que testou em produção e que está funcionando. Não relatou nova falha nessa validação; isso não substitui uma auditoria de todos os fluxos ou dos limites técnicos acima.
- A primeira entrega de navegação está concluída. Próxima prioridade sugerida: investigar os erros locais de FileHandle em streams cancelados durante reload; depois organizar a checagem de tipos. Prévia do original e carga da galeria independente das tags continuam como melhorias posteriores, não como requisitos faltantes da navegação entregue.
