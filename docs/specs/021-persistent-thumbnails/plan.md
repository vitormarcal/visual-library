# Implementação de miniaturas persistentes

Usar `sharp` 0.35.5 já empacotado em `runtime/similarity`. Um script específico recebe caminhos internos e hash esperado, valida SHA-256 dos bytes lidos, aplica orientação e gera WebP qualidade 82 em caixa de 640 × 640, sem ampliação e com alpha. Limite de entrada de 40 MP e primeiro frame, como o runtime existente. Arquivo temporário único no mesmo diretório e rename publicam o resultado. Nenhum modelo é importado ou baixado.

Gerar sob demanda em processo filho com timeout de 15 s, heap JS de 128 MiB e concorrência nativa 1. O heap não limita toda a memória nativa. Serializar pedidos no servidor e compartilhar Promise por derivado; falhas têm cooldown de 60 s em cache limitado a 256 entradas. Não criar daemon, fila persistente ou tabela. A primeira solicitação aguarda o preparo; processos encerram ao terminar. O custo do primeiro acesso deve ser medido junto dos bytes.

`GET /thumbnails/:id?v=v1&hash=<sha256>` consulta imagem existente e confere versão/hash. Arquivo em `data/thumbnails/<id>/v1-<hash>.webp`. Revalidar registro antes/depois do preparo e limpar em caso de exclusão concorrente. Dados ocultos seguem a mesma semântica de acesso aos originais: ocultação é organização, não autenticação.

Resposta pronta faz streaming com ETag/304, Content-Length, Content-Type e cache privado immutable. Se decode/runtime falhar, redirecionar ao original com `no-store`, permitindo tentar o preview novamente após cooldown. Legados sem hash continuam usando original. Exclusão remove diretório por imagem; um preparo pendente também verifica exclusão. Crash abrupto pode deixar `.tmp` inerte: nunca servido, pode ser removido com a aplicação parada. Uma troca futura de política deve atualizar `thumbnailVersion` em `db.ts`, compartilhada pelo contrato e servidor; derivados antigos podem ser apagados com a aplicação parada para recuperar espaço.

Adicionar `thumbnailSrc` ao contrato de imagem, preservando `src`. Consumir somente nas superfícies de preview, reutilizando ProgressiveImage e reserva de dimensões. Não mudar o src do lightbox principal, API de conteúdo de assets ou URLs originais. Docker já copia `runtime/similarity/*.mjs` e dependências do sharp.

Referências primárias: [resize do sharp](https://sharp.pixelplumbing.com/api-resize/), [WebP e saída](https://sharp.pixelplumbing.com/api-output/).

## Validação

Executada em 2026-10-24:

- `npm test`: **56 testes passaram**. Integração em biblioteca temporária com decoder real cobre geração sob demanda, dois pedidos simultâneos, arquivo persistido, processo novo reutilizando arquivo sem mudar mtime, ETag/304 sem corpo, hash/versão inválidos, exclusão e corrida com preparo. Cobre JPEG/PNG/WebP/AVIF, GIF/WebP animados com saída estática, orientação EXIF, alpha, ausência de ampliação, fonte alterada e bytes indecodificáveis. Hash e conteúdo dos originais conferidos.
- Fixture sintética de ruído RGB de 1600 × 1200: **5.771.480 → 134.532 bytes**, redução de aproximadamente **97,7%**; preview 640 × 480. O par inicial de pedidos concorrentes terminou em aproximadamente 143 ms na última execução local. É uma amostra sintética, sem throttling, sem p95 e sem representar o ganho/latência do acervo. Arquivos pequenos podem crescer ao recodificar.
- `npm run build`: passou. Permanecem avisos conhecidos de sourcemap e externalização de `node:sqlite`. `git diff --check` e sintaxe do script de geração passaram.
- Chrome headless/CDP, build de produção com **35 imagens sintéticas**, em **1440 × 900 e 390 × 844**: somente previews próximos da viewport foram ativados (sete e dois na observação inicial); grade e capas de Explore usam `/thumbnails/`, viewer principal carrega original de 1200 px, Escape retorna à galeria. Sem overflow horizontal nem exceções JavaScript. Screenshots de grade/viewer inspecionadas; não é teste de telefone físico, legibilidade de arte/fotografia ou benchmark de scroll.
- `docker build -t visual-library:thumbnails-test .`: passou com o Dockerfile existente. Contêiner isolado **sem rede**, dois CPUs e limite de 768 MiB: upload HTTP, miniatura WebP com alpha e 640 × 400, cache/304 e reinício com o mesmo volume temporário. O mtime do preview permaneceu igual e o original conservou seus bytes. Nenhum peso foi necessário para a miniatura. Neste host com SELinux, o volume temporário do teste usou `:Z`.

Roteiros externos de smoke: `/tmp/visual-library-thumbnails-browser.mjs` e `/tmp/visual-library-thumbnails-docker-smoke.mjs`. Screenshots em `/tmp/visual-library-thumbnails-browser-de7WT8`; dados temporários do contêiner em `/tmp/visual-library-thumbnails-docker-nYaDLJ`. O teste HTTP reproduzível está versionado em `tests/thumbnails.test.ts` e `tests/helpers/thumbnails-http.ts`. Orientação de operação em [thumbnails.md](../../thumbnails.md).

Limites: a primeira visita paga geração serializada, um processo por preview ausente; gerações futuras usam disco/cache. Não foi feita comparação A/B no acervo de produção, p95 em hardware remoto ou medição física mobile/DPR 3. Nitidez da política inicial deve ser avaliada no uso real. As mudanças não alteram a espera pelo HTML público. Nenhum deploy ou acesso ao acervo pessoal foi realizado.
