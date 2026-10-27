# Entrega V1 — voee360tour

Aplicação real, editável e executável, com preview na Vercel e Supabase independente. Esta entrega é para homologação interna e ainda não representa liberação comercial de tours de clientes.

## Acessos

- Plataforma: https://voee360tour.vercel.app/login
- Primeiro acesso: https://voee360tour.vercel.app/definir-senha
- Deployment de preview: https://voee360tour-1kz9fnz9d-daniel-16cd.vercel.app
- Vercel: projeto `voee360tour`, deployment `dpl_EAQaP48mNCh4YKPd1ei93RENtyKq`, target `staging`, status READY.
- Supabase independente: `fbfdchnttkiovcpwcgfn` (sa-east-1).
- Commit da aplicação implantada: `6e48ab68fd4030f41f3297c130bf87c161c24c07`.
- SUPER_ADMIN: `wowdanielnadal@gmail.com`. Convite enviado e associação segura confirmada no banco.

A titular informou ter acessado o aplicativo e redefinido a senha pelo fluxo seguro. O agente não inspecionou essa sessão; os testes de navegador automatizados continuam sendo descritos como testes com fixtures. A senha informada no chat não consta no código, configuração, histórico Git ou pacote entregue.

## O que está implementado

Painel central, clientes independentes, vários projetos por cliente, arquivos próprios por projeto, upload múltiplo e miniaturas, gerenciamento de ambientes, editor visual de setas com ida/volta em coordenadas independentes, posição/direção/tamanho/opacidade/cor/estilo/ícone, arrastar em modo separado, undo/redo, auditoria de navegação com grafo, prévia Pannellum, rascunhos com conflito otimista, publicação atômica, histórico imutável e restauração persistente com checkpoint, arquivamento, duplicação com cópia de arquivos, URLs públicas, iframe, QR Code, compartilhamento e backup ZIP com hashes.

O modelo, as RPCs e o bucket são próprios do Supabase novo. O build usa Vite + TanStack Start + Nitro, sem plugin Lovable. Não há painel de clientes nesta fase.

## Dados reais

| Cliente          | Ambientes | Setas | Arquivos próprios | Estado                            |
| ---------------- | --------: | ----: | ----------------: | --------------------------------- |
| Seven Sports Bar |        22 |    50 |                44 | Rascunho, revisão física pendente |
| Nostro Fumo      |         0 |     0 |                 0 | Projeto vazio                     |

Foram recuperados 22 panoramas e 22 miniaturas, totalizando 14.077.933 bytes. Os panoramas são 2:1. Os arquivos estão no Storage privado e também acompanham este pacote em `media/`, junto com inventário e hashes. O Seven original não foi alterado.

## Verificação

TypeScript e lint passaram. 11 testes unitários, 17 verificações locais do banco, 7 cenários no Supabase real e 10 testes Chromium em celular/touch e desktop passaram. A auditoria de dependências de produção reportou zero vulnerabilidades após atualização do Zod para 4.6.7. A instalação limpa e o build foram executados com lockfile.

A suíte de interface usa fixtures isoladas da API e fotos reais; as transações e permissões foram testadas separadamente no Supabase real, com rollback das alterações. O teste não simula um login bem-sucedido da titular. Os relatórios detalham esses limites.

O preview final respondeu HTTP 200, com cabeçalhos de segurança. A página final foi aberta no navegador no domínio preferido. A verificação de runtime não retornou registros de erro/fatal para o deployment no intervalo consultado.

## Pendências

1. Homologar com a titular a operação de um tour na sessão real. Ela informou ter acessado o aplicativo e redefinido a senha.
2. Acompanhar os checks de qualidade e os deployments das novas alterações. GitHub e Vercel já foram conectados pela titular e o vínculo foi verificado. O histórico anterior à importação segue preservado no bundle da entrega inicial.
3. Ajustar Site URL/Redirect URLs do Auth para o domínio final. Enquanto isso, a página de primeiro acesso valida diretamente o link do convite quando o redirecionamento padrão não funcionar.
4. Conferir fisicamente as 50 setas e conciliar com eventuais alterações posteriores do Seven original.
5. Confirmar hospedagem autorizada para uso comercial antes de liberar tours de clientes pagantes. Nenhum pagamento/upgrade foi realizado.
6. Conferir a opção de proteção contra senhas vazadas no dashboard/plano Supabase. O advisor sinaliza essa opção desabilitada; não há achado de RLS pendente.
7. Homologar compartilhamento WhatsApp/OG e iframe após uma publicação autorizada. Duplicação, backup ZIP e logo foram implementados, mas não passaram por um fluxo completo de browser nesta entrega.

## Estrutura do pacote

- `source/`: código completo, migrations, testes, fixtures e documentação, sem node_modules, arquivos de ambiente reais ou segredos.
- `media/`: as 44 fotografias/miniaturas recuperadas, com caminhos independentes de provedor.
- `media-manifest.json`: inventário com SHA-256, tamanho, dimensões e vínculo com o Seven.
- `voee360tour-history.bundle`: histórico Git local, restaurável com `git clone voee360tour-history.bundle voee360tour`.

Consulte `README.md` para executar e `docs/VALIDACAO.md` para resultados e reprodução dos testes.

## Atualização do editor

O fluxo de conexão guiada e as correções de auditoria estão descritos em [AUDITORIA-CONEXOES.md](AUDITORIA-CONEXOES.md), que registra os testes atuais sem substituir as evidências históricas desta entrega inicial.
