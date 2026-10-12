# Plano técnico: API externa de assets

Status: implementado após pedido de continuidade do usuário em 2026-10-12. Escopo aprovado em [spec.md](spec.md).

## 1. Direção e infraestrutura existente

Manter Nuxt/Nitro/H3, SQLite nativo do Node e arquivos em `data/images`. `server/db.ts` continua responsável pelo banco e pelas migrações aditivas; UUID e hash SHA-256 continuam identificando registros e duplicatas. Não criar entidade de asset, backend separado, provedores ou camada de repositórios.

Separar o contrato externo da resposta consumida pela interface. Compartilhar somente funções concretas de leitura limitada, validação, salvamento e entrega. Preservar `/api/images`, tags, importação por URL e `/images/{filename}`.

## 2. Migração aditiva

Adicionar às tabelas novas e às instalações existentes, mediante `PRAGMA table_info(images)`:

```sql
ALTER TABLE images ADD COLUMN source TEXT NOT NULL DEFAULT 'visual-library';
ALTER TABLE images ADD COLUMN hidden_from_gallery INTEGER NOT NULL DEFAULT 0
  CHECK (hidden_from_gallery IN (0, 1));
```

Executar as alterações pendentes numa transação curta antes de reconciliar capas. A migração deve ser idempotente e preservar IDs, arquivos, hashes, nomes, tags e datas. Imagens antigas continuam visíveis e recebem `visual-library`, inclusive as importadas por URL: `source_url` é proveniência remota, enquanto `source` identifica a aplicação que enviou.

Estender `ImageRow`; mapear o inteiro para boolean na resposta. Acrescentar `source` e `hiddenFromGallery` a `toImageResponse` sem remover campos existentes. Criar `toAssetResponse` somente com os campos públicos descritos abaixo. Não adicionar dimensões, índices especulativos, tabela de origens ou `uploadedBy`.

## 3. Contrato externo

### POST /api/assets

Aceitar somente `multipart/form-data`, com:

| Campo | Regra |
| --- | --- |
| `image` | Exatamente um arquivo não vazio. |
| `source` | Opcional; padrão `visual-library`. Identificador de 1–64 caracteres, após trim, com letras ASCII minúsculas, números, ponto, hífen ou underscore; começa por letra ou número. Não normalizar silenciosamente valores inválidos. |
| `hiddenFromGallery` | Opcional; padrão false. Aceitar apenas as strings `true` e `false`. |

Rejeitar campos repetidos, arquivos adicionais, campos desconhecidos e valores inválidos com 400. JSON, inclusive `{url}`, não faz parte desta rota e retorna 415. Validar metadados e arquivo antes de consultar duplicatas ou escrever.

Retornar 201 quando criado e 200 quando reutilizado. Usar a mesma estrutura nos dois casos:

```json
{
  "id": "c0902e4d-6d90-4f0b-a544-d6822fbf052d",
  "mimeType": "image/jpeg",
  "sizeBytes": 245000,
  "createdAt": "2026-10-12T12:00:00.000Z",
  "source": "media-pulse",
  "hiddenFromGallery": false
}
```

Definir `Location: /api/assets/{id}` e `Cache-Control: no-store` na resposta de upload. Não retornar tags, filename, caminho físico, hash ou source_url. O status diferencia criação de reutilização sem exigir duas formas de resposta.

### GET /api/assets/{id}

Consultar `images` pelo ID e retornar `toAssetResponse`, inclusive quando oculto. ID inexistente retorna 404; não exigir que seja UUID para consultar registros legados. Metadados indicam existência do registro; a entrega de conteúdo verifica o arquivo. Usar `Cache-Control: no-store`, pois visibilidade pode mudar.

### GET /api/assets/{id}/content

Consultar pelo ID, resolver o filename exclusivamente no banco e compartilhar a entrega com `/images/{filename}`. Não redirecionar o consumidor ao nome interno. Asset oculto continua acessível. Não adicionar listagem, exclusão externa, atualização externa ou thumbnail.

