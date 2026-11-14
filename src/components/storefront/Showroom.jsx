import { useEffect, useId, useMemo, useState } from "react";
import { ArrowRight, Award, CalendarDays, Check, CheckCircle2, Clock, Droplets, Heart, Leaf, MessageCircle, Package, Search, Sparkles, X } from "lucide-react";
import { QuickBook } from "./QuickBook.jsx";
import { Avatar, BrandMark, EmptyState, Link, PageHeader, RatingInline, ServiceCardSkeleton, SmartImage, Stars, useApp, useSkeleton } from "../shared/ui.jsx";
import {
  addDays, buildBrandWhatsAppUrl, currentUser, eligibleStylists, firstName, formatCOP, formatDuration, getService, getServiceRating, getStylist,
  getStylistStats, listServices, listStylists, toISODate, todayISO, toggleFavorite, useSalonState, useSession,
} from "../../services/salonService.js";

const MAX_DAYS_AHEAD = 60;
const formatReviewDate = (ts) => new Date(ts).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
const FALLBACK_TESTIMONIALS = [
  { id: "t1", comment: "Reservé mientras iba en el ascensor. Al llegar, todo estaba listo para mí.", author: "Mariana R.", rating: 5, serviceId: "coloracion-signature" },
  { id: "t2", comment: "La puntualidad es impecable. Por fin un salón que entiende lo que vale mi tiempo.", author: "Daniel C.", rating: 5, serviceId: "barberia-ritual" },
  { id: "t3", comment: "Me recomendaron justo lo que necesitaba. El resultado superó mis expectativas.", author: "Valentina P.", rating: 5, serviceId: "corte-styling" },
];

