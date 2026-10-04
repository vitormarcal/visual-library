# Feature: Explorar por tags

Status: aprovado e implementado após pedido de continuidade do usuário em 2026-10-04. Decisões principais em [discovery.md](discovery.md); validação em [plan.md](plan.md).

## Problema e objetivo

As tags já permitem encontrar referências, mas seus acessos são predominantemente textuais. Oferecer entradas visuais para reconhecer assuntos pela capa e abrir suas imagens, preservando a biblioteca pessoal, calma e de baixa fricção.

## Fluxo principal aprovado

1. Explore passa a ser a entrada padrão, conforme ajuste solicitado pelo usuário após 013; Library permanece acessível no segundo link.
2. Explorar apresenta as tags utilizadas em cartões ordenados alfabeticamente e oferece busca pelo nome do assunto.
3. Cada cartão tem uma única capa grande, nome e quantidade de imagens sempre visíveis. O cartão inteiro abre o assunto.
4. A capa é escolhida automaticamente e permanece estável entre sessões e ao adicionar imagens. Se for apagada ou deixar de pertencer à tag, escolher uma substituta.
5. Abrir um assunto mostra seu nome, total de imagens, galeria e “Voltar a Explorar”. A busca e os refinamentos desse assunto começam vazios, exibindo todas as imagens da tag.
6. Busca e filtros anteriores da biblioteca ficam guardados para o retorno a ela. Refinar um assunto não modifica esse contexto.
7. Abrir uma imagem reutiliza o visualizador e suas conexões; fechar recupera o contexto da galeria de origem.
8. “Voltar a Explorar” preserva a busca e a rolagem do diretório, retornando ao cartão de origem.

## Escopo e regras complementares

- Explorar reflete toda a biblioteca, independentemente dos filtros usados nela. Mostrar apenas tags com imagens e contar cada imagem uma vez por tag.
- Buscar assuntos pelo nome ignorando maiúsculas, acentos e espaços repetidos, como a pesquisa existente. Essa busca é independente da busca de imagens.
- Dentro do assunto, reutilizar busca e filtros exatos. A tag base define o grupo e não desaparece ao limpar refinamentos. Preservar o limite atual de três tags combinadas, contando a tag base; não introduzir um novo sistema de filtros.
- Sem refinamentos, mostrar o total do assunto. Com refinamentos, distinguir resultados e total, por exemplo “8 de 42 imagens”.
- Entrar novamente por um cartão começa sem refinamentos, conforme o fluxo aprovado. Fechar o visualizador conserva os refinamentos da galeria atual.
- Voltar à biblioteca recupera busca, filtros e posição anterior, ajustando a posição se as imagens tiverem mudado. Voltar a Explorar recupera seu próprio contexto.
- As setas do visualizador seguem os resultados da galeria de origem. Imagens relacionadas podem ir além do assunto, conforme feature 010; fechar mantém a origem. Escolher explicitamente uma tag no visualizador refina a galeria de origem, respeitando o limite e a tag base.
- Adicionar imagens e editar tags atualiza grupos, capas e contagens. Novas imagens aparecem em um assunto apenas quando tiverem sua tag; salvar não atribui a tag automaticamente.
- Se o assunto aberto perder todas as imagens, mostrar estado vazio contextual com retorno a Explorar, sem trocar de tela automaticamente. O cartão correspondente deixa o diretório.
- A seleção em lote pertence à galeria atual. Sair dela descarta a seleção temporária; durante uma atualização de tags em andamento, bloquear a troca de contexto, conforme o comportamento existente.
- Captura permanece disponível com pouca interação. Progresso e resultados de upload não desaparecem por alternar entre biblioteca e Explorar; salvar não troca de tela nem move foco.

## Estados vazios e falhas

- Biblioteca sem tags: explicar discretamente que os assuntos aparecem ao adicionar tags às imagens e oferecer retorno à biblioteca. Não exigir cadastro de assuntos ou abertura automática do editor.
- Busca sem assuntos correspondentes: mensagem própria e possibilidade de limpar a busca, mantendo os cartões existentes acessíveis.
- Refinamentos sem imagens: informar que não há resultados e permitir limpar refinamentos mantendo a tag base.
- Falha temporária de capa: manter nome e contagem legíveis em superfície neutra e preservar a capa escolhida. Não trocar permanentemente a capa por falha de rede.
- Cartão de origem removido: restaurar uma posição válida e foco em um controle sobrevivente do diretório, sem depender de um elemento inexistente.
- Falha ao carregar a biblioteca: não apresentar ausência de tags como resultado confiável; manter feedback de erro e distinguir carregamento de conteúdo vazio.