Erros externos: 400 para formulário/metadados inválidos ou arquivo vazio, 413 para excesso de tamanho, 415 para formato não suportado/estrutura inválida, 404 para asset ou conteúdo ausente, 500 para falha de armazenamento/persistência. Mensagens públicas não contêm caminhos ou detalhes SQL. Não impor esses novos códigos ao feedback legado sem adaptar e testar sua compatibilidade.

## 4. Limite e validação compartilhados

Adicionar `runtimeConfig.public.maxImageSizeBytes` com padrão `15728640`, configurável por `NUXT_PUBLIC_MAX_IMAGE_SIZE_BYTES`. Embora exposto ao browser, o servidor usa o próprio valor como autoridade. Validar inteiro positivo seguro no início da aplicação; configuração inválida deve falhar de forma explícita.

Modificar os utilitários da interface para receber o limite efetivo, mantendo o padrão nos testes e nas funções puras. Dropzone, validação local, mensagens e download remoto usam o mesmo valor. Não importar configuração Nuxt em utilitários puros.

A versão instalada de H3 lê o multipart inteiro sem argumento de limite. Criar `server/image-upload.ts` com leitura incremental via `getRequestWebStream`, contando bytes antes de acumular além do teto. Verificar Content-Length quando presente, mas também limitar requests sem tamanho declarado e chunked. Cancelar a leitura em excesso e responder 413 sem resetar o socket antes da resposta.

Limitar o corpo multipart a limite do arquivo + 64 KiB de overhead; limitar os campos textuais e o nome original para evitar que sejam usados como corpo adicional. Após a leitura limitada, usar o parser multipart nativo de `Response.formData()` com o Content-Type original, convertendo apenas o arquivo escolhido para Buffer. Aplicar novamente o limite exato aos bytes do arquivo. Não escrever um parser multipart nem introduzir biblioteca de streaming nesta etapa. Upload continua usando memória proporcional ao limite, com possíveis cópias do parser; a entrega do conteúdo será streaming.

Criar `server/image-format.ts`: identificar MIME e extensão canônica pelos bytes, com verificações estruturais limitadas aos formatos aceitos. Verificar assinaturas, limites de segmentos/chunks/boxes e presença da estrutura mínima relevante: SOF/SOS em JPEG, IHDR/IDAT/IEND em PNG, tela/imagem/trailer em GIF, RIFF/WEBP e chunk de imagem em WebP, identificação e boxes de imagem em AVIF. Cobrir AVIF comum e sequência animada. Rejeitar estruturas truncadas, tamanhos inconsistentes, SVG e texto com extensão de imagem. Todas as leituras devem respeitar o tamanho do buffer e terminar em tempo limitado.

Essa verificação não é um decodificador completo e não promete detectar toda corrupção de pixels ou eliminar imagens maliciosas. Não implementar decodificação, recompressão ou dimensões nesta entrega. Se a validação estrutural exigir um parser complexo, registrar a limitação e justificar uma dependência específica antes de adicioná-la; não reduzir a validação a confiar em extensão/MIME.

O formato detectado define MIME persistido e extensão dos arquivos novos; originalName permanece apenas metadado. Aceitar imagem válida com MIME ausente, incorreto ou nome sem extensão. Usar a mesma validação após download remoto, mantendo controles de URL, redirects, timeout e limite existentes. Não ampliar o trabalho para reescrever proteção SSRF.

## 5. Salvamento e compensação

Extrair o salvamento hoje embutido em `images.post.ts` para `server/image-storage.ts`. Receber os bytes já validados, metadados e origem/visibilidade; devolver `{ row, created }`. Ambos os POSTs usam essa função.

1. Inicializar o armazenamento e procurar o registro pelo hash.
2. Em duplicata, devolver a linha existente sem atualizar origem, visibilidade, tags ou data.
3. Para novo asset, gerar UUID e filename canônico; usar abertura exclusiva (`wx`) para nunca sobrescrever arquivo existente.
4. Abrir, escrever e fechar o arquivo com rastreamento de que esta operação o criou. Falha de escrita parcial ou fechamento deve tentar remover somente esse arquivo.
5. Inserir o registro após concluir a escrita. Falha de insert deve remover o arquivo criado.
6. Se a restrição específica de `images.content_hash` detectar concorrência, remover o arquivo perdedor e consultar/devolver o registro vencedor. Não tratar qualquer erro UNIQUE como duplicata.
7. Retornar a linha persistida; depois de persistir com sucesso, falha de resposta ao cliente não apaga o asset. Retry encontra a duplicata.

