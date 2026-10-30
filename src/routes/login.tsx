import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Mail, ShieldCheck } from "lucide-react";
import { Brand } from "../components/Brand";
import { supabase, configured } from "../lib/supabase";
import { errorText } from "../lib/model";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Acessar painel · voee360tour" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const [hydrated, setHydrated] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    setHydrated(true);
    let mounted = true;
    try {
      const lastEmail = window.localStorage.getItem("voee360tour:last-access-email");
      if (lastEmail) setEmail(lastEmail);
    } catch {
      // Private browsing may disable local storage.
    }
    if (configured) {
      void supabase.auth.getUser()
        .then(async ({ data, error }) => {
          if (error || !data.user || !mounted) return;
          const result = await supabase.rpc("is_super_admin");
          if (mounted && !result.error && result.data === true)
            await navigate({ to: "/admin/projetos" });
        })
        .catch(() => {
          // The user can still request a passwordless link below.
        });
    }
    return () => {
      mounted = false;
    };
  }, [navigate]);

  async function requestAccess(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || Date.now() < cooldown) return;
    setBusy(true);
    setMessage("");
    try {
      if (!configured)
        throw new Error("A conexão da plataforma ainda não foi configurada.");
      const address = email.trim().toLowerCase();
      if (!address) throw new Error("Informe o e-mail autorizado.");
      const { error } = await supabase.auth.signInWithOtp({
        email: address,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: window.location.origin + "/admin/projetos",
        },
      });
      if (error) throw error;
      try {
        window.localStorage.setItem("voee360tour:last-access-email", address);
      } catch {
        // Remembering the email is optional.
      }
      setMessage("Enviamos um link temporário ao e-mail autorizado. Abra a mensagem e toque em Acessar painel. Não é necessário digitar senha.");
      setCooldown(Date.now() + 60000);
    } catch (error) {
      setMessage(errorText(error));
      setCooldown(Date.now() + 3000);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-layout">
      <section className="login-story">
        <Link to="/" className="brand-link"><Brand /></Link>
        <div className="orb-scene">
          <div className="orb-grid" />
          <span className="orbit orbit-one" />
          <span className="orbit orbit-two" />
          <span className="orb-label">EXPLORE. CONECTE. TRANSFORME.</span>
        </div>
        <div>
          <p className="eyebrow">CADA ESPAÇO, UMA NOVA PERSPECTIVA</p>
          <h1>Seus passeios virtuais,<br />a um clique de <em>distância.</em></h1>
          <p>Crie, conecte e edite seus ambientes 360° com segurança.</p>
        </div>
        <span className="story-footer">voee360tour · Sua visão, sem limites de perspectiva.</span>
      </section>
      <section className="login-form-section">
        <div className="mobile-brand"><Brand /></div>
        <div className="login-form-wrap">
          <span className="secure-badge"><ShieldCheck size={14} /> ACESSO SEM SENHA</span>
          <h2>Seu universo 360°.</h2>
          <p>Use o botão de acesso para receber um link temporário e abrir o editor dos seus passeios.</p>
          <form onSubmit={requestAccess}>
            <label>
              E-mail autorizado
              <input
                autoComplete="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
              />
            </label>
            {message && <p role="status" className="notice">{message}</p>}
            <button className="primary wide" disabled={busy || !hydrated}>
              {busy ? "Enviando acesso…" : "Acessar painel"}
              {busy ? <Mail size={18} /> : <ArrowRight size={18} />}
            </button>
          </form>
          <div className="login-security">
            <ShieldCheck size={16} />
            <p>Não há campo de senha. Somente o e-mail administrador já autorizado recebe acesso ao editor; visitantes não podem alterar ou excluir passeios.</p>
          </div>
        </div>
        <footer>© {new Date().getFullYear()} voee360tour <span>Todos os ângulos. Uma plataforma.</span></footer>
      </section>
    </main>
  );
}
