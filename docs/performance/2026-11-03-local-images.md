# Avaliação de imagens na rede local — 03/11/2026

Aplicação 0.22.0, `https://visu.mordor.lan`, resolvendo diretamente para `192.168.1.100`. Biblioteca com 1.117 imagens, 1.232.419.486 bytes de originais e 522 tags. Avaliação sem alterações no código da aplicação ou configuração de rede.

## Método e limites

Chrome headless na máquina cliente, sem limitação artificial de rede/CPU. Desktop 1440×1000 e viewport móvel 390×844 com DPR 3; a simulação móvel usa o mesmo computador e conexão, não representa hardware de um celular. Contextos novos para cada rodada inicial, sem cache de navegador compartilhado. Miniaturas persistentes do servidor podem já existir: não se apagou o cache de produção. TLS foi acessado ignorando a validação do certificado local; esta avaliação não é uma auditoria TLS.

Foram observadas as telas Explore, Library e visualizador. Download isolado: oito originais de tamanhos variados (quatro recentes, dois próximos da mediana e os dois maiores), com suas miniaturas, duas rodadas sequenciais; lote adicional de 18 miniaturas com concorrência seis. Todos os 52 pedidos desse ensaio retornaram HTTP 200 e IP remoto 192.168.1.100. Sessão temporária de avaliação, removida ao concluir. Nenhuma senha foi redefinida.

## Principal gargalo: enlace do Mordor a 10 Mb/s

`/sys/class/net/enp4s0/speed` e `ethtool enp4s0` informaram **10 Mb/s, full duplex, autonegociação ligada**. Placa e parceiro anunciaram suporte a 1000baseT/Full. A interface do cliente `enp0s13f0u1u4` estava a 1000 Mb/s. O teto teórico do enlace do servidor é 1,25 MB/s antes de overhead; os downloads observados são coerentes com essa limitação.

Quatro pings durante a avaliação: 47,6–180,5 ms, média 127,2 ms, sem perdas nessa amostra pequena. O servidor estava com load average de aproximadamente 0,16 e o container da biblioteca usava cerca de 1,25% de CPU no instante observado. A causa física da negociação baixa não foi determinada: conferir cabo, conectores e porta do switch antes de alterar configurações. Não se forçou renegociação remotamente.

## Download

| Recurso | Amostra | Resultado |
| --- | --- | --- |
| `/api/images`, 808.293 bytes | 2 pedidos | 0,75–2,05 s; mediana 1,40 s |
| Miniaturas individuais, 15–68 KB | 16 pedidos | mediana 74 ms; 25–257 ms |
| Originais, 0,29–11,39 MB | 16 pedidos | mediana 0,76 s; 0,27–11,66 s |
| Dois maiores originais, 10,86 e 11,39 MB | 4 pedidos | 9,94–11,66 s; aproximadamente 0,93–1,15 MB/s |
| 18 miniaturas, total 780.350 bytes | concorrência 6 | lote completo em 0,81 s |

No próprio container, por HTTP em loopback, os metadados levaram 59 ms, e o maior original, 11.386.718 bytes, levou 49 ms. São amostras isoladas, mas distinguem claramente a entrega local dos custos da transferência pela rede.

## Tempo até aparecer e estabilidade visual

Tempos desde a navegação, incluindo recursos da interface, autenticação, metadados e imagens. A detecção exigiu imagem carregada e opacidade de pelo menos 0,99, incluindo o fade de 180 ms.

| Tela | Primeira imagem visível | Todas as imagens da primeira tela visíveis |
| --- | --- | --- |
| Explore desktop, duas rodadas | 3,34–3,97 s | 3,76–4,53 s |
| Library desktop, duas rodadas | 3,57–6,82 s | 4,19–7,48 s |
| Explore, viewport móvel | 2,94 s | 3,15 s |
| Library, viewport móvel | 2,63 s | 2,63 s; apenas uma imagem alcança a borda inferior |

Uma recarga adicional no mesmo contexto de navegador chegou à primeira miniatura decodificada em 1,75 s; esse marco não inclui o término do fade nem todas as imagens visíveis.

Uma rodada de Library teve uma tarefa longa de 3,61 s na thread principal, contra 233–249 ms nas demais rodadas de Library. Esse pico isolado não permite atribuir toda a diferença ao servidor ou considerar 7,48 s um tempo típico.

A galeria aguarda a lista completa de imagens antes de solicitar miniaturas. `/api/images` carrega 808 KB e `/api/tags`, aproximadamente 119 KB, sem compressão observada nos tamanhos transferidos. Esse custo ocorre mesmo na tela Explore, que mostra apenas uma seleção inicial.

O CLS medido em Explore foi aproximadamente 0,33–0,34 no desktop: deslocamento relevante durante a substituição dos estados de carregamento. Library ficou em aproximadamente 0,017 no desktop e 0,047 no viewport móvel. Não houve erros JavaScript ou downloads de imagem com falha nas seis rodadas de navegador.

## Aparência