Não fazer `await` de filesystem dentro de transação SQLite compartilhada. Não engolir erros de limpeza: registrar a falha no servidor e responder 500, mantendo erro público genérico. Não prometer eliminar órfãos quando o próprio filesystem recusar a limpeza ou o processo terminar abruptamente; esses casos ficam documentados, sem worker ou rotina de reparo.

`POST /api/images` mantém `{duplicate:true,message:'Already saved.'}` para duplicatas e a resposta atual para novas imagens, com os dois campos aditivos. Envios da interface sempre usam `visual-library` e visibilidade padrão; não aceitam metadados externos para substituir essa origem. JSON de URL continua funcionando.

Não alterar o mecanismo de exclusão nesta entrega: ele continua removendo associações/registro e tentando unlink. Documentar a limitação existente de limpeza ignorada na exclusão; não apresentar os testes de compensação de upload como garantia do fluxo de exclusão.

## 6. Conteúdo e cache

Criar `server/image-content.ts` com entrega concreta por `ImageRow`. Abrir o arquivo para leitura e obter stat pelo mesmo handle, evitando a janela stat/open; verificar arquivo regular. ENOENT/ENOTDIR retornam 404; outros erros de IO retornam 500. Fechar o handle em 304 e em erros; o stream fecha o handle ao terminar ou cancelar.

Definir Content-Type, Content-Length, `X-Content-Type-Options: nosniff` e `Cache-Control: private, max-age=3600`. Usar Last-Modified e ETag fraca derivada de ID, tamanho e mtime do arquivo, sem ler o original inteiro. Respeitar If-None-Match e If-Modified-Since com precedência correta; retornar 304 sem corpo. Não usar cache immutable: exclusão e restauração operacional podem mudar disponibilidade.

Usar `sendStream` com stream do handle; tratar erros antes dos headers normalmente e encerrar corretamente a conexão em falhas posteriores. Não adicionar range requests como requisito desta etapa. Manter a rota antiga funcional, resolvendo pelo banco e reutilizando a mesma entrega.

Registros antigos têm MIME informado pelo cliente. Na primeira entrega de um arquivo legado, detectar o formato usando leitura limitada de cabeçalhos/estrutura necessária, sem carregar todo o original, corrigindo MIME no registro quando reconhecido. Não renomear arquivos antigos. Arquivo legado inválido não é apagado automaticamente; documentar a resposta de falha e a necessidade de revisão manual. Testar compatibilidade com imagens antigas legítimas.

## 7. Visibilidade no banco e na interface

Manter `GET /api/images` retornando o acervo completo e campos atuais, com os dois acréscimos. Assim, preservar o contrato atual e permitir recuperação dos ocultos sem endpoint de listagem externa.

Adicionar `PATCH /api/images/{id}/visibility` como operação da interface. Aceitar somente `{ "hiddenFromGallery": boolean }`; rejeitar outros campos/tipos com 400 e ID inexistente com 404. Atualizar visibilidade e reconciliar capas das tags afetadas numa transação SQLite; retornar a imagem atualizada no formato interno. É operação idempotente e não muda source, tags, hash ou arquivos.

Em `app.vue`, separar acervo carregado de imagens disponíveis para descoberta. Library padrão, assunto, Explore e relacionadas usam apenas `hiddenFromGallery === false`. Garantir a mesma regra no viewer selecionado, excursão interna e navegação por histórico: uma imagem oculta não abre pelo endereço padrão nem reaparece pelo Back.

Modificar `listTagSummaries` para contar e listar apenas associações com imagens visíveis. `findTag` continua distinguindo tag existente de inexistente, mas sua contagem reflete imagens visíveis, inclusive zero. Em `reconcileTagCovers`, capa válida precisa estar visível; escolher substituta visível usando o desempate atual. Se não houver, persistir null sem remover tags/associações. Ao mostrar novamente uma imagem, conservar a capa substituta se ainda válida. Não manipular last_used_at só por mudar visibilidade.

### Controles mínimos

