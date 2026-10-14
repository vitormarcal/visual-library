# Plano

- Acrescentar width/height e marcador de consulta às imagens. Upload extrai metadados dos bytes já disponíveis; listagem preenche legado com leitura de até 64 KiB por arquivo, em lotes de oito. Persistir o resultado, inclusive ausência de dimensões. Falha de IO permite nova tentativa.
- Declarar image-meta 0.2.2, já presente via Nuxt, como dependência direta. Preservar orientação EXIF. Formatos sem dimensões detectáveis, inclusive AVIF animado não reconhecido pelo parser, usam proporção provisória quadrada e recebem proporção natural ao carregar.
- Componente ProgressiveImage atribui src ao entrar na margem de 300 px do IntersectionObserver. Guardar URLs ativadas na sessão, desconectar observers no unmount e usar decoding async. Aplicar à galeria, capas e relacionadas; viewer principal imediato.
- Conteúdo: private, max-age=31536000, immutable. Manter validadores e verificar 304 antes do sniff de MIME. Remover cache de respostas de erro.
- Carregar metadados de imagens e tags em paralelo, mantendo mudanças locais e contratos existentes.
- Verificar testes, build, diff e navegador de produção com acervo temporário: abertura, scroll, cache, filtros, assuntos e viewer em desktop/mobile.

Limitações: primeira consulta ao legado precisa ler cabeçalhos de arquivos; o cache do navegador pode ser descartado; originais continuam sendo utilizados; todos os metadados/cartões continuam em memória.

## Validação executada — 2026-10-14

- npm test: 46 testes passaram. Cobertura adicional de dimensões reais, JPEG orientado por EXIF, fallback, persistência de dimensões em upload/legado e 304 com leitura de bytes deliberadamente bloqueada.
- npm run build: produção concluída; permanecem avisos anteriores de sourcemap Nuxt e externalização de node:sqlite. git diff --check sem erros.
- Chrome headless/CDP, build de produção e acervo temporário de 100 PNGs, incluindo 20 registros legados sem dimensões. Rede limitada a 250 kB/s com latência de 100 ms. Em 1280 × 800, oito imagens ativadas/baixadas inicialmente e 28 após rolar até metade da página; restantes sem src. Ao sair da página e voltar, as oito imagens iniciais vieram do cache.
- Viewer abriu/fechou normalmente. Explore apresentou 31 assuntos; abrir um assunto exibiu suas imagens. Em 390 × 844, uma imagem ativada inicialmente, sem overflow horizontal. Zero exceções JavaScript.

Roteiro de navegador em /tmp/visual-library-loading-browser.mjs e screenshot em /tmp/visual-library-loading-mobile.png. Nenhum teste acessou o acervo pessoal. Downloads incompletos não foram considerados cache preenchido; reload forçado e descarte de cache podem exigir revalidação/download. A verificação sintética não mede benefício no acervo real nem cobre todas as combinações de seleção, histórico, imagens animadas e dispositivos físicos.

## Revisão e versão — 2026-10-14

Revisados cache/validadores, limites de leitura do legado, persistência/migração, ativação por proximidade, proporções, contratos de assets, dependência direta e escopo aprovado. Corrigida a leitura de cabeçalhos antigos para acumular leituras parciais até EOF ou 64 KiB; antes, uma leitura curta podia persistir dimensões ausentes. O teste HTTP agora limita cada leitura a sete bytes, verifica dimensões corretas e comprova que a consulta seguinte não relê os arquivos.

Após a correção, os 46 testes passaram. Versão avançada de 0.7.0 para 0.8.0 a pedido do usuário, com package.json e as duas referências do package-lock.json sincronizadas. As limitações documentadas permanecem.
