# Plano — seleção de imagens de uma página

Status: implementação autorizada e concluída localmente em 2026-10-31, na versão 0.21.0. Sem deploy. Escopo em [spec.md](spec.md).

## Base existente

- `SaveDropzone.vue` reconhece uma URL colada e emite `saveUrl`; `LibraryApp.vue` envia a URL e as tags para `POST /api/images`.
- `server/image-url.ts` já limita bytes, tempo e redirecionamentos, verifica destinos públicos e prende a resolução DNS à conexão por um dispatcher Undici. Reutilizar essas garantias.
- `saveImage` valida bytes, deduplica por hash e aceita procedência por `sourceReference`. O parâmetro `enrichDuplicates=false` preserva duplicatas sem alterações.
- `saveImageBatch` valida arquivos locais antes do envio. Não fabricar objetos File nem tamanhos/MIME para encaixar URLs nessa validação.
- CSP permite imagens apenas de `self`, `data:` e `blob:`. Prévias precisam passar pelo backend; não ampliar `img-src` para qualquer origem.
- Middleware exige sessão do dono e mesma origem nas mutações; tokens de integração não recebem acesso a essa captura.

## 1. Transporte remoto e descoberta

Separar em `server/image-url.ts` apenas o trecho necessário de transporte seguro: redirecionamentos manuais, dispatcher existente, timeout, cancelamento de corpos, leitura limitada e URL final. Manter `fetchRemoteImage` com validação por bytes e contrato atual para API externa e `/share`.

Criar `server/page-images.ts` com descoberta específica desta feature. Usar `parse5` como única dependência direta nova para ler HTML sem executar scripts; o projeto não tem parser HTML direto. Justificativa: estrutura, entidades, HTML imperfeito e `noscript` exigem parser; regex não substitui DOM. Referência consultada: https://github.com/inikulin/parse5.

Para a captura interativa, uma requisição remota deve distinguir imagem válida de HTML, sem baixar duas vezes o mesmo endereço. Imagem válida segue imediatamente para `saveImage`; HTML gera candidatas sem persistir imagens. Limites iniciais em constantes internas: 2 MiB de HTML descomprimido, 200 candidatas, 5 redirecionamentos e 5 segundos para o fetch. Excesso produz mensagem explícita; não truncar silenciosamente. Imagens continuam sujeitas ao limite configurado atual.

Selecionar primeiro conteúdo reconhecível (`article`, corpo de post como `entry-content`), depois `main`, depois corpo da página excluindo `header`, `nav`, `aside` e `footer`. A precedência deve favorecer o corpo do post quando houver vários artigos de recomendação. Sem regra por domínio. Quando só houver fallback, informar discretamente que a seleção pode conter elementos do site.

Percorrer `img` e `picture` em ordem; considerar `src`, `srcset`, `data-src`, `data-srcset`, `data-lazy-src` e `data-lazy-srcset`. Resolver URLs relativas sobre a URL final e um `base href` HTTP(S) válido, sem permitir que ele altere as regras de acesso remoto. Ignorar placeholders `data:`, protocolos inválidos, scripts e elementos decorativos explicitamente pequenos. Não baixar cada imagem na descoberta.

Agrupar alternativas do mesmo elemento e URLs compartilhadas por representações repetidas, incluindo `noscript`. Escolher maior largura declarada dentro do conjunto correspondente; não misturar art direction incompatível de `picture` nem comparar descritores `w` e `x` como se fossem a mesma unidade. Na ausência de indicação confiável, usar o endereço original declarado. Não remover sufixos nem parâmetros para adivinhar originais. Links diretos a uma imagem envolvendo sua miniatura podem ser alternativa explícita; links para páginas não são seguidos.

## 2. Rotas de captura

Criar `POST /api/capture-url`, com corpo limitado `{ url, tags }`, retornando união discriminada:

- `{ kind: 'image', result }`: resposta atual de imagem salva ou duplicata.
- `{ kind: 'page', pageUrl, candidates, fallback }`: URL final da página e candidatas com identificador estável na seleção, URL escolhida e dimensões declaradas opcionais.

Manter `POST /api/images` compatível. A UI passa a usar a rota de descoberta; cada candidata selecionada continua sendo salva por `POST /api/images` com `{ url, tags, pageUrl }`. Validar `pageUrl` com limite de comprimento, HTTP(S), sem credenciais; é metadado, não causa fetch. Descoberta e seleção não autorizam acesso posterior: cada download revalida destino, DNS e redirecionamentos.

Para imagens novas, preservar `source_url` como URL da imagem e usar `sourceReference` existente com `application=visual-library`, `entityType=web-page`, `entityId=SHA-256(pageUrl)` e `url=pageUrl`. Reutilizar armazenamento/transação atual, sem migração e sem alterar duplicatas. A página de origem não aparece como formulário novo.

## 3. Prévias privadas

