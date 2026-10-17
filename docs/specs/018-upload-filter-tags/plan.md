# Plano

Reutilizar effectiveFilters no app para capturar os nomes de tags no começo do envio e preservar uma cópia para retries. SaveDropzone exibe a indicação com chips neutros e acessíveis. Encaminhar tags no multipart e JSON da rota interna, validando com as regras existentes. Reutilizar a transação de armazenamento para criar imagem e tags atomicamente, preservando duplicatas e o enriquecimento da API externa.

Verificar os contratos HTTP em acervo temporário: imagens novas e URL com tags persistidas, normalização, duplicatas sem alterações e valores inválidos. Executar suíte, build de produção e diff check. Revisar escopo contra CONSTITUTION.md e DESIGN.md.

## Validação executada — 2026-10-17

Os 46 testes passaram, incluindo novos cenários HTTP de captura multipart e URL com tags persistidas, normalização, duplicata sem alterações e rejeição de tags inválidas/acima dos limites. Build de produção concluído e git diff --check sem erros. Nenhum teste usa o acervo pessoal. Revisão manteve os componentes e tokens existentes, sem dependências adicionais. Validação visual em navegador e dispositivos físicos permanece pendente.
