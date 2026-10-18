# Usar no celular

Após publicar esta versão, abrir o endereço HTTPS da biblioteca no celular.

- Android/Chrome: menu do navegador → Instalar app ou Adicionar à tela inicial. Abrir pelo ícone para usar a janela sem a barra de endereço.
- iPhone/Safari: Compartilhar → Adicionar à Tela de Início; abrir pelo ícone. A opção de receber conteúdo de outros apps depende de Web Share Target, que não é suportado pelo Safari/iOS atualmente.

Nos sistemas compatíveis, depois de instalar, compartilhar um arquivo de imagem ou seu endereço direto e escolher Visual Library. A captura salva no servidor e abre Library com contagens de salvos, duplicatas e falhas. Recompartilhar tenta novamente sem duplicar os itens já salvos. Filtros de sessões anteriores não atribuem tags à captura externa.

Arquivos: JPEG, PNG, WebP, GIF e AVIF. Um lote aceita até 20 arquivos, e o corpo inteiro está limitado ao tamanho máximo configurado de imagem mais 64 KiB para o formulário (padrão: 15 MiB mais envelope). Dividir compartilhamentos maiores. Um link de post, página ou álbum não equivale a um link direto de imagem; compartilhar a imagem ou copiar seu endereço direto.

O servidor precisa estar acessível e o celular precisa de conexão. Não há cache offline, fila de compartilhamentos ou sincronização posterior. Se a conexão falhar antes do retorno, compartilhar novamente quando o servidor estiver acessível.

Se já existia um atalho antes desta versão e a biblioteca não aparecer no Compartilhar, remover o atalho e reinstalar pelo navegador compatível.

Referências: [instalação](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable), [compatibilidade do compartilhamento](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/share_target#browser_compatibility).
