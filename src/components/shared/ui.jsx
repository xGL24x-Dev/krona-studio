/* Primitivas de UI compartidas por la tienda pública y los paneles internos. */
import { createContext, useContext, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, Check, CheckCircle2, Eye, EyeOff, ImagePlus, Info, MessageCircle, Star, Trash2, TriangleAlert, Upload, X, Calendar } from "lucide-react";
import {
  IMAGE_PRESETS, STATUS_META, compressImage, dismissNotification, initials, markAllRead, useSalonState, useSession, visibleNotifications,
} from "../../services/salonService.js";

/* ------------------------------------------------------------------ */
/* Contexto de navegación / UI (lo provee App.jsx)                     */
/* ------------------------------------------------------------------ */
export const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

export function Link({ to, children, className, onClick, ...rest }) {
  const { navigate, route } = useApp();
  return (
    <a
      href={`#${to}`}
      className={className}
      aria-current={route.path === to.split("?")[0] ? "page" : undefined}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        onClick?.(e);
        navigate(to);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}

/* ------------------------------------------------------------------ */
/* Marca blanca: logo + nombre del negocio                             */
/* ------------------------------------------------------------------ */
/**
 * Isotipo por defecto de KRONA Studio (reloj + K). Se usa cuando la empresa
 * no ha subido su propio logo en "Mi Local".
 * dark = variante para fondos oscuros (sidebars de los paneles internos).
 */
export function BrandLogo({ dark = false, size = 36, className = "" }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={`w-9 h-9 shrink-0 ${className}`} style={{ width: size, height: size }} aria-hidden="true" focusable="false">
      <rect x="1.5" y="1.5" width="37" height="37" rx="11" fill={dark ? "#18181B" : "#FAF8F5"} stroke={dark ? "#FFFFFF" : "#18181B"} strokeOpacity={dark ? "0.18" : "0.14"} strokeWidth="1.2" />
      <circle cx="20" cy="20" r="12" stroke={dark ? "#FAF8F5" : "#18181B"} strokeWidth="1.6" />
      <path d="M20 6V8.2M20 31.8V34M6 20H8.2M31.8 20H34" stroke={dark ? "#C27D48" : "#9A5B2C"} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M16.5 13.5V26.5" stroke={dark ? "#FAF8F5" : "#18181B"} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M24.5 14L17.2 20L24.5 26" stroke={dark ? "#C27D48" : "#9A5B2C"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="16.8" cy="20" r="1.6" fill={dark ? "#C27D48" : "#9A5B2C"} />
    </svg>
  );
}

/** Logo de la marca: imagen subida en "Mi Local" o, por defecto, el isotipo KRONA. */
export function BrandMark({ size = 36, light = false, dark = false }) {
  const { brand } = useSalonState();
  if (brand.logo)
    return <img src={brand.logo} alt="" width={size} height={size} className="flex-none rounded-full object-cover" style={{ width: size, height: size, background: light || dark ? "#fff" : "transparent" }} />;
  return <BrandLogo dark={dark} size={size} />;
}

/** Marca tipográfica: primeras palabras en negrita y la última en acento terracota (p. ej. KRONA Studio). */
export function BrandName() {
  const { brand } = useSalonState();
  const words = brand.name.trim().split(/\s+/);
  if (words.length < 2) return <span className="font-bold">{brand.name}</span>;
  const head = words.slice(0, -1).join(" ");
  return (
    <span>
      <span className={`font-bold ${head === head.toUpperCase() ? "tracking-[0.06em]" : ""}`}>{head}</span> <b className="font-medium">{words[words.length - 1]}</b>
    </span>
  );
}

export function Logo({ light = false, dark = false, to = "/" }) {
  const { navigate } = useApp();
  const { brand } = useSalonState();
  return (
    <a
      href={`#${to}`}
      className={`logo ${light ? "logo-light" : ""}`}
      aria-label={`${brand.name}, ir al inicio`}
      onClick={(e) => {
        e.preventDefault();
        navigate(to);
      }}
    >
      <BrandMark light={light} dark={dark} />
      <span aria-hidden="true" className="truncate">
        <BrandName />
      </span>
    </a>
  );
}

