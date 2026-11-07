# Uma capa para pastas que compartilham a única imagem

Status: implementação autorizada pelo usuário e concluída localmente, após inspeção da biblioteca real. Validação no [plano](plan.md). Após a validação local, o usuário autorizou versão, commit, push e release 0.25.0. Implantação em produção permanece separada.

## Problema observado

Uma imagem com várias tags pode ser o único membro visível de várias pastas. Como a versão 0.24.0 mostra um cartão por tag, a mesma imagem aparece repetidamente, às vezes em cartões vizinhos. Não há outra imagem elegível para variar a capa dessas pastas.

Na inspeção autenticada e somente de leitura, havia 522 pastas, 381 com uma imagem e 91 grupos de pastas de uma imagem compartilhando exatamente o mesmo membro. As capturas ficaram apenas em `/tmp`; nenhuma imagem privada foi adicionada ao repositório.

## Comportamento implementado

Mostrar uma capa compartilhada quando duas ou mais pastas tiverem **uma única imagem visível e essa imagem tiver o mesmo ID**. Abaixo da capa, apresentar os nomes das pastas como links independentes. O cartão comunica que uma imagem está associada àquelas pastas, sem escolher uma tag arbitrária para representar as outras.

Os links continuam abrindo as pastas originais e preservando a tag base correta, inclusive para salvar novas imagens naquele contexto. A capa comum não se torna uma pasta adicional. Não unir tags, alterar associações, renomear pastas ou duplicar/excluir arquivos.

Pastas com conteúdos distintos continuam separadas, mesmo quando sua capa principal coincide. A primeira versão desse ajuste não agrupa pastas com várias imagens nem usa similaridade visual ou comparação de nomes.

## Regras de navegação e atualização

- Toda pasta mantém nome, URL e critério. A escolha de um nome abre aquela pasta; o agrupamento visual não abre automaticamente a primeira tag.
- A busca por nome continua encontrando cada pasta. Se apenas um nome corresponder à busca, pode aparecer como cartão individual, sem outros nomes que não correspondam ao termo.
- A ordenação permanece previsível. Posicionar a capa compartilhada pela primeira pasta correspondente na ordem alfabética e manter os nomes internos em ordem alfabética.
- Se uma pasta receber uma segunda imagem, ela deixa o cartão compartilhado e volta a ter cartão próprio. As demais continuam agrupadas se ainda houver mais de uma com o mesmo membro único.
- Ocultação, remoção e edição de tags recalculam a apresentação a partir dos mesmos membros visíveis da versão 0.24.0. Sem persistência de uma segunda lista de grupos.
- Restauração de foco usa a identidade da pasta escolhida, mesmo quando seu link estiver dentro de uma capa compartilhada. Preservar busca, scroll, histórico, reload e retorno do visualizador.
- Todos os nomes precisam ser alcançáveis por teclado e toque. Se um grupo tiver muitos nomes, mostrar uma lista inicial curta e uma expansão explícita para os demais, sem ocultar definitivamente pastas ou exigir hover.
- Reutilizar os tokens e os componentes visuais existentes; sem nova configuração, modelo de dados ou modalidade de pasta.

## Critérios de aceite

- Três tags cujo único membro seja a imagem X produzem uma capa de X com três acessos distintos, em vez de três capas iguais.
- Selecionar o segundo nome abre sua tag base; salvar nesse contexto não aplica as outras tags do cartão compartilhado.
- Uma pasta que também contenha Y não entra no grupo de X. Duas imagens diferentes com aparência semelhante não são agrupadas.
- Acrescentar Y a uma das três pastas a separa automaticamente das outras duas. O arquivo X continua existindo uma vez na biblioteca.
- Busca, teclado/toque, nomes longos, estados de capa indisponível e retorno ao nome escolhido funcionam em desktop e mobile.

## Limite de escopo

Este ajuste é uma compactação da apresentação de pastas automáticas. Não é deduplicação de arquivos, consolidação de tags, tradução de nomes nem introdução de coleções manuais. Preserva o modelo de pasta da spec 032.
