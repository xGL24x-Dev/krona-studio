/* ==========================================================================
 * salonService — puente único entre la Vitrina Pública (storefront) y los
 * Paneles Operativos (workspace). Toda la lógica de negocio, roles, permisos,
 * persistencia (localStorage), disponibilidad, WhatsApp e imágenes vive aquí.
 * Las vistas solo leen el estado (hooks) y llaman acciones: se puede cambiar
 * el diseño completo de la tienda sin tocar la lógica administrativa.
 * ========================================================================== */
import { useSyncExternalStore } from "react";

export const STORAGE_KEY = "appsalon.state.v5";
export const SESSION_KEY = "appsalon.session.v5";
const SEED_VERSION = 5;
/** Claves de versiones anteriores que se eliminan al cargar (restauración de semilla). */
const LEGACY_KEYS = ["appsalon.state.v1", "appsalon.session.v1", "appsalon.state.v2", "appsalon.session.v2", "appsalon.state.v3", "appsalon.session.v3", "appsalon.state.v4", "appsalon.session.v4"];
export const MAX_CATEGORIES = 6; // Ley de Hick
export const ROLES = { client: "Cliente", employee: "Empleada / Estilista", owner: "Dueña / Administradora" };
export const HOME_BY_ROLE = { client: "/cliente", employee: "/empleada", owner: "/admin" };

/* ------------------------------------------------------------------ */
/* Formato y fechas                                                    */
/* ------------------------------------------------------------------ */
export const pad = (n) => String(n).padStart(2, "0");
export const formatCOP = (n) => `$${Math.round(Number(n) || 0).toLocaleString("es-CO")} COP`;
export const toISODate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseISODate = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (d, n) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};
export const todayISO = () => toISODate(new Date());
export const toMinutes = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
export const fromMinutes = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export const formatDateLong = (iso) => cap(parseISODate(iso).toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" }));
export const formatDateShort = (iso) =>
  cap(parseISODate(iso).toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short" }).replace(/\.(?=\s|,|$)/g, ""));
export const formatMonth = (d) => cap(d.toLocaleDateString("es-CO", { month: "long", year: "numeric" }));
export const formatDuration = (min) => (min < 60 ? `${min} min` : `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ""}`);
export const appointmentStart = (a) => {
  const d = parseISODate(a.date);
  const m = toMinutes(a.time);
  d.setHours(Math.floor(m / 60), m % 60, 0, 0);
  return d;
};
export const appointmentEnd = (a) => new Date(appointmentStart(a).getTime() + a.duration * 60000);
export const initials = (name = "") =>
  name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "AS";
export const firstName = (name = "") => name.trim().split(" ")[0] || name;
export const uid = (p = "id") => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
export const digits = (s = "") => String(s).replace(/\D/g, "");

export const bookingCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let c = "AS-";
  for (let i = 0; i < 6; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
};

/** Hash no reversible (demo local: nunca se guarda la contraseña en claro). */
export const hashPassword = (pwd = "") => {
  let h = 5381;
  for (let i = 0; i < pwd.length; i++) h = ((h << 5) + h + pwd.charCodeAt(i)) >>> 0;
  return `h${h.toString(36)}`;
};

export const passwordStrength = (pwd) => {
  if (!pwd) return 0;
  let s = 0;
  if (pwd.length >= 8) s++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) s++;
  if (/\d/.test(pwd)) s++;
  if (/[^A-Za-z0-9]/.test(pwd)) s++;
  return Math.max(1, Math.min(4, s));
};

export const validators = {
  name: (v = "") => (v.trim().length < 3 ? "Ingresa el nombre completo (mínimo 3 caracteres)." : ""),
  phone: (v = "") => (/^(\+?57\s?)?3\d{2}\s?\d{3}\s?\d{4}$/.test(v.trim()) ? "" : "Ingresa un celular colombiano válido, ej. 300 123 4567."),
  email: (v = "") => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? "" : "Ingresa un correo electrónico válido."),
  password: (v = "") => (v.length < 8 ? "La contraseña debe tener al menos 8 caracteres." : ""),
  required: (v) => (String(v ?? "").trim() ? "" : "Este campo es obligatorio."),
  price: (v) => (Number(v) > 0 ? "" : "Ingresa un precio mayor a 0."),
  duration: (v) => (Number(v) >= 15 && Number(v) <= 480 ? "" : "Duración entre 15 y 480 minutos."),
};

/* ------------------------------------------------------------------ */
/* Compresión de imágenes con HTML5 Canvas                             */
/* ------------------------------------------------------------------ */
/**
 * Redimensiona y comprime una imagen local a un data URL liviano para no
 * saturar localStorage (~5 MB). Fotos → JPEG; logos → WebP/PNG (transparencia).
 */
export function compressImage(file, { maxSize = 900, quality = 0.72, mime = "image/jpeg" } = {}) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) return reject(new Error("El archivo debe ser una imagen (JPG, PNG o WebP)."));
    if (file.size > 20 * 1024 * 1024) return reject(new Error("La imagen supera 20 MB."));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (mime === "image/jpeg") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);
      }
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      let out = canvas.toDataURL(mime, quality);
      if (mime === "image/webp" && !out.startsWith("data:image/webp")) out = canvas.toDataURL("image/png");
      resolve(out);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No pudimos leer la imagen. Prueba con otro archivo."));
    };
    img.src = url;
  });
}
export const IMAGE_PRESETS = {
  photo: { maxSize: 900, quality: 0.72, mime: "image/jpeg" },
  avatar: { maxSize: 360, quality: 0.78, mime: "image/jpeg" },
  logo: { maxSize: 256, quality: 0.88, mime: "image/webp" },
  cover: { maxSize: 1400, quality: 0.7, mime: "image/jpeg" },
};

/* ------------------------------------------------------------------ */
/* Datos semilla                                                       */
/* ------------------------------------------------------------------ */
const unsplash = (id, w = 900, extra = "") => `https://images.unsplash.com/${id}?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=80&w=${w}${extra}`;
const face = (id) => unsplash(id, 400, "&h=400&crop=faces");

const DEFAULT_BRAND = {
  name: "KRONA Studio",
  slogan: "Tu tiempo vale oro. Reserva tu estilo en 30 segundos.",
  nit: "901.482.319-4",
  logo: "",
  cover: unsplash("photo-1633681926022-84c23e8cb2d6", 1400),
  whatsapp: "3185540921",
  email: "hola@kronastudio.co",
  instagram: "@krona.studio",
  address: "Calle 10 # 36-45, Barrio El Peñón",
  city: "Cali",
  cancelHours: 2,
  cancellationPolicy: "Reagendamiento o cancelación sin costo hasta 2 horas antes de la cita",
  inviteCode: "STUDIO2026",
  hours: {
    weekdays: { open: "08:00", close: "20:00", closed: false },
    saturday: { open: "08:00", close: "20:00", closed: false },
    sunday: { open: "09:00", close: "17:00", closed: false },
  },
};

const DEFAULT_CATEGORIES = ["Corte", "Color", "Tratamientos", "Uñas", "Barbería"];

