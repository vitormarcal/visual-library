# Discovery: Explorar por tags

Iniciado em 2026-10-04 a pedido do usuário, após commit e push do upload múltiplo e do roadmap (`114cf37`). Status: concluído; direção aprovada e implementada após pedidos de continuidade. Especificação em [spec.md](spec.md), plano e validação em [plan.md](plan.md).

## Problema e hipótese

A biblioteca já permite encontrar imagens por tags, mas apresenta essas associações principalmente como texto. A hipótese é que um diretório com capas facilite reconhecer assuntos e reencontrar referências sem precisar lembrar seus nomes.

O objetivo é validar o fluxo Explorar → tag → galeria → imagem → retorno. Esta hipótese ainda não foi testada com o acervo real.

## Evidências do projeto

- BACKLOG.md registra dificuldade de redescoberta temática por volta de 150 imagens e uso de tags para pessoas, autores, personagens, obras e publicações.
- GalleryTagFilters mostra sugestões textuais e uma lista de todas as tags; seleção utiliza filtros exatos combinados com busca.
- A biblioteca já carrega imagens e associações de tags; a API de tags fornece contagens e inclui apenas tags associadas a imagens.
- A galeria suporta seleção em lote; o visualizador mantém contexto e conexões pela biblioteca inteira. Esses fluxos precisam continuar coerentes ao entrar por Explorar.
- CONSTITUTION.md define tags livres e opcionais e coleções como conjuntos curados distintos. O diretório será uma apresentação das tags existentes.
- DESIGN.md oferece cartões fotográficos, identificação sobre imagens, superfícies neutras e foco visível. Não é necessário criar outra linguagem visual.

## Direção definida pelo roadmap

- Biblioteca continua sendo a entrada padrão, com acesso discreto a Explorar.
- Cartões apresentam capa, nome e quantidade; pesquisa de assuntos pelo nome e ordem alfabética inicial.
- Escolher uma tag abre suas imagens na galeria existente.
- Imagens sem tags continuam disponíveis na biblioteca; salvar não exige organização.
- Coleções, classificação obrigatória de tags e edição manual de capas não fazem parte desta etapa.

## Decisão aprovada: comportamento da capa

O usuário aprovou capas estáveis: adicionar imagens à tag não troca sua capa. A escolha inicial é automática, sem configuração obrigatória. Quando a imagem for apagada ou deixar de pertencer à tag, o sistema escolhe uma substituta.

A estabilidade deve continuar entre sessões. A forma de garantir isso será definida no plano técnico: persistência ou uma regra determinística que preserve a escolha ao entrar novas imagens. Não usar a imagem mais recente como regra de atualização.

Uma falha temporária de carregamento não deve provocar troca definitiva de capa; oferecer um estado visual de falha legível. Escolha manual permanece fora do escopo inicial.

## Decisão aprovada: contexto do assunto

O usuário aprovou apresentar o nome do assunto como título da galeria, sua quantidade de imagens e uma ação explícita de retorno a Explorar. Exemplo: “Manara · 42 imagens”, seguido da galeria correspondente. A tag escolhida define o assunto da galeria, com identificação além do chip de filtro existente.

Essa apresentação básica não implica perfis, páginas com metadados ou as rotas persistentes previstas na etapa 2. Se houver refinamentos adicionais, a quantidade total do assunto deve ser distinguida da quantidade de resultados para não sugerir que imagens desapareceram.

## Decisão aprovada: busca e filtros ao entrar

O usuário aprovou abrir todas as imagens da tag escolhida, com busca e refinamentos próprios inicialmente vazios. A busca e os filtros anteriores da biblioteca ficam preservados para quando o usuário voltar a ela. Uma busca anterior por “wallpaper”, por exemplo, não restringe o assunto “Manara”. Dentro do assunto, o usuário pode refinar novamente.

O retorno deve diferenciar “Voltar a Explorar”, que recupera o diretório, do acesso à biblioteca original. A tag que define o assunto permanece como contexto base; limpar refinamentos adicionais não deve removê-la silenciosamente.

## Decisão aprovada: apresentação dos cartões

O usuário aprovou uma única capa grande por cartão, com nome e contagem sempre visíveis numa etiqueta discreta sobre a imagem, conforme pin-overlay-pill de DESIGN.md. O cartão inteiro abre o assunto. Nomes longos devem continuar legíveis no celular, sem depender de hover. Usar as proporções naturais das capas e o ritmo masonry existente, com cantos de 16px e sem controles extras sobre cada cartão.

Mosaicos com várias miniaturas por assunto ficam fora da primeira versão.

## Decisão aprovada: retorno a Explorar

O usuário aprovou que “Voltar a Explorar” recupere a busca por assuntos e a posição de rolagem do diretório, levando ao cartão de origem. Para acesso por teclado, restaurar o foco nesse cartão sem saltar para o início. Se o assunto tiver desaparecido, retornar ao diretório com um alvo de foco sobrevivente e posição válida.

O contexto da biblioteca permanece independente, conforme decisão anterior. O retorno dentro da sessão não promete restauração após recarregar a página nem o histórico completo do navegador, previstos para avaliação na etapa 2.

## Regras complementares propostas na especificação

Estados vazios, refinamentos e alterações durante a navegação foram consolidados como regras propostas em spec.md, seguindo os fluxos existentes. Não foram submetidos a perguntas individuais nem são apresentados como aprovações explícitas do usuário:

- Refinamentos dentro do assunto: manter a tag base explícita e distinguir total do assunto de resultados filtrados.
- Retorno: preservar pesquisa e posição do diretório, além do contexto independente da biblioteca.
- Estados vazios: orientar quem ainda não tem tags sem exigir classificação; diferenciar pesquisa sem resultados de biblioteca sem assuntos.
- Alterações durante navegação: contagens, capas e grupos devem acompanhar edição de tags, exclusões e captura; seleção em lote não deve passar silenciosamente para outro contexto.

Retorno básico faz parte da primeira etapa. Endereços compartilháveis e histórico completo do navegador pertencem à consolidação da etapa 2; a primeira entrega não deve prometer persistência de navegação ainda inexistente.

## Critério para encerrar o discovery

Ter comportamento definido para entrada, capas, seleção de assunto, busca, retorno e estados vazios, suficiente para escrever uma spec curta com critérios de aceitação. Depois, revisar a spec contra Constituição e DESIGN.md e preparar o plano quando houver aprovação, conforme AI_PRODUCT_WORKFLOW.md.

Validar posteriormente se o usuário reconhece grupos pelas capas e encontra referências com menos esforço. Não adicionar ranking, A–Z, configuração de capas ou novos tipos de entidades apenas por existirem na referência externa.
