# Avaliação de duplicatas

Primeira etapa autorizada pelo pedido “continue” em 2026-10-30. Interface de revisão e descarte permanecem como proposta posterior.

## Encoder e distância

Usar o Immich ML existente no Mordor: `ViT-B-16-SigLIP2__webli`, distância cosseno máxima `0.03`. Nenhuma troca do encoder da busca por conteúdo e nenhuma mistura entre espaços de vetores.

O encoder remoto usa resize squash bicúbico para 224×224 e média/desvio 0.5. O encoder atual daqui usa exportação q8/Transformers.js e redução prévia com sharp; compartilhar família/dimensão não comprova equivalência numérica. Usar o endpoint real evita uma aproximação silenciosa.

O repositório de duplicatas instalado no Immich usa `<=>` e `<= maxDistance`. O experimento usa `1 - cosine_similarity` sobre vetores normalizados e todos os pares prontos, sem repetição. Não reproduz os demais filtros, limite de vizinhos ou agrupamento do Immich. Envia os originais do Visual Library; previews gerados pelo fluxo próprio do Immich podem resultar em pequenas diferenças.

## Implementação isolada

`tools/visual-similarity/duplicate-evaluate.py` abre SQLite em modo somente leitura e congela metadados das imagens visíveis no início. Valida caminhos, hash-fonte, dimensão/valores dos vetores e limite de 40 MP. Falhas por imagem são explícitas; cobertura parcial preserva relatório e retorna código 2.

Uma requisição de inferência por vez ao endereço numérico informado; sem proxies de ambiente, sem redirects, timeout de 120 s. Sem instalar bibliotecas, baixar modelos ou alterar serviços; usar Python/NumPy/Pillow disponíveis no host e o modelo já cacheado.

Output fora do repositório e separado dos dados. Manifesto impede misturar snapshots/configurações; cache liga encoder e hash-fonte. Relatório HTML com previews de até 960 px, resultados JSON sem vetores e exportação manual de julgamentos. Não avaliado não conta como acerto. Sem exclusões.

Fingerprint registra IDs de pesos, configuração e imagem observados. O script não detecta mudança concorrente do modelo servido: manter configuração estável durante a execução. Relatório representa visibilidade no início; arquivos privados estáticos não refletem ocultações posteriores.

## Validação

Seis testes Python passaram no Mordor com dependências existentes: distância/normalização; limiar/pares únicos; vetores inválidos; endpoint explícito; HTML seguro/julgamento inicial; integração HTTP/SQLite com fixtures, ocultos, falha isolada, cache e hashes do banco/originais preservados.

Sem mudanças no aplicativo, schema, npm, versão ou deploy; build Nuxt não é necessário para esta ferramenta isolada. Cobertura, custos e artefatos da execução real serão registrados aqui ao concluir. Qualidade depende de julgamento humano dos resultados.

## Resultado da execução real — 2026-10-30

- Snapshot: 1.141 imagens visíveis; 1.139 preparadas, sem hits de cache na primeira execução.
- Duas falhas AVIF (`UnidentifiedImageError` no Pillow do host): IDs `600f818d-e62f-4ba2-ae5b-f85f51e41a4f` e `70459860-93b8-4295-bc18-e89f83312025`. Não foram enviadas à inferência nem incluídas nos pares; não são classificadas como sem duplicatas.
- 648.091 comparações, 71 pares candidatos envolvendo 136 imagens distintas a distância máxima 0.03. Desses pares, 37 estão até 0.02 e 12 até 0.01. Esses números não medem precisão nem quantidade confirmada de duplicatas.
- Tempo total: 460,83 s; requisições de inferência: 338,11 s; ranking: 0,69 s. O restante inclui leitura/hash/decodificação/previews/cache. Não é benchmark de um runtime próprio do Visual Library.
- Saída 2, conforme contrato de cobertura parcial. Não houve modificação do banco/originais pelo script nem exclusões.

Artefatos privados no Mordor: `/tmp/visual-library-duplicates.XhNYuay0/report/`. Cópia local para revisão: `/home/vitor/Documentos/relatorios/visual-library-duplicates-2026-10-30/index.html`, com `results.json`, `run.json`, previews e cache no mesmo diretório. Não estão no repositório.

Chrome headless real: relatório abre com 71 controles de julgamento; exportação JSON verificada com fingerprint e par escolhidos; layouts 1440×900 e 390×844 sem overflow horizontal; nenhum erro JS. O julgamento artificial do teste foi removido; nenhum par foi confirmado automaticamente. Seis testes Python passaram no host. `git diff --check` passou.

Próxima decisão depende da revisão dos pares. A ferramenta usa o serviço Immich existente apenas para avaliação; não foi criada dependência entre os produtos em produção. Interface/descarte e runtime definitivo ainda não foram implementados.

