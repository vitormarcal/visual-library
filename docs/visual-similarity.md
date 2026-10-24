# Testar a galeria de similares — V1

A V1 está integrada ao aplicativo: abra uma imagem visível e escolha **See similar**. A interface acompanha o idioma atual do projeto. O contexto mostra a referência e uma galeria de similares em todo o acervo visível, sem herdar busca ou tags anteriores.

Abrir um resultado permite examiná-lo. Só **See similar** nessa outra imagem muda a referência. Fechar o visualizador mantém a galeria; **Back** na galeria recupera a origem conhecida. Links diretos e reload preservam referência e imagem; entrada sem histórico oferece retorno à Library.

## Docker

É necessário **reconstruir a imagem com o Dockerfile atual** e recriar o contêiner, preservando o volume de dados montado em `/app/data`. Uma imagem construída quando a versão 0.10.0 continha apenas o experimento não inclui esta interface/runtime. Iniciar ou reiniciar aquela imagem não incorpora o código novo.

```bash
docker build -t visual-library:0.10.0 .
```

Use essa imagem na configuração atual do seu contêiner, mantendo seus mapeamentos de volume/porta/rede. O Dockerfile inclui Nuxt e o runtime de similaridade em Debian slim. Não precisa copiar ferramentas ou relatórios de `tools/`; eles não entram na imagem. Em hosts com SELinux, use a rotulagem de volumes já adequada ao ambiente (por exemplo `:Z` para um volume exclusivo), sem alterar outros diretórios.

## Primeiro uso e preparo

O servidor inicia o preparo das imagens visíveis em um processo separado. No primeiro uso, esse processo baixa o modelo DINOv2 small quantizado da Hugging Face; precisa alcançar a internet durante esse download. Imagens não são enviadas a nenhum serviço. O modelo fica em `data/similarity/models` e os derivados em SQLite, no mesmo volume persistente já usado pela biblioteca.

Não há configuração de modelo ou chave de API. CPU é suficiente para a configuração testada. O processo trabalha em uma imagem por vez, usa duas threads de inferência e encerra ao terminar, liberando o modelo da memória. Reiniciar o contêiner mantém os derivados e retoma o que faltar. Falhas de modelo pausam o preparo por pelo menos um minuto ou até retry explícito; um acesso posterior pode tentar novamente. Uploads não esperam a análise.

Ao abrir uma referência ainda não preparada, a interface mostra **Preparing similar images** e verifica novamente. **Try again** solicita uma nova tentativa em caso de falha. Imagens novas entram no preparo após salvar, inclusive pela API de assets quando visíveis e pelo compartilhamento em `/share`. Neste último, o hook só dispara quando ao menos uma imagem nova foi salva, após a resposta 303; duplicatas e falhas não iniciam outro worker. A correção e sua validação estão em [023](specs/023-share-similarity-trigger/plan.md). Imagens ocultas não participam dos resultados nem podem ser referência desta galeria.

Os resultados chegam em páginas de 24. Cada visita fixa uma ordem; imagens preparadas depois não deslocam as já apresentadas. **Refresh results** inicia uma ordem atualizada. O conjunto é finito e tem indicação de término. Um snapshot do servidor expira após 30 minutos ou restart; uma próxima página desse snapshot oferece atualização explícita em vez de misturar ordens.

## Desenvolvimento local

Além das dependências habituais da aplicação, instale o runtime próprio:

```bash
npm ci
npm ci --prefix runtime/similarity --ignore-scripts
npm run dev
```

Para servir uma build local, mantenha `runtime/similarity/` e suas dependências junto ao diretório de trabalho do servidor; só copiar `.output/` não inclui o processo de preparo. O Dockerfile já faz esse empacotamento.

## Limites da V1

O ranking usa 65% distribuição global de cores, 20% embedding médio da imagem inteira ajustada a 224 × 224 e 15% distribuição das cores em uma grade. Essa é a combinação avaliada no segundo relatório; não há ajuste de pesos na interface. Ela não garante reconhecer a mesma pessoa, pose ou objeto. Proporções são preservadas na exibição; o ajuste a quadrado ocorre somente no descritor.

Animações usam o primeiro frame. O decoder limita imagens a 40 milhões de pixels; formatos/arquivos não decodificáveis ficam indisponíveis para similaridade, sem impedir armazenamento ou visualização habitual. Um retry de arquivo permanentemente incompatível pode voltar a falhar.

Apenas a galeria de similares pagina os resultados; a listagem habitual de metadados da biblioteca continua completa. O ranking compara os derivados disponíveis diretamente no servidor. Não há banco vetorial, serviços pagos, tags automáticas, identificação de pessoas ou mudanças em coleções.
