# Roadmap: organização visual e redescoberta

Data: 2026-10-04. Status: proposta de direção; não autoriza implementação nem define datas de entrega.

## Objetivo

Permitir escolher visualmente um assunto ou conjunto antes de navegar pelas imagens. O fluxo desejado é: Explorar → assunto ou coleção → galeria → imagem → conexões → retorno ao contexto original.

A referência discutida é a navegação por pessoas e obras do AZNude. A adaptação preserva a biblioteca pessoal, local e centrada nas imagens definida em [CONSTITUTION.md](../CONSTITUTION.md), com a linguagem visual de [DESIGN.md](../DESIGN.md).

## Base disponível

- Galeria masonry, captura local e por URL, prevenção de duplicatas e upload múltiplo.
- Tags livres e opcionais, pesquisa, filtros exatos e adição de tags em lote.
- Visualizador com imagens relacionadas de toda a biblioteca e retorno pelo caminho percorrido.
- Tags com contagem de imagens e data de uso; ainda não existem coleções persistidas ou um diretório visual de assuntos.

O upload múltiplo está implementado e validado. Sua entrega deve permanecer separada das próximas features.

## Etapa 1 — Explorar visualmente as tags

Implementada em 2026-10-04 em [012](specs/012-visual-tag-exploration/spec.md), com capas persistidas, retorno de contexto e validação isolada. Avaliação com o acervo real permanece pendente.

**Prioridade:** primeira entrega. **Esforço relativo:** pequeno a médio.

Adicionar uma entrada discreta “Explorar”, mantendo a biblioteca como entrada padrão. Mostrar cada tag utilizada como cartão com imagem representativa, nome e quantidade de imagens. Buscar tags pelo nome e começar com uma ordenação alfabética previsível.

A capa inicial será derivada de uma imagem existente, por uma regra determinística a definir na spec. Não exigir configuração nem criar novas categorias. Imagens sem tags continuam acessíveis na biblioteca.

Ao escolher um cartão, abrir as imagens daquela tag reutilizando a galeria e o filtro exato existentes. A navegação deve distinguir o assunto escolhido de filtros adicionais e permitir retornar ao diretório.

**Concluída quando:** as contagens correspondem às imagens, cada cartão abre o grupo correto, grupos desaparecem quando ficam vazios e teclado/celular permitem o fluxo completo. Capturar imagens continua acessível com pouca interação.

**Avaliação de uso:** verificar se reconhecer a capa ajuda a encontrar referências sem lembrar ou digitar o nome da tag. Caso não ajude, ajustar esta etapa antes de acrescentar controles.

## Etapa 2 — Consolidar a navegação por assunto

**Dependência:** etapa 1 validada. **Esforço relativo:** médio.

Dar ao assunto um contexto claro: nome, quantidade de imagens e caminho de retorno. Preservar posição, busca e filtros ao abrir/fechar o visualizador e ao voltar para Explorar. Permitir abrir um assunto diretamente por endereço e definir o comportamento de Voltar/Avançar do navegador.

Reutilizar as conexões por tags existentes. Abrir outro assunto a partir de uma imagem deve ser uma escolha explícita, com retorno previsível. Separar o retorno entre páginas do histórico temporário de conexões dentro do visualizador.

**Concluída quando:** atualizar a página mantém o assunto, links diretos funcionam, Voltar/Avançar restauram o contexto e uma imagem removida não deixa uma tela sem saída. O fluxo funciona com busca e filtros combinados.

## Etapa 3 — Coleções curadas

**Dependência:** avaliar a necessidade de conjuntos escolhidos manualmente após o uso de Explorar. **Esforço relativo:** médio a alto.

Criar coleções com nome e imagens escolhidas pelo usuário. Reutilizar a seleção em lote para “Adicionar à coleção”, oferecendo criação de coleção nesse mesmo fluxo. Uma imagem pode pertencer a várias coleções.

Apresentar as coleções com capa e contagem e abrir seu conteúdo na galeria existente. Permitir renomear, escolher uma imagem integrante como capa e remover imagens do conjunto. Excluir uma coleção preserva as imagens da biblioteca; retirar uma imagem da coleção também.

Esta etapa exige persistência local de coleções e de suas associações com imagens. Tags continuam associações livres: os resultados de uma tag não se tornam automaticamente uma coleção.

**Concluída quando:** criação, adição e remoção persistem após recarregar; exclusões não apagam imagens indevidamente; capas e contagens permanecem corretas quando uma imagem é apagada da biblioteca.

**Avaliação de uso:** confirmar se coleções representam conjuntos reais, como um ensaio, uma edição ou uma seleção de referências, e se a seleção em lote evita trabalho repetitivo.

## Etapa 4 — Refinar a apresentação com o acervo real

**Dependência:** observar fricção nas etapas anteriores. **Esforço relativo:** variável; entregas independentes.

Selecionar apenas os refinamentos que resolverem dificuldade observada:

- Escolha de capa para assuntos, se a capa automática dificultar o reconhecimento.
- Ordenação de grupos por atualização recente, se a ordem alfabética esconder conjuntos em uso.
- Índice A–Z, se busca e rolagem deixarem de ser suficientes.
- Ordem manual dentro de uma coleção, se a sequência das imagens tiver significado.
- Otimização de carregamento de capas e galerias, se medições mostrarem lentidão.

Cada refinamento terá spec própria e critérios ligados ao problema observado. Esta etapa não representa um pacote obrigatório.

## Regras visuais e de interação

- Usar cartões fotográficos com os componentes e tokens de DESIGN.md; metadados discretos e legíveis, sem depender de hover.
- Preservar as proporções naturais das imagens na galeria e o espaço da imagem no visualizador.
- Usar superfícies neutras, cantos de 16px e vermelho para ações primárias ou estado ativo, conforme DESIGN.md.
- Evitar controles em cada miniatura; apresentar ações de organização quando houver seleção ou contexto explícito.
- Garantir foco visível, nomes acessíveis, alvos de interação de pelo menos 44px e ausência de overflow no celular.
- Não exigir tags, coleções ou formulários para salvar uma imagem.

## Limites da direção

Não estão previstos tipos obrigatórios de pessoa/obra/publicação, perfis com biografias, hierarquia de pastas, classificação automática, scraping, ranking social, colaboração ou infraestrutura externa. Se o uso demonstrar necessidade de distinguir pessoas e obras, avaliar essa mudança separadamente, pois ela altera o modelo atual de tags livres.

## Sequência de entrega e validação

1. Encerrar a entrega independente do upload múltiplo.
2. Especificar a etapa 1, revisar contra Constituição e DESIGN.md e, após aprovação, preparar seu plano de implementação.
3. Implementar e validar comportamento, acessibilidade, celular e retorno de contexto com uma biblioteca isolada.
4. Usar o acervo real para decidir os ajustes e a passagem à etapa seguinte.
5. Repetir o processo por feature, sem agrupar todo o roadmap numa única alteração.

Não há estimativa em dias: esforço relativo indica comparação entre etapas, não compromisso de prazo. O primeiro marco de valor é poder reconhecer um assunto pela capa e chegar às suas imagens com uma escolha.
