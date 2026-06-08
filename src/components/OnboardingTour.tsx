import {
  useCallback,
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react"
import { useNavigate } from "react-router-dom"
import { useUser } from "../hooks/useUser"

// ──────────────────────────────────────────────────────────────────────────────
// Tour de bienvenida interactivo.
// Resalta (spotlight) cada pestaña real de la Navbar y la explica paso a paso.
// Se auto-lanza la primera vez por usuario; se puede repetir con el botón "?".
// ──────────────────────────────────────────────────────────────────────────────

type Step = {
  key: string
  target?: string // selector data-tour; si falta → tarjeta centrada
  icon: ReactNode
  title: string
  desc: string
  badge?: string
}

const svg = (children: ReactNode) => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.7}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </svg>
)

const STEPS: Step[] = [
  {
    key: "welcome",
    icon: svg(
      <>
        <path d="M12 5l1.8 4.7L18 11l-4.2 1.3L12 17l-1.8-4.7L6 11l4.2-1.3z" />
        <path d="M5 4v2.5M6.25 5.25h-2.5" />
        <path d="M19 15v2M20 16h-2" />
      </>
    ),
    title: "¡Te damos la bienvenida! 👋",
    desc: "Te enseñamos en 30 segundos las funciones clave para que encuentres equipo y hagas crecer tu proyecto. Puedes salir cuando quieras.",
  },
  {
    key: "explorar",
    target: '[data-tour="explorar"]',
    icon: svg(
      <>
        <circle cx="12" cy="12" r="9" />
        <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88" />
      </>
    ),
    title: "Explora y conecta",
    desc: "Descubre a otros emprendedores ordenados por afinidad con NES Connect. Conecta con quien encaje contigo o pasa al siguiente.",
  },
  {
    key: "mensajes",
    target: '[data-tour="mensajes"]',
    icon: svg(<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />),
    title: "Habla con tu gente",
    desc: "Tus chats privados y grupos en un mismo lugar. Comparte archivos y audios, y arranca llamadas de voz o vídeo sin salir de la app.",
  },
  {
    key: "workflow",
    target: '[data-tour="workflow"]',
    icon: svg(
      <>
        <rect x="3" y="4" width="5" height="16" rx="1" />
        <rect x="9.5" y="4" width="5" height="11" rx="1" />
        <rect x="16" y="4" width="5" height="13" rx="1" />
      </>
    ),
    title: "Organizad el trabajo",
    desc: "Un tablero Kanban colaborativo y en tiempo real. Crea tareas, asígnalas por roles y arrástralas hasta ‘Hecho’ junto a tu equipo.",
  },
  {
    key: "foros",
    target: '[data-tour="foros"]',
    icon: svg(
      <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z" />
    ),
    title: "Foros de la comunidad",
    desc: "El espacio para resolver dudas y compartir aprendizajes con el resto de emprendedores. Le estamos dando los últimos retoques.",
    badge: "Muy pronto",
  },
  {
    key: "calendario",
    target: '[data-tour="calendario"]',
    icon: svg(
      <>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </>
    ),
    title: "Coordina y prioriza",
    desc: "Agenda reuniones, propón huecos libres y enfócate de verdad con la matriz de prioridades y tu vista ‘Mi Día’.",
  },
  {
    key: "perfil",
    target: '[data-tour="perfil"]',
    icon: svg(
      <>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </>
    ),
    title: "Tu carta de presentación",
    desc: "Cuenta quién eres, tu proyecto y qué buscas. Cuanto más completo esté tu perfil, mejores conexiones te sugerimos.",
  },
  {
    key: "done",
    icon: svg(
      <>
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <path d="m9 11 3 3L22 4" />
      </>
    ),
    title: "¡Listo para empezar! 🚀",
    desc: "Eso es todo lo esencial. Nuestro consejo: completa tu perfil y lánzate a Explorar. ¿Quieres repetir el tour? Pulsa el botón ‘?’ de la barra superior.",
  },
]

const STORAGE_PREFIX = "nes_tour_done_v1_"

