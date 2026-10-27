# Arquitetura

## Fronteiras

Browser React → Supabase Auth → JWT autenticado → RPC pública com SECURITY INVOKER → implementação privada com SECURITY DEFINER e verificação explícita de SUPER_ADMIN → transação PostgreSQL.

Não existe chave de serviço no cliente nem na aplicação Vercel. As duas Edge Functions de configuração usaram exclusivamente as variáveis de serviço fornecidas pelo próprio Supabase; após concluir convite e importação, foram substituídas por resposta 410 com verificação de JWT habilitada.

A navegação pública é SSR pelo TanStack Start. O servidor consulta apenas `published_tours` e mídia referenciada usando a chave publicável. O componente Pannellum só inicializa no navegador, após carregar o script próprio e seu CSS.

## Modelo

| Entidade           | Responsabilidade                                                   |
| ------------------ | ------------------------------------------------------------------ |
| profiles           | Associação segura da única identidade SUPER_ADMIN                  |
| clients            | Empresa cliente, contato, logo e situação                          |
| projects           | Cliente proprietário, slug global, status e ponteiro publicado     |
| project_members    | Fundação futura, sem políticas editoriais na V1                    |
| media_assets       | Projeto, path, tipo, dimensões, tamanho, SHA-256 e função da mídia |
| scenes / hotspots  | Projeção relacional do rascunho, com FKs compostas por projeto     |
| tour_drafts        | Snapshot canônico e revisão otimista                               |
| tour_versions      | Publicações e checkpoints imutáveis                                |
| published_tours    | Snapshot público integral da última publicação                     |
| publication_events | Mudanças auditáveis da publicação                                  |
| audit_events       | Registro imutável de operações                                     |

O rascunho JSON é a fonte canônica de edição. Sua projeção relacional é materializada na mesma transação de salvamento. O visitante não faz JOIN entre rascunhos e publicação: recebe um snapshot integral.

## Reaproveitamento

O carregador e o helper de movimento do Seven foram reaproveitados. O AdminPanorama mantém o guard de load antes de atualizar hotspots, pointer capture, coordenadas esféricas e limpeza de listeners. O TourViewer mantém configuração Pannellum, menu, zoom, giro opcional e navegação, agora parametrizados por snapshot e mídia do projeto. O TourEditor preserva o modelo de seleção/commit/undo/redo e foi ampliado para cenas e versões próprias de cada projeto.

Foram removidos o build Lovable, a senha compartilhada SEVEN_ADMIN_PASSWORD, a sessão global, as regras de 22 cenas, o fallback público de dados estáticos e as URLs internas de assets em runtime.

## Regras de mídia

Upload aceita JPEG, PNG e WebP, até 40 MiB por arquivo; valida assinatura, decodificação, dimensões e proporção 2:1 no navegador. A RPC verifica escopo, existência, tamanho e MIME do objeto no Storage, além da proporção declarada. Os objetos não podem ser substituídos ou excluídos por clientes autenticados, preservando versões anteriores.

O hash é calculado sobre os bytes. Na recuperação do Seven, os hashes locais foram comparados aos bytes recuperados pela Edge Function. Backups verificam novamente o conteúdo baixado.

Usuários com papel administrativo continuam sendo uma fronteira de confiança: uma futura ingestão pública exigirá análise de bytes e antivírus no servidor, reservas de quota e pipeline de processamento isolado.

## Limites e evolução

A aplicação não impõe uma quantidade fixa de clientes, projetos ou cenas. As listagens fazem paginação de 500 registros para superar o limite padrão de respostas da API. Memória do navegador, tamanho de snapshots e cotas dos provedores continuam finitos.

Multirresolução/tiles, uploads retomáveis por TUS, processamento em worker, alertas automáticos de orçamento, domínio por cliente e portal de clientes ficam para evolução. A V1 envia arquivos sequencialmente com progresso e permite reenviar em caso de falha. Arquivos órfãos de uma falha intermediária não são apagados automaticamente; precisam de manutenção controlada que respeite o histórico.