/* ------------------------------------------------------------------ */
/* Tarjeta de servicio / producto                                      */
/* ------------------------------------------------------------------ */
export function ServiceCard({ service, headingLevel = 3 }) {
  const { navigate } = useApp();
  useSalonState();
  const session = useSession();
  const user = session?.role === "client" ? currentUser() : null;
  const fav = user?.favorites?.includes(service.id);
  const H = `h${headingLevel}`;
  const isProduct = service.type === "product";
  const wa = isProduct ? buildBrandWhatsAppUrl(`Hola, quiero pedir el producto “${service.name}” (${formatCOP(service.price)}).`) : null;
  return (
    <article className="service-card">
      <div className="service-image">
        <SmartImage src={service.image} alt="" width="700" height="276" />
        {isProduct ? <span className="service-tag">Producto</span> : service.featured && <span className="service-tag">Más reservado</span>}
        {user && (
          <button type="button" className="fav-btn" aria-pressed={!!fav} aria-label={fav ? `Quitar ${service.name} de favoritos` : `Guardar ${service.name} en favoritos`} onClick={() => toggleFavorite(service.id)}>
            <Heart size={18} fill={fav ? "currentColor" : "none"} aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="service-content">
        <H>
          <Link to={`/servicios/${service.id}`} className="hover:text-copper-dark">{service.name}</Link>
        </H>
        <p className="service-meta">
          {isProduct ? <Package size={16} aria-hidden="true" /> : <Clock size={16} aria-hidden="true" />}
          {isProduct ? service.tagline || service.category : `${formatDuration(service.duration)}${service.tagline ? ` · ${service.tagline}` : ""}`}
        </p>
        <div className="service-foot">
          <strong>{formatCOP(service.price)}</strong>
          {isProduct ? (
            wa && (
              <a className="text-btn" href={wa} target="_blank" rel="noreferrer" aria-label={`Pedir ${service.name} por WhatsApp`}>
                Pedir <MessageCircle size={16} aria-hidden="true" />
              </a>
            )
          ) : (
            <button type="button" className="text-btn" onClick={() => navigate(`/reservar?service=${service.id}`)} aria-label={`Reservar ${service.name}`}>
              Reservar <ArrowRight size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Tarjeta de especialista (calificación real y dinámica)              */
/* ------------------------------------------------------------------ */
export function SpecialistCard({ stylist }) {
  const { navigate } = useApp();
  const stats = getStylistStats(stylist.id);
  return (
    <article className="specialist-card">
      <div className="specialist-photo">
        {stylist.photo ? <SmartImage src={stylist.photo} alt={`Foto de ${stylist.name}`} /> : <div className="grid h-full place-items-center bg-[#ebe4dc]"><Avatar person={stylist} size={96} /></div>}
      </div>
      <div className="p-5">
        <p className="kicker !text-[10px]">{stylist.title}</p>
        <h3 className="mt-1.5 text-[18px] font-semibold tracking-tight">{stylist.name}</h3>
        <p className="mt-1 text-[13px] text-muted">{stylist.specialty}</p>
        {stylist.yearsExperience > 0 && (
          <p className="mt-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-copper-dark">
            <Award size={13} aria-hidden="true" /> {stylist.yearsExperience} años de experiencia
          </p>
        )}
        {stylist.bio && <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-muted">{stylist.bio}</p>}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <RatingInline stats={stats} />
          <span className="text-[12px] text-muted">{stats.done} servicios realizados</span>
        </div>
        <button type="button" className="btn btn-secondary btn-full mt-4" onClick={() => navigate(`/reservar?stylist=${stylist.id}`)}>
          <CalendarDays size={17} aria-hidden="true" /> Agendar con {firstName(stylist.name)}
        </button>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Home                                                                */
/* ------------------------------------------------------------------ */
export function Home() {
  const { navigate, route } = useApp();
  const { brand, reviews, categories } = useSalonState();
  const services = listServices({ type: "service" });
  const featured = (services.filter((s) => s.featured).length ? services.filter((s) => s.featured) : services).slice(0, 3);
  const team = listStylists();

  const testimonials = useMemo(() => {
    const real = reviews.filter((r) => r.rating >= 4 && r.comment && r.comment.length > 18).slice(0, 3);
    return real.length === 3 ? real : FALLBACK_TESTIMONIALS;
  }, [reviews]);

  useEffect(() => {
    if (route.query.s === "especialistas") {
      const t = setTimeout(() => document.getElementById("especialistas")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
      return () => clearTimeout(t);
    }
  }, [route.query.s, route.key]);


  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <div className="eyebrow">
          <span aria-hidden="true" /> Reservas inteligentes para tu estilo · {brand.city.split(",")[0]}
        </div>
        <div className="hero-grid">
          <div className="hero-copy">
            <h1 id="hero-title" tabIndex={-1} data-page-title>
              Tu tiempo vale <em>oro.</em>
              <br />
              Reserva tu estilo en 30 segundos.
            </h1>
            <p>La experiencia de belleza premium de {brand.name} se adapta a tu agenda. Elige servicio, especialista y horario sin llamadas ni esperas.</p>
            <QuickBook />
          </div>
          <div className="hero-visual">
            <div className="image-frame">
              <SmartImage src={brand.cover} alt={`Interior de ${brand.name}`} fetchPriority="high" loading="eager" width="700" height="510" />
            </div>
            <div className="instant-badge">
              <BrandMark size={34} />
              <div>
                <b>Confirmación instantánea</b>
                <small>Sin llamadas. Sin filas.</small>
              </div>
              <span className="status-dot ml-1" aria-hidden="true" />
            </div>
            <span className="image-caption" aria-hidden="true">{brand.name} — {brand.city.split(",")[0]}</span>
          </div>
        </div>
      </section>

      <section className="social-proof" aria-label="Prueba social">
        <div><strong>+15.000</strong><span>citas gestionadas<br />sin caídas</span></div>
        <i aria-hidden="true" />
        <div><strong>4.9/5</strong><span>valoración<br />promedio</span></div>
        <i aria-hidden="true" />
        <div><strong>{team.length}</strong><span>especialistas<br />certificadas</span></div>
        <p>Elegido por quienes valoran<br />su tiempo y su estilo.</p>
      </section>

      <section className="section" aria-labelledby="featured-title">
        <div className="section-heading">
          <div>
            <span className="kicker">Curaduría del mes</span>
            <h2 id="featured-title">Servicios destacados</h2>
          </div>
          <p>Experiencias creadas por especialistas, con productos de alta calidad y tiempos transparentes.</p>
        </div>
        <div className="service-grid">
          {featured.map((s) => <ServiceCard key={s.id} service={s} />)}
        </div>
        <div className="mt-10 flex justify-center">
          <button type="button" className="btn btn-secondary" onClick={() => navigate("/servicios")}>
            Ver catálogo completo <ArrowRight size={18} aria-hidden="true" />
          </button>
        </div>
      </section>

      <section className="section !pt-0" id="especialistas" aria-labelledby="team-title" style={{ scrollMarginTop: 90 }}>
        <div className="section-heading">
          <div>
            <span className="kicker">Nuestro equipo</span>
            <h2 id="team-title">Conoce a nuestras especialistas</h2>
          </div>
          <p>Calificaciones reales de clientes verificados. Elige con quién quieres tu cita y mira su agenda en vivo.</p>
        </div>
        <div className="team-grid">
          {team.map((st) => <SpecialistCard key={st.id} stylist={st} />)}
        </div>
      </section>

      <section className="testimonials" aria-labelledby="testimonials-title">
        <div className="section-heading">
          <div>
            <span className="kicker">Historias reales</span>
            <h2 id="testimonials-title">El lujo de sentirte bien</h2>
          </div>
          <p>Reseñas de clientes que completaron su cita. Cada una actualiza la calificación de su especialista.</p>
        </div>
        <div className="quote-grid">
          {testimonials.map((t) => {
            const st = t.stylistId ? getStylist(t.stylistId) : null;
            return (
              <figure className="quote-card" key={t.id}>
                <div className="stars">
                  <Stars value={t.rating} size={13} />
                  <span className="verified"><CheckCircle2 size={12} className="mr-1 inline" aria-hidden="true" />Verificada</span>
                </div>
                <blockquote>“{t.comment}”</blockquote>
                <figcaption className="client">
                  <span className="avatar" aria-hidden="true">{t.author.split(" ").map((w) => w[0]).join("").slice(0, 2)}</span>
                  <div>
                    <b>{t.author}</b>
                    <small>{getService(t.serviceId)?.name}{st ? ` · con ${firstName(st.name)}` : ""}{t.createdAt ? ` · ${formatReviewDate(t.createdAt)}` : ""}</small>
                  </div>
                </figcaption>
              </figure>
            );
          })}
        </div>
      </section>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Catálogo                                                            */
/* ------------------------------------------------------------------ */
const normalize = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function Catalog() {
  const { route, navigate } = useApp();
  const { categories } = useSalonState();
  const [query, setQuery] = useState("");
  const pills = ["Todos", ...categories];
  const category = pills.includes(route.query.cat) ? route.query.cat : "Todos";
  const loading = useSkeleton([query, category]);
  const searchId = useId();
  const items = listServices();

  const results = useMemo(() => {
    const q = normalize(query.trim());
    return items
      .filter((s) => (category === "Todos" || s.category === category) && (!q || normalize(`${s.name} ${s.category} ${s.tagline} ${s.description}`).includes(q)))
      .sort((a, b) => (a.type === b.type ? 0 : a.type === "service" ? -1 : 1));
  }, [query, category, items]);

  const setCategory = (c) => navigate(c === "Todos" ? "/servicios" : `/servicios?cat=${encodeURIComponent(c)}`, { replace: true, keepScroll: true });

  return (
    <div className="container-x py-14 md:py-20">
      <PageHeader kicker="Catálogo" title={<>Encuentra tu <em>ritual.</em></>}>
        Servicios con tiempos transparentes y productos profesionales. Precios finales en pesos colombianos.
      </PageHeader>
      <div className="flex flex-col gap-4">
        <div className="search">
          <Search size={19} aria-hidden="true" />
          <label htmlFor={searchId} className="sr-only">Buscar servicios y productos</label>
          <input id={searchId} type="search" placeholder="Buscar: corte, balayage, aceite…" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
          {query && (
            <button type="button" className="icon-btn absolute right-1 !h-11 !w-11" onClick={() => setQuery("")} aria-label="Limpiar búsqueda">
              <X size={18} aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:flex-wrap md:px-0" role="group" aria-label="Filtrar por categoría">
          {pills.map((c) => (
            <button key={c} type="button" className="pill" aria-pressed={category === c} onClick={() => setCategory(c)}>
              {c}
              <small aria-hidden="true">{c === "Todos" ? items.length : items.filter((s) => s.category === c).length}</small>
            </button>
          ))}
        </div>
      </div>
      <p className="mt-8 text-[13px] text-muted" aria-live="polite">
        {loading ? "Actualizando resultados…" : `${results.length} ${results.length === 1 ? "resultado" : "resultados"}${category !== "Todos" ? ` en ${category}` : ""}`}
      </p>
      <div className="service-grid mt-4" aria-busy={loading}>
        {loading
          ? Array.from({ length: Math.max(3, Math.min(results.length, 6)) }, (_, i) => <ServiceCardSkeleton key={i} />)
          : results.map((s) => (
              <div key={s.id} className="view-enter">
                <ServiceCard service={s} headingLevel={2} />
              </div>
            ))}
      </div>
      {!loading && results.length === 0 && (
        <EmptyState icon={Search} title="Sin coincidencias" text="No encontramos resultados. Prueba con otra palabra o explora todas las categorías."
          action={<button type="button" className="btn btn-secondary" onClick={() => { setQuery(""); setCategory("Todos"); }}>Ver todos</button>} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Detalle de servicio / producto                                      */
/* ------------------------------------------------------------------ */
export function ServiceDetail({ id }) {
  const { navigate } = useApp();
  useSalonState();
  const service = getService(id);
  const [active, setActive] = useState(0);
  if (!service) return null;
  const isProduct = service.type === "product";
  const gallery = service.gallery?.length ? service.gallery : [service.image];
  const team = eligibleStylists(service);
  const { rating, count, reviews } = getServiceRating(service.id);
  const wa = buildBrandWhatsAppUrl(`Hola, quiero pedir el producto “${service.name}” (${formatCOP(service.price)}).`);

  return (
    <>
      <div className="container-x pb-10 pt-8 md:pt-12">
        <nav aria-label="Ruta de navegación" className="mb-8 text-[13px] text-muted">
          <ol className="flex flex-wrap items-center gap-2">
            <li><Link to="/" className="hover:text-copper-dark">Inicio</Link></li>
            <li aria-hidden="true">/</li>
            <li><Link to="/servicios" className="hover:text-copper-dark">Catálogo</Link></li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="font-semibold text-ink">{service.name}</li>
          </ol>
        </nav>
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
          <div>
            <div className="relative aspect-[4/3] overflow-hidden bg-sand">
              <SmartImage key={gallery[active]} src={gallery[active]} alt={`Imagen ${active + 1} de ${service.name}`} className="view-enter h-full w-full object-cover" />
            </div>
            {gallery.length > 1 && (
              <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4" role="group" aria-label="Galería de resultados">
                {gallery.map((g, i) => (
                  <button key={g + i} type="button" className={`aspect-[4/3] overflow-hidden border-2 ${i === active ? "border-copper-dark" : "border-transparent opacity-75 hover:opacity-100"}`} aria-pressed={i === active} aria-label={`Ver imagen ${i + 1} de ${gallery.length}`} onClick={() => setActive(i)}>
                    <SmartImage src={g} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <span className="kicker">{isProduct ? `Producto · ${service.category}` : service.category}</span>
            <h1 className="page-title mt-3" tabIndex={-1} data-page-title>{service.name}</h1>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[14px] text-muted">
              {!isProduct && <span className="flex items-center gap-1.5"><Clock size={16} aria-hidden="true" /> {formatDuration(service.duration)}</span>}
              {rating && <span className="flex items-center gap-1.5"><Stars value={rating} size={13} /> {rating.toFixed(1)} ({count} reseñas)</span>}
              {service.tagline && <span>{service.tagline}</span>}
            </div>
            <p className="mt-6 font-display text-[28px] font-semibold tracking-tight">{formatCOP(service.price)}</p>
            {service.description && <p className="lead mt-5">{service.description}</p>}
            {service.includes?.length > 0 && (
              <>
                <h2 className="mt-9 text-[13px] font-semibold uppercase tracking-[0.12em] text-subtle">{isProduct ? "Beneficios" : "Incluye"}</h2>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {service.includes.map((inc) => (
                    <li key={inc} className="flex items-center gap-2.5 text-[14px]">
                      <span className="grid h-6 w-6 flex-none place-items-center rounded-full border border-copper text-copper-dark" aria-hidden="true"><Check size={13} /></span>
                      {inc}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {(service.products || service.aftercare) && (
              <div className="mt-9 grid gap-3">
                {service.products && (
                  <div className="panel flex gap-3 p-4">
                    <Leaf size={18} className="mt-0.5 flex-none text-copper-dark" aria-hidden="true" />
                    <div>
                      <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-subtle">{isProduct ? "Composición" : "Productos que usamos"}</h2>
                      <p className="mt-1.5 text-[14px] leading-relaxed">{service.products}</p>
                    </div>
                  </div>
                )}
                {service.aftercare && (
                  <div className="panel flex gap-3 p-4">
                    <Droplets size={18} className="mt-0.5 flex-none text-copper-dark" aria-hidden="true" />
                    <div>
                      <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-subtle">{isProduct ? "Modo de uso" : "Recomendación de cuidado"}</h2>
                      <p className="mt-1.5 text-[14px] leading-relaxed">{service.aftercare}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
            {!isProduct && (
              <>
                <h2 className="mt-10 text-[13px] font-semibold uppercase tracking-[0.12em] text-subtle">Especialistas asignadas</h2>
                <ul className="mt-4 flex flex-col gap-2.5">
                  {team.map((st) => (
                    <li key={st.id} className="panel flex flex-wrap items-center gap-3.5 p-3.5">
                      <Avatar person={st} size={44} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-semibold">{st.name}</p>
                        <p className="text-[13px] text-muted">{st.specialty}{st.yearsExperience ? ` · ${st.yearsExperience} años de experiencia` : ""}</p>
                      </div>
                      <RatingInline stats={getStylistStats(st.id)} />
                      <button type="button" className="text-btn" onClick={() => navigate(`/reservar?service=${service.id}&stylist=${st.id}`)} aria-label={`Agendar ${service.name} con ${st.name}`}>
                        Agendar <ArrowRight size={15} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                  {team.length === 0 && <li className="text-[14px] text-muted">Aún no hay especialistas asignadas a esta categoría.</li>}
                </ul>
              </>
            )}
          </div>
        </div>
        {reviews.length > 0 && (
          <section className="mt-16" aria-labelledby="reviews-title">
            <h2 id="reviews-title" className="text-[26px] font-semibold tracking-tight">Reseñas verificadas</h2>
            <ul className="mt-6 grid gap-4 md:grid-cols-2">
              {reviews.slice(0, 4).map((r) => (
                <li key={r.id} className="panel panel-pad">
                  <div className="flex items-center justify-between"><Stars value={r.rating} size={13} /><span className="verified">Verificada</span></div>
                  {r.comment && <p className="mt-3 text-[15px] leading-relaxed">“{r.comment}”</p>}
                  <p className="mt-3 text-[13px] text-muted">{r.author} · con {getStylist(r.stylistId)?.name} · {formatReviewDate(r.createdAt)}</p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
      <div className="sticky-cta">
        <div className="container-x flex items-center justify-between gap-4">
          <div className="hidden sm:block">
            <p className="text-[14px] font-semibold">{service.name}</p>
            <p className="text-[13px] text-muted">{isProduct ? service.tagline : formatDuration(service.duration)} · {formatCOP(service.price)}</p>
          </div>
          {isProduct ? (
            wa && <a className="btn btn-primary w-full sm:w-auto" href={wa} target="_blank" rel="noreferrer"><MessageCircle size={18} aria-hidden="true" /> Pedir por WhatsApp</a>
          ) : (
            <button type="button" className="btn btn-primary w-full sm:w-auto" onClick={() => navigate(`/reservar?service=${service.id}`)} disabled={team.length === 0}>
              <Sparkles size={18} aria-hidden="true" /> Agendar este servicio
            </button>
          )}
        </div>
      </div>
    </>
  );
}
