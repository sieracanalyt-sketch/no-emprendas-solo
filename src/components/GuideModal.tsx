import { useEffect, useState } from "react"

// ──────────────────────────────────────────────────────────────────────────────
// Guías in-app de Workflow y Calendario: qué hace cada cosa Y —sobre todo—
// para qué sirve en el día a día de un equipo fundador. Se abren con el botón
// "📖 Guía" de la cabecera de cada página.
// ──────────────────────────────────────────────────────────────────────────────

type Section = {
  icon: string
  title: string
  intro?: string
  items?: { name: string; desc: string }[]
  accent?: string
}

type Guide = {
  title: string
  subtitle: string
  sections: Section[]
}

const GUIDES: Record<"workflow" | "calendario", Guide> = {
  workflow: {
    title: "Guía de Workflow",
    subtitle: "El centro de operaciones de tu equipo: qué hacéis, quién lo hace y qué toca primero.",
    sections: [
      {
        icon: "📋",
        title: "Tareas — el tablero Kanban",
        accent: "#5e6ad2",
        intro:
          "Cuatro columnas (Backlog → En Progreso → En Revisión → Completado) que se sincronizan en tiempo real con todo el equipo. Nada de \"¿en qué estabas tú?\": se ve de un vistazo.",
        items: [
          { name: "Crear tarea", desc: "Pulsa el + de cualquier columna. Ponle prioridad, responsable y fecha límite. Las tareas que vencen pronto se encienden en naranja; las vencidas, en rojo." },
          { name: "Arrastrar entre columnas", desc: "Mover una tarjeta ES actualizar el estado del proyecto. Cuando termines algo, arrástralo a Revisión para que otro lo valide antes de darlo por hecho." },
          { name: "Bloqueos", desc: "¿Una tarea no avanza porque depende de algo? Márcala como bloqueada (menú ⋯). El equipo ve el cuello de botella sin que tengas que explicarlo." },
          { name: "Mi carga / filtros por persona", desc: "Filtra el tablero por cualquier miembro para ver su plato. Perfecto antes de repartir trabajo nuevo." },
          { name: "Buscar (⌘K) y Exportar", desc: "⌘K busca cualquier tarea al instante. Exportar copia un resumen del proyecto en texto listo para pegar en un chat o email." },
        ],
      },
      {
        icon: "🎯",
        title: "Prioridades — matriz de Eisenhower + Mi Día",
        accent: "#f2994a",
        intro:
          "La matriz separa lo urgente de lo importante en 4 cuadrantes. Arrastra una tarea a un cuadrante y NES ajusta su prioridad y su columna en el Kanban automáticamente: son espejos.",
        items: [
          { name: "Hacer ahora (urgente + importante)", desc: "Crisis y fechas límite. Si vives siempre aquí, algo falla en tu planificación." },
          { name: "Planificar (importante, no urgente)", desc: "El cuadrante donde se construyen las empresas: estrategia, producto, relaciones. Resérvale tiempo en el Calendario antes de que se vuelva urgente." },
          { name: "Delegar (urgente, no importante)", desc: "Interrupciones con prisa que no requieren TU talento. En un equipo NES, delegar es reasignar la tarea a quien tenga el rol adecuado." },
          { name: "Eliminar (ni una ni otra)", desc: "La papelera estratégica. Decir que no a estas tareas es la decisión de productividad más rentable que existe." },
          { name: "☀ Mi Día", desc: "Tu plan personal de HOY. Añade 3–5 tareas máximo. Cada mañana se autolimpia: lo no terminado se marca como \"arrastrado\" y los restos vuelven al backlog. Cero culpa, cero residuos." },
        ],
      },
      {
        icon: "🌐",
        title: "Gestión — el mapa vivo del equipo",
        accent: "#22c55e",
        intro:
          "Tu equipo como un organismo: cada persona es un nodo conectado al proyecto. Arrastra a las personas para organizarlas (por áreas, por proyectos, como quieras) — la disposición se guarda y la ve todo el equipo.",
        items: [
          { name: "Roles", desc: "Asigna a cada miembro uno de los +50 roles (o crea el tuyo). El color del nodo refleja su área: negocio, tecnología, diseño…" },
          { name: "🌡 Heatmap", desc: "Cambia los colores para mostrar la CARGA de trabajo: verde = sano, rojo = sobrecargado. Detecta el burnout antes de que ocurra." },
          { name: "📊 Métricas", desc: "Velocidad de cierre, ratio de bloqueos y equilibrio de roles del equipo, en vivo." },
          { name: "🏁 Hitos", desc: "Marca los grandes objetivos (MVP, primera venta, ronda) alrededor del mapa. Clic en un hito para eliminarlo." },
          { name: "⚡ Simular baja (clic derecho)", desc: "¿Qué pasa si mañana se va tu CTO? La simulación muestra qué tareas quedarían huérfanas. Tu plan de contingencia en un clic." },
          { name: "Selección múltiple (lasso)", desc: "Dibuja un rectángulo sobre el lienzo vacío para seleccionar a varios y asignarles rol en bloque." },
          { name: "▶ Pitch", desc: "Modo presentación a pantalla completa: enseña tu equipo a un inversor o a un candidato con un mapa que impresiona más que un organigrama." },
        ],
      },
      {
        icon: "💡",
        title: "Para qué te sirve de verdad (más allá de los botones)",
        accent: "#a78bfa",
        items: [
          { name: "La reunión semanal de 15 minutos", desc: "Lunes por la mañana, tablero en pantalla: qué se terminó, qué está bloqueado, qué entra esta semana. Con el tablero delante, la reunión no se va por las ramas." },
          { name: "Decidir qué NO hacer", desc: "El 80 % de los equipos primerizos mueren por hacer demasiadas cosas. La matriz de Eisenhower te obliga a mirar cada tarea y preguntarte: ¿esto construye la empresa o solo me mantiene ocupado?" },
          { name: "Onboarding de un nuevo socio", desc: "Añádelo al mapa de Gestión con su rol y enséñale el Kanban: en 10 minutos entiende quién hace qué y qué está en marcha. Sin documentos de 20 páginas." },
          { name: "Detectar sobrecarga antes del conflicto", desc: "El heatmap no miente: si una persona lleva 8 tareas y el resto 2, tenéis una conversación pendiente. Mejor tenerla mirando datos que reproches." },
          { name: "Material para inversores", desc: "El modo Pitch + las métricas cuentan la historia de un equipo organizado. La ejecución es lo primero que mira un inversor en fase temprana." },
          { name: "Stand-ups asíncronos", desc: "¿No podéis reuniros? \"Exportar\" copia el estado del proyecto y lo pegas en el grupo de Mensajes. Todos alineados sin robar una hora a nadie." },
        ],
      },
    ],
  },
  calendario: {
    title: "Guía del Calendario",
    subtitle: "La agenda semanal del equipo: tiempo protegido para lo importante y reuniones solo cuando tocan.",
    sections: [
      {
        icon: "🗓",
        title: "Lo básico",
        accent: "#5e6ad2",
        items: [
          { name: "Crear un evento", desc: "Haz clic (o arrastra) sobre cualquier hueco de la semana. Elige tipo: evento, reunión, bloque de enfoque o tarea. Cada tipo tiene su color." },
          { name: "Reprogramar arrastrando", desc: "Agarra cualquier evento y muévelo a otra hora o día. Si viene de Google Calendar, el cambio se sincroniza allí también." },
          { name: "Reuniones con asistentes", desc: "Las reuniones pueden incluir a otros miembros y piden preparación (el \"Peaje de Preparación\"): agenda y objetivo antes de robar el tiempo de nadie." },
          { name: "Widget de próxima reunión", desc: "En Mensajes siempre ves tu próxima reunión — nunca más un \"¡uy, se me pasó!\"." },
        ],
      },
      {
        icon: "🔗",
        title: "Google Calendar",
        accent: "#16a34a",
        items: [
          { name: "Conectar (1 clic)", desc: "Pulsa \"Conectar Google Calendar\", elige tu cuenta de Google y listo: tus eventos de Google aparecen en NES (en verde) y los que crees en NES se suben a Google." },
          { name: "Sincronización", desc: "Al volver a la página se reconecta solo. Si cambias o borras aquí un evento de Google, el cambio viaja a tu Google Calendar." },
          { name: "Privacidad", desc: "El acceso vive solo en tu navegador; NES no guarda tu calendario de Google en sus servidores. Puedes desconectar cuando quieras." },
        ],
      },
      {
        icon: "🛡",
        title: "Herramientas de protección del tiempo",
        accent: "#f2994a",
        items: [
          { name: "Bloques de enfoque", desc: "Tiempo sagrado para trabajo profundo. Actúan como barrera: el sistema desincentiva convocarte reuniones encima." },
          { name: "Zonas de enfoque óptimo", desc: "El calendario sugiere las franjas donde históricamente rindes mejor, para que pongas ahí lo difícil." },
          { name: "🚨 Modo Urgencia", desc: "El botón rojo: las reuniones nuevas saltan la preparación y pueden convocarte fuera de horario. Para emergencias REALES (bug en producción, decisión que no puede esperar). Su coste social es alto a propósito." },
          { name: "❄️ Congelar agenda", desc: "Vacaciones, exámenes, un sprint personal: congela tu agenda y el equipo lo sabe. Nadie te convoca mientras estás congelado." },
          { name: "Fusión de calendarios", desc: "Cruza los calendarios del equipo y encuentra los huecos COMUNES en segundos. Se acabó el ping-pong de \"¿te va bien el jueves?\"." },
        ],
      },
      {
        icon: "💡",
        title: "Para qué te sirve de verdad (más allá de los botones)",
        accent: "#a78bfa",
        items: [
          { name: "El ritual del domingo (10 min)", desc: "Abre Prioridades en Workflow, elige lo importante de la semana y resérvale bloques de enfoque en el Calendario. Lo que no tiene hueco en la agenda, no existe." },
          { name: "Timeboxing: de la lista a la agenda", desc: "Una tarea sin hora es un deseo. Convierte las tareas grandes del Kanban en bloques concretos: \"MVP pantalla de pago — martes 9:00-11:30\". La fricción de empezar desaparece." },
          { name: "Proteger el maker time", desc: "Un fundador técnico necesita mañanas ENTERAS sin interrupciones. Los bloques de enfoque + el peaje de preparación hacen que reunirse contigo cueste lo que debe costar." },
          { name: "Coordinar sin ser oficina", desc: "Equipos en remoto y a horas raras: la fusión de calendarios encuentra el hueco común real, y las reuniones con agenda obligatoria hacen que los 30 minutos juntos valgan." },
          { name: "Auditoría de tu semana", desc: "El Espejo de Prioridades compara horas presupuestadas vs. reales por tipo. Si \"reuniones\" se come 15 h y \"producto\" 3 h, ya sabes por qué no avanzas." },
          { name: "Urgencias con freno de mano", desc: "El Modo Urgencia existe para que las emergencias no sean la norma: al ser explícito y visible, usarlo tres veces por semana se nota. Es un termómetro de la salud del equipo." },
        ],
      },
    ],
  },
}

