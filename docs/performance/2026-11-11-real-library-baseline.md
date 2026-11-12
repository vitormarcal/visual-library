# Linha de base com o acervo real — 11/11/2026

Avaliação com Playwright/Chrome visível em `https://visu.mordor.lan`, após login manual do usuário. Nenhuma imagem, tag, credencial, configuração ou dado de produção foi alterado. Navegação pode gerar miniaturas sob demanda pelo comportamento normal da aplicação.

## Método e limites

18 navegações completas: Library, Folders e Explore, três rodadas por tela em desktop 1440×1000 e viewport móvel 390×844. Chrome no computador do usuário, DPR 1 nos dois tamanhos; viewport móvel não representa desempenho de celular físico. Sem limitação artificial de CPU/rede nas medições principais. Cada primeira rodada usou bypass do cache de navegador; as duas seguintes usaram cache normal. Miniaturas do servidor não foram apagadas, portanto isso não é um ensaio de geração fria.

Primeira imagem visível: imagem na viewport, carregada, com dimensões naturais e opacidade acima de 0,98, incluindo a transição visual. Observação por requestAnimationFrame; recursos, tarefas longas e layout shifts por Performance API. A coleta continuou por 1,8 s após esse marco. CLS cobre essa janela inicial, não uma sessão inteira. Resultados de três rodadas são descritivos, não uma garantia estatística. Autenticação manual e inspeção preliminar aqueceram recursos antes do ensaio.

Não foram gravados cookies/senhas no roteiro ou nos resultados. Dados agregados e scripts ficaram em `/tmp/visual-library-review-2026-11-11/`; capturas privadas também permanecem apenas nesse diretório local temporário. Metadados completos foram lidos em memória, sem salvar nomes/tags/URLs do catálogo em arquivo. O build implantado não foi identificado por digest durante este ensaio; a revisão estática anterior usou o commit local `0480405`.

## Acervo observado

| Indicador | Valor |
| --- | ---: |
| Imagens | 2.936 |
| Imagens ocultas na leitura | 0 |
| Tags distintas | 1.182 |
| Associações imagem–tag | 6.594 |
| Originais | 2.023.636.551 bytes, aproximadamente 2,02 GB |
| Original mediano | 254.717 bytes |
| Maior original | 13.715.713 bytes |
| Registros sem URL de miniatura | 0 |
| Registros sem dimensões | 0 |

O acervo cresceu duas imagens em relação ao volume inicialmente informado. URL de miniatura presente não comprova existência prévia do arquivo derivado no servidor.

## Carga inicial

| Tela | Primeira imagem desktop: mediana (intervalo) | Primeira imagem viewport móvel: mediana (intervalo) | Maior tarefa desktop / móvel |
| --- | --- | --- | --- |
| Library | 1,60 s (1,51–1,70) | 1,47 s (1,40–1,51) | 689 / 613 ms |
| Folders | 1,20 s (1,08–1,25) | 1,06 s (1,05–1,33) | 596 / 550 ms |
| Explore | 0,58 s (0,56–0,61) | 0,58 s (0,58–0,58) | 90 / 69 ms |

Library e Folders apresentam tarefas de mais de meio segundo no cliente. A diferença para Explore é compatível com trabalho de montagem/agrupamento adicional; este ensaio não produziu um perfil de CPU que atribua cada tarefa a uma função específica.

| Indicador inicial | Library desktop / móvel | Folders desktop / móvel | Explore desktop / móvel |
| --- | --- | --- | --- |
| Elementos no DOM | 18.957 / 18.957 | 1.694 / 1.694 | 1.381 / 1.381 |
| Elementos de imagem | 2.936 / 2.936 | 90 / 90 | 8 / 8 |
| URLs de miniatura solicitadas | 26 / 16 | 48 / 25 | 8 / 8 |
| Bytes de miniaturas, aproximadamente | 1,18 MB / 0,70 MB | 1,90 MB / 0,87 MB | 0,29–0,30 MB / 0,33–0,45 MB |
| CLS inicial, aproximadamente | 0,00008 / 0,00066 | 0,00008 / 0,0082 | 0,0109 / 0,0256 |

Miniaturas ativadas podem repetir a mesma URL entre capas; por isso número de elementos ativados não equivale a número de pedidos. As seleções de Explore variam entre recargas. Não houve pedidos de originais nas 18 cargas iniciais observadas, nem erros JavaScript capturados por `pageerror`.

A inspeção visual confirmou cinco colunas no desktop, duas na viewport móvel e ausência de overflow horizontal nessas duas larguras. Não foi feita avaliação de nitidez em DPR alto ou aparelho físico. As leituras de heap variaram com navegação/GC e não foram usadas para afirmar consumo estável ou vazamento.

## Metadados e compressão

Todas as telas solicitaram o catálogo inteiro e todas as tags, inclusive Explore com oito imagens:

| Endpoint | Corpo da resposta | Cache-Control | Content-Encoding |
| --- | ---: | --- | --- |
| `/api/images` | 2.125.244 bytes | `no-store` | ausente |
| `/api/tags` | 265.270 bytes | `no-store` | ausente |
| Total | **2.390.514 bytes por navegação completa** | | |

