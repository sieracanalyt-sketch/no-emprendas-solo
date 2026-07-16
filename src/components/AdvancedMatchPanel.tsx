import { useEffect, useState } from "react"
import { fetchLatestMatchResult, type MergieResult } from "../lib/advancedMatch"

// ──────────────────────────────────────────────────────────────────────────────
// Conexiones sugeridas por Mergie. El cruce lo ejecuta MERGE por voz (entrevista
// corta + motor LLM); aquí se muestra el ÚLTIMO resultado real del usuario.
// REAL-DATA-ONLY: sin resultado aún, se explica el flujo — nunca datos inventados.
// ──────────────────────────────────────────────────────────────────────────────

export default function AdvancedMatchPanel({ userId }: { userId: string }) {
  const [res, setRes] = useState<MergieResult | null>(null)
  const [when, setWhen] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    fetchLatestMatchResult(userId).then(({ result, created_at }) => {
      if (!alive) return
      setRes(result); setWhen(created_at); setLoading(false)
    })
    return () => { alive = false }
  }, [userId])

  if (loading) return <div className="text-sm" style={{ color: "var(--text-dim)" }}>Buscando tu último cruce…</div>

  if (!res || res.matches.length === 0) {
    const g = res?.gaps ?? {}
    return (
      <div className="rounded-2xl p-6 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="text-lg font-semibold" style={{ color: "var(--text)" }}>
          {res ? "Tu último cruce no encontró matches" : "Aún no has hecho ningún cruce"}
        </div>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed" style={{ color: "var(--text-dim)" }}>
          {res
            ? (res.nota_honesta ?? "En cuanto entre gente nueva con el perfil relleno, vuelve a intentarlo.")
            : "Habla con MERGE y pulsa «Matchmaking avanzado»: te hará unas preguntas cortas por voz y cruzará tus respuestas con la comunidad real."}
        </p>
        {res && <GapRow g={g} />}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {res.resumen && (
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-dim)" }}>{res.resumen}</p>
      )}
      {res.matches.map((m) => (
        <div key={m.id_perfil} className="rounded-2xl p-5"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold"
              style={{ background: "rgba(94,106,210,0.15)", color: "var(--accent)" }}>{m.posicion}</span>
            <span className="truncate text-base font-semibold" style={{ color: "var(--text)" }}>{m.nombre}</span>
          </div>
          <p className="mt-2.5 text-sm leading-relaxed" style={{ color: "var(--text)" }}>{m.porque_encaja}</p>
          <p className="mt-2 text-sm" style={{ color: "var(--text-dim)" }}>
            <b style={{ color: "#3fca7d" }}>Lo mejor:</b> {m.punto_fuerte}
          </p>
          {m.a_hablar_desde_el_principio && (
            <p className="mt-1.5 text-sm" style={{ color: "var(--text-dim)" }}>
              <b style={{ color: "#e3b341" }}>A hablar desde el principio:</b> {m.a_hablar_desde_el_principio}
            </p>
          )}
          <p className="mt-1.5 text-sm" style={{ color: "var(--text-dim)" }}>
            <b style={{ color: "var(--accent)" }}>Primer paso:</b> {m.primer_paso}
          </p>
        </div>
      ))}
      {res.nota_honesta && (
        <p className="text-xs leading-relaxed" style={{ color: "var(--text-dimmer)" }}>{res.nota_honesta}</p>
      )}
      {when && (
        <p className="text-[11px] uppercase tracking-wider" style={{ color: "var(--text-dimmer)" }}>
          Último cruce: {new Date(when).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
        </p>
      )}
    </div>
  )
}

function GapRow({ g }: { g: NonNullable<MergieResult["gaps"]> }) {
  return (
    <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[11px] uppercase tracking-wider"
      style={{ color: "var(--text-dim)" }}>
      <span>miembros <b style={{ color: "var(--text)" }}>{g.total_members ?? 0}</b></span>
      <span>premium <b style={{ color: "var(--text)" }}>{g.premium_members ?? 0}</b></span>
      <span>perfiles avanzados <b style={{ color: "var(--text)" }}>{g.advanced_profiles ?? 0}</b></span>
    </div>
  )
}
