# Plano de avaliação

Ferramenta isolada em `tools/visual-similarity`, reutilizando dependências fixadas do experimento (`@huggingface/transformers` 4.3.1 e sharp 0.35.5). Não importar pelo servidor ou runtime de produção. Dataset JSON fora do repositório define até 100 imagens com IDs, nomes/tags, paths relativos e SHA-256. Consultas JSON separadas. Validar paths, hashes, visibilidade e isolamento da saída antes de inferência.

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