const svc = (o) => ({ type: "service", active: true, featured: false, gallery: [], includes: [], products: "", aftercare: "", ...o, gallery: (o.gallery || [o.image]).filter(Boolean) });
const SEED_SERVICES = [
  svc({
    id: "corte-styling", name: "Corte & Styling", category: "Corte", duration: 45, price: 45000, tagline: "Asesoría incluida", featured: true,
    image: unsplash("photo-1675034743339-0b0747047727"),
    gallery: [unsplash("photo-1675034743339-0b0747047727", 1100), unsplash("photo-1522337360788-8b13dee7a37e", 1100), unsplash("photo-1560066984-138dadb4c035", 1100)],
    description: "Un corte diseñado para tu rostro, tu textura y tu rutina. Iniciamos con una asesoría de visagismo de 10 minutos, seguimos con un lavado sensorial con masaje capilar y terminamos con un styling que podrás replicar en casa en menos de 5 minutos.",
    includes: ["Diagnóstico de visagismo", "Lavado con masaje capilar", "Corte personalizado a tijera", "Styling y fijación ligera"],
    products: "Shampoo y acondicionador sin sulfatos Kérastase Discipline, protector térmico y crema de peinado de fijación flexible.",
    aftercare: "Espera 24 horas antes de lavar. Usa protector térmico antes de secar y agenda un retoque cada 6 a 8 semanas para mantener la forma.",
  }),
  svc({
    id: "corte-bob-editorial", name: "Bob Editorial", category: "Corte", duration: 60, price: 62000, tagline: "Líneas precisas",
    image: unsplash("photo-1522337360788-8b13dee7a37e"),
    description: "Corte de líneas limpias inspirado en pasarela, en largo mandíbula u hombro. Trabajamos la nuca y el contorno con tijera y navaja para que caiga perfecto incluso sin secador.",
    includes: ["Consulta de estilo con referencias", "Corte a tijera y navaja", "Secado con cepillo redondo", "Guía de mantenimiento"],
    products: "Shampoo nutritivo Olaplex N.º 4, tratamiento sin enjuague N.º 6 y spray texturizador de acabado mate.",
    aftercare: "Seca en dirección de la caída para mantener la línea. Recomendamos retocar la nuca cada 5 semanas.",
  }),
  svc({
    id: "coloracion-signature", name: "Coloración Signature", category: "Color", duration: 120, price: 140000, tagline: "Tratamiento premium", featured: true,
    image: unsplash("photo-1695527081848-1e46c06e6458"),
    gallery: [unsplash("photo-1695527081848-1e46c06e6458", 1100), unsplash("photo-1560066984-138dadb4c035", 1100)],
    description: "Color de autor formulado a la medida de tu tono de piel. Realizamos prueba de sensibilidad, formulamos el tono en tu presencia y protegemos los enlaces del cabello durante todo el proceso para un brillo profundo y duradero.",
    includes: ["Prueba de sensibilidad", "Fórmula personalizada", "Protector de enlaces", "Gloss de acabado y secado"],
    products: "Coloración sin amoníaco Wella Illumina, protector de enlaces Olaplex N.º 1 y 2 y gloss ácido Redken Shades EQ.",
    aftercare: "No laves durante 48 horas. Usa shampoo sin sulfatos, agua tibia y protector UV. Matiza cada 15 días y retoca raíz cada 6 semanas.",
  }),
  svc({
    id: "balayage-natural", name: "Balayage Natural", category: "Color", duration: 150, price: 210000, tagline: "Iluminación a mano alzada",
    image: unsplash("photo-1560066984-138dadb4c035"),
    description: "Mechas pintadas a mano alzada para un efecto bañado por el sol. Las transiciones suaves crecen con elegancia, por lo que puedes espaciar tus visitas hasta 4 meses.",
    includes: ["Diagnóstico de color y textura", "Aclarado a mano alzada", "Matizante a medida", "Tratamiento sellador"],
    products: "Decolorante de baja volatilidad Blondor Plex, matizante Redken Shades EQ y mascarilla reconstructora K18.",
    aftercare: "Usa shampoo violeta una vez por semana, evita el cloro sin protección y aplica mascarilla hidratante cada 7 días.",
  }),
  svc({
    id: "ritual-hidratacion", name: "Ritual de Hidratación", category: "Tratamientos", duration: 50, price: 75000, tagline: "Nutrición profunda",
    image: unsplash("photo-1570172619644-dfd03ed5d881"),
    description: "Tratamiento intensivo con ácido hialurónico y aceites botánicos que devuelve elasticidad y brillo a cabellos secos, teñidos o expuestos al sol. Incluye un masaje relajante de cuero cabelludo de 10 minutos.",
    includes: ["Exfoliación del cuero cabelludo", "Mascarilla con vapor", "Masaje relajante", "Sellado en frío"],
    products: "Exfoliante de sal marina, mascarilla con ácido hialurónico Kérastase Hydra-Fondant y aceite de argán puro.",
    aftercare: "Evita planchas y secadores a alta temperatura durante 48 horas. Repite el ritual cada 3 semanas para mantener la hidratación.",
  }),
  svc({
    id: "keratina-organica", name: "Keratina Orgánica", category: "Tratamientos", duration: 180, price: 260000, tagline: "Libre de formol",
    image: unsplash("photo-1519699047748-de8e457a634e"),
    description: "Alisado progresivo con keratina vegetal libre de formol. Controla el frizz hasta por 4 meses respetando el movimiento natural y reduce a la mitad el tiempo de secado diario.",
    includes: ["Lavado clarificante", "Aplicación por mechones", "Sellado térmico controlado", "Kit de mantenimiento"],
    products: "Keratina vegetal Brasil Cacau Eco, shampoo anti-residuos y kit de mantenimiento sin sulfatos ni sal.",
    aftercare: "Puedes lavar a las 24 horas. Usa solo productos sin sulfatos ni cloruro de sodio y evita amarrar el cabello mojado.",
  }),
  svc({
    id: "manicure-spa", name: "Manicure Spa", category: "Uñas", duration: 45, price: 38000, tagline: "Esmaltado semipermanente",
    image: unsplash("photo-1604654894610-df63bc536371"),
    description: "Cuidado completo de manos con limpieza de cutícula, exfoliación, parafina tibia y esmaltado semipermanente de larga duración. Usamos herramientas esterilizadas en autoclave en cada cita.",
    includes: ["Limpieza de cutícula", "Exfoliación de manos", "Parafina tibia", "Esmalte semipermanente"],
    products: "Esmaltes semipermanentes veganos OPI GelColor, exfoliante de azúcar y crema de karité.",
    aftercare: "Usa guantes para labores domésticas, hidrata las cutículas a diario con aceite y retira el esmalte en el salón para no dañar la uña.",
  }),
  svc({
    id: "pedicure-ritual", name: "Pedicure Ritual", category: "Uñas", duration: 60, price: 48000, tagline: "Sales minerales",
    image: unsplash("photo-1519014816548-bf5fe059798b"),
    description: "Baño de pies con sales minerales, remoción de durezas, exfoliación y masaje descontracturante de 10 minutos. Termina con el esmalte de tu elección.",
    includes: ["Baño de sales minerales", "Remoción de durezas", "Masaje de 10 minutos", "Esmaltado tradicional o semipermanente"],
    products: "Sales del Mar Muerto, lima de vidrio, crema podal con urea al 10% y esmaltes OPI.",
    aftercare: "Usa calzado abierto las primeras 2 horas, hidrata los talones cada noche y repite el ritual cada 4 semanas.",
  }),
  svc({
    id: "barberia-ritual", name: "Barbería Ritual", category: "Barbería", duration: 35, price: 35000, tagline: "Toalla caliente", featured: true,
    image: unsplash("photo-1600948836101-f9ffda59d250"),
    description: "La experiencia clásica de barbería: corte a máquina y tijera, perfilado de contornos con navaja y toalla caliente con aceites esenciales de eucalipto.",
    includes: ["Corte a máquina y tijera", "Perfilado con navaja", "Toalla caliente aromática", "Bálsamo after-shave"],
    products: "Pomada de fijación media Reuzel, aceite esencial de eucalipto y bálsamo after-shave sin alcohol.",
    aftercare: "Lava con shampoo suave cada dos días y retoca el degradado cada 3 semanas para mantener el contorno definido.",
  }),
  svc({
    id: "barba-escultura", name: "Escultura de Barba", category: "Barbería", duration: 30, price: 28000, tagline: "Diseño y perfilado",
    image: unsplash("photo-1503951914875-452162b0f3f1"),
    description: "Diseño de barba según la estructura de tu rostro, con perfilado a navaja, vapor para abrir los poros e hidratación con aceite de argán.",
    includes: ["Diseño facial personalizado", "Perfilado a navaja", "Vapor y toalla caliente", "Aceite de argán"],
    products: "Jabón de afeitar con glicerina, aceite de argán para barba y bálsamo con manteca de karité.",
    aftercare: "Aplica 3 gotas de aceite cada mañana, peina en dirección al crecimiento y retoca el perfilado cada 2 semanas.",
  }),
  svc({
    id: "aceite-argan", type: "product", name: "Aceite de Argán Puro", category: "Tratamientos", duration: 0, price: 68000, tagline: "50 ml · Uso diario",
    image: unsplash("photo-1608248543803-ba4f8c70ae0b"),
    description: "Aceite de argán marroquí prensado en frío que sella las puntas, controla el frizz y aporta brillo sin engrasar. Apto para todo tipo de cabello, incluso teñido.",
    includes: ["100% puro, certificado", "Libre de siliconas", "Apto para cabello teñido"],
    products: "Aceite de Argania spinosa prensado en frío con vitamina E natural.",
    aftercare: "Aplica 2 o 3 gotas en medios y puntas sobre cabello húmedo o seco. Guárdalo lejos de la luz directa.",
  }),
  svc({
    id: "shampoo-color", type: "product", name: "Shampoo Protector de Color", category: "Color", duration: 0, price: 54000, tagline: "300 ml · Sin sulfatos",
    image: unsplash("photo-1631729371254-42c2892f0e6e"),
    description: "Limpieza suave de pH ácido que prolonga la intensidad del color y protege la fibra capilar de los rayos UV. Es el complemento ideal después de tu Coloración Signature.",
    includes: ["Sin sulfatos ni parabenos", "pH balanceado 4.5", "Filtro UV"],
    products: "Fórmula con filtro UV, aceite de camelia y proteína de quinoa.",
    aftercare: "Úsalo 2 o 3 veces por semana con agua tibia y acompáñalo con un acondicionador sin sulfatos.",
  }),
];

const SEED_STYLISTS = [
  { id: "st-camila", name: "Camila Restrepo", title: "Directora creativa", specialty: "Color y balayage", yearsExperience: 12, bio: "Formada en colorimetría en Bogotá y Madrid. Especialista en balayage y correcciones de color con técnicas que respetan la fibra capilar.", categories: ["Corte", "Color", "Tratamientos"], photo: face("photo-1494790108377-be9c29b29330"), email: "camila@appsalon.co", whatsapp: "312 457 8830", password: "camila1234" },
  { id: "st-andres", name: "Andrés Moreno", title: "Master barber", specialty: "Barbería clásica", yearsExperience: 9, bio: "Barbero clásico formado en Medellín. Domina el fade, el perfilado a navaja y el ritual de toalla caliente.", categories: ["Barbería", "Corte"], photo: face("photo-1507003211169-0a1dd7228f2d"), email: "andres@appsalon.co", whatsapp: "301 662 1947", password: "andres1234" },
  { id: "st-sofia", name: "Sofía Vargas", title: "Estilista senior", specialty: "Cortes editoriales", yearsExperience: 7, bio: "Apasionada por los cortes editoriales y el cabello ondulado. Diseña cada corte según tu rostro, tu textura y tu rutina diaria.", categories: ["Corte", "Tratamientos", "Color"], photo: face("photo-1438761681033-6461ffad8d80"), email: "sofia@appsalon.co", whatsapp: "318 774 2056", password: "sofia1234" },
  { id: "st-julian", name: "Julián Ortiz", title: "Colorista", specialty: "Coloración y keratina", yearsExperience: 8, bio: "Colorista técnico certificado en alisados orgánicos y keratina libre de formol. Experto en rubios y matización.", categories: ["Color", "Tratamientos", "Barbería"], photo: face("photo-1500648767791-00dcc994a43e"), email: "julian@appsalon.co", whatsapp: "316 908 3412", password: "julian1234" },
  { id: "st-daniela", name: "Daniela Ruiz", title: "Nail artist", specialty: "Uñas y spa", yearsExperience: 6, bio: "Nail artist certificada en manicure rusa y esmaltado semipermanente. Trabaja con productos veganos y herramientas esterilizadas.", categories: ["Uñas"], photo: face("photo-1544005313-94ddf0286df2"), email: "daniela@appsalon.co", whatsapp: "320 145 6678", password: "daniela1234" },
].map(({ password, ...s }) => ({ ...s, active: true, passwordHash: hashPassword(password), createdAt: Date.now() }));

