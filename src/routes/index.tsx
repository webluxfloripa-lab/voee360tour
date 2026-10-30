import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowRight, Scan, ShieldCheck } from "lucide-react";
import { Brand } from "../components/Brand";
import { configured, supabase } from "../lib/supabase";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  useEffect(() => {
    if (!configured) return;
    let mounted = true;
    void supabase.auth.getUser()
      .then(async ({ data, error }) => {
        if (!mounted || error || !data.user) return;
        const result = await supabase.rpc("is_super_admin");
        if (mounted && !result.error && result.data === true)
          await navigate({ to: "/admin/projetos" });
      })
      .catch(() => {
        // Public landing remains accessible if the provider is offline.
      });
    return () => { mounted = false; };
  }, [navigate]);

  return (
    <main className="center-screen">
      <section className="password-card">
        <Brand />
        <p className="eyebrow">PLATAFORMA DE PASSEIOS VIRTUAIS</p>
        <h1>Gerencie seus passeios 360°.</h1>
        <p>Abra seu painel para editar ambientes, posicionar setas e publicar experiências. Não é necessário digitar senha.</p>
        <Link to="/login" className="primary wide" style={{ display: "flex", justifyContent: "center", gap: 12, alignItems: "center", textDecoration: "none" }}>
          <Scan size={19} /> Acessar painel <ArrowRight size={19} />
        </Link>
        <div className="login-security">
          <ShieldCheck size={16} />
          <p>A edição continua reservada à conta autorizada. Passeios publicados podem ser visualizados pelo link público de cada projeto.</p>
        </div>
      </section>
    </main>
  );
}
