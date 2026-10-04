# Plano técnico: navegação persistente por assunto

Status: implementado após pedido de continuidade do usuário em 2026-10-04. Escopo em [spec.md](spec.md); resultados abaixo.

## 1. Representar a navegação no endereço raiz

Manter app.vue e as telas atuais no caminho `/`, usando parâmetros de consulta. Não criar uma árvore paralela de páginas ou outra galeria.

| Contexto | Endereço ilustrativo |
| --- | --- |
| Library | `/?view=library` |
| Explore | `/?view=explore&q=manara` |
| Assunto | `/?view=subject&subject=<tag-id>` |
| Assunto refinado | `/?view=subject&subject=<tag-id>&q=wallpaper&tag=<outro-tag-id>` |
| Imagem aberta | Endereço da galeria + `&image=<image-id>` |

Explore sem busca usa `/`. Library também admite q, tag repetido e image. Explore admite q, mas não filtros de imagens ou visualizador. Usar IDs persistidos para identidade de assunto/filtros e URLSearchParams para codificação; nomes exibidos vêm do acervo. A tag base fica em subject, não deve reaparecer entre tags adicionais. O limite de três conta a base.

Adicionar app/utils/library-navigation.ts com tipos concretos de destino e funções puras de parse/serialize/validação. Preservar valores inválidos como problemas recuperáveis, sem descartá-los silenciosamente. Normalizar parâmetros válidos sem alterar critérios de busca nem unir identidades distintas.

Duplicação da tag base ou de um mesmo filtro pode ser normalizada por não alterar o conjunto lógico. Tela inválida, campos obrigatórios ausentes, combinações incompatíveis e excesso de filtros produzem estado de problema com recuperação explícita. Parâmetros alheios ao app não se tornam filtros e devem ser preservados nas alterações da URL quando possível.

## 2. Inicializar no destino correto

Ler useRequestURL() durante setup para obter o mesmo destino no SSR e na hidratação. O composable foi conferido no Nuxt instalado: resolve a URL da requisição no servidor e location.href no cliente.

Inicializar tela/query/IDs antes de renderizar a entrada padrão. Para assunto sem nome carregado, mostrar título contextual neutro de carregamento; não renderizar Saved visuals primeiro. Resolver IDs depois do carregamento inicial de imagens e tags.

Manter falhas de carregamento separadas de ausência real. Retry conserva o destino pedido, seus critérios e imagem solicitada. Versões de carregamento/navegação impedem uma resposta de metadados antiga de resolver um destino que já mudou.

Os resumos atuais de /api/tags omitem tags vazias. Acrescentar GET /api/tags/[id] apenas para resolver metadados de uma tag ausente dos resumos: ID, nome, normalizedName e contagem, incluindo zero. Consultar o banco existente, sem migração. Usar para base/filtros não resolvidos, em quantidade limitada pelo fluxo, reutilizando metadados já carregados.

Se a base existir com zero imagens, manter seu nome e grupo vazio. Se não existir, mostrar destino indisponível. Filtro válido com zero imagens continua sendo um filtro exato com zero resultados; ID inexistente gera critério indisponível e resultados bloqueados até remoção explícita.

## 3. Histórico nativo com estado específico

Usar history.pushState/replaceState e um único listener de popstate para este app no caminho raiz. Centralizar as chamadas numa implementação pequena e específica, preferencialmente app/composables/useLibraryNavigation.ts. Não adicionar biblioteca, roteador independente ou motor genérico de histórico.

Guardar em um campo próprio de history.state um registro versionado: chave da entrada, posição relativa, tipo (galeria/diretório/visualizador), referência à entrada da galeria de origem quando houver, posições/foco e referências aos contextos internos conhecidos. Preservar campos de history.state de outros recursos.

A URL é fonte de verdade para tela, critérios e imagem. history.state é apenas metadado de origem/posição; se estiver ausente ou incompatível, tratar como entrada direta, sem inventar dados do acervo. Não usar comprimento do histórico ou document.referrer para inferir que existe uma origem segura dentro do app.

- Mudar de tela ou abrir o viewer: salvar a entrada anterior e fazer push da nova.
- Busca/filtros/limpar: replace da entrada atual.
- Setas, relacionadas e Back interno do viewer: replace apenas da imagem atual; galeria de origem permanece referenciada.
- Popstate: aplicar destino e restaurar contexto, sem gerar push/replace em reação aos próprios watchers.
- Selecionar de novo a tela/imagem atual: no-op para histórico.