export const DEMO_ACCOUNTS = {
  client: { id: "u-demo", identifier: "laura@correo.com", password: "demo1234", label: "Entrar como Cliente" },
  employee: { id: "st-sofia", identifier: "sofia@appsalon.co", password: "sofia1234", label: "Entrar como Empleada · Sofía" },
  owner: { id: "u-owner", identifier: "admin@appsalon.co", password: "admin1234", label: "Entrar como Dueña" },
};

const DEMO_CLIENT_PHONE = "+57 315 842 9104";
const SEED_USERS = [
  {
    id: "u-demo", role: "client", name: "Laura Gómez", email: "laura@correo.com", phone: DEMO_CLIENT_PHONE, passwordHash: hashPassword("demo1234"),
    birthDate: "1996-05-18", address: "Granada, Cali",
    preferences: "Cabello ondulado medio, preferencia por productos sin sulfatos y tonos cobrizos cálidos",
    hairType: "Ondulado medio (2B), poroso en puntas",
    skinType: "Mixta, sensible a fragancias fuertes",
    allergies: "Ninguna",
    photo: "",
    notifications: { whatsapp: true, email: true },
    payments: [{ id: "pm-1", brand: "Visa Débito", last4: "4829", exp: "09/29", default: true }],
    favorites: ["coloracion-signature", "corte-styling"],
  },
  { id: "u-owner", role: "owner", name: "Valentina Ríos", email: "admin@appsalon.co", phone: "318 554 0921", passwordHash: hashPassword("admin1234") },
];

const CLIENT_NAMES = ["Isabella M.", "Santiago L.", "Mariana R.", "Tomás P.", "Valeria G.", "Daniel C.", "Lucía H.", "Mateo S.", "Sara Q.", "Nicolás B.", "Gabriela T.", "Juan E."];
const REVIEWS_BY_RATING = {
  5: [
    "Llegué sin una idea clara y {st} me asesoró con mucha paciencia. El resultado quedó natural y exactamente como lo imaginaba.",
    "Puntualidad total: me atendieron a la hora exacta. {st} explicó cada paso y me dejó recomendaciones de cuidado para la casa.",
    "El ambiente es tranquilo y elegante. {st} fue muy detallista y se nota la experiencia. Ya agendé mi próxima cita.",
    "Tenía el cabello maltratado y salí con un brillo increíble. {st} usó productos de muy buena calidad y sin olores fuertes.",
    "Me encantó que me recordaran la cita por WhatsApp. {st} es súper amable y profesional; lo recomiendo totalmente.",
  ],
  4: [
    "Excelente atención desde la reserva y el acabado fue impecable. Tuve que esperar unos minutos, pero {st} lo compensó con un gran trabajo.",
    "Muy buen resultado y precio justo. {st} fue atenta en todo momento; solo me habría gustado un poco más de tiempo en el peinado final.",
  ],
  3: ["Buen servicio y el resultado me gustó, aunque la cita se demoró más de lo previsto. {st} fue amable y resolvió mis dudas."],
};
const reviewText = (rating, stylistName, rand) => {
  const pool = REVIEWS_BY_RATING[rating] || REVIEWS_BY_RATING[5];
  return pool[Math.floor(rand() * pool.length)].replace("{st}", firstName(stylistName));
};

/* ------------------------------------------------------------------ */
/* Disponibilidad (núcleo puro, reutilizable por la semilla)            */
/* ------------------------------------------------------------------ */
const SLOT_STEP = 30;
const dayKey = (iso) => {
  const d = parseISODate(iso).getDay();
  return d === 0 ? "sunday" : d === 6 ? "saturday" : "weekdays";
};
const hoursFor = (brand, iso) => {
  const h = brand.hours?.[dayKey(iso)];
  if (!h || h.closed) return null;
  return { open: toMinutes(h.open), close: toMinutes(h.close) };
};
const isActiveAppt = (a) => a.status !== "cancelada";
const canDo = (st, service) => st.active && service && st.categories.includes(service.category);

function slotsFor(ctx, date, service, { ignoreId, stylistId } = {}) {
  if (!service || service.type === "product") return [];
  const hours = hoursFor(ctx.brand, date);
  if (!hours) return [];
  const team = ctx.stylists.filter((st) => canDo(st, service) && (!stylistId || st.id === stylistId));
  const dayAppts = ctx.appointments.filter((a) => a.date === date && isActiveAppt(a) && a.id !== ignoreId);
  const now = new Date();
  const minStart = date === toISODate(now) ? now.getHours() * 60 + now.getMinutes() + 30 : date < toISODate(now) ? Infinity : 0;
  const slots = [];
  for (let m = hours.open; m + service.duration <= hours.close; m += SLOT_STEP) {
    const free = m < minStart ? [] : team.filter((st) => !dayAppts.some((a) => a.stylistId === st.id && m < toMinutes(a.time) + a.duration && toMinutes(a.time) < m + service.duration)).map((s) => s.id);
    slots.push({ time: fromMinutes(m), free, status: free.length === 0 ? "busy" : free.length === 1 && !stylistId ? "last" : "available" });
  }
  if (stylistId) {
    // Agenda individual: "Último cupo" cuando a la especialista le quedan ≤ 2 bloques en el día.
    const open = slots.filter((s) => s.status !== "busy");
    if (open.length <= 2) open.forEach((s) => (s.status = "last"));
  }
  return slots;
}

/* ------------------------------------------------------------------ */
/* Semilla                                                             */
/* ------------------------------------------------------------------ */
const seeded = (seed) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

