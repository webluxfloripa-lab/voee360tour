import { useDialogFocus } from "../lib/useDialogFocus";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Plus,
  ArrowUpRight,
  Search,
  Users,
  Scan,
  Globe,
  Clock,
  MoreHorizontal,
  ImageOff,
  ArrowRight,
  Copy,
  Archive,
  RotateCcw,
  Pencil,
  Trash2,
} from "lucide-react";
import { AdminShell } from "./AdminShell";
import { AuthGate } from "./AuthGate";
import { deleteProject, getDashboard, rpc, signedAssets } from "../lib/api";
import { errorText, type Client, type Project } from "../lib/model";
import { duplicateProject } from "../lib/duplicate";
type Data = Awaited<ReturnType<typeof getDashboard>>;
const labels: Record<string, string> = {
  draft: "Rascunho",
  pending_media: "Mídia pendente",
  published: "Publicado",
  archived: "Arquivado",
};
export function Dashboard({ section = "overview" }: { section?: string }) {
  return (
    <AuthGate>
      <DashboardContent section={section} />
    </AuthGate>
  );
}
function DashboardContent({ section }: { section: string }) {
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [modal, setModal] = useState<"client" | "project" | "delete" | null>(null),
    [deleteTarget, setDeleteTarget] = useState<Project | null>(null),
    [deleteConfirmation, setDeleteConfirmation] = useState(""),
    [notice, setNotice] = useState(""),
    [editClient, setEditClient] = useState<Client | null>(null),
    [editProject, setEditProject] = useState<Project | null>(null),
    [busy, setBusy] = useState(false),
    [thumbs, setThumbs] = useState<Record<string, string>>({}),
    [menu, setMenu] = useState(""),
    [assetUrls, setAssetUrls] = useState<Record<string, string>>({});
  useDialogFocus(!!modal, () => {
    if (!busy) setModal(null);
  });
  async function load() {
    try {
      const d = await getDashboard();
      setData(d);
      const thumbnails = d.assets.filter(
        (a) =>
          (a.kind === "thumbnail" || a.kind === "logo") &&
          !d.projects.find((p) => p.id === a.project_id)?.deletion_pending,
      );
      const urls = await signedAssets(thumbnails);
      setAssetUrls(urls);
      const projectThumbs: Record<string, string> = {};
      for (const a of thumbnails)
        if (urls[a.id] && !projectThumbs[a.project_id])
          projectThumbs[a.project_id] = urls[a.id]!;
      setThumbs(projectThumbs);
    } catch (e) {
      setError(errorText(e));
    }
  }
  useEffect(() => {
    void load();
  }, []);
  const projects =
    data?.projects.filter(
      (p) =>
        (filter === "all" || p.status === filter) &&
        (p.title + " " + data.clients.find((c) => c.id === p.client_id)?.name)
          .toLowerCase()
          .includes(search.toLowerCase()),
    ) ?? [];
  const published =
    data?.projects.filter((p) => p.status === "published").length ?? 0;
  async function action(work: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
      await load();
    } catch (e) {
      setError(errorText(e));
      if (modal === "delete") await load();
    } finally {
      setBusy(false);
      setMenu("");
    }
  }
  return (
    <AdminShell section={section}>
      <main className="page-content">
        <div className="page-heading">
          <div>
            <p className="eyebrow">SEU WORKSPACE, DE TODOS OS ÂNGULOS</p>
            <h1>
              {section === "clients"
                ? "Conexões que crescem."
                : section === "projects"
                  ? "Experiências em movimento."
                  : section === "history"
                    ? "Cada passo, registrado."
                    : "Uma visão de tudo."}
              <span className="heading-dot">.</span>
            </h1>
            <p>
              {section === "clients"
                ? "Organize seus clientes e crie novas possibilidades."
                : section === "history"
                  ? "Publicações preservadas e atividade recente dos seus projetos."
                  : "Gerencie seus tours e transforme espaços em experiências."}
            </p>
          </div>
          <button
            className="primary"
            onClick={() => {
              setEditProject(null);
              setEditClient(null);
              setModal(section === "clients" ? "client" : "project");
            }}
          >
            <Plus size={18} />
            {section === "clients" ? "Novo cliente" : "Novo projeto"}
          </button>
        </div>
        {error && (
          <div className="notice error" role="alert">
            {error}
            <button
              className="text-button"
              onClick={() => {
                setError("");
                void load();
              }}
            >
              Tentar novamente
            </button>
          </div>
        )}
        {notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}
        {!data ? (
          <div className="loading-block" role="status">
            <span className="spinner" />
            Carregando seus projetos…
          </div>
        ) : (
          <>
            {section === "overview" && (
              <>
                <div className="stats-grid">
                  {[
                    {
                      icon: Users,
                      label: "Clientes",
                      value: data.clients.length,
                      detail: "Relacionamentos em um só lugar",
                      tone: "lime",
                    },
                    {
                      icon: Scan,
                      label: "Tours criados",
                      value: data.projects.filter(
                        (p) => p.status !== "archived",
                      ).length,
                      detail: "Cada espaço, uma experiência",
                      tone: "blue",
                    },
                    {
                      icon: Globe,
                      label: "Publicados",
                      value: published,
                      detail: "Experiências disponíveis por link",
                      tone: "purple",
                    },
                    {
                      icon: Clock,
                      label: "Em construção",
                      value: data.projects.filter((p) =>
                        ["draft", "pending_media"].includes(p.status),
                      ).length,
                      detail: "Prontos para o próximo passo",
                      tone: "orange",
                    },
                  ].map((s) => (
                    <article className="stat-card" key={s.label}>
                      <div className="stat-top">
                        <span className={`stat-icon ${s.tone}`}>
                          <s.icon size={19} />
                        </span>
                        <span>{s.label}</span>
                        <ArrowUpRight size={16} />
                      </div>
                      <strong>{s.value.toString().padStart(2, "0")}</strong>
                      <small>{s.detail}</small>
                    </article>
                  ))}
                </div>
                <section className="welcome-banner">
                  <div>
                    <span className="eyebrow">DO REAL AO EXTRAORDINÁRIO</span>
                    <h2>Seu próximo tour começa aqui.</h2>
                    <p>
                      Um novo cliente. Um espaço único. Infinitas perspectivas.
                    </p>
                    <button
                      className="light-button"
                      onClick={() => {
                        setEditClient(null);
                        setModal("client");
                      }}
                    >
                      Adicionar cliente <ArrowUpRight size={16} />
                    </button>
                  </div>
                  <div className="banner-orbit" aria-hidden="true">
                    <span>360°</span>
                    <i />
                    <b />
                    <em />
                  </div>
                </section>
              </>
            )}
            {section === "clients" ? (
              <section className="panel">
                <div className="section-heading">
                  <h2>
                    Seus clientes{" "}
                    <span className="count">{data.clients.length}</span>
                  </h2>
                  <label className="search-field">
                    <Search size={17} />
                    <input
                      type="search"
                      aria-label="Buscar clientes"
                      placeholder="Buscar cliente…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                </div>
                <div className="client-grid">
                  {data.clients
                    .filter((c) =>
                      (c.name + " " + c.contact)
                        .toLowerCase()
                        .includes(search.toLowerCase()),
                    )
                    .map((c) => (
                      <article key={c.id} className="client-card">
                        <span className="client-avatar">
                          {c.logo_asset_id && assetUrls[c.logo_asset_id] ? (
                            <img
                              src={assetUrls[c.logo_asset_id]}
                              alt={"Logo de " + c.name}
                            />
                          ) : (
                            c.name.slice(0, 2).toUpperCase()
                          )}
                        </span>
                        <div>
                          <h3>{c.name}</h3>
                          <p>
                            {c.email || c.contact || "Contato não informado"}
                          </p>
                          <small>
                            {
                              data.projects.filter((p) => p.client_id === c.id)
                                .length
                            }{" "}
                            projetos · {c.active ? "Ativo" : "Inativo"}
                          </small>
                        </div>
                        <button
                          className="icon-button"
                          aria-label={"Editar " + c.name}
                          onClick={() => {
                            setEditClient(c);
                            setModal("client");
                          }}
                        >
                          <Pencil size={17} />
                        </button>
                      </article>
                    ))}
                </div>
                {!data.clients.length && (
                  <div className="empty">
                    <Users />
                    <h3>Seu primeiro cliente começa aqui.</h3>
                    <p>Cadastre um cliente para organizar seus tours.</p>
                  </div>
                )}
              </section>
            ) : section === "history" ? (
              <section className="panel">
                <h2>Versões recentes</h2>
                <div className="activity-list">
                  {data.versions.map((v) => (
                    <div className="activity-row" key={v.id}>
                      <span className="activity-icon">
                        <Clock size={18} />
                      </span>
                      <div>
                        <strong>
                          {
                            data.projects.find((p) => p.id === v.project_id)
                              ?.title
                          }
                        </strong>
                        <p>
                          Versão {v.version_number} ·{" "}
                          {v.kind === "published"
                            ? "Publicação"
                            : "Ponto de recuperação"}
                        </p>
                        <small>
                          {v.note || "Sem nota"} ·{" "}
                          {new Date(v.created_at).toLocaleString("pt-BR")}
                        </small>
                      </div>
                      <Link
                        to="/admin/projetos/$id/editor"
                        params={{ id: v.project_id }}
                        className="icon-button"
                        aria-label="Abrir histórico do projeto"
                      >
                        <ArrowUpRight size={18} />
                      </Link>
                    </div>
                  ))}
                </div>
                {!data.versions.length && (
                  <div className="empty">
                    <Clock />
                    <h3>A história começa na primeira publicação.</h3>
                    <p>
                      As versões aparecerão aqui conforme você publicar seus
                      tours.
                    </p>
                  </div>
                )}
              </section>
            ) : (
              <section className="projects-section">
                <div className="section-heading">
                  <h2>
                    {section === "overview"
                      ? "Seus projetos"
                      : "Todos os projetos"}{" "}
                    <span className="count">{data.projects.length}</span>
                  </h2>
                  <div className="section-tools">
                    <label className="search-field">
                      <Search size={17} />
                      <input
                        type="search"
                        aria-label="Buscar projetos"
                        placeholder="Buscar projeto…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </label>
                    <select
                      aria-label="Filtrar status"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    >
                      <option value="all">Todos os status</option>
                      {Object.entries(labels).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="project-grid">
                  {projects.map((p) => {
                    const client = data.clients.find(
                      (c) => c.id === p.client_id,
                    );
                    return (
                      <article className="project-card" key={p.id}>
                        <Link
                          to="/admin/projetos/$id/editor"
                          params={{ id: p.id }}
                          className="project-cover"
                          aria-label={"Editar " + p.title}
                          aria-disabled={p.deletion_pending || undefined}
                          onClick={(e) => {
                            if (p.deletion_pending) e.preventDefault();
                          }}
                        >
                          {thumbs[p.id] ? (
                            <img
                              src={thumbs[p.id]}
                              alt={"Ambiente de " + p.title}
                              loading="lazy"
                            />
                          ) : (
                            <div
                              className={`cover-placeholder ${p.status === "pending_media" ? "amber" : "violet"}`}
                            >
                              <div className="cover-wire" />
                              <span className="cover-symbol">
                                {p.status === "pending_media" ? (
                                  <ImageOff size={35} />
                                ) : (
                                  <Scan size={35} />
                                )}
                              </span>
                              <span>
                                {p.deletion_pending
                                  ? "Exclusão pendente"
                                  : p.status === "pending_media"
                                    ? "Aguardando fotografias"
                                    : "Seu espaço começa aqui"}
                              </span>
                            </div>
                          )}
                          <span className={`status-badge ${p.status}`}>
                            <i />
                            {p.deletion_pending
                              ? "Exclusão pendente"
                              : labels[p.status]}
                          </span>
                          <span className="cover-360">360°</span>
                        </Link>
                        <div className="project-card-body">
                          <div className="project-card-title">
                            <div>
                              <small>{client?.name}</small>
                              <h3>{p.title}</h3>
                            </div>
                            <div className="project-menu">
                              <button
                                className="icon-button"
                                aria-label={"Opções de " + p.title}
                                onClick={() =>
                                  setMenu(menu === p.id ? "" : p.id)
                                }
                              >
                                <MoreHorizontal size={20} />
                              </button>
                              {menu === p.id && (
                                <div className="dropdown">
                                  <button
                                    disabled={busy || p.deletion_pending}
                                    onClick={() => {
                                      setEditProject(p);
                                      setModal("project");
                                      setMenu("");
                                    }}
                                  >
                                    <Pencil size={15} />
                                    Renomear / endereço
                                  </button>
                                  <button
                                    disabled={busy || p.deletion_pending}
                                    onClick={() => {
                                      if (
                                        confirm(
                                          "Duplicar este tour, copiando as mídias para um novo projeto?",
                                        )
                                      )
                                        void action(() => duplicateProject(p));
                                    }}
                                  >
                                    <Copy size={15} />
                                    Duplicar com mídias próprias
                                  </button>
                                  <button
                                    disabled={busy || p.deletion_pending}
                                    onClick={() => {
                                      if (
                                        confirm(
                                          p.status === "archived"
                                            ? "Reabrir este projeto como rascunho?"
                                            : "Arquivar e retirar o tour do acesso público?",
                                        )
                                      )
                                        void action(() =>
                                          rpc("manage_project", {
                                            p_data: {
                                              id: p.id,
                                              status:
                                                p.status === "archived"
                                                  ? "draft"
                                                  : "archived",
                                            },
                                          }),
                                        );
                                    }}
                                  >
                                    {p.status === "archived" ? (
                                      <RotateCcw size={15} />
                                    ) : (
                                      <Archive size={15} />
                                    )}
                                    {p.status === "archived"
                                      ? "Reabrir rascunho"
                                      : "Arquivar"}
                                  </button>
                                  <button
                                    className="danger-text"
                                    disabled={busy}
                                    onClick={() => {
                                      setDeleteTarget(p);
                                      setDeleteConfirmation("");
                                      setError("");
                                      setMenu("");
                                      setModal("delete");
                                    }}
                                  >
                                    <Trash2 size={15} />
                                    {p.deletion_pending
                                      ? "Concluir exclusão"
                                      : "Excluir passeio virtual"}
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="project-card-meta">
                            <span>
                              <Scan size={14} />
                              {
                                data.assets.filter(
                                  (a) =>
                                    a.project_id === p.id &&
                                    a.kind === "panorama",
                                ).length
                              }{" "}
                              panoramas
                            </span>
                            <span>
                              {new Date(p.updated_at).toLocaleDateString(
                                "pt-BR",
                              )}
                            </span>
                          </div>
                          <div className="project-card-footer">
                            <Link
                              to="/admin/projetos/$id/editor"
                              params={{ id: p.id }}
                              aria-disabled={p.deletion_pending || undefined}
                              onClick={(e) => {
                                if (p.deletion_pending) e.preventDefault();
                              }}
                            >
                              Editar ambientes <ArrowRight size={15} />
                            </Link>
                            <Link
                              to="/admin/projetos/$id/editor"
                              params={{ id: p.id }}
                              hash="conteudo"
                              aria-disabled={p.deletion_pending || undefined}
                              onClick={(e) => {
                                if (p.deletion_pending) e.preventDefault();
                              }}
                              aria-label={"Personalizar " + p.title}
                            >
                              Textos e layout
                            </Link>
                            {p.status === "published" && (
                              <a
                                href={"/t/" + p.slug}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={"Visitar " + p.title}
                              >
                                Visualizar <ArrowUpRight size={16} />
                              </a>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                  <button
                    className="new-project-card"
                    onClick={() => {
                      setEditProject(null);
                      setModal("project");
                    }}
                  >
                    <span>
                      <Plus size={25} />
                    </span>
                    <strong>Criar novo tour</strong>
                    <small>Abra uma nova perspectiva</small>
                  </button>
                </div>
              </section>
            )}
            {section === "overview" && (
              <div className="dashboard-bottom">
                <section className="panel">
                  <div className="section-heading">
                    <h2>Últimas publicações</h2>
                    <Link to="/admin/historico" className="text-button">
                      Ver atividade <ArrowUpRight size={15} />
                    </Link>
                  </div>
                  {data.versions
                    .filter((v) => v.kind === "published")
                    .slice(0, 3)
                    .map((v) => (
                      <div className="activity-row" key={v.id}>
                        <span className="activity-icon">
                          <Globe size={18} />
                        </span>
                        <div>
                          <strong>
                            {
                              data.projects.find((p) => p.id === v.project_id)
                                ?.title
                            }
                          </strong>
                          <p>
                            Versão {v.version_number} ·{" "}
                            {new Date(v.created_at).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                      </div>
                    ))}
                  {!data.versions.length && (
                    <div className="quiet-empty">
                      <Clock size={21} />
                      <p>
                        Nenhuma publicação por enquanto.
                        <small>
                          Seu primeiro tour publicado aparecerá aqui.
                        </small>
                      </p>
                    </div>
                  )}
                </section>
                <section className="panel storage-panel">
                  <span className="stat-icon blue">
                    <Scan size={19} />
                  </span>
                  <h3>Espaço para novas histórias.</h3>
                  <p>
                    {(
                      data.assets.reduce((n, a) => n + a.file_size, 0) /
                      1024 /
                      1024
                    ).toFixed(1)}{" "}
                    MB em fotografias cadastradas.
                  </p>
                  <small>
                    Cotas e transferência seguem o plano contratado. Verifique
                    os painéis dos provedores antes de ampliar o uso.
                  </small>
                </section>
              </div>
            )}
          </>
        )}
      </main>
      {modal === "delete" && deleteTarget && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-tour-title"
            aria-describedby="delete-tour-description"
          >
            <h2 id="delete-tour-title">Excluir passeio virtual?</h2>
            <p id="delete-tour-description">
              <strong>{deleteTarget.title}</strong> será removido
              definitivamente, junto com fotos, ambientes, setas, rascunhos e
              histórico. O link público deixará de funcionar. Esta ação não pode
              ser desfeita. O cadastro do cliente será mantido.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (busy || deleteConfirmation !== deleteTarget.slug) return;
                void action(async () => {
                  await deleteProject(deleteTarget.id, deleteConfirmation);
                  setModal(null);
                  setDeleteTarget(null);
                  setNotice(
                    "Passeio virtual, arquivos e registros excluídos definitivamente.",
                  );
                });
              }}
            >
              <label>
                Digite <strong>{deleteTarget.slug}</strong> para confirmar
                <input
                  aria-label="Identificador para confirmar exclusão"
                  autoComplete="off"
                  spellCheck={false}
                  value={deleteConfirmation}
                  disabled={busy}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                />
              </label>
              {error && (
                <p role="alert" className="notice error">
                  {error}
                </p>
              )}
              {busy && (
                <p role="status">
                  Excluindo arquivos e registros… Aguarde a conclusão.
                </p>
              )}
              <div className="modal-actions">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setModal(null)}
                >
                  Cancelar
                </button>
                <button
                  className="danger"
                  disabled={busy || deleteConfirmation !== deleteTarget.slug}
                >
                  {busy ? "Excluindo…" : "Excluir definitivamente"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {(modal === "client" || modal === "project") && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <h2 id="modal-title">
              {modal === "client"
                ? editClient
                  ? "Editar cliente"
                  : "Novo cliente"
                : editProject
                  ? "Editar projeto"
                  : "Criar uma nova experiência"}
            </h2>
            <p>
              {modal === "client"
                ? "Um cadastro independente para cada cliente."
                : "Defina o cliente e o endereço do seu tour."}
            </p>
            <form
              key={editClient?.id || editProject?.id || "new"}
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                void action(async () => {
                  if (modal === "client")
                    await rpc("manage_client", {
                      p_data: {
                        ...(editClient ? { id: editClient.id } : {}),
                        name: form.get("name"),
                        slug: form.get("slug"),
                        email: form.get("email"),
                        contact: form.get("contact"),
                        active: form.get("active") === "on",
                        logo_asset_id: form.get("logo_asset_id") || null,
                      },
                    });
                  else
                    await rpc("manage_project", {
                      p_data: {
                        ...(editProject
                          ? { id: editProject.id }
                          : { client_id: form.get("client_id") }),
                        title: form.get("title"),
                        slug: form.get("slug"),
                      },
                    });
                  setModal(null);
                });
              }}
            >
              {modal === "client" ? (
                <>
                  <label>
                    Nome do cliente
                    <input
                      name="name"
                      required
                      maxLength={160}
                      defaultValue={editClient?.name}
                    />
                  </label>
                  <label>
                    Identificador
                    <input
                      name="slug"
                      required
                      pattern="[a-z0-9]+(-[a-z0-9]+)*"
                      placeholder="nome-do-cliente"
                      defaultValue={editClient?.slug}
                    />
                  </label>
                  <label>
                    E-mail
                    <input
                      type="email"
                      name="email"
                      defaultValue={editClient?.email}
                    />
                  </label>
                  <label>
                    Contato / WhatsApp
                    <input name="contact" defaultValue={editClient?.contact} />
                  </label>
                  <label>
                    Logo do cliente
                    <select
                      name="logo_asset_id"
                      defaultValue={editClient?.logo_asset_id || ""}
                    >
                      <option value="">Sem logo</option>
                      {data?.assets
                        .filter(
                          (a) =>
                            a.kind === "logo" &&
                            data.projects.some(
                              (p) =>
                                p.id === a.project_id &&
                                !p.deletion_pending &&
                                p.client_id === editClient?.id,
                            ),
                        )
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            Logo enviado em{" "}
                            {
                              data.projects.find((p) => p.id === a.project_id)
                                ?.title
                            }
                          </option>
                        ))}
                    </select>
                    <small>
                      Você pode enviar o logo na aba Tour do editor e
                      selecioná-lo aqui.
                    </small>
                  </label>
                  <label className="checkbox">
                    <input
                      name="active"
                      type="checkbox"
                      defaultChecked={editClient?.active ?? true}
                    />
                    Cliente ativo
                  </label>
                </>
              ) : (
                <>
                  <label>
                    Título do tour
                    <input
                      name="title"
                      required
                      maxLength={160}
                      defaultValue={editProject?.title}
                    />
                  </label>
                  <label>
                    Endereço
                    <input
                      name="slug"
                      aria-label="Endereço"
                      required
                      maxLength={100}
                      pattern="[a-z0-9]+(-[a-z0-9]+)*"
                      placeholder="meu-tour"
                      defaultValue={editProject?.slug}
                    />
                    <small>/t/seu-endereco</small>
                  </label>
                  {!editProject && (
                    <label>
                      Cliente
                      <select
                        name="client_id"
                        aria-label="Cliente"
                        required
                        defaultValue=""
                      >
                        <option value="" disabled>
                          Selecione um cliente
                        </option>
                        {data?.clients
                          .filter((c) => c.active)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                      </select>
                    </label>
                  )}
                  {!data?.clients.length && !editProject && (
                    <p className="notice">
                      Cadastre um cliente primeiro.{" "}
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => setModal("client")}
                      >
                        Cadastrar cliente
                      </button>
                    </p>
                  )}
                </>
              )}
              <div className="modal-actions">
                <button type="button" onClick={() => setModal(null)}>
                  Cancelar
                </button>
                <button
                  className="primary"
                  disabled={
                    busy ||
                    (modal === "project" &&
                      !editProject &&
                      !data?.clients.length)
                  }
                >
                  {busy ? "Salvando…" : "Salvar"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </AdminShell>
  );
}
