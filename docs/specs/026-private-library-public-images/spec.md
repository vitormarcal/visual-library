# Biblioteca privada e imagens compartilhadas

Escopo e fluxo de autenticação aprovados em 2026-10-24: proteger a biblioteca pessoal, permitir incorporar imagens escolhidas no blog e manter o Media Pulse integrado por credencial revogável. Implementação concluída e validada localmente, sem deploy. Após avaliação do backend, a autenticação será acrescentada ao backend atual, preservando a possibilidade de migração futura.

## Problema e objetivo

Hoje, quem alcança o servidor pode consultar todo o acervo e alterar imagens. Ocultar da galeria muda a apresentação, sem restringir acesso. Usar uma imagem no blog não deve abrir a biblioteca para visitantes ou crawlers.

O dono deve continuar salvando e redescobrindo referências com pouca fricção, enquanto libera explicitamente imagens individuais para uso externo. Autenticação atende um único dono; não cria um produto de gestão de usuários.

## Fluxos

### Acesso pessoal

- Sem sessão válida, abrir a biblioteca apresenta um login simples, sem imagens, tags, contagens ou outros dados do acervo ao fundo.
- Após entrar, o dono usa a biblioteca atual, incluindo captura, ocultos, busca, assuntos, similares e visualizador.
- Um UUID inédito em OWNER_RESET_KEY, aplicado ao iniciar, revoga senha/sessões e habilita definição de senha pela interface. O primeiro visitante que concluir assume o owner; esse risco foi explicitamente aceito para ambientes controlados. O hash da senha fica no banco e a mesma chave não dispara nova redefinição em reinícios, mesmo se outra chave tiver sido usada depois. Sem senha/comando, a biblioteca fica bloqueada. O backend verifica seu hash e cria uma sessão revogável; o navegador mantém apenas um cookie opaco HttpOnly e Secure em produção, enviado automaticamente nas requisições HTTPS.
- Há uma ação discreta para sair. Sessão encerrada ou expirada exige novo login para acessar dados privados.
- Ao sair ou perder a sessão, a interface limpa os dados privados carregados. Operações de alteração são protegidas contra requisições disparadas por outros sites.
- Captura pelo compartilhamento do sistema exige autenticação; uma tentativa sem sessão não salva nada nem informa sucesso. Recuperação dessa tentativa deve ser definida no plano, respeitando limitações do navegador e sem armazenar arquivos anonimamente.

### Imagem no blog

- No visualizador, o dono escolhe copiar um link público para a imagem atual. Essa ação libera explicitamente seu conteúdo.
- O link funciona diretamente em uma imagem do blog, sem login do leitor e sem depender da sessão do dono.
- Copiar novamente entrega o mesmo link enquanto ele estiver ativo.
- A resposta pública contém somente os bytes da imagem. Não oferece galeria, tags, origem, referências, relacionadas ou navegação pela biblioteca.
- O dono pode revogar esse link no mesmo contexto. Uma nova liberação gera outro link; o anterior permanece inválido.
- Revogar impede novas entregas pelo servidor, mas não remove cópias já baixadas ou em cache.
- Todas as imagens começam sem link público, inclusive as existentes. Ocultar/mostrar na galeria não publica nem revoga imagens.
- Excluir a imagem também invalida seu compartilhamento.

### Aplicações, incluindo Media Pulse

- Na página discreta Access, o dono cria tokens com nomes de aplicações e revoga cada um individualmente. Vários tokens podem coexistir, inclusive para a mesma aplicação. Todos têm as mesmas operações fixas de assets, sem editor de permissões.
- O segredo completo aparece somente na criação, com ação para copiar. Posteriormente, a interface mostra apenas sua identificação e estado.
- O Media Pulse mantém a credencial no servidor para acessar a API de assets existente: upload, consulta individual de metadados/conteúdo e correção de tags vinculadas a referências.
- A credencial não permite listar a biblioteca, usar sua interface, excluir imagens, gerenciar credenciais ou criar/revogar links públicos.
- Revogação bloqueia novas chamadas com a credencial antiga. Criar outro token não revalida um revogado nem revoga automaticamente os demais.
- Revogar a integração preserva imagens, referências, tags e links públicos já criados pelo dono.
- Credencial de integração não é incluída em URLs de imagens ou entregue a leitores do blog.

