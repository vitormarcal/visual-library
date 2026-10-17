# Plano: similaridade visual

Direção aprovada pelo pedido “prossiga” em 2026-10-17, após consolidação da spec. Entrega incremental: primeiro validar qualidade e custo com um experimento concreto; integrar a galeria depois de avaliar os resultados. Não publicar nem modificar serviços em produção nesta etapa.

## 1. Experimento independente

Criar `tools/visual-similarity/` com dependências próprias e lockfile, sem acrescentar o runtime de inferência ao deploy Nuxt antes da validação. Usar Node, Transformers.js, DINOv2 small quantizado em CPU e sharp para leitura limitada e miniaturas. É um candidato inicial, não uma escolha validada de qualidade.

Ler SQLite com `readOnly: true` e selecionar até 100 imagens visíveis distribuídas pela ordem temporal. Validar nomes de arquivos provenientes do banco, decodificar somente um frame de animações, respeitar orientação e limitar pixels. Processar sequencialmente, com no máximo duas threads para inferência. Falhas individuais não interrompem o relatório e ficam registradas.

Guardar somente derivados fora do acervo: descritores, miniaturas locais, relatório HTML e métricas JSON. Cachear descritores por hash dos bytes e versão do método; alterações de arquivo invalidam o cache. Não registrar tags nos resultados nem enviá-las ao modelo. O download do modelo não envia imagens a terceiros; a inferência é local.

Comparar três rankings nos 12 primeiros resultados de até 20 referências: embedding isolado, histograma de cores isolado e combinação de embedding com cores globais/espaciais. A combinação é uma hipótese explícita com pesos internos fixos, para testar aparência em conjunto; não será apresentada como algoritmo validado nem como configuração do produto.

Relatório autocontido com miniaturas relativas, controles simples para percorrer referências, rótulos claros dos métodos e identificação das limitações da amostra. Escapar textos e não incluir caminhos do servidor. Persistir métricas de download/carregamento, processamento por imagem, memória RSS máxima, cache e consultas. Separar primeira execução e execução com cache.

## 2. Medição no Mordor

Executar em contêiner temporário com volume do Visual Library somente para leitura, saída em diretório temporário separado, dois CPUs e limite de 3 GiB de memória. Dependências/modelo ficam no experimento. Não reiniciar ou reconfigurar o Visual Library, não alterar tags/banco/originais e não construir imagem de produção.

Registrar tamanho e cobertura do acervo/amostra, sucessos, falhas, duração e memória. Verificar um endpoint usual antes/depois e durante o lote, sem interpretar essa amostragem como teste completo de carga. Usar limites de recursos como garantia de isolamento, sem prometer ausência absoluta de impacto nos demais serviços.

## 3. Método selecionado após avaliação do usuário

O usuário indicou: “acho que a paleta se aproximou mais”. Selecionado o método de paleta isolada para o MVP. Essa preferência substitui o critério inicial de composição/objetos descrito abaixo.

Preservar o histograma RGB de 64 posições, normalizado após raiz quadrada, e comparação por produto escalar usados na coluna “Paleta isolada”. Reutilizar orientação, fundo branco para transparência e amostragem do protótipo. Nenhum modelo, download de pesos ou runtime ONNX é necessário para esse ranking. O decoder sharp ainda precisa ser integrado e validado no Docker Alpine; o benchmark Debian não comprova essa compatibilidade. Detalhar preparo, persistência e navegação antes de modificar a aplicação.

### Critério original do experimento

Revisar o relatório com o usuário: os primeiros resultados devem apresentar proximidade útil de composição, enquadramento e paleta, sem depender apenas de assunto ou cor. Identificar exemplos ruins e cobertura de formatos. O relatório permite essa avaliação; testes automatizados não determinam valor estético.

Se a amostra não oferecer referências variadas suficientes, registrar a limitação e ampliar a amostra antes de decidir. Se resultados forem insuficientes, ajustar o experimento antes de integrar o método à aplicação.

Depois dessa avaliação, detalhar nesta seção a integração do método escolhido: derivados persistidos em SQLite, preparo incremental fora da resposta de upload, consulta paginada estável no servidor, destino `similar` com referência no endereço, e reuso de GalleryGrid/LightboxViewer. Dimensionar rotina de preparo e compatibilidade de runtime com a evidência coletada. Não criar infraestrutura genérica, banco vetorial ou serviço externo por antecipação.

