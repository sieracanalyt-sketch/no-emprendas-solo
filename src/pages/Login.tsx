import { useState, useEffect, useRef, useCallback } from "react"
import { useNavigate, Link } from "react-router-dom"
import { supabase } from "../supabase"

// ─── Matrix Rain Canvas ───────────────────────────────────────────────────────
function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener("resize", resize)

    const chars =
      "01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワン" +
      "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz{}[]()=+-*/&|!@#$%^"
    const fs = 14
    const cols = Math.floor(canvas.width / fs)
    const drops: number[] = Array.from({ length: cols }, () =>
      Math.floor(Math.random() * (canvas.height / fs))
    )

    const draw = () => {
      ctx.fillStyle = "rgba(0,0,0,0.05)"
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = "#00ff00"
      ctx.font = `${fs}px monospace`
      for (let i = 0; i < drops.length; i++) {
        const ch = chars[Math.floor(Math.random() * chars.length)]
        ctx.fillText(ch, i * fs, drops[i] * fs)
        if (drops[i] * fs > canvas.height && Math.random() > 0.975) drops[i] = 0
        drops[i]++
      }
    }

    const id = setInterval(draw, 33)
    return () => {
      clearInterval(id)
      window.removeEventListener("resize", resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        background: "black",
        display: "block",
      }}
    />
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────
type Phase = "matrix" | "message" | "pills" | "login"

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Login() {
  const [phase, setPhase] = useState<Phase>("matrix")

  // Matrix + text independent opacities for the overlap effect
  const [matrixOpacity, setMatrixOpacity] = useState(1)
  const [textOpacity, setTextOpacity] = useState(0)

  // General cross-fade overlay between phases
  const [crossFadeOpacity, setCrossFadeOpacity] = useState(0)

  // TV-off state
  const [tvOff, setTvOff] = useState(false)

  // Login form
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const navigate = useNavigate()

  // ── Phase 1 auto-sequencing ───────────────────────────────────────────────
  // At 3300ms: text fades IN over matrix (ease-in)
  // At 4000ms: matrix fades OUT — 700ms overlap
  // At 4700ms: phase → "message" (matrix fully gone, text clean on dark bg)
  useEffect(() => {
    if (phase !== "matrix") return
    const t1 = setTimeout(() => setTextOpacity(1), 3300)
    const t2 = setTimeout(() => setMatrixOpacity(0), 4000)
    const t3 = setTimeout(() => setPhase("message"), 4700)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [phase])

  // ── Cross-fade transition helper ──────────────────────────────────────────
  const crossFade = useCallback((to: Phase, durationMs = 350) => {
    setCrossFadeOpacity(1)
    setTimeout(() => {
      setPhase(to)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setCrossFadeOpacity(0))
      })
    }, durationMs + 50)
  }, [])

  // ── Blue pill: TV-off animation → restart whole sequence ──────────────────
  const handleTvOff = () => {
    setTvOff(true)
    setTimeout(() => {
      setTvOff(false)
      // Reset and restart from Phase 1
      setMatrixOpacity(1)
      setTextOpacity(0)
      setCrossFadeOpacity(0)
      setPhase("matrix")
    }, 1700)
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) throw err
      navigate("/explorar")
    } catch {
      setError("Correo o contraseña incorrectos.")
    } finally {
      setLoading(false)
    }
  }

  const loginGoogle = async () => {
    try {
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/explorar` },
      })
      if (err) throw err
    } catch {
      setError("Error al iniciar sesión con Google.")
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#000",
        fontFamily: "'Inter','Segoe UI',system-ui,sans-serif",
        overflow: "hidden",
      }}
    >
      {/* ── Global styles ──────────────────────────────────────────────── */}
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { overflow: hidden; }
        input::placeholder { color: #555; }
        input:focus { border-color: #4a4a4a !important; }

        /* Phase fade-in animation for pills and login */
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* TV-off: flash → squeeze → vanish */
        @keyframes tv-off {
          0%   { transform: scaleY(1)    scaleX(1);   opacity: 1; filter: brightness(1); }
          7%   { transform: scaleY(1)    scaleX(1);               filter: brightness(5); }
          18%  { transform: scaleY(0.025) scaleX(1.04); opacity: 1; filter: brightness(4); }
          50%  { transform: scaleY(0.025) scaleX(0.65); opacity: 1; filter: brightness(2); }
          85%  { transform: scaleY(0.025) scaleX(0.12); opacity: 0.9; }
          100% { transform: scaleY(0)    scaleX(0);   opacity: 0; filter: brightness(0); }
        }

        .tv-off-overlay {
          animation: tv-off 1.5s cubic-bezier(0.4,0,1,1) forwards;
        }

        /* Pill button glow on hover */
        .pill-red:hover  { background: rgba(192,57,43,0.12) !important; box-shadow: 0 0 24px rgba(231,76,60,0.35) !important; }
        .pill-blue:hover { background: rgba(41,128,185,0.12) !important; box-shadow: 0 0 24px rgba(52,152,219,0.35) !important; }

        .next-btn:hover { border-color: rgba(255,255,255,0.55) !important; color: #fff !important; }

        .google-btn:hover { background: #f0f0f0 !important; }
        .submit-btn:hover:not(:disabled) { background: #e8e8e8 !important; }

        @media (max-width: 700px) {
          .login-cols { flex-direction: column !important; }
          .login-left { padding: 2.5rem 1.5rem !important; }
          .login-right { min-height: 220px; }
        }
      `}</style>

      {/* ── TV-off overlay (z 200) ──────────────────────────────────────── */}
      {tvOff && (
        <div
          className="tv-off-overlay"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            background: "#ffffff",
            transformOrigin: "center center",
          }}
        />
      )}

      {/* ── Cross-fade black overlay (z 100) ───────────────────────────── */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 100,
          background: "#000",
          opacity: crossFadeOpacity,
          transition: "opacity 0.35s ease",
          pointerEvents: crossFadeOpacity > 0 ? "all" : "none",
        }}
      />

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* PHASE 1 & 2: Matrix canvas + text overlay                        */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {(phase === "matrix" || phase === "message") && (
        <div style={{ position: "absolute", inset: 0 }}>
          {/* Matrix canvas — fades out independently */}
          {phase === "matrix" && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                opacity: matrixOpacity,
                transition: "opacity 0.65s ease-out",
              }}
            >
              <MatrixRain />
            </div>
          )}

          {/* Text overlay — fades IN over matrix then stays */}
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
              transition: "opacity 0.65s ease-in",
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
                maxWidth: "720px",
                lineHeight: 1.7,
                letterSpacing: "0.01em",
                marginBottom: "2.8rem",
              }}
            >
              &ldquo;Diseñado para emprendedores que tienen la visión,
              <br />pero necesitan la tribu.&rdquo;
            </p>

            {/* "Siguiente" only shows once matrix is gone */}
            {phase === "message" && (
              <button
                className="next-btn"
                onClick={() => crossFade("pills")}
                style={{
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.22)",
                  color: "#888",
                  padding: "0.65rem 1.9rem",
                  borderRadius: "999px",
                  fontSize: "0.88rem",
                  cursor: "pointer",
                  letterSpacing: "0.06em",
                  transition: "border-color 0.2s, color 0.2s",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.55rem",
                }}
              >
                Siguiente{" "}
                <span style={{ fontSize: "1rem", lineHeight: 1 }}>↓</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* PHASE 3: Red pill / Blue pill                                    */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {phase === "pills" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "#080808",
            gap: "3.5rem",
            animation: "fadeUp 0.55s ease both",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <p
              style={{
                color: "#3a3a3a",
                fontSize: "0.75rem",
                letterSpacing: "0.25em",
                textTransform: "uppercase",
                marginBottom: "0.8rem",
              }}
            >
              Una elección
            </p>
            <h2
              style={{
                color: "#d8d8d8",
                fontSize: "clamp(1.6rem, 3.5vw, 2.4rem)",
                fontWeight: 300,
                letterSpacing: "0.04em",
              }}
            >
              ¿Qué camino eliges?
            </h2>
          </div>

          <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", justifyContent: "center" }}>
            {/* Red pill */}
            <button
              className="pill-red"
              onClick={() => crossFade("login")}
              style={{
                padding: "1.1rem 3rem",
                background: "transparent",
                border: "1.5px solid #c0392b",
                color: "#e74c3c",
                borderRadius: "14px",
                fontSize: "1rem",
                fontWeight: 500,
                cursor: "pointer",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                transition: "background 0.25s, box-shadow 0.25s",
                minWidth: "170px",
              }}
            >
              Adelante
            </button>

            {/* Blue pill */}
            <button
              className="pill-blue"
              onClick={handleTvOff}
              style={{
                padding: "1.1rem 3rem",
                background: "transparent",
                border: "1.5px solid #2980b9",
                color: "#3498db",
                borderRadius: "14px",
                fontSize: "1rem",
                fontWeight: 500,
                cursor: "pointer",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                transition: "background 0.25s, box-shadow 0.25s",
                minWidth: "170px",
              }}
            >
              Volver atrás
            </button>
          </div>

          <p
            style={{
              color: "#2a2a2a",
              fontSize: "0.75rem",
              letterSpacing: "0.12em",
              marginTop: "-1rem",
            }}
          >
            La pastilla roja te muestra hasta dónde llega la madriguera
          </p>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* PHASE 4: Login form                                              */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {phase === "login" && (
        <div
          className="login-cols"
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background: "#0d0d0d",
            animation: "fadeUp 0.55s ease both",
          }}
        >
          {/* ── Left column: form ──────────────────────────────────────── */}
          <div
            className="login-left"
            style={{
              flex: "0 0 50%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              padding: "3rem 4rem",
              background: "#111",
              overflowY: "auto",
            }}
          >
            <div style={{ width: "100%", maxWidth: "400px" }}>
              <h1
                style={{
                  color: "#fff",
                  fontSize: "clamp(1.5rem, 2.5vw, 2rem)",
                  fontWeight: 800,
                  marginBottom: "2.5rem",
                  letterSpacing: "-0.03em",
                  lineHeight: 1.2,
                }}
              >
                Inicia sesión en
                <br />tu cuenta
              </h1>

              {/* Google */}
              <button
                className="google-btn"
                onClick={loginGoogle}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.75rem",
                  padding: "0.88rem 1.5rem",
                  background: "#fff",
                  color: "#1a1a1a",
                  border: "none",
                  borderRadius: "10px",
                  fontSize: "0.95rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  marginBottom: "1.5rem",
                  transition: "background 0.18s",
                }}
              >
                <GoogleIcon />
                Iniciar sesión con Google
              </button>

              {/* Divider */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                  marginBottom: "1.5rem",
                }}
              >
                <div style={{ flex: 1, height: "1px", background: "#222" }} />
                <span style={{ color: "#555", fontSize: "0.78rem", letterSpacing: "0.04em" }}>
                  o con correo
                </span>
                <div style={{ flex: 1, height: "1px", background: "#222" }} />
              </div>

              {/* Email/password form */}
              <form onSubmit={handleSubmit}>
                <input
                  type="email"
                  placeholder="Correo electrónico"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={inputStyle}
                />
                <input
                  type="password"
                  placeholder="Contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{ ...inputStyle, marginTop: "0.75rem" }}
                />

                {error && (
                  <p
                    style={{
                      color: "#ff6b6b",
                      fontSize: "0.82rem",
                      marginTop: "0.6rem",
                    }}
                  >
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  className="submit-btn"
                  disabled={loading}
                  style={{
                    width: "100%",
                    padding: "0.88rem",
                    marginTop: "1rem",
                    background: loading ? "#1e1e1e" : "#fff",
                    color: loading ? "#555" : "#111",
                    border: "none",
                    borderRadius: "10px",
                    fontSize: "0.95rem",
                    fontWeight: 600,
                    cursor: loading ? "not-allowed" : "pointer",
                    transition: "background 0.18s",
                  }}
                >
                  {loading ? "Entrando…" : "Iniciar sesión"}
                </button>
              </form>

              <p
                style={{
                  marginTop: "1.8rem",
                  textAlign: "center",
                  color: "#555",
                  fontSize: "0.87rem",
                }}
              >
                ¿No tienes una cuenta?{" "}
                <Link
                  to="/register"
                  style={{ color: "#888", textDecoration: "underline", fontWeight: 500 }}
                >
                  Regístrate
                </Link>
              </p>
            </div>
          </div>

          {/* ── Right column: brand ────────────────────────────────────── */}
          <div
            className="login-right"
            style={{
              flex: "0 0 50%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: "#0d0d0d",
              padding: "3rem",
            }}
          >
            <div
              style={{
                width: "clamp(130px, 16vw, 200px)",
                aspectRatio: "1",
              }}
            >
              <BrandLogo />
            </div>
            <p
              style={{
                marginTop: "2rem",
                color: "#333",
                fontSize: "clamp(0.7rem, 1.1vw, 0.9rem)",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                fontWeight: 500,
              }}
            >
              No Emprendas Solo
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Input style ──────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.85rem 1rem",
  background: "#181818",
  border: "1px solid #2a2a2a",
  borderRadius: "10px",
  color: "#e0e0e0",
  fontSize: "0.92rem",
  outline: "none",
  transition: "border-color 0.18s",
  display: "block",
}

// ─── Google SVG ───────────────────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  )
}

// ─── Brand Logo SVG ───────────────────────────────────────────────────────────
function BrandLogo() {
  return (
    <svg
      viewBox="0 0 200 220"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", height: "100%" }}
      aria-label="No Emprendas Solo"
    >
      <circle cx="100" cy="26" r="16" fill="white" />
      <path
        d="M32 68 Q66 44 100 44 Q134 44 168 68"
        stroke="white"
        strokeWidth="20"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M40 74 Q28 118 30 160"
        stroke="white"
        strokeWidth="20"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M160 74 Q172 118 170 160"
        stroke="white"
        strokeWidth="20"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M100 62 Q100 120 100 165"
        stroke="white"
        strokeWidth="20"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="30" cy="176" r="16" fill="white" />
      <circle cx="170" cy="176" r="16" fill="white" />
    </svg>
  )
}