## Retorno da revisão pelo usuário — 2026-10-30

O usuário relatou: “eu marquei apenas alguns mas todos os itens estão certos, são copias”. Isso registra confirmação humana por relato sobre os resultados apresentados, mesmo com marcações individuais parciais. Não foi importado um arquivo de julgamentos nesta etapa e os campos não marcados do relatório não foram convertidos automaticamente em rótulos positivos.

O retorno sustenta adotar modelo/configuração de referência e distância máxima 0.03 como ponto de partida da primeira versão integrada. Não constitui medição de recall: não sabemos quantas cópias deixaram de ser encontradas, e as duas AVIF continuam fora da cobertura. Também não valida um encoder local diferente do serviço utilizado no experimento.

A sugestão de qual imagem manter será tratada na interface de revisão: priorizar resolução, usar tamanho em bytes como critério secundário, permitir mudar a seleção e manter ambas. Maior resolução/tamanho não garante qualidade; a sugestão não autoriza descarte. Ao consolidar em uma imagem, preservar a união das tags, conforme a proposta. Ainda falta definir descarte/recuperação e tratamento de links públicos antes de implementar essas ações.

## Ampliação do limiar — 2026-10-30

O usuário concordou em ampliar o limiar para procurar cópias fora dos 71 pares iniciais. Foi implementado `duplicate-expand.py`: lê os resultados e os 1.139 vetores válidos do mesmo snapshot, verifica encoder/hash-fonte/dimensão, compara novamente todos os 648.091 pares e gera relatório separado. Sem consulta ao acervo, download, ML ou novas inferências. Ausência/cache inválido aborta; não há fallback silencioso.

Resultados cumulativos:

| Distância máxima | Pares totais | Adicionais sobre 0.03 |
| --- | --- | --- |
| 0.03 | 71 | 0 |
| 0.04 | 108 | 37 |
| 0.05 | 148 | 77 |
| 0.06 | 201 | 130 |
| 0.08 | 381 | 310 |
| 0.10 | 681 | 610 |

Tempo da expansão: 1,11 s no Mordor, incluindo cache, ranking e cópia dos previews dos candidatos. Permanecem as duas falhas AVIF; não houve análise delas nesta rodada. Os 610 candidatos novos ainda não foram julgados e não contam como duplicatas confirmadas.

O relatório inclui tabela cumulativa, seletor de limiar e opção inicialmente marcada para mostrar apenas novos candidatos. Julgamentos são independentes do relatório anterior. Revisão sugerida: começar com os 37 novos até 0.04 e avançar conforme utilidade observada, sem mudar automaticamente o limiar futuro do produto.

Artefatos privados: `/tmp/visual-library-duplicates.XhNYuay0/report-expanded/` no Mordor; cópia local em `/home/vitor/Documentos/relatorios/visual-library-duplicates-2026-10-30-expanded/index.html`. Relatório original preservado.

Sete testes Python passaram, incluindo expansão sem inferência, preservação da fonte e rejeição de cache de outro encoder. A validação do relatório no navegador cobre filtros e exportação; nenhuma exclusão ou integração ao produto nesta etapa.

## Retorno sobre a ampliação — 2026-10-30

O usuário informou que marcou apenas parte dos resultados, encontrou muitas cópias reais adicionais e também muitos casos com diferenças de expressão facial, direção do rosto ou posição de um braço. Para deduplicação, tratar essas variações como imagens distintas; não presumir que diferenças pequenas sejam descartáveis. O relato não especifica o limiar selecionado nem fornece contagens por faixa. Nenhum julgamento parcial foi extrapolado para os demais pares.

O usuário também observou apresentações repetidas de grupos de dois. O relatório atual mostra pares independentes; a mesma imagem pode reaparecer em diferentes pares. A interface futura deve reunir candidatos relacionados em uma apresentação por grupo e permitir escolher mais de uma imagem para manter. Agrupar é uma decisão de apresentação, não confirmação de que todos os membros sejam cópias: proximidade A–B e B–C não garante que A–C seja duplicata.

O retorno mostra o compromisso entre encontrar mais cópias e trazer variantes diferentes. Manter 0.03 como ponto inicial conservador, com base na revisão inicial, e considerar a faixa ampliada exploratória até obter julgamentos por distância. Não há evidência suficiente para escolher um novo limiar global ou afirmar que CLIP sozinho distingue consistentemente essas variações.

## Planejamento visual solicitado — 2026-10-30

O usuário pediu planejar antes da implementação, com sugestões claras de quais imagens manter/remover e absorção de tags. O fluxo foi detalhado em `ux-review.md` e demonstrado por `interface-preview.html`, um protótipo independente do aplicativo. A cópia privada com dois grupos reais do relatório está em `/home/vitor/Documentos/relatorios/visual-library-duplicate-interface/index.html`. Tags e contagens de links da prévia são exemplos, não dados importados do acervo.