Adicionar `POST /api/page-image-preview` com `{ url }`, corpo limitado e resposta binária validada por `fetchRemoteImage`. Mantém sessão do dono, checagem de mesma origem, `Cache-Control: no-store`, MIME detectado e `nosniff`. Nunca retransmitir HTML/SVG, cookies, cabeçalhos de autenticação do usuário ou cabeçalhos arbitrários ao destino remoto.

No cliente, buscar prévias apenas perto do viewport, com no máximo duas requisições simultâneas. Usar `fetch` e Blob URLs, compatíveis com a CSP atual. Guardar só uma janela limitada de blobs (por exemplo, 200 itens ou 32 MiB); revogar por pressão de memória, ao substituir seleção, fechar ou desmontar. Não persistir cache de candidatas no volume, banco ou biblioteca. Ampliação pode recarregar a mesma URL; não precisa de viewer baseado em IDs persistidos.

A prévia pode falhar sem impedir seleção ou ocultar a candidata silenciosamente; mostrar erro local e permitir tentar novamente. Fechar cancela requests e impede respostas antigas de reabrirem a seleção. Salvamento baixa novamente os bytes sujeitos às validações atuais; não promete que a origem permaneça imutável entre prévia e captura.

## 4. Seleção visual e lote

Adicionar `PageImageSelection.vue` e CSS próprio, montado imediatamente após a superfície de captura, fora do sticky. Estado efêmero em composable específico `usePageImageCapture.ts`: página, candidatas, seleção por ID, tags congeladas no início, prévias, ampliação, progresso e resultado. Usar identificador de tentativa/AbortController para ignorar respostas obsoletas.

Grade preserva ordem e proporções; controle nativo de seleção separado do botão de ampliar. Nenhuma marcada inicialmente. “Select all”, “Clear selection”, “Close” e “Save selected (N)” têm hierarquia e tokens existentes; somente salvar é primário enquanto a seleção estiver aberta. Reduzir a ação de escolher arquivos à hierarquia secundária nesse contexto. Todos os alvos têm 44 px, foco visível e seleção anunciada sem depender de cor.

Ampliação usa uma camada transitória com Escape, foco contido e retorno ao controle de origem; não cria entrada fictícia na biblioteca nem altera a navegação do viewer persistido. Fechar seleção devolve foco à captura; nenhum salvamento iniciado apenas por abrir/ampliar.

Enquanto houver seleção aberta, recusar novas capturas com aviso curto para salvar ou fechar primeiro, preservando escolhas. Durante descoberta ou salvamento, evitar sobreposição pelo estado compartilhado de captura; busca e navegação da biblioteca permanecem utilizáveis. Fechar fica indisponível durante o lote ativo para não prometer cancelamento de uma gravação já iniciada.

Criar utilitário específico de lote por URL, sequencial, reaproveitando `UploadResult<T>`, `uploadError` e resumo. Tornar apenas o resumo genérico se necessário. Não criar mecanismo universal de importação. Retentar somente falhas recuperáveis, com tags e procedência originais e totais acumulados. Concluídos ficam identificados e não são reenviados; seleção e falhas restantes permanecem até fechar. Inserir imagens novas como hoje e recarregar tags ao terminar, sem roubar scroll/foco.

`/share` permanece com seu contrato atual de arquivos e URL direta nesta entrega; não transportar um HTML inteiro ou estado de seleção em query string. Ajustar ajuda para distinguir colar uma página na captura de compartilhar links pelo sistema.

## 5. Verificação

- Salvar fixture HTML reduzida e fiel ao post de referência: 30 imagens, alternativas de resolução, lazy loading, `noscript`, logo e barra lateral. Teste deve verificar quantidade, ordem, URLs escolhidas e exclusão de elementos externos ao post.
- Fixtures adicionais: caminhos relativos, `base`, entidades, `picture`, descritores `w`/`x`, HTML imperfeito, fallback sem artigo, página vazia e limite excedido.
- Testes HTTP isolados com transporte controlado: imagem direta salva uma vez, HTML não cria arquivo/registro, origem preservada após salvar escolhidas, tags congeladas, duplicatas intactas, lote parcial e retry.
- Regressão de segurança: DNS rebinding, redirecionamento privado, URL com credenciais, esquema inválido, timeout, limites reais de stream, preview de HTML/SVG recusado, acesso anônimo e token de integração negados, mesma origem obrigatória.
- Testes de estado de seleção: abrir sem marcações, selecionar todas/desmarcar, fechamento, resposta obsoleta, retry sem reenviar sucessos e limpeza de blobs.
- Executar `npm test` e `npm run build`. Conferir em navegador desktop e mobile emulado: grade longa fora do sticky, ampliação, teclado/foco/Escape, CSP, rolagem, mensagens, retorno e salvamento em diretório temporário isolado.
- Fazer smoke do exemplo remoto sem salvar no acervo real. Não depender da página ao vivo para testes determinísticos. Twitter e Reddit continuam sem promessa de suporte; seus exemplos podem ser avaliados depois.

## Entrega e limites

