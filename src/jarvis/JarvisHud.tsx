import { useEffect, useMemo, useRef, useState } from "react"
import { useJarvisRoom, type AgentState, type TranscriptMsg } from "./useJarvisRoom"
import { RenderType } from "./contract"
import type {
  ActionsData, BriefData, FocusData, IntelData, MatchData, MetricsData, PipelineData, Tone,
} from "./contract"
import "./jarvis.css"

// MERGE — asistente de voz del fundador, embebido en NES con estética minimalista.
// La lógica de conexión vive en useJarvisRoom; aquí solo se presenta.

const toneColor: Record<Tone, string> = { up: "#3fb950", down: "#f85149", warn: "#d29922", flat: "var(--text)" }
const AXIS = "var(--text-dimmer)"
const GRID = "rgba(255,255,255,0.06)"

function useTypewriter(text: string, speed = 20, delay = 0) {
  const [out, setOut] = useState(""); const [done, setDone] = useState(false)
  useEffect(() => {
    setOut(""); setDone(false)
    let i = 0; let iv: ReturnType<typeof setInterval>
    const t = setTimeout(() => {
      iv = setInterval(() => {
        i++; setOut(text.slice(0, i))
        if (i >= text.length) { clearInterval(iv); setDone(true) }
      }, speed)
    }, delay)
    return () => { clearTimeout(t); clearInterval(iv) }
  }, [text, speed, delay])
  return { out, done }
}

// Iconos minimalistas inline (sin dependencia de librerías)
function IcMic() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2.5" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3.5" />
    </svg>
  )
}
function IcMicOff() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2.5" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3.5M4 4l16 16" />
    </svg>
  )
}
function IcSend() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V5M6 11l6-6 6 6" />
    </svg>
  )
}
function IcClose() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}
function IcStop() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="6" y="6" width="12" height="12" rx="2.5" />
    </svg>
  )
}

export default function MergeConsole() {
  const r = useJarvisRoom()
  const [draft, setDraft] = useState("")

  const statusText = r.state === "connected" ? "en línea"
    : r.state === "connecting" ? "conectando…" : "desconectado"

  function submitText() {
    const t = draft.trim()
    if (!t || r.state !== "connected") return
    void r.sendText(t)
    setDraft("")
  }

  return (
    <div className="merge-root w-full mx-auto px-4 sm:px-6 py-6" style={{ maxWidth: 880 }}>
      {/* glows de ambiente detrás del cristal */}
      <div className="mg-glow mg-glow-a" />
      <div className="mg-glow mg-glow-b" />

      {/* Header flotante — marca + estado + controles en píldoras de cristal */}
      <div className="mg-glass mg-glass-pill flex items-center justify-between gap-3 flex-wrap"
        style={{ padding: "10px 18px" }}>
        <div className="flex items-center gap-3">
          <span className="mg-orb" style={{ width: 14, height: 14 }} />
          <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "0.03em", color: "var(--text)" }}>MERGE</span>
          <span style={{ fontSize: 13, color: "var(--text-dimmer)" }}>{statusText}</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {r.state === "connected" && (
            <button className="mg-btn" onClick={() => r.sendCommand("capabilities")} title="MERGE te cuenta, con voz, lo que puede hacer hoy">
              ¿Qué puedes hacer?
            </button>
          )}
          {r.state === "connected" && (
            <button className="mg-btn mg-btn-accent" onClick={() => r.sendCommand("matchmaking")} title="Cruza los perfiles reales de la comunidad y sugiere conexiones">
              ✦ Matchmaking avanzado
            </button>
          )}
          {r.state === "connected" && (
            <button className="mg-icon-btn" onClick={r.disconnect} title="Cerrar la sesión con MERGE" aria-label="Desconectar">
              <IcClose />
            </button>
          )}
          {r.state !== "connected" && (
            <button className="mg-btn mg-btn-primary" onClick={r.connect} disabled={r.state === "connecting"}>
              {r.state === "connecting" ? "Conectando…" : "Iniciar MERGE"}
            </button>
          )}
        </div>
      </div>

      {r.error && <div className="mg-err" style={{ marginTop: 10, paddingLeft: 8 }}>{r.error}</div>}

      {/* Escenario — panel de cristal flotante */}
      <div className="mg-glass" style={{ position: "relative", minHeight: 480, marginTop: 18, overflow: "hidden" }}>
        {r.state === "connected" && <StateBar s={r.agentState} />}
        <Stage r={r} />
        {/* Con un panel gráfico en pantalla, lo hablado va como subtítulo inferior */}
        {r.latest && <CaptionOverlay msgs={r.transcript} speaking={r.agentState === "speaking"} />}
      </div>

      {/* Entrada dual: escribe o habla — misma conversación */}
      {r.state === "connected" && (
        <div className="mg-glass mg-glass-pill mg-composer" style={{ marginTop: 16 }}>
          <button
            className={`mg-icon-btn ${r.micOn ? "mg-icon-on" : "mg-icon-off"}`}
            onClick={r.toggleMic}
            title={r.micOn ? "Micro activo — pulsa para silenciar" : "Micro apagado — pulsa para hablar"}
            aria-label={r.micOn ? "Silenciar micro" : "Activar micro"}>
            {r.micOn ? <IcMic /> : <IcMicOff />}
          </button>
          {/* Parar: corta la frase en curso sin tener que hablarle encima.
              Siempre visible (no desplaza el layout), activo solo cuando hay algo
              que cortar. */}
          <button
            className="mg-icon-btn"
            onClick={() => r.sendCommand("stop")}
            disabled={r.agentState !== "speaking" && r.agentState !== "thinking"}
            title="Parar lo que MERGE está diciendo"
            aria-label="Parar respuesta">
            <IcStop />
          </button>
          <input
            className="mg-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitText() } }}
            placeholder={r.micOn ? "Escríbele a MERGE… o simplemente habla" : "Escríbele a MERGE…"}
            aria-label="Mensaje para MERGE"
          />
          <button className="mg-icon-btn mg-icon-send" onClick={submitText} disabled={!draft.trim()}
            title="Enviar (Enter)" aria-label="Enviar mensaje">
            <IcSend />
          </button>
        </div>
      )}

      {/* Hint — one dim line */}
      <p style={{ marginTop: 14, textAlign: "center", fontSize: 12.5, color: "var(--text-dimmer)" }}>
        {r.state === "connected"
          ? "Habla o escribe con naturalidad · ✦ Matchmaking avanzado cruza los perfiles reales de la comunidad"
          : "Pulsa “Iniciar MERGE”: es una conversación por voz o texto, como con un compañero."}
      </p>
    </div>
  )
}

