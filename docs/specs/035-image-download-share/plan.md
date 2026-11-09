# Implementação

- Componente específico ImageFileActions no rodapé existente do detalhe; link download para a rota privada do original.
- Nome de download conserva extensão do arquivo armazenado e usa nome original quando disponível.
- Detectar suporte real a arquivos com canShare. Fetch autenticado sob demanda, AbortController e descarte na desmontagem; componente recriado por ID da imagem.
- Compartilhar somente files. Quando o carregamento consumir a ativação do toque, guardar um único File no detalhe e solicitar novo toque. Cancelamento silencioso; falhas com retry e alternativa Download.
- Sem mudanças de API, armazenamento ou publicação.

## Validação local

- `npm run build` passou.
- Smoke do componente compilado com Vue e APIs nativas simuladas: sem fetch ao montar, nome/extensão do original, preparo sob demanda, segundo toque após perda de ativação, envio de File, cancelamento silencioso, falha/retry e abort/descarte na desmontagem. Roteiro temporário: `/tmp/visual-library-035-check.mjs`.
- Inspeção da composição: controles flexíveis com quebra de linha e altura mínima de 44 px; componente no rodapé do detalhe, sem alterar ampliação ou histórico.
- A operação real do menu nativo, layout em navegador móvel e a escolha entre Arquivos/Fotos ainda exigem validação em navegador/aparelho. O smoke simulado não comprova essas integrações.


## Release 0.28.0

Publicação e atualização do Mordor autorizadas pelo usuário em 09/11/2026. 95 testes passaram; imagem Docker passou no smoke Chrome isolado: setup/login, upload, detalhe móvel, download com bytes e nome do original, compartilhamento com API nativa simulada, larguras 320/390/768/1440 px e nenhum erro JavaScript. Roteiro: `/tmp/visual-library-028-browser.mjs`. Menu nativo real ainda depende de aparelho físico.
