# voee360tour

Plataforma proprietária de passeios virtuais 360°, com painel exclusivo de SUPER_ADMIN. React 19, TypeScript, TanStack Start/Router, Vite/Nitro, Pannellum e Supabase. O Seven e a Nostro Fumo são clientes independentes.

## Cloudflare Workers

Endereço: https://voee360tour.webluxfloripa-lab.workers.dev/

Configure `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` e `VITE_SITE_URL` antes do build. Use a origem Workers em `VITE_SITE_URL` para que imagens de compartilhamento não dependam da Vercel. Somente a chave publicável deve ser usada; nunca uma chave de serviço.

```bash
npm ci
npm run build:cloudflare
npm run deploy:cloudflare
```

O empacotamento mantém o mesmo formato da implantação original: Worker com SSR e arquivos estáticos incorporados, sem dependência de outra hospedagem. `cloudflare/security.mjs` aplica os cabeçalhos de segurança, impede cache das páginas administrativas e conserva cache imutável dos arquivos com hash. O build padrão e a detecção de Vercel continuam disponíveis.

Em 29/10/2026 a implantação foi feita pela API. **A atualização automática do Cloudflare pelo GitHub ainda não está configurada.** O repositório agora contém o build reproduzível, mas precisa ser conectado no Workers Builds com os três valores públicos acima; build `npm run build:cloudflare`, deploy `npx wrangler deploy --config .cloudflare-output/wrangler.json`, branch `main`. Nenhum token ou workflow com credenciais foi criado nesta auditoria.

Veja [a auditoria do Cloudflare](docs/AUDITORIA-CLOUDFLARE.md).

## Executar

Requer Node 24 (ou >=22.12).

```bash
npm ci
cp .env.example .env.local
# Preencha URL e chave publicável do SEU Supabase. Nunca use service_role no navegador.
npm run dev
```

```bash
npm run typecheck
npm run lint
npm test
npm run db:test
npm run test:e2e
npm run build
npm start
```

O servidor de desenvolvimento usa `http://127.0.0.1:3000`. O Playwright inicia um servidor separado na porta 3174 e usa Chromium empacotado como dependência de desenvolvimento. Consulte `docs/VALIDACAO.md` para distinguir testes locais, fixtures de interface e verificações no Supabase real.

## Infraestrutura desta entrega

- Supabase independente: `fbfdchnttkiovcpwcgfn` (São Paulo).
- Projeto Vercel: `voee360tour` / `prj_szwTh2gtrJpB6uGEf7yDRQj3bxqD`.
- Preview de homologação em https://voee360tour.vercel.app/login, com autenticação administrativa própria. Deployments técnicos individuais mantêm proteção Vercel.
- Código enviado ao repositório privado https://github.com/webluxfloripa-lab/voee360tour. Os 92 arquivos do snapshot local `86eb308` foram conferidos por SHA Git; árvore idêntica `bea6b5360d43fa5db32cbe135014d73edf6c5b20`, importada no commit remoto `affae99a3c57642a745d08802b31a33d484c7990`. O projeto Vercel já está conectado ao repositório; a conexão foi confirmada pela API e por um deployment gerado do GitHub.
- Nenhum repositório, dado, deployment ou configuração do Seven original foi alterado.

## Autenticação e primeiro acesso

A única identidade V1 é `wowdanielnadal@gmail.com`, convidada via API administrativa do Supabase. A titular informou ter redefinido a senha e acessado o aplicativo pelo fluxo seguro. A senha continua sendo definida exclusivamente pela própria titular; essa sessão não foi inspecionada pelo agente. A aplicação não oferece cadastro público.

Se o link do e-mail redirecionar para o endereço padrão do Supabase (`localhost`), abra `/definir-senha` no preview e use **Link do convite**: copie o endereço do botão do e-mail e cole exclusivamente nesse campo da aplicação. O token é validado diretamente pelo Supabase e não deve ser enviado ao chat. Depois, defina uma senha exclusiva com pelo menos 12 caracteres.

Para simplificar os próximos convites e recuperação, configure **Authentication → URL Configuration** no Supabase: Site URL e Redirect URLs devem apontar para o endereço efetivamente utilizado, incluindo `/definir-senha`. A integração atual não expõe essa configuração; não afirmamos tê-la aplicado.

