// ──────────────────────────────────────────────────────────────────────────────
// Señalización de llamadas sobre Supabase Realtime (broadcast).
//
//  · Cada usuario escucha su canal personal `nes-ring-<uid>` → recibe "ring".
//  · Cada llamada tiene su canal de sala `nes-call-<room>` → "decline" | "cancel"
//    | "hangup" entre las partes. El audio/vídeo real va por LiveKit; por aquí
//    solo viajan eventos de control.
// ──────────────────────────────────────────────────────────────────────────────
import { supabase } from "../supabase"

export type CallKind = "voice" | "video"

export type CallPeer = { id: string; nombre: string; avatar: string | null }

export type RingPayload = {
  room: string
  video: boolean
  from: CallPeer
  /** Presente cuando es una llamada de grupo */
  group?: { id: string; name: string } | null
}

export const personalChannel = (userId: string) => `nes-ring-${userId}`
export const roomChannel = (room: string) => `nes-call-${room}`

/** Nombre de sala único y no adivinable (validado por la edge function). */
export function makeCallRoom(): string {
  return `call-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 12)}`
}

/**
 * Envía un broadcast puntual a un canal al que no estamos suscritos:
 * suscribe → envía → limpia. Usado para el "ring" inicial y respuestas cortas.
 */
export function sendOnce(channelName: string, event: string, payload: unknown): void {
  const ch = supabase.channel(channelName)
  let done = false
  const cleanup = () => {
    if (!done) {
      done = true
      window.setTimeout(() => void supabase.removeChannel(ch), 400)
    }
  }
  ch.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      void ch.send({ type: "broadcast", event, payload }).finally(cleanup)
    } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
      cleanup()
    }
  })
  // Cinturón de seguridad por si el subscribe nunca resuelve
  window.setTimeout(cleanup, 5000)
}
