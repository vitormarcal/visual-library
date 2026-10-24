# Redescobrir sem histórico

Solicitado em 2026-10-24 como segunda entrega da [sequência escolhida](../../ROADMAP-redescoberta-desempenho.md), após miniaturas persistentes. A autorização de continuidade seleciona este recorte mínimo.

## Problema e objetivo

Imagens salvas há mais tempo desaparecem sob as capturas recentes, especialmente sem tags ou nomes úteis. Oferecer um pequeno ponto de reencontro no Explore, sem configuração, análise de conteúdo ou coleta de comportamento.

## Experiência

- Bloco `Rediscover` antes dos assuntos, com até oito imagens e botão `Another selection`, acompanhando o idioma atual da interface.
- Priorizar imagens salvas há pelo menos 30 dias. Na falta de alternativas antigas, completar com imagens recentes e explicar isso com texto factual.
- Evitar repetir o lote anterior quando houver imagens alternativas; acervos pequenos podem repetir membros, sem duplicatas no mesmo lote. Uma única imagem continua útil, sem botão que prometa outra seleção.
- Manter masonry e miniaturas progressivas. Usar quatro colunas desktop e duas mobile neste bloco finito para não transformar a entrada do Explore numa longa Library.
- Abrir no viewer existente; anterior/próximo seguem o lote. Conexões por tags continuam abrangendo o acervo visível; fora do lote, anterior/próximo ficam indisponíveis.
- Fechar, editar tags, navegar por assuntos ou voltar de similares preserva lote, ordem e posição/foco conhecidos. Outra seleção é explícita e mantém o foco no botão.
- Pesquisa de assuntos não filtra imagens nem reorganiza o lote. Sem resultados de assuntos, as imagens ainda podem ser redescobertas.
- Lote permanece estável durante a sessão; excluir/ocultar retira o item sem preencher a vaga automaticamente. Novos uploads entram somente numa nova seleção; a primeira captura pode preencher o bloco inicialmente vazio.
- Link de imagem continua válido em nova aba/reload. Quando o lote não é conhecido, recuperar a imagem na Library, com aviso discreto, sem fingir reproduzir a seleção anterior.

## Aceite e limites

Nunca selecionar ocultas, IDs repetidos ou inexistentes. Vazio, biblioteca recente, biblioteca sem tags e falha de carregamento são estados normais; falha oferece retry sem apresentar vazio como sucesso. Sem histórico de abertura, não usar “pouco vista”, “nunca vista” ou afirmar esquecimento real.

Sem nova tela, endpoints, tabelas, telemetria, recibos, modelo, dependências, serviço externo, feed infinito, configurações ou mudanças de captura. Preservar Library, pesquisa lexical, filtros, tags e similaridade atuais. Validar propriedades da seleção, navegação, estados e retorno no navegador com biblioteca temporária. Benefício real de redescoberta será avaliado no uso pessoal; não é comprovado por testes sintéticos.