function createSeedState() {
  const rand = seeded(20261113);
  const today = new Date();
  const nowMin = today.getHours() * 60 + today.getMinutes();
  const ctx = { brand: DEFAULT_BRAND, stylists: SEED_STYLISTS, appointments: [] };
  const reviews = [];
  const byId = Object.fromEntries(SEED_SERVICES.map((s) => [s.id, s]));
  const push = (a) => {
    const s = byId[a.serviceId];
    const appt = { id: uid("ap"), code: bookingCode(), duration: s.duration, price: s.price, serviceName: s.name, source: "web", createdAt: Date.now(), reviewed: false, notes: "", ...a };
    ctx.appointments.push(appt);
    return appt;
  };

  for (let offset = -21; offset <= 6; offset++) {
    const date = toISODate(addDays(today, offset));
    const hours = hoursFor(DEFAULT_BRAND, date);
    if (!hours) continue;
    SEED_STYLISTS.forEach((st) => {
      const pool = SEED_SERVICES.filter((s) => s.type === "service" && st.categories.includes(s.category));
      let cursor = hours.open + Math.floor(rand() * 4) * SLOT_STEP;
      const count = 2 + Math.floor(rand() * 3);
      for (let i = 0; i < count; i++) {
        const service = pool[Math.floor(rand() * pool.length)];
        if (cursor + service.duration > hours.close) break;
        const past = offset < 0 || (offset === 0 && cursor + service.duration <= nowMin);
        const r = rand();
        const status = past ? (r < 0.08 ? "no-asistio" : r < 0.13 ? "cancelada" : "completada") : r < 0.06 ? "cancelada" : "confirmada";
        const appt = push({
          serviceId: service.id, stylistId: st.id, stylistName: st.name, date, time: fromMinutes(cursor), clientId: "walk-in",
          clientName: CLIENT_NAMES[Math.floor(rand() * CLIENT_NAMES.length)], clientPhone: `3${10 + Math.floor(rand() * 89)} ${100 + Math.floor(rand() * 899)} ${1000 + Math.floor(rand() * 8999)}`,
          status, source: rand() < 0.3 ? "manual" : "web",
        });
        if (status === "completada" && rand() < 0.45) {
          const rr = rand();
          const rating = rr < 0.72 ? 5 : rr < 0.94 ? 4 : 3;
          appt.reviewed = true;
          reviews.push({ id: uid("rv"), appointmentId: appt.id, serviceId: service.id, stylistId: st.id, rating, comment: reviewText(rating, st.name, rand), author: appt.clientName, createdAt: appointmentStart(appt).getTime() + 3 * 36e5 });
        }
        cursor += Math.ceil(service.duration / SLOT_STEP) * SLOT_STEP + Math.floor(rand() * 4) * SLOT_STEP;
      }
    });
  }

  // Historial de la clienta demo (fechas fijas y realistas).
  const demoAt = (date, time, serviceId, stylistId, status, extra = {}) =>
    push({ serviceId, stylistId, stylistName: SEED_STYLISTS.find((s) => s.id === stylistId).name, date, time, clientId: "u-demo", clientName: "Laura Gómez", clientPhone: DEMO_CLIENT_PHONE, status, source: "web", ...extra });
  const LAURA_HISTORY = [
    { date: "2026-09-12", time: "10:00", serviceId: "coloracion-signature", stylistId: "st-camila", status: "completada", code: "AS-7K2M9Q", rating: 5, comment: "Camila entendió perfecto el cobrizo cálido que quería. Me formuló el tono frente a mí, el brillo duró semanas y me dejó una rutina clara para cuidarlo." },
    { date: "2026-10-04", time: "11:00", serviceId: "corte-bob-editorial", stylistId: "st-andres", status: "completada", code: "AS-4PX8TN", rating: 4, comment: "Andrés hizo un bob precioso y muy preciso en la nuca. Solo esperé unos minutos al llegar, pero el resultado valió totalmente la pena." },
    { date: "2026-10-18", time: "15:30", serviceId: "ritual-hidratacion", stylistId: "st-sofia", status: "completada", code: "AS-9HV3LD", rating: 5, comment: "El ritual de hidratación con Sofía fue un spa completo: masaje relajante, cero frizz durante semanas y me recomendó el aceite de argán ideal para mis puntas." },
    { date: "2026-10-25", time: "17:00", serviceId: "balayage-natural", stylistId: "st-camila", status: "cancelada", code: "AS-2RW6YC", cancelReason: "Cambio de planes" },
    { date: "2026-11-07", time: "10:30", serviceId: "corte-styling", stylistId: "st-sofia", status: "completada", code: "AS-6JN4QF" },
  ];
  const lauraAppts = LAURA_HISTORY.map((h) => {
    const appt = demoAt(h.date, h.time, h.serviceId, h.stylistId, h.status, {
      code: h.code, reviewed: !!h.rating, createdAt: parseISODate(h.date).getTime() - 5 * 864e5,
      ...(h.status === "completada" ? { completedAt: appointmentStart({ date: h.date, time: h.time }).getTime() + byId[h.serviceId].duration * 60000 } : {}),
      ...(h.cancelReason ? { cancelReason: h.cancelReason, cancelledAt: parseISODate(h.date).getTime() - 864e5 } : {}),
    });
    if (h.rating) reviews.push({ id: uid("rv"), appointmentId: appt.id, serviceId: h.serviceId, stylistId: h.stylistId, rating: h.rating, comment: h.comment, author: "Laura G.", createdAt: appt.completedAt + 5 * 36e5 });
    return appt;
  });
  // Evita que citas aleatorias de otros clientes se crucen con el historial de Laura.
  const clash = (a) => a.clientId !== "u-demo" && lauraAppts.some((l) => l.stylistId === a.stylistId && l.date === a.date && toMinutes(a.time) < toMinutes(l.time) + l.duration && toMinutes(l.time) < toMinutes(a.time) + a.duration);
  ctx.appointments = ctx.appointments.filter((a) => !clash(a));
  const liveIds = new Set(ctx.appointments.map((a) => a.id));
  for (let i = reviews.length - 1; i >= 0; i--) if (!liveIds.has(reviews[i].appointmentId)) reviews.splice(i, 1);

  // Próxima cita activa con Sofía (relativa a hoy).
  for (let d = 1; d <= 6; d++) {
    const iso = toISODate(addDays(today, d));
    const slot = slotsFor(ctx, iso, byId["corte-styling"], { stylistId: "st-sofia" }).find((s) => s.status !== "busy" && toMinutes(s.time) >= 10 * 60);
    if (slot) {
      demoAt(iso, slot.time, "corte-styling", "st-sofia", "confirmada", { code: "AS-3TQ8VB" });
      break;
    }
  }

  // Compras de productos en el salón (historial de compras del cliente).
  const purchases = [
    { id: "pu-laura-1", code: "AS-ARG718", userId: "u-demo", productId: "aceite-argan", productName: byId["aceite-argan"].name, category: byId["aceite-argan"].category, qty: 1, price: byId["aceite-argan"].price, date: "2026-10-18", time: "16:25", stylistId: "st-sofia", stylistName: "Sofía Vargas", status: "completada", paymentMethod: "Visa Débito •••• 4829" },
  ];

  return {
    version: SEED_VERSION,
    brand: DEFAULT_BRAND,
    categories: DEFAULT_CATEGORIES,
    services: SEED_SERVICES,
    stylists: SEED_STYLISTS,
    users: SEED_USERS,
    appointments: ctx.appointments,
    purchases,
    reviews,
    notifications: [
      { id: uid("nt"), title: "Bienvenida", body: "Tus reservas, recordatorios y beneficios en un solo lugar.", createdAt: Date.now() - 3600e3, read: false, audience: "all" },
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Store externo + persistencia + sincronización entre pestañas         */
/* ------------------------------------------------------------------ */
function load() {
  try {
    // Datos de versiones anteriores → se descartan y se restaura la semilla actual.
    LEGACY_KEYS.forEach((k) => {
      localStorage.removeItem(k);
      sessionStorage.removeItem(k);
    });
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.version === SEED_VERSION && Array.isArray(parsed.appointments)) return parsed;
    }
  } catch {
    /* almacenamiento bloqueado o corrupto */
  }
  return createSeedState();
}
function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    // Ya no existen reservas anónimas: cualquier sesión de invitado heredada se descarta.
    return parsed && !parsed.guest ? parsed : null;
  } catch {
    return null;
  }
}

let state = load();
let session = loadSession();
const listeners = new Set();
const uiListeners = new Set();
const notify = () => listeners.forEach((l) => l());
const emitUI = (event) => uiListeners.forEach((l) => l(event));
const toast = (message, tone = "success") => emitUI({ type: "toast", message, tone });

function persist(next) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}
/** Escribe de forma síncrona (validación de concurrencia) y persiste. */
function commit(fn) {
  const next = fn(state);
  if (!persist(next)) {
    toast("El almacenamiento del navegador está lleno. Usa imágenes más livianas.", "error");
    return false;
  }
  state = next;
  notify();
  return true;
}
function setSession(next, remember = true) {
  session = next;
  try {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    if (next) (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, JSON.stringify(next));
  } catch {
    /* ignorar */
  }
  notify();
}
persist(state);

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        state = JSON.parse(e.newValue);
        notify();
      } catch {
        /* ignorar */
      }
    }
    if (e.key === SESSION_KEY) {
      session = loadSession();
      notify();
    }
  });
}

export const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
export const onUIEvent = (fn) => {
  uiListeners.add(fn);
  return () => uiListeners.delete(fn);
};
export const getState = () => state;
export const getSession = () => session;
export const useSalonState = () => useSyncExternalStore(subscribe, getState);
export const useSession = () => useSyncExternalStore(subscribe, getSession);

/* ------------------------------------------------------------------ */
/* Selectores                                                          */
/* ------------------------------------------------------------------ */
export const getBrand = () => state.brand;
export const getCategories = () => state.categories;
export const getService = (id) => state.services.find((s) => s.id === id);
export const getStylist = (id) => state.stylists.find((s) => s.id === id);
export const getStylistName = (a) => getStylist(a.stylistId)?.name || a.stylistName || "Especialista";
export const getServiceName = (a) => getService(a.serviceId)?.name || a.serviceName || "Servicio";
export const listServices = ({ includeInactive = false, type } = {}) =>
  state.services.filter((s) => (includeInactive || s.active) && (!type || s.type === type));
export const listStylists = ({ includeInactive = false } = {}) => state.stylists.filter((s) => includeInactive || s.active);
export const eligibleStylists = (service) => state.stylists.filter((st) => canDo(st, service));
export const currentUser = () => (session && !session.guest ? state.users.find((u) => u.id === session.userId) || state.stylists.find((s) => s.id === session.userId) : null);
export const openingHours = (iso) => hoursFor(state.brand, iso);
export const getDaySlots = (date, service, opts) => slotsFor(state, date, service, opts);

export function firstAvailableDate(service, opts = {}, from = new Date()) {
  for (let i = 0; i < 60; i++) {
    const iso = toISODate(addDays(from, i));
    if (getDaySlots(iso, service, opts).some((s) => s.status !== "busy")) return iso;
  }
  return toISODate(from);
}

/** Otras especialistas con cupos ese mismo día para el mismo servicio. */
export function alternativeStylists(date, service, excludeId, ignoreId) {
  return eligibleStylists(service)
    .filter((st) => st.id !== excludeId)
    .map((st) => ({ stylist: st, freeSlots: getDaySlots(date, service, { stylistId: st.id, ignoreId }).filter((s) => s.status !== "busy") }))
    .filter((x) => x.freeSlots.length > 0)
    .sort((a, b) => b.freeSlots.length - a.freeSlots.length);
}

/** Calificación promedio real (recalculada desde las reseñas) y servicios realizados. */
const statsCache = new WeakMap();
export function getStylistStats(id) {
  let all = statsCache.get(state);
  if (!all) {
    all = {};
    for (const st of state.stylists) all[st.id] = { sum: 0, reviews: 0, done: 0 };
    for (const r of state.reviews) if (all[r.stylistId]) (all[r.stylistId].sum += r.rating), all[r.stylistId].reviews++;
    for (const a of state.appointments) if (a.status === "completada" && all[a.stylistId]) all[a.stylistId].done++;
    for (const k in all) all[k].rating = all[k].reviews ? Math.round((all[k].sum / all[k].reviews) * 10) / 10 : null;
    statsCache.set(state, all);
  }
  return all[id] || { rating: null, reviews: 0, done: 0 };
}
export const bestAvailable = (freeIds) =>
  freeIds.map(getStylist).filter(Boolean).sort((a, b) => (getStylistStats(b.id).rating || 0) - (getStylistStats(a.id).rating || 0))[0];

export function getServiceRating(serviceId) {
  const rs = state.reviews.filter((r) => r.serviceId === serviceId);
  return { rating: rs.length ? Math.round((rs.reduce((s, r) => s + r.rating, 0) / rs.length) * 10) / 10 : null, count: rs.length, reviews: rs.sort((a, b) => b.createdAt - a.createdAt) };
}

/** Compras de productos realizadas por un cliente. */
export const getClientPurchases = (userId) => (state.purchases || []).filter((p) => p.userId === userId);

/**
 * Historial unificado del cliente (servicios + compras), del más reciente al más antiguo.
 * Cada registro trae lo necesario para la tabla, el recibo y "Volver a agendar".
 */
