# Plano técnico: enriquecimento inicial no upload de assets

Status: implementado após aprovação e pedido de continuidade do usuário em 2026-10-12. Resultados de validação abaixo. Escopo em [spec.md](spec.md).

## 1. Direção

Estender o POST externo já existente; manter Nuxt/H3, SQLite, tabela `images`, arquivos, UUIDs e hash atuais. Não criar outra entidade de asset, mecanismo de armazenamento, serviço de sincronização ou esquema genérico de metadados.

Reutilizar `tags` e `image_tags`. Adicionar apenas a persistência das referências, que o modelo atual não representa. A aplicação escolhe as tags; Visual Library não conhece modelos de álbum/obra e não acessa a URL enviada.

Não modificar Media Pulse, interface de captura, chips ou regras de visibilidade. Não adicionar dependências, autenticação, uploadedBy ou propriedade de tags por aplicação.

## 2. Entrada multipart compatível

Em `server/image-upload.ts`, aceitar os campos externos existentes `image`, `source`, `hiddenFromGallery` e os novos campos opcionais:

| Campo | Formato e regra |
| --- | --- |
| `tags` | Texto JSON com array de strings. Omitido ou `[]` significa nenhuma sugestão. Normalização e limites atuais. |
| `sourceReference` | Texto JSON com objeto `{ entityType, entityId, url? }`. Omitido significa envio sem referência. |

Continuar rejeitando campos desconhecidos/repetidos, arquivos adicionais e valores não textuais nos campos JSON. Não substituir `source` por objeto; ele identifica a aplicação que está fazendo este envio, com seu formato atual. A aplicação da nova referência vem desse campo, mesmo quando `images.source` do asset reutilizado é outra aplicação. Manter o default atual `visual-library` se source não for informado.

Validar todo o formulário antes de escrever. Proposta de limites concretos:

- Texto JSON de tags: máximo 4 KiB UTF-8 e 32 entradas brutas antes da normalização. Até oito tags únicas não vazias após limpeza, com 48 caracteres cada. O teto bruto limita repetição abusiva sem mudar o limite de tags efetivas.
- Texto JSON da referência: máximo 8 KiB UTF-8; objeto não nulo e não array. Somente os campos declarados.
- `entityType`: string de 1–64 caracteres; identificador simples com letras minúsculas ASCII, números, ponto, hífen e underscore, como `album` ou `artwork`.
- `entityId`: string opaca de 1–256 caracteres, sem caracteres de controle; rejeitar espaços externos em vez de alterar sua identidade silenciosamente. Não interpretar como número nem remover zeros à esquerda.
- `url`: opcional, string de até 2048 caracteres, parseável como URL HTTP(S) absoluta e sem credenciais. Armazenar o valor validado sem buscar o endereço. Não usar URL como chave de associação.

JSON inválido, tipos inválidos e limites semânticos retornam 400. Corpo/arquivo acima do limite continua 413; formato inválido continua 415. Preservar o teto multipart de arquivo + 64 KiB de 014; os campos novos cabem nesse orçamento. Não acrescentar runtimeConfig só para esses limites pequenos.

O POST da interface continua ignorando enriquecimento externo e usando seu contrato atual. Novos parâmetros da persistência são opcionais para manter sua chamada existente.

## 3. Referências no banco

Adicionar `asset_references` por `CREATE TABLE IF NOT EXISTS` em `ensureDataStore`, sem alterar ou preencher imagens antigas:

```sql
CREATE TABLE IF NOT EXISTS asset_references (
  asset_id TEXT NOT NULL,
  application TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  url TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (asset_id, application, entity_type, entity_id)
);
```

Essa chave deduplica a associação completa. Não criar UNIQUE somente em aplicação/tipo/ID: uma entidade pode ter várias imagens, e um asset pode ter várias entidades. Não adicionar tabela de entidades, slots de capa, procedência de tags, snapshot de metadados ou registro de consumidores.

Como o banco atual remove associações explicitamente e não habilita foreign keys, manter a mesma convenção: `deleteImageRecord` também remove `asset_references` dentro de sua transação existente. Não habilitar globalmente foreign keys nem alterar o esquema das tabelas antigas nesta feature.

Adicionar helper de consulta das referências por asset, com ordenação estável por created_at e chaves como desempate, e resposta `{ application, entityType, entityId, url, createdAt }`. Ausência de URL retorna null. IDs e paths internos adicionais não são necessários.

## 4. Tags: reaproveitamento sem transações aninhadas

