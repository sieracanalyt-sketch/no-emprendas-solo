import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { supabase } from "../supabase"
import { useUser } from "../hooks/useUser"
import { useNavigate } from "react-router-dom"
import {
  computeMatch, isStrongMatch, INACTIVITY_DAYS,
  type MatchProfile, type MatchResult,
} from "../lib/matchmaking"
import { getIgnored, ignoreUser, ignoredCount } from "../lib/connectStore"
import { checkProfile, type ProfileCheck } from "../lib/profileCompletion"
import ProfileGateDrawer from "../components/ProfileGateDrawer"
import AiConnectPanel from "../components/AiConnectPanel"
import FeatureGated from "../components/FeatureGated"

type Row = {
  id: string
  nombre: string | null
  avatar: string | null
  biografia: string | null
  proyecto: string | null
  project_status: string | null
  buscando: string[] | null
  last_login: string | null
  created_at: string | null
  streak_days: number | null
}

type Candidate = { profile: MatchProfile; match: MatchResult }

export default function Explorar() {
  const [user, userLoading] = useUser()
  const navigate = useNavigate()
  const [candidates, setCandidates] = useState<Candidate[]>([])
  // Pool completo para la búsqueda con IA: solo excluye al propio usuario, NUNCA
  // a quien ya ignoró en el feed pasivo — una búsqueda explícita es una petición
  // deliberada y no debería ocultar resultados por descartes antiguos.
  const [aiCandidates, setAiCandidates] = useState<MatchProfile[]>([])
  const [meProfile, setMeProfile] = useState<MatchProfile | null>(null)
  const [loadingData, setLoadingData] = useState(true)
  // Mientras la sesión aún se resuelve, seguimos "cargando" — evita el falso
  // "No quedan fundadores" antes de saber siquiera quién es el usuario.
  const loading = userLoading || loadingData
  const [leaving, setLeaving] = useState<Set<string>>(new Set())
  const [hiddenCount, setHiddenCount] = useState(0)
  // Gate de conexión: drawer si el perfil está incompleto
  const [meCheck, setMeCheck] = useState<ProfileCheck | null>(null)
  const [gateOpen, setGateOpen] = useState(false)

  useEffect(() => {
    if (!user) { if (!userLoading) setLoadingData(false); return }
    let cancelled = false
    const cargar = async () => {
      try {
        const [{ data: users }, { data: roles }] = await Promise.all([
          supabase.from("users")
            .select("id, nombre, avatar, biografia, proyecto, project_status, buscando, last_login, created_at, streak_days"),
          supabase.from("workflow_roles").select("user_id, rol"),
        ])
        if (cancelled) return
        const roleMap = new Map((roles ?? []).map(r => [r.user_id, r.rol as string]))
        const all = (users ?? []) as Row[]
        const meRow = all.find(u => u.id === user.id)
        setMeCheck(checkProfile(meRow ?? null))
        const me: MatchProfile = {
          id: user.id,
          nombre: meRow?.nombre, biografia: meRow?.biografia,
          proyecto: meRow?.proyecto, buscando: meRow?.buscando,
          role: roleMap.get(user.id) ?? null,
          last_login: meRow?.last_login, created_at: meRow?.created_at,
          project_status: meRow?.project_status ?? null,
          streak_days: meRow?.streak_days ?? null,
        }
        setMeProfile(me)
        const ignored = getIgnored(user.id)
        const others = all.filter(u => u.id !== user.id)
        const toProfile = (u: Row): MatchProfile => ({
          id: u.id, nombre: u.nombre, biografia: u.biografia,
          proyecto: u.proyecto, buscando: u.buscando,
          role: roleMap.get(u.id) ?? null,
          last_login: u.last_login, created_at: u.created_at,
          project_status: u.project_status ?? null,
          streak_days: u.streak_days ?? null,
        })
        const list: Candidate[] = others
          .filter(u => !ignored.has(u.id))
          .map(u => {
            const profile = toProfile(u)
            return { profile, match: computeMatch(me, profile) }
          })
          .sort((a, b) => b.match.score - a.match.score || b.match.rawScore - a.match.rawScore)
        setCandidates(list)
        setAiCandidates(others.map(toProfile))
        setHiddenCount(ignoredCount(user.id))
      } catch {
        // error de red o JS — no romper el estado de carga
      } finally {
        if (!cancelled) setLoadingData(false)
      }
    }
    cargar()
    return () => { cancelled = true }
  }, [user, userLoading])

  const handleIgnore = (id: string) => {
    setLeaving(prev => new Set(prev).add(id))
    setTimeout(() => {
      if (user) ignoreUser(user.id, id)
      setCandidates(prev => prev.filter(c => c.profile.id !== id))
      setLeaving(prev => { const n = new Set(prev); n.delete(id); return n })
      setHiddenCount(c => c + 1)
    }, 360)
  }

  const stats = useMemo(() => {
    const active = candidates.filter(c => !c.match.inactive).length
    const strong = candidates.filter(c => isStrongMatch(c.match.score)).length
    return { active, strong }
  }, [candidates])

  return (
    <div className="max-w-6xl mx-auto px-5 py-10 animate-in">
      <style>{`
        @keyframes nes-card-in { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes nes-overlay-in { from { opacity: 0 } to { opacity: 1 } }
        @keyframes nes-modal-in { from { opacity: 0; transform: scale(0.96) } to { opacity: 1; transform: scale(1) } }
        @media (prefers-reduced-motion: reduce) {
          .nes-modal-overlay, .nes-modal-box { animation: none !important; }
        }
      `}</style>

      {/* Header */}
      <div className="mb-7">
        <div className="flex items-center gap-2.5">
          <h1 className="text-[22px] font-semibold tracking-tight text-white">NES Connect</h1>
          <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
            style={{ background: "rgba(94,106,210,0.14)", color: "#aab2f0", border: "1px solid rgba(94,106,210,0.35)" }}>
            Matchmaking
          </span>
        </div>
        <p className="text-[13px] mt-1.5" style={{ color: "var(--text-dim)" }}>
          Fundadores compatibles, ordenados por afinidad y actividad reciente.
        </p>
        {!loading && candidates.length > 0 && (
          <div className="flex items-center gap-3 mt-3 text-[11px]" style={{ color: "var(--text-dimmer)" }}>
            <span><span className="text-white font-semibold">{stats.active}</span> activos</span>
            <span>·</span>
            <span><span style={{ color: "#3b82f6" }} className="font-semibold">{stats.strong}</span> match fuerte</span>
            {hiddenCount > 0 && (<><span>·</span><span>{hiddenCount} ocultos 2 semanas</span></>)}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_350px] gap-6 lg:gap-8 items-start">
        {/* Columna izquierda: feed de matchmaking */}
        <div>
          {loading && (
            <p className="text-[13px]" style={{ color: "var(--text-dim)" }}>Calculando compatibilidad…</p>
          )}
          {!loading && candidates.length === 0 && (
            <div className="text-[13px] text-center py-16 px-6 rounded-xl border border-dashed"
              style={{ color: "var(--text-dim)", borderColor: "var(--border)" }}>
              No quedan fundadores por descubrir ahora mismo.<br />
              <span className="text-[12px]" style={{ color: "var(--text-dimmer)" }}>
                Los que ignoraste volverán a aparecer en unas semanas.
              </span>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {candidates.map((c, i) => (
              <ConnectCard
                key={c.profile.id}
                candidate={c}
                index={i}
                leaving={leaving.has(c.profile.id)}
                locked={!!meCheck && !meCheck.complete}
                onConnect={() => navigate(`/chat/${c.profile.id}`)}
                onLocked={() => setGateOpen(true)}
                onProfile={() => navigate(`/perfil-publico/${c.profile.id}`)}
                onIgnore={() => handleIgnore(c.profile.id)}
              />
            ))}
          </div>
        </div>

        {/* Columna derecha: Conexión IA (función estrella).
            Gated por el flag matching_advanced: mientras el flag esté inactivo
            (estado actual) todo el mundo la ve; al activarlo desde /admin, los
            usuarios free ven el paywall en vivo. */}
        <aside className="order-first lg:order-none lg:sticky lg:top-6">
          <FeatureGated feature="matching_advanced">
            <AiConnectPanel
              me={meProfile}
              candidates={aiCandidates}
              disabled={loading}
              locked={!!meCheck && !meCheck.complete}
              onLocked={() => setGateOpen(true)}
            />
          </FeatureGated>
        </aside>
      </div>

      {/* Drawer de perfil incompleto */}
      {meCheck && (
        <ProfileGateDrawer
          check={meCheck}
          open={gateOpen}
          onClose={() => setGateOpen(false)}
        />
      )}
    </div>
  )
}

function ConnectCard({ candidate, index, leaving, locked, onConnect, onLocked, onProfile, onIgnore }: {
  candidate: Candidate
  index: number
  leaving: boolean
  locked: boolean
  onConnect: () => void
  onLocked: () => void
  onProfile: () => void
  onIgnore: () => void
}) {
  const { profile, match } = candidate
  const [showBreakdown, setShowBreakdown] = useState(false)
  const strong = isStrongMatch(match.score)
  const name = profile.nombre || "Fundador"
  const initial = name.trim()[0]?.toUpperCase() || "?"
  const scoreColor = match.inactive ? "#62666d" : strong ? "#3b82f6" : match.score >= 55 ? "#5e6ad2" : "#8a8f98"

  return (
    <div
      className="relative rounded-xl p-4 sm:p-5 overflow-hidden"
      style={{
        background: strong
          ? "linear-gradient(180deg, rgba(59,130,246,0.06), rgba(59,130,246,0.02)), var(--surface)"
          : "var(--surface)",
        border: `1px solid ${strong ? "rgba(59,130,246,0.30)" : "var(--border)"}`,
        boxShadow: strong ? "0 0 0 1px rgba(59,130,246,0.12), 0 8px 30px rgba(59,130,246,0.07)" : "none",
        opacity: leaving ? 0 : 1,
        transform: leaving ? "translateX(-110%)" : "translateX(0)",
        transition: "transform 0.36s cubic-bezier(0.4,0,0.2,1), opacity 0.36s ease",
        animation: leaving ? "none" : `nes-card-in 0.35s ease-out both`,
        animationDelay: `${Math.min(index * 40, 240)}ms`,
      }}
    >
      {strong && (
        <span className="absolute top-0 right-0 text-[9px] font-bold uppercase tracking-wider px-2.5 py-1"
          style={{ background: "rgba(59,130,246,0.16)", color: "#7eb0ff", borderBottomLeftRadius: 10 }}>
          ★ Match fuerte
        </span>
      )}

      <div className="flex items-start gap-4">
        {/* Avatar */}
        <button onClick={onProfile} className="shrink-0">
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-[16px] font-semibold"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: `1px solid ${strong ? "rgba(59,130,246,0.35)" : "rgba(255,255,255,0.08)"}`,
              color: "var(--text-dim)",
            }}>
            {initial}
          </div>
        </button>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={onProfile} className="text-white font-semibold text-[15px] leading-tight hover:underline">
              {name}
            </button>
            {profile.role && (
              <span className="text-[10.5px] px-1.5 py-0.5 rounded-md"
                style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-dim)", border: "1px solid var(--border)" }}>
                {profile.role}
              </span>
            )}
            {match.inactive && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-md inline-flex items-center gap-1"
                style={{ background: "rgba(98,102,109,0.12)", color: "var(--text-dimmer)" }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#62666d" }} />
                Inactivo {match.daysInactive >= 999 ? `${INACTIVITY_DAYS}+` : match.daysInactive}d
              </span>
            )}
          </div>

          <p className="text-[12.5px] mt-1 truncate" style={{ color: "var(--text-dim)" }}>
            {profile.proyecto || profile.biografia || "Sin proyecto definido"}
          </p>

          {/* Reasons */}
          {match.reasons.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
              {match.reasons.map((r, k) => (
                <span key={k} className="text-[10.5px] px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(94,106,210,0.10)", color: "#aab2f0", border: "1px solid rgba(94,106,210,0.22)" }}>
                  {r}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Match score — clicable: abre el modal con el desglose */}
        <button
          onClick={() => setShowBreakdown(true)}
          className="shrink-0 text-right rounded-lg p-1 -m-1 transition-colors cursor-pointer"
          style={{ background: showBreakdown ? "rgba(255,255,255,0.04)" : "transparent" }}
          title="Ver cómo se calcula este match"
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
          onMouseLeave={e => (e.currentTarget.style.background = showBreakdown ? "rgba(255,255,255,0.04)" : "transparent")}
        >
          <div className="text-[22px] font-bold leading-none" style={{ color: scoreColor }}>
            {match.score}<span className="text-[12px] font-medium">%</span>
          </div>
          <div className="text-[9.5px] uppercase tracking-wider mt-1 flex items-center justify-end gap-1" style={{ color: "var(--text-dimmer)" }}>
            match
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
              <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
            </svg>
          </div>
          <div className="mt-2 h-[3px] w-16 rounded-full overflow-hidden ml-auto" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div className="h-full rounded-full" style={{ width: `${match.score}%`, background: scoreColor }} />
          </div>
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-4">
        {locked ? (
          <button onClick={onLocked}
            title="Completa tu perfil (biografía de 150+ caracteres y todos los apartados) para poder conectar"
            className="flex-1 sm:flex-none px-4 py-2 rounded-md text-[13px] font-semibold transition inline-flex items-center justify-center gap-1.5"
            style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-dim)", border: "1px solid var(--border)" }}
            onMouseEnter={e => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "var(--border-strong)" }}
            onMouseLeave={e => { e.currentTarget.style.color = "var(--text-dim)"; e.currentTarget.style.borderColor = "var(--border)" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Conectar
          </button>
        ) : (
          <button onClick={onConnect}
            className="flex-1 sm:flex-none px-4 py-2 rounded-md text-[13px] font-semibold transition"
            style={{ background: strong ? "linear-gradient(180deg,#3b82f6,#2f6fe0)" : "linear-gradient(180deg,#5e6ad2,#4d59c4)", color: "#fff" }}
            onMouseEnter={e => (e.currentTarget.style.filter = "brightness(1.08)")}
            onMouseLeave={e => (e.currentTarget.style.filter = "brightness(1)")}>
            Conectar
          </button>
        )}
        <button onClick={onIgnore}
          className="px-3.5 py-2 rounded-md text-[13px] font-medium transition"
          style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--text-dim)" }}
          onMouseEnter={e => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "var(--border-strong)" }}
          onMouseLeave={e => { e.currentTarget.style.color = "var(--text-dim)"; e.currentTarget.style.borderColor = "var(--border)" }}>
          Ignorar por ahora
        </button>
      </div>

      {/* Modal con el desglose del match */}
      {showBreakdown && (
        <MatchBreakdownModal
          match={match}
          name={name}
          scoreColor={scoreColor}
          onClose={() => setShowBreakdown(false)}
        />
      )}
    </div>
  )
}

