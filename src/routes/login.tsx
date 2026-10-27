import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, LockKeyhole, Eye, EyeOff } from "lucide-react";
import { Brand } from "../components/Brand";
import { supabase, configured } from "../lib/supabase";
import { errorText } from "../lib/model";
export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar · voee360tour" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: Login,
});
function Login() {
  const nav = useNavigate();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [visible, setVisible] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [cooldown, setCooldown] = useState(0);
  async function login(e: React.FormEvent) {
    e.preventDefault();
    if (busy || Date.now() < cooldown) return;
    setBusy(true);
    setMessage("");
    try {
      if (!configured)
        throw new Error("A conexão da plataforma ainda não foi configurada.");
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      setPassword("");
      if (error) throw error;
      const { data, error: err } = await supabase.rpc("is_super_admin");
      if (err || !data) {
        await supabase.auth.signOut();
        throw new Error("Acesso exclusivo da superadministradora.");
      }
      await nav({ to: "/admin" });
    } catch (e) {
      setMessage(errorText(e));
      setCooldown(Date.now() + 3000);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-layout">
      <section className="login-story">
        <Link to="/" className="brand-link">
          <Brand />
        </Link>
        <div className="orb-scene">
          <div className="orb-grid" />
          <span className="orbit orbit-one" />
          <span className="orbit orbit-two" />
          <span className="orb-label">EXPLORE. CONECTE. TRANSFORME.</span>
        </div>
        <div>
          <p className="eyebrow">CADA ESPAÇO, UMA NOVA PERSPECTIVA</p>
          <h1>
            O próximo passo
            <br />é estar <em>dentro.</em>
          </h1>
          <p>Transforme espaços reais em experiências que aproximam pessoas.</p>
        </div>
        <span className="story-footer">
          voee360tour · Sua visão, sem limites de perspectiva.
        </span>
      </section>
      <section className="login-form-section">
        <div className="mobile-brand">
          <Brand />
        </div>
        <div className="login-form-wrap">
          <span className="secure-badge">
            <LockKeyhole size={14} /> ACESSO EXCLUSIVO
          </span>
          <h2>Seu universo 360°.</h2>
          <p>
            Entre para administrar clientes, criar experiências e conectar cada
            ambiente.
          </p>
          <form onSubmit={login}>
            <label>
              E-mail
              <input
                autoComplete="username"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@empresa.com.br"
              />
            </label>
            <label>
              Senha
              <span className="password-input">
                <input
                  autoComplete="current-password"
                  type={visible ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Sua senha de acesso"
                />
                <button
                  type="button"
                  className="icon-button"
                  disabled={!hydrated}
                  aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>
            <button
              type="button"
              className="text-button forgot"
              disabled={busy || !hydrated}
              onClick={async () => {
                if (!email) {
                  setMessage("Informe seu e-mail para recuperar o acesso.");
                  return;
                }
                setBusy(true);
                try {
                  const { error } = await supabase.auth.resetPasswordForEmail(
                    email,
                    { redirectTo: window.location.origin + "/definir-senha" },
                  );
                  if (error) throw error;
                  setMessage(
                    "Se o e-mail estiver autorizado, você receberá as instruções de recuperação.",
                  );
                } catch (e) {
                  setMessage(errorText(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Esqueci minha senha
            </button>
            {message && (
              <p role="status" className="notice">
                {message}
              </p>
            )}
            <button className="primary wide" disabled={busy || !hydrated}>
              {busy ? "Validando acesso…" : "Entrar no painel"}
              <ArrowRight size={18} />
            </button>
          </form>
          <Link className="first-access-link" to="/definir-senha">
            Primeiro acesso? Ativar meu convite
          </Link>
          <div className="login-security">
            <LockKeyhole size={16} />
            <p>
              Ambiente protegido. Somente contas convidadas e autorizadas podem
              acessar.
            </p>
          </div>
        </div>
        <footer>
          © {new Date().getFullYear()} voee360tour{" "}
          <span>Todos os ângulos. Uma plataforma.</span>
        </footer>
      </section>
    </main>
  );
}