export default function OnboardingTour() {
  const [user] = useUser()
  const navigate = useNavigate()
  const [active, setActive] = useState(false)
  const [i, setI] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)

  const storageKey = user ? STORAGE_PREFIX + user.id : null

  // Auto-arranque para usuarios que aún no han visto el tour
  useEffect(() => {
    if (!storageKey) return
    let done = false
    try {
      done = localStorage.getItem(storageKey) === "1"
    } catch {
      /* localStorage no disponible */
    }
    if (!done) {
      const t = setTimeout(() => {
        setI(0)
        setActive(true)
      }, 650)
      return () => clearTimeout(t)
    }
  }, [storageKey])

  // Relanzar manualmente desde el botón "?" de la Navbar
  useEffect(() => {
    const onStart = () => {
      setI(0)
      setActive(true)
    }
    window.addEventListener("nes:tour", onStart)
    return () => window.removeEventListener("nes:tour", onStart)
  }, [])

  const measure = useCallback(() => {
    const sel = STEPS[i]?.target
    if (!sel) {
      setRect(null)
      return
    }
    const el = document.querySelector(sel) as HTMLElement | null
    setRect(el ? el.getBoundingClientRect() : null)
  }, [i])

  // Recalcular la posición del foco al cambiar de paso, redimensionar o hacer scroll
  useEffect(() => {
    if (!active) return
    const raf = requestAnimationFrame(measure)
    window.addEventListener("resize", measure)
    window.addEventListener("scroll", measure, true)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("resize", measure)
      window.removeEventListener("scroll", measure, true)
    }
  }, [active, measure])

  const finish = useCallback(() => {
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, "1")
      } catch {
        /* ignore */
      }
    }
    setActive(false)
  }, [storageKey])

  const next = useCallback(
    () => setI((p) => (p < STEPS.length - 1 ? p + 1 : p)),
    []
  )
  const back = useCallback(() => setI((p) => Math.max(0, p - 1)), [])

  // Navegación por teclado
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish()
      else if (e.key === "ArrowRight") next()
      else if (e.key === "ArrowLeft") back()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [active, finish, next, back])

  if (!active) return null
  const step = STEPS[i]
  if (!step) return null

  const isFirst = i === 0
  const isLast = i === STEPS.length - 1
  const useSpotlight = !!step.target && !!rect
  const isCentered = !useSpotlight

  // Posición de la tarjeta cuando hay un elemento resaltado
  const CARD_W = 340
  let cardStyle: CSSProperties = {}
  let caretLeft = CARD_W / 2
  if (useSpotlight && rect) {
    const vw = window.innerWidth
    const centerX = rect.left + rect.width / 2
    let left = centerX - CARD_W / 2
    left = Math.max(12, Math.min(left, vw - CARD_W - 12))
    cardStyle = { top: rect.bottom + 22, left }
    caretLeft = Math.max(18, Math.min(centerX - left, CARD_W - 24))
  }

  const body = (
    <>
      <button className="tour-close" onClick={finish} aria-label="Cerrar tutorial">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
        >
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>

      <div className="tour-icon">{step.icon}</div>

      {step.badge && (
        <div style={{ marginTop: 12 }}>
          <span className="tour-badge">{step.badge}</span>
        </div>
      )}

      <h3 style={{ fontSize: 17, marginTop: 14, marginBottom: 7 }}>{step.title}</h3>
      <p
        style={{
          fontSize: 13.5,
          lineHeight: 1.55,
          color: "var(--text-dim)",
          margin: 0,
        }}
      >
        {step.desc}
      </p>

      {/* Indicador de progreso */}
      <div
        style={{
          display: "flex",
          gap: 6,
          marginTop: 18,
          marginBottom: 18,
          alignItems: "center",
          justifyContent: isCentered ? "center" : "flex-start",
        }}
      >
        {STEPS.map((s, idx) => (
          <button
            key={s.key}
            aria-label={`Ir al paso ${idx + 1}`}
            className={"tour-dot" + (idx === i ? " tour-dot--active" : "")}
            onClick={() => setI(idx)}
          />
        ))}
      </div>

      {/* Acciones */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <button className="tour-skip" onClick={finish}>
          {isFirst ? "Saltar" : isLast ? "Cerrar" : "Saltar tutorial"}
        </button>

        <div style={{ display: "flex", gap: 8 }}>
          {!isFirst && !isLast && (
            <button className="tour-back" onClick={back}>
              Atrás
            </button>
          )}
          {isLast ? (
            <button
              className="tour-next"
              onClick={() => {
                navigate("/perfil")
                finish()
              }}
            >
              Ir a mi perfil →
            </button>
          ) : (
            <button className="tour-next" onClick={next}>
              {isFirst ? "Empezar tour" : "Siguiente"}
            </button>
          )}
        </div>
      </div>
    </>
  )

  return (
    <div role="dialog" aria-modal="true" aria-label="Tutorial de NoEmprendasSolo">
      {useSpotlight && rect ? (
        <>
          <div className="tour-clickguard" />
          <div
            className="tour-spotlight"
            style={{
              top: rect.top - 6,
              left: rect.left - 6,
              width: rect.width + 12,
              height: rect.height + 12,
            }}
          />
          <div key={i} className="tour-card" style={cardStyle}>
            <span className="tour-caret" style={{ left: caretLeft }} />
            {body}
          </div>
        </>
      ) : (
        <div className="tour-overlay">
          <div key={i} className="tour-card tour-card--centered">
            {body}
          </div>
        </div>
      )}
    </div>
  )
}
