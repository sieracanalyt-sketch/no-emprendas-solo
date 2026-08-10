import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from "react"
import { supabase } from "../supabase"
import { useUser } from "../hooks/useUser"
import Avatar from "../components/Avatar"
import CallModal from "./CallModal"
import { startRingtone, stopRingtone } from "./ringtones"
import {
  makeCallRoom, personalChannel, roomChannel, sendOnce,
  type CallPeer, type RingPayload,
} from "./signaling"

// ──────────────────────────────────────────────────────────────────────────────
// Proveedor global de llamadas: cualquier página puede iniciar una llamada y
// cualquier usuario logueado recibe las entrantes (con melodía) esté donde esté.
// ──────────────────────────────────────────────────────────────────────────────

export type StartCallOpts =
  | { type: "user"; video: boolean; peer: CallPeer; chatId: string }
  | { type: "group"; video: boolean; groupId: string; groupName: string; memberIds: string[] }

export type ActiveCall = {
  room: string
  video: boolean
  direction: "outgoing" | "incoming"
  peer: CallPeer | null                       // 1:1 → el otro; grupo → null
  group: { id: string; name: string } | null
  chatId?: string                             // 1:1 saliente → para "llamada perdida"
}

type CallsCtx = {
  startCall: (opts: StartCallOpts) => void
  inCall: boolean
}

const Ctx = createContext<CallsCtx>({ startCall: () => {}, inCall: false })
export const useCalls = () => useContext(Ctx)

