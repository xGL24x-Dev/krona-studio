import { useEffect, useMemo, useState } from "react";
import { Archive, ArchiveRestore, Check, Copy, Pencil, Plus, RefreshCw, Search, Sparkles, Tags, Trash2, X } from "lucide-react";
import { Avatar, BrandMark, ConfirmDialog, EmptyState, Field, ImageUpload, Modal, RatingInline, SmartImage, Switch, WhatsAppButton, useApp } from "../shared/ui.jsx";
import {
  MAX_CATEGORIES, appointmentEnd, deleteCatalogItem, deleteStylist, formatCOP, formatDuration, formatHoursSummary, getStylistStats, renameCategory,
  resetDemoData, saveCatalogItem, saveCategories, saveStylist, storageUsageKB, updateBrand, useSalonState, waUrl,
} from "../../services/salonService.js";

/* ================================================================== */
/* Catálogo: servicios y productos                                     */
/* ================================================================== */
const EMPTY_ITEM = { type: "service", name: "", category: "", duration: 45, price: "", tagline: "", description: "", includes: "", featured: false, active: true, image: "" };

export function CatalogManager() {
  const { services, categories } = useSalonState();
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return services.filter((s) => {
      const f = filter === "all" ? s.active : filter === "archived" ? !s.active : s.active && s.type === filter;
      return f && (!q || `${s.name} ${s.category}`.toLowerCase().includes(q));
    });
  }, [services, filter, query]);

  const counts = {
    all: services.filter((s) => s.active).length,
    service: services.filter((s) => s.active && s.type === "service").length,
    product: services.filter((s) => s.active && s.type === "product").length,
    archived: services.filter((s) => !s.active).length,
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <CategoriesCard />
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar catálogo">
          {[["all", "Publicados"], ["service", "Servicios"], ["product", "Productos"], ["archived", "Archivados"]].map(([k, l]) => (
            <button key={k} type="button" className="pill" aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}<small aria-hidden="true">{counts[k]}</small></button>
          ))}
        </div>
        <div className="search ml-auto min-w-[220px] flex-1 sm:max-w-[280px]">
          <Search size={17} aria-hidden="true" />
          <label htmlFor="cat-q" className="sr-only">Buscar en el catálogo</label>
          <input id="cat-q" type="search" placeholder="Buscar…" value={query} onChange={(e) => setQuery(e.target.value)} className="!min-h-[44px]" />
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setEditing({ ...EMPTY_ITEM, category: categories[0] })}><Plus size={18} aria-hidden="true" /> Nuevo servicio</button>
        <button type="button" className="btn btn-secondary" onClick={() => setEditing({ ...EMPTY_ITEM, type: "product", duration: 0, category: categories[0] })}><Plus size={18} aria-hidden="true" /> Nuevo producto</button>
      </div>

      {list.length === 0 ? (
        <EmptyState icon={Sparkles} title="Nada por aquí" text={filter === "archived" ? "No hay ítems archivados." : "Crea tu primer servicio o producto y aparecerá al instante en la tienda."} />
      ) : (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {list.map((s) => (
            <li key={s.id} className={`panel flex gap-4 p-4 ${s.active ? "" : "opacity-70"}`}>
              <div className="h-24 w-24 flex-none overflow-hidden bg-sand"><SmartImage src={s.image} alt="" className="h-full w-full object-cover" /></div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`status !py-0.5 text-[11px] ${s.type === "product" ? "tone-ink" : "tone-copper"}`}>{s.type === "product" ? "Producto" : "Servicio"}</span>
                  {s.featured && <span className="status tone-success !py-0.5 text-[11px]">Destacado</span>}
                  {!s.active && <span className="status tone-alert !py-0.5 text-[11px]">Archivado</span>}
                </div>
                <p className="mt-1.5 truncate text-[15px] font-semibold">{s.name}</p>
                <p className="text-[13px] text-muted">{s.category}{s.type === "service" ? ` · ${formatDuration(s.duration)}` : ""}</p>
                <p className="mt-1 text-[14px] font-semibold">{formatCOP(s.price)}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  <button type="button" className="btn btn-ghost btn-sm !px-2.5" onClick={() => setEditing({ ...s, includes: (s.includes || []).join(", ") })} aria-label={`Editar ${s.name}`}><Pencil size={15} aria-hidden="true" /> Editar</button>
                  <button type="button" className="btn btn-ghost btn-sm !px-2.5" onClick={() => saveCatalogItem({ ...s, active: !s.active })} aria-label={`${s.active ? "Archivar" : "Restaurar"} ${s.name}`}>
                    {s.active ? <Archive size={15} aria-hidden="true" /> : <ArchiveRestore size={15} aria-hidden="true" />} {s.active ? "Archivar" : "Restaurar"}
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm !px-2.5 !text-error" onClick={() => setDeleting(s)} aria-label={`Eliminar ${s.name}`}><Trash2 size={15} aria-hidden="true" /></button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <ItemEditor item={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog open={!!deleting} danger title={`¿Eliminar “${deleting?.name}”?`} description="Si tiene citas asociadas se archivará para conservar el historial; si no, se eliminará definitivamente." confirmLabel="Eliminar" onClose={() => setDeleting(null)} onConfirm={() => { deleteCatalogItem(deleting.id); setDeleting(null); }} />
    </div>
  );
}

function CategoriesCard() {
  const { categories, services } = useSalonState();
  const { toast } = useApp();
  const [adding, setAdding] = useState("");
  const [renaming, setRenaming] = useState(null);
  const [error, setError] = useState("");
  const full = categories.length >= MAX_CATEGORIES;
  const run = (res) => {
    setError(res.error || "");
    return !res.error;
  };
  return (
    <section className="panel panel-pad" aria-labelledby="cats-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="cats-title" className="flex items-center gap-2 text-[17px] font-semibold"><Tags size={18} className="text-copper-dark" aria-hidden="true" /> Categorías de la tienda</h2>
        <span className={`text-[13px] ${full ? "font-semibold text-alert" : "text-muted"}`}>{categories.length}/{MAX_CATEGORIES} · Ley de Hick: menos opciones, decisiones más rápidas</span>
      </div>
      <ul className="mt-4 flex flex-wrap gap-2">
        {categories.map((c) => (
          <li key={c} className="flex items-center gap-1 rounded-full border border-[#d4d4d8] bg-white py-1 pl-4 pr-1 text-[13px]">
            {renaming?.from === c ? (
              <form className="flex items-center gap-1" onSubmit={(e) => { e.preventDefault(); if (run(renameCategory(c, renaming.to))) setRenaming(null); }}>
                <label className="sr-only" htmlFor={`rn-${c}`}>Nuevo nombre para {c}</label>
                <input id={`rn-${c}`} autoFocus className="h-8 w-28 border-b border-copper bg-transparent outline-none" value={renaming.to} onChange={(e) => setRenaming({ from: c, to: e.target.value })} />
                <button type="submit" className="icon-btn !h-9 !w-9" aria-label="Guardar nombre"><Check size={15} aria-hidden="true" /></button>
                <button type="button" className="icon-btn !h-9 !w-9" onClick={() => setRenaming(null)} aria-label="Cancelar"><X size={15} aria-hidden="true" /></button>
              </form>
            ) : (
              <>
                <span className="font-semibold">{c}</span>
                <span className="ml-1 text-muted">{services.filter((s) => s.category === c && s.active).length}</span>
                <button type="button" className="icon-btn !h-9 !w-9" onClick={() => setRenaming({ from: c, to: c })} aria-label={`Renombrar ${c}`}><Pencil size={14} aria-hidden="true" /></button>
                <button type="button" className="icon-btn !h-9 !w-9 text-error" onClick={() => { if (run(saveCategories(categories.filter((x) => x !== c)))) toast(`Categoría “${c}” eliminada`); }} aria-label={`Eliminar categoría ${c}`}><X size={15} aria-hidden="true" /></button>
              </>
            )}
          </li>
        ))}
        {!full && (
          <li>
            <form className="flex items-center gap-1" onSubmit={(e) => { e.preventDefault(); if (adding.trim() && run(saveCategories([...categories, adding]))) setAdding(""); }}>
              <label htmlFor="new-cat" className="sr-only">Nueva categoría</label>
              <input id="new-cat" className="h-11 w-40 rounded-full border border-dashed border-[#a1a1aa] px-4 text-[13px] outline-none focus:border-copper-dark" placeholder="Nueva categoría" value={adding} onChange={(e) => setAdding(e.target.value)} maxLength={20} />
              <button type="submit" className="icon-btn" aria-label="Agregar categoría" disabled={!adding.trim()}><Plus size={18} aria-hidden="true" /></button>
            </form>
          </li>
        )}
      </ul>
      {error && <p className="field-hint mt-3 !text-error" role="alert">{error}</p>}
    </section>
  );
}

function ItemEditor({ item, onClose }) {
  const { categories } = useSalonState();
  const [v, setV] = useState(item);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  useEffect(() => {
    setV(item);
    setErrors({});
    setFormError("");
  }, [item]);
  if (!item || !v) return null;
  const isProduct = v.type === "product";
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }));
  const save = (e) => {
    e.preventDefault();
    const res = saveCatalogItem(v);
    if (res.errors) return setErrors(res.errors);
    if (res.error) return setFormError(res.error);
    onClose();
  };
  return (
    <Modal open onClose={onClose} title={item.id ? `Editar ${isProduct ? "producto" : "servicio"}` : `Nuevo ${isProduct ? "producto" : "servicio"}`} description="Se publica en la tienda al guardar." size="dialog-lg">
      <form onSubmit={save} noValidate className="grid gap-4 sm:grid-cols-2">
        {formError && <p className="notice notice-error sm:col-span-2" role="alert">{formError}</p>}
        <div className="sm:col-span-2">
          <ImageUpload label="Foto" value={v.image} onChange={(image) => setV((s) => ({ ...s, image }))} preset="photo" hint="Se redimensiona a 900px y se comprime automáticamente." />
        </div>
        <div className="sm:col-span-2" role="radiogroup" aria-label="Tipo">
          <div className="flex gap-2">
            {[["service", "Servicio (agendable)"], ["product", "Producto (venta)"]].map(([k, l]) => (
              <button key={k} type="button" role="radio" aria-checked={v.type === k} className="pill" aria-pressed={v.type === k} onClick={() => setV((s) => ({ ...s, type: k, duration: k === "product" ? 0 : s.duration || 45 }))}>{l}</button>
            ))}
          </div>
        </div>
        <Field label="Nombre" value={v.name} onChange={set("name")} error={errors.name} data-autofocus required />
        <Field as="select" label="Categoría" value={v.category} onChange={set("category")} error={errors.category}>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </Field>
        {!isProduct && <Field label="Duración (minutos)" type="number" min="15" max="480" step="5" value={v.duration} onChange={set("duration")} error={errors.duration} />}
        <Field label="Precio (COP)" type="number" min="0" step="1000" inputMode="numeric" value={v.price} onChange={set("price")} error={errors.price} hint={v.price ? formatCOP(v.price) : undefined} />
        <Field label={isProduct ? "Presentación" : "Frase corta"} placeholder={isProduct ? "Ej. 250 ml · Sin sulfatos" : "Ej. Asesoría incluida"} value={v.tagline} onChange={set("tagline")} className={isProduct ? "" : "sm:col-span-2"} />
        <Field as="textarea" label="Descripción" value={v.description} onChange={set("description")} className="sm:col-span-2" />
        <Field label={isProduct ? "Beneficios (separados por coma)" : "Incluye (separado por coma)"} value={v.includes} onChange={set("includes")} className="sm:col-span-2" />
        <Field as="textarea" label={isProduct ? "Composición" : "Productos que usamos"} value={v.products || ""} onChange={set("products")} className="sm:col-span-2" />
        <Field as="textarea" label={isProduct ? "Modo de uso" : "Recomendación de cuidado"} value={v.aftercare || ""} onChange={set("aftercare")} className="sm:col-span-2" />
        <div className="divide-y divide-line border-y border-line sm:col-span-2">
          <Switch label="Destacado en el inicio" description="Aparece en “Servicios destacados”." checked={!!v.featured} onChange={(featured) => setV((s) => ({ ...s, featured }))} />
          <Switch label="Publicado en la tienda" description="Si lo desactivas, queda archivado." checked={v.active !== false} onChange={(active) => setV((s) => ({ ...s, active }))} />
        </div>
        <div className="flex flex-col-reverse gap-2.5 sm:col-span-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary"><Check size={18} aria-hidden="true" /> {item.id ? "Guardar cambios" : "Publicar"}</button>
        </div>
      </form>
    </Modal>
  );
}

