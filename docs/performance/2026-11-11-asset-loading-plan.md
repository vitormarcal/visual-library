# Plano de melhoria do carregamento de assets

Status: implementação local concluída em 11/11/2026 após autorização do usuário. Resultados e limites no [relatório da entrega](2026-11-11-asset-loading-implementation.md). Sem deploy. Base: [revisão do carregamento](2026-11-11-asset-loading-review.md), CONSTITUTION.md e contratos de navegação, imagens progressivas, miniaturas, acesso e pastas de 013/017/021/026/031/032/033.

Atualização após autenticação manual: [linha de base no acervo real](2026-11-11-real-library-baseline.md) concluída para carga inicial e fluxos amostrais. Foram observadas 2.936 imagens, 2,39 MB de metadados sem compressão por navegação e tarefas de até 689 ms. O ensaio real substitui a necessidade de fixture para diagnóstico inicial; manter fixtures para testes de implementação. Geração fria e celular físico continuam pendentes.

## Objetivo e limites

Fazer a primeira tela depender das imagens que ela mostra, manter navegação responsiva e reduzir transferências repetidas para o acervo informado de 2.934 imagens e 1.182 tags. Preservar masonry, busca global, organização e privacidade.

Continuar com Nuxt/Nitro, SQLite e arquivos locais. Sem serviço novo, CDN, Redis, fila persistente, preparo de todo o acervo no startup ou dependência de IA. Não modificar originais, URLs públicas ou a API de integração de assets como efeito colateral. Tamanhos de lote abaixo são valores iniciais de implementação, não configurações novas para o usuário.

## 1. Registrar a linha de base

Antes de modificar o fluxo, criar um cenário isolado e repetível com aproximadamente 3.000 registros, 1.200 tags, associações variadas, ocultas, datas empatadas e dimensões conhecidas. Usar originais de tamanhos/proporções variados, incluindo animação, transparência, arquivo inválido e imagem grande. Fixtures não reproduzem a distribuição ou a latência do acervo real.

Medir build de produção em desktop 1440×1000 e mobile 390×844 emulado, com pelo menos três rodadas por cenário. Registrar mediana e intervalo de bytes, tempo até primeira imagem visível, tarefas longas, CLS, quantidade de cartões/observadores e requisições de miniaturas/originais. Distinguir primeira visita, retorno do detalhe e recarga; distinguir miniaturas presentes e ausentes no servidor.

Guardar roteiro e resultados sem imagens privadas, cookies ou tokens. Medição do acervo real é uma validação posterior em sessão existente/autorizada, sem reset de senha ou mutações nos dados. Não reutilizar tempos de 03/11 como linha de base atual.

**Saída:** comparação reproduzível para as etapas seguintes, sem instrumentação permanente na interface.

### 1b. Comprimir JSON sem mudar os contratos

Adicionado pela medição real: o catálogo de 2.125.244 bytes comprimiu para 350.969 bytes com gzip nível 6 no ensaio local. Verificar o ponto existente de entrega HTTP (Nitro ou proxy) e aplicar compressão em apenas uma camada para JSON, negociando `Accept-Encoding` e enviando `Vary: Accept-Encoding`. Não comprimir WebP/JPEG/AVIF novamente nem alterar `no-store` como parte desta etapa. Evitar cache compartilhado de respostas privadas.

Validar descompressão e conteúdo idêntico, cliente sem suporte, cabeçalhos corretos, ausência de compressão dupla e custo de CPU/latência sob navegação normal. Preferir recurso nativo da camada já implantada, sem novo serviço. Meta inicial: corpo comprimido de `/api/images` abaixo de 25% dos 2.125.244 bytes para a mesma amostra; registrar o ganho observado de latência separadamente. Revisar exposição de segredos em respostas comprimidas; autenticação e respostas com credenciais ficam fora do escopo. Esta etapa não substitui paginação ou montagem incremental.

## 2. Mostrar prévia no detalhe e corrigir reativação fora da tela

Esta entrega é pequena e pode preceder a mudança de dados.

