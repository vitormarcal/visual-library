# Implementação

Usar o parâmetro publicContent já existente em sendImageContent para selecionar public, max-age=31536000, immutable apenas na entrega pública. Preservar o padrão no-store do middleware e o tratamento de erros. Nenhuma dependência, nova rota ou alteração do armazenamento.

Cobrir via HTTP GET/HEAD/304 com ETag e Last-Modified, respostas privadas normais/condicionais, link revogado, arquivo ausente e conteúdo inválido. Documentar o efeito da revogação em caches existentes. Avançar para 0.16.1, executar suíte/build e enviar commit para origin/main conforme solicitado.

## Validação e versão

- `node --test tests/access.test.ts`: três testes passaram, incluindo autorização, migração e cabeçalhos HTTP públicos/privados.
- `npm test`: 69 testes passaram, sem skips.
- `npm run build`: passou.
- `git diff --check`: passou.
- Versão avançada de 0.16.0 para 0.16.1 em package.json e package-lock.json.

Esta entrega inclui também as alterações de publicação por token da especificação 027, que ainda estavam sem commit no checkout. Commit e push autorizados pelo usuário. Sem deploy nesta etapa.
