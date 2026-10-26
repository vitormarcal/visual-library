# Cache das imagens públicas

O blog usa imagens públicas imutáveis do Visual Library. A entrega com no-store força novas transferências e impede caches HTTP úteis. O usuário autorizou cache público padrão por um ano, aceitando que revogar o link não invalida cópias já entregues.

GET/HEAD de links públicos válidos permitem cache por um ano, inclusive 304. Conteúdo privado, metadados, gestão de links e erros continuam sem armazenamento em cache. Validar o vínculo e a existência do arquivo antes de responder condicionalmente. Revogação/exclusão impedem entregas futuras pelo servidor; caches existentes podem continuar servindo a imagem. Não adicionar configuração, serviço de CDN ou purga de caches.
