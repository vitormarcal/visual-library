# Feature: navegação persistente por assunto

Status: implementada após os pedidos de continuidade do usuário em 2026-10-04. Decisões em [discovery.md](discovery.md); implementação e validação em [plan.md](plan.md).

## Problema e objetivo

A navegação de 012 fica apenas na memória: um assunto não tem endereço próprio, reload perde a tela e Voltar/Avançar não acompanha o fluxo. Permitir reabrir o contexto por endereço e navegar pelo histórico da aba sem perder o caminho de origem.

## Fluxo aprovado

1. Library, Explore e assuntos têm endereços que identificam o contexto atual.
2. O endereço do assunto preserva tag base, busca e filtros adicionais. Abrir esse endereço ou recarregar mantém os mesmos critérios, sujeitos a mudanças no acervo.
3. Entrar por um cartão de Explore continua abrindo o assunto inteiro, sem refinamentos herdados.
4. Mudar de tela ou abrir o visualizador cria um passo no histórico. Digitar busca, adicionar/remover filtros e limpar refinamentos atualiza a entrada atual, sem criar passos por edição.
5. Com imagem aberta, o primeiro Voltar fecha o visualizador e retorna à galeria de origem; o próximo retorna à tela anterior. Avançar reabre a imagem que estava sendo vista.
6. Reload com visualizador aberto recupera a imagem atual e sua galeria de origem, incluindo busca/filtros. O caminho temporário de conexões não é recuperado.
7. “Back to Explore” sempre abre o diretório dentro do app. Recupera busca/posição conhecidos; em entrada direta sem contexto anterior, abre o início do diretório sem busca.

Exemplo: Explore → Manara → buscar “wallpaper” → filtrar “colorido” → imagem A → relacionada B. Voltar retorna à galeria refinada de Manara; Avançar reabre B; após fechar o visualizador, Voltar retorna a Explore.

## Endereços e restauração

- Identificar assuntos e filtros sem depender de posição na lista, contagem ou capa. Nomes de tags continuam livres; espaços, acentos e caracteres especiais devem funcionar.
- A identificação de Library/Explore e suas consultas também deve ser preservada para que o histórico restaure os três contextos de forma consistente.
- O endereço representa critérios de navegação e imagem atual, não uma cópia do acervo. Não prometer resultados idênticos após edições ou exclusões.
- Posição e foco pertencem ao contexto da entrada na aba. No percurso de Voltar/Avançar, restaurar a posição e um alvo de foco válido quando disponíveis, conforme o comportamento de 012.
- Um endereço aberto em outra aba não transporta posição de rolagem, seleção em lote ou contextos de outras telas que não estejam representados nele. Após reload, garantir assunto, critérios e imagem atual; posição exata depende dos dados de sessão disponíveis e do layout.
- Não carregar por um instante a biblioteca padrão para depois trocar ao assunto solicitado. Enquanto dados necessários não chegaram, mostrar carregamento no contexto de destino.

## Histórico e visualizador

- Abrir uma imagem cria uma camada sobre a galeria de origem. Setas e relacionadas atualizam a imagem da entrada atual sem criar novos passos de páginas. O Back interno mantém a excursão de 010 e atualiza a imagem representada pelo endereço.
- A galeria de origem fica intacta ao explorar conexões fora de seus resultados. Nenhuma troca automática de assunto acompanha a imagem relacionada.
- Após reload ou reabertura por Avançar, começar uma nova sessão de conexões no visualizador; não reconstruir um caminho fictício de imagens.
- Fechar por botão ou Escape tem o mesmo destino de fechar por Voltar: galeria de origem. O fechamento não deve criar outro passo que reabra o visualizador quando o usuário quiser voltar à tela anterior.
- Abrir diretamente um endereço com imagem também oferece a galeria de origem como primeira saída da camada, inclusive pelo Voltar. Depois dela, respeitar o histórico real da aba, sem prender o usuário no app.
- Repetir a seleção da tela atual ou da imagem atual não cria entradas duplicadas.
- “Back to Explore” usa a origem conhecida quando existir e um destino explícito interno quando não existir. Evitar ciclos artificiais de assunto → diretório → assunto causados pelo próprio botão de retorno.
- Chips de tags no visualizador continuam refinando a galeria atual, respeitando a tag base e o limite de três; não criar outra ação para navegar a um assunto nesta etapa.

## Estados indisponíveis

