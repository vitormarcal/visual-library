# Carregamento leve da biblioteca

Escopo aprovado pelo pedido de implementação de 11/11/2026, após o plano e a medição autenticada do acervo real. Referências: [plano](../../performance/2026-11-11-asset-loading-plan.md) e [linha de base](../../performance/2026-11-11-real-library-baseline.md).

## Comportamento

- A primeira tela apresenta um lote pequeno; rolar ou acionar Load more traz os próximos cartões. Erro adicional conserva os cartões existentes e oferece retry.
- Busca, filtros, pasta e ocultas consultam o acervo completo antes de limitar resultados. Contagens e Select all não representam somente o que já apareceu.
- Explore mantém uma seleção de até oito imagens e sua ordem durante a navegação. Pastas mantêm capas estáveis, contagens completas e montagem em lotes de 30.
- Abrir links diretos, atravessar lotes no detalhe e retornar ao cartão/posição continuam funcionando. Novos cartões não redistribuem os já apresentados no mesmo tamanho de tela.
- Uma miniatura permanece visível enquanto o original carrega. Falhas permitem tentar novamente sem perder a prévia.
- Imagens privadas podem ser armazenadas pelo navegador, com revalidação obrigatória no servidor antes de reutilizar. Sem sessão válida não há conteúdo nem 304. Metadados e autenticação continuam sem armazenamento HTTP; integrações e links públicos conservam seus contratos.
- JSONs do catálogo podem ser comprimidos quando o cliente aceita gzip. Autenticação, credenciais e tokens públicos ficam fora dessa compressão.

## Limites

Sem nova infraestrutura ou dependência; originais preservados. Não mudar qualidade/resolução de miniaturas nem aumentar concorrência sem evidência. Não adicionar virtualização nesta entrega: lotes reduzem a montagem inicial, mas a rolagem completa ainda acumula cartões. Consistência entre páginas é eventual quando o acervo muda; não criar snapshots persistentes do banco.

## Aceite

Primeira página limitada a 60 imagens; ausência de catálogo completo no startup; sem resultados parciais por causa da rolagem; busca com a mesma normalização atual; seleção global; navegação e retorno de foco/posição preservados; prévia em rede lenta; retry sem descarte dos cartões; autorização antes de 304; logout limpa os dados da interface; desktop e mobile sem overflow. Validar em armazenamento temporário, sem alterações no acervo real.
