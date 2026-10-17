# Discovery: galeria por similaridade visual

Iniciado em 2026-10-17 a pedido do usuário. Status: direção aprovada pelo pedido de continuidade; [spec.md](spec.md) e [plan.md](plan.md) consolidados. Protótipo e medição executados; após segunda rodada, usuário aprovou os resultados para V1 e a galeria foi integrada. Validação no plano.

## Problema e evidências

O usuário quer explorar imagens similares por cor, posição/composição e objetos, sem precisar passar por tags relacionadas. BACKLOG.md já registra a dificuldade de redescobrir imagens sem nomes ou tags úteis e o uso de tags como associações pessoais, não descrições visuais obrigatórias.

A implementação atual oferece:

- `app/utils/related-images.ts`: até seis resultados por quantidade de tags compartilhadas, calculados no cliente.
- `app/components/LightboxViewer.vue`: visualizador com relacionadas, histórico temporário e retorno à galeria.
- `app/components/GalleryGrid.vue`: masonry com imagens progressivas e links nativos para o visualizador.
- `app/utils/library-navigation.ts` e `app/composables/useLibraryNavigation.ts`: destinos Library/Explore/assunto, endereço da imagem e restauração de contexto.
- `server/api/images.get.ts`: listagem completa de metadados e tags. A entrega 017 evita downloads iniciais de imagens distantes, mas não pagina metadados/cartões.
- `server/db.ts`: SQLite e arquivos locais; sem descritores visuais ou índice de similaridade.

As entregas recentes adicionaram navegação persistente, visibilidade de assets, enriquecimento externo e carregamento progressivo. A nova feature deve reutilizar galeria e visualizador, preservar ocultação e não ampliar as responsabilidades de tags ou da API externa de assets. Acrescentar similaridade não justifica reestruturar a aplicação inteira.

## Alinhamento e mudança de fronteira

A Constituição inclui agrupamento visual e redescoberta como missão. O mecanismo de análise deve servir à navegação, sem classificação obrigatória ou interface de administração de IA.

O backlog anterior exclui embeddings/similaridade enquanto sugestões de IA eram especulativas. O pedido explícito atual seleciona uma investigação específica de similaridade; não autoriza sugestões de tags, organização automática ou processamento genérico. As exclusões de similaridade em 008/010 continuam valendo para as conexões por tags existentes.

## Decisão confirmada pelo usuário

Abrir um resultado mantém a referência e a galeria. Escolher “Ver similares” na imagem aberta é a ação explícita para torná-la a nova referência. Não recalcular a galeria automaticamente ao abrir cada cartão.

## Direção proposta

- Entrada contextual no visualizador, sem nova seção na navegação principal.
- Galeria com referência reconhecível e resultados ordenados por proximidade visual, dentro do acervo visível completo.
- Carregamento gradual e finito, sem repetição de cartões ou preenchimento aleatório.
- Retorno com contexto, rolagem e foco; setas do visualizador seguem a galeria de origem.
- Um único comportamento inicial de similaridade, sem controles de pesos ou escolha de modelos.
- Prova de conceito para comparar embeddings e paleta antes de decidir o mecanismo da entrega.

## Viabilidade observada e limites da evidência

Consulta SSH somente de leitura a `kamisama@mordor`, nesta conversa: Ryzen 5 5600G (6 núcleos/12 threads), aproximadamente 46 GiB de RAM total e 14 GiB disponíveis, 33 GiB livres na raiz. O uso de swap era aproximadamente 1,8 GiB. São valores pontuais, não capacidade reservada. Não foi executado benchmark, instalado modelo ou alterado serviço remoto.

O processador parece adequado para experimentar um modelo compacto em CPU. Tempo por imagem, memória de pico, compatibilidade com o deploy atual em Node/Alpine e impacto nos serviços continuam desconhecidos. Não assumir GPU utilizável; a inspeção inicial não verificou todos os dispositivos.

Proposta de avaliação técnica posterior: lote de até 100 imagens, processamento limitado e persistência de derivados em área separada, sem alterar originais/tags. Avaliar cerca de 20 referências variadas e seus 12 primeiros resultados. Inspeção humana deve considerar imagens sem tags, relações entre tags diferentes, cores, composição e objetos. O resultado pode exigir ajustar o método ou reduzir a promessa do MVP.

## Decisão delegada: aparência visual primeiro

O usuário pediu que o agente escolhesse a prioridade. Escolha: priorizar aparência visual, considerando composição, enquadramento e paleta em conjunto. Objetos e assunto são sinais secundários. Isso atende ao uso de referências e inspiração sem exigir que as tags pessoais descrevam a aparência.

Exemplo de intenção: um retrato com enquadramento e distribuição de cores próximos pode ser mais útil do que outro retrato do mesmo assunto com composição muito diferente. Compartilhar apenas uma cor dominante também não basta para caracterizar um bom resultado. A regra orienta a avaliação humana e a escolha técnica posterior; não fixa pesos numéricos nem promete reconhecer poses com precisão.

Não expor seletor de critérios no MVP. Comparar resultados do experimento com essa intenção antes de escolher o mecanismo definitivo.

## Retorno do usuário: preferência pela paleta

Após conhecer os três métodos, o usuário informou: “acho que a paleta se aproximou mais”. A direção do MVP passa a usar somente a distribuição global de cores do método “Paleta isolada”. Esse retorno substitui a escolha inicial delegada de combinar composição, enquadramento e paleta. É evidência de preferência neste experimento, não uma validação universal de qualidade.

Manter o mesmo fluxo de referência explícita e um único ranking, com contexto “Cores semelhantes”. Embeddings e distribuição espacial permanecem apenas no experimento. Objetos, posição e pose ficam fora da promessa inicial.

## Próximos passos

O usuário pediu depois uma nova rodada de parâmetros de embedding e aparência combinada. Executado um segundo experimento controlado, preservando candidatos e referências do primeiro; resultados em [plan.md](plan.md). A preferência por paleta continua sendo a direção provisória, até o usuário comparar as variantes. Essa rodada não altera a interface ou o ranking do produto.

O pedido posterior “prossiga” aprovou a direção e iniciou o plano e o experimento. O protótipo foi executado no Mordor com 100 imagens visíveis, sem falhas de decodificação/inferência no lote válido; resultados detalhados no plano. O acervo de produção foi montado somente para leitura. A galeria do produto ainda não foi implementada.

O ranking foi selecionado pela preferência do usuário: paleta isolada. Concluir o plano técnico de integração dessa direção e implementar a galeria. Não considerar a feature entregue apenas porque o benchmark passou. A delegação da prioridade foi uma decisão específica; o pedido posterior de continuidade é que autorizou avançar à etapa experimental.

## Direção final da V1

O usuário aprovou a segunda rodada “para uma v1”. Adotada a opção selecionada no relatório e indicada para iniciar a comparação: 65% paleta, 20% embedding médio da imagem inteira e 15% posição das cores. Isso substitui a preferência provisória por paleta isolada. A integração preserva um único ranking e referência explícita, sem seletor no produto. Resultados da implementação e limitações no plano; não houve deploy em produção.
