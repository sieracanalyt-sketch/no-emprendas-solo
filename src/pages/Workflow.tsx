import { useEffect, useMemo, useRef, useState } from "react"

// ════════════════════════════════════════════════════════════════════════════
// TIPOS / ARQUITECTURA DE DATOS
// ════════════════════════════════════════════════════════════════════════════
type Status = "backlog" | "progress" | "review" | "done"
type Priority = "Urgente" | "Alta" | "Media" | "Baja"

type Member = {
  id: string
  nombre: string
  role: string
}

type Task = {
  id: string
  title: string
  description: string
  priority: Priority
  status: Status
  assignee: string // member id
  blocked: boolean
}

// ── Constantes de configuración ─────────────────────────────────────────────
const COLUMNS: { status: Status; label: string }[] = [
  { status: "backlog", label: "Backlog" },
  { status: "progress", label: "En Progreso" },
  { status: "review", label: "En Revisión" },
  { status: "done", label: "Hecho" },
]

const ROLES = [
  "Product Manager",
  "Lead Developer",
  "Growth Marketer",
  "Designer",
  "Sin rol",
]

const ROLE_COLOR: Record<string, string> = {
  "Product Manager": "#5e6ad2",
  "Lead Developer": "#3b82f6",
  "Growth Marketer": "#22c55e",
  Designer: "#ec4899",
  "Sin rol": "#8a8f98",
}

const PRIORITIES: Priority[] = ["Urgente", "Alta", "Media", "Baja"]

const PRIORITY_COLOR: Record<Priority, string> = {
  Urgente: "#eb5757",
  Alta: "#f2994a",
  Media: "#e2b93b",
  Baja: "#8a8f98",
}

const MEMBER_COLORS = ["#5e6ad2", "#3b82f6", "#22c55e", "#ec4899", "#f2994a", "#06b6d4"]

// ── Mock data inicial ────────────────────────────────────────────────────────
const INITIAL_MEMBERS: Member[] = [
  { id: "m1", nombre: "Siera", role: "Product Manager" },
  { id: "m2", nombre: "Guillem Castells", role: "Lead Developer" },
  { id: "m3", nombre: "Alex Rivera", role: "Growth Marketer" },
  { id: "m4", nombre: "Marta Lin", role: "Designer" },
]

const INITIAL_TASKS: Task[] = [
  { id: "t1", title: "Definir roadmap del MVP", description: "Priorizar features para el primer release público.", priority: "Alta", status: "progress", assignee: "m1", blocked: false },
  { id: "t2", title: "Integrar autenticación con Supabase", description: "Login, registro y recuperación de sesión.", priority: "Urgente", status: "progress", assignee: "m2", blocked: false },
  { id: "t3", title: "Diseñar sistema de tokens UI", description: "Paleta, tipografía y componentes base estilo Linear.", priority: "Media", status: "review", assignee: "m4", blocked: false },
  { id: "t4", title: "Campaña de waitlist", description: "Landing + captación de primeros 500 usuarios.", priority: "Alta", status: "backlog", assignee: "m3", blocked: false },
  { id: "t5", title: "Migrar mensajería a realtime", description: "Canales de Supabase para chats y grupos.", priority: "Urgente", status: "backlog", assignee: "m2", blocked: true },
  { id: "t6", title: "Pulir onboarding", description: "Flujo de completar perfil tras el registro.", priority: "Baja", status: "done", assignee: "m1", blocked: false },
  { id: "t7", title: "Definir métricas de activación", description: "Eventos clave y dashboard de seguimiento.", priority: "Media", status: "backlog", assignee: "m3", blocked: false },
  { id: "t8", title: "Tablero Kanban del equipo", description: "Vista de flujo de trabajo y asignaciones.", priority: "Alta", status: "review", assignee: "m2", blocked: false },
]

// ── Helpers ──────────────────────────────────────────────────────────────────
const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "id-" + Math.random().toString(36).slice(2)

