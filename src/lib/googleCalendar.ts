import { type CalEvent, addDays, startOfWeek } from "./calendarUtils"

// ──────────────────────────────────────────────────────────────────────────────
// Google Calendar — integración real con OAuth 2.0 (Google Identity Services)
//
// SETUP (solo una vez):
// 1. https://console.cloud.google.com → nuevo proyecto
// 2. "APIs y servicios" → habilitar "Google Calendar API"
// 3. Credenciales → Crear → ID de cliente OAuth 2.0 → tipo "Aplicación web"
// 4. Añadir en "Orígenes JS autorizados":
//      http://localhost:5173   (desarrollo)
//      https://no-emprendas-solo.vercel.app   (producción)
// 5. Copiar el Client ID en .env.local: VITE_GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
// ──────────────────────────────────────────────────────────────────────────────

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: {
            client_id: string
            scope: string
            prompt?: string
            login_hint?: string
            callback: (resp: { access_token?: string; error?: string }) => void
            error_callback?: (err: { type: string }) => void
          }): { requestAccessToken(overrides?: { prompt?: string; login_hint?: string }): void }
        }
      }
    }
  }
}

const SCOPES = "https://www.googleapis.com/auth/calendar openid email"
const STORAGE_KEY = "nes:gcal"
const CLIENT_ID_KEY = "nes:gcal-client-id"
const CAL = "https://www.googleapis.com/calendar/v3"

/** Lee el Client ID desde env (build time) o desde localStorage (runtime paste). */
function getClientId(): string {
  return (
    (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() ||
    localStorage.getItem(CLIENT_ID_KEY)?.trim() ||
    ""
  )
}

/** Guarda el Client ID en localStorage para uso inmediato sin reiniciar. */
export function saveClientId(id: string): void {
  if (id.trim()) localStorage.setItem(CLIENT_ID_KEY, id.trim())
}

export type GoogleSyncState = {
  connected: boolean
  email: string | null
  lastSync: string | null
  /** true cuando el access token está en memoria (se pierde al recargar la página) */
  tokenLoaded: boolean
}

// Token SOLO en memoria — nunca en localStorage
let _token: string | null = null

export function hasClientId(): boolean {
  return getClientId().length > 0
}

export function getAccessToken(): string | null {
  return _token
}

export function getGoogleState(): GoogleSyncState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const s = JSON.parse(raw)
      return { connected: !!s.connected, email: s.email ?? null, lastSync: s.lastSync ?? null, tokenLoaded: !!_token }
    }
  } catch { /* noop */ }
  return { connected: false, email: null, lastSync: null, tokenLoaded: false }
}

function persist(s: Omit<GoogleSyncState, "tokenLoaded">) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}

// ── Esperar a que el script de Google cargue (async) ────────────────────────
function waitForGSI(ms = 6000): Promise<void> {
  return new Promise((res, rej) => {
    if (window.google?.accounts?.oauth2) { res(); return }
    const start = Date.now()
    const iv = window.setInterval(() => {
      if (window.google?.accounts?.oauth2) { clearInterval(iv); res() }
      else if (Date.now() - start > ms) { clearInterval(iv); rej(new Error("Google Identity Services no se cargó. Comprueba tu conexión.")) }
    }, 150)
  })
}

// ── OAuth: abre el popup de Google y devuelve el estado ─────────────────────
// `silent: true` intenta renovar el token SIN interacción (iframe oculto de GIS):
// funciona si el usuario ya dio permiso antes y tiene sesión de Google abierta.
export async function connectGoogle(opts: { silent?: boolean } = {}): Promise<GoogleSyncState> {
  const clientId = getClientId()
  if (!clientId) {
    throw new Error("No hay Client ID configurado.")
  }
  await waitForGSI()

  const knownEmail = getGoogleState().email

  return new Promise<GoogleSyncState>((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: async (resp) => {
        if (resp.error || !resp.access_token) {
          reject(new Error(resp.error ?? "Sin token"))
          return
        }
        _token = resp.access_token

        // Obtener email del usuario desde Google
        let email: string | null = null
        try {
          const ui = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: { Authorization: `Bearer ${_token}` },
          }).then((r) => r.json())
          email = ui.email ?? null
        } catch { /* email queda null */ }

        const state: GoogleSyncState = {
          connected: true,
          email: email ?? knownEmail,
          lastSync: new Date().toISOString(),
          tokenLoaded: true,
        }
        persist(state)
        resolve(state)
      },
      error_callback: (err) => {
        if (err.type === "popup_closed") reject(new Error("Popup cerrado por el usuario"))
        else reject(new Error(err.type))
      },
    })
    // prompt "" → Google solo muestra UI si de verdad hace falta (primera vez).
    // login_hint evita el selector de cuentas en reconexiones.
    client.requestAccessToken(
      opts.silent && knownEmail ? { prompt: "", login_hint: knownEmail } : undefined,
    )
  })
}

