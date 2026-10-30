# Proposta de interface — revisão por grupos

Planejamento solicitado antes de implementar, posteriormente aprovado pelo pedido de revisão contra DESIGN.md e implementação. A avaliação mostrou cópias reais e variantes de expressão/pose; o desenho permite comparar sem pressupor que todo grupo tenha uma única imagem correta.

## Entrada e estrutura

Entrada secundária `Review duplicates` junto às ações da Library, com contagem discreta quando disponível. Sem alerta sobre as imagens da galeria e sem banner permanente. Tela própria dentro da navegação existente: `Back to Library`, título, progresso `Group 1 of 66` e uma frase curta explicando que são sugestões. Retorno restaura o contexto da Library. Uma URL de grupo permite reload/voltar sem abrir outro grupo arbitrariamente.

Um grupo por vez, não uma lista de todos os pares. No snapshot inicial, os 71 pares correspondem a 66 grupos: 62 com duas imagens e quatro com três. Agrupar evita repetir a mesma cópia em apresentações diferentes. Conexões transitivas não autorizam tratar todas as imagens como equivalentes.

Modo padrão `Likely copies` corresponde a 0.03. A opção secundária `Broader review` fica em um menu discreto e tem progresso separado, informando `May include different expressions and poses`. Distâncias numéricas e parâmetros do modelo não entram na superfície principal do produto. Trocar modo não aplica escolhas pendentes.

## Cartões: a imagem vem primeiro

Grade de duas ou três colunas no desktop, cartões com estágio de altura visual igual e imagem inteira em `contain`, sem recortar ou deformar. Fundo neutro, cantos de 16 px, espaço de 16–24 px e controles abaixo da imagem. Em grupos maiores, quebrar em linhas; não usar carrossel que esconda candidatas. No celular, cartões empilhados e rodapé no fluxo, sem cobrir imagens com ações fixas.

Cada cartão mostra:

1. Imagem grande; uma ação explícita de ampliar abre comparação com navegação entre as imagens do grupo e retorno ao cartão/foco. O clique de ampliar não altera a seleção.
2. Selo opcional `Suggested to keep`, acompanhado de um motivo verificável: `Higher resolution`, `Same resolution · larger file` ou `Different crop · compare`. Não apresentar score, porcentagem de confiança ou diagnóstico de nitidez não medido.
3. Dimensões em px e tamanho em MB, numa linha discreta. Quando houver publicação, uma indicação curta `2 public links` explica o que será preservado. Nome completo, formato e tags ficam em detalhes expansíveis.
4. Controle sempre visível `Keep` / `Remove`, com estado textual, ícone e borda. Sugestão é diferente de decisão do usuário. Imagem marcada para remover continua nítida para comparação; não aplicar blur, risco sobre o conteúdo ou opacidade que esconda diferenças.

O cartão a manter usa borda de tinta e indicação `✓ Keep`; o de remover usa borda neutra, rótulo `Remove` e ícone discreto. O vermelho é reservado à confirmação final de remoção, não a toda a tela. Nenhum estado depende só da cor.

## Como sugerir uma ou várias imagens

Priorizar resolução como indício técnico; tamanho em bytes é desempate secundário, nunca prova de qualidade. Upscale, compressão, recorte ou diferenças de conteúdo podem contrariar a sugestão. A interface diz `Suggested`, sem afirmar `Best quality`.

Comparar tecnicamente imagens de proporções compatíveis. Proporção diferente indica possível recorte/variante: sugerir manter essa candidata também. Empate sem distinção útil e dimensões ausentes não geram um vencedor arbitrário; manter as candidatas empatadas e mostrar `Compare before removing`.

Uma variação de pose/expressão não pode ser identificada com segurança só pelo vetor CLIP. Na revisão ampliada, iniciar todas como `Keep` e exigir que o usuário marque explicitamente o que remover. Não prometer distinguir esses detalhes automaticamente. No modo conservador, pré-selecionar a sugestão técnica somente quando houver comparação clara; manter variantes/empates e imagens protegidas por referências de integração. Links públicos são absorvidos e não impedem a escolha de remover uma cópia.

