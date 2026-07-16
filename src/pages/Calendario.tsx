import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../supabase"
import { useUser } from "../hooks/useUser"
import { useCalendar, type NewEvent } from "../hooks/useCalendar"
import {
  type CalEvent,
  START_HOUR,
  END_HOUR,
  HOUR_H,
  GRID_HEIGHT,
  DAY_LABELS,
  startOfWeek,
  addDays,
  sameDay,
  minutesToY,
  yToMinutes,
  minutesOfDay,
  fmtHour,
  fmtClock,
  durationMin,
  layoutDay,
  freeGaps,
  commonFreeGaps,
  attendanceScore,
  timeInTz,
  fmtRangeMin,
  TIMEZONES,
} from "../lib/calendarUtils"
import {
  getGoogleState,
  connectGoogle,
  reconnectGoogleSilent,
  disconnectGoogle,
  pullGoogleEvents,
  pushEventToGoogle,
  updateGoogleEvent,
  deleteGoogleEvent,
  markSynced,
  hasClientId,
  saveClientId,
  type GoogleSyncState,
} from "../lib/googleCalendar"
import GuideButton from "../components/GuideModal"

// ──────────────────────────────────────────────────────────────────────────────
// Tipos auxiliares
// ──────────────────────────────────────────────────────────────────────────────
type Member = { id: string; nombre: string; avatar: string | null }
type KTask = { id: string; title: string; priority: string; status: string }
type Toast = { id: number; text: string; type: "info" | "success" | "warn" }
type Priority = { id: string; label: string; budgetH: number; kind: "meeting" | "focus" | "task" }

const KIND_COLOR: Record<CalEvent["kind"], string> = {
  event: "#5e6ad2",
  meeting: "#3b82f6",
  focus: "#38bdf8",
  task: "#f59e0b",
}

const FOCUS_MIN = 180 // T2-5: huecos > 3h
const PROPOSAL_TTL_H = 12 // T2-4: caducidad por defecto

// Drag payload helpers
const DT_EVENT = "text/x-cal-event"
const DT_TASK = "text/x-cal-task"
const DT_MEMBER = "text/x-cal-member"

