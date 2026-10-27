import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowLeftRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ImageIcon,
  Search,
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    setCollapsed(false);
    if (flow.step !== "return") panel.current?.focus({ preventScroll: true });
  }, [flow.step]);
  const source = snapshot.scenes.find((s) => s.id === flow.sourceId);
  const target = snapshot.scenes.find((s) => s.id === flow.targetId);
  const existing = source?.links.some((a) => a.to === flow.targetId);
  const destinations = snapshot.scenes.filter((s) => s.id !== flow.sourceId);
  const filtered = destinations.filter((s) =>
    `${s.name} ${s.group}`
      .toLocaleLowerCase("pt-BR")
      .includes(query.trim().toLocaleLowerCase("pt-BR")),
  );
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
      className={
        "connection-panel step-" + flow.step + (collapsed ? " collapsed" : "")
      }
      aria-labelledby="connection-panel-title"
      aria-busy={busy}
    >
      <div className="connection-panel-heading">
        <span className="connection-step">
          {flow.step === "destination"
            ? "1 · ESCOLHA O DESTINO"
            : flow.step === "done"
              ? "3 · SALVE O RASCUNHO"
              : "2 · POSICIONE A VOLTA"}
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
        <span title={source?.name}>{source?.name}</span>
        <ArrowLeftRight size={16} aria-hidden="true" />
        <span title={target?.name}>
          {target?.name || "Escolha o próximo ambiente"}
        </span>
      </p>
      {!collapsed && (
        <>
          <div className="connection-panel-body">
            {flow.step === "destination" ? (
              <>
                <div className="destination-picker-heading">
                  <label
                    className="destination-label"
                    htmlFor="connection-target"
                  >
                    Próximo ambiente
                  </label>
                  <select
                    id="connection-target"
                    value={flow.targetId}
                    onChange={(e) => onTarget(e.target.value)}
                  >
                    <option value="">Selecione o destino</option>
                    {destinations.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Buscar ambiente"
                    aria-expanded={searchOpen}
                    onClick={() => {
                      setSearchOpen(!searchOpen);
                      setQuery("");
                    }}
                  >
                    <Search size={17} />
                  </button>
                </div>
                {searchOpen && (
                  <input
                    type="search"
                    aria-label="Buscar ambiente por nome"
                    placeholder="Nome ou grupo do ambiente"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                )}

                <div
                  className="destination-cards"
                  role="group"
                  aria-label="Miniaturas dos ambientes de destino"
                >
                  {filtered.map((s) => (
                    <button
                      type="button"
                      key={s.id}
                      className={
                        s.id === flow.targetId
                          ? "destination-card active"
                          : "destination-card"
                      }
                      aria-label={"Conectar com " + s.name}
                      aria-pressed={s.id === flow.targetId}
                      title={s.name + (s.group ? " · " + s.group : "")}
                      onClick={() => onTarget(s.id)}
                    >
                      {urls[s.thumbnailAssetId ?? ""] ? (
                        <img
                          src={urls[s.thumbnailAssetId ?? ""]}
                          alt={"Prévia de " + s.name}
                          loading="lazy"
                        />
                      ) : (
                        <span className="destination-no-image">
                          <ImageIcon size={20} />
                          Sem foto
                        </span>
                      )}
                      <strong>{s.name}</strong>
                      {s.id === flow.targetId && (
                        <span className="destination-check">
                          <Check size={13} />
                        </span>
                      )}
                    </button>
                  ))}
                  {!filtered.length && (
                    <p role="status">Nenhum ambiente encontrado.</p>
                  )}
                </div>
                {target && (
                  <p className="destination-selected" role="status">
                    Destino: <strong>{target.name}</strong>
                    {!target.panoramaAssetId && (
                      <small>
                        Envie a foto deste ambiente para posicionar a volta.
                      </small>
                    )}
                  </p>
                )}
                {existing && (
                  <p className="connection-note">
                    Esta ida já existe. Vamos abri-la sem criar outra seta nem
                    alterar sua posição.
                  </p>
                )}
              </>
            ) : flow.step === "return" ? (
              <>
                <p role="status">
                  Agora posicione a seta que retorna para{" "}
                  <strong>{source?.name}</strong>.
                </p>
                <p>Arraste a foto para girar. Toque na passagem da volta.</p>
                {!placing && (
                  <button className="primary wide" onClick={onPosition}>
                    Posicionar volta no panorama
                  </button>
                )}
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
                <p>
                  Para ajustar, segure a seta e arraste. Cada direção tem sua
                  própria posição.
                </p>
              </>
            ) : (
              <p>
                Ida e volta vinculadas. Salve o rascunho para preservar as duas
                posições.
              </p>
            )}
          </div>
          <div className="connection-buttons">
            {flow.step === "destination" ? (
              <>
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
              </>
            ) : flow.step === "return" ? (
              <button onClick={onCancel}>Deixar retorno para depois</button>
            ) : flow.step === "review" ? (
              <>
                <button className="primary" onClick={onFinish}>
                  Concluir conexão
                </button>
                <button onClick={onPosition}>Corrigir posição da volta</button>
                <button onClick={onCancel}>Deixar retorno para depois</button>
              </>
            ) : (
              <>
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
                  <ArrowLeft size={16} />
                  Voltar ao ambiente anterior
                </button>
                <button onClick={onTest}>Testar navegação</button>
              </>
            )}
          </div>
          {flow.step === "destination" && (
            <small className="connection-footnote">
              A volta é posicionada por você. Confirmar só o destino deixa o
              retorno pendente.
            </small>
          )}
        </>
      )}
    </section>
  );
}