/* ================================================================== */
/* Equipo / Empleadas                                                  */
/* ================================================================== */
const EMPTY_STYLIST = { name: "", title: "Estilista", yearsExperience: "", bio: "", specialty: "", categories: [], photo: "", email: "", whatsapp: "", password: "", active: true };

export function TeamManager() {
  const { stylists, appointments, brand } = useSalonState();
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const upcoming = (id) => appointments.filter((a) => a.stylistId === id && a.status === "confirmada" && appointmentEnd(a) > new Date()).length;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[14px] text-muted">
          {stylists.filter((s) => s.active).length} activas · Código de invitación para autorregistro: <b className="text-ink">{brand.inviteCode}</b>
        </p>
        <button type="button" className="btn btn-primary" onClick={() => setEditing(EMPTY_STYLIST)}><Plus size={18} aria-hidden="true" /> Nueva empleada</button>
      </div>
      <ul className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {stylists.map((st) => {
          const stats = getStylistStats(st.id);
          return (
            <li key={st.id} className={`panel p-5 ${st.active ? "" : "opacity-70"}`}>
              <div className="flex items-start gap-4">
                <Avatar person={st} size={60} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-[16px] font-semibold">{st.name}</p>
                    {!st.active && <span className="status tone-alert !py-0.5 text-[11px]">Inactiva</span>}
                  </div>
                  <p className="text-[13px] text-muted">{st.title} · {st.specialty}{st.yearsExperience ? ` · ${st.yearsExperience} años` : ""}</p>
                  {st.bio && <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-muted">{st.bio}</p>}
                  <div className="mt-1.5"><RatingInline stats={stats} /></div>
                </div>
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-2 border-y border-line py-3 text-center">
                <div><dt className="text-[11px] uppercase tracking-[0.08em] text-subtle">Realizados</dt><dd className="font-display text-[18px] font-semibold">{stats.done}</dd></div>
                <div><dt className="text-[11px] uppercase tracking-[0.08em] text-subtle">Próximas</dt><dd className="font-display text-[18px] font-semibold">{upcoming(st.id)}</dd></div>
                <div><dt className="text-[11px] uppercase tracking-[0.08em] text-subtle">Reseñas</dt><dd className="font-display text-[18px] font-semibold">{stats.reviews}</dd></div>
              </dl>
              <p className="mt-3 text-[13px] text-muted">{st.categories.join(" · ")}</p>
              <p className="mt-1 text-[13px]">WhatsApp: <b>{st.whatsapp}</b> · {st.email}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing({ ...st, password: "" })}><Pencil size={15} aria-hidden="true" /> Editar</button>
                <WhatsAppButton href={waUrl(st.whatsapp, `Hola ${st.name.split(" ")[0]} 👋 Te escribimos desde ${brand.name}.`)} className="btn btn-ghost btn-sm">WhatsApp</WhatsAppButton>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => saveStylist({ ...st, active: !st.active })}>{st.active ? "Desactivar" : "Activar"}</button>
                <button type="button" className="btn btn-ghost btn-sm !text-error" onClick={() => setDeleting(st)} aria-label={`Eliminar a ${st.name}`}><Trash2 size={15} aria-hidden="true" /></button>
              </div>
            </li>
          );
        })}
      </ul>
      <StylistEditor stylist={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog open={!!deleting} danger title={`¿Eliminar a ${deleting?.name}?`} description="Si tiene citas o historial se desactivará para conservar los registros y dejará de recibir reservas." confirmLabel="Eliminar" onClose={() => setDeleting(null)} onConfirm={() => { deleteStylist(deleting.id); setDeleting(null); }} />
    </div>
  );
}

