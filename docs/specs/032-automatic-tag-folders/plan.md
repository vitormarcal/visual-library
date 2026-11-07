# Plano — pastas automáticas por tag

Status: implementação autorizada pelo usuário após a spec 032 e concluída localmente. Sem mudança de versão, commit, publicação ou deploy nesta etapa.

1. Acrescentar o destino `folders` à navegação existente, mantendo `subject` e seus links antigos como detalhe da pasta. Guardar um snapshot próprio de Pastas, compatível com entradas de histórico anteriores, e restaurar consulta, posição e foco no retorno.
2. Derivar as pastas dos agrupamentos por tag existentes: somente imagens visíveis, contagem única, ordenação alfabética e até três imagens distintas por capa. Reutilizar a capa principal estável da tag e selecionar complementares de forma determinística. Sem tabela ou lista de membros adicional.
3. Transformar o diretório visual em grade regular de pastas, com capa composta e identificação abaixo. Usar duas colunas em 390 px e uma quando necessário. Preservar carregamento por lotes e retorno a cartões já renderizados.
4. Acrescentar Imagens/Pastas à Biblioteca. Mover o diretório de Explore para Pastas; Explore mantém redescoberta. Assuntos passam a pertencer visualmente à Biblioteca e retornam a Pastas. Busca indica o escopo; na lista de Pastas pesquisa nomes, na pasta pesquisa imagens, em Explore pesquisa a Biblioteca mediante Enter.
5. Reutilizar captura, tags de contexto, seleção em lote e viewer existentes. Confirmar que a lista de Pastas não atribui tags e que uma pasta aberta mantém sua tag base ao refinar/limpar e salvar.
6. Cobrir derivação das pastas/capas e contratos de URL com testes. Executar a suíte, build e `git diff --check`. Verificar no navegador com armazenamento isolado: abas, busca, retorno/histórico/reload, capas de um/dois/três itens, ocultação e tags, captura pendente, viewer/ampliação, estados vazios/erro e mobile. Registrar resultados reais abaixo.

Não introduzir infraestrutura para modalidades futuras de pasta. As demais pendências técnicas da versão 0.23.0 permanecem fora desta entrega, salvo regressão provocada pela integração.

## Resultado e validação

- Novo destino `?view=folders`, com consulta por nomes e validação que rejeita parâmetros de imagem/filtros/modos incompatíveis com o diretório. `?view=subject&subject=...` continua abrindo a mesma tag, agora apresentada como pasta; links antigos não foram migrados ou invalidados.
- `useLibraryNavigation` ganhou snapshot opcional de Pastas, aceitando históricos antigos sem esse campo. As vistas usam restauração explícita de posição e foco; trocar para um controle de navegação não apaga o último cartão de conteúdo. Retorno da pasta usa a origem do diretório quando conhecida e um destino seguro nos links diretos.
- `automaticTagFolders` deriva grupos visíveis, únicos e alfabéticos usando o agrupamento existente. Capa principal reutilizada da tag; complementares distintas escolhidas de forma determinística. Nenhuma tabela, cópia de arquivos, lista paralela de membros, dependência ou engine de critérios novos.
- `FolderGrid` substitui `TagExploreGrid`, com grade regular, capas compostas, nomes/contagens abaixo e duas colunas em 390px. Mantém a renderização progressiva da lista, inclusive profundidade suficiente para restaurar um cartão além do primeiro lote após reload.
- Biblioteca ganha Images/Folders. Pasta/assunto mantém o estado ativo de Biblioteca e o retorno a Folders; Explore mantém Rediscover. Sua busca oferece explicitamente busca na Biblioteca com Enter, sem manter um diretório duplicado. Captura e viewer existentes foram reutilizados.
- A constituição agora permite coleções automáticas ou manuais, sem tratar todo tipo futuro de pasta como uma tag. DESIGN.md foi atualizado para a apresentação nova. Não foram introduzidas modalidades futuras, CRUD independente de pastas ou obrigação de usar tags.

### Checks

- `npm test`: 88 testes aprovados, sem skips. O teste do embaralhamento diário do diretório retirado foi substituído por testes de ordem alfabética, membros visíveis únicos, estabilidade de capa, previews de um/dois/três itens e atualização por associação/visibilidade. Acrescentado teste de URL de Pastas e compatibilidade dos assuntos antigos.
- `npm run build` e `git diff --check`: passaram. Sem mudanças em package.json/package-lock.json, migração ou dados do acervo real.
- Playwright/Chrome headless com armazenamento e sessão próprios em `/tmp/visual-library-032-app-W4URxx/`, inicialmente com 24 PNGs sintéticos, um oculto e tags para pastas de um/dois/três itens. Os testes de mutação usaram somente essa biblioteca temporária; seus arquivos extras e tags de paginação foram retirados da fixture ao terminar.
- Verificados mosaicos, contagens, ausência de pasta só com conteúdo oculto, busca por nomes, consultas independentes das abas, navegação de assunto legado, detalhe/ampliação, retorno ao cartão, reload, navegação nativa e Explore sem diretório duplicado. Sem overflow em 320, 390, 768, 1440 e 1920px. Capturas desktop/mobile inspecionadas; duas colunas em 390px.
- Edição real de tags no viewer criou uma pasta e esvaziou outra, com retorno seguro ao diretório quando o cartão de origem deixou de existir. Upload real de fixture dentro de pasta com refinamento recebeu exatamente a tag base e o refinamento; upload na lista de Pastas recebeu zero tags. Nada disso alterou a biblioteca de produção.
- Descoberta/prévia HTML usaram transporte controlado no browser; seleção pendente foi mantida entre Images, Folders e uma pasta aberta. O backend de captura continua coberto pela suíte existente.
- Uma lista com mais de 50 pastas de teste validou paginação e retorno depois de reload do detalhe. O diretório renderizou o cartão correspondente além do primeiro lote, restaurou scroll/foco e preservou esse contexto ao sair pela navegação fixa e retornar por Images/Folders. Quando o usuário rola ao topo para alcançar as abas, a posição atual continua sendo a que se guarda.
- Verificados estados sem pastas, pesquisa sem resultados, pasta sem imagens visíveis, erro/retry de carga, falha de miniatura e histórico legado sem snapshot de Pastas. Nomes e links permanecem utilizáveis quando as capas falham. Rodadas funcionais finais sem exceções JavaScript.

Scripts e capturas em `/tmp/visual-library-032-*.mjs`, `/tmp/visual-library-032-*.log` e no diretório da fixture. Não houve avaliação em celular físico, inferência de similaridade ou auditoria completa de acessibilidade; o viewer usa os relacionados/fallback existentes. As pendências de tipagem/streams registradas em 031 não foram ampliadas ou corrigidas por esta entrega.

## Preparação da release 0.24.0

Após a entrega local, o usuário solicitou avanço de versão, commit e push, seguidos de release. package.json e package-lock.json foram sincronizados em 0.24.0. A imagem Docker passou no build e em smoke Playwright com volume anônimo isolado: setup/login, upload real de duas fixtures, navegação Images/Folders, capa/contagem compartilhada, retirada de imagem oculta dos grupos, detalhe/ampliação, retorno e duas colunas em 390px. Nenhuma exceção JavaScript observada. O contêiner de teste e seu volume foram removidos ao concluir.

Publicação pelo fluxo `make release VERSION=0.24.0`, com tags 0.24.0 e latest, depois de enviar o commit ao repositório. Notas em [0.24.0](../../releases/0.24.0.md). Sem implantação automática na produção ou alteração do acervo real.
