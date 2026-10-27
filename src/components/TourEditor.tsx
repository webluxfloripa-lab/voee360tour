import { useDialogFocus } from "../lib/useDialogFocus";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { ClientOnly, Link } from "@tanstack/react-router";
import {
  Plus,
  Save,
  Upload,
  Download,
  Undo2,
  Redo2,
  Eye,
  Send,
  Trash2,
  ArrowLeftRight,
  X,
  ArrowLeft,
  MousePointer2,
  Move,
  ImagePlus,
  ChevronUp,
  ChevronDown,
  Star,
  History,
  ShieldCheck,
  Share2,
  Settings2,
  CheckCircle2,
  AlertTriangle,
  Copy,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import {
  getEditor,
  saveDraft,
  rpc,
  signedAssets,
  downloadJson,
  backupProject,
} from "../lib/api";
import {
  errorText,
  snapshotSchema,
  newArrow,
  removeScene,
  auditTour,
  snapshotDiff,
  type Arrow,
  type Scene,
  type Snapshot,
} from "../lib/model";
import { uploadPanorama, uploadBrandImage } from "../lib/media";
import { useHistory } from "../lib/useHistory";
const Panorama = lazy(() => import("./AdminPanorama"));
const Viewer = lazy(() => import("./TourViewer"));
type State = Awaited<ReturnType<typeof getEditor>>;
export function TourEditor({ initial }: { initial: State }) {
  const h = useHistory(initial.draft.snapshot),
    config = h.value;
  const [saved, setSaved] = useState(initial.draft.snapshot),
    [revision, setRevision] = useState(initial.draft.revision),
    [project, setProject] = useState(initial.project),
    [assets, setAssets] = useState(initial.assets),
    [versions, setVersions] = useState(initial.versions),
    [urls, setUrls] = useState<Record<string, string>>({}),
    [sceneId, setSceneId] = useState(
      config.firstSceneId || config.scenes[0]?.id || "",
    ),
    [selected, setSelected] = useState(""),
    [mode, setMode] = useState<"pan" | "place" | "drag" | "preview">("pan"),
    [dest, setDest] = useState(""),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [tab, setTab] = useState<"arrow" | "scene" | "settings">("arrow"),
    [dialog, setDialog] = useState<"history" | "audit" | "share" | null>(null),
    [viewSnapshot, setViewSnapshot] = useState<Snapshot | null>(null),
    [returnPlan, setReturnPlan] = useState<{
      source: string;
      arrowId: string;
      pairId: string;
    } | null>(null);
  const upload = useRef<HTMLInputElement>(null),
    replace = useRef<HTMLInputElement>(null),
    importFile = useRef<HTMLInputElement>(null),
    brandFile = useRef<HTMLInputElement>(null),
    brandKind = useRef<"logo" | "social">("social"),
    camera = useRef({ pitch: 0, yaw: 0, hfov: 105 });
  useDialogFocus(!!dialog || !!viewSnapshot, () => {
    if (viewSnapshot) setViewSnapshot(null);
    else setDialog(null);
  });
  const row = config.scenes.find((s) => s.id === sceneId),
    arrow = row?.links.find((a) => a.id === selected),
    dirty = JSON.stringify(config) !== JSON.stringify(saved),
    audit = auditTour(config);
  useEffect(() => {
    let alive = true;
    async function refresh() {
      try {
        const u = await signedAssets(assets);
        if (alive) setUrls(u);
      } catch (e) {
        if (alive) setStatus(errorText(e));
      }
    }
    void refresh();
    const interval = window.setInterval(() => void refresh(), 45 * 60 * 1000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [assets]);
  useEffect(() => {
    function warn(e: BeforeUnloadEvent) {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function commit(next: Snapshot) {
    h.commit(next);
    setStatus("Alterações ainda não salvas.");
  }
  function changeArrow(changes: Partial<Arrow>) {
    const brokenPair =
      changes.to && changes.to !== arrow?.to ? arrow?.pairId : null;
    commit({
      ...config,
      scenes: config.scenes.map((s) => ({
        ...s,
        links: s.links.map((a) =>
          a.id === selected
            ? { ...a, ...changes }
            : brokenPair && a.pairId === brokenPair
              ? { ...a, pairId: null }
              : a,
        ),
      })),
    });
  }
  function changeScene(changes: Partial<Scene>) {
    commit({
      ...config,
      scenes: config.scenes.map((s) =>
        s.id === sceneId ? { ...s, ...changes } : s,
      ),
    });
  }
  function selectScene(id: string) {
    setSceneId(id);
    setSelected("");
    setMode("pan");
    setReturnPlan(null);
  }
  async function execute(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setStatus("Processando…");
    try {
      await work();
    } catch (e) {
      setStatus(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function persist() {
    const rev = await saveDraft(project.id, config, revision);
    setRevision(rev);
    setSaved(config);
    return rev;
  }
  async function reload() {
    const state = await getEditor(project.id);
    setProject(state.project);
    setAssets(state.assets);
    setVersions(state.versions);
    return state;
  }
  function place(pitch: number, yaw: number) {
    if (returnPlan) {
      const original = config.scenes
        .find((s) => s.id === returnPlan.source)
        ?.links.find((a) => a.id === returnPlan.arrowId);
      if (!original) return;
      const existing = row?.links.find(
        (a) => a.pairId === returnPlan.pairId && a.to === returnPlan.source,
      );
      const back = {
        ...(existing || newArrow(returnPlan.source, yaw, pitch)),
        yaw,
        pitch,
        pairId: returnPlan.pairId,
      };
      commit({
        ...config,
        scenes: config.scenes.map((s) =>
          s.id === sceneId
            ? {
                ...s,
                links: existing
                  ? s.links.map((a) => (a.id === existing.id ? back : a))
                  : [...s.links, back],
              }
            : s.id === returnPlan.source
              ? {
                  ...s,
                  links: s.links.map((a) =>
                    a.id === returnPlan.arrowId
                      ? { ...a, pairId: returnPlan.pairId }
                      : a,
                  ),
                }
              : s,
        ),
      });
      setSelected(back.id);
      setReturnPlan(null);
      setMode("drag");
      return;
    }
    if (!dest) {
      setStatus("Escolha o destino antes de tocar no panorama.");
      return;
    }
    const a = newArrow(dest, yaw, pitch);
    commit({
      ...config,
      scenes: config.scenes.map((s) =>
        s.id === sceneId ? { ...s, links: [...s.links, a] } : s,
      ),
    });
    setSelected(a.id);
    setMode("drag");
    setTab("arrow");
  }
  function removeArrow(kind: "one" | "pair" | "return") {
    if (!arrow) return;
    const pair = arrow.pairId;
    const paired = config.scenes
      .flatMap((s) => s.links)
      .filter((a) => pair && a.pairId === pair && a.id !== arrow.id);
    if (kind === "return" && !paired.length) {
      setStatus("Esta seta não tem retorno pareado.");
      return;
    }
    if (
      !confirm(
        kind === "pair"
          ? "Remover a ida e a volta desta conexão?"
          : kind === "return"
            ? "Remover somente a seta de retorno?"
            : "Remover esta seta?",
      )
    )
      return;
    commit({
      ...config,
      scenes: config.scenes.map((s) => ({
        ...s,
        links: s.links
          .filter((a) =>
            kind === "one"
              ? a.id !== arrow.id
              : kind === "return"
                ? !paired.some((p) => p.id === a.id)
                : a.id !== arrow.id && !paired.some((p) => p.id === a.id),
          )
          .map((a) => (pair && a.pairId === pair ? { ...a, pairId: null } : a)),
      })),
    });
    setSelected("");
  }
  async function addFiles(files: FileList | null, replacing = false) {
    if (!files?.length) return;
    const list = [...files];
    let next = config;
    const added = [...assets];
    await execute(async () => {
      try {
        for (let i = 0; i < list.length; i++) {
          const file = list[i]!;
          setStatus(`Enviando ${i + 1}/${list.length}: ${file.name}`);
          setProgress(0);
          const { panorama, thumbnail } = await uploadPanorama(
            project.id,
            file,
            setProgress,
          );
          added.push(panorama, thumbnail);
          if (replacing && row) {
            next = {
              ...next,
              scenes: next.scenes.map((s) =>
                s.id === row.id
                  ? {
                      ...s,
                      panoramaAssetId: panorama.id,
                      thumbnailAssetId: thumbnail.id,
                    }
                  : s,
              ),
            };
          } else {
            const scene: Scene = {
              id: crypto.randomUUID(),
              name: file.name.replace(/\.[^.]+$/, ""),
              group: "",
              panoramaAssetId: panorama.id,
              thumbnailAssetId: thumbnail.id,
              yaw: 0,
              pitch: 0,
              hfov: 105,
              links: [],
            };
            next = {
              ...next,
              firstSceneId: next.firstSceneId || scene.id,
              scenes: [...next.scenes, scene],
            };
            if (!sceneId && i === 0) setSceneId(scene.id);
          }
        }
        setStatus(
          "Fotografias enviadas. Salve o rascunho para manter os ambientes.",
        );
      } finally {
        setAssets(added);
        if (next !== config) h.commit(next);
      }
    });
  }
  function reorder(id: string, delta: number) {
    const scenes = [...config.scenes],
      index = scenes.findIndex((s) => s.id === id),
      target = index + delta;
    if (target < 0 || target >= scenes.length) return;
    [scenes[index], scenes[target]] = [scenes[target]!, scenes[index]!];
    commit({ ...config, scenes });
  }
  const publicUrl =
    typeof window !== "undefined"
      ? window.location.origin + "/t/" + project.slug
      : "";
  return (
    <div className="editor-root">
      <header className="editor-heading">
        <div className="editor-title">
          <Link
            to="/admin/projetos"
            className="icon-button"
            aria-label="Voltar aos projetos"
            onClick={(e) => {
              if (
                dirty &&
                !confirm("Há alterações não salvas. Sair do editor?")
              )
                e.preventDefault();
            }}
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1>{config.title}</h1>
            <span className={dirty ? "dirty-state" : "saved-state"}>
              <i />
              {dirty ? "Alterações pendentes" : "Rascunho salvo"}
            </span>
          </div>
        </div>
        <div className="editor-actions">
          <button
            title="Desfazer"
            aria-label="Desfazer"
            disabled={!h.canUndo || busy}
            onClick={h.undo}
          >
            <Undo2 size={17} />
          </button>
          <button
            title="Refazer"
            aria-label="Refazer"
            disabled={!h.canRedo || busy}
            onClick={h.redo}
          >
            <Redo2 size={17} />
          </button>
          <button
            aria-label="Prévia"
            disabled={busy || !config.scenes.length || audit.errors.length > 0}
            onClick={() => setViewSnapshot(config)}
          >
            <Eye size={17} />
            <span>Prévia</span>
          </button>
          <button
            aria-label="Salvar"
            disabled={busy}
            onClick={() =>
              void execute(async () => {
                await persist();
                setStatus("Rascunho salvo no servidor.");
              })
            }
          >
            <Save size={17} />
            <span>Salvar</span>
          </button>
          <button
            aria-label="Publicar"
            className="primary"
            disabled={busy || project.status === "archived"}
            onClick={() => {
              if (audit.errors.length) {
                setDialog("audit");
                return;
              }
              if (
                confirm(
                  "Salvar e publicar este tour? O link público passará a mostrar esta versão integral.",
                )
              )
                void execute(async () => {
                  const rev = await persist();
                  await rpc("publish_tour", {
                    p_project: project.id,
                    p_expected: rev,
                    p_note: "Publicação pelo editor",
                  });
                  await reload();
                  setStatus(
                    "Tour publicado. Sua versão anterior continua preservada.",
                  );
                });
            }}
          >
            <Send size={16} />
            <span>Publicar</span>
          </button>
        </div>
      </header>
      <div className="editor-status" role="status" aria-live="polite">
        {busy && <span className="mini-spinner" />}
        {status ||
          "Arraste o panorama para explorar. Use os modos abaixo para editar."}
        {busy && progress > 0 && <progress max={100} value={progress} />}
      </div>
      <div
        className="editor-content"
        inert={busy || project.status === "archived"}
      >
        <aside className="scene-panel">
          <div className="scene-panel-heading">
            <h2>
              Ambientes <span>{config.scenes.length}</span>
            </h2>
            <button
              className="icon-button"
              aria-label="Adicionar fotografias"
              onClick={() => upload.current?.click()}
            >
              <Plus size={20} />
            </button>
          </div>
          <div className="scene-list">
            {config.scenes.map((s, i) => (
              <div
                className={
                  "scene-list-item " + (sceneId === s.id ? "active" : "")
                }
                key={s.id}
              >
                <button
                  onClick={() => selectScene(s.id)}
                  className="scene-select"
                >
                  {urls[s.thumbnailAssetId || ""] ? (
                    <img src={urls[s.thumbnailAssetId || ""]} alt="" />
                  ) : (
                    <span className="scene-no-image">
                      <ImagePlus size={18} />
                    </span>
                  )}
                  <span>
                    <small>
                      {String(i + 1).padStart(2, "0")} · {s.group || "Ambiente"}
                    </small>
                    <strong>{s.name}</strong>
                    <em>
                      {s.links.length} setas{" "}
                      {s.id === config.firstSceneId ? "· Inicial" : ""}
                    </em>
                  </span>
                </button>
                <div className="scene-order">
                  <button
                    aria-label={"Mover " + s.name + " para cima"}
                    disabled={i === 0}
                    onClick={() => reorder(s.id, -1)}
                  >
                    <ChevronUp size={13} />
                  </button>
                  <button
                    aria-label={"Mover " + s.name + " para baixo"}
                    disabled={i === config.scenes.length - 1}
                    onClick={() => reorder(s.id, 1)}
                  >
                    <ChevronDown size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button
            className="upload-drop"
            onClick={() => upload.current?.click()}
          >
            <Upload size={20} />
            <strong>Enviar panoramas</strong>
            <small>JPEG, PNG ou WebP · 2:1 · até 40 MB</small>
          </button>
          <button
            className="text-button"
            onClick={() => {
              const s: Scene = {
                id: crypto.randomUUID(),
                name: "Novo ambiente",
                group: "",
                panoramaAssetId: null,
                thumbnailAssetId: null,
                yaw: 0,
                pitch: 0,
                hfov: 105,
                links: [],
              };
              commit({
                ...config,
                firstSceneId: config.firstSceneId || s.id,
                scenes: [...config.scenes, s],
              });
              setSceneId(s.id);
              setTab("scene");
            }}
          >
            Criar ambiente sem foto
          </button>
        </aside>
        <section className="editor-workspace">
          <div className="editor-modebar">
            {(
              [
                { id: "pan", icon: MousePointer2, label: "Explorar" },
                { id: "place", icon: Plus, label: "Adicionar seta" },
                { id: "drag", icon: Move, label: "Mover seta" },
                { id: "preview", icon: Eye, label: "Navegar" },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                className={mode === m.id ? "active" : ""}
                onClick={() => {
                  setMode(m.id);
                  if (m.id !== "place") setReturnPlan(null);
                }}
              >
                <m.icon size={16} />
                {m.label}
              </button>
            ))}
          </div>
          <div className="editor-panorama-wrap">
            {row ? (
              <ClientOnly
                fallback={
                  <div className="panorama-empty">Preparando visualizador…</div>
                }
              >
                <Suspense
                  fallback={
                    <div className="panorama-empty">
                      Preparando visualizador…
                    </div>
                  }
                >
                  <Panorama
                    scene={row}
                    scenes={config.scenes}
                    image={urls[row.panoramaAssetId || ""]}
                    arrows={row.links}
                    selected={selected}
                    mode={mode}
                    onSelect={(id) => {
                      setSelected(id);
                      setTab("arrow");
                    }}
                    onPlace={place}
                    onMove={(id, pitch, yaw) =>
                      commit({
                        ...config,
                        scenes: config.scenes.map((s) =>
                          s.id === sceneId
                            ? {
                                ...s,
                                links: s.links.map((a) =>
                                  a.id === id ? { ...a, pitch, yaw } : a,
                                ),
                              }
                            : s,
                        ),
                      })
                    }
                    onNavigate={selectScene}
                    onView={(pitch, yaw, hfov) => {
                      camera.current = { pitch, yaw, hfov };
                    }}
                  />
                </Suspense>
              </ClientOnly>
            ) : (
              <div className="panorama-empty">
                <span>360°</span>
                <h2>Todo grande tour começa por um ambiente.</h2>
                <p>Envie suas fotografias para começar a explorar.</p>
                <button
                  className="primary"
                  onClick={() => upload.current?.click()}
                >
                  <Upload size={18} />
                  Adicionar panoramas
                </button>
              </div>
            )}
            {mode === "place" && (
              <div className="placement-tip">
                {returnPlan
                  ? "Na cena de destino, toque no ponto físico da volta."
                  : "Escolha o destino e toque no panorama para inserir a seta."}
              </div>
            )}
          </div>
          <div className="scene-caption">
            <span>{row?.name || "Novo tour"}</span>
            <small>
              Revisão visual das passagens é necessária antes da publicação.
            </small>
          </div>
        </section>
        <aside className="inspector">
          <div className="inspector-tabs">
            {(
              [
                { id: "arrow", label: "Setas" },
                { id: "scene", label: "Ambiente" },
                { id: "settings", label: "Tour" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={tab === t.id ? "active" : ""}
              >
                {t.label}
              </button>
            ))}
          </div>
          {tab === "arrow" ? (
            <div className="inspector-body">
              <h3>Conecte os espaços.</h3>
              <p className="muted">Cada seta leva a uma nova perspectiva.</p>
              <label>
                Destino da nova seta
                <select value={dest} onChange={(e) => setDest(e.target.value)}>
                  <option value="">Selecione um ambiente</option>
                  {config.scenes
                    .filter((s) => s.id !== sceneId)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </label>
              <button
                className="outline wide"
                disabled={!row || !dest || !row.panoramaAssetId}
                onClick={() => {
                  setReturnPlan(null);
                  setMode("place");
                }}
              >
                <Plus size={16} />
                Posicionar no panorama
              </button>
              {row && (
                <div className="arrow-list">
                  {row.links.map((a, i) => (
                    <button
                      key={a.id}
                      className={selected === a.id ? "selected" : ""}
                      onClick={() => setSelected(a.id)}
                    >
                      <span>↗ {i + 1}</span>
                      <strong>
                        {a.label ||
                          config.scenes.find((s) => s.id === a.to)?.name}
                      </strong>
                      <small>
                        {a.visible ? "Visível" : "Oculta"}
                        {a.pairId ? " · Ida/volta" : ""}
                      </small>
                    </button>
                  ))}
                </div>
              )}
              {arrow ? (
                <>
                  <div className="inspector-divider" />
                  <h4>Propriedades da seta</h4>
                  <label>
                    Destino
                    <select
                      value={arrow.to}
                      onChange={(e) =>
                        changeArrow({ to: e.target.value, pairId: null })
                      }
                    >
                      {config.scenes.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Rótulo
                    <input
                      maxLength={100}
                      value={arrow.label}
                      onChange={(e) => changeArrow({ label: e.target.value })}
                      placeholder="Ir para…"
                    />
                  </label>
                  {(
                    [
                      {
                        key: "yaw",
                        label: "Posição horizontal",
                        min: -180,
                        max: 180,
                        step: 0.1,
                      },
                      {
                        key: "pitch",
                        label: "Posição vertical",
                        min: -62,
                        max: 80,
                        step: 0.1,
                      },
                      {
                        key: "rotation",
                        label: "Direção da seta",
                        min: -180,
                        max: 180,
                        step: 1,
                      },
                      {
                        key: "size",
                        label: "Tamanho",
                        min: 24,
                        max: 120,
                        step: 1,
                      },
                      {
                        key: "opacity",
                        label: "Opacidade",
                        min: 0.1,
                        max: 1,
                        step: 0.05,
                      },
                    ] as const
                  ).map((f) => (
                    <label key={f.key} className="range-label">
                      <span>
                        {f.label}
                        <input
                          aria-label={f.label + " valor"}
                          type="number"
                          min={f.min}
                          max={f.max}
                          step={f.step}
                          value={arrow[f.key]}
                          onChange={(e) => {
                            const n = e.target.valueAsNumber;
                            if (Number.isFinite(n))
                              changeArrow({
                                [f.key]: Math.max(f.min, Math.min(f.max, n)),
                              });
                          }}
                        />
                      </span>
                      <input
                        aria-label={f.label}
                        type="range"
                        min={f.min}
                        max={f.max}
                        step={f.step}
                        value={arrow[f.key]}
                        onChange={(e) =>
                          changeArrow({ [f.key]: Number(e.target.value) })
                        }
                      />
                    </label>
                  ))}
                  <div className="two-fields">
                    <label>
                      Estilo
                      <select
                        value={arrow.style}
                        onChange={(e) =>
                          changeArrow({
                            style: e.target.value as Arrow["style"],
                          })
                        }
                      >
                        <option value="circle">Círculo</option>
                        <option value="plain">Livre</option>
                      </select>
                    </label>
                    <label>
                      Ícone
                      <select
                        value={arrow.icon}
                        onChange={(e) =>
                          changeArrow({ icon: e.target.value as Arrow["icon"] })
                        }
                      >
                        <option value="arrow">Seta</option>
                        <option value="chevron">Chevron</option>
                      </select>
                    </label>
                  </div>
                  <label>
                    Cor
                    <input
                      type="color"
                      value={arrow.color}
                      onChange={(e) =>
                        changeArrow({ color: e.target.value, tone: "primary" })
                      }
                    />
                  </label>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={arrow.visible}
                      onChange={(e) =>
                        changeArrow({ visible: e.target.checked })
                      }
                    />
                    Visível para o visitante
                  </label>
                  <button
                    className="outline wide"
                    onClick={() => {
                      const pairId = arrow.pairId || crypto.randomUUID();
                      setReturnPlan({
                        source: sceneId,
                        arrowId: arrow.id,
                        pairId,
                      });
                      setSceneId(arrow.to);
                      setSelected("");
                      setMode("place");
                      setStatus(
                        "Escolha um ponto independente para o retorno no ambiente de destino.",
                      );
                    }}
                  >
                    <ArrowLeftRight size={16} />
                    Posicionar retorno
                  </button>
                  <div className="danger-actions">
                    <button onClick={() => removeArrow("one")}>
                      <Trash2 size={14} />
                      Excluir ida
                    </button>
                    <button onClick={() => removeArrow("return")}>
                      Excluir volta
                    </button>
                    <button onClick={() => removeArrow("pair")}>
                      Excluir par
                    </button>
                  </div>
                </>
              ) : (
                <div className="inspector-empty">
                  <MousePointer2 size={22} />
                  <p>Selecione uma seta para ajustar suas propriedades.</p>
                </div>
              )}
            </div>
          ) : tab === "scene" ? (
            <div className="inspector-body">
              {row ? (
                <>
                  <h3>Seu ambiente.</h3>
                  <label>
                    Nome
                    <input
                      value={row.name}
                      maxLength={120}
                      onChange={(e) => changeScene({ name: e.target.value })}
                    />
                  </label>
                  <label>
                    Grupo
                    <input
                      value={row.group}
                      maxLength={100}
                      onChange={(e) => changeScene({ group: e.target.value })}
                      placeholder="Ex.: Térreo"
                    />
                  </label>
                  <button
                    className="outline wide"
                    onClick={() => replace.current?.click()}
                  >
                    <ImagePlus size={16} />
                    Trocar fotografia
                  </button>
                  <button
                    className="outline wide"
                    onClick={() => commit({ ...config, firstSceneId: row.id })}
                  >
                    <Star size={16} />
                    {config.firstSceneId === row.id
                      ? "Ambiente inicial"
                      : "Definir como início"}
                  </button>
                  <button
                    className="outline wide"
                    onClick={() => changeScene(camera.current)}
                  >
                    <Settings2 size={16} />
                    Usar enquadramento atual
                  </button>
                  <p className="muted">
                    Posição inicial: {row.yaw.toFixed(1)}° /{" "}
                    {row.pitch.toFixed(1)}° · Campo {row.hfov.toFixed(0)}°
                  </p>
                  <button
                    className="danger wide"
                    onClick={() => {
                      const incoming = config.scenes.reduce(
                        (n, s) =>
                          n + s.links.filter((a) => a.to === row.id).length,
                        0,
                      );
                      if (
                        confirm(
                          `Excluir “${row.name}”? Serão removidas ${row.links.length} setas de saída e ${incoming} de entrada. Versões antigas e suas fotografias serão preservadas.`,
                        )
                      ) {
                        const next = removeScene(config, row.id);
                        commit(next);
                        setSceneId(next.scenes[0]?.id || "");
                        setSelected("");
                      }
                    }}
                  >
                    <Trash2 size={16} />
                    Excluir ambiente
                  </button>
                </>
              ) : (
                <p>Selecione um ambiente.</p>
              )}
            </div>
          ) : (
            <div className="inspector-body">
              <h3>A identidade do tour.</h3>
              <label>
                Título
                <input
                  value={config.title}
                  maxLength={160}
                  onChange={(e) => commit({ ...config, title: e.target.value })}
                />
              </label>
              <label>
                Descrição
                <textarea
                  value={config.description}
                  maxLength={1000}
                  onChange={(e) =>
                    commit({ ...config, description: e.target.value })
                  }
                />
              </label>
              <label>
                Cor principal
                <input
                  type="color"
                  value={config.branding.accent}
                  onChange={(e) =>
                    commit({
                      ...config,
                      branding: { ...config.branding, accent: e.target.value },
                    })
                  }
                />
              </label>
              <div className="branding-previews">
                {config.branding.logoAssetId &&
                  urls[config.branding.logoAssetId] && (
                    <img
                      alt="Logo do cliente"
                      src={urls[config.branding.logoAssetId]}
                    />
                  )}
                {config.branding.ogAssetId &&
                  urls[config.branding.ogAssetId] && (
                    <img
                      alt="Prévia de compartilhamento"
                      src={urls[config.branding.ogAssetId]}
                    />
                  )}
              </div>
              <button
                className="outline wide"
                onClick={() => {
                  brandKind.current = "logo";
                  brandFile.current?.click();
                }}
              >
                Enviar logo do cliente
              </button>
              <button
                className="outline wide"
                onClick={() => {
                  brandKind.current = "social";
                  brandFile.current?.click();
                }}
              >
                Imagem de prévia WhatsApp
              </button>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={config.settings.autoRotate}
                  onChange={(e) =>
                    commit({
                      ...config,
                      settings: {
                        ...config.settings,
                        autoRotate: e.target.checked,
                      },
                    })
                  }
                />
                Giro automático opcional
              </label>
              <div className="two-fields">
                <label>
                  Zoom mínimo
                  <input
                    type="number"
                    min={30}
                    max={100}
                    value={config.settings.minHfov}
                    onChange={(e) =>
                      commit({
                        ...config,
                        settings: {
                          ...config.settings,
                          minHfov: Number(e.target.value),
                        },
                      })
                    }
                  />
                </label>
                <label>
                  Zoom máximo
                  <input
                    type="number"
                    min={90}
                    max={140}
                    value={config.settings.maxHfov}
                    onChange={(e) =>
                      commit({
                        ...config,
                        settings: {
                          ...config.settings,
                          maxHfov: Number(e.target.value),
                        },
                      })
                    }
                  />
                </label>
              </div>
              <p className="muted">
                A redução de movimento do dispositivo é respeitada. Dados e
                marca permanecem exclusivos deste projeto.
              </p>
            </div>
          )}
        </aside>
      </div>
      <footer className="editor-footer">
        <button disabled={busy} onClick={() => setDialog("history")}>
          <History size={16} />
          Histórico <span className="count">{versions.length}</span>
        </button>
        <button disabled={busy} onClick={() => setDialog("audit")}>
          <ShieldCheck size={16} />
          Auditoria
          {audit.errors.length > 0 && (
            <span className="count warn">{audit.errors.length}</span>
          )}
        </button>
        <button
          disabled={busy || project.status !== "published"}
          onClick={() => setDialog("share")}
        >
          <Share2 size={16} />
          Compartilhar
        </button>
        <span className="footer-spacer" />
        <button
          disabled={busy}
          onClick={() => {
            if (
              dirty &&
              !confirm(
                "O backup inclui o rascunho salvo e as versões no servidor. Continuar sem salvar as alterações locais?",
              )
            )
              return;
            void execute(async () => {
              await backupProject(project.id, setStatus);
              setStatus(
                "Backup completo baixado, com fotografias e histórico.",
              );
            });
          }}
        >
          <Download size={16} />
          Backup ZIP
        </button>
        <button
          onClick={() => downloadJson(config, project.slug + "-draft.json")}
        >
          <Download size={16} />
          Exportar
        </button>
        <button disabled={busy} onClick={() => importFile.current?.click()}>
          <Upload size={16} />
          Importar
        </button>
      </footer>
      <input
        ref={upload}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        hidden
        onChange={(e) => {
          void addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={replace}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => {
          void addFiles(e.target.files, true);
          e.target.value = "";
        }}
      />
      <input
        ref={importFile}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file)
            void execute(async () => {
              if (file.size > 5 * 1024 * 1024)
                throw new Error("O JSON deve ter até 5 MB.");
              const snap = snapshotSchema.safeParse(
                JSON.parse(await file.text()),
              );
              if (!snap.success)
                throw new Error(
                  "JSON inválido. Exporte um tour no formato voee360tour.",
                );
              const assetIds = new Set(assets.map((a) => a.id));
              if (
                snap.data.scenes.some((s) =>
                  [s.panoramaAssetId, s.thumbnailAssetId].some(
                    (id) => id && !assetIds.has(id),
                  ),
                )
              )
                throw new Error(
                  "As mídias deste JSON não pertencem ao projeto. Use duplicar para copiar um tour completo.",
                );
              if (confirm("Substituir o rascunho local por este arquivo?")) {
                commit(snap.data);
                setSceneId(snap.data.firstSceneId || "");
              }
            });
          e.target.value = "";
        }}
      />
      <input
        ref={brandFile}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file)
            void execute(async () => {
              const kind = brandKind.current;
              const asset = await uploadBrandImage(
                project.id,
                file,
                kind,
                setProgress,
              );
              setAssets([...assets, asset]);
              commit({
                ...config,
                branding: {
                  ...config.branding,
                  [kind === "logo" ? "logoAssetId" : "ogAssetId"]: asset.id,
                },
              });
              setStatus(
                "Imagem enviada. Salve e publique para atualizar o compartilhamento.",
              );
            });
          e.target.value = "";
        }}
      />
      {dialog && (
        <div className="modal-backdrop">
          <section
            className={
              "modal " +
              (dialog === "history" || dialog === "audit" ? "large" : "")
            }
            role="dialog"
            aria-modal="true"
            aria-labelledby="editor-dialog-title"
          >
            <div className="section-heading">
              <h2 id="editor-dialog-title">
                {dialog === "history"
                  ? "Histórico preservado"
                  : dialog === "audit"
                    ? "Auditoria do trajeto"
                    : "Compartilhe a experiência"}
              </h2>
              <button
                className="icon-button"
                aria-label="Fechar"
                onClick={() => setDialog(null)}
              >
                <X />
              </button>
            </div>
            {dialog === "history" ? (
              <>
                <p>
                  Restaurar cria um rascunho persistente e preserva o rascunho
                  atual como ponto de recuperação. A publicação só muda ao
                  clicar em Publicar.
                </p>
                <div className="version-list">
                  {versions.map((v) => {
                    const diff = snapshotDiff(v.snapshot, config);
                    return (
                      <article key={v.id}>
                        <div>
                          <strong>
                            V{v.version_number} ·{" "}
                            {v.kind === "published"
                              ? "Publicação"
                              : "Ponto de recuperação"}
                          </strong>
                          <small>
                            {new Date(v.created_at).toLocaleString("pt-BR")}
                          </small>
                          <p>{v.note || "Sem nota"}</p>
                          <small>
                            Atual em relação a esta versão:{" "}
                            {diff.scenes >= 0 ? "+" : ""}
                            {diff.scenes} ambientes, +{diff.added} / −
                            {diff.removed} setas.
                          </small>
                        </div>
                        <div className="version-actions">
                          <button
                            disabled={auditTour(v.snapshot).errors.length > 0}
                            onClick={() => setViewSnapshot(v.snapshot)}
                          >
                            <Eye size={15} />
                            Prévia
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => {
                              if (
                                confirm(
                                  "Restaurar esta versão para um novo rascunho no servidor? Seu rascunho atual será preservado. O tour público permanece como está.",
                                )
                              )
                                void execute(async () => {
                                  const expected = dirty
                                    ? await persist()
                                    : revision;
                                  await rpc("restore_version", {
                                    p_project: project.id,
                                    p_version: v.id,
                                    p_expected: expected,
                                  });
                                  const state = await reload();
                                  h.reset(state.draft.snapshot);
                                  setSaved(state.draft.snapshot);
                                  setRevision(state.draft.revision);
                                  setSceneId(
                                    state.draft.snapshot.firstSceneId || "",
                                  );
                                  setSelected("");
                                  setDialog(null);
                                  setStatus(
                                    "Versão restaurada e salva no servidor. Revise a prévia antes de publicar.",
                                  );
                                });
                            }}
                          >
                            Restaurar rascunho
                          </button>
                        </div>
                      </article>
                    );
                  })}
                  {!versions.length && (
                    <div className="empty">
                      <History />
                      <p>A primeira publicação inaugura seu histórico.</p>
                    </div>
                  )}
                </div>
              </>
            ) : dialog === "audit" ? (
              <>
                <div className="audit-stats">
                  <span>{config.scenes.length} ambientes</span>
                  <span>{audit.arrows} setas</span>
                  <span>{audit.reachable} alcançáveis</span>
                </div>
                <p className="notice">
                  A conectividade automática não confirma a direção física.
                  Confira cada passagem visualmente.
                </p>
                {!audit.errors.length && (
                  <p className="success">
                    <CheckCircle2 size={18} />
                    Estrutura pronta para validação de mídia na publicação.
                  </p>
                )}
                {audit.errors.map((e) => (
                  <p className="audit-issue error" key={e}>
                    <AlertTriangle size={16} />
                    {e}
                  </p>
                ))}
                {audit.warnings.map((e) => (
                  <p className="audit-issue" key={e}>
                    <AlertTriangle size={16} />
                    {e}
                  </p>
                ))}
                <h3>Mapa de conexões</h3>
                <ConnectionGraph
                  snapshot={config}
                  onSelect={(id) => {
                    selectScene(id);
                    setDialog(null);
                  }}
                />
                <div className="graph-list">
                  {config.scenes.map((s) => (
                    <div key={s.id}>
                      <strong>{s.name}</strong>
                      <span>→</span>
                      <p>
                        {s.links
                          .map(
                            (a) =>
                              config.scenes.find((x) => x.id === a.to)?.name ||
                              "Destino inválido",
                          )
                          .join(" · ") || "Sem conexões"}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p>Este endereço mostra somente a última versão publicada.</p>
                <div className="qr-wrap">
                  <QRCodeSVG value={publicUrl} size={180} level="M" />
                </div>
                <label>
                  Link do tour
                  <input readOnly value={publicUrl} />
                </label>
                <div className="modal-actions">
                  <button
                    onClick={() =>
                      void navigator.clipboard
                        .writeText(publicUrl)
                        .then(() => setStatus("Link copiado."))
                        .catch(() =>
                          setStatus("Selecione o link e copie manualmente."),
                        )
                    }
                  >
                    <Copy size={16} />
                    Copiar link
                  </button>
                  <a
                    className="button primary"
                    target="_blank"
                    rel="noreferrer"
                    href={
                      "https://wa.me/?text=" +
                      encodeURIComponent(config.title + " " + publicUrl)
                    }
                  >
                    WhatsApp
                  </a>
                </div>
                <label>
                  Incorporar por iframe
                  <textarea
                    readOnly
                    value={`<iframe src="${publicUrl.replace("/t/", "/embed/")}" title="Tour virtual 360°" style="width:100%;height:600px;border:0" allow="fullscreen; gyroscope; accelerometer" allowfullscreen loading="lazy"></iframe>`}
                  />
                </label>
                <button
                  onClick={() => {
                    const svg = document.querySelector(".qr-wrap svg");
                    if (!svg) return;
                    const blob = new Blob(
                      [new XMLSerializer().serializeToString(svg)],
                      { type: "image/svg+xml" },
                    );
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(blob);
                    a.download = project.slug + "-qrcode.svg";
                    a.click();
                    URL.revokeObjectURL(a.href);
                  }}
                >
                  Baixar QR Code SVG
                </button>
              </>
            )}
          </section>
        </div>
      )}
      {viewSnapshot && (
        <div
          className="preview-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Prévia do visitante"
        >
          <div className="preview-header">
            <span>Pré-visualização · {viewSnapshot.title}</span>
            <button onClick={() => setViewSnapshot(null)}>
              <X size={18} />
              Fechar prévia
            </button>
          </div>
          <ClientOnly>
            <Suspense fallback={<p>Preparando…</p>}>
              <Viewer snapshot={viewSnapshot} urls={urls} embed />
            </Suspense>
          </ClientOnly>
        </div>
      )}
    </div>
  );
}

function ConnectionGraph({
  snapshot,
  onSelect,
}: {
  snapshot: Snapshot;
  onSelect: (id: string) => void;
}) {
  const nodes = snapshot.scenes.map((s, i) => ({
    ...s,
    x:
      300 +
      235 *
        Math.cos(
          (i * 2 * Math.PI) / Math.max(1, snapshot.scenes.length) - Math.PI / 2,
        ),
    y:
      280 +
      225 *
        Math.sin(
          (i * 2 * Math.PI) / Math.max(1, snapshot.scenes.length) - Math.PI / 2,
        ),
  }));
  return (
    <svg
      className="connection-graph"
      viewBox="0 0 600 560"
      role="img"
      aria-label="Grafo das conexões entre ambientes"
    >
      <defs>
        <marker
          id="route-arrow"
          markerWidth="7"
          markerHeight="7"
          refX="25"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L0,6 L6,3 z" fill="#a4b88a" />
        </marker>
      </defs>
      {nodes.flatMap((s) =>
        s.links
          .filter((a) => a.visible)
          .map((a) => {
            const d = nodes.find((d) => d.id === a.to);
            return d ? (
              <line
                key={a.id}
                x1={s.x}
                y1={s.y}
                x2={d.x}
                y2={d.y}
                stroke="#c6d5b7"
                strokeWidth="1.3"
                markerEnd="url(#route-arrow)"
              />
            ) : null;
          }),
      )}
      {nodes.map((s, i) => (
        <g
          key={s.id}
          role="button"
          tabIndex={0}
          aria-label={"Editar ambiente " + s.name}
          onClick={() => onSelect(s.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect(s.id);
            }
          }}
        >
          <title>{s.name}</title>
          <circle
            cx={s.x}
            cy={s.y}
            r={18}
            fill={s.id === snapshot.firstSceneId ? "#b5ed80" : "#f3f6ee"}
            stroke="#a6bd8d"
          />
          <text
            x={s.x}
            y={s.y + 4}
            textAnchor="middle"
            fill="#5f7648"
            fontSize="11"
          >
            {i + 1}
          </text>
          <text
            x={s.x}
            y={s.y + 34}
            textAnchor="middle"
            fill="#8a9583"
            fontSize="7"
          >
            {s.name.slice(0, 23)}
          </text>
        </g>
      ))}
    </svg>
  );
}
