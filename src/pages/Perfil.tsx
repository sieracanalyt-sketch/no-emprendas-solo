import { useEffect, useRef, useState } from "react"
import { supabase } from "../supabase"
import { useNavigate, useLocation } from "react-router-dom"
import { checkProfile, MIN_BIO, type ProjectStatus } from "../lib/profileCompletion"
import { useUserTier } from "../hooks/useUserTier"
import AdvancedMatchProfile from "../components/AdvancedMatchProfile"
import UpgradeModal from "../components/UpgradeModal"
import PrestigeCard from "../components/PrestigeCard"

// ─── Gamification helpers ────────────────────────────────────────────────────

function getConnectionRank(n: number): string {
  if (n === 0) return "Fundador en solitario"
  if (n <= 2) return "Núcleo fundador"
  if (n <= 5) return "Equipo inicial"
  if (n <= 10) return "Equipo en expansión"
  return "Estudio consolidado"
}

const PROJECT_OPTIONS = [
  { value: "has_project", label: "Tengo un proyecto" },
  { value: "no_project",  label: "No tengo proyecto" },
  { value: "looking",     label: "Buscando proyecto" },
] as const

function FlameIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 17c.55 0 1.05-.18 1.46-.48C14.08 15.67 15 14 15 12c0-1.5-.5-2.7-1.18-3.82C12.93 7.05 12 6 12 6c0 0-.5 2-2 3.5C8.5 11 8.5 13 8.5 14.5Z" />
      <path d="M12 6c0 0 3 2.5 3 6 0 2.76-2.24 5-5 5" />
    </svg>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function Perfil() {
  const [perfil, setPerfil] = useState({ nombre: "", biografia: "", proyecto: "" })
  const [buscando, setBuscando] = useState<string[]>([])
  const [projectStatus, setProjectStatus] = useState<ProjectStatus>(null)
  const [inputTag, setInputTag] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [streakDays, setStreakDays] = useState(0)
  const [connectionCount, setConnectionCount] = useState(0)
  const [showMissing, setShowMissing] = useState(false)
  const [displayPct, setDisplayPct] = useState(0)
  const [userId, setUserId] = useState<string | null>(null)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  // Premium gate para el perfil avanzado (mismo criterio que Conexión Avanzada)
  const { tier, isAdmin, trialUntil } = useUserTier()
  const isPremium =
    isAdmin || tier === "premium" || (trialUntil ? trialUntil.getTime() > Date.now() : false)

  // Refs para scroll-to-field desde el drawer
  const sectionNombre   = useRef<HTMLDivElement>(null)
  const sectionBio      = useRef<HTMLDivElement>(null)
  const sectionProyecto = useRef<HTMLDivElement>(null)
  const sectionBuscando = useRef<HTMLDivElement>(null)

  const fieldRefs: Record<string, React.RefObject<HTMLDivElement | null>> = {
    nombre:    sectionNombre,
    biografia: sectionBio,
    proyecto:  sectionProyecto,
    buscando:  sectionBuscando,
  }

  // ── Carga inicial ─────────────────────────────────────────────────────────
  useEffect(() => {
    const cargarPerfil = async () => {
      try {
        // getSession() usa la caché local — más rápido y sin llamada de red
        const { data: { session } } = await supabase.auth.getSession()
        const user = session?.user
        if (!user) { setLoading(false); return }
        setUserId(user.id)

        const [{ data: profileData }, { data: sentMsgs }] = await Promise.all([
          supabase
            .from("users")
            .select("nombre, biografia, proyecto, buscando, project_status, streak_days")
            .eq("id", user.id)
            .single(),
          supabase
            .from("messages")
            .select("chat_id")
            .eq("from_uid", user.id)
            .limit(500),
        ])

        if (profileData) {
          const pd = profileData as Record<string, unknown>
          setPerfil({
            nombre:    (pd.nombre    as string) || "",
            biografia: (pd.biografia as string) || "",
            proyecto:  (pd.proyecto  as string) || "",
          })
          setBuscando((pd.buscando as string[]) || [])
          setProjectStatus((pd.project_status as ProjectStatus) || null)
          setStreakDays((pd.streak_days as number) || 0)
        }

        const uniqueChats = new Set(sentMsgs?.map((m: Record<string, unknown>) => m.chat_id) ?? [])
        setConnectionCount(uniqueChats.size)
      } finally {
        setLoading(false)
      }
    }
    cargarPerfil()
  }, [])

  // ── Scroll al campo indicado por el drawer ────────────────────────────────
  useEffect(() => {
    if (loading) return
    const focusField = (location.state as Record<string, unknown> | null)?.focusField as string | undefined
    if (focusField && fieldRefs[focusField]?.current) {
      setTimeout(() => {
        fieldRefs[focusField].current?.scrollIntoView({ behavior: "smooth", block: "center" })
      }, 180)
    }
  }, [loading]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Calcular completitud (necesario antes del segundo useEffect) ──────────
  const check = checkProfile({ ...perfil, buscando, project_status: projectStatus })
  const bioLen = perfil.biografia.trim().length

  const progressItems = [
    { key: "nombre",    label: "Nombre",               done: perfil.nombre.trim().length > 0 },
    { key: "biografia", label: `Biografía (${MIN_BIO}+ chars)`, done: bioLen >= MIN_BIO },
    { key: "proyecto",  label: "Proyecto",              done: check.items.find(i => i.key === "proyecto")?.ok ?? false },
    { key: "buscando",  label: "A quién buscas",        done: buscando.filter(t => t.trim()).length > 0 },
    { key: "conexion",  label: "Primera conexión",      done: connectionCount > 0 },
  ]
  const donePct = Math.round(progressItems.filter(i => i.done).length / progressItems.length * 100)
  const missingItems = progressItems.filter(i => !i.done)

  // ── Animar barra al montar ────────────────────────────────────────────────
  useEffect(() => {
    if (!loading) setTimeout(() => setDisplayPct(donePct), 60)
  }, [loading]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Guardar perfil ────────────────────────────────────────────────────────
  const guardarPerfil = async () => {
    if (saving) return
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) {
      alert("Tu sesión ha expirado. Recarga la página e inicia sesión de nuevo.")
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase.from("users").update({
        ...perfil,
        buscando,
        project_status: projectStatus,
      }).eq("id", user.id)
      if (error) throw error
      alert("Perfil actualizado")
    } catch {
      alert("Error al guardar el perfil. Inténtalo de nuevo.")
    } finally {
      setSaving(false)
    }
  }

  // ── Eliminar cuenta ───────────────────────────────────────────────────────
  const eliminarCuenta = async () => {
    const confirmed = window.confirm("¿Seguro que quieres eliminar tu cuenta? Esta acción no se puede deshacer.")
    if (!confirmed) return
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) return
      await supabase.from("users").delete().eq("id", user.id)
      await supabase.rpc("delete_user")
      navigate("/")
    } catch {
      alert("Error al eliminar la cuenta. Inténtalo de nuevo.")
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && inputTag.trim() !== "") {
      e.preventDefault()
      setBuscando([...buscando, inputTag.trim()])
      setInputTag("")
    }
  }

  const removeTag = (index: number) => {
    setBuscando(buscando.filter((_, i) => i !== index))
  }

  const handleMissingClick = (key: string) => {
    if (key === "conexion") { navigate("/explorar"); return }
    fieldRefs[key]?.current?.scrollIntoView({ behavior: "smooth", block: "center" })
  }

  if (loading)
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-[13px]" style={{ color: "var(--text-dim)" }}>Cargando…</p>
      </div>
    )

  return (
    <div className="max-w-2xl mx-auto px-5 py-10 animate-in">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <h1 className="text-[22px] font-semibold tracking-tight text-white">Tu perfil</h1>
        <p className="text-[13px] mt-1" style={{ color: "var(--text-dim)" }}>
          Actualiza tu información pública
        </p>
      </div>

      {/* ── Gamificación (≤ 80px excluyendo colapsable) ─────────────────── */}
      <div className="glass mb-6 rounded-2xl px-4 py-3">
        {/* Fila 1: barra de progreso + label */}
        <div className="flex items-center gap-3">
          <div
            className="flex-1 rounded-full overflow-hidden"
            style={{ height: 4, background: "rgba(255,255,255,0.06)" }}
          >
            <div
              className="profile-progress-fill rounded-full h-full"
              style={{ width: `${displayPct}%`, background: donePct === 100 ? "#4ade80" : "#5e6ad2" }}
            />
          </div>
          <span className="text-[11.5px] whitespace-nowrap shrink-0" style={{ color: "#8a8f98" }}>
            {donePct === 100 ? (
              <span className="flex items-center gap-1" style={{ color: "rgba(74,222,128,0.85)" }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                Perfil completo
              </span>
            ) : `Perfil ${donePct}% completo`}
          </span>
        </div>

        {/* Fila 2: racha + rango */}
        <div className="flex items-center justify-between mt-2">
          <div>
            {streakDays >= 2 && (
              <span
                className="flex items-center gap-1.5 text-[12px]"
                style={{ color: "#8a8f98" }}
                title="Días consecutivos con actividad en NES."
              >
                <FlameIcon />
                {streakDays} días activo
              </span>
            )}
          </div>
          <span
            className="text-[12px] px-2 py-0.5"
            style={{ color: "#8a8f98", border: "1px solid var(--border-strong)", borderRadius: 999, padding: "2px 10px" }}
            title="Tu rango refleja el número de conexiones activas en NES."
          >
            {getConnectionRank(connectionCount)}
          </span>
        </div>

        {/* Colapsable "Qué falta" */}
        {missingItems.length > 0 && (
          <div className="mt-2.5">
            <button
              onClick={() => setShowMissing(v => !v)}
              className="flex items-center gap-1 text-[11.5px] transition-colors"
              style={{ color: showMissing ? "var(--text-dim)" : "#62666d", background: "none", border: "none", cursor: "pointer" }}
            >
              <svg
                width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ transform: showMissing ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }}
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
              Qué falta
            </button>
            {showMissing && (
              <div className="mt-2 flex flex-col gap-1.5">
                {missingItems.map(item => (
                  <button
                    key={item.key}
                    onClick={() => handleMissingClick(item.key)}
                    className="text-left text-[12px] flex items-center gap-1.5 transition-colors group"
                    style={{ color: "#62666d", background: "none", border: "none", cursor: "pointer" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "var(--text-dim)")}
                    onMouseLeave={e => (e.currentTarget.style.color = "#62666d")}
                  >
                    <span style={{ color: "rgba(249,115,22,0.6)" }}>·</span>
                    {item.label}
                    {item.key === "conexion" && (
                      <span className="text-[10.5px]" style={{ color: "#5e6ad2" }}>→ NES Connect</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Prestigio por aportar (cron diario) ─────────────────────────── */}
      {userId && (
        <div className="my-5">
          <PrestigeCard userId={userId} />
        </div>
      )}

      {/* ── Formulario ──────────────────────────────────────────────────── */}
      <div className="glass rounded-3xl p-6 space-y-5">
        {/* Nombre */}
        <div ref={sectionNombre} id="field-nombre">
          <Field label="Nombre">
            <input
              value={perfil.nombre}
              onChange={(e) => { const v = e.target.value; setPerfil(prev => ({ ...prev, nombre: v })) }}
              className="field-input w-full px-3.5 py-2 rounded-md text-[14px]"
            />
          </Field>
        </div>

        {/* Biografía */}
        <div ref={sectionBio} id="field-bio">
          <Field label="Biografía">
            <textarea
              value={perfil.biografia}
              onChange={(e) => { const v = e.target.value; setPerfil(prev => ({ ...prev, biografia: v })) }}
              rows={4}
              className="field-input w-full px-3.5 py-2.5 rounded-md text-[14px] resize-none leading-relaxed"
            />
            <div className="flex justify-between items-center mt-1.5">
              <span className="text-[11px]" style={{ color: "var(--text-dimmer)" }}>
                {bioLen >= MIN_BIO ? "¡Perfecto!" : `Te faltan ${MIN_BIO - bioLen} caracteres`}
              </span>
              <span
                className="text-[11px] font-medium"
                style={{ color: bioLen >= MIN_BIO ? "#7ee2b8" : "var(--text-dim)" }}
              >
                {bioLen}/{MIN_BIO}
              </span>
            </div>
          </Field>
        </div>

        {/* Proyecto */}
        <div ref={sectionProyecto} id="field-proyecto">
          <Field label="Proyecto">
            {/* Toggle de 3 opciones */}
            <div className="flex gap-2">
              {PROJECT_OPTIONS.map(opt => {
                const active = projectStatus === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setProjectStatus(active ? null : opt.value as ProjectStatus)}
                    className="flex-1 py-2 px-2 rounded-xl text-[12.5px] font-medium transition-all text-center"
                    style={{
                      background: active ? "rgba(94,106,210,0.15)" : "var(--surface-3)",
                      border: `1px solid ${active ? "#6366f1" : "var(--border)"}`,
                      color: active ? "#f7f8f8" : "#8a8f98",
                    }}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>

            {/* Expansión animada para "Tengo un proyecto" */}
            <div
              className="project-expand overflow-hidden"
              style={{ maxHeight: projectStatus === "has_project" ? "160px" : "0" }}
            >
              <div className="mt-3">
                <textarea
                  value={perfil.proyecto}
                  onChange={(e) => { const v = e.target.value; setPerfil(prev => ({ ...prev, proyecto: v })) }}
                  rows={3}
                  placeholder="Describe brevemente tu proyecto…"
                  tabIndex={projectStatus === "has_project" ? 0 : -1}
                  aria-hidden={projectStatus === "has_project" ? undefined : true}
                  className="field-input w-full px-3.5 py-2.5 rounded-md text-[14px] resize-none leading-relaxed"
                />
              </div>
            </div>
          </Field>
        </div>

        {/* Tipo de persona */}
        <div ref={sectionBuscando} id="field-buscando">
          <Field label="Tipo de persona que buscas">
            {buscando.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2.5">
                {buscando.map((tag, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium text-white"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    <span>{tag}</span>
                    <button
                      onClick={() => removeTag(i)}
                      className="leading-none transition-colors"
                      style={{ color: "var(--text-dim)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-dim)")}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <input
              value={inputTag}
              onChange={(e) => setInputTag(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe y pulsa Enter…"
              className="field-input w-full px-3.5 py-2 rounded-md text-[14px]"
            />
          </Field>
        </div>
      </div>

      {/* ── Guardar ──────────────────────────────────────────────────────── */}
      <div className="mt-5 flex justify-end">
        <button
          onClick={guardarPerfil}
          disabled={saving}
          className="px-5 py-2 bg-white text-black text-[13px] font-semibold rounded-full hover:bg-white/90 transition disabled:opacity-50"
          style={{ boxShadow: "0 8px 24px rgba(255,255,255,0.12)" }}
        >
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>

      {/* ── Perfil avanzado (premium): los 9 campos del matchmaking ─────── */}
      <section className="glass rounded-3xl p-6 mt-8">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-[17px] font-semibold tracking-tight text-white">Perfil avanzado</h2>
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
            style={{ background: "rgba(94,106,210,0.15)", color: "var(--accent)", border: "1px solid rgba(94,106,210,0.35)" }}
          >
            Premium
          </span>
        </div>
        <p className="text-[13px] mt-1 mb-6" style={{ color: "var(--text-dim)" }}>
          9 preguntas rápidas de conducta real. Alimentan el Matchmaking Avanzado: cuanto más
          honesto respondas, mejores conexiones te propondrá MERGE.
        </p>

        {isPremium && userId ? (
          <AdvancedMatchProfile userId={userId} />
        ) : (
          <div
            className="rounded-2xl p-7 text-center"
            style={{ border: "1px dashed rgba(94,106,210,0.4)", background: "rgba(94,106,210,0.05)" }}
          >
            <div className="text-2xl">🔒</div>
            <p className="mt-2 text-[14px] font-medium" style={{ color: "var(--text)" }}>
              El perfil avanzado es una función Premium
            </p>
            <p className="mx-auto mt-1 max-w-sm text-[13px]" style={{ color: "var(--text-dim)" }}>
              Desbloquéalo para que la IA cruce tu perfil con toda la red y te proponga
              tus mejores co-fundadores.
            </p>
            <button
              onClick={() => setShowUpgrade(true)}
              className="btn-linear mt-4 rounded-full px-5 py-2 text-[13px] font-medium"
            >
              Ver Premium
            </button>
            <UpgradeModal feature="matching_advanced" open={showUpgrade} onClose={() => setShowUpgrade(false)} />
          </div>
        )}
      </section>

      {/* ── Separador ────────────────────────────────────────────────────── */}
      <div className="my-7" style={{ height: "1px", background: "var(--border)" }} />

      {/* ── Zona de peligro ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[14px] font-medium" style={{ color: "var(--text-dim)" }}>
            Eliminar cuenta
          </p>
          <p className="text-[12px] mt-0.5" style={{ color: "var(--text-dimmer)" }}>
            Esta acción es permanente. Todos tus datos serán borrados.
          </p>
        </div>
        <button
          onClick={eliminarCuenta}
          className="shrink-0 text-[13px] font-medium transition-colors"
          style={{ color: "rgba(239,68,68,0.8)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "rgb(239,68,68)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(239,68,68,0.8)")}
        >
          Eliminar mi cuenta
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        className="block text-[11px] font-medium uppercase tracking-wider mb-1.5"
        style={{ color: "var(--text-dimmer)" }}
      >
        {label}
      </label>
      {children}
    </div>
  )
}
