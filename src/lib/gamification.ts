// ─── Sistema de gamificación NES ──────────────────────────────────────────────
// Lógica pura, sin acoplar a React ni a Supabase. Fácil de testear.

export type ProfileMetrics = {
  connections: number   // conversaciones únicas iniciadas
  tasks_done: number    // tareas de Workflow completadas
  meetings: number      // reuniones confirmadas ya celebradas
  streak_days: number   // racha actual
  streak_best: number   // mejor marca histórica
  activity: { day: string; weight: number }[]  // últimos 84 días
}

export const EMPTY_METRICS: ProfileMetrics = {
  connections: 0,
  tasks_done: 0,
  meetings: 0,
  streak_days: 0,
  streak_best: 0,
  activity: [],
}

// ─── Rangos (progresión limpia y aspiracional) ───────────────────────────────
// El estatus se deriva del nº de personas conectadas. Sin almacenarlo en BD.
export type Rank = {
  name: string
  min: number   // conexiones necesarias para alcanzarlo
}

export const RANKS: Rank[] = [
  { name: "Explorador",   min: 0  },
  { name: "Conector",     min: 3  },
  { name: "Mentor",       min: 8  },
  { name: "Referente",    min: 20 },
  { name: "Pilar de NES", min: 50 },
]

export function getRank(connections: number): Rank {
  let current = RANKS[0]
  for (const r of RANKS) {
    if (connections >= r.min) current = r
  }
  return current
}

export function getNextRank(connections: number): Rank | null {
  return RANKS.find(r => r.min > connections) ?? null
}

// Progreso (0–1) dentro del tramo del rango actual hacia el siguiente.
export function getRankProgress(connections: number): number {
  const current = getRank(connections)
  const next = getNextRank(connections)
  if (!next) return 1
  const span = next.min - current.min
  if (span <= 0) return 1
  return Math.min(1, Math.max(0, (connections - current.min) / span))
}

// ─── Aportaciones (impacto comunitario) ───────────────────────────────────────
// Decidido con el usuario: reuniones celebradas + tareas completadas.
export function getContributions(m: Pick<ProfileMetrics, "tasks_done" | "meetings">): number {
  return m.tasks_done + m.meetings
}

// ─── Mapa de contribuciones (estilo GitHub, simplificado) ─────────────────────
// Devuelve una matriz [semana][díaSemana] con nivel de intensidad 0–3,
// alineada de forma que la última columna sea la semana actual y la última
// celda de esa columna sea hoy. weeks = nº de columnas (por defecto 12).
export type HeatLevel = 0 | 1 | 2 | 3

export function buildHeatmap(
  activity: { day: string; weight: number }[],
  weeks = 12,
  today = new Date(),
): HeatLevel[][] {
  const byDay = new Map<string, number>()
  for (const a of activity) byDay.set(a.day, a.weight)

  const level = (w: number): HeatLevel => {
    if (w <= 0) return 0
    if (w === 1) return 1
    if (w <= 3) return 2
    return 3
  }

  // Día de la semana de hoy con lunes = 0 … domingo = 6
  const dow = (today.getDay() + 6) % 7
  const totalCells = weeks * 7
  // La última celda es hoy → retrocedemos desde (totalCells-1 - (6-dow)) días.
  const offsetFromEnd = 6 - dow

  const cells: HeatLevel[] = []
  for (let i = 0; i < totalCells; i++) {
    const daysAgo = totalCells - 1 - offsetFromEnd - i
    if (daysAgo < 0) { cells.push(0); continue } // celdas futuras (esta semana)
    const d = new Date(today)
    d.setDate(d.getDate() - daysAgo)
    const key = d.toISOString().split("T")[0]
    cells.push(level(byDay.get(key) ?? 0))
  }

  // Reagrupar en columnas (semanas) de 7 celdas
  const grid: HeatLevel[][] = []
  for (let w = 0; w < weeks; w++) {
    grid.push(cells.slice(w * 7, w * 7 + 7))
  }
  return grid
}
