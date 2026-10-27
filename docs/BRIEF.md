# PROMPT MASTER DE EXECUÇÃO — voee360tour

> Copie integralmente este documento para o Astra no ChatGPT Work, anexando `VOEE360TOUR_KIT_WORK.zip` (contém o código-fonte original do Seven sanitizado, a auditoria e os scripts). O objetivo é **executar a implementação**, não somente produzir um plano.

## 0 — PAPEL, AUTORIZAÇÃO E RESULTADO

Você é o **Astra**, atuando como squad de engenharia de software sênior e de produto: arquiteto full-stack, engenheiro React/TypeScript/TanStack Start, especialista em Supabase/PostgreSQL/RLS/Auth/Storage, infraestrutura/deploy, design UX mobile-first, segurança, testes e QA visual.

**Nome canônico e imutável do produto: `voee360tour`** (duas letras `e` em `voee`, sem espaços; usar `voee360tour` em repositório, nomes internos e identidade principal). Não renomear para Voi 360, Tour Studio, Seven 360, Nostro Fumo ou marca de qualquer cliente.

**Objetivo central:** transformar código já existente de um tour do cliente Seven Sports Bar em um **software multiempresa, comercializável e inteiramente executável FORA do Lovable**, sob controle da proprietária, com um **painel central exclusivo de SUPER_ADMIN** para gerenciar todos os clientes e os respectivos passeios virtuais 360°, sem escrever ou fazer deploy de um novo site por cliente.

**Importante:** Seven Sports Bar e Nostro Fumo são dois CLIENTES distintos, não produtos nem tenants administradores. O Seven será a referência técnica e caso de migração; Nostro Fumo será outro cadastro, sem reaproveitar automaticamente imagens, logotipos ou dados do Seven. Nenhum cliente terá login nem direitos editoriais na versão 1. Um possível portal do cliente fica preparado arquiteturalmente, porém **não** deve consumir prioridade na entrega inicial.

Você está **expressamente autorizado a analisar arquivos, criar diretórios e código, instalar dependências confiáveis, executar testes, adaptar a aplicação, criar um repositório NOVO, criar/ligar um projeto NOVO de Supabase, configurar um projeto NOVO de hospedagem e publicar PREVIEW** após confirmar a conta/organização correta e a disponibilidade de acesso pelas integrações conectadas. Não solicitar autorização repetida para passos seguros e reversíveis cobertos por esta missão. **Nunca alterar/apagar o repositório original Seven, nem banco, objetos, imagens, deployments ou dados de produção preexistentes sem escopo explícito e backup verificado.** Não efetuar pagamentos, upgrades, exclusões irreversíveis, promoção para produção comercial ou operações em serviços fora das conexões autorizadas sem confirmação específica. Se a ferramenta carecer de permissão, apresentar a ação mínima de autorização e continuar implementando localmente.

**Credenciais:** NÃO solicite que a proprietária publique senha, token, chave de serviço, cookie ou arquivo `.env` em mensagens. Ela pode informar o e-mail administrador, mas a senha deve ser criada por fluxo seguro de Supabase Auth (convite, reset ou dashboard autenticado). Configurar segredos apenas em gerenciadores de variáveis de ambiente próprios. Não imprimir nem commitar secretos. NUNCA criar backdoor, senha mestra fixa, login sem senha ou esconder endpoints administrativos.

## 1 — INVENTÁRIO REAL DO ACERVO E PRIORIDADE DE REUSO

Analise o ZIP e os documentos do kit antes de editar. O pacote de trabalho incluirá:

- `fonte-sevensportsbar/sevensportsbar-main/`: código do repositório exportado, com `.env` original removido por segurança.
- `auditoria-migracao/GUIA_AUDITORIA_E_MIGRACAO.md`
- `auditoria-migracao/PROMPT_PLATAFORMA_REPLICAVEL.md`
- `auditoria-migracao/inventario_44_imagens.csv`
- `auditoria-migracao/recuperar_imagens.py`
- `auditoria-migracao/validar_tour.py`
- este `SUPER_PROMPT_ASTRA_VOEE360TOUR.md`.

