# Plano técnico: Explorar por tags

Status: implementado após pedido de continuidade do usuário em 2026-10-04. Escopo: [spec.md](spec.md). Validação registrada abaixo.

## 1. Persistir a identidade visual das tags

Adicionar `cover_image_id TEXT` à tabela `tags`, seguindo a migração aditiva existente com PRAGMA table_info. Não alterar arquivos de imagem, IDs ou associações atuais. Não usar localStorage: a capa pertence ao acervo local e deve ser igual em diferentes navegadores.

Criar uma função específica em server/db.ts para reconciliar capas de tags afetadas:

- Manter uma capa se sua imagem existir e continuar associada à tag.
- Para uma tag sem capa válida, escolher um integrante de forma determinística: associação mais antiga, depois data da imagem e ID para desempate.
- Se não houver integrantes, limpar a referência. A tag pode continuar no banco; listTagSummaries já omite tags sem associações.
- Fazer o preenchimento inicial das capas existentes ao inicializar o banco e após adicionar a coluna. Reexecutar a inicialização não deve trocar capas válidas.

A escolha inicial determinística não substitui a persistência: associar depois uma imagem antiga não pode alterar uma capa válida.

Executar reconciliação dentro das transações de replaceImageTags e addTagsToImages, após concluir as associações. Em replaceImageTags, reconciliar a união das tags anteriores e novas apenas ao final, pois a função remove e reinsere associações inclusive de tags que permanecem. Uma falha deve reverter associações e capas juntas.

Na exclusão de imagem, coletar tags afetadas, remover associações/imagem e reconciliar capas numa transação curta. Manter unlink fora da transação e preservar o comportamento de remoção de arquivo existente. Evitar novo serviço, tabela de coleções ou sistema genérico de migrações.

Estender a resposta de /api/tags com coverImageId. Manter campos e ordenação atuais para não mudar sugestões da biblioteca. A ordem alfabética de Explorar será aplicada no cliente. Não criar endpoint de escolha de capa.

## 2. Construir os assuntos a partir do acervo carregado

Criar app/utils/tag-exploration.ts com lógica específica de agrupamento, pesquisa e ordenação. Reutilizar normalizeSearch. Comparação de identidade continua exata por ID/normalizedName; normalização de busca não une tags distintas com acentos diferentes.

Construir grupos a partir de images, calculando integrantes e contagem atual; usar coverImageId vindo das tags para resolver a capa. Assim, contagens e pertencimento acompanham alterações locais imediatamente. Ordenar por nome com desempate estável por identidade.

Não escolher uma capa nova no cliente quando o servidor estiver temporariamente indisponível. Se a referência estiver desatualizada enquanto loadTags conclui, mostrar superfície neutra com identificação legível até chegar a capa persistida. Uma falha de imagem preserva sua referência.

Preservar o último resultado válido de tags em caso de falha de atualização; não substituir silenciosamente por []. Expor estado de erro/repetição de carregamento para falhas iniciais. Versionar requisições de tags para que uma resposta antiga não sobrescreva uma mais recente após edições. O agrupamento local evita contagens antigas mesmo antes da resposta.

## 3. Separar três contextos explícitos no app.vue

Usar uma identificação de tela simples: library, explore ou subject. Manter estruturas específicas, sem roteador novo ou gerenciador genérico de navegação:

- Biblioteca: query, filtros, posição de rolagem e alvo de foco.
- Explorar: busca de assuntos, posição e cartão de origem.
- Assunto: tag base, query e filtros adicionais, criados vazios a cada entrada por cartão.

Derivar a busca/filtros da galeria atual por computed, conservando o estado independente da biblioteca. A tag base é aplicada junto aos filtros adicionais; entra no limite total de três e não pode ser removida pelo botão de limpar refinamentos. Os filtros guardados da biblioteca são reconciliados com tags ainda existentes sem descartar o restante da busca.

Centralizar transições concretas (abrir Explorar, abrir assunto, voltar a Explorar, voltar à biblioteca). Antes de sair da galeria, terminar seleção temporária e limpar avisos próprios desse contexto. Impedir transição durante applyingTags, mantendo guardas além do estado disabled dos controles. Upload não impede trocar de contexto.

Manter SaveDropzone montado fora das seções condicionais, com upload/resultados no app.vue. Entrar em um assunto não atribui tags a novos uploads.

