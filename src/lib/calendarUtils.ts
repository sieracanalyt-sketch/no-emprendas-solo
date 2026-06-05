// ──────────────────────────────────────────────────────────────────────────────
// Utilidades del calendario: rejilla horaria, huecos, zonas horarias, scoring.
// ──────────────────────────────────────────────────────────────────────────────

export type CalEvent = {
  id: string
  owner_id: string
  title: string
  description: string | null
  start_at: string
  end_at: string
  color: string | null
  status: "confirmed" | "proposed" | "tentative" | "cancelled"
  kind: "event" | "meeting" | "focus" | "task"
  attendees: string[]
  expires_at: string | null
  proposal_for: string | null
  source: "local" | "google"
  google_id: string | null
  task_id: string | null
  prep_answers: unknown | null
  urgent: boolean
  created_at: string
}

// Rejilla
export const START_HOUR = 7
export const END_HOUR = 22
export const HOUR_H = 56 // px por hora
export const SNAP_MIN = 15
export const GRID_HEIGHT = (END_HOUR - START_HOUR) * HOUR_H

export const DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]

export function startOfWeek(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  const day = (x.getDay() + 6) % 7 // 0 = lunes
  x.setDate(x.getDate() - day)
  return x
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/** minutos desde medianoche → px (relativo al inicio de la rejilla). */
export function minutesToY(min: number): number {
  return ((min - START_HOUR * 60) / 60) * HOUR_H
}

/** px (desde el inicio de la rejilla) → minutos desde medianoche, con snap. */
export function yToMinutes(y: number): number {
  const raw = (y / HOUR_H) * 60 + START_HOUR * 60
  const snapped = Math.round(raw / SNAP_MIN) * SNAP_MIN
  return Math.max(START_HOUR * 60, Math.min(END_HOUR * 60, snapped))
}

export function minutesOfDay(iso: string): number {
  const d = new Date(iso)
  return d.getHours() * 60 + d.getMinutes()
}

export function fmtHour(h: number): string {
  return `${String(h).padStart(2, "0")}:00`
}

export function fmtClock(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
}

export function durationMin(e: { start_at: string; end_at: string }): number {
  return (new Date(e.end_at).getTime() - new Date(e.start_at).getTime()) / 60000
}

// ── Lane packing (eventos solapados lado a lado) ──────────────────────────────
export type Positioned = { ev: CalEvent; lane: number; lanes: number }

export function layoutDay(events: CalEvent[]): Positioned[] {
  const sorted = [...events].sort(
    (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
  )
  const laneEnds: number[] = []
  const placed: { ev: CalEvent; lane: number; start: number; end: number }[] = []

  for (const ev of sorted) {
    const start = new Date(ev.start_at).getTime()
    const end = new Date(ev.end_at).getTime()
    let lane = laneEnds.findIndex((e) => e <= start)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(end)
    } else {
      laneEnds[lane] = end
    }
    placed.push({ ev, lane, start, end })
  }

  // nº de carriles solapados por evento (clusters de solapamiento)
  return placed.map((p) => {
    const overlapping = placed.filter((q) => q.start < p.end && q.end > p.start)
    const lanes = Math.max(...overlapping.map((q) => q.lane)) + 1
    return { ev: p.ev, lane: p.lane, lanes }
  })
}

// ── Huecos / Zonas de Enfoque (T2-5) ──────────────────────────────────────────
export type Gap = { startMin: number; endMin: number }

/** Huecos libres del día dentro de la franja laboral (en minutos). */
export function freeGaps(
  events: CalEvent[],
  dayStartMin = START_HOUR * 60,
  dayEndMin = END_HOUR * 60
): Gap[] {
  const busy = events
    .filter((e) => e.status !== "cancelled")
    .map((e) => ({ s: minutesOfDay(e.start_at), e: minutesOfDay(e.end_at) }))
    .sort((a, b) => a.s - b.s)

  const gaps: Gap[] = []
  let cursor = dayStartMin
  for (const b of busy) {
    if (b.s > cursor) gaps.push({ startMin: cursor, endMin: Math.min(b.s, dayEndMin) })
    cursor = Math.max(cursor, b.e)
    if (cursor >= dayEndMin) break
  }
  if (cursor < dayEndMin) gaps.push({ startMin: cursor, endMin: dayEndMin })
  return gaps.filter((g) => g.endMin > g.startMin)
}

/** Huecos comunes a TODOS los conjuntos de eventos (Fusión de Calendarios T2-3). */
export function commonFreeGaps(eventSets: CalEvent[][]): Gap[] {
  let acc: Gap[] = [{ startMin: START_HOUR * 60, endMin: END_HOUR * 60 }]
  for (const set of eventSets) {
    const setGaps = freeGaps(set)
    const next: Gap[] = []
    for (const a of acc) {
      for (const g of setGaps) {
        const s = Math.max(a.startMin, g.startMin)
        const e = Math.min(a.endMin, g.endMin)
        if (e > s) next.push({ startMin: s, endMin: e })
      }
    }
    acc = next
  }
  return acc
}

// ── IA Predictiva de Asistencia (T1-15) — determinista por id ──────────────────
export function attendanceScore(userId: string): { punctual: number; attendance: number } {
  let h = 0
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0
  const punctual = 72 + (h % 27) // 72–98 %
  const attendance = 80 + ((h >> 3) % 20) // 80–99 %
  return { punctual, attendance }
}

// ── Zona horaria (T1-14) ───────────────────────────────────────────────────────
export const TIMEZONES = [
  { id: "Europe/Madrid", label: "Madrid" },
  { id: "Europe/London", label: "Londres" },
  { id: "America/New_York", label: "Nueva York" },
  { id: "America/Los_Angeles", label: "Los Ángeles" },
  { id: "America/Argentina/Buenos_Aires", label: "Buenos Aires" },
  { id: "Asia/Tokyo", label: "Tokio" },
]

export function timeInTz(iso: string, tz: string): { time: string; isDay: boolean } {
  const d = new Date(iso)
  const time = d.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz,
  })
  const hourStr = d.toLocaleString("en-US", { hour: "2-digit", hour12: false, timeZone: tz })
  const hour = parseInt(hourStr, 10)
  return { time, isDay: hour >= 7 && hour < 20 }
}

export function fmtRangeMin(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}
