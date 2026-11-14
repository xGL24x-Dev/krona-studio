import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CalendarDays, CheckCircle2, Clock, History, ListTodo, Phone, Play, Star, StickyNote, TrendingUp, Wallet } from "lucide-react";
import { WorkspaceShell } from "./WorkspaceShell.jsx";
import { Avatar, EmptyState, Modal, RatingInline, StatusBadge, Stars, WhatsAppButton, useApp } from "../shared/ui.jsx";
import {
  addDays, appointmentStart, buildClientWhatsAppUrl, completeAppointment, firstName, formatCOP, formatDateLong, formatDateShort, formatDuration,
  getServiceName, getStylist, getStylistStats, startAppointment, toISODate, todayISO, useSalonState, useSession,
} from "../../services/salonService.js";

const NAV = [
  { to: "/empleada", label: "Mi agenda", icon: CalendarDays },
  { to: "/empleada/resenas", label: "Mis reseñas", icon: Star },
];

export function EmployeePanel({ section }) {
  const salon = useSalonState();
  const session = useSession();
  const me = getStylist(session?.userId);
  const mine = useMemo(() => salon.appointments.filter((a) => a.stylistId === session?.userId), [salon.appointments, session]);
  if (!me) return null;
  const stats = getStylistStats(me.id);
  const pendingCount = mine.filter(isPending).length;

  return (
    <WorkspaceShell
      items={NAV.map((n) => (n.to === "/empleada" ? { ...n, badge: pendingCount || null } : n))}
      title={section === "resenas" ? "Mis reseñas" : `Agenda de ${firstName(me.name)}`}
      subtitle={section === "resenas" ? "Lo que dicen tus clientes. Tu promedio se recalcula con cada calificación." : `${me.specialty} · Solo ves las citas asignadas a ti.`}
    >
      <div className="mb-6 flex items-center gap-4 rounded-none border border-line bg-white p-5">
        <Avatar person={me} size={56} />
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-semibold">{me.name}</p>
          <p className="text-[13px] text-muted">{me.title} · {me.categories.join(", ")}</p>
        </div>
        <div className="text-right">
          <p className="font-display text-[30px] font-semibold leading-none tracking-tight">{stats.rating ? stats.rating.toFixed(1) : "—"}</p>
          <div className="mt-1.5">{stats.rating ? <Stars value={stats.rating} size={13} /> : <span className="text-[12px] text-muted">Sin reseñas aún</span>}</div>
          <p className="mt-1 text-[12px] text-muted">{stats.reviews} reseñas · {stats.done} servicios</p>
        </div>
      </div>
      {section === "resenas" ? <ReviewsView stylistId={me.id} /> : <AgendaView mine={mine} />}
    </WorkspaceShell>
  );
}

/* ------------------------------------------------------------------ */
/* Agenda operativa                                                    */
/* ------------------------------------------------------------------ */
const PENDING = ["confirmada", "en-atencion"];
/** Pendiente por realizar: en atención (cualquier fecha) o confirmada de hoy en adelante. */
const isPending = (a) => a.status === "en-atencion" || (a.status === "confirmada" && a.date >= todayISO());
/** Día en que se completó (si se finalizó antes de su fecha, cuenta el día real de cierre). */
const completedDay = (a) => (a.completedAt ? toISODate(new Date(a.completedAt)) : a.date);

const TABS = [
  ["pendientes", "Por atender"],
  ["completadas", "Completadas hoy"],
  ["historial", "Historial"],
];
const EMPTY = {
  pendientes: ["Nada por atender", "No tienes citas pendientes. Las nuevas reservas aparecerán aquí al instante."],
  completadas: ["Aún no completas citas hoy", "Cuando finalices una cita en “Por atender”, se moverá automáticamente aquí."],
  historial: ["Sin historial", "Aquí verás las citas completadas o canceladas de días anteriores."],
};

