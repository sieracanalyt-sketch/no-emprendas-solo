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

      <WaitlistSection />
      <InvitesSection />
      <FlagsSection />
      <UsersSection />
    </div>
  )
}

// ── Apertura de cohorte desde la lista de espera ──────────────────────────────
type InvitePreview = { queue: number | null; email: string }

/**
 * Manda a los N primeros de la lista de espera (por orden de confirmación) su
 * código personal de un solo uso. Todo el trabajo lo hace la Edge Function
 * waitlist-mailer: aquí no se toca ni la tabla `waitlist` ni `invite_codes`,
 * porque los emails de la lista no son legibles desde el cliente.
 */
function WaitlistSection() {
  const [limit, setLimit] = useState("15")
  const [preview, setPreview] = useState<InvitePreview[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState("")

  const call = async (dryRun: boolean) => {
    setBusy(true)
    setMsg("")
    try {
      const { data, error } = await supabase.functions.invoke("waitlist-mailer", {
        body: { action: "invite", limit: Number(limit) || 15, dryRun },
      })
      if (error || !data?.ok) {
        setMsg("No se pudo completar. Revisa que RESEND_API_KEY esté configurada.")
        return
      }
      if (dryRun) {
        setPreview(data.preview as InvitePreview[])
        setMsg(`${data.wouldInvite} personas recibirían su código.`)
      } else {
        setPreview(null)
        const failed = (data.failed as string[]) ?? []
        setMsg(
          `Enviados ${data.invited} códigos.` +
            (failed.length ? ` Fallaron ${failed.length}: ${failed.join(", ")}` : "")
        )
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mt-8">
      <h2 className="text-sm font-medium" style={{ color: "var(--text)" }}>
        Abrir cohorte
      </h2>
      <p className="mt-0.5 text-xs" style={{ color: "var(--text-dimmer)" }}>
        Genera un código de un solo uso para cada persona de la lista de espera y
        se lo manda por email con el enlace de acceso. Va por orden de llegada y
        salta a quien ya fue invitado o se dio de baja. Comprueba antes con
        «Ver a quién», que no envía nada.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="number"
          min={1}
          max={500}
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
          className="field-input rounded-full px-4 py-2 text-sm"
          style={{ width: 96 }}
          aria-label="Cuántas personas invitar"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => call(true)}
          className="rounded-full px-4 py-2 text-sm"
          style={{ background: "rgba(var(--overlay-rgb), 0.08)", color: "var(--text)" }}
        >
          Ver a quién
        </button>
        <button
          type="button"
          disabled={busy || !preview}
          onClick={() => {
            if (confirm(`Se van a enviar ${preview?.length ?? 0} códigos. Esto no se puede deshacer.`))
              void call(false)
          }}
          className="rounded-full px-4 py-2 text-sm font-medium"
          style={{
            background: !preview || busy ? "rgba(var(--overlay-rgb), 0.08)" : "#00ff7f",
            color: !preview || busy ? "var(--text-dimmer)" : "#04120a",
          }}
          title={preview ? "" : "Primero pulsa «Ver a quién»"}
        >
          Enviar códigos
        </button>
      </div>

      {msg && (
        <p className="mt-2 text-xs" style={{ color: "var(--text-dim)" }}>
          {msg}
        </p>
      )}

      {preview && preview.length > 0 && (
        <ul className="mt-2 max-h-48 overflow-y-auto text-xs" style={{ color: "var(--text-dimmer)" }}>
          {preview.map((p) => (
            <li key={p.email}>
              #{p.queue ?? "—"} · {p.email}
            </li>
          ))}
        </ul>
      )}
    </section>
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
                  background: f.active ? "#c2542f" : "rgba(var(--overlay-rgb), 0.10)",
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

// ── Invitaciones de cohorte ─────────────────────────────────────────────────────
type InviteCode = {
  code: string
  note: string | null
  created_at: string
  used_by: string | null
  used_at: string | null
  max_uses: number
  uses_count: number
  users: { nombre: string; email: string | null } | null
}

function InvitesSection() {
  const [codes, setCodes] = useState<InviteCode[]>([])
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState("")
  // Texto (no number) para poder borrar el campo sin que salte a 0 mientras
  // escribes; se valida al enviar.
  const [maxUses, setMaxUses] = useState("1")
  const [creating, setCreating] = useState(false)
  const [justCreated, setJustCreated] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke("admin-generate-invite", { method: "GET" })
    if (!error && data?.ok) setCodes(data.codes as InviteCode[])
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const generate = async (e: React.FormEvent) => {
    e.preventDefault()
    const uses = Math.trunc(Number(maxUses))
    if (!Number.isFinite(uses) || uses < 1 || uses > 1000) {
      setError("El número de usos debe estar entre 1 y 1000.")
      return
    }
    setCreating(true)
    setError(null)
    setJustCreated(null)
    const { data, error } = await supabase.functions.invoke("admin-generate-invite", {
      body: { note: note.trim() || undefined, max_uses: uses },
    })
    if (error || !data?.ok) {
      setError("No se pudo generar el código.")
    } else {
      setJustCreated(data.code as string)
      setNote("")
      setMaxUses("1")
      await refresh()
    }
    setCreating(false)
  }

  const copy = (code: string) => {
    navigator.clipboard?.writeText(code).catch(() => {})
  }

  return (
    <section className="mt-8">
      <h2 className="text-sm font-medium" style={{ color: "var(--text)" }}>
        Invitaciones de cohorte
      </h2>
      <p className="mt-0.5 text-xs" style={{ color: "var(--text-dimmer)" }}>
        Elige cuántas personas pueden canjear el código: 1 para una invitación
        individual, o 15 para mandar el mismo código a todo un grupo. Cada persona
        solo puede gastar un uso.
      </p>

      <form onSubmit={generate} className="mt-3 flex flex-wrap gap-2">
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Nota (nombre o email de la persona, opcional)"
          className="field-input min-w-[12rem] flex-1 rounded-full px-4 py-2 text-sm"
        />
        <input
          type="number"
          min={1}
          max={1000}
          value={maxUses}
          onChange={(e) => setMaxUses(e.target.value)}
          className="field-input rounded-full px-4 py-2 text-sm"
          style={{ width: 96 }}
          title="Número de personas que pueden usar este código"
          aria-label="Número de usos"
        />
        <button
          type="submit"
          disabled={creating}
          className="rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-40"
          style={{
            background: "linear-gradient(180deg,#d97c50,#a34420)",
            color: "var(--on-accent)",
            border: "1px solid rgba(var(--overlay-rgb), 0.16)",
            boxShadow: "0 6px 18px rgba(194, 84, 47,0.32), inset 0 1px 0 rgba(var(--overlay-rgb), 0.22)",
          }}
        >
          {creating ? "Generando…" : "Generar código"}
        </button>
      </form>

      {justCreated && (
        <div
          className="row-card mt-3 flex items-center justify-between rounded-xl p-3.5"
          style={{ background: "rgba(194, 84, 47,0.12)", border: "1px solid rgba(194, 84, 47,0.3)" }}
        >
          <span className="font-mono text-sm" style={{ color: "var(--t1)" }}>{justCreated}</span>
          <button
            onClick={() => copy(justCreated)}
            className="text-xs font-medium"
            style={{ color: "var(--accent)" }}
          >
            Copiar
          </button>
        </div>
      )}

      {error && (
        <p className="mt-2 text-xs" style={{ color: "#f87171" }}>{error}</p>
      )}

      <div className="mt-4 flex flex-col gap-2">
        {loading && (
          <p className="text-xs" style={{ color: "var(--text-dim)" }}>Cargando códigos…</p>
        )}
        {!loading && codes.length === 0 && (
          <p className="text-xs" style={{ color: "var(--text-dim)" }}>Todavía no has generado ningún código.</p>
        )}
        {codes.map((c) => {
          const agotado = c.uses_count >= c.max_uses
          return (
            <div key={c.code} className="row-card flex items-center gap-3 rounded-xl p-3.5">
              <span className="font-mono text-sm" style={{ color: "var(--text)" }}>{c.code}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs" style={{ color: "var(--text-dim)" }}>
                  {c.note || "sin nota"}
                </p>
                {c.used_by && (
                  <p className="truncate text-[11px]" style={{ color: "var(--text-dimmer)" }}>
                    primer canje: {c.users?.nombre ?? c.used_by}
                  </p>
                )}
              </div>
              <button
                onClick={() => copy(c.code)}
                className="shrink-0 text-xs font-medium"
                style={{ color: "var(--accent)" }}
              >
                Copiar
              </button>
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
                style={{
                  background: agotado ? "rgba(var(--overlay-rgb), 0.06)" : "rgba(74,222,128,0.14)",
                  color: agotado ? "var(--text-dim)" : "#9a9d78",
                }}
              >
                {agotado ? `agotado · ${c.uses_count}/${c.max_uses}` : `${c.uses_count}/${c.max_uses} usos`}
              </span>
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

  // Vía edge function: users.email ya no es legible desde el cliente (se revocó
  // la columna al descubrir que la anon key permitía descargar los correos de
  // toda la comunidad). El service role de la función es el único que los ve.
  const refresh = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke("admin-list-users", { method: "GET" })
    if (!error && data?.ok) setUsers(data.users as UserRow[])
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
                    style={{ background: "rgba(194, 84, 47,0.16)", color: "var(--accent)" }}
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
                background: u.tier === "premium" ? "rgba(194, 84, 47,0.16)" : "rgba(var(--overlay-rgb), 0.06)",
                color: u.tier === "premium" ? "#d97c50" : "var(--text-dim)",
              }}
            >
              {u.tier}
            </span>
            <select
              value={u.tier}
              disabled={busy === u.id}
              onChange={(e) => setTier(u, e.target.value as Tier)}
              className="field-input rounded-lg px-2 py-1 text-xs disabled:opacity-40"
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