O usuário pode alterar qualquer seleção elegível, manter duas ou mais e usar `Keep all`. A comparação não exige escolher uma vencedora. Deve restar pelo menos uma imagem a manter para confirmar remoções.

## Tags preservadas, com destino claro

Com uma mantida, unir suas tags às das removidas, sem duplicatas e sem apagar tags já presentes. Explicação junto ao resumo: `Tags from removed images will be added to the kept image`.

Com várias mantidas, não espalhar tags de variantes diferentes por todas. Uma delas recebe o indicador `Receives tags and links`; clicar esse indicador em outra mantida muda o destino. A mantida sugerida é o destino inicial quando inequívoca; caso contrário, pedir uma escolha antes de remover. As demais mantidas preservam suas próprias tags e publicações. Usar um único destino para tags e links evita dois seletores quase iguais.

Se as removidas não tiverem tags nem links públicos, não exigir escolher um destino sem utilidade; informar que as mantidas permanecerão inalteradas.

Mostrar o resultado da união como chips em uma área curta `Tags to preserve`, distinguindo discretamente novas adições das já existentes. Com `Keep all`, nenhuma transferência ocorre. Se o destino for marcado para remover, escolher outra mantida apenas quando única; caso contrário, pedir o novo destino. Não transferir tags nem alterar o acervo ao alternar seleções.

O usuário autorizou aumentar ou remover o limite atual de oito tags. Proposta: remover o teto de quantidade por imagem em todos os fluxos, preservando normalização, unicidade e validação do nome (48 caracteres). União de 11 ou mais tags não bloqueia a consolidação e não exige escolher quais perder. A revisão mostra inicialmente até oito chips e uma ação `Show all 17 tags`, mantendo a apresentação curta. Captura, editor pessoal, tagging em lote e enriquecimento por API devem aceitar a mesma regra; não criar uma exceção apenas para duplicatas.

Tags absorvidas tornam-se associações pessoais preservadas no destino; não copiar procedência de integrações nem fingir que o destino pertencia à mesma referência de origem.

## Confirmação e conclusão

Rodapé curto: `Keep 1 · Remove 2`, destino das tags e botão `Review removal`. Ação secundária `Skip for now` preserva o grupo para outra visita; não registra rejeição definitiva. `Keep all` resolve o grupo sem excluir nem mesclar tags.

`Review removal` abre uma confirmação inline no mesmo rodapé, mantendo as imagens visíveis. Mostrar quantidade a remover, quantidade a manter, destino/adições de tags, número de links públicos preservados e `Removal is permanent`. Botões `Cancel` e `Remove 2 images`. Nenhuma ação destrutiva ocorre na seleção ou na ampliação. Sem segunda janela modal, sem exclusão de todos os grupos de uma vez.

Após sucesso, avançar ao próximo grupo com mensagem breve `2 images removed · tags preserved`. Em falha, manter imagens/seleções e informar erro; não anunciar conclusão antecipada. Finalização apresenta uma mensagem simples, sem dashboard de estatísticas.

O aplicativo atual exclui definitivamente e não tem lixeira. Não oferecer `Undo` fictício. Criar recuperação/lixeira seria outra mudança de escopo.

## Links públicos absorvidos

Pedido explícito posterior: links públicos devem ser absorvidos. As URLs das imagens removidas permanecem idênticas e passam a servir a imagem mantida escolhida como destino. Não criar novas URLs no lugar das antigas, não revogá-las durante a remoção e não depender de editar o blog. Com uma mantida, o destino é automático; com várias, usar a mesma escolha explícita de tags e links.

