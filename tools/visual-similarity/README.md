# Experimento de similaridade visual

## Avaliação de duplicatas com o Immich ML

`duplicate-evaluate.py` compara todas as imagens visíveis de um snapshot, sem alterar o banco ou os originais. Usa o endpoint de inferência já existente, modelo `ViT-B-16-SigLIP2__webli` e distância cosseno máxima inicial de `0.03`. Não usa o ranking de paleta/DINOv2 e não mistura vetores da busca por conteúdo.

Requer Python 3, NumPy e Pillow no ambiente de avaliação. No Mordor esses pacotes já estavam instalados. Não há dependência nova no aplicativo.

```bash
OPENBLAS_NUM_THREADS=1 python3 -B tools/visual-similarity/duplicate-evaluate.test.py
OPENBLAS_NUM_THREADS=1 python3 tools/visual-similarity/duplicate-evaluate.py \
  --data /private/visual-library-data \
  --out /separate/private/duplicates-report \
  --ml-url http://127.0.0.1:3003 \
  --encoder-id 'fingerprint-of-ML-image-weights-and-preprocessing'
```

Informar o endereço IP correto do serviço de ML no ambiente de execução: todas as imagens visíveis serão enviadas a ele, sequencialmente. A execução registrada em 029 usa a rede interna do Mordor. Não há descoberta automática de serviço, redirects ou proxies de ambiente. O serviço precisa estar com o modelo disponível; a ferramenta não instala modelos, mas o comportamento de cache/download é controlado pelo próprio Immich ML.

O identificador do encoder deve mudar ao trocar pesos, processamento, runtime ou política de precisão. Não trocar essas configurações durante a execução. Modelo/limiar/snapshot ficam em `run.json`; pesos não são copiados. O output precisa ficar fora do repositório e separado da fonte. Reexecutar com o mesmo snapshot/configuração reaproveita vetores válidos, vinculados ao hash dos originais. Para outro snapshot/configuração, usar outra saída.

Abrir `index.html` para comparar os pares e baixar julgamentos JSON antes de fechar. Previews têm até 960 px; não são os originais. Resultados e previews são privados, inclusive após ocultações/exclusões posteriores na biblioteca. Não publicar nem comitar esses arquivos. `results.json` registra cobertura, falhas, custos e pares sem vetores. Código de saída 2 indica cobertura parcial e preserva o relatório. Não avaliados permanecem não avaliados; nenhum descarte é executado.

Este experimento usa inferência real do Immich e comparação exaustiva. Não reproduz todos os filtros, agrupamentos e limites da aplicação Immich; analisar os originais também pode diferir de analisar previews. Mais detalhes em [029](../../docs/specs/029-duplicate-review/plan.md).

### Ampliar o limite sem nova inferência

```bash
OPENBLAS_NUM_THREADS=1 python3 -B tools/visual-similarity/duplicate-expand.py \
  --from-report /separate/private/duplicates-report \
  --out /separate/private/duplicates-expanded \
  --max-distance 0.1
```

Usa somente metadados, vetores e previews do relatório original, sem consultar o acervo ou o ML. Cada vetor precisa corresponder ao encoder e hash-fonte registrados. Ausência/cache inválido aborta, sem inferência de fallback. A pasta de saída precisa ser nova; relatório original e julgamentos permanecem intactos. O novo relatório oferece limites 0.03/0.04/0.05/0.06/0.08/0.10, contagens e filtro inicial mostrando apenas novos pares. Marcações anteriores não são importadas nem presumidas. Como o snapshot é o mesmo, não inclui imagens adicionadas depois ou AVIF que falharam anteriormente. Para expandir novamente, usar o relatório original com seu cache de vetores.

## Experimentos anteriores

Ferramenta de desenvolvimento independente do Nuxt. Não altera o acervo e não integra a galeria de produção. Requer Node 26 e runtime Linux com glibc para o ONNX nativo (por exemplo, `node:26-bookworm-slim`); a aplicação atual já usa Debian e similaridade integrada; este harness continua separado do runtime de produção.

```bash
cd tools/visual-similarity
npm ci --no-audit --no-fund
npm test
node evaluate.mjs --data /caminho/data --out /caminho/separado/relatorio
```

A saída deve ficar fora do acervo. O SQLite é aberto somente para leitura. Para isolamento adicional, monte todo o diretório de dados como volume Docker `:ro`. Use dois CPUs e 3 GiB de memória no contêiner. O primeiro uso baixa DINOv2 small quantizado, com revisão fixada no código, da Hugging Face; nenhuma imagem é enviada. Downloads e dependências exigem rede. Usos seguintes reutilizam o modelo e os descritores em cache.

Padrão: até 100 imagens visíveis, distribuídas pela ordem temporal; até 20 referências; 12 resultados por método. Opções: `--limit 100 --references 20`. A seleção temporal não garante diversidade visual. Somente a amostra participa do ranking.