function StylistEditor({ stylist, onClose }) {
  const { categories } = useSalonState();
  const [v, setV] = useState(stylist);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  useEffect(() => {
    setV(stylist);
    setErrors({});
    setFormError("");
  }, [stylist]);
  if (!stylist || !v) return null;
  const isNew = !stylist.id;
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }));
  const save = (e) => {
    e.preventDefault();
    const res = saveStylist(v);
    if (res.errors) return setErrors(res.errors);
    if (res.error) return setFormError(res.error);
    onClose();
  };
  return (
    <Modal open onClose={onClose} title={isNew ? "Nueva empleada" : `Editar a ${stylist.name}`} description="El WhatsApp es obligatorio: allí recibe los avisos de cada cita." size="dialog-lg">
      <form onSubmit={save} noValidate className="grid gap-4 sm:grid-cols-2">
        {formError && <p className="notice notice-error sm:col-span-2" role="alert">{formError}</p>}
        <div className="sm:col-span-2">
          <ImageUpload label="Foto de perfil" value={v.photo} onChange={(photo) => setV((s) => ({ ...s, photo }))} preset="avatar" shape="circle" hint="Cuadrada, rostro centrado. Se comprime a 360px." />
        </div>
        <Field label="Nombre completo" value={v.name} onChange={set("name")} error={errors.name} data-autofocus required />
        <Field label="Cargo" placeholder="Ej. Estilista senior" value={v.title} onChange={set("title")} />
        <Field label="Años de experiencia" type="number" min="0" max="60" value={v.yearsExperience ?? ""} onChange={set("yearsExperience")} />
        <Field as="textarea" label="Biografía breve" placeholder="Formación, estilo y en qué se destaca…" value={v.bio || ""} onChange={set("bio")} maxLength={280} hint="Se muestra en “Conoce a nuestras especialistas”." className="sm:col-span-2" />
        <Field label="Especialidad" placeholder="Ej. Color y balayage" value={v.specialty} onChange={set("specialty")} error={errors.specialty} required />
        <Field label="WhatsApp (obligatorio)" type="tel" placeholder="300 000 0000" value={v.whatsapp} onChange={set("whatsapp")} error={errors.whatsapp} required />
        <fieldset className="sm:col-span-2">
          <legend className="field-label mb-2">Servicios que realiza</legend>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => {
              const on = v.categories.includes(c);
              return <button key={c} type="button" className="pill" aria-pressed={on} onClick={() => setV((s) => ({ ...s, categories: on ? s.categories.filter((x) => x !== c) : [...s.categories, c] }))}>{on && <Check size={14} aria-hidden="true" />} {c}</button>;
            })}
          </div>
          {errors.categories && <p className="field-hint mt-2 !text-error" role="alert">{errors.categories}</p>}
        </fieldset>
        <Field label="Correo de acceso" type="email" autoComplete="off" value={v.email} onChange={set("email")} error={errors.email} required />
        <Field label={isNew ? "Contraseña de acceso" : "Nueva contraseña (opcional)"} type="text" autoComplete="new-password" placeholder={isNew ? "Mínimo 8 caracteres" : "Déjala vacía para mantenerla"} value={v.password} onChange={set("password")} error={errors.password} />
        <div className="border-y border-line sm:col-span-2">
          <Switch label="Acceso activo" description="Puede iniciar sesión y recibir reservas." checked={v.active !== false} onChange={(active) => setV((s) => ({ ...s, active }))} />
        </div>
        <div className="flex flex-col-reverse gap-2.5 sm:col-span-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary"><Check size={18} aria-hidden="true" /> {isNew ? "Agregar al equipo" : "Guardar cambios"}</button>
        </div>
      </form>
    </Modal>
  );
}

