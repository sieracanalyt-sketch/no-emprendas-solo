import { useEffect, useState } from "react"
import {
  fetchAdvancedMatches, FRAMEWORK_COLOR,
  type AdvancedResult, type AdvancedReason,
} from "../lib/advancedMatch"

// ──────────────────────────────────────────────────────────────────────────────
// Conexiones sugeridas por el motor avanzado. REAL-DATA-ONLY: si no hay perfiles
// premium completos, muestra el estado honesto (nunca datos inventados).
// ──────────────────────────────────────────────────────────────────────────────

function scoreColor(s: number): string {
  if (s >= 70) return "#3fca7d"
  if (s >= 40) return "#5e6ad2"
  return "#8a8f98"
}

export default function AdvancedMatchPanel() {
  const [res, setRes] = useState<AdvancedResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    fetchAdvancedMatches(6).then((r) => { if (alive) { setRes(r); setLoading(false) } })
    return () => { alive = false }
  }, [])

  if (loading) return <div className="text-sm" style={{ color: "var(--text-dim)" }}>Analizando compatibilidades…</div>
  if (!res) return null

  const g = res.gaps ?? {}

  if (res.unavailable || res.pairs.length === 0) {
    const premium = g.premium_members ?? 0
    return (
      <div className="rounded-2xl p-6 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="text-lg font-semibold" style={{ color: "var(--text)" }}>
          {res.unavailable ? "Sin datos ahora mismo" : "Aún no hay conexiones que sugerir"}
        </div>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed" style={{ color: "var(--text-dim)" }}>
          {res.unavailable
            ? res.unavailable
            : premium === 0
              ? "El matchmaking avanzado cruza los perfiles premium (Rocket Fuel · Working Genius · Give and Take · DISC). En cuanto haya al menos dos perfiles completos, aparecerán aquí las conexiones."
              : `${g.eligible ?? 0} de ${premium} premium tienen el perfil avanzado completo. Hacen falta al menos dos.`}
        </p>
        <GapRow g={g} />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {res.pairs.map((p) => (
        <div key={`${p.a}-${p.b}`} className="rounded-2xl p-4"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate font-semibold" style={{ color: "var(--text)" }}>{p.a}</span>
              <span style={{ color: "var(--accent)" }}>⇄</span>
              <span className="truncate font-semibold" style={{ color: "var(--text)" }}>{p.b}</span>
              {p.mutual && (
                <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
                  style={{ color: "#3fca7d", border: "1px solid rgba(63,202,125,0.4)" }}>✦ mutuo</span>
              )}
            </div>
            <span className="shrink-0 text-lg font-bold tabular-nums" style={{ color: scoreColor(p.score) }}>{p.score}</span>
          </div>

          <div className="mt-2 h-1 overflow-hidden rounded" style={{ background: "var(--border-strong)" }}>
            <div className="h-full rounded" style={{ width: `${p.score}%`, background: scoreColor(p.score) }} />
          </div>

          {p.reasons.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {p.reasons.map((r, i) => <ReasonChip key={i} r={r} />)}
            </div>
          )}
        </div>
      ))}
      <GapRow g={g} />
    </div>
  )
}

function ReasonChip({ r }: { r: AdvancedReason }) {
  const c = FRAMEWORK_COLOR[r.framework] ?? "#8a8f98"
  return (
    <span className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px]"
      style={{ border: `1px solid ${c}55`, background: `${c}12`, color: c }}>
      <span className="font-semibold uppercase tracking-wider">{r.framework}</span>
      <span style={{ color: "var(--text-dim)" }}>{r.text}</span>
    </span>
  )
}

function GapRow({ g }: { g: AdvancedResult["gaps"] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 pt-2 text-[11px] uppercase tracking-wider"
      style={{ color: "var(--text-dim)" }}>
      <span>miembros <b style={{ color: "var(--text)" }}>{g.total_members ?? 0}</b></span>
      <span>premium <b style={{ color: "var(--text)" }}>{g.premium_members ?? 0}</b></span>
      <span>perfiles avanzados <b style={{ color: "var(--text)" }}>{g.advanced_profiles ?? 0}</b></span>
    </div>
  )
}
