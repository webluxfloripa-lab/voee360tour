import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { supabase, configured } from "../lib/supabase";
import { errorText } from "../lib/model";
export function AuthGate({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [state, setState] = useState<"loading" | "ready" | "denied">("loading"),
    [message, setMessage] = useState("");
  useEffect(() => {
    let alive = true;
    async function check() {
      if (!configured) {
        setState("denied");
        setMessage("A conexão da plataforma ainda precisa ser configurada.");
        return;
      }
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();
        if (error || !user) {
          if (alive) void navigate({ to: "/" });
          return;
        }
        const { data: admin, error: err } =
          await supabase.rpc("is_super_admin");
        if (err) throw err;
        if (alive) setState(admin ? "ready" : "denied");
      } catch (e) {
        if (alive) {
          setMessage(errorText(e));
          setState("denied");
        }
      }
    }
    void check();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") void navigate({ to: "/" });
    });
    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, [navigate]);
  if (state === "loading")
    return (
      <main className="center-screen">
        <span className="spinner" />
        <p>Validando acesso…</p>
      </main>
    );
  if (state === "denied")
    return (
      <main className="center-screen">
        <div className="empty">
          <h1>Acesso restrito</h1>
          <p>{message || "Este painel é exclusivo da superadministradora."}</p>
          <Link to="/">Voltar ao acesso</Link>
        </div>
      </main>
    );
  return children;
}
