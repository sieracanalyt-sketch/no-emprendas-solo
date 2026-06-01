import { useEffect, useRef, useState } from "react"

type Panel = {
  num: string
  title: string
  body: string
  accent: string
  bg: string
}

const PANELS: Panel[] = [
  {
    num: "I",
    title: "Contactos de alto nivel",
    body:
      "Empresarios, inversores y fundadores reales. Conexiones que normalmente cuestan miles en redes premium.",
    accent: "#ef4444",
    bg: "radial-gradient(circle at 20% 30%, rgba(239,68,68,0.18), transparent 50%)",
  },
  {
    num: "II",
    title: "Masterminds semanales",
    body:
      "Reuniones íntimas donde resuelves tus bloqueos reales con personas que ya pasaron por ahí.",
    accent: "#22d3ee",
    bg: "radial-gradient(circle at 80% 30%, rgba(34,211,238,0.18), transparent 50%)",
  },
  {
    num: "III",
    title: "Recursos ocultos",
    body:
      "Plantillas, contactos directos, herramientas y datos privados que no aparecen en ningún Google.",
    accent: "#a855f7",
    bg: "radial-gradient(circle at 50% 70%, rgba(168,85,247,0.2), transparent 55%)",
  },
  {
    num: "IV",
    title: "Una tribu que responde",
    body:
      "Mensajes contestados en minutos. Cero ghosting. Cuando tropiezas, hay manos extendidas.",
    accent: "#22c55e",
    bg: "radial-gradient(circle at 30% 80%, rgba(34,197,94,0.18), transparent 50%)",
  },
]

/**
 * Scroll horizontal "espacial": al llegar a la sección, el scroll vertical
 * se convierte en horizontal mientras dura. Implementado con sticky positioning
 * + transform basado en el progreso de scroll relativo al contenedor.
 */
export default function HorizontalBenefits() {
  const containerRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const onScroll = () => {
      const rect = container.getBoundingClientRect()
      const total = container.offsetHeight - window.innerHeight
      const passed = -rect.top
      const p = Math.max(0, Math.min(1, passed / total))
      setProgress(p)
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
    }
  }, [])

  const translatePct = -progress * (PANELS.length - 1) * 100

  return (
    <section
      ref={containerRef}
      style={{
        position: "relative",
        height: `${PANELS.length * 100}vh`,
        background: "#050505",
      }}
    >
      <div
        style={{
          position: "sticky",
          top: 0,
          width: "100vw",
          height: "100vh",
          overflow: "hidden",
        }}
      >
        {/* Progress bar lateral */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            right: "2rem",
            transform: "translateY(-50%)",
            display: "flex",
            flexDirection: "column",
            gap: "0.8rem",
            zIndex: 10,
          }}
        >
          {PANELS.map((_, i) => {
            const isActive = Math.round(progress * (PANELS.length - 1)) === i
            return (
              <div
                key={i}
                style={{
                  width: isActive ? "3px" : "2px",
                  height: isActive ? "32px" : "16px",
                  background: isActive
                    ? PANELS[i].accent
                    : "rgba(255,255,255,0.2)",
                  borderRadius: "2px",
                  transition: "all 0.4s",
                  boxShadow: isActive
                    ? `0 0 12px ${PANELS[i].accent}`
                    : "none",
                }}
              />
            )
          })}
        </div>

        {/* Header */}
        <div
          style={{
            position: "absolute",
            top: "3rem",
            left: "2rem",
            zIndex: 10,
            maxWidth: "300px",
          }}
        >
          <p
            style={{
              color: "rgba(255,255,255,0.4)",
              fontSize: "0.72rem",
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              marginBottom: "0.4rem",
            }}
          >
            · Capítulo 02 · Beneficios ocultos
          </p>
          <p
            style={{
              color: "#fff",
              fontSize: "0.95rem",
              fontWeight: 500,
              opacity: 0.8,
            }}
          >
            Desplázate para descubrir
          </p>
        </div>

        {/* Track horizontal */}
        <div
          ref={trackRef}
          style={{
            display: "flex",
            width: `${PANELS.length * 100}vw`,
            height: "100%",
            transform: `translate3d(${translatePct}vw, 0, 0)`,
            transition: "transform 0.1s linear",
            willChange: "transform",
          }}
        >
          {PANELS.map((p, i) => (
            <BenefitPanel key={i} panel={p} index={i} progress={progress} total={PANELS.length} />
          ))}
        </div>

        {/* Hint flecha */}
        <div
          className="nes-scroll-hint"
          style={{
            position: "absolute",
            bottom: "2rem",
            left: "50%",
            transform: "translateX(-50%)",
            color: "rgba(255,255,255,0.4)",
            fontSize: "0.78rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            display: "flex",
            alignItems: "center",
            gap: "0.7rem",
          }}
        >
          Scroll <span style={{ fontSize: "1.1rem" }}>→</span>
        </div>
      </div>
    </section>
  )
}

function BenefitPanel({
  panel,
  index,
  progress,
  total,
}: {
  panel: Panel
  index: number
  progress: number
  total: number
}) {
  // Calculo "centralidad" para asimetrías de entrada
  const myProgress = progress * (total - 1)
  const distance = Math.abs(myProgress - index)
  const opacity = Math.max(0.3, 1 - distance * 0.7)
  const translateY = distance * 30

  return (
    <div
      style={{
        flex: "0 0 100vw",
        height: "100%",
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 2rem",
        background: panel.bg,
      }}
    >
      {/* Número de fondo gigante */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "clamp(20rem, 50vw, 40rem)",
          fontWeight: 900,
          color: "rgba(255,255,255,0.02)",
          letterSpacing: "-0.1em",
          pointerEvents: "none",
          userSelect: "none",
          transform: `translateY(${-translateY * 0.5}px)`,
        }}
      >
        {panel.num}
      </div>

      {/* Tarjeta glassmorphism */}
      <div
        style={{
          position: "relative",
          maxWidth: "560px",
          padding: "3rem 2.5rem",
          background: "rgba(15,15,18,0.55)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: `1px solid ${panel.accent}33`,
          borderRadius: "24px",
          boxShadow: `0 30px 80px -20px ${panel.accent}25, inset 0 1px 0 rgba(255,255,255,0.05)`,
          opacity,
          transform: `translateY(${translateY}px)`,
          transition: "opacity 0.3s, transform 0.3s",
          zIndex: 1,
        }}
      >
        <div
          style={{
            color: panel.accent,
            fontSize: "0.75rem",
            letterSpacing: "0.3em",
            textTransform: "uppercase",
            marginBottom: "1rem",
            fontWeight: 600,
          }}
        >
          {panel.num} de {total}
        </div>
        <h3
          style={{
            color: "#fff",
            fontSize: "clamp(2rem, 4.5vw, 3rem)",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            lineHeight: 1.05,
            marginBottom: "1.5rem",
          }}
        >
          {panel.title}
        </h3>
        <p
          style={{
            color: "rgba(255,255,255,0.7)",
            fontSize: "1.05rem",
            lineHeight: 1.7,
            margin: 0,
          }}
        >
          {panel.body}
        </p>
      </div>
    </div>
  )
}