// ──────────────────────────────────────────────────────────────────────────────
// Página
// ──────────────────────────────────────────────────────────────────────────────
export default function Calendario() {
  const [user] = useUser()
  const navigate = useNavigate()
  const { events, create, update, remove } = useCalendar(user)

  const [weekRef, setWeekRef] = useState<Date>(() => new Date())
  const [members, setMembers] = useState<Member[]>([])
  const [tasks, setTasks] = useState<KTask[]>([])

  const [urgentMode, setUrgentMode] = useState(false)
  const [urgentConfirm, setUrgentConfirm] = useState(false)
  const [showFocus, setShowFocus] = useState(true)
  const [fusion, setFusion] = useState<Set<string>>(new Set())
  const [previewTz, setPreviewTz] = useState<string>("America/New_York")
  const [showTzPreview, setShowTzPreview] = useState(false)

  // Espejo de Prioridades — datos reales, sin inventar
  const [priorities, setPriorities] = useState<Priority[]>(() => {
    try { return JSON.parse(localStorage.getItem("nes:cal-priorities") ?? "[]") } catch { return [] }
  })
  const [showPriorityForm, setShowPriorityForm] = useState(false)

  const [google, setGoogle] = useState<GoogleSyncState>(() => getGoogleState())
  const [googleEvents, setGoogleEvents] = useState<CalEvent[]>([])
  const [syncing, setSyncing] = useState(false)
  const [googleConnectModal, setGoogleConnectModal] = useState(false)

  // Modales
  const [detail, setDetail] = useState<CalEvent | null>(null)
  const [draft, setDraft] = useState<NewEvent | null>(null)
  const [prep, setPrep] = useState<NewEvent | null>(null)
  const [emergency, setEmergency] = useState(false)

  const [toasts, setToasts] = useState<Toast[]>([])
  const toast = useCallback((text: string, type: Toast["type"] = "info") => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, text, type }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200)
  }, [])

  const weekStart = useMemo(() => startOfWeek(weekRef), [weekRef])
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])

  // ── Persistir prioridades en localStorage ────────────────────────────────────
  useEffect(() => {
    localStorage.setItem("nes:cal-priorities", JSON.stringify(priorities))
  }, [priorities])

  // ── Cargar equipo (solo miembros de workflow_roles) + tareas Kanban ──────────
  useEffect(() => {
    if (!user) return
    // Solo el equipo registrado en Workflow, sin incluir al propio usuario
    supabase
      .from("workflow_roles")
      .select("user_id")
      .neq("user_id", user.id)
      .then(async ({ data: roles }) => {
        if (!roles?.length) { setMembers([]); return }
        const { data: usersData } = await supabase
          .from("users")
          .select("id, nombre, avatar")
          .in("id", roles.map((r: { user_id: string }) => r.user_id))
          .order("nombre")
        setMembers((usersData as Member[]) ?? [])
      })
    supabase
      .from("workflow_tasks")
      .select("id, title, priority, status")
      .neq("status", "done")
      .then(({ data }) => setTasks((data as KTask[]) ?? []))
  }, [user])

  // ── Google: reconexión SILENCIOSA al entrar (sin que el usuario haga nada) ──
  useEffect(() => {
    if (!user) return
    const s = getGoogleState()
    if (s.connected && !s.tokenLoaded && hasClientId()) {
      reconnectGoogleSilent().then((st) => {
        if (st) setGoogle(st)
      })
    }
  }, [user])

  // ── Google: traer eventos reales al conectar / cambiar de semana ────────────
  useEffect(() => {
    if (!user || !google.connected || !google.tokenLoaded) {
      setGoogleEvents([])
      return
    }
    pullGoogleEvents(weekRef, user.id).then(setGoogleEvents)
  }, [user, google.connected, google.tokenLoaded, weekStart, weekRef])

  // ── Caducidad de propuestas (T2-4) ──────────────────────────────────────────
  useEffect(() => {
    const check = () => {
      const now = Date.now()
      events.forEach((e) => {
        if (e.status === "proposed" && e.expires_at && new Date(e.expires_at).getTime() < now) {
          update(e.id, { status: "cancelled" })
          toast(`Propuesta "${e.title}" caducada — hueco liberado`, "warn")
        }
      })
    }
    check()
    const i = window.setInterval(check, 30_000)
    return () => window.clearInterval(i)
  }, [events, update, toast])

  // ── Obsidian Graph (T1-10): registrar reuniones completadas ─────────────────
  const completedNodes = useMemo(() => {
    const now = Date.now()
    return events.filter(
      (e) =>
        (e.kind === "meeting" || e.kind === "event") &&
        e.status !== "cancelled" &&
        new Date(e.end_at).getTime() < now
    ).length
  }, [events])

  // ── Mis eventos vs los de un miembro (Fusión T2-3) ──────────────────────────
  const isMine = useCallback(
    (e: CalEvent) => !!user && (e.owner_id === user.id || e.attendees?.includes(user.id)),
    [user]
  )

  const allVisible = useMemo(() => {
    const mine = events.filter((e) => e.status !== "cancelled" && isMine(e))
    return [...mine, ...googleEvents]
  }, [events, googleEvents, isMine])

  const memberEventsById = useCallback(
    (id: string) =>
      events.filter(
        (e) => e.status !== "cancelled" && (e.owner_id === id || e.attendees?.includes(id))
      ),
    [events]
  )

  // ── Espejo de Prioridades (T2-7) — horas reales por tipo de evento ──────────
  const weekHours = useMemo(() => {
    const ws = weekStart.getTime()
    const we = addDays(weekStart, 7).getTime()
    const inWeek = allVisible.filter((e) => {
      const t = new Date(e.start_at).getTime()
      return t >= ws && t < we && e.status !== "cancelled"
    })
    const sum = (kind: string) =>
      inWeek.filter((e) => e.kind === kind).reduce((acc, e) => acc + durationMin(e) / 60, 0)
    return { meeting: sum("meeting"), focus: sum("focus"), task: sum("task") }
  }, [allVisible, weekStart])

  // ── Crear / editar ──────────────────────────────────────────────────────────
  const openCreate = (day: Date, startMin: number) => {
    const s = new Date(day)
    s.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0)
    const e = new Date(s.getTime() + 60 * 60000)
    setDraft({
      title: "",
      start_at: s.toISOString(),
      end_at: e.toISOString(),
      kind: "event",
      color: KIND_COLOR.event,
      attendees: [],
      urgent: urgentMode,
    })
  }

  const commitCreate = async (ev: NewEvent) => {
    if (ev.kind === "meeting" && (ev.attendees?.length ?? 0) > 0 && !ev.urgent && !ev.prep_answers) {
      setDraft(null)
      setPrep(ev)
      return
    }
    const created = await create(ev)
    setDraft(null)
    if (created && google.connected) {
      const { google_id } = await pushEventToGoogle(created)
      await update(created.id, { google_id })
    }
    toast("Evento creado", "success")
  }

  // ── Reprogramar (drag move) — sincroniza con Google si aplica ───────────────
  const moveEvent = async (id: string, day: Date, newStartMin: number) => {
    // ¿Es un evento importado de Google (no está en Supabase)?
    const gEv = googleEvents.find((e) => e.id === id)
    if (gEv?.google_id) {
      const dur = durationMin(gEv)
      const s = new Date(day)
      s.setHours(Math.floor(newStartMin / 60), newStartMin % 60, 0, 0)
      const e = new Date(s.getTime() + dur * 60000)
      await updateGoogleEvent(gEv.google_id, { start_at: s.toISOString(), end_at: e.toISOString() })
      // Refrescar vista local
      if (user) setGoogleEvents(await pullGoogleEvents(weekRef, user.id))
      toast("Evento actualizado en Google Calendar", "success")
      return
    }
    // Evento NES normal
    const ev = events.find((e) => e.id === id)
    if (!ev) return
    const dur = durationMin(ev)
    const s = new Date(day)
    s.setHours(Math.floor(newStartMin / 60), newStartMin % 60, 0, 0)
    const e = new Date(s.getTime() + dur * 60000)
    await update(id, { start_at: s.toISOString(), end_at: e.toISOString() })
    // Si también tiene google_id, actualizar allí
    if (ev.google_id) {
      await updateGoogleEvent(ev.google_id, { start_at: s.toISOString(), end_at: e.toISOString() })
    }
  }

  // ── Soltar tarea Kanban (T1-9) ──────────────────────────────────────────────
  const dropTask = async (task: KTask, day: Date, startMin: number) => {
    const s = new Date(day)
    s.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0)
    const e = new Date(s.getTime() + 60 * 60000)
    await create({
      title: task.title,
      start_at: s.toISOString(),
      end_at: e.toISOString(),
      kind: "task",
      color: KIND_COLOR.task,
      task_id: task.id,
    })
    toast(`Tarea "${task.title}" planificada`, "success")
  }

  // ── Contrapropuestas en 1 clic (T1-1) ───────────────────────────────────────
  const proposeAlternatives = async (ev: CalEvent) => {
    const dur = durationMin(ev)
    const base = new Date(ev.start_at)
    const offsets = [
      { d: 0, m: 60 },
      { d: 1, m: 0 },
      { d: 2, m: -30 },
    ]
    const expires = new Date(Date.now() + PROPOSAL_TTL_H * 3600_000).toISOString()
    for (const o of offsets) {
      const s = addDays(base, o.d)
      s.setMinutes(s.getMinutes() + o.m)
      const e = new Date(s.getTime() + dur * 60000)
      await create({
        title: `↪ ${ev.title}`,
        start_at: s.toISOString(),
        end_at: e.toISOString(),
        kind: "meeting",
        color: "#a78bfa",
        status: "proposed",
        proposal_for: ev.id,
        expires_at: expires,
        attendees: ev.attendees,
        prep_answers: { auto: true },
      })
    }
    setDetail(null)
    toast("3 alternativas propuestas (caducan en 12 h)", "success")
  }

  // ── Congelación de Emergencia (T2-6) ────────────────────────────────────────
  const freezeAgenda = async (hours: number) => {
    const now = Date.now()
    const limit = now + hours * 3600_000
    const affected = events.filter(
      (e) =>
        isMine(e) &&
        e.status !== "cancelled" &&
        new Date(e.start_at).getTime() > now &&
        new Date(e.start_at).getTime() <= limit
    )
    for (const e of affected) await update(e.id, { status: "cancelled" })
    setEmergency(false)
    toast(
      `${affected.length} cita${affected.length !== 1 ? "s" : ""} congelada${
        affected.length !== 1 ? "s" : ""
      } · aviso automático enviado`,
      "warn"
    )
  }

  // ── Google connect / sync ───────────────────────────────────────────────────
  const handleConnect = async () => {
    setGoogleConnectModal(false)
    setSyncing(true)
    try {
      const s = await connectGoogle()
      setGoogle(s)
      toast(`Google Calendar conectado · ${s.email ?? "cuenta de Google"}`, "success")
    } catch (err) {
      toast(`No se pudo conectar: ${(err as Error).message}`, "warn")
    }
    setSyncing(false)
  }
  const handleSync = async () => {
    if (!user) return
    setSyncing(true)
    const ev = await pullGoogleEvents(weekRef, user.id)
    setGoogleEvents(ev)
    setGoogle(await markSynced())
    setSyncing(false)
    toast("Sincronizado con Google", "success")
  }
  const handleDisconnect = async () => {
    setGoogle(await disconnectGoogle())
    setGoogleEvents([])
    toast("Google Calendar desconectado")
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center page-viewport">
        <p className="text-[13px]" style={{ color: "var(--text-dim)" }}>Cargando…</p>
      </div>
    )
  }

  const weekLabel = `${weekStart.toLocaleDateString("es-ES", { day: "numeric", month: "short" })} – ${addDays(
    weekStart,
    6
  ).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}`

  return (
    <div className="flex flex-col page-viewport">
      {/* ════════ TOOLBAR ════════ */}
      <div
        className="flex items-center gap-x-3 gap-y-2 px-4 md:px-6 min-h-14 py-2 shrink-0 flex-wrap"
        style={{ borderBottom: "1px solid var(--border)", background: "rgba(21,22,24,0.4)" }}
      >
        <h1 className="text-[15px] font-semibold" style={{ color: "var(--text)" }}>
          Calendario
        </h1>

        <div className="flex items-center gap-1 ml-1">
          <NavBtn onClick={() => setWeekRef(addDays(weekStart, -7))}>‹</NavBtn>
          <button
            onClick={() => setWeekRef(new Date())}
            className="btn-linear text-[12px] px-2.5 py-1 rounded-md"
          >
            Hoy
          </button>
          <NavBtn onClick={() => setWeekRef(addDays(weekStart, 7))}>›</NavBtn>
        </div>
        <span className="text-[13px]" style={{ color: "var(--text-dim)" }}>{weekLabel}</span>

        <div className="flex-1" />

        {/* Modo Urgencia (T1-18) — abre modal de confirmación */}
        <button
          onClick={() => urgentMode ? setUrgentMode(false) : setUrgentConfirm(true)}
          className="text-[12px] px-2.5 py-1.5 rounded-md font-medium transition"
          style={{
            background: urgentMode ? "rgba(235,87,87,0.16)" : "transparent",
            border: `1px solid ${urgentMode ? "rgba(235,87,87,0.5)" : "var(--border-strong)"}`,
            color: urgentMode ? "#ff8585" : "var(--text-dim)",
          }}
        >
          🚨 {urgentMode ? "Urgencia ON" : "Modo Urgencia"}
        </button>

        {/* Congelación de Emergencia (T2-6) */}
        <button
          onClick={() => setEmergency(true)}
          className="text-[12px] px-2.5 py-1.5 rounded-md font-medium btn-linear"
        >
          ❄️ Congelar agenda
        </button>

        {/* Google Calendar */}
        {google.connected ? (
          <div className="flex items-center gap-1.5">
            <span
              className="text-[11px] hidden lg:inline font-medium"
              style={{ color: google.tokenLoaded ? "#4ade80" : "#f59e0b" }}
            >
              {google.tokenLoaded ? "🟢" : "🟡"} {google.email}
            </span>
            {google.tokenLoaded ? (
              <>
                <span className="text-[11px] hidden xl:inline" style={{ color: "var(--text-dimmer)" }}>
                  {google.lastSync ? `· sync ${fmtClock(google.lastSync)}` : ""}
                </span>
                <button onClick={handleSync} disabled={syncing} className="btn-linear text-[12px] px-2.5 py-1.5 rounded-md">
                  {syncing ? "Sincronizando…" : "↻ Sync"}
                </button>
              </>
            ) : (
              <button
                onClick={() => (hasClientId() ? handleConnect() : setGoogleConnectModal(true))}
                disabled={syncing}
                className="text-[12px] px-2.5 py-1.5 rounded-md font-medium"
                style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.4)", color: "#fbbf24" }}
              >
                {syncing ? "Reconectando…" : "↻ Reconectar"}
              </button>
            )}
            <button
              onClick={handleDisconnect}
              className="text-[12px] px-2 py-1.5 rounded-md"
              style={{ color: "var(--text-dimmer)" }}
            >
              Desconectar
            </button>
          </div>
        ) : (
          <button
            onClick={() => (hasClientId() ? handleConnect() : setGoogleConnectModal(true))}
            disabled={syncing}
            className="text-[12px] px-3 py-1.5 rounded-md font-medium text-white"
            style={{ background: "#16a34a" }}
          >
            {syncing ? "Conectando…" : "Conectar Google Calendar"}
          </button>
        )}

        <GuideButton page="calendario" />
      </div>

      {/* Banner urgencia — explicación completa */}
      {urgentMode && (
        <div
          className="px-4 md:px-6 py-2 text-[12px] shrink-0 flex items-start gap-2.5"
          style={{ background: "rgba(235,87,87,0.1)", color: "#ff9b9b", borderBottom: "1px solid rgba(235,87,87,0.2)" }}
        >
          <span className="text-[14px] mt-px shrink-0">🚨</span>
          <div className="flex-1">
            <strong style={{ color: "#ffcece" }}>Modo Urgencia activo</strong>
            <span style={{ color: "#ffb3b3" }}>
              {" "}— Las nuevas reuniones saltan el Peaje de Preparación y se marcan como prioritarias (🔴).
              El equipo núcleo puede convocarte fuera de tu horario habitual.
              Los bloques de enfoque no actúan como barrera.
            </span>
            <span style={{ color: "rgba(255,180,180,0.6)" }}>
              {" "}Reservado para emergencias reales: bugs críticos en producción, decisiones que no pueden esperar.
            </span>
          </div>
          <button
            onClick={() => setUrgentMode(false)}
            className="shrink-0 text-[11px] px-2 py-0.5 rounded"
            style={{ color: "var(--text-dimmer)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            Desactivar
          </button>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        {/* ════════ RAIL IZQUIERDO ════════ */}
        <aside
          className="hidden md:flex flex-col w-[248px] shrink-0 overflow-y-auto"
          style={{ borderRight: "1px solid var(--border)", background: "var(--surface-2)", WebkitBackdropFilter: "blur(16px)", backdropFilter: "blur(16px)" }}
        >
          {/* Espejo de Prioridades (T2-7) — sin datos inventados */}
          <RailSection title="Espejo de Prioridades">
            {priorities.length === 0 && !showPriorityForm ? (
              <div className="text-center py-1">
                <p className="text-[12px] mb-2.5" style={{ color: "var(--text-dimmer)" }}>
                  No hay prioridades esta semana
                </p>
                <button
                  onClick={() => setShowPriorityForm(true)}
                  className="text-[12px] px-3 py-1.5 rounded-md w-full"
                  style={{
                    background: "transparent",
                    border: "1px dashed var(--border-strong)",
                    color: "var(--text-dim)",
                  }}
                >
                  + Añadir prioridad
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {priorities.map((p) => {
                  const used = weekHours[p.kind]
                  const pct = Math.min(100, (used / p.budgetH) * 100)
                  const over = used > p.budgetH
                  return (
                    <div
                      key={p.id}
                      className="rounded-lg p-2.5"
                      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[12px] truncate flex-1 pr-1" style={{ color: "var(--text)" }}>
                          {p.label}
                        </span>
                        <button
                          onClick={() => setPriorities((ps) => ps.filter((x) => x.id !== p.id))}
                          className="shrink-0 text-[10px] px-1"
                          style={{ color: "var(--text-dimmer)" }}
                          title="Eliminar prioridad"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden mb-1" style={{ background: "var(--surface-3)" }}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, background: over ? "#eb5757" : "var(--accent)" }}
                        />
                      </div>
                      <p className="text-[10px]" style={{ color: over ? "#ff8585" : "var(--text-dimmer)" }}>
                        {used.toFixed(1)}h / {p.budgetH}h
                        {" · "}
                        {p.kind === "meeting" ? "reuniones" : p.kind === "focus" ? "enfoque" : "tareas"}
                        {over && " ⚠ excedido"}
                      </p>
                    </div>
                  )
                })}
                {!showPriorityForm && (
                  <button
                    onClick={() => setShowPriorityForm(true)}
                    className="text-[12px] px-2 py-1.5 rounded-md text-center"
                    style={{
                      background: "transparent",
                      border: "1px dashed var(--border-strong)",
                      color: "var(--text-dimmer)",
                    }}
                  >
                    + Añadir prioridad
                  </button>
                )}
              </div>
            )}
            {showPriorityForm && (
              <PriorityForm
                onSave={(label, budgetH, kind) => {
                  setPriorities((ps) => [
                    ...ps,
                    { id: `${Date.now()}`, label, budgetH, kind: kind as Priority["kind"] },
                  ])
                  setShowPriorityForm(false)
                }}
                onCancel={() => setShowPriorityForm(false)}
              />
            )}
          </RailSection>

          {/* Equipo — solo miembros de Workflow (T2-3) + IA Asistencia (T1-15) */}
          <RailSection title="Equipo · arrastra para fusionar">
            <div className="flex flex-col gap-1">
              {members.map((m) => {
                const sc = attendanceScore(m.id)
                const active = fusion.has(m.id)
                return (
                  <div
                    key={m.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData(DT_MEMBER, m.id)}
                    onClick={() =>
                      setFusion((s) => {
                        const n = new Set(s)
                        if (n.has(m.id)) n.delete(m.id)
                        else n.add(m.id)
                        return n
                      })
                    }
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-grab active:cursor-grabbing transition"
                    style={{
                      background: active ? "rgba(94,106,210,0.14)" : "transparent",
                      border: `1px solid ${active ? "rgba(94,106,210,0.4)" : "transparent"}`,
                    }}
                    title={`Puntualidad ${sc.punctual}% · Asistencia ${sc.attendance}%`}
                  >
                    <MiniAvatar name={m.nombre} src={m.avatar} />
                    <span className="text-[12px] truncate flex-1" style={{ color: "var(--text)" }}>
                      {m.nombre}
                    </span>
                    <span
                      className="text-[10px] px-1 rounded"
                      style={{ color: sc.attendance >= 90 ? "#22c55e" : "#f59e0b" }}
                    >
                      {sc.attendance}%
                    </span>
                  </div>
                )
              })}
              {members.length === 0 && (
                <p className="text-[11px] px-1" style={{ color: "var(--text-dimmer)", lineHeight: 1.5 }}>
                  Sin miembros en el equipo.{" "}
                  <button
                    onClick={() => navigate("/workflow")}
                    className="underline"
                    style={{ color: "var(--accent)" }}
                  >
                    Añádelos en Workflow
                  </button>
                  .
                </p>
              )}
            </div>
          </RailSection>

          {/* Tareas Kanban (T1-9) */}
          <RailSection title="Tareas Kanban · arrastra al calendario">
            <div className="flex flex-col gap-1.5">
              {tasks.map((t) => (
                <div
                  key={t.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData(DT_TASK, JSON.stringify(t))}
                  className="px-2.5 py-2 rounded-md cursor-grab active:cursor-grabbing"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                >
                  <p className="text-[12px] truncate" style={{ color: "var(--text)" }}>{t.title}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: "var(--text-dim)" }}>{t.priority} · {t.status}</p>
                </div>
              ))}
              {tasks.length === 0 && (
                <p className="text-[11px] px-2" style={{ color: "var(--text-dimmer)" }}>Sin tareas pendientes</p>
              )}
            </div>
          </RailSection>

          {/* Zona horaria (T1-14) — toggle ON/OFF + Enfoque + Obsidian (T1-10) */}
          <RailSection title="Contexto">
            {/* Toggle zona horaria */}
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px]" style={{ color: "var(--text-dim)" }}>
                Zona horaria de la otra persona
              </label>
              <button
                onClick={() => setShowTzPreview((v) => !v)}
                className="text-[10px] px-2 py-0.5 rounded-md font-medium transition"
                style={{
                  background: showTzPreview ? "rgba(94,106,210,0.15)" : "var(--surface)",
                  border: `1px solid ${showTzPreview ? "rgba(94,106,210,0.5)" : "var(--border)"}`,
                  color: showTzPreview ? "var(--accent)" : "var(--text-dimmer)",
                }}
              >
                {showTzPreview ? "ON" : "OFF"}
              </button>
            </div>
            {showTzPreview && (
              <select
                value={previewTz}
                onChange={(e) => setPreviewTz(e.target.value)}
                className="field-input w-full px-2 py-1.5 rounded-md text-[12px] mb-3"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz.id} value={tz.id}>{tz.label}</option>
                ))}
              </select>
            )}

            <label className="flex items-center gap-2 text-[12px] mb-2" style={{ color: "var(--text-dim)" }}>
              <input type="checkbox" checked={showFocus} onChange={(e) => setShowFocus(e.target.checked)} />
              Zonas de Enfoque Óptima
            </label>

            <button
              onClick={() => navigate("/workflow")}
              className="text-[11px] w-full text-left px-2 py-1.5 rounded-md"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-dim)" }}
            >
              🕸️ {completedNodes} nodo{completedNodes !== 1 ? "s" : ""} histórico{completedNodes !== 1 ? "s" : ""} → Gestión
            </button>
          </RailSection>
        </aside>

        {/* ════════ REJILLA SEMANAL ════════ */}
        <WeekGrid
          days={days}
          events={allVisible}
          fusionMembers={fusion}
          memberEventsById={memberEventsById}
          members={members}
          showFocus={showFocus}
          onCreate={openCreate}
          onMove={moveEvent}
          onDropTask={dropTask}
          onAddFusion={(id) => setFusion((s) => new Set(s).add(id))}
          onOpen={setDetail}
          currentUserId={user.id}
        />
      </div>

      {/* ════════ MODALES ════════ */}
      {detail && (
        <EventDetail
          ev={detail}
          members={members}
          previewTz={previewTz}
          showTzPreview={showTzPreview}
          onClose={() => setDetail(null)}
          onDelete={async () => {
            if (detail.source === "google" && detail.google_id) {
              // Evento que vive en Google Calendar — eliminar allí
              await deleteGoogleEvent(detail.google_id)
              setGoogleEvents((prev) => prev.filter((e) => e.id !== detail.id))
              setDetail(null)
              toast("Evento eliminado de Google Calendar", "success")
              return
            }
            // Evento NES normal
            await remove(detail.id)
            if (detail.google_id) await deleteGoogleEvent(detail.google_id)
            setDetail(null)
            toast("Evento eliminado")
          }}
          onAccept={async () => {
            await update(detail.id, { status: "confirmed", expires_at: null })
            setDetail(null)
            toast("Propuesta aceptada", "success")
          }}
          onPropose={() => proposeAlternatives(detail)}
        />
      )}

      {draft && (
        <CreateModal
          draft={draft}
          members={members}
          urgentMode={urgentMode}
          onCancel={() => setDraft(null)}
          onSave={commitCreate}
        />
      )}

      {prep && (
        <PrepModal
          onCancel={() => setPrep(null)}
          onAsync={() => {
            setPrep(null)
            toast("Mejor resuélvelo por chat asíncrono", "info")
            navigate("/chats")
          }}
          onConfirm={async (answers) => {
            const ev = { ...prep, prep_answers: answers }
            setPrep(null)
            await commitCreate(ev)
          }}
        />
      )}

      {emergency && <EmergencyModal onCancel={() => setEmergency(false)} onFreeze={freezeAgenda} />}

      {urgentConfirm && (
        <UrgentConfirmModal
          onCancel={() => setUrgentConfirm(false)}
          onConfirm={() => {
            setUrgentConfirm(false)
            setUrgentMode(true)
            toast("Modo Urgencia activado", "warn")
          }}
        />
      )}

      {googleConnectModal && (
        <GoogleConnectModal
          onCancel={() => setGoogleConnectModal(false)}
          onConnect={handleConnect}
        />
      )}

      {/* Toasts */}
      <div className="fixed bottom-5 right-5 z-[130] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="px-3.5 py-2.5 rounded-lg text-[13px] animate-in"
            style={{
              background: "rgba(21,22,24,0.82)",
              WebkitBackdropFilter: "blur(16px)",
              backdropFilter: "blur(16px)",
              border: `1px solid ${t.type === "warn" ? "rgba(235,87,87,0.4)" : t.type === "success" ? "rgba(34,197,94,0.4)" : "var(--glass-border)"}`,
              color: "var(--text)",
              boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
            }}
          >
            {t.text}
          </div>
        ))}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// REJILLA SEMANAL