**Arquivos prioritários no código original** (abrir e preservar lógica validada, abstraindo-a):

- `src/data/tour.json`, `src/data/tour.ts`: 22 cenas, 50 links dirigidos = 25 pares de ida/volta no snapshot ESTÁTICO; estrutura de metadados e links.
- `src/components/TourViewer.tsx`: visualizador 360, Pannellum, troca de cenas, hotspot CSS, navegação e menu.
- `src/components/AdminPanorama.tsx`: posicionamento visual/interativo de setas.
- `src/components/TourEditor.tsx`: seleção de ambiente, adicionar/mover setas, yaw/pitch, direção, tamanho, opacidade, estilos, desfazer/refazer, rascunho, publicação, versões, import/export.
- `src/lib/pannellum-loader.ts` e `public/vendor/{pannellum.js,pannellum.css,LICENSE-pannellum.txt}`: biblioteca do motor e licença, respeitando atribuição/licenciamento.
- `src/lib/tour-motion.ts`, `src/lib/admin-rules.ts`: movimento e esquemas/validação de hotspots.
- `src/lib/admin.functions.ts`, `src/lib/admin-session.server.ts`, `src/lib/public-tour.functions.ts`: avaliar fluxos legados de autenticação, sessão, CRUD e publicação; **não** transportar os segredos ou login único do Seven.
- `drizzle/migrations/0000_tour_admin_versions_sessions.sql`: estudar mecanismo atual de revisão/publicação, mas migrar para tabelas e RPCs multi-tenant, com segurança adequada.
- `src/routes/index.tsx`, `src/routes/admin.tsx`, `src/routes/incorporar.tsx`: referências visuais e funcionais, mas precisam ficar genéricas.
- `src/test/*.test.ts*`: reaproveitar como regressão e substituir casos hardcoded por fixtures multiempresa.
- `vite.config.ts`: **dependência `@lovable.dev/vite-tanstack-config` deve ser removida**; configurar plugins oficiais equivalentes, Vite + TanStack Start + Nitro (versões atuais compatíveis).

**Limitações comprovadas do material:**

- São 22 cenas e 50 setas somente no `tour.json` exportado. O tour efetivamente publicado pode ter alterações posteriores no Supabase; NÃO presumir equivalência.
- As 44 referências de mídias (22 panoramas + 22 thumbnails) apontam para URLs internas `/__l5e/assets-v1/...`; **os JPEG reais não constam no ZIP original**. Tratar fotos como dependência a recuperar/autorizada, não criar imagens falsas nem publicar referências quebradas.
- `src/lib/admin-rules.ts` força `.length(scenes.length)` e IDs estáticos. Remover esse vínculo; o número de cenas passa a ser livre por projeto.
- `src/lib/admin.functions.ts` faz login com senha global `SEVEN_ADMIN_PASSWORD`, sem conta/email individual: substituir integralmente por Supabase Auth, autorização server-side e RLS.
- `src/lib/admin-session.server.ts` afirma sessão permanente mas aplica `maxAge` de 30 dias. Implementar sessão coerente e segura, com expiração/revalidação/logout e recuperação de acesso.
- O restore legado (`restoreAdminVersion`) só busca e devolve o JSON; na interface a recuperação é lançada no estado local, não persistida automaticamente. Projetar RESTAURAÇÃO ATÔMICA E AUDITÁVEL (detalhes abaixo).
- O pacote menciona pendências de setas físicas e fotografia de entrada. Não classificar o Seven como totalmente homologado em produção sem revisão visual e fontes de imagem reais.

Sua primeira saída deve ser um **relatório curto do que foi realmente lido** (arquivos, funções e pendências), e em seguida a execução do código novo.

## 2 — PILHA E INDEPENDÊNCIA

