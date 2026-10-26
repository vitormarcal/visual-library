# API de assets do Visual Library

O Visual Library usa Nuxt/Nitro/H3, SQLite nativo do Node e arquivos locais em `data/images`. A API externa compartilha a tabela `images`, UUIDs, deduplicação SHA-256 e ciclo de vida com a biblioteca. Aplicações consumidoras guardam o ID e seus próprios metadados; não precisam conhecer nomes ou diretórios internos.

A API exige sessão do dono ou token Bearer revogável de aplicação. Configuração e transição em [acesso e compartilhamento](access-and-sharing.md). `source` é informado pelo cliente e `hiddenFromGallery` controla apresentação, não autorização. Não foram adicionadas permissões CORS.

## Endpoints externos

| Método e caminho | Resposta |
| --- | --- |
| `POST /api/assets` | 201 para criação; 200 para bytes já existentes, com o mesmo contrato. |
| `GET /api/assets/{id}` | Metadados; 404 se o registro não existe. |
| `GET /api/assets/{id}/content` | Original por streaming; 404 se o registro ou arquivo não existe. |

Há também `PUT /api/assets/{id}/references/tags` para atualizar um grupo de classificação de uma referência existente. Não há listagem externa, exclusão externa, importação por URL externa ou miniaturas. A interface continua usando os endpoints existentes de imagens e tags e a rota `/images/{filename}`.

## Upload

Enviar `multipart/form-data` com exatamente um arquivo no campo `image`:

| Campo | Obrigatório | Valor |
| --- | --- | --- |
| `image` | Sim | Imagem não vazia: JPEG, PNG, GIF, WebP ou AVIF. SVG não é aceito. |
| `source` | Não | Padrão `visual-library`; 1–64 caracteres após trim, letras ASCII minúsculas, números, `.`, `-`, `_`; primeiro caractere deve ser letra ou número. |
| `hiddenFromGallery` | Não | String `true` ou `false`; padrão `false`. |
| `tags` | Não | Texto JSON com array de strings; omitido ou `[]` não remove tags. |
| `sourceReference` | Não | Texto JSON `{ entityType, entityId, url? }`; a aplicação vem de `source`. |

Campos desconhecidos/repetidos e arquivos adicionais são rejeitados. O formato é identificado pelos bytes com verificação estrutural; MIME e extensão do cliente não determinam formato ou nome de armazenamento. Uma imagem legítima com MIME incorreto é aceita. JPEGs completos com metadados SEF após o marcador final (`FF D9`) também são aceitos: o trailer precisa ter cabeçalho `SEFH`, rodapé `SEFT`, diretório consistente e registros contíguos dentro dos limites do arquivo, sem sobreposição ou lacunas. Ter apenas a assinatura final não basta. Bytes extras arbitrários, trailers inconsistentes e JPEG sem marcador final continuam retornando 415. A validação não remove o trailer nem recomprime a imagem; tamanho, SHA-256, armazenamento e conteúdo retornado consideram o arquivo completo.

```bash
curl -i \
  -F 'image=@foto.jpg' \
  -F 'source=media-pulse' \
  -F 'hiddenFromGallery=true' \
  http://visual-library:3000/api/assets
```

Exemplo de resposta (201 e `Location: /api/assets/{id}`):

```json
{
  "id": "c0902e4d-6d90-4f0b-a544-d6822fbf052d",
  "mimeType": "image/jpeg",
  "sizeBytes": 245000,
  "createdAt": "2026-10-12T12:00:00.000Z",
  "source": "media-pulse",
  "hiddenFromGallery": true,
  "tags": [],
  "sourceReferences": []
}
```

Enviar novamente os mesmos bytes retorna 200 com o ID, data, origem e visibilidade originais. Esses campos não são sobrescritos. Tags e referências podem ser enriquecidas conforme as regras abaixo. A origem do asset representa o primeiro envio; não há histórico de uploads ou propriedade por consumidor.

## Tags e referências de origem no upload

