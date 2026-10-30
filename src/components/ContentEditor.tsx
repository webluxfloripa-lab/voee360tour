import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  Eye,
  EyeOff,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { snapshotSchema, type Snapshot } from "../lib/model";
import {
  copyLabels,
  getPresentation,
  moveItem,
  presentationSchema,
  type CopyKey,
  type Presentation,
} from "../lib/presentation";
import { useDialogFocus } from "../lib/useDialogFocus";
import { TourPage } from "./TourPage";

type Props = {
  snapshot: Snapshot;
  urls: Record<string, string>;
  onApply: (s: Snapshot) => void;
  onClose: () => void;
};
export default function ContentEditor({
  snapshot,
  urls,
  onApply,
  onClose,
}: Props) {
  const [value, setValue] = useState<Snapshot>(() => structuredClone(snapshot));
  const [selected, setSelected] = useState("title"),
    [device, setDevice] = useState<"desktop" | "mobile">("desktop"),
    [error, setError] = useState("");
  const textField = useRef<HTMLTextAreaElement>(null);
  const p = getPresentation(value),
    l = p.layout;
  const dirty = JSON.stringify(value) !== JSON.stringify(snapshot);
  function close() {
    if (!dirty || confirm("Descartar as alterações de conteúdo desta prévia?"))
      onClose();
  }
  useDialogFocus(true, close);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function selectText(path: string) {
    setSelected(path);
    window.requestAnimationFrame?.(() => {
      textField.current?.focus({ preventScroll: true });
      if (window.innerWidth <= 800)
        textField.current?.scrollIntoView?.({
          block: "nearest",
          behavior: "smooth",
        });
    });
  }
  function presentation(next: Presentation) {
    setValue((v) => ({ ...v, presentation: next }));
    setError("");
  }
  function layout<K extends keyof Presentation["layout"]>(
    key: K,
    next: Presentation["layout"][K],
  ) {
    presentation({ ...p, layout: { ...l, [key]: next } });
  }
  const options = [
    { key: "title", label: "Título do tour" },
    { key: "description", label: "Descrição do tour" },
    ...Object.entries(copyLabels).map(([key, label]) => ({
      key: `copy.${key}`,
      label,
    })),
    ...p.blocks.flatMap((b, i) =>
      ["title", "body", "cta"].map((key) => ({
        key: `block.${b.id}.${key}`,
        label: `Seção ${i + 1} · ${key === "title" ? "Título" : key === "body" ? "Texto" : "Botão"}`,
      })),
    ),
  ];
  const path = selected.split(".");
  const selectedBlock = p.blocks.find((b) => b.id === path[1]);
  const current =
    selected === "title"
      ? value.title
      : selected === "description"
        ? value.description
        : path[0] === "copy"
          ? p.copy[path[1] as CopyKey]
          : selectedBlock?.[path[2] as "title" | "body" | "cta"] || "";
  function editText(next: string) {
    if (selected === "title") setValue((v) => ({ ...v, title: next }));
    else if (selected === "description")
      setValue((v) => ({
        ...v,
        description: next,
        presentation: { ...p, copy: { ...p.copy, descriptionFallback: next } },
      }));
    else if (path[0] === "copy")
      presentation({ ...p, copy: { ...p.copy, [path[1]!]: next } });
    else if (selectedBlock)
      presentation({
        ...p,
        blocks: p.blocks.map((b) =>
          b.id === selectedBlock.id ? { ...b, [path[2]!]: next } : b,
        ),
      });
    setError("");
  }
  function block(id: string, changes: Partial<Presentation["blocks"][number]>) {
    presentation({
      ...p,
      blocks: p.blocks.map((b) => (b.id === id ? { ...b, ...changes } : b)),
    });
  }
  const range = (
    key:
      | "subtitleSize"
      | "eyebrowSize"
      | "footerSize"
      | "viewerTextSize"
      | "buttonSize"
      | "titleSize"
      | "headingSize"
      | "bodySize"
      | "logoWidth"
      | "viewerHeight"
      | "contentWidth"
      | "spacing",
    label: string,
    min: number,
    max: number,
    unit = "px",
  ) => (
    <label key={key}>
      {label}
      <span className="range-control">
        <input
          aria-label={label}
          type="range"
          min={min}
          max={max}
          value={l[key]}
          onChange={(e) => layout(key, Number(e.target.value))}
        />
        <output>
          {l[key]}
          {unit}
        </output>
      </span>
    </label>
  );
  return (
    <div
      className="content-editor-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Conteúdo e layout"
    >
      <header className="content-editor-top">
        <div>
          <span className="eyebrow">SEU TOUR, DO SEU JEITO</span>
          <h2>Conteúdo e layout</h2>
        </div>
        <div className="content-editor-top-actions">
          <button
            type="button"
            aria-label="Fechar editor de conteúdo"
            onClick={close}
          >
            <X size={16} />
            <span>Fechar</span>
          </button>
          <button
            type="button"
            className="primary"
            onClick={() => {
              const result = snapshotSchema.safeParse(value);
              if (!result.success) {
                setError(
                  result.error.issues[0]?.path[0] === "title"
                    ? "Informe um título para o tour."
                    : "Revise os campos: mantenha os botões identificados, respeite os limites dos textos e use links completos com https://.",
                );
                return;
              }
              onApply(result.data);
            }}
          >
            <Check size={16} />
            Aplicar ao rascunho
          </button>
        </div>
      </header>
      <div className="content-editor-body">
        <section
          className="content-preview-region"
          aria-label="Prévia do conteúdo"
        >
          <div className="content-preview-toolbar">
            <span>Clique em um texto para editar</span>
            <div role="group" aria-label="Dispositivo da prévia">
              <button
                type="button"
                aria-pressed={device === "desktop"}
                onClick={() => setDevice("desktop")}
              >
                Desktop
              </button>
              <button
                type="button"
                aria-pressed={device === "mobile"}
                onClick={() => setDevice("mobile")}
              >
                Celular
              </button>
            </div>
          </div>
          <div className={"content-preview-scroll " + device}>
            <div className="content-preview-page">
              <TourPage
                tour={{ snapshot: value, urls }}
                onSelect={selectText}
                selected={selected}
              />
            </div>
          </div>
        </section>
        <aside
          className="content-properties"
          aria-label="Propriedades do conteúdo"
        >
          <p className="content-help">
            Aplique as mudanças e use Salvar ou Publicar no editor. Você pode
            desfazer as alterações antes de salvar.
          </p>
          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}
          <details open>
            <summary>Textos e títulos</summary>
            <label>
              Texto selecionado
              <select
                aria-label="Texto selecionado"
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
              >
                {options.map((o) => (
                  <option value={o.key} key={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Conteúdo do texto
              <textarea
                aria-label="Conteúdo do texto"
                ref={textField}
                key={selected}
                autoFocus={false}
                rows={5}
                value={current}
                maxLength={4000}
                onChange={(e) => editText(e.target.value)}
              />
            </label>
            <p className="muted">
              Use {"{tour}"} no título da apresentação para inserir o nome do
              passeio. Campos vazios ocultam textos opcionais.
            </p>
          </details>
          <details>
            <summary>Cores e alinhamento</summary>
            <div className="content-colors">
              {(
                [
                  ["background", "Fundo"],
                  ["text", "Texto principal"],
                  ["heading", "Títulos"],
                  ["muted", "Texto secundário"],
                ] as const
              ).map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    aria-label={label}
                    type="color"
                    value={l[key]}
                    onChange={(e) => layout(key, e.target.value)}
                  />
                </label>
              ))}
              <label>
                Cor de destaque
                <input
                  type="color"
                  value={value.branding.accent}
                  onChange={(e) =>
                    setValue((v) => ({
                      ...v,
                      branding: { ...v.branding, accent: e.target.value },
                    }))
                  }
                />
              </label>
            </div>
            <label>
              Alinhamento da apresentação
              <select
                value={l.align}
                onChange={(e) =>
                  layout("align", e.target.value as typeof l.align)
                }
              >
                <option value="left">Esquerda</option>
                <option value="center">Centro</option>
                <option value="right">Direita</option>
              </select>
            </label>
          </details>
          <details>
            <summary>Tamanhos e proporções</summary>
            {range("subtitleSize", "Tamanho do subtítulo e marca", 8, 24)}
            {range("eyebrowSize", "Tamanho da chamada", 8, 24)}
            {range("footerSize", "Tamanho do rodapé", 9, 24)}
            {range(
              "viewerTextSize",
              "Tamanho dos textos do visualizador",
              10,
              24,
            )}
            {range("buttonSize", "Tamanho dos controles do panorama", 32, 64)}
            {range("titleSize", "Tamanho do título do cabeçalho", 16, 60)}
            {range("headingSize", "Tamanho dos títulos das seções", 18, 72)}
            {range("bodySize", "Tamanho do texto", 12, 28)}
            {range("logoWidth", "Largura da logomarca", 32, 240)}
            {range("viewerHeight", "Altura do panorama", 40, 100, "vh")}
            {range("contentWidth", "Largura do conteúdo", 320, 1600)}
            {range("spacing", "Espaçamento das seções", 16, 120)}
          </details>
          <details>
            <summary>Visibilidade e ordem</summary>
            {(
              [
                ["header", "Mostrar cabeçalho"],
                ["showLogo", "Mostrar logomarca"],
                ["showCredit", "Mostrar marca do cabeçalho"],
                ["description", "Mostrar apresentação"],
                ["footer", "Mostrar rodapé"],
              ] as const
            ).map(([key, label]) => (
              <label className="checkbox" key={key}>
                <input
                  type="checkbox"
                  checked={l[key]}
                  onChange={(e) => layout(key, e.target.checked)}
                />
                {label}
              </label>
            ))}
            <p className="muted">
              Reordene as seções abaixo. Ocultar mantém o conteúdo para uso
              posterior.
            </p>
            {l.order.map((key, i) => (
              <div className="content-order-row" key={key}>
                <span>
                  {
                    {
                      tour: "Panorama",
                      description: "Apresentação",
                      blocks: "Seções adicionais",
                    }[key]
                  }
                </span>
                <button
                  type="button"
                  aria-label={`Subir ${key}`}
                  disabled={i === 0}
                  onClick={() => layout("order", moveItem(l.order, i, -1))}
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  type="button"
                  aria-label={`Descer ${key}`}
                  disabled={i === l.order.length - 1}
                  onClick={() => layout("order", moveItem(l.order, i, 1))}
                >
                  <ArrowDown size={14} />
                </button>
              </div>
            ))}
            {value.branding.logoAssetId && (
              <button
                type="button"
                className="danger-button"
                onClick={() =>
                  setValue((v) => ({
                    ...v,
                    branding: { ...v.branding, logoAssetId: null },
                  }))
                }
              >
                <Trash2 size={14} />
                Remover logo deste layout
              </button>
            )}
          </details>
          <details open>
            <summary>Seções adicionais · {p.blocks.length}/30</summary>
            {p.blocks.map((b, i) => (
              <article className="content-block-card" key={b.id}>
                <div className="content-block-heading">
                  <strong>{b.title || `Seção ${i + 1}`}</strong>
                  <button
                    type="button"
                    aria-label={
                      b.visible
                        ? `Ocultar seção ${i + 1}`
                        : `Mostrar seção ${i + 1}`
                    }
                    onClick={() => block(b.id, { visible: !b.visible })}
                  >
                    {b.visible ? <Eye size={15} /> : <EyeOff size={15} />}
                  </button>
                </div>
                <button
                  type="button"
                  className="outline wide"
                  onClick={() => setSelected(`block.${b.id}.title`)}
                >
                  Editar título, texto e botão
                </button>
                <label>
                  Link do botão (https://)
                  <input
                    type="url"
                    value={b.url}
                    onChange={(e) => block(b.id, { url: e.target.value })}
                    placeholder="https://wa.me/…"
                  />
                </label>
                <label>
                  Alinhamento da seção
                  <select
                    value={b.align}
                    onChange={(e) =>
                      block(b.id, { align: e.target.value as typeof b.align })
                    }
                  >
                    <option value="left">Esquerda</option>
                    <option value="center">Centro</option>
                    <option value="right">Direita</option>
                  </select>
                </label>
                <label>
                  Tamanho do título da seção
                  <input
                    type="range"
                    min={18}
                    max={72}
                    value={b.titleSize}
                    onChange={(e) =>
                      block(b.id, { titleSize: Number(e.target.value) })
                    }
                  />
                </label>
                <label>
                  Tamanho do texto da seção
                  <input
                    type="range"
                    min={12}
                    max={28}
                    value={b.bodySize}
                    onChange={(e) =>
                      block(b.id, { bodySize: Number(e.target.value) })
                    }
                  />
                </label>
                <div className="content-block-actions">
                  <button
                    type="button"
                    aria-label={`Subir seção ${i + 1}`}
                    disabled={i === 0}
                    onClick={() =>
                      presentation({ ...p, blocks: moveItem(p.blocks, i, -1) })
                    }
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Descer seção ${i + 1}`}
                    disabled={i === p.blocks.length - 1}
                    onClick={() =>
                      presentation({ ...p, blocks: moveItem(p.blocks, i, 1) })
                    }
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Duplicar seção ${i + 1}`}
                    disabled={p.blocks.length >= 30}
                    onClick={() =>
                      presentation({
                        ...p,
                        blocks: [
                          ...p.blocks.slice(0, i + 1),
                          {
                            ...b,
                            id: crypto.randomUUID(),
                            title: b.title.slice(0, 290) + " · cópia",
                          },
                          ...p.blocks.slice(i + 1),
                        ],
                      })
                    }
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    type="button"
                    className="danger-button"
                    aria-label={`Excluir seção ${i + 1}`}
                    onClick={() => {
                      presentation({
                        ...p,
                        blocks: p.blocks.filter((x) => x.id !== b.id),
                      });
                      if (selected.includes(b.id)) setSelected("title");
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </article>
            ))}
            <button
              type="button"
              className="outline wide"
              disabled={p.blocks.length >= 30}
              onClick={() => {
                const id = crypto.randomUUID();
                presentation({
                  ...p,
                  blocks: [
                    ...p.blocks,
                    {
                      id,
                      title: "Nova seção",
                      body: "Escreva aqui seu conteúdo.",
                      cta: "",
                      url: "",
                      visible: true,
                      align: "center",
                      titleSize: 30,
                      bodySize: 16,
                    },
                  ],
                });
                setSelected(`block.${id}.title`);
              }}
            >
              <Plus size={16} />
              Adicionar seção de conteúdo
            </button>
          </details>
          <button
            type="button"
            className="outline wide"
            style={{ marginTop: 16 } as CSSProperties}
            onClick={() => {
              if (
                confirm(
                  "Restaurar cores, tamanhos e textos da interface? O título, a descrição, as seções adicionais e os ambientes serão preservados.",
                )
              )
                presentation({
                  ...presentationSchema.parse({}),
                  blocks: p.blocks,
                });
            }}
          >
            <RotateCcw size={16} />
            Restaurar estilo padrão
          </button>
        </aside>
      </div>
    </div>
  );
}