/* ------------------------------------------------------------------ */
/* Modal / Drawer accesible                                            */
/* ------------------------------------------------------------------ */
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({ open, onClose, title, description, children, size = "", variant = "dialog", dismissable = true }) {
  const ref = useRef(null);
  const titleId = useId();
  const descId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    const node = ref.current;
    (node?.querySelector("[data-autofocus]") || node?.querySelector(FOCUSABLE) || node)?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape" && dismissable) {
        e.stopPropagation();
        onCloseRef.current?.();
      }
      if (e.key === "Tab" && node) {
        const items = [...node.querySelectorAll(FOCUSABLE)];
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open, dismissable]);

  if (!open) return null;
  const isDrawer = variant === "drawer";
  return createPortal(
    <div className={`overlay ${isDrawer ? "drawer-overlay" : ""}`} onMouseDown={(e) => dismissable && e.target === e.currentTarget && onClose?.()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descId : undefined} tabIndex={-1} className={isDrawer ? "drawer" : `dialog ${size}`}>
        <div className="dialog-head">
          <div className="min-w-0">
            <h2 id={titleId}>{title}</h2>
            {description && (
              <p id={descId} className="mt-1.5 text-[14px] leading-relaxed text-muted">
                {description}
              </p>
            )}
          </div>
          {dismissable && (
            <button type="button" className="icon-btn -mr-2 -mt-2 flex-none" onClick={onClose} aria-label="Cerrar">
              <X size={20} aria-hidden="true" />
            </button>
          )}
        </div>
        <div className={isDrawer ? "dialog-body flex-1 overflow-y-auto" : "dialog-body"}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({ open, title, description, confirmLabel = "Confirmar", danger = false, onConfirm, onClose }) {
  return (
    <Modal open={open} onClose={onClose} title={title} description={description}>
      <div className="flex flex-col-reverse gap-2.5 sm:flex-row">
        <button type="button" className="btn btn-secondary flex-1" onClick={onClose} data-autofocus>
          Cancelar
        </button>
        <button type="button" className={`btn flex-1 ${danger ? "btn-danger" : "btn-primary"}`} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Notificaciones en vivo                                              */
/* ------------------------------------------------------------------ */
const timeAgo = (ts) => {
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return "hace unos segundos";
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
};

export function useNotifications() {
  useSalonState();
  useSession();
  const list = visibleNotifications();
  return { list, unread: list.filter((n) => !n.read).length };
}

export function BellButton({ className = "icon-btn" }) {
  const { openDrawer } = useApp();
  const { unread } = useNotifications();
  return (
    <button type="button" className={className} onClick={openDrawer} aria-label={`Notificaciones${unread ? `, ${unread} sin leer` : ""}`} aria-haspopup="dialog">
      <Bell size={20} aria-hidden="true" />
      {unread > 0 && (
        <span className="badge-dot" aria-hidden="true">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </button>
  );
}

export function NotificationsDrawer() {
  const { drawerOpen, closeDrawer, navigate } = useApp();
  const { list, unread } = useNotifications();
  return (
    <Modal open={drawerOpen} onClose={closeDrawer} title="Notificaciones" variant="drawer" description="Actualizaciones en tiempo real.">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-[13px] text-muted" aria-live="polite">
          {unread} sin leer
        </span>
        <button type="button" className="text-btn" onClick={markAllRead}>
          <Check size={16} aria-hidden="true" /> Marcar todo como leído
        </button>
      </div>
      {list.length === 0 ? (
        <EmptyState icon={Bell} title="Todo al día" text="Te avisaremos cuando haya novedades." />
      ) : (
        <ul className="flex flex-col gap-2.5">
          {list.map((n) => (
            <li key={n.id} className={`panel relative p-4 pr-12 ${n.read ? "" : "border-l-2 !border-l-copper"}`}>
              <p className="flex items-center gap-2 text-[14px] font-semibold">
                {!n.read && <span className="h-2 w-2 flex-none rounded-full bg-copper-dark" aria-label="Sin leer" />}
                {n.kind === "review" && <Star size={14} className="text-copper" fill="currentColor" aria-hidden="true" />}
                {n.title}
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">{n.body}</p>
              <p className="mt-2 text-[12px] text-subtle">{timeAgo(n.createdAt)}</p>
              {n.link && (
                <button
                  type="button"
                  className={n.kind === "review" ? "btn btn-primary btn-sm mt-2" : "text-btn mt-1"}
                  onClick={() => {
                    closeDrawer();
                    navigate(n.link);
                  }}
                >
                  {n.kind === "review" ? "Calificar ahora" : "Ver detalle"}
                </button>
              )}
              <button type="button" className="icon-btn absolute right-1 top-1 !h-10 !w-10" onClick={() => dismissNotification(n.id)} aria-label={`Descartar notificación: ${n.title}`}>
                <X size={16} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

export function Toasts({ toasts }) {
  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.tone === "error" ? "!bg-error" : ""}`}>
          {t.tone === "error" ? (
            <TriangleAlert size={18} className="flex-none" aria-hidden="true" />
          ) : t.tone === "info" ? (
            <Info size={18} className="flex-none text-[#e3a879]" aria-hidden="true" />
          ) : (
            <CheckCircle2 size={18} className="flex-none text-[#86efac]" aria-hidden="true" />
          )}
          {t.message}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Átomos                                                              */
/* ------------------------------------------------------------------ */
export function SmartImage({ src, alt = "", className = "", ...rest }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (failed || !src) {
    return (
      <div role={alt ? "img" : undefined} aria-label={alt || undefined} className={`grid h-full w-full place-items-center bg-[linear-gradient(135deg,#ebe4dc,#f6f1ea)] text-copper-dark ${className}`}>
        <ImagePlus size={28} aria-hidden="true" className="opacity-60" />
      </div>
    );
  }
  return <img src={src} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} className={className} {...rest} />;
}

export function Avatar({ person, size = 38, className = "" }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [person?.photo]);
  if (person?.photo && !failed)
    return <img src={person.photo} alt="" width={size} height={size} onError={() => setFailed(true)} className={`flex-none rounded-full object-cover ${className}`} style={{ width: size, height: size }} />;
  return (
    <span className={`avatar ${className}`} style={{ width: size, height: size, fontSize: Math.max(10, size * 0.32) }} aria-hidden="true">
      {initials(person?.name)}
    </span>
  );
}

export function Stars({ value = 5, size = 14, label = true }) {
  const rounded = Math.round(value || 0);
  return (
    <span className="inline-flex items-center gap-0.5 text-copper" role={label ? "img" : undefined} aria-label={label ? `${value || 0} de 5 estrellas` : undefined}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} fill={i <= rounded ? "currentColor" : "none"} aria-hidden="true" />
      ))}
    </span>
  );
}

/** Calificación dinámica de una especialista (o "Nueva" si aún no tiene reseñas). */
export function RatingInline({ stats, size = 12 }) {
  if (!stats.rating) return <span className="status tone-copper !py-0.5 text-[11px]">Nueva</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold">
      <Stars value={stats.rating} size={size} /> {stats.rating.toFixed(1)}
      <span className="font-normal text-muted">({stats.reviews})</span>
    </span>
  );
}

export function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.confirmada;
  return <span className={`status tone-${meta.tone}`}>{meta.label}</span>;
}

export function EmptyState({ icon: Icon = Calendar, title, text, action }) {
  return (
    <div className="panel flex flex-col items-center px-6 py-12 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-full bg-sand text-copper-dark">
        <Icon size={24} aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-[18px] font-semibold">{title}</h3>
      <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-muted">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ServiceCardSkeleton() {
  return (
    <div className="panel" aria-hidden="true">
      <div className="shimmer h-[220px]" />
      <div className="p-[22px]">
        <div className="shimmer h-4 w-2/3" />
        <div className="shimmer mt-3 h-3 w-1/2" />
        <div className="mt-6 flex justify-between border-t border-line pt-5">
          <div className="shimmer h-4 w-24" />
          <div className="shimmer h-4 w-16" />
        </div>
      </div>
    </div>
  );
}

export function PageHeader({ kicker, title, children, actions }) {
  return (
    <div className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
      <div>
        {kicker && <span className="kicker">{kicker}</span>}
        <h1 className="page-title mt-3" tabIndex={-1} data-page-title>
          {title}
        </h1>
        {children && <p className="lead mt-3 max-w-2xl">{children}</p>}
      </div>
      {actions}
    </div>
  );
}

/** Skeleton breve (250ms) al cambiar filtros o fechas. */
export function useSkeleton(deps, ms = 250) {
  const [loading, setLoading] = useState(false);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setLoading(true);
    const t = setTimeout(() => setLoading(false), ms);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return loading;
}

/* ------------------------------------------------------------------ */
/* Formularios                                                         */
/* ------------------------------------------------------------------ */
export function Field({ label, error, hint, valid, suffix, inputRef, as = "input", children, className = "", ...props }) {
  const id = useId();
  const hintId = `${id}-hint`;
  const Tag = as;
  return (
    <div className={`field ${error ? "field-error" : valid ? "field-valid" : ""} ${className}`}>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <span className="input-wrap">
        <Tag id={id} ref={inputRef} aria-invalid={error ? true : undefined} aria-describedby={error || hint ? hintId : undefined} {...props}>
          {children}
        </Tag>
        {suffix ||
          (valid && !error && (
            <span className="valid-icon" aria-hidden="true">
              <Check size={16} />
            </span>
          ))}
      </span>
      {(error || hint) && (
        <span id={hintId} className="field-hint" role={error ? "alert" : undefined}>
          {error || hint}
        </span>
      )}
    </div>
  );
}

export function PasswordToggle({ show, setShow }) {
  return (
    <button type="button" className="input-icon" onClick={() => setShow((s) => !s)} aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={show}>
      {show ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
    </button>
  );
}

export function Switch({ checked, onChange, label, description, icon: Icon }) {
  const id = useId();
  return (
    <div className="flex items-center gap-4 py-4">
      {Icon && (
        <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-sand text-copper-dark" aria-hidden="true">
          <Icon size={18} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p id={id} className="text-[15px] font-semibold">
          {label}
        </p>
        {description && <p className="text-[13px] text-muted">{description}</p>}
      </div>
      <button type="button" role="switch" aria-checked={checked} aria-labelledby={id} className="switch" onClick={() => onChange(!checked)} />
    </div>
  );
}

/**
 * Subida de imagen desde el dispositivo con compresión Canvas automática.
 * preset: photo | avatar | logo | cover
 */
export function ImageUpload({ label, value, onChange, preset = "photo", shape = "rect", hint }) {
  const id = useId();
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [drag, setDrag] = useState(false);
  const sizeKB = value?.startsWith("data:") ? Math.round((value.length * 0.75) / 1024) : null;

  const handle = async (file) => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      onChange(await compressImage(file, IMAGE_PRESETS[preset]));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const round = shape === "circle";
  return (
    <div className="field">
      <span className="field-label" id={`${id}-l`}>
        {label}
      </span>
      <div
        className={`upload ${drag ? "upload-drag" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          handle(e.dataTransfer.files?.[0]);
        }}
      >
        <div className={`upload-preview ${round ? "rounded-full" : ""}`} style={round ? { width: 72, height: 72 } : undefined}>
          {value ? <SmartImage src={value} alt="Vista previa" className={`h-full w-full object-cover ${round ? "rounded-full" : ""}`} /> : <ImagePlus size={24} className="text-subtle" aria-hidden="true" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2">
            <label htmlFor={id} className="btn btn-secondary btn-sm" aria-describedby={`${id}-h`}>
              {busy ? <span className="loader !border-[#d4d4d8] !border-t-ink" aria-hidden="true" /> : <Upload size={15} aria-hidden="true" />}
              {busy ? "Optimizando…" : value ? "Cambiar foto" : "Subir desde el dispositivo"}
            </label>
            {value && (
              <button type="button" className="btn btn-ghost btn-sm !text-error" onClick={() => onChange("")} aria-label={`Quitar ${label.toLowerCase()}`}>
                <Trash2 size={15} aria-hidden="true" /> Quitar
              </button>
            )}
          </div>
          <p id={`${id}-h`} className="mt-1.5 text-[12px] text-muted">
            {hint || "JPG, PNG o WebP. Se comprime automáticamente."}
            {sizeKB !== null && ` · Optimizada: ${sizeKB} KB`}
          </p>
          <input ref={inputRef} id={id} type="file" accept="image/*" className="sr-only" onChange={(e) => handle(e.target.files?.[0])} aria-labelledby={`${id}-l`} />
        </div>
      </div>
      {error && (
        <span className="field-hint !text-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

/** Enlace de WhatsApp con estilo de botón (abre wa.me en otra pestaña). */
export function WhatsAppButton({ href, children, className = "btn btn-secondary", disabledReason = "Sin número de WhatsApp registrado" }) {
  if (!href)
    return (
      <button type="button" className={`${className} opacity-60`} disabled title={disabledReason}>
        <MessageCircle size={17} aria-hidden="true" /> {children}
      </button>
    );
  return (
    <a href={href} target="_blank" rel="noreferrer" className={`${className} wa-btn`}>
      <MessageCircle size={17} aria-hidden="true" /> {children}
      <span className="sr-only"> (abre WhatsApp en una pestaña nueva)</span>
    </a>
  );
}
