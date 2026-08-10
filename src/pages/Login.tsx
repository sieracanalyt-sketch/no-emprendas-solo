import { useState } from "react"
import { useNavigate, useSearchParams, Navigate, Link } from "react-router-dom"
import { supabase } from "../supabase"
import { useUser } from "../hooks/useUser"
import AuthLayout, { GoogleIcon, EyeIcon } from "../components/AuthLayout"

export default function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [searchParams] = useSearchParams()
  const [user, loadingUser] = useUser()
  const navigate = useNavigate()

  // Ya hay sesión (p. ej. vuelves a "/" con el navegador): directo a la app.
  if (!loadingUser && user) return <Navigate to="/explorar" replace />

  // RequireAuth nos reenvía aquí con ?authError cuando el OAuth vuelve sin
  // sesión — típicamente porque se cerró el selector de cuentas de Google.
  const authError = searchParams.get("authError")
  const oauthMessage =
    authError === "access_denied"
      ? "Has cancelado el acceso con Google. Elige una cuenta para continuar."
      : authError
        ? "No se pudo completar el acceso con Google. Inténtalo de nuevo."
        : ""

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
    <AuthLayout>
      <h1 style={{ color: "var(--t1)", fontSize: "clamp(1.6rem, 2.4vw, 2rem)", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.15, margin: 0 }}>
        Bienvenido de nuevo
      </h1>
      <p style={{ marginTop: "0.6rem", color: "var(--text-dim)", fontSize: "0.9rem" }}>
        ¿No tienes una cuenta?{" "}
        <Link to="/register" style={{ color: "var(--link)", fontWeight: 500 }}>Regístrate</Link>
      </p>

      {oauthMessage && (
        <p
          style={{
            marginTop: "1.2rem",
            padding: "0.7rem 0.9rem",
            borderRadius: "10px",
            background: "rgba(248,129,123,0.10)",
            border: "1px solid rgba(248,129,123,0.28)",
            color: "#f8817b",
            fontSize: "0.82rem",
            lineHeight: 1.45,
          }}
        >
          {oauthMessage}
        </p>
      )}

      <button className="auth-google" onClick={loginGoogle} style={{ marginTop: "1.8rem" }}>
        <GoogleIcon />
        Continuar con Google
      </button>

      <div className="auth-divider" style={{ margin: "1.5rem 0" }}>
        <span>o con tu correo</span>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <input
          type="email"
          className="auth-input"
          placeholder="Correo electrónico"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <div className="auth-field">
          <input
            type={showPw ? "text" : "password"}
            className="auth-input"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            style={{ paddingRight: "3rem" }}
          />
          <button
            type="button"
            className="auth-eye"
            onClick={() => setShowPw((s) => !s)}
            aria-label={showPw ? "Ocultar contraseña" : "Mostrar contraseña"}
            tabIndex={-1}
          >
            <EyeIcon off={showPw} />
          </button>
        </div>

        {error && <p style={{ color: "#f8817b", fontSize: "0.82rem", margin: "0.2rem 0 0" }}>{error}</p>}

        <button type="submit" className="auth-submit" disabled={loading} style={{ marginTop: "0.6rem" }}>
          {loading ? "Entrando…" : "Iniciar sesión"}
        </button>
      </form>
    </AuthLayout>
  )
}
