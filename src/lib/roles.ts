// ──────────────────────────────────────────────────────────────────────────────
// CATÁLOGO DE ROLES DE NES
//
// Fuente única de verdad para: el selector de rol del equipo, el cuestionario
// "encuentra tu rol", la guía de roles y el resolutor de nombres que usa MERGE.
//
// Cada rol lleva su explicación. No basta con poner "Diseñador UX / UI" en un
// chip: si no sabes qué hace esa persona, no sabes si te falta en el equipo.
// ──────────────────────────────────────────────────────────────────────────────

export type RoleDef = { name: string; desc: string }
export type RoleCategory = {
  label: string
  emoji: string
  color: string
  blurb: string          // para qué sirve la categoría entera
  roles: RoleDef[]
}

export const ROLE_CATEGORIES: RoleCategory[] = [
  {
    label: "Negocio", emoji: "🏢", color: "#c2542f",
    blurb: "Quien decide hacia dónde va el proyecto, cómo gana dinero y quién hace qué. Sin este bloque hay producto, pero no empresa.",
    roles: [
      { name: "CEO / Fundador", desc: "Marca el rumbo y responde de las decisiones difíciles. Levanta dinero, contrata y protege la visión cuando todo tira en otra dirección." },
      { name: "Director General", desc: "Ejecuta la visión del día a día. El CEO decide el qué; esta persona se asegura de que ocurra." },
      { name: "COO / Operaciones", desc: "Convierte el caos en procesos repetibles: proveedores, entregas, soporte, herramientas. Que la máquina no se pare." },
      { name: "Responsable de Producto", desc: "Decide qué se construye y en qué orden. Traduce lo que necesita el cliente en tareas concretas para el equipo técnico." },
      { name: "Estratega de Negocio", desc: "Estudia mercado, competencia y números para elegir la jugada: a qué segmento atacar y con qué modelo cobrar." },
      { name: "Inversor / Business Angel", desc: "Pone dinero propio en fases tempranas y, con él, su agenda de contactos y su experiencia. No trabaja en el día a día." },
      { name: "Asesor Empresarial", desc: "Acompaña puntualmente con criterio externo. No ejecuta: te evita errores que ya cometió otro." },
      { name: "Director Comercial", desc: "Diseña la estrategia de venta y dirige al equipo que la ejecuta. Responde del objetivo de facturación." },
      { name: "Responsable de Ventas", desc: "Cierra clientes. Gestiona el embudo desde el primer contacto hasta la firma." },
      { name: "Ejecutivo de Cuentas", desc: "Cuida a los clientes que ya están dentro: que renueven, que crezcan y que no se vayan." },
      { name: "Director de Expansión", desc: "Abre mercados nuevos: otras ciudades, otros países, otros canales. Replica lo que ya funciona." },
      { name: "Jefe de Proyecto", desc: "Plazos, presupuesto y coordinación. La persona que sabe en todo momento por dónde va cada cosa." },
      { name: "Responsable de Alianzas", desc: "Construye acuerdos con otras empresas: integraciones, distribución, acuerdos comerciales. Crecer sin gastar en publicidad." },
      { name: "CFO / Finanzas", desc: "Controla la caja, los márgenes y cuántos meses de vida le quedan al proyecto. El freno de mano cuando hace falta." },
    ],
  },
  {
    label: "Tecnología", emoji: "💻", color: "#3b82f6",
    blurb: "Quien construye y sostiene el producto. Aquí es donde una idea deja de ser una presentación y pasa a existir.",
    roles: [
      { name: "Desarrollador Full Stack", desc: "Programa tanto lo que se ve como lo que hay detrás. El perfil más rentable al principio: hace un producto entero solo." },
      { name: "Desarrollador Frontend", desc: "Construye lo que el usuario toca: pantallas, botones, velocidad y que se vea bien en el móvil." },
      { name: "Desarrollador Backend", desc: "El motor invisible: base de datos, lógica de negocio y las APIs que alimentan la aplicación." },
      { name: "Desarrollador Móvil", desc: "Apps nativas de iOS y Android, con sus reglas propias de publicación en las tiendas." },
      { name: "Arquitecto de Software", desc: "Decide cómo se organiza el sistema para que aguante crecer sin reescribirlo entero dentro de un año." },
      { name: "DevOps / Infraestructura", desc: "Servidores, despliegues y monitorización. Que puedas publicar cambios varias veces al día sin romper nada." },
      { name: "Ingeniero de Datos", desc: "Monta las tuberías que recogen y ordenan los datos para que otros puedan analizarlos." },
      { name: "Científico de Datos", desc: "Encuentra patrones en esos datos y los convierte en decisiones o en modelos predictivos." },
      { name: "Experto en IA / ML", desc: "Integra modelos de inteligencia artificial en el producto: automatizaciones, asistentes, recomendaciones." },
      { name: "Seguridad Informática", desc: "Busca los agujeros antes que los malos. Protege los datos de tus usuarios y tu reputación." },
      { name: "QA / Control de Calidad", desc: "Rompe el producto a propósito antes de que lo haga un cliente. Prueba, documenta y bloquea lo que no está listo." },
      { name: "CTO / Director Técnico", desc: "Máximo responsable de tecnología: elige el stack, dirige al equipo técnico y traduce negocio a arquitectura." },
      { name: "Administrador de Sistemas", desc: "Mantiene en pie las máquinas, las redes y los accesos internos del equipo." },
      { name: "Experto en Blockchain", desc: "Contratos inteligentes, tokens y aplicaciones descentralizadas. Un nicho muy concreto." },
      { name: "Ingeniero de Software", desc: "Perfil generalista con base sólida de ingeniería: diseña, programa y prueba sistemas completos." },
    ],
  },
  {
    label: "Diseño", emoji: "🎨", color: "#ec4899",
    blurb: "Quien decide cómo se ve y cómo se siente. No es la capa de pintura del final: es la diferencia entre que alguien entienda tu producto en cinco segundos o se vaya.",
    roles: [
      { name: "Diseñador UX / UI", desc: "Dos cosas en una: la experiencia (que el usuario llegue a su objetivo sin perderse) y la interfaz (que además sea bonita y coherente)." },
      { name: "Diseñador Gráfico", desc: "Piezas visuales: carteles, presentaciones, materiales de marca y contenido para redes." },
      { name: "Diseñador de Producto", desc: "Trabaja con negocio y tecnología para decidir cómo debe funcionar una función, no solo cómo se ve." },
      { name: "Diseñador de Marca", desc: "Logo, colores, tipografías y tono. Que se te reconozca sin leer el nombre." },
      { name: "Motion Designer", desc: "Animación y vídeo: transiciones de la app, anuncios y explicativos que se entienden en quince segundos." },
      { name: "Ilustrador / Artista", desc: "Imagen propia hecha a mano. Lo que te hace no parecerte a ninguna otra plantilla." },
      { name: "Director Creativo", desc: "Dirige el criterio visual del conjunto y dice que no. Coherencia entre producto, marca y campañas." },
      { name: "Diseñador Web", desc: "Diseña —y a menudo monta— la web pública: landing, blog y páginas de conversión." },
      { name: "Fotógrafo / Videógrafo", desc: "Produce el material real: producto, equipo y testimonios. Lo que hace que una marca parezca de verdad." },
      { name: "Diseñador de Experiencias", desc: "Mira el recorrido completo del cliente, dentro y fuera de la pantalla: del anuncio al soporte posventa." },
    ],
  },
  {
    label: "Marketing y Ventas", emoji: "📢", color: "#9a9d78",
    blurb: "Quien consigue que existas para el mundo. Un producto excelente que nadie encuentra no es un negocio.",
    roles: [
      { name: "Director de Marketing", desc: "Estrategia y presupuesto de captación. Decide en qué canales se juega y mide qué devuelve cada euro." },
      { name: "Especialista en Growth", desc: "Experimenta sin parar sobre el embudo completo para crecer más rápido y más barato." },
      { name: "Community Manager", desc: "Da la cara en redes y sostiene la comunidad: responde, modera y detecta lo que la gente pide." },
      { name: "Responsable de RRSS", desc: "Planifica y publica el contenido social. Calendario, formatos y métricas por plataforma." },
      { name: "SEO / SEM", desc: "Que te encuentren en Google: por posicionamiento orgánico (SEO) y por anuncios de búsqueda (SEM)." },
      { name: "Creador de Contenido", desc: "Produce el material que atrae: vídeos, artículos, newsletters. Atención sin pagar por cada clic." },
      { name: "Director de Marca", desc: "Cuida qué significa tu nombre en la cabeza de la gente y que el mensaje sea el mismo en todas partes." },
      { name: "Copywriter / Redactor", desc: "Escribe para que la gente actúe: titulares, páginas de venta, emails y los textos de la propia app." },
      { name: "Email Marketing", desc: "Convierte suscriptores en clientes con secuencias automáticas. El canal más barato y más ignorado." },
      { name: "Responsable de PR", desc: "Consigue que hablen de ti gratis: prensa, podcasts, premios y eventos." },
      { name: "Influencer / Creator", desc: "Aporta audiencia propia y credibilidad prestada desde el primer día." },
      { name: "Publicidad Digital", desc: "Gestiona campañas de pago y vigila el coste de captación frente a lo que deja cada cliente." },
      { name: "Representante de Ventas", desc: "Prospección pura: busca clientes potenciales, contacta y agenda reuniones." },
    ],
  },
  {
    label: "Legal y Finanzas", emoji: "⚖️", color: "#f59e0b",
    blurb: "Quien evita que un error administrativo se lleve por delante años de trabajo. Aburrido hasta el día que lo necesitas.",
    roles: [
      { name: "Abogado / Asesor Legal", desc: "Contratos, pacto de socios, condiciones de uso y propiedad intelectual. Quién es dueño de qué, por escrito." },
      { name: "Gestor Financiero", desc: "Previsión de tesorería y control de gastos. Saber cuánto dinero queda y hasta cuándo." },
      { name: "Contable / Asesor Fiscal", desc: "Facturas, impuestos y cierres. Que Hacienda nunca sea una sorpresa." },
      { name: "Responsable de RRHH", desc: "Contratación, contratos, nóminas y cultura interna. Cómo se entra, cómo se crece y cómo se sale." },
      { name: "Asesor de Cumplimiento", desc: "Normativa aplicable: protección de datos, sector regulado, auditorías." },
      { name: "Analista Financiero", desc: "Modelos, escenarios y métricas. Los números que se enseñan a un inversor." },
      { name: "Director Financiero", desc: "Máximo responsable económico: estrategia de financiación, márgenes y relación con inversores y bancos." },
    ],
  },
  {
    label: "Otros", emoji: "✨", color: "#c7c2b3",
    blurb: "Perfiles de apoyo y situaciones que no encajan en una casilla fija. Valen igual: en una fase temprana casi nadie tiene un solo rol.",
    roles: [
      { name: "Mentor / Coach", desc: "Acompaña a las personas, no al producto. Te ayuda a decidir mejor y a no quemarte por el camino." },
      { name: "Consultor Independiente", desc: "Experto contratado para un problema concreto y un plazo concreto." },
      { name: "Investigador / Académico", desc: "Aporta conocimiento profundo y rigor. Clave si tu producto nace de una tecnología o una tesis." },
      { name: "Estudiante / En formación", desc: "Aprende mientras aporta. Menos experiencia, mucho tiempo y ganas: cómo empieza casi todo el mundo." },
      { name: "Freelancer", desc: "Colabora por proyectos sin formar parte del equipo fijo. Flexible y sin coste estructural." },
      { name: "Sin rol definido", desc: "Todavía no está claro dónde encaja. Perfectamente normal al principio: usa el cuestionario para descubrirlo." },
    ],
  },
]

