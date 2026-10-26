# Implementação

Adicionar publish_public_links com padrão 0 na tabela application_tokens. Receber boolean opcional publishPublicLinks na criação exclusiva do owner e expor boolean em criação/listagem. Checkbox em Access, desligado inicialmente, com aviso de persistência dos links após revogação.

Autorizar somente GET/POST do caminho UUID /api/images/{id}/public-link para Bearer com essa permissão. Os handlers revalidam a identidade autorizada pelo middleware; DELETE continua exclusivo do owner. Manter autenticação antes do handler e sem fallback de Bearer inválido para sessão.

Cobrir via HTTP publicação/consulta/idempotência, bytes públicos, permissões negadas, métodos e caminhos não autorizados, ID inexistente, revogação e persistência. Conferir migração do schema anterior e tokens legados sem publicação. Executar suíte e build.

## Validação

- `npm test`: 68 testes passaram, sem skips.
- `npm run build`: passou.
- Após ampliar a fixture para o schema anterior de application_tokens, `node --test tests/access.test.ts`: dois testes passaram, incluindo migração, reabertura, tokens legados e HTTP.
- `git diff --check`: passou.

Sem deploy ou uso do acervo real. A migração do blog depende de instalar esta versão e criar a credencial temporária com publicação.

## Ajustes após revisão da constituição

O texto junto à permissão informa que ela permite publicar qualquer imagem por ID, incluindo imagens existentes, e que os links permanecem após revogação da credencial.

Teste adicional cria tokens ativo e revogado diretamente no schema anterior, verifica autenticação e publicação desabilitada após migração, reabre em outro processo e confirma persistência e revogação do token migrado. `node --test tests/access.test.ts`: três testes passaram. Build repetido após o ajuste de interface passou; `git diff --check` passou.
