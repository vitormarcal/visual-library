# Tags dos filtros no upload

## Problema e objetivo

Salvar referências num contexto já filtrado exige repetir manualmente as mesmas tags. Novas imagens devem receber as tags explicitamente selecionadas na navegação, com indicação prévia discreta na área de captura.

## Comportamento e critérios de aceite

- A área Save images informa “New images will receive these tags:” e mostra os nomes antes do envio, seguindo o idioma atual da interface.
- Library usa os filtros de tags; um assunto aberto usa sua tag e os refinamentos selecionados. Explore geral e navegação sem filtros não atribuem tags.
- Busca textual e modo de imagens ocultas não geram tags nem mudam a visibilidade das novas imagens.
- Escolher arquivos, arrastar, colar imagem e colar URL usam o mesmo contexto.
- Cada lote captura as tags ao começar e mantém esse contexto se a navegação mudar ou houver retry de falhas.
- Tags e imagem nova são persistidas juntas; duplicatas continuam sem alterações.
- Sem novos modais, confirmação, formulário obrigatório, dependências ou configuração. Para salvar sem tags do contexto, remover os filtros ou sair do assunto antes do envio.
- Permanecem os limites existentes de oito tags e 48 caracteres.
