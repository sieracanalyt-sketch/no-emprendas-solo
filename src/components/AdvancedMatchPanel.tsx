import { useEffect, useState } from "react"
import {
  fetchLatestMatchResult, CATEGORIA_LABEL,
  type MergieResult, type MergieMatch, type SubScore,
} from "../lib/advancedMatch"

// ──────────────────────────────────────────────────────────────────────────────
// Conexiones sugeridas por Mergie. El cruce lo ejecuta MERGE por voz (entrevista
// corta + motor LLM); aquí se muestra el ÚLTIMO resultado real del usuario.
// REAL-DATA-ONLY: sin resultado aún, se explica el flujo — nunca datos inventados.
//
// Bloque 2 del doc de investigación: la nota NUNCA se muestra sola. Cada match
// enseña su desglose por categoría, la justificación con evidencia literal del
// perfil (feature attribution estilo XAI), las banderas rojas/verdes y las
// conversaciones difíciles pendientes. Los red flags CAPAN la nota global en vez
// de diluirse en la media ponderada, y se dicen explícitamente.
//
// Lenguaje deliberadamente profesional (informe de due diligence ligero), nunca
// estética de app de citas: "compatibilidad de co-fundación", no "match".
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
      {res.pesos_usuario && res.pesos_usuario.length > 0 && (
        <p className="text-[11.5px]" style={{ color: "var(--text-dimmer)" }}>
          Ponderado según lo que marcaste como prioritario:{" "}
          {res.pesos_usuario.map((k) => CATEGORIA_LABEL[k] ?? k).join(" · ")}
        </p>
      )}
      {res.matches.map((m) => <MatchCard key={m.id_perfil} m={m} />)}
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

function MatchCard({ m }: { m: MergieMatch }) {
  const [openScore, setOpenScore] = useState(false)
  const subs = m.sub_scores ?? []
  const hasScore = typeof m.score_global === "number"

  return (
    <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-center gap-2.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold"
          style={{ background: "rgba(94,106,210,0.15)", color: "var(--accent)" }}>{m.posicion}</span>
        <span className="truncate text-base font-semibold" style={{ color: "var(--text)" }}>{m.nombre}</span>
        {hasScore && (
          <span className="ml-auto shrink-0 text-sm font-semibold tabular-nums"
            style={{ color: scoreColor(m.score_global as number) }}>
            {m.score_global}<span className="text-[11px] opacity-60">/100</span>
          </span>
        )}
      </div>

      {/* La nota nunca va sola: el desglose es el producto, no el número. */}
      {hasScore && subs.length > 0 && (
        <div className="mt-3">
          <button onClick={() => setOpenScore((v) => !v)}
            className="text-[12px] font-medium transition hover:opacity-80"
            style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            {openScore ? "Ocultar" : "Ver"} de dónde sale esta nota
          </button>
          {/* barras compactas siempre visibles — el detalle se despliega */}
          <div className="mt-2 space-y-1.5">
            {subs.map((s) => <SubScoreRow key={s.categoria} s={s} detailed={openScore} />)}
          </div>
        </div>
      )}

      {m.capado_por_red_flag && (
        <p className="mt-3 rounded-xl px-3 py-2 text-[12px] leading-relaxed"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", color: "#f0836f" }}>
          Nota limitada a propósito: hay una señal de riesgo fuerte que no se puede compensar con
          el resto de categorías. Léela antes de seguir.
        </p>
      )}

      <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--text)" }}>{m.porque_encaja}</p>
      <p className="mt-2 text-sm" style={{ color: "var(--text-dim)" }}>
        <b style={{ color: "#3fca7d" }}>Lo mejor:</b> {m.punto_fuerte}
      </p>

      <FlagList items={m.green_flags} label="A favor" color="#3fca7d" />
      <FlagList items={m.red_flags} label="Riesgos" color="#f0836f" />

      {m.a_hablar_desde_el_principio && (
        <p className="mt-1.5 text-sm" style={{ color: "var(--text-dim)" }}>
          <b style={{ color: "#e3b341" }}>A hablar desde el principio:</b> {m.a_hablar_desde_el_principio}
        </p>
      )}

      {/* Las 3 conversaciones difíciles: el guardarraíl del Bloque 4 */}
      {m.conversaciones_pendientes && m.conversaciones_pendientes.length > 0 && (
        <div className="mt-3 rounded-xl p-3" style={{ background: "var(--surface-3)", border: "1px solid var(--border)" }}>
          <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-dimmer)" }}>
            Conversaciones que deberíais tener antes de comprometeros
          </div>
          <ul className="mt-1.5 space-y-1">
            {m.conversaciones_pendientes.map((c, i) => (
              <li key={i} className="flex gap-2 text-[13px] leading-relaxed" style={{ color: "var(--text-dim)" }}>
                <span style={{ color: "var(--accent)" }}>{i + 1}.</span>{c}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-2.5 text-sm" style={{ color: "var(--text-dim)" }}>
        <b style={{ color: "var(--accent)" }}>Primer paso:</b> {m.primer_paso}
      </p>
    </div>
  )
}

/** Una categoría de la rúbrica: barra + peso y, al desplegar, por qué y con qué evidencia. */
function SubScoreRow({ s, detailed }: { s: SubScore; detailed: boolean }) {
  const label = CATEGORIA_LABEL[s.categoria] ?? s.categoria
  return (
    <div>
      <div className="flex items-center gap-2.5">
        <span className="w-[42%] shrink-0 truncate text-[12px]" style={{ color: "var(--text-dim)" }}>{label}</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: "var(--border)" }}>
          <div className="h-full rounded-full transition-all"
            style={{ width: `${Math.max(0, Math.min(100, s.score))}%`, background: scoreColor(s.score) }} />
        </div>
        <span className="w-[54px] shrink-0 text-right text-[11px] tabular-nums" style={{ color: "var(--text-dimmer)" }}>
          {s.score} · {s.peso}%
        </span>
      </div>
      {detailed && (
        <div className="mb-2 mt-1.5 pl-[42%]">
          <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-dim)" }}>{s.justificacion}</p>
          {s.evidencia?.map((e, i) => (
            <p key={i} className="mt-1 border-l-2 pl-2 text-[11.5px] italic leading-relaxed"
              style={{ borderColor: "var(--border)", color: "var(--text-dimmer)" }}>«{e}»</p>
          ))}
        </div>
      )}
    </div>
  )
}

function FlagList({ items, label, color }: { items?: string[]; label: string; color: string }) {
  if (!items || items.length === 0) return null
  return (
    <p className="mt-1.5 text-sm" style={{ color: "var(--text-dim)" }}>
      <b style={{ color }}>{label}:</b> {items.join(" · ")}
    </p>
  )
}

/** Calibración honesta: el verde fuerte se reserva a evidencia real, no se regala. */
function scoreColor(score: number): string {
  if (score >= 80) return "#3fca7d"
  if (score >= 60) return "#8bc34a"
  if (score >= 40) return "#e3b341"
  return "#f0836f"
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