function AgendaView({ mine }) {
  const [tab, setTab] = useState("pendientes");
  const [finished, setFinished] = useState(null);
  const [error, setError] = useState("");
  const tabRefs = useRef([]);
  const baseId = useId();
  const today = todayISO();
  const monthAgo = toISODate(addDays(new Date(), -30));
  const historyFrom = toISODate(addDays(new Date(), -60));

  const lists = {
    // 1) En atención arriba → confirmadas de hoy → próximos días (cronológico).
    pendientes: mine
      .filter(isPending)
      .sort((a, b) => (b.status === "en-atencion") - (a.status === "en-atencion") || (b.date === today) - (a.date === today) || appointmentStart(a) - appointmentStart(b)),
    // 2) Solo las completadas hoy (incluye las que se finalizan desde "Por atender").
    completadas: mine.filter((a) => a.status === "completada" && completedDay(a) === today).sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0) || b.time.localeCompare(a.time)),
    // 3) Exclusivamente días anteriores (completadas o canceladas), sin duplicar las de hoy.
    historial: mine
      .filter((a) => a.date < today && a.date >= historyFrom && ["completada", "cancelada"].includes(a.status) && completedDay(a) !== today)
      .sort((a, b) => appointmentStart(b) - appointmentStart(a)),
  };
  const done30 = mine.filter((a) => a.status === "completada" && completedDay(a) >= monthAgo);
  const kpis = [
    { icon: ListTodo, label: "Por atender", value: lists.pendientes.length, note: `${lists.pendientes.filter((a) => a.status === "en-atencion").length} en atención · ${lists.pendientes.filter((a) => a.date === today).length} de hoy` },
    { icon: CheckCircle2, label: "Completadas hoy", value: lists.completadas.length, note: "Servicios terminados hoy" },
    { icon: TrendingUp, label: "Completadas (30 d)", value: done30.length, note: "Acumulado del último mes" },
    { icon: Wallet, label: "Generado (30 d)", value: formatCOP(done30.reduce((sum, a) => sum + a.price, 0)).replace(" COP", ""), note: "COP · servicios completados" },
  ];

  const onKeyDown = (e, i) => {
    const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!dir) return;
    const n = (i + dir + TABS.length) % TABS.length;
    setTab(TABS[n][0]);
    tabRefs.current[n]?.focus();
  };

  const start = (a) => {
    const res = startAppointment(a.id);
    setError(res.error || "");
  };
  const finish = (a) => {
    const res = completeAppointment(a.id);
    if (res.error) return setError(res.error);
    setError("");
    setTab("completadas"); // la cita se mueve a "Completadas hoy"
    setFinished(res);
  };

  return (
    <>
      <dl className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map(({ icon: Icon, label, value, note }) => (
          <div key={label} className="kpi">
            <dt>{label}<Icon size={18} className="text-copper-dark" aria-hidden="true" /></dt>
            <dd>{value}</dd>
            <p className="mt-3 text-[12px] text-muted">{note}</p>
          </div>
        ))}
      </dl>
      {error && <p className="notice notice-error mb-5" role="alert">{error}</p>}

      <div role="tablist" aria-label="Filtrar citas" className="tabs mb-6">
        {TABS.map(([id, label], i) => (
          <button key={id} ref={(el) => (tabRefs.current[i] = el)} role="tab" type="button" id={`${baseId}-${id}`} aria-selected={tab === id} aria-controls={`${baseId}-p`} tabIndex={tab === id ? 0 : -1} className="tab" onClick={() => setTab(id)} onKeyDown={(e) => onKeyDown(e, i)}>
            {label}<span>{lists[id].length}</span>
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${baseId}-p`} aria-labelledby={`${baseId}-${tab}`} className="view-enter" key={tab}>
        {lists[tab].length === 0 ? (
          <EmptyState icon={tab === "historial" ? History : CalendarDays} title={EMPTY[tab][0]} text={EMPTY[tab][1]} />
        ) : (
          <ul className="flex flex-col gap-3">
            {lists[tab].map((a) => <ApptCard key={a.id} a={a} onStart={start} onFinish={finish} showDate={tab !== "completadas"} />)}
          </ul>
        )}
      </div>

      <Modal open={!!finished} onClose={() => setFinished(null)} title="¡Cita completada!" description={finished ? `${getServiceName(finished.appointment)} · ${finished.appointment.clientName}` : ""}>
        {finished && (
          <>
            <div className="notice notice-success">
              <CheckCircle2 size={18} className="mt-0.5 flex-none text-success" aria-hidden="true" />
              <span>{finished.appointment.clientId === "walk-in" ? "La cita quedó registrada como completada." : `${firstName(finished.appointment.clientName)} recibió una notificación en la app con el enlace directo para calificarte.`}</span>
            </div>
            <p className="mt-4 text-[14px] text-muted">Cierra el ciclo con un mensaje personal de agradecimiento e invita a calificar por WhatsApp:</p>
            <WhatsAppButton href={finished.clientWhatsAppUrl} className="btn btn-full wa-solid mt-4">
              Enviar agradecimiento a {firstName(finished.appointment.clientName)}
            </WhatsAppButton>
            <button type="button" className="btn btn-ghost btn-full mt-2" onClick={() => setFinished(null)} data-autofocus>Listo</button>
          </>
        )}
      </Modal>
    </>
  );
}

function SinceTimer({ since }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);
  const min = Math.max(0, Math.round((Date.now() - since) / 60000));
  return <span className="text-[12px] font-semibold text-copper-dark">En atención hace {min} min</span>;
}

function ApptCard({ a, onStart, onFinish, showDate }) {
  const wa = a.status === "completada" ? buildClientWhatsAppUrl(a) : null;
  return (
    <li className={`panel grid gap-4 p-5 md:grid-cols-[110px_1fr_auto] md:items-center ${a.status === "en-atencion" ? "!border-ink shadow-[inset_3px_0_0_var(--color-copper)]" : ""}`}>
      <div className="flex items-baseline gap-3 md:block">
        <p className="font-display text-[26px] font-semibold leading-none tracking-tight">{a.time}</p>
        <p className="text-[13px] text-muted md:mt-1.5">{showDate && a.date !== todayISO() ? formatDateShort(a.date) : formatDuration(a.duration)}</p>
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[16px] font-semibold">{a.clientName}</p>
          <StatusBadge status={a.status} />
          {a.date === todayISO() && PENDING.includes(a.status) && <span className="status tone-today">Hoy</span>}
          {a.status === "en-atencion" && a.startedAt && <SinceTimer since={a.startedAt} />}
        </div>
        <p className="mt-1 text-[14px]">{getServiceName(a)} · {formatCOP(a.price)}</p>
        <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted">
          {a.clientPhone && <span className="flex items-center gap-1"><Phone size={13} aria-hidden="true" /> {a.clientPhone}</span>}
          {a.notes && <span className="flex items-center gap-1"><StickyNote size={13} aria-hidden="true" /> {a.notes}</span>}
          <span>Código {a.code}</span>
        </p>
      </div>
      <div className="flex flex-wrap gap-2 md:justify-end">
        {a.status === "confirmada" && (
          <button type="button" className="btn btn-dark" onClick={() => onStart(a)} aria-label={`Iniciar cita de ${a.clientName} a las ${a.time}`}>
            <Play size={16} aria-hidden="true" /> Iniciar cita
          </button>
        )}
        {a.status === "en-atencion" && (
          <button type="button" className="btn btn-primary" onClick={() => onFinish(a)} aria-label={`Finalizar y marcar completada la cita de ${a.clientName}`}>
            <CheckCircle2 size={17} aria-hidden="true" /> Finalizar y marcar completada
          </button>
        )}
        {a.status === "completada" && (
          <>
            {a.reviewed ? <span className="status tone-success">Calificada</span> : <span className="status tone-copper">Esperando calificación</span>}
            <WhatsAppButton href={wa} className="btn btn-secondary btn-sm">Agradecer</WhatsAppButton>
          </>
        )}
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Reseñas de la empleada                                              */
/* ------------------------------------------------------------------ */
function ReviewsView({ stylistId }) {
  const { reviews } = useSalonState();
  const mine = reviews.filter((r) => r.stylistId === stylistId).sort((a, b) => b.createdAt - a.createdAt);
  const dist = [5, 4, 3, 2, 1].map((n) => [n, mine.filter((r) => r.rating === n).length]);
  if (!mine.length) return <EmptyState icon={Star} title="Aún no tienes reseñas" text="Cuando finalices una cita, tu cliente recibirá el enlace para calificarte." />;
  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      <section className="panel panel-pad h-fit" aria-label="Distribución de calificaciones">
        <RatingInline stats={getStylistStats(stylistId)} size={14} />
        <ul className="mt-5 flex flex-col gap-2">
          {dist.map(([n, c]) => (
            <li key={n} className="flex items-center gap-2 text-[13px]">
              <span className="w-8">{n} ★</span>
              <span className="h-2 flex-1 bg-[#f0eee9]" aria-hidden="true"><i className="block h-full bg-copper" style={{ width: `${(c / mine.length) * 100}%` }} /></span>
              <span className="w-6 text-right text-muted">{c}</span>
            </li>
          ))}
        </ul>
      </section>
      <ul className="flex flex-col gap-3">
        {mine.slice(0, 30).map((r) => (
          <li key={r.id} className="panel p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Stars value={r.rating} size={14} />
              <span className="text-[12px] text-muted">{formatDateLong(toISODate(new Date(r.createdAt)))}</span>
            </div>
            {r.comment && <p className="mt-2 text-[15px] leading-relaxed">“{r.comment}”</p>}
            <p className="mt-2 text-[13px] text-muted">{r.author}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

