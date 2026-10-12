# Feature: API externa de assets

Status: implementada após aprovação da especificação, plano e pedido de continuidade do usuário em 2026-10-12. Validação em [plan.md](plan.md).

## Problema e objetivo

Aplicações pessoais precisam armazenar imagens e recuperar seu conteúdo por HTTP sem conhecer diretórios ou depender dos endpoints voltados à interface do Visual Library.

Permitir upload, obtenção de um identificador permanente e recuperação do original, reutilizando o acervo existente. O Visual Library continua responsável pelos arquivos e pela organização pessoal; cada consumidor mantém seus próprios domínios e metadados.

Esta extensão deve permanecer pequena e compatível com CONSTITUTION.md: sem transformar a biblioteca em plataforma de armazenamento, gerenciador genérico de mídia ou sistema de perfis.

## Decisões acordadas

- Assets externos podem fazer parte do mesmo acervo das imagens salvas pela interface.
- `source` identifica a origem do envio, por exemplo `visual-library` ou `media-pulse`.
- `hiddenFromGallery` permite ocultar uma imagem da navegação visual sem excluir o arquivo nem alterar o acesso HTTP por ID.
- Não adicionar `uploadedBy`, perfis, propriedade por usuário ou permissões nesta etapa.
- Não adicionar autenticação. O usuário aceita rotas acessíveis a quem alcançar o servidor; a comunicação entre serviços ocorrerá inicialmente na mesma rede Docker.
- Preservar endpoints e comportamento de captura atuais; o contrato externo fica em `/api/assets`.
- Não modificar nem integrar o Media Pulse nesta entrega.

## Fluxo do consumidor

1. Enviar uma imagem por `multipart/form-data`, identificando sua origem.
2. Receber o ID estável e metadados técnicos do asset.
3. Guardar esse ID junto aos metadados próprios da aplicação consumidora.
4. Consultar metadados ou recuperar o conteúdo usando o ID, sem conhecer nomes internos ou caminhos físicos.
5. Se repetir o envio dos mesmos bytes, receber a referência ao asset existente, respeitando a deduplicação atual.

## Contrato externo

| Operação | Comportamento |
| --- | --- |
| `POST /api/assets` | Recebe imagem multipart e retorna sua referência, inclusive em caso de duplicata. |
| `GET /api/assets/{id}` | Retorna metadados do asset; 404 quando inexistente. |
| `GET /api/assets/{id}/content` | Entrega o arquivo original pelo ID; 404 para registro ou arquivo inexistente. |

Usar o campo multipart `image`, preservando a convenção atual. A resposta deve fornecer pelo menos `id`, `mimeType`, `sizeBytes`, `createdAt`, `source` e `hiddenFromGallery`, sem tags, hash, URL de origem remota, filename ou caminhos físicos internos.

Dimensões não são requisito mínimo desta entrega. Não criar endpoint de thumbnail: o projeto não possui miniaturas geradas. Importação por URL permanece disponível no fluxo atual da interface e não faz parte do contrato externo desta etapa.

O ID deve permanecer estável se o arquivo for movido ou renomeado pelo Visual Library. O cliente nunca determina caminhos de armazenamento.

## Origem e visibilidade

`source` é uma identificação simples declarada pelo cliente, não uma identidade autenticada nem uma tag. Não criar cadastro de aplicações, taxonomia de origens ou tabela de perfis.

Imagens existentes e novos envios pela interface devem ter origem `visual-library` e continuar visíveis. Para a API externa, usar essa origem quando não informada. Assets novos ficam visíveis por padrão; o envio externo pode solicitar `hiddenFromGallery`.

O usuário deve conseguir identificar a origem e alterar a visibilidade de uma imagem com controles discretos, incluindo recuperar imagens ocultas por uma visualização explícita. A forma exata desses controles será detalhada no plano, preservando DESIGN.md e evitando uma nova tela administrativa.

Ocultar significa retirar da navegação padrão: Library, resultados de busca, galerias por assunto, imagens relacionadas e capas/contagens de Explore devem refletir o mesmo conjunto visível. Associações de tags e arquivos são preservados. Uma capa oculta não deve aparecer em Explore; o comportamento de substituição deve manter a estabilidade das demais capas válidas.

Um endereço interno antigo para uma imagem oculta deve respeitar sua ausência da navegação padrão e oferecer recuperação explícita, sem apagar o asset. Consulta e entrega pela API externa permanecem disponíveis, independentemente da visibilidade na galeria.