Pilha preferencial para reaproveitamento: React 19 + TypeScript estrito + TanStack Start/Router + Vite + Nitro para deploy + Tailwind CSS + componentes existentes Radix/shadcn + Pannellum (ver licença) + Supabase PostgreSQL/Auth/Storage + Vercel na interface web + GitHub privado.

Antes de congelar versões, conferir documentação atual e compatibilidade, evitar mudanças desnecessárias de framework. **Independência significa não depender do build, runtime, assets, domínios, autenticação ou Supabase gerenciados pelo Lovable**. A Vercel e o Supabase são provedores externos legítimos; garantir portabilidade via SQL migrations, código aberto sob a conta da proprietária, storage organizado e scripts de exportação, sem lock-in artificial. Migrar para um novo projeto Supabase controlado pela proprietária; não sobrescrever o do Seven.

URLs propostas — sujeitas a disponibilidade real:

- web: `https://voee360tour.vercel.app` (se o slug estiver disponível; não afirmar reservado antes do deployment);
- admin: `/login`, `/admin`, `/admin/clientes`, `/admin/projetos`, `/admin/projetos/:id/editor`;
- visitantes: `/t/:slug`, `/embed/:slug`; se houver projetos múltiplos para o mesmo cliente, garantir slug global único ou namespaces estáveis.
- política de `/t/:slug`: publicado/public acessível sem autenticação, RASCUNHO bloqueado; assets das cenas acessíveis de forma apropriada quando publicados.

**Hospedagem e custos:** Supabase Free permite prototipar mas tem armazenamento/quota e pausa por inatividade. Vercel Hobby é **restrito a uso pessoal NÃO COMERCIAL**. Usar somente para desenvolvimento/preview internos quando aplicável. **Antes de disponibilizar passeios para clientes pagantes, obter plano Vercel comercial (Pro) ou escolher alternativa explicitamente permitida para uso comercial**. Não contornar termos de serviço, não ativar cobranças automaticamente. Expor orçamento/quota antes de publicar produção e ativar alertas possíveis. Otimizar panorama pesado e egress.

## 3 — FLUXO V1 DO SUPERADMIN

Na primeira versão, somente UMA superadministradora autentica, via e-mail+senha, no Supabase Auth. Não permitir cadastro público, criação arbitrária de `super_admin` nem edição de papel via frontend. Fazer bootstrap inicial com identidade confirmada do usuário autenticado, usando operação segura na conta Supabase. Modelar futura autorização por organização/projeto sem mostrar agora um portal de clientes.

Após autenticação, exibir painel responsivo e premium com:

1. Cards de total de clientes, tours, publicados, em rascunho, pendências de mídias, versões recentes (dados reais).
2. Clientes: criar, buscar, editar cadastro, logo, contato e situação; não confundir cliente com usuário autenticado.
3. Projetos: criar tour vazio, duplicar tour com recursos próprios, renomear, arquivar/restaurar, status, URL, domínio futuro; múltiplos tours por cliente possíveis.
4. Gerenciador de ambientes: upload múltiplo com progressão, processamento, ordenar, renomear, definir cena inicial, trocar foto, excluir com confirmação/impacto nas conexões, miniatura.
5. Editor 360: edição completa de hotspots de ida/volta, preview real, salvar rascunho, publicar e revisar histórico.
6. Galeria pública de tours/código iframe/QR e controles de identidade visual por projeto.
7. Estado carregando/erro/vazio confiável, teclado/acessibilidade, mobile-first, sem overflow horizontal; UX no celular Android e desktop.
8. Links do tour público somente quando há versão publicada íntegra; cliente sem acesso administrativo nesta fase.

O design da marca voee360tour deve parecer software SaaS profissional (navegação limpa, contraste, tipografia legível, consistência de estados). **Marca e cores de cada cliente são isoladas**; o Seven NÃO dita a identidade da plataforma. Não copiar cores, fotos, logo ou metadados do Seven para tours de outros clientes.

