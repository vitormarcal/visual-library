# Plano e implementação

Base: [spec.md](spec.md). Escopo atualizado por decisão do usuário: definição de senha pela interface após comando de reset via ambiente; tokens nomeados por aplicação. A captura do owner pelo primeiro visitante durante setup foi aceita explicitamente para ambiente controlado. Sem migração de backend ou armazenamento.

## Acesso e fronteiras

Manter Nuxt/Nitro, SQLite e arquivos locais, sem dependências novas. Funções em `server/access-store.ts` recebem configuração/valores simples e não dependem de H3/Nuxt/cookies. Adaptadores em auth, middleware, plugin e handlers interpretam HTTP e autorizam antes das operações privadas. Frontend depende dos contratos HTTP; outra implementação pode exigir novo login, preservando tokens, IDs e URLs.

Origem privada obrigatória `NUXT_LIBRARY_ORIGIN`, canônica e HTTPS fora de localhost. `OWNER_RESET_KEY` é um UUID opcional lido somente no startup; configuração privada alternativa `NUXT_OWNER_RESET_KEY` tem a mesma semântica. Validação de formato/origem é síncrona no plugin Nitro, pois plugins assíncronos não bloqueiam startup da mesma forma. Um hook de request aguarda a inicialização do banco/reset antes de atender qualquer rota.

## Definição e recuperação de senha

Tabelas novas `owner_credentials` (singleton com password_hash ou setup_generation) e `owner_reset_commands` (hash de UUID aplicado e data). No startup, uma transação IMMEDIATE identifica UUID novo, apaga senha e sessões, cria geração pública aleatória e registra o comando. A identificação em minúsculas torna caixa irrelevante. Manter todo o histórico de hashes impede que A→B→A dispare novamente.

O comando é registrado como aplicado quando abre o ciclo, antes de definir a senha. Reinício com a mesma variável mantém o estado pendente ou pronto, sem revogar novamente. Remover variável também preserva o estado no banco. Sem senha/comando, o estado é bloqueado. Tokens de aplicações e publicações ficam independentes dessa transação.

`GET /api/auth/session` retorna authenticated/state/generation. `POST /api/auth/setup` recebe senha, confirmação e geração; não pede prova de posse do UUID. Validar 12–1024 caracteres e confirmação, calcular scrypt assíncrono, depois executar UPDATE condicional/transação para confirmar que a geração ainda está pendente. Apenas uma tentativa vence. Resposta 409 para formulário ultrapassado/concorrente. Encerrar ciclo e limpar sessões conjuntamente. Pedir login após salvar.

`POST /api/auth/login` verifica hash atual persistido; INSERT de sessão revalida o hash para impedir emissão baseada em verificação anterior a reset concorrente. Cookie opaco HttpOnly/Secure/SameSite=Lax; banco guarda hash do token, fingerprint do hash atual e validade absoluta de 30 dias. Logout invalida no banco e expira cookie.

Login/setup compartilham limites por IP/global e duas operações concorrentes; parsing limitado antes da derivação. CSRF exige origem canônica e cabeçalho de intenção; setup é anônimo somente no ciclo armado. Não criar modo público, cadastro, email ou recuperação adicional. Remover ferramenta e configuração antigas de hash no ambiente.

## Autorização, conteúdo e aplicações

Middleware protege todas as rotas privadas por padrão, antes de ler uploads, executar buscas/workers ou responder 304. Exceções explícitas: shell sem dados privados, estáticos necessários, status/login/setup e conteúdo público de token válido. Sem sessão, API/arquivo é 401; operação fora das permissões é 403. Bearer inválido não cai na sessão como alternativa.

Tabela `application_tokens` com UUID, nome de até 80 caracteres, hash SHA-256 do token aleatório, prefixo, criação e revogação. `GET/POST /api/access/tokens` e `DELETE /api/access/tokens/{id}` exigem owner; segredo só na criação. Nomes não precisam ser únicos, permitindo troca com coexistência. Nenhum nome implica isolamento de dados ou permissão diferente.

Todos os tokens permitem exclusivamente POST /api/assets, GET /api/assets/{id}, GET /api/assets/{id}/content e PUT /api/assets/{id}/references/tags. Não autorizam interface/listagem/exclusão/buscas/gestão/publicação. Migrar transacionalmente a credencial fixa anterior para a lista, preservando segredo/revogação; aceitar prefixo legado. Remover tabela antiga para evitar reimportação após revogar.

Links públicos existentes continuam vinculados à imagem, não à senha ou a um token de aplicação. Gestão GET/POST/DELETE /api/images/{id}/public-link é exclusiva do owner. POST idempotente enquanto ativo; revogação remove vínculo, nova publicação cria outro token. Exclusão remove vínculo na transação existente. GET/HEAD /shared-images/{token} entrega somente conteúdo, sem IDs/tags/URLs internas; ausentes/revogados retornam 404. Não publicar uploads automaticamente.

