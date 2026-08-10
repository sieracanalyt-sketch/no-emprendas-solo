import { useCallback, useEffect, useRef, useState } from "react"
import type {
  LocalVideoTrack, RemoteParticipant, RemoteTrack, Room,
} from "livekit-client"
import { supabase } from "../supabase"
import Avatar from "../components/Avatar"
import { playCue, startRingtone, stopRingtone } from "./ringtones"
import { roomChannel, sendOnce } from "./signaling"
import type { ActiveCall } from "./CallProvider"

// ──────────────────────────────────────────────────────────────────────────────
// Llamada REAL por LiveKit (WebRTC). El audio/vídeo viaja por la misma
// infraestructura que MERGE; la señalización (ring/decline/cancel/hangup) va por
// Supabase Realtime. livekit-client se importa en diferido: solo paga su peso
// quien llama.
// ──────────────────────────────────────────────────────────────────────────────

type Status =
  | "ringing" | "connecting" | "connected"
  | "ended" | "declined" | "busy" | "missed" | "error"

type LK = typeof import("livekit-client")

function fmt(total: number): string {
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

/** El agente de voz de MERGE hace dispatch automático a TODAS las salas nuevas
 *  del proyecto LiveKit: si se cuela en una llamada, lo ignoramos por completo. */
function isAgent(p: { kind?: unknown; identity: string }): boolean {
  return String(p.kind) === "agent" || /^(agent|merge|nes-agent)/i.test(p.identity)
}

const STATUS_TEXT: Record<Status, string> = {
  ringing: "Llamando…",
  connecting: "Conectando…",
  connected: "Conectado",
  ended: "Llamada finalizada",
  declined: "Llamada rechazada",
  busy: "Comunicando… está en otra llamada",
  missed: "No contesta",
  error: "No se pudo conectar",
}

export default function CallModal({
  call, meId, onClose,
}: {
  call: ActiveCall
  meId: string
  onClose: () => void
}) {
  const isVideo = call.video
  const [status, setStatus] = useState<Status>(call.direction === "outgoing" ? "ringing" : "connecting")
  const [secs, setSecs] = useState(0)
  const [muted, setMuted] = useState(false)
  const [camOn, setCamOn] = useState(isVideo)
  const [remotes, setRemotes] = useState<RemoteParticipant[]>([])
  const [remoteVideos, setRemoteVideos] = useState<Map<string, RemoteTrack>>(new Map())
  const [localTrack, setLocalTrack] = useState<LocalVideoTrack | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const lkRef = useRef<LK | null>(null)
  const roomRef = useRef<Room | null>(null)
  const statusRef = useRef<Status>(status)
  statusRef.current = status
  const endedRef = useRef(false)
  const audioEls = useRef<HTMLAudioElement[]>([])
  const timerRef = useRef<number | null>(null)
  const ringTimeoutRef = useRef<number | null>(null)

  const isTerminal = (s: Status) =>
    s === "ended" || s === "declined" || s === "busy" || s === "missed" || s === "error"

  // ── Registrar la llamada en el chat 1:1 (perdida / cancelada) ───────────────
  const logCallMessage = useCallback(async (text: string) => {
    if (!call.chatId || !call.peer) return
    try {
      const sorted = [meId, call.peer.id].sort()
      await supabase.from("chats").upsert({
        id: call.chatId, user1_id: sorted[0], user2_id: sorted[1],
        updated_at: new Date().toISOString(),
      })
      await supabase.from("messages").insert({
        chat_id: call.chatId, from_uid: meId, to_uid: call.peer.id, text,
      })
    } catch { /* mejor-esfuerzo */ }
  }, [call.chatId, call.peer, meId])

  // ── Terminar (idempotente) ──────────────────────────────────────────────────
  const endCall = useCallback((s: Status, cue: "ended" | "declined" | null = "ended") => {
    if (endedRef.current) return
    endedRef.current = true
    stopRingtone()
    if (timerRef.current) window.clearInterval(timerRef.current)
    if (ringTimeoutRef.current) window.clearTimeout(ringTimeoutRef.current)
    if (cue) playCue(cue)
    setStatus(s)
    void roomRef.current?.disconnect()
    window.setTimeout(onClose, 1500)
  }, [onClose])

  const hangUp = useCallback(() => {
    if (endedRef.current) return
    if (statusRef.current === "ringing" && call.direction === "outgoing") {
      sendOnce(roomChannel(call.room), "cancel", { userId: meId })
      void logCallMessage(isVideo ? "🎥 Videollamada cancelada" : "📞 Llamada cancelada")
      endCall("ended")
    } else {
      sendOnce(roomChannel(call.room), "hangup", { userId: meId })
      endCall("ended")
    }
  }, [call.direction, call.room, meId, isVideo, logCallMessage, endCall])

  // ── Conexión LiveKit + señalización ─────────────────────────────────────────
  useEffect(() => {
    let cancelled = false

    if (call.direction === "outgoing") startRingtone("outgoing")

    // Canal de control de ESTA llamada
    const sig = supabase
      .channel(roomChannel(call.room))
      .on("broadcast", { event: "decline" }, ({ payload }) => {
        if (call.group) return // en grupo, que uno rechace no corta la llamada
        const busy = (payload as { reason?: string })?.reason === "busy"
        endCall(busy ? "busy" : "declined", "declined")
      })
      .on("broadcast", { event: "hangup" }, () => {
        if (!call.group) endCall("ended")
      })
      .subscribe()

    // Sin respuesta en 35 s → registrar perdida y cerrar
    if (call.direction === "outgoing") {
      ringTimeoutRef.current = window.setTimeout(() => {
        if (statusRef.current === "ringing") {
          sendOnce(roomChannel(call.room), "cancel", { userId: meId })
          void logCallMessage(isVideo ? "🎥 Videollamada perdida" : "📞 Llamada perdida")
          endCall("missed")
        }
      }, 35000)
    }

    const becomeConnected = () => {
      if (statusRef.current !== "ringing" && statusRef.current !== "connecting") return
      stopRingtone()
      playCue("connected")
      if (ringTimeoutRef.current) window.clearTimeout(ringTimeoutRef.current)
      setStatus("connected")
      timerRef.current = window.setInterval(() => setSecs((x) => x + 1), 1000)
    }

    ;(async () => {
      try {
        const { data, error } = await supabase.functions.invoke("livekit-token", {
          body: { room: call.room },
        })
        if (error || !data?.token) throw new Error(data?.error || error?.message || "sin token")
        if (cancelled) return

        const lk = await import("livekit-client")
        lkRef.current = lk
        if (cancelled) return

        const room = new lk.Room({
          adaptiveStream: true,
          dynacast: true,
          audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        })
        roomRef.current = room

        const refreshRemotes = () => {
          const rs = [...room.remoteParticipants.values()].filter((p) => !isAgent(p))
          setRemotes(rs)
          if (rs.length > 0) becomeConnected()
          else if (statusRef.current === "connected") {
            // El último se fue → fin de la llamada
            endCall("ended")
          }
        }

        room
          .on(lk.RoomEvent.ParticipantConnected, refreshRemotes)
          .on(lk.RoomEvent.ParticipantDisconnected, refreshRemotes)
          .on(lk.RoomEvent.TrackSubscribed, (track, _pub, participant) => {
            if (isAgent(participant)) return
            if (track.kind === lk.Track.Kind.Audio) {
              const el = track.attach() as HTMLAudioElement
              el.autoplay = true
              document.body.appendChild(el)
              audioEls.current.push(el)
            } else if (track.kind === lk.Track.Kind.Video) {
              setRemoteVideos((m) => new Map(m).set(participant.identity, track))
            }
          })
          .on(lk.RoomEvent.TrackUnsubscribed, (track, _pub, participant) => {
            track.detach().forEach((el) => el.remove())
            setRemoteVideos((m) => {
              if (!m.has(participant.identity)) return m
              const next = new Map(m)
              next.delete(participant.identity)
              return next
            })
          })
          .on(lk.RoomEvent.Disconnected, () => {
            if (!isTerminal(statusRef.current)) endCall("ended", null)
          })

        await room.connect(data.url, data.token)
        if (cancelled) { void room.disconnect(); return }

        refreshRemotes()

        try {
          await room.localParticipant.setMicrophoneEnabled(true)
        } catch {
          setNotice("Micrófono bloqueado por el navegador — te oyen en silencio. Actívalo en los permisos del sitio.")
          setMuted(true)
        }
        if (isVideo) {
          try {
            const pub = await room.localParticipant.setCameraEnabled(true)
            setLocalTrack((pub?.videoTrack as LocalVideoTrack) ?? null)
          } catch {
            setCamOn(false)
            setNotice("Cámara no disponible — la llamada sigue solo con audio.")
          }
        }
      } catch (e) {
        if (!cancelled) {
          setNotice(e instanceof Error ? e.message : String(e))
          endCall("error", null)
        }
      }
    })()

    return () => {
      cancelled = true
      stopRingtone()
      if (timerRef.current) window.clearInterval(timerRef.current)
      if (ringTimeoutRef.current) window.clearTimeout(ringTimeoutRef.current)
      audioEls.current.forEach((el) => el.remove())
      audioEls.current = []
      void supabase.removeChannel(sig)
      void roomRef.current?.disconnect()
      roomRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call.room])

  // ── Controles ───────────────────────────────────────────────────────────────
  const toggleMute = async () => {
    const room = roomRef.current
    if (!room) return
    const next = !muted
    try {
      await room.localParticipant.setMicrophoneEnabled(!next)
      setMuted(next)
    } catch { /* permiso denegado */ }
  }

  const toggleCam = async () => {
    const room = roomRef.current
    if (!room) return
    const next = !camOn
    try {
      const pub = await room.localParticipant.setCameraEnabled(next)
      setCamOn(next)
      setLocalTrack(next ? ((pub?.videoTrack as LocalVideoTrack) ?? null) : null)
    } catch { /* sin cámara */ }
  }

  const title = call.group ? call.group.name : call.peer?.nombre ?? "Usuario"
  const connectedText =
    status === "connected"
      ? call.group
        ? `${remotes.length + 1} en la llamada · ${fmt(secs)}`
        : `Conectado · ${fmt(secs)}`
      : STATUS_TEXT[status]

  const showVideoStage = isVideo && (status === "connected" || status === "ringing" || status === "connecting")

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center sm:p-4 animate-in"
      style={{ background: "rgba(8,9,11,0.62)", backdropFilter: "blur(14px) saturate(140%)" }}
    >
      <div
        className={`relative flex flex-col overflow-hidden w-full h-full sm:h-auto sm:rounded-2xl ${isVideo ? "sm:max-w-2xl" : "sm:max-w-sm"}`}
        style={{
          background: "rgba(17,18,20,0.92)",
          border: "1px solid var(--border-strong)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.55)",
        }}
      >
        {/* ── Escenario ── */}
        <div className="relative flex-1 flex flex-col items-center justify-center px-6 pt-10 pb-7"
          style={{ minHeight: isVideo ? 420 : 320 }}>

          {showVideoStage && remoteVideos.size > 0 ? (
            // Vídeos remotos
            <div className={`absolute inset-0 grid gap-1 ${remoteVideos.size > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
              {[...remoteVideos.entries()].map(([identity, track]) => (
                <VideoTile
                  key={identity}
                  track={track}
                  label={remotes.find((p) => p.identity === identity)?.name || call.peer?.nombre || "Participante"}
                />
              ))}
            </div>
          ) : (
            // Voz (o vídeo aún sin señal): avatar + estado
            <>
              <div className="relative mb-5">
                {(status === "ringing" || status === "connecting") && (
                  <span className="absolute inset-0 rounded-full animate-ping" style={{ background: "rgba(194, 84, 47,0.35)" }} />
                )}
                <div className="relative">
                  <Avatar name={title} src={call.peer?.avatar} size={96} group={!!call.group} />
                </div>
              </div>
              {status === "connected" && call.group && remotes.length > 0 && (
                <div className="flex items-center gap-1.5 mb-3 flex-wrap justify-center">
                  {remotes.map((p) => (
                    <span key={p.identity} className="text-[11px] px-2 py-0.5 rounded-full"
                      style={{ background: "rgba(255,255,255,0.07)", color: "var(--text-dim)", border: "1px solid var(--border)" }}>
                      {p.name || "Participante"}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Nombre + estado (superpuesto en vídeo) */}
          <div className={showVideoStage && remoteVideos.size > 0
            ? "absolute top-3 left-4 z-10 text-left"
            : "relative text-center"}>
            <p className="text-[17px] font-semibold text-white" style={{ textShadow: "0 1px 8px rgba(0,0,0,0.8)" }}>
              {title}
            </p>
            <p className="text-[13px] mt-0.5" style={{ color: status === "connected" ? "#9a9d78" : "var(--text-dim)", textShadow: "0 1px 6px rgba(0,0,0,0.8)" }}>
              {connectedText}
            </p>
          </div>

          {/* Auto-vista local */}
          {isVideo && !isTerminal(status) && (
            <div
              className="absolute bottom-4 right-4 w-24 h-32 sm:w-28 sm:h-36 rounded-lg overflow-hidden z-10"
              style={{ border: "1px solid var(--border-strong)", background: "#0a0b0c", boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}
            >
              {camOn && localTrack ? (
                <LocalPreview track={localTrack} />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[11px]" style={{ color: "var(--text-dimmer)" }}>
                  Cámara off
                </div>
              )}
            </div>
          )}
        </div>

        {notice && (
          <p className="px-5 py-2 text-[11.5px] text-center" style={{ color: "#f2994a", background: "rgba(242,153,74,0.08)", borderTop: "1px solid rgba(242,153,74,0.2)" }}>
            {notice}
          </p>
        )}

        {/* ── Controles ── */}
        <div
          className="flex items-center justify-center gap-3 px-6 py-5 shrink-0"
          style={{ borderTop: "1px solid var(--border)", background: "rgba(12,13,14,0.55)" }}
        >
          <CtrlButton active={muted} onClick={toggleMute} label={muted ? "Activar micro" : "Silenciar"}>
            {muted ? "🔇" : "🎙️"}
          </CtrlButton>

          {isVideo && (
            <CtrlButton active={!camOn} onClick={toggleCam} label={camOn ? "Apagar cámara" : "Encender cámara"}>
              {camOn ? "📹" : "🚫"}
            </CtrlButton>
          )}

          <button
            onClick={hangUp}
            className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl transition-transform hover:scale-105 active:scale-95"
            style={{ background: "#eb5757", boxShadow: "0 6px 20px rgba(235,87,87,0.4)" }}
            aria-label="Colgar"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Tiles de vídeo ────────────────────────────────────────────────────────────
function VideoTile({ track, label }: { track: RemoteTrack; label: string }) {
  const ref = useRef<HTMLVideoElement | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    track.attach(el)
    return () => { track.detach(el) }
  }, [track])
  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: "#0a0b0c" }}>
      <video ref={ref} autoPlay playsInline className="w-full h-full object-cover" />
      <span className="absolute bottom-2 left-2 text-[11px] px-2 py-0.5 rounded-md text-white"
        style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)" }}>
        {label}
      </span>
    </div>
  )
}

function LocalPreview({ track }: { track: LocalVideoTrack }) {
  const ref = useRef<HTMLVideoElement | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    track.attach(el)
    return () => { track.detach(el) }
  }, [track])
  return (
    <video ref={ref} autoPlay muted playsInline className="w-full h-full object-cover" style={{ transform: "scaleX(-1)" }} />
  )
}

function CtrlButton({
  children, onClick, active, label,
}: {
  children: React.ReactNode
  onClick: () => void
  active: boolean
  label: string
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="w-12 h-12 rounded-full flex items-center justify-center text-base transition"
      style={{
        background: active ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.06)",
        border: "1px solid var(--border-strong)",
      }}
    >
      {children}
    </button>
  )
}