Capturar posições nas transições e manter metadados da entrada ativa atualizados com mudanças relevantes de rolagem/foco, sem escrita por cada frame. No popstate, o navegador já selecionou outra entrada: guardar o contexto de saída no registro em memória da chave anterior, nunca substituir a entrada de destino com os dados da saída.

Um registro em memória por chave de entrada pode complementar history.state durante a sessão. Não guardar imagens completas, File, seleção em lote ou excursões internas. Nenhum histórico global permanente ou localStorage de visitas.

## 4. Conciliar a camada do visualizador

Antes de abrir uma imagem pela galeria, persistir a origem sem image e empilhar uma única entrada de viewer. Essa entrada guarda a galeria, sua chave e alvo original de retorno, mesmo quando a imagem atual passa a estar fora dos resultados por uma conexão.

Fechar por X/Escape usa history.back quando a camada tiver origem interna confirmada. Popstate fecha e restaura a galeria. Avançar reaplica a imagem representada na entrada do viewer e começa com viewerHistory vazio. O Back interno de 010 continua usando recordViewerVisit/popViewerVisit; não persisti-lo no histórico nativo.

Ao abrir diretamente uma URL com imagem, estabelecer uma origem segura: substituir a entrada inicial pelo mesmo destino sem image e empilhar uma camada de viewer após validar a imagem. Isso oferece o primeiro Voltar para a galeria e o seguinte para o histórico real anterior. Marcar as entradas para não repetir essa preparação após reload de uma camada já estabelecida.

Reload recupera a imagem atual pela URL, sem recriar a excursão ou aumentar repetidamente o histórico. Se a imagem não existir, permanecer na galeria com aviso e ajustar a entrada para não manter uma camada inválida. Não substituir por outra imagem.

Tag escolhida no viewer mantém seu significado de refinamento. Aplicar o filtro aos critérios da galeria de origem e atualizar essa entrada quando ela se tornar ativa no fechamento, usando dados locais da operação. Não acrescentar uma nova página, não perder o refinamento no popstate e não adulterar uma entrada de outro assunto. O caso de filtro recusado mantém o viewer e sua entrada intactos.

## 5. Retornos e contextos independentes

Substituir os dois únicos snapshots globais de posição por snapshots identificados pela entrada do histórico. Duas visitas ao mesmo assunto com filtros diferentes devem ser restauráveis separadamente.

Preservar os contextos independentes de Library/Explore existentes em 012. As referências de origem da entrada permitem que Back to Explore recupere o diretório correto, não apenas a última visita de qualquer caminho.

Se a origem Explore existir em entradas internas conhecidas da aba, retornar a ela sem criar um ciclo artificial de assunto/diretório. Se não existir, navegar explicitamente a Explore sem busca e no início; não executar history.back indiscriminadamente. O link sempre terá href interno válido para abertura em outra aba.

Após reload, usar referências de origem disponíveis no estado da aba; um endereço isolado em outra aba começa sem esses contextos. Não prometer transportar rolagem/foco pelo link.

Reutilizar a restauração limitada de 012, com versão de transição, foco preventScroll e cancelamento por interação. Gerenciar history.scrollRestoration durante a montagem para evitar disputa com restauração manual e restaurar seu valor anterior ao desmontar. Registrar destino antes de operações assíncronas; nenhuma promessa de posição exata com acervo alterado.

## 6. Links, estados indisponíveis e feedback

Transformar os acessos Library/Explore, os cartões de assunto e o retorno explícito em links nativos com href gerado pelo serializador. Interceptar apenas clique primário sem modificadores para transição interna; preservar Ctrl/Cmd, botão do meio, menu de contexto e nova aba.

Nos cartões de imagens, manter botão durante seleção e oferecer link para a imagem quando fora da seleção, com a mesma aparência. Não alterar dimensionamento ou conteúdo do viewer. Dar foco visível aos anchors, pois as regras globais atuais cobrem principalmente button/input/tabindex.

Durante aplicação em lote, sinalizar indisponibilidade dos controles explícitos e impedir clique simples por guarda no handler; abertura em outra aba não modifica a operação original. Não tentar bloquear o histórico nativo com ciclos artificiais de popstate.