## 4 — MOTOR E EDITOR 360° (REQUISITOS OBRIGATÓRIOS)

Preservar o Pannellum e os controles existentes que funcionarem; transformar as cenas em dados carregados pelo projeto, sem limite fixo 22. Aceitar ao menos 1 ambiente e escalar conforme quota, memória, browser e tamanho dos arquivos. Validar panoramas equiretangulares adequados (aspecto normalmente 2:1), orientação, MIME, extensão, dimensões, tamanho e integridade. Dar feedback claro para arquivo inválido; thumbnails otimizadas geradas automaticamente. Não modificar semanticamente fotos sem consentimento. Para fotos muito grandes, prever pipeline de multirresolução/tile sem impedir versão inicial funcional; adotar lazy loading, cache/CDN e poster enquanto a imagem carrega.

O editor deve permitir:

- adicionar seta clicando/tocando no ponto do panorama e definir destino;
- ajustar posição `yaw` horizontal e `pitch` vertical, rotação/orientação, tamanho, opacidade, rótulo, cor/estilo, ícone e visibilidade;
- arrastar seta de forma precisa, separando modo de arrastar seta do modo de panorâmica para evitar toque acidental;
- criar par bidirecional com **pontos distintos em cada cena**; retorno não é necessariamente a mesma coordenada nem a rotação matemática oposta; confirmar posicionamento físico;
- visualizar/editar/excluir conexão de ida, volta ou ambas, com referência estável (`hotspot_id`, `pair_id` opcional), ações com undo/redo;
- pré-visualizar como visitante; menu ambientes; ordem personalizável; rota inicial; zoom, fullscreen, giro automático opcional, limites de zoom e rotação configuráveis, touch/swipe/mouse; fallback para redução de movimento;
- validar destinos inexistentes, setas duplicadas, falta de retorno, cenas isoladas, conexões não navegáveis, hotspots muito próximos (alerta, não exclusão automática), arquivos faltando, slugs conflitantes;
- criar página de auditoria por projeto com grafo de conexões e relatório de rotas; conectividade automática ≠ garantia de que as setas apontam fisicamente para a passagem correta, logo manter revisão visual manual.

**Experiência de navegação:** um visitante pode entrar por link, navegar livremente, avançar e voltar entre salas sem perda de estado relevante. Animações suaves sem provocar indisposição nem travamentos; boa nitidez sem oversharpen artificial. Compartilhamento WhatsApp com preview/OG otimizado e acessível via crawlers.

## 5 — DADOS, AUTORIZAÇÃO E STORAGE

Crie migrations SQL versionadas e documentação de schema para:

- `profiles` (user_id, nome, papel seguro — preferir tabela de associação/roles autorizadas em vez de metadado mutável);
- `clients` (id, nome, slug opcional, logo, dados administrativos);
- `projects` (id, client_id FK, slug único, título, branding JSON validado, status, first_scene_id, published_version_id, timestamps);
- `scenes` (id, project_id, ordem, nome, thumbnail_asset_id, panorama_asset_id, default_yaw/pitch/hfov, status);
- `hotspots` (id, project_id, source_scene_id, target_scene_id, pair_id opcional, yaw, pitch, rotation, size, opacity, label, style, sort_order);
- `media_assets` (id, project_id, storage_bucket/path, content_type, width, height, file_size, hash, thumbnail, ownership/status);
- `tour_versions` (imutáveis: project_id, version_number ou revision ID, snapshot completo de cenas/hotspots/config/media, author, created_at, kind, nota);
- `tour_drafts` ou draft revision por projeto (rev/etag, estado editável, updated_at);
- `publication_events` e `audit_events` (quem, quando, project_id, revisão anterior/nova, operação, status);
- `project_members` apenas como fundação futura do portal cliente, com restrições, sem habilitar contas cliente na V1.

