# Feature: enriquecimento inicial no upload de assets

Status: implementada após aprovação da especificação e plano e pedido de continuidade do usuário em 2026-10-12. Resultados e limites da validação em [plan.md](plan.md).

## Problema e objetivo

Aplicações consumidoras já possuem informações úteis para encontrar imagens. Enviar uma imagem sem essas associações exige classificação manual repetida no Visual Library.

Permitir que o upload externo receba tags opcionais e uma referência à entidade de origem, tornando a imagem pesquisável e organizável pelos mecanismos existentes. A organização pessoal permanece independente; a extensão se limita ao enriquecimento no envio, sem sincronização automática.

Essa necessidade foi apresentada pelo usuário para imagens de álbuns e obras do Media Pulse. Não pressupõe benefício validado com o acervo real nem autoriza alterações nesse consumidor.

## Conceitos separados

- Origem do asset: aplicação que fez o primeiro envio, conforme 014; preservar essa informação quando o arquivo for reutilizado.
- Referência externa: associação do asset a uma entidade de uma aplicação, identificada por aplicação, tipo e ID externo. Pode incluir um endereço de origem. Tags e filenames não identificam essa associação.
- Tags: associações livres para descoberta. O consumidor pode sugeri-las no envio e o usuário pode editá-las na interface atual.

O consumidor escolhe quais informações são úteis como tags. Não exigir título, criador, técnica ou movimento nem converter propriedades automaticamente em categorias. Não criar um modelo de álbum ou obra dentro do Visual Library.

## Fluxo esperado

1. O consumidor envia uma imagem, identificando sua aplicação, e pode incluir tags e referência à entidade de origem.
2. O Visual Library valida o envio e cria ou reutiliza o asset existente.
3. Acrescenta as sugestões de tags e associa a referência de origem conforme as regras de reenvio abaixo, preservando a organização já existente.
4. O consumidor recebe o identificador estável e o estado efetivamente registrado.
5. O usuário encontra a imagem por busca, assuntos ou relações entre tags e pode organizar a imagem na interface atual.

Exemplos:

- Capa do álbum Dois: `Legião Urbana`, `Dois`, `álbum`, `rock brasileiro`.
- Ninfas e sátiro: `pintura`, `William-Adolphe Bouguereau`, `academicismo francês`, `óleo sobre tela`.

Essas etiquetas são exemplos livres, não uma taxonomia obrigatória. Buscar por `pintura` só encontra uma imagem se esse termo estiver nas informações já pesquisáveis; não inferir seu tipo a partir dos pixels ou de metadados que o consumidor não enviou.

## Tags e organização pessoal

- Tags opcionais; omitir a lista ou enviar lista vazia não remove associações existentes.
- Acrescentar tags pela união com as atuais, sem substituir o conjunto pela lista recebida.
- Reutilizar normalização, identidade e nomes de exibição de 005: espaços limpos, comparação sem diferenciar caixa e preservação de nomes existentes.
- Preservar o máximo atual de oito tags distintas por imagem e 48 caracteres por tag.
- Se a união exceder o limite, rejeitar o envio inteiro com feedback claro. Não truncar sugestões nem apagar tags pessoais para liberar espaço.
- Todas as tags continuam editáveis pelo usuário. O upload externo não passa a controlar ou bloquear associações.
- Não atribuir propriedade exclusiva de uma tag a uma aplicação nesta etapa. Isso exigiria regras próprias para associações compartilhadas, edição manual e atualização externa.

As sugestões recebidas participam da busca, assuntos e relacionadas atuais. Visibilidade segue 014: ocultação preserva tags e acesso HTTP, mas retira a imagem da descoberta padrão.

## Referências externas e arquivos compartilhados

Referências são independentes das tags. Um asset pode estar associado a entidades distintas, da mesma aplicação ou de outras aplicações, sem duplicar o arquivo.

Uma nova referência pode enriquecer um asset já existente. Preservar ID, data, origem do primeiro envio, visibilidade e tags anteriores. A aplicação responsável por uma nova referência é a que a informou nesse envio, mesmo quando o asset foi criado originalmente por outra aplicação.

Uma mesma entidade pode ter várias imagens, como capa e contracapa de um álbum. Enviar outra imagem para essa entidade acrescenta uma associação, sem substituir ou apagar a anterior. Repetições da mesma associação não criam duplicatas.

Excluir uma entidade no consumidor não apaga automaticamente nada no Visual Library. Excluir a imagem no Visual Library remove suas associações locais e invalida referências por ID, conforme o ciclo de vida atual. Não adicionar retenção por consumidor.

## Compatibilidade e falhas

Preservar clientes que enviam apenas o arquivo e os campos existentes de 014. O enriquecimento é opcional e não exige uma segunda requisição para concluir o primeiro envio.

Consulta do asset deve permitir recuperar suas tags e referências externas, além dos metadados atuais, sem caminhos físicos ou conhecimento do domínio do consumidor. Conteúdo original e identificador público permanecem com o comportamento de 014.

