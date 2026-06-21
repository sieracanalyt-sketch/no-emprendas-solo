import {
  buildHeatmap,
  getContributions,
  getRank,
  getNextRank,
  getRankProgress,
  RANKS,
  type HeatLevel,
  type ProfileMetrics,
} from "../lib/gamification"

const HEAT_COLORS: Record<HeatLevel, string> = {
  0: "#1a1c1f",
  1: "rgba(94,106,210,0.35)",
  2: "rgba(94,106,210,0.65)",
  3: "#5e6ad2",
}

function FlameIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 17c.55 0 1.05-.18 1.46-.48C14.08 15.67 15 14 15 12c0-1.5-.5-2.7-1.18-3.82C12.93 7.05 12 6 12 6c0 0-.5 2-2 3.5C8.5 11 8.5 13 8.5 14.5Z" />
      <path d="M12 6c0 0 3 2.5 3 6 0 2.76-2.24 5-5 5" />
    </svg>
  )
}

// ─── Pill de rango (junto al nombre) ──────────────────────────────────────────
export function RankPill({ connections }: { connections: number }) {
  const rank = getRank(connections)
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[12px]"
      style={{
        color: "#aeb6ff",
        background: "rgba(94,106,210,0.12)",
        border: "1px solid rgba(94,106,210,0.30)",
        borderRadius: 999,
        padding: "4px 11px",
      }}
      title="Tu rango sube con las personas que conectas en NES."
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="6" />
        <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
      </svg>
      {rank.name}
    </span>
  )
}

// ─── Tile de métrica ──────────────────────────────────────────────────────────
function MetricTile({
  value, label, accent, icon,
}: { value: number; label: string; accent?: string; icon?: React.ReactNode }) {
  return (
    <div
      className="rounded-xl px-3.5 py-3.5"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-baseline gap-1.5">
        <span
          className="text-[23px] font-semibold"
          style={{ letterSpacing: "-0.02em", color: accent ?? "var(--text)" }}
        >
          {value}
        </span>
        {icon && <span style={{ color: accent }}>{icon}</span>}
      </div>
      <div className="text-[11.5px] mt-0.5" style={{ color: "var(--text-dim)" }}>
        {label}
      </div>
    </div>
  )
}

// ─── Mapa de contribuciones ───────────────────────────────────────────────────
function StreakHeatmap({ metrics }: { metrics: ProfileMetrics }) {
  const grid = buildHeatmap(metrics.activity)
  return (
    <div
      className="rounded-xl p-4"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[12.5px]" style={{ color: "var(--text-dim)" }}>
          Actividad · últimas 12 semanas
        </span>
        {metrics.streak_best > 0 && (
          <span className="text-[11.5px]" style={{ color: "var(--text-dimmer)" }}>
            récord {metrics.streak_best} {metrics.streak_best === 1 ? "día" : "días"}
          </span>
        )}
      </div>

      <div className="flex gap-[3px]">
        {grid.map((week, w) => (
          <div key={w} className="flex flex-col gap-[3px] flex-1">
            {week.map((lvl, d) => (
              <div
                key={d}
                style={{ aspectRatio: "1", borderRadius: 2, background: HEAT_COLORS[lvl] }}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1.5 mt-3 text-[10.5px]" style={{ color: "var(--text-dimmer)" }}>
        <span>menos</span>
        {([0, 1, 2, 3] as HeatLevel[]).map(l => (
          <span key={l} style={{ width: 9, height: 9, borderRadius: 2, background: HEAT_COLORS[l] }} />
        ))}
        <span>más</span>
      </div>
    </div>
  )
}

// ─── Progreso de rango ────────────────────────────────────────────────────────
function RankProgress({ connections }: { connections: number }) {
  const rank = getRank(connections)
  const next = getNextRank(connections)
  const pct = Math.round(getRankProgress(connections) * 100)
  const remaining = next ? next.min - connections : 0

  return (
    <div
      className="rounded-xl p-4"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[12.5px]" style={{ color: "var(--text)" }}>
          Rango: <span style={{ color: "#aeb6ff" }}>{rank.name}</span>
        </span>
        {next ? (
          <span className="text-[11.5px]" style={{ color: "var(--text-dimmer)" }}>
            {remaining} {remaining === 1 ? "conexión" : "conexiones"} para{" "}
            <span style={{ color: "var(--text-dim)" }}>{next.name}</span>
          </span>
        ) : (
          <span className="text-[11.5px]" style={{ color: "rgba(74,222,128,0.85)" }}>
            rango máximo
          </span>
        )}
      </div>

      <div className="rounded-full overflow-hidden" style={{ height: 4, background: "rgba(255,255,255,0.06)" }}>
        <div
          className="profile-progress-fill rounded-full h-full"
          style={{ width: `${pct}%`, background: next ? "#5e6ad2" : "#4ade80" }}
        />
      </div>

      <div className="flex justify-between mt-2.5 text-[10.5px]">
        {RANKS.map(r => (
          <span key={r.name} style={{ color: r.name === rank.name ? "#aeb6ff" : "var(--text-dimmer)" }}>
            {r.name}
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── Bloque completo de estadísticas ──────────────────────────────────────────
export default function ProfileStats({ metrics }: { metrics: ProfileMetrics }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2.5">
        <MetricTile value={metrics.connections} label="Personas conectadas" />
        <MetricTile value={getContributions(metrics)} label="Aportaciones" />
        <MetricTile
          value={metrics.streak_days}
          label="Días de racha"
          accent="#f0997b"
          icon={<FlameIcon />}
        />
      </div>
      <StreakHeatmap metrics={metrics} />
      <RankProgress connections={metrics.connections} />
    </div>
  )
}