```bash
curl -i \
  -F 'image=@capa.jpg' \
  -F 'source=media-pulse' \
  -F 'tags=["Legião Urbana","Dois","álbum","rock brasileiro"]' \
  -F 'sourceReference={"entityType":"album","entityId":"123","url":"https://media-pulse.marcal.dev/albums/123"}' \
  http://visual-library:3000/api/assets
```

Tags são aditivas: a união com as atuais deve caber nas oito tags por imagem, com 48 caracteres por tag após limpeza de espaços. Comparação ignora caixa e reutiliza o nome de exibição existente. O JSON aceita até 32 entradas brutas e 4 KiB UTF-8; após normalização, até oito tags distintas. Não há conversão automática de tipos, títulos ou metadados em tags.

A referência permite identificar a entidade sem usar tags. `entityType` usa identificador simples de até 64 caracteres (como source); `entityId` é string opaca de 1–256 caracteres, sem controles/espaços externos. `url` é opcional, HTTP(S) absoluta, até 2048 caracteres e sem credenciais. O objeto aceita apenas esses campos e seu JSON tem limite de 8 KiB. IDs numéricos devem ser enviados como string; `"00123"` e `"123"` continuam distintos. A URL é armazenada sem ser acessada.

POST e GET de asset incluem arrays `tags` e `sourceReferences`, além dos campos anteriores. Tags usam `{ id, name, normalizedName }`; referências usam `{ application, entityType, entityId, url, createdAt }`. Ausência de URL é null. Cada consulta mostra o estado atual completo, sem filenames ou paths internos.

Uma entidade pode ter várias imagens, e uma imagem pode ter referências a várias entidades/aplicações. Enviar outra imagem para a mesma entidade acrescenta uma associação; não substitui a anterior. O source original do asset é preservado, mesmo quando outra aplicação acrescenta sua referência.

Regras de reenvio:

- A associação é identificada por asset + aplicação + tipo + ID externo. Reenviar a mesma associação não reaplica tags nem altera URL/data da referência, preservando remoções pessoais.
- Uma primeira associação sem tags ou sem URL não é preenchida posteriormente pelo retry; atualização de referência fica fora desta API.
- Sem referência, cada envio com tags acrescenta sugestões explicitamente. Uma tag removida manualmente pode voltar se reenviada dessa forma.
- Uma nova referência ao mesmo asset também pode acrescentar novamente uma sugestão removida em outro contexto. Não existe procedência ou histórico de remoções por tag.

Arquivo novo, tags e referência são confirmados conjuntamente. Erro de limite ou persistência reverte o enriquecimento; compensação nunca apaga o arquivo reutilizado. Exclusão pela interface remove referências locais junto com o registro. Não há sincronização automática ou chamada ao Media Pulse.

## Referenciar e exibir

Para chamadas de servidor, enviar `Authorization: Bearer TOKEN` nos exemplos curl abaixo (inclusive uploads); os exemplos mostram os payloads e caminhos. O navegador do dono usa sua sessão. Guardar o ID na aplicação consumidora. Configurar a URL base do Visual Library e formar `/api/assets/{id}` para metadados e `/api/assets/{id}/content` para os bytes.

```bash
curl http://visual-library:3000/api/assets/ASSET_ID
curl -o original.jpg http://visual-library:3000/api/assets/ASSET_ID/content
```

```html
<!-- Para leitores externos, criar um link público pelo visualizador ou por token autorizado. -->
<img src="https://biblioteca.exemplo/shared-images/TOKEN_PUBLICO" alt="Imagem">
```

Tokens criados com `publishPublicLinks: true` podem consultar/criar o link público por `GET/POST /api/images/{id}/public-link`, usando o ID retornado no upload e o mesmo Bearer. POST retorna `{ "url": "https://biblioteca.exemplo/shared-images/..." }` e reutiliza um link ativo. GET retorna `{ "url": null }` se ainda não publicado. Tokens comuns recebem 403; revogados recebem 401. A publicação é uma chamada explícita após o upload. Revogar o token preserva URLs publicadas; revogar o link continua exclusivo do owner.

