import { useEffect, useState } from "react";
import { ExternalLink, LogOut, Menu, X } from "lucide-react";
import { BellButton, BrandMark, BrandName, Link, useApp } from "../shared/ui.jsx";
import { ROLES, firstName, initials, logout, useSalonState, useSession } from "../../services/salonService.js";

/**
 * Shell de los paneles internos (Dueña / Empleada). Interfaz independiente
 * de la vitrina pública: sidebar oscuro, fondo de trabajo y topbar propios.
 */
export function WorkspaceShell({ items, title, subtitle, actions, children }) {
  const { navigate, route } = useApp();
  const session = useSession();
  const { brand } = useSalonState();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [route.path]);

  return (
    <div className="ws-shell">
      <a href="#ws-main" className="skip-link sr-only-focusable" onClick={(e) => { e.preventDefault(); document.getElementById("ws-main")?.focus(); }}>
        Saltar al contenido
      </a>
      <aside id="ws-sidebar" className={`ws-side ${open ? "open" : ""}`} aria-label="Menú del panel">
        <div className="flex items-center justify-between gap-2 px-5 pb-6 pt-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <BrandMark size={36} dark />
            <div className="min-w-0">
              <p className="ws-brand truncate"><BrandName /></p>
              <p className="text-[11px] uppercase tracking-[0.14em] text-[#a1a1aa]">Workspace</p>
            </div>
          </div>
          <button type="button" className="ws-icon lg:hidden" onClick={() => setOpen(false)} aria-label="Cerrar menú"><X size={20} aria-hidden="true" /></button>
        </div>
        <nav className="flex flex-col gap-1 px-3" aria-label={`Panel de ${ROLES[session?.role] || ""}`}>
          {items.map(({ to, label, icon: Icon, badge }) => (
            <Link key={to} to={to} className="ws-link">
              <Icon size={18} aria-hidden="true" />
              <span className="flex-1">{label}</span>
              {badge ? <span className="ws-badge">{badge}</span> : null}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-1 border-t border-white/10 p-3">
          <a href="#/" className="ws-link" target="_blank" rel="noreferrer">
            <ExternalLink size={18} aria-hidden="true" /> <span className="flex-1">Ver tienda pública</span>
          </a>
          <div className="mt-2 flex items-center gap-3 px-3 py-2">
            <span className="avatar !h-9 !w-9 !bg-[#3f3f46] !text-white" aria-hidden="true">{initials(session?.name)}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-white">{session?.name}</p>
              <p className="truncate text-[11px] text-[#a1a1aa]">{ROLES[session?.role]}</p>
            </div>
            <button type="button" className="ws-icon" onClick={() => { navigate("/"); logout(); }} aria-label="Cerrar sesión" title="Cerrar sesión">
              <LogOut size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      </aside>
      {open && <div className="ws-scrim lg:hidden" onClick={() => setOpen(false)} aria-hidden="true" />}

      <div className="ws-main">
        <header className="ws-top">
          <button type="button" className="icon-btn lg:!hidden" onClick={() => setOpen(true)} aria-label="Abrir menú del panel" aria-expanded={open} aria-controls="ws-sidebar">
            <Menu size={22} aria-hidden="true" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold uppercase tracking-[0.12em] text-subtle">{brand.name} · {ROLES[session?.role]}</p>
            <p className="truncate text-[14px] text-muted">Hola, {firstName(session?.name)}</p>
          </div>
          <BellButton />
        </header>
        <main id="ws-main" tabIndex={-1} className="ws-content view-enter outline-none" key={route.path}>
          <div className="mb-8 flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
            <div>
              <h1 className="text-[clamp(26px,3vw,34px)] font-semibold tracking-[-0.035em]" tabIndex={-1} data-page-title>{title}</h1>
              {subtitle && <p className="mt-1.5 text-[14px] text-muted">{subtitle}</p>}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
