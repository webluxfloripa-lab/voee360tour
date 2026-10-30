# Auditoria voee360tour — 30/10/2026

## Checkpoint 1 — diagnóstico
- Base GitHub: fe4dd6cf37196c5e4d39c368e73966d301962678, main.
- Vercel: implantação READY dpl_5Cwr7bozU4pLqC1q1BJk2F913V2t, mesmo commit.
- Cloudflare: versão 555d1c61-4ef2-4105-901e-f3f66284590a ativa a 100%.
- Supabase saudável, tabelas públicas com RLS: 22 ambientes, 50 setas, 45 ativos.
- Tour seven-sports-bar publicado, mas rascunho diferente da publicação.
- Rascunho atualizado em 30/10/2026 03:57:35 UTC; publicação em 29/10/2026 05:00:23 UTC.
- Não existe atualização periódica da versão no visualizador público.
- Publicar salva o rascunho, chama a RPC e recarrega o editor, sem confirmar leitura anônima da versão publicada.
- Em investigação: validação estrita do rascunho e integração automática Cloudflare.

## Preservação
Nenhum tour, ambiente, seta ou fotografia excluído. Histórico anterior preservado.

## Checkpoint 2 — recuperação e correções
- Validação estrita do rascunho passou (incluindo acesso a mídia e alcance de cenas).
- Checkpoint imutável criado no banco antes da publicação de recuperação.
- Publicação de recuperação: 69d7fe8c-a575-49b6-a7f5-c5f297a2bda1, em 30/10/2026 04:09:39 UTC.
- Conferência posterior: rascunho = publicação; 22 ambientes e 50 setas.
- Cloudflare: nenhuma conexão de build automático encontrada para o Worker.
- Implementado em código: leitura pública sem sessão administrativa, cache no-store, atualização de versão a cada 30 segundos e ao retornar à aba, confirmação anônima após publicar.
- TypeScript passou. Testes e implantação em andamento.
- Advisor Supabase: aviso de proteção contra senhas vazadas desativada; tabela privada de tarefas de exclusão fechada por RLS (informativo, não uma falha de acesso público).

## Checkpoint 3 — homologação
- 43 testes unitários passaram; lint e TypeScript passaram.
- Testes locais de banco passaram: conflitos de revisão, isolamento, V1/V2/V3, restauração, exclusão restrita e preservação de outros projetos.
- 4 testes de navegador passaram no mobile e desktop: upload, setas ida/volta, salvar, publicar, restaurar e atualizar a página.
- Build Cloudflare concluído, incluindo 40 arquivos estáticos.
- Vercel público retornou HTTP 200 e contém a nova versão 69d7fe8c-a575-49b6-a7f5-c5f297a2bda1 no HTML.
- Cloudflare público abriu no navegador com título correto. Requisição do terminal recebeu 403; não representa indisponibilidade ao usuário.
- Cloudflare rejeitou conexão de build: erro 8000008, integração Git desconectada. Lista de build tokens também vazia. Não foi possível reativar CI apenas com a conexão atual.
- Políticas live de leitura anônima do workspace diferem das migrações Git (public_workspace_read/public_workspace_media_read). Mantidas conforme o pedido anterior de acesso público; não houve ampliação de permissões nesta auditoria. Painel/RPCs de alteração continuam exigindo administração.
