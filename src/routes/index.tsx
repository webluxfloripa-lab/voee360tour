import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Scan, ShieldCheck, Mail, LockKeyhole } from "lucide-react";
import { Brand } from "../components/Brand";
import { configured, supabase } from "../lib/supabase";
import { errorText } from "../lib/model";
import { ACCESS_RETRY_KEY, remainingSeconds, retrySecondsFromError } from "../lib/admin-access";

const ADMIN_EMAIL = "wowdanielnadal@gmail.com";
type Step = "closed" | "verify" | "email-sent";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<Step>("closed");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(0);
  const secondsLeft = remainingSeconds(retryAt, now);

  useEffect(() => {
    try {
      const stored = Number(window.localStorage.getItem(ACCESS_RETRY_KEY) || "0");
      if (Number.isFinite(stored) && stored > 0) setRetryAt(stored);
    } catch { /* Storage may be unavailable in private windows. */ }
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!configured) return;
    let mounted = true;
    void supabase.auth.getUser().then(async ({ data, error }) => {
      if (!mounted || error || !data.user) return;
      const result = await supabase.rpc("is_super_admin");
      if (mounted && !result.error && result.data === true)
        await navigate({ to: "/admin/projetos" });
    }).catch(() => { /* Public entry remains available while Auth is offline. */ });
    return () => { mounted = false; };
  }, [navigate]);

  function recordCooldown(seconds: number) {
    const until = Date.now() + seconds * 1000;
    setRetryAt(until);
    setNow(Date.now());
    try { window.localStorage.setItem(ACCESS_RETRY_KEY, String(until)); } catch { /* Optional. */ }
  }

  async function verifyAdmin() {
    const { data, error } = await supabase.rpc("is_super_admin");
    if (error) throw error;
    if (data !== true) {
      await supabase.auth.signOut({ scope: "local" });
      throw new Error("Esta conta não possui permissão de administradora.");
    }
    await navigate({ to: "/admin/projetos" });
  }

  async function openAdmin() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      if (!configured) throw new Error("A conexão do Supabase não está configurada.");
      const { data, error } = await supabase.auth.getUser();
      if (!error && data.user) {
        await verifyAdmin();
        return;
      }
      // Do not automatically email on every click: the Supabase has an OTP rate limit.
      setStep("verify");
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  async function sendLink() {
    if (busy || remainingSeconds(retryAt, Date.now()) > 0) return;
    setBusy(true);
    setMessage("");
    try {
      if (!configured) throw new Error("A conexão do Supabase não está configurada.");
      const { error } = await supabase.auth.signInWithOtp({
        email: ADMIN_EMAIL,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: window.location.origin + "/admin/projetos",
        },
      });
      if (error) throw error;
      recordCooldown(60);
      setStep("email-sent");
      setMessage("Link solicitado. Verifique a caixa de entrada e o spam da conta administradora. Abra o link no mesmo navegador em que fez o pedido.");
    } catch (error) {
      const seconds = retrySecondsFromError(error);
      if (seconds > 0) {
        recordCooldown(seconds);
        setMessage("O Supabase está limitando novos e-mails temporariamente. Use o último link recebido ou entre com sua senha abaixo.");
      } else {
        setMessage(errorText(error));
      }
    } finally {
      setBusy(false);
    }
  }

  async function signInWithPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !password) return;
    setBusy(true);
    setMessage("");
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: ADMIN_EMAIL,
        password,
      });
      if (error) throw error;
      setPassword("");
      await verifyAdmin();
    } catch (error) {
      const plain = errorText(error);
      setMessage(plain === "Invalid login credentials" ? "Senha incorreta. Confira sua senha ou solicite um link por e-mail." : plain);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="center-screen">
      <section className="password-card">
        <Brand />
        <p className="eyebrow">PLATAFORMA DE PASSEIOS VIRTUAIS</p>
        <h1>Gerencie seus passeios 360°.</h1>
        <p>Acesse o editor para organizar ambientes, conectar setas e publicar seus tours.</p>
        <button
          type="button"
          className="primary wide"
          onClick={() => { void openAdmin(); }}
          disabled={busy}
          style={{ display: "flex", justifyContent: "center", gap: 12, alignItems: "center" }}
        >
          <Scan size={19} /> {busy ? "Verificando acesso…" : "Acessar Tour 360"} <ArrowRight size={19} />
        </button>
        {step !== "closed" && (
          <div className="admin-access-options" role="region" aria-label="Verificação administrativa">
            <p>Este navegador ainda não tem uma sessão administrativa. Confirme sua identidade uma vez para editar seus passeios.</p>
            <button type="button" className="secondary wide" onClick={() => { void sendLink(); }} disabled={busy || secondsLeft > 0}>
              <Mail size={17} /> {secondsLeft > 0 ? `Novo link em ${secondsLeft}s` : "Receber link de acesso por e-mail"}
            </button>
            {step === "email-sent" && <p>Já enviou a solicitação? Use o último e-mail recebido, sem pedir outro link.</p>}
            <details>
              <summary>Entrar com a senha já cadastrada (sem aguardar e-mail)</summary>
              <form onSubmit={(event) => { void signInWithPassword(event); }}>
                <label htmlFor="admin-password">Senha administrativa</label>
                <input
                  id="admin-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button className="primary wide" type="submit" disabled={busy || !password}>
                  <LockKeyhole size={17} /> Entrar no editor
                </button>
              </form>
            </details>
          </div>
        )}
        {message && <p role="status" className="notice">{message}</p>}
        <div className="login-security">
          <ShieldCheck size={16} />
          <p>A edição exige uma conta com permissão super_admin. Uma sessão ativa abre o editor diretamente; visitantes não podem alterar nem excluir os tours.</p>
        </div>
      </section>
    </main>
  );
}