export function getClientHistory(userId) {
  const now = Date.now();
  const services = state.appointments
    .filter((a) => a.clientId === userId && (["completada", "cancelada", "no-asistio"].includes(a.status) || appointmentEnd(a).getTime() <= now))
    .map((a) => {
      const svc = getService(a.serviceId);
      const review = state.reviews.find((r) => r.appointmentId === a.id);
      return {
        id: a.id, kind: "servicio", ref: a, code: a.code, date: a.date, time: a.time, name: getServiceName(a), category: svc?.category || "Servicio",
        image: svc?.image || "", serviceId: a.serviceId, stylistId: a.stylistId, stylistName: getStylistName(a), duration: a.duration, price: a.price,
        status: a.status === "confirmada" ? "completada" : a.status, rating: review?.rating ?? null, reviewable: a.status === "completada" && !a.reviewed,
        cancelReason: a.cancelReason || "", bookable: !!svc?.active && !!getStylist(a.stylistId)?.active,
      };
    });
  const products = getClientPurchases(userId).map((p) => {
    const prod = getService(p.productId);
    return {
      id: p.id, kind: "compra", ref: p, code: p.code, date: p.date, time: p.time, name: p.productName, category: p.category, image: prod?.image || "",
      serviceId: p.productId, stylistId: p.stylistId, stylistName: getStylist(p.stylistId)?.name || p.stylistName, duration: 0, price: p.price * (p.qty || 1),
      qty: p.qty || 1, status: p.status, rating: null, reviewable: false, paymentMethod: p.paymentMethod, bookable: false,
    };
  });
  return [...services, ...products].sort((x, y) => `${y.date} ${y.time}`.localeCompare(`${x.date} ${x.time}`));
}

/** KPIs del Member Hub. */
export function getClientStats(userId) {
  const history = getClientHistory(userId);
  const done = history.filter((h) => h.status === "completada");
  const next = state.appointments
    .filter((a) => a.clientId === userId && ["confirmada", "en-atencion"].includes(a.status) && appointmentEnd(a).getTime() > Date.now())
    .sort((a, b) => appointmentStart(a) - appointmentStart(b))[0];
  return {
    next,
    servicesDone: done.filter((h) => h.kind === "servicio").length,
    totalInvested: done.reduce((sum, h) => sum + h.price, 0),
    pendingReviews: history.filter((h) => h.reviewable).map((h) => h.ref),
    tier: done.length >= 3 ? "Miembro Frecuente" : "Miembro",
  };
}

export const visibleNotifications = () => {
  if (!session) return state.notifications.filter((n) => n.audience === "all");
  const aud = new Set(["all", session.userId, session.role === "owner" ? "owner" : null]);
  return state.notifications.filter((n) => aud.has(n.audience));
};

export function formatHoursSummary(brand = state.brand) {
  const f = (h) => (h.closed ? "Cerrado" : `${h.open.replace(/^0/, "")}–${h.close.replace(/^0/, "")}`);
  return [
    ["Lun–Vie", f(brand.hours.weekdays)],
    ["Sáb", f(brand.hours.saturday)],
    ["Dom", f(brand.hours.sunday)],
  ];
}

/* ------------------------------------------------------------------ */
/* WhatsApp                                                            */
/* ------------------------------------------------------------------ */
export const appBaseUrl = () => (typeof window === "undefined" ? "" : `${window.location.origin}${window.location.pathname}`);
export const waUrl = (phone, text) => `https://wa.me/57${digits(phone).slice(-10)}?text=${encodeURIComponent(text)}`;
export const hasWhatsApp = (phone) => digits(phone).length >= 10;

export function buildStylistWhatsAppUrl(appt) {
  const st = getStylist(appt.stylistId);
  if (!st || !hasWhatsApp(st.whatsapp)) return null;
  const text = [
    `Hola ${firstName(st.name)} 👋 Tienes una cita en ${state.brand.name}:`,
    `• Servicio: ${getServiceName(appt)} (${formatDuration(appt.duration)})`,
    `• Cliente: ${appt.clientName}${appt.clientPhone ? ` · ${appt.clientPhone}` : ""}`,
    `• Fecha: ${formatDateLong(appt.date)}`,
    `• Hora: ${appt.time}`,
    `• Código: ${appt.code}`,
    appt.notes ? `• Notas: ${appt.notes}` : "",
  ].filter(Boolean).join("\n");
  return waUrl(st.whatsapp, text);
}

export function buildClientWhatsAppUrl(appt) {
  if (!hasWhatsApp(appt.clientPhone)) return null;
  const st = getStylist(appt.stylistId);
  const link = `${appBaseUrl()}#/cliente?calificar=${appt.id}`;
  const text = `Hola ${firstName(appt.clientName)} ✨ ¡Gracias por visitarnos en ${state.brand.name}! Fue un gusto atenderte en tu ${getServiceName(appt)}. ¿Nos ayudas calificando tu experiencia? ⭐ ${link}\n— ${st ? firstName(st.name) : state.brand.name}`;
  return waUrl(appt.clientPhone, text);
}

export const buildBrandWhatsAppUrl = (text) => (hasWhatsApp(state.brand.whatsapp) ? waUrl(state.brand.whatsapp, text) : null);

/* ------------------------------------------------------------------ */
/* Permisos                                                            */
/* ------------------------------------------------------------------ */
export const isOwner = () => session?.role === "owner";
export const isEmployee = () => session?.role === "employee";
const canManageAppointment = (a) => isOwner() || (isEmployee() && a.stylistId === session.userId) || (session && a.clientId === session.userId);
const denied = { error: "No tienes permisos para esta acción." };

/* ------------------------------------------------------------------ */
/* Notificaciones                                                      */
/* ------------------------------------------------------------------ */
const note = (title, body, audience, link, extra = {}) => ({ id: uid("nt"), title, body, audience, link, createdAt: Date.now(), read: false, ...extra });
const withNotes = (st, ...items) => [...items.filter(Boolean), ...st.notifications].slice(0, 80);

export function markAllRead() {
  const ids = new Set(visibleNotifications().map((n) => n.id));
  commit((st) => ({ ...st, notifications: st.notifications.map((n) => (ids.has(n.id) ? { ...n, read: true } : n)) }));
}
export const dismissNotification = (id) => commit((st) => ({ ...st, notifications: st.notifications.filter((n) => n.id !== id) }));

/** Recordatorio en vivo: cita confirmada en menos de 48 h. */
export function ensureReminder() {
  if (!session || session.role !== "client") return;
  const soon = state.appointments.find((a) => a.clientId === session.userId && a.status === "confirmada" && appointmentStart(a) - Date.now() > 0 && appointmentStart(a) - Date.now() < 48 * 36e5);
  if (soon && !state.notifications.some((n) => n.refId === soon.id))
    commit((st) => ({ ...st, notifications: withNotes(st, note("Recordatorio de cita", `${getServiceName(soon)} · ${formatDateLong(soon.date)} a las ${soon.time} con ${getStylistName(soon)}.`, session.userId, "/cliente", { refId: soon.id })) }));
}

/* ------------------------------------------------------------------ */
/* Autenticación y roles                                               */
/* ------------------------------------------------------------------ */
const sessionFor = (record, role) => ({ userId: record.id, role, guest: false, name: record.name, phone: record.phone || record.whatsapp || "" });
const emailTaken = (email, exceptId) =>
  [...state.users, ...state.stylists].some((u) => u.email?.toLowerCase() === email.toLowerCase() && u.id !== exceptId);

export function login(role, identifier, password, remember = true) {
  const id = identifier.trim().toLowerCase();
  const dg = digits(id);
  const match = (r) => r.email?.toLowerCase() === id || (dg.length >= 10 && digits(r.phone || r.whatsapp).endsWith(dg.slice(-10)));
  const pool = role === "employee" ? state.stylists : state.users.filter((u) => (u.role || "client") === role);
  const record = pool.find(match);
  if (!record || record.passwordHash !== hashPassword(password)) {
    const elsewhere = Object.keys(ROLES).find((r) => r !== role && (r === "employee" ? state.stylists : state.users.filter((u) => (u.role || "client") === r)).some(match));
    return { error: elsewhere ? `Esta cuenta pertenece al perfil “${ROLES[elsewhere]}”. Cambia el tipo de acceso arriba.` : "Correo/celular o contraseña incorrectos." };
  }
  if (role === "employee" && !record.active) return { error: "Tu acceso está desactivado. Habla con la administradora." };
  setSession(sessionFor(record, role), remember);
  toast(`Hola, ${firstName(record.name)}`);
  return { role, home: HOME_BY_ROLE[role] };
}

/**
 * Acceso demo en 1 clic, siempre disponible (también en producción / GitHub Pages).
 * Si la cuenta demo fue desactivada, borrada o modificada desde los paneles,
 * se restauran sus credenciales y su estado antes de iniciar sesión.
 */
export function loginDemo(role) {
  const acc = DEMO_ACCOUNTS[role];
  if (!acc) return { error: "Perfil de demostración no disponible." };
  const coll = role === "employee" ? "stylists" : "users";
  const seedRecord = (role === "employee" ? SEED_STYLISTS : SEED_USERS).find((r) => r.id === acc.id);
  let record = state[coll].find((r) => r.id === acc.id);
  const healthy = record && record.email?.toLowerCase() === acc.identifier && record.passwordHash === seedRecord.passwordHash && (role !== "employee" || record.active) && (role === "employee" || (record.role || "client") === role);
  if (!healthy) {
    const fixed = record
      ? { ...record, email: acc.identifier, passwordHash: seedRecord.passwordHash, ...(role === "employee" ? { active: true } : { role }) }
      : { ...seedRecord };
    const ok = commit((s) => ({ ...s, [coll]: record ? s[coll].map((r) => (r.id === acc.id ? fixed : r)) : [...s[coll], fixed] }));
    if (!ok) return { error: "No se pudo preparar la cuenta de demostración." };
    record = fixed;
  }
  setSession(sessionFor(record, role), true);
  toast(`Hola, ${firstName(record.name)}`);
  return { role, home: HOME_BY_ROLE[role] };
}

