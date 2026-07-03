import { useCallback, useEffect, useState } from "react"
import { Navigate } from "react-router-dom"
import { supabase } from "../supabase"
import { useUserTier } from "../hooks/useUserTier"
import { useFeatureFlags } from "../hooks/useFeatureAccess"
import { FEATURE_INFO, type Tier } from "../lib/premium"

// ──────────────────────────────────────────────────────────────────────────────
// Panel de administración (solo users.is_admin). Dos zonas:
//   1. Feature flags → Edge Function admin-feature-flags (toggle sin redeploy).
//   2. Tier por usuario → Edge Function subscription-changed (stub webhook).
// Los cambios llegan por realtime a todas las pestañas abiertas.
// ──────────────────────────────────────────────────────────────────────────────

type UserRow = {
  id: string
  nombre: string
  email: string | null
  avatar: string | null
  tier: Tier
  is_admin: boolean
}

export default function Admin() {
  const { isAdmin, loading } = useUserTier()

  if (!loading && !isAdmin) return <Navigate to="/explorar" replace />
  if (loading) {
    return (
      <div className="flex justify-center pt-24 text-sm" style={{ color: "var(--text-dim)" }}>
        Cargando…
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8 animate-in">
      <h1 className="text-xl font-semibold" style={{ color: "var(--text)" }}>
        Administración
      </h1>
      <p className="mt-1 text-sm" style={{ color: "var(--text-dim)" }}>
        Feature flags y tiers. Los cambios se propagan en vivo a todos los usuarios.
      </p>

      <FlagsSection />
      <UsersSection />
    </div>
  )
}

// ── Feature flags ─────────────────────────────────────────────────────────────
function FlagsSection() {
  const { flags, loading } = useFeatureFlags()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const toggle = async (feature: string, active: boolean) => {
    setBusy(feature)
    setError(null)
    const { data, error } = await supabase.functions.invoke("admin-feature-flags", {
      body: { feature, active },
    })
    if (error || data?.error) setError(`No se pudo actualizar «${feature}»`)
    setBusy(null)
    // El refresco llega solo por realtime (useFeatureFlags)
  }

  return (
    <section className="mt-8">
      <h2 className="text-sm font-medium" style={{ color: "var(--text)" }}>
        Feature flags
      </h2>
      <p className="mt-0.5 text-xs" style={{ color: "var(--text-dimmer)" }}>
        Flag activo = la feature queda bloqueada para usuarios free (los admins siempre la ven).
      </p>
      {error && (
        <p className="mt-2 text-xs" style={{ color: "#f87171" }}>
          {error}
        </p>
      )}
      <div className="mt-3 flex flex-col gap-2">
        {loading && (
          <p className="text-xs" style={{ color: "var(--text-dim)" }}>
            Cargando flags…
          </p>
        )}
        {flags.map((f) => {
          const info = FEATURE_INFO[f.feature]
          return (
            <div key={f.feature} className="row-card flex items-center gap-3 rounded-xl p-3.5">
              <span className="text-lg">{info?.emoji ?? "🚩"}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium" style={{ color: "var(--text)" }}>
                  {info?.nombre ?? f.feature}
                  <span className="ml-2 font-mono text-[10px]" style={{ color: "var(--text-dimmer)" }}>
                    {f.feature} · min: {f.min_tier}
                  </span>
                </p>
                <p className="truncate text-xs" style={{ color: "var(--text-dim)" }}>
                  {info?.descripcion}
                </p>
              </div>
              <button
                onClick={() => toggle(f.feature, !f.active)}
                disabled={busy === f.feature}
                className="relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-40"
                style={{
                  background: f.active ? "#5e6ad2" : "rgba(255,255,255,0.10)",
                  border: "1px solid var(--border-strong)",
                }}
                title={f.active ? "Desactivar (todos ven la feature)" : "Activar (solo premium)"}
                aria-label={`Flag ${f.feature}`}
              >
                <span
                  className="absolute top-0.5 rounded-full bg-white transition-all"
                  style={{ left: f.active ? "calc(100% - 20px)" : "2px", width: 18, height: 18 }}
                />
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ── Usuarios y tiers ──────────────────────────────────────────────────────────
function UsersSection() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from("users")
      .select("id, nombre, email, avatar, tier, is_admin")
      .order("nombre")
    setUsers((data as UserRow[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
    // Sufijo único: si se remonta la página, un topic repetido devolvería la
    // instancia vieja del canal y .on() lanzaría (ver useUserTier).
    const channel = supabase
      .channel(`admin-users:${Date.now()}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "users" }, () => refresh())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [refresh])

  const setTier = async (user: UserRow, tier: Tier) => {
    if (tier === user.tier) return
    setBusy(user.id)
    setError(null)
    const { data, error } = await supabase.functions.invoke("subscription-changed", {
      body: {
        user_id: user.id,
        new_tier: tier,
        event_type: tier === "premium" ? "upgrade" : "downgrade",
      },
    })
    if (error || data?.error) setError(`No se pudo cambiar el tier de ${user.nombre}`)
    setBusy(null)
  }

  return (
    <section className="mt-10">
      <h2 className="text-sm font-medium" style={{ color: "var(--text)" }}>
        Usuarios
      </h2>
      <p className="mt-0.5 text-xs" style={{ color: "var(--text-dimmer)" }}>
        Cambiar el tier crea/actualiza su subscription (vía el stub del webhook).
      </p>
      {error && (
        <p className="mt-2 text-xs" style={{ color: "#f87171" }}>
          {error}
        </p>
      )}
      <div className="mt-3 flex flex-col gap-2">
        {loading && (
          <p className="text-xs" style={{ color: "var(--text-dim)" }}>
            Cargando usuarios…
          </p>
        )}
        {users.map((u) => (
          <div key={u.id} className="row-card flex items-center gap-3 rounded-xl p-3.5">
            {u.avatar ? (
              <img src={u.avatar} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
            ) : (
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                style={{ background: "var(--surface-3)", color: "var(--text-dim)" }}
              >
                {(u.nombre || "?").slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium" style={{ color: "var(--text)" }}>
                {u.nombre}
                {u.is_admin && (
                  <span
                    className="ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                    style={{ background: "rgba(94,106,210,0.16)", color: "#9aa4f0" }}
                  >
                    admin
                  </span>
                )}
              </p>
              <p className="truncate text-xs" style={{ color: "var(--text-dimmer)" }}>
                {u.email}
              </p>
            </div>
            <span
              className="rounded-full px-2 py-0.5 text-[11px] font-medium"
              style={{
                background: u.tier === "premium" ? "rgba(94,106,210,0.16)" : "rgba(255,255,255,0.06)",
                color: u.tier === "premium" ? "#9aa4f0" : "var(--text-dim)",
              }}
            >
              {u.tier}
            </span>
            <select
              value={u.tier}
              disabled={busy === u.id}
              onChange={(e) => setTier(u, e.target.value as Tier)}
              className="field-input rounded-md px-2 py-1 text-xs disabled:opacity-40"
              style={{ width: 96 }}
            >
              <option value="free">free</option>
              <option value="premium">premium</option>
            </select>
          </div>
        ))}
      </div>
    </section>
  )
}