Durante o planejamento, o usuário determinou que links públicos devem ser absorvidos e o limite de tags aumentado ou removido. Isso substitui a proposta inicial de bloquear imagens com links públicos e bloquear uniões acima de oito tags. A proposta atual remove o teto de quantidade, preserva validação de cada nome e usa um destino explícito para tags e URLs quando várias imagens são mantidas. URLs existentes continuam funcionando e passam a servir a imagem destino; links já revogados permanecem revogados.

Implementar essa regra exigirá migrar o armazenamento de publicações, que hoje permite só um token por imagem, preservar um link principal estável para copiar e adaptar a revogação para o conjunto de links ativos. Transferência de tags/links e remoção de registros devem ser uma operação de metadados validada no servidor. Referências de aplicações não são sinônimo de links públicos e sua migração automática não foi solicitada.

Prévia validada em Chrome real: manter múltiplas candidatas, escolher destino, união de 11 tags sem bloqueio, expansão de chips, contagem/destino de links, bloqueio de remoção de todas as imagens, ampliação, confirmação inline, cancelamento e avanço simulado. Layouts 1440×1100 e 390×844 sem overflow; sem erros JS. A inspeção visual corrigiu o estágio para exibir a imagem inteira com `contain`. Screenshots privados `desktop.png` e `mobile.png` junto à prévia.

Nesta etapa foram produzidos o plano e a prévia, sem alterar schema, limites reais, links ou arquivos da biblioteca. O plano técnico de integração será atualizado após revisão do fluxo. Sem deploy, exclusão real ou dependência permanente do Immich introduzida.

## Integração autorizada e implementada — 2026-10-30

O pedido seguinte aprovou o fluxo e determinou revisão contra DESIGN.md antes de implementar. Ajustes visuais registrados em `ux-review.md`: tokens existentes, título 28 px, texto de apoio 14 px, cartões/estágios 16 px, diálogo 32 px, controles acessíveis e vermelho concentrado na ação primária. A implementação reutiliza ProgressiveImage e a navegação atual, sem framework novo.

### Runtime próprio e compatibilidade do encoder

- `runtime/similarity/duplicate-*` usa o export visual do Immich/SigLIP2 v2, revisão `81999505043a05dbc3ff4c6ba9932d93a15216a4`. Download explícito na ativação e SHA-256 dos dois arquivos conforme discovery. Pesos no volume de dados, fora do Docker/Git. `onnxruntime-node` 1.30.0 já existia transitivamente; agora é também dependência direta fixa do runtime. Não foi introduzido novo binário/versionamento de pacote ou serviço permanente.
- Entrada do grafo: uint8 NHWC 1×224×224×3; saída de 768 dimensões, normalizada. Decoder sharp suporta AVIF estático, EXIF e primeiro frame de animações decodificáveis. Limite de 40 MP e orçamento para geometrias extremas; falha de arquivo fica isolada.
- O primeiro teste com resize bicúbico do sharp mostrou diferenças mensuráveis em relação ao Immich, inclusive em um par próximo ao limiar. Foi substituído por resize separável A=-0.5, antialiasing e arredondamento fixo de 22 bits, compatível com Pillow. Quatro golden hashes independentes gerados pelo Pillow 10.2 do Mordor cobrem ampliação, redução, dimensões mistas e identidade; a implementação JS reproduz todos.
- Nova comparação end-to-end com cinco previews privados do relatório: distância cosseno entre vetores locais e retornados pelo Immich no máximo 1,39×10⁻¹². Isso valida esses cinco inputs e o processamento compartilhado; não afirma equivalência universal de todos os decoders, ICC e fontes EXIF. Os vetores da busca por conteúdo não são misturados aos de duplicatas.
- Worker de preparo é ativado por ação do dono, processa uma imagem por vez com duas threads de inferência, verifica hash/caminho e revalida existência/visibilidade ao gravar. Encerra liberando o modelo. Flag persistida retoma pendências no startup e após capturas bem-sucedidas/visibilidade; sem bloquear uploads. Retry explícito, falhas isoladas e cooldown de modelo. Comparação exaustiva roda em worker thread separado do processo web e mantém cache de uma assinatura de vetores.

### Persistência, grupos e consolidação

Tabelas aditivas `image_duplicate_vectors`, `duplicate_reviews` e `image_public_link_aliases`. A tabela original de links principais permanece intacta, preservando tokens legados. Aliases permitem que vários tokens sirvam a imagem mantida, sem redirecionamentos ou alteração das URLs. O link principal do destino é preservado; se não existia, um herdado é promovido. Revogação remove principal e aliases em transação; links revogados não reaparecem.

