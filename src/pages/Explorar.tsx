import { useEffect, useMemo, useState } from "react"
import { supabase } from "../supabase"
import { useUser } from "../hooks/useUser"
import { useNavigate } from "react-router-dom"
import {
  computeMatch, isStrongMatch, INACTIVITY_DAYS,
  type MatchProfile, type MatchResult,
} from "../lib/matchmaking"
import { getIgnored, ignoreUser, ignoredCount } from "../lib/connectStore"
import { checkProfile, MIN_BIO, type ProfileCheck } from "../lib/profileCompletion"

type Row = {
  id: string
  nombre: string | null
  avatar: string | null
  biografia: string | null
  proyecto: string | null
  buscando: string[] | null
  last_login: string | null
  created_at: string | null
}

type Candidate = { profile: MatchProfile; match: MatchResult }

export default function Explorar() {
  const [user] = useUser()
  const navigate = useNavigate()
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)
  const [leaving, setLeaving] = useState<Set<string>>(new Set())
  const [hiddenCount, setHiddenCount] = useState(0)
  // Gate de conexión: el usuario no puede conectar hasta completar su perfil
  const [meCheck, setMeCheck] = useState<ProfileCheck | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    const cargar = async () => {
      const [{ data: users }, { data: roles }] = await Promise.all([
        supabase.from("users")
          .select("id, nombre, avatar, biografia, proyecto, buscando, last_login, created_at"),
        supabase.from("workflow_roles").select("user_id, rol"),
      ])
      if (cancelled) return
      const roleMap = new Map((roles ?? []).map(r => [r.user_id, r.rol as string]))
      const all = (users ?? []) as Row[]
      const meRow = all.find(u => u.id === user.id)
      setMeCheck(checkProfile(meRow))
      const me: MatchProfile = {
        id: user.id,
        nombre: meRow?.nombre, biografia: meRow?.biografia,
        proyecto: meRow?.proyecto, buscando: meRow?.buscando,
        role: roleMap.get(user.id) ?? null,
        last_login: meRow?.last_login, created_at: meRow?.created_at,
      }
      const ignored = getIgnored(user.id)
      const list: Candidate[] = all
        .filter(u => u.id !== user.id && !ignored.has(u.id))
        .map(u => {
          const profile: MatchProfile = {
            id: u.id, nombre: u.nombre, biografia: u.biografia,
            proyecto: u.proyecto, buscando: u.buscando,
            role: roleMap.get(u.id) ?? null,
            last_login: u.last_login, created_at: u.created_at,
          }
          return { profile, match: computeMatch(me, profile) }
        })
        .sort((a, b) => b.match.score - a.match.score || b.match.rawScore - a.match.rawScore)
      setCandidates(list)
      setHiddenCount(ignoredCount(user.id))
      setLoading(false)
    }
    cargar()
    return () => { cancelled = true }
  }, [user])

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
    <div className="max-w-3xl mx-auto px-5 py-10 animate-in">
      <style>{`
        @keyframes nes-card-in { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: translateY(0) } }
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

      {meCheck && !meCheck.complete && (
        <ProfileGateBanner check={meCheck} onComplete={() => navigate("/perfil")} />
      )}

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
            onLocked={() => navigate("/perfil")}
            onProfile={() => navigate(`/perfil-publico/${c.profile.id}`)}
            onIgnore={() => handleIgnore(c.profile.id)}
          />
        ))}
      </div>
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

        {/* Match score */}
        <div className="shrink-0 text-right">
          <div className="text-[22px] font-bold leading-none" style={{ color: scoreColor }}>
            {match.score}<span className="text-[12px] font-medium">%</span>
          </div>
          <div className="text-[9.5px] uppercase tracking-wider mt-1" style={{ color: "var(--text-dimmer)" }}>match</div>
          <div className="mt-2 h-[3px] w-16 rounded-full overflow-hidden ml-auto" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div className="h-full rounded-full" style={{ width: `${match.score}%`, background: scoreColor }} />
          </div>
        </div>
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
    </div>
  )
}

// Aviso + gate: se muestra cuando el perfil del usuario está incompleto.
// Mientras se muestra, los botones "Conectar" del feed quedan bloqueados.
function ProfileGateBanner({ check, onComplete }: { check: ProfileCheck; onComplete: () => void }) {
  return (
    <div
      className="mb-6 rounded-xl p-4 sm:p-5"
      style={{
        background: "linear-gradient(180deg, rgba(94,106,210,0.10), rgba(94,106,210,0.03)), var(--surface)",
        border: "1px solid rgba(94,106,210,0.35)",
        boxShadow: "0 8px 30px rgba(94,106,210,0.06)",
      }}
    >
      <div className="flex items-start gap-3.5">
        <div
          className="shrink-0 w-10 h-10 rounded-lg inline-flex items-center justify-center"
          style={{ background: "rgba(94,106,210,0.16)", border: "1px solid rgba(94,106,210,0.3)", color: "#aab2f0" }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="text-[15px] font-semibold text-white">Completa tu perfil para empezar a conectar</h2>
          <p className="text-[12.5px] mt-1" style={{ color: "var(--text-dim)" }}>
            Para conectar con otros fundadores necesitas una biografía de {MIN_BIO}+ caracteres y rellenar todos tus apartados.
          </p>

          <div className="flex flex-wrap gap-2 mt-3">
            {check.items.map((it) => (
              <span
                key={it.key}
                className="inline-flex items-center gap-1.5 text-[11.5px] px-2.5 py-1 rounded-full"
                style={{
                  background: it.ok ? "rgba(52,211,153,0.10)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${it.ok ? "rgba(52,211,153,0.30)" : "var(--border)"}`,
                  color: it.ok ? "#7ee2b8" : "var(--text-dim)",
                }}
              >
                {it.ok ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                ) : (
                  <span className="w-[11px] h-[11px] rounded-full border" style={{ borderColor: "var(--text-dimmer)" }} />
                )}
                {it.label}
                {it.key === "biografia" && it.detail && (
                  <span style={{ color: it.ok ? "#7ee2b8" : "var(--text-dimmer)" }}>· {it.detail}</span>
                )}
              </span>
            ))}
          </div>
        </div>

        <button
          onClick={onComplete}
          className="shrink-0 self-center px-4 py-2 rounded-md text-[13px] font-semibold transition"
          style={{ background: "linear-gradient(180deg,#5e6ad2,#4d59c4)", color: "#fff" }}
          onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(1.08)")}
          onMouseLeave={(e) => (e.currentTarget.style.filter = "brightness(1)")}
        >
          Completar perfil
        </button>
      </div>
    </div>
  )
}