Mostrar problemas de destino/filtros no conteúdo, usando tokens neutros de DESIGN.md e controles de recuperação de 44px. Para filtro indisponível, apresentar identificação segura do critério e ação de remover; não tentar tratá-lo como uma tag válida nem exibir a galeria ampliada.

Atualizar título do documento por contexto com useHead: nome do assunto quando resolvido, Explore ou Saved visuals. Não alterar o título por cada letra digitada. Manter avisos de erro/remoção fora de notificações por mudança de URL.

Exclusão de imagem no fluxo atual conserva a reconciliação de filtros de 012; se ela remover filtros, atualizar a URL da galeria correspondente e informar a retirada. Um filtro ausente em link antigo não é descartado automaticamente. Tag base permanece protegida.

## 7. Operações em andamento

Manter captura, images, resultados de upload e estado de requests no app.vue acima das seções de destino. Não remountar o app a cada parâmetro modificado. Testar que link direto/reload é atendido pelo servidor no mesmo caminho raiz.

Em applyBulkTags, capturar IDs, tags, chave/contexto de origem e versão de seleção antes do await. A resposta atualiza apenas os IDs retornados e metadados do acervo. Limpar seleção/mostrar feedback local apenas se ainda pertencer àquela operação/contexto. Se o histórico tiver mudado, dar resultado discreto sem aplicar efeitos de seleção, query ou foco na nova tela.

Separar saída de seleção por navegação nativa da guarda atual de exitSelection durante applyingTags: limpar a seleção temporária sem cancelar o request. Guardas de cliques explícitos continuam. PendingTagSaves individual já é associado por ID; preservar e testar fechamento/retorno durante saves.

Remover listeners/observers e cancelar tarefas/versionar respostas no teardown. Reload não promete conclusão de upload ou retomada de operação em andamento.

## 8. Validação

Testar regras de parse/serialize e decisões de transição que tenham valor independente do DOM: IDs especiais, queries, tags repetidas, base protegida, limite, combinações inválidas, URL com imagem fora do assunto e ida/volta sem perda dos critérios. Não criar testes que apenas espelhem chamadas a pushState.

Teste de API com SQLite temporário para lookup de tag com imagens, tag vazia e ID inexistente; sem tocar no acervo real.

Browser de produção e biblioteca isolada:

- Library/Explore/assunto por entrada direta e reload, inclusive URL refinada e nova aba real com Ctrl/Cmd ou botão do meio.
- Explore pesquisado/rolado → assunto → refinamentos → imagem A → relacionada B; Voltar fecha para a galeria, Avançar abre B, próximo percurso de Voltar retorna ao diretório correto.
- Digitar várias letras/adicionar/remover filtros não cria passos extras; visitas repetidas ao mesmo assunto com critérios distintos mantêm entradas separadas.
- X/Escape sem entradas duplicadas, Back interno separado, reload sem excursão e repetidos reloads sem empilhar camadas.
- URL direta com imagem vinda de um histórico externo: primeiro Voltar fecha a imagem, segundo deixa o app; Back to Explore continua interno.
- Filtro explícito pelo viewer persiste na origem após fechar; excesso mantém viewer intacto.
- Assunto vazio/desconhecido, filtro removido, imagem fora dos resultados/removida, parâmetro inválido, API lenta/falha e retry mantendo destino.
- Voltar/Avançar durante POST em lote e edição individual; upload durante navegação; respostas fora de ordem; origem desaparecida; interação interrompendo restauração.
- Teclado, foco/rolagem, alvos de 44px, títulos e screenshots em320/390px, tablet e desktop. Medir espaço da imagem para confirmar que a integração não adicionou chrome no viewer.

Executar npm test, npm run build e git diff --check. Registrar cenários efetivamente validados e separar touch físico/leitor de tela de testes sintéticos.

## Arquivos e entrega

Modificar app/app.vue, TagExploreGrid.vue/CSS, GalleryGrid.vue/CSS e estilos dos links necessários. Adicionar utilitário de destino, composable específico se justificar a separação, lookup de tag no servidor e testes correspondentes. Nenhuma nova dependência ou migração de banco.

Entregar endereços, reload, histórico da camada e retorno contextual juntos. Após validar, atualizar specs005/006/010/012, BACKLOG.md e roadmap para suas novas fronteiras. Não marcar esta etapa implementada ou validada antes disso. Versionamento, commit e push seguem pedidos do usuário na entrega.


