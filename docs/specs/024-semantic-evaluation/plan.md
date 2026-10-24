# Plano de avaliação

**Status atual: retomada pelo usuário em 2026-10-24 para executar sobre toda a biblioteca visível.** Mesmo encoder, revisão, consultas e orçamento do Mordor; sem novo modelo ou integração. O adiamento anterior e as limitações do piloto ficam preservados no histórico abaixo.

Ferramenta isolada em `tools/visual-similarity`, reutilizando dependências fixadas do experimento (`@huggingface/transformers` 4.3.1 e sharp 0.35.5). Não importar pelo servidor ou runtime de produção. Dataset JSON fora do repositório define IDs, nomes/tags, paths relativos e SHA-256: até 100 imagens no piloto, ou todas as visíveis com `--all` explícito na retomada. Consultas JSON separadas. Validar paths, hashes, visibilidade e isolamento da saída antes de inferência.

Candidato: `onnx-community/siglip2-base-patch16-224-ONNX`, revisão `ba1f3b0843f24bc5417d38e19c37b287d719b2f4`, torres q8 de texto e imagem, CPU, duas threads. Texto/imagem do mesmo checkpoint, 768 dimensões normalizadas e cosseno. Preprocessamento oficial do checkpoint após orientação/primeiro frame, alpha em branco e limite de 40 MP. Consultas sem tradução automática ou prefixo inglês. Medir português, grafia original/corrigida e inglês separadamente.