A função atual `addTagsToImages` já preserva associações, verifica a união e usa uma transação própria. Chamá-la depois do upload permitiria estado parcial; chamá-la dentro de outra transação falharia por transação aninhada.

Extrair somente seu trecho concreto de adição para helper síncrono em `server/db.ts`, por exemplo `addImageTagsWithinTransaction(imageIds, normalizedTags)`. O helper:

1. Verifica existência dos IDs e valida a união com tags atuais antes de fazer alterações.
2. Reutiliza nomes e IDs existentes e cria apenas tags novas.
3. Insere somente associações ausentes, preservando as antigas e suas datas.
4. Atualiza last_used_at somente para tags efetivamente acrescentadas.
5. Reconciliará capas das tags afetadas depois de terminar as associações, na transação do chamador.

`addTagsToImages` mantém seu contrato, validação de lista não vazia e BEGIN/COMMIT/ROLLBACK, delegando ao helper. O upload pode aceitar lista normalizada vazia como no-op. Não chamar `replaceImageTags` para compor a união: ele apaga/recria associações e abre outra transação.

Não mudar edição manual ou criar políticas de propriedade: todas as tags continuam editáveis e são armazenadas nas associações atuais.

## 5. Upload, enriquecimento e retry

Estender `saveImage` com um argumento opcional de enriquecimento `{ tags, sourceReference }`, sem alterar seus defaults para os fluxos legados. Manter formato, tamanho e hash de 014.

Criar um helper síncrono concreto para confirmar enriquecimento na transação ativa:

- Com referência, procurar pela associação completa `(assetId, source informado, entityType, entityId)`.
- Se já existe, não aplicar sugestões, não atualizar URL nem timestamp da associação; retornar o estado atual. Não calcular a união com sugestões ignoradas nesse retry, pois tags manuais posteriores não devem fazer um retry legítimo exceder oito.
- Se é nova, validar a união, adicionar sugestões e inserir referência na mesma transação.
- Sem referência, adicionar sugestões pela união em cada envio explícito. Omitidas/vazias não fazem alterações.
- Nova referência com tags vazias também é persistida; adicionar tags depois exigiria outro fluxo, fora desta entrega. Explicar isso na documentação para não confundir retry com atualização.

A validação de formato e shape do formulário ainda vale em retries. A ausência de URL no primeiro envio fica registrada como null; reenvio com URL não passa a preenchê-la automaticamente.

### Asset já existente

Consultar por hash; em transação SQLite curta, reler a imagem para garantir que ainda existe, aplicar enriquecimento conforme as regras acima e ler o resultado. Falha reverte apenas as associações dessa operação; nunca apaga nem modifica o arquivo existente ou source/visibilidade/data do asset.

### Asset novo

1. Gerar UUID e filename canônico e escrever com `wx`, fora da transação SQLite, como em 014.
2. Depois de fechar o arquivo, abrir transação curta e inserir a imagem, tags e referência.
3. Confirmar COMMIT somente quando tudo persistir; depois disso, perda da resposta não desfaz a operação.
4. Falha de limite/associação/insert/commit faz ROLLBACK e remove somente o arquivo criado por essa operação. Não deixar imagem nova persistida sem seu enriquecimento solicitado.

Não executar await de IO de arquivos dentro de transação SQLite. Não envolver a gravação do arquivo numa transação longa nem introduzir fila ou unidade de trabalho genérica.

### Concorrência

Manter UNIQUE de content_hash. Se duas gravações passam pela consulta inicial, uma inserção vence. A perdedora reverte sua transação e remove somente seu arquivo; depois consulta o asset vencedor e executa a transação de enriquecimento para ele.

A chave composta da referência e o helper síncrono dentro da transação tornam a repetição da mesma associação um no-op. Referências distintas podem acrescentar tags até o limite; a operação que exceder a união falha inteira e não altera o estado anterior. Tratar apenas o erro específico do índice de hash como corrida de duplicata.

Preservar 400 para erro de validação/limite e 500 genérico para persistência/IO. O catch atual de saveImage converte falhas em 500; adaptá-lo para preservar os erros semânticos conhecidos depois de fazer rollback/compensação. Não vazar SQL ou caminhos. Falhas de limpeza continuam registradas e limitadas pelas garantias de 014.

## 6. Respostas e endpoints

Manter as três rotas externas e seus status: POST 201 para novo arquivo/registro, 200 para asset reutilizado, mesmo que receba uma nova referência. Não criar endpoints de update, listagem por entidade ou sincronização.