export default function GuideButton({ page }: { page: "workflow" | "calendario" }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium transition"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-dim)" }}
        onMouseEnter={e => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)" }}
        onMouseLeave={e => { e.currentTarget.style.color = "var(--text-dim)"; e.currentTarget.style.borderColor = "var(--border)" }}
        title="Cómo sacarle partido a esta página"
      >
        📖 Guía
      </button>
      {open && <GuideModal page={page} onClose={() => setOpen(false)} />}
    </>
  )
}

export function GuideModal({ page, onClose }: { page: "workflow" | "calendario"; onClose: () => void }) {
  const guide = GUIDES[page]

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    document.addEventListener("keydown", h)
    return () => document.removeEventListener("keydown", h)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)" }}
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-2xl flex flex-col rounded-2xl overflow-hidden"
        style={{
          background: "linear-gradient(180deg, rgba(30,32,38,0.96), rgba(17,19,23,0.96))",
          border: "1px solid var(--glass-border)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.08)",
          maxHeight: "88vh",
          animation: "modal-pop 0.28s cubic-bezier(0.34,1.2,0.64,1) both",
        }}
        onMouseDown={e => e.stopPropagation()}
      >
        <style>{`@keyframes modal-pop{0%{opacity:0;transform:scale(0.94) translateY(10px)}100%{opacity:1;transform:scale(1) translateY(0)}}`}</style>

        {/* Cabecera */}
        <div className="shrink-0 px-6 pt-5 pb-4 flex items-start justify-between gap-3"
          style={{ borderBottom: "1px solid var(--border)" }}>
          <div>
            <h2 className="text-[18px] font-semibold text-white tracking-tight">{guide.title}</h2>
            <p className="text-[12.5px] mt-1 leading-relaxed" style={{ color: "var(--text-dim)" }}>{guide.subtitle}</p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-[14px] transition"
            style={{ color: "var(--text-dim)", background: "rgba(255,255,255,0.04)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--text-dim)")}
            aria-label="Cerrar guía"
          >
            ✕
          </button>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-6">
          {guide.sections.map(s => (
            <section key={s.title}>
              <div className="flex items-center gap-2.5 mb-2">
                <span
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-[15px] shrink-0"
                  style={{ background: `${s.accent ?? "#5e6ad2"}1c`, border: `1px solid ${s.accent ?? "#5e6ad2"}3a` }}
                >
                  {s.icon}
                </span>
                <h3 className="text-[14.5px] font-semibold text-white">{s.title}</h3>
              </div>
              {s.intro && (
                <p className="text-[12.5px] leading-relaxed mb-2.5" style={{ color: "var(--text-dim)" }}>
                  {s.intro}
                </p>
              )}
              {s.items && (
                <div className="flex flex-col gap-1.5">
                  {s.items.map(it => (
                    <div
                      key={it.name}
                      className="px-3.5 py-2.5 rounded-xl"
                      style={{ background: "rgba(255,255,255,0.028)", border: "1px solid var(--border)" }}
                    >
                      <p className="text-[12.5px] font-semibold" style={{ color: s.accent ?? "#aab2f0" }}>
                        {it.name}
                      </p>
                      <p className="text-[12px] mt-0.5 leading-relaxed" style={{ color: "var(--text-dim)" }}>
                        {it.desc}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}
          <p className="text-[11px] text-center pb-1" style={{ color: "var(--text-dimmer)" }}>
            Consejo: vuelve a esta guía cuando el equipo crezca — las herramientas escalan contigo.
          </p>
        </div>
      </div>
    </div>
  )
}
