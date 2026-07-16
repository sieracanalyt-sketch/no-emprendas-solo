import { useEffect, useState } from "react"
import { supabase } from "../supabase"

// ──────────────────────────────────────────────────────────────────────────────
// Prestigio por aportar — tarjeta del Perfil propio.
//
// El prestigio (0–100) lo calcula un cron diario en el servidor a partir de:
//   · Perfil completo (40 pts) — mejor matching para todos
//   · Velocidad de respuesta (35 pts) — matches que no mueren en el buzón
//   · Constancia (25 pts) — racha y actividad reciente
// Sube el match score de quien lo tiene y luce ⭐ en Explorar: aportar tiene
// premio visible.
// ──────────────────────────────────────────────────────────────────────────────

type Detail = {
  perfil?: number
  respuesta?: number
  constancia?: number
  computed_at?: string
}

const FACTORS: { key: keyof Detail; label: string; max: number; tip: string }[] = [
  { key: "perfil", label: "Perfil completo", max: 40, tip: "Completa nombre, biografía (250+), proyecto y a quién buscas." },
  { key: "respuesta", label: "Velocidad de respuesta", max: 35, tip: "Responde a los matches en menos de 24 h — el contador de 72 h es tu aliado." },
  { key: "constancia", label: "Constancia", max: 25, tip: "Entra a diario y mantén tu racha para no perder visibilidad." },
]

export default function PrestigeCard({ userId }: { userId: string }) {
  const [prestige, setPrestige] = useState<number | null>(null)
  const [detail, setDetail] = useState<Detail | null>(null)

  useEffect(() => {
    let cancelled = false
    supabase
      .from("users")
      .select("prestige, prestige_detail")
      .eq("id", userId)
      .single()
      .then(({ data }) => {
        if (cancelled || !data) return
        setPrestige(data.prestige ?? 0)
        setDetail((data.prestige_detail as Detail) ?? null)
      })
    return () => { cancelled = true }
  }, [userId])

  if (prestige === null) return null

  const gold = prestige >= 70
  const color = gold ? "#f5c442" : prestige >= 40 ? "#5e6ad2" : "#8a8f98"

  return (
    <div
      className="rounded-2xl p-4 sm:p-5"
      style={{
        background: gold
          ? "linear-gradient(180deg, rgba(245,196,66,0.06), rgba(245,196,66,0.015)), var(--surface)"
          : "var(--surface)",
        border: `1px solid ${gold ? "rgba(245,196,66,0.3)" : "var(--glass-border)"}`,
        boxShadow: "0 8px 24px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.05)",
      }}
    >
      <div className="flex items-center justify-between gap-3 mb-1">
        <div className="flex items-center gap-2">
          <span className="text-[15px]">⭐</span>
          <h3 className="text-[14px] font-semibold text-white">Prestigio por aportar</h3>
        </div>
        <span className="text-[22px] font-bold leading-none" style={{ color }}>
          {prestige}
          <span className="text-[12px] font-medium" style={{ color: "var(--text-dimmer)" }}>/100</span>
        </span>
      </div>
      <p className="text-[11.5px] mb-3.5" style={{ color: "var(--text-dim)" }}>
        Se recalcula cada día y mejora tu posición en el feed de Explorar: quien aporta, destaca.
      </p>

      <div className="flex flex-col gap-2.5">
        {FACTORS.map(f => {
          const raw = detail?.[f.key]
          const pts = typeof raw === "number" ? raw : 0
          const pct = Math.round((pts / f.max) * 100)
          const full = pts >= f.max
          return (
            <div key={f.key}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[12px] font-medium text-white">{f.label}</span>
                <span className="text-[11px] font-semibold" style={{ color: full ? "#22c55e" : "var(--text-dim)" }}>
                  {pts}/{f.max}
                </span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden mb-0.5" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, background: full ? "#22c55e" : color }}
                />
              </div>
              {!full && (
                <p className="text-[10.5px]" style={{ color: "var(--text-dimmer)" }}>💡 {f.tip}</p>
              )}
            </div>
          )
        })}
      </div>

      {detail?.computed_at && (
        <p className="text-[10px] mt-3 text-right" style={{ color: "var(--text-dimmer)" }}>
          Actualizado {new Date(detail.computed_at).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
        </p>
      )}
    </div>
  )
}
