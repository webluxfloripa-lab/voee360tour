# Hospedagem Cloudflare

Aplicação publicada em https://voee360tour.webluxfloripa-lab.workers.dev/login em 29/10/2026.

Worker: `voee360tour`. A hospedagem existente permanece disponível. Supabase Auth, banco e Storage continuam no projeto atual; a implantação não migra nem publica dados dos clientes.

## Compilação e publicação

Use Node 22.12 ou superior e `npm ci`. Configure localmente `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`, sem credenciais administrativas.

Execute `npm run build:cloudflare` e depois `npm run deploy:cloudflare` com uma sessão Cloudflare autorizada. A compilação padrão continua compatível com a hospedagem Vercel.

A embalagem inclui os arquivos públicos no módulo do Worker; fotos privadas continuam no Storage. O envio desta primeira versão foi realizado pela API Cloudflare. Atualização automática pelo GitHub ainda não foi configurada.

## Verificação

TypeScript e 26 testes automatizados passaram. O pacote compilou e o Worker foi aceito pela Cloudflare, com inicialização de 12 ms. Login renderizado no navegador e visita sem sessão a `/admin/projetos` redirecionada para `/login`. Não houve login da titular, alteração de dados ou publicação de tours reais. A regressão completa em simulador Cloudflare local ficou impedida por falha do ambiente ao detectar interfaces de rede.

Recuperação de senha e convites dependem da lista de redirecionamentos permitidos do Supabase; este trabalho não alterou a configuração de Auth.
