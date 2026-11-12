# Implementação e validação do carregamento — 036

Implementação local em 11/11/2026, após [plano](2026-11-11-asset-loading-plan.md), [linha de base real](2026-11-11-real-library-baseline.md) e autorização do usuário. Sem release/deploy ou alteração do acervo real. Versão do pacote e Compose preservados; nenhuma dependência adicionada.

## Mudanças entregues

- Biblioteca e assuntos recebem até 60 imagens por página, com cursor estável por data e ID. Busca normaliza caixa, acentos e espaços e aplica todos os termos antes da paginação, incluindo termos distribuídos entre filename e tags. Ocultas e interseções de tags são filtros no servidor.
- Metadados conhecidos e IDs dos resultados são estados distintos. Resumos, tags e seleção global consultam o escopo completo. Select all obtém IDs sob demanda, sem montar o restante da galeria.
- Explore solicita só sua seleção de até oito imagens. Pastas recebem contagens e até três previews por tag; deixam de depender do catálogo no cliente. O diretório continua montando lotes de 30 e agrupando capas de imagem única.
- Links diretos, referências de similares, relacionadas e vizinhos são resolvidos independentemente dos lotes. Conteúdo/similares conservam as APIs existentes; preparo semântico continua explícito.
- Galeria usa posições estáveis calculadas pelas dimensões, preservando ordem do DOM e dos links. Append não redistribui cartões anteriores; resize preserva uma âncora. Sentinel e botão carregam mais; erro adicional conserva os resultados com retry.
- Profundidade, âncora, scroll e foco usam o histórico existente, inclusive após reload. Respostas antigas são ignoradas na troca de critérios e invalidação por mutações. Uploads aparecem no lote ativo quando correspondem ao filtro; tags/visibilidade/exclusão atualizam listas e resumos.
- Detalhe e ampliação mostram miniatura sob o original durante download/decode/fade. Falhas oferecem retry e preservam a prévia quando disponível. Dimensões ausentes têm reserva inicial e ajuste por dimensões naturais.
- GETs pessoais do catálogo negociam gzip assíncrono com Vary; credenciais, autenticação, tokens públicos, falhas e arquivos de imagem não entram na compressão. Corpo já codificado não é comprimido novamente.
- Miniaturas e rota pessoal de originais usam `private, no-cache`, permitindo armazenamento local com revalidação obrigatória. Autorização continua antes de 304. Metadados, autenticação, falhas/fallback e conteúdo da API de integração continuam `no-store`; política pública preservada. Logout limpa estado privado; pageshow persistido revalida a sessão antes de remontar a biblioteca.

A política de geração de miniaturas não foi alterada. Não houve evidência suficiente para aumentar concorrência, mudar qualidade/resolução ou remover a ativação compartilhada entre remounts. Virtualização continua condicionada a medições de rolagem completa.

## Comparação controlada em biblioteca temporária

Dois builds: commit anterior `0480405` e implementação atual. Mesmo banco inicial: 3.000 imagens, 2.990 visíveis, 10 ocultas, 1.200 tags, 2.400 associações. Originais sintéticos somam 12.658.250 bytes, com padrões sólidos em 12 proporções/tamanhos e conteúdo/hash distinto por registro. Miniaturas já presentes. Essa distribuição é diferente do acervo real de 2 GB; os tempos abaixo não são uma previsão de produção.

Chrome headless no mesmo computador, desktop 1440×1000 e viewport móvel 390×844, DPR 1, sem throttling. Três navegações completas por tela/tamanho em cada build, contextos separados, cache normal. A versão anterior foi medida antes da nova, sem alternância aleatória; carga do computador e caches podem influenciar os tempos. Primeira imagem exige carregamento e opacidade >0,98 na viewport; janela de observação continua por 900 ms depois. As seleções do Explore variam. Os dados da comparação foram coletados antes dos testes que acrescentam tags/uploads nas fixtures.

| Tela | Desktop antes → depois, mediana | Viewport móvel antes → depois, mediana |
| --- | --- | --- |
| Biblioteca | 2.897 → **301 ms** | 3.111 → **273 ms** |
| Pastas | 491 → **289 ms** | 411 → **289 ms** |
| Explore | 360 → **272 ms** | 343 → **272 ms** |

| Indicador inicial | Antes | Depois |
| --- | ---: | ---: |
| Elementos no DOM, Biblioteca | 19.299 | **1.722** (−91,1%) |
| Elementos de imagem, Biblioteca | 2.990 | **60** |
| Corpos das APIs iniciais, Biblioteca | 1.443.098 bytes | **17.672 bytes** (−98,8%) |
| Corpos das APIs iniciais, Pastas | 1.443.098 bytes | **141.827 bytes** |
| Corpos das APIs iniciais, Explore | 1.443.098 bytes | aproximadamente **14,6 KB** |
| Maior tarefa inicial, Biblioteca desktop / móvel | 1.683 / 1.587 ms | nenhuma ≥50 ms observada |

