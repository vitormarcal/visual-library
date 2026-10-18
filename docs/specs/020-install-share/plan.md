# Implementação

Usar manifest estático, ícones PNG/SVG e metadados no head do Nuxt. Sem service worker: captura online diretamente em POST /share, conforme suportado pelo Web Share Target. Copiar public no build Docker.

Receber multipart com leitura limitada antes do parse. Validar arquivos com as funções atuais, persistir sequencialmente com saveImage e usar fetchRemoteImage para URLs, preservando proteção contra destinos privados, limites e timeouts. Arquivos têm precedência. Redirecionar 303 para Library com contagens e códigos fixos, sem transportar conteúdo compartilhado na URL. Mostrar aviso persistente dispensável e retirar os parâmetros antes de iniciar o histórico da biblioteca.

Testar recebimento HTTP isolado com SQLite temporário, deduplicação, arquivo forjado, falha parcial, corpo excedente, limite de quantidade, destino privado e formulário inválido. Testar extração de URL e mensagens. Executar suíte e build; validar manifest, recursos e resultado no Chrome em viewport móvel. Instalação pelo sistema e compartilhamento de outro app exigem validação no celular real.

Referências: [Web Share Target](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/share_target), [instalação](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).

## Validação

- `npm test`: 55 testes passaram. Captura HTTP isolada cobre arquivos, deduplicação, falha parcial, URL direta em texto Android, rejeição de HTML, destino privado, limites e redirecionamento.

- Build Nuxt concluído, incluindo manifest e ícones nos recursos públicos de produção. Sem novas dependências; permanecem os avisos conhecidos de sourcemap e externalização de node:sqlite.
- Chrome headless/CDP em 390 × 844, servidor de produção com acervo temporário: manifest sem erros e Page.getInstallabilityErrors sem impedimentos. Ícones PNG retornam 200. Resultado parcial aparece, não há overflow horizontal, Dismiss funciona e parâmetros transitórios são removidos antes da navegação. Screenshot mobile inspecionada visualmente.
- POST inválido em servidor de produção redireciona à Library e apresenta explicação, sem tela de erro HTTP crua.
- Instalação no sistema, abertura standalone física e escolha da biblioteca no menu Compartilhar de outro app ainda precisam ser conferidas no celular real. Nenhuma publicação foi feita nesta etapa.