Ocultação é uma preferência de apresentação, não uma regra de segurança. Exclusão continua sendo a operação atual da biblioteca e remove a referência disponível aos consumidores. Não prometer retenção permanente apenas porque o ID é estável.

## Duplicatas e ciclo de vida

Reutilizar a deduplicação por bytes já existente. Um segundo envio não cria outro asset e não sobrescreve `source`, `hiddenFromGallery` ou a data do registro existente. A resposta informa os valores efetivos do asset reutilizado.

`source` representa a origem registrada no primeiro envio; não descreve todos os serviços que posteriormente referenciam o asset. Não registrar consumidores, histórico de uploads, contagem de referências ou retenção por aplicação.

Manter a resposta e o feedback de duplicata da interface compatíveis. Falhas de escrita ou persistência devem ter compensação para evitar arquivos e registros órfãos nas falhas tratáveis. Não prometer atomicidade entre banco e filesystem diante de interrupções abruptas do processo.

## Validação e entrega de conteúdo

- Validar o formato real dos bytes, sem aceitar um arquivo apenas pelo MIME ou pela extensão informados.
- Aceitar somente JPEG, PNG, WebP, GIF e AVIF; SVG continua excluído.
- Aplicar limite configurável, mantendo 15 MiB como padrão atual e tratamento coerente na interface.
- Aplicar a validação compartilhada aos fluxos de captura existentes, preservando arquivos de imagem legítimos enviados sem MIME correto pelo navegador.
- Entregar o original por streaming, com MIME correspondente ao formato validado e cabeçalhos de cache apropriados.
- Permitir exibição por `<img>` quando o navegador puder alcançar a URL do Visual Library. O hostname interno da rede Docker não é necessariamente acessível ao navegador.
- Não adicionar CORS amplo; chamadas entre backends não exigem essa configuração.

## Compatibilidade e apresentação

Não alterar a experiência de salvar por upload, paste, drop ou URL. Tags continuam opcionais e pessoais; origens externas não se tornam tags nem recebem sincronização automática.

Preservar navegação, visualizador e histórico existentes. Os únicos acréscimos visuais devem atender à identificação de origem e ao controle de visibilidade, sem badges permanentes em cada imagem, formulários adicionais de captura ou painéis de metadados.

## Fora do escopo

- Alterações no Media Pulse ou integração entre aplicações.
- Sincronização de tags ou coleções; metadados de domínio dos consumidores.
- `uploadedBy`, perfis, contas, autenticação ou autorização.
- Exclusão pela API externa e retenção por consumidor.
- Novo mecanismo de armazenamento, S3, MinIO ou múltiplos provedores.
- Nova entidade de asset independente das imagens existentes.
- Miniaturas, transformações, processamento complexo ou deduplicação adicional.
- Workers, filas, serviços separados ou abstrações genéricas.

## Critérios de aceitação

- Upload válido retorna ID estável e metadados; arquivos inválidos e acima do limite são rejeitados sem persistência indevida.
- Arquivo disfarçado por MIME/extensão permitidos é rejeitado; imagem legítima sem MIME correto continua utilizável.
- Duplicata retorna o ID existente sem alterar origem, visibilidade, data ou quantidade de registros/arquivos.
- Consulta por ID existente funciona; ID inexistente retorna 404. Respostas não expõem caminhos ou nomes internos de armazenamento.
- Conteúdo original preserva os bytes, usa MIME correto, streaming e cache apropriado; arquivo ausente retorna 404.
- Assets externos usam o acervo atual e permitem origem e visibilidade; imagens antigas continuam visíveis como `visual-library`.
- Ocultar/mostrar preserva ID, bytes e tags. Ocultos deixam de aparecer em todas as superfícies padrão de descoberta, inclusive capas, contagens e relacionadas, e podem ser recuperados explicitamente.
- Exclusão atual continua funcionando; referências externas ao asset excluído retornam 404.
- Interface e endpoints atuais preservam seus contratos e fluxos legítimos de upload, URL e deduplicação.
- Testes usam acervo temporário e não alteram os dados pessoais. Cobrir upload, validação real, limite, metadados, original, duplicatas, falhas tratáveis e compatibilidade existente.
- Documentar exemplos de requests/respostas, migrações, acesso HTTP sem autenticação, diferença entre endereço Docker e endereço acessível ao navegador, e consequências da exclusão.

## Próxima etapa

O plano técnico está em [plan.md](plan.md), incluindo migração aditiva, contrato dos campos multipart, tratamento de falhas e controles mínimos de visibilidade. Resultados da implementação e validação estão registrados no plano; uso e limitações em [assets-api.md](../../assets-api.md).