export function registerClient(v) {
  const email = v.email.trim().toLowerCase();
  if (emailTaken(email)) return { error: "Ya existe una cuenta con ese correo. Inicia sesión o usa otro." };
  const user = { id: uid("u"), role: "client", name: v.name.trim(), email, phone: v.phone.trim(), passwordHash: hashPassword(v.password), allergies: v.allergies || "", birthDate: "", address: "", preferences: "", notifications: { whatsapp: !!v.whatsapp, email: !!v.news }, payments: [], favorites: [] };
  if (!commit((st) => ({ ...st, users: [...st.users, user], notifications: withNotes(st, note(`Bienvenida, ${firstName(user.name)}`, "Tu cuenta está lista. Agenda tu primera cita en segundos.", user.id, "/reservar")) }))) return { error: "No se pudo guardar." };
  setSession(sessionFor(user, "client"));
  toast("Cuenta creada con éxito");
  return { home: "/cliente" };
}

/** Registro de empresa: crea la cuenta de la dueña y personaliza la marca. */
export function registerOwner(v) {
  const email = v.email.trim().toLowerCase();
  if (emailTaken(email)) return { error: "Ese correo ya está registrado." };
  const user = { id: uid("u"), role: "owner", name: v.name.trim(), email, phone: v.phone.trim(), passwordHash: hashPassword(v.password) };
  const ok = commit((st) => ({
    ...st,
    users: [...st.users, user],
    brand: { ...st.brand, name: v.business.trim() || st.brand.name, logo: v.logo || st.brand.logo, whatsapp: v.phone.trim() || st.brand.whatsapp, email },
    notifications: withNotes(st, note("Tu negocio está listo", "Configura tu catálogo, equipo y horarios desde el panel.", user.id, "/admin/catalogo")),
  }));
  if (!ok) return { error: "No se pudo guardar (almacenamiento lleno)." };
  setSession(sessionFor(user, "owner"));
  toast("Negocio registrado");
  return { home: "/admin/catalogo" };
}

/** Registro de empleada: requiere el código de invitación del local. */
export function registerEmployee(v) {
  if (v.inviteCode.trim().toUpperCase() !== state.brand.inviteCode.toUpperCase()) return { error: "El código de invitación no es válido. Pídelo a la administradora del local." };
  const email = v.email.trim().toLowerCase();
  if (emailTaken(email)) return { error: "Ese correo ya está registrado." };
  const st = { id: uid("st"), name: v.name.trim(), title: "Estilista", bio: "", yearsExperience: 0, specialty: v.specialty.trim() || "Estilismo", categories: v.categories?.length ? v.categories : [state.categories[0]], photo: v.photo || "", email, whatsapp: v.phone.trim(), passwordHash: hashPassword(v.password), active: true, createdAt: Date.now() };
  if (!commit((s) => ({ ...s, stylists: [...s.stylists, st], notifications: withNotes(s, note("Nueva integrante del equipo", `${st.name} se unió como ${st.specialty}.`, "owner", "/admin/equipo")) }))) return { error: "No se pudo guardar." };
  setSession(sessionFor(st, "employee"));
  toast("¡Bienvenida al equipo!");
  return { home: "/empleada" };
}

/* ------------------------------------------------------------------ */
/* Intención de reserva (visitante sin sesión → login → reserva)        */
/* ------------------------------------------------------------------ */
const INTENT_KEY = "appsalon.booking-intent.v1";
const INTENT_FIELDS = ["service", "stylist", "date"];

/** Guarda temporalmente lo que el visitante quería agendar (servicio, especialista, fecha). */
export function saveBookingIntent(query = {}) {
  const intent = Object.fromEntries(INTENT_FIELDS.filter((k) => query[k]).map((k) => [k, String(query[k])]));
  try {
    sessionStorage.setItem(INTENT_KEY, JSON.stringify({ ...intent, savedAt: Date.now() }));
  } catch {
    /* almacenamiento no disponible */
  }
}
export function peekBookingIntent() {
  try {
    const raw = sessionStorage.getItem(INTENT_KEY);
    const intent = raw ? JSON.parse(raw) : null;
    // La intención expira a los 30 minutos.
    return intent && Date.now() - intent.savedAt < 30 * 60000 ? intent : null;
  } catch {
    return null;
  }
}
export function consumeBookingIntent() {
  const intent = peekBookingIntent();
  try {
    sessionStorage.removeItem(INTENT_KEY);
  } catch {
    /* ignorar */
  }
  return intent;
}
export const bookingIntentPath = (intent) => {
  const params = new URLSearchParams(Object.fromEntries(INTENT_FIELDS.filter((k) => intent?.[k]).map((k) => [k, intent[k]])));
  return `/reservar${params.toString() ? `?${params}` : ""}`;
};
/** Texto legible de la selección guardada (para el aviso del login). */
export function describeBookingIntent(intent) {
  if (!intent) return "";
  const parts = [];
  if (intent.service && getService(intent.service)) parts.push(getService(intent.service).name);
  if (intent.stylist && getStylist(intent.stylist)) parts.push(`con ${getStylist(intent.stylist).name}`);
  if (intent.date) parts.push(`· ${formatDateLong(intent.date)}`);
  return parts.join(" ");
}
/** Destino tras autenticarse: la reserva pendiente (solo Clientes) o el panel del rol. */
export function postAuthDestination(role, fallback) {
  const intent = consumeBookingIntent();
  if (role === "client" && intent) return bookingIntentPath(intent);
  return fallback || HOME_BY_ROLE[role];
}
export const isClientSession = () => !!session && session.role === "client" && !session.guest;
export function logout() {
  setSession(null);
  toast("Sesión cerrada");
}

export function updateProfile(patch) {
  if (!session || session.guest) return denied;
  if (patch.email && emailTaken(patch.email, session.userId)) return { error: "Ese correo ya está en uso." };
  const coll = session.role === "employee" ? "stylists" : "users";
  if (!commit((st) => ({ ...st, [coll]: st[coll].map((u) => (u.id === session.userId ? { ...u, ...patch } : u)) }))) return { error: "No se pudo guardar." };
  if (patch.name || patch.phone) setSession({ ...session, name: patch.name ?? session.name, phone: patch.phone ?? session.phone });
  return {};
}

export function toggleFavorite(serviceId) {
  if (!session || session.guest || session.role !== "client") return;
  let added = false;
  commit((st) => ({
    ...st,
    users: st.users.map((u) => {
      if (u.id !== session.userId) return u;
      const has = u.favorites?.includes(serviceId);
      added = !has;
      return { ...u, favorites: has ? u.favorites.filter((f) => f !== serviceId) : [...(u.favorites || []), serviceId] };
    }),
  }));
  toast(added ? "Guardado en favoritos" : "Eliminado de favoritos");
}

/* ------------------------------------------------------------------ */
/* Citas: reservar, reagendar, cancelar, ciclo de atención              */
/* ------------------------------------------------------------------ */
function validateSlot({ serviceId, date, time, stylistId }, ignoreId) {
  const service = getService(serviceId);
  if (!service || service.type !== "service" || !service.active) return { error: "Este servicio ya no está disponible." };
  const slot = getDaySlots(date, service, { ignoreId }).find((s) => s.time === time);
  if (!slot || slot.free.length === 0) return { error: "Ese horario acaba de ocuparse. Elige otro, por favor." };
  if (stylistId === "auto" || !stylistId) return { stylistId: bestAvailable(slot.free).id, service };
  if (!slot.free.includes(stylistId)) return { error: `${getStylist(stylistId)?.name || "La especialista"} ya no está disponible a las ${time}. Elige otro horario o especialista.` };
  return { stylistId, service };
}

/**
 * Crea una cita. Reglas:
 *  - Reserva pública (web): exige sesión activa de Cliente registrado. Cero reservas anónimas.
 *  - Cita manual (recepción): exclusiva de la Dueña desde /admin.
 */
export function createAppointment(payload) {
  if (payload.manual) {
    if (!isOwner()) return denied;
  } else if (!isClientSession()) {
    return { error: "Inicia sesión o crea tu cuenta gratis para agendar y proteger tu cupo.", requiresLogin: true };
  }
  const check = validateSlot(payload);
  if (check.error) return check;
  const st = getStylist(check.stylistId);
  const appointment = {
    id: uid("ap"), code: bookingCode(), serviceId: payload.serviceId, serviceName: check.service.name, stylistId: check.stylistId, stylistName: st.name,
    date: payload.date, time: payload.time, duration: check.service.duration, price: check.service.price, status: "confirmada",
    clientId: payload.manual ? "walk-in" : session.userId, clientName: payload.clientName, clientPhone: payload.clientPhone || "", notes: payload.notes || "",
    source: payload.manual ? "manual" : "web", createdAt: Date.now(), reviewed: false,
  };
  const when = `${formatDateLong(appointment.date)} · ${appointment.time}`;
  commit((s) => ({
    ...s,
    appointments: [...s.appointments, appointment],
    notifications: withNotes(
      s,
      !payload.manual && note("Reserva confirmada", `${check.service.name} · ${when} con ${st.name}. Código ${appointment.code}.`, session.userId, "/cliente/citas"),
      note("Nueva cita asignada", `${appointment.clientName} · ${check.service.name} · ${when}.`, st.id, "/empleada"),
      note(payload.manual ? "Cita manual creada" : "Nueva reserva web", `${appointment.clientName} · ${check.service.name} · ${when} con ${st.name}.`, "owner", "/admin"),
    ),
  }));
  toast(payload.manual ? "Cita manual agregada a la agenda" : `Reserva ${appointment.code} confirmada`);
  return { appointment, stylistWhatsAppUrl: buildStylistWhatsAppUrl(appointment) };
}

