import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Brand } from "../components/Brand";
import { supabase } from "../lib/supabase";
import { errorText } from "../lib/model";
export const Route = createFileRoute("/definir-senha")({
  head: () => ({
    meta: [
      { title: "Definir senha · voee360tour" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: Password,
});
function Password() {
  const nav = useNavigate();
  const [ready, setReady] = useState(false),
    [password, setPassword] = useState(""),
    [repeat, setRepeat] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [inviteLink, setInviteLink] = useState("");
  useEffect(() => {
    const tokenHash = new URLSearchParams(location.search).get("token_hash"),
      type = new URLSearchParams(location.search).get("type");
    async function init() {
      if (tokenHash && (type === "invite" || type === "recovery")) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type,
        });
        if (error) {
          setMessage(errorText(error));
          return;
        }
        history.replaceState(null, "", "/definir-senha");
      }
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setReady(!!session);
      if (!session)
        setMessage(
          "Abra o link de convite ou recuperação enviado para seu e-mail.",
        );
    }
    void init();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, s) => setReady(!!s));
    return () => subscription.unsubscribe();
  }, []);
  return (
    <main className="center-screen">
      <section className="password-card">
        <Brand />
        <h1>Crie sua senha.</h1>
        <p>Use uma senha exclusiva, com pelo menos 12 caracteres.</p>
        {!ready && (
          <div className="invitation-help">
            <p>
              Se o convite abriu um endereço indisponível, copie o endereço do
              botão do e-mail e cole abaixo. O código será validado diretamente
              pelo Supabase.
            </p>
            <label>
              Link do convite
              <input
                type="url"
                autoComplete="off"
                value={inviteLink}
                onChange={(e) => setInviteLink(e.target.value)}
                placeholder="Cole aqui o endereço do convite"
              />
            </label>
            <button
              disabled={busy || !inviteLink}
              onClick={async () => {
                setBusy(true);
                try {
                  const url = new URL(inviteLink);
                  if (
                    url.origin !== import.meta.env.VITE_SUPABASE_URL ||
                    url.pathname !== "/auth/v1/verify"
                  )
                    throw new Error(
                      "Use o link do convite enviado pelo Supabase desta plataforma.",
                    );
                  const token = url.searchParams.get("token"),
                    type = url.searchParams.get("type");
                  if (!token || (type !== "invite" && type !== "recovery"))
                    throw new Error(
                      "Este link não é um convite ou recuperação válido.",
                    );
                  const { error } = await supabase.auth.verifyOtp({
                    token_hash: token,
                    type,
                  });
                  if (error) throw error;
                  setInviteLink("");
                  setReady(true);
                  setMessage("Convite validado. Defina uma senha exclusiva.");
                } catch (e) {
                  setMessage(errorText(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Validar convite
            </button>
          </div>
        )}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (password !== repeat) {
              setMessage("As senhas devem ser iguais.");
              return;
            }
            setBusy(true);
            try {
              const { error } = await supabase.auth.updateUser({ password });
              if (error) throw error;
              setPassword("");
              setRepeat("");
              await nav({ to: "/admin" });
            } catch (e) {
              setMessage(errorText(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Nova senha
            <input
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label>
            Confirme a senha
            <input
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
            />
          </label>
          <button className="primary" disabled={!ready || busy}>
            Salvar e entrar
          </button>
          {message && (
            <p role="status" className="notice">
              {message}
            </p>
          )}
        </form>
      </section>
    </main>
  );
}
