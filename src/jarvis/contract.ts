// JARVIS ⇄ HUD wire contract (NES copy). MUST match the agent's render.py literals.
// See MERGE/projects/jarvis-aios/CONTRACT.md.

export const RENDER_TOPIC = "aios.render"

export const RenderType = {
  BRIEF: "aios.brief",
  METRICS: "aios.metrics",
  PIPELINE: "aios.pipeline",
  INTEL: "aios.intel",
  ACTIONS: "aios.actions",
  FOCUS: "aios.focus",
  MATCH: "aios.match",
} as const
export type RenderTypeValue = (typeof RenderType)[keyof typeof RenderType]

export interface RenderEnvelope<T = unknown> {
  type: RenderTypeValue
  v: number
  ts: number
  data: T
}

export type Tone = "up" | "down" | "warn" | "flat"
export interface BriefData {
  date: string; headline: string
  signals: { label: string; value: string; tone: Tone }[]; note: string
}
export interface MetricPoint { t: string; v: number }
export interface MetricsData {
  metric: string; label: string; unit: string; delta_pct: number
  range_days: number; points: MetricPoint[]; available: string[]
}
export interface Stage { key: string; label: string; count: number }
export interface Deal {
  name: string; stage: string; size: "S" | "M" | "L"; at_risk: boolean; reason: string
}
export interface PipelineData { stages: Stage[]; deals: Deal[]; at_risk_count: number }
export interface IntelItem {
  time: string; type: "meeting" | "message" | "doc"; who: string; summary: string
}
export interface IntelData { query: string; timeline: IntelItem[] }
export interface ActionItem { rank: number; title: string; why: string; effort: string }
export interface ActionsData { date: string; actions: ActionItem[] }
export interface FocusData { minutes: number; label: string; started_ts: number }
// Matchmaking avanzado (motor Mergie, doc de investigación NES): tarjetas con
// explicación humana en vez de pares con puntuación. Sin puntuaciones visibles.
export interface MergieMatch {
  posicion: number
  id_perfil: string
  nombre: string
  porque_encaja: string
  punto_fuerte: string
  a_hablar_desde_el_principio: string | null
  primer_paso: string
}
export interface MatchData {
  generated: string | null; engine?: string
  resumen?: string | null
  matches: MergieMatch[]
  nota_honesta?: string | null
  gaps: { total_members?: number; premium_members?: number; advanced_profiles?: number; eligible?: number; free_members?: number }
  unavailable?: string
}

export function parseRenderEvent(bytes: Uint8Array): RenderEnvelope | null {
  try {
    const obj = JSON.parse(new TextDecoder().decode(bytes))
    if (obj && typeof obj.type === "string" && "data" in obj) return obj as RenderEnvelope
  } catch { /* not ours */ }
  return null
}