// Clear, always-visible indicator of what MERGE is doing right now.
function StateBar({ s }: { s: AgentState }) {
  if (s === "idle") return null
  if (s === "listening") return (
    <div className="mg-state" style={{ color: "#3fb950" }}>
      <span className="mg-listen-ring" />
      <span style={{ color: "var(--text)" }}>Te escucho — habla</span>
    </div>
  )
  if (s === "thinking") return (
    <div className="mg-state" style={{ color: "#d29922" }}>
      <span className="mg-dots"><i /><i /><i /></span>
      <span style={{ color: "var(--text)" }}>Pensando…</span>
    </div>
  )
  if (s === "speaking") return (
    <div className="mg-state" style={{ color: "var(--accent)" }}>
      <span className="mg-bars"><i /><i /><i /><i /></span>
      <span style={{ color: "var(--text)" }}>Hablando…</span>
    </div>
  )
  return ( // connecting
    <div className="mg-state" style={{ color: "var(--text-dimmer)" }}>
      <span className="mg-dots"><i /><i /><i /></span>
      <span style={{ color: "var(--text-dim)" }}>Conectando con MERGE…</span>
    </div>
  )
}

function Stage({ r }: { r: ReturnType<typeof useJarvisRoom> }) {
  if (!r.latest) {
    // Sin panel gráfico: la conversación ES la pantalla (texto en streaming).
    if (r.transcript.length > 0) {
      return <Conversation msgs={r.transcript} speaking={r.agentState === "speaking"} />
    }
    return <Idle text={r.state === "connected"
      ? "Habla con MERGE con naturalidad — dale vueltas a una idea, pídele opinión, o pulsa Matchmaking avanzado para cruzar los perfiles de la comunidad."
      : "Pulsa “Iniciar MERGE” y háblale. Es una conversación: te responde con voz, como un compañero."} />
  }
  const { type, data, ts } = r.latest
  switch (type) {
    case RenderType.BRIEF: return <Brief key={ts} d={data as BriefData} />
    case RenderType.METRICS: return <Metrics key={ts} d={data as MetricsData} />
    case RenderType.PIPELINE: return <Pipeline key={ts} d={data as PipelineData} />
    case RenderType.INTEL: return <Intel key={ts} d={data as IntelData} />
    case RenderType.ACTIONS: return <Actions key={ts} d={data as ActionsData} />
    case RenderType.FOCUS: return <Focus key={ts} d={data as FocusData} />
    case RenderType.MATCH: return <Match key={ts} d={data as MatchData} />
    default: return <Idle text={`Tipo desconocido: ${String(type)}`} />
  }
}