Abra `index.html` no navegador. `thumbs/` contém cópias reduzidas para revisão local; não publique esse relatório, pois inclui conteúdo do acervo pessoal. `metrics.json` registra os custos e falhas; `results.json` registra rankings sem embeddings; `descriptors/` e `models/` são caches descartáveis. Não comite artefatos pessoais.

Três hipóteses comparadas: embedding DINOv2, paleta RGB e combinação de embedding/paleta/distribuição espacial de cores (65/20/15). Esses pesos não são configuração do produto nem uma conclusão de qualidade. Animações usam o primeiro frame; imagens acima de 40 MP ou formatos que o decoder não suporta ficam registradas como falhas. Derivados refletem a visibilidade no momento da execução; para descartar uma imagem do relatório, gere novamente em outra saída ou apague os derivados antigos.

Métricas de consulta medem comparação em memória dentro da amostra, não latência HTTP ou desempenho do acervo completo. A memória máxima é RSS do processo, não pico total do contêiner; o tempo inicial de carregamento inclui download do modelo quando necessário. O relatório e as medições precisam ser avaliados antes de integrar o método à aplicação.

## Segundo teste: extração e pesos

```bash
node evaluate.mjs --data /caminho/data --out /saida/nova \
  --variants --baseline /saida/original/results.json
```

Usar uma nova saída preserva o relatório anterior. `--baseline` exige o `results.json` do primeiro teste: congela seus candidatos e referências, confirma os hashes originais e rejeita imagens removidas/ocultas em vez de substituí-las silenciosamente. Sem essa opção, o programa faz uma nova amostragem, que pode diferir se o acervo cresceu. Com baseline, `--limit` e `--references` não alteram a amostra congelada.

