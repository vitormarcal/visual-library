# Instalação e captura pelo compartilhamento

Escopo solicitado em 2026-10-18: abrir a biblioteca sem a barra do navegador e receber conteúdo do menu Compartilhar. Modo offline explicitamente excluído.

- Instalar com nome e ícone próprios e abrir em janela standalone, mantendo a experiência web atual.
- Nos sistemas compatíveis, selecionar Visual Library ao compartilhar imagens ou um link direto de imagem salva o conteúdo e abre Library com um resultado discreto e dispensável.
- Reutilizar formatos aceitos, validação dos bytes, limite configurado, deduplicação e persistência existentes. Um arquivo inválido não impede os demais do lote.
- Arquivos têm precedência sobre texto/URL acompanhantes. Links diretos enviados no campo de texto também funcionam, conforme comportamento comum do Android.
- Compartilhamento começa sem filtros ou tags implícitas; duplicatas não recebem alterações.
- Informar sucesso, duplicatas, falhas parciais e conteúdo inválido. Recompartilhar permite tentar novamente e não duplica itens já salvos.
- Links de páginas/posts não são extraídos: explicar que é necessário compartilhar o arquivo ou endereço direto da imagem.
- Nenhum modal, promoção automática de instalação, modo offline, fila, sincronização, notificações, dependência ou configuração nova.
- Instalação requer HTTPS (ou localhost no desenvolvimento); registro no menu Compartilhar depende do suporte do sistema/navegador e da instalação. Não prometer paridade com o iPhone.
- Lotes limitados a 20 arquivos; corpo total limitado ao tamanho configurado de imagem mais 64 KiB de envelope multipart. Compartilhamentos maiores devem ser divididos.

Aceite: manifest e ícones válidos, Docker inclui os recursos públicos, POST valida e salva, resposta 303 evita reenvio no reload, Library exibe resultado sem manter parâmetros transitórios, navegação atual preservada. Validar instalação/compartilhamento físico separadamente dos testes HTTP e navegador.
