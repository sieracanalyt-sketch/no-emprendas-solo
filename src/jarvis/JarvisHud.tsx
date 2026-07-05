import { useEffect, useMemo, useRef, useState } from "react"
import { useJarvisRoom } from "./useJarvisRoom"
import { RenderType } from "./contract"
import type {
  ActionsData, BriefData, FocusData, IntelData, MatchData, MetricsData, PipelineData, Tone,
} from "./contract"
import "./jarvis.css"

const FW_COLOR: Record<string, string> = {
  "Rocket Fuel": "#5e6ad2", "Working Genius": "#8b7bff",
  "Give and Take": "#2fffb0", DISC: "#ffca3a", Necesidades: "#ff7ac2",
}
const toneColor: Record<Tone, string> = { up: "var(--j-good)", down: "var(--j-risk)", warn: "var(--j-warn)", flat: "var(--j-text)" }

function useTypewriter(text: string, speed = 22, delay = 0) {
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

export default function JarvisHud({ onClose }: { onClose?: () => void }) {
  const r = useJarvisRoom()

  return (
    <div className="jarvis-root">
      <div className="jx-header">
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div className={`jx-dot ${r.agentSpeaking ? "" : ""}`} style={r.agentSpeaking ? { animation: "jx-flick 2s infinite" } : undefined} />
          <div className="jx-title">JARVIS <span>AIOS</span></div>
          <div className="jx-status">
            {r.state === "connected" ? (r.agentSpeaking ? "▮ hablando" : "● en línea") : r.state === "connecting" ? "◌ conectando" : "○ standby"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {r.state === "connected" && (
            <button className={r.micOn ? "jx-btn jx-btn-primary" : "jx-btn jx-btn-risk"} onClick={r.toggleMic}>
              {r.micOn ? "mic ● live" : "mic ○ muted"}
            </button>
          )}
          {r.state === "connected"
            ? <button className="jx-btn jx-btn-ghost" onClick={r.disconnect}>desconectar</button>
            : <button className="jx-btn jx-btn-primary" onClick={r.connect} disabled={r.state === "connecting"}>
                {r.state === "connecting" ? "conectando…" : "⏻ encender"}
              </button>}
          {onClose && <button className="jx-btn jx-btn-ghost" onClick={onClose}>✕ salir</button>}
        </div>
      </div>

      <div className="jx-hairline" />
      {r.error && <div className="jx-err">{r.error}</div>}

      <div className="jx-stage">
        <span className="jx-label" style={{ position: "absolute", left: 20, top: 16, opacity: 0.6 }}>sys // aios.v1</span>
        <span className="jx-label" style={{ position: "absolute", right: 20, top: 16, opacity: 0.6 }}>room // aios · {r.state}</span>
        <Stage r={r} />
        {r.caption?.text && (
          <div className="jx-cap"><div>
            <span className="jx-cap-who" style={{ color: r.caption.self ? "var(--j-blue)" : "var(--j-cyan)" }}>{r.caption.self ? "tú" : "jarvis"}</span>
            <span style={{ fontSize: 14 }}>{r.caption.text}</span>
          </div></div>
        )}
      </div>

      <div className="jx-foot">di: “dame el brief” · “enséñame las métricas” · “¿qué está en riesgo?” · “¿a quién presento?” · “dame 25 minutos”</div>
    </div>
  )
}

function Stage({ r }: { r: ReturnType<typeof useJarvisRoom> }) {
  if (!r.latest) {
    return <Idle text={r.state === "connected" ? "Conectado. Pídele el brief, las métricas o el plan." : "Enciende y habla. JARVIS se une a esta sala."} />
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

function Idle({ text }: { text: string }) {
  return (
    <div className="jx-idle">
      <div className="jx-reactor">
        <div className="jx-ring jx-ring1" />
        <div className="jx-ring jx-ring2" />
        <div className="jx-core" />
      </div>
      <p style={{ maxWidth: 440, textAlign: "center", fontSize: 14, color: "var(--j-dim)", letterSpacing: "0.05em" }}>{text}</p>
    </div>
  )
}

function Brief({ d }: { d: BriefData }) {
  const head = useTypewriter(d.headline, 24)
  const note = useTypewriter(d.note, 12, d.headline.length * 24 + 400)
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", gap: 22, padding: 32 }}>
      <div className="jx-label">Daily Brief · {d.date}</div>
      <h1 className={`jx-glow ${head.done ? "" : "jx-caret"}`} style={{ fontSize: 30, fontWeight: 600, color: "#fff", minHeight: 40, lineHeight: 1.2 }}>{head.out}</h1>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {d.signals.map((s, i) => (
          <div key={i} className="jx-panel jx-fade" style={{ padding: 16, animationDelay: `${450 + i * 140}ms` }}>
            <div className="jx-label">{s.label}</div>
            <div className="jx-glow" style={{ fontSize: 22, fontWeight: 700, color: toneColor[s.tone], marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>
      <p className={note.done ? "" : "jx-caret"} style={{ marginTop: "auto", maxWidth: 640, color: "var(--j-dim)" }}>{note.out}</p>
    </div>
  )
}

const MW = 760, MH = 300, MP = { l: 52, r: 18, t: 24, b: 34 }
function Metrics({ d }: { d: MetricsData }) {
  const pathRef = useRef<SVGPathElement>(null)
  const [len, setLen] = useState(0); const [draw, setDraw] = useState(false)
  const g = useMemo(() => {
    const pts = d.points, vals = pts.map((p) => p.v)
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
    <div style={{ height: "100%", display: "flex", flexDirection: "column", gap: 12, padding: 32 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div><div className="jx-label">Métricas · {d.range_days} días</div>
          <div className="jx-glow" style={{ fontSize: 22, fontWeight: 600, color: "#fff" }}>{d.label}</div></div>
        <div className="jx-glow" style={{ fontSize: 20, fontWeight: 700, color: up ? "var(--j-good)" : "var(--j-risk)" }}>{up ? "▲" : "▼"} {Math.abs(d.delta_pct).toFixed(0)}%</div>
      </div>
      <svg viewBox={`0 0 ${MW} ${MH}`} style={{ width: "100%", flex: 1 }}>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const y = MP.t + f * g.ih, val = g.max - f * (g.max - g.min)
          return <g key={f}><line x1={MP.l} y1={y} x2={MW - MP.r} y2={y} stroke="#16304f" opacity={0.5} /><text x={MP.l - 8} y={y + 4} textAnchor="end" fontSize={11} fill="#5c7ca6">{fmt(val)}</text></g>
        })}
        {d.points.length > 0 && <>
          <text x={MP.l} y={MH - 10} fontSize={11} fill="#5c7ca6">{sd(d.points[0].t)}</text>
          <text x={MW - MP.r} y={MH - 10} textAnchor="end" fontSize={11} fill="#5c7ca6">{sd(d.points[d.points.length - 1].t)}</text>
        </>}
        <path ref={pathRef} d={g.line} fill="none" stroke="#4de8ff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
          style={{ filter: "drop-shadow(0 0 6px rgba(77,232,255,0.7))", strokeDasharray: len, strokeDashoffset: draw ? 0 : len, transition: "stroke-dashoffset 1.2s ease-out" }} />
        {last && <circle cx={last[0]} cy={last[1]} r={5} fill="#4de8ff" opacity={draw ? 1 : 0} style={{ transition: "opacity 0.4s 1.1s", filter: "drop-shadow(0 0 8px #4de8ff)" }} />}
      </svg>
      <div style={{ display: "flex", gap: 8 }}>
        {d.available.map((m) => <span key={m} className="jx-chip" style={{ border: `1px solid ${m === d.metric ? "rgba(77,232,255,0.7)" : "rgba(22,48,79,0.5)"}`, color: m === d.metric ? "var(--j-cyan)" : "var(--j-dim)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{m.replace("_", " ")}</span>)}
      </div>
    </div>
  )
}

function Pipeline({ d }: { d: PipelineData }) {
  const maxC = Math.max(...d.stages.map((s) => s.count), 1)
  const sizeL: Record<string, string> = { S: "Small", M: "Mid", L: "Large" }
  return (
    <div style={{ height: "100%", display: "grid", gridTemplateColumns: "3fr 2fr", gap: 24, padding: 32 }}>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 12 }}>
        <div className="jx-label">Deal Funnel</div>
        {d.stages.map((s, i) => (
          <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 96, textAlign: "right", fontSize: 13, color: "var(--j-dim)" }}>{s.label}</div>
            <div style={{ position: "relative", height: 36, flex: 1, borderRadius: 6, overflow: "hidden", background: "rgba(22,48,79,0.2)" }}>
              <div className="jx-growx" style={{ height: "100%", width: `${(s.count / maxC) * 100}%`, borderRadius: 6, background: "linear-gradient(90deg,#3d7bff,#4de8ff)", animationDelay: `${i * 130}ms`, boxShadow: "0 0 16px rgba(77,232,255,0.4)" }} />
              <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 13, fontWeight: 700, color: "#fff" }}>{s.count}</span>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div className="jx-label">Riesgo · <span style={{ color: "var(--j-risk)" }}>{d.at_risk_count}</span></div>
        <div className="jx-scroll" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {d.deals.map((dl, i) => (
            <div key={dl.name} className={`jx-fade ${dl.at_risk ? "jx-riskpulse" : ""}`} style={{ borderRadius: 8, padding: 12, animationDelay: `${i * 90}ms`, border: `1px solid ${dl.at_risk ? "rgba(255,61,85,0.6)" : "rgba(22,48,79,0.5)"}`, background: dl.at_risk ? "rgba(255,61,85,0.05)" : "var(--j-panel)" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 600, color: dl.at_risk ? "var(--j-risk)" : "var(--j-text)" }}>{dl.name}</span>
                <span className="jx-label">{dl.stage} · {sizeL[dl.size]}</span>
              </div>
              {dl.at_risk && dl.reason && <div style={{ marginTop: 4, fontSize: 13, color: "rgba(255,61,85,0.8)" }}>⚠ {dl.reason}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Intel({ d }: { d: IntelData }) {
  const icon = (t: string) => t === "meeting" ? "◈ Meeting" : t === "doc" ? "▤ Doc" : "✉ Message"
  const col = (t: string) => t === "meeting" ? "var(--j-cyan)" : t === "doc" ? "var(--j-good)" : "var(--j-blue)"
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", gap: 14, padding: 32 }}>
      <div className="jx-label">Intel{d.query ? ` · ${d.query}` : ""}</div>
      <div className="jx-scroll" style={{ display: "flex", flexDirection: "column", gap: 12, paddingLeft: 18, borderLeft: "1px solid rgba(22,48,79,0.6)" }}>
        {d.timeline.map((it, i) => (
          <div key={i} className="jx-fade" style={{ position: "relative", animationDelay: `${i * 90}ms` }}>
            <span style={{ position: "absolute", left: -25, top: 6, width: 10, height: 10, borderRadius: "50%", border: `2px solid ${col(it.type)}`, background: "rgba(77,232,255,0.2)", boxShadow: "0 0 10px rgba(77,232,255,0.5)" }} />
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span className="jx-label" style={{ color: col(it.type) }}>{icon(it.type)}</span>
              <span style={{ fontSize: 11, color: "var(--j-dim)" }}>{it.time.replace("T", " ")}</span>
            </div>
            <div style={{ fontWeight: 600, color: "#fff", marginTop: 2 }}>{it.who}</div>
            <div style={{ fontSize: 14, color: "var(--j-dim)" }}>{it.summary}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Actions({ d }: { d: ActionsData }) {
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", gap: 16, padding: 32 }}>
      <div className="jx-label">Plan · {d.date}</div>
      <div className="jx-scroll" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {d.actions.map((a, i) => (
          <div key={a.rank} className="jx-panel jx-fade" style={{ display: "flex", alignItems: "center", gap: 16, padding: 16, animationDelay: `${i * 150}ms` }}>
            <div className="jx-glow" style={{ width: 40, height: 40, flexShrink: 0, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, border: `1px solid ${a.rank === 1 ? "var(--j-cyan)" : "var(--j-line)"}`, color: a.rank === 1 ? "var(--j-cyan)" : "var(--j-dim)" }}>{a.rank}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.title}</div>
              <div style={{ fontSize: 13, color: "var(--j-dim)" }}>{a.why}</div>
            </div>
            <div className="jx-chip jx-label" style={{ border: "1px solid rgba(22,48,79,0.5)" }}>{a.effort}</div>
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
    <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 30 }}>
      <div className="jx-label">{done ? "sesión completa" : "focus // en curso"}</div>
      <div style={{ position: "relative", width: 300, height: 300 }}>
        <svg viewBox="0 0 300 300" style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}>
          <circle cx="150" cy="150" r={R} fill="none" stroke="#16304f" strokeWidth={4} />
          <circle cx="150" cy="150" r={R} fill="none" stroke={done ? "#2fffb0" : "#4de8ff"} strokeWidth={4} strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - frac)} style={{ transition: "stroke-dashoffset 0.3s linear", filter: "drop-shadow(0 0 10px rgba(77,232,255,0.7))" }} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div className="jx-glow" style={{ fontSize: 60, fontWeight: 600, color: done ? "var(--j-good)" : "#fff", fontVariantNumeric: "tabular-nums" }}>{done ? "TIME" : `${mm}:${ss}`}</div>
          <div className="jx-label" style={{ marginTop: 12 }}>{d.label}</div>
        </div>
      </div>
      <div className="jx-label">{d.minutes} min · llamadas en espera</div>
    </div>
  )
}

function Match({ d }: { d: MatchData }) {
  const g = d.gaps ?? {}
  const sc = (s: number) => s >= 70 ? "#2fffb0" : s >= 40 ? "#4de8ff" : "#5c7ca6"
  if (d.unavailable || d.pairs.length === 0) {
    const prem = g.premium_members ?? 0
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column", gap: 12, padding: 32 }}>
        <div className="jx-label">Matchmaking avanzado{d.generated ? ` · ${d.generated}` : ""}</div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, textAlign: "center", padding: "0 40px" }}>
          <div className="jx-glow" style={{ fontSize: 20, color: "var(--j-warn)" }}>{d.unavailable ? "Sin datos de NES" : "Aún no hay miembros premium"}</div>
          <p style={{ maxWidth: 520, fontSize: 14, color: "var(--j-dim)", lineHeight: 1.6 }}>
            {d.unavailable ?? (prem === 0
              ? "El matchmaking avanzado cruza perfiles premium (Rocket Fuel · Working Genius · Give and Take · DISC). En cuanto haya perfiles completos aparecen aquí."
              : `${g.eligible ?? 0} de ${prem} premium tienen el perfil avanzado completo. Hacen falta al menos dos.`)}
          </p>
          <div style={{ display: "flex", gap: 20, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.2em", color: "var(--j-dim)" }}>
            <span>miembros <b style={{ color: "var(--j-text)" }}>{g.total_members ?? 0}</b></span>
            <span>premium <b style={{ color: "var(--j-text)" }}>{g.premium_members ?? 0}</b></span>
            <span>perfiles avanzados <b style={{ color: "var(--j-text)" }}>{g.advanced_profiles ?? 0}</b></span>
          </div>
        </div>
      </div>
    )
  }
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", gap: 14, padding: 32 }}>
      <div className="jx-label">Matchmaking avanzado · {d.generated}</div>
      <div className="jx-scroll" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {d.pairs.map((p, i) => (
          <div key={`${p.a}-${p.b}`} className="jx-panel jx-fade" style={{ padding: 16, animationDelay: `${i * 140}ms` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <span style={{ fontWeight: 600, color: "#fff" }}>{p.a}</span>
                <span className="jx-glow" style={{ color: "var(--j-cyan)" }}>⇄</span>
                <span style={{ fontWeight: 600, color: "#fff" }}>{p.b}</span>
                {p.mutual && <span className="jx-chip" style={{ color: "var(--j-good)", border: "1px solid rgba(63,202,125,0.4)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.2em" }}>✦ mutuo</span>}
              </div>
              <span style={{ fontSize: 18, fontWeight: 700, color: sc(p.score), fontVariantNumeric: "tabular-nums" }}>{p.score}</span>
            </div>
            <div style={{ marginTop: 8, height: 4, borderRadius: 4, overflow: "hidden", background: "rgba(22,48,79,0.4)" }}>
              <div className="jx-growx" style={{ height: "100%", width: `${p.score}%`, borderRadius: 4, background: `linear-gradient(90deg,#3d7bff,${sc(p.score)})`, animationDelay: `${i * 140 + 150}ms` }} />
            </div>
            {p.reasons.length > 0 && (
              <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
                {p.reasons.map((rs, j) => {
                  const c = FW_COLOR[rs.framework] ?? "#5c7ca6"
                  return <span key={j} className="jx-chip" style={{ border: `1px solid ${c}55`, background: `${c}12`, color: c }}>
                    <b style={{ textTransform: "uppercase", letterSpacing: "0.06em", fontSize: 10 }}>{rs.framework}</b>
                    <span style={{ color: "var(--j-dim)" }}>{rs.text}</span>
                  </span>
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