function memberColor(members: Member[], id: string): string {
  const idx = Math.max(0, members.findIndex((m) => m.id === id))
  return MEMBER_COLORS[idx % MEMBER_COLORS.length]
}

function useOutsideClick<T extends HTMLElement>(onClose: () => void) {
  const ref = useRef<T>(null)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [onClose])
  return ref
}

// ════════════════════════════════════════════════════════════════════════════
// SUBCOMPONENTES VISUALES
// ════════════════════════════════════════════════════════════════════════════
function MemberAvatar({
  member,
  members,
  size = 26,
}: {
  member: Member
  members: Member[]
  size?: number
}) {
  const color = memberColor(members, member.id)
  const initial = member.nombre.trim()[0]?.toUpperCase() || "?"
  return (
    <div
      className="flex items-center justify-center font-semibold shrink-0 text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        borderRadius: "9999px",
        background: `linear-gradient(135deg, ${color}, ${color}bb)`,
        boxShadow: `0 0 0 1px ${color}55`,
      }}
      title={`${member.nombre} · ${member.role}`}
    >
      {initial}
    </div>
  )
}

function RoleTag({ role, small = false }: { role: string; small?: boolean }) {
  const c = ROLE_COLOR[role] ?? "#8a8f98"
  return (
    <span
      className={`inline-flex items-center rounded-md font-medium ${
        small ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]"
      }`}
      style={{ background: `${c}1a`, color: c, border: `1px solid ${c}33` }}
    >
      {role}
    </span>
  )
}

