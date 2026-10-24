# Avaliação semântica isolada

**Status: adiada por decisão do usuário em 2026-10-24.** O piloto e os julgamentos ficam preservados; não iniciar outra comparação ou integração automaticamente.

Quarto item do roadmap. Solicitado em 2026-10-24. O usuário autorizou amostra de até 100 imagens visíveis, por leitura, inferência local e relatórios privados fora do repositório. Consultas fornecidas: `mulher gurreira segurando espada`, `mulher posando em frente a carro`, `coruja`, `água`.

## Objetivo

Avaliar se recuperação por conteúdo complementa nome/tags no acervo pessoal, com consultas em português e custo compatível com o host. Não entregar uma busca integrada antes de avaliar seus resultados.

## Escopo

- Amostra fixa de até 100 imagens visíveis, escolhida por distribuição temporal, com IDs/hashes e metadados congelados para comparação.
- Preservar consultas do usuário; adicionar variante corrigida de `gurreira` e pares em inglês para diagnóstico, identificados como tais.
- Comparar ranking semântico com o contrato lexical existente de nome/tags, sem misturar scores ou substituir DINOv2/paleta.
- Executar encoder texto/imagem alinhado em CPU, sem enviar imagens ou consultas a serviço externo.
- Gerar relatório local com previews, resultados, custos, fingerprint de modelo e formulário de julgamentos. Relatórios contêm conteúdo pessoal e não entram no Git.
- Registrar tamanho dos pesos, tempos de download/carregamento/inferência/ranking, cache e RSS. Distinguir medição local de medição no host alvo.
- Qualidade exige julgamento humano 0/1/2 e relevância conhecida; ausência de julgamento não vira score zero ou aprovação automática.

## Limites

Sem UI de busca no produto, tagging, treinamento, novo banco, serviços permanentes, integração em produção ou envio de conteúdo externo. Miniaturas, captura, busca lexical e similaridade estética existentes permanecem independentes.

O piloto com quatro intenções e 100 imagens pode revelar problemas; não substitui o gate mais amplo proposto no estudo (30 consultas reais, português e exemplos diversos). Se não houver resultados relevantes na amostra, não concluir incapacidade do encoder nem sucesso por aparência plausível. A decisão de integrar depende de utilidade observada e custo no hardware alvo.