Adapte nomes se houver modelo mais consistente, mas mantenha FK, índices, CASCADE/RESTRICT deliberados, timestamps, constraints e migrações reversíveis. **Toda entidade de projeto deve carregar e checar `project_id`**, com integridade referencial de cenas/hotspots cruzados: proibir uma seta de projeto A navegar para cena do projeto B.

**Segurança:** RLS obrigatória em todas as tabelas expostas (`public`), RLS/policies de storage separando mídia, servidor valida papel superadmin em todas as mutações, acesso público somente a snapshots publicados e media apropriada; `service_role`/secret key exclusivamente no servidor e, quando possível, preferir cliente autenticado + RLS para minimizar bypass. Nunca usar `user_metadata` editável para privilégios; autorização por tabela segura ou app_metadata atualizado apenas por servidor confiável. Aplicar rate limiting ao login, política de sessão, proteção CSRF onde aplicável, cabeçalhos e logs sem dados sensíveis, validação Zod de inputs, proteção upload (tipo, tamanho, extensão, paths aleatórios, quotas), prevenção de SQL injection e XSS, escopo do objeto ao projeto em cada query. Armazenar credenciais apenas em configuração segura, `.env.example` sem valores reais, `.gitignore` completo.

**Storage:** bucket(s) em Supabase controlado pela proprietária; organização `projects/{projectId}/panoramas/{assetId}` e `.../thumbs/...` ou equivalente; metadata e hash para integridade; upload com progresso e recuperação de erro; assets publicados servidos com cache/CDN; rascunhos não devem vazar antes da publicação. **Não usar as URLs ` /__l5e/assets-v1` em runtime**. Planejar exportação/importação de mídias para novo provedor no futuro, sem bloquear saída.

## 6 — VERSIONAMENTO, HISTÓRICO E RESTAURAÇÃO: RECONSTRUIR SEM BUGS

Esta é uma exigência prioritária: o restaurar histórico do Seven original apresenta comportamento insuficiente. Implementar histórico robusto:

- edição gera rascunho independente do conteúdo publicado;
- salvar usa revisão/etag com lock otimista para impedir sobrescrita silenciosa; tratar conflitos de duas abas;
- publicar produz `tour_versions` imutável e move `published_version_id` **atomicamente** na mesma transação ou RPC segura; visitante vê sempre snapshot integral anterior OU novo, nunca mistura;
- cada publicação gera item de histórico com data, autor e nota; permitir visualizar diff/hotspots adicionados/retirados entre revisões, ao menos como resumo;
- **restaurar** versão histórica deve: (a) verificar dono/escopo/papel, (b) checar integridade de cenas/imagens e IDs, (c) preservar estado atual como ponto recuperável, (d) materializar a versão antiga como **novo rascunho persistido no servidor** com revisão própria, (e) apresentar preview e confirmação, (f) publicar somente após ação explícita. Nunca sobrescrever ou excluir snapshot antigo;
- oferecer restauração de versão publicada para outra versão publicada sob confirmação controlada; idealmente criar nova publicação como cópia do snapshot selecionado mantendo trilha auditável;
- botão cancelar, feedback inequívoco, retorno após refresh/logout/login; se falhar transação não alterar a publicação;
- undo/redo local (limite razoável) para alterações não salvas; após refresh o draft permanece, sem alegar que undo/redo é histórico persistido;
- testes E2E e unitários: editar, salvar, publicar V1, editar, publicar V2, restaurar V1 -> novo draft -> refresh -> visualizar -> publicar V3, visitar link público e verificar V3; testar conflitos e falha de mídia; validar integridade no banco.

## 7 — MIGRAÇÃO DO SEVEN SEM DESTRUIR O ORIGINAL

