import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Scan, ShieldCheck } from "lucide-react";
import { Brand } from "../components/Brand";
import { configured, supabase } from "../lib/supabase";
import { errorText } from "../lib/model";

const ADMIN_EMAIL = "wowdanielnadal@gmail.com";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!configured) return;
    let mounted = true;
    void supabase.auth.getUser().then(async ({ data, error }) => {
      if (!mounted || error || !data.user) return;
      const result = await supabase.rpc("is_super_admin");
      if (mounted && !result.error && result.data === true)
        await navigate({ to: "/admin/projetos" });
    }).catch(() => {
      // O acesso continua disponível se o provedor estiver temporariamente offline.
    });
    return () => { mounted = false; };
  }, [navigate]);

  async function openAdmin() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      if (!configured)
        throw new Error("A conexão com o Supabase não está configurada.");
      const { data, error } = await supabase.auth.getUser();
      if (!error && data.user) {
        const result = await supabase.rpc("is_super_admin");
        if (result.error) throw result.error;
        if (result.data !== true)
          throw new Error("Esta conta não tem permissão para editar passeios.");
        await navigate({ to: "/admin/projetos" });
        return;
      }
      const { error: linkError } = await supabase.auth.signInWithOtp({
        email: ADMIN_EMAIL,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: window.location.origin + "/admin/projetos",
        },
      });
      if (linkError) throw linkError;
      setMessage("Link de acesso enviado ao e-mail administrador. Abra-o neste mesmo navegador para entrar no editor. Nenhuma senha é necessária.");
    } catch (e) {
      setMessage(errorText(e));
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
        {message && <p role="status" className="notice">{message}</p>}
        <div className="login-security">
          <ShieldCheck size={16} />
          <p>Com uma sessão administrativa ativa, o editor abre diretamente. Sem sessão, o acesso é confirmado por um link enviado à conta autorizada.</p>
        </div>
      </section>
    </main>
  );
}