## Regras de UX e limites

- Seguir CONSTITUTION.md e DESIGN.md: imagem como foco, controles secundários e sem painel administrativo na navegação principal.
- Login não pede cadastro, perfil ou metadados de imagem. Após autenticar, captura continua sem formulários adicionais.
- Compartilhar exige uma ação explícita, com indicação breve de que qualquer pessoa com o link poderá acessar a imagem. Não adicionar confirmação modal ao copiar.
- Falha ao criar/copiar/revogar recebe feedback local e não indica sucesso antes da conclusão. Permitir copiar um link criado mesmo se a área de transferência falhar.
- Link público é estável, imprevisível e independente dos endereços internos. Conhecer um ID ou filename não libera conteúdo privado.
- Autorização é aplicada pelo servidor em todas as entradas privadas, incluindo originais, miniaturas e APIs. Esconder controles, robots.txt e noindex não substituem essa proteção.
- Recursos públicos necessários ao login e à instalação não podem conter dados do acervo. Respostas privadas não devem vazar por caches compartilhados.
- Preservar os dados e contratos existentes sempre que possível; a exigência de autenticação é uma mudança deliberada para os consumidores atuais e precisa de instruções de transição.
- A integração mantém o contrato atual de assets. Esta entrega não promete isolamento de propriedade por aplicação ou por referência.

## Fora do escopo

Cadastro público, vários usuários, papéis, permissões configuráveis, OAuth, login social, recuperação por email, catálogo de provedores ou editor de permissões, auditoria, quotas, coleções públicas, feed público, CMS, sincronização e novas funções do blog ou Media Pulse.

Não publicar automaticamente assets enviados por integrações. Automatizar publicação pelo Media Pulse exigiria uma decisão separada de produto.

## Critérios de aceite

1. Sem autenticação, interface, listagens, buscas, tags, referências, originais, miniaturas e alterações do acervo ficam inacessíveis, mesmo conhecendo URLs antigas.
2. Sessão válida permite os fluxos pessoais existentes. Sair impede novos acessos privados; requisições externas não podem usar a sessão do dono para alterar o acervo sem autorização.
3. Uma imagem só se torna pública por ação explícita do dono. Um visitante acessa seu conteúdo sem obter dados ou acesso a outras imagens.
4. Copiar novamente mantém o link ativo; revogar bloqueia a URL antiga no servidor; liberar novamente não a reativa. Exclusão também bloqueia o link.
5. Ocultação da galeria e publicação são independentes. Migração não publica imagens antigas.
6. Credencial válida permite somente as operações fixas da integração. Ausência, invalidez ou revogação da credencial impede essas chamadas, sem fallback anônimo.
7. Credencial de integração não autoriza interface, listagem, exclusão, publicação ou gestão de acesso. Revogá-la não quebra links públicos ativos.
8. Alterações preservam IDs, arquivos, tags, referências, deduplicação e navegação. Captura pessoal continua simples após login.
9. UUID novo invalida senha/sessões, sem revogar tokens de aplicações ou publicações. Apenas uma definição de senha por ciclo conclui, e telas de outro ciclo são recusadas. Documentar configuração inicial do dono, transição das integrações, efeito sobre URLs antigas e limites de revogação em conteúdo já baixado.
10. Autenticação permanece na fronteira HTTP, sem introduzir dependência de cookies ou sessões Nuxt nas regras da biblioteca. Uma futura troca de backend pode exigir novo login pessoal, preservando contratos HTTP, credenciais de integração e links públicos mediante migração dos respectivos dados.

## Próxima etapa

O [plano técnico](plan.md) detalha sessão pessoal, proteção de rotas, persistência de links/credencial, política de cache, transição dos consumidores e fronteiras para migração. Implementação e resultados registrados no plano; sem deploy ou alteração do acervo real.
