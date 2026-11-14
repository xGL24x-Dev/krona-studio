import { useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Briefcase, CalendarCheck, Check, Minus, Plus, Scissors, User, X } from "lucide-react";
import { Field, ImageUpload, Logo, PasswordToggle, useApp } from "../shared/ui.jsx";
import {
  DEMO_ACCOUNTS, HOME_BY_ROLE, ROLES, describeBookingIntent, login, loginDemo, passwordStrength, peekBookingIntent, postAuthDestination, registerClient,
  registerEmployee, registerOwner,
  useSalonState, validators,
} from "../../services/salonService.js";

const ROLE_ICONS = { client: User, employee: Scissors, owner: Briefcase };
const ROLE_SHORT = { client: "Cliente", employee: "Empleada", owner: "Dueña" };

const ASIDE = {
  client: {
    kicker: "Tu espacio, a tu manera",
    title: <>Menos esperas.<br />Más tiempo para ti.</>,
    text: "Crea tu perfil una vez y disfruta de una experiencia personalizada en cada visita.",
    items: ["Reservas en menos de 30 segundos", "Elige a tu especialista favorita", "Califica y repite en un clic"],
  },
  employee: {
    kicker: "Workspace del equipo",
    title: <>Tu agenda,<br />siempre clara.</>,
    text: "Gestiona tus citas del día, inicia y finaliza servicios y recibe las calificaciones de tus clientes.",
    items: ["Solo tus citas, sin ruido", "Inicia y finaliza en un toque", "Agradece por WhatsApp al terminar"],
  },
  owner: {
    kicker: "Panel gerencial",
    title: <>Tu negocio,<br />en piloto automático.</>,
    text: "Agenda global, catálogo, equipo y marca blanca desde un solo lugar.",
    items: ["KPIs del día en tiempo real", "Catálogo y equipo editables", "Tu logo y horarios en toda la app"],
  },
};

