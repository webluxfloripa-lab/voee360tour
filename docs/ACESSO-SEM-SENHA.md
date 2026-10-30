# Acesso sem senha — Voee360Tour

A interface pública em `/` contém um único botão **Acessar painel**. Uma sessão administrativa válida leva diretamente para `/admin/projetos`; se não houver sessão, `/login` solicita somente o e-mail da conta já autorizada.

A chamada `supabase.auth.signInWithOtp` usa `shouldCreateUser:false` para não permitir cadastramento por e-mail anônimo. O Supabase envia um link temporário ao e-mail; ao abri-lo, o navegador obtém uma sessão e o `AuthGate` verifica também `is_super_admin`. O editor, as operações RPC e o banco continuam protegidos. Nenhuma política RLS ou conta administrativa foi alterada. Não existe "login universal" para edição.

**Configuração do projeto Supabase Auth**: confirmar na seção Authentication > URL Configuration o Site URL e Redirect URLs, incluindo:
- `https://voee360tour.vercel.app/**`
- `https://voee360tour.webluxfloripa-lab.workers.dev/**`

Configurar o e-mail de Magic Link para autorizar redirecionamento e, se o fluxo PKCE exigir, o callback apropriado. No painel oficial, `signInWithOtp` só consegue entregar e-mails se o provedor de e-mail estiver corretamente configurado e dentro das cotas.

**Testes**: `npm run build && npm run typecheck && npm run lint && npm test && npm run test:e2e`.

Referência: https://supabase.com/docs/guides/auth/auth-email-passwordless

**Atenção**: a versão publicada somente ficará atualizada após build e deploy do commit aprovado; o código foi preparado para não interferir nos dados existentes.
