import { addDays, startOfWeek, type CalEvent } from "./calendarUtils"

// ──────────────────────────────────────────────────────────────────────────────
// Adaptador de Google Calendar — MOCK.
// Arquitectura lista para OAuth real: sustituir `connectGoogle` por el flujo
// `google.accounts.oauth2` y `pullGoogleEvents`/`pushEventToGoogle` por llamadas
// a `https://www.googleapis.com/calendar/v3/...`. La UI y los estados de
// sincronización (conectado, último sync, capa "google") ya están completos.
// ──────────────────────────────────────────────────────────────────────────────

export type GoogleSyncState = {
  connected: boolean
  email: string | null
  lastSync: string | null
}

const KEY = "nes:gcal"

export function getGoogleState(): GoogleSyncState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* noop */
  }
  return { connected: false, email: null, lastSync: null }
}

function save(s: GoogleSyncState) {
  localStorage.setItem(KEY, JSON.stringify(s))
}

/** Simula el popup de consentimiento OAuth. */
export async function connectGoogle(email = "asierfelicescabrero@gmail.com"): Promise<GoogleSyncState> {
  await new Promise((r) => setTimeout(r, 1100))
  const s: GoogleSyncState = { connected: true, email, lastSync: new Date().toISOString() }
  save(s)
  return s
}

export async function disconnectGoogle(): Promise<GoogleSyncState> {
  const s: GoogleSyncState = { connected: false, email: null, lastSync: null }
  save(s)
  return s
}

export async function markSynced(): Promise<GoogleSyncState> {
  const s = { ...getGoogleState(), lastSync: new Date().toISOString() }
  save(s)
  return s
}

/** Empuja un evento local a Google (mock: resuelve tras un instante). */
export async function pushEventToGoogle(ev: CalEvent): Promise<{ google_id: string }> {
  await new Promise((r) => setTimeout(r, 250))
  return { google_id: `gcal_${ev.id.slice(0, 6)}_${Math.random().toString(36).slice(2, 8)}` }
}

/**
 * Trae eventos de Google para la semana (mock determinista).
 * Devuelve bloques source:"google" sólo para la vista — no se persisten.
 */
export async function pullGoogleEvents(weekRef: Date, ownerId: string): Promise<CalEvent[]> {
  await new Promise((r) => setTimeout(r, 450))
  const ws = startOfWeek(weekRef)

  const make = (
    dayOffset: number,
    h: number,
    m: number,
    durMin: number,
    title: string
  ): CalEvent => {
    const start = addDays(ws, dayOffset)
    start.setHours(h, m, 0, 0)
    const end = new Date(start.getTime() + durMin * 60000)
    return {
      id: `gcal-${dayOffset}-${h}${m}`,
      owner_id: ownerId,
      title,
      description: "Importado de Google Calendar",
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      color: "#16a34a",
      status: "confirmed",
      kind: "event",
      attendees: [],
      expires_at: null,
      proposal_for: null,
      source: "google",
      google_id: `gcal_seed_${dayOffset}_${h}`,
      task_id: null,
      prep_answers: null,
      urgent: false,
      created_at: new Date().toISOString(),
    }
  }

  return [
    make(0, 9, 0, 30, "Standup diario"),
    make(2, 16, 0, 60, "Sync con inversores"),
    make(4, 13, 30, 45, "Comida networking"),
  ]
}