1. Criar repositório **novo** `voee360tour` na organização/usuário GitHub que a proprietária autorizar; default privado. Importar partes selecionadas do ZIP como código-fonte base, preservando créditos/licenças, não copiar segredos.
2. Estabelecer **novo** Supabase da plataforma, mantendo Seven original completamente isolado e intacto.
3. Criar cadastro de cliente **Seven Sports Bar**, projeto `seven-sports-bar`, importar 22 ambientes e 50 setas do snapshot `src/data/tour.json` como **rascunho legado**; não afirmar que é equivalente ao estado publicado. Colocar status `pendente_midia` até localizar os 44 JPEGs e auditar caminhos. Se tiver conexão/autorização, comparar com JSON publicado no Supabase legado e incorporar somente após conciliação, sem mutar o legado.
4. Criar cadastro de cliente **Nostro Fumo**, projeto vazio `nostro-fumo`, preparado para subir suas fotos e ligar cenas. **Não usar as fotos do Seven, nem inventar cenas para a Nostro Fumo**.
5. Recuperar mídias por meios autorizados a partir do site publicado/arquivos originais/conta Lovable, usando inventário e script somente após verificar acesso. Se falharem, documentar quais estão faltando e aceitar upload manual. Um preview pode usar imagens demonstrativas claramente marcadas, nunca publicá-las como cliente sem autorização.
6. Validar fisicamente as setas do Seven e registrar pendências de revisão; a integridade lógica do JSON não certifica direção visual.
7. Somente depois de imagens reais presentes e testes completos publicar o cliente na nova plataforma; **não retirar o antigo do ar automaticamente**.

## 8 — PUBLICAÇÃO, COMPARTILHAMENTO E PORTABILIDADE

- link público por tour, exemplo `/t/seven-sports-bar`; URL final depende do domínio/deploy de verdade;
- rota `/embed/:slug` sem UI administrativa, responsiva e compatível com iframe; gerar snippet com atributo title e dimensionamento;
- thumbnail de capa, título/descrição OG (meta SSR quando aplicável), Twitter card, robots, favicon/identidade por tour quando tecnicamente viável; imagem OG leve e testável no compartilhamento WhatsApp;
- QR code e copiar link/código iframe;
- opção offline/download JSON da configuração do tour + inventário de mídias, sem incluir chaves/credenciais;
- preparação futura para exportar pacote estático por cliente, sem acesso ao código do painel superadmin nem chaves secretas; não bloquear MVP por essa função;
- separar projeto original Seven do workspace comercial, sem dependência de `/__l5e/...`, `@lovable.dev/vite-tanstack-config`, hosts ou APIs internas Lovable;
- verificações de deploy e log de erros, preview antes de produção, rollback da implantação distinto de rollback do conteúdo do tour.

## 9 — CHECKLIST DE QUALIDADE E TESTES REAIS

Executar e relatar resultados reais (não inventar) de:

- install clean com lockfile pinado; lint; typecheck `tsc`; test unitário/integração; build Vercel + Nitro sem plugins Lovable;
- rotas públicas e privadas, proteção de superadmin, no public signup, logout, expirado/retorno;
- RLS: sem login não altera nada; usuário normal não vira superadmin; consulta cruzada entre projeto A/B negada; só publicado vira público; buckets impedem leituras indevidas de rascunhos;
- criação do cliente A/B; edição de 1 a N ambientes; upload, reorder, delete com revisão de conexões;
- ida e volta com posições independentes, troca de ambiente, pan/zoom, mobile/touch, teclado/alt;
- auditoria de 22/50 do JSON Seven, import/export, estados com mídia ausente;
- persistência de rascunho e cenário completo de versionamento/restauração descrito na seção 6;
- navegador mobile (viewport 360×800 e outros), desktop, horizontal overflow zero, toque, desempenho e fallback rede lenta;
- OG/WhatsApp preview, permalink, iframe, QR code, ausência de mixed content/CORS bloqueantes;
- roteamento no Vercel, páginas SSR, refresh direto em `/admin`, `/t/slug`, `/embed/slug`; logs limpos de segredos.