## Validação da etapa experimental

Testes de ranking com vetores conhecidos, exclusão da referência, empates determinísticos, influência espacial, validação de descritores e amostragem. Smoke real de inferência e cache, relatório com miniaturas, isolamento de leitura e falha individual. Executar testes existentes e `git diff --check`; build de Nuxt só será necessário se houver alteração na aplicação ou em suas dependências.

## Resultados da etapa experimental — 2026-10-17

Implementado em `tools/visual-similarity/`: CLI somente de leitura, dependências/lockfile independentes, revisão fixada do modelo, extração DINOv2 CLS normalizada, paleta e cores em grade 4 × 4, cache invalidado por conteúdo/método, miniaturas e relatório HTML de comparação. Nenhuma dependência ou código da aplicação Nuxt foi alterado.

Execução no Mordor com imagem `node:26-bookworm-slim`, dois CPUs, limite de 3 GiB sem swap adicional e volume do acervo `:ro`. Amostra temporal de 100 entre 538 imagens visíveis; 20 referências, 12 candidatos por método, 720 cartões no relatório. Não houve seleção por tags ou garantia de diversidade visual.

| Medida | Primeiro lote válido | Reexecução com descritores em cache |
| --- | --- | --- |
| Sucessos / falhas | 100 / 0 | 100 / 0 |
| Novos descritores / reutilizados | 100 / 0 | 0 / 100 |
| Tempo total da ferramenta | 9.534 ms | 3.591 ms |
| Carregamento do modelo | 469 ms | dispensado |
| Pico RSS do processo | 287 MiB | 237,9 MiB |
| 60 rankings em memória (20 × 3) | 35,13 ms | 65,24 ms |

O modelo já estava baixado no primeiro lote válido. A tentativa inicial levou cerca de 28 segundos carregando/baixando o modelo, mas falhou por solicitar `pooler_output`, ausente nesse export. Corrigida a extração do primeiro token global (CLS), com teste de formato e seleção do token. Não somar a medição de download dessa tentativa a um benchmark válido nem interpretar 9,5 segundos como instalação fria completa.

Uma amostra de `docker stats` durante o lote registrou aproximadamente 196 MiB e 182% de CPU; não é o pico do contêiner. O endpoint `/api/tags` respondeu 200 em 72 ms antes, 74 ms durante e 63 ms depois. São três observações pontuais, não teste de carga ou garantia de ausência de impacto.

Validações:

- Seis testes próprios passaram localmente; também executados no Mordor antes do lote. Cobrem CLS, ranking/empates/exclusão, posição de cores, amostragem, escape de HTML e CLI com acervo temporário incluindo oculto, arquivo inválido e caminho inadequado. SQLite e original temporários permaneceram byte a byte iguais. Reforço posterior impede criar diretório de saída dentro do acervo antes da validação; os seis testes passaram novamente localmente com esse caso.
- Os 46 testes existentes do projeto passaram. `git diff --check` passou. Build Nuxt não executado: aplicação, seu lockfile e dependências não foram modificados.
- Chrome headless/CDP em 1440 × 1100 e 390 × 844: 20 seções e 720 cartões, sem overflow horizontal, zero imagens quebradas entre as carregadas, miniaturas por proximidade da tela. Foram verificadas áreas das referências 1 e 8, não todas as referências ou todas as interações assistivas.
- Inspeção visual inicial mostra aproximações úteis em ilustração e fotografia de retrato, mas não estabelece qualidade geral nem superioridade consistente da combinação sobre o embedding. Avaliação do usuário pendente.

Artefatos privados, ignorados pelo Git: `tools/visual-similarity/artifacts/mordor-100/index.html`, `thumbs/`, `results.json`, `metrics-first.json` e `metrics.json`. No Mordor, experimento/cache em `/tmp/visual-library-similarity.jIjxuC`; contêineres de inferência temporários removidos automaticamente. Nenhum serviço do produto foi reiniciado ou publicado. O diretório temporário e a imagem Node baixada permanecem disponíveis para reprodução.

