// ──────────────────────────────────────────────────────────────────────────────
// MATRIZ DE EISENHOWER — lógica de espejo sincronizado
//
// La matriz NO duplica tareas: es una "vista" del mismo estado del Kanban.
// El cuadrante se DERIVA de (priority + status + due_date) salvo que la tarea
// tenga un `eisenhower_quadrant` explícito (override por arrastre en la matriz).
//
// Eje IMPORTANCIA  → priority (Urgente/Alta = importante)
// Eje URGENCIA     → status "progress" · priority "Urgente" · fecha límite cercana
// ──────────────────────────────────────────────────────────────────────────────

export type Quadrant = 1 | 2 | 3 | 4

// Forma mínima que necesita el motor de cuadrantes (desacoplado del tipo Task).
export type EisenhowerTask = {
  priority: "Urgente" | "Alta" | "Media" | "Baja"
  status: "backlog" | "progress" | "review" | "done"
  due_date: string | null
  eisenhower_quadrant?: number | null
}

export type QuadrantMeta = {
  q: Quadrant
  title: string
  subtitle: string
  action: string
  color: string
  emoji: string
}

// Orden de lectura natural: Q1 arriba-izq, Q2 arriba-der, Q3 abajo-izq, Q4 abajo-der.
export const QUADRANTS: QuadrantMeta[] = [
  { q: 1, title: "Hacer ahora",  subtitle: "Urgente · Importante",       action: "Hazlo ya",          color: "#eb5757", emoji: "🔥" },
  { q: 2, title: "Planificar",   subtitle: "Importante · No urgente",    action: "Agenda tiempo",     color: "#c2542f", emoji: "🗓️" },
  { q: 3, title: "Delegar",      subtitle: "Urgente · No importante",    action: "Delega o agrupa",   color: "#e2b93b", emoji: "🤝" },
  { q: 4, title: "Eliminar",     subtitle: "Ni urgente · Ni importante", action: "Backlog / descartar", color: "#c7c2b3", emoji: "🧹" },
]

export const QUADRANT_BY_ID: Record<Quadrant, QuadrantMeta> =
  QUADRANTS.reduce((acc, m) => { acc[m.q] = m; return acc }, {} as Record<Quadrant, QuadrantMeta>)

const DUE_SOON_MS = 48 * 60 * 60 * 1000 // 48 h

function isImportant(t: EisenhowerTask): boolean {
  return t.priority === "Urgente" || t.priority === "Alta"
}

function parseDueDate(dateStr: string): number {
  // "YYYY-MM-DD" sin hora → parsear como medianoche local (no UTC)
  const parts = dateStr.split("T")[0].split("-").map(Number)
  if (parts.length === 3) return new Date(parts[0], parts[1] - 1, parts[2]).getTime()
  return new Date(dateStr).getTime()
}

function isUrgent(t: EisenhowerTask): boolean {
  if (t.priority === "Urgente" || t.status === "progress") return true
  if (!t.due_date) return false
  const diff = parseDueDate(t.due_date) - Date.now()
  return diff <= DUE_SOON_MS // vencida o a <48h
}

/** Cuadrante efectivo: respeta el override explícito; si no, lo deriva. */
export function deriveQuadrant(t: EisenhowerTask): Quadrant {
  const explicit = t.eisenhower_quadrant
  if (explicit === 1 || explicit === 2 || explicit === 3 || explicit === 4) return explicit
  const important = isImportant(t)
  const urgent = isUrgent(t)
  if (important && urgent) return 1
  if (important && !urgent) return 2
  if (!important && urgent) return 3
  return 4
}

/** Prioridad que corresponde a cada cuadrante (al arrastrar en la matriz). */
export function priorityForQuadrant(q: Quadrant): EisenhowerTask["priority"] {
  switch (q) {
    case 1: return "Urgente"
    case 2: return "Alta"
    case 3: return "Media"
    case 4: return "Baja"
  }
}

/** Los cuadrantes 1 y 3 son el eje "urgente". */
export function isUrgentQuadrant(q: Quadrant): boolean {
  return q === 1 || q === 3
}
