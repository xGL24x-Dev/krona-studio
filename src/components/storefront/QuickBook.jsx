/* Barra de reserva rápida del Hero con popovers propios (sin <select> ni <input type="date">). */
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowRight, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Clock, Sparkles, X } from "lucide-react";
import { useApp } from "../shared/ui.jsx";
import {
  addDays, formatCOP, formatDuration, formatMonth, getDaySlots, getService, listServices, openingHours, parseISODate, toISODate, todayISO,
  useSalonState,
} from "../../services/salonService.js";

const MAX_DAYS_AHEAD = 60;
const DOW = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];
const shortDate = (iso) =>
  parseISODate(iso).toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short" }).replace(/\.(?=\s|,|$)/g, "").replace(/^./, (c) => c.toUpperCase());

/** Próximo sábado (o hoy si ya es sábado). */
const thisSaturday = () => {
  const d = new Date();
  return toISODate(addDays(d, (6 - d.getDay() + 7) % 7));
};

export function QuickBook() {
  const { navigate } = useApp();
  const salon = useSalonState();
  const services = listServices({ type: "service" });
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState("");
  const [open, setOpen] = useState(null); // "service" | "date" | null — nunca ambos a la vez
  const rootRef = useRef(null);
  const triggerRefs = { service: useRef(null), date: useRef(null) };
  const ids = { service: useId(), date: useId() };
  const service = getService(serviceId);

  // Cerrar al hacer clic fuera o con Escape (devolviendo el foco al disparador).
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(null);
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        const which = open;
        setOpen(null);
        triggerRefs[which].current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (which) => setOpen((o) => (o === which ? null : which));

  const submit = (e) => {
    e.preventDefault();
    setOpen(null);
    const p = new URLSearchParams();
    if (serviceId) p.set("service", serviceId);
    if (date) p.set("date", date);
    navigate(`/reservar${p.toString() ? `?${p}` : ""}`);
  };

  return (
    <form ref={rootRef} className="qb" onSubmit={submit} aria-label="Reserva rápida">
      {/* --------- Servicio --------- */}
      <button
        ref={triggerRefs.service}
        type="button"
        className="qb-field"
        aria-haspopup="listbox"
        aria-expanded={open === "service"}
        aria-controls={ids.service}
        onClick={() => toggle("service")}
      >
        <span className="qb-label">Servicio</span>
        <span className="flex min-w-0 items-center gap-2">
          <span className={`qb-value ${service ? "" : "is-placeholder"}`}>{service ? service.name : "¿Qué te gustaría?"}</span>
          <ChevronDown size={16} className={`qb-chevron ${open === "service" ? "rotate-180" : ""}`} aria-hidden="true" />
        </span>
        {service && <span className="qb-hint">{formatDuration(service.duration)} · {formatCOP(service.price)}</span>}
      </button>

      <span className="qb-divider" aria-hidden="true" />

      {/* --------- Fecha --------- */}
      <button
        ref={triggerRefs.date}
        type="button"
        className="qb-field"
        aria-haspopup="dialog"
        aria-expanded={open === "date"}
        aria-controls={ids.date}
        onClick={() => toggle("date")}
      >
        <span className="qb-label">Fecha</span>
        <span className="flex min-w-0 items-center gap-2">
          <CalendarDays size={16} className="flex-none text-copper-dark" aria-hidden="true" />
          <span className={`qb-value ${date ? "" : "is-placeholder"}`}>{date ? shortDate(date) : "Lo antes posible"}</span>
          <ChevronDown size={16} className={`qb-chevron ${open === "date" ? "rotate-180" : ""}`} aria-hidden="true" />
        </span>
      </button>

      <button type="submit" className="btn btn-primary qb-submit">
        Ver disponibilidad <ArrowRight size={18} aria-hidden="true" />
      </button>

      {open === "service" && (
        <ServicePopover
          id={ids.service}
          services={services}
          categories={salon.categories}
          value={serviceId}
          onPick={(id) => {
            setServiceId(id);
            setOpen(null);
            triggerRefs.service.current?.focus();
          }}
        />
      )}
      {open === "date" && (
        <DatePopover
          id={ids.date}
          service={service}
          services={services}
          salon={salon}
          value={date}
          onPick={(iso) => {
            setDate(iso);
            setOpen(null);
            triggerRefs.date.current?.focus();
          }}
        />
      )}
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Popover de servicios                                                */
/* ------------------------------------------------------------------ */
function ServicePopover({ id, services, categories, value, onPick }) {
  const [cat, setCat] = useState(() => getService(value)?.category || "Todos");
  const listRef = useRef(null);
  const list = services.filter((s) => cat === "Todos" || s.category === cat);
  const pills = ["Todos", ...categories.filter((c) => services.some((s) => s.category === c))];

  useEffect(() => {
    const el = listRef.current?.querySelector('[aria-selected="true"]') || listRef.current?.querySelector("[role=option]");
    el?.focus({ preventScroll: false });
  }, []);

  // Flechas ↑/↓ entre opciones (patrón listbox).
  const onKeyDown = (e) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const opts = [...listRef.current.querySelectorAll("[role=option]")];
    const i = opts.indexOf(document.activeElement);
    const next = e.key === "Home" ? 0 : e.key === "End" ? opts.length - 1 : Math.max(0, Math.min(opts.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)));
    opts[next]?.focus();
  };

  return (
    <div className="qb-pop qb-pop-service" role="dialog" aria-label="Elegir servicio">
      <div className="flex flex-wrap gap-1.5 pb-3" role="group" aria-label="Filtrar por categoría">
        {pills.map((c) => (
          <button key={c} type="button" className="qb-pill" aria-pressed={cat === c} onClick={() => setCat(c)}>
            {c}
          </button>
        ))}
      </div>
      <ul ref={listRef} id={id} role="listbox" aria-label="Servicios" className="qb-list" onKeyDown={onKeyDown}>
        {list.map((s) => {
          const selected = s.id === value;
          return (
            <li key={s.id}>
              <button type="button" role="option" aria-selected={selected} className="qb-option" onClick={() => onPick(s.id)}>
                <span className="qb-check" aria-hidden="true">{selected && <Check size={14} />}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold">{s.name}</span>
                  <span className="mt-0.5 flex items-center gap-1 text-[12px] text-muted">
                    <Clock size={12} aria-hidden="true" /> {formatDuration(s.duration)} · {s.category}
                  </span>
                </span>
                <span className="flex-none text-[13px] font-semibold tabular-nums">{formatCOP(s.price)}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {value && (
        <button type="button" className="qb-clear" onClick={() => onPick("")}>
          <X size={14} aria-hidden="true" /> Quitar selección
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Popover de calendario editorial                                     */
/* ------------------------------------------------------------------ */
function DatePopover({ id, service, services, salon, value, onPick }) {
  const today = todayISO();
  const maxISO = toISODate(addDays(new Date(), MAX_DAYS_AHEAD));
  const [view, setView] = useState(() => {
    const d = value ? parseISODate(value) : new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const gridRef = useRef(null);

  // Punto de disponibilidad: con servicio elegido usa su agenda real; sin servicio, cualquier servicio.
  const days = useMemo(() => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    const count = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    const cells = Array.from({ length: offset }, () => null);
    for (let i = 1; i <= count; i++) {
      const iso = toISODate(new Date(view.getFullYear(), view.getMonth(), i));
      const inRange = iso >= today && iso <= maxISO;
      const pool = service ? [service] : services;
      const available = inRange && !!openingHours(iso) && pool.some((s) => getDaySlots(iso, s).some((x) => x.status !== "busy"));
      cells.push({ iso, day: i, inRange, available });
    }
    return cells;
  }, [view, service, services, salon, today, maxISO]);

  useEffect(() => {
    (gridRef.current?.querySelector('[aria-pressed="true"]') || gridRef.current?.querySelector("button:not(:disabled)"))?.focus();
  }, []);

  const quick = [
    ["Hoy", today],
    ["Mañana", toISODate(addDays(new Date(), 1))],
    ["Este sábado", thisSaturday()],
  ];
  const canPrev = view > new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const canNext = new Date(view.getFullYear(), view.getMonth() + 1, 1) <= parseISODate(maxISO);

  const onKeyDown = (e) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    const cur = document.activeElement?.dataset?.iso;
    if (!step || !cur) return;
    e.preventDefault();
    let d = parseISODate(cur);
    for (let i = 0; i < 6; i++) {
      d = addDays(d, step);
      const el = gridRef.current.querySelector(`button[data-iso="${toISODate(d)}"]:not(:disabled)`);
      if (el) return el.focus();
      if (Math.abs(step) !== 1) break;
    }
  };

  return (
    <div id={id} className="qb-pop qb-pop-date" role="dialog" aria-label="Elegir fecha">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Accesos rápidos">
        {quick.map(([label, iso]) => (
          <button key={label} type="button" className="qb-pill" aria-pressed={value === iso} onClick={() => onPick(iso)}>
            {label}
          </button>
        ))}
      </div>
      <div className="mb-2 mt-4 flex items-center justify-between">
        <button type="button" className="icon-btn !h-9 !w-9" disabled={!canPrev} onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))} aria-label="Mes anterior">
          <ChevronLeft size={18} className={canPrev ? "" : "opacity-30"} aria-hidden="true" />
        </button>
        <p className="font-display text-[15px] font-semibold" aria-live="polite">{formatMonth(view).replace(" de ", " ")}</p>
        <button type="button" className="icon-btn !h-9 !w-9" disabled={!canNext} onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))} aria-label="Mes siguiente">
          <ChevronRight size={18} className={canNext ? "" : "opacity-30"} aria-hidden="true" />
        </button>
      </div>
      <div className="qb-cal" aria-hidden="true">
        {DOW.map((d) => <span key={d} className="qb-dow">{d}</span>)}
      </div>
      <div ref={gridRef} className="qb-cal" role="group" aria-label={`Días de ${formatMonth(view)}`} onKeyDown={onKeyDown}>
        {days.map((d, i) =>
          d ? (
            <button
              key={d.iso}
              type="button"
              className="qb-day"
              data-iso={d.iso}
              data-today={d.iso === today}
              data-available={d.available}
              disabled={!d.inRange}
              aria-pressed={d.iso === value}
              aria-label={`${shortDate(d.iso)}${d.available ? ", con disponibilidad" : ", sin cupos"}`}
              onClick={() => onPick(d.iso)}
            >
              {d.day}
            </button>
          ) : (
            <span key={`e${i}`} aria-hidden="true" />
          ),
        )}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 text-[12px] text-muted">
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-copper" aria-hidden="true" /> Con disponibilidad</span>
        {value ? (
          <button type="button" className="qb-clear !mt-0" onClick={() => onPick("")}>
            <X size={14} aria-hidden="true" /> Lo antes posible
          </button>
        ) : (
          <span className="flex items-center gap-1"><Sparkles size={12} aria-hidden="true" /> {service ? service.name : "Todos los servicios"}</span>
        )}
      </div>
    </div>
  );
}
