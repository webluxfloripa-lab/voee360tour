import { ArrowLeftRight } from "lucide-react";
import { connections, type Connection } from "../lib/connections";
import type { Snapshot } from "../lib/model";

export function ConnectionsList({
  snapshot,
  onEdit,
  onReturn,
  onTest,
  onRemove,
  onScene,
}: {
  snapshot: Snapshot;
  onEdit: (sceneId: string, arrowId: string) => void;
  onReturn: (sourceId: string, arrowId: string) => void;
  onTest: (sourceId: string, targetId: string) => void;
  onRemove: (connection: Connection) => void;
  onScene: (sceneId: string) => void;
}) {
  const rows = connections(snapshot);
  const isolated = snapshot.scenes.filter(
    (s) =>
      !s.links.length &&
      !snapshot.scenes.some((other) => other.links.some((a) => a.to === s.id)),
  );
  const labels = {
    complete: "Ida e volta concluídas",
    pending: "Retorno pendente",
    hidden: "Há uma seta oculta",
    invalid: "Destino inválido",
  };
  return (
    <details className="connections-section">
      <summary>
        <ArrowLeftRight size={17} /> Conexões entre ambientes{" "}
        <span>{rows.length}</span>
      </summary>
      <div className="connections-list">
        {rows.map((c) => {
          const source = snapshot.scenes.find((s) => s.id === c.sourceId)!;
          const target = snapshot.scenes.find((s) => s.id === c.targetId);
          return (
            <article
              key={c.arrow.id}
              data-connection-id={c.arrow.pairId || c.arrow.id}
            >
              <button
                className="connection-row-title"
                onClick={() => onEdit(c.sourceId, c.arrow.id)}
              >
                {source.name} {c.back ? "⇄" : "→"}{" "}
                {target?.name || "Destino inválido"}
              </button>
              <small
                className={
                  c.status === "complete"
                    ? "connection-complete"
                    : "connection-pending"
                }
              >
                {labels[c.status]}
              </small>
              <div className="connection-row-actions">
                <button onClick={() => onEdit(c.sourceId, c.arrow.id)}>
                  Editar ida
                </button>
                {c.back ? (
                  <button onClick={() => onEdit(c.targetId, c.back!.id)}>
                    Editar volta
                  </button>
                ) : (
                  <button
                    disabled={
                      !target ||
                      target.id === source.id ||
                      !target.panoramaAssetId
                    }
                    onClick={() => onReturn(c.sourceId, c.arrow.id)}
                  >
                    Posicionar retorno
                  </button>
                )}
                {c.back && c.status === "pending" && (
                  <button onClick={() => onReturn(c.sourceId, c.arrow.id)}>
                    Posicionar retorno
                  </button>
                )}
                <button
                  disabled={
                    !source.panoramaAssetId ||
                    !target?.panoramaAssetId ||
                    target.id === source.id
                  }
                  onClick={() => onTest(c.sourceId, c.targetId)}
                >
                  Testar navegação
                </button>
                <button className="danger-text" onClick={() => onRemove(c)}>
                  Remover conexão
                </button>
              </div>
            </article>
          );
        })}
        {isolated.map((s) => (
          <article key={s.id}>
            <button
              className="connection-row-title"
              onClick={() => onScene(s.id)}
            >
              {s.name}
            </button>
            <small>Ambiente sem conexões</small>
          </article>
        ))}
        {!snapshot.scenes.length && (
          <p>Adicione ambientes para construir seu trajeto.</p>
        )}
      </div>
    </details>
  );
}
