# Miniaturas da galeria

Library, Explore, similares e relacionadas usam previews WebP persistidos em `data/thumbnails`. O lightbox principal e a API de conteúdo continuam usando originais. Nenhum preparo ocorre no upload: a primeira solicitação de uma miniatura aguarda sua geração; as seguintes usam arquivo/cache HTTP. Não há processamento de todo o acervo na inicialização.

## Desenvolvimento e instalação

O gerador usa o sharp já declarado no runtime de similaridade. No desenvolvimento, instalar também esse pacote:

```bash
npm ci
npm ci --prefix runtime/similarity --ignore-scripts
npm test
npm run build
```

Executar a aplicação a partir da raiz do projeto, como o runtime de similaridade existente. A imagem Docker já inclui o script `runtime/similarity/thumbnail.mjs` e as dependências. Um volume em `/app/data` preserva originais, banco e miniaturas. Não são necessários pesos de IA para gerar previews.

## Política inicial e recuperação

WebP qualidade 82, até 640 px em cada eixo, mantendo proporção, orientação e transparência, sem ampliar. Animações têm preview estático do primeiro frame; o original permanece animado. Imagens acima de 40 MP ou que o decoder não consiga abrir usam original. O timeout é de 15 s por geração; pedidos são serializados e pedidos do mesmo derivado são compartilhados. O limite de heap JS não representa limite total da memória nativa.

O contrato de imagem acrescenta `thumbnailSrc`; `src` mantém o endereço original. URLs e arquivos incluem versão e SHA-256. Cache continua privado, com ETag e 304. Falhas redirecionam ao original com `no-store`; há cooldown de um minuto para evitar repetir decodificação problemática. Falta do runtime também degrada para original. Legados sem hash não têm preview até possuírem hash válido.

Excluir uma imagem pela aplicação remove seu diretório de previews. Previews podem ser apagados com a aplicação parada e serão reconstruídos quando solicitados. Para mudar a política, atualizar `thumbnailVersion` em `server/db.ts`; arquivos de versões antigas podem ser removidos com a aplicação parada. Arquivos `.tmp` de encerramento abrupto nunca são servidos e podem ser limpos nessa ocasião. Não apagar `data/images` ou `library.sqlite` para limpar miniaturas.

## Limites

640 px é uma política inicial, não otimização comprovada para toda imagem/tela/DPR. Validar nitidez com o uso real, especialmente em celular de alta densidade. Arquivos pequenos podem não economizar bytes; o objetivo é reduzir originais grandes. Não há alteração do TTFB do documento público, paginação ou virtualização. A decisão e a sequência das próximas entregas estão no [roadmap](ROADMAP-redescoberta-desempenho.md).


## Autenticação (026)

Miniaturas e originais exigem sessão pessoal; tokens de aplicações acessam conteúdo somente pela API de assets. Cache atual é `no-store`, com validação de acesso antes de 304. Isso substitui a política anterior de cache privado immutable. Links públicos individuais entregam o original, sem miniatura pública. Ver [acesso e compartilhamento](access-and-sharing.md).