- Na Library, oferecer um controle neutro `Hidden images` para alternar entre imagens visíveis e somente ocultas, sem tela nova. Busca e filtros existentes continuam disponíveis.
- Representar esse modo por `visibility=hidden` somente em Library; incluir no parse/serialize, snapshots e histórico existentes. Ausência significa modo padrão. Valores inválidos e combinações com Explore/assunto produzem estado recuperável, sem ignorar silenciosamente o critério.
- No viewer, mostrar source em texto discreto junto à área de tags, fora do estágio principal; oferecer `Hide from gallery` ou `Show in gallery`, com alvo de 44px, estado pendente e feedback contextual. Sem badges na grade ou alteração na captura.
- Em ocultos, setas e relacionadas usam o conjunto oculto. Tags para sugestões são derivadas das imagens desse conjunto, sem modificar o contrato padrão de Explore; o lookup por ID continua resolvendo tags que tenham zero imagens visíveis.
- Após ocultar no modo padrão ou mostrar no modo ocultos, fechar o viewer para sua galeria de origem e retirar a imagem daquele conjunto. Limpar excursão temporária, reconciliar seleção e retornar foco a um controle sobrevivente. Falha conserva estado anterior e permite retry.
- Link antigo para asset oculto no modo padrão mostra aviso e ação explícita que abre `view=library&visibility=hidden&image={id}`. Não alterar a visibilidade só por seguir o link e não confundir ocultação com exclusão. Asset excluído conserva tratamento de indisponibilidade existente.
- Capturar ID e versão da operação; respostas tardias atualizam a imagem correta, sem voltar a outra tela ou reabrir viewer. Atualizar tags/capas após confirmação, respeitando versionamento de requests existente.

Não adicionar filtro por source, ocultação em lote ou preferência global por aplicação nesta entrega. Source identifica origem no viewer; visibilidade é individual. Se surgir necessidade real de controle por aplicação, tratar como extensão separada.

## 8. Testes e validação

Usar `node:test`, como os testes atuais, com diretório temporário e subprocesso para isolar o singleton SQLite. Para HTTP, importar handlers reais com os globals Nuxt necessários explicitamente instalados no harness e usar H3 `toNodeListener`, servidor em porta efêmera e fetch nativo. Fechar servidor, handles e diretórios em finally. Não usar `.output` antigo para validar código novo nem tocar no acervo pessoal.

Cobrir:

- Fixtures reais pequenas de JPEG/PNG/GIF/WebP/AVIF; MIME incorreto/ausente, extensão enganosa, SVG, texto, vazio e estruturas truncadas.
- Upload externo com defaults e metadados; campos repetidos/desconhecidos; JSON rejeitado; source/boolean inválidos; limites exato, excedido, overhead e request chunked.
- Configuração não padrão refletida em servidor e utilitários da interface; configuração inválida.
- Upload legado multipart e JSON de URL com fetch remoto controlado, mantendo respostas e feedback de duplicata.
- Duplicata entre interface/API e corrida de inserts, preservando primeiro source/visibilidade e um único arquivo/registro.
- Falha de insert com trigger SQLite e falha de escrita/fechamento mediante stub no ponto concreto de IO; verificar compensação e tratamento de erro de limpeza. Sem abstração de filesystem em produção apenas para testes.
- Consulta existente/ausente, contrato sem campos internos, original byte a byte, arquivo ausente, MIME corrigido de legado, cache condicional e leitura cancelada.
- Acesso sem credenciais funcionando por decisão de produto; não adicionar testes de autenticação inexistente.
- Migração de banco antigo, reabertura idempotente, defaults, ocultar/mostrar preservando bytes/tags, rollback da visibilidade e capas, tags com somente ocultos e capa substituta estável.
- Regras de navegação por `visibility=hidden`, conjuntos de descoberta, excursões e recuperação explícita de links antigos; não testar apenas classes CSS ou espelhar chamadas internas.

Browser de produção com acervo temporário: salvar pelos fluxos atuais, navegar entre Library/Explore/assunto, ocultar/mostrar, conferir capas/contagens/relacionadas, links diretos, reload, Voltar/Avançar, respostas atrasadas e erro de PATCH. Verificar foco, teclado, 44px, ausência de overflow em 320/390/768/1280px e área da imagem principal preservada. Separar verificação sintética de touch físico e leitor de tela.

