import { useEffect, useRef, useState } from "react"
import { formatBytes } from "../lib/uploadMedia"

// ──────────────────────────────────────────────────────────────────────────────
// Previsualización de adjuntos dentro del chat.
// Contenedores de borde fino y fondo #151618 (estética Linear).
// ──────────────────────────────────────────────────────────────────────────────

export type Attachment = {
  url: string
  type: "image" | "audio" | "file"
  name?: string | null
  size?: number | null
  duration?: number | null
}

function fmtClock(total: number): string {
  const s = Math.max(0, Math.round(total))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, "0")}`
}

export default function MessageAttachment({ att }: { att: Attachment }) {
  if (att.type === "image") return <ImageAttachment att={att} />
  if (att.type === "audio") return <AudioAttachment att={att} />
  return <FileAttachment att={att} />
}

// ── Imagen ──────────────────────────────────────────────────────────────────
function ImageAttachment({ att }: { att: Attachment }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="block overflow-hidden rounded-lg"
        style={{ border: "1px solid var(--border)", background: "#151618", maxWidth: 260 }}
      >
        <img
          src={att.url}
          alt={att.name ?? "imagen"}
          className="block w-full h-auto object-cover"
          style={{ maxHeight: 280 }}
          loading="lazy"
        />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-6"
          style={{ background: "rgba(6,7,8,0.82)", backdropFilter: "blur(8px)" }}
          onClick={() => setOpen(false)}
        >
          <img
            src={att.url}
            alt={att.name ?? "imagen"}
            className="max-w-full max-h-full rounded-lg"
            style={{ border: "1px solid var(--border-strong)" }}
          />
        </div>
      )}
    </>
  )
}

// ── Audio (reproductor minimalista con waveform) ──────────────────────────────
function AudioAttachment({ att }: { att: Attachment }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [cur, setCur] = useState(0)
  const [dur, setDur] = useState(att.duration ?? 0)

  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    const onTime = () => setCur(a.currentTime)
    const onMeta = () => {
      if (isFinite(a.duration) && a.duration > 0) setDur(a.duration)
    }
    const onEnd = () => {
      setPlaying(false)
      setCur(0)
    }
    a.addEventListener("timeupdate", onTime)
    a.addEventListener("loadedmetadata", onMeta)
    a.addEventListener("durationchange", onMeta)
    a.addEventListener("ended", onEnd)
    return () => {
      a.removeEventListener("timeupdate", onTime)
      a.removeEventListener("loadedmetadata", onMeta)
      a.removeEventListener("durationchange", onMeta)
      a.removeEventListener("ended", onEnd)
    }
  }, [])

  const toggle = () => {
    const a = audioRef.current
    if (!a) return
    if (playing) {
      a.pause()
      setPlaying(false)
    } else {
      a.play()
      setPlaying(true)
    }
  }

  const pct = dur > 0 ? Math.min(1, cur / dur) : 0
  // Barras pseudo-aleatorias estables por longitud (waveform decorativo)
  const bars = 32
  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
      style={{ background: "#151618", border: "1px solid var(--border)", minWidth: 200, maxWidth: 280 }}
    >
      <audio ref={audioRef} src={att.url} preload="metadata" />
      <button
        onClick={toggle}
        className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-white"
        style={{ background: "var(--accent)" }}
        aria-label={playing ? "Pausar" : "Reproducir"}
      >
        {playing ? "❚❚" : "▶"}
      </button>

      <div className="flex items-center gap-[2px] flex-1 h-7">
        {Array.from({ length: bars }).map((_, i) => {
          const h = 5 + ((i * 37) % 18)
          const active = i / bars <= pct
          return (
            <span
              key={i}
              className="rounded-full"
              style={{
                width: 2,
                height: h,
                background: active ? "var(--accent)" : "rgba(255,255,255,0.18)",
              }}
            />
          )
        })}
      </div>

      <span className="text-[11px] tabular-nums shrink-0" style={{ color: "var(--text-dim)" }}>
        {fmtClock(playing || cur > 0 ? dur - cur : dur)}
      </span>
    </div>
  )
}

// ── Archivo genérico (PDF, zip, código…) ──────────────────────────────────────
function iconFor(name: string): string {
  const ext = /\.([a-z0-9]+)$/i.exec(name || "")?.[1]?.toLowerCase() ?? ""
  if (ext === "pdf") return "📄"
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "🗜️"
  if (["js", "ts", "tsx", "jsx", "py", "go", "rs", "json", "html", "css"].includes(ext)) return "⌨️"
  if (["doc", "docx"].includes(ext)) return "📝"
  if (["xls", "xlsx", "csv"].includes(ext)) return "📊"
  return "📎"
}

function FileAttachment({ att }: { att: Attachment }) {
  const name = att.name ?? "archivo"
  return (
    <a
      href={att.url}
      target="_blank"
      rel="noopener noreferrer"
      download={name}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition"
      style={{ background: "#151618", border: "1px solid var(--border)", minWidth: 200, maxWidth: 280 }}
    >
      <div
        className="shrink-0 w-10 h-10 rounded-md flex items-center justify-center text-lg"
        style={{ background: "var(--surface-3)", border: "1px solid var(--border)" }}
      >
        {iconFor(name)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium" style={{ color: "var(--text)" }}>
          {name}
        </p>
        <p className="text-[11px]" style={{ color: "var(--text-dim)" }}>
          {att.size ? formatBytes(att.size) : "Descargar"}
        </p>
      </div>
      <span className="shrink-0 text-[15px]" style={{ color: "var(--text-dim)" }}>
        ↓
      </span>
    </a>
  )
}