// Merge consecutive segments from the same speaker into one visual message,
// but split on a real pause (>4 s) so separate answers don't fuse into one
// giant paragraph when the other side never speaks (e.g. mic muted).
const TURN_GAP_MS = 4000
function groupMsgs(msgs: TranscriptMsg[]): { self: boolean; text: string; final: boolean }[] {
  const out: { self: boolean; text: string; final: boolean; ts: number }[] = []
  for (const m of msgs) {
    const last = out[out.length - 1]
    if (last && last.self === m.self && m.ts - last.ts < TURN_GAP_MS) {
      last.text += " " + m.text; last.final = m.final; last.ts = m.ts
    } else {
      out.push({ self: m.self, text: m.text, final: m.final, ts: m.ts })
    }
  }
  return out
}

// La conversación en streaming, estilo ChatGPT: el texto de MERGE aparece
// palabra a palabra sincronizado con su voz; lo tuyo se ve en un tono apagado.
function Conversation({ msgs, speaking }: { msgs: TranscriptMsg[]; speaking: boolean }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const groups = useMemo(() => groupMsgs(msgs), [msgs])
  const lastText = groups[groups.length - 1]?.text
  useEffect(() => {
    const el = boxRef.current
    if (el) el.scrollTop = el.scrollHeight // sigue el texto según crece
  }, [lastText, groups.length])
  return (
    <div ref={boxRef} className="mg-scroll" style={{ minHeight: 480, maxHeight: 580, padding: "48px 8px 28px", display: "flex", flexDirection: "column", gap: 26, maxWidth: 680, margin: "0 auto" }}>
      {groups.map((g, i) => {
        const isLast = i === groups.length - 1
        const streaming = isLast && !g.self && (speaking || !g.final)
        return (
          <div key={i} className="mg-fade">
            <div className="mg-cap-who" style={{ color: "var(--text-dimmer)", marginBottom: 6 }}>
              {g.self ? "Tú" : "MERGE"}
            </div>
            <p className={streaming ? "mg-caret" : ""} style={{
              fontSize: g.self ? 14.5 : 17, lineHeight: 1.7, margin: 0,
              color: g.self ? "var(--text-dim)" : "var(--text)",
              letterSpacing: g.self ? undefined : "0.005em",
            }}>{g.text}</p>
          </div>
        )
      })}
    </div>
  )
}

// Subtítulo inferior cuando hay un panel gráfico ocupando el escenario.
function CaptionOverlay({ msgs, speaking }: { msgs: TranscriptMsg[]; speaking: boolean }) {
  const groups = useMemo(() => groupMsgs(msgs), [msgs])
  const last = groups[groups.length - 1]
  if (!last?.text) return null
  const streaming = !last.self && (speaking || !last.final)
  return (
    <div className="mg-cap"><div>
      <span className="mg-cap-who" style={{ color: last.self ? "var(--accent)" : "var(--text)" }}>{last.self ? "Tú" : "MERGE"}</span>
      <span className={streaming ? "mg-caret" : ""}>{last.text}</span>
    </div></div>
  )
}

function Idle({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center" style={{ minHeight: 480, padding: 40, gap: 28, textAlign: "center" }}>
      <span className="mg-orb" style={{ width: 44, height: 44 }} />
      <p style={{ maxWidth: 400, fontSize: 15, lineHeight: 1.7, color: "var(--text-dim)" }}>{text}</p>
    </div>
  )
}

function Brief({ d }: { d: BriefData }) {
  const head = useTypewriter(d.headline, 22)
  const note = useTypewriter(d.note, 10, d.headline.length * 22 + 350)
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, padding: 28, minHeight: 460 }}>
      <div className="mg-label">Brief diario · {d.date}</div>
      <h2 className={head.done ? "" : "mg-caret"} style={{ fontSize: 26, fontWeight: 600, color: "var(--text)", minHeight: 34, lineHeight: 1.25 }}>{head.out}</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        {d.signals.map((s, i) => (
          <div key={i} className="mg-card mg-fade" style={{ padding: 16, animationDelay: `${350 + i * 120}ms` }}>
            <div className="mg-label">{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: toneColor[s.tone], marginTop: 6 }}>{s.value}</div>
          </div>
        ))}
      </div>
      <p className={note.done ? "" : "mg-caret"} style={{ marginTop: "auto", maxWidth: 680, color: "var(--text-dim)", lineHeight: 1.6 }}>{note.out}</p>
    </div>
  )
}