Se a tag base perder todos os integrantes, manter seu identificador/nome na tela e mostrar vazio contextual; não voltar automaticamente. Tags extras desaparecidas podem ser removidas conforme comportamento existente. Não remover silenciosamente a tag base.

## 4. Compor a interface

Adicionar TagExploreGrid.vue e seu CSS Module para busca por assuntos e cartões. Reutilizar os tokens, breakpoints e ritmo de GalleryGrid, sem introduzir uma abstração compartilhada apenas para reaproveitar poucas regras CSS.

- Um botão nativo por cartão, com data-explore-tag-id, imagem lazy e nome acessível incluindo nome/contagem.
- Etiqueta neutra baseada em pin-overlay-pill, sempre visível e com quebra de nomes longos. Sem truncamento obrigatório, gradiente ou ações extras.
- Capas em proporção natural, radius16 e espaçamento8. Reservar espaço neutro legível para imagens ausentes/com erro; texto deve continuar dentro do cartão mesmo com capas muito baixas.
- Pesquisa de assuntos com nome acessível e controle de limpar; loading, erro inicial, nenhum assunto e nenhuma correspondência são estados distintos.
- Acesso discreto Library / Explore seguindo o idioma inglês já usado pela interface, com estado atual identificável e controles de44px.
- Assunto com título, total ou resultados/total e Back to Explore, sem acrescentar controles fixos no visualizador.

Estender GalleryTagFilters.vue com contexto de tag base explícito: excluir a base das sugestões, contar a base no limite de seleção e deixar clear/remove agir apenas nos extras. Ajustar a regra atual que limpa a query antes de emitir select: ela só pode limpar quando a seleção for realmente aceita.

Reutilizar GalleryGrid e LightboxViewer. Setas seguem a galeria atual e relacionadas continuam globais. Uma tag escolhida no viewer é aplicada como refinamento; escolher a base já presente é operação sem duplicação. O limite recusado mantém o visualizador e mostra o aviso existente.

## 5. Preservar rolagem e foco

Guardar window.scrollY e identificadores estáveis ao sair da biblioteca ou de Explorar. Entrar num assunto começa no início do seu conteúdo e focaliza seu título após nextTick, sem interferir no upload.

No retorno, montar o contexto, aguardar nextTick, restaurar posição válida e focalizar a origem com preventScroll. Se o cartão/imagem não existir, usar o campo de busca correspondente. Não misturar essa restauração com viewer-history.ts, cujo histórico pertence exclusivamente às conexões no visualizador.

Para capas lazy, guardar dimensões já carregadas no componente pai durante a sessão e reservá-las ao remontar. Corrigir deslocamentos de layout por um intervalo curto e limitado, cancelando na próxima transição ou na primeira interação do usuário. Implementar apenas o necessário para a restauração verificável, tomando o comportamento existente do viewer como referência.

Toda tarefa assíncrona de restauração recebe uma versão de transição; respostas antigas não podem mover foco/rolagem numa tela nova. Mudanças de contagens não movem foco. Não gravar contextos em storage nem prometer restauração após reload.

## 6. Validação

Testes de SQLite em processo separado e diretório temporário, seguindo bulk-tagging.test.ts:

- Migração de biblioteca sem cover_image_id, preenchimento inicial e estabilidade após reabrir o banco.
- Tag com capa válida mantém escolha após nova imagem ou associação de imagem antiga.
- Edição individual que conserva a tag não troca a capa ao remover/reinserir associações.
- Remoção da associação da capa, exclusão da imagem, tag vazia e reativação geram referências válidas.
- Falha de adição/edição em lote reverte capas junto com associações.

Testar regras de agrupamento/pesquisa: contagem sem duplicação, tags exatas distintas, busca sem acentos, ordenação e capa ausente sem substituição indevida. Não escrever testes que apenas espelhem classes ou markup.

Browser com produção e acervo isolado, sem tocar nos dados reais:

- Biblioteca com query + filtros → Explorar com busca/rolagem → assunto completo → refinamentos → viewer/relacionadas → retorno às três origens.
- Limite de três incluindo base, limpar extras sem perder assunto, seleção descartada na saída e troca bloqueada durante save de tags.
- Upload durante navegação, chegada tardia de /api/tags, falha inicial de carregamento e repetição sem inventar estado vazio.
- Remover capa, última imagem do assunto e cartão de origem; falha temporária da imagem não altera escolha persistida.
- Cartões com nomes de48 caracteres, imagens baixas/altas, foco real com teclado, Tab/Enter/Escape, retorno com lazy loading e cancelamento de restauração por interação.
- 320/390px, tablet e desktop; medir alvos44px, overflow e espaço inalterado da imagem no viewer. Inspecionar screenshots.

Executar npm test, npm run build e git diff --check. Registrar resultados efetivos; testes planejados não equivalem a validação. Touch físico e reconhecimento das capas no acervo real permanecem avaliações separadas.

## Entrega

Implementar persistência/estabilidade das capas, diretório, galeria por assunto e retorno como uma entrega coerente. Atualizar descoberta/spec com resultado, BACKLOG.md com implementação e limites, e referências005/006/010 quando o comportamento de filtros mudar.

Sem incremento de versão, commit ou push automático desta etapa: realizar quando solicitado no fluxo de entrega. Sem novas dependências, perfis, coleções ou rotas persistentes.

## Validação da implementação — 2026-10-04

- npm test: 26 testes passaram. Novos testes verificam migração com e sem associações existentes, persistência após reabertura, manutenção de capa após associar imagem antiga ou substituir tags, substituição/limpeza após remoções, reativação e rollback de capas junto com alterações individuais/em lote.
- Testes de agrupamento verificam identidade exata, contagem única, busca sem acentos, ordem alfabética e ausência de substituição local de capa inválida.
- npm run build passou. Permanecem os avisos existentes de sourcemap e externalização de node:sqlite.
- Chrome headless com biblioteca SQLite e imagens sintéticas isoladas validou busca/filtros independentes nos três contextos, limite de três incluindo base, limpar sem perder o assunto, excursões globais no viewer e retorno à origem.
- Validou retorno ao cartão com busca, foco e rolagem profunda preservados, cancelamento da correção de rolagem ao interagir, título focalizado por ativação real de teclado e foco de fallback quando o cartão desaparece.
- Uma verificação adicional confirmou retorno à rolagem profunda da biblioteca independente do diretório. Capturas do viewport em 390px e 1280px foram revisadas após o build final.
- Verificou capas persistidas após reload, troca após edição no viewer, exclusão da última imagem mantendo o assunto vazio e saída clara para Explorar.
- Verificou seleção em lote descartada ao mudar de galeria e navegação bloqueada durante POST de tags. Novas tags aparecem como assuntos após o salvamento.
- Upload mantido enquanto alterna entre telas, sem atribuir automaticamente a tag do assunto. Resposta antiga de /api/tags após uma edição posterior não substitui a capa mais recente confirmada.
- Falhas iniciais de biblioteca/tags oferecem retry e não se confundem com acervo sem tags. Falha temporária de capa mantém identificação e não altera sua referência persistida.
- Em 320/390px, tablet e desktop, controles têm alvos de pelo menos 44px, nomes longos permanecem dentro dos cartões e não há overflow horizontal. Capturas de desktop/celular foram inspecionadas.
- Nenhuma exceção JavaScript não tratada nos cenários do navegador. Nenhum teste altera os dados reais da biblioteca; nenhuma dependência foi adicionada.

Capas ficam persistidas em tags.cover_image_id; posições, buscas e dimensões de capas ficam apenas na sessão. A restauração corrige mudanças de layout por até dois segundos e é cancelada por interação. Touch físico, anúncios em leitor de tela e reconhecimento visual com o acervo real ainda precisam de avaliação manual. Endereços persistentes e histórico completo do navegador continuam na etapa 2.

### Revisão da etiqueta após feedback visual

Substituído o bloco de duas linhas pela identificação compacta “nome · quantidade”, com contagem secundária, mantendo padding, raio e tipografia de pin-overlay-pill. A altura de nomes curtos passou de aproximadamente 52px para 27px. O nome acessível do cartão mantém a quantidade por extenso. Build e git diff --check passaram; Chrome verificou a etiqueta compacta, nomes de 48 caracteres dentro dos cartões e ausência de overflow em 320/390/768/1280px. Captura do viewport em 390px foi inspecionada.