- Em `LightboxViewer.vue`, exibir `thumbnailSrc` sob o original durante carregamento e decodificação. A troca usa o ID/src atual para descartar conclusões atrasadas após navegar rapidamente. Reservar dimensões e manter a mesma geometria, sem flash entre imagens.
- Aplicar a prévia também na ampliação quando o original ainda estiver pendente. Ao falhar a miniatura, continuar o original; ao falhar o original, conservar a prévia e oferecer retry discreto. Sem miniatura, manter um placeholder estável. Evitar requisição duplicada desnecessária do original entre detalhe e ampliação.
- Em `ProgressiveImage.vue`, separar proximidade da tela de estado de transição visual. Uma URL vista anteriormente não deve ganhar `src` fora da tela apenas por estar no registro compartilhado da aba. Preservar o comportamento ao navegar/retornar e limpar observadores ao desmontar.

**Aceite:** original lento mantém uma prévia visível; resposta de imagem anterior não interfere na atual; voltar de uma galeria percorrida não dispara downloads de todas as miniaturas anteriormente ativadas. Sem alteração de cache ou acesso nesta etapa.

Na medição real, persistiram 240 imagens ativadas fora da viewport, mas sem novos pedidos no retorno entre telas. Portanto a prévia tem prioridade comprovada; a mudança na ativação depende de reproduzir requisições/custo desnecessário e não deve ser agrupada obrigatoriamente à entrega da prévia.

## 3. Criar consultas limitadas com semântica completa

Preparar os contratos antes de substituir a fonte de dados do frontend. Reaproveitar `server/db.ts` e utilitários específicos; não criar um framework genérico de consultas.

### Biblioteca, busca e assuntos

- Introduzir listagem paginada para a interface, começando com 60 imagens por lote e máximo validado no servidor. Migrar o consumidor no mesmo conjunto de mudanças; a listagem antiga não pode continuar sendo chamada no startup.
- Ordenar por `created_at DESC, id DESC`, com cursor pela mesma dupla. Validar formato e tamanho dos parâmetros, usar SQL parametrizado e buscar tags somente dos IDs retornados. Adicionar índices apenas para consultas efetivas, verificados por `EXPLAIN QUERY PLAN`.
- Aplicar ocultas, assunto, interseção de tags e busca textual antes da paginação. Preservar exatamente a normalização de `image-search.ts`: caixa, acentos, espaços e todos os termos distribuídos entre nome original e tags. Não substituir por LIKE simples com semântica diferente. Medir normalização na consulta; persistir campos normalizados somente se isso for necessário e com atualização em todos os caminhos de escrita.
- Retornar contagem total do resultado separada do número carregado. Disponibilizar resumo global de imagens, tags e bytes para Informações, incluindo ocultas como hoje; não calculá-lo sobre o lote parcial.
- Tags/sugestões continuam globais ao escopo atual, nunca derivadas apenas dos cartões carregados. `/api/tags` pode continuar pequeno e independente, sem bloquear as primeiras imagens. Preservar as contagens do escopo oculto e dos refinamentos existentes.
- Preencher dimensões legadas somente dos registros solicitados, mantendo leituras limitadas e persistência. Não varrer o legado inteiro na primeira resposta.

### Demais consumidores do catálogo completo

- **Explore:** selecionar no servidor até oito candidatas usando a regra de `rediscovery.ts` (prioridade para antigas, exclusão preferencial do lote anterior e fallback). Buscar os registros completos somente da seleção. Preservar IDs/ordem do lote na sessão e o comportamento atual de reload/lote perdido.
- **Pastas:** entregar grupos com contagem, capa estável e até três previews, calculados sobre todas as imagens elegíveis. Preservar ordenação, busca por nome de pasta e agrupamento de pastas de imagem única de 033. Começar retornando o diretório completo com previews limitados, mantendo montagem em lotes de 30; paginar o diretório no servidor apenas se a medição justificar o custo adicional. Remover o agrupamento duplicado do catálogo no cliente.
- **Detalhe/relacionadas:** obter uma imagem por ID sem exigir que seus lotes anteriores estejam carregados. Consultar relacionadas por tags sobre o escopo completo, preservando ranking, deduplicação e fallback; continuar usando a API existente de similaridade. Registros de similares não podem depender de já estarem no catálogo local para aparecer. Revalidar visibilidade/existência no servidor.
- **Anterior/próxima:** consultar vizinhos segundo os critérios e a ordenação do destino, inclusive além da borda do lote. Explore mantém sua ordem finita; similares e conteúdo preservam a ordem das APIs próprias. Não usar o cache parcial como limite da coleção.

