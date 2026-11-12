# Revisão do carregamento — 11/11/2026

Revisão estática do commit `0480405`, orientada por CONSTITUTION.md: carregamento rápido, navegação fluida e soluções pequenas. Volume informado pelo usuário: 2.934 imagens, 1.182 tags e aproximadamente 2 GB de originais, incluindo imagens ocultas. Esse acervo não está disponível no diretório local de imagens; não foram medidos tempos atuais em produção.

## Resultado

A entrega dos arquivos já possui otimizações úteis, mas o carregamento inicial e a montagem da galeria ainda crescem com o acervo inteiro. Os 2 GB não são transferidos ao abrir a biblioteca: entram metadados completos e miniaturas próximas da tela; originais entram no visualizador ou como fallback de miniaturas.

| Área | Evidência atual | Consequência |
| --- | --- | --- |
| Lista inicial | `server/api/images.get.ts` seleciona todas as imagens e todas as associações com tags; `LibraryApp.vue:loadImages` aguarda também `loadTags` | A primeira imagem depende do catálogo completo, inclusive na seleção pequena do Explore. Tags repetem seus campos em cada imagem associada. Ocultas também integram o catálogo privado inicial. |
| Montagem | `GalleryGrid.vue` faz `v-for` sobre todas as imagens recebidas, com menu e componente de imagem por cartão | Lazy loading reduz downloads, mas não reduz DOM, componentes, observadores nem custo de layout. Até 2.934 cartões se todos forem visíveis no filtro. |
| Download progressivo | `ProgressiveImage.vue` usa IntersectionObserver com margem de 300 px, dimensões reservadas e decode assíncrono | Evita baixar todos os arquivos inicialmente. A ativação fica registrada por URL na aba: ao remontar uma grade já percorrida, as URLs anteriormente ativadas recebem `src` imediatamente, mesmo longe da tela. |
| Cache | `server/thumbnails.ts` e `server/image-content.ts` usam `no-store` para conteúdo privado | O cache persistente de miniaturas no servidor evita regerar, mas o navegador não deve armazenar as respostas para reutilização. ETag/304 existe no código, porém `no-store` impede o fluxo normal de revalidação usando uma resposta armazenada. |
| Miniaturas | WebP Q82, até 640×640, orientação corrigida, sem ampliar, persistência por versão/hash | Boa base para cartões; não há variantes responsivas. Nitidez em DPR alto e economia em arquivos pequenos precisam de amostras reais. |
| Primeira geração | Um processo por derivado, geração serializada, requisições iguais coalescidas, timeout de 15 s por execução | Protege a memória, mas miniaturas ausentes disputam uma fila única. O timeout não limita a espera na fila. Uma sequência de falhas pode atrasar outras imagens. |
| Fallback | Falha de geração redireciona ao original, com cooldown | Mantém conteúdo acessível, mas um lote problemático pode transferir originais grandes dentro da grade. |
| Visualizador | `LightboxViewer.vue` carrega `image.src` diretamente e só revela após load | Arquivos grandes deixam a área principal sem prévia enquanto carregam; a miniatura já disponível não aparece durante a espera. |
| Pastas | `FolderGrid.vue` monta lotes de 30; `automaticTagFolders` deriva grupos no cliente | A montagem do diretório já é incremental, mas ainda depende da lista completa. O agrupamento verifica duplicatas com busca linear por grupo e é chamado separadamente para a lista completa e filtrada. |
| Dimensões legadas | `ensureImageDimensions` lê prefixos de até 64 KiB, oito arquivos por lote, persistindo resultado | Trabalho limitado por arquivo e normalmente único, mas a API aguarda todo o backfill pendente antes de responder. Arquivos ilegíveis são tentados novamente nas próximas consultas. |

## Ordem recomendada

1. **Reduzir a dependência do catálogo completo para a primeira tela.** Entregar um lote inicial limitado com filtros no servidor e resumo separado de contagens/bytes; carregar próximos lotes conforme navegação. Explore deve solicitar somente sua seleção. Preservar busca global, imagens ocultas, seleção em lote, próxima/anterior e retorno com posição/foco: apenas acrescentar LIMIT ao endpoint atual quebraria esses contratos.
2. **Limitar a montagem dos cartões e reavaliar a ativação por proximidade em remounts.** Começar com lotes incrementais, seguindo a abordagem simples já presente em pastas. O masonry usa CSS columns: limitar os itens muda sua distribuição ao acrescentar lotes; validar estabilidade, retorno e foco antes de aplicar. Lotes reduzem montagem inicial, mas não limitam o DOM depois de percorrer todo o acervo; virtualização só se a medição justificar.
3. **Mostrar a miniatura durante o download do original no visualizador.** Pequena melhoria direta na espera percebida, preservando proporção e troca após carregamento/decodificação.
4. **Revisar cache privado como mudança explícita de contrato.** Uma alternativa é `private, no-cache`, que permite armazenamento local e exige revalidação, sempre após autenticação. Validar logout, troca de sessão, revogação, exclusão e histórico do navegador. Não aplicar cache longo ou público a conteúdo privado. O `no-store` atual é uma escolha documentada de privacidade, não uma linha a remover isoladamente.
5. **Medir a fila fria antes de aumentar concorrência ou criar preparo antecipado.** Comparar biblioteca com miniaturas presentes e ausentes, registrar tempo de espera, fallback e memória. Manter geração sob demanda e evitar novo serviço ou preparo integral no startup.

Não há evidência de necessidade de trocar SQLite, criar CDN, serviços separados ou infraestrutura de busca para resolver estes pontos.

## Validação necessária no acervo atual

Medir primeira visita e revisita em Library, Explore e pastas; abertura de original grande; rolagem e retorno do visualizador. Registrar bytes de `/api/images` e `/api/tags`, TTFB, primeira imagem visível, requisições por tipo, cartões no DOM, tarefas longas, CLS e memória. Repetir em desktop e celular real, distinguindo cache de navegador e miniaturas persistidas no servidor.

O relatório de 03/11 encontrou 805 KB de metadados para 1.112 imagens e resolveu um enlace de rede a 10 Mb/s. Esses valores são históricos: não permitem atribuir latência atual à rede nem estimar com precisão o payload de 2.934 imagens, pois o número de associações e o tamanho dos campos variam.

Esta revisão adiciona apenas documentação; nenhum comportamento, política de acesso ou dado do acervo foi alterado.