Limites: consulta medida somente em 100 candidatos e em memória; tempo do cache ainda inclui releitura, decodificação e geração das miniaturas do relatório. Não estima latência HTTP ou custo do acervo inteiro. O preprocessamento padrão do modelo usa recorte central; a grade de cores considera a imagem inteira, mas não constitui entendimento de pose ou geometria. Formatos/arquivos fora da amostra ainda precisam de validação na integração. A aplicação continua com Docker Alpine, cuja compatibilidade com o runtime escolhido não foi validada nesta etapa.

O retorno posterior do usuário selecionou paleta isolada. Próxima etapa: detalhar e implementar sua integração à galeria. A medição de 9,5 s/287 MiB acima pertence ao experimento com embeddings, não ao futuro runtime só de paleta. Feature completa ainda não entregue.

## Segunda rodada solicitada: parâmetros de embedding e combinação

O usuário pediu comparar novos parâmetros antes de encerrar a escolha. Mantidos modelo, revisão, quantização, normalização e extração de cores do primeiro experimento. Cinco variantes acrescentadas aos três controles:

| Método | Extração do embedding | Pesos embedding/paleta/posição |
| --- | --- | --- |
| Embedding médio | Média dos patches, sem CLS, recorte central original | 100/0/0 |
| Embedding da imagem inteira | Média dos patches, imagem completa ajustada a 224 × 224 | 100/0/0 |
| Combinação com mais cor e CLS | CLS original | 20/65/15 |
| Combinação intermediária | Média da imagem inteira | 40/45/15 |
| Combinação com mais cor e imagem inteira | Média da imagem inteira | 20/65/15 |

A imagem inteira é ajustada a quadrado e pode sofrer distorção de proporções; o relatório deixa essa limitação explícita. Não houve treinamento nem mudança dos pesos do modelo. Pooling e pré-processamento são hipóteses experimentais. A paleta não foi recalculada com outro método.

Adicionados `--variants`, `--baseline` e `--offline`. A base congela as mesmas 100 imagens e 20 referências do primeiro relatório, valida seus hashes, rejeita desaparecimento/ocultação e compara os controles sem usar tags. Isso foi necessário porque o acervo visível cresceu para 702 no instante da seleção desta execução. Novas imagens não entraram na comparação.

Execução válida no Mordor: volume do acervo e cache de modelos somente para leitura, contêiner sem rede, dois CPUs e 3 GiB de limite. Foram processadas 100 imagens, zero falhas, em 16.122 ms, com 303 MiB de pico RSS. Carregamento local do modelo: 187 ms; processamento: 15.829 ms; 160 rankings em memória: 105,12 ms. Não inclui instalação ou download. Os controles de paleta, embedding CLS e combinação original repetiram exatamente a ordem dos 12 resultados em 20/20 referências cada.

As cinco variantes alteraram a ordem dos resultados em todas as 20 referências em relação ao respectivo controle (embedding ou combinação). A combinação original tinha em média 4,7 resultados em comum com o top 12 da paleta; as variantes com 65% de paleta passaram a 9,55 (CLS) e 9,8 (imagem inteira). Isso demonstra a influência das cores, não qualidade estética superior. A avaliação do usuário continua necessária para decidir se o ganho compensa o modelo.

Nove testes próprios passaram localmente, cobrindo média de patches sem CLS, formato dos tensores, pesos e mudança do ranking, controles de relatório e recusa de referência oculta na base. A execução no Mordor também passou os nove testes antes do lote; os reforços posteriores de baseline/saída foram verificados localmente. Chrome/CDP em 1440 × 1100 e 390 × 844 verificou as sete opções do seletor: sempre uma variante por referência, com paleta fixa, sem overflow horizontal e sem miniaturas quebradas entre as carregadas. Não há mudanças no aplicativo Nuxt, suas dependências ou Dockerfile; não houve novo build de produção.

Relatório privado: `tools/visual-similarity/artifacts/mordor-variants/index.html`, com `thumbs/`, `results.json` e `metrics.json`, todos ignorados pelo Git. O primeiro relatório permanece em `artifacts/mordor-100/`. No Mordor a segunda saída está em `/tmp/visual-library-similarity.jIjxuC/report-variants`; os serviços do produto não foram reiniciados ou alterados. A execução inicial sem rede precisou ser corrigida para apontar explicitamente ao diretório local do modelo; só o lote válido acima foi usado como benchmark.