// ── Modal de desglose del match ────────────────────────────────────────────
// Se renderiza vía portal en <body> porque la tarjeta tiene `transform` y
// `overflow:hidden` (un position:fixed dentro quedaría recortado/anclado a ella).
function MatchBreakdownModal({ match, name, scoreColor, onClose }: {
  match: MatchResult
  name: string
  scoreColor: string
  onClose: () => void
}) {
  // Escape para cerrar + bloqueo del scroll de fondo mientras está abierto.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  // Anima el relleno de las barras desde 0 al montar.
  const [filled, setFilled] = useState(false)
  useEffect(() => {
    const r = requestAnimationFrame(() => setFilled(true))
    return () => cancelAnimationFrame(r)
  }, [])

  return createPortal(
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Desglose de compatibilidad con ${name}`}
      className="nes-modal-overlay fixed inset-0 z-[140] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", animation: "nes-overlay-in 0.15s ease-out" }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="nes-modal-box relative w-[90%] max-w-[420px] max-h-[90vh] overflow-y-auto p-5 sm:p-6"
        style={{
          background: "#151618",
          border: "1px solid #222326",
          borderRadius: 10,
          boxShadow: "0 24px 70px rgba(0,0,0,0.55)",
          animation: "nes-modal-in 0.15s ease-out",
        }}
      >
        {/* Cerrar */}
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute top-3.5 right-3.5 w-7 h-7 inline-flex items-center justify-center rounded-md cursor-pointer"
          style={{ color: "#8a8f98" }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "#f7f8f8" }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#8a8f98" }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        {/* Cabecera */}
        <div className="mb-5 pr-8">
          <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#62666d" }}>
            Desglose de compatibilidad
          </div>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-[26px] font-bold leading-none" style={{ color: scoreColor }}>
              {match.score}<span className="text-[14px] font-semibold">%</span>
            </span>
            <span className="text-[13px]" style={{ color: "#8a8f98" }}>de match con {name}</span>
          </div>
        </div>

        {/* Métricas con barra de progreso */}
        <div className="space-y-3.5">
          {match.breakdown.map(f => {
            const pct = f.max > 0 ? Math.round((f.pts / f.max) * 100) : 0
            return (
              <div key={f.label}>
                <div className="flex items-center justify-between mb-1.5 gap-3">
                  <span className="text-[14px]" style={{ color: "#b4bcd0" }}>{f.label}</span>
                  <span className="text-[14px] font-bold shrink-0" style={{ color: "#f7f8f8" }}>{pct}%</span>
                </div>
                <div className="h-1.5 w-full rounded-[4px] overflow-hidden" style={{ background: "#222326" }}>
                  <div
                    className="h-full rounded-[4px]"
                    style={{
                      width: filled ? `${pct}%` : "0%",
                      background: "var(--accent)",
                      transition: "width 0.45s cubic-bezier(0.4,0,0.2,1)",
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {/* Nota de inactividad (si aplica) */}
        {match.inactive && (
          <div className="mt-4 px-3 py-2 rounded-lg text-[12px]" style={{ background: "rgba(98,102,109,0.10)", color: "#8a8f98", border: "1px solid #222326" }}>
            ⚠ Puntuación base {match.rawScore}% → reducida al 50% por inactividad ({match.daysInactive >= 999 ? `${INACTIVITY_DAYS}+` : match.daysInactive} días sin actividad).
          </div>
        )}

        {/* Nota explicativa */}
        <p className="text-[12px] leading-relaxed mt-4" style={{ color: "#8a8f98" }}>
          La compatibilidad se calcula comparando los campos de tu perfil con los de esta persona. A mayor completitud de perfil, mayor precisión.
        </p>
      </div>
    </div>,
    document.body,
  )
}