Executar `npm test`, `npm run build` e `git diff --check` após implementação. Registrar resultados reais e limitações, sem marcar cenários planejados como executados.

## 9. Arquivos e sequência de entrega

1. Migração e respostas em `server/db.ts`; helpers específicos `server/image-format.ts`, `server/image-upload.ts`, `server/image-storage.ts` e `server/image-content.ts`.
2. Rotas `server/api/assets.post.ts`, `server/api/assets/[id].get.ts`, `server/api/assets/[id]/content.get.ts`; adaptar `images.post.ts`, `image-url.ts` e a rota de conteúdo antiga.
3. PATCH de visibilidade, consultas/contagens/capas e testes de persistência.
4. Limite em `nuxt.config.ts` e utilitários/SaveDropzone; visibilidade em `app.vue`, LightboxViewer/CSS, navegação/composable e utilitário pequeno de elegibilidade se necessário.
5. Testes de formatos, API, migração/visibilidade e regressões; browser isolado; documentação final.

Manter nomes concretos e funções pequenas. Não adicionar dependências por padrão. Não alterar Media Pulse, Docker storage, versionamento, commit ou publicação automaticamente.

## 10. Documentação e limitações da entrega

Adicionar `docs/assets-api.md` com campos, status, erros, variável de limite, migração, exemplos multipart, consulta, conteúdo e img. Exemplo externo:

```bash
curl -i -F 'image=@foto.jpg' -F 'source=media-pulse' \
  -F 'hiddenFromGallery=true' http://visual-library:3000/api/assets
curl http://visual-library:3000/api/assets/ASSET_ID
curl -o original.jpg http://visual-library:3000/api/assets/ASSET_ID/content
```

```html
<img src="https://biblioteca.exemplo/api/assets/ASSET_ID/content" alt="Imagem">
```

Explicar que a URL do browser precisa ser alcançável fora da rede Docker; o backend consumidor guarda o ID e configura a URL base apropriada. Não inserir URL absoluta derivada do Host recebido na resposta da API. Não configurar CORS ou autenticação.

Documentar explicitamente: todos os endpoints permanecem acessíveis; ocultação não restringe HTTP; source é declarado e representa primeiro envio; exclusão quebra referências; cache pode exibir bytes já baixados por até uma hora; registros antigos sem hash não passam a participar automaticamente da deduplicação; validação estrutural não equivale a decodificação completa; upload limitado ainda usa memória; falhas abruptas e falhas de limpeza podem deixar órfãos; não há thumbnails nem polling/live update para uploads de outros serviços.

Após implementação validada, atualizar BACKLOG e fronteiras das specs de captura, tags, Explore e navegação com links a 014. Não atualizar constituição para declarar o produto uma plataforma. Os resultados efetivamente executados estão registrados abaixo.

## Implementação e validação executadas — 2026-10-12

Implementado contrato externo com três rotas, mesmas imagens/UUIDs/hash/arquivos, source e visibilidade por migração aditiva. POST externo retorna 201/200 e o mesmo registro para duplicatas; o POST da interface preserva seu envelope de duplicata. PATCH de visibilidade atualiza capas na mesma transação; descoberta padrão e modo de ocultos usam conjuntos distintos. Nenhuma dependência foi adicionada e nenhum código do Media Pulse foi alterado.

Detalhes ajustados durante a implementação:

- Leitura limitada usa eventos do IncomingMessage no runtime Node já adotado pelo projeto, em vez de cancelar `getRequestWebStream`: ao exceder o teto, descarta os chunks e drena a entrada sem destruir o socket, permitindo entregar 413. O multipart continua usando parser nativo do Node e limite exato de arquivo.
- Validação dos novos uploads verifica assinaturas e estrutura delimitada dos cinco formatos, incluindo GIF/WebP/AVIF animados. Não verifica todos os checksums nem decodifica pixels. Legados são identificados somente pelo prefixo de até 64 KiB na entrega; essa compatibilidade não equivale à validação estrutural de upload.
- Recuperação de link oculto estabelece primeiro uma galeria de ocultos e depois abre o viewer. Uma primeira verificação de browser revelou que usar diretamente a entrada antiga como parent podia reabrir a imagem ao mostrar novamente; corrigido e repetido o percurso.
- Estado de apresentação muda após confirmação do PATCH. Respostas tardias atualizam apenas a imagem correspondente e não restauram destino/visualizador anteriores.

