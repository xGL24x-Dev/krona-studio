/* Portal del Cliente — Member Hub (/cliente, /cliente/historial, /cliente/favoritos, /cliente/perfil). */
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, ArrowRight, Calendar, CalendarDays, Camera, Clock, CreditCard, Crown, Heart, History, LogOut, Mail, MessageCircle, Plus, QrCode,
  Receipt, Repeat, Search, ShoppingBag, Sparkles, Star, Trash2, UserRound, Wallet, X,
} from "lucide-react";
import { Avatar, BrandMark, BrandName, ConfirmDialog, EmptyState, Field, Link, Modal, RatingInline, SmartImage, StatusBadge, Switch, WhatsAppButton, useApp, useSkeleton } from "../shared/ui.jsx";
import { PseudoQR } from "./BookingWizard.jsx";
import {
  IMAGE_PRESETS, addReview, appointmentEnd, appointmentStart, buildBrandWhatsAppUrl, cancelAppointment, changeWindow, compressImage, currentUser,
  firstName, formatCOP, formatDateLong, formatDateShort, formatDuration, getClientHistory, getClientStats, getService, getServiceName, getStylist,
  getStylistName, getStylistStats, logout, toggleFavorite, updateProfile, useSalonState, useSession, validators,
} from "../../services/salonService.js";

const TABS = [
  { to: "/cliente", label: "Mis citas activas", short: "Citas", icon: CalendarDays },
  { to: "/cliente/historial", label: "Historial de servicios y compras", short: "Historial", icon: History },
  { to: "/cliente/favoritos", label: "Favoritos y especialistas", short: "Favoritos", icon: Heart },
  { to: "/cliente/perfil", label: "Mi perfil, preferencias y pagos", short: "Perfil", icon: UserRound },
];
const TAB_ALIASES = { "/cliente/citas": "/cliente" };
const displayCode = (code) => `#${code}`;

/* ================================================================== */
/* Contenedor                                                          */
/* ================================================================== */
export function ClientArea({ tab: rawTab }) {
  const tab = TAB_ALIASES[rawTab] || rawTab;
  const session = useSession();
  const { navigate, route } = useApp();
  const salon = useSalonState();
  const [reviewing, setReviewing] = useState(null);

  // Enlace directo de evaluación (?calificar=<id>) desde la notificación o WhatsApp.
  useEffect(() => {
    const id = route.query.calificar;
    if (!id) return;
    const a = salon.appointments.find((x) => x.id === id && x.clientId === session?.userId);
    if (a && a.status === "completada" && !a.reviewed) setReviewing(a);
    navigate(route.path, { replace: true, keepScroll: true });
  }, [route.query.calificar]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!session) return null;
  const user = currentUser();
  const stats = getClientStats(session.userId);

  return (
    <div className="container-x py-10 md:py-14">
      <HubHeader user={user} session={session} stats={stats} />

      <dl className="mt-8 grid gap-3 sm:grid-cols-3">
        <div className="hub-kpi">
          <dt><CalendarDays size={16} className="text-copper-dark" aria-hidden="true" /> Próxima cita</dt>
          <dd className="!text-[20px]">{stats.next ? `${formatDateShort(stats.next.date)} · ${stats.next.time}` : "Sin citas"}</dd>
          <p className="mt-1 truncate text-[12px] text-muted">{stats.next ? `${getServiceName(stats.next)} con ${firstName(getStylistName(stats.next))}` : "Agenda tu próxima experiencia"}</p>
        </div>
        <div className="hub-kpi">
          <dt><Sparkles size={16} className="text-copper-dark" aria-hidden="true" /> Servicios realizados</dt>
          <dd>{stats.servicesDone}</dd>
          <p className="mt-1 text-[12px] text-muted">Citas completadas</p>
        </div>
        <div className="hub-kpi">
          <dt><Wallet size={16} className="text-copper-dark" aria-hidden="true" /> Total invertido</dt>
          <dd>{formatCOP(stats.totalInvested).replace(" COP", "")}</dd>
          <p className="mt-1 text-[12px] text-muted">COP · servicios y productos</p>
        </div>
      </dl>

      <nav className="tabs mb-8 mt-10" aria-label="Secciones de mi cuenta">
        {TABS.map(({ to, label, short, icon: Icon }) => (
          <Link key={to} to={to} className="tab flex items-center gap-2" aria-current={tab === to ? "page" : undefined}>
            <Icon size={16} aria-hidden="true" />
            <span className="hidden lg:inline">{label}</span>
            <span className="lg:hidden">{short}</span>
          </Link>
        ))}
      </nav>

      <div className="view-enter" key={tab}>
        {tab === "/cliente" && <ActiveTab stats={stats} onReview={setReviewing} />}
        {tab === "/cliente/historial" && <HistoryTab onReview={setReviewing} />}
        {tab === "/cliente/favoritos" && <FavoritesTab />}
        {tab === "/cliente/perfil" && <ProfileTab />}
      </div>
      <ReviewModal appointment={reviewing} onClose={() => setReviewing(null)} />
    </div>
  );
}

