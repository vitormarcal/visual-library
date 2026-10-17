# Experimento de similaridade visual

Ferramenta de desenvolvimento independente do Nuxt. Não altera o acervo e não integra a galeria de produção. Requer Node 26 e runtime Linux com glibc para o ONNX nativo (por exemplo, `node:26-bookworm-slim`); o Dockerfile Alpine atual da aplicação não foi alterado.

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
