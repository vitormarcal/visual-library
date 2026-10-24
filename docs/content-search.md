# Busca experimental por conteúdo

Na Library visível, selecione **Content · experimental**. A busca normal por tags/nome continua sendo o padrão. Na primeira utilização, **Prepare content search** ativa o recurso e prepara as imagens visíveis. Escreva uma descrição e pressione Enter ou **Search**; digitar sozinho não executa inferência. Até três tags restringem os candidatos antes da ordenação.

São retornadas até 24 imagens, sem paginação. O modelo sempre ordena os candidatos disponíveis; uma imagem apresentada pode não corresponder à descrição. A avaliação pessoal encontrou utilidade para algumas consultas, mas qualidade inconsistente, especialmente para ações/objetos combinados e água. Não há limiar de relevância calibrado. **Refresh results** refaz a consulta com o índice atual. Abrir/fechar uma imagem preserva a sessão; novas capturas não substituem silenciosamente os resultados apresentados.

Ocultos ficam fora do índice consultável e deste modo. Ocultar/excluir uma imagem remove sua elegibilidade. Arquivos ilegíveis são contados separadamente; **Retry preparation** tenta prepará-los novamente. Falhas de modelo não impedem captura, navegação ou busca por tags/nome.

## Operação local

O primeiro preparo baixa aproximadamente 412 MB de arquivos públicos do modelo SigLIP2 q8 e calcula os vetores localmente. Imagens e consultas não são enviadas a um serviço de inferência. O download exige rede; com os seis arquivos do modelo completos no cache, o runtime usa o diretório local sem rede. Pesos não são incluídos na imagem Docker. O volume `/app/data` deve persistir e permitir escrita.

- `data/semantic/enabled`: ativação persistida, criada somente pelo preparo explícito.
- `data/semantic/models`: cache dos pesos/tokenizer, separado de DINOv2.
- `image_semantic_vectors` no SQLite: derivados por imagem, fingerprint da política e hash da origem; nenhum julgamento do experimento é importado.

Após a ativação, o startup e novas capturas/alterações de visibilidade preparam incrementalmente os itens pendentes. A resposta da captura não espera a indexação. O primeiro preparo pode levar minutos, além do download. Na avaliação completa, 876 imagens levaram cerca de 154 s no Mordor, com dois CPUs/2 GiB; isso não é uma promessa de tempo para outras bibliotecas.

A inferência roda em um processo separado, com trabalhos serializados. Ao terminar o preparo visual, o processo mantém somente a torre textual aquecida; encerra após 60 segundos sem trabalhos. A consulta seguinte pode ter custo de carregamento. Há cache temporário de até 32 vetores de consulta, sem histórico persistido. Resultados do navegador também ficam apenas na sessão e na URL submetida.

Falhas pausam tentativas por 60 segundos; o botão de retry permite tentar imediatamente. Arquivos incompletos ou corrompidos no cache podem exigir reparo: pare a aplicação e remova somente `data/semantic/models`, preservando SQLite e originais; o próximo preparo baixa novamente. Para desativar o preparo automático, pare a aplicação e remova `data/semantic/enabled`. Os derivados podem permanecer para uma ativação futura.

DINOv2 e SigLIP2 usam processos/cache distintos e podem concorrer por memória. O teste isolado de SigLIP2 não comprova um limite conjunto durante os dois preparos; dimensione o host considerando essa concorrência. O limite de heap JavaScript não limita memória nativa do ONNX. A validação desta entrega usa imagens sintéticas e não processa novamente o acervo de produção.

## Contrato HTTP

- GET `/api/search/content/status`: inactive, preparing, ready ou unavailable, com contagens de preparo.
- POST `/api/search/content/prepare`: ativa ou solicita retry; retorno não aguarda o trabalho completo.
- POST `/api/search/content`: `{ "query": "coruja", "tagIds": [] }`, descrição de até 500 caracteres e até três IDs de tags. Retorna estado e imagens, sem vetores ou escores.

As respostas usam `Cache-Control: no-store`. O acesso segue o mesmo perímetro de confiança da aplicação existente; não acrescenta autenticação.
