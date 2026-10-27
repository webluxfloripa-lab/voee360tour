# Validação desta versão

Resultados executados de verdade; os testes de interface com fixtures não são apresentados como login real da titular.

| Verificação                                                | Resultado e limite                                                                                                             |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| TypeScript estrito                                         | Concluído/testado, sem erros                                                                                                   |
| ESLint                                                     | Concluído/testado, sem erros/avisos                                                                                            |
| Vitest                                                     | Concluído/testado, 11 testes em 3 arquivos                                                                                     |
| PostgreSQL local (PGlite)                                  | Concluído/testado, 17 verificações, migrations completas                                                                       |
| Supabase PostgreSQL real                                   | Concluído/testado, 7 cenários transacionais, com rollback dos dados de teste                                                   |
| Playwright Chromium                                        | Concluído/testado, 10 testes, 360×800 com touch e 1440×1000 desktop                                                            |
| Sem overflow horizontal                                    | Concluído/testado em login, dashboard e editor nas duas resoluções                                                             |
| Upload e Pannellum                                         | Concluído/testado no browser com dois panoramas reais do Seven; backend de interface interceptado localmente                   |
| CRUD cliente/projeto                                       | Concluído/testado pela interface com fixtures de teste isoladas                                                                |
| Ida/volta, publicar V1/V2, restaurar, refresh, V3 e prévia | Concluído/testado no browser com fixtures; transações e permissões também testadas separadamente no Supabase real              |
| Build Vite/TanStack/Nitro                                  | Concluído/testado, independente do plugin Lovable                                                                              |
| Deployment Vercel                                          | Concluído/testado em preview, HTTP 200 em /login; /t/seven-sports-bar retornou 404 enquanto rascunho, sem vazar os ambientes   |
| Imagens Seven                                              | Concluído/testado: 44 objetos no Storage próprio, 14.077.933 bytes; tamanho e SHA-256 conferidos; 22 panoramas com aspecto 2:1 |
| Convite SUPER_ADMIN                                        | Concluído/testado pelo Auth: convite criado para a identidade autorizada e papel super_admin confirmado                        |
| Login bem-sucedido da titular                              | Pendente: tentativa pelo formulário seguro retornou e-mail/senha inválidos; finalizar pelo convite/recuperação                 |
| GitHub remoto                                              | Bloqueado por autenticação: login do provedor não concluído; repositório Git local existe e original Seven preservado          |
| WhatsApp/OG real e iframe público de cliente               | Implementado, ainda não homologado por compartilhamento real; não há cliente publicado nesta fase                              |
| Duplicação, backup ZIP e logotipo do cliente               | Implementados; fluxo completo no browser não incluído na suíte desta entrega                                                   |
| Portal do cliente                                          | Fora do escopo V1, não implementado                                                                                            |

## Cenários reais no Supabase

O arquivo `tests/live-db.sql` executa como papel autenticado com a identidade já convidada. Testa lock otimista, publicação V1/V2, restauração persistente, V3, imutabilidade, isolamento de mídia/versão por projeto, falha atômica por mídia ausente, usuário comum e acesso anônimo. Ao final, uma subtransação é revertida intencionalmente. Após o teste foram confirmados: dois projetos em rascunho, zero tours públicos, 44 assets e o checkpoint de migração original preservado.

Isso verifica autorização e transações reais, mas não equivale a digitar a senha da titular e concluir uma sessão real pelo navegador. Não utilizamos nem presumimos credenciais dessa conta nos testes automatizados.

## Suíte de interface

Os testes usam Chromium real, imagens reais e renderização WebGL/Pannellum. A conexão com Supabase é interceptada por um backend de teste em memória, sem permitir tráfego externo. Esse isolamento evita criar contas, projetos ou publicações de teste na infraestrutura da titular e permite comprovar o comportamento após refresh.

As requests de dados são testadas separadamente no banco real. A suíte não constitui homologação comercial integral dos provedores, e a visualização do Seven completo ainda requer conferência física das passagens.

## Segurança e limitações observadas

Todas as 12 tabelas expostas possuem RLS. O advisor final não indicou problemas de políticas ou funções; registrou um WARN de proteção de senha vazada desabilitada no Auth. O advisor de performance foi corrigido para índices/FKs e políticas redundantes; restam somente índices ainda não utilizados, esperado em uma base recém-criada.

A revisão automática interrompeu uma execução por telemetria opcional do CLI. Foi usada a opção oficial `supabase telemetry disable`, com `SUPABASE_TELEMETRY_DISABLED=1` e `DO_NOT_TRACK=1`. Depois, os testes foram executados com sucesso e com conexões externas do navegador bloqueadas. A aplicação não inclui analytics de terceiros.

Os builds apresentam avisos de dependências sobre diretivas `use client` no bundler, sem impedir a compilação. Logs e resumos estão em `docs/validation`.

A auditoria de dependências de produção identificou um aviso alto no Zod 3.25.76 ([GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)). A versão foi atualizada para 4.6.7 e a compilação, tipagem e testes foram reexecutados. O resultado final do npm audit está em `docs/validation/dependency-audit.json`.