Nas 18 navegações, `/api/images` levou 212–334 ms. Em três leituras adicionais, TTFB foi 28–36 ms e a transferência do corpo levou aproximadamente 181 ms; duração total 210–218 ms. A taxa observada de transferência está na ordem de 11 MB/s, mas não foi verificada a velocidade negociada do enlace nem isolada sua causa. Não se deve reutilizar o diagnóstico de rede de 03/11 como diagnóstico atual.

Ensaio local, em memória, com o corpo exato do catálogo recebido: gzip nível 6 produziu **350.969 bytes** (redução de 83,5%) e Brotli qualidade 4, **318.840 bytes** (85,0%). Isso mede compressibilidade; não mede ganho de latência nem custo de CPU no servidor. Nenhuma compressão foi ativada na aplicação/proxy.

**Consequência para o plano:** incluir uma entrega pequena de compressão dos JSONs antes da migração maior de paginação. Ela reduz transferência, mas não resolve montagem de 2.936 cartões, parsing nem necessidade de obter o catálogo completo.

## Rolagem, retorno e consultas

- Rolagem desktop em 12 passos de 800 px: posição final 9.600 px; imagens com `src` passaram de 26 para 194, enquanto DOM e total de elementos de imagem permaneceram em 18.957 e 2.936. Foram observadas tarefas longas durante o fluxo; a maior foi 517 ms. Isso não equivale a um benchmark de FPS de toda a biblioteca.
- Abrir e fechar o detalhe restaurou a posição de 9.600 px. O número de imagens ativadas subiu para 205. Houve 16 pedidos adicionais de miniaturas na janela de retorno, sem repetir URLs já observadas nesse trecho; a contagem inclui solicitações que podem ter sido ativadas pelo fluxo do detalhe/restauração.
- Em um segundo percurso entre Library → Folders → Library, 266 imagens continuaram com `src`, incluindo 240 distantes da viewport após voltar ao topo. **Nenhum novo pedido de miniatura foi observado nesse retorno.** A persistência da ativação está confirmada; uma rajada de downloads por remount não foi reproduzida. Não tratar essa hipótese como falha medida nem prometer ganho ao alterá-la.
- Uma busca textual usando uma tag existente retornou 471 imagens, igual ao esperado pela função atual de busca aplicada ao catálogo. A pasta dessa tag retornou 469, também igual ao esperado. São verificações amostrais, não cobertura completa de todas as buscas.
- Diretório de pastas começou com 30 cartões e passou a 60 ao acionar Load more. Esse comportamento deve ser preservado.

## Visualizador

| Amostra | Bytes do original | Recurso de rede | Clique até original visível |
| --- | ---: | ---: | ---: |
| Mediana do acervo visível | 254.717 | 47 ms | 531 ms |
| Maior original | 13.715.713 | 1.266 ms | 1.629 ms |

Uma rodada por amostra, com caches do servidor não controlados. O intervalo até ficar visível inclui montagem, transferência, decode, transição e polling da verificação; não é uma medida isolada de decodificação.

Em ensaio separado, atrasou-se somente o request do original por 2 s usando interceptação no navegador, sem mudar o servidor. Aos 700 ms após abrir, o original estava incompleto, com opacidade zero; havia somente uma imagem no seu palco e nenhuma prévia visível. Isso confirma a melhoria de prévia proposta. A interceptação foi removida ao concluir.

## Cache e autorização

Uma miniatura de 30.110 bytes e um original de 1.435.854 bytes foram solicitados duas vezes cada. As duas respostas naturais foram 200 com corpo completo e `no-store`, apesar de ETag presente. As revisitas das rodadas principais também retornaram miniaturas com 200.

Enviando `If-None-Match` explicitamente, ambos retornaram 304 sem corpo. Repetindo o pedido condicional com `credentials: omit`, ambos retornaram **401**, sem ETag. A autorização antes de 304 funciona nessa amostra; o navegador não aproveita automaticamente a revalidação de uma resposta que não deve armazenar.

Não houve logout/revogação da sessão do usuário. Esses casos e back-forward cache permanecem critérios para uma futura alteração de cache; o ensaio atual não os certifica.

## Prioridade confirmada

1. **Compressão de JSON e prévia no visualizador:** melhorias delimitadas com evidência direta e sem depender da migração do catálogo.
2. **Paginação com busca/contagens completas e montagem incremental:** principal mudança estrutural; reduzir transferência e trabalho inicial, mantendo navegação, seleção, pastas e relacionadas.
3. **Cache privado com revalidação:** economia de revisitas, sujeita à revisão explícita do contrato de armazenamento local e testes de sessão.
4. **Ativação compartilhada e geração fria:** investigar de forma dirigida; não foi comprovada rajada de remount nem gargalo de geração nesta sessão. Não aumentar concorrência ou alterar qualidade de miniaturas com base nestes dados.

O backfill de dimensões não é um gargalo demonstrado neste acervo, pois todos os registros observados já tinham dimensões. Geração fria, aparelho real, rede externa, rolagem de toda a biblioteca e perfil detalhado de CPU permanecem fora do que foi medido.