Há oito métodos: os três controles anteriores e cinco variantes. O embedding varia entre CLS original, média dos patches no recorte central e média dos patches da imagem inteira ajustada a 224 × 224. A última opção preserva todo o conteúdo, mas altera as proporções; é uma hipótese para comparação, não uma correção garantida. Os vetores são normalizados. O modelo, revisão e quantização continuam iguais; não há treinamento. A [documentação DINOv2](https://huggingface.co/docs/transformers/model_doc/dinov2#notes) distingue o token global CLS das características locais por patch; a média dessas regiões é uma escolha deste experimento.

As novas combinações testam 20/65/15 com CLS, 40/45/15 com média da imagem inteira e 20/65/15 com média da imagem inteira (embedding/paleta/posição das cores). A paleta original permanece fixa à esquerda; um seletor troca o método à direita. No celular os dois blocos são empilhados. Controles e pesos ficam nos rótulos; a interface do produto não foi alterada.

Para executar sem rede, reutilize o cache do modelo em `nova/models/` e acrescente `--offline`. Esse modo carrega a revisão fixada diretamente do diretório local e desabilita modelos remotos; foi validado com Docker `--network none`. Os caches de descritores v1/v2 têm versões diferentes. `metrics.json` registra quantas das 20 referências reproduzem exatamente cada controle; divergência de controle ou falha de imagem faz o comando terminar com código 1, mesmo que um relatório parcial tenha sido gerado.

## Avaliação semântica separada (024)

`semantic-evaluate.mjs` avalia texto → imagem com SigLIP2 q8 e a busca lexical atual. Não integra busca ao produto nem altera o índice DINOv2. Reutiliza as dependências deste diretório. Guia completo em [024](../../docs/specs/024-semantic-evaluation/plan.md).

```bash
node semantic-evaluate.mjs --dataset /privado/amostra/dataset.json \
  --queries /privado/queries.json --out /privado/relatorio
# Repetir com o cache completo sem rede:
node semantic-evaluate.mjs --dataset /privado/amostra/dataset.json \
  --queries /privado/queries.json --out /privado/relatorio --offline
```

O JSON de dataset tem `version: 1` e `images`: por padrão de 1 a 100 objetos (ou snapshot completo com `--all`) com `id`, `file` relativo ao diretório do JSON, `sha256`, `originalName`, `createdAt`, `tags: [{name}]` e `hiddenFromGallery: false`. Congelar amostra, hashes e metadados; o programa rejeita arquivos fora do diretório, hashes alterados, ocultas e IDs repetidos. A ferramenta não acessa automaticamente SQLite/SSH. Seleção/exportação da amostra deve ser autorizada separadamente.

Queries têm `version: 1` e `queries: [{id, text, language, source, tags?}]`. `tags` é opcional e filtra por identidade antes de ranquear, sem remover acentos das identidades; o baseline lexical reutiliza o matcher da aplicação. Consultas não recebem tradução ou prefixo automático. Cosseno não representa probabilidade/confiança.

Saída e cache de modelos devem ficar fora do repositório e separados da entrada. `--models /privado/models` permite reutilizar os pesos em outra saída. A primeira execução pode baixar aproximadamente 412 MB de torres quantizadas/tokenizer, mais configurações. Revisão, pré-processamento e biblioteca são fixados no fingerprint. Reexecução confere arquivos e reutiliza vetores por hash; não troca silenciosamente dataset/consultas/modelo numa saída já existente.

Abra `index.html` localmente; contém previews pessoais. Compare top 10 lexical/semântico e abra a seção de avaliação de cada consulta para julgar todos os candidatos com 0/1/2. “Não avaliada” permanece diferente de 0. O relatório não envia julgamentos; **Exportar julgamentos JSON** baixa um arquivo local. **Retomar julgamentos** reabre uma exportação parcial do mesmo dataset/consultas/modelo para continuar a revisão. Não publique artefatos pessoais nem comite `models/`, `vectors/`, imagens ou resultados.

```bash
node semantic-score.mjs --results /privado/relatorio/results.json \
  --judgments /privado/judgments.json --out /privado/quality.json
```

O scorer confere fingerprint do dataset/consultas/modelo. Só calcula nDCG@10, Recall@10 e sucesso top 5 quando todos os candidatos daquela consulta foram julgados. Sem positivos conhecidos, sinaliza ausência de relevantes na amostra em vez de aprovação/reprovação. Resultados parciais não viram métricas conclusivas. Inglês, português e grafia corrigida são diagnósticos distintos, não consultas reais adicionais.

`metrics.json` separa carregamento de modelos, inferência textual, ranking, cache, tempo de imagem incluindo preview, CPU user/system e RSS máximo do processo. CPU soma trabalho entre threads e pode exceder o tempo de parede. O download fica incluído na primeira carga; compare reexecução offline para separar rede. RSS não é pico total de contêiner; uma amostra de nove consultas não estabelece p95 de uso real. A lista de arquivos baixados fica no cache; peso da cache pode incluir arquivos temporários em execução.

Modelo base: Apache-2.0. A conversão ONNX não declarou licença nos metadados consultados; não redistribuímos pesos e a licença da conversão deve ser esclarecida antes de distribuição/integração. O suporte multilíngue documentado não comprova qualidade nas consultas pessoais.

Exportação opcional e explícita da amostra (somente após autorizar leitura do acervo):

```bash
# Executar o script via stdin no host, sem instalar ferramenta no servidor:
ssh usuario@host python3 - --data /caminho/data --limit 100 \
  < semantic-sample.py > /privado/sample.tar
mkdir -m 700 /privado/amostra
python3 -c "import tarfile; t=tarfile.open('/privado/sample.tar'); t.extractall('/privado/amostra', filter='data')"
```

O exportador abre SQLite com `mode=ro` e `query_only`, congela metadados visíveis numa transação curta e encerra a leitura do banco antes de copiar bytes. A amostragem temporal não garante diversidade nem a presença de uma coruja, carro ou qualquer positivo. Original alterado ou path externo aborta a exportação; não reutilize um TAR de execução malsucedida. O TAR inclui cópias pessoais e deve permanecer privado; não é um backup do acervo.

### Biblioteca visível completa

A retomada autorizada pelo usuário permite exportar **todas as imagens visíveis** com `semantic-sample.py --all`, sem mudar o padrão de amostra de 100. `--all` e `--limit` são mutuamente exclusivos. O snapshot registra `selection: "all visible images"` e `visibleCount`.

```bash
ssh usuario@host python3 - --data /caminho/data --all \
  < semantic-sample.py > /privado/full.tar
# Extrair em uma entrada privada nova, então:
node semantic-evaluate.mjs --dataset /privado/full/dataset.json \
  --queries /privado/queries.json --out /privado/full-report \
  --models /privado/models --offline --all
```

O avaliador só aceita mais de 100 imagens quando `--all` é explícito; exige que o número de registros coincida com `visibleCount` e o snapshot seja declarado completo. Continua rejeitando ocultas, duplicatas de ID, hashes alterados e paths externos. Não muda código, schema ou índice da aplicação.

Para reaproveitar anotações de um experimento anterior sem atribuir notas às imagens novas:

```bash
node semantic-migrate.mjs --previous /privado/old/results.json \
  --judgments /privado/old/judgments.exported.json \
  --results /privado/full-report/results.json --out /privado/full-report/judgments.seed.json
```

A migração exige o mesmo modelo/consultas e conserva notas somente se ID e SHA-256 da imagem coincidirem. Não propaga notas entre consultas ou gera zeros para candidatos novos. Ao usar o export original de 151 marcações, os 749 zeros completados por convenção no piloto não são reaplicados automaticamente. A importação normal do HTML continua exigindo fingerprint do novo dataset; o arquivo migrado pode ser usado em **Retomar julgamentos**. A função `semanticReport(results, metrics, seed)` também permite gerar o relatório já preenchido com esse seed validado.

Os dez primeiros resultados semânticos agora têm seletores de nota ao lado da imagem; os demais candidatos ficam numa seção recolhida, sem duplicar controles. Isso permite revisar o topo de toda a biblioteca sem precisar percorrer todos os cartões. Métricas de recuperação completa continuam dependendo de julgamentos suficientes, e não são calculadas como se imagens ainda não vistas fossem irrelevantes.
