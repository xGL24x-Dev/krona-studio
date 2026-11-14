import { useEffect, useMemo, useState } from "react";
import {
  CalendarCheck, CalendarDays, ChevronLeft, ChevronRight, LayoutList, Package, Percent, Plus, Store, UserCheck, Users, Wallet, Rows3,
} from "lucide-react";
import { WorkspaceShell } from "./WorkspaceShell.jsx";
import { BrandManager, CatalogManager, TeamManager } from "./AdminManagers.jsx";
import { Avatar, EmptyState, Field, Modal, StatusBadge, WhatsAppButton, useSkeleton } from "../shared/ui.jsx";
import {
  STATUS_META, addDays, createAppointment, buildClientWhatsAppUrl, buildStylistWhatsAppUrl, cancelAppointment, completeAppointment, eligibleStylists,
  formatCOP, formatDateLong, formatDuration, fromMinutes, getDaySlots, getService, getServiceName, getStylist, getStylistName, listServices,
  listStylists, openingHours, parseISODate, setAppointmentStatus, startAppointment, toISODate, toMinutes, todayISO, useSalonState, validators,
} from "../../services/salonService.js";

const NAV = [
  { to: "/admin", label: "Agenda global & KPIs", icon: CalendarDays },
  { to: "/admin/catalogo", label: "Catálogo", icon: Package },
  { to: "/admin/equipo", label: "Equipo", icon: Users },
  { to: "/admin/local", label: "Mi Local", icon: Store },
];

const SECTIONS = {
  agenda: { title: "Agenda global", subtitle: "Todas las citas del local en tiempo real. Filtra por especialista o estado." },
  catalogo: { title: "Catálogo", subtitle: "Servicios y productos. Los cambios se publican al instante en la tienda." },
  equipo: { title: "Equipo", subtitle: "Especialistas, accesos y WhatsApp para avisos de citas." },
  local: { title: "Mi Local", subtitle: "Marca blanca: nombre, logo, contacto y horarios en toda la app." },
};

export function AdminPanel({ section = "agenda" }) {
  const { appointments } = useSalonState();
  const [manualOpen, setManualOpen] = useState(false);
  const todayCount = appointments.filter((a) => a.date === todayISO() && a.status === "confirmada").length;
  const meta = SECTIONS[section];
  return (
    <WorkspaceShell
      items={NAV.map((n) => (n.to === "/admin" ? { ...n, badge: todayCount || null } : n))}
      title={meta.title}
      subtitle={meta.subtitle}
      actions={section === "agenda" && <button type="button" className="btn btn-primary" onClick={() => setManualOpen(true)}><Plus size={18} aria-hidden="true" /> Nueva cita manual</button>}
    >
      {section === "agenda" && <AgendaModule manualOpen={manualOpen} setManualOpen={setManualOpen} />}
      {section === "catalogo" && <CatalogManager />}
      {section === "equipo" && <TeamManager />}
      {section === "local" && <BrandManager />}
    </WorkspaceShell>
  );
}

