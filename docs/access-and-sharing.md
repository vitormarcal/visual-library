# Acesso pessoal, aplicações e imagens públicas

A biblioteca e seus arquivos internos exigem autenticação. O dono usa senha/sessão; aplicações usam tokens nomeados; leitores e crawlers acessam apenas links públicos individuais. Ocultação da galeria não altera autorização ou publicação.

## Primeiro acesso ou recuperação

Configurar o processo/container:

```dotenv
NUXT_LIBRARY_ORIGIN=https://biblioteca.exemplo.com
OWNER_RESET_KEY=11111111-1111-4111-8111-111111111111
```

O UUID acima é ilustrativo: gerar um novo, por exemplo com `node -e 'console.log(crypto.randomUUID())'`. `OWNER_RESET_KEY` é um comando de redefinição, não uma senha ou chave solicitada no navegador. A origem deve ser canônica, sem barra final/caminho/query; HTTPS é obrigatório, exceto HTTP em localhost/127.0.0.1/::1 durante desenvolvimento.

1. Ao iniciar com um UUID ainda não utilizado, o backend apaga o hash da senha do owner e revoga todas as suas sessões. Armazena somente o hash do UUID aplicado e abre uma geração de configuração.
2. Abrir a biblioteca apresenta **Set your owner password**, sem imagens ou outros dados privados. Não pede o UUID. Informar senha e confirmação, de 12 a 1024 caracteres.
3. O backend calcula scrypt, grava somente o hash da senha no SQLite e encerra aquela geração atomicamente. Entre tentativas simultâneas, apenas uma conclui.
4. Entrar com a nova senha. O UUID já foi registrado como aplicado no início do ciclo; reiniciar durante ou depois da configuração não dispara outro reset.
5. A variável pode ser removida depois. Para recuperar o acesso novamente, configurar outro UUID e reiniciar.

**Decisão de uso em ambiente controlado:** qualquer visitante pode concluir a definição enquanto esse modo estiver aberto. O primeiro que conseguir concluir se torna owner. O usuário aceitou esse comportamento para configurações e recuperações ocasionais. O UUID não funciona como prova de posse no navegador.

Todos os UUIDs aplicados permanecem registrados como hashes: reutilizar um valor antigo, inclusive após usar outro, não redefine nada. UUIDs com letras em outra caixa representam o mesmo comando. Remover a variável não cancela uma configuração pendente já registrada no banco. UUID inválido ou origem inválida impedem inicialização.

Sem senha e sem comando aplicado, a aplicação inicia **bloqueada** e orienta configurar a variável. Não libera definição anônima sem o comando. Depois de existir senha no banco, ela funciona sem OWNER_RESET_KEY no ambiente. Não existe mais NUXT_OWNER_PASSWORD_HASH nem gerador manual de hash.

Preservar o volume `/app/data`, incluindo SQLite e imagens. Arquivos `.env` locais são ignorados pelo Git/contexto Docker. O proxy deve servir interface/API/imagens na mesma origem, encaminhar cookies e respeitar no-store. Nunca publicar o diretório data diretamente. Host/X-Forwarded-Host/For enviados pelo visitante não são prova de identidade/origem.

## Sessão pessoal e contrato HTTP

Em HTTPS, cookie `__Host-vl_owner_session`; em HTTP local de desenvolvimento, `vl_owner_session`: token opaco de 32 bytes aleatórios base64url, HttpOnly, SameSite=Lax, Path=/, sem Domain, Secure em HTTPS, validade absoluta de 30 dias. O banco guarda SHA-256 do texto do token e fingerprint do hash da senha atual. Logout remove a sessão. Redefinição apaga senha e sessões em uma transação. Login revalida o hash antes de emitir sessão para não aceitar uma senha verificada antes de um reset concorrente. Em HTTPS, o nome antigo sem prefixo não é aceito como alternativa; após atualizar para essa proteção, entrar novamente no navegador. Senha, tokens e links permanecem.

| Método e rota | Resposta/comportamento |
| --- | --- |
| `GET /api/auth/session` | `{ authenticated, state, generation }`: state é `blocked`, `setup` ou `ready`. Generation é um identificador público de ciclo, não um segredo; null fora do setup. |
| `POST /api/auth/setup` | JSON `{ password, confirmation, generation }`; grava a senha somente se a geração ainda estiver pendente. Retorna `{ authenticated: false, state: "ready", generation: null }`. Exige login depois. |
| `POST /api/auth/login` | JSON `{ password }`; emite cookie e retorna `{ authenticated: true }`. |
| `POST /api/auth/logout` | Invalida sessão e expira cookie; retorna `{ authenticated: false }`. |

Setup/login e alterações com sessão exigem Origin igual à configuração e `X-Library-Request: 1`; Fetch Metadata incompatível é recusado. A interface acrescenta o cabeçalho. Setup não exige cookie ou UUID secreto, por decisão de produto. Tela antiga de setup recebe 409 se outro ciclo começou ou alguém já definiu a senha. Senhas inválidas/confirmações diferentes retornam 400; senha incorreta 401, origem inválida 403, excesso de corpo 413, limite de tentativas 429/Retry-After.

Setup e login compartilham limite de dez tentativas por IP da conexão e sessenta globais por minuto, no máximo duas derivações concorrentes. Não confia em cabeçalhos arbitrários de proxy; atrás de proxy o limite por IP pode ser compartilhado. Limites são locais ao processo. Vagas de derivação só são reservadas após ler o JSON; a leitura do corpo de login/setup tem prazo de dez segundos (408 ao exceder). Corpo de login até 4 KiB e setup até 16 KiB, com senha até 1024 caracteres.

