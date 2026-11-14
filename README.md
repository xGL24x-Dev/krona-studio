<div align="center">

# KRONA Studio

**Reservas inteligentes para salones, barberías y estudios estéticos.**

Plataforma SaaS *white-label* con vitrina pública, portal de clientes y paneles operativos para el equipo y la administración.

[**Ver demo en vivo →**](https://xgl24x-dev.github.io/krona-studio/)

![React](https://img.shields.io/badge/React-19-18181B?logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-8-18181B?logo=vite&logoColor=FFD62E)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-18181B?logo=tailwindcss&logoColor=38BDF8)
![WCAG 2.1 AA](https://img.shields.io/badge/WCAG_2.1-AA-9A5B2C)
![Deploy](https://img.shields.io/badge/GitHub_Pages-CI%2FCD-18181B?logo=github)

</div>

---

## Propuesta comercial

Los negocios de belleza pierden horas al día confirmando citas por teléfono y WhatsApp, y sus clientes abandonan la reserva cuando el proceso es lento. **KRONA Studio** convierte ese flujo en una experiencia de 30 segundos y le da al negocio un panel para operar su día:

- **White-label real:** desde *Mi Local* cada empresa cambia su nombre, logo, portada, contacto, horarios, NIT y política de cancelación. Los cambios se reflejan en vivo en toda la app (navbar, footer, comprobantes y pestaña del navegador).
- **Ciclo cerrado de atención:** reserva → aviso por WhatsApp a la especialista → *Iniciar cita* → *Finalizar* → invitación automática a calificar → el promedio de estrellas se actualiza en toda la tienda.
- **Tres roles con interfaces separadas:** la tienda pública para clientes y un *workspace* tipo SaaS (con sidebar propio) para empleadas y dueña.
- **Cero reservas anónimas:** el cupo queda protegido a nombre de una cuenta. Si un visitante intenta reservar, su selección se guarda y vuelve a la reserva precargada al iniciar sesión.

## Funcionalidades principales

| Rol | Qué puede hacer |
| --- | --- |
| **Cliente** | Reserva rápida desde la portada con popovers propios, catálogo con búsqueda y filtros, wizard de 4 pasos con agenda real por especialista y alternativas cuando no hay cupo, temporizador de 5 minutos que protege el cupo, comprobante con QR y archivo `.ics`, y *Member Hub* con citas activas, historial de servicios y compras, recibos, favoritos, calificaciones y perfil con foto. |
| **Empleada** | Agenda propia en tres pestañas (*Por atender*, *Completadas hoy* e *Historial*), KPIs personales, ciclo *Iniciar → Finalizar*, agradecimiento por WhatsApp y vista de sus reseñas con distribución de estrellas. |
| **Dueña** | Agenda global en *timeline* o lista con KPIs del día (citas, ocupación, ingresos en COP y asistencia), citas manuales, CRUD de catálogo (servicios y productos con foto), CRUD de equipo, categorías (máximo 6) y *Mi Local* (marca blanca). |

## Probar la demo

En `/#/login` y `/#/registro` hay botones de **acceso rápido en 1 clic** para explorar cada rol, sin escribir credenciales:

| Rol | Botón | Correo | Contraseña |
| --- | --- | --- | --- |
| Cliente | *Entrar como Cliente* | `laura@correo.com` | `demo1234` |
| Empleada | *Entrar como Empleada · Sofía* | `sofia@appsalon.co` | `sofia1234` |
| Dueña | *Entrar como Dueña* | `admin@appsalon.co` | `admin1234` |

- **Código de registro para empleadas:** `STUDIO2026` (en *Registro → Empleada*). La dueña puede regenerarlo en *Mi Local*.
- Las cuentas demo se **autorreparan**: si alguien las desactiva o cambia su contraseña desde el panel, el acceso rápido las restaura.
- Para volver al estado inicial: *Panel de Dueña → Mi Local → Restaurar datos de demostración*.

> **Nota:** es una demo sin servidor. Todos los datos viven en el `localStorage` del navegador de cada visitante, y las contraseñas se guardan con un hash simple de demostración, **no apto para producción**.

## Arquitectura

El proyecto separa la **presentación** de la **lógica de negocio**, de modo que se puede rediseñar toda la tienda sin tocar la administración:

```text
src/
├── services/
│   └── salonService.js      ← Puente único de datos
├── components/
│   ├── shared/ui.jsx        ← Primitivas comunes (modal, campos, BrandLogo, uploads)
│   ├── storefront/          ← Vitrina pública + portal del cliente
│   │   ├── Showroom.jsx         Home, catálogo y detalle
│   │   ├── QuickBook.jsx        Reserva rápida con popovers propios
│   │   ├── BookingWizard.jsx    Wizard de 4 pasos
│   │   ├── ClientDashboard.jsx  Member Hub
│   │   ├── AuthViews.jsx        Login y registro de los 3 roles
│   │   └── StoreLayout.jsx      Navbar, footer, ayuda y errores
│   └── workspace/           ← Paneles operativos (SaaS)
│       ├── WorkspaceShell.jsx   Sidebar y topbar
│       ├── EmployeePanel.jsx    Panel de empleada
│       ├── AdminPanel.jsx       Agenda global y KPIs
│       └── AdminManagers.jsx    Catálogo, equipo y Mi Local
├── App.jsx                  ← Router por hash y guardas por rol
└── index.css                ← Tokens de diseño y componentes
```

**`salonService.js`** es la única fuente de verdad:

- **Store externo** con `useSyncExternalStore`, persistencia en `localStorage` y sincronización en tiempo real entre pestañas (por ejemplo, el cliente en una pestaña y la dueña en otra).
- **Reglas de negocio y permisos por rol:** solo una sesión de Cliente puede crear reservas web, y solo la dueña puede crear citas manuales o editar el catálogo y el equipo.
- **Disponibilidad real** por especialista y horario de apertura, con protección contra choques de horario.
- **Compresión de imágenes con HTML5 Canvas** (`compressImage`): logos, fotos y avatares se redimensionan y comprimen antes de guardarse para no saturar el almacenamiento. Por ejemplo, una foto de 2400 px y 139 KB queda en unos 15 KB.
- **WhatsApp:** genera enlaces `wa.me` con los datos de cada cita (aviso a la especialista y agradecimiento al cliente).
- **Semilla versionada:** al subir la versión, los datos antiguos se descartan y se restaura la demo automáticamente.

## Diseño UX y accesibilidad

Estética *Quiet Luxury / Modern Editorial*: fondo `#FAF9F6`, tarjetas `#FFFFFF`, texto `#18181B`, acento terracota y tipografías **Plus Jakarta Sans** (títulos) e **Inter** (texto).

- **Ley de Fitts:** todos los botones primarios miden al menos **48 px** de alto, y las áreas táctiles de calendario, horarios y pestañas son amplias.
- **Ley de Hick:** el menú principal tiene como máximo **5 ítems** y el catálogo como máximo **6 categorías**, con filtros en píldoras en lugar de listas largas.
- **Ley de Tesler:** el sistema absorbe la complejidad. Preselecciona el día disponible más cercano, ofrece asignación automática de especialista, sugiere alternativas cuando no hay cupo y muestra campos opcionales con *progressive disclosure*.
- **Contraste WCAG 2.1 AA:** el terracota del diseño original (`#C27D48`, 3,2:1) se reserva para acentos y texto grande. Para texto y botones se usa **`#9A5B2C`, con 5,1:1** sobre el fondo crema (≥ 4,5:1).
- **Teclado y lectores de pantalla:** *skip link*, foco visible, modales con *focus trap* y `Escape`, `aria-live` en avisos y temporizadores, patrones `tablist`, `radiogroup` y `listbox` con flechas, y gestión de foco en cada cambio de vista.
- **Responsive de 320 px a 1920 px**, verificado sin scroll horizontal. Se respeta `prefers-reduced-motion`.
- Transiciones de `300ms ease-out` y *skeleton loaders* de `250ms` al filtrar o cambiar fechas.

## Ejecución local

Requisitos: **Node.js 22.12 o superior** (también funciona con 20.19+).

```bash
git clone https://github.com/xGL24x-Dev/krona-studio.git
cd krona-studio
npm install
npm run dev        # http://localhost:5173
```

Otros comandos:

```bash
npm run build      # compila a /dist
npm run preview    # sirve el build de producción en local
```

## Despliegue

Cada `push` a `main` ejecuta `.github/workflows/deploy.yml`, que instala con `npm ci`, compila con Vite y publica `dist/` en **GitHub Pages**. `vite.config.js` usa `base: './'` y la app usa un router por hash (`/#/ruta`), así que funciona en una subcarpeta de Pages sin rutas rotas ni configuración extra del servidor.

> En el repositorio, ve a **Settings → Pages → Build and deployment** y elige **Source: GitHub Actions**.

## Stack

React 19 · Vite 8 · Tailwind CSS 4 · lucide-react. Sin librerías de UI, routing ni estado: los componentes, el router y el store están hechos a medida para mantener la app ligera.

---

<div align="center">

Desarrollado por **[xGL24x-Dev](https://github.com/xGL24x-Dev)**

</div>
