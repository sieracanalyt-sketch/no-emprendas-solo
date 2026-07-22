import { useState } from "react"
import { useNavigate, Navigate, Link } from "react-router-dom"
import { supabase } from "../supabase"
import { useUser } from "../hooks/useUser"
import AuthLayout, { GoogleIcon, EyeIcon } from "../components/AuthLayout"

export default function Register() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [user, loadingUser] = useUser()
  const navigate = useNavigate()

  if (!loadingUser && user) return <Navigate to="/explorar" replace />

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.")
      return
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.")
      return
    }

    setLoading(true)
    try {
      const { error: err } = await supabase.auth.signUp({ email, password })
      if (err) throw err
      navigate("/explorar")
    } catch {
      setError("Error al registrarte. Puede que el correo ya esté en uso.")
    } finally {
      setLoading(false)
    }
  }

  const registerGoogle = async () => {
    try {
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/explorar` },
      })
      if (err) throw err
    } catch {
      setError("Error al registrarte con Google.")
    }
  }

  return (
    <AuthLayout>
      <h1 style={{ color: "#fff", fontSize: "clamp(1.6rem, 2.4vw, 2rem)", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.15, margin: 0 }}>
        Crea tu cuenta
      </h1>
      <p style={{ marginTop: "0.6rem", color: "var(--text-dim)", fontSize: "0.9rem" }}>
        ¿Ya tienes una cuenta?{" "}
        <Link to="/login" style={{ color: "#9aa4f0", fontWeight: 500 }}>Inicia sesión</Link>
      </p>

      <button className="auth-google" onClick={registerGoogle} style={{ marginTop: "1.8rem" }}>
        <GoogleIcon />
        Registrarse con Google
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
            placeholder="Contraseña (mín. 6 caracteres)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
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
        <input
          type={showPw ? "text" : "password"}
          className="auth-input"
          placeholder="Confirma tu contraseña"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          autoComplete="new-password"
        />

        {error && <p style={{ color: "#f8817b", fontSize: "0.82rem", margin: "0.2rem 0 0" }}>{error}</p>}

        <button type="submit" className="auth-submit" disabled={loading} style={{ marginTop: "0.6rem" }}>
          {loading ? "Creando cuenta…" : "Crear cuenta"}
        </button>
      </form>
    </AuthLayout>
  )
}