Bytes de APIs são corpos codificados de todas as chamadas iniciais, incluindo estado de sessão/resumo; não incluem headers, scripts ou imagens. O ganho combina paginação, consultas específicas e compressão; não isola o efeito de cada mudança. No novo build não houve tarefas ≥50 ms nas janelas iniciais das seis combinações de tela/viewport. Isso não comprova ausência de tarefas longas em toda a sessão ou em celular físico. CLS inicial permaneceu na mesma ordem: Biblioteca desktop ~0,00002 e móvel ~0,00065; Explore móvel ~0,025. Nenhum `pageerror` nas 36 navegações da comparação.

Dados completos e scripts: `/tmp/visual-library-performance-implementation/before-benchmark.json`, `after-benchmark.json`, `benchmark.mjs`; build anterior em `/tmp/visual-library-performance-baseline/`. Não contêm imagens ou metadados privados do acervo real.

## Verificações funcionais

- **97 testes Node passaram** (`npm test`), incluindo os dois testes novos de paginação/consultas e negociação de compressão. Repetição focal de acesso, consultas e compressão: cinco testes passaram após ampliar a cobertura dos oito endpoints pessoais.
- `npm run build` e `git diff --check` passaram. Build de produção foi usado nos testes de navegador.
- Paginação testada até o fim dos 2.990 resultados, incluindo datas empatadas, sem duplicatas/perdas, cursor inválido, limite máximo, exclusão entre páginas, filtros combinados, normalização, contagens, ocultas, capas, relacionadas e seleção completa após mudança de associação/visibilidade. Plano de consulta confirmou o índice de navegação.
- Chrome: primeira montagem de 60 cartões e ausência de `/api/images` no startup; append sem alterar posições dos primeiros cartões; anterior/próxima atravessando a primeira página; link direto distante; busca fora do lote; Select all incluindo 2.990 resultados; pastas com 30 cartões; Explore com oito; ocultas com dez; larguras 320/390/768/1440 sem overflow e sem erros JavaScript.
- Falha 503 na próxima página preservou os 60 cartões e retry trouxe mais. Tags atrasadas por 1,8 s não bloquearam os cartões. Resposta de uma consulta antiga atrasada não substituiu os resultados da consulta nova.
- Reload recuperou foco no 101º cartão, profundidade necessária e scroll com diferença inferior a 5 px. Detalhe/ampliação mantiveram prévia durante atraso artificial de 1,8 s do original. Falha do original ofereceu retry, concluiu e removeu a prévia após a transição.
- Biblioteca temporária vazia: o primeiro upload no Explore preencheu sua seleção automaticamente. Registro com dimensões ausentes manteve palco visível e retry durante falha do original. Roteiro `empty.mjs`, em processo isolado adicional.
- Mutações somente na fixture: aplicação de tag a **2.990 imagens**, inclusive páginas não carregadas; upload entrando no primeiro lote; edição de tags conservando o detalhe aberto; ocultar/mostrar corrigindo o escopo; exclusão removendo resultado e lookup direto.
- Navegação de busca por conteúdo conservou o preparo explícito; similares com referência A e imagem B em link direto carregaram ambos; duplicatas iniciaram sem catálogo completo.
- Cache no Chrome: **27 respostas 304 reais**, observadas por CDP na revisita. Após logout da sessão de teste, request condicional com cookie antigo retornou 401. Evento `pageshow` persistido simulado descartou o DOM privado e voltou ao login. Não equivale a um ensaio físico de todos os caminhos de BFCache em todos os navegadores.

Roteiros e logs locais: `smoke.mjs`, `advanced.mjs`, `mutations.mjs`, `compatibility.mjs` e arquivos `.log` correspondentes em `/tmp/visual-library-performance-implementation/`. Capturas de detalhe, ampliação e viewport móvel usam somente imagens sintéticas.

## Limites e implantação

A tentativa de typecheck geral com vue-tsc continua encontrando problemas já registrados na entrega 031: profundidade dos tipos de `$fetch`, classes CSS possivelmente indefinidas e ausência de tipos Node no ambiente de checagem. Não usar esse comando como evidência de aprovação completa de tipos; os composables novos, LibraryApp e OriginalImage não produziram erros específicos na última checagem. Logs em `/tmp/visual-library-performance-typecheck-app.log`. Build, testes Node e execução de navegador passaram.

Não foi repetida medição no acervo real com o novo código, pois produção não foi atualizada. Geração fria, hardware móvel real, rede externa e comportamento após percorrer toda a biblioteca continuam sem benchmark novo. Lotes limitam o início, mas o DOM cresce com a rolagem; não há virtualização.

A migração adiciona dois índices e registra uma função SQLite na conexão; não reescreve imagens, tags, IDs ou originais. Nenhuma preparação integral do acervo no startup foi adicionada. Publicação, atualização do servidor e referência `latest` do Compose permanecem fora desta entrega local.