Próximo passo de produto: comparar as variantes com o usuário. A paleta segue como preferência provisória, sem presumir que uma variante nova seja melhor. Galeria do produto ainda não integrada.

## Integração V1 autorizada

O usuário aprovou os resultados “para uma v1”. Adotada a variante selecionada no relatório e indicada para iniciar a comparação: 20% embedding médio da imagem inteira, 65% paleta e 15% posição das cores. Essa decisão substitui a preferência provisória por paleta isolada. Não acrescentar seletor de métodos ao produto.

- Runtime específico em `runtime/similarity/`, com dependências e lockfile próprios. Processo filho único, sequencial, com duas threads ONNX e decoder limitado. Nitro inicia o preparo sem aguardá-lo e solicita nova varredura após uploads/visibilidade. Priorizar a referência solicitada; falhas de modelo suspendem o lote e oferecem retry. Cache do modelo em `data/similarity/models`, reutilizado sem rede quando completo.
- Tabela aditiva de derivados por imagem, método e hash; confirmar cada resultado somente se a imagem/hash ainda existe. Guardar sucesso/falha, sem editar originais/tags. Exclusão remove derivados na transação existente. Trabalho pendente sobrevive por consulta ao banco após restart, sem fila ou serviço genérico.
- API interna de similares com referência visível obrigatória, 24 imagens por lote e snapshot de IDs ordenados em memória, limitado a 100 sessões e 30 minutos. Filtrar novamente ocultos/excluídos em cada lote. Novos descritores não reordenam a sessão; atualizar cria um snapshot novo. Expiração oferece recuperação explícita. Estados de preparo, erro e resultados parciais identificados.
- Destino `similar` com referência no endereço; nova galeria guarda sua origem interna. Fechar o visualizador retorna à mesma galeria, e retorno da galeria recupera a origem conhecida, inclusive imagem aberta. Entrada direta retorna à Library. Contexto de similares não herda busca/tags para captura; clicar tag no viewer abre Library filtrada explicitamente.
- Reutilizar ProgressiveImage, GalleryGrid e LightboxViewer. Colunas de similares recebem cartões incrementalmente sem redistribuir os já apresentados. Busca/seleção em lote permanecem nas telas existentes. Uma ação contextual “See similar”; título “Similar images”, alinhados ao idioma atual da interface.
- Docker passa a Debian slim para runtime ONNX nativo. Stage próprio instala as dependências do processo de similaridade; imagem final contém worker/dependências e Nuxt. Não depender da ferramenta experimental ou de arquivos privados na build. Validar build e execução de inferência dentro da imagem com acervo temporário, sem substituir o contêiner de produção.
- Testes: paridade do descritor/ranking com o experimento, migração e persistência, snapshots/empates/expiração/ocultação/exclusão, HTTP, navegação/endereço e retorno. Executar suíte, build, smoke de browser em desktop/mobile e Docker isolado. Documentar primeiro download, preparo inicial e limites sem declarar deploy em produção.

## Implementação e validação da V1 — 2026-10-17

Implementada a combinação aprovada no aplicativo, mantendo a versão 0.10.0 solicitada anteriormente. `runtime/similarity/` contém o decoder/modelo e um processo concreto de preparo; dependências próprias com versões fixadas, sem importar o runtime de ML no processo web. O preparo usa a imagem inteira e as mesmas operações de amostragem/normalização do segundo experimento. O primeiro download fica em `data/similarity/models`; cache completo é aberto diretamente sem rede.

Nitro inicia o preparo depois da inicialização e após capturas/alterações de visibilidade. A API de similares também pode priorizar sua referência. Um único processo analisa imagens sequencialmente, persiste sucesso/falha por versão/hash, confirma que o registro ainda existe e continua visível, e encerra ao concluir. Falha de carregamento do modelo pausa o lote; retry permite retomar. Descritores de imagem apagada são removidos dentro da transação de exclusão existente. SQLite tem espera de lock limitada a cinco segundos; não há transações abertas durante inferência ou IO de imagem.

O servidor retorna páginas de 24 com snapshot dos IDs em ordem, limitado a 100 sessões/30 minutos. Cada página respeita novamente ocultação/exclusão. Imagens preparadas após a criação do snapshot não são acrescentadas à ordem anterior; a resposta mantém indicação de atualização disponível mesmo se o preparo terminar entre páginas. Refresh inicia um novo conjunto; expiração exige atualização explícita.