/**
 * Política de Mi Local: el cliente puede reagendar o cancelar sin costo solo hasta
 * `cancelHours` antes de la cita. Dentro de ese margen debe contactar al salón.
 */
export function changeWindow(a) {
  const limit = Number(state.brand.cancelHours) || 0;
  const hoursLeft = (appointmentStart(a).getTime() - Date.now()) / 36e5;
  return { limit, hoursLeft, allowed: hoursLeft >= limit };
}
const clientWindowError = (a) => {
  if (session?.role !== "client") return null;
  const w = changeWindow(a);
  return w.allowed ? null : { error: `Faltan menos de ${w.limit} ${w.limit === 1 ? "hora" : "horas"} para tu cita. Para cambios de último momento escríbenos por WhatsApp.`, outsideWindow: true };
};

export function rescheduleAppointment(id, payload) {
  const prev = state.appointments.find((a) => a.id === id);
  if (!prev || !canManageAppointment(prev)) return denied;
  const blocked = clientWindowError(prev);
  if (blocked) return blocked;
  const check = validateSlot({ ...payload, serviceId: prev.serviceId }, id);
  if (check.error) return check;
  const st = getStylist(check.stylistId);
  const updated = { ...prev, date: payload.date, time: payload.time, stylistId: check.stylistId, stylistName: st.name, rescheduledAt: Date.now() };
  const when = `${formatDateLong(updated.date)} · ${updated.time}`;
  commit((s) => ({
    ...s,
    appointments: s.appointments.map((a) => (a.id === id ? updated : a)),
    notifications: withNotes(
      s,
      note("Cita reagendada", `${check.service.name} ahora es el ${when} con ${st.name}.`, prev.clientId, "/cliente/citas"),
      note("Cita reagendada", `${prev.clientName} movió ${check.service.name} al ${when}.`, st.id, "/empleada"),
      prev.stylistId !== st.id && note("Cita reasignada", `${prev.clientName} ya no está en tu agenda (${formatDateShort(prev.date)} ${prev.time}).`, prev.stylistId, "/empleada"),
      note("Cita reagendada", `${prev.clientName} movió ${check.service.name} al ${when}.`, "owner", "/admin"),
    ),
  }));
  toast("Cita reagendada");
  return { appointment: updated, stylistWhatsAppUrl: buildStylistWhatsAppUrl(updated) };
}

export function cancelAppointment(id, reason = "") {
  const a = state.appointments.find((x) => x.id === id);
  if (!a || !canManageAppointment(a)) return denied;
  const blocked = clientWindowError(a);
  if (blocked) return blocked;
  const name = getServiceName(a);
  const byStaff = isOwner() || isEmployee();
  commit((s) => ({
    ...s,
    appointments: s.appointments.map((x) => (x.id === id ? { ...x, status: "cancelada", cancelReason: reason, cancelledAt: Date.now() } : x)),
    notifications: withNotes(
      s,
      note(byStaff ? "El salón canceló tu cita" : "Cita cancelada", `${name} del ${formatDateLong(a.date)} fue cancelada.${byStaff ? " Escríbenos para reagendar sin costo." : " El cupo quedó libre."}`, a.clientId, "/cliente/citas"),
      note("Cancelación", `${a.clientName} · ${name} (${formatDateShort(a.date)} ${a.time}).${reason ? ` Motivo: ${reason}.` : ""}`, a.stylistId, "/empleada"),
      note("Cancelación", `${a.clientName} · ${name} (${formatDateShort(a.date)} ${a.time}) con ${getStylistName(a)}.`, "owner", "/admin"),
    ),
  }));
  toast("Cita cancelada");
  return {};
}

/** Paso 1 del ciclo: Confirmada → En atención. */
export function startAppointment(id) {
  const a = state.appointments.find((x) => x.id === id);
  if (!a || !(isOwner() || (isEmployee() && a.stylistId === session.userId))) return denied;
  if (a.status !== "confirmada") return { error: "Solo puedes iniciar citas confirmadas." };
  commit((s) => ({
    ...s,
    appointments: s.appointments.map((x) => (x.id === id ? { ...x, status: "en-atencion", startedAt: Date.now() } : x)),
    notifications: withNotes(s, note("Cita en atención", `${getStylistName(a)} inició ${getServiceName(a)} con ${a.clientName}.`, "owner", "/admin")),
  }));
  toast("Cita iniciada · En atención");
  return {};
}

/** Paso 2 del ciclo: En atención → Completada + invitación a calificar. */
export function completeAppointment(id) {
  const a = state.appointments.find((x) => x.id === id);
  if (!a || !(isOwner() || (isEmployee() && a.stylistId === session.userId))) return denied;
  if (!["confirmada", "en-atencion"].includes(a.status)) return { error: "Esta cita no se puede completar." };
  const st = getStylist(a.stylistId);
  const done = { ...a, status: "completada", completedAt: Date.now() };
  commit((s) => ({
    ...s,
    appointments: s.appointments.map((x) => (x.id === id ? done : x)),
    notifications: withNotes(
      s,
      a.clientId !== "walk-in" && note(`¿Cómo te fue con ${firstName(st?.name)}?`, `Tu ${getServiceName(a)} fue completado. Califica a ${firstName(st?.name)} en 10 segundos.`, a.clientId, `/cliente?calificar=${a.id}`, { kind: "review" }),
      note("Cita completada", `${getStylistName(a)} completó ${getServiceName(a)} · ${a.clientName} (${formatCOP(a.price)}).`, "owner", "/admin"),
    ),
  }));
  toast("Cita completada · Se invitó al cliente a calificar");
  return { appointment: done, clientWhatsAppUrl: buildClientWhatsAppUrl(done) };
}

/** Cambios administrativos de estado (dueña o empleada asignada). */
export function setAppointmentStatus(id, status) {
  if (status === "en-atencion") return startAppointment(id);
  if (status === "completada") return completeAppointment(id);
  if (status === "cancelada") return cancelAppointment(id, "Gestionado por el salón");
  const a = state.appointments.find((x) => x.id === id);
  if (!a || !(isOwner() || (isEmployee() && a.stylistId === session.userId))) return denied;
  commit((s) => ({
    ...s,
    appointments: s.appointments.map((x) => (x.id === id ? { ...x, status } : x)),
    notifications: withNotes(s, status === "no-asistio" && a.clientId !== "walk-in" && note("Registramos tu inasistencia", "Puedes reagendar cuando quieras.", a.clientId, "/cliente/citas")),
  }));
  toast(`Estado actualizado: ${STATUS_META[status]?.label || status}`);
  return {};
}

export function addReview({ appointmentId, rating, comment }) {
  const a = state.appointments.find((x) => x.id === appointmentId);
  if (!a || !session || a.clientId !== session.userId) return denied;
  if (a.status !== "completada") return { error: "Solo puedes calificar citas completadas." };
  if (a.reviewed) return { error: "Ya calificaste esta cita." };
  const r = Math.min(5, Math.max(1, Math.round(rating)));
  const author = `${firstName(session.name)} ${session.name.split(" ")[1]?.[0] ?? ""}.`.replace(/\s\.$/, "");
  commit((s) => ({
    ...s,
    appointments: s.appointments.map((x) => (x.id === appointmentId ? { ...x, reviewed: true } : x)),
    reviews: [{ id: uid("rv"), appointmentId, serviceId: a.serviceId, stylistId: a.stylistId, rating: r, comment, author, createdAt: Date.now() }, ...s.reviews],
    notifications: withNotes(
      s,
      note("Nueva reseña", `${"★".repeat(r)} de ${a.clientName}${comment ? `: “${comment}”` : ""}`, a.stylistId, "/empleada/resenas"),
      note("Nueva reseña", `${r}★ para ${getStylistName(a)} · ${getServiceName(a)}.`, "owner", "/admin/equipo"),
    ),
  }));
  toast(`¡Gracias! Calificaste a ${firstName(getStylistName(a))} con ${r}★`);
  return {};
}

/* ------------------------------------------------------------------ */
/* Administración: catálogo, categorías, equipo, marca                 */
/* ------------------------------------------------------------------ */
const slugify = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "item";

export function saveCatalogItem(data) {
  if (!isOwner()) return denied;
  const isProduct = data.type === "product";
  const errors = {
    name: validators.required(data.name),
    category: state.categories.includes(data.category) ? "" : "Elige una categoría.",
    price: validators.price(data.price),
    duration: isProduct ? "" : validators.duration(data.duration),
  };
  if (Object.values(errors).some(Boolean)) return { errors };
  const base = {
    type: isProduct ? "product" : "service", name: data.name.trim(), category: data.category, price: Math.round(Number(data.price)),
    duration: isProduct ? 0 : Math.round(Number(data.duration)), tagline: (data.tagline || "").trim(), description: (data.description || "").trim(),
    includes: (Array.isArray(data.includes) ? data.includes : String(data.includes || "").split(",")).map((x) => x.trim()).filter(Boolean),
    featured: !!data.featured, active: data.active !== false, image: data.image || "",
    products: (data.products || "").trim(), aftercare: (data.aftercare || "").trim(),
  };
  base.gallery = data.image && data.gallery?.[0] !== data.image ? [data.image, ...(data.gallery || []).filter((g) => g !== data.image)].slice(0, 4) : data.gallery?.length ? data.gallery : [data.image].filter(Boolean);
  let saved;
  const ok = commit((s) => {
    if (data.id && s.services.some((x) => x.id === data.id)) {
      saved = { ...s.services.find((x) => x.id === data.id), ...base };
      return { ...s, services: s.services.map((x) => (x.id === data.id ? saved : x)) };
    }
    let id = slugify(base.name);
    while (s.services.some((x) => x.id === id)) id = `${id}-${Math.random().toString(36).slice(2, 5)}`;
    saved = { id, ...base, createdAt: Date.now() };
    return { ...s, services: [saved, ...s.services] };
  });
  if (!ok) return { error: "No se pudo guardar: almacenamiento lleno." };
  toast(data.id ? "Cambios publicados en la tienda" : `${isProduct ? "Producto" : "Servicio"} publicado en la tienda`);
  return { item: saved };
}

