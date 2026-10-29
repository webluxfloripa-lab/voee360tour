import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthGate } from "../components/AuthGate";
import { TourEditor } from "../components/TourEditor";
import { getEditor } from "../lib/api";
import { errorText } from "../lib/model";
export const Route = createFileRoute("/admin/projetos/$id/editor")({
  component: EditorRoute,
});
function EditorPage({ id }: { id: string }) {
  const [state, setState] = useState<Awaited<
      ReturnType<typeof getEditor>
    > | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    getEditor(id)
      .then((s) => {
        if (alive) setState(s);
      })
      .catch((e) => {
        if (alive) setError(errorText(e));
      });
    return () => {
      alive = false;
    };
  }, [id]);
  if (error)
    return (
      <main className="center-screen">
        <h1>Não foi possível abrir o projeto.</h1>
        <p role="alert">{error}</p>
        <a href="/admin/projetos">Voltar aos projetos</a>
      </main>
    );
  if (!state)
    return (
      <main className="center-screen">
        <span className="spinner" />
        <p>Carregando editor…</p>
      </main>
    );
  if (state.project.deletion_pending)
    return (
      <main className="center-screen">
        <h1>Exclusão em andamento.</h1>
        <p>Volte aos projetos e escolha Concluir exclusão para remover os arquivos e registros restantes.</p>
        <a href="/admin/projetos">Voltar aos projetos</a>
      </main>
    );
  return <TourEditor key={id} initial={state} />;
}

function EditorRoute() {
  const { id } = Route.useParams();
  return (
    <AuthGate>
      <EditorPage id={id} />
    </AuthGate>
  );
}