export const ALL_ROLES_FLAT = ROLE_CATEGORIES.flatMap(c =>
  c.roles.map(r => ({ name: r.name, desc: r.desc, color: c.color, category: c.label }))
)

/** Los tres atajos del selector rápido: no son cargos, son áreas. */
export const MAIN_QUICK_ROLES = [
  { name: "Negocio",     color: "#c2542f", emoji: "🏢", desc: "Estrategia, producto y operaciones" },
  { name: "Tecnología",  color: "#3b82f6", emoji: "💻", desc: "Desarrollo, datos e infraestructura" },
  { name: "Creatividad", color: "#ec4899", emoji: "🎨", desc: "Diseño, marketing y contenido"       },
]

// ── Cuestionario de descubrimiento de rol ──
export const QUIZ_AREAS = [
  { value: "negocio",     label: "Dirijo, decido y gestiono el negocio", emoji: "🏢" },
  { value: "tecnologia",  label: "Construyo, programo y resuelvo técnico", emoji: "💻" },
  { value: "diseno",      label: "Diseño y creo visualmente", emoji: "🎨" },
  { value: "marketing",   label: "Vendo, conecto y comunico", emoji: "📢" },
  { value: "legal",       label: "Gestiono lo legal y financiero", emoji: "⚖️" },
]
export const QUIZ_LEVELS = [
  { value: "junior", label: "Estoy empezando / Aprendiendo", emoji: "🌱" },
  { value: "mid",    label: "Tengo experiencia media",       emoji: "🚀" },
  { value: "senior", label: "Soy senior / Experto",          emoji: "⭐" },
]
export const ROLE_SUGGESTIONS: Record<string, string[]> = {
  "negocio-junior":    ["Jefe de Proyecto","Responsable de Ventas","Ejecutivo de Cuentas"],
  "negocio-mid":       ["Responsable de Producto","Director Comercial","Estratega de Negocio"],
  "negocio-senior":    ["CEO / Fundador","Director General","COO / Operaciones"],
  "tecnologia-junior": ["Desarrollador Frontend","Desarrollador Backend","QA / Control de Calidad"],
  "tecnologia-mid":    ["Desarrollador Full Stack","Desarrollador Móvil","Ingeniero de Datos"],
  "tecnologia-senior": ["CTO / Director Técnico","Arquitecto de Software","Experto en IA / ML"],
  "diseno-junior":     ["Diseñador Gráfico","Diseñador Web","Ilustrador / Artista"],
  "diseno-mid":        ["Diseñador UX / UI","Diseñador de Producto","Diseñador de Marca"],
  "diseno-senior":     ["Director Creativo","Diseñador de Experiencias","Motion Designer"],
  "marketing-junior":  ["Community Manager","Creador de Contenido","Copywriter / Redactor"],
  "marketing-mid":     ["Especialista en Growth","SEO / SEM","Responsable de RRSS"],
  "marketing-senior":  ["Director de Marketing","Director de Marca","Responsable de PR"],
  "legal-junior":      ["Contable / Asesor Fiscal","Analista Financiero","Responsable de RRHH"],
  "legal-mid":         ["Gestor Financiero","Abogado / Asesor Legal","Asesor de Cumplimiento"],
  "legal-senior":      ["Director Financiero","CFO / Finanzas","Asesor Empresarial"],
}

