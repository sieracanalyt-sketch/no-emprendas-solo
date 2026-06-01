import { useEffect, useState } from "react"
import MatrixRain from "./MatrixRain"

type Phase = "matrix" | "message" | "pills" | "transitioning"
type ExitMode = "glitch" | "tv" | null

/**
 * Intro inmersivo: Matrix → mensaje → elección (Adelante / Volver atrás).
 * Llama a onComplete() cuando el usuario elige "Adelante" tras el glitch.
 * "Volver atrás" reinicia la secuencia.
 */
export default function IntroSequence({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState<Phase>("matrix")
  const [matrixOpacity, setMatrixOpacity] = useState(1)
  const [textOpacity, setTextOpacity] = useState(0)
  const [crossFade, setCrossFade] = useState(0)
  const [exit, setExit] = useState<ExitMode>(null)

  // ── Fase Matrix: timings ──────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "matrix") return
    const t1 = setTimeout(() => setTextOpacity(1), 2500)
    const t2 = setTimeout(() => setMatrixOpacity(0), 3200)
    const t3 = setTimeout(() => setPhase("message"), 3900)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [phase])

  const crossTo = (to: Phase, ms = 320) => {
    setCrossFade(1)
    setTimeout(() => {
      setPhase(to)
      requestAnimationFrame(() =>
        requestAnimationFrame(() => setCrossFade(0))
      )
    }, ms + 40)
  }

  const handleAdelante = () => {
    setPhase("transitioning")
    setExit("glitch")
    // glitch dura 0.85s; al terminar, montamos la landing
    setTimeout(onComplete, 850)
  }

  const handleVolver = () => {
    setExit("tv")
    setTimeout(() => {
      // Reinicio total
      setExit(null)
      setMatrixOpacity(1)
      setTextOpacity(0)
      setCrossFade(0)
      setPhase("matrix")
    }, 1700)
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#000",
        overflow: "hidden",
        fontFamily: "'Inter','Segoe UI',system-ui,sans-serif",
        zIndex: 1000,
      }}
    >
      {/* ─── TV OFF overlay (azul) ─── */}
      {exit === "tv" && (
        <div
          className="nes-tv-off"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            background: "#fff",
            transformOrigin: "center center",
            pointerEvents: "none",
          }}
        />
      )}

      {/* ─── Glitch overlay (rojo) ─── */}
      {exit === "glitch" && (
        <div
          className="nes-glitch"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            background:
              "linear-gradient(180deg, rgba(255,0,80,0.15), rgba(0,255,255,0.15))",
            pointerEvents: "none",
            mixBlendMode: "screen",
          }}
        >
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="nes-glitch-bar"
              style={{
                position: "absolute",
                left: 0,
                top: `${Math.random() * 100}%`,
                width: "100%",
                height: `${4 + Math.random() * 14}px`,
                background: `rgba(${Math.random() > 0.5 ? "255,255,255" : "239,68,68"},0.7)`,
                animationDelay: `${Math.random() * 0.4}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* ─── Cross-fade negro entre fases ─── */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 40,
          background: "#000",
          opacity: crossFade,
          transition: "opacity 0.32s ease",
          pointerEvents: crossFade > 0 ? "all" : "none",
        }}
      />

      {/* ═══════════════════ FASES MATRIX + MENSAJE ═══════════════════ */}
      {(phase === "matrix" || phase === "message") && (
        <div style={{ position: "absolute", inset: 0 }}>
          {phase === "matrix" && <MatrixRain opacity={matrixOpacity} />}

          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "2rem",
              opacity: textOpacity,
              transition: "opacity 0.7s ease-in",
              pointerEvents: textOpacity < 0.5 ? "none" : "auto",
            }}
          >
            <p
              style={{
                color: "#e8e8e8",
                fontSize: "clamp(1.15rem, 2.8vw, 2rem)",
                fontWeight: 300,
                fontStyle: "italic",
                textAlign: "center",
                maxWidth: "740px",
                lineHeight: 1.7,
                letterSpacing: "0.01em",
                marginBottom: "2.8rem",
                textShadow: "0 0 30px rgba(0,255,127,0.15)",
              }}
            >
              &ldquo;Diseñado para emprendedores que tienen la visión,
              <br />
              pero necesitan la tribu.&rdquo;
            </p>

            {phase === "message" && (
              <button
                onClick={() => crossTo("pills")}
                className="nes-fade-up"
                style={{
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.22)",
                  color: "#888",
                  padding: "0.7rem 2rem",
                  borderRadius: "999px",
                  fontSize: "0.88rem",
                  cursor: "pointer",
                  letterSpacing: "0.08em",
                  transition: "border-color 0.2s, color 0.2s",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.6rem",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.6)"
                  e.currentTarget.style.color = "#fff"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.22)"
                  e.currentTarget.style.color = "#888"
                }}
              >
                Siguiente <span style={{ fontSize: "1rem" }}>↓</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════ FASE PILLS ═══════════════════ */}
      {phase === "pills" && (
        <div
          className="nes-fade-up"
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background:
              "radial-gradient(ellipse at center, rgba(20,20,25,1) 0%, #000 70%)",
            gap: "3.5rem",
            padding: "2rem",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <p
              style={{
                color: "#3a3a3a",
                fontSize: "0.75rem",
                letterSpacing: "0.3em",
                textTransform: "uppercase",
                marginBottom: "0.8rem",
              }}
            >
              · Una elección ·
            </p>
            <h2
              style={{
                color: "#d8d8d8",
                fontSize: "clamp(1.6rem, 3.5vw, 2.6rem)",
                fontWeight: 300,
                letterSpacing: "0.04em",
              }}
            >
              ¿Qué camino eliges?
            </h2>
          </div>

          <div
            style={{
              display: "flex",
              gap: "1.75rem",
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            <PillButton color="red" label="Adelante" onClick={handleAdelante} />
            <PillButton color="blue" label="Volver atrás" onClick={handleVolver} />
          </div>

          <p
            style={{
              color: "#2a2a2a",
              fontSize: "0.78rem",
              letterSpacing: "0.12em",
              maxWidth: "440px",
              textAlign: "center",
              lineHeight: 1.6,
            }}
          >
            La pastilla roja te muestra hasta dónde llega la madriguera.
          </p>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Pill button con glow al hover
// ─────────────────────────────────────────────────────────────────────────
function PillButton({
  color,
  label,
  onClick,
}: {
  color: "red" | "blue"
  label: string
  onClick: () => void
}) {
  const accent = color === "red" ? "#ef4444" : "#3b82f6"
  const accentDark = color === "red" ? "#c0392b" : "#2563eb"
  const accentSoft =
    color === "red" ? "rgba(239,68,68,0.15)" : "rgba(59,130,246,0.15)"

  return (
    <button
      onClick={onClick}
      style={{
        position: "relative",
        padding: "1.15rem 3.2rem",
        background: "transparent",
        border: `1.5px solid ${accentDark}`,
        color: accent,
        borderRadius: "14px",
        fontSize: "1rem",
        fontWeight: 500,
        cursor: "pointer",
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        transition: "all 0.3s",
        minWidth: "180px",
        boxShadow: `0 0 0 0 ${accentSoft}`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = accentSoft
        e.currentTarget.style.boxShadow = `0 0 30px 4px ${accentSoft}, inset 0 0 20px ${accentSoft}`
        e.currentTarget.style.transform = "translateY(-2px)"
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent"
        e.currentTarget.style.boxShadow = `0 0 0 0 ${accentSoft}`
        e.currentTarget.style.transform = "none"
      }}
    >
      {label}
    </button>
  )
}