**Aceite:** busca encontra uma imagem que nunca foi carregada; primeira tela recebe no máximo um lote; Explore não baixa o catálogo; diretório e relacionadas refletem todo o escopo; resumo global permanece correto. Testar datas empatadas, fim da lista, cursor inválido e ocultas.

## 4. Integrar lotes à interface e limitar a montagem inicial

- Em `LibraryApp.vue`, separar resultados ordenados do destino de registros conhecidos por ID. Usar um composable específico para listagem caso necessário; preservar `useLibraryNavigation` como fonte de destino/histórico. Não interpretar registros conhecidos como biblioteca completa.
- Buscar o lote inicial imediatamente; carregar tags e resumo de forma independente. Cancelar ou ignorar respostas de critérios anteriores ao mudar busca, tags, assunto ou ocultas. Debounce curto da busca textual (ponto inicial: 200 ms), sem alterar o submit explícito da busca por conteúdo.
- Em `GalleryGrid.vue`, montar somente lotes disponíveis. Sentinel carrega o próximo lote, com botão acessível equivalente. Distinguir carregamento inicial de carregamento adicional; falha de lote conserva cartões e oferece retry. Deduplicar IDs, impedir solicitações simultâneas do mesmo cursor e encerrar ao chegar ao fim.
- Corrigir a redistribuição causada por CSS columns antes de liberar append: manter colunas explícitas com atribuição estável dos novos cartões pela altura estimada usando dimensões. Recalcular no breakpoint, preservando âncora visual. Validar ordem de leitura e foco; não aceitar salto dos cartões já vistos como custo do carregamento incremental. Manter o aspecto e os espaçamentos definidos em DESIGN.md.
- Guardar profundidade carregada, âncora do cartão e contexto no mecanismo existente de histórico. No retorno/reload, recuperar os lotes necessários antes de restaurar scroll/foco; abortar restauração se houver nova navegação e limitar pela disponibilidade real dos resultados.
- Após upload, exclusão, ocultação, tags ou resolução de duplicatas, atualizar o registro afetado e invalidar resultados/resumos pertinentes. Recarregar o destino preservando âncora quando a ordenação/membership mudar; não ressuscitar dados de requisições antigas. Em sessão longa, documentar consistência eventual entre páginas, sem snapshot persistente do banco.
- Manter a seleção explícita por IDs ao carregar mais. **Selecionar todas** conserva o escopo completo do filtro: obter IDs elegíveis sob demanda, sem montar cartões nem baixar originais, e respeitar os limites atuais do endpoint de alteração em lote. Não redefinir silenciosamente a ação como selecionar apenas o lote visível.
- Descartar dados privados e cancelar cargas no logout usando o mecanismo de acesso existente. Não criar cache persistente de metadados no browser nesta entrega.

**Aceite:** primeira montagem limitada a 60 cartões; rolagem adicional sem duplicatas ou saltos de cartões existentes; busca e seleção globais; links diretos e retorno a cartão profundo funcionam; tags lentas não impedem as primeiras imagens; troca rápida de filtros não mistura resultados.

Lotes limitam a montagem inicial, não o DOM depois de percorrer todo o acervo. Virtualização fica condicionada a tarefas longas/memória ainda problemáticas no ensaio de rolagem completa, evitando adicioná-la antecipadamente.

## 5. Rever cache privado com revalidação obrigatória

Executar isoladamente, depois das entregas anteriores, atualizando a documentação de acesso de 026. A proposta permite armazenamento local de imagens privadas; isso muda o contrato atual de `no-store` e precisa ficar explícito na revisão da entrega.

