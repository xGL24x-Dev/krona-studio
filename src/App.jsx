import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HOME_BY_ROLE, ensureReminder, getService, onUIEvent, saveBookingIntent, uid, useSalonState, useSession } from "./services/salonService.js";
import { AppContext, NotificationsDrawer, Toasts } from "./components/shared/ui.jsx";
// Vitrina pública
import { ErrorView, Footer, HelpView, Navbar } from "./components/storefront/StoreLayout.jsx";
import { ForgotPassword, Login, Register } from "./components/storefront/AuthViews.jsx";
import { Catalog, Home, ServiceDetail } from "./components/storefront/Showroom.jsx";
import { BookingWizard } from "./components/storefront/BookingWizard.jsx";
import { ClientArea } from "./components/storefront/ClientDashboard.jsx";
// Paneles operativos
import { EmployeePanel } from "./components/workspace/EmployeePanel.jsx";
import { AdminPanel } from "./components/workspace/AdminPanel.jsx";

/* Router por hash: funciona en GitHub Pages sin configuración de servidor. */
function parseHash() {
  const raw = window.location.hash.replace(/^#/, "") || "/";
  const [path, search = ""] = raw.split("?");
  const clean = path.length > 1 ? path.replace(/\/+$/, "") : "/";
  return { path: clean, query: Object.fromEntries(new URLSearchParams(search)), key: raw };
}

const CHROMELESS = ["/registro", "/login", "/recuperar", "/error"];
const NO_FOOTER = ["/reservar"];
const CLIENT_ROUTES = ["/cliente", "/cliente/citas", "/cliente/historial", "/cliente/favoritos", "/cliente/perfil"];
const EMPLOYEE_ROUTES = { "/empleada": "agenda", "/empleada/resenas": "resenas" };
const ADMIN_ROUTES = { "/admin": "agenda", "/admin/catalogo": "catalogo", "/admin/equipo": "equipo", "/admin/local": "local" };

export default function App() {
  const { brand } = useSalonState();
  const session = useSession();
  useEffect(() => {
    document.title = `${brand.name} — Reservas Inteligentes`;
  }, [brand.name]);
  const [route, setRoute] = useState(parseHash);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const scrollMode = useRef("top");

  const navigate = useCallback((to, opts = {}) => {
    scrollMode.current = opts.keepScroll ? "keep" : "top";
    if (opts.replace) window.history.replaceState(null, "", `#${to}`);
    else if (`#${to}` !== window.location.hash) window.location.hash = to;
    // Actualización síncrona: evita que una guarda de ruta vea el estado anterior
    // (p. ej. al cerrar sesión desde un panel protegido).
    setRoute(parseHash());
  }, []);

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // Foco y scroll en cada cambio de vista (WCAG 2.4.3).
  useEffect(() => {
    if (scrollMode.current === "top") window.scrollTo({ top: 0, behavior: "instant" });
    scrollMode.current = "top";
    setDrawerOpen(false);
    const raf = requestAnimationFrame(() => (document.querySelector("[data-page-title]") || document.getElementById("main") || document.getElementById("ws-main"))?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(raf);
  }, [route.path]);

  // Caída de red real → pantalla 503.
  useEffect(() => {
    const onOffline = () => navigate(`/error?from=${encodeURIComponent(parseHash().key)}`);
    window.addEventListener("offline", onOffline);
    return () => window.removeEventListener("offline", onOffline);
  }, [navigate]);

  const toast = useCallback((message, tone = "success") => {
    const id = uid("ts");
    setToasts((t) => [...t.slice(-2), { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);
  useEffect(() => onUIEvent((e) => e.type === "toast" && toast(e.message, e.tone)), [toast]);
  useEffect(() => ensureReminder(), [session]);

  const ctx = useMemo(
    () => ({ route, navigate, toast, drawerOpen, openDrawer: () => setDrawerOpen(true), closeDrawer: () => setDrawerOpen(false) }),
    [route, navigate, toast, drawerOpen],
  );

  /* ----------------------------- Guardas por rol ----------------------------- */
  const { path } = route;
  const isBooking = path === "/reservar";
  // /reservar exige cuenta de Cliente: cero reservas anónimas.
  const required = CLIENT_ROUTES.includes(path) || isBooking ? "client" : EMPLOYEE_ROUTES[path] ? "employee" : ADMIN_ROUTES[path] ? "owner" : null;
  const allowed = !required || session?.role === required;
  const handledKey = useRef(null);
  useEffect(() => {
    if (path === "/staff") return navigate("/admin", { replace: true });
    if (!required || allowed || handledKey.current === route.key) return;
    handledKey.current = route.key; // evita avisos duplicados (StrictMode)
    if (session && session.role !== required) {
      if (isBooking) toast("Las reservas web son exclusivas para cuentas de Cliente. Te llevamos a tu panel.", "info");
      navigate(HOME_BY_ROLE[session.role], { replace: true });
    } else if (isBooking) {
      // Visitante sin sesión: guardamos su selección y lo enviamos al login.
      saveBookingIntent(route.query);
      navigate("/login?role=client&motivo=reservar", { replace: true });
    } else navigate(`/login?role=${required}&next=${encodeURIComponent(route.key)}`, { replace: true });
  }, [path, required, allowed, session, navigate, route.key, route.query, isBooking, toast]);

  /* ----------------------------- Vistas ----------------------------- */
  let page = null;
  let layout = "store";
  if (!allowed) layout = "blank";
  else if (EMPLOYEE_ROUTES[path]) {
    layout = "workspace";
    page = <EmployeePanel section={EMPLOYEE_ROUTES[path]} />;
  } else if (ADMIN_ROUTES[path]) {
    layout = "workspace";
    page = <AdminPanel section={ADMIN_ROUTES[path]} />;
  } else if (path === "/") page = <Home />;
  else if (path === "/registro") page = <Register key={route.query.role} />;
  else if (path === "/login") page = <Login key={route.query.role} />;
  else if (path === "/recuperar") page = <ForgotPassword />;
  else if (path === "/servicios") page = <Catalog />;
  else if (path.startsWith("/servicios/") && getService(decodeURIComponent(path.split("/")[2]))) page = <ServiceDetail id={decodeURIComponent(path.split("/")[2])} />;
  else if (path === "/reservar") page = <BookingWizard key={route.key} />;
  else if (CLIENT_ROUTES.includes(path)) page = <ClientArea tab={path} />;
  else if (path === "/ayuda") page = <HelpView />;
  else if (path === "/error") page = <ErrorView code={503} />;
  else if (path === "/staff") layout = "blank";
  else layout = "404";

  return (
    <AppContext.Provider value={ctx}>
      {layout === "workspace" && page}
      {layout === "404" && <ErrorView code={404} />}
      {layout === "store" &&
        (CHROMELESS.includes(path) ? (
          page
        ) : (
          <>
            <a href="#main" className="skip-link sr-only-focusable" onClick={(e) => { e.preventDefault(); document.getElementById("main")?.focus(); }}>Saltar al contenido</a>
            <Navbar />
            <main id="main" tabIndex={-1} className="view-enter min-h-[60vh] outline-none" key={path}>{page}</main>
            {!NO_FOOTER.includes(path) && <Footer />}
          </>
        ))}
      <NotificationsDrawer />
      <Toasts toasts={toasts} />
    </AppContext.Provider>
  );
}
