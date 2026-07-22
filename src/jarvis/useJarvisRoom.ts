import { useCallback, useEffect, useRef, useState } from "react"
import {
  Room, RoomEvent, Track,
  type RemoteTrack, type TranscriptionSegment, type Participant,
} from "livekit-client"
import { supabase } from "../supabase"
import { RENDER_TOPIC, parseRenderEvent, type RenderEnvelope } from "./contract"

// Owns the LiveKit connection for the JARVIS cockpit:
//   • token from the `livekit-token` Edge Function
//   • publishes the mic, plays JARVIS's voice
//   • surfaces the latest render event (topic aios.render)
// Mic is best-effort: a blocked mic never drops the session.

export type ConnState = "idle" | "connecting" | "connected" | "error"
// What MERGE is doing right now, from LiveKit's `lk.agent.state` attribute.
export type AgentState = "idle" | "connecting" | "listening" | "thinking" | "speaking"
// One utterance in the live transcript. Segments arrive incrementally from LiveKit
// (same id, growing text) so the words appear on screen as they are spoken —
// ChatGPT-style streaming, but synced with the actual voice.
export type TranscriptMsg = { id: string; self: boolean; text: string; final: boolean; ts: number }

// Small audio cue via Web Audio (no asset needed):
//  · "ready"  → two-tone chime when the session connects (you can start talking)
//  · "listen" → soft blip when MERGE finishes speaking (your turn)
function playCue(kind: "ready" | "listen") {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new AC()
    const now = ctx.currentTime
    const tones = kind === "ready" ? [523, 784] : [660]
    tones.forEach((f, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain()
      o.type = "sine"; o.frequency.value = f
      o.connect(g); g.connect(ctx.destination)
      const t = now + i * 0.11
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.14, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.19)
      o.start(t); o.stop(t + 0.22)
    })
    setTimeout(() => { void ctx.close() }, 700)
  } catch { /* audio unavailable — ignore */ }
}