const MW = 760, MH = 300, MP = { l: 52, r: 18, t: 24, b: 34 }
function Metrics({ d }: { d: MetricsData }) {
  const pathRef = useRef<SVGPathElement>(null)
  const [len, setLen] = useState(0); const [draw, setDraw] = useState(false)
  const g = useMemo(() => {
    const pts = d.points, vals = pts.map((p) => p.v)
    const ihEmpty = MH - MP.t - MP.b
    // Serie vacía (fuente en vivo sin datos): sin esto, Math.min(...[]) = Infinity
    // y las etiquetas del eje pintan "NaN".
    if (pts.length === 0) return { co: [] as const, line: "", min: 0, max: 1, ih: ihEmpty }
    const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1
    const iw = MW - MP.l - MP.r, ih = MH - MP.t - MP.b
    const co = pts.map((p, i) => [MP.l + (pts.length === 1 ? iw / 2 : (i / (pts.length - 1)) * iw), MP.t + (1 - (p.v - min) / span) * ih] as const)
    const line = co.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ")
    return { co, line, min, max, ih }
  }, [d])
  useEffect(() => {
    setLen(pathRef.current?.getTotalLength() ?? 0); setDraw(false)
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setDraw(true)))
    return () => cancelAnimationFrame(id)
  }, [d])
  const last = g.co[g.co.length - 1], up = d.delta_pct >= 0
  const fmt = (n: number) => Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${Math.round(n * 10) / 10}`
  const sd = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" })
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 28, minHeight: 460 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div><div className="mg-label">Métricas · {d.range_days} días</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: "var(--text)", marginTop: 4 }}>{d.label}</div></div>
        <div style={{ fontSize: 18, fontWeight: 600, color: up ? "#3fb950" : "#f85149" }}>{up ? "▲" : "▼"} {Math.abs(d.delta_pct).toFixed(0)}%</div>
      </div>
      <svg viewBox={`0 0 ${MW} ${MH}`} style={{ width: "100%", flex: 1, minHeight: 240 }}>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const y = MP.t + f * g.ih, val = g.max - f * (g.max - g.min)
          return <g key={f}><line x1={MP.l} y1={y} x2={MW - MP.r} y2={y} stroke={GRID} /><text x={MP.l - 8} y={y + 4} textAnchor="end" fontSize={11} fill={AXIS}>{fmt(val)}</text></g>
        })}
        {d.points.length > 0 && <>
          <text x={MP.l} y={MH - 10} fontSize={11} fill={AXIS}>{sd(d.points[0].t)}</text>
          <text x={MW - MP.r} y={MH - 10} textAnchor="end" fontSize={11} fill={AXIS}>{sd(d.points[d.points.length - 1].t)}</text>
        </>}
        <path ref={pathRef} d={g.line} fill="none" stroke="var(--accent)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
          style={{ strokeDasharray: len, strokeDashoffset: draw ? 0 : len, transition: "stroke-dashoffset 1.1s ease-out" }} />
        {last && <circle cx={last[0]} cy={last[1]} r={4.5} fill="var(--accent)" opacity={draw ? 1 : 0} style={{ transition: "opacity 0.4s 1s" }} />}
      </svg>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {d.available.map((m) => <span key={m} className="mg-chip" style={m === d.metric ? { borderColor: "rgba(94,106,210,0.4)", background: "rgba(94,106,210,0.1)", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.04em" } : { textTransform: "uppercase", letterSpacing: "0.04em" }}>{m.replace("_", " ")}</span>)}
      </div>
    </div>
  )
}

function Pipeline({ d }: { d: PipelineData }) {
  const maxC = Math.max(...d.stages.map((s) => s.count), 1)
  const sizeL: Record<string, string> = { S: "Small", M: "Mid", L: "Large" }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 24, padding: 28, minHeight: 460 }}>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 12 }}>
        <div className="mg-label">Embudo de deals</div>
        {d.stages.map((s, i) => (
          <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 96, textAlign: "right", fontSize: 13, color: "var(--text-dim)" }}>{s.label}</div>
            <div style={{ position: "relative", height: 34, flex: 1, borderRadius: 8, overflow: "hidden", background: "rgba(255,255,255,0.03)" }}>
              <div className="mg-grow" style={{ height: "100%", width: `${(s.count / maxC) * 100}%`, borderRadius: 8, background: "var(--accent)", animationDelay: `${i * 120}ms` }} />
              <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 13, fontWeight: 600, color: "#fff" }}>{s.count}</span>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, minHeight: 0 }}>
        <div className="mg-label">En riesgo · <span style={{ color: "#f85149" }}>{d.at_risk_count}</span></div>
        <div className="mg-scroll" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {d.deals.map((dl, i) => (
            <div key={dl.name} className="mg-fade" style={{ borderRadius: 12, padding: 12, animationDelay: `${i * 80}ms`, background: dl.at_risk ? "rgba(248,81,73,0.07)" : "rgba(255,255,255,0.025)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontWeight: 600, color: dl.at_risk ? "#f85149" : "var(--text)" }}>{dl.name}</span>
                <span className="mg-label">{dl.stage} · {sizeL[dl.size]}</span>
              </div>
              {dl.at_risk && dl.reason && <div style={{ marginTop: 4, fontSize: 13, color: "rgba(248,81,73,0.85)" }}>⚠ {dl.reason}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Intel({ d }: { d: IntelData }) {
  const icon = (t: string) => t === "meeting" ? "◈ Reunión" : t === "doc" ? "▤ Doc" : "✉ Mensaje"
  const col = (t: string) => t === "meeting" ? "var(--accent)" : t === "doc" ? "#3fb950" : "#3b82f6"
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: 28, minHeight: 460 }}>
      <div className="mg-label">Intel{d.query ? ` · ${d.query}` : ""}</div>
      <div className="mg-scroll" style={{ display: "flex", flexDirection: "column", gap: 14, paddingLeft: 18, borderLeft: "1px solid var(--border-strong)" }}>
        {d.timeline.map((it, i) => (
          <div key={i} className="mg-fade" style={{ position: "relative", animationDelay: `${i * 80}ms` }}>
            <span style={{ position: "absolute", left: -24, top: 5, width: 9, height: 9, borderRadius: "50%", border: `2px solid ${col(it.type)}`, background: "var(--bg)" }} />
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span className="mg-label" style={{ color: col(it.type) }}>{icon(it.type)}</span>
              <span style={{ fontSize: 11, color: "var(--text-dimmer)" }}>{it.time.replace("T", " ")}</span>
            </div>
            <div style={{ fontWeight: 600, color: "var(--text)", marginTop: 2 }}>{it.who}</div>
            <div style={{ fontSize: 14, color: "var(--text-dim)" }}>{it.summary}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Actions({ d }: { d: ActionsData }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: 28, minHeight: 460 }}>
      <div className="mg-label">Plan del día · {d.date}</div>
      <div className="mg-scroll" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {d.actions.map((a, i) => (
          <div key={a.rank} className="mg-card mg-fade" style={{ display: "flex", alignItems: "center", gap: 16, padding: 16, animationDelay: `${i * 120}ms` }}>
            <div style={{ width: 34, height: 34, flexShrink: 0, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 600, border: `1px solid ${a.rank === 1 ? "var(--accent)" : "var(--border-strong)"}`, color: a.rank === 1 ? "var(--accent)" : "var(--text-dim)" }}>{a.rank}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.title}</div>
              <div style={{ fontSize: 13, color: "var(--text-dim)" }}>{a.why}</div>
            </div>
            <div className="mg-chip">{a.effort}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Focus({ d }: { d: FocusData }) {
  const total = d.minutes * 60
  const [rem, setRem] = useState(total)
  useEffect(() => {
    const tick = () => setRem(Math.max(0, total - (Date.now() / 1000 - d.started_ts)))
    tick(); const id = setInterval(tick, 250); return () => clearInterval(id)
  }, [d.started_ts, total])
  const R = 130, C = 2 * Math.PI * R, frac = total > 0 ? rem / total : 0, done = rem <= 0
  const mm = String(Math.floor(rem / 60)).padStart(2, "0"), ss = String(Math.floor(rem % 60)).padStart(2, "0")
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 28, minHeight: 460, padding: 28 }}>
      <div className="mg-label">{done ? "Sesión completa" : "Foco · en curso"}</div>
      <div style={{ position: "relative", width: 280, height: 280 }}>
        <svg viewBox="0 0 300 300" style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}>
          <circle cx="150" cy="150" r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={4} />
          <circle cx="150" cy="150" r={R} fill="none" stroke={done ? "#3fb950" : "var(--accent)"} strokeWidth={4} strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - frac)} style={{ transition: "stroke-dashoffset 0.3s linear" }} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontSize: 56, fontWeight: 600, color: done ? "#3fb950" : "var(--text)", fontVariantNumeric: "tabular-nums" }}>{done ? "¡YA!" : `${mm}:${ss}`}</div>
          <div className="mg-label" style={{ marginTop: 10 }}>{d.label}</div>
        </div>
      </div>
      <div className="mg-label">{d.minutes} min · sin interrupciones</div>
    </div>
  )
}

function Match({ d }: { d: MatchData }) {
  const g = d.gaps ?? {}
  const matches = d.matches ?? []
  if (d.unavailable || matches.length === 0) {
    // El estado vacío honesto — por diseño solo aparece DESPUÉS de la entrevista.
    const prem = g.premium_members ?? 0
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 28, minHeight: 460 }}>
        <div className="mg-label">Matchmaking avanzado{d.generated ? ` · ${d.generated}` : ""}</div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, textAlign: "center", padding: "0 40px" }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: "#d29922" }}>{d.unavailable ? "Sin datos de NES" : "Aún no hay con quién cruzarte"}</div>
          <p style={{ maxWidth: 520, fontSize: 14, color: "var(--text-dim)", lineHeight: 1.6 }}>
            {d.unavailable ?? d.nota_honesta ?? (prem === 0
              ? "Tus respuestas quedan guardadas. En cuanto haya miembros premium con el perfil relleno, el cruce usará justo lo que acabas de contar."
              : `Hay ${prem} miembros premium pero ninguno más ha rellenado su perfil avanzado todavía.`)}
          </p>
          <div style={{ display: "flex", gap: 20, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-dimmer)" }}>
            <span>miembros <b style={{ color: "var(--text)" }}>{g.total_members ?? 0}</b></span>
            <span>premium <b style={{ color: "var(--text)" }}>{g.premium_members ?? 0}</b></span>
            <span>perfiles avanzados <b style={{ color: "var(--text)" }}>{g.advanced_profiles ?? 0}</b></span>
          </div>
        </div>
      </div>
    )
  }
  // Tarjetas Mergie: explicación humana, sin puntuaciones visibles (regla del doc).
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: 28, minHeight: 460 }}>
      <div className="mg-label">Matchmaking avanzado{d.generated ? ` · ${d.generated}` : ""}</div>
      {d.resumen && <p style={{ fontSize: 13.5, color: "var(--text-dim)", lineHeight: 1.6, margin: 0 }}>{d.resumen}</p>}
      <div className="mg-scroll" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {matches.map((m, i) => (
          <div key={m.id_perfil} className="mg-card mg-fade" style={{ padding: 18, animationDelay: `${i * 120}ms` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{
                width: 24, height: 24, borderRadius: "50%", display: "inline-flex", alignItems: "center",
                justifyContent: "center", fontSize: 12, fontWeight: 700,
                background: "rgba(94,106,210,0.15)", color: "var(--accent)",
              }}>{m.posicion}</span>
              <span style={{ fontWeight: 600, fontSize: 15, color: "var(--text)" }}>{m.nombre}</span>
            </div>
            <p style={{ margin: "10px 0 0", fontSize: 13.5, lineHeight: 1.6, color: "var(--text)" }}>{m.porque_encaja}</p>
            <p style={{ margin: "8px 0 0", fontSize: 13, lineHeight: 1.5, color: "var(--text-dim)" }}>
              <b style={{ color: "#3fb950" }}>Lo mejor: </b>{m.punto_fuerte}
            </p>
            {m.a_hablar_desde_el_principio && (
              <p style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.5, color: "var(--text-dim)" }}>
                <b style={{ color: "#e3b341" }}>A hablar desde el principio: </b>{m.a_hablar_desde_el_principio}
              </p>
            )}
            <p style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.5, color: "var(--text-dim)" }}>
              <b style={{ color: "var(--accent)" }}>Primer paso: </b>{m.primer_paso}
            </p>
          </div>
        ))}
      </div>
      {d.nota_honesta && <p style={{ margin: 0, fontSize: 12, color: "var(--text-dimmer)", lineHeight: 1.5 }}>{d.nota_honesta}</p>}
    </div>
  )
}
