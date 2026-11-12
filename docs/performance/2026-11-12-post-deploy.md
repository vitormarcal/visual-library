# Validação após deploy — 2026-11-12

Produção `visu.mordor.lan`, Chrome com janela e sessão autenticada pelo proprietário. Acervo observado: 2.958 imagens visíveis, 1.214 tags e 2.032.216.743 bytes de originais. Nenhuma alteração no acervo.

Mesma metodologia do baseline: três navegações por tela e viewport (1440×1000 e 390×844, DPR 1), primeira com cache desabilitado e duas com cache normal. Viewport móvel não representa aparelho físico. Rede e caches do servidor podem variar entre dias; o acervo cresceu desde a medição anterior.

| Tela | Desktop antes → agora | Viewport móvel antes → agora |
| --- | --- | --- |
| Biblioteca | 1,60 s → 0,310 s | 1,47 s → 0,305 s |
| Pastas | 1,20 s → 0,408 s | 1,06 s → 0,398 s |
| Explorar | 0,58 s → 0,307 s | 0,58 s → 0,281 s |

Valores são medianas até a primeira imagem visível. Biblioteca: DOM inicial de 18.957 para 1.736 elementos, imagens de 2.936 para 60. Corpos transferidos do catálogo e tags: 2.390.514 para 91.945 bytes (96,2% menos). Pastas: 303.172 bytes; Explorar: aproximadamente 85 KB. Tags ainda compõem a maior parte do payload inicial da Biblioteca.

Nenhum erro JavaScript nas 18 navegações. Uma tarefa de 58 ms em Pastas desktop; nenhuma tarefa de pelo menos 50 ms nas demais janelas iniciais observadas. CLS máximo observado: 0,026 em Explorar móvel.

Verificações adicionais: páginas de API com 60 registros; rolagem carregou 180 cards a partir dos 60 iniciais; abertura e fechamento do detalhe restauraram scroll com diferença de 0 px. Filtro real retornou 30 resultados com associação correta, busca correspondente retornou 30 e seleção global por IDs retornou os mesmos 30. Thumbnails e original responderam `private, no-cache`, revalidação 304 e acesso sem credenciais 401. Não foi revogada a sessão do proprietário nem realizadas mutações em produção.

Dados agregados e scripts locais em `/tmp/visual-library-review-2026-11-11/post-deploy-*` e `post-check.*`; sem exportar títulos, tags ou credenciais para este relatório. A segunda execução de navegação preservou profundidade da primeira, começando em 180 cards e chegando a 300, conforme esperado pelo histórico.

Resultado: ganhos confirmados no acervo real. Não há evidência nesta medição que justifique virtualização ou ajuste da geração de thumbnails agora. Próxima oportunidade mensurável: reduzir carregamento global de tags, caso o acervo continue crescendo.
