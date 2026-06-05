import { useEffect, useRef, useState } from "react"
import Avatar from "./Avatar"

// ──────────────────────────────────────────────────────────────────────────────
// Modal de llamada — WebRTC "mock".
// Arquitectura lista para conectar señalización real (Daily / Jitsi / Agora):
// basta sustituir el bloque `connect()` por la negociación de SDP/ICE y enchufar
// los MediaStream remotos a los <video>. La UI/estados ya están completos.
// ──────────────────────────────────────────────────────────────────────────────

export type CallInfo = {
  type: "voice" | "video"
  peerName: string
  peerAvatar?: string | null
  direction?: "outgoing" | "incoming"
}

type Phase = "ringing" | "connected" | "ended"

function fmt(total: number): string {
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

export default function CallModal({ call, onEnd }: { call: CallInfo; onEnd: () => void }) {
  const isVideo = call.type === "video"
  const [phase, setPhase] = useState<Phase>("ringing")
  const [secs, setSecs] = useState(0)
  const [muted, setMuted] = useState(false)
  const [camOn, setCamOn] = useState(isVideo)
  const selfVideoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Simula el establecimiento de la conexión (señalización mock).
  useEffect(() => {
    const t = window.setTimeout(() => setPhase("connected"), 2100)
    return () => window.clearTimeout(t)
  }, [])

  // Cronómetro al conectar.
  useEffect(() => {
    if (phase !== "connected") return
    const i = window.setInterval(() => setSecs((s) => s + 1), 1000)
    return () => window.clearInterval(i)
  }, [phase])

  // Auto-vista de cámara real para videollamadas (si el usuario lo permite).
  useEffect(() => {
    let cancelled = false
    async function getCam() {
      if (!isVideo || !camOn) return
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (selfVideoRef.current) selfVideoRef.current.srcObject = stream
      } catch {
        /* sin cámara → se muestra el avatar */
      }
    }
    getCam()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [isVideo, camOn])

  const hangUp = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    setPhase("ended")
    window.setTimeout(onEnd, 320)
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 animate-in"
      style={{ background: "rgba(8,9,11,0.55)", backdropFilter: "blur(14px) saturate(140%)" }}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl overflow-hidden"
        style={{
          background: "rgba(21,22,24,0.72)",
          border: "1px solid var(--border-strong)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.55)",
        }}
      >
        {/* Vídeo remoto (placeholder mock) / fondo */}
        <div
          className="relative flex flex-col items-center justify-center px-6 pt-10 pb-7"
          style={{ minHeight: isVideo ? 360 : 300 }}
        >
          {/* Halo pulsante mientras suena */}
          <div className="relative mb-5">
            {phase === "ringing" && (
              <span
                className="absolute inset-0 rounded-full animate-ping"
                style={{ background: "rgba(94,106,210,0.35)" }}
              />
            )}
            <div className="relative">
              <Avatar name={call.peerName} src={call.peerAvatar} size={96} />
            </div>
          </div>

          <p className="text-[17px] font-semibold" style={{ color: "var(--text)" }}>
            {call.peerName}
          </p>
          <p className="text-[13px] mt-1" style={{ color: "var(--text-dim)" }}>
            {phase === "ringing"
              ? call.direction === "incoming"
                ? `Llamada ${isVideo ? "de vídeo" : "de voz"} entrante…`
                : "Llamando…"
              : phase === "connected"
              ? `Conectado · ${fmt(secs)}`
              : "Llamada finalizada"}
          </p>

          {/* Auto-vista local (videollamada) */}
          {isVideo && (
            <div
              className="absolute bottom-4 right-4 w-24 h-32 rounded-lg overflow-hidden"
              style={{ border: "1px solid var(--border-strong)", background: "#0a0b0c" }}
            >
              {camOn ? (
                <video
                  ref={selfVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                  style={{ transform: "scaleX(-1)" }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[11px]" style={{ color: "var(--text-dimmer)" }}>
                  Cámara off
                </div>
              )}
            </div>
          )}
        </div>

        {/* Controles */}
        <div
          className="flex items-center justify-center gap-3 px-6 py-5"
          style={{ borderTop: "1px solid var(--border)", background: "rgba(12,13,14,0.4)" }}
        >
          <CtrlButton
            active={muted}
            onClick={() => setMuted((m) => !m)}
            label={muted ? "Silenciado" : "Mic"}
          >
            {muted ? "🔇" : "🎙️"}
          </CtrlButton>

          {isVideo && (
            <CtrlButton active={!camOn} onClick={() => setCamOn((c) => !c)} label="Cámara">
              {camOn ? "📹" : "🚫"}
            </CtrlButton>
          )}

          <button
            onClick={hangUp}
            className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl"
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

function CtrlButton({
  children,
  onClick,
  active,
  label,
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