- Candidata: `Cache-Control: private, no-cache` somente para respostas bem-sucedidas de miniaturas e originais privados. Manter metadados, autenticação, erros e redirects de fallback com `no-store`; manter a política de links públicos fora desta mudança.
- Preservar autenticação antes de consultar/retornar 304 e o validador específico de cada conteúdo. Não usar `public`, `immutable` ou max-age longo para imagens privadas.
- Testar no navegador e por HTTP primeira entrega 200, revisita com revalidação/304 sem corpo, sessão expirada, logout, revogação, exclusão, troca de sessão e histórico/back-forward cache. Verificar também que caches compartilhados não armazenam as respostas.
- Documentar que cópias locais já entregues não são revogáveis retroativamente. Se o contrato de privacidade exigir impedir armazenamento local, manter `no-store` e registrar o ganho de cache como deliberadamente não aplicado.

**Aceite:** revisitas autenticadas reduzem bytes; requisição sem sessão nunca recebe conteúdo nem 304; interface não restaura catálogo privado após logout. Falha nesses critérios bloqueia a alteração do cache, sem impedir as outras melhorias.

## 6. Ajustar geração de miniaturas apenas com evidência

- Medir fila fria com imagens representativas e erros, separando espera em fila, execução, tamanho gerado e fallback. A política inicial continua em um decoder por vez.
- Se a fila causar atraso relevante, experimentar concorrência máxima de dois processos no ambiente isolado, medindo RSS total, CPU e latência das demais rotas. Aumentar somente se houver ganho sem pressão de memória no servidor alvo.
- Se falhas repetidas forem relevantes, melhorar cooldown/cancelamento de trabalhos ainda não iniciados e testar a recuperação. Não cancelar um trabalho compartilhado enquanto existir consumidor ativo; requisições encerradas não devem deixar arquivos parciais servíveis.
- Medir nitidez e bytes em cartões DPR 1/2/3 antes de propor variantes de tamanho. Manter WebP 640/Q82 nesta rodada, salvo deficiência demonstrada. Preservar animação no original, transparência, orientação, hash e versão dos derivados.

**Aceite:** falhas não criam geração repetitiva, pedidos iguais compartilham trabalho e respostas interrompidas liberam recursos. Sem regeneração integral ou preparo automático no startup.

## Validação e ordem de entrega

Entregas independentes: (1) linha de base, já medida no acervo real; (1b) compressão de JSON; (2) prévia, com ativação condicionada à reprodução; (3+4) consultas limitadas com migração completa dos consumidores; (5) cache; (6) geração, se justificada. Consultas e frontend podem ser desenvolvidos em passos, mas não liberar uma interface parcialmente migrada. Cada entrega deve ter comparação com a linha de base e revisão de escopo.

Testes automatizados devem cobrir os contratos novos e riscos reais: paginação/ordenação, semântica de busca, seleção global, escopos ocultos, resumo, mutações entre páginas, respostas atrasadas e autorização antes de 304. Reutilizar suítes existentes de navegação, viewer-history, rediscovery, tags, assets, acesso e miniaturas. Rodar `npm test`, `npm run build` e `git diff --check` nas entregas de código.

Smoke de navegador: Library, Explore, pastas, assunto, ocultas, conteúdo, similares e duplicatas; adicionar imagem; selecionar resultados além do primeiro lote; editar tags; excluir/ocultar; abrir link direto; atravessar borda de lote no detalhe; retornar a cartão profundo; teclado, zoom 200%, larguras 320/390/768/1440 e scroll/foco sob a navegação fixa. Validar rede lenta, erro/retry e troca de destino durante requests. Simulação móvel não substitui teste em aparelho real.

Critérios estruturais obrigatórios: nenhuma chamada de catálogo completo no startup; primeira montagem limitada; seleção e resultados completos independentemente da rolagem; prévia durante download lento; nenhum afrouxamento de acesso. Metas numéricas de tempo/bytes serão fixadas com a linha de base, sem prometer ganhos ainda não medidos.

Releases e deploy ficam separados da elaboração deste plano. Quando houver entrega, validar em ambiente isolado antes de atualizar produção; preservar banco/originais e possibilidade de rollback. Não alterar Compose ou sua referência de imagem nesta tarefa.