Grupos conectados a 0.03 ou 0.10, sem afirmar equivalência entre todos os membros. IDs incluem fingerprint e integrantes/hashes. Grupos resolvidos e componentes sobreviventes deliberadamente mantidos são registrados para não reaparecerem imediatamente; uma nova cópia muda a identidade e permite nova revisão. Pular é temporário. Progresso distingue inativo, preparando, indisponível, cobertura parcial e pronto sem resultados.

`GET /api/duplicates`, `POST /api/duplicates/prepare` e `POST /api/duplicates/resolve` ficam atrás da autenticação/mesma origem existentes; credenciais de integração não recebem acesso. Revalidar metadados após ranking assíncrono e antes do commit. Revisão inclui tags, links, referências, visibilidade, dimensões e hash; mudanças exigem atualizar, sem aplicar escolhas antigas silenciosamente.

Resolução é uma única transação de metadados: adicionar tags pessoais no destino, transferir principal/aliases, excluir associações/vetores/registros das removidas, reconciliar capas e marcar grupos revisados. Não encadear DELETEs pelo cliente. Arquivos/previews são removidos somente após commit. Falha de limpeza pode deixar arquivo órfão sem acesso por rota; não desfaz metadados já confirmados.

Quantidade de tags removida globalmente de validação/editor/captura/bulk/enriquecimento; manter normalização, unicidade e 48 caracteres por nome. Mantidas várias imagens, só o destino escolhido recebe tags/links; se as removidas não têm nada a transferir, não exigir uma escolha adicional. Referências de aplicações continuam protegendo a imagem, sem migração de IDs ou revisões.

### Interface e navegação

Entrada **Review duplicates** na navegação existente; URL preserva grupo e modo, com retorno à origem. Um grupo por vez, sugestões técnicas explicáveis, várias mantidas, destino explícito, chips com expansão, zoom de originais e confirmação inline permanente. Broader review inicia tudo como Keep. Keep all resolve sem remover/transferir. Alterações reais só ocorrem após confirmação; falha mantém escolhas e exige refresh quando necessário. Resultado concluído atualiza a biblioteca mesmo se o usuário já navegou para outra tela durante a requisição.

O visualizador existente mostra a contagem de links ativos e o alcance da revogação conjunta. Não foi criada lixeira, autoexclusão, migração de referências ou dependência permanente do Immich. Não houve deploy, mudança de versão ou consolidação do acervo pessoal.

### Validação da implementação

- `npm test`: 78 testes aprovados, sem skips. Incluem HTTP/SQLite reais em bibliotecas isoladas: autenticação/mesma origem/negação a tokens, modos/grupos, normalização/resize, revalidação, rollback, união acima de oito, múltiplas mantidas, promoção de link principal, aliases, revogação sem ressurreição, revisão persistida/reabertura, novas cópias e ausência de destino desnecessário.
- Lifecycle com worker controlado: ativação explícita, coalescência, falha de arquivo, retry, indisponibilidade de modelo/cooldown e gatilho de `/share` somente após nova imagem salva com sucesso. Regressões de captura/enriquecimento/tagging atualizadas para a regra sem teto de quantidade.
- Build Nuxt e Docker concluídos. Runtime na imagem testado sem rede, com dois CPUs/2 GiB, pesos cacheados montados somente leitura e dados sintéticos separados: três imagens prontas (PNG, JPEG, AVIF estático), duas falhas isoladas (arquivo inválido e AVIF animado não suportado), ocultos excluídos e hashes de todos os originais preservados. Não é teste de pico simultâneo com os outros modelos.
- HTTP da imagem Docker: login owner, endpoint privado negado sem sessão, revisão pronta com cobertura 3/5 e grupo calculado pelo worker thread. Contêiner temporário removido ao concluir.
- Chrome real desktop 1440×1000 e mobile 390×844: imagens carregadas com `contain`, múltiplas mantidas/destino, 14 tags expandidas, links preservados, zoom/Escape, modo ampliado conservador, reload de grupo, cancelar/confirmar, atualização da Library e retorno aos filtros anteriores. Sem overflow horizontal ou erros JS. Fixtures/screenshot fora do repositório, em `/tmp/visual-library-duplicates-browser-wOZgbY/` (e passes anteriores).
- Comparação nativa e caches privados em `/tmp/visual-library-duplicate-native.hSu2f5br/`. São artefatos de validação, sem importação automática para o produto. `git diff --check` aprovado.

Operação e limites documentados em `docs/duplicate-review.md`. Os testes garantem integração e preservação de metadados/URLs; qualidade sobre o acervo completo continua se apoiando na avaliação e no retorno do usuário, com a ressalva de que variações de conteúdo precisam de revisão humana.
