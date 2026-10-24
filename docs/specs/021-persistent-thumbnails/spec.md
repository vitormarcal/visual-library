# Miniaturas persistentes

Solicitado em 2026-10-24 como primeira entrega da [sequência documentada](../../ROADMAP-redescoberta-desempenho.md).

## Problema e objetivo

A galeria ativa somente imagens próximas da tela, mas transfere originais grandes. Reduzir essa transferência sem acrescentar ações ou controles e mantendo a navegação visual definida pela constituição e DESIGN.md.

## Experiência e escopo

- Library, resultados de similares, capas de assuntos, referência de similares e imagens relacionadas usam previews menores.
- O lightbox principal continua exibindo o original, com animação/transparência originais preservadas.
- Captura responde sem esperar preparo; imagens novas e legadas recebem miniatura quando necessárias à navegação.
- Previews preservam proporção e orientação, sem ampliar imagens pequenas. Transparência permanece no preview; animações usam primeiro frame.
- Derivados persistem no volume local e são reutilizados após reiniciar. Excluir imagem remove seus derivados.
- Falha no preparo preserva acesso ao original. Não acrescentar modal, formulário, indicador de pipeline ou configuração na interface.

## Aceite

- Navegação próxima da viewport continua progressiva; não gerar todo o acervo ao abrir Library.
- Original conserva bytes/hash, ID, tags, fonte e visibilidade.
- Cache privado e URLs versionadas não congelam fallback como se fosse miniatura pronta.
- Publicação atômica: nenhuma resposta oferece arquivo parcial.
- Pedidos concorrentes do mesmo preview compartilham preparo; decodificação não executa no processo web e é serializada.
- Imagem removida durante geração não deixa preview publicado; versão/hash inválidos retornam 404.
- Testes usam banco/arquivos temporários e verificam persistência, cache/304, exclusão, falhas, orientação, alpha, primeiro frame e redução de bytes em amostra sintética.
- Build da aplicação e empacotamento Docker incluem o gerador sem dependências adicionais.

## Fora do escopo

Reescrever masonry, paginação, virtualização, CDN pública, reprocessar originais, geração semântica, histórico de aberturas e deploy. A redução de bytes em fixtures não constitui benchmark do acervo nem garantia de legibilidade em telefone físico.