/* ================================================================== */
/* Mi Local (marca blanca)                                             */
/* ================================================================== */
const DAYS = [["weekdays", "Lunes a viernes"], ["saturday", "Sábado"], ["sunday", "Domingo"]];

export function BrandManager() {
  const { brand } = useSalonState();
  const { toast } = useApp();
  const [v, setV] = useState(brand);
  const [error, setError] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  useEffect(() => setV(brand), [brand]);
  const dirty = JSON.stringify(v) !== JSON.stringify(brand);
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }));
  const setHour = (day, k, val) => setV((s) => ({ ...s, hours: { ...s.hours, [day]: { ...s.hours[day], [k]: val } } }));

  const save = (e) => {
    e.preventDefault();
    for (const [d, label] of DAYS) {
      const h = v.hours[d];
      if (!h.closed && h.open >= h.close) return setError(`${label}: la hora de cierre debe ser posterior a la de apertura.`);
    }
    const res = updateBrand(v);
    setError(res.error || "");
  };

  const words = (v.name || "Tu negocio").trim().split(" ");
  return (
    <form onSubmit={save} noValidate className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
        {error && <p className="notice notice-error" role="alert">{error}</p>}
        <section className="panel panel-pad grid gap-4 sm:grid-cols-2" aria-labelledby="b-id">
          <h2 id="b-id" className="text-[17px] font-semibold sm:col-span-2">Identidad</h2>
          <Field label="Nombre del negocio" value={v.name} onChange={set("name")} required />
          <Field label="Eslogan" value={v.slogan} onChange={set("slogan")} />
          <ImageUpload label="Logo / foto de perfil" value={v.logo} onChange={(logo) => setV((s) => ({ ...s, logo }))} preset="logo" shape="circle" hint="Se muestra en navbar, hero, footer, paneles y comprobantes." />
          <ImageUpload label="Foto de portada (Hero)" value={v.cover} onChange={(cover) => setV((s) => ({ ...s, cover }))} preset="cover" hint="Horizontal o vertical, se comprime a 1400px." />
        </section>
        <section className="panel panel-pad grid gap-4 sm:grid-cols-2" aria-labelledby="b-ct">
          <h2 id="b-ct" className="text-[17px] font-semibold sm:col-span-2">Contacto</h2>
          <Field label="WhatsApp del local" type="tel" value={v.whatsapp} onChange={set("whatsapp")} />
          <Field label="Correo" type="email" value={v.email} onChange={set("email")} />
          <Field label="Dirección" value={v.address} onChange={set("address")} />
          <Field label="Ciudad" value={v.city} onChange={set("city")} />
          <Field label="NIT" placeholder="000.000.000-0" value={v.nit || ""} onChange={set("nit")} />
          <Field label="Instagram" placeholder="@tusalon" value={v.instagram || ""} onChange={set("instagram")} />
        </section>
        <section className="panel panel-pad grid gap-4 sm:grid-cols-[180px_1fr]" aria-labelledby="b-cancel">
          <h2 id="b-cancel" className="text-[17px] font-semibold sm:col-span-2">Política de cancelación</h2>
          <Field label="Horas mínimas sin costo" type="number" min="0" max="72" value={v.cancelHours ?? 2} onChange={(e) => setV((s) => ({ ...s, cancelHours: Math.max(0, Number(e.target.value) || 0) }))} />
          <Field as="textarea" label="Texto visible para clientes" value={v.cancellationPolicy || ""} onChange={set("cancellationPolicy")} hint="Se muestra en la reserva, al cancelar y en Ayuda." />
        </section>
        <section className="panel panel-pad" aria-labelledby="b-hr">
          <h2 id="b-hr" className="text-[17px] font-semibold">Horarios de atención</h2>
          <p className="mt-1 text-[13px] text-muted">Controlan la disponibilidad real del calendario de reservas.</p>
          <div className="mt-4 flex flex-col divide-y divide-line">
            {DAYS.map(([d, label]) => {
              const h = v.hours[d];
              return (
                <div key={d} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="w-36 text-[14px] font-semibold">{label}</span>
                  <label className="sr-only" htmlFor={`${d}-o`}>Apertura {label}</label>
                  <input id={`${d}-o`} type="time" step="1800" className="input !min-h-[44px] !w-[130px] !pr-3" value={h.open} disabled={h.closed} onChange={(e) => setHour(d, "open", e.target.value)} />
                  <span aria-hidden="true">–</span>
                  <label className="sr-only" htmlFor={`${d}-c`}>Cierre {label}</label>
                  <input id={`${d}-c`} type="time" step="1800" className="input !min-h-[44px] !w-[130px] !pr-3" value={h.close} disabled={h.closed} onChange={(e) => setHour(d, "close", e.target.value)} />
                  <label className="check ml-auto !text-ink"><input type="checkbox" checked={h.closed} onChange={(e) => setHour(d, "closed", e.target.checked)} /> Cerrado</label>
                </div>
              );
            })}
          </div>
        </section>
        <section className="panel panel-pad" aria-labelledby="b-inv">
          <h2 id="b-inv" className="text-[17px] font-semibold">Código de invitación del equipo</h2>
          <p className="mt-1 text-[13px] text-muted">Compártelo con tus empleadas para que se registren solas en “Únete a un equipo”.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="border border-line bg-canvas px-4 py-2.5 font-display text-[18px] font-semibold tracking-[0.1em]">{v.inviteCode}</code>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setV((s) => ({ ...s, inviteCode: Math.random().toString(36).slice(2, 8).toUpperCase() }))}><RefreshCw size={15} aria-hidden="true" /> Generar nuevo</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard?.writeText(v.inviteCode).then(() => toast("Código copiado"))}><Copy size={15} aria-hidden="true" /> Copiar</button>
          </div>
        </section>
        <section className="panel panel-pad border-l-2 !border-l-error" aria-labelledby="b-dz">
          <h2 id="b-dz" className="text-[17px] font-semibold">Datos de la demo</h2>
          <p className="mt-1 text-[13px] text-muted">Uso de almacenamiento local: {storageUsageKB()} KB de ~5.000 KB.</p>
          <button type="button" className="btn btn-secondary btn-sm mt-3 !text-error" onClick={() => setResetOpen(true)}>Restaurar datos de demostración</button>
        </section>
      </div>

      <aside className="h-fit xl:sticky xl:top-24" aria-labelledby="b-prev">
        <h2 id="b-prev" className="mb-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-subtle">Vista previa en vivo</h2>
        <div className="panel overflow-hidden">
          <div className="flex items-center gap-2.5 border-b border-line bg-canvas px-4 py-3">
            {v.logo ? <img src={v.logo} alt="" className="h-8 w-8 rounded-full object-cover" /> : <BrandMark size={32} />}
            <span className="logo !min-h-0 !text-[14px]">{words.length > 1 ? <>{words.slice(0, -1).join(" ")} <b>{words[words.length - 1]}</b></> : v.name}</span>
          </div>
          <div className="relative h-40 bg-sand"><SmartImage src={v.cover} alt="" className="h-full w-full object-cover" /></div>
          <div className="p-4">
            <p className="kicker !text-[10px]">{v.slogan}</p>
            <p className="mt-2 font-display text-[20px] font-semibold leading-tight tracking-tight">Tu tiempo vale <em className="text-copper">oro.</em></p>
            <p className="mt-3 text-[12px] text-muted">{v.address} · {v.city}</p>
            <p className="text-[12px] text-muted">{v.nit ? `NIT ${v.nit}` : ""}{v.instagram ? ` · ${v.instagram}` : ""}</p>
            <p className="text-[12px] text-muted">{formatHoursSummary(v).map(([d, h]) => `${d} ${h}`).join(" · ")}</p>
          </div>
        </div>
        <button type="submit" className="btn btn-primary btn-full mt-4" disabled={!dirty}><Check size={18} aria-hidden="true" /> {dirty ? "Publicar cambios" : "Sin cambios"}</button>
        {dirty && <button type="button" className="btn btn-ghost btn-full mt-2" onClick={() => setV(brand)}>Descartar</button>}
      </aside>
      <ConfirmDialog open={resetOpen} danger title="¿Restaurar los datos de demostración?" description="Se reemplazarán catálogo, equipo, citas, reseñas y marca por los datos de ejemplo. Se cerrará la sesión." confirmLabel="Restaurar" onClose={() => setResetOpen(false)} onConfirm={() => { setResetOpen(false); resetDemoData(); window.location.hash = "/login"; }} />
    </form>
  );
}

