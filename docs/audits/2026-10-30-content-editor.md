# Editor de conteúdo e layout — 30/10/2026

## Checkpoint 1 — implementação
- Base: main 36a6a0e, publicação verificada nas duas hospedagens.
- Entrada administrativa: /admin/projetos, separada do tour público /t/seven-sports-bar.
- Implementados campos por tour para todos os textos fixos do cabeçalho, apresentação, rodapé e controles do visualizador.
- Implementada prévia clicável com edição de texto, cores, tamanhos, alinhamento, proporções e ordem das seções.
- Implementadas seções de conteúdo com adicionar, duplicar, ocultar, reordenar e excluir; botão opcional e link HTTPS.
- Apresentação faz parte do snapshot: rascunho, histórico, publicação, restauração e backup preservam a configuração.
- Compatibilidade com tours antigos sem apresentação configurada.
- Nenhum conteúdo do tour real foi alterado durante a implementação.
- Validação e homologação em andamento.

## Checkpoint 2 — regressão e ajustes
- 12 testes de acesso/editor passaram em mobile e desktop.
- Prévia completa inclui cabeçalho, panorama, apresentação, seções e rodapé.
- Ajustada compatibilidade para manter snapshots antigos sem campos adicionais automáticos.
- Adicionados testes de persistência/restauração de textos e dimensões no banco local.
- Adicionada proteção de alterações locais ao fechar a página.
- Testes específicos da nova interface em andamento; dados reais preservados.

## Checkpoint 3 — homologação
- 46 testes unitários passaram; TypeScript, lint e validação de diferenças passaram.
- Teste de banco local confirmou que publicar/restaurar preserva textos e dimensões personalizados.
- Nova interface passou no mobile e desktop: clique no texto, alteração, redimensionamento, inclusão de seção, salvar e recarregar.
- Fluxos anteriores de acesso e edição passaram em 12 casos de navegador.
- Prévia inspecionada em celular e desktop. Acrescentados ajustes de subtítulo, chamada, rodapé, textos do visualizador e controles.
- Build final Cloudflare concluído; implantação nas duas hospedagens a seguir.
