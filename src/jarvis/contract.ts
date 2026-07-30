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
  TASKLIST: "aios.tasklist",
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
// explicación humana. La nota, cuando existe, SIEMPRE viaja con su desglose por
// categoría y la evidencia que la sostiene — nunca un número solo.
// Espejo de src/lib/advancedMatch.ts.
export type CategoriaScore =
  | "vision_valores" | "complementariedad" | "compromiso" | "riesgo_conflicto" | "personalidad"
export interface SubScore {
  categoria: CategoriaScore
  score: number      // 0-100
  peso: number       // % aplicado tras la re-ponderación del usuario
  justificacion: string
  evidencia?: string[]
}
export interface MergieMatch {
  posicion: number
  id_perfil: string
  nombre: string
  porque_encaja: string
  punto_fuerte: string
  a_hablar_desde_el_principio: string | null
  primer_paso: string
  score_global?: number | null
  sub_scores?: SubScore[]
  red_flags?: string[]
  green_flags?: string[]
  conversaciones_pendientes?: string[]
  capado_por_red_flag?: boolean
}
export interface MatchData {
  generated: string | null; engine?: string
  resumen?: string | null
  matches: MergieMatch[]
  nota_honesta?: string | null
  pesos_usuario?: CategoriaScore[]
  gaps: { total_members?: number; premium_members?: number; advanced_profiles?: number; eligible?: number; free_members?: number }
  unavailable?: string
}

// Lista de tareas interactiva. MERGE la propone mientras habláis; tú marcas y
// descartas lo que quieras y, al guardar, entra en el Backlog del workflow.
export interface TaskListItem {
  title: string
  note?: string | null
  priority?: ActionPriority | null
  assignee?: string | null   // nombre de un miembro del equipo (se resuelve en el cliente)
  due_date?: string | null   // YYYY-MM-DD
}
export interface TaskListData {
  title?: string | null
  intro?: string | null
  items: TaskListItem[]
}

export function parseRenderEvent(bytes: Uint8Array): RenderEnvelope | null {
  try {
    const obj = JSON.parse(new TextDecoder().decode(bytes))
    if (obj && typeof obj.type === "string" && "data" in obj) return obj as RenderEnvelope
  } catch { /* not ours */ }
  return null
}

// ──────────────────────────────────────────────────────────────────────────────
// MERGE ⇄ WORKFLOW — canal de acciones
//
// MERGE no toca la base de datos: publica intenciones por el topic `merge.action`
// y es la APP quien las ejecuta con la sesión del usuario (misma RLS que si las
// hubiera pulsado él a mano). Ni un permiso extra para el agente, y todo lo que
// hace queda reflejado en la actividad del tablero.
//
// El resultado vuelve por `merge.action.result` para que MERGE pueda confirmarlo
// en voz alta ("hecho, la he movido a Planificar") o explicar por qué no pudo.
//
// Los selectores van por NOMBRE, no por uuid: MERGE conoce "Marta" y "rediseñar
// la landing", no identificadores. El cliente los resuelve de forma tolerante
// (sin acentos, sin mayúsculas, por coincidencia parcial).
// ──────────────────────────────────────────────────────────────────────────────
export const MERGE_ACTION_TOPIC = "merge.action"
export const MERGE_ACTION_RESULT_TOPIC = "merge.action.result"

export type ActionStatus = "backlog" | "progress" | "review" | "done"
export type ActionPriority = "Urgente" | "Alta" | "Media" | "Baja"
export type ActionQuadrant = 1 | 2 | 3 | 4

export type MergeAction =
  | { op: "task.create"; title: string; description?: string; priority?: ActionPriority
      status?: ActionStatus; assignee?: string; due_date?: string }
  | { op: "task.update"; task: string; title?: string; description?: string
      priority?: ActionPriority; status?: ActionStatus; assignee?: string
      due_date?: string | null; blocked?: boolean }
  | { op: "task.move"; task: string; status: ActionStatus }
  | { op: "task.quadrant"; task: string; quadrant: ActionQuadrant }
  | { op: "task.delete"; task: string }
  | { op: "member.add"; person: string; role?: string }
  | { op: "member.remove"; person: string }
  | { op: "member.role"; person: string; role: string }

export type MergeActionOp = MergeAction["op"]

/** Lo que llega por `merge.action`: una o varias acciones en un solo envío. */
export interface MergeActionEnvelope {
  v?: number
  id?: string            // eco en el resultado, para que MERGE case petición y respuesta
  actions: MergeAction[]
}

export interface MergeActionOutcome {
  op: MergeActionOp
  ok: boolean
  message: string        // frase lista para decir en voz alta
}
export interface MergeActionResult {
  id?: string
  ok: boolean
  summary: string
  outcomes: MergeActionOutcome[]
}

const ACTION_OPS: readonly string[] = [
  "task.create", "task.update", "task.move", "task.quadrant", "task.delete",
  "member.add", "member.remove", "member.role",
]

/**
 * Valida lo que llega por el cable. El agente es una fuente externa: aquí no se
 * confía en la forma del payload, solo se dejan pasar las acciones conocidas.
 * Acepta también una acción suelta sin envoltorio, por comodidad del agente.
 */
export function parseMergeActions(bytes: Uint8Array): MergeActionEnvelope | null {
  try {
    const obj = JSON.parse(new TextDecoder().decode(bytes)) as unknown
    if (!obj || typeof obj !== "object") return null
    const raw = obj as Record<string, unknown>
    const list = Array.isArray(raw.actions) ? raw.actions
      : typeof raw.op === "string" ? [raw]
      : null
    if (!list) return null
    const actions = list.filter(
      (a): a is MergeAction =>
        !!a && typeof a === "object" && ACTION_OPS.includes((a as { op?: unknown }).op as string)
    )
    if (actions.length === 0) return null
    return { v: typeof raw.v === "number" ? raw.v : 1, id: typeof raw.id === "string" ? raw.id : undefined, actions }
  } catch { /* not ours */ }
  return null
}