Resumo visível: `3 public links will keep working with image 1`. O destino pode acumular vários tokens ativos. Seu link principal atual permanece como o link de copiar; se não tinha publicação, adotar um dos herdados como principal. O visualizador indica `3 active public links`, permite copiar o principal e revogar o conjunto com rótulo que deixe o alcance claro. Links já revogados não voltam a funcionar. Ocultação continua independente da publicação.

O schema atual permite apenas um token por imagem, então a absorção exige migração preservando os tokens existentes e resolução de múltiplos tokens para a imagem destino. O endpoint público continua servindo os bytes diretamente, com validadores relativos à imagem efetivamente servida. Caches já entregues podem continuar exibindo a cópia anterior até expirar; não há purga de caches nesta mudança.

Preservar tags, reatribuir links e remover registros precisa ocorrer em uma única operação de metadados validada pelo servidor. Falha de validação não pode deixar links quebrados ou remover sem absorver. Revalidar publicações e tags no momento de confirmar, incluindo alterações posteriores à abertura do grupo.

Referências de aplicação são distintas de URLs públicas e envolvem IDs, revisões e procedência. Migrá-las automaticamente ainda não foi solicitado. Nesta proposta, imagens com referências ativas de integração ficam mantidas e identificadas como `Used by an integration`; não bloqueá-las apenas por possuírem links públicos.

## Estados e acessibilidade

Preparando, falha com retry e nenhum grupo encontrado são estados distintos. Grupos incompletos não geram falsas garantias de que a biblioteca está limpa; AVIF precisa de cobertura no runtime definitivo. Decisões não reaparecem para o mesmo conjunto de candidatos inalterado, mas uma nova imagem pode abrir nova revisão.

Botões com alvos de pelo menos 44 px, foco visível, `aria-pressed` na seleção, labels únicos, mensagem de resultado em região live. Teclado e leitor de tela devem comunicar manter/remover e destino de tags. Navegação/ampliação preserva a seleção; não executar remoção ao pressionar Enter em um filtro.

## Prévia revisável

Protótipo local privado em `/home/vitor/Documentos/relatorios/visual-library-duplicate-interface/index.html`. Usa imagens do relatório, tags e contagens de links de exemplo, com interações simuladas: escolha de várias mantidas, destino/união de tags e links, ampliar e confirmação inline. Nenhuma chamada à API ou alteração do acervo. O produto mantém os rótulos em inglês, conforme a interface atual; a prévia em português facilita discutir o fluxo.

## Implementação posterior

Reutilizar tokens, ProgressiveImage, tags e padrões de navegação do projeto. Componentes específicos de revisão e estado por grupo; sem framework novo ou painel de infraestrutura. Integração implementada com encoder próprio, sem dependência do Immich. Preservação de tags/links e exclusão dos registros formam uma operação validada no servidor, sem encadear DELETEs individuais pelo navegador. Detalhes e validações em `plan.md`.

## Revisão contra DESIGN.md e ajustes aplicados

- Tokens existentes de cor/espaçamento/raio e fonte Inter; título da tela em 28 px, textos de apoio em 14 px e metadados curtos em 12 px.
- Cartões e estágios em 16 px, diálogo em 32 px, controles de seleção/círculo em pill. Removidos os raios intermediários da primeira prévia e sombras decorativas.
- Fundo branco com superfícies neutras; vermelho concentrado na ação primária e no indicador de navegação atual. Escolhas comunicadas por texto, ícone e borda.
- Imagens inteiras com `contain` e ampliação separada da seleção; alvos de pelo menos 44 px, foco visível, Escape no diálogo e confirmação no fluxo.
- Entrada integrada à navegação atual, captura ausente somente na revisão e retorno contextual. Não foi criado painel de métricas ou parâmetros de ML na interface.

Chrome com a implementação real: desktop 1440×1000 e mobile 390×844 sem overflow horizontal, imagens carregadas/sem recorte e interações de escolha, destino, modos, reload, confirmação, cancelamento e retorno verificadas. Artefatos de teste usam fixtures, sem expor o acervo na documentação versionada.
