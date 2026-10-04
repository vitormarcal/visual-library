# Discovery: navegação persistente por assunto

Status: decisões principais aprovadas e consolidadas em [spec.md](spec.md), proposta para revisão. Sem implementação ou plano técnico. Corresponde à etapa 2 do [roadmap](../../ROADMAP-organizacao-visual.md).

## Problema e evidências atuais

A etapa 1 oferece Explorar, galerias por assunto e retorno com busca, rolagem e foco. O usuário avaliou positivamente a experiência e solicitou ajustes na etiqueta e na ordem dos acessos, já incorporados ao commit 5756ced.

No código atual, biblioteca, diretório e assunto são estados locais de app.vue. A tela começa em Library; consultas, filtros e posições ficam na memória da sessão. A URL não identifica a tela ou o assunto. Recarregar perde esse contexto e Voltar/Avançar do navegador não acompanha as transições internas.

O visualizador tem outro histórico: Back retraz conexões entre imagens, descartado ao fechar. As setas seguem os resultados da galeria de origem. Esse comportamento de 010 não deve ser confundido com navegação entre páginas.

O pedido atual seleciona o discovery da etapa 2. Não constitui aprovação prévia das decisões propostas abaixo nem autoriza implementar coleções.

## Objetivo

Abrir um assunto diretamente por endereço, continuar no contexto relevante após recarregar e usar Voltar/Avançar de forma previsível, preservando a apresentação discreta da etapa 1.

Fluxo a definir: Library → Explore → assunto → imagem; retornar e avançar sem perder o contexto da origem.

## Base preservada

- Ordem visual dos acessos: Explore, depois Library. A inversão dos links não alterou a entrada padrão atual em Library.
- Cartões com uma capa persistida e identificação compacta “nome · quantidade”.
- Entrar por um cartão começa com todas as imagens do assunto e sem refinamentos herdados da biblioteca.
- A tag base define o assunto e conta para o limite de três filtros; limpar refinamentos não remove a base.
- Busca/filtros da biblioteca são independentes dos refinamentos do assunto e da busca do diretório.
- Captura não exige tags e upload não atribui o assunto automaticamente.
- Coleções continuam conjuntos curados distintos das tags; não são parte desta etapa.

## Decisão aprovada: Voltar com o visualizador aberto

O usuário aprovou: se uma imagem estiver aberta, o primeiro Voltar do navegador fecha o visualizador e devolve à galeria de origem; o próximo Voltar retorna à tela anterior. Exemplo: Explore → Manara → imagem; Voltar → Manara; Voltar → Explore.

Não saltar diretamente para a tela anterior enquanto o visualizador estiver aberto no fluxo normal de navegação.

O usuário também concordou que o Back interno de conexões continua uma ação diferente. Avançar e reload foram definidos nas decisões abaixo. A spec consolida a atualização da imagem atual sem criar passos por cada conexão.

## Decisão aprovada: conteúdo do endereço

O usuário aprovou que o endereço de um assunto represente a tag base, a busca e os filtros adicionais atuais. Recarregar ou abrir esse endereço mantém os mesmos critérios de seleção; alterações do acervo podem mudar os resultados. Exemplo: Manara com busca “wallpaper” e filtro “colorido” reabre com esses refinamentos.

Entrar pelo cartão de Explorar continua abrindo todas as imagens da tag, sem refinamentos herdados, como aprovado na etapa 1. Um endereço refinado e a entrada limpa pelo cartão são caminhos distintos.

Não descartar busca e filtros ao reabrir um endereço refinado.

## Decisão aprovada: passos do histórico

O usuário aprovou que mudar entre Library, Explore e um assunto, ou abrir o visualizador, crie um passo de navegação. Digitar busca, adicionar/remover filtros e limpar refinamentos atualiza o endereço da entrada atual, sem criar um passo por edição.

Exemplo: Explore → Manara → buscar “wallpaper” → adicionar “colorido”; Voltar retorna a Explore de uma vez. Avançar volta ao assunto com os refinamentos mais recentes registrados nessa entrada. Se uma imagem estiver aberta, o primeiro Voltar fecha o visualizador, conforme aprovado.

Essa regra evita ter que desfazer letras e filtros antes de sair do assunto. O comportamento de Avançar/reload com imagem aberta está definido abaixo.

## Decisão aprovada: recuperar a imagem aberta

O usuário aprovou: após Voltar fechar o visualizador, Avançar reabre a imagem que estava sendo vista. Recarregar com o visualizador aberto também recupera essa imagem e mantém a galeria de origem, sua busca e filtros.

O endereço da entrada com visualizador identifica a imagem atual, inclusive se ela foi alcançada por uma conexão fora dos resultados. Seguir relacionadas ou usar setas atualiza essa entrada sem adicionar passos ao histórico de páginas. Assim, o primeiro Voltar fecha a camada inteira, conforme aprovado.

O usuário concordou que o caminho temporário de conexões do Back interno não é persistido após reload: recuperar a imagem atual não significa recuperar toda a excursão. Uma imagem removida deve produzir feedback e uma galeria de origem acessível, sem abrir outra imagem silenciosamente; este tratamento de ausência será consolidado na spec.

## Decisão aprovada: retorno após entrada direta

O usuário aprovou que “Back to Explore” sempre leve ao diretório de assuntos dentro do app. Quando o assunto foi aberto pelo diretório, recuperar a busca, posição e cartão de origem conhecidos. Quando foi aberto diretamente em uma nova aba, mostrar Explorar sem busca, no início, pois não há contexto anterior a restaurar.

A ação explícita não deve usar indiscriminadamente o Voltar do navegador, que pode levar para um site externo. O Voltar nativo mantém seu significado de percorrer o histórico da aba.

## Regras complementares propostas na spec

Estados indisponíveis, retorno explícito sem duplicação de telas, posições por entrada do histórico e operações em andamento foram detalhados como propostas em spec.md. Não foram submetidos a perguntas individuais nem representam aprovação explícita do usuário. Abrir novos assuntos pelos chips do visualizador fica fora desta entrega: manter seu significado atual de refinamento.

## Limites iniciais

Sem alterações nas capas ou expansão visual, histórico permanente de visitas, favoritos internos, coleções, rotas de perfis, metadados obrigatórios, classificação automática ou infraestrutura externa. Endereços diretos acessam o mesmo acervo local; não tornam imagens públicas nem criam compartilhamento externo.

Aplicar CONSTITUTION.md e DESIGN.md: navegação previsível, poucos controles, imagens em destaque e nenhum painel de gerenciamento de URLs ou histórico.

## Encerramento do discovery

Consolidar decisões suficientes para uma spec curta sobre endereços, reload, histórico, retorno explícito e estados indisponíveis. Elaborar plano técnico após aprovação da spec, conforme AI_PRODUCT_WORKFLOW.md.

Validar a implementação futura com acervo isolado: links diretos, reload, sequências de Voltar/Avançar, buscas/filtros combinados, imagens/tag removidas, foco/rolagem, navegação durante saves e celular. Nenhuma dessas validações foi executada para esta etapa ainda.


## Continuidade

Após os pedidos de continuidade do usuário, a implementação foi concluída. Resultados e limites da validação estão em [plan.md](plan.md); os registros acima descrevem as decisões e propostas do discovery original.