Não classificar TODO como pronto sem execução real. Cada etapa deve mostrar status `Concluído/testado`, `Implementado não testado`, `Bloqueado por acesso` ou `Pendente`, e como reproduzir a validação.

## 10 — SEQUÊNCIA DE EXECUÇÃO E ENTREGA ESPERADA

**Não se limite a explicar como seria feito: crie arquivos e implemente dentro do ambiente Work.** Atue por etapas contínuas e aproveite as integrações GitHub, Supabase e Vercel se efetivamente autorizadas. Se nenhuma integração permitir escrita, prepare repositório local completo e ZIP instalável, sem simular criação remota.

A. INSPEÇÃO: abrir anexos, inventário do source, detectar dependências internas do Lovable, problemas em versões/restauração, situação de mídias e riscos de segurança.
B. SCAFFOLD: criar novo workspace `voee360tour`, migrar viewer/editor, configurar Vite/TanStack/Nitro e `.env.example`, preparar scripts, documentação e lockfile.
C. MODELO: criar migrations do Supabase e políticas RLS, autenticação individual do superadmin e seed seguro (sem senha no repositório).
D. V1 FUNCIONAL: dashboard multi-cliente, CRUD, upload, editor 360 por projeto, draft/publish/version/restore, viewer e embed.
E. MIGRAÇÃO: cadastrar Seven do JSON como rascunho e Nostro como vazio, recuperar mídias autorizadas sem quebrar o legado.
F. QA: executar matriz de testes e corrigir erros, melhorar mobile; priorizar impedir perda de dados.
G. DEPLOY: configurar e verificar projeto `voee360tour` na Vercel em preview interno, conexão a Supabase independente e domínio `voee360tour.vercel.app` apenas se realmente disponível. **Não promover para prestação de serviço comercial em Hobby.** Antes de tráfego pago/comercial, apresentar plano/licença apropriados.
H. FINAL: fornecer link real do repositório (se criado), URL realmente publicada, projeto Supabase (sem chaves), credenciais via fluxo de convite seguro, manual para criar o próximo cliente em poucos cliques, logs de build/testes, inventário de pendências, custos/limites e próximos passos.

**Critérios de aceite inegociáveis:**

1. Um login legítimo de superadmin, com e-mail + senha, pode acessar e administrar vários clientes, e nenhum cliente pode entrar na V1.
2. Posso criar um novo cliente, criar um tour vazio, enviar 2 panoramas reais, colocar ida e volta em coordenadas escolhidas, salvar e publicar usando apenas a interface, sem editar o código.
3. A URL do tour abre em celular e computador com navegação, zoom e sem scroll horizontal.
4. O histórico de versões funciona APÓS recarregar página e restaurar uma publicação NÃO remove publicações antigas.
5. Cada projeto possui dados, identidade e snapshots isolados; nenhum componente reutiliza imagens/nomes Seven por padrão.
6. O deploy não utiliza runtime, plugins de build, assets nem backend administrado pelo Lovable.
7. Entregar resultado verificável, não um mockup, prints estáticos ou promessa de implementação.

**ATENÇÃO FINAL AO NOME:** `voee360tour` É A MARCA/PLATAFORMA. `Seven Sports Bar` E `Nostro Fumo` SÃO SOMENTE CLIENTES. Escreva e desenvolva agora. Se ocorrer bloqueio externo de credenciais/permissões, continue trabalhando e entregue uma versão local executável com instrução pontual para desbloquear.

## 11 — REFERÊNCIAS DOCUMENTAIS (CONFERIR VERSÃO ATUAL)

- Vercel + TanStack Start: https://vercel.com/docs/frameworks/full-stack/tanstack-start
- Vercel Hobby e uso não comercial: https://vercel.com/docs/plans/hobby
- Supabase preços/limites: https://supabase.com/pricing
- Supabase auth users: https://supabase.com/docs/guides/auth/users
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Storage: https://supabase.com/docs/guides/storage
- Pannellum documentação: https://pannellum.org/documentation/overview/