O hostname `visual-library` da rede Docker normalmente só é resolvido pelos containers. O navegador precisa de endereço alcançável, por exemplo o domínio usado para acessar a biblioteca ou um endereço da rede local. Nenhuma alteração no Media Pulse faz parte desta implementação.

O ID independe do filename registrado. A entrega autenticada de conteúdo usa MIME detectado, `Content-Length`, `X-Content-Type-Options: nosniff`, `Cache-Control: no-store`, ETag e Last-Modified. Requisições condicionais podem retornar 304. Metadados e resposta de upload usam `no-store`. Não há suporte específico a range requests.

Imagens públicas válidas em `/shared-images/{token}` permitem cache por um ano: `Cache-Control: public, max-age=31536000, immutable`, em GET/HEAD e respostas condicionais 304. Erros continuam com `no-store`. Revogar o link ou excluir a imagem interrompe novas entregas pelo servidor; não purga nem invalida cópias existentes em navegadores/CDNs. Rotas privadas e gestão de links conservam `no-store`.

## Origem e visibilidade na interface

No visualizador, a área abaixo da imagem mostra `Source` e permite `Hide from gallery`/`Show in gallery`. Na Library, `Hidden images` abre somente as ocultas; `Show gallery` retorna às visíveis. Esse modo usa `/?view=library&visibility=hidden` e acompanha reload/histórico.

Ocultos não participam da descoberta padrão: galeria, busca, assuntos, relacionadas, capas e contagens. Arquivos e tags permanecem armazenados e acessíveis por HTTP autenticado. Links internos antigos para ocultos oferecem recuperação explícita sem mostrá-los automaticamente na galeria. Capas são substituídas por integrantes visíveis e a substituta válida permanece estável quando outra imagem volta a ser visível.

A interface usa `PATCH /api/images/{id}/visibility` com JSON `{ "hiddenFromGallery": true }`, retornando a imagem no formato interno. Este endpoint não altera origem ou tags. `GET /api/images` continua listando o acervo completo, com os campos aditivos `source` e `hiddenFromGallery`; a interface filtra a apresentação.

## Limite e migração

Limite padrão: 15 MiB (`15728640` bytes). Configurar `NUXT_PUBLIC_MAX_IMAGE_SIZE_BYTES` no ambiente do servidor/container, por exemplo `10485760` para 10 MiB. O valor deve ser inteiro positivo seguro; configuração inválida impede inicialização. O limite efetivo também é enviado à interface para validar arquivos e apresentar mensagens coerentes.

O servidor limita a leitura multipart a limite do arquivo + 64 KiB de overhead e verifica o tamanho exato do arquivo após parsing, inclusive em requests chunked. Upload usa memória proporcional ao limite e pode envolver cópias do parser; download do original usa streaming. O download remoto da interface também respeita o limite.

A inicialização do banco aplica migração aditiva e idempotente:

- `images.source TEXT NOT NULL DEFAULT 'visual-library'`.
- `images.hidden_from_gallery INTEGER NOT NULL DEFAULT 0 CHECK (...)`.

Imagens antigas continuam visíveis, com seus IDs, datas, nomes, bytes e tags preservados. A extensão de enriquecimento também cria automaticamente a tabela `asset_references`, inicialmente vazia, com chave composta por asset/aplicação/tipo/ID. Não há comando manual de migração, backfill de hashes ou alteração do diretório/volume. Arquivos legados têm MIME corrigido, quando identificável, a partir de um prefixo de até 64 KiB durante a entrega; não são renomeados.

## Erros

| Status | Situação |
| --- | --- |
| 400 | Formulário, campos ou valores inválidos; arquivo vazio. |
| 413 | Arquivo ou corpo acima do limite. |
| 415 | Corpo não multipart ou imagem não suportada/estrutura inválida. |
| 404 | Asset ou conteúdo inexistente. |
| 500 | Falha de armazenamento ou persistência. |

Erros seguem o envelope HTTP do H3/Nitro, com `statusCode` e `statusMessage`. Detalhes operacionais são registrados no servidor. Não usar textos de erro como contrato de integração.

## Limitações

