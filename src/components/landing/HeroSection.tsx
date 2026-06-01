import { useEffect, useRef } from "react"
import MagneticButton from "./MagneticButton"

type Props = { onJoin: () => void }

/**
 * Hero brutalista:
 * - Fondo con parallax controlado por la posición del cursor (CSS vars).
 * - Titular gigante con letras hover-reactivas.
 * - Subtítulo intrigante + CTA magnética.
 */
export default function HeroSection({ onJoin }: Props) {
  const wrapperRef = useRef<HTMLElement>(null)

  // Mouse parallax → actualiza CSS vars --mx --my en %
  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    const onMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2  // -1..1
      const y = (e.clientY / window.innerHeight - 0.5) * 2
      el.style.setProperty("--mx", `${x}`)
      el.style.setProperty("--my", `${y}`)
    }
    window.addEventListener("mousemove", onMove)
    return () => window.removeEventListener("mousemove", onMove)
  }, [])

  return (
    <section
      ref={wrapperRef}
      style={{
        position: "relative",
        minHeight: "100vh",
        background: "#050505",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "6rem 1.5rem 4rem",
        // CSS vars de cursor (se actualizan en el effect)
        // @ts-expect-error custom CSS property
        "--mx": 0,
        "--my": 0,
      }}
    >
      {/* ── Capa de fondo: grid + glow ───────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          inset: "-10%",
          backgroundImage: `
            radial-gradient(circle at 30% 40%, rgba(239,68,68,0.15) 0%, transparent 40%),
            radial-gradient(circle at 70% 60%, rgba(34,211,238,0.12) 0%, transparent 45%),
            linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)
          `,
          backgroundSize: "100% 100%, 100% 100%, 64px 64px, 64px 64px",
          transform:
            "translate3d(calc(var(--mx) * -25px), calc(var(--my) * -25px), 0)",
          transition: "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
          pointerEvents: "none",
        }}
      />

      {/* ── Capa de fondo profunda: estrellas/puntos ────────────────── */}
      <div
        style={{
          position: "absolute",
          inset: "-5%",
          background: `radial-gradient(2px 2px at 20% 30%, rgba(255,255,255,0.5), transparent),
                       radial-gradient(1px 1px at 80% 70%, rgba(255,255,255,0.4), transparent),
                       radial-gradient(1.5px 1.5px at 50% 20%, rgba(255,255,255,0.3), transparent),
                       radial-gradient(1px 1px at 90% 40%, rgba(255,255,255,0.4), transparent),
                       radial-gradient(2px 2px at 10% 80%, rgba(255,255,255,0.3), transparent)`,
          backgroundSize: "300px 300px",
          transform:
            "translate3d(calc(var(--mx) * -10px), calc(var(--my) * -10px), 0)",
          transition: "transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
          pointerEvents: "none",
          opacity: 0.7,
        }}
      />

      {/* ── Mini-nav superior ────────────────────────────────────────── */}
      <nav
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          padding: "1.5rem 2rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          zIndex: 10,
        }}
      >
        <span
          style={{
            color: "#fff",
            fontWeight: 800,
            fontSize: "0.95rem",
            letterSpacing: "0.05em",
          }}
        >
          NES<span style={{ color: "#ef4444" }}>.</span>
        </span>
        <button
          onClick={onJoin}
          style={{
            background: "transparent",
            color: "rgba(255,255,255,0.7)",
            border: "1px solid rgba(255,255,255,0.15)",
            padding: "0.5rem 1.1rem",
            borderRadius: "999px",
            fontSize: "0.82rem",
            cursor: "pointer",
            fontWeight: 500,
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.45)"
            e.currentTarget.style.color = "#fff"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"
            e.currentTarget.style.color = "rgba(255,255,255,0.7)"
          }}
        >
          Entrar
        </button>
      </nav>

      {/* ── Contenido principal ──────────────────────────────────────── */}
      <div
        style={{
          position: "relative",
          zIndex: 5,
          maxWidth: "1200px",
          margin: "0 auto",
          width: "100%",
          textAlign: "center",
        }}
      >
        {/* Badge superior */}
        <div
          className="nes-fade-up"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.4rem 1rem",
            borderRadius: "999px",
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.25)",
            color: "#fca5a5",
            fontSize: "0.78rem",
            letterSpacing: "0.08em",
            marginBottom: "2.5rem",
            textTransform: "uppercase",
            fontWeight: 500,
          }}
        >
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "999px",
              background: "#ef4444",
              boxShadow: "0 0 10px #ef4444",
            }}
          />
          Acceso por invitación
        </div>

        {/* Titular brutalista */}
        <h1
          style={{
            fontSize: "clamp(2.8rem, 9vw, 7rem)",
            fontWeight: 900,
            lineHeight: 0.95,
            letterSpacing: "-0.04em",
            margin: 0,
            color: "#fff",
            textTransform: "uppercase",
          }}
        >
          <BrutalLine text="CONSTRUYE." delay={0} />
          <BrutalLine
            text="SIN RED."
            delay={120}
            style={{
              display: "block",
              color: "#888",
              fontStyle: "italic",
              fontWeight: 400,
              textDecoration: "line-through",
              textDecorationColor: "#ef4444",
              textDecorationThickness: "6px",
            }}
          />
          {/* Tercera línea: gradient via solid render (no per-letter split,
              para que background-clip:text funcione correctamente) */}
          <span
            className="nes-fade-up"
            style={{
              display: "block",
              animationDelay: "240ms",
              background:
                "linear-gradient(90deg, #fff 0%, #ef4444 50%, #fff 100%)",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              filter: "drop-shadow(0 0 30px rgba(239,68,68,0.3))",
            }}
          >
            CON TU TRIBU.
          </span>
        </h1>

        {/* Subtítulo */}
        <p
          className="nes-fade-up"
          style={{
            fontSize: "clamp(1rem, 1.6vw, 1.2rem)",
            color: "rgba(255,255,255,0.6)",
            maxWidth: "560px",
            margin: "2.5rem auto 3rem",
            lineHeight: 1.65,
            animationDelay: "0.5s",
          }}
        >
          El club secreto de los que no se conforman.
          <br />
          No mostramos lo que hay dentro a cualquiera.
        </p>

        {/* CTA magnética */}
        <div
          className="nes-fade-up"
          style={{ animationDelay: "0.7s", marginBottom: "2rem" }}
        >
          <MagneticButton
            onClick={onJoin}
            style={{
              position: "relative",
              padding: "1.2rem 3rem",
              background: "#fff",
              color: "#000",
              border: "none",
              borderRadius: "999px",
              fontSize: "1rem",
              fontWeight: 700,
              cursor: "pointer",
              letterSpacing: "0.04em",
              boxShadow:
                "0 20px 60px -10px rgba(255,255,255,0.4), 0 0 0 1px rgba(255,255,255,0.1)",
            }}
          >
            Unirme a la tribu →
          </MagneticButton>
        </div>

        {/* Trust indicators */}
        <div
          style={{
            display: "flex",
            gap: "2rem",
            justifyContent: "center",
            flexWrap: "wrap",
            color: "rgba(255,255,255,0.35)",
            fontSize: "0.75rem",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          <span>· 1:1 Matching ·</span>
          <span>· Masterminds ·</span>
          <span>· Sin spam ·</span>
        </div>
      </div>

      {/* Scroll hint */}
      <div
        style={{
          position: "absolute",
          bottom: "2rem",
          left: "50%",
          transform: "translateX(-50%)",
          color: "rgba(255,255,255,0.3)",
          fontSize: "0.72rem",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0.5rem",
        }}
      >
        Scroll
        <span style={{ fontSize: "1rem" }}>↓</span>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Línea de titular con letras hover-reactivas
// ─────────────────────────────────────────────────────────────────────────
function BrutalLine({
  text,
  delay = 0,
  style,
}: {
  text: string
  delay?: number
  style?: React.CSSProperties
}) {
  return (
    <span
      className="nes-fade-up"
      style={{
        display: "block",
        animationDelay: `${delay}ms`,
        ...style,
      }}
    >
      {Array.from(text).map((char, i) => (
        <span
          key={i}
          className="nes-letter"
          style={{ display: char === " " ? "inline" : "inline-block" }}
        >
          {char === " " ? " " : char}
        </span>
      ))}
    </span>
  )
}
