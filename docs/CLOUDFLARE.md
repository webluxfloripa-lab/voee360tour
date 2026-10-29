# Hospedagem Cloudflare

Aplicação publicada em https://voee360tour.webluxfloripa-lab.workers.dev/login em 29/10/2026.

Worker: `voee360tour`. A hospedagem existente permanece disponível. Supabase Auth, banco e Storage continuam no projeto atual; a implantação não migra nem publica dados dos clientes.

## Compilação e publicação

Use Node 22.12 ou superior e `npm ci`. Configure localmente `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`, sem credenciais administrativas.

Execute `npm run build:cloudflare` e depois `npm run deploy:cloudflare` com uma sessão Cloudflare autorizada. A compilação padrão continua compatível com a hospedagem Vercel.

A embalagem inclui os arquivos públicos no módulo do Worker; fotos privadas continuam no Storage. O envio desta primeira versão foi realizado pela API Cloudflare. Atualização automática pelo GitHub ainda não foi configurada.

## Atualização automática preparada

Repositório: `webluxfloripa-lab/voee360tour`. Branch de produção: `main`. Diretório raiz: `/`. Inclua todos os caminhos (`*`) e somente a branch de produção para evitar publicar trabalho em andamento.

- Build: `npm run build:cloudflare && npm run typecheck && npm run lint && npm test`
- Deploy: `npm run deploy:cloudflare`
- Versão do Node: 22 ou superior, respeitando o mínimo 22.12 do projeto.
- Variáveis de build: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` e `VITE_SITE_URL=https://voee360tour.webluxfloripa-lab.workers.dev`.

Cadastre os valores públicos do mesmo projeto Supabase usado atualmente. Não use chaves administrativas. A compilação agora falha se as variáveis estiverem ausentes ou se receber uma chave administrativa; assim uma configuração incompleta não substitui a versão funcional.

O workflow de qualidade do GitHub compila também o pacote Cloudflare, sem implantar os valores de teste.

**Bloqueio atual:** a API de conexão retornou `8000008`, indicando que a conta Git ainda não foi vinculada à Cloudflare. A documentação oficial exige instalar/autorizar o app Cloudflare GitHub pelo painel uma vez antes de criar a conexão pela API. O Worker permanece publicado e a automação ainda não está ativa.

No painel Cloudflare: Workers & Pages → voee360tour → Settings → Builds → Connect → GitHub. Autorize o repositório `voee360tour`. Depois crie o trigger de produção com os comandos acima e o token de build da Cloudflare. Valide um build disparado por commit antes de considerar a integração concluída.

Referência: https://developers.cloudflare.com/workers/ci-cd/builds/api-reference/

## Verificação

TypeScript e 26 testes automatizados passaram. O pacote compilou e o Worker foi aceito pela Cloudflare, com inicialização de 12 ms. Login renderizado no navegador e visita sem sessão a `/admin/projetos` redirecionada para `/login`. Não houve login da titular, alteração de dados ou publicação de tours reais. A regressão completa em simulador Cloudflare local ficou impedida por falha do ambiente ao detectar interfaces de rede.

Recuperação de senha e convites dependem da lista de redirecionamentos permitidos do Supabase; este trabalho não alterou a configuração de Auth.