Revisar implementação contra spec, CONSTITUTION.md e DESIGN.md, registrar resultados reais neste plano e atualizar BACKLOG.md com precisão. Não incluir deploy, importação no acervo real ou mudança de versão como efeito deste planejamento. As alterações locais existentes de 029 devem ser preservadas.


## Resultado da implementação e validação — 2026-10-31

- Versão avançada para 0.21.0 antes da implementação; package.json e lockfile sincronizados. Nova dependência direta: parse5 8.0.1 (entities transitivo).
- Captura interativa diferencia imagem de HTML em um único download. URLs diretas permanecem imediatas e disparam preparo existente somente quando criam imagem; `/api/images`, API externa e `/share` conservam seus contratos.
- Descoberta prioriza corpos de post, inclusive a classe comum do Elementor presente no exemplo. O primeiro smoke remoto revelou que os `<article>` do site pertenciam a recomendações; o seletor e a fixture foram corrigidos a partir do HTML completo, sem exceção por domínio.
- Estado da seleção ficou no componente específico, com um utilitário de lote e fila de prévias, em vez de um composable adicional. Isso evita uma camada sem outros consumidores. Prévias usam o cliente autenticado, dois downloads simultâneos, cancelamento por visibilidade/desmontagem e retenção máxima de 200 blobs/32 MiB.
- Ampliação usa dialog nativo com Escape e foco devolvido ao botão de origem; seleção começa vazia, preserva escolhas e permite selecionar todas. Salvamento sequencial preserva tags iniciais, procedência e resultados anteriores em retries. Duplicatas não recebem tags nem referências novas.
- `npm test`: 85 testes passaram, incluindo fixture com 30 imagens, variantes de HTML, fila cancelável, lote parcial/retry e testes HTTP com middleware real em armazenamento temporário. Timeout, limite real de stream, HTML/SVG recusados em prévias, endereços internos, redirecionamento privado, sessão, origem e tokens de aplicação verificados. A regressão existente de DNS rebinding também passou.
- `npm run build`: passou. `git diff --check`: passou.
- Chrome headless, desktop 1440×900 e celular emulado 390×844, com o post remoto real: 30 candidatas sem seleção inicial, prévias, selecionar todas/limpar, duas escolhas, ampliação, Escape, foco restaurado, fechamento e ausência de overflow horizontal passaram. Somente duas fotos foram salvas numa biblioteca temporária isolada; nenhuma alteração no acervo real. Sem exceções JavaScript observadas.
- Inspeção da captura mobile confirmou grade fora do sticky, hierarquia com apenas um CTA primário e controles de toque. Celular físico e suporte a Twitter/Reddit permanecem fora da validação desta entrega.
- Não houve deploy, publicação automática, novo serviço, migração de banco ou configuração adicional. Compartilhamento de links de página pelo menu do sistema permanece fora deste fluxo; a ajuda orienta colar a URL na captura.


### Ajuste de consistência com a galeria

Por solicitação do usuário, removido o botão textual “Enlarge”. A própria imagem é um botão acessível de abertura, como na galeria, enquanto o checkbox continua reservado à seleção para salvar. A visualização ocupa a tela inteira e reutiliza as classes de overlay e fechamento de LightboxViewer; mantém Escape, retorno de foco e escolhas intactas. O dialog nativo preserva a contenção de foco sem criar registros fictícios no acervo. Build e smoke Chrome desktop/mobile com clique na imagem, largura de viewport, Escape, retorno ao cartão e salvamento de somente duas imagens passaram.


### Retenção das prévias ao rolar

O usuário observou downloads repetidos ao sair e voltar à área visível. Ajustado: sair do viewport cancela apenas downloads ainda pendentes; prévias concluídas permanecem no cache temporário da seleção, limitado a 200 blobs e 32 MiB. A ampliação reutiliza a Blob URL do cartão, sem novo download. O limite de bytes pode descartar prévias antigas; fechamento/desmontagem revoga todas as URLs. Nenhuma persistência no servidor ou alteração na política privada de cache HTTP.

Validação: build passou; Chrome desktop e celular emulado confirmaram pelo número de requisições que rolar até o último cartão e voltar ao primeiro já carregado não repete o download, e que abrir a ampliação também não faz nova requisição. Seleção, Escape, foco e salvamento continuaram passando.


### Aproveitar a tela na ampliação

Solicitado pelo usuário: a prévia ampliada deve aproveitar o display como a ampliação da galeria. Substituída a classe do viewer comum por `expandedOverlay`, a mesma usada pela galeria ao ampliar; removida a reserva de 64 px no topo e as margens laterais próprias. A imagem usa o viewport com as margens de 8 px e safe areas do componente existente; fechamento fica sobreposto. Mantidos ajuste sem recorte, cache da prévia, Escape e retorno de foco.

Build e Chrome desktop/mobile passaram. Conferido que o palco começa a 8 px do topo e ocupa a altura do viewport menos 16 px, sem reservar faixa para controles; seleção, cache, Escape, foco e salvamento seguem funcionando.
