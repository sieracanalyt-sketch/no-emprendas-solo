import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import type { User } from "@supabase/supabase-js"
import { useNextMeeting } from "../hooks/useNextMeeting"
import { fmtClock } from "../lib/calendarUtils"

// ──────────────────────────────────────────────────────────────────────────────
// Mini-agenda lateral (T1-20): muestra la próxima reunión sin salir del chat.
// ──────────────────────────────────────────────────────────────────────────────

function countdown(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return "ahora"
  const min = Math.round(diff / 60000)
  if (min < 60) return `en ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `en ${h} h ${min % 60}m`
  return `en ${Math.round(h / 24)} d`
}

export default function NextMeetingWidget({ user }: { user: User }) {
  const next = useNextMeeting(user)
  const navigate = useNavigate()
  const [, tick] = useState(0)

  // Refresca el contador cada 30 s
  useEffect(() => {
    const i = window.setInterval(() => tick((n) => n + 1), 30_000)
    return () => window.clearInterval(i)
  }, [])

  if (!next) {
    return (
      <button
        onClick={() => navigate("/calendario")}
        className="w-full text-left px-3 py-2.5 rounded-lg transition"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <p className="text-[11px] uppercase tracking-wide" style={{ color: "var(--text-dimmer)" }}>
          Próxima reunión
        </p>
        <p className="text-[12px] mt-0.5" style={{ color: "var(--text-dim)" }}>
          Sin reuniones · abrir calendario →
        </p>
      </button>
    )
  }

  return (
    <button
      onClick={() => navigate("/calendario")}
      className="w-full text-left px-3 py-2.5 rounded-lg transition"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderLeft: `3px solid ${next.color || "var(--accent)"}`,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-wide" style={{ color: "var(--text-dimmer)" }}>
          Próxima reunión
        </p>
        <span
          className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0"
          style={{ background: "rgba(94,106,210,0.18)", color: "var(--accent)" }}
        >
          {countdown(next.start_at)}
        </span>
      </div>
      <p className="text-[13px] font-medium truncate mt-1" style={{ color: "var(--text)" }}>
        {next.urgent && "🔴 "}
        {next.title}
      </p>
      <p className="text-[11px] mt-0.5" style={{ color: "var(--text-dim)" }}>
        {new Date(next.start_at).toLocaleDateString("es-ES", { weekday: "short", day: "numeric" })}
        {" · "}
        {fmtClock(next.start_at)}–{fmtClock(next.end_at)}
      </p>
    </button>
  )
}