O bootstrap só permite inserir a identidade autorizada durante uma janela de convite reivindicada por operação exclusiva de serviço. O papel é concedido apenas quando o Supabase define `invited_at`, um campo protegido. Metadados editáveis de usuário nunca concedem privilégio. O convite já foi enviado, a janela foi fechada e a Edge Function de bootstrap foi substituída por resposta 410.

## Criar o próximo cliente

1. Entre no painel e abra **Clientes → Novo cliente**.
2. Cadastre nome, identificador, contato e e-mail.
3. Em **Projetos e tours → Novo projeto**, escolha o cliente, título e slug exclusivo.
4. Abra o editor e envie fotografias equiretangulares 2:1. Miniaturas são geradas automaticamente.
5. Selecione uma cena, escolha o destino e use **Posicionar no panorama**.
6. Selecione a seta de ida e use **Posicionar retorno**. No ambiente de destino, toque no ponto físico da volta. As posições são independentes.
7. Ajuste direção, posição, tamanho, opacidade, cor, ícone e visibilidade. Use **Mover seta** para arrastar e **Explorar** para girar o panorama.
8. Salve, abra a auditoria, confira as passagens na prévia e publique quando autorizado para o ambiente de hospedagem.
9. Use **Compartilhar** para link, WhatsApp, QR Code ou iframe.

A V1 não possui painel/login dos clientes. Todo o conteúdo é operado pela SUPER_ADMIN.

## Histórico sem perda

`save_draft` faz comparação de revisão e rejeita sobrescrita concorrente. `publish_tour` valida o snapshot, registra uma versão imutável e muda a projeção pública em uma única transação. `restore_version` preserva o rascunho atual como checkpoint, valida a versão escolhida e cria um novo rascunho persistido; não muda a publicação. Uma nova publicação após restaurar cria outra versão, sem apagar as anteriores.

O undo/redo é local e limitado a 100 alterações. Ele não substitui o histórico persistente. Ações sobre versões sem fotografias recuperáveis são bloqueadas.

## Banco e portabilidade

As migrations em `supabase/migrations` são aplicadas em ordem. A primeira cria o esquema e todas as políticas. As migrations de seed e importação são específicas da migração autorizada do Seven; para outra instalação, ajuste a identidade de bootstrap e decida quais seeds executar.

- Todas as tabelas expostas têm RLS.
- Toda mídia e entidade do tour carrega `project_id`.
- FKs compostas impedem conexões cruzadas entre projetos.
- As mutações passam por RPCs autenticadas; clientes não têm permissão de alteração direta de tabelas.
- Implementações privilegiadas ficam no schema privado e verificam a associação segura de SUPER_ADMIN.
- Acesso anônimo somente à projeção publicada e aos arquivos referenciados por ela.
- Bucket privado `tour-media`, objetos imutáveis, paths exclusivos por projeto.
- Arquivar retira o tour público e preserva versões e fotografias.
- **Backup ZIP** baixa rascunho, histórico, inventário e fotografias, verificando os hashes. O JSON individual continua disponível para edição/importação no mesmo projeto.
- A duplicação cria novos IDs e copia os arquivos para paths do novo projeto. Nunca compartilha os objetos editáveis entre projetos.

Não há dependência operacional do Lovable. Referências antigas aparecem apenas em fixtures, documentação e scripts de migração, nunca no visualizador ou no fluxo de publicação.

## Hospedagem comercial

O deployment desta entrega é para preview/homologação interna. Vercel Hobby restringe uso a projetos pessoais não comerciais. Antes de atender clientes pagantes, confirme um plano Vercel que permita esse uso (ou outro provedor compatível), orçamento e cotas. Nenhum upgrade ou pagamento foi realizado.

Consulte `docs/OPERACAO.md`, `docs/VALIDACAO.md` e `docs/ARQUITETURA.md`.

## Editor guiado de conexões

No panorama, escolha **Adicionar seta**, toque na passagem e selecione o próximo ambiente no painel **Conectar ambiente**. Use **Continuar e posicionar volta**, marque a passagem no panorama de destino, escolha **Concluir conexão** e **Salvar rascunho**. O painel **Conexões entre ambientes** permite retomar voltas pendentes, editar cada direção e testar a navegação sem publicar o tour.

Veja [a auditoria e os limites de homologação](docs/AUDITORIA-CONEXOES.md).

No celular, use as miniaturas para escolher o destino e segure a seta para arrastá-la. Veja [a auditoria mobile e as capturas](docs/AUDITORIA-MOBILE.md).
