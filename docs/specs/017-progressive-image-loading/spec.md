# Carregamento gradual de imagens

Pacote aprovado pelo usuário em 2026-10-14: cache duradouro, dimensões reservadas, downloads por proximidade da tela e ajustes simples no servidor.

Ao abrir a biblioteca, carregar apenas imagens próximas da área visível. Ao rolar, antecipar os próximos cartões. Imagens já ativadas permanecem disponíveis durante a sessão; visitas posteriores reutilizam o cache HTTP quando disponível. Preservar proporções naturais, navegação, busca, filtros, seleção e restauração de foco/rolagem.

Critérios: imagens distantes sem download inicial; novos downloads ao rolar; espaço reservado antes do download quando dimensões conhecidas; conteúdo imutável com cache de longa duração; requisição condicional respondida sem ler bytes; imagens e tags consultadas em paralelo. Acervo antigo deve continuar funcionando.

Miniaturas, paginação de metadados e virtualização ficam para outra etapa. Sem alteração do contrato externo de metadados de assets.
