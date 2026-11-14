import { useCallback, useEffect, useId, useState } from "react";
import { AtSign, Calendar, Check, ChevronDown, LayoutDashboard, LogOut, Mail, MapPin, Menu, MessageCircle, RefreshCw, WifiOff, X } from "lucide-react";
import { Avatar, BellButton, Link, Logo, PageHeader, useApp } from "../shared/ui.jsx";
import { HOME_BY_ROLE, currentUser, firstName, formatHoursSummary, getBusinessProfile, getFaqs, logout, useSalonState, useSession } from "../../services/salonService.js";

/* ------------------------------------------------------------------ */
/* Navbar de la tienda                                                 */
/* ------------------------------------------------------------------ */
const SECTION_ID = "especialistas";

/**
 * Scroll-spy del Home: devuelve "especialistas" solo mientras esa sección
 * ocupa la franja central de la pantalla; en el resto del Home, "inicio".
 */
function useHomeSection(onHome) {
  const [section, setSection] = useState("inicio");
  useEffect(() => {
    if (!onHome) {
      setSection("inicio");
      return;
    }
    let observer;
    const raf = requestAnimationFrame(() => {
      const el = document.getElementById(SECTION_ID);
      if (!el) return;
      observer = new IntersectionObserver(([entry]) => setSection(entry.isIntersecting ? "especialistas" : "inicio"), { rootMargin: "-35% 0px -55% 0px" });
      observer.observe(el);
    });
    return () => {
      cancelAnimationFrame(raf);
      observer?.disconnect();
    };
  }, [onHome]);
  return [section, setSection];
}