Originais, miniaturas, metadados e públicos usam no-store. ETag opaco/304 após autorização. Sem diretório data público. Cache anterior de um ano e cópias baixadas não podem ser revogados retroativamente.

## Interface e captura

Shell monta login, setup, estado bloqueado ou conteúdo autenticado, sem requests privados prévios. Setup tem nova senha/confirmação; sem pedir UUID. Ao salvar, volta ao login. LibraryApp mantém captura e navegação existentes. Cliente HTTP injeta intenção e trata 401 cancelando requests/descartando respostas da sessão anterior.

Link Access abre `/?access=1`, página pequena para criar/copiar/listar/revogar tokens nomeados. Nome não é convertido em tags ou source. Sem dashboard, scopes configuráveis, catálogo de provedores ou usuários adicionais. Segredo sai da tela no reload; cópia manual alternativa disponível. Publicação individual continua nos controles secundários do viewer, com proteção contra respostas de outra imagem.

Web Share Target exige sessão e origem válida (ou Fetch Metadata same-origin se Origin ausente). Sem sessão, redireciona ao login pedindo compartilhar novamente; não lê ou retém payload anônimo. Conferência física permanece necessária; não afrouxar CSRF para preservar uma integração de navegador não verificada.

## Validação e entrega

Testes HTTP com SQLite/arquivos temporários cobrem bloqueio inicial, UUID novo/reutilizado/removido, confirmação, concorrência e geração ultrapassada, sessões/revogação/expiração, login concorrente com reset, CSRF, limites, múltiplas aplicações e revogação independente, migração legada, reinício, publicações e métodos/rotas proibidos. Preservar regressões de armazenamento/metadata/processamento. Sem bypass de auth para fixtures.

Executar npm test, build Nuxt, build Docker e smoke com rede desabilitada/volume temporário. Navegador desktop/mobile emulado cobre setup/login, Access, tokens, links públicos, logout, 401, reload e recuperação após restart. Documentar resultados abaixo e operação em [access-and-sharing.md](../../access-and-sharing.md).

Não alterar versão, publicar imagem Docker, fazer deploy, modificar Media Pulse ou usar o acervo real nesta entrega.

## Resultados

- `npm test`: **66 testes aprovados**, sem skips. Cenários novos exercitam ciclo de reset, concorrência de definição, confirmação, formulário de geração anterior, login verificado antes de reset, reutilização de UUIDs antigos, remoção da variável, persistência da senha e revogação independente de tokens. Migração de token legado foi conferida em processo separado e reabertura, sem restaurar token revogado.
- `npm run build` e build Docker passaram. Sem dependências novas, mudança de versão ou deploy. Permanecem avisos conhecidos de sourcemap e externalização de node:sqlite.
- Chrome desktop 1440×900 e mobile emulado 390×844: definição e confirmação pela interface, login, publicação/revogação individual, página Access, dois tokens nomeados, revogação independente, segredo ausente após reload, logout e limpeza após 401 passaram sem exceções JS ou overflow. Layout mobile revisado visualmente; estilos da página Access separados dos da tela de login. Artefatos sintéticos em `/tmp/visual-library-owner-browser-cHGoqG`.
- Reinício real do Nitro no smoke de navegador: mesma chave preserva senha/sessão; chave nova revoga senha/sessões e reabre setup; reutilizar a primeira chave depois da segunda não redefine; variável removida preserva senha. Token de aplicação e URL pública permanecem ativos durante a recuperação.
- Contêiner com rede desabilitada, dois CPUs/2 GiB e volume temporário: recusa de configuração de origem ausente, definição de senha, login, upload, token nomeado, conteúdo público GET/HEAD, logout e reinício com mesma chave aprovados. Volume de teste removido ao concluir; nenhum acervo/modelo de produção usado.
- Ferramenta antiga de geração manual de hash removida; senha agora é definida pela interface e persistida como hash no banco. Documentação operacional e backlog atualizados para o fluxo aprovado.

Limites: primeiro visitante que concluir o setup assume o owner, conforme aceitação explícita; UUID é comando de administração, não prova de posse. Não houve alteração no Media Pulse, publicação de imagem Docker, commit ou deploy. Web Share Target precisa de conferência física no celular; emulação não comprova origem/cookies do lançamento pelo sistema. Sem medição de desempenho no acervo real ou teste de leitor de tela.

## Versionamento autorizado

Após a validação, o usuário solicitou avanço de versão, commit e push. Versão atualizada de 0.14.0 para **0.15.0** em package.json e package-lock.json. Publicação de imagem Docker e deploy permanecem fora dessa solicitação.
