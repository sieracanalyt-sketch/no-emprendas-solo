import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { supabase } from "../supabase"

export default function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const navigate = useNavigate()

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

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        background: "#0d0d0d",
        fontFamily: "'Inter','Segoe UI',system-ui,sans-serif",
        overflow: "hidden",
      }}
    >
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { overflow: hidden; }
        input::placeholder { color: #555; }
        input:focus { border-color: #4a4a4a !important; outline: none; }
        .google-btn:hover  { background: #f0f0f0 !important; }
        .submit-btn:hover:not(:disabled) { background: #e8e8e8 !important; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
        @media (max-width: 700px) {
          .login-cols { flex-direction: column !important; }
          .login-left { padding: 2.5rem 1.5rem !important; flex: 1 !important; }
          .login-right { flex: 0 0 180px !important; }
        }
      `}</style>

      {/* ── Left column: form ───────────────────────────────────────────── */}
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
          animation: "fadeIn 0.5s ease both",
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

          {/* Form */}
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
              <p style={{ color: "#ff6b6b", fontSize: "0.82rem", marginTop: "0.6rem" }}>
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

          <p style={{ marginTop: "1.8rem", textAlign: "center", color: "#555", fontSize: "0.87rem" }}>
            ¿No tienes una cuenta?{" "}
            <Link to="/register" style={{ color: "#888", textDecoration: "underline", fontWeight: 500 }}>
              Regístrate
            </Link>
          </p>
        </div>
      </div>

      {/* ── Right column: brand ─────────────────────────────────────────── */}
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
          animation: "fadeIn 0.6s ease 0.1s both",
        }}
      >
        {/*
          LOGO: coloca aquí tu imagen real.
          Sustituye el componente <BrandLogo /> por:
            <img src="/logo.png" alt="No Emprendas Solo" style={{ width: "clamp(130px,16vw,200px)" }} />
          y pon tu archivo en: src/assets/logo.png  (o public/logo.png)
        */}
        <div style={{ width: "clamp(130px, 16vw, 200px)", aspectRatio: "1" }}>
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

// ─── Google icon ──────────────────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  )
}

// ─── Brand logo SVG (temporal — reemplaza con tu imagen real, ver comentario arriba)
function BrandLogo() {
  return (
    <svg viewBox="0 0 200 220" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }} aria-label="No Emprendas Solo">
      <circle cx="100" cy="26" r="16" fill="white" />
      <path d="M32 68 Q66 44 100 44 Q134 44 168 68" stroke="white" strokeWidth="20" strokeLinecap="round" fill="none"/>
      <path d="M40 74 Q28 118 30 160" stroke="white" strokeWidth="20" strokeLinecap="round" fill="none"/>
      <path d="M160 74 Q172 118 170 160" stroke="white" strokeWidth="20" strokeLinecap="round" fill="none"/>
      <path d="M100 62 Q100 120 100 165" stroke="white" strokeWidth="20" strokeLinecap="round" fill="none"/>
      <circle cx="30" cy="176" r="16" fill="white" />
      <circle cx="170" cy="176" r="16" fill="white" />
    </svg>
  )
}
