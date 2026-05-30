import { useState, useEffect, useRef } from "react"
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

    const characters =
      "01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワン0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz{}[]()=+-*/&|!@#$%^"
    const fontSize = 14
    const columns = Math.floor(canvas.width / fontSize)
    const drops: number[] = Array.from({ length: columns }, () =>
      Math.floor(Math.random() * (canvas.height / fontSize))
    )

    const draw = () => {
      ctx.fillStyle = "rgba(0,0,0,0.05)"
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = "#00ff00"
      ctx.font = `${fontSize}px monospace`
      for (let i = 0; i < drops.length; i++) {
        const text = characters[Math.floor(Math.random() * characters.length)]
        ctx.fillText(text, i * fontSize, drops[i] * fontSize)
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = 0
        }
        drops[i]++
      }
    }

    const interval = setInterval(draw, 33)
    return () => {
      clearInterval(interval)
      window.removeEventListener("resize", resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ display: "block", background: "black" }}
    />
  )
}

// ─── Phase types ─────────────────────────────────────────────────────────────
type Phase = "matrix" | "message" | "login"

// ─── Main Login Component ─────────────────────────────────────────────────────
export default function Login() {
  const [phase, setPhase] = useState<Phase>("matrix")
  const [opacity, setOpacity] = useState(1)

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const navigate = useNavigate()

  // ── Phase sequencing ──────────────────────────────────────────────────────
  useEffect(() => {
    if (phase === "matrix") {
      // Show matrix for 4s then fade out → message
      const fadeOut = setTimeout(() => {
        setOpacity(0)
      }, 3600)
      const next = setTimeout(() => {
        setOpacity(1)
        setPhase("message")
      }, 4200)
      return () => {
        clearTimeout(fadeOut)
        clearTimeout(next)
      }
    }

    if (phase === "message") {
      // Fade in (already opacity 1 from above)
      // Hold for 2.8s then fade out → login
      const fadeOut = setTimeout(() => setOpacity(0), 2800)
      const next = setTimeout(() => {
        setOpacity(1)
        setPhase("login")
      }, 3500)
      return () => {
        clearTimeout(fadeOut)
        clearTimeout(next)
      }
    }
  }, [phase])

  // ── Auth handlers ─────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (authError) throw authError
      navigate("/explorar")
    } catch {
      setError("Correo o contraseña incorrectos.")
    } finally {
      setLoading(false)
    }
  }

  const loginGoogle = async () => {
    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/explorar` },
      })
      if (authError) throw authError
    } catch {
      setError("Error al iniciar sesión con Google.")
    }
  }

  // ── Shared overlay wrapper ─────────────────────────────────────────────────
  const overlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    opacity,
    transition: "opacity 0.6s ease-in-out",
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE 1: Matrix
  // ─────────────────────────────────────────────────────────────────────────
  if (phase === "matrix") {
    return (
      <div style={overlayStyle}>
        <MatrixRain />
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE 2: Community Message
  // ─────────────────────────────────────────────────────────────────────────
  if (phase === "message") {
    return (
      <div
        style={{
          ...overlayStyle,
          background: "#0a0a0a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
        }}
      >
        <p
          style={{
            color: "#f0f0f0",
            fontSize: "clamp(1.4rem, 3.5vw, 2.6rem)",
            fontFamily: "'Inter', 'Segoe UI', sans-serif",
            fontWeight: 600,
            textAlign: "center",
            lineHeight: 1.5,
            maxWidth: "780px",
            letterSpacing: "-0.01em",
          }}
        >
          Esta es una comunidad para personas con un proyecto pero sin un
          círculo que les apoye
        </p>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE 3: Login
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        ...overlayStyle,
        display: "flex",
        minHeight: "100vh",
        background: "#0d0d0d",
        fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
      }}
    >
      {/* ── Left column: form ─────────────────────────────────────── */}
      <div
        style={{
          flex: "0 0 50%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: "3rem 4rem",
          background: "#111111",
        }}
      >
        <div style={{ width: "100%", maxWidth: "400px" }}>
          {/* Title */}
          <h1
            style={{
              color: "#ffffff",
              fontSize: "clamp(1.5rem, 2.5vw, 2rem)",
              fontWeight: 800,
              marginBottom: "2.5rem",
              letterSpacing: "-0.03em",
              lineHeight: 1.2,
            }}
          >
            Inicia sesión en<br />tu cuenta
          </h1>

          {/* Google button */}
          <button
            onClick={loginGoogle}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.75rem",
              padding: "0.85rem 1.5rem",
              background: "#ffffff",
              color: "#1a1a1a",
              border: "none",
              borderRadius: "10px",
              fontSize: "0.95rem",
              fontWeight: 600,
              cursor: "pointer",
              marginBottom: "1.5rem",
              transition: "background 0.2s",
            }}
            onMouseOver={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.background = "#f0f0f0")
            }
            onMouseOut={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.background = "#ffffff")
            }
          >
            {/* Google SVG logo */}
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
            Continuar con Google
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
            <div style={{ flex: 1, height: "1px", background: "#2a2a2a" }} />
            <span style={{ color: "#555", fontSize: "0.8rem" }}>
              o con correo
            </span>
            <div style={{ flex: 1, height: "1px", background: "#2a2a2a" }} />
          </div>

          {/* Email / password form */}
          <form onSubmit={handleSubmit}>
            <input
              type="email"
              placeholder="Correo electrónico"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={inputStyle}
              onFocus={(e) =>
                ((e.currentTarget as HTMLInputElement).style.borderColor = "#4a4a4a")
              }
              onBlur={(e) =>
                ((e.currentTarget as HTMLInputElement).style.borderColor = "#2a2a2a")
              }
            />
            <input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ ...inputStyle, marginTop: "0.75rem" }}
              onFocus={(e) =>
                ((e.currentTarget as HTMLInputElement).style.borderColor = "#4a4a4a")
              }
              onBlur={(e) =>
                ((e.currentTarget as HTMLInputElement).style.borderColor = "#2a2a2a")
              }
            />

            {error && (
              <p
                style={{
                  color: "#ff6b6b",
                  fontSize: "0.82rem",
                  marginTop: "0.5rem",
                }}
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "0.85rem",
                marginTop: "1rem",
                background: loading ? "#2a2a2a" : "#ffffff",
                color: loading ? "#555" : "#111",
                border: "none",
                borderRadius: "10px",
                fontSize: "0.95rem",
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                transition: "background 0.2s",
              }}
            >
              {loading ? "Entrando…" : "Iniciar sesión"}
            </button>
          </form>

          {/* Register link */}
          <p
            style={{
              marginTop: "1.75rem",
              textAlign: "center",
              color: "#666",
              fontSize: "0.88rem",
            }}
          >
            ¿No tienes una cuenta?{" "}
            <Link
              to="/register"
              style={{
                color: "#aaa",
                textDecoration: "underline",
                fontWeight: 500,
              }}
            >
              Regístrate
            </Link>
          </p>
        </div>
      </div>

      {/* ── Right column: brand ───────────────────────────────────── */}
      <div
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
        {/* Logo — the 3-person icon from the screenshot, rendered as SVG */}
        <div
          style={{
            width: "clamp(140px, 18vw, 220px)",
            aspectRatio: "1",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <BrandLogo />
        </div>

        <p
          style={{
            marginTop: "2rem",
            color: "#444",
            fontSize: "clamp(0.75rem, 1.2vw, 0.95rem)",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            fontWeight: 500,
          }}
        >
          No Emprendas Solo
        </p>
      </div>

      {/* ── Responsive: stack on small screens ───────────────────── */}
      <style>{`
        @media (max-width: 700px) {
          .login-grid { flex-direction: column !important; }
          .login-left { flex: 1 !important; padding: 2.5rem 1.5rem !important; }
          .login-right { flex: 0 0 auto !important; padding: 2rem !important; min-height: 200px; }
        }
        * { box-sizing: border-box; }
        body { margin: 0; }
        input::placeholder { color: #555; }
      `}</style>
    </div>
  )
}

// ─── Shared input style ───────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.82rem 1rem",
  background: "#1a1a1a",
  border: "1px solid #2a2a2a",
  borderRadius: "10px",
  color: "#e0e0e0",
  fontSize: "0.92rem",
  outline: "none",
  transition: "border-color 0.2s",
  display: "block",
}

// ─── Brand logo SVG (reconstructed from the provided screenshot) ──────────────
function BrandLogo() {
  return (
    <svg
      viewBox="0 0 200 220"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", height: "100%" }}
      aria-label="No Emprendas Solo logo"
    >
      {/* Top circle — center person's head */}
      <circle cx="100" cy="26" r="16" fill="white" />

      {/* Shoulder band: wide arc sweeping left & right from top */}
      <path
        d="M32 68 Q66 44 100 44 Q134 44 168 68"
        stroke="white"
        strokeWidth="20"
        strokeLinecap="round"
        fill="none"
      />

      {/* Left arm: curves from shoulder down-left */}
      <path
        d="M40 74 Q28 118 30 160"
        stroke="white"
        strokeWidth="20"
        strokeLinecap="round"
        fill="none"
      />

      {/* Right arm: curves from shoulder down-right */}
      <path
        d="M160 74 Q172 118 170 160"
        stroke="white"
        strokeWidth="20"
        strokeLinecap="round"
        fill="none"
      />

      {/* Central stem going down from the junction */}
      <path
        d="M100 62 Q100 120 100 165"
        stroke="white"
        strokeWidth="20"
        strokeLinecap="round"
        fill="none"
      />

      {/* Bottom-left circle — left person's head */}
      <circle cx="30" cy="176" r="16" fill="white" />

      {/* Bottom-right circle — right person's head */}
      <circle cx="170" cy="176" r="16" fill="white" />
    </svg>
  )
}