Adicionar `tags` e `sourceReferences` às respostas de POST e GET de asset. Tags usam o formato existente `{ id, name, normalizedName }`. Referências usam o formato da seção 3 e sempre representam todas as associações do asset, não apenas o envio atual.

Preservar campos anteriores, cache no-store de metadados/POST e Location por ID. Arrays vazios são retornados quando não há associações. Não alterar a resposta interna de upload nem adicionar referências ao payload de toda a galeria sem necessidade.

Exemplo lógico de resposta, com IDs ilustrativos:

```json
{
  "id": "asset-uuid",
  "mimeType": "image/jpeg",
  "sizeBytes": 245000,
  "createdAt": "2026-10-12T12:00:00.000Z",
  "source": "media-pulse",
  "hiddenFromGallery": false,
  "tags": [
    { "id": "tag-uuid", "name": "Legião Urbana", "normalizedName": "legião urbana" }
  ],
  "sourceReferences": [
    {
      "application": "media-pulse",
      "entityType": "album",
      "entityId": "123",
      "url": "https://media-pulse.marcal.dev/albums/123",
      "createdAt": "2026-10-12T12:00:00.000Z"
    }
  ]
}
```

Entrega de conteúdo não muda. `source` do asset continua indicando primeiro envio, e application de cada referência registra sua origem independente. Sem autenticação, esses valores permanecem declarações dos clientes.

## 7. Interface e descoberta

Sem novos componentes, formulários ou badges. A listagem interna já expõe tags; após reload, busca, chips, Explore e relacionadas usam o enriquecimento persistido. Não adicionar polling ou live update para upload externo.

Capas e contagens seguem os mesmos helpers de 014: tags acrescentadas a uma imagem oculta não a fazem aparecer na descoberta padrão; mostram-se quando a imagem volta a ser visível. A edição manual mantém suas operações atuais. Não marcar uma tag como imutável por ter vindo do consumidor.

## 8. Testes

Seguir node:test, subprocesso e diretório temporário de 014. Reutilizar fixtures e harness HTTP existente; organizar os novos cenários em teste/helper próprio se tornar a leitura mais clara. Não usar o acervo pessoal.

Verificar:

- Upload anterior sem campos novos, com arrays vazios na resposta externa; upload interno e URL sem alterações de contrato.
- Imagem nova com tags/referência, consulta com dados persistidos e recuperação byte a byte inalterada.
- JSON inválido, tipos/campos inválidos ou repetidos, listas vazias, normalização, deduplicação, 48 caracteres, tamanho dos campos e limite da união de oito tags.
- Asset existente com tags pessoais recebe somente adições; source/data/visibilidade/arquivo permanecem.
- Remover uma tag manualmente e repetir a mesma referência/asset não restaura a tag; repetir com outras sugestões não as aplica como update. Retry com tags atuais no limite também funciona.
- Sem referência, envio explícito acrescenta sugestões; uma tag removida pode voltar. Nova referência independente ao mesmo asset pode enriquecer novamente.
- Duas entidades apontam para o mesmo asset; uma entidade aponta para duas imagens diferentes. Referências de duas aplicações permanecem distintas, mesmo que entityId/type sejam iguais.
- URL da associação existente e createdAt permanecem no retry, inclusive quando o novo payload a omite ou muda. URL nunca é buscada.
- Erro de insert de tags/referências/commit em asset novo não deixa imagem, arquivo ou associações parciais. Em existente, estado e bytes anteriores permanecem. Usar triggers SQLite e os mecanismos concretos de IO já usados em 014.
- Concorrência de uploads iguais com referência igual ou distinta, índice de hash e limite de união sem duplicatas nem arquivos perdedores.
- Exclusão remove referências na mesma transação; falha reverte remoções. Reabertura de banco de 014 cria tabela vazia e preserva registros; inicialização repetida é idempotente.
- Regressões da adição em lote: associações antigas, timestamps, nomes, no-op, limite, rollback e capas continuam iguais depois da extração do helper.
- Imagens ocultas não entram em capas/contagens/relacionadas por receber tags externas.

Executar npm test, npm run build e git diff --check. Fazer smoke no browser de produção com acervo temporário: upload HTTP com `Legião Urbana` → reload → busca → assunto → viewer → edição pessoal → retry HTTP → reload com edição preservada. Sem alegar validação de uso real ou de todas as combinações possíveis de concorrência.

## 9. Arquivos e documentação

Modificar somente quando implementar:

- `server/image-upload.ts`: parsing e validação dos campos.
- `server/db.ts`: tabela, consultas, helper de adição e remoção de referências na exclusão.
- `server/image-storage.ts`: transação de upload/enriquecimento e compensação.
- `server/api/assets.post.ts`: encaminhar enriquecimento; GET usa mapeamento aditivo.
- Testes existentes relevantes e testes específicos de enriquecimento.
- `docs/assets-api.md`: exemplos e regras de retries/limites/associações.

Exemplo planejado de request:

```bash
curl -i \
  -F 'image=@capa.jpg' \
  -F 'source=media-pulse' \
  -F 'tags=["Legião Urbana","Dois","álbum","rock brasileiro"]' \
  -F 'sourceReference={"entityType":"album","entityId":"123","url":"https://media-pulse.marcal.dev/albums/123"}' \
  http://visual-library:3000/api/assets
```

Documentar que a referência pertence à combinação asset/aplicação/tipo/ID; uma entidade admite várias imagens e não há substituição automática. Referência não representa vínculo de propriedade nem garantia de retenção. Retry da mesma associação preserva tags removidas e URL; novo envio sem referência ou nova associação pode acrescentar novamente uma tag.

Após implementação validada, registrar resultados em 015 e atualizar somente as fronteiras relevantes de 014/005/007 e o backlog. Não marcar a proposta como implementada antes dos testes. Versionamento, commit e push seguem pedidos posteriores do usuário; a autorização da entrega 0.5.0 não é publicação automática desta extensão.

## Limitações deliberadas

Sem metadados de domínio, procedência por tag, garantia de preservar remoção diante de novas referências, atualização de URL, substituição de imagens por entidade, endpoints de sincronização ou exclusão por consumidor. Limites de tags permanecem oito/48; a aplicação deve escolher sugestões relevantes. Mantêm-se as limitações de validação estrutural, deduplicação legada e compensação de falhas abruptas documentadas em 014.

## Implementação e validação executadas — 2026-10-12

Implementado enriquecimento no POST externo e consulta de tags/referências em POST/GET. Tabela de referências criada aditivamente; helper síncrono de adição compartilha a transação entre upload e tagging em lote. Imagem nova, tags e referência são confirmados juntos. Compensação limpa apenas o arquivo criado pela operação. Retry da mesma associação conserva tags pessoais e URL; várias imagens por entidade e entidades/aplicações distintas por imagem permanecem independentes.

Nenhuma dependência, rota adicional ou alteração na interface foi necessária. Nenhum código do Media Pulse foi alterado. Versão avançada para 0.6.0 a pedido do usuário, com package.json e package-lock.json sincronizados. Commit e push desta extensão autorizados pelo usuário.

Validação executada:

- npm test: 42 testes passaram, zero falhas. Novo cenário HTTP em subprocesso/acervo temporário cobre normalização, tipos/campos/JSON inválidos, tamanhos dos campos, limite da união, arrays vazios, preservação de edição manual, URL imutável no retry, referências múltiplas, várias imagens por entidade e remoção de referências na exclusão.
- Triggers SQLite verificaram falhas em tags e referências, rollback em imagem nova/existente e rollback de exclusão. Constraint deferida numa tabela exclusiva do teste provocou falha real no COMMIT; imagem/associações e arquivo novo foram revertidos.
- Requests concorrentes verificaram uma só imagem por hash, referência igual sem duplicata, referências distintas com adições e união perto do limite (uma operação aceita, outra rejeitada sem referência parcial).
- Migração partiu do schema de 014; reabertura em outro processo verificou referências persistidas e inicialização idempotente. Regressões de upload/URL de 014, adição em lote, timestamps/no-op, tags/capas e visibilidade passaram.
- npm run build: produção concluída, mantendo os avisos anteriores de sourcemap Nuxt e externalização de node:sqlite. git diff --check sem erros.
- Google Chrome headless/CDP com build de produção e acervo temporário: upload com Legião Urbana → busca por legiao urbana → Explore/assunto → viewer → acrescentar favoritos e remover rock brasileiro → retry do mesmo payload → reload. A tag removida não voltou; favoritos permaneceu; nenhuma exceção JavaScript não tratada.

O roteiro de browser está em /tmp/visual-library-enrichment-browser.mjs, sem dependência de teste adicional. Nenhum teste acessou o acervo pessoal. A validação não cobre todas as combinações possíveis de concorrência nem comprova benefício de uso cotidiano. Permanecem as limitações deliberadas acima; contrato e exemplos atualizados em [assets-api.md](../../assets-api.md).
