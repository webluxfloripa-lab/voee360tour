import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowLeftRight,
  CheckCircle2,
  ChevronDown,
  X,
} from "lucide-react";
import type { Snapshot } from "../lib/model";
import type { ConnectionFlow } from "../lib/connections";

export function ConnectionPanel({
  flow,
  snapshot,
  urls,
  busy,
  placing,
  onTarget,
  onConfirm,
  onCancel,
  onPosition,
  onFinish,
  onContinue,
  onPrevious,
  onSave,
  onTest,
}: {
  flow: ConnectionFlow;
  snapshot: Snapshot;
  urls: Record<string, string>;
  busy: boolean;
  placing: boolean;
  onTarget: (id: string) => void;
  onConfirm: (withReturn: boolean) => void;
  onCancel: () => void;
  onPosition: () => void;
  onFinish: () => void;
  onContinue: (connect: boolean) => void;
  onPrevious: () => void;
  onSave: () => void;
  onTest: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    setCollapsed(false);
    if (flow.step !== "return") panel.current?.focus({ preventScroll: true });
  }, [flow.step]);
  const source = snapshot.scenes.find((s) => s.id === flow.sourceId);
  const target = snapshot.scenes.find((s) => s.id === flow.targetId);
  const thumb = target && urls[target.thumbnailAssetId ?? ""];
  const existing = source?.links.some((a) => a.to === flow.targetId);
  const title =
    flow.step === "destination"
      ? "Conectar ambiente"
      : flow.step === "done"
        ? "Conexão concluída!"
        : flow.step === "review"
          ? "Confira a ida e a volta"
          : "Posicione a volta";
  return (
    <section
      ref={panel}
      tabIndex={-1}
      className={"connection-panel" + (collapsed ? " collapsed" : "")}
      aria-labelledby="connection-panel-title"
      aria-busy={busy}
    >
      <div className="connection-panel-heading">
        <span className="connection-step">
          {flow.step === "destination"
            ? "01 / DESTINO"
            : flow.step === "done"
              ? "PRONTO PARA SALVAR"
              : "02 / RETORNO"}
        </span>
        <button
          type="button"
          className="icon-button"
          aria-label={collapsed ? "Expandir conexão" : "Minimizar conexão"}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed(!collapsed)}
        >
          <ChevronDown size={18} />
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label="Fechar conexão"
          disabled={busy}
          onClick={onCancel}
        >
          <X size={18} />
        </button>
      </div>
      <h2 id="connection-panel-title">{title}</h2>
      <p className="connection-path">
        {source?.name} <ArrowLeftRight size={16} aria-hidden="true" />{" "}
        {target?.name || "Escolha o próximo ambiente"}
      </p>
      {!collapsed && (
        <div className="connection-panel-body">
          {flow.step === "destination" ? (
            <>
              <p>
                Ambiente atual: <strong>{source?.name}</strong>
              </p>
              <label>
                Próximo ambiente
                <select
                  value={flow.targetId}
                  onChange={(e) => onTarget(e.target.value)}
                >
                  <option value="">Selecione o destino</option>
                  {snapshot.scenes
                    .filter((s) => s.id !== flow.sourceId)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </label>
              {target && (
                <figure className="connection-destination">
                  {thumb ? (
                    <img src={thumb} alt={"Prévia de " + target.name} />
                  ) : (
                    <span>Sem miniatura</span>
                  )}
                  <figcaption>
                    <strong>{target.name}</strong>
                    <small>
                      Ambiente {snapshot.scenes.indexOf(target) + 1} ·{" "}
                      {target.group || "Neste projeto"}
                    </small>
                  </figcaption>
                </figure>
              )}
              {existing && (
                <p className="connection-note">
                  Esta ida já existe. Vamos abri-la sem criar outra seta nem
                  alterar sua posição.
                </p>
              )}
              <div className="connection-buttons">
                <button
                  className="primary"
                  disabled={!target || !target.panoramaAssetId || busy}
                  onClick={() => onConfirm(true)}
                >
                  Continuar e posicionar volta
                </button>
                <button
                  disabled={!target || busy}
                  onClick={() => onConfirm(false)}
                >
                  Confirmar destino
                </button>
                <button onClick={onCancel}>Cancelar</button>
              </div>
              <small>
                A volta só será criada no ponto que você escolher. Confirmar
                apenas o destino deixa o retorno pendente.
              </small>
            </>
          ) : flow.step === "return" ? (
            <>
              <p role="status">
                Agora posicione a seta que retorna para{" "}
                <strong>{source?.name}</strong>.
              </p>
              <p>
                Arraste para girar a câmera. Depois dê um toque curto na porta
                ou passagem da volta.
              </p>
              {!placing && (
                <button className="primary wide" onClick={onPosition}>
                  Posicionar volta no panorama
                </button>
              )}
              <button className="wide" onClick={onCancel}>
                Deixar retorno para depois
              </button>
            </>
          ) : flow.step === "review" ? (
            <>
              <div className="connection-directions">
                <p>
                  <CheckCircle2 size={16} /> {source?.name} → {target?.name}
                  <small>Ida preservada</small>
                </p>
                <p>
                  <CheckCircle2 size={16} /> {target?.name} → {source?.name}
                  <small>Volta posicionada por você</small>
                </p>
              </div>
              <div className="connection-buttons">
                <button className="primary" onClick={onFinish}>
                  Concluir conexão
                </button>
                <button onClick={onPosition}>Corrigir posição da volta</button>
                <button onClick={onCancel}>Deixar retorno para depois</button>
              </div>
              <small>
                Concluir registra as duas direções no editor. Salve o rascunho
                para persistir no servidor.
              </small>
            </>
          ) : (
            <>
              <p>
                Ida e volta vinculadas, com posições independentes. As
                alterações aguardam o salvamento do rascunho.
              </p>
              <div className="connection-buttons">
                <button className="primary" disabled={busy} onClick={onSave}>
                  Salvar rascunho
                </button>
                <button onClick={() => onContinue(true)}>
                  Conectar outro ambiente
                </button>
                <button onClick={() => onContinue(false)}>
                  Continuar editando este ambiente
                </button>
                <button onClick={onPrevious}>
                  <ArrowLeft size={16} /> Voltar ao ambiente anterior
                </button>
                <button onClick={onTest}>Testar navegação</button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
