import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
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
  yToMinutesRaw,
  snapMinutes,
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

// Drag payload helpers (arrastre nativo desde el rail: tareas Kanban y miembros)
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
  const [editing, setEditing] = useState<CalEvent | null>(null)
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
  const atTime = (day: Date, min: number) => {
    const d = new Date(day)
    d.setHours(Math.floor(min / 60), min % 60, 0, 0)
    return d
  }

  // Clic simple sobre un hueco → bloque de 1 h por defecto
  const openCreate = (day: Date, startMin: number) =>
    openCreateRange(day, startMin, Math.min(END_HOUR * 60, startMin + 60))

  // Arrastrar sobre un hueco → bloque con la duración dibujada
  const openCreateRange = (day: Date, startMin: number, endMin: number) => {
    setDraft({
      title: "",
      start_at: atTime(day, startMin).toISOString(),
      end_at: atTime(day, Math.max(endMin, startMin + 15)).toISOString(),
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

  // ── Guardar cambios de un evento existente (modal de edición) ───────────────
  const commitEdit = async (id: string, patch: Partial<CalEvent>) => {
    const ev = events.find((e) => e.id === id) ?? googleEvents.find((e) => e.id === id)
    setEditing(null)
    setDetail(null)
    // Evento que vive en Google Calendar (no está en Supabase)
    if (ev?.source === "google" && ev.google_id) {
      await updateGoogleEvent(ev.google_id, {
        title: patch.title,
        description: patch.description ?? undefined,
        start_at: patch.start_at,
        end_at: patch.end_at,
      })
      if (user) setGoogleEvents(await pullGoogleEvents(weekRef, user.id))
      toast("Evento actualizado en Google Calendar", "success")
      return
    }
    await update(id, patch)
    if (ev?.google_id) {
      await updateGoogleEvent(ev.google_id, {
        title: patch.title,
        description: patch.description ?? undefined,
        start_at: patch.start_at,
        end_at: patch.end_at,
      })
    }
    toast("Evento actualizado", "success")
  }

  // ── Reprogramar: mover o redimensionar (drag) — sync con Google si aplica ───
  const rescheduleEvent = async (id: string, day: Date, startMin: number, endMin: number) => {
    const s = atTime(day, startMin)
    const e = atTime(day, Math.max(endMin, startMin + 15))
    // ¿Es un evento importado de Google (no está en Supabase)?
    const gEv = googleEvents.find((ev) => ev.id === id)
    if (gEv?.google_id) {
      await updateGoogleEvent(gEv.google_id, { start_at: s.toISOString(), end_at: e.toISOString() })
      if (user) setGoogleEvents(await pullGoogleEvents(weekRef, user.id))
      toast("Evento actualizado en Google Calendar", "success")
      return
    }
    // Evento NES normal
    const ev = events.find((ev) => ev.id === id)
    if (!ev) return
    await update(id, { start_at: s.toISOString(), end_at: e.toISOString() })
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
          className="text-[12px] px-2.5 py-1.5 rounded-md font-medium transition inline-flex items-center gap-1.5"
          style={{
            background: urgentMode ? "rgba(235,87,87,0.16)" : "transparent",
            border: `1px solid ${urgentMode ? "rgba(235,87,87,0.5)" : "var(--border-strong)"}`,
            color: urgentMode ? "#ff8585" : "var(--text-dim)",
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" />
          </svg>
          {urgentMode ? "Urgencia ON" : "Modo Urgencia"}
        </button>

        {/* Congelación de Emergencia (T2-6) */}
        <button
          onClick={() => setEmergency(true)}
          className="text-[12px] px-2.5 py-1.5 rounded-md font-medium btn-linear inline-flex items-center gap-1.5"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v20M2 12h20M4.5 4.5l15 15M19.5 4.5l-15 15" />
          </svg>
          Congelar agenda
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
          onCreateRange={openCreateRange}
          onReschedule={rescheduleEvent}
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
          onEdit={() => {
            setEditing(detail)
            setDetail(null)
          }}
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
        <EventModal
          mode="create"
          draft={draft}
          members={members}
          urgentMode={urgentMode}
          onCancel={() => setDraft(null)}
          onSave={commitCreate}
        />
      )}

      {editing && (
        <EventModal
          mode="edit"
          draft={{
            title: editing.title,
            description: editing.description ?? "",
            start_at: editing.start_at,
            end_at: editing.end_at,
            kind: editing.kind,
            color: editing.color ?? KIND_COLOR[editing.kind],
            attendees: editing.attendees ?? [],
            urgent: editing.urgent,
          }}
          members={members}
          urgentMode={urgentMode}
          locked={editing.source === "google"}
          onCancel={() => setEditing(null)}
          onSave={(ev) =>
            commitEdit(editing.id, {
              title: ev.title,
              description: ev.description ?? "",
              start_at: ev.start_at,
              end_at: ev.end_at,
              kind: ev.kind,
              color: ev.color,
              attendees: ev.attendees ?? [],
              urgent: ev.urgent ?? false,
            })
          }
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
// REJILLA SEMANAL — interacción por punteros (crear/mover/redimensionar en vivo)
// ──────────────────────────────────────────────────────────────────────────────
const GUTTER_W = 56 // px de la columna de horas
const MIN_EVENT_MIN = 15 // duración mínima de un bloque
const DRAG_THRESHOLD = 4 // px antes de considerar que es arrastre y no clic

type Gesture = {
  kind: "create" | "move" | "resize"
  ev?: CalEvent
  edge?: "top" | "bottom"
  dayIndex: number
  anchorMin: number // punto fijo (inicio en create; extremo opuesto en resize)
  startMin: number
  endMin: number
  durMin: number
  grabOffset: number // solo move: rawMin − startMin al agarrar
  startX: number
  startY: number
  moved: boolean
  touch: boolean
}

function WeekGrid({
  days,
  events,
  fusionMembers,
  memberEventsById,
  members,
  showFocus,
  onCreate,
  onCreateRange,
  onReschedule,
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
  onCreateRange: (day: Date, startMin: number, endMin: number) => void
  onReschedule: (id: string, day: Date, startMin: number, endMin: number) => void
  onDropTask: (task: KTask, day: Date, startMin: number) => void
  onAddFusion: (id: string) => void
  onOpen: (e: CalEvent) => void
  currentUserId: string
}) {
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)
  // Estable entre renders → no rompe la memoización de las columnas durante el arrastre
  const now = useMemo(() => new Date(), [])

  const bodyRef = useRef<HTMLDivElement>(null)
  const gesture = useRef<Gesture | null>(null) // estado mutable del arrastre (handlers)
  const rafRef = useRef<number | null>(null)    // coalesce de updates a 1 por frame
  const [ghost, setGhost] = useState<Gesture | null>(null) // instantánea para pintar el fantasma
  // Solo cambia al empezar/soltar (no en cada frame) → las columnas no se repintan al arrastrar
  const [dragId, setDragId] = useState<string | null>(null)

  // clientX/Y → (índice de día, minutos crudos desde medianoche)
  const locate = useCallback((clientX: number, clientY: number) => {
    const rect = bodyRef.current!.getBoundingClientRect()
    const colW = (rect.width - GUTTER_W) / 7
    const dayIndex = Math.max(0, Math.min(6, Math.floor((clientX - rect.left - GUTTER_W) / colW)))
    const rawMin = yToMinutesRaw(clientY - rect.top)
    return { dayIndex, rawMin }
  }, [])

  const updateGesture = useCallback((e: PointerEvent) => {
    const g = gesture.current
    if (!g) return
    if (Math.abs(e.clientX - g.startX) + Math.abs(e.clientY - g.startY) > DRAG_THRESHOLD) g.moved = true
    const { dayIndex, rawMin } = locate(e.clientX, e.clientY)

    if (g.kind === "create") {
      if (g.touch) return // en táctil no se dibuja: es pulsación para crear o scroll
      const b = snapMinutes(rawMin)
      g.startMin = Math.min(g.anchorMin, b)
      g.endMin = Math.max(g.anchorMin, b)
    } else if (g.kind === "move") {
      g.dayIndex = dayIndex
      let ns = snapMinutes(rawMin - g.grabOffset)
      ns = Math.max(START_HOUR * 60, Math.min(END_HOUR * 60 - g.durMin, ns))
      g.startMin = ns
      g.endMin = ns + g.durMin
    } else if (g.edge === "bottom") {
      g.startMin = g.anchorMin
      g.endMin = Math.max(g.anchorMin + MIN_EVENT_MIN, snapMinutes(rawMin))
    } else {
      g.endMin = g.anchorMin
      g.startMin = Math.min(g.anchorMin - MIN_EVENT_MIN, snapMinutes(rawMin))
    }
  }, [locate])

  const beginGesture = useCallback((init: Gesture) => {
    gesture.current = init
    setGhost({ ...init })
    setDragId(init.kind !== "create" ? init.ev!.id : null)
    const flush = () => {
      rafRef.current = null
      setGhost(gesture.current ? { ...gesture.current } : null)
    }
    const move = (e: PointerEvent) => {
      updateGesture(e)
      // A lo sumo un repintado por frame (evita tirones)
      if (rafRef.current == null) rafRef.current = requestAnimationFrame(flush)
    }
    const up = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
      if (rafRef.current != null) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
      const g = gesture.current
      gesture.current = null
      setGhost(null)
      setDragId(null)
      if (!g) return
      const day = days[g.dayIndex]
      if (g.kind === "create") {
        if (g.moved && !g.touch && g.endMin - g.startMin >= MIN_EVENT_MIN) {
          onCreateRange(day, g.startMin, g.endMin)
        } else if (!g.moved) {
          onCreate(day, snapMinutes(g.anchorMin)) // pulsación simple → bloque de 1 h
        }
      } else if (g.kind === "move") {
        if (g.moved) onReschedule(g.ev!.id, day, g.startMin, g.endMin)
        else onOpen(g.ev!) // clic sin arrastrar → abre el detalle
      } else if (g.moved) {
        onReschedule(g.ev!.id, day, g.startMin, g.endMin)
      }
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }, [days, updateGesture, onCreate, onCreateRange, onReschedule, onOpen])

  // Agarrar un evento (mover)
  const grabEvent = useCallback((e: React.PointerEvent, ev: CalEvent, dayIndex: number) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const { rawMin } = locate(e.clientX, e.clientY)
    const s = minutesOfDay(ev.start_at)
    const dur = durationMin(ev)
    beginGesture({
      kind: "move", ev, dayIndex, anchorMin: s, startMin: s, endMin: s + dur,
      durMin: dur, grabOffset: rawMin - s, startX: e.clientX, startY: e.clientY,
      moved: false, touch: e.pointerType === "touch",
    })
  }, [beginGesture, locate])

  // Agarrar un tirador de redimensión
  const grabResize = useCallback((e: React.PointerEvent, ev: CalEvent, dayIndex: number, edge: "top" | "bottom") => {
    if (e.button !== 0) return
    e.stopPropagation()
    const s = minutesOfDay(ev.start_at)
    const en = s + durationMin(ev)
    beginGesture({
      kind: "resize", ev, edge, dayIndex,
      anchorMin: edge === "bottom" ? s : en, startMin: s, endMin: en,
      durMin: en - s, grabOffset: 0, startX: e.clientX, startY: e.clientY,
      moved: false, touch: e.pointerType === "touch",
    })
  }, [beginGesture])

  // Empezar a crear arrastrando sobre un hueco
  const grabCreate = useCallback((e: React.PointerEvent, dayIndex: number) => {
    if (e.button !== 0) return
    const { rawMin } = locate(e.clientX, e.clientY)
    const m = snapMinutes(rawMin)
    beginGesture({
      kind: "create", dayIndex, anchorMin: m, startMin: m, endMin: m + 60,
      durMin: 60, grabOffset: 0, startX: e.clientX, startY: e.clientY,
      moved: false, touch: e.pointerType === "touch",
    })
  }, [beginGesture, locate])

  const handleDrop = useCallback((e: React.DragEvent, day: Date) => {
    e.preventDefault()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const startMin = yToMinutes(e.clientY - rect.top)
    const taskRaw = e.dataTransfer.getData(DT_TASK)
    const memberId = e.dataTransfer.getData(DT_MEMBER)
    if (taskRaw) onDropTask(JSON.parse(taskRaw) as KTask, day, startMin)
    else if (memberId) onAddFusion(memberId)
  }, [onDropTask, onAddFusion])

  return (
    <div className="flex-1 overflow-auto">
      {/* Cabecera de días */}
      <div
        className="grid sticky top-0 z-20"
        style={{
          gridTemplateColumns: `${GUTTER_W}px repeat(7, minmax(110px, 1fr))`,
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
        ref={bodyRef}
        className="grid relative"
        style={{ gridTemplateColumns: `${GUTTER_W}px repeat(7, minmax(110px, 1fr))`, height: GRID_HEIGHT }}
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

        {/* Columnas de día — memoizadas: no se repintan mientras arrastras */}
        {days.map((day, di) => (
          <DayColumn
            key={di}
            day={day}
            dayIndex={di}
            events={events}
            showFocus={showFocus}
            fusionMembers={fusionMembers}
            memberEventsById={memberEventsById}
            members={members}
            currentUserId={currentUserId}
            now={now}
            dimmedId={dragId}
            onCreateDown={grabCreate}
            onDropNative={handleDrop}
            onGrab={grabEvent}
            onResizeGrab={grabResize}
          />
        ))}

        {/* Fantasma en vivo — una sola capa sobre toda la rejilla (repintado barato) */}
        {ghost && <GhostOverlay g={ghost} />}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// COLUMNA DE DÍA — memoizada para que el arrastre no la re-renderice
// ──────────────────────────────────────────────────────────────────────────────
const DayColumn = memo(function DayColumn({
  day,
  dayIndex,
  events,
  showFocus,
  fusionMembers,
  memberEventsById,
  members,
  currentUserId,
  now,
  dimmedId,
  onCreateDown,
  onDropNative,
  onGrab,
  onResizeGrab,
}: {
  day: Date
  dayIndex: number
  events: CalEvent[]
  showFocus: boolean
  fusionMembers: Set<string>
  memberEventsById: (id: string) => CalEvent[]
  members: Member[]
  currentUserId: string
  now: Date
  dimmedId: string | null
  onCreateDown: (e: React.PointerEvent, dayIndex: number) => void
  onDropNative: (e: React.DragEvent, day: Date) => void
  onGrab: (e: React.PointerEvent, ev: CalEvent, dayIndex: number) => void
  onResizeGrab: (e: React.PointerEvent, ev: CalEvent, dayIndex: number, edge: "top" | "bottom") => void
}) {
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)

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
  const commonGaps = fusionMembers.size > 0 ? commonFreeGaps([myDay, ...fusionSets]) : []
  const fusionLayers = [...fusionMembers].flatMap((id) =>
    memberEventsById(id)
      .filter((e) => sameDay(new Date(e.start_at), day))
      .map((e) => ({ id, e }))
  )

  return (
    <div
      className="relative select-none"
      style={{ borderLeft: "1px solid var(--border)", touchAction: "pan-y" }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => onDropNative(e, day)}
      onPointerDown={(e) => onCreateDown(e, dayIndex)}
    >
      {/* Líneas de hora */}
      {hours.map((h) => (
        <div
          key={h}
          className="absolute left-0 right-0 pointer-events-none"
          style={{ top: minutesToY(h * 60), borderTop: "1px solid var(--border)" }}
        />
      ))}

      {/* Zonas de Enfoque */}
      {focusGaps.map((gap, i) => (
        <div
          key={`f${i}`}
          className="absolute left-1 right-1 rounded-md pointer-events-none flex items-start p-1.5"
          style={{
            top: minutesToY(gap.startMin),
            height: ((gap.endMin - gap.startMin) / 60) * HOUR_H,
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
      {commonGaps.map((gap, i) => (
        <div
          key={`c${i}`}
          className="absolute rounded-md pointer-events-none"
          style={{
            top: minutesToY(gap.startMin),
            height: ((gap.endMin - gap.startMin) / 60) * HOUR_H,
            right: 2,
            width: 6,
            background: "rgba(34,197,94,0.5)",
          }}
          title={`Hueco común ${fmtRangeMin(gap.startMin)}–${fmtRangeMin(gap.endMin)}`}
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
          dayIndex={dayIndex}
          dimmed={dimmedId === ev.id}
          onGrab={onGrab}
          onResizeGrab={onResizeGrab}
        />
      ))}
    </div>
  )
})

// ──────────────────────────────────────────────────────────────────────────────
// FANTASMA — capa única sobre la rejilla que sigue el arrastre en vivo
// ──────────────────────────────────────────────────────────────────────────────
function GhostOverlay({ g }: { g: Gesture }) {
  const top = minutesToY(g.startMin)
  const height = Math.max(14, ((g.endMin - g.startMin) / 60) * HOUR_H)
  const label = g.kind === "move" && g.ev ? g.ev.title || "Evento" : "Nuevo bloque"
  const accent = g.kind === "move" && g.ev ? g.ev.color || KIND_COLOR[g.ev.kind] : "var(--accent)"
  return (
    <div
      className="absolute pointer-events-none z-30 rounded-md px-1.5 py-1 overflow-hidden"
      style={{
        top,
        height,
        left: `calc(${GUTTER_W}px + (100% - ${GUTTER_W}px) * ${g.dayIndex} / 7 + 4px)`,
        width: `calc((100% - ${GUTTER_W}px) / 7 - 8px)`,
        background: "rgba(94,106,210,0.30)",
        border: `1px solid ${accent}`,
        boxShadow: "0 8px 22px rgba(0,0,0,0.4)",
      }}
    >
      <p className="text-[11px] font-semibold leading-tight truncate" style={{ color: "var(--text)" }}>{label}</p>
      <p className="text-[10px] leading-tight" style={{ color: "var(--text)" }}>
        {fmtRangeMin(g.startMin)}–{fmtRangeMin(g.endMin)}
      </p>
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
  dayIndex,
  dimmed,
  onGrab,
  onResizeGrab,
}: {
  ev: CalEvent
  lane: number
  lanes: number
  dayIndex: number
  dimmed: boolean
  onGrab: (e: React.PointerEvent, ev: CalEvent, dayIndex: number) => void
  onResizeGrab: (e: React.PointerEvent, ev: CalEvent, dayIndex: number, edge: "top" | "bottom") => void
}) {
  const startMin = minutesOfDay(ev.start_at)
  const top = minutesToY(startMin)
  const height = Math.max(18, (durationMin(ev) / 60) * HOUR_H - 2)
  const color = ev.color || KIND_COLOR[ev.kind]
  const proposed = ev.status === "proposed"
  const isGoogle = ev.source === "google"
  const widthPct = 100 / lanes
  const resizable = height >= 34 // solo mostramos tiradores si hay espacio
  const expiresIn = ev.expires_at
    ? Math.max(0, Math.round((new Date(ev.expires_at).getTime() - Date.now()) / 3600_000))
    : null

  return (
    <div
      onPointerDown={(e) => onGrab(e, ev, dayIndex)}
      className="cal-event absolute rounded-md px-1.5 py-1 text-left overflow-hidden cursor-grab active:cursor-grabbing"
      style={{
        top,
        height,
        left: `calc(${lane * widthPct}% + 3px)`,
        width: `calc(${widthPct}% - 6px)`,
        background: proposed ? `${color}1f` : `${color}28`,
        border: `1px solid ${ev.urgent ? "#eb5757" : color}${proposed ? "" : "88"}`,
        borderStyle: proposed ? "dashed" : "solid",
        borderLeft: `3px solid ${ev.urgent ? "#eb5757" : color}`,
        opacity: dimmed ? 0.35 : 1,
        touchAction: "none",
      }}
    >
      {/* Tirador superior */}
      {resizable && (
        <div
          onPointerDown={(e) => onResizeGrab(e, ev, dayIndex, "top")}
          className="cal-grip absolute top-0 left-0 right-0 h-2 flex items-start justify-center"
          style={{ cursor: "ns-resize" }}
        >
          <div className="mt-[1px] w-5 h-[3px] rounded-full" style={{ background: `${color}cc` }} />
        </div>
      )}

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

      {/* Tirador inferior */}
      {resizable && (
        <div
          onPointerDown={(e) => onResizeGrab(e, ev, dayIndex, "bottom")}
          className="cal-grip absolute bottom-0 left-0 right-0 h-2 flex items-end justify-center"
          style={{ cursor: "ns-resize" }}
        >
          <div className="mb-[1px] w-5 h-[3px] rounded-full" style={{ background: `${color}cc` }} />
        </div>
      )}
    </div>
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
  onEdit,
  onDelete,
  onAccept,
  onPropose,
}: {
  ev: CalEvent
  members: Member[]
  previewTz: string
  showTzPreview: boolean
  onClose: () => void
  onEdit: () => void
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
        <button
          onClick={onEdit}
          title="Editar evento"
          className="btn-linear shrink-0 w-8 h-8 rounded-md flex items-center justify-center"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--text-dim)" }}>
            <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </button>
      </div>

      {/* Fecha y hora */}
      <div className="flex items-center gap-2 mb-3 text-[13px]" style={{ color: "var(--text)" }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--text-dim)" }}>
          <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" strokeLinecap="round" />
        </svg>
        <span className="capitalize">
          {new Date(ev.start_at).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
        </span>
        <span style={{ color: "var(--text-dim)" }}>· {local}</span>
      </div>

      {ev.description && (
        <p className="text-[13px] mb-3 whitespace-pre-wrap" style={{ color: "var(--text-dim)" }}>{ev.description}</p>
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
        <button onClick={onEdit} className="flex-1 py-2 rounded-md text-[13px] font-medium text-white" style={{ background: "var(--accent)" }}>
          Editar
        </button>
        <button onClick={onPropose} className="flex-1 btn-linear py-2 rounded-md text-[13px] font-medium">
          ↪ 3 alternativas
        </button>
        <button onClick={onDelete} title="Eliminar" className="py-2 px-3 rounded-md text-[13px]" style={{ color: "#eb5757", border: "1px solid rgba(235,87,87,0.3)" }}>
          Eliminar
        </button>
      </div>
    </Backdrop>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// CREAR / EDITAR EVENTO — mismo modal para ambos flujos
// ──────────────────────────────────────────────────────────────────────────────
const EVENT_COLORS = ["#5e6ad2", "#3b82f6", "#38bdf8", "#22c55e", "#f59e0b", "#eb5757", "#a78bfa", "#ec4899"]

function EventModal({
  mode,
  draft,
  members,
  urgentMode,
  locked = false,
  onCancel,
  onSave,
}: {
  mode: "create" | "edit"
  draft: NewEvent
  members: Member[]
  urgentMode: boolean
  locked?: boolean
  onCancel: () => void
  onSave: (ev: NewEvent) => void
}) {
  const [title, setTitle] = useState(draft.title)
  const [description, setDescription] = useState(draft.description ?? "")
  const [kind, setKind] = useState<CalEvent["kind"]>(draft.kind ?? "event")
  const [color, setColor] = useState(draft.color ?? KIND_COLOR[draft.kind ?? "event"])
  const [attendees, setAttendees] = useState<string[]>(draft.attendees ?? [])
  const [startTime, setStartTime] = useState(toLocalInput(draft.start_at))
  const [endTime, setEndTime] = useState(toLocalInput(draft.end_at))
  const [error, setError] = useState<string | null>(null)

  const toggle = (id: string) =>
    setAttendees((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]))

  // Al cambiar el tipo, se adopta su color por defecto (se puede sobrescribir).
  const pickKind = (k: CalEvent["kind"]) => {
    setKind(k)
    setColor(KIND_COLOR[k])
  }

  const save = () => {
    const s = new Date(startTime)
    const e = new Date(endTime)
    if (isNaN(s.getTime()) || isNaN(e.getTime())) { setError("Revisa las fechas."); return }
    if (e.getTime() <= s.getTime()) { setError("El fin debe ser posterior al inicio."); return }
    onSave({
      ...draft,
      title: title.trim() || "Evento",
      description,
      kind,
      attendees,
      color,
      start_at: s.toISOString(),
      end_at: e.toISOString(),
      urgent: mode === "create" ? urgentMode || draft.urgent : draft.urgent,
    })
  }

  return (
    <Backdrop onClose={onCancel}>
      <h3 className="text-[15px] font-semibold mb-3" style={{ color: "var(--text)" }}>
        {mode === "create" ? "Nuevo bloque" : "Editar evento"}
      </h3>

      {locked && (
        <div className="rounded-md p-2.5 mb-3 text-[11px]" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)", color: "#4ade80" }}>
          🟢 Evento de Google Calendar — se editan título, descripción y horario, y se sincroniza allí.
        </div>
      )}

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
          <input type="datetime-local" value={startTime} onChange={(e) => { setStartTime(e.target.value); setError(null) }} className="field-input w-full px-2 py-1.5 rounded-md text-[12px]" />
        </div>
        <div>
          <label className="text-[11px] block mb-1" style={{ color: "var(--text-dim)" }}>Fin</label>
          <input type="datetime-local" value={endTime} onChange={(e) => { setEndTime(e.target.value); setError(null) }} className="field-input w-full px-2 py-1.5 rounded-md text-[12px]" />
        </div>
      </div>

      {!locked && (
        <>
          <label className="text-[11px] block mb-1" style={{ color: "var(--text-dim)" }}>Tipo</label>
          <div className="flex gap-1.5 mb-3">
            {(["event", "meeting", "focus", "task"] as const).map((k) => (
              <button
                key={k}
                onClick={() => pickKind(k)}
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

          <label className="text-[11px] block mb-1" style={{ color: "var(--text-dim)" }}>Color</label>
          <div className="flex gap-2 mb-3">
            {EVENT_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className="w-6 h-6 rounded-full transition"
                style={{
                  background: c,
                  boxShadow: color === c ? "0 0 0 2px var(--bg), 0 0 0 4px " + c : "none",
                }}
                title={c}
              />
            ))}
          </div>
        </>
      )}

      <label className="text-[11px] block mb-1" style={{ color: "var(--text-dim)" }}>Descripción</label>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        placeholder="Notas, orden del día, enlaces…"
        className="field-input w-full px-3 py-2 rounded-md text-[13px] mb-3 resize-none"
      />

      {!locked && kind === "meeting" && (
        <>
          <label className="text-[11px] block mb-1" style={{ color: "var(--text-dim)" }}>
            Asistentes {mode === "create" && !urgentMode && "(requiere Peaje de Preparación)"}
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
            {members.length === 0 && (
              <p className="text-[11px]" style={{ color: "var(--text-dimmer)" }}>Sin miembros en el equipo.</p>
            )}
          </div>
        </>
      )}

      {error && (
        <p className="text-[12px] mb-2" style={{ color: "#ff8585" }}>{error}</p>
      )}

      <div className="flex gap-2 mt-2">
        <button onClick={onCancel} className="flex-1 py-2 rounded-md text-[13px]" style={{ color: "var(--text-dim)", border: "1px solid var(--border-strong)" }}>
          Cancelar
        </button>
        <button onClick={save} className="flex-1 py-2 rounded-md text-[13px] font-medium text-white" style={{ background: "var(--accent)" }}>
          {mode === "create" ? "Crear" : "Guardar cambios"}
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
