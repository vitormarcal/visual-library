# Plano — capas compartilhadas de pastas com uma imagem

Status: implementação autorizada pelo usuário e concluída localmente. Versão, commit, push e release 0.25.0 autorizados posteriormente pelo usuário; deploy em produção permanece separado.

1. Derivar cartões de apresentação a partir das pastas já filtradas: agrupar somente membros únicos com o mesmo ID de imagem. Manter cada pasta e sua URL; ordenar pela primeira pasta alfabética. Sem persistência ou comparação por nomes/aparência.
2. Reutilizar a apresentação de capa em um componente específico. Pastas individuais continuam abrindo pelo cartão inteiro; cartões compartilhados mostram uma capa e links separados, sem escolher uma tag arbitrária. Limitar a lista inicial a três nomes e permitir expansão explícita.
3. Paginar os cartões visuais, não a quantidade original de tags. Para restaurar foco, localizar o cartão que contém o ID da pasta e expandir seus nomes se necessário, inclusive após reload.
4. Cobrir agrupamento, busca filtrada, IDs distintos, pastas com vários membros e separação automática com testes. Executar suíte/build e verificar em Playwright com dados isolados: links individuais, tags de captura, expansão, foco/histórico, alterações de membros, imagens indisponíveis e mobile.

Não alterar a conta de produção nem suas tags/imagens durante a validação. A inspeção real anterior é somente evidência do problema; preview e mutações usam fixtures.

## Resultado e validação

- `sharedSingleImageFolderCards` compõe os cartões a partir das pastas já filtradas. Somente pastas com um membro visível conhecido compartilham uma capa pelo ID dessa imagem. Preservadas as identidades, URLs, contagens e a ordem alfabética dos nomes; pastas com vários membros e IDs diferentes permanecem separadas.
- `FolderCover.vue` reaproveita a apresentação da capa nos cartões individuais e compartilhados. Pastas individuais mantêm o clique no cartão; nas compartilhadas, clicar na capa revela as escolhas e foca um nome, sem navegar automaticamente. Links separados abrem a tag correta.
- Listas compartilhadas mostram três nomes inicialmente; a expansão explícita mantém o acionador antes dos nomes adicionais. Paginação considera cartões visuais. A restauração procura o ID da pasta dentro do cartão e expande a lista quando o nome estava recolhido, inclusive após reload e além do primeiro lote.
- Agrupamento, separação e busca são derivados em memória. Nenhuma tabela, associação persistida, duplicação de arquivo, infraestrutura ou dependência foi adicionada. Entrega incluída na versão 0.25.0.

### Checks

- `npm test`: 91 testes aprovados, sem skips. Os três novos testes cobrem ordem e preservação de identidades, não mutação dos dados, membros/IDs diferentes, separação por nova imagem, ocultação, consulta filtrada, capas ausentes e agrupamento antes da paginação.
- `npm run build` e `git diff --check`: passaram. DESIGN.md atualizado para o comportamento visual.
- Playwright/Chrome headless com biblioteca e sessão isoladas em `/tmp/visual-library-033-app-EVYHPB/`. Quatro PNGs sintéticos com dez tags reproduziram três grupos compartilhados e uma pasta com vários membros. Filtrar por American Jesus mostrou nove pastas em quatro cartões, sem retirar nenhum acesso.
- Clique na capa não trocou o destino. Escolher o segundo nome abriu a tag esperada; upload real de fixture nesse contexto recebeu apenas essa tag. A pasta ganhou um cartão próprio ao passar a dois membros; o arquivo anterior não foi copiado. O arquivo de teste foi removido depois, restaurando o agrupamento original.
- Verificados busca por um único nome, detalhe/ampliação, retorno ao nome escolhido, teclado, foco e layout sem overflow em 320, 390, 768, 1440 e 1920px. Capturas desktop/mobile inspecionadas.
- Um grupo com onze nomes validou expansão/recolhimento e retorno automático ao nome inicialmente oculto. Mais 35 imagens sintéticas com pastas distintas colocaram o grupo além do primeiro lote: reload do detalhe, retorno, foco/scroll e Voltar/Avançar passaram. Os dados extras foram retirados da fixture ao terminar.
- Falha controlada de thumbnails preservou nomes e links. Busca e acesso à pasta continuaram funcionando no viewport móvel. Rodadas funcionais finais sem exceções JavaScript.

Scripts e capturas em `/tmp/visual-library-033-*.mjs`, `/tmp/visual-library-033-*.log` e no diretório da fixture. Não foram importadas imagens privadas para o repositório nem executadas mutações no acervo real. A avaliação móvel é por viewport emulado; não constitui teste em celular físico nem auditoria completa de acessibilidade. As pendências de tipagem/streams já registradas nas entregas anteriores não fazem parte deste ajuste.

## Ajuste posterior — ordenar por quantidade

Solicitado pelo usuário após uso da 0.25.0: priorizar pastas maiores na busca, pois há predominância de tags com uma imagem. Aplicar a mesma ordem no diretório sem consulta para manter consistência. Reaproveitar a ordenação por membros visíveis únicos já calculada em `groupImagesByTag`; na composição dos cartões, ordenar por quantidade decrescente, nome e ID. O número de tags numa capa compartilhada não soma imagens. Sem controles novos, persistência ou alteração da ordem das imagens dentro das pastas.

Testes focados: oito aprovados, incluindo consulta vazia e preenchida, contagens distintas, empate por nome, duplicatas/ocultas e separação de capa compartilhada quando uma pasta ganha outro membro.

Validação da entrega: suíte completa com 92 testes aprovados; build local aprovado.

Entrega do ajuste na versão 0.26.0, com commit, push e publicação das tags Docker `0.26.0` e `latest` autorizados pelo usuário. Deploy em produção permanece separado.
