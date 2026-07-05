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
export type Caption = { self: boolean; text: string } | null

export function useJarvisRoom() {
  const [state, setState] = useState<ConnState>("idle")
  const [error, setError] = useState<string | null>(null)
  const [latest, setLatest] = useState<RenderEnvelope | null>(null)
  const [caption, setCaption] = useState<Caption>(null)
  const [agentSpeaking, setAgentSpeaking] = useState(false)
  const [micOn, setMicOn] = useState(false)

  const roomRef = useRef<Room | null>(null)
  const audioEls = useRef<HTMLAudioElement[]>([])

  const connect = useCallback(async () => {
    if (roomRef.current) return
    setState("connecting"); setError(null)
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("livekit-token", { body: {} })
      if (fnErr || !data?.token) throw new Error(data?.error || fnErr?.message || "no se pudo obtener el token")

      const room = new Room({ adaptiveStream: true, dynacast: true })
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
        .on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
          const localId = room.localParticipant.identity
          setAgentSpeaking(speakers.some((s) => s.identity !== localId))
        })
        .on(RoomEvent.TranscriptionReceived, (segs: TranscriptionSegment[], p?: Participant) => {
          const seg = segs[segs.length - 1]
          if (!seg?.text) return
          setCaption({ self: p?.identity === room.localParticipant.identity, text: seg.text })
        })
        .on(RoomEvent.Disconnected, () => { setState("idle"); roomRef.current = null })

      await room.connect(data.url, data.token)
      setState("connected")
      try {
        await room.localParticipant.setMicrophoneEnabled(true)
        setMicOn(true)
      } catch {
        setMicOn(false)
        setError("Micrófono bloqueado por el sistema — oyes a JARVIS pero no puedes hablarle. Actívalo en Ajustes de Windows › Privacidad › Micrófono y pulsa MIC.")
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
    setState("idle")
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

  return { state, error, latest, caption, agentSpeaking, micOn, connect, disconnect, toggleMic }
}
