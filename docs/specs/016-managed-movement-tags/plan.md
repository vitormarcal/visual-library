# Plano

Adicionar coluna personal em image_tags (default 1 para preservar o legado), tabela asset_reference_tag_groups com tags JSON e revisão por referência/grupo. Reutilizar a transação síncrona e reconciliar capas. Upload aceita managedTags opcional junto à referência; PUT /api/assets/{id}/references/tags atualiza uma associação existente. Edição individual preserva procedência das tags inalteradas e marca novas tags como pessoais; adição em lote protege as tags explicitamente escolhidas. A atualização não reaplica termos inalterados que foram removidos manualmente. Rejeitar limite/conflito sem alterar o estado. Revisão monotônica evita respostas antigas sobrescreverem correções novas.

Arquivos: server/db.ts, server/image-upload.ts, novo handler PUT, docs/assets-api.md e testes isolados. Sem dependências ou frontend novo. Executar npm test, npm run build e smoke isolado com Media Pulse.

Validação concluída: 43 testes sem falhas ou skips e build de produção. Smoke isolado com Media Pulse e PostgreSQL confirmou upload e correção de múltiplos assets, tags pessoais e referências compartilhadas, limite com rollback, retry após liberar espaço e reinício do serviço preservando revisões. Interação no navegador do Media Pulse validada em 390 e 1280 px. A ausência de procedência no legado é tratada conservadoramente: as tags existentes permanecem pessoais e a resposta informa sua preservação.

Publicação autorizada pelo usuário: Media Pulse 1.2.0 e Visual Library 0.7.0, com commit e push em ambos os repositórios.