/** Los roles sin los que un equipo de producto se atasca (aviso en Gestión). */
export const CRITICAL_ROLES = ["CTO / Director Técnico", "Diseñador UX / UI", "Responsable de Producto"]

/** Compara ignorando mayúsculas, acentos y separadores. */
export function normalizeText(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim()
}

/**
 * Resuelve un rol dicho en lenguaje natural ("cto", "diseñadora ux") al nombre
 * exacto del catálogo. Devuelve null si no hay nada razonablemente parecido.
 */
export function resolveRole(input: string): string | null {
  const q = normalizeText(input)
  if (!q) return null
  const pool = [...ALL_ROLES_FLAT.map(r => r.name), ...MAIN_QUICK_ROLES.map(r => r.name)]
  const exact = pool.find(n => normalizeText(n) === q)
  if (exact) return exact
  const contains = pool.find(n => normalizeText(n).includes(q) || q.includes(normalizeText(n)))
  if (contains) return contains
  // Última pasada: alguna palabra significativa en común ("director tecnico").
  const words = q.split(" ").filter(w => w.length > 2)
  if (!words.length) return null
  const scored = pool
    .map(n => ({ n, hits: words.filter(w => normalizeText(n).includes(w)).length }))
    .filter(x => x.hits > 0)
    .sort((a, b) => b.hits - a.hits)
  return scored[0]?.n ?? null
}