- As miniaturas observadas mantêm proporções e não apresentaram deformação ou recorte indevido. A geração usa WebP, qualidade 82, limite de 640×640 sem ampliar o original.
- No visualizador desktop, o original de 400×400 foi exibido a **640×640**: ampliação de 1,6×, que reduz a nitidez. No viewport móvel foi exibido a 358×358.
- A galeria desktop apresentou cinco colunas na tela Library, com cartões de 240 px. Nas imagens verificadas, as miniaturas são suficientes para esse tamanho em DPR 1. Em DPR alto, a mesma variante de até 640 px pode não cobrir todos os pixels físicos; a nitidez depende da resolução original e do tamanho do cartão.
- No viewport móvel da Library, cabeçalho, navegação, upload e filtros empurram as imagens para perto do final da primeira tela. A sensação de demora não vem apenas do download: há pouca área inicial dedicada às imagens.
- O visualizador usa o original diretamente e opacidade zero até o evento `load`; não mantém a miniatura visível como prévia enquanto baixa o original. O fade de 180 ms suaviza a entrada, mas não resolve a espera por arquivos grandes. No ensaio com o original de 11,39 MB, a imagem central continuava com opacidade zero após um segundo e só concluiu o carregamento cerca de **11,14 s** após a montagem do visualizador.

## Prioridades

1. Restaurar o enlace do Mordor a 1 Gb/s, verificando cabo/conectores/porta e repetindo as medições. A capacidade nominal é 100 vezes maior que 10 Mb/s; isso não implica ganho de 100 vezes em toda a interface.
2. Mostrar a miniatura imediatamente no visualizador, substituindo-a pelo original após download/decodificação. Assim, o usuário tem conteúdo durante a espera.
3. Reduzir a carga inicial de metadados: compressão HTTP e consultas limitadas/paginadas, especialmente em Explore. Evitar que a primeira imagem dependa dos metadados de toda a biblioteca.
4. Evitar ampliar originais pequenos e reservar espaço consistente durante o carregamento em Explore.
5. Compactar controles no celular para colocar imagens na primeira tela. Avaliar variantes responsivas de miniatura para telas de alta densidade depois de corrigir os gargalos anteriores.

Dados brutos e capturas desta avaliação estão em `/tmp/visual-library-performance/`; não foram adicionadas imagens privadas ao repositório.

## Reavaliação após reconectar o cabo — enlace a 1 Gb/s

O usuário reconectou o cabo nas duas pontas. O kernel registrou enlace a 1 Gb/s full duplex às 22:18:45 e novamente às 22:19:20 de 03/11/2026. Cinco pings após a reconexão tiveram média de 0,299 ms, sem perdas. A leitura de velocidade permaneceu em 1000 Mb/s antes e depois desta reavaliação.

A nova rodada utilizou uma sessão temporária explicitamente autorizada pelo usuário, excluída ao concluir. Os scripts de navegador foram executados sequencialmente, seguidos dos downloads isolados, sem mudanças na aplicação, firewall ou armazenamento. Todos os 52 pedidos do ensaio de download retornaram HTTP 200. As seis rodadas de navegador não registraram erros JavaScript ou requisições com falha.

A biblioteca em uso passou de 1.117 para 1.112 registros entre as avaliações; portanto, a navegação não representa uma reprodução de dados inteiramente imutável. A amostra automática de oito originais manteve seis arquivos iguais. O maior original e o lote de 18 miniaturas são exatamente os mesmos nas duas avaliações. As seleções aleatórias de Explore também podem variar.

| Medição | Antes: 10 Mb/s | Depois: 1 Gb/s |
| --- | --- | --- |
| Mesmo original, 11.386.718 bytes; duas rodadas de download isolado | 9,94–9,96 s | 0,104–0,105 s; aproximadamente 109 MB/s |
| Mesmo lote de 18 miniaturas, 780.350 bytes | 0,813 s | 0,058 s |
| Miniaturas individuais: mediana apenas dos seis arquivos comuns, duas rodadas cada | 59 ms | 6,9 ms |
| Library desktop: todas as imagens visíveis da primeira tela | 4,19–7,48 s | 0,670–0,808 s |
| Explore desktop: todas as imagens visíveis da primeira tela | 3,76–4,53 s | 0,470–0,769 s |
| Library em viewport móvel: primeira imagem visível | 2,63 s | 0,607 s |
| Mesmo maior original no navegador: montagem até carregamento/decodificação completos, antes do término do fade | 11,14 s | 0,294 s |
| Recarga no mesmo contexto até a primeira miniatura decodificada, sem aguardar todo o fade | 1,75 s | 0,518 s |

O maior original levou 218 ms de recurso de rede no navegador desta rodada. Após um segundo, já estava completamente carregado e com opacidade 1; na rodada anterior, nesse marco permanecia incompleto e invisível. O novo script registra o instante de conclusão da decodificação independentemente da captura feita após um segundo, evitando impor artificialmente um mínimo de um segundo à medição.

Os metadados atuais, aproximadamente 805 KB, chegaram em cerca de 21–22 ms nas rodadas de navegador; no download isolado, em 23–24 ms. A redução de cinco registros é pequena em comparação com a mudança de tempo, mas os valores absolutos de payload não são idênticos.

A reconexão removeu o gargalo predominante observado: o download isolado do maior arquivo ficou aproximadamente 95 vezes mais rápido. Essa comparação inclui arquivos possivelmente presentes em cache do servidor e não mede leitura fria do HDD. Não permite concluir qual cabo, contato ou porta originou a negociação baixa, nem garantir que ela não voltará a ocorrer.

A aparência e as limitações da interface continuam: ampliação de originais pequenos, falta de prévia durante a carga do original e excesso de controles antes das imagens no celular. O CLS de Explore desktop ficou em aproximadamente 0,33–0,34 mesmo com a rede rápida, enquanto Library desktop ficou em aproximadamente 0,038. Isso distingue os deslocamentos de layout do problema de transferência já resolvido nesta rodada.

Dados e capturas posteriores à reconexão: `/tmp/visual-library-performance-gigabit/`. Arquivos locais com o token e o cookie temporários foram excluídos após a remoção da sessão no servidor.
