# API de assets do Visual Library

O Visual Library usa Nuxt/Nitro/H3, SQLite nativo do Node e arquivos locais em `data/images`. A API externa compartilha a tabela `images`, UUIDs, deduplicação SHA-256 e ciclo de vida com a biblioteca. Aplicações consumidoras guardam o ID e seus próprios metadados; não precisam conhecer nomes ou diretórios internos.

Não há autenticação nesta entrega, por decisão do usuário. Todas as rotas são acessíveis a quem alcançar o servidor. `source` é informado pelo cliente e `hiddenFromGallery` controla apresentação, não autorização. Não foram adicionadas permissões CORS.

## Endpoints externos

| Método e caminho | Resposta |
| --- | --- |
| `POST /api/assets` | 201 para criação; 200 para bytes já existentes, com o mesmo contrato. |
| `GET /api/assets/{id}` | Metadados; 404 se o registro não existe. |
| `GET /api/assets/{id}/content` | Original por streaming; 404 se o registro ou arquivo não existe. |

Não há listagem externa, exclusão externa, importação por URL externa ou miniaturas. A interface continua usando os endpoints existentes de imagens e tags e a rota `/images/{filename}`.

## Upload

Enviar `multipart/form-data` com exatamente um arquivo no campo `image`:

| Campo | Obrigatório | Valor |
| --- | --- | --- |
| `image` | Sim | Imagem não vazia: JPEG, PNG, GIF, WebP ou AVIF. SVG não é aceito. |
| `source` | Não | Padrão `visual-library`; 1–64 caracteres após trim, letras ASCII minúsculas, números, `.`, `-`, `_`; primeiro caractere deve ser letra ou número. |
| `hiddenFromGallery` | Não | String `true` ou `false`; padrão `false`. |

Campos desconhecidos/repetidos e arquivos adicionais são rejeitados. O formato é identificado pelos bytes com verificação estrutural; MIME e extensão do cliente não determinam formato ou nome de armazenamento. Uma imagem legítima com MIME incorreto é aceita.

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
  "hiddenFromGallery": true
}
```

Enviar novamente os mesmos bytes retorna 200 com o registro original, inclusive ID, data, origem e visibilidade originais. O segundo envio não altera esses campos. A origem representa o primeiro envio; não há histórico ou propriedade por consumidor.

## Referenciar e exibir

Guardar o ID na aplicação consumidora. Configurar a URL base do Visual Library e formar `/api/assets/{id}` para metadados e `/api/assets/{id}/content` para os bytes.

```bash
curl http://visual-library:3000/api/assets/ASSET_ID
curl -o original.jpg http://visual-library:3000/api/assets/ASSET_ID/content
```

```html
<img src="https://biblioteca.exemplo/api/assets/ASSET_ID/content" alt="Imagem">
```

O hostname `visual-library` da rede Docker normalmente só é resolvido pelos containers. O navegador precisa de endereço alcançável, por exemplo o domínio usado para acessar a biblioteca ou um endereço da rede local. Nenhuma alteração no Media Pulse faz parte desta implementação.

O ID independe do filename registrado. A entrega usa MIME detectado, `Content-Length`, `X-Content-Type-Options: nosniff`, `Cache-Control: private, max-age=3600`, ETag e Last-Modified. Requisições condicionais podem retornar 304. Metadados e resposta de upload usam `no-store`. Não há suporte específico a range requests.

## Origem e visibilidade na interface

No visualizador, a área abaixo da imagem mostra `Source` e permite `Hide from gallery`/`Show in gallery`. Na Library, `Hidden images` abre somente as ocultas; `Show gallery` retorna às visíveis. Esse modo usa `/?view=library&visibility=hidden` e acompanha reload/histórico.

Ocultos não participam da descoberta padrão: galeria, busca, assuntos, relacionadas, capas e contagens. Arquivos e tags permanecem armazenados e acessíveis por HTTP. Links internos antigos para ocultos oferecem recuperação explícita sem mostrá-los automaticamente na galeria. Capas são substituídas por integrantes visíveis e a substituta válida permanece estável quando outra imagem volta a ser visível.

A interface usa `PATCH /api/images/{id}/visibility` com JSON `{ "hiddenFromGallery": true }`, retornando a imagem no formato interno. Este endpoint não altera origem ou tags. `GET /api/images` continua listando o acervo completo, com os campos aditivos `source` e `hiddenFromGallery`; a interface filtra a apresentação.

## Limite e migração

Limite padrão: 15 MiB (`15728640` bytes). Configurar `NUXT_PUBLIC_MAX_IMAGE_SIZE_BYTES` no ambiente do servidor/container, por exemplo `10485760` para 10 MiB. O valor deve ser inteiro positivo seguro; configuração inválida impede inicialização. O limite efetivo também é enviado à interface para validar arquivos e apresentar mensagens coerentes.

O servidor limita a leitura multipart a limite do arquivo + 64 KiB de overhead e verifica o tamanho exato do arquivo após parsing, inclusive em requests chunked. Upload usa memória proporcional ao limite e pode envolver cópias do parser; download do original usa streaming. O download remoto da interface também respeita o limite.

A inicialização do banco aplica migração aditiva e idempotente:

- `images.source TEXT NOT NULL DEFAULT 'visual-library'`.
- `images.hidden_from_gallery INTEGER NOT NULL DEFAULT 0 CHECK (...)`.

Imagens antigas continuam visíveis, com seus IDs, datas, nomes, bytes e tags preservados. Não há comando manual de migração, backfill de hashes ou alteração do diretório/volume. Arquivos legados têm MIME corrigido, quando identificável, a partir de um prefixo de até 64 KiB durante a entrega; não são renomeados.

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

- Excluir pela interface remove o registro e quebra referências externas. ID estável não garante retenção; o browser pode continuar mostrando conteúdo já armazenado em cache por até uma hora.
- Validação estrutural não decodifica pixels, verifica todos os checksums ou identifica toda corrupção. Legados são identificados somente pelo prefixo; formato não reconhecido retorna 415 sem apagar o arquivo.
- Falhas tratáveis de escrita/insert são compensadas. Interrupção abrupta do processo ou recusa do filesystem em limpar podem deixar órfãos; falhas de compensação são registradas. A exclusão mantém sua limitação anterior: erro de unlink é ignorado.
- Registros antigos sem hash continuam fora da deduplicação. Uma duplicata não repara automaticamente arquivo ausente.
- Sem dimensões persistidas, miniaturas, transformações, perfis, sincronização de tags/coleções, controle por origem em lote ou atualização automática da galeria quando outro serviço envia imagens. Reload carrega alterações externas.