/* ------------------------------------------------------------------ */
/* Agenda global + KPIs                                                */
/* ------------------------------------------------------------------ */
function AgendaModule({ manualOpen, setManualOpen }) {
  const salon = useSalonState();
  const [date, setDate] = useState(todayISO());
  const [stylistFilter, setStylistFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [view, setView] = useState("timeline");
  const [selected, setSelected] = useState(null);
  const loading = useSkeleton([date, stylistFilter, statusFilter]);
  const team = listStylists();
  const columns = stylistFilter === "all" ? team : team.filter((s) => s.id === stylistFilter);

  const dayAppts = useMemo(
    () => salon.appointments.filter((a) => a.date === date && (stylistFilter === "all" || a.stylistId === stylistFilter) && (statusFilter === "all" || a.status === statusFilter)),
    [salon.appointments, date, stylistFilter, statusFilter],
  );

  const kpis = useMemo(() => {
    const scope = salon.appointments.filter((a) => a.date === date && (stylistFilter === "all" || a.stylistId === stylistFilter));
    const active = scope.filter((a) => a.status !== "cancelada");
    const hours = openingHours(date);
    const capacity = hours ? columns.length * (hours.close - hours.open) : 0;
    const booked = active.reduce((s, a) => s + a.duration, 0);
    const revenue = active.filter((a) => a.status !== "no-asistio").reduce((s, a) => s + a.price, 0);
    const from = toISODate(addDays(parseISODate(date), -30));
    const win = salon.appointments.filter((a) => a.date >= from && a.date <= date && (stylistFilter === "all" || a.stylistId === stylistFilter));
    const attended = win.filter((a) => a.status === "completada").length;
    const noShow = win.filter((a) => a.status === "no-asistio").length;
    return {
      count: active.length,
      cancelled: scope.length - active.length,
      occupancy: capacity ? Math.min(100, Math.round((booked / capacity) * 100)) : 0,
      revenue,
      attendance: attended + noShow ? Math.round((attended / (attended + noShow)) * 100) : 100,
      sample: attended + noShow,
    };
  }, [salon.appointments, date, stylistFilter, columns.length]);

  const isToday = date === todayISO();
  const shift = (n) => setDate(toISODate(addDays(parseISODate(date), n)));

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div className="flex items-center border border-[#d4d4d8] bg-white">
          <button type="button" className="icon-btn !rounded-none" onClick={() => shift(-1)} aria-label="Día anterior"><ChevronLeft size={20} aria-hidden="true" /></button>
          <label className="sr-only" htmlFor="ag-date">Fecha</label>
          <input id="ag-date" type="date" className="h-11 border-x border-line px-2 text-[14px] outline-none" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          <button type="button" className="icon-btn !rounded-none" onClick={() => shift(1)} aria-label="Día siguiente"><ChevronRight size={20} aria-hidden="true" /></button>
        </div>
        {!isToday && <button type="button" className="btn btn-secondary" onClick={() => setDate(todayISO())}>Hoy</button>}
        <Field as="select" label="Especialista" className="min-w-[180px]" value={stylistFilter} onChange={(e) => setStylistFilter(e.target.value)}>
          <option value="all">Todas</option>
          {team.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Field>
        <Field as="select" label="Estado" className="min-w-[160px]" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">Todos</option>
          {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Field>
        <div className="ml-auto flex border border-[#d4d4d8] bg-white" role="group" aria-label="Vista">
          <button type="button" className="seg" aria-pressed={view === "timeline"} onClick={() => setView("timeline")}><Rows3 size={16} aria-hidden="true" /> Timeline</button>
          <button type="button" className="seg" aria-pressed={view === "list"} onClick={() => setView("list")}><LayoutList size={16} aria-hidden="true" /> Lista</button>
        </div>
      </div>
      <p className="mb-5 text-[14px] text-muted" aria-live="polite">{formatDateLong(date)}{isToday ? " · Hoy" : ""} · {dayAppts.length} citas en vista</p>

      <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-busy={loading}>
        <Kpi icon={CalendarCheck} label={isToday ? "Citas hoy" : "Citas del día"} value={kpis.count} note={`${kpis.cancelled} canceladas`} loading={loading} />
        <Kpi icon={Percent} label="Ocupación" value={`${kpis.occupancy}%`} meter={kpis.occupancy} note={`${columns.length} especialista${columns.length === 1 ? "" : "s"}`} loading={loading} />
        <Kpi icon={Wallet} label={isToday ? "Ingresos est. hoy" : "Ingresos estimados"} value={formatCOP(kpis.revenue).replace(" COP", "")} note="COP · sin no-shows" loading={loading} />
        <Kpi icon={UserCheck} label="Tasa de asistencia" value={`${kpis.attendance}%`} meter={kpis.attendance} note={`Últimos 30 días · ${kpis.sample} citas`} loading={loading} />
      </dl>

      <div className="mb-4 mt-8 flex flex-wrap gap-2" aria-label="Leyenda de estados">
        {Object.keys(STATUS_META).map((s) => <StatusBadge key={s} status={s} />)}
      </div>

      {loading ? (
        <div className="shimmer h-[420px]" aria-label="Cargando agenda" />
      ) : view === "timeline" ? (
        <Timeline date={date} columns={columns} appts={dayAppts} onSelect={setSelected} />
      ) : dayAppts.length === 0 ? (
        <EmptyState icon={CalendarDays} title="Sin citas con estos filtros" text="Cambia la fecha o los filtros, o crea una cita manual." />
      ) : (
        <div className="overflow-x-auto border border-line bg-white">
          <table className="ws-table">
            <thead>
              <tr><th scope="col">Hora</th><th scope="col">Cliente</th><th scope="col">Servicio</th><th scope="col">Especialista</th><th scope="col">Estado</th><th scope="col"><span className="sr-only">Acciones</span></th></tr>
            </thead>
            <tbody>
              {[...dayAppts].sort((a, b) => a.time.localeCompare(b.time)).map((a) => (
                <tr key={a.id}>
                  <td className="font-semibold tabular-nums">{a.time}</td>
                  <td>{a.clientName}<span className="block text-[12px] text-muted">{a.clientPhone || "Sin teléfono"}</span></td>
                  <td>{getServiceName(a)}<span className="block text-[12px] text-muted">{formatDuration(a.duration)} · {formatCOP(a.price)}</span></td>
                  <td><span className="flex items-center gap-2"><Avatar person={getStylist(a.stylistId) || { name: a.stylistName }} size={28} />{getStylistName(a)}</span></td>
                  <td><StatusBadge status={a.status} /></td>
                  <td>
                    <div className="flex justify-end gap-1.5">
                      <WhatsAppButton href={buildStylistWhatsAppUrl(a)} className="btn btn-secondary btn-sm">Avisar</WhatsAppButton>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelected(a.id)}>Gestionar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ManualAppointmentModal open={manualOpen} onClose={() => setManualOpen(false)} defaultDate={date} />
      <AppointmentDetailModal id={selected} onClose={() => setSelected(null)} />
    </>
  );
}

function Kpi({ icon: Icon, label, value, note, meter, loading }) {
  return (
    <div className="kpi">
      <dt>{label}<Icon size={18} className="text-copper-dark" aria-hidden="true" /></dt>
      <dd>{loading ? <span className="shimmer block h-8 w-28" aria-hidden="true" /> : value}</dd>
      {meter !== undefined && <div className="meter" aria-hidden="true"><i style={{ width: `${loading ? 0 : Math.min(100, meter)}%` }} /></div>}
      <p className="mt-3 text-[12px] text-muted">{note}</p>
    </div>
  );
}

function Timeline({ date, columns, appts, onSelect }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  const hours = openingHours(date);
  if (!hours) return <EmptyState icon={Store} title="El local está cerrado este día" text="Ajusta los horarios en Mi Local si deseas abrir." />;
  if (!columns.length) return <EmptyState icon={Users} title="Sin especialistas activas" text="Agrega integrantes desde el módulo Equipo." />;
  const { open, close } = hours;
  const height = close - open;
  const nowMin = new Date(now).getHours() * 60 + new Date(now).getMinutes();
  return (
    <div className="timeline view-enter" role="region" aria-label="Agenda por especialista" tabIndex={0}>
      <div className="timeline-grid" style={{ gridTemplateColumns: `64px repeat(${columns.length}, minmax(160px, 1fr))` }}>
        <div className="tl-head !border-l-0" aria-hidden="true" />
        {columns.map((st) => (
          <div key={st.id} className="tl-head flex items-center gap-2.5">
            <Avatar person={st} size={34} />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold">{st.name}</p>
              <p className="truncate text-[12px] text-muted">{appts.filter((a) => a.stylistId === st.id && a.status !== "cancelada").length} citas</p>
            </div>
          </div>
        ))}
        <div className="tl-hours" style={{ height }} aria-hidden="true">
          {Array.from({ length: Math.floor((close - open) / 60) + 1 }, (_, i) => (
            <span key={i} className="tl-hour" style={{ top: Math.min(i * 60, height - 8) + (i === 0 ? 8 : 0) }}>{fromMinutes(open + i * 60)}</span>
          ))}
        </div>
        {columns.map((st) => (
          <div key={st.id} className="tl-col" style={{ height }} role="list" aria-label={`Citas de ${st.name}`}>
            {date === todayISO() && nowMin >= open && nowMin <= close && <div className="tl-now" style={{ top: nowMin - open }} aria-hidden="true" />}
            {appts.filter((a) => a.stylistId === st.id).sort((a, b) => (a.status === "cancelada") - (b.status === "cancelada")).map((a) => {
              const h = Math.max(28, a.duration - 2);
              return (
                <button key={a.id} type="button" role="listitem" className="tl-block" data-status={a.status} style={{ top: toMinutes(a.time) - open, height: h, opacity: a.status === "cancelada" ? 0.75 : 1 }} onClick={() => onSelect(a.id)} aria-label={`${a.time}, ${getServiceName(a)}, ${a.clientName}, ${STATUS_META[a.status].label}`}>
                  <b>{a.time} · {a.clientName}</b>
                  {h >= 40 && <span className="block truncate">{getServiceName(a)}</span>}
                  {h >= 70 && <span className="mt-1 block text-[11px] opacity-80">{STATUS_META[a.status].label}{a.source === "manual" ? " · Manual" : ""}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Detalle + estados + WhatsApp                                        */
/* ------------------------------------------------------------------ */
function AppointmentDetailModal({ id, onClose }) {
  const { appointments } = useSalonState();
  const a = appointments.find((x) => x.id === id);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    setConfirmCancel(false);
    setError("");
  }, [id]);
  if (!a) return null;
  const st = getStylist(a.stylistId);
  const run = (fn) => {
    const res = fn(a.id);
    if (res?.error) setError(res.error);
  };
  const row = (label, value) => (
    <div><dt className="text-[12px] font-semibold uppercase tracking-[0.08em] text-subtle">{label}</dt><dd className="mt-1">{value}</dd></div>
  );
  return (
    <Modal open onClose={onClose} title={a.clientName} description={`${getServiceName(a)} · ${a.code}`}>
      <dl className="grid grid-cols-2 gap-4 text-[14px]">
        {row("Horario", `${formatDateLong(a.date)} · ${a.time}`)}
        {row("Duración", formatDuration(a.duration))}
        {row("Especialista", st?.name || a.stylistName)}
        {row("Valor", formatCOP(a.price))}
        {row("Estado", <StatusBadge status={a.status} />)}
        {row("Origen", a.source === "manual" ? "Manual (recepción)" : "Reserva web")}
        {a.clientPhone && <div className="col-span-2">{row("Contacto", a.clientPhone)}</div>}
        {a.notes && <div className="col-span-2">{row("Notas", a.notes)}</div>}
      </dl>
      {error && <p className="notice notice-error mt-5" role="alert">{error}</p>}
      <div className="mt-6 flex flex-col gap-2.5">
        <WhatsAppButton href={buildStylistWhatsAppUrl(a)} className="btn btn-full wa-solid">Avisar a {st?.name.split(" ")[0] || "la especialista"} por WhatsApp</WhatsAppButton>
        {a.status === "completada" && <WhatsAppButton href={buildClientWhatsAppUrl(a)} className="btn btn-secondary btn-full">Agradecer al cliente e invitar a calificar</WhatsAppButton>}
      </div>
      {["confirmada", "en-atencion"].includes(a.status) && !confirmCancel && (
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          {a.status === "confirmada" && <button type="button" className="btn btn-dark" onClick={() => run(startAppointment)}>Iniciar cita</button>}
          <button type="button" className="btn btn-primary" onClick={() => run(completeAppointment)}>Marcar completada</button>
          {a.status === "confirmada" && <button type="button" className="btn btn-secondary" onClick={() => run((x) => setAppointmentStatus(x, "no-asistio"))}>No asistió</button>}
          <button type="button" className="btn btn-ghost !text-error" onClick={() => setConfirmCancel(true)}>Cancelar cita</button>
        </div>
      )}
      {confirmCancel && (
        <div className="notice notice-error mt-5 flex-col" role="alert">
          <p>¿Confirmas la cancelación? El cliente y la especialista recibirán una notificación y el cupo quedará libre.</p>
          <div className="mt-3 flex gap-2">
            <button type="button" className="btn btn-danger btn-sm" onClick={() => { cancelAppointment(a.id, "Gestionado por el salón"); onClose(); }}>Sí, cancelar</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setConfirmCancel(false)}>No</button>
          </div>
        </div>
      )}
      {a.status === "no-asistio" && <button type="button" className="btn btn-secondary btn-full mt-3" onClick={() => run((x) => setAppointmentStatus(x, "confirmada"))}>Revertir a confirmada</button>}
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* + Nueva cita manual                                                 */
/* ------------------------------------------------------------------ */
function ManualAppointmentModal({ open, onClose, defaultDate }) {
  const salon = useSalonState();
  const services = listServices({ type: "service" });
  const initial = () => ({ name: "", phone: "", serviceId: services[0]?.id || "", stylistId: "auto", date: defaultDate, time: "" });
  const [v, setV] = useState(initial);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(null);
  useEffect(() => {
    if (open) {
      setV(initial());
      setTouched(false);
      setError("");
      setCreated(null);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const service = getService(v.serviceId);
  const slots = useMemo(
    () => (open && service ? getDaySlots(v.date, service, v.stylistId === "auto" ? {} : { stylistId: v.stylistId }).filter((s) => s.status !== "busy") : []),
    [open, salon, v.date, service, v.stylistId], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const errors = { name: validators.name(v.name), phone: v.phone ? validators.phone(v.phone) : "", time: v.time ? "" : "Elige un horario disponible." };
  const set = (k, resetTime = true) => (e) => setV((s) => ({ ...s, [k]: e.target.value, ...(resetTime ? { time: "" } : {}) }));

  const submit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (Object.values(errors).some(Boolean)) return;
    const res = createAppointment({ serviceId: v.serviceId, stylistId: v.stylistId, date: v.date, time: v.time, clientName: v.name.trim(), clientPhone: v.phone.trim(), manual: true });
    if (res.error) {
      setError(res.error);
      setV((s) => ({ ...s, time: "" }));
      return;
    }
    setCreated(res);
  };

  if (!services.length) return <Modal open={open} onClose={onClose} title="Nueva cita manual"><p className="text-[14px] text-muted">Primero crea servicios en el módulo Catálogo.</p></Modal>;

  return (
    <Modal open={open} onClose={onClose} title={created ? "Cita creada" : "Nueva cita manual"} description={created ? `${created.appointment.clientName} · ${getServiceName(created.appointment)} · ${formatDateLong(created.appointment.date)} ${created.appointment.time}` : "Registra reservas telefónicas o de recepción. Se reflejan al instante en todas las agendas."} size="dialog-lg">
      {created ? (
        <div className="flex flex-col gap-2.5">
          <p className="notice notice-success">La cita ya aparece en la agenda de {getStylistName(created.appointment)} y en su panel.</p>
          <WhatsAppButton href={created.stylistWhatsAppUrl} className="btn btn-full wa-solid">Avisar a {getStylistName(created.appointment).split(" ")[0]} por WhatsApp</WhatsAppButton>
          <button type="button" className="btn btn-ghost btn-full" onClick={onClose} data-autofocus>Listo</button>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
          {error && <p className="notice notice-error sm:col-span-2" role="alert">{error}</p>}
          <Field label="Nombre del cliente" value={v.name} onChange={set("name", false)} error={touched ? errors.name : ""} data-autofocus autoComplete="off" />
          <Field label="Celular (opcional)" type="tel" value={v.phone} onChange={set("phone", false)} error={touched ? errors.phone : ""} autoComplete="off" />
          <Field as="select" label="Servicio" value={v.serviceId} onChange={(e) => setV((s) => ({ ...s, serviceId: e.target.value, stylistId: "auto", time: "" }))}>
            {salon.categories.map((c) => {
              const list = services.filter((s) => s.category === c);
              return list.length ? <optgroup key={c} label={c}>{list.map((s) => <option key={s.id} value={s.id}>{s.name} · {formatDuration(s.duration)}</option>)}</optgroup> : null;
            })}
          </Field>
          <Field as="select" label="Especialista" value={v.stylistId} onChange={set("stylistId")}>
            <option value="auto">Asignación automática</option>
            {eligibleStylists(service).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Field>
          <Field label="Fecha" type="date" value={v.date} min={todayISO()} onChange={(e) => e.target.value && setV((s) => ({ ...s, date: e.target.value, time: "" }))} />
          <Field as="select" label="Hora" value={v.time} onChange={set("time", false)} error={touched ? errors.time : ""} hint={slots.length ? `${slots.length} horarios libres` : "Sin horarios libres para esta combinación"}>
            <option value="">Selecciona…</option>
            {slots.map((s) => <option key={s.time} value={s.time}>{s.time}{s.status === "last" ? " · último cupo" : ""}</option>)}
          </Field>
          <div className="flex flex-col-reverse gap-2.5 sm:col-span-2 sm:flex-row sm:justify-end">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary"><Plus size={18} aria-hidden="true" /> Crear cita · {formatCOP(service?.price || 0)}</button>
          </div>
        </form>
      )}
    </Modal>
  );
}