function PriorityTag({ priority }: { priority: Priority }) {
  const c = PRIORITY_COLOR[priority]
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium"
      style={{ background: `${c}1a`, color: c, border: `1px solid ${c}30` }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />
      {priority}
    </span>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ════════════════════════════════════════════════════════════════════════════
export default function Workflow() {
  const [members, setMembers] = useState<Member[]>(INITIAL_MEMBERS)
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS)

  const [focusMember, setFocusMember] = useState<string | null>(null)
  const [roleMenuFor, setRoleMenuFor] = useState<string | null>(null)
  const [modalStatus, setModalStatus] = useState<Status | null>(null)
  const [mobileTab, setMobileTab] = useState<Status>("backlog")
  const [dragOver, setDragOver] = useState<Status | null>(null)
  const dragId = useRef<string | null>(null)

  // ── Mutaciones de estado ────────────────────────────────────────────────────
  const setRole = (memberId: string, role: string) => {
    setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, role } : m)))
    setRoleMenuFor(null)
  }

  const moveTask = (taskId: string, status: Status) =>
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)))

  const toggleBlocked = (taskId: string) =>
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, blocked: !t.blocked } : t))
    )

  const deleteTask = (taskId: string) =>
    setTasks((prev) => prev.filter((t) => t.id !== taskId))

  const createTask = (data: Omit<Task, "id">) =>
    setTasks((prev) => [{ ...data, id: uid() }, ...prev])

  // ── Filtrado (modo enfoque) ─────────────────────────────────────────────────
  const visibleTasks = useMemo(
    () => (focusMember ? tasks.filter((t) => t.assignee === focusMember) : tasks),
    [tasks, focusMember]
  )

  const memberById = (id: string) => members.find((m) => m.id === id) ?? members[0]

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 3.5rem)" }}>
      {/* ═══════════════ CABECERA + PANEL DE GESTIÓN ═══════════════ */}
      <header className="shrink-0 px-5 md:px-6 pt-6 pb-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight text-white">
              Flujo de trabajo
            </h1>
            <p className="text-[13px] mt-1" style={{ color: "var(--text-dim)" }}>
              ¿En qué trabaja cada uno? Gestiona roles y asignaciones del equipo.
            </p>
          </div>
        </div>

        {/* A) GESTIÓN DE ROLES — avatares del equipo con dropdown de rol */}
        <div className="mt-5 flex items-center gap-4 flex-wrap">
          <span
            className="text-[11px] font-medium uppercase tracking-wider"
            style={{ color: "var(--text-dimmer)" }}
          >
            Equipo
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            {members.map((m) => (
              <RoleChip
                key={m.id}
                member={m}
                members={members}
                open={roleMenuFor === m.id}
                onToggle={() =>
                  setRoleMenuFor((cur) => (cur === m.id ? null : m.id))
                }
                onPick={(role) => setRole(m.id, role)}
                onClose={() => setRoleMenuFor(null)}
              />
            ))}
          </div>
        </div>

        {/* 1) MODO ENFOQUE — filtro por miembro */}
        <div className="mt-3 flex items-center gap-2.5 flex-wrap">
          <span
            className="text-[11px] font-medium uppercase tracking-wider"
            style={{ color: "var(--text-dimmer)" }}
          >
            Enfoque
          </span>
          <FocusPill
            active={focusMember === null}
            onClick={() => setFocusMember(null)}
            label="Todos"
          />
          {members.map((m) => (
            <FocusPill
              key={m.id}
              active={focusMember === m.id}
              onClick={() =>
                setFocusMember((cur) => (cur === m.id ? null : m.id))
              }
              label={m.nombre.split(" ")[0]}
              avatar={<MemberAvatar member={m} members={members} size={18} />}
            />
          ))}
        </div>
      </header>

      {/* ═══════════════ SELECTOR DE PESTAÑAS (solo móvil) ═══════════════ */}
      <div
        className="md:hidden flex shrink-0 px-3 gap-1"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        {COLUMNS.map((c) => {
          const count = visibleTasks.filter((t) => t.status === c.status).length
          const active = mobileTab === c.status
          return (
            <button
              key={c.status}
              onClick={() => setMobileTab(c.status)}
              className="relative flex-1 py-2.5 text-[12px] font-medium transition-colors"
              style={{ color: active ? "var(--text)" : "var(--text-dim)" }}
            >
              {c.label}
              <span className="ml-1 opacity-60">{count}</span>
              {active && (
                <span
                  className="absolute left-2 right-2 bottom-0 h-[2px] rounded-full"
                  style={{ background: "var(--text)" }}
                />
              )}
            </button>
          )
        })}
      </div>

      {/* ═══════════════ TABLERO KANBAN ═══════════════ */}
      <div className="flex-1 min-h-0 px-3 md:px-6 pb-5 pt-3">
        <div className="h-full md:grid md:grid-cols-4 gap-4 flex flex-col">
          {COLUMNS.map((col) => {
            const colTasks = visibleTasks.filter((t) => t.status === col.status)
            const isDragOver = dragOver === col.status
            return (
              <section
                key={col.status}
                className={`${
                  mobileTab === col.status ? "flex" : "hidden"
                } md:flex flex-col min-h-0 h-full rounded-lg transition-colors`}
                style={{
                  background: isDragOver
                    ? "rgba(94,106,210,0.07)"
                    : "transparent",
                  outline: isDragOver
                    ? "1px dashed rgba(94,106,210,0.4)"
                    : "1px solid transparent",
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  if (dragOver !== col.status) setDragOver(col.status)
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node))
                    setDragOver(null)
                }}
                onDrop={() => {
                  if (dragId.current) moveTask(dragId.current, col.status)
                  dragId.current = null
                  setDragOver(null)
                }}
              >
                {/* Cabecera de columna */}
                <div className="flex items-center justify-between px-2 py-2 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-white">
                      {col.label}
                    </span>
                    <span
                      className="text-[11px] px-1.5 rounded-md"
                      style={{
                        color: "var(--text-dim)",
                        background: "rgba(255,255,255,0.05)",
                      }}
                    >
                      {colTasks.length}
                    </span>
                  </div>
                  {/* 3) Creación rápida */}
                  <button
                    onClick={() => setModalStatus(col.status)}
                    className="w-6 h-6 rounded-md flex items-center justify-center text-[15px] leading-none transition"
                    style={{ color: "var(--text-dim)" }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(255,255,255,0.06)"
                      e.currentTarget.style.color = "#fff"
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent"
                      e.currentTarget.style.color = "var(--text-dim)"
                    }}
                    title="Añadir tarea"
                  >
                    +
                  </button>
                </div>

                {/* Cuerpo con scroll independiente */}
                <div className="flex-1 min-h-0 overflow-y-auto px-1.5 pb-2 flex flex-col gap-2">
                  {colTasks.length === 0 && (
                    <div
                      className="text-[12px] text-center py-6 rounded-lg border border-dashed"
                      style={{
                        color: "var(--text-dimmer)",
                        borderColor: "var(--border)",
                      }}
                    >
                      Sin tareas
                    </div>
                  )}
                  {colTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      member={memberById(task.assignee)}
                      members={members}
                      onDragStart={() => (dragId.current = task.id)}
                      onMove={(s) => moveTask(task.id, s)}
                      onToggleBlocked={() => toggleBlocked(task.id)}
                      onDelete={() => deleteTask(task.id)}
                    />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      </div>

      {/* ═══════════════ MODAL CREAR TAREA ═══════════════ */}
      {modalStatus && (
        <CreateTaskModal
          status={modalStatus}
          members={members}
          onClose={() => setModalStatus(null)}
          onCreate={(data) => {
            createTask(data)
            setModalStatus(null)
          }}
        />
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// A) CHIP DE MIEMBRO + DROPDOWN DE ROL
// ════════════════════════════════════════════════════════════════════════════
function RoleChip({
  member,
  members,
  open,
  onToggle,
  onPick,
  onClose,
}: {
  member: Member
  members: Member[]
  open: boolean
  onToggle: () => void
  onPick: (role: string) => void
  onClose: () => void
}) {
  const ref = useOutsideClick<HTMLDivElement>(onClose)
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={onToggle}
        className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full transition"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.borderColor = "var(--border-strong)")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.borderColor = "var(--border)")
        }
      >
        <MemberAvatar member={member} members={members} size={22} />
        <span className="text-[12px] font-medium text-white">
          {member.nombre.split(" ")[0]}
        </span>
        <RoleTag role={member.role} small />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-2 z-30 w-56 rounded-lg p-1.5 animate-in"
          style={{
            background: "#17191b",
            border: "1px solid var(--border-strong)",
            boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
          }}
        >
          <p
            className="px-2 py-1.5 text-[11px] uppercase tracking-wider"
            style={{ color: "var(--text-dimmer)" }}
          >
            Asignar rol · {member.nombre}
          </p>
          {ROLES.map((role) => {
            const active = role === member.role
            return (
              <button
                key={role}
                onClick={() => onPick(role)}
                className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md transition text-left"
                style={{ background: active ? "rgba(255,255,255,0.05)" : "transparent" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "rgba(255,255,255,0.05)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = active
                    ? "rgba(255,255,255,0.05)"
                    : "transparent")
                }
              >
                <RoleTag role={role} />
                {active && <span style={{ color: ROLE_COLOR[role] }}>✓</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 1) PASTILLA DE MODO ENFOQUE
// ════════════════════════════════════════════════════════════════════════════
function FocusPill({
  active,
  onClick,
  label,
  avatar,
}: {
  active: boolean
  onClick: () => void
  label: string
  avatar?: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-full text-[12px] font-medium transition"
      style={{
        background: active ? "rgba(94,106,210,0.14)" : "var(--surface)",
        border: active
          ? "1px solid rgba(94,106,210,0.45)"
          : "1px solid var(--border)",
        color: active ? "#aab2f0" : "var(--text-dim)",
      }}
    >
      {avatar ?? (
        <span
          className="w-2 h-2 rounded-full"
          style={{ background: active ? "#5e6ad2" : "var(--text-dimmer)" }}
        />
      )}
      {label}
    </button>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// B) TARJETA DE TAREA
// ════════════════════════════════════════════════════════════════════════════
function TaskCard({
  task,
  member,
  members,
  onDragStart,
  onMove,
  onToggleBlocked,
  onDelete,
}: {
  task: Task
  member: Member
  members: Member[]
  onDragStart: () => void
  onMove: (s: Status) => void
  onToggleBlocked: () => void
  onDelete: () => void
}) {
  const [menu, setMenu] = useState(false)
  const ref = useOutsideClick<HTMLDivElement>(() => setMenu(false))

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move"
        onDragStart()
      }}
      className="group relative rounded-lg p-3 cursor-grab active:cursor-grabbing animate-in"
      style={{
        background: "var(--surface)",
        border: task.blocked
          ? "1px solid rgba(242,153,74,0.45)"
          : "1px solid var(--border)",
        boxShadow: task.blocked ? "0 0 0 1px rgba(242,153,74,0.12)" : undefined,
      }}
    >
      {/* Fila superior: prioridad + menú */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <PriorityTag priority={task.priority} />
        <div className="relative" ref={ref}>
          <button
            onClick={() => setMenu((v) => !v)}
            className="w-6 h-6 -mr-1 rounded-md flex items-center justify-center text-[15px] leading-none opacity-0 group-hover:opacity-100 transition"
            style={{ color: "var(--text-dim)" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "rgba(255,255,255,0.06)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
            aria-label="Opciones de tarea"
          >
            ⋯
          </button>
          {menu && (
            <div
              className="absolute right-0 top-full mt-1 z-30 w-48 rounded-lg p-1.5 animate-in"
              style={{
                background: "#17191b",
                border: "1px solid var(--border-strong)",
                boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
              }}
            >
              <p
                className="px-2 py-1 text-[10px] uppercase tracking-wider"
                style={{ color: "var(--text-dimmer)" }}
              >
                Mover a
              </p>
              {COLUMNS.map((c) => (
                <button
                  key={c.status}
                  onClick={() => {
                    onMove(c.status)
                    setMenu(false)
                  }}
                  disabled={c.status === task.status}
                  className="w-full text-left px-2 py-1.5 rounded-md text-[12px] transition disabled:opacity-40"
                  style={{ color: "var(--text)" }}
                  onMouseEnter={(e) => {
                    if (c.status !== task.status)
                      e.currentTarget.style.background = "rgba(255,255,255,0.05)"
                  }}
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  {c.label}
                </button>
              ))}
              <div className="my-1 h-px" style={{ background: "var(--border)" }} />
              <button
                onClick={() => {
                  onToggleBlocked()
                  setMenu(false)
                }}
                className="w-full text-left px-2 py-1.5 rounded-md text-[12px] transition"
                style={{ color: task.blocked ? "#22c55e" : "#f2994a" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "rgba(255,255,255,0.05)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                {task.blocked ? "Desbloquear" : "Marcar bloqueado"}
              </button>
              <button
                onClick={() => {
                  onDelete()
                  setMenu(false)
                }}
                className="w-full text-left px-2 py-1.5 rounded-md text-[12px] transition"
                style={{ color: "rgba(235,87,87,0.85)" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "rgba(235,87,87,0.1)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                Eliminar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Título + descripción */}
      <p className="text-[13.5px] font-medium text-white leading-snug">
        {task.title}
      </p>
      {task.description && (
        <p
          className="text-[12px] mt-1 leading-relaxed line-clamp-2"
          style={{ color: "var(--text-dim)" }}
        >
          {task.description}
        </p>
      )}

      {/* 2) Indicador de bloqueo */}
      {task.blocked && (
        <div
          className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-medium"
          style={{
            background: "rgba(242,153,74,0.12)",
            color: "#f2994a",
            border: "1px solid rgba(242,153,74,0.3)",
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#f2994a" }} />
          Bloqueado · necesita ayuda
        </div>
      )}

      {/* Fila inferior: assignee a la derecha */}
      <div className="flex items-center justify-end mt-3">
        <MemberAvatar member={member} members={members} size={24} />
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 3) MODAL DE CREACIÓN DE TAREA
// ════════════════════════════════════════════════════════════════════════════
function CreateTaskModal({
  status,
  members,
  onClose,
  onCreate,
}: {
  status: Status
  members: Member[]
  onClose: () => void
  onCreate: (data: Omit<Task, "id">) => void
}) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [priority, setPriority] = useState<Priority>("Media")
  const [assignee, setAssignee] = useState(members[0]?.id ?? "")

  const columnLabel = COLUMNS.find((c) => c.status === status)?.label ?? ""

  const submit = () => {
    if (!title.trim()) return
    onCreate({
      title: title.trim(),
      description: description.trim(),
      priority,
      status,
      assignee,
      blocked: false,
    })
  }

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    document.addEventListener("keydown", onEsc)
    return () => document.removeEventListener("keydown", onEsc)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(2px)" }}
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl p-5 animate-in"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border-strong)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-semibold text-white">Nueva tarea</h3>
          <span
            className="text-[11px] px-2 py-0.5 rounded-md"
            style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-dim)" }}
          >
            {columnLabel}
          </span>
        </div>

        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Título de la tarea"
          className="field-input w-full px-3.5 py-2 rounded-md text-[14px] mb-3"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Descripción corta…"
          className="field-input w-full px-3.5 py-2.5 rounded-md text-[14px] resize-none leading-relaxed mb-4"
        />

        {/* Prioridad */}
        <p
          className="text-[11px] font-medium uppercase tracking-wider mb-1.5"
          style={{ color: "var(--text-dimmer)" }}
        >
          Prioridad
        </p>
        <div className="flex gap-2 mb-4 flex-wrap">
          {PRIORITIES.map((p) => {
            const active = priority === p
            const c = PRIORITY_COLOR[p]
            return (
              <button
                key={p}
                onClick={() => setPriority(p)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium transition"
                style={{
                  background: active ? `${c}1f` : "rgba(255,255,255,0.03)",
                  color: active ? c : "var(--text-dim)",
                  border: `1px solid ${active ? `${c}55` : "var(--border)"}`,
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />
                {p}
              </button>
            )
          })}
        </div>

        {/* Asignar a */}
        <p
          className="text-[11px] font-medium uppercase tracking-wider mb-1.5"
          style={{ color: "var(--text-dimmer)" }}
        >
          Asignar a
        </p>
        <div className="flex gap-2 mb-5 flex-wrap">
          {members.map((m) => {
            const active = assignee === m.id
            return (
              <button
                key={m.id}
                onClick={() => setAssignee(m.id)}
                className="flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full text-[12px] font-medium transition"
                style={{
                  background: active ? "rgba(94,106,210,0.14)" : "rgba(255,255,255,0.03)",
                  border: active
                    ? "1px solid rgba(94,106,210,0.45)"
                    : "1px solid var(--border)",
                  color: active ? "#aab2f0" : "var(--text-dim)",
                }}
              >
                <MemberAvatar member={m} members={members} size={18} />
                {m.nombre.split(" ")[0]}
              </button>
            )
          })}
        </div>

        {/* Acciones */}
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3.5 py-2 rounded-md text-[13px] font-medium transition"
            style={{ color: "var(--text-dim)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-dim)")}
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={!title.trim()}
            className="px-4 py-2 rounded-md text-[13px] font-semibold bg-white text-black transition hover:bg-white/90 disabled:opacity-40"
          >
            Crear tarea
          </button>
        </div>
      </div>
    </div>
  )
}