export function Navbar() {
  const { navigate, route } = useApp();
  const session = useSession();
  useSalonState();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [route.key]);
  const close = () => setOpen(false);
  const staff = session && session.role !== "client";
  const onHome = route.path === "/";
  const [section, setSection] = useHomeSection(onHome);

  const goHome = () => {
    setSection("inicio");
    navigate("/", { keepScroll: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const goSpecialists = () => {
    setSection("especialistas");
    if (onHome) {
      navigate(`/?s=${SECTION_ID}`, { keepScroll: true, replace: true });
      document.getElementById(SECTION_ID)?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else navigate(`/?s=${SECTION_ID}`);
  };

  // Máximo 5 ítems (Ley de Hick), en orden fijo.
  const items = [
    { key: "inicio", to: "/", label: "Inicio", active: onHome && section !== "especialistas", onClick: goHome },
    { key: "servicios", to: "/servicios", label: "Servicios", active: route.path.startsWith("/servicios") },
    { key: "especialistas", to: `/?s=${SECTION_ID}`, label: "Especialistas", active: onHome && section === "especialistas", onClick: goSpecialists },
    { key: "reservar", to: "/reservar", label: "Reservar", active: route.path === "/reservar" },
    { key: "ayuda", to: "/ayuda", label: "Ayuda", active: route.path === "/ayuda" },
  ];

  return (
    <header className="top-nav">
      <div className="nav-inner">
        <Logo />
        <nav id="main-nav" className={open ? "nav-links open" : "nav-links"} aria-label="Navegación principal">
          {items.map((it) => (
            <a
              key={it.key}
              href={`#${it.to}`}
              aria-current={it.active ? "page" : undefined}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                e.preventDefault();
                close();
                if (it.onClick) it.onClick();
                else navigate(it.to);
              }}
            >
              {it.label}
            </a>
          ))}
          {session?.role === "client" && <Link to="/cliente" onClick={close} className="mobile-only">Mi cuenta</Link>}
          {!session && <Link to="/login" onClick={close} className="mobile-only">Iniciar sesión</Link>}
          {staff && <Link to={HOME_BY_ROLE[session.role]} onClick={close} className="mobile-only">Ir a mi panel</Link>}
          {session && (
            <button type="button" className="mobile-only" onClick={() => { close(); navigate("/"); logout(); }}>
              <LogOut size={17} aria-hidden="true" className="mr-2 inline align-[-3px]" /> Cerrar sesión
            </button>
          )}
        </nav>
        <div className="nav-actions">
          <BellButton />
          {staff ? (
            <button type="button" className="btn btn-dark hide-mobile" onClick={() => navigate(HOME_BY_ROLE[session.role])}>
              <LayoutDashboard size={17} aria-hidden="true" /> Mi panel
            </button>
          ) : session ? (
            <Link to="/cliente" className="flex items-center gap-2 rounded-full p-0.5 hover:bg-[#f0eee9] sm:py-1 sm:pl-1 sm:pr-3" aria-label={`Mi cuenta (${firstName(session.name)})`}>
              <Avatar person={{ name: session.name, photo: currentUser()?.photo }} size={36} />
              <span className="hidden text-[13px] font-semibold sm:inline">{firstName(session.name)}</span>
            </Link>
          ) : (
            <button type="button" className="btn btn-ghost hide-mobile" onClick={() => navigate("/login")}>
              Iniciar sesión
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={() => navigate("/reservar")}>
            Agendar cita
          </button>
          <button type="button" className="icon-btn mobile-menu" onClick={() => setOpen((o) => !o)} aria-label={open ? "Cerrar menú" : "Abrir menú"} aria-expanded={open} aria-controls="main-nav">
            {open ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
          </button>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Footer corporativo (datos de "Mi Local")                            */
/* ------------------------------------------------------------------ */
export function Footer() {
  const { navigate } = useApp();
  useSalonState();
  const biz = getBusinessProfile();
  return (
    <footer className="footer">
      <div className="footer-main">
        <div>
          <Logo light />
          <p>{biz.slogan}</p>
          {biz.instagramUrl && (
            <a href={biz.instagramUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2">
              <AtSign size={16} aria-hidden="true" /> {biz.instagram}
              <span className="sr-only"> (abre Instagram en una pestaña nueva)</span>
            </a>
          )}
        </div>
        <nav aria-label="Explorar">
          <div className="flex flex-col items-start gap-[10px] text-[13px] leading-[1.8]">
            <b>Explora</b>
            <Link to="/">Inicio</Link>
            <Link to="/servicios">Servicios y productos</Link>
            <Link to={`/?s=${SECTION_ID}`}>Especialistas</Link>
            <Link to="/reservar">Agendar cita</Link>
            <Link to="/ayuda">Ayuda / FAQ</Link>
          </div>
        </nav>
        <div>
          <b>Visítanos</b>
          <span>
            {biz.address}
            <br />
            {biz.city}
          </span>
          <span>
            {formatHoursSummary(biz).map(([d, h]) => (
              <span key={d} className="block">{d} · {h}</span>
            ))}
          </span>
        </div>
        <div>
          <b>Soporte</b>
          {biz.emailUrl && <a href={biz.emailUrl}>{biz.email}</a>}
          {biz.whatsappUrl && <a href={biz.whatsappUrl} target="_blank" rel="noreferrer">WhatsApp · {biz.phoneDisplay}</a>}
          <button type="button" className="footer-accent" onClick={() => navigate("/login?role=owner")}>
            Portal Staff / Admin
          </button>
          <button type="button" onClick={() => navigate("/login?role=employee")}>
            Acceso para empleadas
          </button>
          <button type="button" onClick={() => navigate("/error")}>
            Simular caída de red
          </button>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} {biz.name}{biz.nit ? ` · NIT ${biz.nit}` : ""}</span>
        <div>
          <Link to="/ayuda">Privacidad</Link>
          <Link to="/ayuda">Términos</Link>
          <Link to="/ayuda">Cancelaciones</Link>
        </div>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/* Ayuda / FAQ                                                         */
/* ------------------------------------------------------------------ */
export function HelpView() {
  const [openIndex, setOpenIndex] = useState(0); // la primera pregunta abierta por defecto
  const baseId = useId();
  useSalonState();
  const biz = getBusinessProfile();
  const faqs = getFaqs();
  return (
    <div className="container-x py-16 md:py-24">
      <PageHeader kicker="Centro de ayuda" title={<>¿Cómo podemos <em>ayudarte?</em></>}>
        Respuestas claras a las preguntas más frecuentes. Si necesitas algo más, nuestro equipo responde en minutos.
      </PageHeader>
      <div className="grid gap-12 lg:grid-cols-[1fr_340px]">
        <div className="border-t border-line">
          {faqs.map((f, i) => {
            const expanded = openIndex === i;
            return (
              <div key={f.q} className="acc-item">
                <h2>
                  <button type="button" className="acc-trigger" aria-expanded={expanded} aria-controls={`${baseId}-p${i}`} id={`${baseId}-t${i}`} onClick={() => setOpenIndex(expanded ? -1 : i)}>
                    {f.q}
                    <ChevronDown size={20} aria-hidden="true" />
                  </button>
                </h2>
                <div className="disclosure" data-open={expanded}>
                  <div id={`${baseId}-p${i}`} role="region" aria-labelledby={`${baseId}-t${i}`} inert={!expanded ? true : undefined}>
                    <div className="acc-panel">
                      <p>{f.a}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <aside className="panel panel-pad h-fit" aria-labelledby={`${baseId}-contact`}>
          <h2 id={`${baseId}-contact`} className="text-[20px] font-semibold tracking-tight">¿Sigues con dudas?</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-muted">Escríbenos y te respondemos en minutos dentro del horario de atención.</p>
          <ul className="mt-4 flex flex-col gap-1.5 text-[13px] text-muted">
            {formatHoursSummary(biz).map(([d, h]) => <li key={d}>{d} · {h}</li>)}
            <li className="mt-1 flex items-start gap-1.5"><MapPin size={14} className="mt-0.5 flex-none" aria-hidden="true" /> {biz.fullAddress}</li>
          </ul>
          <div className="mt-6 flex flex-col gap-3">
            {biz.whatsappUrl && (
              <a className="btn btn-primary btn-full" href={biz.whatsappUrl} target="_blank" rel="noreferrer">
                <MessageCircle size={18} aria-hidden="true" /> WhatsApp {biz.phoneDisplay}
                <span className="sr-only"> (abre WhatsApp en una pestaña nueva)</span>
              </a>
            )}
            {biz.emailUrl && (
              <a className="btn btn-secondary btn-full" href={biz.emailUrl}>
                <Mail size={18} aria-hidden="true" /> {biz.email}
              </a>
            )}
          </div>
          <p className="mt-5 border-t border-line pt-4 text-[12px] leading-relaxed text-muted">
            <b className="text-ink">Política de cancelación:</b> {biz.cancellationPolicy}.
          </p>
        </aside>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Error 503 / 404                                                     */
/* ------------------------------------------------------------------ */
export function ErrorView({ code = 503 }) {
  const { navigate, route } = useApp();
  useSalonState();
  const [retrying, setRetrying] = useState(false);
  const [failed, setFailed] = useState(false);
  const is404 = code === 404;

  const retry = useCallback(() => {
    setRetrying(true);
    setFailed(false);
    window.setTimeout(() => {
      setRetrying(false);
      if (navigator.onLine === false) return setFailed(true);
      navigate(route.query.from || "/");
    }, 1200);
  }, [navigate, route.query.from]);

  return (
    <div className="error-page">
      <div className="error-top">
        <Logo />
        <span>
          Estado del servicio <i aria-hidden="true" /> Protegido
        </span>
      </div>
      <main id="main" tabIndex={-1} className="error-content view-enter">
        <div className="error-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="wifi-disc">
            {is404 ? <span className="!static !h-auto !w-auto !border-0 !bg-transparent font-display text-[34px] font-semibold text-copper-dark">404</span> : <WifiOff size={48} />}
            {!is404 && <span />}
          </div>
          <div className="floating-card card-one">
            <Calendar size={20} />
          </div>
          <div className="floating-card card-two">
            <Check size={20} />
          </div>
        </div>
        <span className="error-code">{is404 ? "ERROR 404 · PÁGINA NO ENCONTRADA" : "ERROR 503 · CONEXIÓN INTERRUMPIDA"}</span>
        <h1 tabIndex={-1} data-page-title>{is404 ? "Este espacio no existe." : "Un pequeño respiro."}</h1>
        <p>
          {is404 ? (
            <>La página que buscas fue movida o ya no está disponible. <strong>Tus citas y preferencias siguen intactas.</strong></>
          ) : (
            <>Estamos experimentando alta demanda o tu conexión se interrumpió. No te preocupes: <strong>tus datos de reserva están guardados localmente.</strong></>
          )}
        </p>
        <div className="saved-note">
          <span aria-hidden="true">
            <Check size={16} />
          </span>
          <div>
            <b>Tu progreso está seguro</b>
            <small>Retomaremos exactamente donde estabas.</small>
          </div>
        </div>
        {failed && (
          <p role="alert" className="notice notice-error mt-5 w-full max-w-[390px] text-left">
            Seguimos sin conexión. Verifica tu red e inténtalo de nuevo.
          </p>
        )}
        <button type="button" className="btn btn-primary retry-btn" onClick={is404 ? () => navigate("/") : retry} disabled={retrying} aria-busy={retrying}>
          <RefreshCw size={19} aria-hidden="true" className={retrying ? "spin" : ""} />
          {is404 ? "Ir al inicio" : retrying ? "Conectando…" : "Reintentar conexión"}
        </button>
        <button type="button" className="back-link" onClick={() => navigate(is404 ? "/servicios" : "/")}>
          {is404 ? "Explorar servicios" : "Volver al inicio"}
        </button>
      </main>
      <footer className="error-footer">
        <span>¿Necesitas ayuda inmediata?</span>
        <a href={getBusinessProfile().emailUrl || "#/ayuda"}>Contactar soporte</a>
      </footer>
    </div>
  );
}