/* ------------------------------ Cabecera ------------------------------ */
function HubHeader({ user, session, stats }) {
  const { navigate, toast } = useApp();
  const [busy, setBusy] = useState(false);
  const inputId = useId();
  const person = { name: session.name, photo: user?.photo };

  const onFile = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const photo = await compressImage(file, IMAGE_PRESETS.avatar);
      const res = updateProfile({ photo });
      toast(res.error || "Foto de perfil actualizada", res.error ? "error" : "success");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <header className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
      <div className="flex min-w-0 items-center gap-4">
        <div className="avatar-upload">
          <Avatar person={person} size={72} className={busy ? "opacity-50" : ""} />
          <label htmlFor={inputId} title="Cambiar foto de perfil">
            <Camera size={15} aria-hidden="true" />
            <span className="sr-only">Subir o cambiar foto de perfil</span>
          </label>
          <input id={inputId} type="file" accept="image/*" className="sr-only" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
        </div>
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fbf3ec] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-copper-dark">
            <Crown size={12} aria-hidden="true" /> {stats.tier}
          </span>
          <h1 className="mt-1.5 truncate font-display text-[clamp(26px,3.2vw,36px)] font-semibold tracking-[-0.035em]" tabIndex={-1} data-page-title>
            {session.name}
          </h1>
          {user?.email && <p className="truncate text-[14px] text-muted">{user.email}</p>}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" onClick={() => navigate("/reservar")}>
          <Plus size={18} aria-hidden="true" /> Nueva reserva
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => { navigate("/"); logout(); }}>
          <LogOut size={18} aria-hidden="true" /> Cerrar sesión
        </button>
      </div>
    </header>
  );
}

/* ================================================================== */
/* Pestaña 1 · Mis citas activas                                       */
/* ================================================================== */
function Countdown({ to }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const diff = Math.max(0, to - now);
  const parts = [[Math.floor(diff / 864e5), "días"], [Math.floor((diff / 36e5) % 24), "horas"], [Math.floor((diff / 6e4) % 60), "min"], [Math.floor((diff / 1e3) % 60), "seg"]];
  return (
    <div className="flex gap-2" role="timer" aria-label={`Faltan ${parts[0][0]} días, ${parts[1][0]} horas y ${parts[2][0]} minutos`}>
      {parts.map(([v, l]) => (
        <div key={l} className="min-w-[58px] rounded-xl bg-white/10 px-2.5 py-2.5 text-center" aria-hidden="true">
          <span className="block font-display text-[24px] font-semibold tabular-nums leading-none">{String(v).padStart(2, "0")}</span>
          <span className="mt-1 block text-[11px] uppercase tracking-[0.1em] text-[#d4d4d8]">{l}</span>
        </div>
      ))}
    </div>
  );
}