## Implementação e validação executadas — 2026-10-04

Endereços centralizados em library-navigation.ts; estado da aba e transições em useLibraryNavigation.ts. Os cartões e acessos usam anchors nativos. O lookup de tags utiliza o SQLite existente e distingue grupo vazio de ID ausente. Operações em lote capturam IDs/tags e chave de origem antes do request; respostas após navegação não alteram os critérios ou a seleção da nova tela.

A integração exigiu um pequeno plugin cliente para capturar history.state antes do hook app:created do roteador raiz do Nuxt 4.4.6, que o substitui. Um afterEach preserva os metadados próprios também após popstate e a URL refinada pelo viewer durante o fechamento. Sem alterar APIs do navegador ou acrescentar dependências. Reload repetido e refinamento seguido de Voltar/Avançar foram testados especificamente contra essa interação.

Validação executada:

- npm test: 29 testes passaram, incluindo parse/serialize, critérios inválidos, identidade exata e lookup SQLite para tag preenchida, vazia e ausente.
- npm run build: produção concluída; git diff --check sem erros.
- Chrome headless com servidor de produção e acervo SQLite temporário: Library/Explore/assunto, buscas e refinamentos sem passos adicionais, viewer com conexões fora dos resultados, Voltar/Avançar e reload sem camada duplicada. Avançar/reload começam sem excursão interna.
- Filtro escolhido no viewer permanece na galeria e no Avançar; entrada direta refinada, retorno explícito sem origem, filtro ausente com remoção explícita, assunto/endereço inválido e imagem removida têm recuperação.
- Rolagem/foco do cartão restaurados no Voltar; Escape retorna foco à miniatura sem empilhar entradas. Ctrl-clique real abre uma nova aba no assunto e mantém o diretório original.
- Assunto existente vazio conserva nome; falha de lookup oferece retry sem perder query.
- POST de tags em lote retido durante Voltar: somente os IDs capturados são atualizados; destino e seleção temporária não são reaplicados à nova tela. Edição individual retida durante fechamento nativo conclui na imagem correta, reapresentada atualizada no Avançar.
- Upload retido durante Voltar continua e salva sem herdar a tag base do assunto. Entrada de viewer a partir de about:blank fecha primeiro para a galeria; o Voltar seguinte sai do app.
- Screenshots inspecionados e ausência de overflow horizontal em 320, 390, 768 e 1440px. Sem alterações no dimensionamento da imagem do viewer. Nenhuma exceção JavaScript no roteiro do navegador.

Scripts e screenshots de browser foram produzidos em /tmp/visual-library-connected-check, sem nova dependência de teste e sem tocar no acervo real. Touch físico, leitor de tela, todas as combinações de respostas fora de ordem e avaliação cotidiana com o acervo do usuário permanecem pendentes. A validação não afirma benefício de uso real.

Versão avançada para 0.4.0 a pedido do usuário, com package.json e package-lock.json sincronizados. Entrega da versão 0.4.0 autorizada pelo usuário para commit e push em main.


## Revisão contra DESIGN.md — 2026-10-04

Revisada a apresentação da navegação persistente: labels compactas de Explore, imagem sem padding, cantos de 16px, gutters de 8px, links com foco visível e vermelho reservado à ação principal/estado ativo. Corrigido o contorno de seleção que encobria o foco azul das miniaturas. Os controles de recuperação usam button-secondary e seu estado pressionado, com espaçamento de 8px via flex gap, quebra em telas estreitas e alvos mínimos de 44px.

Build 0.4.0 e git diff --check passaram. O roteiro Chrome de produção passou novamente, incluindo medição dos tokens/altura dos controles de recuperação, foco azul por teclado em imagem selecionada e ausência de overflow nas quatro larguras. A revisão preserva a apresentação compacta aprovada e o espaço do viewer; não representa auditoria completa de acessibilidade dos componentes anteriores.


## Entrada inicial em Explore

A pedido do usuário após a entrega 0.4.0, o acesso raiz sem critérios abre Explore e Library passa a usar view=library. Endereços antigos sem view que contenham q, tag ou image preservam o contexto Library. Parse/serialize e recuperação foram ajustados juntos. npm test (29 testes), build de produção e git diff --check passaram.