## Regras visuais e de acessibilidade

- Seguir DESIGN.md: cartões pin-card sem padding interno, imagem em sua proporção natural, cantos de 16px, ritmo masonry e espaçamento compacto existente.
- Nome e contagem ficam em identificação discreta sobre a capa, usando pin-overlay-pill. Não depender de hover; nomes longos devem permanecer legíveis, sem corte que impeça identificar o assunto no celular.
- Após revisão visual solicitada pelo usuário, usar nome e contagem numérica lado a lado, por exemplo “manara · 42”, sem empilhar “N images” numa segunda linha. Manter a contagem completa no nome acessível do cartão, tipografia de 12px e padding 6px/12px do pin-overlay-pill; permitir quebra apenas quando o nome longo exigir.
- Usar superfícies neutras e reservar vermelho para ações primárias ou indicação de contexto ativo. Sem gradientes, sombras decorativas, controles de administração ou mosaicos de miniaturas.
- O acesso entre Biblioteca e Explorar deve ser claro e discreto, com estado atual identificável. A identificação do assunto permanece distinta de refinamentos adicionais.
- Cartões e controles têm nomes acessíveis, foco visível e alvos efetivos de pelo menos 44px. Contagens usam singular/plural correto, seguindo o idioma atual da interface.
- Restaurar foco ao fechar o visualizador e ao retornar ao diretório sem alterar indevidamente a rolagem. Não roubar foco quando contagens ou capas forem atualizadas.
- Manter o espaço de visualização da imagem principal e acesso por teclado e celular, sem overflow horizontal.

## Limites

Tags continuam livres e opcionais; esta feature apresenta associações existentes e não cria coleções. Coleções curadas pertencem à etapa 3 do roadmap.

Fora desta entrega: edição manual de capas, tipos obrigatórios de pessoa/obra/publicação, perfis, biografias, índice A–Z, rankings, classificação automática, scraping, novas dependências ou infraestrutura externa. Links diretos de assuntos, restauração de contexto após reload e integração completa ao histórico do navegador pertencem à etapa 2.

## Critérios de aceitação

- Cada tag utilizada aparece uma vez, em ordem alfabética, com capa integrante e contagem correta; a busca encontra nomes com variações de acento e caixa.
- Adicionar imagens, inclusive imagens antigas que recebem a tag depois, não altera uma capa válida. Recarregar preserva a escolha. Remover a capa provoca substituição válida; falha temporária de carregamento não provoca substituição definitiva.
- Escolher um cartão abre todas as imagens da tag com título e total, sem filtros herdados. Refinar e limpar preservam o assunto e respeitam o limite de tags.
- Galeria e visualizador mantêm seus fluxos atuais, inclusive relacionadas fora do assunto, com retorno correto à origem.
- Voltar a Explorar recupera busca, rolagem e cartão de origem; retornar à biblioteca recupera seu contexto independente.
- Edição de tags e exclusão de imagens atualizam contagens e grupos; desaparecimento do assunto ou cartão não deixa o usuário sem saída.
- Captura e seleção em lote continuam coerentes ao trocar de contexto, inclusive durante upload e salvamento de tags.
- Estados de carregamento, falha e vazio são distinguíveis. Nomes longos, teclado e telas a partir de 320px funcionam sem overflow ou dependência de hover.
- Validar com dados isolados e depois avaliar reconhecimento das capas e redescoberta no acervo real; não assumir benefício apenas por concluir a implementação.

## Revisão de direção

Constituição: reforça redescoberta por associações pessoais, preserva tags opcionais e separa coleções. DESIGN.md: reutiliza cartões fotográficos, identificação sobre imagem e controles discretos. A principal pressão é preservar três contextos de navegação sem transformar a interface em gerenciador de metadados; limitar a entrega ao fluxo descrito.

A implementação e os resultados dos testes estão registrados em plan.md. A validação isolada não estabelece benefício de redescoberta com o acervo real.


## Navegação persistente (013)

[013](../013-persistent-subject-navigation/spec.md) implementa endereços para os contextos existentes, busca/filtros no endereço, reload e Voltar/Avançar. Refinamentos substituem a entrada atual; não são buscas salvas. O visualizador mantém uma camada sobre a galeria de origem, e o retorno explícito a Explore usa a origem interna conhecida ou um destino seguro. Mantêm-se a tag base protegida, o limite de três e a aparência de 012.