- Assunto desconhecido ou endereço inválido: informar que o destino não está disponível e oferecer Explore/Library. Não abrir um assunto diferente nem mostrar a biblioteca inteira como se fosse o destino pedido.
- Assunto conhecido sem imagens: manter nome/contexto quando disponíveis e um estado vazio com retorno, conforme 012.
- Imagem removida: recuperar a galeria de origem com feedback discreto; não selecionar outra imagem automaticamente. Manter seus refinamentos.
- Filtro de um endereço que não pode ser resolvido: explicar o critério indisponível e permitir removê-lo explicitamente. Não ignorar silenciosamente o filtro e ampliar resultados. Refinamentos demais ou malformados também precisam de feedback e recuperação explícita.
- A regra de filtros indisponíveis vale ao reabrir endereços/histórico. Exclusões feitas no fluxo atual mantêm a reconciliação existente, com atualização correspondente do endereço e feedback se filtros forem retirados.
- Carregamento e falha de requisição não significam destino inexistente. Oferecer retry antes de concluir que uma tag/imagem não existe.

## Operações em andamento

- Navegação interna mantém SaveDropzone e estado de upload, como em 012. Reload/fechar aba continuam encerrando trabalho não concluído, sem promessa de retomada.
- Capturar o conjunto de IDs e tags de uma operação em lote ao iniciá-la. Sua resposta atualiza apenas essas imagens, mesmo que o histórico tenha levado a outra tela.
- Controles explícitos de troca de contexto podem continuar desabilitados durante aplicação em lote. Se o Voltar/Avançar nativo mudar o contexto, manter a operação em andamento e não alterar o destino autorizado, a URL ou a seleção da nova tela para acomodar uma resposta antiga.
- Seleção temporária não é persistida em endereço ou histórico. Ao sair de uma galeria, descartá-la; não transformar navegação em nova aplicação de tags.
- Cancelar restaurações antigas de foco/rolagem quando houver outra navegação ou interação; respostas tardias não movem o usuário de volta a uma tela anterior.

## Visual e acessibilidade

Preservar DESIGN.md e a apresentação revisada de 012: Explore antes de Library, capas estáveis, etiquetas compactas e galeria em destaque. Aproveitar a barra de endereço e os comandos do navegador, sem painel de histórico, barra adicional de breadcrumbs ou novos controles fixos no visualizador.

Destinos navegáveis devem permitir o comportamento esperado de links, inclusive abrir em nova aba. Manter identificação da tela atual, foco visível, alvos de 44px, nomes acessíveis e título do documento coerente com o destino. Restaurar foco sem provocar saltos indevidos; não anunciar cada letra digitada como uma nova página.

## Limites e mudanças de fronteira

Esta feature substitui os limites de 012 que deixam endereços/reload fora de escopo e o limite de 010 que não integra o visualizador ao histórico do navegador. Seu histórico interno de conexões continua temporário e separado.

Não altera capas, regras de tags, ranking de relacionadas, upload. Não introduz coleções, favoritos internos, histórico permanente de visitas, perfis, compartilhamento público ou dependências externas. Endereços acessam o mesmo acervo local.

## Critérios de aceitação

- Abrir em nova aba um assunto refinado recupera o assunto correto, sua busca e filtros; entrar pelo cartão continua abrindo o grupo completo.
- Reload mantém Library/Explore/assunto e seus critérios. Com visualizador aberto, mantém a imagem atual e a galeria de origem, sem reconstruir a excursão.
- Explore → assunto → refinamentos → imagem → relacionadas → Voltar/Avançar segue o fluxo aprovado, sem exigir desfazer letras, filtros ou cada relacionada.
- Botão de fechar e Escape não criam passos duplicados; retorno explícito ao diretório funciona após entrada direta e após navegação interna.
- Voltar/Avançar recupera entradas do mesmo assunto com refinamentos diferentes, sem misturar seus contextos ou perder a busca anterior de Explore/Library.
- Nomes especiais, destinos removidos, critérios indisponíveis e falhas de carregamento permitem recuperação e não ampliam resultados sem indicação.
- Navegação durante upload/salvamento não redireciona respostas a outras imagens, perde o progresso interno ou restaura foco antigo indevidamente.
- Teclado, nova aba, foco/rolagem, celular e espaço da imagem no visualizador continuam coerentes com 012/009.

## Revisão de direção

Constituição: reforça redescoberta e comportamento previsível sem taxonomia ou ferramentas de administração. DESIGN.md: preserva controles e linguagem visual existentes. A pressão técnica está na conciliação entre endereço, histórico de páginas, origem da galeria e excursão temporária; resolver apenas os estados descritos, sem um sistema genérico de navegação.

Implementação concluída. A validação isolada está registrada no plano; a avaliação de redescoberta com o acervo real permanece pendente.


## Ajuste da entrada inicial

A pedido do usuário, `/` abre Explore, acompanhando a ordem Explore → Library dos links. Library possui endereço explícito `/?view=library`. Endereços antigos com busca, filtros ou imagem e sem view continuam abrindo Library; a busca de Explore mantém view=explore explícito. Esta decisão substitui a entrada padrão Library definida anteriormente em 012 e no roadmap.