Pesos quantizados: texto 283.438.275 bytes e visão 94.553.333 bytes; tokenizer JSON 34.363.039 bytes, mais configurações. Download não envia imagens/consultas. Modelo base declara Apache-2.0; a conversão ONNX não declara licença no metadata consultado. Não redistribuir pesos no projeto nem presumir licença da conversão; esclarecer antes de distribuir ou integrar. Fontes: [base](https://huggingface.co/google/siglip2-base-patch16-224), [conversão fixada](https://huggingface.co/onnx-community/siglip2-base-patch16-224-ONNX/tree/ba1f3b0843f24bc5417d38e19c37b287d719b2f4), [SigLIP2](https://huggingface.co/docs/transformers/model_doc/siglip2). O suporte multilíngue documentado é hipótese útil, não resultado em português no acervo.

Extrair amostra por SSH com SQLite somente leitura; copiar apenas os originais escolhidos e metadados para diretório privado separado. Não gerar derivados no volume da aplicação. Cache do experimento e relatório ficam nessa área privada. Fingerprint inclui revisão, dtype, biblioteca, dimensões, pré-processamento e formato; cache inclui hash do original. Reexecução offline reutiliza pesos/vetores e confere integridade da amostra.

Relatório compara top 10 semântico e lexical, com filtro de tags antes do ranking quando fornecido. Sem score apresentado como confiança. Julgamentos exportáveis são vinculados ao fingerprint/hash do dataset/queries. Medir nDCG@10, Recall@10 e sucesso top 5 somente com relevâncias de todos os candidatos da consulta; julgamentos parciais ficam explicitamente parciais, sem aprovação.

Testar ranking, filtros, métricas, caches, relatório escapado e validações sem rede/modelo. Fazer inferência real no piloto; medir no host alvo separadamente se houver ambiente isolado disponível. Não prometer qualidade sem revisão do usuário. Suíte da aplicação permanece como regressão, sem mudar versão do produto por ferramenta experimental.

## Resultados

Piloto técnico e análise dos julgamentos executados em 2026-10-24. **Recomendação após revisão: não integrar este candidato como está.**

### Amostra e consultas

- Exportação somente leitura via SSH de **100 das 876 imagens visíveis**, distribuição uniforme na ordem de salvamento, aproximadamente 103 MB em TAR. Os arquivos escolhidos foram conferidos por SHA-256 contra o banco. Nenhum oculto foi incluído. Amostra e metadados foram congelados; ela não acompanha alterações posteriores do acervo.
- Quatro consultas reais do usuário, uma variante ortográfica corrigida e quatro traduções diagnósticas: **nove textos, quatro intenções**, não nove necessidades reais diferentes.
- A busca lexical não encontrou correspondências em nome/tags para nenhum desses textos **dentro da amostra**. O semântico ranqueou os 100 candidatos por consulta. Isso não demonstra relevância nem ganho de qualidade: mesmo uma consulta sem positivo na amostra recebe um ranking.

### Medições no Mordor

Execução isolada na imagem já disponível `sha256:0a69d08a8d78d96c3682352dfdbed0ef13eccb5a8fd52fe34524fa009f7ba1f3`, com Node 26.12.1, AMD Ryzen 5 5600G, **dois CPUs e 2 GiB de limite**, rede desabilitada, raiz somente leitura e cópias da amostra/modelos montadas somente leitura. Somente relatórios/vetores foram gravados na área temporária do experimento; nenhum volume de produção foi montado ou contêiner da aplicação reiniciado.

| Métrica | Observação |
| --- | --- |
| Pesos/tokenizer/configs no cache | 412.402.716 bytes, aproximadamente 393 MiB |
| Índice experimental JSON de 100 imagens + 9 textos | aproximadamente 1,80 MB |
| Tempo total, três execuções sem vetores prévios | 19,13 s; 19,23 s; 19,35 s |
| Pico RSS do processo nas três execuções | 1008,3; 1028,8; 986,6 MiB |
| Carregamento da torre visual, último passe | 364 ms, sem download |
| Carregamento de tokenizer/torre textual, último passe | 1,79 s, sem download |
| Imagem, mediana excluindo a primeira, último passe | 149 ms, incluindo IO/hash, inferência, cache e preview |
| Primeira consulta, incluindo carregar texto | 1,83 s no último passe |
| Demais consultas, último passe | aproximadamente 35–43 ms cada, sem HTTP |
| Inferência textual, último passe | aproximadamente 30–38 ms por texto |
| Ranking semântico + lexical de 100 candidatos | aproximadamente 4–5 ms por consulta |
| CPU user + system, último passe | 33,21 s + 1,06 s, trabalho somado entre threads |

Os tempos acima não são p95, latência HTTP, benchmark de 876 imagens ou SLA de produto. O pico é RSS do processo, não toda a memória do contêiner. Host com outros serviços; não atribuir diferenças pequenas exclusivamente ao CPU.

No notebook, o primeiro passe incluiu downloads e levou cerca de **466 s**, com aproximadamente 105 s de carga visual e 339 s de carga textual incluindo rede. Não confundir isso com inferência. A repetição com os 100 vetores e nove textos em cache levou aproximadamente 3,25 s, sem carregar modelo, mas ainda conferindo hashes e produzindo previews. Pesos do modelo foram copiados para o ambiente do Mordor para que sua execução não tivesse rede.

### Reprodutibilidade e idiomas

As três execuções independentes no Mordor reproduziram exatamente os nove top 10; entre as duas primeiras, cosseno mínimo dos vetores correspondentes foi aproximadamente 1. Já notebook versus Mordor compartilhou **8–10 membros de cada top 10**, mas nenhuma das nove ordens completas foi idêntica. A causa não foi isolada; não atribuir automaticamente a CPU, decoder ou quantização. Mesma revisão/fingerprint não constitui promessa de equivalência numérica entre ambientes. O relatório do Mordor é a referência desta avaliação; não misturar vetores das execuções.

No primeiro passe do Mordor, sobreposição de membros do top 10 entre português/inglês foi **8/10** para guerreira, **7/10** para mulher/carro, **6/10** para coruja e **4/10** para água. Grafia original/corrigida de guerreira compartilhou **8/10**. São diagnósticos de estabilidade, não métricas de relevância. A consulta ampla `água` exige julgamento e delimitação de intenção antes de qualquer conclusão linguística.

### Validação da ferramenta

- **15 testes do harness passaram**, incluindo os controles anteriores. Novos testes cobrem vetores normalizados, dimensões, cache/fingerprint/hash, filtro antes do ranking, contrato lexical real, métricas com julgamentos incompletos/sem positivos, escaping do HTML e ausência de imagens remotas, avaliação offline totalmente em cache, paths/symlinks, integridade e exportação SQLite read-only.
- **61 testes da aplicação passaram** como regressão. `git diff --check` passou. Sem mudança de dependências, Dockerfile, runtime ou interface do aplicativo; não se gerou release de produto nem deploy.
- Chrome headless/CDP com relatório privado em **1440 × 900 e 390 × 844**: nove consultas, 900 seletores inicialmente sem nota, previews locais, sem overflow ou exceções JS. Exportar JSON preserva fingerprints; retomar exportação recupera os campos; outro dataset é rejeitado sem apagar notas existentes. A nota usada no smoke foi sintética e seus arquivos ficaram separados da área de revisão humana.
- Scorer com exportação parcial de smoke manteve todas as consultas como **incompletas**; não calculou aprovação automática. Na etapa inicial, nDCG@10, Recall@10 e sucesso top 5 ainda não tinham resultado humano; o export recebido depois está analisado abaixo.

### Artefatos privados e próximo passo

- Raiz local: `/tmp/visual-library-semantic-8mwhvkOS`.
- Cópia durável privada para revisão: `/home/vitor/Documentos/relatorios/visual-library-semantic-2026-10-24/report/index.html`, com amostra e consultas congeladas ao lado em `sample/` e `queries.json`. Código/artefatos separados; nenhum arquivo pessoal foi incorporado ao Git.
- Saída temporária original de referência: `/tmp/visual-library-semantic-8mwhvkOS/mordor-profile/index.html`.
- Resultados/métricas: `mordor-profile/results.json` e `mordor-profile/metrics.json` nessa raiz. Passes anteriores em `report`, `mordor-report` e `mordor-repeat`.
- Amostra e queries congeladas: `sample/dataset.json` e `queries.json`. Não foram incorporadas ao Git. Downloads iniciais e logs ficam na mesma área privada.
- Área remota temporária: `/tmp/visual-library-semantic-s8LuzGAv`, sem contêiner experimental permanente. O exportador reproduzível agora está em `tools/visual-similarity/semantic-sample.py`; ele não roda automaticamente.
- Smoke de relatório: `/tmp/visual-library-semantic-report-smoke.mjs`; exportações sintéticas em `validation-smoke`, não são julgamentos do usuário.

**Decisão ao fim do piloto técnico, antes do export:** candidato tecnicamente executável no orçamento de teste; utilidade ainda não demonstrada. Revisar primeiro as quatro consultas de origem `user`, atribuir 0/1/2 aos candidatos e exportar julgamentos. “Retomar julgamentos” permite continuar uma revisão parcial. Inglês e grafia corrigida são diagnósticos opcionais. Só então calcular qualidade; quatro intenções não satisfazem o gate maior de 30 consultas reais. Nenhum índice semântico, botão de busca ou sugestão de tags foi integrado ao produto.


## Julgamentos recebidos e decisão — 2026-10-24

O usuário exportou os julgamentos e instruiu explicitamente a interpretar os não avaliados como **0, irrelevante**. Preservado o original de Downloads; uma cópia privada manteve **151 notas explícitas** e completou **749 zeros**. A complementação registra autorização, SHA-256 do original e IDs completados por consulta. Nenhum comportamento padrão do scorer ou relatório foi alterado: em outras avaliações, ausentes continuam incompletos. Nenhuma inferência adicional ou alteração no acervo ocorreu.

| Consulta original | Explícitas / zeros completados | Nota 2 no top 10 | Nota 1 no top 10 | Nota 2 na amostra | nDCG@10 |
| --- | --- | --- | --- | --- | --- |
| mulher gurreira segurando espada | 99 / 1 | 0 | 1 | 0 | 0,126 |
| mulher posando em frente a carro | 28 / 72 | 1 | 0 | 1 | 1,000 |
| coruja | 2 / 98 | 0 | 0 | 0 | 0,000 |
| água | 8 / 92 | 1 | 1 | 7 | 0,190 |

O scorer usa notas 1 e 2 como algum grau de relevância em Recall/sucesso top 5; um parcial não é acerto completo. Por isso a leitura acima separa os graus. A precisão estrita nas quatro consultas foi **2 itens com nota 2 em 40 posições**. Mulher/carro teve o positivo na posição 1: nDCG=1 reflete a ordem perfeita de um único positivo anotado, não dez acertos. Água teve os sete positivos completos nas posições **3, 30, 34, 41, 65, 86 e 87**, evidenciando que seis ficaram fora do top 10. Guerreiras e corujas não receberam nota 2; não declarar ausência desses conteúdos no acervo completo.

Os nove JSONs foram completados pela convenção autorizada, mas não houve 900 notas explícitas. `an owl` não teve marcações: seu estado de ausência de positivos decorre de 100 zeros completados, não de revisão humana exaustiva. Traduções e grafia corrigida possuem notas diferentes; não inferir vantagem linguística por comparação não pareada. Estes resultados substituem a pendência inicial de receber o primeiro export, sem satisfazer o gate de 30 consultas reais.

Arquivos privados em `/home/vitor/Documentos/relatorios/visual-library-semantic-2026-10-24`: `judgments.exported.json`, `judgments.completed.json`, `quality.completed.json`, `quality.summary.json` e `assessment.md`. Nenhum ID, preview ou anotação individual foi incorporado ao Git; apenas agregados nesta documentação.

**Decisão:** não integrar SigLIP2 q8 nesta forma. Houve um acerto útil para mulher/carro, mas a maioria dos resultados próximos da entrada é irrelevante e água recuperou mal os positivos conhecidos. O custo técnico aceitável não compensa essa qualidade. Uma próxima avaliação deve usar positivos confirmados para cada intenção e julgamentos pareados, antes de escolher outro candidato. Não iniciar automaticamente outro modelo, download, tagging ou integração.


## Adiamento e limite de interpretação — 2026-10-24

O usuário decidiu deixar a busca semântica para depois e informou forte concentração temática no acervo atual. Esse contexto não foi quantificado por classificação de conteúdo nesta investigação. A amostragem temporal pode refletir o acervo pessoal, mas não garante um benchmark diverso ou positivos suficientes para cada consulta.

A baixa diversidade **pode ter influenciado** os resultados; não foi isolada como causa. Os julgamentos continuam válidos para a amostra e a regra de completar ausentes como zero permanece documentada. O fato de seis dos sete positivos completos de água terem ficado fora do top 10 continua sendo uma limitação observada de ordenação neste piloto. Não generalizar esse resultado para concluir que o encoder falha em todo tipo de acervo; também não atribuir todas as falhas exclusivamente à composição da amostra.

**Decisão final desta etapa:** adiar a funcionalidade, sem outra rodada de modelos, downloads ou integração. Preservar ferramentas, pesos em cache e relatórios privados; nenhuma exclusão foi solicitada. O trabalho entregue em miniaturas, Redescobrir e captura permanece independente. Uma retomada só deve ocorrer por nova decisão de produto, com necessidade concreta e amostra adequada às consultas, incluindo positivos confirmados e julgamentos pareados. Isso não constitui uma próxima entrega já selecionada.

Detalhes pessoais do conteúdo não são necessários à documentação versionada; registra-se somente a concentração temática relevante ao método.


## Retomada: biblioteca visível completa — 2026-10-24

Por solicitação explícita do usuário, retomada do mesmo candidato sobre **todas as 876 imagens visíveis**, em vez de outra amostra ou outro modelo. O piloto de 100 imagens e suas anotações permanecem intactos. A cobertura integral inclui as 100 anteriores e outras 776; não garante diversidade temática ou presença de positivos para cada intenção, mas remove a dúvida de exclusão pela amostragem temporal.

O exportador ganhou `--all` explícito, mutuamente exclusivo com `--limit`; o padrão continua limitado a 100. O avaliador só aceita um snapshot maior quando `--all` está presente, `selection` declara todas as visíveis e `visibleCount` coincide com os registros. Visibilidade, IDs, paths e hashes continuam validados. Exportação somente leitura de **1.005.673.131 bytes** de originais, metadados congelados antes do IO; todos os 876 hashes foram conferidos no host e novamente na cópia local.

Execução no Mordor em contêiner isolado, mesmo digest de imagem/revisão/quantização e nove textos do piloto, rede desabilitada, **dois CPUs e 2 GiB**, raiz e entrada/modelos somente leitura. Nenhum volume de produção montado no contêiner de avaliação, restart, modelo novo ou deploy. Vetores novos nesta rodada, sem cache de imagens/textos reaproveitado, para registrar custo real do conjunto completo. Pesos existentes em cache: nenhum download.

| Métrica da execução integral | Resultado |
| --- | --- |
| Imagens processadas / visíveis no snapshot | 876 / 876, sem falhas |
| Tempo do harness após preflight | 154,10 s |
| Mediana por imagem, excluindo a primeira | 150 ms, incluindo IO/hash, inferência, cache e preview |
| Pico RSS do processo | 1112,75 MiB, aproximadamente 1,09 GiB |
| CPU user / system | 276,52 s / 2,49 s, somados entre threads |
| Carga de tokenizer/torre textual sem download | 1,93 s |
| Primeira consulta com carga textual | 2,01 s |
| Demais consultas, incluindo ranking | aproximadamente 67–74 ms |
| Ranking semântico + lexical de 876 candidatos | aproximadamente 35–39 ms |
| Cache JSON de vetores de 876 imagens e 9 textos | 14.623.849 bytes |

São tempos pontuais, não p95, SLA HTTP ou comparação causal de hardware. O pico é RSS do processo. Nenhuma consulta teve correspondência lexical nos metadados congelados, inclusive sobre o conjunto completo. O semântico retornou rankings para todos os textos; relevância dos novos resultados ainda não foi julgada.

| Consulta original | Candidatos do top 10 integral que não estavam na amostra de 100 |
| --- | --- |
| mulher gurreira segurando espada | 9 |
| mulher posando em frente a carro | 7 |
| coruja | 9 |
| água | 9 |

A maioria dos candidatos do novo topo estava fora do piloto, confirmando que sua cobertura era insuficiente para representar o ranking integral. Isso não prova que os novos candidatos sejam relevantes nem transforma o resultado anterior em aprovação do modelo.

### Notas anteriores e revisão

`semantic-migrate.mjs` reaproveita notas somente com mesmo fingerprint de modelo/consultas e mesmo ID/SHA-256 de imagem. Foram migradas **151 notas explícitas, sem descartes**, a partir de `judgments.exported.json` preservado. Os 749 zeros completados por convenção no piloto permanecem naquele artefato; não preencheram candidatos desta rodada. O novo dataset tem outro hash. As nove consultas continuam incompletas para métricas globais, sem nova conclusão de qualidade.

O relatório mostra seletores no próprio top 10; a seção dos demais candidatos continua recolhida e cada candidato possui só um controle de nota. As 151 notas migradas já vêm preenchidas, e o export `judgments-full.json` evita confundir arquivos com o piloto. Exportação/importação preservam fingerprints e proveniência; imagens sem nota continuam sem nota. Revisar o top 10 permite avaliar sua precisão sem julgar todos os 876 candidatos; Recall/nDCG abrangentes continuam dependendo de relevâncias suficientes.

### Validação e artefatos

- **17 testes do harness passaram**. Modos padrão/integral, rejeição de snapshot incompleto, exportação de mais de 100 sem ocultos/mutação do SQLite, hashes, migração com hash alterado/novo ID/modelo diferente, seed de outro dataset e um único controle por candidato cobertos. Permanecem controles e testes anteriores.
- **61 testes da aplicação passaram**. `git diff --check` e sintaxe dos scripts passaram. Sem mudança de versão, dependência ou UI do aplicativo.
- Chrome/CDP com o relatório completo em 1440 × 900 e 390 × 844: **7884 controles**, 151 notas pré-preenchidas, previews locais, sem overflow ou exceções. Exportação, retomada e rejeição de outro dataset conferidas. A nota de smoke é sintética e foi isolada em `validation-smoke-*`, fora dos julgamentos humanos.
- Scorer executado sobre o seed: **zero consultas completas**, sem métricas conclusivas. Não houve preenchimento automático de novos candidatos como irrelevantes.

Área privada durável: `/home/vitor/Documentos/relatorios/visual-library-semantic-full-2026-10-24`. Relatório em `report/index.html`, seed em `report/judgments.seed.json`, resultados/métricas em `report/results.json` e `report/metrics.json`, snapshot em `sample/`, consultas em `queries.json` e notas de método em `assessment.md`. Nenhum conteúdo pessoal incorporado ao Git. Cópia isolada no Mordor: `/tmp/visual-library-semantic-full-gQi7yZfE`; o contêiner de avaliação foi removido ao concluir.

**Estado atual:** execução integral concluída; aguardando revisão dos novos resultados. Esta retomada não autoriza integração, novos modelos ou tagging. As conclusões qualitativas do piloto ficam restritas àquela amostra e não substituem a avaliação integral.
