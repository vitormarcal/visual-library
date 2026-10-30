# Referência do Immich no Mordor

Consulta em 2026-10-30 via SSH a `kamisama@mordor`, somente leitura. O contêiner `immich_server` usa a imagem `ghcr.io/immich-app/immich-server:v3`; essa tag não identifica a versão exata instalada.

Foi consultado apenas o registro `system-config` de `system_metadata`, em transação PostgreSQL READ ONLY, imprimindo somente os campos relevantes de machine learning:

- `machineLearning.clip.modelName`: `ViT-B-16-SigLIP2__webli`.
- `machineLearning.duplicateDetection.maxDistance`: `0.03`.

Nenhum serviço foi alterado/reiniciado e nenhuma imagem foi lida nessa consulta. Não foram coletadas credenciais no relatório.

## Implicação

O Immich agrupa modelos sob a configuração chamada CLIP, mas o modelo selecionado nessa instalação é SigLIP2. Portanto, a oposição feita inicialmente entre “CLIP do Immich” e “SigLIP2 daqui” foi imprecisa.

O Visual Library usa `onnx-community/siglip2-base-patch16-224-ONNX`, revisão `ba1f3b0843f24bc5417d38e19c37b287d719b2f4`, q8, vetores normalizados de 768 dimensões. A extração aplica orientação EXIF, primeiro frame, transparência branca, sRGB, redução prévia até 448 px e o processador do modelo. Isso comprova a família SigLIP2, mas não equivalência numérica com os pesos/processamento do Immich.

A decisão acordada é seguir a abordagem do Immich para obter utilidade cedo. Ainda falta conferir os artefatos e o processamento exatos do encoder remoto antes de escolher reutilização dos vetores ou extração separada; `0.03` é referência experimental, não um limiar validado para o Visual Library.

## Fontes

- https://docs.immich.app/features/duplicates-utility/
- https://docs.immich.app/administration/system-settings/#duplicate-detection
- `runtime/similarity/semantic-features.mjs`
- `runtime/similarity/semantic-extract.mjs`

O escopo está em `spec.md`; a avaliação autorizada posteriormente está descrita em `plan.md`.

## Verificação do runtime e início da avaliação

Na continuação autorizada em 2026-10-30, foram lidos os arquivos do contêiner ML já instalado. `immich_ml/models/clip/visual.py` confirma o resize squash para 224×224 com interpolação bicúbica; `preprocess_cfg.json` usa média/desvio 0.5. A resposta `/predict` contém o vetor em `clip` como string JSON. O repositório de duplicatas do servidor instalado usa distância cosseno `<=>` com comparação inclusiva `<= maxDistance`.

Artefatos observados, SHA-256:

- Imagem do contêiner ML: `fc548ba30a5025dfdd4a5ada9a227b557fbadc95786b6cd52f5ad3cd3f198268`.
- `v2/visual/model.onnx`: `896c732bf4aa73cb5c655e18130d4b8280a91ebc6a6ab534da25101ae5700bd1`.
- `v2/visual/model.rw-4b750c656162.onnx`: `2c1d1e69c54f5f605f5be098b2c724b5f789da58855124b1cdc807439785035d`.
- `v2/visual/preprocess_cfg.json`: `d78a80d49dca4e62d17f802a685d67d821f7102844cb89f65a0bb1a5d0601f43`.

Identificador do experimento: `immich-ml-fc548ba30a5025df;model-896c732bf4aa73cb;runtime-2c1d1e69c54f5f60;preprocess-d78a80d49dca4e62;v2`. Esses hashes registram os artefatos presentes; não constituem introspecção da sessão ONNX carregada em memória.

Execução temporária no host, sem instalar pacotes, alterar contêineres ou criar serviço novo. Python 3, NumPy 1.26.4 e Pillow 10.2.0 já estavam disponíveis. Requisições sequenciais ao ML existente na rede Docker interna. Snapshot inicial: 1.141 imagens visíveis. Dados/relatórios pessoais permanecem fora do repositório.

Uma amostra pontual de `docker stats` durante a inferência mostrou ML com aproximadamente 343% CPU e 3,47 GiB, Visual Library com 0% CPU e 152 MiB. Não é medição de pico nem benchmark de latência do produto. Esta execução compartilha os recursos do ML com o Immich, portanto não justifica prometer esse custo para um runtime próprio futuro.
