# Pastas automáticas por tag

Status: direção de produto e implementação autorizadas pelo usuário após a versão 0.23.0. Implementada e validada, com release 0.24.0 solicitada posteriormente; resultados no [plano](plan.md). Deploy em produção permanece separado da publicação da imagem. A constituição foi alinhada à decisão de permitir coleções automáticas e, futuramente, manuais.

## Decisão e interpretação inicial

Uma pasta é uma coleção visual de imagens. Na primeira versão, cada tag com imagens visíveis gera uma pasta automaticamente; suas imagens são aquelas que possuem essa tag. Uma imagem com várias tags pode aparecer em várias pastas, sem duplicação do arquivo.

Esta é a interpretação inicial de “uma pasta é uma coleção automática de tags”, reaproveitando os agrupamentos existentes. A pasta contém imagens reunidas pela tag, em vez de ser um recipiente para cadastrar tags. Pastas que combinem várias tags e pastas de seleção manual são possibilidades posteriores, não funcionalidades desta entrega.

O usuário aceita que pastas possam ser automáticas ou manuais. A primeira entrega implementa somente o caso automático. Isso orienta o significado do produto, sem justificar um mecanismo genérico ou persistência adicional agora.

## Problema e objetivo

Os assuntos atuais já agrupam imagens por tag, mas aparecem como cartões de imagem no Explore. Falta apresentar esses grupos como pastas reconhecíveis dentro da Biblioteca, próximas do modelo de navegação por pastas observado no Pinterest.

Oferecer dois caminhos complementares: navegar por todas as imagens ou reconhecer um grupo por nome e capa composta. Preservar a entrada em Biblioteca, a captura imediata e os dois passos de visualização da versão 0.23.0.

## Navegação proposta

1. Biblioteca ganha as abas **Imagens** e **Pastas**. Imagens continua sendo a entrada padrão e mostra o acervo completo visível.
2. Pastas mostra os grupos automáticos por tag, em cartões de pasta. Exibir cada grupo uma vez, com nome, capa composta e contagem de imagens distintas.
3. A busca dessa aba pesquisa nomes de pastas/tags. O escopo fica explícito no cabeçalho e não se confunde com busca de imagens.
4. Clicar em uma pasta abre todas as imagens visíveis com sua tag, com título, contagem e retorno à lista de pastas. Refinamentos começam vazios nessa entrada.
5. Dentro da pasta, busca e tags adicionais refinam o grupo. Limpar refinamentos mantém a tag que define a pasta. Preservar o limite atual de três tags combinadas, contando a base.
6. Abrir um cartão de imagem mostra o detalhe com relacionadas; ampliar continua sendo uma ação separada. Fechar recupera a mesma pasta, refinamentos, posição e foco.
7. Voltar a Pastas preserva busca, scroll e cartão de origem. Voltar a Imagens preserva seu contexto independente. Voltar/avançar, reload, link direto e nova aba devem manter destinos compreensíveis.
8. O diretório de assuntos passa de Explore para Biblioteca/Pastas, evitando dois diretórios equivalentes. Explore mantém a redescoberta existente; não recebe um feed externo nem outro mecanismo de recomendação.

As URLs existentes de assuntos continuam abrindo as imagens da mesma tag. Ao abrir um endereço antigo sem origem recuperável, oferecer retorno seguro à lista de Pastas. Não invalidar links existentes para trocar apenas o nome da superfície.

## Cartões de pasta

- Capa composta de até três imagens: principal maior à esquerda e até duas menores à direita. Nome e contagem ficam abaixo, sempre legíveis, sem depender de hover.
- Reutilizar a capa estável já associada à tag como imagem principal. Acrescentar ou remover outras imagens não troca uma capa principal ainda válida.
- As imagens complementares pertencem à mesma pasta e são distintas entre si e da principal. Usar uma escolha determinística; não embaralhar a pasta a cada renderização.
- Pastas com uma ou duas imagens usam apenas o conteúdo disponível, sem repetir miniaturas para preencher o mosaico.
- Recortes são permitidos apenas nas miniaturas da capa composta. Ao abrir a pasta e seu visualizador, preservar as proporções naturais e a ampliação sem recorte.
- Falha de uma miniatura mantém nome, contagem e acesso. Não substituir permanentemente a capa escolhida por causa de uma falha de rede.
- Grade regular de cartões com proporção de capa consistente, distinguindo pastas do masonry de imagens. Seguir os tokens existentes de DESIGN.md, com cantos de 16 px e superfícies neutras.
- Duas colunas em 390 px quando houver largura útil suficiente; permitir uma em telas estreitas ou zoom. Nomes longos podem quebrar linha. Alvos de pelo menos 44 px e foco visível.