Uma falha não pode deixar tags ou referências aplicadas parcialmente. Em asset reutilizado, conservar arquivos, dados e associações anteriores. Em asset novo, compensar falhas tratáveis para não deixar registros ou arquivos órfãos. Não apagar o arquivo compartilhado ao desfazer um enriquecimento que falhou.

## Interface e experiência

Reutilizar os chips, busca, assuntos e organização atuais. O usuário pode acrescentar ou remover tags sem um novo modo de edição ou formulário de classificação.

Não adicionar campos à captura manual, etiquetas permanentes às miniaturas, inspector de metadados, cadastro de origens ou editor de referências. Tags permanecem opcionais e fora da galeria, conforme 005 e DESIGN.md. A visualização principal da imagem mantém seu espaço.

## Reenvio após edição manual — decisão aprovada

O usuário concordou em 2026-10-12 que repetir a mesma referência para o mesmo asset preserva as tags atuais, sem restaurar sugestões removidas manualmente. Essa repetição não aplica um novo enriquecimento de tags; a primeira associação continua acrescentando sugestões sem substituir as existentes.

## Várias imagens por entidade — decisão aprovada

O usuário concordou em 2026-10-12 que uma entidade pode ter várias imagens. A referência identifica a entidade de origem; não representa um único slot de imagem e não impõe substituição automática.

## Regras complementares do enriquecimento inicial

Para manter esta etapa limitada ao envio inicial, o plano considera as seguintes regras, sem introduzir um contrato de atualização:

- Na repetição da mesma referência para o mesmo asset, conservar também o endereço de origem inicialmente registrado. A ausência ou alteração desse endereço no retry não apaga ou sobrescreve a referência.
- Sem referência externa, cada envio com tags é uma adição explícita de sugestões. Não existe identidade de associação que permita diferenciá-lo de um novo enriquecimento; uma tag removida poderá voltar se for enviada novamente. O cliente que precisa preservar remoções entre retries deve enviar a referência.
- Uma nova referência ao mesmo asset pode acrescentar sugestões, mesmo que alguma dessas tags já tenha sido removida em outro contexto. Não há controle de procedência por tag ou histórico de remoções nesta entrega.

Essas regras complementares foram aprovadas pelo usuário junto ao plano técnico em 2026-10-12. A aprovação permanece limitada ao enriquecimento inicial; não autoriza sincronização futura.

## Escopo e fronteiras

Incluído: tags opcionais no upload externo, referências independentes, reaproveitamento de assets e preservação da edição pessoal.

Esta proposta amplia explicitamente a fronteira de 014 que deixava tags e referências fora do envio externo, e a de 005 que excluía tagging no momento de captura. A captura manual continua sem classificação obrigatória. Não alterar as specs implementadas para declarar esta proposta entregue antes da aprovação e validação.

Fora do escopo: armazenamento genérico de metadados, modelos por álbum/obra, procedência ou gerenciamento de tags por aplicação, atualização/sincronização automática ou bidirecional, perfis, uploadedBy, autenticação, coleções, infraestrutura externa, alterações no Media Pulse e novas telas administrativas.

As regras técnicas de campos, serialização, respostas, validação e persistência pertencem ao plano técnico. Preservar o contrato atual de `source`; não substituir sua string por um objeto incompatível.

## Critérios de aceitação

- Upload sem enriquecimento continua compatível com 014.
- Upload com tags torna imagens novas ou reutilizadas pesquisáveis pelas associações enviadas, conforme a política de reenvio aprovada.
- Tags pessoais existentes permanecem; lista vazia não apaga associações; limites são aplicados à união.
- Referências identificam entidades sem depender de tags e admitem entidades independentes no mesmo asset.
- Consulta recupera o estado real das tags e referências; conteúdo e visibilidade continuam como 014.
- Repetições não duplicam arquivos, tags ou referências nem sobrescrevem os metadados originais do asset.
- Reenvio da mesma referência para o mesmo asset não restaura tags removidas manualmente.
- Uma entidade pode associar vários assets sem conflito ou substituição da imagem anterior.
- Retry da mesma associação preserva seu endereço de origem; envio sem referência usa adição explícita, conforme as regras complementares acima.
- Falha de enriquecimento deixa o estado anterior intacto e nunca apaga arquivo reutilizado.
- Busca, chips, assuntos, relacionadas e edição manual funcionam sem novos controles ou alterações no fluxo de captura.
- Testes de acervo temporário cobrem duplicatas, limites, entradas inválidas, falhas e concorrência; não acessam os dados pessoais.
- Nenhuma chamada ao Media Pulse, sincronização ou procedência por tag é implementada nesta etapa.

## Próxima etapa

Plano técnico em [plan.md](plan.md), preparado após o pedido de continuidade. O enriquecimento está implementado dentro destas fronteiras; avaliar seu uso com o acervo real antes de propor novas capacidades. Não antecipar mecanismos para sincronização futura.
