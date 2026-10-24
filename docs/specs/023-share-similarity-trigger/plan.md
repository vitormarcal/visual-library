# Plano de implementação

Marcar `event.context.sharedImagesCreated` na rota `/share` somente quando a contagem final `saved` for maior que zero. O sinal é interno à requisição e não vem do formulário ou da URL. O hook `afterResponse` existente aceita esse sinal para POST `/share` com status abaixo de 400, incluindo 303. Chamar `prepareSimilarity()` somente após a resposta, mantendo worker/coalescência/cooldown atuais.

Usar imports explícitos `.ts` no plugin para permitir o teste Node, como nas rotas já testadas. Sem dependência nova ou chamada de inferência na rota de captura.

Teste de integração com banco e diretório temporários: carregar plugin real, registrar hooks e acionar `afterResponse` pelo adaptador H3 real. Um child de teste no caminho esperado do worker registra início/saída e IDs observados; não baixa modelo nem produz descritor fictício como resultado de inferência. Esperar o preparo de inicialização encerrar antes do primeiro share. Confirmar que POST por arquivo/URL e lote parcialmente válido reabrem preparo com os registros já persistidos; duplicatas/falhas não. Manter worker de teste ativo brevemente para confirmar resposta 303 anterior ao término. Encerrar hooks/servidor e limpar dados no final.

Executar suíte e build, mais smoke do build Nitro com worker de teste isolado, para confirmar que o hook recebe o contexto da rota e status 303. Nenhuma mudança visual exige novo teste de layout. Documentar limites da simulação; o decoder/modelo/ranking existentes não são alterados.

## Validação

Executada em 2026-10-24:

- `npm test`: **61 testes passaram**. Novo teste isolado carrega a rota e o plugin reais, usa o adaptador H3 de `afterResponse` e o fork real de `prepareSimilarity`. Espera a saída do worker de inicialização antes de compartilhar; confirma um novo child observando o registro já salvo e a resposta entregue enquanto o child ainda trabalha. Cobre arquivo, URL direta (fetch remoto simulado), lote parcialmente válido, duplicatas, corpo inválido, arquivo inválido e resposta de URL que não é imagem. Não chama GET de similares nem reinicia a aplicação para provocar preparo.
- `npm run build`: passou. Permanecem avisos conhecidos de sourcemap e externalização de `node:sqlite`. `git diff --check` passou.
- Smoke adicional com **build Nitro de produção**, servidor e banco temporários: worker inicial encerrado; POST `/share` de PNG inicia novo child depois da resposta 303; duplicata e corpo inválido não iniciam outro; lote JPEG + arquivo inválido salva um e dispara preparo. Child observa um e depois dois IDs persistidos. O runtime de teste mantém o trabalho ativo por 500 ms para verificar que a resposta não espera sua conclusão. Hooks executados pelo Nitro real, sem adaptador de teste nessa etapa.

Testes versionados em `tests/share-similarity.test.ts` e `tests/helpers/share-similarity-http.ts`. Smoke externo em `/tmp/visual-library-share-trigger-smoke.mjs`, com dados/eventos em `/tmp/visual-library-share-trigger-nitro-eUYHf4`.

Limites: o child de teste registra início/saída e imagens observadas; não gera embeddings nem afirma qualidade ou sucesso de inferência real. Decoder, modelo, ranking, coalescência e cooldown existentes não foram alterados. Não foi necessário repetir testes visuais ou construir outra imagem Docker: empacotamento e interface permanecem iguais. Nenhum modelo foi baixado, acervo pessoal acessado ou deploy executado.