export default function CallProvider({ children }: { children: React.ReactNode }) {
  const [user] = useUser()
  const [me, setMe] = useState<CallPeer | null>(null)
  const [call, setCall] = useState<ActiveCall | null>(null)
  const [incoming, setIncoming] = useState<RingPayload | null>(null)

  // Refs espejo para decidir "ocupado" dentro del callback de realtime
  const callRef = useRef<ActiveCall | null>(null)
  callRef.current = call
  const incomingRef = useRef<RingPayload | null>(null)
  incomingRef.current = incoming
  const ringTimeout = useRef<number | null>(null)
  const cancelSub = useRef<ReturnType<typeof supabase.channel> | null>(null)

  // Mi perfil (nombre/avatar) para presentarme en el "ring"
  useEffect(() => {
    if (!user) { setMe(null); return }
    let cancelled = false
    supabase.from("users").select("id, nombre, avatar").eq("id", user.id).single()
      .then(({ data }) => {
        if (!cancelled) {
          setMe(data
            ? { id: data.id, nombre: data.nombre || "Usuario", avatar: data.avatar ?? null }
            : { id: user.id, nombre: "Usuario", avatar: null })
        }
      })
    return () => { cancelled = true }
  }, [user])

  const clearIncoming = useCallback(() => {
    stopRingtone()
    if (ringTimeout.current) { window.clearTimeout(ringTimeout.current); ringTimeout.current = null }
    if (cancelSub.current) { void supabase.removeChannel(cancelSub.current); cancelSub.current = null }
    setIncoming(null)
  }, [])

  // ── Escucha global de llamadas entrantes ────────────────────────────────────
  useEffect(() => {
    if (!user) return
    const ch = supabase
      .channel(personalChannel(user.id))
      .on("broadcast", { event: "ring" }, ({ payload }) => {
        const p = payload as RingPayload
        if (!p?.room || !p.from || p.from.id === user.id) return
        // Ya en llamada u otra entrante sonando → contesto "ocupado"
        if (callRef.current || incomingRef.current) {
          sendOnce(roomChannel(p.room), "decline", { userId: user.id, reason: "busy" })
          return
        }
        setIncoming(p)
        startRingtone("incoming")
        // Si quien llama cancela antes de contestar, cerramos el aviso
        cancelSub.current = supabase
          .channel(roomChannel(p.room))
          .on("broadcast", { event: "cancel" }, () => clearIncoming())
          .subscribe()
        // Nadie contesta en 40 s → se descarta solo
        ringTimeout.current = window.setTimeout(clearIncoming, 40000)
      })
      .subscribe()
    return () => { void supabase.removeChannel(ch) }
  }, [user, clearIncoming])

  // ── API: iniciar llamada ────────────────────────────────────────────────────
  const startCall = useCallback((opts: StartCallOpts) => {
    if (!user || !me || callRef.current) return
    const room = makeCallRoom()
    const base: RingPayload = { room, video: opts.video, from: me }
    if (opts.type === "user") {
      sendOnce(personalChannel(opts.peer.id), "ring", base)
      setCall({ room, video: opts.video, direction: "outgoing", peer: opts.peer, group: null, chatId: opts.chatId })
    } else {
      const payload: RingPayload = { ...base, group: { id: opts.groupId, name: opts.groupName } }
      for (const id of opts.memberIds) {
        if (id !== user.id) sendOnce(personalChannel(id), "ring", payload)
      }
      setCall({
        room, video: opts.video, direction: "outgoing", peer: null,
        group: { id: opts.groupId, name: opts.groupName },
      })
    }
  }, [user, me])

  const accept = useCallback(() => {
    const p = incomingRef.current
    if (!p) return
    stopRingtone()
    if (ringTimeout.current) { window.clearTimeout(ringTimeout.current); ringTimeout.current = null }
    if (cancelSub.current) { void supabase.removeChannel(cancelSub.current); cancelSub.current = null }
    setIncoming(null)
    setCall({
      room: p.room, video: p.video, direction: "incoming",
      peer: p.group ? null : p.from, group: p.group ?? null,
    })
  }, [])

  const decline = useCallback(() => {
    const p = incomingRef.current
    if (!p || !user) return
    sendOnce(roomChannel(p.room), "decline", { userId: user.id })
    clearIncoming()
  }, [user, clearIncoming])

  return (
    <Ctx.Provider value={{ startCall, inCall: !!call }}>
      {children}

      {/* ── Aviso de llamada entrante ── */}
      {incoming && user && (
        <div
          className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center p-4 animate-in"
          style={{ background: "rgba(8,9,11,0.6)", backdropFilter: "blur(16px) saturate(140%)" }}
        >
          <div
            className="w-full max-w-sm rounded-2xl px-6 pt-9 pb-6 flex flex-col items-center text-center"
            style={{
              background: "linear-gradient(180deg, rgba(30,32,38,0.94), rgba(19,21,25,0.94))",
              border: "1px solid var(--glass-border)",
              boxShadow: "0 32px 80px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.08)",
            }}
          >
            <div className="relative mb-4">
              <span className="absolute inset-0 rounded-full animate-ping" style={{ background: "rgba(34,197,94,0.3)" }} />
              <span className="absolute -inset-2 rounded-full animate-pulse" style={{ boxShadow: "0 0 40px rgba(34,197,94,0.25)" }} />
              <div className="relative">
                <Avatar name={incoming.from.nombre} src={incoming.from.avatar} size={88} />
              </div>
            </div>
            <p className="text-[17px] font-semibold text-white">
              {incoming.group ? incoming.group.name : incoming.from.nombre}
            </p>
            <p className="text-[13px] mt-1 mb-7" style={{ color: "var(--text-dim)" }}>
              {incoming.group
                ? `${incoming.from.nombre} te llama al grupo · ${incoming.video ? "vídeo" : "voz"}`
                : incoming.video ? "Videollamada entrante…" : "Llamada de voz entrante…"}
            </p>
            <div className="flex items-center gap-10">
              <div className="flex flex-col items-center gap-1.5">
                <button
                  onClick={decline}
                  className="w-14 h-14 rounded-full flex items-center justify-center text-xl text-white transition-transform hover:scale-105 active:scale-95"
                  style={{ background: "#eb5757", boxShadow: "0 8px 24px rgba(235,87,87,0.45)" }}
                  aria-label="Rechazar"
                >
                  ✕
                </button>
                <span className="text-[11px]" style={{ color: "var(--text-dimmer)" }}>Rechazar</span>
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <button
                  onClick={accept}
                  className="w-14 h-14 rounded-full flex items-center justify-center text-xl transition-transform hover:scale-105 active:scale-95"
                  style={{ background: "#9a9d78", boxShadow: "0 8px 24px rgba(34,197,94,0.45)", animation: "nes-ring-bounce 1.2s ease-in-out infinite" }}
                  aria-label="Contestar"
                >
                  {incoming.video ? "🎥" : "📞"}
                </button>
                <span className="text-[11px]" style={{ color: "var(--text-dimmer)" }}>Contestar</span>
              </div>
            </div>
          </div>
          <style>{`@keyframes nes-ring-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}`}</style>
        </div>
      )}

      {/* ── Llamada activa ── */}
      {call && user && (
        <CallModal call={call} meId={user.id} onClose={() => setCall(null)} />
      )}
    </Ctx.Provider>
  )
}
