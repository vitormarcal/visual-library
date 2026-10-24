# Implementação

Reutilizar o pacote de runtime existente, SigLIP2 q8/revisão/preprocessamento da avaliação 024 e o fingerprint atual. Arquivos de produção sob `runtime/similarity/semantic-*`; nenhum import de `tools/` no aplicativo. Política/vetores compartilhados com o harness, sem dependências novas ou pesos na imagem Docker.

Tabela `image_semantic_vectors` separada de DINOv2, chave imagem/fingerprint, hash-fonte e ready/failed com vetor JSON. Inicialização compatível com SQLite atual e exclusão junto do registro. Originais/tags não mudam. Arquivo `data/semantic/enabled` registra a ativação explícita; `data/semantic/models` guarda os pesos. Sem download ou índice no startup antes de ativar.

Um child semântico por processo web recebe preparo/consulta por IPC serializado. Preparo lê só visíveis pendentes, verifica hash/path e revalida existência/visibilidade ao gravar. Falha de arquivo é isolada, falha de modelo pausa por 60 s com retry explícito. Ao concluir imagem, descarrega visão e prepara tokenizer/texto para evitar download durante a primeira consulta pronta. Texto permanece aquecido por no máximo 60 s ocioso; encerra e libera memória. Requisições de texto têm limite de concorrência, timeout e pequeno cache de vetores em memória; nenhum histórico persistido. Descritores e modelos permanecem no volume. Heap JS não é limite total de memória nativa.

Hook independente acompanha ativação persistida no startup e após uploads/assets/share/visibilidade; usa coalescência e não interfere no worker DINOv2. A preparação é independente da resposta de captura. Dois modelos diferentes podem concorrer no host; validar limite em contêiner e documentar orçamento antes de produção.

API: GET `/api/search/content/status`, POST `/api/search/content/prepare` (retry explícito) e POST `/api/search/content` com query/tagIds. Respostas privadas no-store, validação de texto (500 caracteres) e até três filtros. Read de candidatos após obter o vetor textual para revalidar mudanças durante a inferência. Filtros antes de ranking, até 24, empates por ID. Sem paginação ou limiar calibrado nesta primeira entrega. Sem escores expostos. Falhas/missing weights não viram biblioteca vazia.

URL `mode=content` somente na Library visível; q representa consulta submetida, draft local separado. Modo normal continua incremental por tecla. Composable guarda sessões por query/filtros, evita corridas, consulta status durante preparo e congela resultados até nova busca/refresh. Edits/ocultação/exclusão são refletidos sem reposição silenciosa. Reutilizar GalleryGrid/ProgressiveImage/LightboxViewer e tags existentes; controle neutro no componente de busca, sem nova tela ou painel de infraestrutura.

Testes de contratos, migração, worker/IPC/cooldown, visibilidade, exclusão, filtro antes do top K e regressão de URL. Inferência real isolada sem rede com cache já autorizado; sem indexar produção. Build Nuxt/Docker e smoke desktop/mobile, submit/typing, retry, retorno, tags, upload e refresh. Não aumentar versão ou publicar implantação sem pedido específico.

## Validação

- `npm test`: 64 testes aprovados, incluindo rotas reais/SQLite/IPC com worker controlado, ativação explícita, filtros antes do top 24, mudanças durante inferência, retry e captura independente de falha.
- Harness experimental: 17 testes aprovados após compartilhar a política de vetores com o runtime; fingerprint preservado.
- Build Nuxt e imagem Docker concluídos. Nenhuma dependência nova ou peso incluído na imagem.
- Navegador Chromium desktop 1440×900 e mobile 390×844: envio explícito, navegação/fechamento estáveis, tags, corrida lenta/rápida e A→B→A, reload, ocultos, regressão lexical e exclusão sem reposição. Sem erros JS ou overflow horizontal. Fixtures sintéticas e screenshots fora do repositório.
- Runtime nativo com SigLIP2 real e pesos locais, sem baixar novos modelos: três imagens sintéticas preparadas, um arquivo inválido isolado, consulta em português e hashes dos originais preservados.
- Contêiner final sem rede, dois CPUs/2 GiB: inferência real, persistência/reinício, captura incremental e hashes dos originais aprovados. Worker semântico ausente após 62 s sem trabalhos. Amostras de memória do contêiner: 882,5 MiB após primeira consulta e 23,26 MiB após encerrar o worker; não são medições de pico nem teste conjunto com DINOv2. Pesos previamente cacheados montados somente leitura; nenhum download.

Não houve deploy, alteração de versão nem indexação do acervo real nesta implementação. A avaliação 024 continua sendo a evidência de qualidade; os testes sintéticos desta entrega verificam integração, não relevância. Concorrência de memória com o preparo DINOv2 não foi medida; a documentação não presume um orçamento conjunto de 2 GiB.

## Retorno inicial de uso — 0.14.0

Em 2026-10-24, após testar a interface, o usuário considerou o resultado “razoável” e relatou encontrar imagens por objetos, personagens e características: espada, revólver, guerreira, bunda, nua, loira e carro. Relatou resultados tanto com consultas em português quanto em inglês. Este registro se baseia no relato do usuário; não houve nova inspeção do acervo ou coleta de consultas, imagens e posições individuais pelo agente.

O retorno indica utilidade percebida na busca por conteúdo no acervo pessoal. Não constitui avaliação formal de precisão, comparação controlada entre idiomas, comprovação de acerto em todas as consultas ou medição de tempo economizado. Os problemas de ordenação documentados em 024 continuam relevantes.

Manter o modo opcional e experimental e a busca por tags/nome como padrão. Observar o uso cotidiano antes de ajustar o modelo ou ampliar controles; ainda falta confirmar se os primeiros resultados ajudam consistentemente a reencontrar a imagem desejada com menos esforço. Este registro não altera o escopo nem autoriza novos modelos ou processamento do acervo.
