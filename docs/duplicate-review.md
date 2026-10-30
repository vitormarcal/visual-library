# Revisar possíveis cópias

Na Library, abrir **Review duplicates**. A revisão mostra um grupo por vez, com imagens inteiras, ampliação, dimensões e indicação do motivo de cada sugestão. **Likely copies** usa distância máxima 0.03; **Broader review** usa 0.10 e começa mantendo todas, pois pode incluir poses, expressões e recortes diferentes.

## Primeiro preparo

Escolher **Prepare duplicate review**. O servidor baixa aproximadamente 372 MB de pesos uma vez e prepara as imagens visíveis em um processo separado, uma por vez. CPU é suficiente. Originais não são enviados para serviços externos; somente os pesos são baixados da Hugging Face. A captura continua independente do preparo.

O modelo é `immich-app/ViT-B-16-SigLIP2__webli`, revisão fixa `81999505043a05dbc3ff4c6ba9932d93a15216a4`. Os dois arquivos de pesos têm SHA-256 verificado. O encoder roda no próprio Visual Library, sem dependência do Immich. Cache e ativação ficam em `data/duplicates/`; vetores e revisões em SQLite. O volume habitual `/app/data` preserva tudo.

Após ativar, imagens novas e imagens mostradas novamente na galeria entram no preparo. Reinício retoma pendências. O processo encerra ao terminar, liberando o modelo. Falha de modelo pausa tentativas por um minuto; **Try again** permite tentar novamente. Falha por arquivo não impede analisar os demais; a interface mostra cobertura e permite repetir as falhas.

A build Docker inclui runtime e dependências, sem pesos embutidos. Para desenvolvimento, executar `npm ci --prefix runtime/similarity --ignore-scripts` além da instalação principal e iniciar a aplicação da raiz do projeto. É preciso reconstruir a imagem para instalar esta entrega. Não houve deploy durante a implementação.

## Escolhas e sugestões

O grupo organiza a revisão, mas não prova que todos os membros sejam cópias. As sugestões usam resolução e tamanho do arquivo como indícios; não medem nitidez nem reconhecem com segurança pequenas mudanças de expressão ou pose. Proporções diferentes, empates úteis e dimensões desconhecidas são motivos para preservar mais candidatas. Qualquer sugestão pode ser alterada, exceto imagens com referências ativas de integração nesta versão.

Selecionar **Keep** ou **Remove** em cada cartão. É possível manter várias imagens. **Keep all** registra o grupo como revisado sem excluir ou transferir nada. **Skip for now** deixa o grupo para outra visita. Grupos resolvidos não reaparecem para o mesmo conjunto de imagens; uma nova cópia pode gerar outra revisão.

## Tags e links públicos

Com uma mantida, ela recebe automaticamente as tags e os links públicos das removidas. Com várias, escolher **Receives tags and links** em uma delas. As outras conservam suas próprias tags e publicações. Chips indicam as tags adicionadas; conjuntos maiores ficam em **Show all**.

O limite de quantidade de tags por imagem foi removido da edição pessoal, captura, tagging em lote e API de enriquecimento. Normalização, unicidade e o limite de 48 caracteres por nome continuam valendo. Os limites de tamanho das requisições HTTP permanecem.

As URLs públicas antigas continuam iguais e passam a servir a imagem destino. O link principal do destino é preservado; se ele ainda não tinha publicação, um link herdado se torna principal. O visualizador informa quantos links ativos existem e permite revogar todos. Links anteriormente revogados nunca são reativados por consolidação.

Metadados, tags, associação dos links e remoção dos registros são consolidados em uma transação. O servidor revalida os dados exibidos antes de confirmar; mudanças de visibilidade, tags, links, referências ou integrantes exigem atualizar a revisão. Arquivos são removidos somente após o commit. Uma falha de limpeza física pode deixar um arquivo órfão sem rota de acesso; a limpeza não desfaz o commit.

URLs públicas usam cache imutável por um ano. Uma cópia já entregue pode continuar aparecendo em caches até expirar, mesmo depois da absorção ou revogação. Respostas novas usam o conteúdo e os validadores da imagem destino.

## Remoção e limites

**Review removal** mostra quantidade a manter/remover, destino de tags e links e confirmação inline. A remoção é definitiva; esta versão não oferece lixeira ou Undo. Nenhuma imagem é excluída apenas por abrir a revisão ou mudar seleções.

Somente imagens visíveis participam. Imagens com referências de aplicações são mantidas, porque migrar seus IDs/revisões/procedência não é equivalente a preservar uma URL pública. Não existe descarte automático, bloqueio de upload por similaridade ou limpeza de toda a biblioteca em uma só ação.

Decodificação limitada a 40 MP e primeiro frame de animações suportadas. AVIF estático foi validado; o AVIF animado da fixture não foi decodificado pelo runtime atual e aparece como falha, sem impedir armazenamento ou visualização habitual. Geometrias extremas que ultrapassam o orçamento do redimensionamento também ficam indisponíveis para a análise.

Inferência tem duas threads e ranking roda em worker separado para não executar a comparação completa no processo web. O teste do contêiner isolado passou com dois CPUs/2 GiB e pesos cacheados, sem rede; isso não mede o pico combinado com DINOv2 e busca por conteúdo. Manter recursos suficientes quando os preparos coincidirem.
