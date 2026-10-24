# Preparo de similaridade após compartilhamento

Terceiro item da [sequência escolhida](../../ROADMAP-redescoberta-desempenho.md), solicitado em 2026-10-24 após a avaliação em produção de miniaturas e Redescobrir.

## Problema e objetivo

Uma imagem salva pelo menu Compartilhar pode ficar sem descritor quando o worker inicial já terminou. A rota `/share` salva pelo mesmo armazenamento, mas não é acompanhada pelo hook de similaridade. Garantir que uma nova captura compartilhada entre no preparo existente sem exigir abrir similares ou reiniciar a aplicação.

## Comportamento

- Após salvar pelo menos uma imagem nova por arquivo ou URL direta em `/share`, agendar preparo após a resposta, usando o worker existente.
- Preservar resposta 303, contagens de salvas/duplicadas/falhas, limites, deduplicação e proteção de URLs.
- Lote parcialmente válido também dispara preparo das imagens novas que conseguiu salvar.
- Compartilhamento só de duplicatas, inválido ou inteiramente malsucedido não inicia um worker desnecessário.
- O preparo não bloqueia a resposta nem condiciona sucesso da captura à disponibilidade de modelo. Falhas seguem cooldown e retry atuais.
- Coalescência e processamento sequencial continuam sendo responsabilidade do preparo existente. Não criar outro processo concorrente de similaridade.

## Aceite e limites

Validar com worker previamente encerrado, sem GET de similares e sem restart: compartilhar uma imagem nova reabre o preparo e o worker observa o registro salvo. Validar arquivo, URL, lote parcial, duplicatas e falhas. Verificar que a captura responde enquanto o processamento continua.

Sem nova interface, configuração, dependência, fila, modelo ou mudança no ranking. Sem alterar histórico, miniaturas, Redescobrir ou gatilhos existentes. Testes isolados não autorizam enviar conteúdo externo nem processar o acervo de produção.
