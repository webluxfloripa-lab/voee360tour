import { Link, useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  Users,
  Scan,
  History,
  LogOut,
  Menu,
  X,
  ArrowUpRight,
} from "lucide-react";
import { Brand } from "./Brand";
import { supabase } from "../lib/supabase";
export function AdminShell({
  children,
  section = "overview",
}: {
  children: ReactNode;
  section?: string;
}) {
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const links = [
    {
      to: "/admin",
      label: "Visão geral",
      icon: LayoutDashboard,
      id: "overview",
    },
    { to: "/admin/clientes", label: "Clientes", icon: Users, id: "clients" },
    {
      to: "/admin/projetos",
      label: "Projetos e tours",
      icon: Scan,
      id: "projects",
    },
    {
      to: "/admin/historico",
      label: "Atividades",
      icon: History,
      id: "history",
    },
  ] as const;
  return (
    <div className="app-layout">
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="sidebar-brand">
          <Link to="/admin">
            <Brand />
          </Link>
          <button
            className="icon-button mobile-only"
            aria-label="Fechar navegação"
            onClick={() => setOpen(false)}
          >
            <X />
          </button>
        </div>
        <div className="workspace-pill">
          <span className="workspace-avatar">V</span>
          <div>
            Workspace principal<small>Voee Certificada Google</small>
          </div>
          <span className="tiny-tag">V1</span>
        </div>
        <p className="nav-heading">GERENCIAMENTO</p>
        <nav aria-label="Navegação principal">
          {links.map((l) => (
            <Link
              key={l.id}
              to={l.to}
              className={section === l.id ? "nav-item active" : "nav-item"}
              onClick={() => setOpen(false)}
            >
              <l.icon size={19} />
              {l.label}
              {section === l.id && <span className="active-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="workspace-tip">
            <span className="tiny-orbit">360°</span>
            <h3>Um novo ponto de vista.</h3>
            <p>Seu próximo tour começa com uma boa perspectiva.</p>
            <Link to="/admin/projetos">
              Criar experiência <ArrowUpRight size={15} />
            </Link>
          </div>
          <div className="profile-row">
            <span className="avatar">D</span>
            <div>
              Superadministradora<small>Acesso exclusivo</small>
            </div>
            <button
              className="icon-button"
              aria-label="Sair do painel"
              onClick={async () => {
                await supabase.auth.signOut({ scope: "local" });
                await nav({ to: "/login" });
              }}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
      {open && (
        <button
          className="sidebar-backdrop"
          aria-label="Fechar menu"
          onClick={() => setOpen(false)}
        />
      )}
      <div className="workspace-main">
        <header className="topbar">
          <button
            className="icon-button mobile-only"
            aria-label="Abrir navegação"
            onClick={() => setOpen(true)}
          >
            <Menu />
          </button>
          <span className="breadcrumb">
            Workspace <span>/</span>{" "}
            <strong>
              {links.find((l) => l.id === section)?.label || "Editor do tour"}
            </strong>
          </span>
          <div className="topbar-right">
            <span className="environment">
              <span />
              Preview interno
            </span>
            <span className="avatar small">D</span>
          </div>
        </header>
        {children}
        <footer className="app-footer">
          <span>voee360tour</span>
          <span>Feito para explorar novas possibilidades.</span>
        </footer>
      </div>
    </div>
  );
}
