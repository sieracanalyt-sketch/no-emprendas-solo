import { useEffect, useState, type ReactNode } from "react"
import { supabase } from "../supabase"

// Cohorte cerrada: tras el primer login (email o Google, da igual) se
// comprueba users.cohort_approved. Si no está aprobado, se bloquea la app
// entera con esta pantalla hasta que se canjee un código válido — una vez
// aprobado se guarda en la fila del usuario y no se vuelve a pedir nunca más
// (ni en este dispositivo ni en otros, porque vive en la base de datos).
type Status = "checking" | "no-user" | "approved" | "gated"

const INVITE_KEY = "nes:pendingInvite"

/**
 * El email de apertura de cohorte enlaza a /login?invite=XXXX-XXXX. Entre esa
 * URL y la pantalla que pide el código hay un login por medio (y en el caso de
 * Google, un viaje a otro dominio), así que la query string se pierde. Se
 * captura aquí, en el arranque del módulo —CohortGate envuelve la app entera,
 * de modo que esto corre antes que cualquier navegación— y se guarda en
 * sessionStorage hasta que la pantalla del código lo consuma.
 */
function captureInviteFromUrl(): void {
  try {
    const params = new URLSearchParams(window.location.search)
    const code = (params.get("invite") ?? "").trim().toUpperCase()
    if (!code) return
    sessionStorage.setItem(INVITE_KEY, code)
    params.delete("invite")
    const qs = params.toString()
    window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""))
  } catch {
    // sessionStorage bloqueado (modo privado estricto): se teclea a mano.
  }
}

/** Devuelve el código capturado y lo borra: es de un solo uso. */
function takeStoredInvite(): string {
  try {
    const code = sessionStorage.getItem(INVITE_KEY) ?? ""
    if (code) sessionStorage.removeItem(INVITE_KEY)
    return code
  } catch {
    return ""
  }
}

captureInviteFromUrl()

export default function CohortGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("checking")

  useEffect(() => {
    let cancelled = false

    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        if (!cancelled) setStatus("no-user")
        return
      }
      const { data } = await supabase
        .from("users")
        .select("cohort_approved, is_admin")
        .eq("id", session.user.id)
        .maybeSingle()
      if (cancelled) return
      // Los admins nunca quedan bloqueados: si no, quien gestiona la cohorte
      // (generar códigos en /admin) podría quedarse fuera de su propia app.
      setStatus(data?.cohort_approved || data?.is_admin ? "approved" : "gated")
    }

    check()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      // setTimeout: igual que en App.tsx, evita bloquear el lock de auth del SDK
      setTimeout(check, 0)
    })
    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  if (status === "no-user" || status === "approved") return <>{children}</>
  if (status === "checking") return null
  return <InviteScreen onApproved={() => setStatus("approved")} />
}

function InviteScreen({ onApproved }: { onApproved: () => void }) {
  const [code, setCode] = useState(takeStoredInvite)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return
    setLoading(true)
    setError("")
    try {
      const { data, error: err } = await supabase.functions.invoke("redeem-invite", {
        body: { code: code.trim() },
      })
      if (err || !data?.ok) {
        setError(
          data?.error === "exhausted"
            ? "Este código ya ha alcanzado su número máximo de usos."
            : "Código incorrecto. Revisa el correo que te enviamos."
        )
        return
      }
      onApproved()
    } catch {
      setError("Error de conexión. Inténtalo de nuevo.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0c0d0e",
        fontFamily: "'Inter','Segoe UI',system-ui,sans-serif",
        padding: "1.5rem",
        zIndex: 10000,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          padding: "2.25rem 2rem",
          borderRadius: "16px",
          background: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
          WebkitBackdropFilter: "blur(24px) saturate(1.3)",
          backdropFilter: "blur(24px) saturate(1.3)",
          border: "1px solid var(--glass-border)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
          textAlign: "center",
          animation: "fadeIn 0.4s ease both",
        }}
      >
        <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>🔒</div>
        <h1 style={{ color: "#fff", fontSize: "1.3rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
          Acceso por cohorte
        </h1>
        <p style={{ color: "var(--text-dim)", fontSize: "0.88rem", marginTop: "0.6rem", lineHeight: 1.5 }}>
          No Emprendas Solo está en fase cerrada. Introduce el código que te
          hemos enviado por correo para entrar.
        </p>

        <form onSubmit={submit} style={{ marginTop: "1.5rem" }}>
          <input
            type="text"
            placeholder="XXXX-XXXX"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            autoFocus
            style={{
              width: "100%",
              padding: "0.85rem 1rem",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid var(--border-strong)",
              borderRadius: "12px",
              color: "var(--text)",
              fontSize: "1rem",
              letterSpacing: "0.08em",
              textAlign: "center",
              outline: "none",
            }}
          />
          {error && (
            <p style={{ color: "#ff6b6b", fontSize: "0.82rem", marginTop: "0.7rem" }}>{error}</p>
          )}
          <button
            type="submit"
            disabled={loading || !code.trim()}
            style={{
              width: "100%",
              padding: "0.85rem",
              marginTop: "1.1rem",
              background: loading || !code.trim() ? "rgba(255,255,255,0.08)" : "#fff",
              color: loading || !code.trim() ? "var(--text-dimmer)" : "#111",
              border: "none",
              borderRadius: "10px",
              fontSize: "0.92rem",
              fontWeight: 600,
              cursor: loading || !code.trim() ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Comprobando…" : "Entrar"}
          </button>
        </form>

        <button
          onClick={() => supabase.auth.signOut()}
          style={{
            marginTop: "1.25rem",
            background: "none",
            border: "none",
            color: "var(--text-dimmer)",
            fontSize: "0.8rem",
            textDecoration: "underline",
            cursor: "pointer",
          }}
        >
          Cerrar sesión y probar con otra cuenta
        </button>
      </div>
    </div>
  )
}
