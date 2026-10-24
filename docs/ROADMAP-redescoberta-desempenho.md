# Navegação leve e redescoberta

Decisão do usuário em 2026-10-24, após leitura de CONSTITUTION.md e análise dos relatórios de 23/10/2026. As entregas serão feitas individualmente, começando por miniaturas persistentes. Este documento registra a sequência escolhida; não amplia o backlog para todas as funcionalidades do Spooly.

## Evidência e decisão

O estudo `visual-library-spooly-2026-10-23.md` identifica mecanismos úteis e descreve o código em `3c6558b`. O diagnóstico posterior `visual-library-performance-2026-10-23/diagnostico.md` traz medições de navegação e revisa a prioridade. Ambos permanecem em `/home/vitor/Documentos/relatorios`; traces, URLs pessoais e dados do acervo não são copiados para o projeto.

Nas medições, dez imagens iniciais da Library desktop transferiram 6,77 MiB; uma rolagem elevou o acumulado a 22,97 MiB. A 10 Mbps, as dez imagens terminaram de carregar em 6,8 s. Lazy loading e cache HTTP já funcionam. Esses números justificam reduzir os arquivos da grade antes de ampliar descoberta. Não comprovam que decode seja o gargalo dominante nem estimam o ganho de uma implementação ainda inexistente.

A espera pública de até 36,54 s pelo primeiro byte do HTML é um problema separado. Sua causa não foi localizada; miniaturas não corrigem esse intervalo. Mobile foi emulado em computador; não há benchmark de telefone físico.

## Sequência escolhida

1. **Miniaturas persistentes — implementadas e validadas em 2026-10-24, [021](specs/021-persistent-thumbnails/spec.md).** Reduzir transferência na Library, capas, similares e relacionadas. Manter masonry, ativação progressiva, cache privado e originais no lightbox. Validar bytes, proporção, transparência e falhas com acervo temporário. Tamanho e qualidade são política inicial a avaliar, não resultado universal.
2. **Redescobrir mínimo — implementado e validado em 2026-10-24, [022](specs/022-rediscover/spec.md).** Lote de até oito imagens no Explore, priorizando salvamentos de pelo menos 30 dias, seleção variável e ordem mantida ao abrir/voltar. Sem histórico de abertura; não usar rótulos “pouco vista” ou “nunca vista”. Usa metadados existentes e miniaturas, sem API ou tabelas novas. Lotes vivem na página; links sem lote conhecido recuperam a imagem na Library. Contagem, recibos, retenção e limpeza só entram se uso demonstrar necessidade.
3. **Gatilho de similaridade de `/share` — implementado e validado em 2026-10-24, [023](specs/023-share-similarity-trigger/spec.md).** Capturas compartilhadas que salvam pelo menos uma imagem nova sinalizam o hook existente para preparar depois da resposta 303. Duplicatas e falhas não iniciam worker. Validado com child de teste previamente encerrado, sem abrir similares ou reiniciar a aplicação. Sem nova fila ou algoritmo; inferência real não foi repetida nesta correção.
4. **Avaliação semântica isolada — piloto técnico executado; qualidade pendente, [024](specs/024-semantic-evaluation/plan.md).** Com autorização do usuário, amostra fixa de 100 imagens visíveis e quatro intenções reais em português foi avaliada com SigLIP2 q8, incluindo diagnósticos de grafia/inglês. Execução sem rede no Mordor, com dois CPUs/2 GiB, levou cerca de 19 s para o lote e aproximadamente 1 GiB de RSS. Relatório privado aguarda julgamentos humanos; nenhuma busca foi integrada ao produto. Preservadas similaridade estética e busca lexical, sem tagging, serviço externo ou novo banco.

## Limites de produto

Preservar tags como pistas pessoais e coleções como curadoria distinta. Paginação global, virtualização, novos modos de similaridade, classificação e infraestrutura adicional dependem de fricção medida. Nenhuma entrega exige realizar todo o roadmap. Commit/push de código não implica deploy nem processamento do acervo de produção.