/** Reintento silencioso al cargar la página: devuelve null si requiere interacción. */
export async function reconnectGoogleSilent(): Promise<GoogleSyncState | null> {
  const s = getGoogleState()
  if (!s.connected || s.tokenLoaded || !hasClientId()) return null
  try {
    return await connectGoogle({ silent: true })
  } catch {
    return null
  }
}

export async function disconnectGoogle(): Promise<GoogleSyncState> {
  _token = null
  const s: GoogleSyncState = { connected: false, email: null, lastSync: null, tokenLoaded: false }
  persist(s)
  return s
}

export async function markSynced(): Promise<GoogleSyncState> {
  const cur = getGoogleState()
  const s = { ...cur, lastSync: new Date().toISOString() }
  persist(s)
  return s
}

// ── Leer eventos reales del Google Calendar ──────────────────────────────────
export async function pullGoogleEvents(weekRef: Date, ownerId: string): Promise<CalEvent[]> {
  if (!_token) return []

  const ws = startOfWeek(weekRef)
  const we = addDays(ws, 7)

  try {
    const params = new URLSearchParams({
      timeMin: ws.toISOString(),
      timeMax: we.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "200",
    })
    const res = await fetch(`${CAL}/calendars/primary/events?${params}`, {
      headers: { Authorization: `Bearer ${_token}` },
    })
    if (res.status === 401) { _token = null; return [] }
    if (!res.ok) return []

    const data = await res.json()
    const items: GoogleEventItem[] = data.items ?? []
    return items
      .filter((it) => it.status !== "cancelled")
      .map((it) => gItemToCalEvent(it, ownerId))
      .filter(Boolean) as CalEvent[]
  } catch {
    return []
  }
}

// ── Crear evento en Google Calendar ─────────────────────────────────────────
export async function pushEventToGoogle(ev: CalEvent): Promise<{ google_id: string }> {
  if (!_token) return { google_id: "" }
  try {
    const res = await fetch(`${CAL}/calendars/primary/events`, {
      method: "POST",
      headers: { Authorization: `Bearer ${_token}`, "Content-Type": "application/json" },
      body: JSON.stringify(calEventToGItem(ev)),
    })
    if (!res.ok) return { google_id: "" }
    const created = await res.json()
    return { google_id: created.id ?? "" }
  } catch {
    return { google_id: "" }
  }
}

// ── Actualizar evento en Google Calendar ────────────────────────────────────
export async function updateGoogleEvent(
  googleId: string,
  patch: { start_at?: string; end_at?: string; title?: string; description?: string }
): Promise<void> {
  if (!_token || !googleId) return
  try {
    const body: Record<string, unknown> = {}
    if (patch.title) body.summary = patch.title
    if (patch.description !== undefined) body.description = patch.description
    if (patch.start_at) body.start = { dateTime: patch.start_at, timeZone: "UTC" }
    if (patch.end_at) body.end = { dateTime: patch.end_at, timeZone: "UTC" }
    await fetch(`${CAL}/calendars/primary/events/${googleId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${_token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  } catch { /* fallo silencioso — cambio local preservado */ }
}

// ── Eliminar evento de Google Calendar ──────────────────────────────────────
export async function deleteGoogleEvent(googleId: string): Promise<void> {
  if (!_token || !googleId) return
  try {
    await fetch(`${CAL}/calendars/primary/events/${googleId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${_token}` },
    })
  } catch { /* noop */ }
}

// ── Helpers de conversión ─────────────────────────────────────────────────────
type GoogleEventItem = {
  id: string
  summary?: string
  description?: string
  status?: string
  start?: { dateTime?: string; date?: string }
  end?: { dateTime?: string; date?: string }
}

function gItemToCalEvent(it: GoogleEventItem, ownerId: string): CalEvent | null {
  const startRaw = it.start?.dateTime ?? it.start?.date
  const endRaw = it.end?.dateTime ?? it.end?.date
  if (!startRaw || !endRaw) return null

  let startIso: string
  let endIso: string

  if (it.start?.dateTime) {
    // Evento con hora específica
    startIso = it.start.dateTime
    endIso = it.end?.dateTime ?? endRaw
  } else {
    // Evento de día completo → representar como 09:00-10:00
    const d = new Date(startRaw + "T09:00:00")
    const e = new Date(startRaw + "T10:00:00")
    startIso = d.toISOString()
    endIso = e.toISOString()
  }

  return {
    id: `gcal-${it.id}`,
    owner_id: ownerId,
    title: it.summary ?? "(Sin título)",
    description: it.description ?? "",
    start_at: startIso,
    end_at: endIso,
    color: "#16a34a",
    status: "confirmed",
    kind: "event",
    attendees: [],
    expires_at: null,
    proposal_for: null,
    source: "google",
    google_id: it.id,
    task_id: null,
    prep_answers: null,
    urgent: false,
    created_at: new Date().toISOString(),
  }
}

function calEventToGItem(ev: CalEvent) {
  return {
    summary: ev.title,
    description: ev.description ?? "",
    start: { dateTime: ev.start_at, timeZone: "UTC" },
    end: { dateTime: ev.end_at, timeZone: "UTC" },
  }
}