Ao receber 401, a interface desmonta dados privados e cancela requisições pendentes; respostas de outra sessão são descartadas. Também verifica a sessão ao recuperar foco/visibilidade e a cada minuto enquanto autenticada e visível.

## Tokens por aplicação

Depois de entrar, abrir **Access** (`/?access=1`). Informar um nome, como Media Pulse ou Blog, e criar uma credencial. O segredo aparece uma única vez com cópia/campo selecionável. Manter no servidor consumidor e enviar:

```http
Authorization: Bearer vl_app_...
```

Cada token tem ID próprio, nome, prefixo de identificação, data e estado de revogação. É possível ter mais de um token com o mesmo nome, para trocar credenciais sem interromper o consumidor: criar novo, atualizar a aplicação e revogar o antigo. A lista nunca devolve segredo ou hash. Revogar um não afeta os demais, a senha do owner ou links públicos.

Todos os tokens têm o mesmo conjunto fixo de operações:

- `POST /api/assets`.
- `GET /api/assets/{id}`.
- `GET /api/assets/{id}/content`.
- `PUT /api/assets/{id}/references/tags`.

Não autorizam listagem da biblioteca, interface, exclusão, busca/processamento, gestão de acesso ou publicação. O nome é identificação; não cria propriedade/isolamento de assets por aplicação. `source` e `application` continuam metadados declarados. Tokens não são enviados em query, HTML do blog ou URLs de imagens. Bearer inválido não cai na sessão como alternativa.

Gestão exige sessão do dono: `GET /api/access/tokens` lista `{ id, name, prefix, createdAt, revokedAt }`; `POST` recebe `{ name }` de 1–80 caracteres após trim e retorna esses campos mais `token` somente na criação; `DELETE /api/access/tokens/{id}` revoga idempotentemente. POST/DELETE exigem proteção de origem. O consumidor é atualizado manualmente; esta entrega não altera o Media Pulse.

Credenciais fixas da implementação anterior são migradas para a lista, preservando hash/prefixo/data/revogação e aceitando seu formato `vl_mp_`. A tabela antiga é removida após migração transacional para não restaurar tokens revogados em reinícios. O hash de senha anteriormente configurado no ambiente não é importado: usar um UUID novo para definir a senha no banco. Sessões antigas não dão acesso sem a senha atual persistida.

## Links públicos

No visualizador, **Create and copy public link** publica somente aquela imagem. A URL funciona em img do blog, sem login, e não oferece galeria, tags ou navegação. Copiar novamente reutiliza o mesmo link. Se clipboard falhar, copiar o campo exibido.

**Revoke public link** impede novas entregas; publicar novamente gera outro endereço. Exclusão também remove o vínculo. Ocultar/mostrar na galeria e uploads por aplicações não publicam nem revogam. Redefinir o owner preserva os tokens das aplicações e links públicos, inclusive enquanto a senha está pendente.

Rotas pessoais `GET/POST/DELETE /api/images/{id}/public-link` consultam/criam/revogam, retornando `{ url: string | null }`. Público `GET/HEAD /shared-images/{token}` entrega somente conteúdo e cabeçalhos de imagem. Inválidos, revogados ou ausentes retornam 404. Não existe listagem pública.

Respostas privadas/públicas usam `Cache-Control: no-store`. ETag/304 só são avaliados depois da autorização. URLs internas antigas passam a exigir sessão ou, para conteúdo de assets, Bearer. Não são publicadas automaticamente. Cópias baixadas e caches de um ano emitidos antes da autenticação não podem ser revogados retroativamente.

## Armazenamento e migração futura

`server/access-store.ts` recebe valores simples e configuração explícita, sem cookies, H3Event ou runtime Nuxt. Adaptadores HTTP resolvem e autorizam identidade. Frontend depende dos contratos HTTP e de cookie opaco. Outra implementação de backend pode pedir novo login pessoal, preservando dados, tokens e URLs.

- Senha: `scrypt-v1$<sal hex de 16 bytes>$<chave hex de 64 bytes>`, N=16384, r=8, p=1. Sal usado como string hexadecimal UTF-8; comparação em tempo constante.
- Comando: SHA-256 hexadecimal do UUID em minúsculas e data ISO. Uma linha singleton guarda hash da senha ou geração pendente de setup. Sem guardar UUID bruto ou senha bruta.
- Sessão: SHA-256 hexadecimal do texto do token; timestamps em milissegundos e fingerprint SHA-256 do texto completo do hash da senha.
- Aplicação: prefixo `vl_app_` + 32 bytes base64url sem padding, ID UUID, SHA-256 hexadecimal do texto completo, nome, prefixo e datas ISO. Tokens legados `vl_mp_` continuam válidos até revogação.
- Compartilhamento: 32 bytes base64url persistidos como texto com vínculo/data para recuperar o mesmo link.

Não exige banco compartilhado entre backends ativos, JWT ou outro serviço de identidade.

Compartilhamento pelo sistema do celular ainda requer validação física. Sem sessão, redireciona ao login pedindo compartilhar novamente, sem ler/reter arquivos. Com sessão, exige Origin canônico ou, se ausente, Fetch Metadata same-origin. Não repete POST perdido automaticamente.


## Revisão de segurança

[Achados, correções e limites](security/review-2026-10-24.md): cookie __Host em HTTPS, CSP com nonce para scripts de produção, bloqueio de iframe, HSTS e validação de DNS no socket da captura remota. O proxy precisa preservar esses cabeçalhos. Scripts de terceiros e frames não fazem parte da interface; imagens públicas continuam incorporáveis em outros sites. Capturas por URL recusam DNS misto público/privado, endereços especiais e URLs com credenciais. Isso substitui a validação DNS anterior de melhor esforço.