function AuthShell({ role, children }) {
  const a = ASIDE[role] || ASIDE.client;
  return (
    <div className="auth-shell">
      <aside className="auth-aside">
        <Logo light />
        <div className="auth-aside-copy view-enter" key={role}>
          <span className="kicker">{a.kicker}</span>
          <p className="font-display text-[clamp(40px,4vw,59px)] font-semibold leading-[1.08] tracking-[-0.045em]" style={{ margin: "17px 0 22px" }}>
            {a.title}
          </p>
          <p>{a.text}</p>
          <ul>
            {a.items.map((item) => (
              <li key={item}>
                <span aria-hidden="true"><Check size={15} /></span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <p className="aside-note">Membresía · Experiencia personalizada</p>
      </aside>
      <main id="main" tabIndex={-1} className="auth-panel">
        <div className="auth-mobile-logo">
          <Logo />
        </div>
        <div className="view-enter w-full max-w-[470px]">{children}</div>
      </main>
    </div>
  );
}

/** Aviso cuando el visitante intentó agendar sin sesión. */
function BookingIntentNotice({ forced }) {
  const intent = peekBookingIntent();
  if (!intent && !forced) return null;
  const summary = describeBookingIntent(intent);
  return (
    <div className="notice notice-alert mt-5" role="status">
      <CalendarCheck size={18} className="mt-0.5 flex-none" aria-hidden="true" />
      <span>
        <b className="text-ink">Inicia sesión o crea tu cuenta gratis para agendar y proteger tu cupo.</b>
        {summary && <span className="mt-1 block">Guardamos tu selección: {summary}. Al ingresar volverás directo a tu reserva.</span>}
      </span>
    </div>
  );
}

/**
 * Bloque "Acceso rápido para explorar roles": 3 botones de 1 clic, visibles siempre
 * (sin condición de entorno), compartidos por Login y Registro.
 * El Cliente con una reserva pendiente vuelve a /reservar con su selección precargada.
 */
function DemoAccess({ next }) {
  const { navigate } = useApp();
  const [error, setError] = useState("");
  const enter = (r) => {
    const res = loginDemo(r);
    if (res.error) return setError(res.error);
    navigate(postAuthDestination(r, r === "client" && next ? next : res.home));
  };
  return (
    <section className="mt-7 border-t border-line pt-5" aria-labelledby="demo-access-title">
      <h2 id="demo-access-title" className="text-[12px] font-semibold uppercase tracking-[0.12em] text-subtle">Acceso rápido para explorar roles</h2>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {Object.entries(DEMO_ACCOUNTS).map(([r, acc]) => {
          const Icon = ROLE_ICONS[r];
          return (
            <button key={r} type="button" className="btn btn-secondary btn-sm !h-auto !min-h-[48px] !whitespace-normal !py-2 text-center !text-[12px]" onClick={() => enter(r)}>
              <Icon size={15} className="flex-none" aria-hidden="true" /> {acc.label}
            </button>
          );
        })}
      </div>
      {error && <p className="field-hint mt-2 !text-error" role="alert">{error}</p>}
    </section>
  );
}

/** Selector accesible de perfil (radiogroup con flechas). */
function RoleSwitch({ value, onChange, label }) {
  const refs = useRef([]);
  const roles = Object.keys(ROLES);
  const onKeyDown = (e, i) => {
    const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const n = (i + dir + roles.length) % roles.length;
    onChange(roles[n]);
    refs.current[n]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} className="role-switch">
      {roles.map((r, i) => {
        const Icon = ROLE_ICONS[r];
        return (
          <button key={r} ref={(el) => (refs.current[i] = el)} type="button" role="radio" aria-checked={value === r} tabIndex={value === r ? 0 : -1} onClick={() => onChange(r)} onKeyDown={(e) => onKeyDown(e, i)}>
            <Icon size={17} aria-hidden="true" />
            <span>{ROLE_SHORT[r]}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Login                                                               */
/* ------------------------------------------------------------------ */
export function Login() {
  const { navigate, route } = useApp();
  const bookingRedirect = route.query.motivo === "reservar" || !!peekBookingIntent();
  const [role, setRole] = useState(bookingRedirect ? "client" : ROLES[route.query.role] ? route.query.role : "client");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const idRef = useRef();
  const next = route.query.next;

  // Cliente con reserva pendiente → vuelve a /reservar con su selección; si no, a su destino habitual.
  const go = (res, r) => navigate(postAuthDestination(r, r === "client" && next ? next : res.home));

  const submit = (e) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setError("Ingresa tu correo o celular y tu contraseña.");
      idRef.current?.focus();
      return;
    }
    setLoading(true);
    setTimeout(() => {
      const res = login(role, identifier, password, remember);
      setLoading(false);
      if (res.error) return setError(res.error);
      go(res, role);
    }, 350);
  };

  return (
    <AuthShell role={role}>
      <form className="auth-form" onSubmit={submit} noValidate aria-labelledby="login-title">
        <span className="step-label">Acceso seguro</span>
        <h1 id="login-title" className="mt-3 text-[clamp(30px,4vw,36px)] font-semibold tracking-[-0.04em]" tabIndex={-1} data-page-title>
          Inicia sesión
        </h1>
        <p className="form-intro">Elige tu perfil para entrar a tu espacio.</p>
        {role === "client" && <BookingIntentNotice forced={route.query.motivo === "reservar"} />}
        <div className="mt-6">
          <RoleSwitch value={role} onChange={(r) => { setRole(r); setError(""); }} label="Tipo de acceso" />
          <p className="mt-2 text-[12px] text-muted" aria-live="polite">Accediendo como <b className="text-ink">{ROLES[role]}</b></p>
        </div>
        {error && <p className="notice notice-error mt-5" role="alert">{error}</p>}
        <div className="form-stack !mt-6 !gap-5">
          <Field label={role === "client" ? "Correo o celular" : "Correo de trabajo o celular"} placeholder={role === "client" ? "tu@correo.com" : "nombre@tusalon.co"} autoComplete="username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} inputRef={idRef} required />
          <Field label="Contraseña" type={show ? "text" : "password"} placeholder="Tu contraseña" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required suffix={<PasswordToggle show={show} setShow={setShow} />} />
          <div className="form-options">
            <label className="check !text-ink">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Recordarme
            </label>
            <button type="button" className="link !no-underline" onClick={() => navigate("/recuperar")}>¿Olvidaste tu contraseña?</button>
          </div>
        </div>
        <button className="btn btn-primary btn-full mt-6" type="submit" disabled={loading} aria-busy={loading}>
          {loading && <span className="loader" aria-hidden="true" />}
          {loading ? "Verificando…" : `Ingresar como ${ROLE_SHORT[role].toLowerCase()}`} {!loading && <ArrowRight size={18} aria-hidden="true" />}
        </button>
        {role === "client" && (
          <>
            <div className="or"><span>o</span></div>
            <button className="btn btn-secondary btn-full guest-btn" type="button" onClick={() => navigate(`/registro?role=client${next ? `&next=${encodeURIComponent(next)}` : ""}`)}>
              Crear cuenta gratis <small>Tu cupo queda protegido a tu nombre</small>
            </button>
          </>
        )}

        <DemoAccess next={next} />

        <p className="switch-auth">
          ¿Aún no tienes cuenta?{" "}
          <button type="button" onClick={() => navigate(`/registro?role=${role}${next ? `&next=${encodeURIComponent(next)}` : ""}`)}>
            {role === "owner" ? "Registra tu negocio" : role === "employee" ? "Únete a un equipo" : "Créala gratis"}
          </button>
        </p>
      </form>
    </AuthShell>
  );
}

/* ------------------------------------------------------------------ */
/* Registro (3 perfiles)                                               */
/* ------------------------------------------------------------------ */
const STRENGTH = [
  { label: "Usa 8+ caracteres, mayúsculas, números y símbolos", color: "#e4e4e7", bars: 0 },
  { label: "Débil", color: "var(--error)", bars: 1 },
  { label: "Media", color: "var(--alert)", bars: 2 },
  { label: "Buena", color: "var(--success)", bars: 3 },
  { label: "Fuerte", color: "var(--success)", bars: 4 },
];

function PasswordField({ value, onChange, onBlur, error, inputRef }) {
  const [show, setShow] = useState(false);
  const strength = passwordStrength(value);
  const rules = [
    [value.length >= 8, "8+ caracteres"],
    [/[A-Z]/.test(value) && /[a-z]/.test(value), "Mayús. y minús."],
    [/\d/.test(value), "Un número"],
    [/[^A-Za-z0-9]/.test(value), "Un símbolo"],
  ];
  return (
    <>
      <Field label="Contraseña" type={show ? "text" : "password"} placeholder="Mínimo 8 caracteres" autoComplete="new-password" value={value} onChange={onChange} onBlur={onBlur} error={error} inputRef={inputRef} required suffix={<PasswordToggle show={show} setShow={setShow} />} />
      <div className="strength" aria-live="polite">
        <div className="strength-bars" aria-hidden="true">
          {[1, 2, 3, 4].map((i) => (
            <i key={i} style={{ background: i <= STRENGTH[strength].bars ? STRENGTH[strength].color : undefined }} />
          ))}
        </div>
        <span><span className="sr-only">Fortaleza de la contraseña: </span>{STRENGTH[strength].label}</span>
      </div>
      {value && (
        <ul className="-mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px]" aria-label="Requisitos de la contraseña">
          {rules.map(([ok, text]) => (
            <li key={text} className={`flex items-center gap-1.5 ${ok ? "text-success" : "text-muted"}`}>
              {ok ? <Check size={13} aria-hidden="true" /> : <X size={13} aria-hidden="true" />}
              {text}
              <span className="sr-only">{ok ? "cumplido" : "pendiente"}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

const INITIAL = { name: "", phone: "", email: "", password: "", allergies: "", whatsapp: true, news: false, business: "", logo: "", inviteCode: "", specialty: "", categories: [], photo: "" };

export function Register() {
  const { navigate, route } = useApp();
  const { categories } = useSalonState();
  const [role, setRole] = useState(ROLES[route.query.role] ? route.query.role : "client");
  const [v, setV] = useState(INITIAL);
  const [touched, setTouched] = useState({});
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [loading, setLoading] = useState(false);
  const refs = { business: useRef(), inviteCode: useRef(), name: useRef(), phone: useRef(), email: useRef(), specialty: useRef(), password: useRef() };

  const errors = useMemo(() => {
    const e = { name: validators.name(v.name), phone: validators.phone(v.phone), email: validators.email(v.email), password: validators.password(v.password) };
    if (role === "owner") e.business = validators.required(v.business);
    if (role === "employee") {
      e.inviteCode = validators.required(v.inviteCode);
      e.specialty = validators.required(v.specialty);
      e.categories = v.categories.length ? "" : "Elige al menos una categoría.";
    }
    return e;
  }, [v, role]);

  const set = (k) => (e) => {
    const val = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setV((s) => ({ ...s, [k]: val }));
    if (typeof val === "string" && val.length > 2) setTouched((t) => ({ ...t, [k]: true }));
  };
  const blur = (k) => () => setTouched((t) => ({ ...t, [k]: true }));
  const err = (k) => (touched[k] ? errors[k] : "");
  const ok = (k) => touched[k] && !errors[k];

  const submit = (e) => {
    e.preventDefault();
    setTouched(Object.fromEntries(Object.keys(errors).map((k) => [k, true])));
    const firstInvalid = Object.keys(refs).find((k) => errors[k]);
    if (firstInvalid || errors.categories) {
      setSubmitError("Revisa los campos marcados para continuar.");
      refs[firstInvalid]?.current?.focus();
      return;
    }
    setLoading(true);
    setTimeout(() => {
      const res = role === "owner" ? registerOwner(v) : role === "employee" ? registerEmployee(v) : registerClient(v);
      setLoading(false);
      if (res.error) return setSubmitError(res.error);
      navigate(postAuthDestination(role, role === "client" && route.query.next ? route.query.next : res.home || HOME_BY_ROLE[role]));
    }, 400);
  };

  const titles = { client: "Crea tu cuenta", employee: "Únete a tu equipo", owner: "Registra tu negocio" };
  const intros = {
    client: "Solo necesitamos lo esencial. Te tomará menos de un minuto.",
    employee: "Pide a la administradora el código de invitación del local.",
    owner: "Crea tu marca: nombre, logo y tu cuenta de administradora.",
  };

  return (
    <AuthShell role={role}>
      <form className="auth-form" onSubmit={submit} noValidate aria-labelledby="register-title">
        <span className="step-label">Registro · {ROLES[role]}</span>
        <h1 id="register-title" className="mt-3 text-[clamp(30px,4vw,36px)] font-semibold tracking-[-0.04em]" tabIndex={-1} data-page-title>
          {titles[role]}
        </h1>
        <p className="form-intro">{intros[role]}</p>
        <div className="mt-6">
          <RoleSwitch value={role} onChange={(r) => { setRole(r); setSubmitError(""); setTouched({}); }} label="Tipo de cuenta" />
        </div>
        {role === "client" && <BookingIntentNotice />}
        {submitError && <p className="notice notice-error mt-5" role="alert">{submitError}</p>}

        <div className="form-stack view-enter" key={role}>
          {role === "owner" && (
            <>
              <Field label="Nombre del negocio" placeholder="Ej. Casa Bruma Salón" value={v.business} onChange={set("business")} onBlur={blur("business")} error={err("business")} valid={ok("business")} inputRef={refs.business} required />
              <ImageUpload label="Logo del negocio (opcional)" value={v.logo} onChange={(logo) => setV((s) => ({ ...s, logo }))} preset="logo" shape="circle" hint="Cuadrado, idealmente con fondo transparente." />
            </>
          )}
          {role === "employee" && (
            <Field label="Código de invitación del local" placeholder="Ej. STUDIO2026" value={v.inviteCode} onChange={set("inviteCode")} onBlur={blur("inviteCode")} error={err("inviteCode")} inputRef={refs.inviteCode} autoComplete="off" hint="Demo: STUDIO2026" required />
          )}
          <Field label={role === "owner" ? "Tu nombre (administradora)" : "Nombre completo"} placeholder="Como aparece en tu documento" autoComplete="name" value={v.name} onChange={set("name")} onBlur={blur("name")} error={err("name")} valid={ok("name")} inputRef={refs.name} required />
          <Field label="Celular / WhatsApp" type="tel" inputMode="tel" placeholder="300 000 0000" autoComplete="tel" value={v.phone} onChange={set("phone")} onBlur={blur("phone")} error={err("phone")} valid={ok("phone")} inputRef={refs.phone} required hint={role === "employee" ? "Obligatorio: aquí recibirás los avisos de nuevas citas." : undefined} />
          <Field label={role === "client" ? "Correo electrónico" : "Correo de acceso"} type="email" placeholder="tu@correo.com" autoComplete="email" value={v.email} onChange={set("email")} onBlur={blur("email")} error={err("email")} valid={ok("email")} inputRef={refs.email} required />
          {role === "employee" && (
            <>
              <Field label="Especialidad" placeholder="Ej. Colorimetría y balayage" value={v.specialty} onChange={set("specialty")} onBlur={blur("specialty")} error={err("specialty")} inputRef={refs.specialty} required />
              <fieldset>
                <legend className="field-label mb-2">Servicios que realizas</legend>
                <div className="flex flex-wrap gap-2">
                  {categories.map((c) => {
                    const checked = v.categories.includes(c);
                    return (
                      <button key={c} type="button" className="pill" aria-pressed={checked} onClick={() => setV((s) => ({ ...s, categories: checked ? s.categories.filter((x) => x !== c) : [...s.categories, c] }))}>
                        {checked && <Check size={14} aria-hidden="true" />} {c}
                      </button>
                    );
                  })}
                </div>
                {touched.categories && errors.categories && <p className="field-hint mt-2 !text-error" role="alert">{errors.categories}</p>}
              </fieldset>
              <ImageUpload label="Tu foto de perfil (opcional)" value={v.photo} onChange={(photo) => setV((s) => ({ ...s, photo }))} preset="avatar" shape="circle" />
            </>
          )}
          <PasswordField value={v.password} onChange={set("password")} onBlur={blur("password")} error={err("password")} inputRef={refs.password} />

          {role === "client" && (
            <>
              <button type="button" className="preferences-toggle" onClick={() => setPrefsOpen((o) => !o)} aria-expanded={prefsOpen} aria-controls="prefs-panel">
                {prefsOpen ? <Minus size={18} aria-hidden="true" /> : <Plus size={18} aria-hidden="true" />} Preferencias opcionales
              </button>
              <div className="disclosure" data-open={prefsOpen}>
                <div id="prefs-panel" inert={!prefsOpen ? true : undefined}>
                  <div className="preferences">
                    <Field label="Alergias o sensibilidades" placeholder="Ej. amoníaco, fragancias…" value={v.allergies} onChange={set("allergies")} />
                    <div className="check-row">
                      <label className="check"><input type="checkbox" checked={v.whatsapp} onChange={set("whatsapp")} /> Recordatorios por WhatsApp</label>
                      <label className="check"><input type="checkbox" checked={v.news} onChange={set("news")} /> Novedades y beneficios</label>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
        <button className="btn btn-primary btn-full mt-6" type="submit" disabled={loading} aria-busy={loading}>
          {loading && <span className="loader" aria-hidden="true" />}
          {loading ? "Creando…" : role === "owner" ? "Crear mi negocio" : role === "employee" ? "Unirme al equipo" : "Crear mi cuenta"}
          {!loading && <ArrowRight size={18} aria-hidden="true" />}
        </button>
        <p className="terms">
          Al continuar, aceptas nuestros <a href="#/ayuda">Términos</a> y <a href="#/ayuda">Política de privacidad</a>.
        </p>
        <p className="switch-auth">
          ¿Ya tienes una cuenta?{" "}
          <button type="button" onClick={() => navigate(`/login?role=${role}${route.query.next ? `&next=${encodeURIComponent(route.query.next)}` : ""}`)}>Inicia sesión</button>
        </p>
        <DemoAccess next={route.query.next} />
      </form>
    </AuthShell>
  );
}

/* ------------------------------------------------------------------ */
/* Recuperar contraseña                                                */
/* ------------------------------------------------------------------ */
export function ForgotPassword() {
  const { navigate } = useApp();
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const [sent, setSent] = useState(false);
  const error = touched ? validators.email(email) : "";
  return (
    <AuthShell role="client">
      <form className="auth-form" noValidate aria-labelledby="forgot-title" onSubmit={(e) => { e.preventDefault(); setTouched(true); if (!validators.email(email)) setSent(true); }}>
        <span className="step-label">Recuperar acceso</span>
        <h1 id="forgot-title" className="mt-3 text-[clamp(30px,4vw,36px)] font-semibold tracking-[-0.04em]" tabIndex={-1} data-page-title>¿Olvidaste tu contraseña?</h1>
        <p className="form-intro">Te enviaremos un enlace seguro para crear una nueva. Expira en 30 minutos.</p>
        {sent ? (
          <div className="notice notice-success mt-8" role="status">
            <Check size={18} className="mt-0.5 flex-none text-success" aria-hidden="true" />
            <span>Si <b className="text-ink">{email}</b> está registrado, recibirás el enlace en los próximos minutos.</span>
          </div>
        ) : (
          <div className="form-stack !mt-8">
            <Field label="Correo electrónico" type="email" autoComplete="email" placeholder="tu@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => setTouched(true)} error={error} required />
          </div>
        )}
        {!sent && <button className="btn btn-primary btn-full mt-6" type="submit">Enviar enlace <ArrowRight size={18} aria-hidden="true" /></button>}
        <button type="button" className="btn btn-ghost btn-full mt-3" onClick={() => navigate("/login")}>
          <ArrowLeft size={18} aria-hidden="true" /> Volver a iniciar sesión
        </button>
      </form>
    </AuthShell>
  );
}
