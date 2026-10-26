# Publicação por credencial de aplicação

Solicitado para migrar imagens do blog usando uma credencial temporária revogável.

Ao criar uma credencial em Access, o dono pode permitir consultar e criar links públicos. A opção começa desmarcada e a lista identifica credenciais com publicação. Tokens atuais conservam as permissões existentes. Revogar o token impede novas operações e preserva os links usados pelos leitores do blog.

A autorização permite publicar qualquer imagem por ID conhecido. Não inclui listagem, exclusão, revogação de links nem gestão de credenciais. Upload não publica automaticamente. Segredo continua exibido somente uma vez. Sem novas dependências ou alteração da captura/galeria.

Aceitação: token autorizado publica idempotentemente; token comum recebe 403; inválido/revogado recebe 401; conteúdo público funciona sem login após revogação da credencial; owner conserva revogação; migração e reinício preservam permissões e credenciais.