export function deleteCatalogItem(id) {
  if (!isOwner()) return denied;
  if (state.appointments.some((a) => a.serviceId === id)) {
    commit((s) => ({ ...s, services: s.services.map((x) => (x.id === id ? { ...x, active: false } : x)) }));
    toast("Tiene citas asociadas: se archivó y ya no aparece en la tienda");
    return { archived: true };
  }
  commit((s) => ({ ...s, services: s.services.filter((x) => x.id !== id) }));
  toast("Eliminado del catálogo");
  return {};
}

export function saveCategories(list) {
  if (!isOwner()) return denied;
  const clean = [...new Set(list.map((c) => c.trim()).filter(Boolean))];
  if (clean.length === 0) return { error: "Debe existir al menos una categoría." };
  if (clean.length > MAX_CATEGORIES) return { error: `Máximo ${MAX_CATEGORIES} categorías para mantener la tienda simple (Ley de Hick).` };
  const removed = state.categories.filter((c) => !clean.includes(c));
  const inUse = removed.find((c) => state.services.some((s) => s.category === c && s.active));
  if (inUse) return { error: `“${inUse}” tiene ítems activos. Muévelos o archívalos antes de eliminarla.` };
  commit((s) => ({ ...s, categories: clean }));
  toast("Categorías actualizadas");
  return {};
}

export function renameCategory(from, to) {
  if (!isOwner()) return denied;
  const name = to.trim();
  if (!name) return { error: "El nombre no puede estar vacío." };
  if (state.categories.includes(name)) return { error: "Ya existe esa categoría." };
  commit((s) => ({
    ...s,
    categories: s.categories.map((c) => (c === from ? name : c)),
    services: s.services.map((x) => (x.category === from ? { ...x, category: name } : x)),
    stylists: s.stylists.map((x) => ({ ...x, categories: x.categories.map((c) => (c === from ? name : c)) })),
  }));
  toast("Categoría renombrada");
  return {};
}

export function saveStylist(data) {
  if (!isOwner()) return denied;
  const isNew = !data.id;
  const errors = {
    name: validators.name(data.name),
    specialty: validators.required(data.specialty),
    whatsapp: validators.phone(data.whatsapp || ""),
    email: validators.email(data.email || "") || (emailTaken(data.email.trim(), data.id) ? "Ese correo ya está en uso." : ""),
    password: isNew || data.password ? validators.password(data.password || "") : "",
    categories: data.categories?.length ? "" : "Elige al menos una categoría.",
  };
  if (Object.values(errors).some(Boolean)) return { errors };
  const base = {
    name: data.name.trim(), title: (data.title || "Estilista").trim(), specialty: data.specialty.trim(), categories: data.categories, photo: data.photo || "",
    email: data.email.trim().toLowerCase(), whatsapp: data.whatsapp.trim(), active: data.active !== false,
    bio: (data.bio || "").trim(), yearsExperience: Math.max(0, Math.round(Number(data.yearsExperience) || 0)),
  };
  if (data.password) base.passwordHash = hashPassword(data.password);
  let saved;
  const ok = commit((s) => {
    if (!isNew) {
      saved = { ...s.stylists.find((x) => x.id === data.id), ...base };
      return { ...s, stylists: s.stylists.map((x) => (x.id === data.id ? saved : x)) };
    }
    saved = { id: uid("st"), ...base, createdAt: Date.now() };
    return { ...s, stylists: [...s.stylists, saved], notifications: withNotes(s, note(`Bienvenida, ${firstName(saved.name)}`, "Ya puedes ver tu agenda y gestionar tus citas.", saved.id, "/empleada")) };
  });
  if (!ok) return { error: "No se pudo guardar: almacenamiento lleno." };
  toast(isNew ? `${firstName(saved.name)} se unió al equipo` : "Perfil actualizado");
  return { stylist: saved };
}

export function deleteStylist(id) {
  if (!isOwner()) return denied;
  const upcoming = state.appointments.some((a) => a.stylistId === id && a.status === "confirmada" && appointmentEnd(a) > new Date());
  const hasHistory = state.appointments.some((a) => a.stylistId === id);
  if (upcoming || hasHistory) {
    commit((s) => ({ ...s, stylists: s.stylists.map((x) => (x.id === id ? { ...x, active: false } : x)) }));
    toast(upcoming ? "Tiene citas próximas: se desactivó (reasígnalas desde la agenda)" : "Se desactivó para conservar el historial");
    return { archived: true };
  }
  commit((s) => ({ ...s, stylists: s.stylists.filter((x) => x.id !== id) }));
  toast("Integrante eliminada");
  return {};
}

export function updateBrand(patch) {
  if (!isOwner()) return denied;
  if (patch.name !== undefined && !patch.name.trim()) return { error: "El nombre del negocio es obligatorio." };
  if (!commit((s) => ({ ...s, brand: { ...s.brand, ...patch, hours: { ...s.brand.hours, ...(patch.hours || {}) } } }))) return { error: "No se pudo guardar: almacenamiento lleno." };
  toast("Marca actualizada en toda la app");
  return {};
}

export function resetDemoData() {
  const fresh = createSeedState();
  persist(fresh);
  state = fresh;
  setSession(null);
  toast("Datos de demostración restaurados");
}

export const storageUsageKB = () => {
  try {
    return Math.round((localStorage.getItem(STORAGE_KEY)?.length || 0) / 1024);
  } catch {
    return 0;
  }
};

export const STATUS_META = {
  confirmada: { label: "Confirmada", tone: "copper" },
  "en-atencion": { label: "En atención", tone: "ink" },
  completada: { label: "Completada", tone: "success" },
  cancelada: { label: "Cancelada", tone: "error" },
  "no-asistio": { label: "No asistió", tone: "alert" },
};

export const formatPhone = (p = "") => {
  const d = digits(p).slice(-10);
  return d.length === 10 ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : p;
};

/** Datos públicos del local (Mi Local) con enlaces de contacto listos para usar. */
export function getBusinessProfile() {
  const b = state.brand;
  const phone = digits(b.whatsapp).slice(-10);
  return {
    ...b,
    phoneDisplay: `+57 ${formatPhone(b.whatsapp)}`,
    whatsappUrl: phone.length === 10 ? `https://wa.me/57${phone}` : null,
    emailUrl: b.email ? `mailto:${b.email}` : null,
    instagramUrl: b.instagram ? `https://instagram.com/${b.instagram.replace(/^@/, "")}` : null,
    fullAddress: [b.address, b.city].filter(Boolean).join(", "),
  };
}

/** Preguntas frecuentes con datos reales del local (política, horarios, contacto). */
export function getFaqs() {
  const b = state.brand;
  const hours = formatHoursSummary(b).map(([d, h]) => `${d} ${h}`).join(", ");
  const h = Number(b.cancelHours) || 2;
  return [
    {
      q: "¿Cómo reagendo o cancelo una cita?",
      a: `Ingresa a tu cuenta, abre “Mis citas” y elige la cita. Con “Reagendar” ves la agenda en tiempo real y mueves tu cita en segundos; con “Cancelar” liberas el cupo para otra persona. Nuestra política: ${b.cancellationPolicy.charAt(0).toLowerCase()}${b.cancellationPolicy.slice(1)}. Si faltan menos de ${h} ${h === 1 ? "hora" : "horas"}, escríbenos por WhatsApp y te ayudamos.`,
    },
    {
      q: "¿Puedo elegir a mi especialista?",
      a: "Sí. En el inicio, en “Conoce a nuestras especialistas”, toca “Agendar con…” en la persona que prefieras, o elígela en el paso de fecha y hora. Verás su agenda individual con los horarios libres y ocupados. Si ese día no tiene cupos, te mostramos otras especialistas disponibles para el mismo servicio y fecha, y cambias con un clic.",
    },
    {
      q: "¿Necesito una cuenta para reservar?",
      a: "Sí, y el registro es gratuito y toma menos de un minuto. Tu cuenta protege tu cupo: la reserva queda a tu nombre y nadie más puede tomarla. Además, desde tu cuenta gestionas, reagendas o cancelas tus citas, guardas tus servicios favoritos, recibes recordatorios por WhatsApp y calificas a tu especialista al terminar cada servicio.",
    },
    {
      q: "¿Qué pasa si no alcanzo a confirmar en 5 minutos?",
      a: "Mientras revisas el resumen te guardamos el horario durante 5 minutos; verás el contador en pantalla. Si el tiempo se agota, el cupo se libera para otros clientes y te avisamos. Tu servicio y tu especialista siguen seleccionados, así que solo tienes que elegir un nuevo horario.",
    },
    {
      q: "¿Cómo califico a mi especialista?",
      a: "Cuando tu especialista finaliza la cita recibes una notificación en la app (y, si lo autorizaste, un mensaje de WhatsApp) con un enlace directo para calificarla de 1 a 5 estrellas y dejar un comentario. Su promedio se actualiza al instante en toda la página y ayuda a otros clientes a elegir.",
    },
    {
      q: "¿Mis datos están protegidos?",
      a: `Sí. Tratamos tu información conforme a la Ley 1581 de 2012 de protección de datos personales en Colombia. Solo pedimos lo necesario para gestionar tus citas (nombre, celular y correo), nunca compartimos tus datos con terceros y de tus tarjetas solo guardamos la marca y los últimos 4 dígitos. Puedes consultar, actualizar o eliminar tu información cuando quieras escribiendo a ${b.email}. Horario de atención: ${hours}.`,
    },
  ];
}


/** @deprecated Usa createAppointment(). Se mantiene como alias por compatibilidad. */
export const bookAppointment = createAppointment;