export function useJarvisRoom() {
  const [state, setState] = useState<ConnState>("idle")
  const [error, setError] = useState<string | null>(null)
  const [latest, setLatest] = useState<RenderEnvelope | null>(null)
  const [transcript, setTranscript] = useState<TranscriptMsg[]>([])
  const [agentState, setAgentState] = useState<AgentState>("idle")
  const [micOn, setMicOn] = useState(false)

  const roomRef = useRef<Room | null>(null)
  const audioEls = useRef<HTMLAudioElement[]>([])

  const connect = useCallback(async () => {
    if (roomRef.current) return
    setState("connecting"); setError(null); setAgentState("connecting"); setTranscript([])
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("livekit-token", { body: {} })
      if (fnErr || !data?.token) throw new Error(data?.error || fnErr?.message || "no se pudo obtener el token")

      // echoCancellation explícito: sin él, el micro puede captar la propia voz de
      // MERGE por los altavoces y el agente se auto-interrumpe a mitad de frase.
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      roomRef.current = room

      room
        .on(RoomEvent.DataReceived, (payload, _p, _k, topic) => {
          if (topic !== RENDER_TOPIC) return
          const evt = parseRenderEvent(payload)
          if (evt) setLatest(evt)
        })
        .on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
          if (track.kind === Track.Kind.Audio) {
            const el = track.attach() as HTMLAudioElement
            el.autoplay = true
            document.body.appendChild(el)
            audioEls.current.push(el)
          }
        })
        .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
          track.detach().forEach((el) => el.remove())
        })
        // MERGE reports what it's doing via the `lk.agent.state` attribute.
        // Drive the on-screen indicator (listening / thinking / speaking) from it,
        // and blip the moment it starts listening — that's your cue to talk.
        .on(RoomEvent.ParticipantAttributesChanged, (changed, p) => {
          if (p.identity === room.localParticipant.identity) return
          const raw = changed["lk.agent.state"]
          if (!raw) return
          const next: AgentState =
            raw === "speaking" ? "speaking" :
            raw === "thinking" ? "thinking" :
            raw === "listening" ? "listening" : "connecting"
          setAgentState((prev) => { if (prev !== "listening" && next === "listening") playCue("listen"); return next })
        })
        .on(RoomEvent.TranscriptionReceived, (segs: TranscriptionSegment[], p?: Participant) => {
          const self = p?.identity === room.localParticipant.identity
          // Upsert each segment by id: LiveKit re-sends the same segment with more
          // text as the speech progresses, which is what animates the words in.
          setTranscript((prev) => {
            const next = [...prev]
            for (const seg of segs) {
              if (!seg.text) continue
              const i = next.findIndex((m) => m.id === seg.id)
              // ts is the FIRST arrival time of the segment (stable while it grows),
              // so the UI can split visual paragraphs on real conversational pauses.
              const msg: TranscriptMsg = { id: seg.id, self, text: seg.text, final: seg.final, ts: i >= 0 ? next[i].ts : Date.now() }
              if (i >= 0) next[i] = msg
              else next.push(msg)
            }
            return next.slice(-40) // bounded history
          })
        })
        .on(RoomEvent.Disconnected, () => { setState("idle"); setAgentState("idle"); roomRef.current = null })

      await room.connect(data.url, data.token)
      setState("connected")
      playCue("ready") // audible "ready to listen" cue
      try {
        await room.localParticipant.setMicrophoneEnabled(true)
        setMicOn(true)
      } catch {
        setMicOn(false)
        setError("Micrófono bloqueado por el sistema — oyes a MERGE pero no puedes hablarle. Actívalo en Ajustes de Windows › Privacidad › Micrófono y pulsa el botón del micro.")
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setState("error")
      roomRef.current = null
    }
  }, [])

  const disconnect = useCallback(async () => {
    await roomRef.current?.disconnect()
    roomRef.current = null
    setState("idle"); setAgentState("idle")
  }, [])

  // Fire a one-shot command to the agent (e.g. the Matchmaking button).
  // The agent listens on the "merge.cmd" data topic and runs the real action.
  const sendCommand = useCallback((cmd: string) => {
    const room = roomRef.current
    if (!room) return
    const payload = new TextEncoder().encode(JSON.stringify({ cmd }))
    void room.localParticipant.publishData(payload, { reliable: true, topic: "merge.cmd" })
  }, [])

  // Envía al agente el contexto del usuario (agenda + workflow, NUNCA mensajes)
  // por el topic "merge.context". Silencioso: no aparece en el transcript. El
  // agente lo usa como contexto para responder sobre calendario y tareas.
  const sendContext = useCallback((context: unknown) => {
    const room = roomRef.current
    if (!room) return
    const payload = new TextEncoder().encode(JSON.stringify(context))
    void room.localParticipant.publishData(payload, { reliable: true, topic: "merge.context" })
  }, [])

  // Dual input: typed messages go over LiveKit's "lk.chat" text stream, which the
  // agent treats as a user turn (text input is on by default in Agents 1.x). The
  // typed turn is echoed into the transcript immediately — STT never sees it, so
  // without this the user's own words would never appear on screen.
  const sendText = useCallback(async (text: string) => {
    const room = roomRef.current
    const t = text.trim()
    if (!room || !t) return
    setTranscript((prev) =>
      [...prev, { id: `typed-${Date.now()}`, self: true, text: t, final: true, ts: Date.now() }].slice(-40))
    try {
      await room.localParticipant.sendText(t, { topic: "lk.chat" })
    } catch {
      setError("No pude enviar el mensaje — ¿sigue conectada la sesión?")
    }
  }, [])

  const toggleMic = useCallback(async () => {
    const room = roomRef.current
    if (!room) return
    const next = !micOn
    try {
      await room.localParticipant.setMicrophoneEnabled(next)
      setMicOn(next)
      if (next) setError(null)
    } catch {
      setMicOn(false)
      setError("El sistema sigue bloqueando el micrófono.")
    }
  }, [micOn])

  useEffect(() => () => {
    roomRef.current?.disconnect()
    audioEls.current.forEach((el) => el.remove())
  }, [])

  return { state, error, latest, transcript, agentState, micOn, connect, disconnect, toggleMic, sendCommand, sendContext, sendText }
}