// ──────────────────────────────────────────────────────────────────────────────
function WeekGrid({
  days,
  events,
  fusionMembers,
  memberEventsById,
  members,
  showFocus,
  onCreate,
  onMove,
  onDropTask,
  onAddFusion,
  onOpen,
  currentUserId,
}: {
  days: Date[]
  events: CalEvent[]
  fusionMembers: Set<string>
  memberEventsById: (id: string) => CalEvent[]
  members: Member[]
  showFocus: boolean
  onCreate: (day: Date, startMin: number) => void
  onMove: (id: string, day: Date, startMin: number) => void
  onDropTask: (task: KTask, day: Date, startMin: number) => void
  onAddFusion: (id: string) => void
  onOpen: (e: CalEvent) => void
  currentUserId: string
}) {
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)
  const now = new Date()

  const handleDrop = (e: React.DragEvent, day: Date) => {
    e.preventDefault()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const y = e.clientY - rect.top
    const startMin = yToMinutes(y)

    const evId = e.dataTransfer.getData(DT_EVENT)
    const taskRaw = e.dataTransfer.getData(DT_TASK)
    const memberId = e.dataTransfer.getData(DT_MEMBER)
    if (evId) onMove(evId, day, startMin)
    else if (taskRaw) onDropTask(JSON.parse(taskRaw) as KTask, day, startMin)
    else if (memberId) onAddFusion(memberId)
  }

  return (
    <div className="flex-1 overflow-auto">
      {/* Cabecera de días */}
      <div
        className="grid sticky top-0 z-20"
        style={{
          gridTemplateColumns: `56px repeat(7, minmax(110px, 1fr))`,
          background: "var(--bg)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div />
        {days.map((d, i) => {
          const today = sameDay(d, now)
          return (
            <div key={i} className="py-2 text-center" style={{ borderLeft: "1px solid var(--border)" }}>
              <p className="text-[11px]" style={{ color: "var(--text-dim)" }}>{DAY_LABELS[i]}</p>
              <p
                className="text-[15px] font-semibold inline-flex items-center justify-center w-7 h-7 rounded-full mt-0.5"
                style={{
                  color: today ? "#fff" : "var(--text)",
                  background: today ? "var(--accent)" : "transparent",
                }}
              >
                {d.getDate()}
              </p>
            </div>
          )
        })}
      </div>

      {/* Cuerpo */}
      <div
        className="grid relative"
        style={{ gridTemplateColumns: `56px repeat(7, minmax(110px, 1fr))`, height: GRID_HEIGHT }}
      >
        {/* Gutter de horas */}
        <div className="relative">
          {hours.map((h) => (
            <div
              key={h}
              className="absolute right-1.5 text-[10px] -translate-y-1/2"
              style={{ top: minutesToY(h * 60), color: "var(--text-dimmer)" }}
            >
              {fmtHour(h)}
            </div>
          ))}
        </div>

        {/* Columnas de día */}
        {days.map((day, di) => {
          const dayEvents = events.filter((e) => sameDay(new Date(e.start_at), day))
          const positioned = layoutDay(dayEvents)

          // Zonas de Enfoque (T2-5)
          const myDay = dayEvents.filter((e) => e.owner_id === currentUserId || e.attendees?.includes(currentUserId))
          const focusGaps = showFocus
            ? freeGaps(myDay).filter((g) => g.endMin - g.startMin >= FOCUS_MIN)
            : []

          // Fusión: huecos comunes (T2-3)
          const fusionSets = [...fusionMembers].map((id) =>
            memberEventsById(id).filter((e) => sameDay(new Date(e.start_at), day))
          )
          const commonGaps =
            fusionMembers.size > 0 ? commonFreeGaps([myDay, ...fusionSets]) : []
          // Capas translúcidas de cada miembro fusionado
          const fusionLayers = [...fusionMembers].flatMap((id) =>
            memberEventsById(id)
              .filter((e) => sameDay(new Date(e.start_at), day))
              .map((e) => ({ id, e }))
          )

          return (
            <div
              key={di}
              className="relative"
              style={{ borderLeft: "1px solid var(--border)" }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, day)}
              onClick={(e) => {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                onCreate(day, yToMinutes(e.clientY - rect.top))
              }}
            >
              {/* Líneas de hora */}
              {hours.map((h) => (
                <div
                  key={h}
                  className="absolute left-0 right-0"
                  style={{ top: minutesToY(h * 60), borderTop: "1px solid var(--border)" }}
                />
              ))}

              {/* Zonas de Enfoque */}
              {focusGaps.map((g, i) => (
                <div
                  key={`f${i}`}
                  className="absolute left-1 right-1 rounded-md pointer-events-none flex items-start p-1.5"
                  style={{
                    top: minutesToY(g.startMin),
                    height: ((g.endMin - g.startMin) / 60) * HOUR_H,
                    background: "linear-gradient(180deg, rgba(56,189,248,0.12), rgba(56,189,248,0.05))",
                    border: "1px dashed rgba(56,189,248,0.35)",
                  }}
                >
                  <span className="text-[10px] font-medium" style={{ color: "#7dd3fc" }}>
                    Zona de Enfoque Óptima
                  </span>
                </div>
              ))}

              {/* Huecos comunes (fusión) */}
              {commonGaps.map((g, i) => (
                <div
                  key={`c${i}`}
                  className="absolute rounded-md pointer-events-none"
                  style={{
                    top: minutesToY(g.startMin),
                    height: ((g.endMin - g.startMin) / 60) * HOUR_H,
                    right: 2,
                    width: 6,
                    background: "rgba(34,197,94,0.5)",
                  }}
                  title={`Hueco común ${fmtRangeMin(g.startMin)}–${fmtRangeMin(g.endMin)}`}
                />
              ))}

              {/* Capas translúcidas de miembros fusionados */}
              {fusionLayers.map(({ id, e }, i) => (
                <div
                  key={`l${i}`}
                  className="absolute rounded-md pointer-events-none"
                  style={{
                    top: minutesToY(minutesOfDay(e.start_at)),
                    height: Math.max(14, (durationMin(e) / 60) * HOUR_H),
                    left: 2,
                    right: 10,
                    background: `${memberColor(members, id)}22`,
                    border: `1px solid ${memberColor(members, id)}55`,
                  }}
                />
              ))}

              {/* Indicador "ahora" */}
              {sameDay(day, now) && (
                <div
                  className="absolute left-0 right-0 z-10 pointer-events-none"
                  style={{ top: minutesToY(now.getHours() * 60 + now.getMinutes()) }}
                >
                  <div className="h-[2px]" style={{ background: "#eb5757" }} />
                  <div className="w-2 h-2 rounded-full -mt-[5px] -ml-[3px]" style={{ background: "#eb5757" }} />
                </div>
              )}

              {/* Eventos */}
              {positioned.map(({ ev, lane, lanes }) => (
                <EventBlock
                  key={ev.id}
                  ev={ev}
                  lane={lane}
                  lanes={lanes}
                  onOpen={onOpen}
                />
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// BLOQUE DE EVENTO
// ──────────────────────────────────────────────────────────────────────────────
function EventBlock({
  ev,
  lane,
  lanes,
  onOpen,
}: {
  ev: CalEvent
  lane: number
  lanes: number
  onOpen: (e: CalEvent) => void
}) {
  const startMin = minutesOfDay(ev.start_at)
  const top = minutesToY(startMin)
  const height = Math.max(18, (durationMin(ev) / 60) * HOUR_H - 2)
  const color = ev.color || KIND_COLOR[ev.kind]
  const proposed = ev.status === "proposed"
  const isGoogle = ev.source === "google"
  const widthPct = 100 / lanes
  const expiresIn = ev.expires_at
    ? Math.max(0, Math.round((new Date(ev.expires_at).getTime() - Date.now()) / 3600_000))
    : null

  return (
    <button
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DT_EVENT, ev.id)
        e.stopPropagation()
      }}
      onClick={(e) => {
        e.stopPropagation()
        onOpen(ev)
      }}
      className="absolute rounded-md px-1.5 py-1 text-left overflow-hidden cursor-grab active:cursor-grabbing"
      style={{
        top,
        height,
        left: `calc(${lane * widthPct}% + 3px)`,
        width: `calc(${widthPct}% - 6px)`,
        background: proposed ? `${color}1f` : `${color}28`,
        border: `1px solid ${ev.urgent ? "#eb5757" : color}${proposed ? "" : "88"}`,
        borderStyle: proposed ? "dashed" : "solid",
        borderLeft: `3px solid ${ev.urgent ? "#eb5757" : color}`,
      }}
    >
      <p className="text-[11px] font-semibold leading-tight truncate" style={{ color: "var(--text)" }}>
        {ev.urgent && "🔴 "}
        {isGoogle && "🟢 "}
        {ev.title || "Evento"}
      </p>
      {height > 30 && (
        <p className="text-[10px] leading-tight truncate" style={{ color: "var(--text-dim)" }}>
          {fmtClock(ev.start_at)}–{fmtClock(ev.end_at)}
        </p>
      )}
      {proposed && expiresIn !== null && height > 42 && (
        <span className="text-[9px]" style={{ color: "#c4b5fd" }}>⏳ caduca en {expiresIn}h</span>
      )}
    </button>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// DETALLE DE EVENTO
// ──────────────────────────────────────────────────────────────────────────────
function EventDetail({
  ev,
  members,
  previewTz,
  showTzPreview,
  onClose,
  onDelete,
  onAccept,
  onPropose,
}: {
  ev: CalEvent
  members: Member[]
  previewTz: string
  showTzPreview: boolean
  onClose: () => void
  onDelete: () => void
  onAccept: () => void
  onPropose: () => void
}) {
  const local = `${fmtClock(ev.start_at)}–${fmtClock(ev.end_at)}`
  const there = timeInTz(ev.start_at, previewTz)
  const tzLabel = TIMEZONES.find((t) => t.id === previewTz)?.label ?? previewTz
  const attendees = members.filter((m) => ev.attendees?.includes(m.id))

  return (
    <Backdrop onClose={onClose}>
      <div className="flex items-start gap-2 mb-3">
        <div className="w-3 h-3 rounded-full mt-1 shrink-0" style={{ background: ev.color || KIND_COLOR[ev.kind] }} />
        <div className="flex-1 min-w-0">
          <h3 className="text-[16px] font-semibold" style={{ color: "var(--text)" }}>
            {ev.urgent && "🔴 "}
            {ev.title}
          </h3>
          <p className="text-[12px] capitalize" style={{ color: "var(--text-dim)" }}>
            {ev.kind} · {ev.status}
            {ev.source === "google" && " · Google"}
          </p>
        </div>
      </div>

      {ev.description && (
        <p className="text-[13px] mb-3" style={{ color: "var(--text-dim)" }}>{ev.description}</p>
      )}

      {/* Previsualización de zona horaria (T1-14) — solo si está activa */}
      {showTzPreview && (
        <div className="rounded-lg p-3 mb-3 flex items-center justify-between" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div>
            <p className="text-[11px]" style={{ color: "var(--text-dimmer)" }}>Tu hora</p>
            <p className="text-[14px]" style={{ color: "var(--text)" }}>☀️ {local}</p>
          </div>
          <span style={{ color: "var(--text-dimmer)" }}>→</span>
          <div className="text-right">
            <p className="text-[11px]" style={{ color: "var(--text-dimmer)" }}>{tzLabel}</p>
            <p className="text-[14px]" style={{ color: "var(--text)" }}>{there.isDay ? "☀️" : "🌙"} {there.time}</p>
          </div>
        </div>
      )}

      {/* Asistentes + IA de asistencia (T1-15) */}
      {attendees.length > 0 && (
        <div className="mb-3">
          <p className="text-[11px] mb-1.5" style={{ color: "var(--text-dimmer)" }}>Asistentes</p>
          <div className="flex flex-col gap-1">
            {attendees.map((a) => {
              const sc = attendanceScore(a.id)
              return (
                <div key={a.id} className="flex items-center gap-2">
                  <MiniAvatar name={a.nombre} src={a.avatar} />
                  <span className="text-[12px] flex-1" style={{ color: "var(--text)" }}>{a.nombre}</span>
                  <span className="text-[10px]" style={{ color: sc.attendance >= 90 ? "#22c55e" : "#f59e0b" }}>
                    🎯 {sc.punctual}% punt · {sc.attendance}% asist
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 mt-4">
        {ev.status === "proposed" && (
          <button onClick={onAccept} className="flex-1 py-2 rounded-md text-[13px] font-medium text-white" style={{ background: "#22c55e" }}>
            Aceptar
          </button>
        )}
        <button onClick={onPropose} className="flex-1 btn-linear py-2 rounded-md text-[13px] font-medium">
          ↪ 3 alternativas
        </button>
        <button onClick={onDelete} className="py-2 px-3 rounded-md text-[13px]" style={{ color: "#eb5757", border: "1px solid rgba(235,87,87,0.3)" }}>
          Eliminar
        </button>
      </div>
    </Backdrop>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// CREAR EVENTO
// ──────────────────────────────────────────────────────────────────────────────
function CreateModal({
  draft,
  members,
  urgentMode,
  onCancel,
  onSave,
}: {
  draft: NewEvent
  members: Member[]
  urgentMode: boolean
  onCancel: () => void
  onSave: (ev: NewEvent) => void
}) {
  const [title, setTitle] = useState(draft.title)
  const [kind, setKind] = useState<CalEvent["kind"]>(draft.kind ?? "event")
  const [attendees, setAttendees] = useState<string[]>(draft.attendees ?? [])
  const [startTime, setStartTime] = useState(toLocalInput(draft.start_at))
  const [endTime, setEndTime] = useState(toLocalInput(draft.end_at))

  const toggle = (id: string) =>
    setAttendees((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]))

  const save = () => {
    onSave({
      ...draft,
      title: title.trim() || "Evento",
      kind,
      attendees,
      color: KIND_COLOR[kind],
      start_at: new Date(startTime).toISOString(),
      end_at: new Date(endTime).toISOString(),
      urgent: urgentMode || draft.urgent,
    })
  }

  return (
    <Backdrop onClose={onCancel}>
      <h3 className="text-[15px] font-semibold mb-3" style={{ color: "var(--text)" }}>Nuevo bloque</h3>
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Título…"
        className="field-input w-full px-3 py-2 rounded-md text-[14px] mb-3"
      />

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <label className="text-[11px] block mb-1" style={{ color: "var(--text-dim)" }}>Inicio</label>
          <input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="field-input w-full px-2 py-1.5 rounded-md text-[12px]" />
        </div>
        <div>
          <label className="text-[11px] block mb-1" style={{ color: "var(--text-dim)" }}>Fin</label>
          <input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="field-input w-full px-2 py-1.5 rounded-md text-[12px]" />
        </div>
      </div>

      <label className="text-[11px] block mb-1" style={{ color: "var(--text-dim)" }}>Tipo</label>
      <div className="flex gap-1.5 mb-3">
        {(["event", "meeting", "focus", "task"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className="flex-1 py-1.5 rounded-md text-[12px] capitalize"
            style={{
              background: kind === k ? `${KIND_COLOR[k]}28` : "var(--surface)",
              border: `1px solid ${kind === k ? KIND_COLOR[k] : "var(--border)"}`,
              color: "var(--text)",
            }}
          >
            {k === "event" ? "Evento" : k === "meeting" ? "Reunión" : k === "focus" ? "Enfoque" : "Tarea"}
          </button>
        ))}
      </div>

      {kind === "meeting" && (
        <>
          <label className="text-[11px] block mb-1" style={{ color: "var(--text-dim)" }}>
            Asistentes {!urgentMode && "(requiere Peaje de Preparación)"}
          </label>
          <div className="flex flex-wrap gap-1.5 mb-3 max-h-24 overflow-y-auto">
            {members.map((m) => (
              <button
                key={m.id}
                onClick={() => toggle(m.id)}
                className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[12px]"
                style={{
                  background: attendees.includes(m.id) ? "rgba(94,106,210,0.2)" : "var(--surface)",
                  border: `1px solid ${attendees.includes(m.id) ? "var(--accent)" : "var(--border)"}`,
                  color: "var(--text)",
                }}
              >
                <MiniAvatar name={m.nombre} src={m.avatar} />
                {m.nombre}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="flex gap-2 mt-2">
        <button onClick={onCancel} className="flex-1 py-2 rounded-md text-[13px]" style={{ color: "var(--text-dim)", border: "1px solid var(--border-strong)" }}>
          Cancelar
        </button>
        <button onClick={save} className="flex-1 py-2 rounded-md text-[13px] font-medium text-white" style={{ background: "var(--accent)" }}>
          Crear
        </button>
      </div>
    </Backdrop>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// PEAJE DE PREPARACIÓN (T1-7)
// ──────────────────────────────────────────────────────────────────────────────
function PrepModal({
  onCancel,
  onAsync,
  onConfirm,
}: {
  onCancel: () => void
  onAsync: () => void
  onConfirm: (answers: Record<string, string>) => void
}) {
  const [a1, setA1] = useState("")
  const [a2, setA2] = useState("")
  const [a3, setA3] = useState("")

  const tooSimple = a1.trim().length < 15 || a3.trim().length < 10
  const filled = a1.trim() && a2.trim() && a3.trim()

  return (
    <Backdrop onClose={onCancel}>
      <h3 className="text-[15px] font-semibold mb-1" style={{ color: "var(--text)" }}>Peaje de Preparación</h3>
      <p className="text-[12px] mb-4" style={{ color: "var(--text-dim)" }}>
        Responde 3 preguntas antes de reservar tiempo del equipo.
      </p>

      <Field label="1 · ¿Cuál es el objetivo concreto de la reunión?">
        <textarea value={a1} onChange={(e) => setA1(e.target.value)} rows={2} className="field-input w-full px-3 py-2 rounded-md text-[13px] resize-none" />
      </Field>
      <Field label="2 · ¿Qué decisión necesitas tomar?">
        <input value={a2} onChange={(e) => setA2(e.target.value)} className="field-input w-full px-3 py-2 rounded-md text-[13px]" />
      </Field>
      <Field label="3 · ¿Por qué no puede resolverse por chat asíncrono?">
        <textarea value={a3} onChange={(e) => setA3(e.target.value)} rows={2} className="field-input w-full px-3 py-2 rounded-md text-[13px] resize-none" />
      </Field>

      {filled && tooSimple && (
        <div className="rounded-md p-2.5 mb-3 text-[12px]" style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", color: "#fbbf24" }}>
          Este motivo parece resoluble de forma asíncrona. Considera el chat en lugar de una llamada.
        </div>
      )}

      <div className="flex gap-2 mt-1">
        <button onClick={onAsync} className="flex-1 btn-linear py-2 rounded-md text-[13px]">
          Reunión asíncrona (chat)
        </button>
        <button
          onClick={() => onConfirm({ a1, a2, a3 })}
          disabled={!filled || tooSimple}
          className="flex-1 py-2 rounded-md text-[13px] font-medium text-white disabled:opacity-40"
          style={{ background: "var(--accent)" }}
        >
          Reservar tiempo
        </button>
      </div>
    </Backdrop>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// CONGELACIÓN DE EMERGENCIA (T2-6)
// ──────────────────────────────────────────────────────────────────────────────
function EmergencyModal({ onCancel, onFreeze }: { onCancel: () => void; onFreeze: (h: number) => void }) {
  return (
    <Backdrop onClose={onCancel}>
      <h3 className="text-[15px] font-semibold mb-1" style={{ color: "var(--text)" }}>❄️ Congelar agenda</h3>
      <p className="text-[13px] mb-3" style={{ color: "var(--text-dim)" }}>
        Cancela y libera todas tus citas próximas de un solo golpe.
        Ideal para cuando surge una emergencia y necesitas tiempo libre de compromisos inmediatamente.
      </p>
      <ul className="text-[12px] flex flex-col gap-1.5 mb-4" style={{ color: "var(--text-dim)" }}>
        <li>❄️ Todas las citas en el rango quedan canceladas</li>
        <li>📨 Los asistentes reciben un aviso automático</li>
        <li>↩️ Puedes volver a crear las citas manualmente después</li>
      </ul>
      <div className="flex gap-2">
        <button onClick={() => onFreeze(24)} className="flex-1 py-2.5 rounded-md text-[13px] font-medium text-white" style={{ background: "#eb5757" }}>
          Congelar próximas 24 h
        </button>
        <button onClick={() => onFreeze(48)} className="flex-1 py-2.5 rounded-md text-[13px] font-medium text-white" style={{ background: "#c0392b" }}>
          Congelar próximas 48 h
        </button>
      </div>
      <button onClick={onCancel} className="w-full mt-2 py-2 rounded-md text-[13px]" style={{ color: "var(--text-dim)" }}>
        Cancelar
      </button>
    </Backdrop>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// MODO URGENCIA — confirmación + explicación (T1-18)
// ──────────────────────────────────────────────────────────────────────────────
function UrgentConfirmModal({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  return (
    <Backdrop onClose={onCancel}>
      <h3 className="text-[15px] font-semibold mb-1" style={{ color: "#ff8585" }}>🚨 Activar Modo Urgencia</h3>
      <p className="text-[13px] mb-3" style={{ color: "var(--text-dim)" }}>
        Este modo está pensado para situaciones excepcionales donde necesitas actuar de forma inmediata, saltándote las barreras habituales del calendario.
      </p>
      <p className="text-[11px] uppercase tracking-wide mb-2" style={{ color: "var(--text-dimmer)" }}>Al activarlo:</p>
      <ul className="flex flex-col gap-2 mb-4">
        {[
          ["Se omite el Peaje de Preparación", "No necesitas justificar el motivo de la reunión."],
          ["Eventos marcados como prioritarios 🔴", "Se muestran con borde rojo en el calendario."],
          ["Sin barreras de horario", "Los bloques de enfoque no actúan como freno."],
          ["Convocatoria fuera de horario habitual", "El equipo núcleo puede llamarte aunque estés en modo silencio."],
        ].map(([title, desc]) => (
          <li key={title} className="flex gap-2.5">
            <span className="text-[12px] mt-0.5" style={{ color: "rgba(235,87,87,0.7)" }}>✦</span>
            <div>
              <p className="text-[12px] font-medium" style={{ color: "var(--text)" }}>{title}</p>
              <p className="text-[11px]" style={{ color: "var(--text-dimmer)" }}>{desc}</p>
            </div>
          </li>
        ))}
      </ul>
      <div
        className="rounded-md p-2.5 mb-4 text-[12px]"
        style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", color: "#fbbf24" }}
      >
        ⚠ Úsalo solo en emergencias reales: bugs críticos en producción, inversores esperando una decisión, situaciones que no pueden esperar a mañana.
      </div>
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-2 rounded-md text-[13px]" style={{ color: "var(--text-dim)", border: "1px solid var(--border-strong)" }}>
          Cancelar
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 py-2 rounded-md text-[13px] font-medium text-white"
          style={{ background: "rgba(235,87,87,0.85)" }}
        >
          Activar Modo Urgencia
        </button>
      </div>
    </Backdrop>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// GOOGLE CALENDAR — modal de conexión (pega tu Client ID aquí)
// ──────────────────────────────────────────────────────────────────────────────
function GoogleConnectModal({
  onCancel,
  onConnect,
}: {
  onCancel: () => void
  onConnect: () => void
}) {
  const [clientId, setClientId] = useState(
    () => localStorage.getItem("nes:gcal-client-id") ?? ""
  )
  const [showSteps, setShowSteps] = useState(false)
  const alreadyReady = hasClientId()
  const canConnect = alreadyReady || clientId.trim().length > 10

  const handleConnect = () => {
    if (clientId.trim()) saveClientId(clientId.trim())
    onConnect()
  }

  return (
    <Backdrop onClose={onCancel}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "#4ade80" }}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        <h3 className="text-[15px] font-semibold" style={{ color: "var(--text)" }}>Conectar Google Calendar</h3>
      </div>
      <p className="text-[12px] mb-4" style={{ color: "var(--text-dim)" }}>
        Sincroniza tus eventos reales. Los cambios aquí se reflejan en Google y viceversa.
      </p>

      {alreadyReady ? (
        /* Client ID ya guardado — mostrar directamente el botón */
        <div
          className="rounded-lg p-3 mb-4 flex items-center gap-2 text-[12px]"
          style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", color: "#4ade80" }}
        >
          ✓ Client ID configurado — listo para conectar
        </div>
      ) : (
        <>
          {/* Campo de pegado */}
          <label className="text-[11px] block mb-1.5 font-medium" style={{ color: "var(--text-dim)" }}>
            Pega tu Google OAuth Client ID:
          </label>
          <input
            autoFocus
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="123456789-abc.apps.googleusercontent.com"
            className="field-input w-full px-3 py-2 rounded-md text-[12px] mb-1 font-mono"
            style={{ color: clientId ? "#7dd3fc" : undefined }}
          />

          {/* Cómo conseguirlo — colapsable */}
          <button
            onClick={() => setShowSteps((v) => !v)}
            className="flex items-center gap-1 text-[11px] mb-3 mt-2"
            style={{ color: "var(--accent)" }}
          >
            <span style={{ transform: showSteps ? "rotate(90deg)" : "none", display: "inline-block", transition: "transform 0.15s" }}>▶</span>
            ¿Cómo obtengo el Client ID? (5 min, gratis)
          </button>

          {showSteps && (
            <div
              className="rounded-lg p-3 mb-3 text-[11px] flex flex-col gap-2"
              style={{ background: "rgba(94,106,210,0.07)", border: "1px solid rgba(94,106,210,0.2)" }}
            >
              {[
                ["Abrir Google Cloud Console", "https://console.cloud.google.com/apis/library/calendar-json.googleapis.com", "Habilitar Google Calendar API →"],
                ["Crear credenciales OAuth", "https://console.cloud.google.com/apis/credentials/oauthclient", "Nueva credencial → Aplicación web →"],
              ].map(([label, url, cta]) => (
                <div key={label} className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5" style={{ background: "rgba(94,106,210,0.3)", color: "var(--accent)" }}>1</span>
                  <div>
                    <p style={{ color: "var(--text-dim)" }}>{label}</p>
                    <a href={url} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "var(--accent)" }}>{cta}</a>
                  </div>
                </div>
              ))}
              <div className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5" style={{ background: "rgba(94,106,210,0.3)", color: "var(--accent)" }}>2</span>
                <div style={{ color: "var(--text-dim)" }}>
                  En <strong style={{ color: "var(--text)" }}>Orígenes JavaScript autorizados</strong> añade:<br />
                  <span className="font-mono" style={{ color: "#7dd3fc" }}>https://no-emprendas-solo.vercel.app</span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5" style={{ background: "rgba(94,106,210,0.3)", color: "var(--accent)" }}>3</span>
                <div style={{ color: "var(--text-dim)" }}>
                  Copia el <strong style={{ color: "var(--text)" }}>Client ID</strong> y pégalo arriba. Listo.
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="py-2 px-4 rounded-md text-[13px]"
          style={{ color: "var(--text-dim)", border: "1px solid var(--border-strong)" }}
        >
          Cancelar
        </button>
        <button
          onClick={handleConnect}
          disabled={!canConnect}
          className="flex-1 py-2 rounded-md text-[13px] font-medium text-white disabled:opacity-40 flex items-center justify-center gap-2"
          style={{ background: "#16a34a" }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Conectar con Google
        </button>
      </div>
    </Backdrop>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// FORMULARIO DE PRIORIDAD
// ──────────────────────────────────────────────────────────────────────────────
function PriorityForm({
  onSave,
  onCancel,
}: {
  onSave: (label: string, budgetH: number, kind: string) => void
  onCancel: () => void
}) {
  const [label, setLabel] = useState("")
  const [budgetH, setBudgetH] = useState(8)
  const [kind, setKind] = useState<"meeting" | "focus" | "task">("meeting")

  return (
    <div
      className="mt-2 p-3 rounded-lg"
      style={{ background: "var(--surface)", border: "1px solid var(--border-strong)" }}
    >
      <p className="text-[11px] mb-1.5" style={{ color: "var(--text-dimmer)" }}>Nueva prioridad</p>
      <input
        autoFocus
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Ej: Reuniones con inversores"
        className="field-input w-full px-2 py-1.5 rounded-md text-[12px] mb-2"
      />
      <div className="flex items-center gap-2 mb-2">
        <label className="text-[11px] shrink-0" style={{ color: "var(--text-dim)" }}>Horas / semana:</label>
        <input
          type="number"
          value={budgetH}
          onChange={(e) => setBudgetH(Math.max(1, Number(e.target.value)))}
          min={1}
          max={60}
          className="field-input w-16 px-2 py-1 rounded-md text-[12px]"
        />
      </div>
      <div className="flex gap-1 mb-3">
        {(["meeting", "focus", "task"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className="flex-1 py-1 rounded text-[11px]"
            style={{
              background: kind === k ? "rgba(94,106,210,0.2)" : "transparent",
              border: `1px solid ${kind === k ? "var(--accent)" : "var(--border)"}`,
              color: kind === k ? "var(--accent)" : "var(--text-dimmer)",
            }}
          >
            {k === "meeting" ? "Reuniones" : k === "focus" ? "Enfoque" : "Tareas"}
          </button>
        ))}
      </div>
      <div className="flex gap-1.5">
        <button
          onClick={onCancel}
          className="flex-1 py-1.5 text-[12px] rounded-md"
          style={{ color: "var(--text-dim)", border: "1px solid var(--border-strong)" }}
        >
          Cancelar
        </button>
        <button
          onClick={() => label.trim() && onSave(label.trim(), budgetH, kind)}
          disabled={!label.trim()}
          className="flex-1 py-1.5 text-[12px] rounded-md text-white disabled:opacity-40"
          style={{ background: "var(--accent)" }}
        >
          Guardar
        </button>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Subcomponentes UI
// ──────────────────────────────────────────────────────────────────────────────
function Backdrop({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 animate-in"
      style={{ background: "rgba(8,9,11,0.6)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        className="glass-dark w-full max-w-md rounded-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-dim)" }}>{label}</label>
      {children}
    </div>
  )
}

function RailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-3 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
      <p className="text-[10px] uppercase tracking-wide mb-2" style={{ color: "var(--text-dimmer)" }}>{title}</p>
      {children}
    </div>
  )
}

function NavBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="btn-linear w-7 h-7 rounded-md flex items-center justify-center text-[14px]">
      {children}
    </button>
  )
}

function MiniAvatar({ name, src }: { name: string; src: string | null }) {
  if (src) return <img src={src} alt={name} className="w-5 h-5 rounded-full object-cover shrink-0" />
  return (
    <div
      className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0"
      style={{ background: "rgba(255,255,255,0.12)", color: "var(--text-dim)" }}
    >
      {(name || "?").trim()[0]?.toUpperCase()}
    </div>
  )
}

const MEMBER_PALETTE = ["#e57373", "#64b5f6", "#81c784", "#ffd54f", "#ba68c8", "#4dd0e1", "#ffb74d"]
function memberColor(members: Member[], id: string): string {
  const idx = Math.max(0, members.findIndex((m) => m.id === id))
  return MEMBER_PALETTE[idx % MEMBER_PALETTE.length]
}

// datetime-local helper
function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