## Formação e atualização automática

- Só aparecem tags que possuem ao menos uma imagem visível. Imagens ocultas não entram em capas, contagens ou resultados dessas pastas.
- Adicionar uma tag a uma imagem existente inclui a imagem na pasta correspondente. Remover a associação a retira dessa pasta, sem apagar a imagem.
- Uma imagem pode pertencer a várias pastas. Contar uma vez em cada uma; não somar suas aparições como se fossem novos arquivos no total da biblioteca.
- Uma tag nova passa a ter pasta quando estiver associada a uma imagem visível. Não exigir cadastro de pasta separado nem criar uma cópia da tag.
- Pastas ficam em ordem alfabética por nome na primeira versão. Não herdar o embaralhamento diário usado hoje em Explore; o retorno à biblioteca deve ser previsível.
- Ocultar ou excluir imagens atualiza grupos e capas. Se o grupo ficar vazio, seu cartão sai da lista. Se ele já estiver aberto, manter um estado vazio contextual com retorno, sem trocar de destino silenciosamente.
- Salvar no contexto de uma pasta reaproveita a aplicação de tags de contexto existente: informar a tag base e os refinamentos que serão aplicados às novas imagens. Duplicatas mantêm o contrato atual.
- Tags pessoais e gerenciadas continuam seguindo as regras existentes. A apresentação como pasta não concede novas permissões para editar tags gerenciadas.

## Captura e estados de interface

Adicionar permanece disponível em Imagens, Pastas e dentro de uma pasta. Salvar na lista de Pastas não aplica uma tag arbitrária; apenas o contexto de uma pasta aberta pode contribuir com sua tag base. Tags continuam opcionais.

Sem tags, explicar que as pastas aparecem automaticamente ao adicionar tags e oferecer acesso a Imagens. Não impor organização, não chamar o acervo sem tags de incompleto e não adicionar uma etapa obrigatória ao salvamento.

Separar biblioteca vazia, ausência de pastas, busca sem resultados, pasta vazia e erro de carregamento. Atualizações de contagem/capa não roubam foco ou scroll. Ao desaparecer o cartão de origem, retornar a uma posição válida e a um controle sobrevivente.

Captura de páginas, seleção pendente, progresso e retry devem continuar preservados ao alternar abas, entrar/sair de pasta e navegar em Explore.

## Fronteiras desta entrega

- Reaproveitar grupos por tag, capas estáveis e galerias de assunto existentes. A apresentação não deve criar uma segunda lista persistente de membros.
- Não criar tabela genérica de tipos de pasta, motor de regras, plugins, filas ou configuração para critérios hipotéticos.
- Não introduzir criação/renomeação/exclusão independente de pasta nesta versão automática. Não equiparar “excluir pasta” a remover tags ou apagar imagens.
- Sem combinações salvas de tags, escolha manual de membros, subpastas, arrastar entre pastas, favoritos, compartilhamento de coleções ou edição manual de capa.
- Não reservar na interface controles desativados para funções futuras. Se houver necessidade real de pastas manuais, elas deverão usar a mesma ideia visual de coleção, com comportamento definido em outra entrega.
- Não alterar a release 0.23.0 nem publicar uma nova versão como consequência desta spec.

## Critérios de aceitação

- Com tags A e B em uma mesma imagem, ela aparece uma vez na pasta A e uma vez na B; o total da biblioteca conta um arquivo.
- Cada tag com imagens visíveis gera um cartão; imagens ocultas não aparecem nem influenciam contagens/capas.
- Pastas com uma, duas e várias imagens mostram capas coerentes, sem duplicar imagens no mosaico. Uma capa principal válida permanece estável após novas inclusões e reload.
- Adicionar/remover tags, ocultar e excluir imagens atualiza membros e contagens sem criar ou apagar arquivos indevidamente.
- Imagens/Pastas mantêm busca e posição próprias. Dentro da pasta, filtros preservam a base; voltar do detalhe e da ampliação restaura contexto e foco.
- Endereços antigos de assunto, reload, links diretos, nova aba e histórico continuam funcionando.
- O diretório visual não fica duplicado em Explore. Redescoberta e suas seleções permanecem válidas.
- Captura local/URL/página, tags de contexto, seleção em lote e retry seguem funcionando; trocar de aba não perde captura pendente.
- Desktop e mobile mostram nome/contagem legíveis e acessos por teclado/toque, sem overflow horizontal e com estados de vazio/erro distintos.

## Continuidade

A composição de Imagens/Pastas e os fluxos desta spec foram implementados. Avaliar a apresentação antes de uma eventual release. O significado amplo de pasta não obriga implementar modalidades futuras nesta etapa; novas formas de coleção dependem de necessidade real.