function ActiveTab({ stats, onReview }) {
  const { navigate } = useApp();
  const { appointments } = useSalonState();
  const session = useSession();
  const [qrFor, setQrFor] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const upcoming = appointments
    .filter((a) => a.clientId === session.userId && ["confirmada", "en-atencion"].includes(a.status) && appointmentEnd(a) > new Date())
    .sort((a, b) => appointmentStart(a) - appointmentStart(b));
  const [next, ...rest] = upcoming;

  return (
    <div className="grid gap-8">
      {stats.pendingReviews.length > 0 && (
        <section className="panel rounded-2xl border-l-4 !border-l-copper p-5" aria-labelledby="pending-title">
          <h2 id="pending-title" className="flex items-center gap-2 text-[16px] font-semibold">
            <Star size={18} className="text-copper" fill="currentColor" aria-hidden="true" />
            {stats.pendingReviews.length === 1 ? "Tienes 1 servicio por calificar" : `Tienes ${stats.pendingReviews.length} servicios por calificar`}
          </h2>
          <ul className="mt-3 flex flex-col gap-2.5">
            {stats.pendingReviews.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3">
                <Avatar person={getStylist(a.stylistId) || { name: a.stylistName }} size={36} />
                <span className="min-w-0 flex-1 text-[14px]"><b>{getServiceName(a)}</b> · {formatDateShort(a.date)} con {getStylistName(a)}</span>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => onReview(a)}>
                  <Star size={15} aria-hidden="true" /> Calificar a {firstName(getStylistName(a))}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {next ? (
        <FeaturedAppointment a={next} onQr={() => setQrFor(next)} onCancel={() => setCancelling(next)} />
      ) : (
        <EmptyState icon={CalendarDays} title="No tienes citas activas" text="Reserva en menos de 30 segundos con tu especialista favorita."
          action={<button type="button" className="btn btn-primary" onClick={() => navigate("/reservar")}>Agendar ahora <ArrowRight size={18} aria-hidden="true" /></button>} />
      )}

      {rest.length > 0 && (
        <section aria-labelledby="more-title">
          <h2 id="more-title" className="mb-4 text-[20px] font-semibold tracking-tight">Otras citas programadas</h2>
          <ul className="flex flex-col gap-3">
            {rest.map((a) => {
              const w = changeWindow(a);
              return (
                <li key={a.id} className="panel grid gap-3 rounded-2xl p-5 md:grid-cols-[110px_1fr_auto] md:items-center">
                  <div>
                    <p className="font-display text-[22px] font-semibold leading-none">{a.time}</p>
                    <p className="mt-1 text-[13px] text-muted">{formatDateShort(a.date)}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold">{getServiceName(a)}</p>
                    <p className="text-[13px] text-muted">{getStylistName(a)} · {formatDuration(a.duration)} · {formatCOP(a.price)} · {displayCode(a.code)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setQrFor(a)}><QrCode size={15} aria-hidden="true" /> QR</button>
                    <button type="button" className="btn btn-secondary btn-sm" disabled={!w.allowed} onClick={() => navigate(`/reservar?reprogramar=${a.id}`)}><Repeat size={15} aria-hidden="true" /> Reagendar</button>
                    <button type="button" className="btn btn-ghost btn-sm !text-error" disabled={!w.allowed} onClick={() => setCancelling(a)}><X size={15} aria-hidden="true" /> Cancelar</button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <QrModal appointment={qrFor} onClose={() => setQrFor(null)} />
      <CancelModal appointment={cancelling} onClose={() => setCancelling(null)} />
    </div>
  );
}

function FeaturedAppointment({ a, onQr, onCancel }) {
  const { navigate } = useApp();
  const stylist = getStylist(a.stylistId) || { name: a.stylistName };
  const w = changeWindow(a);
  const wa = buildBrandWhatsAppUrl(`Hola, tengo una consulta sobre mi cita ${displayCode(a.code)}: ${getServiceName(a)} el ${formatDateLong(a.date)} a las ${a.time} con ${stylist.name}.`);
  const inService = a.status === "en-atencion";
  return (
    <section aria-labelledby="next-title" className="relative overflow-hidden rounded-2xl bg-[#24221f] p-6 text-white md:p-9">
      <div className="pointer-events-none absolute inset-0 opacity-15 [background:radial-gradient(circle_at_85%_20%,#c27d48,transparent_40%)]" aria-hidden="true" />
      <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="min-w-0">
          <span className="kicker !text-[#e3a879]">{inService ? "En atención ahora" : "Tu próxima cita"}</span>
          <h2 id="next-title" className="mt-3 text-[clamp(24px,3vw,34px)] font-semibold tracking-[-0.035em]">{getServiceName(a)}</h2>
          <div className="mt-4 flex items-center gap-3">
            <Avatar person={stylist} size={48} />
            <div>
              <p className="text-[15px] font-semibold">{stylist.name}</p>
              <p className="text-[13px] text-[#d4d4d8]">{stylist.specialty || "Especialista"}</p>
            </div>
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-[14px] sm:grid-cols-4">
            <div><dt className="text-[11px] uppercase tracking-[0.1em] text-[#a1a1aa]">Fecha</dt><dd className="mt-0.5 flex items-center gap-1.5"><Calendar size={14} aria-hidden="true" /> {formatDateShort(a.date)}</dd></div>
            <div><dt className="text-[11px] uppercase tracking-[0.1em] text-[#a1a1aa]">Hora · duración</dt><dd className="mt-0.5 flex items-center gap-1.5"><Clock size={14} aria-hidden="true" /> {a.time} · {formatDuration(a.duration)}</dd></div>
            <div><dt className="text-[11px] uppercase tracking-[0.1em] text-[#a1a1aa]">Valor</dt><dd className="mt-0.5 font-semibold">{formatCOP(a.price)}</dd></div>
            <div><dt className="text-[11px] uppercase tracking-[0.1em] text-[#a1a1aa]">Código</dt><dd className="mt-0.5 font-semibold">{displayCode(a.code)}</dd></div>
          </dl>
          <div className="mt-6 flex flex-wrap gap-2">
            <button type="button" className="btn !bg-white !text-ink hover:!bg-[#f0eee9]" onClick={onQr}><QrCode size={17} aria-hidden="true" /> Ver comprobante QR</button>
            <WhatsAppButton href={wa} className="btn wa-solid">Consultar por WhatsApp</WhatsAppButton>
            {!inService && (
              <>
                <button type="button" className="btn border-white/30 text-white hover:bg-white/10" disabled={!w.allowed} onClick={() => navigate(`/reservar?reprogramar=${a.id}`)}><Repeat size={17} aria-hidden="true" /> Reagendar</button>
                <button type="button" className="btn border-white/30 text-white hover:bg-white/10" disabled={!w.allowed} onClick={onCancel}>Cancelar cita</button>
              </>
            )}
          </div>
          {!inService && !w.allowed && (
            <p className="mt-3 text-[13px] text-[#f3d6b3]" role="note">Faltan menos de {w.limit} {w.limit === 1 ? "hora" : "horas"}: para cambios de último momento escríbenos por WhatsApp.</p>
          )}
        </div>
        <Countdown to={appointmentStart(a).getTime()} />
      </div>
    </section>
  );
}

/* Comprobante QR de una cita activa */
function QrModal({ appointment: a, onClose }) {
  const { brand } = useSalonState();
  if (!a) return null;
  return (
    <Modal open onClose={onClose} title="Comprobante de reserva" description="Preséntalo al llegar al salón.">
      <div className="mb-4 flex items-center gap-3 border-b border-line pb-4">
        <BrandMark size={36} />
        <div className="logo !min-h-0 !text-[14px]"><BrandName /></div>
        {brand.nit && <span className="ml-auto text-[12px] text-muted">NIT {brand.nit}</span>}
      </div>
      <div className="flex flex-col items-center text-center">
        <PseudoQR value={a.code} />
        <p className="mt-3 font-display text-[26px] font-semibold tracking-[0.02em]">{displayCode(a.code)}</p>
        <p className="mt-1 text-[14px] text-muted">{getServiceName(a)} · {formatDateLong(a.date)} · {a.time}</p>
        <p className="text-[14px] text-muted">con {getStylistName(a)} · {formatCOP(a.price)}</p>
      </div>
      <button type="button" className="btn btn-primary btn-full mt-6" onClick={onClose} data-autofocus>Listo</button>
    </Modal>
  );
}

/* ================================================================== */
/* Pestaña 2 · Historial de servicios y compras                        */
/* ================================================================== */
const FILTERS = [["todos", "Todos"], ["completados", "Completados"], ["cancelados", "Cancelados"]];
const normalize = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function HistoryTab({ onReview }) {
  const { navigate } = useApp();
  const salon = useSalonState();
  const session = useSession();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("todos");
  const [receipt, setReceipt] = useState(null);
  const loading = useSkeleton([query, filter]);
  const searchId = useId();

  const history = useMemo(() => getClientHistory(session.userId), [salon, session]); // eslint-disable-line react-hooks/exhaustive-deps
  const rows = history.filter((h) => {
    const okFilter = filter === "todos" || (filter === "completados" ? h.status === "completada" : ["cancelada", "no-asistio"].includes(h.status));
    const q = normalize(query.trim());
    return okFilter && (!q || normalize(`${h.name} ${h.stylistName} ${h.category} ${h.code}`).includes(q));
  });

  const rebook = (h) => navigate(`/reservar?service=${h.serviceId}${getStylist(h.stylistId)?.active ? `&stylist=${h.stylistId}` : ""}`);
  const reorderUrl = (h) => buildBrandWhatsAppUrl(`Hola, quiero pedir de nuevo el producto “${h.name}” (${formatCOP(h.price)}). Mi última compra fue ${displayCode(h.code)}.`);

  const statusCell = (h) =>
    h.kind === "compra" ? (
      <span className="status tone-ink"><ShoppingBag size={12} aria-hidden="true" /> Compra</span>
    ) : h.status !== "completada" ? (
      <StatusBadge status={h.status} />
    ) : h.rating ? (
      <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-copper-dark" aria-label={`Calificado con ${h.rating} de 5`}>
        <Star size={14} fill="currentColor" aria-hidden="true" /> {h.rating.toFixed(1)}
      </span>
    ) : (
      <button type="button" className="btn btn-primary btn-sm" onClick={() => onReview(h.ref)}><Star size={14} aria-hidden="true" /> Calificar</button>
    );

  const actions = (h) => (
    <div className="flex flex-wrap gap-1.5 md:justify-end">
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setReceipt(h)} aria-label={`Ver recibo ${displayCode(h.code)}`}><Receipt size={15} aria-hidden="true" /> Ver recibo</button>
      {h.kind === "servicio" ? (
        <button type="button" className="btn btn-secondary btn-sm" disabled={!h.bookable} onClick={() => rebook(h)} aria-label={`Volver a agendar ${h.name}`}><Repeat size={15} aria-hidden="true" /> Volver a agendar</button>
      ) : (
        <WhatsAppButton href={reorderUrl(h)} className="btn btn-secondary btn-sm">Pedir de nuevo</WhatsAppButton>
      )}
    </div>
  );

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="search flex-1">
          <Search size={18} aria-hidden="true" />
          <label htmlFor={searchId} className="sr-only">Buscar por servicio, producto o especialista</label>
          <input id={searchId} type="search" placeholder="Buscar por servicio o especialista…" value={query} onChange={(e) => setQuery(e.target.value)} className="!rounded-xl" />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar historial">
          {FILTERS.map(([k, l]) => (
            <button key={k} type="button" className="pill" aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
      </div>
      <p className="mb-3 text-[13px] text-muted" aria-live="polite">{loading ? "Actualizando…" : `${rows.length} ${rows.length === 1 ? "registro" : "registros"}`}</p>

      {loading ? (
        <div className="flex flex-col gap-2" aria-hidden="true">{Array.from({ length: 4 }, (_, i) => <div key={i} className="shimmer h-16 rounded-xl" />)}</div>
      ) : rows.length === 0 ? (
        <EmptyState icon={History} title="Sin registros" text="No encontramos servicios o compras con esos filtros." />
      ) : (
        <>
          {/* Escritorio: tabla editorial */}
          <div className="hidden overflow-hidden rounded-2xl border border-line bg-white md:block">
            <table className="hub-table">
              <caption className="sr-only">Historial de servicios y compras</caption>
              <thead>
                <tr><th scope="col">Fecha y hora</th><th scope="col">Servicio / Producto</th><th scope="col">Encargado</th><th scope="col">Duración</th><th scope="col">Valor</th><th scope="col">Estado</th><th scope="col"><span className="sr-only">Acciones</span></th></tr>
              </thead>
              <tbody>
                {rows.map((h) => {
                  const st = getStylist(h.stylistId);
                  return (
                    <tr key={h.id}>
                      <td className="whitespace-nowrap"><b className="block">{formatDateShort(h.date)}</b><span className="text-[12px] text-muted">{h.time}</span></td>
                      <td>
                        <div className="flex items-center gap-3">
                          <span className="h-11 w-11 flex-none overflow-hidden rounded-lg bg-sand"><SmartImage src={h.image} alt="" className="h-full w-full object-cover" /></span>
                          <div className="min-w-0">
                            <p className="font-semibold">{h.name}</p>
                            <p className="text-[12px] text-muted">{h.kind === "compra" ? "Producto" : "Servicio"} · {h.category} · {displayCode(h.code)}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <Avatar person={st || { name: h.stylistName }} size={30} />
                          <div className="min-w-0"><p className="text-[13px] font-semibold">{h.stylistName}</p><p className="text-[12px] text-muted">{st?.specialty || "Especialista"}</p></div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap">{h.duration ? `${h.duration} min` : "—"}</td>
                      <td className="whitespace-nowrap font-semibold">{formatCOP(h.price)}</td>
                      <td>{statusCell(h)}</td>
                      <td>{actions(h)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Móvil: tarjetas */}
          <ul className="flex flex-col gap-3 md:hidden">
            {rows.map((h) => (
              <li key={h.id} className="panel rounded-2xl p-4">
                <div className="flex gap-3">
                  <span className="h-14 w-14 flex-none overflow-hidden rounded-lg bg-sand"><SmartImage src={h.image} alt="" className="h-full w-full object-cover" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{h.name}</p>
                    <p className="text-[12px] text-muted">{h.kind === "compra" ? "Producto" : "Servicio"} · {h.category} · {displayCode(h.code)}</p>
                    <p className="mt-1 text-[13px]">{formatDateShort(h.date)} · {h.time}</p>
                  </div>
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 border-y border-line py-3 text-[13px]">
                  <div><dt className="text-[11px] uppercase tracking-[0.08em] text-subtle">Encargado</dt><dd className="mt-0.5 truncate font-semibold">{firstName(h.stylistName)}</dd></div>
                  <div><dt className="text-[11px] uppercase tracking-[0.08em] text-subtle">Duración</dt><dd className="mt-0.5">{h.duration ? `${h.duration} min` : "—"}</dd></div>
                  <div><dt className="text-[11px] uppercase tracking-[0.08em] text-subtle">Valor</dt><dd className="mt-0.5 font-semibold">{formatCOP(h.price).replace(" COP", "")}</dd></div>
                </dl>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  {statusCell(h)}
                  {actions(h)}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      <ReceiptModal item={receipt} onClose={() => setReceipt(null)} />
    </div>
  );
}

function ReceiptModal({ item: h, onClose }) {
  const { brand } = useSalonState();
  const user = currentUser();
  if (!h) return null;
  const st = getStylist(h.stylistId);
  const card = user?.payments?.find((p) => p.default);
  const payment = h.paymentMethod || (h.status === "completada" ? (card ? `${card.brand} •••• ${card.last4}` : "Pago en el salón") : "No aplica");
  const rows = [
    ["Fecha y hora", `${formatDateLong(h.date)} · ${h.time}`],
    [h.kind === "compra" ? "Producto" : "Servicio", `${h.name}${h.qty > 1 ? ` × ${h.qty}` : ""}`],
    ["Categoría", h.category],
    ["Encargado", `${h.stylistName}${st?.specialty ? ` · ${st.specialty}` : ""}`],
    ...(h.kind === "servicio" ? [["Duración", `${h.duration} min`]] : []),
    ["Estado", h.kind === "compra" ? "Compra entregada" : h.status === "completada" ? "Completada" : h.status === "cancelada" ? `Cancelada${h.cancelReason ? ` · ${h.cancelReason}` : ""}` : "No asistió"],
    ...(h.rating ? [["Tu calificación", `★ ${h.rating.toFixed(1)}`]] : []),
    ["Método de pago", payment],
  ];
  return (
    <Modal open onClose={onClose} title="Recibo" description={`${displayCode(h.code)} · ${brand.name}`}>
      <div className="mb-4 flex items-center gap-3 border-b border-line pb-4">
        <BrandMark size={36} />
        <div className="min-w-0">
          <div className="logo !min-h-0 !text-[14px]"><BrandName /></div>
          <p className="text-[12px] text-muted">{brand.nit ? `NIT ${brand.nit} · ` : ""}{brand.address}, {brand.city}</p>
        </div>
      </div>
      <dl className="divide-y divide-line text-[14px]">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 py-2.5"><dt className="text-muted">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
        ))}
      </dl>
      <div className="mt-3 flex items-center justify-between border-t-2 border-ink pt-3">
        <span className="font-display text-[15px] font-semibold">Total {h.status === "cancelada" ? "(no cobrado)" : "pagado"}</span>
        <span className="font-display text-[22px] font-semibold">{formatCOP(h.status === "cancelada" ? 0 : h.price)}</span>
      </div>
      <button type="button" className="btn btn-secondary btn-full mt-6" onClick={onClose} data-autofocus>Cerrar</button>
    </Modal>
  );
}

/* ================================================================== */
/* Pestaña 3 · Favoritos y especialistas                               */
/* ================================================================== */
function FavoritesTab() {
  const { navigate } = useApp();
  const salon = useSalonState();
  const session = useSession();
  const user = currentUser();
  const history = useMemo(() => getClientHistory(session.userId), [salon, session]); // eslint-disable-line react-hooks/exhaustive-deps
  const favorites = (user?.favorites || []).map(getService).filter((s) => s?.active);

  const specialists = useMemo(() => {
    const map = new Map();
    history.filter((h) => h.kind === "servicio" && h.status === "completada").forEach((h) => {
      const cur = map.get(h.stylistId) || { stylistId: h.stylistId, name: h.stylistName, visits: 0, last: h, lastServiceId: h.serviceId };
      cur.visits += 1;
      map.set(h.stylistId, cur);
    });
    return [...map.values()];
  }, [history]);

  return (
    <div className="grid gap-10">
      <section aria-labelledby="fav-title">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 id="fav-title" className="text-[22px] font-semibold tracking-tight">Servicios guardados</h2>
            <p className="mt-1 text-[14px] text-muted">Toca el corazón en cualquier servicio del catálogo para guardarlo aquí.</p>
          </div>
          <Link to="/servicios" className="text-btn">Explorar <ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
        {favorites.length ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {favorites.map((s) => (
              <li key={s.id} className="panel overflow-hidden rounded-2xl">
                <div className="relative h-36 bg-sand"><SmartImage src={s.image} alt="" className="h-full w-full object-cover" /></div>
                <div className="p-4">
                  <p className="text-[15px] font-semibold">{s.name}</p>
                  <p className="text-[13px] text-muted">{s.type === "product" ? "Producto" : formatDuration(s.duration)} · {formatCOP(s.price)}</p>
                  <div className="mt-3 flex gap-2">
                    {s.type === "service" ? (
                      <button type="button" className="btn btn-primary btn-sm flex-1" onClick={() => navigate(`/reservar?service=${s.id}`)}><Repeat size={15} aria-hidden="true" /> Agendar de nuevo</button>
                    ) : (
                      <Link to={`/servicios/${s.id}`} className="btn btn-secondary btn-sm flex-1">Ver producto</Link>
                    )}
                    <button type="button" className="icon-btn !h-10 !w-10 text-copper-dark" onClick={() => toggleFavorite(s.id)} aria-label={`Quitar ${s.name} de favoritos`}>
                      <Heart size={18} fill="currentColor" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={Heart} title="Aún no tienes favoritos" text="Guarda tus servicios preferidos para reservarlos en un clic." />
        )}
      </section>

      <section aria-labelledby="team-fav-title">
        <h2 id="team-fav-title" className="mb-4 text-[22px] font-semibold tracking-tight">Especialistas que te han atendido</h2>
        {specialists.length ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {specialists.map((sp) => {
              const st = getStylist(sp.stylistId);
              return (
                <li key={sp.stylistId} className="panel flex flex-col rounded-2xl p-5">
                  <div className="flex items-center gap-3">
                    <Avatar person={st || { name: sp.name }} size={56} />
                    <div className="min-w-0">
                      <p className="text-[16px] font-semibold">{st?.name || sp.name}</p>
                      <p className="text-[13px] text-muted">{st?.specialty || "Especialista"}</p>
                      {st && <RatingInline stats={getStylistStats(st.id)} />}
                    </div>
                  </div>
                  <p className="mt-3 text-[13px] text-muted">
                    {sp.visits} {sp.visits === 1 ? "visita" : "visitas"} · Última: {sp.last.name}, {formatDateShort(sp.last.date)}
                  </p>
                  <button type="button" className="btn btn-secondary btn-sm mt-4" disabled={!st?.active} onClick={() => navigate(`/reservar?stylist=${sp.stylistId}&service=${sp.lastServiceId}`)}>
                    <Repeat size={15} aria-hidden="true" /> Agendar de nuevo con {firstName(st?.name || sp.name)}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState icon={UserRound} title="Aún no te ha atendido nadie" text="Después de tu primera cita verás aquí a tus especialistas." />
        )}
      </section>
    </div>
  );
}

/* ================================================================== */
/* Pestaña 4 · Mi perfil, preferencias y pagos                          */
/* ================================================================== */
const PROFILE_FIELDS = ["name", "phone", "email", "birthDate", "address", "hairType", "skinType", "preferences", "allergies"];
const detectBrand = (num) => (/^4/.test(num) ? "Visa" : /^5[1-5]/.test(num) ? "Mastercard" : /^3[47]/.test(num) ? "Amex" : "Tarjeta");

function ProfileTab() {
  const { navigate, toast } = useApp();
  useSalonState();
  const user = currentUser();
  const [values, setValues] = useState(() => Object.fromEntries(PROFILE_FIELDS.map((k) => [k, user?.[k] || ""])));
  const [touched, setTouched] = useState(false);
  const [adding, setAdding] = useState(false);
  const [card, setCard] = useState({ number: "", exp: "" });
  const [cardError, setCardError] = useState("");
  const [removing, setRemoving] = useState(null);

  if (!user) {
    return <EmptyState icon={UserRound} title="Perfil no disponible" text="Inicia sesión con tu cuenta para editar tu perfil." action={<button type="button" className="btn btn-primary" onClick={() => navigate("/login")}>Iniciar sesión</button>} />;
  }
  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));
  const errors = { name: validators.name(values.name), phone: validators.phone(values.phone), email: validators.email(values.email) };
  const dirty = PROFILE_FIELDS.some((k) => (values[k] || "") !== (user[k] || ""));
  const save = (e) => {
    e.preventDefault();
    setTouched(true);
    if (Object.values(errors).some(Boolean)) return;
    const res = updateProfile({ ...Object.fromEntries(PROFILE_FIELDS.map((k) => [k, (values[k] || "").trim()])), email: values.email.trim().toLowerCase() });
    toast(res.error || "Perfil actualizado", res.error ? "error" : "success");
  };
  const addCard = (e) => {
    e.preventDefault();
    const dg = card.number.replace(/\D/g, "");
    if (dg.length < 13 || dg.length > 19) return setCardError("Ingresa un número de tarjeta válido.");
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(card.exp)) return setCardError("La fecha debe tener el formato MM/AA.");
    updateProfile({ payments: [...(user.payments || []), { id: `pm-${Date.now()}`, brand: detectBrand(dg), last4: dg.slice(-4), exp: card.exp, default: !user.payments?.length }] });
    toast("Tarjeta agregada");
    setCard({ number: "", exp: "" });
    setCardError("");
    setAdding(false);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <form className="grid gap-6" onSubmit={save} noValidate aria-label="Datos personales y preferencias">
        <section className="panel panel-pad rounded-2xl" aria-labelledby="pd-title">
          <h2 id="pd-title" className="text-[19px] font-semibold tracking-tight">Datos personales</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Nombre completo" autoComplete="name" value={values.name} onChange={set("name")} error={touched ? errors.name : ""} className="sm:col-span-2" />
            <Field label="Celular / WhatsApp" type="tel" autoComplete="tel" value={values.phone} onChange={set("phone")} error={touched ? errors.phone : ""} />
            <Field label="Correo electrónico" type="email" autoComplete="email" value={values.email} onChange={set("email")} error={touched ? errors.email : ""} />
            <Field label="Fecha de nacimiento" type="date" autoComplete="bday" value={values.birthDate} onChange={set("birthDate")} max={new Date().toISOString().slice(0, 10)} />
            <Field label="Dirección o barrio" autoComplete="street-address" value={values.address} onChange={set("address")} />
          </div>
        </section>
        <section className="panel panel-pad rounded-2xl" aria-labelledby="pref-title">
          <h2 id="pref-title" className="text-[19px] font-semibold tracking-tight">Preferencias de atención</h2>
          <p className="mt-1 text-[13px] text-muted">Tu especialista las verá antes de cada cita.</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Tipo de cabello" placeholder="Ej. Ondulado medio (2B)" value={values.hairType} onChange={set("hairType")} />
            <Field label="Tipo de piel" placeholder="Ej. Mixta, sensible" value={values.skinType} onChange={set("skinType")} />
            <Field as="textarea" label="Preferencias generales" value={values.preferences} onChange={set("preferences")} className="sm:col-span-2" />
            <Field label="Alergias / notas" placeholder="Ej. Ninguna" value={values.allergies} onChange={set("allergies")} className="sm:col-span-2" />
          </div>
          <button type="submit" className="btn btn-primary mt-6" disabled={!dirty}>Guardar cambios</button>
        </section>
      </form>

      <div className="grid h-fit gap-6">
        <section className="panel panel-pad rounded-2xl" aria-labelledby="nt-title">
          <h2 id="nt-title" className="text-[19px] font-semibold tracking-tight">Notificaciones</h2>
          <div className="mt-2 divide-y divide-line">
            <Switch icon={MessageCircle} label="WhatsApp" description="Confirmaciones, recordatorios y enlace para calificar." checked={!!user.notifications?.whatsapp} onChange={(v) => updateProfile({ notifications: { ...user.notifications, whatsapp: v } })} />
            <Switch icon={Mail} label="Correo electrónico" description="Resumen de citas y beneficios exclusivos." checked={!!user.notifications?.email} onChange={(v) => updateProfile({ notifications: { ...user.notifications, email: v } })} />
          </div>
        </section>
        <section className="panel panel-pad rounded-2xl" aria-labelledby="pm-title">
          <div className="flex items-center justify-between gap-3">
            <h2 id="pm-title" className="text-[19px] font-semibold tracking-tight">Tarjetas guardadas</h2>
            {!adding && <button type="button" className="text-btn" onClick={() => setAdding(true)}><Plus size={16} aria-hidden="true" /> Agregar</button>}
          </div>
          <ul className="mt-4 flex flex-col gap-2.5">
            {(user.payments || []).map((pm) => (
              <li key={pm.id} className="flex items-center gap-3 rounded-xl border border-line p-3.5">
                <span className="grid h-10 w-14 flex-none place-items-center rounded-md bg-ink text-white" aria-hidden="true"><CreditCard size={18} /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold">{pm.brand} •••• {pm.last4}</p>
                  <p className="text-[12px] text-muted">{pm.exp ? `Vence ${pm.exp}` : "Billetera digital"}{pm.default ? " · Predeterminada" : ""}</p>
                </div>
                {!pm.default && <button type="button" className="text-btn !text-[12px]" onClick={() => updateProfile({ payments: user.payments.map((p) => ({ ...p, default: p.id === pm.id })) })}>Predeterminar</button>}
                <button type="button" className="icon-btn !h-10 !w-10 text-error" onClick={() => setRemoving(pm)} aria-label={`Eliminar ${pm.brand} terminada en ${pm.last4}`}><Trash2 size={17} aria-hidden="true" /></button>
              </li>
            ))}
            {!user.payments?.length && <li className="text-[14px] text-muted">No tienes tarjetas guardadas.</li>}
          </ul>
          {adding && (
            <form className="mt-4 flex flex-col gap-3 rounded-xl border border-line bg-canvas p-4" onSubmit={addCard} noValidate aria-label="Agregar tarjeta">
              <Field label="Número de tarjeta" inputMode="numeric" autoComplete="cc-number" placeholder="4242 4242 4242 4242" value={card.number} onChange={(e) => setCard((c) => ({ ...c, number: e.target.value.replace(/[^\d ]/g, "").slice(0, 23) }))} />
              <Field label="Vencimiento (MM/AA)" inputMode="numeric" autoComplete="cc-exp" placeholder="08/29" value={card.exp} onChange={(e) => setCard((c) => ({ ...c, exp: e.target.value.replace(/[^\d/]/g, "").slice(0, 5) }))} />
              {cardError && <p className="field-hint !text-error" role="alert">{cardError}</p>}
              <p className="text-[12px] text-muted">Solo guardamos la marca y los últimos 4 dígitos.</p>
              <div className="flex gap-2">
                <button type="submit" className="btn btn-primary flex-1">Guardar tarjeta</button>
                <button type="button" className="btn btn-ghost" onClick={() => { setAdding(false); setCardError(""); }}>Cancelar</button>
              </div>
            </form>
          )}
        </section>
      </div>
      <ConfirmDialog open={!!removing} title="¿Eliminar tarjeta?" description={removing ? `${removing.brand} •••• ${removing.last4}` : ""} confirmLabel="Eliminar" danger onClose={() => setRemoving(null)}
        onConfirm={() => {
          const rest = user.payments.filter((p) => p.id !== removing.id);
          if (rest.length && !rest.some((p) => p.default)) rest[0] = { ...rest[0], default: true };
          updateProfile({ payments: rest });
          toast("Tarjeta eliminada");
          setRemoving(null);
        }} />
    </div>
  );
}

/* ================================================================== */
/* Modales compartidos                                                 */
/* ================================================================== */
const REASONS = ["Cambio de planes", "Encontré otro horario", "Motivos de salud", "Otro"];

function CancelModal({ appointment, onClose }) {
  const { navigate } = useApp();
  const [reason, setReason] = useState(REASONS[0]);
  const [error, setError] = useState("");
  const { brand } = useSalonState();
  useEffect(() => setError(""), [appointment?.id]);
  if (!appointment) return null;
  const w = changeWindow(appointment);
  const wa = buildBrandWhatsAppUrl(`Hola, necesito cancelar mi cita ${displayCode(appointment.code)} del ${formatDateLong(appointment.date)} a las ${appointment.time}.`);
  const confirm = () => {
    const res = cancelAppointment(appointment.id, reason);
    if (res?.error) return setError(res.error);
    onClose();
  };
  return (
    <Modal open onClose={onClose} title="¿Cancelar esta cita?" description="Liberaremos el horario para otros clientes. Esta acción no se puede deshacer.">
      <div className="rounded-xl border border-line bg-canvas p-4">
        <p className="text-[15px] font-semibold">{getServiceName(appointment)}</p>
        <p className="mt-1 text-[13px] text-muted">{formatDateLong(appointment.date)} · {appointment.time} · {getStylistName(appointment)}</p>
      </div>
      <p className="mt-4 text-[13px] text-muted">Política del local: {brand.cancellationPolicy}.</p>
      {(!w.allowed || error) && (
        <div className="notice notice-alert mt-3 flex-col" role="alert">
          <span className="flex gap-2"><AlertTriangle size={18} className="mt-0.5 flex-none" aria-hidden="true" />{error || `Faltan menos de ${w.limit} ${w.limit === 1 ? "hora" : "horas"}: la cancelación en línea ya no está disponible.`}</span>
          <WhatsAppButton href={wa} className="btn wa-solid btn-sm mt-3 self-start">Escribir por WhatsApp</WhatsAppButton>
        </div>
      )}
      {w.allowed && (
        <>
          <fieldset className="mt-5">
            <legend className="field-label mb-2">Motivo (nos ayuda a mejorar)</legend>
            <div className="grid gap-1 sm:grid-cols-2">
              {REASONS.map((r) => <label key={r} className="check !text-ink"><input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} /> {r}</label>)}
            </div>
          </fieldset>
          <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row">
            <button type="button" className="btn btn-secondary flex-1" onClick={() => { onClose(); navigate(`/reservar?reprogramar=${appointment.id}`); }}>Mejor reagendar</button>
            <button type="button" className="btn btn-danger flex-1" onClick={confirm}>Sí, cancelar cita</button>
          </div>
        </>
      )}
      <button type="button" className="btn btn-ghost btn-full mt-2" onClick={onClose} data-autofocus>Conservar mi cita</button>
    </Modal>
  );
}

const RATING_LABEL = ["", "Muy mala", "Mala", "Regular", "Muy buena", "Excelente"];

export function ReviewModal({ appointment, onClose }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const refs = useRef([]);
  useEffect(() => {
    setRating(0);
    setComment("");
    setError("");
  }, [appointment?.id]);
  if (!appointment) return null;
  const stylist = getStylist(appointment.stylistId) || { name: appointment.stylistName };
  const stats = getStylistStats(appointment.stylistId);
  const shown = hover || rating;

  const onKeyDown = (e) => {
    const dir = ["ArrowRight", "ArrowUp"].includes(e.key) ? 1 : ["ArrowLeft", "ArrowDown"].includes(e.key) ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const n = Math.min(5, Math.max(1, (rating || 0) + dir));
    setRating(n);
    refs.current[n - 1]?.focus();
  };
  const submit = (e) => {
    e.preventDefault();
    if (!rating) {
      setError("Selecciona de 1 a 5 estrellas.");
      refs.current[0]?.focus();
      return;
    }
    const res = addReview({ appointmentId: appointment.id, rating, comment: comment.trim() });
    if (res.error) return setError(res.error);
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={`Califica a ${firstName(stylist.name)}`} description={`${getServiceName(appointment)} · ${formatDateShort(appointment.date)}`}>
      <div className="mb-5 flex items-center gap-3">
        <Avatar person={stylist} size={52} />
        <div>
          <p className="text-[15px] font-semibold">{stylist.name}</p>
          <p className="text-[13px] text-muted">Promedio actual: {stats.rating ? `${stats.rating.toFixed(1)} ★ (${stats.reviews} reseñas)` : "sin reseñas aún"}</p>
        </div>
      </div>
      <form onSubmit={submit} noValidate>
        <div role="radiogroup" aria-label="Calificación" className="flex items-center gap-1" onKeyDown={onKeyDown} onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} ref={(el) => (refs.current[n - 1] = el)} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} ${n === 1 ? "estrella" : "estrellas"}, ${RATING_LABEL[n]}`} tabIndex={rating ? (rating === n ? 0 : -1) : n === 1 ? 0 : -1} className="grid h-12 w-12 place-items-center text-copper hover:scale-110" onClick={() => { setRating(n); setError(""); }} onMouseEnter={() => setHover(n)}>
              <Star size={32} fill={n <= shown ? "currentColor" : "none"} strokeWidth={1.5} aria-hidden="true" />
            </button>
          ))}
          <span className="ml-3 text-[14px] font-semibold" aria-hidden="true">{RATING_LABEL[shown]}</span>
        </div>
        {error && <p className="field-hint mt-2 !text-error" role="alert">{error}</p>}
        <div className="mt-5">
          <Field as="textarea" label="Comentario (opcional)" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="¿Qué fue lo que más te gustó?" maxLength={400} />
        </div>
        <button type="submit" className="btn btn-primary btn-full mt-6">Publicar calificación</button>
      </form>
    </Modal>
  );
}