O destino `similar` guarda referência separada da imagem aberta. URLs, nova aba, reload, Voltar/Avançar e origem interna foram estendidos sem substituir as conexões por tags. Resultados usam colunas com distribuição incremental, evitando redistribuição ao carregar mais cartões. A ação **See similar** acompanha o idioma do aplicativo e fica indisponível durante edição/salvamento. Tags escolhidas a partir desse contexto abrem Library filtrada; upload nessa galeria não herda tags da referência.

Validação executada:

- **49 testes passaram**, incluindo paridade da distribuição de cores, pooling e ranking com a variante experimental selecionada; destinos válidos/inválidos; contrato HTTP com biblioteca isolada; empates, exclusão da referência, snapshots, expiração, deriva de hash, JSON derivado inválido, ocultação/exclusão e retry. As regressões existentes de uploads/assets, tags, visibilidade e migração também passaram. O último ajuste cobriu preparo concluído entre páginas sem perder a indicação de refresh.
- **Build Nuxt e build Docker concluídos**. Permanecem os avisos anteriores de sourcemap Nuxt e externalização de `node:sqlite`. A imagem final local `visual-library:similarity-v1-test` contém o processo e suas dependências em Debian slim, sem depender de `tools/` ou relatórios privados. A `.dockerignore` exclui dependências locais, ferramentas e dados pessoais do contexto.
- **Chrome/CDP, build de produção, acervo sintético de 70 imagens**: partir de Library com busca que exibe dez imagens, abrir uma imagem e entrar em similares; carregar os 69 candidatos em três páginas; comparar coordenadas dos primeiros cartões antes/depois, sem mudança de posição; abrir/fechar resultados com restauração da rolagem; trocar referência explicitamente; voltar à imagem da galeria anterior e depois ao visualizador/busca originais. Link direto, reload e Voltar/Avançar recuperaram referência/imagem e uma única camada de visualizador.
- Repetido com a build final em **1280 × 900 e 390 × 844**. Tecla Enter no novo link abriu a galeria e o ciclo de Tab permaneceu no visualizador incluindo a nova ação. Zero exceções JavaScript não tratadas e sem overflow horizontal. Conferidos visualmente galeria e espaço da imagem/controles no celular; não se declara teste em dispositivo físico ou leitor de tela.
- **Docker final, dados temporários, sem rede, dois CPUs e limite de 1 GiB**: preparar os 70 originais com modelo pré-cacheado; upload HTTP de uma imagem nova e confirmação do preparo automático consultando SQLite, sem GET de similares que pudesse dispará-lo; arquivo inválido registrado como falha e recuperado após correção/retry. Os originais de referência conservaram o hash. Recriado o contêiner com a imagem final e o mesmo volume temporário, preservando 71 descritores e retomando um removido: 72 imagens prontas. Nenhum serviço ou acervo de produção foi alterado.
- `git diff --check` e sintaxe dos módulos de runtime sem erros. Não houve commit, push ou publicação automática.

Roteiros temporários: `/tmp/visual-library-v1-seed.mjs`, `/tmp/visual-library-v1-final-browser.mjs` e `/tmp/visual-library-v1-docker-smoke.mjs`. Biblioteca de teste em `/tmp/visual-library-v1.zYmysy`, separada do acervo pessoal. Instruções de uso/build em [visual-similarity.md](../../visual-similarity.md).

Limitações deliberadas: primeiro uso exige download; imagens/animações seguem os limites do decoder/primeiro frame; as medidas anteriores de qualidade foram feitas na amostra aprovada, não em todo o acervo. O modelo não garante identidade, pose ou objetos. A biblioteca habitual ainda carrega todos os metadados, enquanto apenas os resultados de similares são paginados. Cache de sessões não sobrevive ao restart, mas referência/endereço e descritores sobrevivem. O modelo fica fora da memória quando o processo encerra; não foi estabelecido um SLA ou realizado teste completo de carga concorrente. Esta entrega prepara o código e a imagem para revisão; não substitui o contêiner do usuário automaticamente.

Após avaliar a V1, o usuário aprovou explicitamente commit e push da versão 0.10.0. Relatórios privados, miniaturas, dados e dependências locais permanecem fora do versionamento.
