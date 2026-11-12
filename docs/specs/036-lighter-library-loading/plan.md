# Implementação

O [plano detalhado de desempenho](../../performance/2026-11-11-asset-loading-plan.md) foi elaborado antes da autorização. Esta entrega concretiza compressão, prévia, consultas limitadas, montagem incremental e cache privado com revalidação. A medição não justificou mudar o decoder ou a qualidade das miniaturas.

- `server/library-browse.ts` concentra consultas específicas: páginas por cursor data/ID, busca normalizada antes do limite, IDs para seleção global, resumo, pastas com três previews, Explore, imagem direta, vizinhos e relacionadas. Endpoints pessoais em `/api/library/*`; `/api/images` e integrações conservam seus contratos.
- Índices de navegação por visibilidade/data/ID e associações por tag. Tags dos cartões são consultadas por lote, sem uma consulta por cartão. Dimensões legadas são preenchidas só no lote solicitado.
- `useLibraryCatalog` mantém listas por critérios e registros conhecidos separados. Respostas antigas são ignoradas após invalidação; alterações recarregam resultados e resumos. Profundidade e âncora acompanham o histórico existente.
- GalleryGrid calcula posições por altura estimada e mantém a ordem do DOM; append conserva a posição dos cartões anteriores. Sentinel e botão equivalente, erro/retry local, breakpoints e âncora em resize.
- OriginalImage mostra prévia sob o original, aguarda decode e ignora conclusões de uma imagem anterior. Retry e ampliação preservados.
- Plugin de compressão no hook `beforeResponse` da versão instalada de Nitro; gzip assíncrono, negociação e Vary, somente GETs pessoais do catálogo. Sem dupla compressão ou inclusão de respostas com credenciais.
- Miniaturas e rota pessoal `/images/*` usam `private, no-cache`; autenticação precede 304. Metadados, falhas, fallback e conteúdo da API de assets continuam `no-store`; política pública preservada. Retorno via pageshow persistido revalida sessão e descarta estado privado antes de remontar.

Resultados e limites estão no [relatório de implementação](../../performance/2026-11-11-asset-loading-implementation.md). Sem release, deploy ou alteração de Compose nesta entrega.