- Excluir pela interface remove o registro e quebra referências externas. ID estável não garante retenção; cópias baixadas e caches emitidos antes da autenticação podem permanecer disponíveis.
- Validação estrutural não decodifica pixels, verifica todos os checksums ou identifica toda corrupção. Legados são identificados somente pelo prefixo; formato não reconhecido retorna 415 sem apagar o arquivo.
- Falhas tratáveis de escrita/insert são compensadas. Interrupção abrupta do processo ou recusa do filesystem em limpar podem deixar órfãos; falhas de compensação são registradas. A exclusão mantém sua limitação anterior: erro de unlink é ignorado.
- Registros antigos sem hash continuam fora da deduplicação. Uma duplicata não repara automaticamente arquivo ausente.
- Sem dimensões persistidas, miniaturas, transformações, perfis, metadados genéricos, atualização de referências, sincronização de tags/coleções, controle por origem em lote ou atualização automática da galeria quando outro serviço envia imagens. Reload carrega alterações externas.

## Grupos de classificação vinculados a referências

Esta extensão foi aprovada para correções automáticas de movimentos de obras no Media Pulse. Sem alteração de interface ou novas dependências. Referências agora incluem `managedTags`, um objeto de grupos `{ tags: string[], revision: number }`. Upload pode enviar o campo multipart textual `managedTags`, por exemplo `{"movements":{"tags":["Art Nouveau","Simbolismo"],"revision":1}}`; exige `sourceReference`. Até quatro grupos, identificadores simples de até 64 caracteres, JSON até 8 KiB, 32 entradas brutas por grupo e revisão inteira segura não negativa. A união visível continua limitada a oito tags, com 48 caracteres por tag. Erros de grupo/união são 409 e revertem upload/enriquecimento; não descartar termos silenciosamente. Upload genérico sem esse campo continua igual.

`PUT /api/assets/{id}/references/tags` recebe JSON até 16 KiB:

```json
{
  "application": "media-pulse",
  "entityType": "artwork",
  "entityId": "123",
  "group": "movements",
  "tags": ["Secessão Vienense", "Simbolismo"],
  "revision": 2
}
```

Requer asset e referência existentes. `[]` limpa o grupo. Retorna `{ preservedTags: string[], legacyTagsPreserved: boolean }`, com no-store. Erros: 400 formato/identidade/revisão inválidos, 404 asset/referência ausentes, 409 limite de tags ou revisão conflitante/antiga, 413 tamanho, 500 persistência. Conflitos incluem `data.code` (`TAG_LIMIT`, `STALE_REVISION`, `REVISION_CONFLICT`). Revisões iguais e conjuntos iguais são idempotentes; menor revisão não sobrescreve maior. URL e data da referência continuam preservadas.

Cada grupo registra sua procedência em `asset_reference_tag_groups`; associações visíveis têm flag `image_tags.personal`. Inicialização adiciona coluna com default 1, protegendo todo o legado sem adivinhar sua origem. Exclusão da imagem também remove grupos. Não há backfill de procedência.

Ao corrigir, remover um termo antigo apenas quando ele não é pessoal nem pertence a outro grupo/referência. Preservar datas e nomes das tags existentes. Adições/removidas, revisão e capas são confirmadas conjuntamente. A edição individual preserva a procedência de termos inalterados e marca novos termos como pessoais; remover e acrescentar um termo ou adicioná-lo explicitamente em lote permite assumi-lo na curadoria pessoal. Adição em lote protege também termos já presentes. Um termo inalterado que foi removido manualmente não é restaurado por uma correção ou retry; uma nova classificação pode adicioná-lo novamente.

**Legado:** tags anteriores à procedência são preservadas. A primeira adoção informa `legacyTagsPreserved`; remoções de termos pessoais/compartilhados informam `preservedTags`. A classificação da referência é corrigida, mas essas tags globais não são apagadas automaticamente.

Reenvio de upload conserva sugestões genéricas quando a referência já existe; grupos vinculados são atualizados sob suas regras de revisão. O Visual Library agora exige autenticação; aplicação e referência continuam declarações do cliente, não permissões por asset. Sem fila, sincronização de metadados gerais ou controle de retenção.