Validação executada:

- `npm test`: 41 testes passaram, zero falhas. Testes novos usam fixtures reais pequenas e acervo temporário, handlers HTTP reais e SQLite isolado. Cobrem cinco formatos e três variantes animadas, truncamento/arquivo disfarçado, limites exato e excedido/chunked, configuração, criação/defaults, duplicatas e corrida, consulta/conteúdo, MIME legado, cache condicional, renomeação preservando ID e cancelamento de streaming.
- Falhas de insert por trigger SQLite, escrita parcial e fechamento por substituição temporária de bindings nativos no subprocesso verificaram compensação. Falha de limpeza retorna erro genérico e deixa o órfão conhecido, removido pelo próprio teste; não há afirmação de atomicidade em falhas irrecuperáveis.
- Migração de banco antigo e reabertura em processo separado verificaram defaults e idempotência. Ocultar/mostrar preserva tags e arquivo, corrige capas/contagens e reverte visibilidade/capas juntas após trigger de erro.
- Fluxo multipart legado e URL com resposta remota controlada continuam válidos; ausência de credenciais é aceita deliberadamente.
- `npm run build`: produção concluída. Permanecem os avisos existentes de sourcemap do plugin Nuxt e externalização de `node:sqlite`.
- `git diff --check`: sem erros.
- Google Chrome headless via CDP, servidor de produção e acervo temporário: galeria visível exclui ocultos; relacionadas respeitam o conjunto; source e ações aparecem abaixo do estágio principal; ocultar/mostrar retorna à galeria correta; modo ocultos, link antigo, reload e Voltar/Avançar funcionam.
- Browser verificou erro de PATCH com retry e PATCH retido durante Voltar e navegação a Explore: resposta não reabre viewer nem muda destino. Capas/contagens refletem visíveis. Upload pelo input nativo continua funcionando; DELETE existente invalida metadados/conteúdo externos.
- Layouts de 320, 390, 768 e 1280px sem overflow horizontal; controles novos com pelo menos 44px. Screenshots em 390/1280px inspecionados. Nenhuma exceção JavaScript não tratada no roteiro.

Script de browser e screenshots ficam em `/tmp/visual-library-assets-browser.mjs` e `/tmp/visual-assets-{390,1280}.png`; não são dependências do projeto. Nenhum teste acessou o acervo pessoal. Touch físico, leitor de tela, todos os arquivos possíveis dos formatos aceitos e avaliação cotidiana permanecem fora da validação sintética.

Uso, migração e limitações estão documentados em [assets-api.md](../../assets-api.md). A implementação inicial não fez commit ou publicação; a versão foi posteriormente avançada para 0.5.0 a pedido do usuário.


## Revisão antes do commit — 2026-10-12

Revisão solicitada pelo usuário, com autorização para commit e push se consistente. Conferidos contrato externo, compensação de arquivos, migração, estabilidade de IDs, preservação da deduplicação, visibilidade/capas, compatibilidade dos endpoints atuais, governança e ausência de dependências adicionais. A decisão de não adicionar autenticação foi preservada.

Corrigido o tratamento de erro de IO durante streaming: quando parte da imagem já foi enviada, encerrar a conexão; antes do envio, remover cabeçalhos do arquivo para permitir resposta JSON de erro. Teste com erro injetado depois dos primeiros bytes verifica encerramento sem espera indefinida e leitura posterior normal.

A revisão também regenerou a fixture WebP com frames de cores distintas e conferiu ANMF/avis nos fixtures animados, evitando que otimização do encoder transformasse o teste em imagem estática.

Validação nesta revisão: 41 testes passaram, build de produção 0.5.0 concluído e git diff --check sem erros. package.json e as duas referências de versão do package-lock.json estão sincronizados. Permanecem somente as limitações já documentadas; não foi identificada pendência que impeça o commit desta entrega.
