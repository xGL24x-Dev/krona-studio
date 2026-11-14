import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, ArrowLeft, ArrowRight, Calendar, CalendarDays, Check, ChevronLeft, ChevronRight, Copy, Sparkles, Timer, UserRoundX, Zap,
} from "lucide-react";
import { Avatar, BrandMark, BrandName, EmptyState, Field, Modal, RatingInline, SmartImage, WhatsAppButton, useApp, useSkeleton } from "../shared/ui.jsx";
import {
  addDays, alternativeStylists, appointmentStart, bestAvailable, createAppointment, currentUser, eligibleStylists, firstAvailableDate, firstName,
  formatCOP, formatDateLong, formatDuration, formatMonth, getDaySlots, getService, getStylist, getStylistStats, listServices, parseISODate,
  rescheduleAppointment, saveBookingIntent, toISODate, todayISO, useSalonState, useSession, validators,
} from "../../services/salonService.js";

const STEPS = ["Servicio", "Fecha y hora", "Especialista", "Confirmar"];
const HOLD_SECONDS = 300;
const MAX_DAYS_AHEAD = 60;
const DOW = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const SLOT_LABEL = { available: "Disponible", last: "Último cupo", busy: "Ocupado" };

export function BookingWizard() {
  const salon = useSalonState();
  const session = useSession();
  const { route, navigate } = useApp();
  const q = route.query;
  const rescheduling = q.reprogramar ? salon.appointments.find((a) => a.id === q.reprogramar && a.status === "confirmada" && session && a.clientId === session.userId) : null;
  const ignoreId = rescheduling?.id;

  const initialStylist = rescheduling?.stylistId || (getStylist(q.stylist)?.active ? q.stylist : "auto");
  const initialService = rescheduling?.serviceId || (getService(q.service)?.type === "service" && getService(q.service)?.active ? q.service : "");
  const [serviceId, setServiceId] = useState(initialService);
  const service = getService(serviceId);
  const [stylistChoice, setStylistChoice] = useState(() => (initialStylist !== "auto" && service && !getStylist(initialStylist).categories.includes(service.category) ? "auto" : initialStylist));
  const stylistOpt = stylistChoice === "auto" ? {} : { stylistId: stylistChoice };
  const [step, setStep] = useState(service ? 2 : 1);
  const [date, setDate] = useState(() => (q.date && q.date >= todayISO() ? q.date : service ? firstAvailableDate(service, { ignoreId, ...stylistOpt }) : todayISO()));
  const [time, setTime] = useState("");
  const [holdUntil, setHoldUntil] = useState(null);
  const [expired, setExpired] = useState(false);
  const [conflict, setConflict] = useState("");
  const [confirmed, setConfirmed] = useState(null);
  const [terms, setTerms] = useState(false);
  const user = session?.role === "client" ? currentUser() : null;
  const [contact, setContact] = useState({
    name: rescheduling?.clientName || user?.name || "",
    phone: rescheduling?.clientPhone || user?.phone || session?.phone || "",
    notes: "",
  });
  const [contactTouched, setContactTouched] = useState(false);
  const headingRef = useRef(null);

  // Agenda específica de la especialista elegida (o combinada si es "Cualquiera").
  const slots = useMemo(() => getDaySlots(date, service, { ignoreId, ...stylistOpt }), [salon, date, service, ignoreId, stylistChoice]); // eslint-disable-line react-hooks/exhaustive-deps
  const slot = slots.find((s) => s.time === time);
  const loadingSlots = useSkeleton([date, serviceId, stylistChoice]);
  const chosen = stylistChoice === "auto" ? null : getStylist(stylistChoice);
  const noSlotsForChosen = chosen && slots.every((s) => s.status === "busy");
  const alternatives = useMemo(() => (noSlotsForChosen ? alternativeStylists(date, service, stylistChoice, ignoreId) : []), [noSlotsForChosen, salon, date, service, stylistChoice, ignoreId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Si otra persona (u otra pestaña) toma el horario, se libera la selección.
  useEffect(() => {
    if (time && step < 4 && !confirmed && (!slot || slot.status === "busy")) {
      setTime("");
      setConflict("El horario que elegiste acaba de ser reservado por otra persona. Elige uno nuevo.");
    }
  }, [slot, time, step, confirmed]);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  const chooseService = (id) => {
    const s = getService(id);
    setServiceId(id);
    setTime("");
    const keep = stylistChoice !== "auto" && getStylist(stylistChoice)?.categories.includes(s.category);
    if (!keep) setStylistChoice("auto");
    setDate(firstAvailableDate(s, { ignoreId, ...(keep ? { stylistId: stylistChoice } : {}) }));
  };

  const chooseStylist = (id) => {
    setStylistChoice(id);
    setConflict("");
    if (time && id !== "auto" && !slot?.free.includes(id)) setTime("");
  };

  const stylistFree = (id) => slot?.free.includes(id);
  const contactErrors = { name: validators.name(contact.name), phone: validators.phone(contact.phone) };
  const contactValid = !contactErrors.name && !contactErrors.phone;
  const canContinue =
    (step === 1 && !!service) ||
    (step === 2 && !!slot && slot.status !== "busy") ||
    (step === 3 && (stylistChoice === "auto" || stylistFree(stylistChoice))) ||
    (step === 4 && terms && contactValid);

  const goTo = (n) => {
    setConflict("");
    if (n === 4) {
      setHoldUntil(Date.now() + HOLD_SECONDS * 1000);
      setExpired(false);
    } else setHoldUntil(null);
    setStep(n);
  };

  const confirm = () => {
    setContactTouched(true);
    if (!terms || !contactValid) return;
    const payload = { serviceId, date, time, stylistId: stylistChoice, clientName: contact.name.trim(), clientPhone: contact.phone.trim(), notes: contact.notes.trim() };
    const res = rescheduling ? rescheduleAppointment(rescheduling.id, payload) : createAppointment(payload);
    if (res.requiresLogin) {
      saveBookingIntent({ service: serviceId, stylist: stylistChoice !== "auto" ? stylistChoice : "", date });
      navigate("/login?role=client&motivo=reservar");
      return;
    }
    if (res.error) {
      setConflict(res.error);
      setTime("");
      goTo(2);
      return;
    }
    setHoldUntil(null);
    setConfirmed(res);
  };

  const assigned = stylistChoice === "auto" ? (slot ? bestAvailable(slot.free) : null) : chosen;
  const servicesForStep1 = listServices({ type: "service" }).filter((s) => !chosen || chosen.categories.includes(s.category));

  return (
    <div className="container-x pb-6 pt-8 md:pt-12">
      <div className="mx-auto max-w-[960px]">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="kicker">{rescheduling ? `Reagendar · ${rescheduling.code}` : chosen ? `Reserva con ${chosen.name}` : "Nueva reserva"}</span>
            <p className="mt-1 text-[13px] text-muted">Paso {step} de 4 · {STEPS[step - 1]}</p>
          </div>
          {step === 4 && holdUntil && <HoldTimer until={holdUntil} onExpire={() => { setHoldUntil(null); setExpired(true); }} />}
        </div>

        <ol className="stepper" aria-label="Progreso de la reserva">
          {STEPS.map((s, i) => {
            const n = i + 1;
            const st = n < step ? "done" : n === step ? "current" : "todo";
            return (
              <li key={s} data-state={st} aria-current={st === "current" ? "step" : undefined}>
                <div className="bar" />
                <p>
                  <span className="sr-only">{st === "done" ? "Completado: " : st === "current" ? "Paso actual: " : "Pendiente: "}</span>
                  <span className="hidden sm:inline">{n}. </span>{s}
                </p>
              </li>
            );
          })}
        </ol>

        {conflict && (
          <div className="notice notice-alert mt-6" role="alert">
            <AlertTriangle size={18} className="mt-0.5 flex-none" aria-hidden="true" /> {conflict}
          </div>
        )}

        <section className="view-enter mt-10" key={step} aria-labelledby="step-title">
          {step === 1 && (
            <div>
              <StepHeading headingRef={headingRef} title="¿Qué servicio deseas?" text={chosen ? `Mostramos los servicios que realiza ${chosen.name}.` : "Confirma o cambia el servicio. Siempre puedes ajustarlo en el resumen."} />
              {chosen && (
                <div className="notice mb-5 items-center">
                  <Avatar person={chosen} size={36} />
                  <span className="flex-1">Reservando con <b className="text-ink">{chosen.name}</b> · {chosen.specialty}</span>
                  <button type="button" className="text-btn" onClick={() => setStylistChoice("auto")}>Ver todos los servicios</button>
                </div>
              )}
              <div role="radiogroup" aria-label="Servicio" className="grid gap-3 md:grid-cols-2">
                {servicesForStep1.map((s) => (
                  <button key={s.id} type="button" role="radio" aria-checked={s.id === serviceId} className="option-card" onClick={() => chooseService(s.id)}>
                    <span className="h-16 w-16 flex-none overflow-hidden bg-sand" aria-hidden="true"><SmartImage src={s.image} alt="" className="h-full w-full object-cover" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-semibold">{s.name}</span>
                      <span className="mt-0.5 block text-[13px] text-muted">{formatDuration(s.duration)} · {s.category}</span>
                      <span className="mt-1 block text-[14px] font-semibold">{formatCOP(s.price)}</span>
                    </span>
                    <span className="radio" aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && service && (
            <div>
              <StepHeading headingRef={headingRef} title="Elige fecha y hora" text={`${service.name} · ${formatDuration(service.duration)}. ${chosen ? `Estás viendo la agenda individual de ${firstName(chosen.name)}.` : "Te mostramos el día disponible más cercano."}`} />

              <div className="mb-6">
                <p className="field-label mb-2" id="agenda-of">Agenda de</p>
                <div role="radiogroup" aria-labelledby="agenda-of" className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:flex-wrap md:px-0">
                  <button type="button" role="radio" aria-checked={stylistChoice === "auto"} className="chip-stylist" onClick={() => chooseStylist("auto")}>
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-ink text-white" aria-hidden="true"><Zap size={15} /></span>
                    Cualquiera <small>más rápida</small>
                  </button>
                  {eligibleStylists(service).map((st) => (
                    <button key={st.id} type="button" role="radio" aria-checked={stylistChoice === st.id} className="chip-stylist" onClick={() => chooseStylist(st.id)}>
                      <Avatar person={st} size={32} />
                      {firstName(st.name)}
                      <small>{getStylistStats(st.id).rating ? `★ ${getStylistStats(st.id).rating.toFixed(1)}` : "Nueva"}</small>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-8 lg:grid-cols-[340px_minmax(0,1fr)]">
                <MonthCalendar salon={salon} service={service} opts={{ ignoreId, ...stylistOpt }} value={date} onChange={(d) => { setDate(d); setTime(""); setConflict(""); }} />
                <div className="min-w-0">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-[16px] font-semibold">{formatDateLong(date)}{chosen ? ` · ${firstName(chosen.name)}` : ""}</h3>
                    <ul className="flex flex-wrap gap-3 text-[12px] text-muted" aria-label="Leyenda de horarios">
                      <li className="flex items-center gap-1.5"><i className="h-3 w-3 border border-[#d4d4d8] bg-white" aria-hidden="true" /> Disponible</li>
                      <li className="flex items-center gap-1.5"><i className="h-3 w-3 border border-[#e0b98a] bg-[#fffaf3]" aria-hidden="true" /> Último cupo</li>
                      <li className="flex items-center gap-1.5"><i className="h-3 w-3 bg-[#e4e4e7]" aria-hidden="true" /> Ocupado</li>
                    </ul>
                  </div>
                  {loadingSlots ? (
                    <div className="slot-grid" aria-busy="true" aria-label="Cargando horarios">
                      {Array.from({ length: 12 }, (_, i) => <div key={i} className="shimmer h-14 rounded" />)}
                    </div>
                  ) : noSlotsForChosen ? (
                    <div className="view-enter">
                      <div className="notice notice-alert" role="alert">
                        <UserRoundX size={18} className="mt-0.5 flex-none" aria-hidden="true" />
                        <span><b>{chosen.name}</b> no tiene cupos disponibles el {formatDateLong(date).toLowerCase()}.{alternatives.length ? " Estas especialistas sí pueden atenderte ese mismo día:" : ""}</span>
                      </div>
                      {alternatives.length > 0 ? (
                        <ul className="mt-4 grid gap-3 xl:grid-cols-2">
                          {alternatives.map(({ stylist, freeSlots }) => (
                            <li key={stylist.id} className="panel flex items-center gap-3 p-4">
                              <Avatar person={stylist} size={46} />
                              <div className="min-w-0 flex-1">
                                <p className="text-[15px] font-semibold">{stylist.name}</p>
                                <RatingInline stats={getStylistStats(stylist.id)} />
                                <p className="mt-0.5 text-[12px] text-success">{freeSlots.length} horarios libres · desde {freeSlots[0].time}</p>
                              </div>
                              <button type="button" className="btn btn-secondary btn-sm" onClick={() => chooseStylist(stylist.id)} aria-label={`Cambiar a ${stylist.name}`}>
                                Cambiar
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-4 text-[14px] text-muted">Ninguna otra especialista tiene cupos ese día.</p>
                      )}
                      <button type="button" className="btn btn-ghost mt-4" onClick={() => setDate(firstAvailableDate(service, { ignoreId, ...stylistOpt }, addDays(parseISODate(date), 1)))}>
                        <CalendarDays size={17} aria-hidden="true" /> Siguiente día libre de {firstName(chosen.name)}
                      </button>
                    </div>
                  ) : slots.length === 0 || slots.every((s) => s.status === "busy") ? (
                    <EmptyState icon={CalendarDays} title={slots.length ? "Día completo" : "Cerrado este día"} text="No quedan cupos para este servicio en la fecha elegida."
                      action={<button type="button" className="btn btn-secondary" onClick={() => setDate(firstAvailableDate(service, { ignoreId }, addDays(parseISODate(date), 1)))}>Ir al siguiente día disponible</button>} />
                  ) : (
                    <div className="slot-grid view-enter" role="group" aria-label={`Horarios para ${formatDateLong(date)}`}>
                      {slots.map((s) => (
                        <button key={s.time} type="button" className="slot" data-status={s.status} disabled={s.status === "busy"} aria-pressed={s.time === time} aria-label={`${s.time}, ${SLOT_LABEL[s.status]}`} onClick={() => { setTime(s.time); setConflict(""); }}>
                          {s.time}
                          <small aria-hidden="true">{SLOT_LABEL[s.status]}</small>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 3 && service && slot && (
            <div>
              <StepHeading headingRef={headingRef} title="¿Con quién te gustaría?" text={`${formatDateLong(date)} a las ${time}. Solo mostramos especialistas en ${service.category.toLowerCase()}.`} />
              <div role="radiogroup" aria-label="Especialista" className="flex flex-col gap-3">
                <button type="button" role="radio" aria-checked={stylistChoice === "auto"} className="option-card auto-card" onClick={() => setStylistChoice("auto")}>
                  <span className="grid h-12 w-12 flex-none place-items-center rounded-full bg-ink text-white" aria-hidden="true"><Zap size={20} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2 text-[15px] font-semibold">Sin preferencia <span className="status tone-success !py-0.5 text-[11px]">Recomendado</span></span>
                    <span className="mt-1 block text-[13px] text-muted">Asignación automática más rápida: la especialista libre mejor calificada.</span>
                  </span>
                  <span className="radio" aria-hidden="true" />
                </button>
                <div className="grid gap-3 md:grid-cols-2">
                  {eligibleStylists(service).map((st) => {
                    const free = stylistFree(st.id);
                    return (
                      <button key={st.id} type="button" role="radio" aria-checked={stylistChoice === st.id} disabled={!free} className="option-card" onClick={() => setStylistChoice(st.id)}>
                        <Avatar person={st} size={48} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[15px] font-semibold">{st.name}</span>
                          <span className="block text-[13px] text-muted">{st.specialty}</span>
                          <span className="mt-1.5 block"><RatingInline stats={getStylistStats(st.id)} /></span>
                          {!free && <span className="mt-1 block text-[12px] font-semibold text-error">No disponible a las {time}</span>}
                        </span>
                        <span className="radio" aria-hidden="true" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {step === 4 && service && (
            <div>
              <StepHeading headingRef={headingRef} title={rescheduling ? "Confirma el nuevo horario" : "Revisa y confirma"} text="Guardamos tu horario durante 5 minutos mientras confirmas." />
              <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
                <dl className="panel px-6">
                  <SummaryRow label="Servicio" value={`${service.name} · ${formatCOP(service.price)}`} onEdit={rescheduling ? null : () => goTo(1)} />
                  <SummaryRow label="Fecha y hora" value={`${formatDateLong(date)} · ${time}`} onEdit={() => goTo(2)} />
                  <SummaryRow label="Especialista" value={stylistChoice === "auto" ? `Asignación automática${assigned ? ` (${assigned.name})` : ""}` : assigned?.name} onEdit={() => goTo(3)} />
                  <SummaryRow label="Duración" value={formatDuration(service.duration)} />
                  <div className="flex items-center justify-between py-5">
                    <dt className="font-display text-[16px] font-semibold">Total a pagar en el salón</dt>
                    <dd className="font-display text-[22px] font-semibold">{formatCOP(service.price)}</dd>
                  </div>
                </dl>
                <div className="flex flex-col gap-4">
                  <Field label="Nombre para la reserva" autoComplete="name" value={contact.name} onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))} onBlur={() => setContactTouched(true)} error={contactTouched ? contactErrors.name : ""} required />
                  <Field label="Celular / WhatsApp" type="tel" autoComplete="tel" value={contact.phone} onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))} onBlur={() => setContactTouched(true)} error={contactTouched ? contactErrors.phone : ""} hint="Te enviaremos la confirmación y el enlace para calificar." required />
                  <Field as="textarea" label="Notas para tu especialista (opcional)" value={contact.notes} onChange={(e) => setContact((c) => ({ ...c, notes: e.target.value }))} placeholder="Ej. traigo foto de referencia" />
                  <label className="check !items-start !text-ink">
                    <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5" />
                    <span>Acepto los <a href="#/ayuda" className="link">términos</a> y la política de cancelación: {salon.brand.cancellationPolicy.charAt(0).toLowerCase()}{salon.brand.cancellationPolicy.slice(1)}.</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </section>

        <div className="sticky-cta mt-10">
          <div className="flex items-center justify-between gap-3">
            {step > 1 && !(rescheduling && step === 2) ? (
              <button type="button" className="btn btn-ghost" onClick={() => goTo(step - 1)}><ArrowLeft size={18} aria-hidden="true" /> Atrás</button>
            ) : (
              <button type="button" className="btn btn-ghost" onClick={() => navigate(rescheduling ? "/cliente/citas" : "/servicios")}><ArrowLeft size={18} aria-hidden="true" /> {rescheduling ? "Mis citas" : "Catálogo"}</button>
            )}
            {step < 4 ? (
              <button type="button" className="btn btn-primary min-w-[160px] flex-1 sm:flex-none" disabled={!canContinue} onClick={() => goTo(step + 1)}>
                Continuar <ArrowRight size={18} aria-hidden="true" />
              </button>
            ) : (
              <button type="button" className="btn btn-primary min-w-[200px] flex-1 sm:flex-none" disabled={!canContinue || !holdUntil} onClick={confirm}>
                <Check size={18} aria-hidden="true" /> {rescheduling ? "Confirmar cambio" : "Confirmar reserva"}
              </button>
            )}
          </div>
        </div>
      </div>

      <Modal open={expired} onClose={() => { setExpired(false); setTime(""); goTo(2); }} title="Tu tiempo de reserva expiró" description="Pasaron 5 minutos sin confirmar, así que liberamos el cupo para otros clientes.">
        <div className="notice notice-alert"><Timer size={18} className="mt-0.5 flex-none" aria-hidden="true" />Tu servicio y especialista siguen seleccionados. Solo elige un nuevo horario.</div>
        <button type="button" className="btn btn-primary btn-full mt-5" data-autofocus onClick={() => { setExpired(false); setTime(""); goTo(2); }}>Elegir nuevo horario</button>
      </Modal>

      {confirmed && <ConfirmationModal result={confirmed} rescheduled={!!rescheduling} />}
    </div>
  );
}

function StepHeading({ headingRef, title, text }) {
  return (
    <div className="mb-8">
      <h1 id="step-title" ref={headingRef} tabIndex={-1} className="text-[clamp(26px,3.2vw,34px)] font-semibold tracking-[-0.035em] outline-none">{title}</h1>
      {text && <p className="mt-2 text-[15px] text-muted">{text}</p>}
    </div>
  );
}

function SummaryRow({ label, value, onEdit }) {
  return (
    <div className="summary-row">
      <div><dt>{label}</dt><dd>{value}</dd></div>
      {onEdit && <button type="button" className="text-btn" onClick={onEdit} aria-label={`Cambiar ${label.toLowerCase()}`}>Cambiar</button>}
    </div>
  );
}

/* Calendario mensual (refleja la agenda de la especialista elegida) */
function MonthCalendar({ salon, service, opts, value, onChange }) {
  const today = todayISO();
  const maxISO = toISODate(addDays(new Date(), MAX_DAYS_AHEAD));
  const [view, setView] = useState(() => {
    const d = parseISODate(value);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  useEffect(() => {
    const d = parseISODate(value);
    setView((v) => (v.getMonth() === d.getMonth() && v.getFullYear() === d.getFullYear() ? v : new Date(d.getFullYear(), d.getMonth(), 1)));
  }, [value]);
  const gridRef = useRef(null);
  const optKey = JSON.stringify(opts);

  const days = useMemo(() => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    const count = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    const list = Array.from({ length: offset }, () => null);
    for (let i = 1; i <= count; i++) {
      const iso = toISODate(new Date(view.getFullYear(), view.getMonth(), i));
      const inRange = iso >= today && iso <= maxISO;
      list.push({ iso, day: i, available: inRange && getDaySlots(iso, service, opts).some((s) => s.status !== "busy") });
    }
    return list;
  }, [view, salon, service, optKey, today, maxISO]); // eslint-disable-line react-hooks/exhaustive-deps

  const monthLabel = formatMonth(view);
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
    <div className="calendar panel min-w-0 p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between">
        <button type="button" className="icon-btn" disabled={!canPrev} onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))} aria-label="Mes anterior">
          <ChevronLeft size={20} aria-hidden="true" className={canPrev ? "" : "opacity-30"} />
        </button>
        <h3 className="text-[15px] font-semibold" aria-live="polite">{monthLabel}</h3>
        <button type="button" className="icon-btn" disabled={!canNext} onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))} aria-label="Mes siguiente">
          <ChevronRight size={20} aria-hidden="true" className={canNext ? "" : "opacity-30"} />
        </button>
      </div>
      <div className="cal-grid" aria-hidden="true">{DOW.map((d) => <span key={d} className="cal-dow">{d}</span>)}</div>
      <div className="cal-grid" ref={gridRef} role="group" aria-label={`Días de ${monthLabel}`} onKeyDown={onKeyDown}>
        {days.map((d, i) =>
          d ? (
            <button key={d.iso} type="button" className="cal-day" data-iso={d.iso} data-today={d.iso === today} data-available={d.available} disabled={!d.available} aria-pressed={d.iso === value} aria-label={`${formatDateLong(d.iso)}${d.available ? ", con cupos" : ", sin cupos"}`} onClick={() => onChange(d.iso)}>
              {d.day}
            </button>
          ) : (
            <span key={`e${i}`} aria-hidden="true" />
          ),
        )}
      </div>
      <p className="mt-3 flex items-center gap-2 text-[12px] text-muted"><span className="h-1.5 w-1.5 rounded-full bg-copper" aria-hidden="true" /> Días con cupos disponibles</p>
    </div>
  );
}

function HoldTimer({ until, onExpire }) {
  const [left, setLeft] = useState(() => Math.max(0, Math.round((until - Date.now()) / 1000)));
  const expireRef = useRef(onExpire);
  expireRef.current = onExpire;
  useEffect(() => {
    const tick = () => {
      const s = Math.max(0, Math.round((until - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) expireRef.current();
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [until]);
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  return (
    <div className="flex items-center gap-3">
      <span className="hidden text-[13px] text-muted sm:inline">Cupo reservado por</span>
      <span className="timer" data-warn={left <= 60} role="timer" aria-label={`Tiempo restante ${mm} minutos ${ss} segundos`}><Timer size={16} aria-hidden="true" /> {mm}:{ss}</span>
      <span className="sr-only" aria-live="assertive">{left === 60 ? "Queda 1 minuto para confirmar tu reserva." : left === 0 ? "El tiempo expiró." : ""}</span>
    </div>
  );
}

/* Comprobante de reserva con marca blanca, QR y aviso por WhatsApp */
function ConfirmationModal({ result, rescheduled }) {
  const { navigate } = useApp();
  const session = useSession();
  const { appointment, stylistWhatsAppUrl } = result;
  const { brand } = useSalonState();
  const [copied, setCopied] = useState(false);
  const service = getService(appointment.serviceId);
  const stylist = getStylist(appointment.stylistId);
  const done = () => navigate(session ? "/cliente/citas" : "/");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(appointment.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* portapapeles no disponible */
    }
  };

  const downloadICS = () => {
    const start = appointmentStart(appointment);
    const end = new Date(start.getTime() + appointment.duration * 60000);
    const f = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//AppSalon//ES", "BEGIN:VEVENT", `UID:${appointment.id}@appsalon`, `DTSTAMP:${f(new Date())}`, `DTSTART:${f(start)}`, `DTEND:${f(end)}`, `SUMMARY:${service?.name}`, `DESCRIPTION:Código ${appointment.code} · ${stylist?.name}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    Object.assign(document.createElement("a"), { href: url, download: `${appointment.code}.ics` }).click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal open onClose={done} title={rescheduled ? "¡Cita reagendada!" : "¡Reserva confirmada!"} description="Guarda tu comprobante. Te avisaremos por la app y WhatsApp." size="dialog-lg">
      <div className="mb-5 flex items-center gap-3 border-b border-line pb-4">
        <BrandMark size={40} />
        <div className="logo !min-h-0 !text-[15px]"><BrandName /></div>
        <span className="ml-auto text-right text-[12px] font-semibold uppercase tracking-[0.1em] text-subtle">
          Comprobante
          {brand.nit && <span className="block text-[11px] font-normal normal-case tracking-normal">NIT {brand.nit}</span>}
        </span>
      </div>
      <div className="grid items-center gap-6 sm:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-center">
          <PseudoQR value={appointment.code} />
          <p className="mt-2 text-[12px] text-muted">Preséntalo al llegar</p>
        </div>
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-subtle">Código de reserva</p>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="font-display text-[30px] font-semibold tracking-[0.02em]">{appointment.code}</span>
            <button type="button" className="icon-btn" onClick={copy} aria-label="Copiar código de reserva">
              {copied ? <Check size={18} className="text-success" aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
            </button>
            <span className="sr-only" aria-live="polite">{copied ? "Código copiado" : ""}</span>
          </div>
          <dl className="mt-4 grid gap-2.5 text-[14px]">
            <div className="flex gap-2"><dt className="sr-only">Servicio</dt><Sparkles size={16} className="mt-0.5 text-copper-dark" aria-hidden="true" /><dd><b>{service?.name}</b> · {formatCOP(appointment.price)}</dd></div>
            <div className="flex gap-2"><dt className="sr-only">Fecha</dt><Calendar size={16} className="mt-0.5 text-copper-dark" aria-hidden="true" /><dd>{formatDateLong(appointment.date)} · {appointment.time}</dd></div>
            <div className="flex items-center gap-2"><dt className="sr-only">Especialista</dt><Avatar person={stylist} size={22} /><dd>{stylist?.name}</dd></div>
          </dl>
        </div>
      </div>
      <div className="mt-6 flex flex-col gap-2.5">
        <WhatsAppButton href={stylistWhatsAppUrl} className="btn btn-full wa-solid">
          Notificar a {firstName(stylist?.name)} por WhatsApp
        </WhatsAppButton>
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <button type="button" className="btn btn-primary flex-1" onClick={done} data-autofocus>{session ? "Ver mis citas" : "Volver al inicio"}</button>
          <button type="button" className="btn btn-secondary flex-1" onClick={downloadICS}><CalendarDays size={18} aria-hidden="true" /> Añadir al calendario</button>
        </div>
      </div>
    </Modal>
  );
}

/** Código visual tipo QR determinista (sin dependencias, no escaneable). */
export function PseudoQR({ value }) {
  const N = 25;
  const cells = useMemo(() => {
    let h = 2166136261;
    const bits = [];
    for (let i = 0; i < N * N; i++) {
      h ^= value.charCodeAt(i % value.length) + i;
      h = Math.imul(h, 16777619) >>> 0;
      bits.push((h >>> 7) & 1);
    }
    return bits;
  }, [value]);
  const finder = (x, y) => {
    for (const [ox, oy] of [[0, 0], [N - 7, 0], [0, N - 7]]) {
      if (x >= ox && x < ox + 7 && y >= oy && y < oy + 7) {
        const dx = x - ox, dy = y - oy;
        return dx === 0 || dy === 0 || dx === 6 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4) ? 1 : 0;
      }
      if (x >= ox - 1 && x <= ox + 7 && y >= oy - 1 && y <= oy + 7) return 0;
    }
    return null;
  };
  const rects = [];
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const f = finder(x, y);
      if (f === 1 || (f === null && cells[y * N + x])) rects.push(<rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" />);
    }
  return (
    <svg className="qr" viewBox={`0 0 ${N} ${N}`} role="img" aria-label={`Código QR de la reserva ${value}`} shapeRendering="crispEdges">
      <g fill="#18181B">{rects}</g>
    </svg>
  );
}
