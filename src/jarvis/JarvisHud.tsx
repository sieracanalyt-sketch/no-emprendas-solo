import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useJarvisRoom, type AgentState, type TranscriptMsg } from "./useJarvisRoom"
import { RenderType } from "./contract"
import type {
  ActionsData, BriefData, FocusData, IntelData, MatchData, MetricsData,
  PipelineData, TaskListData, Tone,
} from "./contract"
import { fetchMergeContext, digestForAgent } from "./mergeContext"
import { executeMergeActions, saveTaskListToBacklog } from "./workflowAgent"
import { useUser } from "../hooks/useUser"
import "./jarvis.css"

// MERGE — asistente de voz del fundador, embebido en NES con estética minimalista.
// La lógica de conexión vive en useJarvisRoom; aquí solo se presenta.

const toneColor: Record<Tone, string> = { up: "#9a9d78", down: "#f85149", warn: "#d29922", flat: "var(--text)" }
const AXIS = "var(--text-dimmer)"
const GRID = "rgba(var(--overlay-rgb), 0.06)"

function useTypewriter(text: string, speed = 20, delay = 0) {
  const [out, setOut] = useState(""); const [done, setDone] = useState(false)
  useEffect(() => {
    setOut(""); setDone(false)
    const words = text.split(" ")
    let i = 0; let iv: ReturnType<typeof setInterval>
    const t = setTimeout(() => {
      iv = setInterval(() => {
        i++; setOut(words.slice(0, i).join(" "))
        if (i >= words.length) { clearInterval(iv); setDone(true) }
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

// Iconos de las tarjetas (SVG de línea, sin emojis)
const capIc = { width: 17, height: 17, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" } as const
const IcTileMatch = () => <svg {...capIc}><circle cx="7" cy="7" r="2.5" /><circle cx="17" cy="7" r="2.5" /><circle cx="12" cy="17.5" r="2.5" /><path d="M9.3 7.8h5.4M8.4 9.2l2.6 5.6M15.6 9.2 13 14.8" /></svg>
const IcTileCal = () => <svg {...capIc}><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9h18M8 2.5v4M16 2.5v4" /></svg>
const IcTileBoard = () => <svg {...capIc}><rect x="3" y="3" width="7" height="18" rx="1.5" /><rect x="14" y="3" width="7" height="11" rx="1.5" /></svg>
const IcTileHelp = () => <svg {...capIc}><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 .8-1 1.7M12 17h.01" /></svg>
const IcTileFocus = () => <svg {...capIc}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="0.6" fill="currentColor" /></svg>
const IcTileOrganize = () => <svg {...capIc}><path d="M4 6h10M4 12h13M4 18h7" /><path d="M17.5 17.5 19 19l3-3.5" /></svg>

// Lo que el usuario puede pedirle a MERGE (intro). Cada tile lanza una acción
// real: comandos con `cmd`, peticiones en lenguaje natural con `text`. Los que
// llevan `context: true` sincronizan antes tu agenda + workflow con el agente.
type Cap = {
  id: string; ic: ReactNode; tt: string; sub: string; label: string
  cmd?: string; text?: string; kind?: "agenda" | "workflow"
}
const CAPS: Cap[] = [
  { id: "match", ic: <IcTileMatch />, tt: "Matchmaking avanzado", label: "Cruzando los perfiles de la comunidad",
    sub: "Cruza los perfiles reales de NES y te sugiere con quién conectar.", cmd: "matchmaking" },
  { id: "agenda", ic: <IcTileCal />, tt: "Mi agenda", label: "Revisando tu agenda",
    sub: "Lee tu calendario y te ayuda a organizar los próximos días.",
    text: "Repasa mi agenda de los próximos días y ayúdame a organizarla.", kind: "agenda" },
  { id: "workflow", ic: <IcTileBoard />, tt: "Mi workflow", label: "Revisando tu workflow",
    sub: "Tus tareas, prioridades (Eisenhower) y el mapa del equipo.",
    text: "Repasa mi workflow —tareas, prioridades y equipo— y dime en qué centrarme.", kind: "workflow" },
  { id: "organize", ic: <IcTileOrganize />, tt: "Organiza mis tareas", label: "Reorganizando tu tablero",
    sub: "MERGE reordena el tablero por ti: prioriza, mueve y reparte.",
    text: "Organiza mis tareas: repasa el tablero, decide qué es urgente y qué es importante, "
      + "y aplica tú los cambios —mueve las tareas de columna, ajústales la prioridad y "
      + "repártelas entre el equipo—. Cuéntame qué has cambiado y por qué.", kind: "workflow" },
  { id: "capabilities", ic: <IcTileHelp />, tt: "¿Qué puedes hacer?", label: "Repasando lo que sé hacer",
    sub: "MERGE te cuenta, con voz, todo lo que sabe hacer.", cmd: "capabilities" },
  { id: "focus", ic: <IcTileFocus />, tt: "Sesión de foco", label: "Montando tu sesión de foco",
    sub: "Un temporizador guiado para concentrarte sin ruido.", text: "Empecemos una sesión de foco de 25 minutos." },
]
const capById = (id: string) => CAPS.find(c => c.id === id)!

type Action = { cmd?: string; text?: string; label?: string; kind?: "agenda" | "workflow" }
// Cada cambio que MERGE aplica de verdad sobre el workflow, para que se vea.
type AppliedChange = { id: string; ok: boolean; text: string }

export default function MergeConsole() {
  const r = useJarvisRoom()
  const [user] = useUser()
  const [draft, setDraft] = useState("")
  // Qué está haciendo MERGE ahora mismo (rótulo del estado "trabajando").
  const [workLabel, setWorkLabel] = useState<string | null>(null)
  const [applied, setApplied] = useState<AppliedChange[]>([])
  // Acción pendiente: si escribes/pulsas algo estando desconectado, se guarda
  // aquí y se ejecuta sola en cuanto la sesión queda conectada (auto-arranque).
  const pending = useRef<Action | null>(null)
  // `r` cambia de identidad cada render; una ref estable evita re-crear efectos.
  const rRef = useRef(r); rRef.current = r
  const userRef = useRef(user); userRef.current = user

  const statusText = r.state === "connected" ? "en línea"
    : r.state === "connecting" ? "conectando…" : "desconectado"

  // En cuanto MERGE empieza a responder (o llega un panel), deja de "trabajar".
  useEffect(() => {
    if (r.agentState === "speaking" || r.agentState === "listening" || r.agentState === "idle") setWorkLabel(null)
  }, [r.agentState])
  useEffect(() => { if (r.latest) setWorkLabel(null) }, [r.latest])

  // Ejecuta una acción con la sesión ya conectada. Para agenda/workflow: recoge
  // el contexto del usuario, se lo pasa al agente (merge.context) y además
  // incrusta un resumen legible en el mensaje para que funcione ya mismo.
  const execAction = async (a: Action) => {
    const rr = rRef.current, u = userRef.current
    if (a.label) setWorkLabel(a.label)
    if (a.kind && u) {
      try {
        const ctx = await fetchMergeContext(u.id)
        rr.sendContext(ctx)
        const digest = digestForAgent(ctx, a.kind)
        await rr.sendText(`${a.text ?? ""}\n\n${digest}`.trim())
        return
      } catch { /* si falla el contexto, cae al texto plano */ }
    }
    if (a.cmd) rr.sendCommand(a.cmd)
    else if (a.text) await rr.sendText(a.text)
  }

  // Al conectar: sincroniza SIEMPRE el contexto (agenda + workflow) y ejecuta lo
  // que quedó pendiente (mensaje escrito o capacidad).
  useEffect(() => {
    if (r.state !== "connected") return
    const u = userRef.current
    if (u) fetchMergeContext(u.id).then((ctx) => rRef.current.sendContext(ctx)).catch(() => {})
    const p = pending.current
    pending.current = null
    if (p) void execAction(p)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.state])

  // MERGE pidiendo tocar el workflow. Lo ejecuta la app con la sesión del
  // usuario (misma RLS que a mano), le devuelve el resultado para que pueda
  // confirmarlo en voz, y deja el cambio a la vista.
  const { setActionHandler } = r
  useEffect(() => {
    setActionHandler(async (env) => {
      setWorkLabel("Aplicando cambios en tu workflow")
      const res = await executeMergeActions(env)
      rRef.current.sendActionResult(res)
      setApplied((prev) => [
        ...prev,
        ...res.outcomes.map((o, i) => ({ id: `${Date.now()}-${i}`, ok: o.ok, text: o.message })),
      ].slice(-5))
      setWorkLabel(null)
    })
    return () => setActionHandler(null)
  }, [setActionHandler])

  // Lanza una capacidad: si hay sesión la ejecuta; si no, la deja pendiente y
  // arranca MERGE (se ejecutará sola al conectar).
  const runCap = (c: Cap) => {
    const a: Action = { cmd: c.cmd, text: c.text, label: c.label, kind: c.kind }
    if (r.state === "connected") void execAction(a)
    else if (r.state !== "connecting") { pending.current = a; void r.connect() }
  }

  // Enviar texto: si ya hay sesión, manda; si no, arranca MERGE y lo envía solo
  // al conectar. No hace falta pulsar "Iniciar" — escribir y enviar basta.
  function submitText() {
    const t = draft.trim()
    if (!t) return
    const a: Action = { text: t, label: "Procesando tu petición" }
    if (r.state === "connected") { void execAction(a); setDraft("") }
    else if (r.state !== "connecting") { pending.current = a; setDraft(""); void r.connect() }
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
            <button className="mg-btn" onClick={() => runCap(capById("agenda"))} title="MERGE lee tu agenda y te ayuda a organizarla">
              Mi agenda
            </button>
          )}
          {r.state === "connected" && (
            <button className="mg-btn" onClick={() => runCap(capById("workflow"))} title="Tus tareas, prioridades y el mapa del equipo">
              Mi workflow
            </button>
          )}
          {r.state === "connected" && (
            <button className="mg-btn" onClick={() => runCap(capById("organize"))} title="MERGE reordena el tablero por ti: prioriza, mueve y reparte">
              Organiza mis tareas
            </button>
          )}
          {r.state === "connected" && (
            <button className="mg-btn mg-btn-accent" onClick={() => runCap(capById("match"))} title="Cruza los perfiles reales de la comunidad y sugiere conexiones">
              Matchmaking avanzado
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
        {r.state === "connected" && r.agentState !== "thinking" && <StateBar s={r.agentState} />}
        <Stage r={r} onCap={runCap} />
        {/* Con un panel gráfico en pantalla, lo hablado va como subtítulo inferior */}
        {r.latest && <CaptionOverlay msgs={r.transcript} speaking={r.agentState === "speaking"} />}
        {/* MERGE trabajando: enseña el esfuerzo con datos ocultos (privacidad) */}
        {r.agentState === "thinking" && <WorkingOverlay label={workLabel ?? "Procesando tu petición"} />}
      </div>

      {/* Lo que MERGE ha cambiado de verdad en tu workflow, a la vista */}
      {applied.length > 0 && <AppliedFeed items={applied} onClear={() => setApplied([])} />}

      {/* Entrada — SIEMPRE visible. Escribe y envía: si no hay sesión, MERGE
          arranca solo. Menos glow para que el texto se lea (design.md §9). */}
      <div
        className={`mg-composer-wrap ${r.agentState === "thinking" || r.agentState === "speaking" ? "mg-working" : ""}`}
        style={{ marginTop: 16 }}
      >
        <div className="mg-glass mg-glass-pill mg-composer">
          {r.state === "connected" && (
            <>
              <button
                className={`mg-icon-btn ${r.micOn ? "mg-icon-on" : "mg-icon-off"}`}
                onClick={r.toggleMic}
                title={r.micOn ? "Micro activo — pulsa para silenciar" : "Micro apagado — pulsa para hablar"}
                aria-label={r.micOn ? "Silenciar micro" : "Activar micro"}>
                {r.micOn ? <IcMic /> : <IcMicOff />}
              </button>
              {/* Parar: corta la frase en curso; activo solo cuando hay algo que cortar */}
              <button
                className="mg-icon-btn"
                onClick={() => r.sendCommand("stop")}
                disabled={r.agentState !== "speaking" && r.agentState !== "thinking"}
                title="Parar lo que MERGE está diciendo"
                aria-label="Parar respuesta">
                <IcStop />
              </button>
            </>
          )}
          <input
            className="mg-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitText() } }}
            placeholder={
              r.state === "connecting" ? "Conectando con MERGE…"
                : r.state === "connected" ? (r.micOn ? "Escríbele a MERGE… o simplemente habla" : "Escríbele a MERGE…")
                : "Escribe y pulsa Enter para empezar…"
            }
            aria-label="Mensaje para MERGE"
          />
          <button className="mg-icon-btn mg-icon-send" onClick={submitText} disabled={!draft.trim() || r.state === "connecting"}
            title="Enviar (Enter)" aria-label="Enviar mensaje">
            <IcSend />
          </button>
        </div>
      </div>

      {/* Hint — one dim line */}
      <p style={{ marginTop: 14, textAlign: "center", fontSize: 12.5, color: "var(--text-dimmer)" }}>
        {r.state === "connected"
          ? "Habla o escribe con naturalidad · MERGE conoce tu agenda, tu workflow y la comunidad"
          : "Escribe abajo y pulsa Enter para empezar — o dale a “Iniciar MERGE” para hablar por voz."}
      </p>
    </div>
  )
}

// Clear, always-visible indicator of what MERGE is doing right now.
function StateBar({ s }: { s: AgentState }) {
  if (s === "idle") return null
  if (s === "listening") return (
    <div className="mg-state" style={{ color: "#9a9d78" }}>
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

function Stage({ r, onCap }: { r: ReturnType<typeof useJarvisRoom>; onCap: (c: Cap) => void }) {
  if (!r.latest) {
    // Sin panel gráfico: la conversación ES la pantalla (texto en streaming).
    if (r.transcript.length > 0) {
      return <Conversation msgs={r.transcript} speaking={r.agentState === "speaking"} />
    }
    return <Intro connected={r.state === "connected"} onCap={onCap} />
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
    case RenderType.TASKLIST: return <TaskList key={ts} d={data as TaskListData} />
    default: return (
      <div className="flex items-center justify-center" style={{ minHeight: 480, padding: 40, textAlign: "center" }}>
        <p style={{ maxWidth: 400, fontSize: 14, color: "var(--text-dim)" }}>Tipo de panel desconocido: {String(type)}</p>
      </div>
    )
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

function IcLock() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  )
}

// Intro: deja claro PARA QUÉ sirve MERGE y qué puede pedirle el usuario.
// Nunca una pantalla en blanco (design.md §9). Las tarjetas arrancan la sesión
// solas — no hace falta pulsar "Iniciar".
function Intro({ connected, onCap }: { connected: boolean; onCap: (c: Cap) => void }) {
  return (
    <div className="flex flex-col items-center justify-center" style={{ minHeight: 480, padding: "48px 28px", gap: 26, textAlign: "center" }}>
      <span className="mg-orb" style={{ width: 48, height: 48 }} />
      <div>
        <h2 style={{ fontSize: 23, fontWeight: 600, color: "var(--text)", letterSpacing: "-0.01em", margin: 0 }}>
          Tu copiloto de fundador
        </h2>
        <p style={{ maxWidth: 470, margin: "10px auto 0", fontSize: 14.5, lineHeight: 1.65, color: "var(--text-dim)" }}>
          MERGE conoce a la comunidad de NES, tu agenda y tu workflow. Habla o escribe con
          naturalidad: te cruza con las personas adecuadas, te resume el día y piensa contigo.
        </p>
      </div>

      {/* Qué puedes pedirle — al pulsar, MERGE arranca solo */}
      <div className="mg-cap-grid">
        {CAPS.map((c) => (
          <button key={c.tt} className="mg-cap-tile" onClick={() => onCap(c)}
            title={connected ? c.sub : "Púlsalo y MERGE arranca solo"}>
            <span className="mg-cap-ic" style={{ color: "var(--accent)" }}>{c.ic}</span>
            <span style={{ display: "block" }}>
              <span className="mg-cap-tt" style={{ display: "block" }}>{c.tt}</span>
              <span className="mg-cap-sub" style={{ display: "block" }}>{c.sub}</span>
            </span>
          </button>
        ))}
      </div>

      <p style={{ fontSize: 11.5, color: "var(--text-dimmer)", display: "inline-flex", alignItems: "center", gap: 6, margin: 0 }}>
        <IcLock /> Tus datos y los de la comunidad nunca se muestran en crudo.
      </p>
    </div>
  )
}

// Estado "trabajando": preview difuminado + pixelado que NO revela datos.
// Enseña que MERGE está haciendo algo real sin filtrar información.
function WorkingOverlay({ label }: { label: string }) {
  return (
    <div className="mg-working-overlay">
      <div className="mg-working-blur" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="mg-ghost-card">
            <div className="mg-ghost-avatar" />
            <div className="mg-ghost-lines">
              <div className="mg-ghost-line" style={{ width: `${58 - i * 6}%` }} />
              <div className="mg-ghost-line" style={{ width: `${88 - i * 4}%`, opacity: 0.55 }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mg-pixel-grid" aria-hidden />
      <div className="mg-working-scrim" aria-hidden />
      <div className="mg-working-badge">
        <span className="mg-spinner" aria-hidden />
        {label}…
      </div>
      <div className="mg-privacy">
        <IcLock /> Trabajando sobre datos reales · ocultos para proteger la privacidad
      </div>
    </div>
  )
}

// Lo que MERGE acaba de cambiar en el workflow. No es un toast decorativo: cada
// línea es una escritura real en la base de datos que ya está en el tablero.
function AppliedFeed({ items, onClear }: { items: AppliedChange[]; onClear: () => void }) {
  return (
    <div className="mg-glass" style={{ marginTop: 14, padding: "12px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
        <span className="mg-label">MERGE ha tocado tu workflow</span>
        <button className="mg-btn" style={{ padding: "3px 10px", fontSize: 12 }} onClick={onClear}>Vale</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map((it) => (
          <div key={it.id} className="mg-fade" style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: 13.5, lineHeight: 1.5 }}>
            <span aria-hidden style={{ color: it.ok ? "#9a9d78" : "#f85149", fontWeight: 700, lineHeight: 1.5 }}>
              {it.ok ? "✓" : "✕"}
            </span>
            <span style={{ color: it.ok ? "var(--text)" : "var(--text-dim)" }}>{it.text}</span>
          </div>
        ))}
      </div>
      <p style={{ margin: "10px 0 0", fontSize: 11.5, color: "var(--text-dimmer)" }}>
        Ya está aplicado en Flujo de trabajo — no tienes que hacer nada más.
      </p>
    </div>
  )
}

// La lista de tareas que MERGE propone mientras habláis. Marcas lo que vale,
// descartas lo demás y lo que quede entra en el Backlog del workflow.
function TaskList({ d }: { d: TaskListData }) {
  const items = useMemo(() => (Array.isArray(d.items) ? d.items : []), [d.items])
  const [keep, setKeep] = useState<boolean[]>(() => items.map(() => true))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<number | null>(null)
  const [err, setErr] = useState<string | null>(null)
  // Cada panel llega con su `key={ts}`: una lista nueva es un componente nuevo,
  // así que el estado arranca limpio sin necesidad de sincronizarlo a mano.
  const chosen = items.filter((_, i) => keep[i])
  const toggle = (i: number) => setKeep((prev) => prev.map((v, j) => (j === i ? !v : v)))

  const save = async () => {
    if (!chosen.length || saving) return
    setSaving(true); setErr(null)
    const res = await saveTaskListToBacklog(chosen)
    setSaving(false)
    if (res.error) setErr(res.error)
    else setSaved(res.created)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: 28, minHeight: 460 }}>
      <div className="mg-label">{d.title || "Tu lista de tareas"}</div>
      {d.intro && <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "var(--text-dim)" }}>{d.intro}</p>}

      <div className="mg-scroll" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.length === 0 && (
          <p style={{ fontSize: 13.5, color: "var(--text-dim)" }}>MERGE no ha propuesto ninguna tarea todavía.</p>
        )}
        {items.map((it, i) => {
          const on = keep[i]
          return (
            <button key={`${it.title}-${i}`} onClick={() => toggle(i)} disabled={saved !== null}
              className="mg-card mg-fade"
              style={{
                display: "flex", alignItems: "flex-start", gap: 12, padding: 14, textAlign: "left",
                animationDelay: `${i * 60}ms`, opacity: on ? 1 : 0.45,
                cursor: saved === null ? "pointer" : "default",
              }}>
              <span aria-hidden style={{
                marginTop: 1, width: 19, height: 19, flexShrink: 0, borderRadius: 6,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 700, color: on ? "var(--t1)" : "transparent",
                background: on ? "var(--accent)" : "transparent",
                border: `1.5px solid ${on ? "var(--accent)" : "var(--border-strong)"}`,
              }}>✓</span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{
                  display: "block", fontSize: 14.5, fontWeight: 600, color: "var(--text)",
                  textDecoration: on ? "none" : "line-through",
                }}>{it.title}</span>
                {it.note && (
                  <span style={{ display: "block", marginTop: 3, fontSize: 13, lineHeight: 1.5, color: "var(--text-dim)" }}>
                    {it.note}
                  </span>
                )}
              </span>
              {it.priority && <span className="mg-chip" style={{ flexShrink: 0 }}>{it.priority}</span>}
            </button>
          )
        })}
      </div>

      {err && <div className="mg-err">No pude guardarlas: {err}</div>}

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: "auto", flexWrap: "wrap" }}>
        {saved !== null ? (
          <span style={{ fontSize: 13.5, color: "#9a9d78" }}>
            ✓ {saved} {saved === 1 ? "tarea guardada" : "tareas guardadas"} en el Backlog de tu workflow.
          </span>
        ) : (
          <>
            <button className="mg-btn mg-btn-primary" onClick={save} disabled={!chosen.length || saving}>
              {saving ? "Guardando…" : `Guardar ${chosen.length} en Backlog`}
            </button>
            <span style={{ fontSize: 12, color: "var(--text-dimmer)" }}>
              Desmarca lo que no quieras. Lo que guardes entra en Tareas → Backlog.
            </span>
          </>
        )}
      </div>
    </div>
  )
}

function Brief({ d }: { d: BriefData }) {
  const head = useTypewriter(d.headline, 90)
  const note = useTypewriter(d.note, 60, d.headline.split(" ").length * 90 + 350)
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
        <div style={{ fontSize: 18, fontWeight: 600, color: up ? "#9a9d78" : "#f85149" }}>{up ? "▲" : "▼"} {Math.abs(d.delta_pct).toFixed(0)}%</div>
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
        {d.available.map((m) => <span key={m} className="mg-chip" style={m === d.metric ? { borderColor: "rgba(194, 84, 47,0.4)", background: "rgba(194, 84, 47,0.1)", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.04em" } : { textTransform: "uppercase", letterSpacing: "0.04em" }}>{m.replace("_", " ")}</span>)}
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
            <div style={{ position: "relative", height: 34, flex: 1, borderRadius: 8, overflow: "hidden", background: "rgba(var(--overlay-rgb), 0.03)" }}>
              <div className="mg-grow" style={{ height: "100%", width: `${(s.count / maxC) * 100}%`, borderRadius: 8, background: "var(--accent)", animationDelay: `${i * 120}ms` }} />
              <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 13, fontWeight: 600, color: "var(--on-accent)" }}>{s.count}</span>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, minHeight: 0 }}>
        <div className="mg-label">En riesgo · <span style={{ color: "#f85149" }}>{d.at_risk_count}</span></div>
        <div className="mg-scroll" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {d.deals.map((dl, i) => (
            <div key={dl.name} className="mg-fade" style={{ borderRadius: 12, padding: 12, animationDelay: `${i * 80}ms`, background: dl.at_risk ? "rgba(248,81,73,0.07)" : "rgba(var(--overlay-rgb), 0.025)" }}>
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
  const col = (t: string) => t === "meeting" ? "var(--accent)" : t === "doc" ? "var(--green)" : "var(--accent-2)"
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
          <circle cx="150" cy="150" r={R} fill="none" stroke="rgba(var(--overlay-rgb), 0.07)" strokeWidth={4} />
          <circle cx="150" cy="150" r={R} fill="none" stroke={done ? "#9a9d78" : "var(--accent)"} strokeWidth={4} strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - frac)} style={{ transition: "stroke-dashoffset 0.3s linear" }} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontSize: 56, fontWeight: 600, color: done ? "#9a9d78" : "var(--text)", fontVariantNumeric: "tabular-nums" }}>{done ? "¡YA!" : `${mm}:${ss}`}</div>
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
                background: "rgba(194, 84, 47,0.15)", color: "var(--accent)",
              }}>{m.posicion}</span>
              <span style={{ fontWeight: 600, fontSize: 15, color: "var(--text)" }}>{m.nombre}</span>
            </div>
            <p style={{ margin: "10px 0 0", fontSize: 13.5, lineHeight: 1.6, color: "var(--text)" }}>{m.porque_encaja}</p>
            <p style={{ margin: "8px 0 0", fontSize: 13, lineHeight: 1.5, color: "var(--text-dim)" }}>
              <b style={{ color: "#9a9d78" }}>Lo mejor: </b>{m.punto_fuerte}
            </p>
            {m.a_hablar_desde_el_principio && (
              <p style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.5, color: "var(--text-dim)" }}>
                <b style={{ color: "var(--accent)" }}>A hablar desde el principio: </b>{m.a_hablar_desde_el_principio}
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
