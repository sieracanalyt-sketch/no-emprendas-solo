import {
  createContext, useCallback, useContext, useEffect,
  useMemo, useRef, useState,
} from "react"
import type { User } from "@supabase/supabase-js"
import { supabase } from "../supabase"
import { useUser } from "../hooks/useUser"
import {
  QUADRANTS, QUADRANT_BY_ID, deriveQuadrant,
  priorityForQuadrant, isUrgentQuadrant, type Quadrant,
} from "../lib/eisenhower"
import {
  dayKey, loadPlan, savePlan, runAutoclean, type MyDayPlan,
} from "../lib/myDay"

// ══════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════
type Tab = "tasks" | "prioridades" | "gestion"
type Status = "backlog" | "progress" | "review" | "done"
type Priority = "Urgente" | "Alta" | "Media" | "Baja"
type Member = { id: string; nombre: string; avatar: string | null; role: string; joinedAt: string }
type Task = {
  id: string; title: string; description: string
  priority: Priority; status: Status; assignee: string | null
  blocked: boolean; due_date: string | null
  eisenhower_quadrant: number | null
}
type CustomRole = { id: string; name: string; color: string }
type ActivityEntry = { id: string; text: string; time: Date }
type AllUser = { id: string; nombre: string; avatar: string | null }
type Milestone = { id: string; label: string; color: string }
type Toast = { id: string; type: "error" | "success" | "info"; text: string }

// ══════════════════════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════════════════════
const COLUMNS: { status: Status; label: string; desc: string }[] = [
  { status: "backlog",  label: "Backlog",     desc: "Ideas y tareas pendientes de priorizar." },
  { status: "progress", label: "En Progreso", desc: "Objetivos activos en desarrollo ahora mismo." },
  { status: "review",   label: "En Revisión", desc: "Tareas terminadas esperando feedback o aprobación." },
  { status: "done",     label: "Completado",  desc: "Hitos alcanzados con éxito por el equipo." },
]
// ── 50+ roles organizados por categoría ──
const ROLE_CATEGORIES = [
  { label: "Negocio",            emoji: "🏢", color: "#5e6ad2", roles: ["CEO / Fundador","Director General","COO / Operaciones","Responsable de Producto","Estratega de Negocio","Inversor / Business Angel","Asesor Empresarial","Director Comercial","Responsable de Ventas","Ejecutivo de Cuentas","Director de Expansión","Jefe de Proyecto","Responsable de Alianzas","CFO / Finanzas"] },
  { label: "Tecnología",         emoji: "💻", color: "#3b82f6", roles: ["Desarrollador Full Stack","Desarrollador Frontend","Desarrollador Backend","Desarrollador Móvil","Arquitecto de Software","DevOps / Infraestructura","Ingeniero de Datos","Científico de Datos","Experto en IA / ML","Seguridad Informática","QA / Control de Calidad","CTO / Director Técnico","Administrador de Sistemas","Experto en Blockchain","Ingeniero de Software"] },
  { label: "Diseño",             emoji: "🎨", color: "#ec4899", roles: ["Diseñador UX / UI","Diseñador Gráfico","Diseñador de Producto","Diseñador de Marca","Motion Designer","Ilustrador / Artista","Director Creativo","Diseñador Web","Fotógrafo / Videógrafo","Diseñador de Experiencias"] },
  { label: "Marketing y Ventas", emoji: "📢", color: "#22c55e", roles: ["Director de Marketing","Especialista en Growth","Community Manager","Responsable de RRSS","SEO / SEM","Creador de Contenido","Director de Marca","Copywriter / Redactor","Email Marketing","Responsable de PR","Influencer / Creator","Publicidad Digital","Representante de Ventas"] },
  { label: "Legal y Finanzas",   emoji: "⚖️", color: "#f59e0b", roles: ["Abogado / Asesor Legal","Gestor Financiero","Contable / Asesor Fiscal","Responsable de RRHH","Asesor de Cumplimiento","Analista Financiero","Director Financiero"] },
  { label: "Otros",              emoji: "✨", color: "#8a8f98", roles: ["Mentor / Coach","Consultor Independiente","Investigador / Académico","Estudiante / En formación","Freelancer","Sin rol definido"] },
]
const ALL_ROLES_FLAT = ROLE_CATEGORIES.flatMap(c => c.roles.map(name => ({ name, color: c.color, category: c.label })))
const MAIN_QUICK_ROLES = [
  { name: "Negocio",     color: "#5e6ad2", emoji: "🏢", desc: "Estrategia, producto y operaciones" },
  { name: "Tecnología",  color: "#3b82f6", emoji: "💻", desc: "Desarrollo, datos e infraestructura" },
  { name: "Creatividad", color: "#ec4899", emoji: "🎨", desc: "Diseño, marketing y contenido"       },
]
// Cuestionario de descubrimiento de rol
const QUIZ_AREAS = [
  { value: "negocio",     label: "Dirijo, decido y gestiono el negocio", emoji: "🏢" },
  { value: "tecnologia",  label: "Construyo, programo y resuelvo técnico", emoji: "💻" },
  { value: "diseno",      label: "Diseño y creo visualmente", emoji: "🎨" },
  { value: "marketing",   label: "Vendo, conecto y comunico", emoji: "📢" },
  { value: "legal",       label: "Gestiono lo legal y financiero", emoji: "⚖️" },
]
const QUIZ_LEVELS = [
  { value: "junior", label: "Estoy empezando / Aprendiendo", emoji: "🌱" },
  { value: "mid",    label: "Tengo experiencia media",       emoji: "🚀" },
  { value: "senior", label: "Soy senior / Experto",          emoji: "⭐" },
]
const ROLE_SUGGESTIONS: Record<string, string[]> = {
  "negocio-junior":    ["Jefe de Proyecto","Responsable de Ventas","Ejecutivo de Cuentas"],
  "negocio-mid":       ["Responsable de Producto","Director Comercial","Estratega de Negocio"],
  "negocio-senior":    ["CEO / Fundador","Director General","COO / Operaciones"],
  "tecnologia-junior": ["Desarrollador Frontend","Desarrollador Backend","QA / Control de Calidad"],
  "tecnologia-mid":    ["Desarrollador Full Stack","Desarrollador Móvil","Ingeniero de Datos"],
  "tecnologia-senior": ["CTO / Director Técnico","Arquitecto de Software","Experto en IA / ML"],
  "diseno-junior":     ["Diseñador Gráfico","Diseñador Web","Ilustrador / Artista"],
  "diseno-mid":        ["Diseñador UX / UI","Diseñador de Producto","Diseñador de Marca"],
  "diseno-senior":     ["Director Creativo","Diseñador de Experiencias","Motion Designer"],
  "marketing-junior":  ["Community Manager","Creador de Contenido","Copywriter / Redactor"],
  "marketing-mid":     ["Especialista en Growth","SEO / SEM","Responsable de RRSS"],
  "marketing-senior":  ["Director de Marketing","Director de Marca","Responsable de PR"],
  "legal-junior":      ["Contable / Asesor Fiscal","Analista Financiero","Responsable de RRHH"],
  "legal-mid":         ["Gestor Financiero","Abogado / Asesor Legal","Asesor de Cumplimiento"],
  "legal-senior":      ["Director Financiero","CFO / Finanzas","Asesor Empresarial"],
}

const PRIORITIES: Priority[] = ["Urgente", "Alta", "Media", "Baja"]
const PRIORITY_COLOR: Record<Priority, string> = {
  Urgente: "#eb5757", Alta: "#f2994a", Media: "#e2b93b", Baja: "#8a8f98",
}
const MEMBER_COLORS = ["#5e6ad2", "#3b82f6", "#22c55e", "#ec4899", "#f2994a", "#06b6d4", "#a78bfa", "#f472b6"]
const FALLBACK_MEMBER: Member = { id: "", nombre: "Sin asignar", avatar: null, role: "Sin rol definido", joinedAt: new Date().toISOString() }
const CUSTOM_ROLES_KEY  = "nes_custom_roles"
const MILESTONES_KEY    = "nes_milestones"
const CRITICAL_ROLES    = ["CTO / Director Técnico", "Diseñador UX / UI", "Responsable de Producto"]

// ══════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════
function memberColorById(members: Member[], id: string | null) {
  if (!id) return MEMBER_COLORS[0]
  const idx = Math.max(0, members.findIndex(m => m.id === id))
  return MEMBER_COLORS[idx % MEMBER_COLORS.length]
}
function getRoleColor(allRoles: { name: string; color: string }[], role: string) {
  return allRoles.find(r => r.name === role)?.color ?? "#8a8f98"
}
function useOutsideClick<T extends HTMLElement>(onClose: () => void) {
  const ref = useRef<T>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [onClose])
  return ref
}
function isDueSoon(d: string | null) {
  if (!d) return false
  const diff = new Date(d).getTime() - Date.now()
  return diff >= 0 && diff <= 172800000
}
function isDueOverdue(d: string | null) {
  if (!d) return false
  return new Date(d).getTime() < Date.now()
}
function fmtRel(date: Date) {
  const diff = Date.now() - date.getTime()
  if (diff < 60000) return "ahora"
  if (diff < 3600000) return `hace ${Math.floor(diff / 60000)}m`
  return `hace ${Math.floor(diff / 3600000)}h`
}
function heatColor(count: number) {
  if (count === 0) return "#3b82f6"
  if (count <= 3)  return "#22c55e"
  if (count <= 6)  return "#f59e0b"
  return "#ef4444"
}
function crossStrength(a: string, b: string, tasks: Task[]) {
  let s = 0
  const statuses: Status[] = ["backlog","progress","review","done"]
  for (const st of statuses) {
    const ca = tasks.filter(t => t.assignee === a && t.status === st).length
    const cb = tasks.filter(t => t.assignee === b && t.status === st).length
    s += Math.min(ca, cb)
  }
  return s
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })
}

// ══════════════════════════════════════════════════════════════════
// CONTEXT
// ══════════════════════════════════════════════════════════════════
type WFCtx = {
  user: User | null
  members: Member[]; tasks: Task[]; allUsers: AllUser[]
  allRoles: { name: string; color: string }[]
  activity: ActivityEntry[]
  focusMember: string | null; myWorkloadOnly: boolean
  visibleTasks: Task[]; progress: number; searchResults: Task[]
  activityOpen: boolean; roleMenuFor: string | null
  addMenuOpen: boolean; addSelectedUser: string | null
  createRoleOpen: boolean; modalStatus: Status | null
  mobileTab: Status; dragOver: Status | null
  dragId: React.MutableRefObject<string | null>
  toasts: Toast[]
  memberById: (id: string | null) => Member
  openSearch: () => void
  setFocusMember: (v: string | null) => void
  setMyWorkloadOnly: (v: boolean) => void
  setActivityOpen: (v: boolean) => void
  setRoleMenuFor: (v: string | null) => void
  setAddMenuOpen: (v: boolean) => void
  setAddSelectedUser: (v: string | null) => void
  setCreateRoleOpen: (v: boolean) => void
  setModalStatus: (v: Status | null) => void
  setMobileTab: (v: Status) => void
  setDragOver: (v: Status | null) => void
  addMember: (userId: string, role: string) => Promise<void>
  removeMember: (id: string) => Promise<void>
  setRole: (id: string, role: string) => Promise<void>
  addCustomRole: (r: CustomRole) => void
  createTask: (d: Omit<Task, "id">) => Promise<void>
  moveTask: (id: string, s: Status) => Promise<void>
  setTaskQuadrant: (id: string, q: Quadrant) => Promise<void>
  toggleBlocked: (id: string) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  exportProject: () => void
  addToast: (type: Toast["type"], text: string) => void
  dismissToast: (id: string) => void
}
const WFContext = createContext<WFCtx>({} as WFCtx)
const useWF = () => useContext(WFContext)

// ══════════════════════════════════════════════════════════════════
// ATOMS
// ══════════════════════════════════════════════════════════════════
function MemberAvatar({ member, size = 26 }: { member: Member; size?: number }) {
  const { members } = useWF()
  const color = memberColorById(members, member.id)
  const initial = member.nombre.trim()[0]?.toUpperCase() || "?"
  if (member.avatar) return (
    <img src={member.avatar} alt={member.nombre} referrerPolicy="no-referrer"
      className="shrink-0 object-cover"
      style={{ width: size, height: size, borderRadius: "9999px", boxShadow: `0 0 0 1px ${color}66` }} />
  )
  return (
    <div className="flex items-center justify-center font-semibold shrink-0 text-white"
      style={{ width: size, height: size, fontSize: size * 0.42, borderRadius: "9999px",
        background: `linear-gradient(135deg,${color},${color}bb)`, boxShadow: `0 0 0 1px ${color}55` }}>
      {initial}
    </div>
  )
}
function RoleTag({ role, color, small = false }: { role: string; color: string; small?: boolean }) {
  return (
    <span className={`inline-flex items-center rounded-md font-medium ${small ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]"}`}
      style={{ background: `${color}1a`, color, border: `1px solid ${color}33` }}>{role}</span>
  )
}
function PriorityTag({ priority }: { priority: Priority }) {
  const c = PRIORITY_COLOR[priority]
  return (
    <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium"
      style={{ background: `${c}1a`, color: c, border: `1px solid ${c}30` }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />{priority}
    </span>
  )
}
function ToastContainer() {
  const { toasts, dismissToast } = useWF()
  if (!toasts.length) return null
  return (
    <div className="fixed bottom-5 right-5 z-[9998] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => {
        const col = t.type === "error" ? "#eb5757" : t.type === "success" ? "#22c55e" : "#5e6ad2"
        return (
          <div key={t.id} className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-[13px] font-medium pointer-events-auto"
            style={{ background: `${col}18`, border: `1px solid ${col}44`, color: col, backdropFilter: "blur(8px)", boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
            <span>{t.type === "error" ? "✕" : t.type === "success" ? "✓" : "ℹ"}</span>
            {t.text}
            <button onClick={() => dismissToast(t.id)} className="ml-1 opacity-50 hover:opacity-100 transition-opacity">✕</button>
          </div>
        )
      })}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════
export default function Workflow() {
  const [user, userLoading] = useUser()
  const [members, setMembers]       = useState<Member[]>([])
  const [tasks, setTasks]           = useState<Task[]>([])
  const [allUsers, setAllUsers]     = useState<AllUser[]>([])
  const [customRoles, setCustomRoles] = useState<CustomRole[]>(() => {
    try { return JSON.parse(localStorage.getItem(CUSTOM_ROLES_KEY) ?? "[]") } catch { return [] }
  })
  const [loading, setLoading]       = useState(true)
  const [activeTab, setActiveTab]   = useState<Tab>("tasks")
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [focusMember, setFocusMember] = useState<string | null>(null)
  const [myWorkloadOnly, setMyWorkloadOnly] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)
  const [activity, setActivity]     = useState<ActivityEntry[]>([])
  const [roleMenuFor, setRoleMenuFor] = useState<string | null>(null)
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [addSelectedUser, setAddSelectedUser] = useState<string | null>(null)
  const [createRoleOpen, setCreateRoleOpen] = useState(false)
  const [modalStatus, setModalStatus] = useState<Status | null>(null)
  const [mobileTab, setMobileTab]   = useState<Status>("backlog")
  const [dragOver, setDragOver]     = useState<Status | null>(null)
  const [toasts, setToasts]         = useState<Toast[]>([])
  const dragId = useRef<string | null>(null)

  const allRoles = useMemo(
    () => [...ALL_ROLES_FLAT.map(r => ({ name: r.name, color: r.color })), ...customRoles.map(r => ({ name: r.name, color: r.color }))],
    [customRoles]
  )

  const addToast = useCallback((type: Toast["type"], text: string) => {
    const id = crypto.randomUUID()
    setToasts(prev => [...prev, { id, type, text }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])
  const dismissToast = useCallback((id: string) => setToasts(prev => prev.filter(t => t.id !== id)), [])

  const logActivity = useCallback((text: string) => {
    setActivity(prev => [{ id: crypto.randomUUID(), text, time: new Date() }, ...prev.slice(0, 19)])
  }, [])

  // ── Loaders ──
  const loadMembers = useCallback(async () => {
    const { data: roles } = await supabase.from("workflow_roles").select("user_id, rol, updated_at")
    if (!roles || roles.length === 0) { setMembers([]); return }
    const { data: users } = await supabase.from("users").select("id, nombre, avatar")
      .in("id", roles.map(r => r.user_id))
    const map = new Map(roles.map(r => [r.user_id, r]))
    setMembers((users ?? []).map(u => ({
      id: u.id, nombre: u.nombre || "Usuario", avatar: u.avatar ?? null,
      role: map.get(u.id)?.rol ?? "Sin rol",
      joinedAt: map.get(u.id)?.updated_at ?? new Date().toISOString(),
    })))
  }, [])

  const loadTasks = useCallback(async () => {
    const { data, error } = await supabase.from("workflow_tasks")
      .select("id,title,description,priority,status,assignee,blocked,due_date,eisenhower_quadrant")
      .order("created_at", { ascending: false })
    if (error) { console.error("loadTasks:", error); return }
    setTasks((data as Task[]) ?? [])
  }, [])

  const loadAllUsers = useCallback(async () => {
    const { data } = await supabase.from("users").select("id,nombre,avatar").order("nombre")
    setAllUsers(data ?? [])
  }, [])

  useEffect(() => {
    if (userLoading) return
    let cancelled = false
    ;(async () => {
      await Promise.all([loadMembers(), loadTasks(), loadAllUsers()])
      if (!cancelled) setLoading(false)
    })()
    const ch = supabase.channel("wf-board")
      .on("postgres_changes", { event: "*", schema: "public", table: "workflow_tasks" }, () => loadTasks())
      .on("postgres_changes", { event: "*", schema: "public", table: "workflow_roles" }, () => loadMembers())
      .subscribe()
    return () => { cancelled = true; supabase.removeChannel(ch) }
  }, [userLoading, loadMembers, loadTasks, loadAllUsers])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setSearchOpen(v => !v); setSearchQuery("") }
    }
    document.addEventListener("keydown", h)
    return () => document.removeEventListener("keydown", h)
  }, [])

  // ── Mutations ──
  const addMember = useCallback(async (userId: string, role: string) => {
    const u = allUsers.find(x => x.id === userId)
    if (!u) return
    setMembers(prev => [...prev, { id: u.id, nombre: u.nombre || "Usuario", avatar: u.avatar ?? null, role, joinedAt: new Date().toISOString() }])
    setAddMenuOpen(false); setAddSelectedUser(null)
    logActivity(`Añadiste a ${u.nombre || "Usuario"} · ${role}`)
    const { error } = await supabase.from("workflow_roles").upsert({ user_id: userId, rol: role, updated_at: new Date().toISOString() })
    if (error) addToast("error", "Error al añadir miembro")
  }, [allUsers, logActivity, addToast])

  const removeMember = useCallback(async (id: string) => {
    const m = members.find(x => x.id === id)
    setMembers(prev => prev.filter(x => x.id !== id)); setRoleMenuFor(null)
    if (m) logActivity(`Eliminaste a ${m.nombre} del equipo`)
    const { error } = await supabase.from("workflow_roles").delete().eq("user_id", id)
    if (error) { addToast("error", "Error al eliminar miembro"); loadMembers() }
  }, [members, logActivity, addToast, loadMembers])

  const setRole = useCallback(async (id: string, role: string) => {
    setMembers(prev => prev.map(m => m.id === id ? { ...m, role } : m)); setRoleMenuFor(null)
    const m = members.find(x => x.id === id)
    if (m) logActivity(`Rol de ${m.nombre} → ${role}`)
    const { error } = await supabase.from("workflow_roles").upsert({ user_id: id, rol: role, updated_at: new Date().toISOString() })
    if (error) addToast("error", "Error al actualizar rol")
  }, [members, logActivity, addToast])

  const addCustomRole = useCallback((r: CustomRole) => {
    const updated = [...customRoles, r]
    setCustomRoles(updated); localStorage.setItem(CUSTOM_ROLES_KEY, JSON.stringify(updated))
    logActivity(`Nuevo rol: "${r.name}"`)
  }, [customRoles, logActivity])

  // ── FIX: split insert from select; reload tasks after insert ──
  const createTask = useCallback(async (d: Omit<Task, "id">) => {
    const { error } = await supabase.from("workflow_tasks").insert(d)
    if (error) {
      console.error("createTask error:", error)
      addToast("error", `Error al crear tarea: ${error.message}`)
      return
    }
    await loadTasks()
    logActivity(`Creaste "${d.title}"`)
  }, [logActivity, addToast, loadTasks])

  const moveTask = useCallback(async (id: string, status: Status) => {
    const t = tasks.find(x => x.id === id)
    setTasks(prev => prev.map(x => x.id === id ? { ...x, status } : x))
    if (t) logActivity(`"${t.title}" → ${COLUMNS.find(c => c.status === status)?.label}`)
    const { error } = await supabase.from("workflow_tasks").update({ status }).eq("id", id)
    if (error) { addToast("error", "Error al mover tarea"); loadTasks() }
  }, [tasks, logActivity, addToast, loadTasks])

  // ── Matriz de Eisenhower: arrastrar a un cuadrante actualiza el Kanban ──
  // (espejo sincronizado). Persiste el cuadrante explícito + ajusta prioridad,
  // y saca del Backlog las que pasan a un cuadrante urgente.
  const setTaskQuadrant = useCallback(async (id: string, q: Quadrant) => {
    const t = tasks.find(x => x.id === id)
    if (!t || deriveQuadrant(t) === q && t.eisenhower_quadrant === q) return
    const priority = priorityForQuadrant(q)
    const status: Status = isUrgentQuadrant(q) && t.status === "backlog" ? "progress" : t.status
    setTasks(prev => prev.map(x => x.id === id ? { ...x, priority, status, eisenhower_quadrant: q } : x))
    logActivity(`"${t.title}" → ${QUADRANT_BY_ID[q].title}`)
    const { error } = await supabase.from("workflow_tasks")
      .update({ priority, status, eisenhower_quadrant: q }).eq("id", id)
    if (error) { addToast("error", "Error al priorizar tarea"); loadTasks() }
  }, [tasks, logActivity, addToast, loadTasks])

  const toggleBlocked = useCallback(async (id: string) => {
    const t = tasks.find(x => x.id === id); const blocked = !t?.blocked
    setTasks(prev => prev.map(x => x.id === id ? { ...x, blocked } : x))
    if (t) logActivity(`${blocked ? "Bloqueaste" : "Desbloqueaste"} "${t.title}"`)
    const { error } = await supabase.from("workflow_tasks").update({ blocked }).eq("id", id)
    if (error) { addToast("error", "Error al actualizar tarea"); loadTasks() }
  }, [tasks, logActivity, addToast, loadTasks])

  const deleteTask = useCallback(async (id: string) => {
    const t = tasks.find(x => x.id === id)
    setTasks(prev => prev.filter(x => x.id !== id))
    if (t) logActivity(`Eliminaste "${t.title}"`)
    const { error } = await supabase.from("workflow_tasks").delete().eq("id", id)
    if (error) { addToast("error", "Error al eliminar tarea"); loadTasks() }
  }, [tasks, logActivity, addToast, loadTasks])

  const exportProject = useCallback(() => {
    const by = (s: Status) => tasks.filter(t => t.status === s)
    const fmt = (sym: string, t: Task) =>
      `- [${sym}] ${t.title}${t.blocked ? " [BLOQUEADO]" : ""}${t.due_date ? ` (vence: ${new Date(t.due_date).toLocaleDateString("es-ES")})` : ""}`
    const done = tasks.filter(t => t.status === "done").length
    const pct  = tasks.length ? Math.round((done / tasks.length) * 100) : 0
    const txt  = [
      `# Estado del Proyecto — ${new Date().toLocaleDateString("es-ES")}`,
      `Progreso: ${done}/${tasks.length} tareas (${pct}%)`, "",
      `## 📋 Backlog (${by("backlog").length})`,   ...by("backlog").map(t => fmt(" ", t)), "",
      `## 🔄 En Progreso (${by("progress").length})`, ...by("progress").map(t => fmt("~", t)), "",
      `## 🔍 En Revisión (${by("review").length})`,   ...by("review").map(t => fmt("!", t)), "",
      `## ✅ Completado (${by("done").length})`,       ...by("done").map(t => fmt("x", t)),
    ].join("\n")
    navigator.clipboard.writeText(txt).then(() => {
      logActivity("Estado exportado al portapapeles ✓")
      addToast("success", "Resumen copiado al portapapeles")
    })
  }, [tasks, logActivity, addToast])

  const visibleTasks = useMemo(() => {
    if (myWorkloadOnly && user) return tasks.filter(t => t.assignee === user.id)
    if (focusMember) return tasks.filter(t => t.assignee === focusMember)
    return tasks
  }, [tasks, myWorkloadOnly, focusMember, user])

  const progress = tasks.length === 0 ? 0 : Math.round(
    (tasks.filter(t => t.status === "done").length / tasks.length) * 100
  )

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.toLowerCase()
    return tasks.filter(t => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)).slice(0, 8)
  }, [tasks, searchQuery])

  const memberById = useCallback(
    (id: string | null) => members.find(m => m.id === id) ?? FALLBACK_MEMBER,
    [members]
  )

  if (!userLoading && !user) return (
    <div className="flex items-center justify-center" style={{ height: "calc(100vh - 3.5rem)" }}>
      <p className="text-[13px]" style={{ color: "var(--text-dim)" }}>Inicia sesión para ver el flujo de trabajo.</p>
    </div>
  )
  if (loading) return (
    <div className="flex items-center justify-center" style={{ height: "calc(100vh - 3.5rem)" }}>
      <p className="text-[13px]" style={{ color: "var(--text-dim)" }}>Cargando flujo de trabajo…</p>
    </div>
  )

  const ctx: WFCtx = {
    user, members, tasks, allUsers, allRoles, activity,
    focusMember, myWorkloadOnly, visibleTasks, progress, searchResults,
    activityOpen, roleMenuFor, addMenuOpen, addSelectedUser, createRoleOpen,
    modalStatus, mobileTab, dragOver, dragId, toasts, memberById,
    openSearch: () => { setSearchOpen(true); setSearchQuery("") },
    setFocusMember, setMyWorkloadOnly, setActivityOpen, setRoleMenuFor,
    setAddMenuOpen, setAddSelectedUser, setCreateRoleOpen, setModalStatus,
    setMobileTab, setDragOver,
    addMember, removeMember, setRole, addCustomRole,
    createTask, moveTask, setTaskQuadrant, toggleBlocked, deleteTask, exportProject,
    addToast, dismissToast,
  }

  return (
    <WFContext.Provider value={ctx}>
      <style>{`
        @keyframes wf-pop{0%{transform:translate(-50%,-50%) scale(0);opacity:0}65%{transform:translate(-50%,-50%) scale(1.06);opacity:1}100%{transform:translate(-50%,-50%) scale(1);opacity:1}}
        @keyframes modal-pop{0%{opacity:0;transform:scale(0.92) translateY(8px)}100%{opacity:1;transform:scale(1) translateY(0)}}
        @keyframes wf-float{0%,100%{transform:translate(-50%,-50%) translateY(0px)}50%{transform:translate(-50%,-50%) translateY(-5px)}}
        @keyframes wf-pulse{0%,100%{box-shadow:0 0 0 0 rgba(94,106,210,0.3),0 0 0 0 rgba(94,106,210,0.1)}50%{box-shadow:0 0 0 12px rgba(94,106,210,0.07),0 0 0 24px rgba(94,106,210,0.02)}}
        @keyframes wf-diamond-pulse{0%,100%{opacity:0.7}50%{opacity:1}}
      `}</style>
      <div className="flex flex-col" style={{ height: "calc(100vh - 3.5rem)" }}>
        {/* ── HEADER ── */}
        <header className="shrink-0 px-5 md:px-6 pt-5 pb-0">
          <div className="flex items-center justify-between gap-4 mb-3 flex-wrap">
            <div>
              <h1 className="text-[22px] font-semibold tracking-tight text-white">Flujo de trabajo</h1>
              <p className="text-[12px] mt-0.5" style={{ color: "var(--text-dim)" }}>
                Gestiona tareas y conexiones de tu equipo.
              </p>
            </div>
            <div className="flex items-center gap-0.5 p-0.5 rounded-lg"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              {(["tasks","prioridades","gestion"] as Tab[]).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className="px-4 py-1.5 rounded-md text-[13px] font-medium transition-all"
                  style={{
                    background: activeTab === tab ? "rgba(255,255,255,0.09)" : "transparent",
                    color: activeTab === tab ? "#fff" : "var(--text-dim)",
                  }}>
                  {tab === "tasks" ? "Tareas" : tab === "prioridades" ? "Prioridades" : "Gestión"}
                </button>
              ))}
            </div>
          </div>
          {tasks.length > 0 && activeTab === "tasks" && (
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px]" style={{ color: "var(--text-dimmer)" }}>Progreso global</span>
                <span className="text-[11px] font-semibold" style={{ color: progress === 100 ? "#22c55e" : "#5e6ad2" }}>{progress}%</span>
              </div>
              <div className="h-[3px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${progress}%`, background: progress === 100 ? "#22c55e" : "linear-gradient(90deg,#5e6ad2,#3b82f6)" }} />
              </div>
            </div>
          )}
        </header>

        {activeTab === "tasks" ? <TasksView />
          : activeTab === "prioridades" ? <PrioridadesView />
          : <GestionView />}

        {searchOpen && (
          <SearchModal query={searchQuery} onQueryChange={setSearchQuery}
            onClose={() => { setSearchOpen(false); setSearchQuery("") }} />
        )}
        <ToastContainer />
      </div>
    </WFContext.Provider>
  )
}

// ══════════════════════════════════════════════════════════════════
// TASKS VIEW
// ══════════════════════════════════════════════════════════════════
function TasksView() {
  const {
    user, members, visibleTasks, activityOpen, activity,
    focusMember, myWorkloadOnly, roleMenuFor, addMenuOpen, addSelectedUser,
    createRoleOpen, modalStatus, mobileTab, dragOver, dragId,
    memberById, openSearch, exportProject,
    setFocusMember, setMyWorkloadOnly, setActivityOpen, setRoleMenuFor,
    setAddMenuOpen, setAddSelectedUser, setCreateRoleOpen, setModalStatus, setMobileTab, setDragOver,
    addMember, removeMember, setRole, addCustomRole, createTask, moveTask, toggleBlocked, deleteTask,
  } = useWF()

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <div className="shrink-0 px-5 md:px-6 pb-3">
        {/* Member bar */}
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--text-dimmer)" }}>Equipo</span>
          {members.map(m => (
            <RoleChip key={m.id} member={m} open={roleMenuFor === m.id}
              onToggle={() => setRoleMenuFor(roleMenuFor === m.id ? null : m.id)}
              onPick={r => setRole(m.id, r)} onClose={() => setRoleMenuFor(null)} onRemove={() => removeMember(m.id)} />
          ))}
          <AddMemberButton open={addMenuOpen}
            onToggle={() => { setAddMenuOpen(!addMenuOpen); setAddSelectedUser(null) }}
            onClose={() => { setAddMenuOpen(false); setAddSelectedUser(null) }}
            selectedUser={addSelectedUser} onSelectUser={setAddSelectedUser}
            onBack={() => setAddSelectedUser(null)} onAdd={addMember} />
          <CreateRoleButton open={createRoleOpen} onToggle={() => setCreateRoleOpen(!createRoleOpen)}
            onClose={() => setCreateRoleOpen(false)} onSave={addCustomRole} />
        </div>
        {/* Filter bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--text-dimmer)" }}>Vista</span>
          <button onClick={() => { setMyWorkloadOnly(!myWorkloadOnly); setFocusMember(null) }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium transition"
            style={{
              background: myWorkloadOnly ? "rgba(94,106,210,0.14)" : "var(--surface)",
              border: myWorkloadOnly ? "1px solid rgba(94,106,210,0.45)" : "1px solid var(--border)",
              color: myWorkloadOnly ? "#aab2f0" : "var(--text-dim)",
            }}>Mi carga</button>
          <FocusPill active={!focusMember && !myWorkloadOnly}
            onClick={() => { setFocusMember(null); setMyWorkloadOnly(false) }} label="Todos" />
          {members.map(m => (
            <FocusPill key={m.id} active={focusMember === m.id && !myWorkloadOnly}
              onClick={() => { setFocusMember(focusMember === m.id ? null : m.id); setMyWorkloadOnly(false) }}
              label={m.nombre.split(" ")[0]} avatar={<MemberAvatar member={m} size={18} />} />
          ))}
          <div className="ml-auto flex items-center gap-1.5">
            <ActionBtn onClick={() => setActivityOpen(!activityOpen)} active={activityOpen} label="Actividad" />
            <ActionBtn onClick={exportProject} label="Exportar" title="Copiar resumen al portapapeles" />
            <ActionBtn onClick={openSearch} label="Buscar" hint="⌘K" />
          </div>
        </div>
      </div>

      {/* Mobile tabs */}
      <div className="md:hidden flex shrink-0 px-3 gap-1" style={{ borderBottom: "1px solid var(--border)" }}>
        {COLUMNS.map(c => {
          const n = visibleTasks.filter(t => t.status === c.status).length
          const active = mobileTab === c.status
          return (
            <button key={c.status} onClick={() => setMobileTab(c.status)}
              className="relative flex-1 py-2.5 text-[12px] font-medium transition-colors"
              style={{ color: active ? "var(--text)" : "var(--text-dim)" }}>
              {c.label} <span className="opacity-50">{n}</span>
              {active && <span className="absolute left-2 right-2 bottom-0 h-[2px] rounded-full" style={{ background: "var(--text)" }} />}
            </button>
          )
        })}
      </div>

      {/* Board + activity */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        <div className="flex-1 min-w-0 px-3 md:px-6 pb-5 pt-3 overflow-hidden">
          <div className="h-full md:grid md:grid-cols-4 gap-4 flex flex-col">
            {COLUMNS.map(col => {
              const colTasks = visibleTasks.filter(t => t.status === col.status)
              const over = dragOver === col.status
              return (
                <section key={col.status}
                  className={`${mobileTab === col.status ? "flex" : "hidden"} md:flex flex-col min-h-0 h-full rounded-lg transition-all`}
                  style={{
                    background: over ? "rgba(94,106,210,0.07)" : "transparent",
                    outline: over ? "1px dashed rgba(94,106,210,0.4)" : "1px solid transparent",
                  }}
                  onDragOver={e => { e.preventDefault(); if (dragOver !== col.status) setDragOver(col.status) }}
                  onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null) }}
                  onDrop={() => { if (dragId.current) moveTask(dragId.current, col.status); dragId.current = null; setDragOver(null) }}>
                  <div className="flex items-center justify-between px-2 py-2 shrink-0">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-white">{col.label}</span>
                        <span className="text-[11px] px-1.5 rounded-md" style={{ color: "var(--text-dim)", background: "rgba(255,255,255,0.05)" }}>
                          {colTasks.length}
                        </span>
                      </div>
                      <p className="text-[10px] mt-0.5 hidden lg:block" style={{ color: "var(--text-dimmer)" }}>{col.desc}</p>
                    </div>
                    <button onClick={() => setModalStatus(col.status)}
                      className="w-6 h-6 rounded-md flex items-center justify-center text-[15px] leading-none transition shrink-0"
                      style={{ color: "var(--text-dim)" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "#fff" }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-dim)" }}>
                      +
                    </button>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto px-1.5 pb-2 flex flex-col gap-2">
                    {colTasks.length === 0 && (
                      <div className="text-[11px] text-center py-5 px-3 rounded-lg border border-dashed"
                        style={{ color: "var(--text-dimmer)", borderColor: "var(--border)" }}>
                        {col.desc}
                      </div>
                    )}
                    {colTasks.map(task => (
                      <TaskCard key={task.id} task={task} member={memberById(task.assignee)}
                        onDragStart={() => (dragId.current = task.id)}
                        onMove={s => moveTask(task.id, s)}
                        onToggleBlocked={() => toggleBlocked(task.id)}
                        onDelete={() => deleteTask(task.id)} />
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        </div>
        {activityOpen && <ActivityPanel activity={activity} onClose={() => setActivityOpen(false)} />}
      </div>

      {modalStatus && (
        <CreateTaskModal status={modalStatus}
          defaultAssignee={user?.id ?? members[0]?.id ?? ""}
          onClose={() => setModalStatus(null)}
          onCreate={d => { createTask(d); setModalStatus(null) }} />
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
// GESTIÓN VIEW — Node Graph with 10 features
// ══════════════════════════════════════════════════════════════════
function GestionView() {
  const { members, tasks, allRoles, addMenuOpen, addSelectedUser, roleMenuFor, createRoleOpen,
    setAddMenuOpen, setAddSelectedUser, setRoleMenuFor, setCreateRoleOpen,
    addMember, removeMember, setRole, addCustomRole, addToast } = useWF()

  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize]   = useState({ w: 800, h: 500 })
  const [hovered, setHovered]       = useState<string | null>(null)
  const [heatmapMode, setHeatmapMode] = useState(false)
  const [simDeparture, setSimDeparture] = useState<string | null>(null)
  const [pitchMode, setPitchMode]   = useState(false)
  const [metricsOpen, setMetricsOpen] = useState(false)
  const [timelineSlider, setTimelineSlider] = useState(1)
  const [lassoSelected, setLassoSelected] = useState(new Set<string>())
  const [lasso, setLasso] = useState<{x1:number;y1:number;x2:number;y2:number}|null>(null)
  const lassoStart = useRef<{x:number;y:number}|null>(null)
  const [ctxMenu, setCtxMenu] = useState<{memberId:string;x:number;y:number}|null>(null)
  const [showAddMS, setShowAddMS]   = useState(false)
  const [milestones, setMilestones] = useState<Milestone[]>(() => {
    try { return JSON.parse(localStorage.getItem(MILESTONES_KEY) ?? "[]") } catch { return [] }
  })
  const prevIds = useRef(new Set<string>())
  const [newIds, setNewIds] = useState(new Set<string>())

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect
      setSize({ w: width, h: height })
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const cur = new Set(members.map(m => m.id))
    const added = members.filter(m => !prevIds.current.has(m.id))
    if (added.length > 0) {
      setNewIds(new Set(added.map(m => m.id)))
      const t = setTimeout(() => setNewIds(new Set()), 700)
      prevIds.current = cur
      return () => clearTimeout(t)
    }
    prevIds.current = cur
  }, [members])

  // Timeline: filter members by join date
  const joinTimes = members.map(m => new Date(m.joinedAt).getTime())
  const minTime = joinTimes.length > 0 ? Math.min(...joinTimes) : Date.now() - 30 * 86400000
  const maxTime = Date.now()
  const cutoff  = minTime + (maxTime - minTime) * timelineSlider
  const visibleMembers = members.filter(m => new Date(m.joinedAt).getTime() <= cutoff)

  const cx = size.w / 2, cy = size.h / 2
  const r1 = Math.min(size.w, size.h) * 0.28
  const r2 = Math.min(size.w, size.h) * 0.44

  const memberPositions = useMemo(() => visibleMembers.map((m, i) => {
    const angle = (2 * Math.PI * i) / Math.max(1, visibleMembers.length) - Math.PI / 2
    return { id: m.id, x: cx + r1 * Math.cos(angle), y: cy + r1 * Math.sin(angle) }
  }), [visibleMembers, cx, cy, r1])

  const msPositions = useMemo(() => milestones.map((ms, i) => {
    const angle = (2 * Math.PI * i) / Math.max(1, milestones.length) - Math.PI / 6
    return { id: ms.id, x: cx + r2 * Math.cos(angle), y: cy + r2 * Math.sin(angle) }
  }), [milestones, cx, cy, r2])

  // Feature 1: Heatmap color
  const nodeColor = (memberId: string) => {
    if (heatmapMode) {
      const count = tasks.filter(t => t.assignee === memberId).length
      return heatColor(count)
    }
    return getRoleColor(allRoles, members.find(m => m.id === memberId)?.role ?? "Sin rol")
  }

  // Feature 8: Skill gap
  const currentRoles = new Set(visibleMembers.map(m => m.role))
  const missingRoles = CRITICAL_ROLES.filter(r => !currentRoles.has(r))

  // Hover data
  const hoveredMember = members.find(m => m.id === hovered)
  const hoveredPos    = memberPositions.find(n => n.id === hovered)
  const hoveredTasks  = hovered ? tasks.filter(t => t.assignee === hovered) : []

  // Lasso handlers
  const onContainerMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as Element).closest("[data-node]")) return
    if (e.button !== 0) return
    const rect = containerRef.current!.getBoundingClientRect()
    const x = e.clientX - rect.left, y = e.clientY - rect.top
    lassoStart.current = { x, y }
    setLasso({ x1: x, y1: y, x2: x, y2: y })
    setLassoSelected(new Set())
    setCtxMenu(null)
  }
  const onContainerMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!lassoStart.current) return
    const rect = containerRef.current!.getBoundingClientRect()
    setLasso({ x1: lassoStart.current.x, y1: lassoStart.current.y, x2: e.clientX - rect.left, y2: e.clientY - rect.top })
  }
  const onContainerMouseUp = () => {
    if (!lasso) { lassoStart.current = null; return }
    const lx1 = Math.min(lasso.x1, lasso.x2), lx2 = Math.max(lasso.x1, lasso.x2)
    const ly1 = Math.min(lasso.y1, lasso.y2), ly2 = Math.max(lasso.y1, lasso.y2)
    const inRect = memberPositions.filter(n => n.x >= lx1 && n.x <= lx2 && n.y >= ly1 && n.y <= ly2)
    if (inRect.length > 0) setLassoSelected(new Set(inRect.map(n => n.id)))
    setLasso(null)
    lassoStart.current = null
  }

  const addMilestone = (label: string, color: string) => {
    const ms: Milestone = { id: crypto.randomUUID(), label, color }
    const updated = [...milestones, ms]
    setMilestones(updated)
    localStorage.setItem(MILESTONES_KEY, JSON.stringify(updated))
    setShowAddMS(false)
  }
  const removeMilestone = (id: string) => {
    const updated = milestones.filter(m => m.id !== id)
    setMilestones(updated)
    localStorage.setItem(MILESTONES_KEY, JSON.stringify(updated))
  }

  const handleBulkRole = async (role: string) => {
    for (const id of Array.from(lassoSelected)) await setRole(id, role)
    setLassoSelected(new Set())
  }

  const graphContent = (fullscreen = false) => {
    const w = fullscreen ? window.innerWidth  : size.w
    const h = fullscreen ? window.innerHeight : size.h
    const fcx = w / 2, fcy = h / 2
    const fr1 = Math.min(w, h) * 0.28
    const fr2 = Math.min(w, h) * 0.44
    const fMemberPos = visibleMembers.map((m, i) => {
      const angle = (2 * Math.PI * i) / Math.max(1, visibleMembers.length) - Math.PI / 2
      return { id: m.id, x: fcx + fr1 * Math.cos(angle), y: fcy + fr1 * Math.sin(angle) }
    })
    const fMsPos = milestones.map((ms, i) => {
      const angle = (2 * Math.PI * i) / Math.max(1, milestones.length) - Math.PI / 6
      return { id: ms.id, x: fcx + fr2 * Math.cos(angle), y: fcy + fr2 * Math.sin(angle) }
    })

    return (
      <>
        <style>{`
          @keyframes wf-float{0%,100%{transform:translate(-50%,-50%) translateY(0px)}50%{transform:translate(-50%,-50%) translateY(-5px)}}
          @keyframes wf-pop{0%{transform:translate(-50%,-50%) scale(0);opacity:0}65%{transform:translate(-50%,-50%) scale(1.2);opacity:1}100%{transform:translate(-50%,-50%) scale(1);opacity:1}}
          @keyframes wf-pulse{0%,100%{box-shadow:0 0 0 0 rgba(94,106,210,0.3),0 0 0 0 rgba(94,106,210,0.1)}50%{box-shadow:0 0 0 12px rgba(94,106,210,0.07),0 0 0 24px rgba(94,106,210,0.02)}}
          @keyframes wf-depart{to{opacity:0.2;filter:grayscale(1)}}
          @keyframes wf-diamond-pulse{0%,100%{opacity:0.7}50%{opacity:1}}
        `}</style>

        {/* SVG lines */}
        <svg className="absolute inset-0 pointer-events-none" width={w} height={h}>
          <defs>
            <filter id="wf-glow"><feGaussianBlur stdDeviation="2.5" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <filter id="wf-glow-red"><feGaussianBlur stdDeviation="3" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>

          {/* Center to milestones */}
          {fMsPos.map(({ id, x, y }) => {
            const ms = milestones.find(m => m.id === id)!
            return <line key={`c-ms-${id}`} x1={fcx} y1={fcy} x2={x} y2={y}
              stroke={ms.color} strokeWidth={0.5} strokeOpacity={0.25} strokeDasharray="3 4" />
          })}

          {/* Center to members */}
          {fMemberPos.map(({ id, x, y }) => {
            const isHov = hovered === id
            const isDep = simDeparture === id
            const color = nodeColor(id)
            const isOrphan = isDep ? false : simDeparture !== null && tasks.filter(t => t.assignee === id).length > 0
            const lineColor = isDep ? "rgba(235,87,87,0.7)" : isOrphan ? "rgba(235,87,87,0.5)" : isHov ? color : "rgba(255,255,255,0.07)"
            return (
              <line key={`c-${id}`} x1={fcx} y1={fcy} x2={x} y2={y}
                stroke={lineColor} strokeWidth={isHov || isDep ? 1.5 : 0.7}
                filter={(isHov || isDep) ? "url(#wf-glow)" : undefined}
                style={{ transition: "stroke 0.3s,stroke-width 0.25s" }} />
            )
          })}

          {/* Cross-member connections (Feature 3) */}
          {fMemberPos.map((a, i) => fMemberPos.slice(i + 1).map(b => {
            const strength = crossStrength(a.id, b.id, tasks)
            const opacity  = Math.max(0.03, Math.min(0.22, 0.03 + strength * 0.06))
            const width    = 0.4 + Math.min(strength, 5) * 0.25
            return (
              <line key={`${a.id}-${b.id}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke="rgba(255,255,255,1)" strokeOpacity={opacity} strokeWidth={width}
                style={{ transition: "stroke-opacity 0.5s" }} />
            )
          }))}

          {/* Lasso rect */}
          {lasso && (
            <rect x={Math.min(lasso.x1, lasso.x2)} y={Math.min(lasso.y1, lasso.y2)}
              width={Math.abs(lasso.x2 - lasso.x1)} height={Math.abs(lasso.y2 - lasso.y1)}
              fill="rgba(94,106,210,0.07)" stroke="rgba(94,106,210,0.5)" strokeWidth={1} strokeDasharray="4 3" />
          )}

          {/* Milestone diamonds */}
          {fMsPos.map(({ id, x, y }) => {
            const ms = milestones.find(m => m.id === id)!
            const s = 10
            return (
              <g key={`ms-${id}`}>
                <polygon points={`${x},${y-s} ${x+s},${y} ${x},${y+s} ${x-s},${y}`}
                  fill={`${ms.color}22`} stroke={ms.color} strokeWidth={1.5}
                  style={{ animation: "wf-diamond-pulse 3s ease-in-out infinite" }} />
                <text x={x} y={y + s + 13} textAnchor="middle" fontSize={10} fill={ms.color} fontFamily="Inter,sans-serif" fontWeight={600}>
                  {ms.label}
                </text>
              </g>
            )
          })}
        </svg>

        {/* Center node */}
        <div className="absolute flex flex-col items-center justify-center z-10"
          style={{ left: fcx, top: fcy, transform: "translate(-50%,-50%)",
            width: 76, height: 76, borderRadius: "9999px",
            background: "linear-gradient(135deg,rgba(94,106,210,0.22),rgba(59,130,246,0.14))",
            border: "1.5px solid rgba(94,106,210,0.5)", animation: "wf-pulse 3s ease-in-out infinite" }}>
          <span className="text-[11px] font-semibold text-white text-center leading-tight px-2">Proyecto</span>
        </div>

        {/* Member nodes */}
        {fMemberPos.map(({ id, x, y }, idx) => {
          const m = members.find(x => x.id === id)!
          const color   = nodeColor(id)
          const isNew   = newIds.has(id)
          const isHov   = hovered === id
          const isDep   = simDeparture === id
          const isSel   = lassoSelected.has(id)
          const initial = m.nombre.trim()[0]?.toUpperCase() || "?"
          const mTasks  = tasks.filter(t => t.assignee === id)
          return (
            <div key={id} data-node className="absolute flex flex-col items-center gap-1 cursor-pointer z-20"
              style={{
                left: x, top: y,
                opacity: isDep ? 0.25 : 1,
                filter: isDep ? "grayscale(1)" : "none",
                transition: "opacity 0.5s, filter 0.5s",
                animation: isNew
                  ? "wf-pop 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards"
                  : `wf-float ${3.5 + idx * 0.4}s ease-in-out ${idx * 0.3}s infinite`,
              }}
              onMouseEnter={() => setHovered(id)}
              onMouseLeave={() => setHovered(null)}
              onContextMenu={e => { e.preventDefault(); setCtxMenu({ memberId: id, x: e.clientX, y: e.clientY }) }}>
              {m.avatar ? (
                <img src={m.avatar} alt={m.nombre} referrerPolicy="no-referrer" className="object-cover"
                  style={{ width: 48, height: 48, borderRadius: "9999px",
                    border: `2px solid ${isSel ? "#5e6ad2" : isHov ? color : color + "60"}`,
                    boxShadow: isSel ? `0 0 0 3px rgba(94,106,210,0.4),0 0 18px ${color}50` : isHov ? `0 0 18px ${color}50` : "none",
                    transition: "border-color 0.25s,box-shadow 0.25s", transform: "translate(-50%,-50%)" }} />
              ) : (
                <div className="flex items-center justify-center font-semibold text-white"
                  style={{ width: 48, height: 48, fontSize: 18, borderRadius: "9999px",
                    background: `linear-gradient(135deg,${color},${color}99)`,
                    border: `2px solid ${isSel ? "#5e6ad2" : isHov ? color : color + "55"}`,
                    boxShadow: isSel ? `0 0 0 3px rgba(94,106,210,0.4),0 0 18px ${color}50` : isHov ? `0 0 18px ${color}50` : "none",
                    transition: "border-color 0.25s,box-shadow 0.25s", transform: "translate(-50%,-50%)" }}>
                  {initial}
                </div>
              )}
              <div className="flex flex-col items-center gap-0.5" style={{ transform: "translateX(-50%) translateY(14px)" }}>
                <span className="text-[12px] font-medium text-white whitespace-nowrap" style={{ textShadow: "0 1px 6px rgba(0,0,0,0.9)" }}>
                  {m.nombre.split(" ")[0]}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-md whitespace-nowrap"
                  style={{ background: `${color}22`, color, border: `1px solid ${color}44`, textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>
                  {heatmapMode ? `${mTasks.length} tareas` : m.role}
                </span>
              </div>
            </div>
          )
        })}

        {/* Glassmorphism hover tooltip (Feature 7) */}
        {hovered && hoveredMember && hoveredPos && (
          <div className="absolute pointer-events-none z-40 rounded-xl p-3.5 w-56"
            style={{
              left: Math.min(Math.max(8, hoveredPos.x + (hoveredPos.x > fcx ? 60 : -228)), w - 228),
              top:  Math.max(8, Math.min(hoveredPos.y - 80, h - 200)),
              background: "rgba(13,14,16,0.92)", backdropFilter: "blur(16px)",
              border: `1px solid ${nodeColor(hovered)}44`,
              boxShadow: `0 12px 40px rgba(0,0,0,0.7),0 0 0 1px ${nodeColor(hovered)}18`,
            }}>
            <div className="flex items-center gap-2.5 mb-2.5">
              <MemberAvatar member={hoveredMember} size={32} />
              <div>
                <p className="text-[13px] font-semibold text-white leading-tight">{hoveredMember.nombre}</p>
                <RoleTag role={hoveredMember.role} color={getRoleColor(allRoles, hoveredMember.role)} small />
              </div>
            </div>
            <div className="flex items-center gap-3 mb-2.5 text-[11px]" style={{ color: "var(--text-dimmer)" }}>
              <span>📅 Unido {fmtDate(hoveredMember.joinedAt)}</span>
            </div>
            <div className="flex gap-3 mb-2 text-[11px]">
              <div className="text-center">
                <div className="text-[15px] font-bold text-white">{hoveredTasks.length}</div>
                <div style={{ color: "var(--text-dimmer)" }}>tareas</div>
              </div>
              <div className="text-center">
                <div className="text-[15px] font-bold text-white">{hoveredTasks.filter(t => t.status === "done").length}</div>
                <div style={{ color: "var(--text-dimmer)" }}>hechas</div>
              </div>
              <div className="text-center">
                <div className="text-[15px] font-bold" style={{ color: "#f2994a" }}>{hoveredTasks.filter(t => t.blocked).length}</div>
                <div style={{ color: "var(--text-dimmer)" }}>bloq.</div>
              </div>
            </div>
            {hoveredTasks.length > 0 && (
              <div className="flex flex-col gap-1">
                {hoveredTasks.slice(0, 3).map(t => (
                  <div key={t.id} className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: PRIORITY_COLOR[t.priority] }} />
                    <span className="text-[11px] truncate" style={{ color: "var(--text-dim)" }}>{t.title}</span>
                  </div>
                ))}
                {hoveredTasks.length > 3 && <span className="text-[10px]" style={{ color: "var(--text-dimmer)" }}>+{hoveredTasks.length - 3} más</span>}
              </div>
            )}
          </div>
        )}
      </>
    )
  }

  // Metrics computed (Feature 5)
  const doneTasks    = tasks.filter(t => t.status === "done").length
  const blockedTasks = tasks.filter(t => t.blocked).length
  const velocity     = tasks.length > 0 ? Math.round((doneTasks / tasks.length) * 100) : 0
  const blockedRatio = tasks.length > 0 ? Math.round((blockedTasks / tasks.length) * 100) : 0
  const uniqueRoles  = new Set(members.map(m => m.role)).size
  const roleBalance  = members.length > 0 ? Math.round((uniqueRoles / members.length) * 100) : 0

  const sliderLabel = () => {
    if (timelineSlider >= 0.999) return "Ahora"
    return new Date(cutoff).toLocaleDateString("es-ES", { month: "short", year: "numeric" })
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Controls bar */}
      <div className="shrink-0 px-5 md:px-6 py-2.5 flex items-center gap-2 flex-wrap"
        style={{ borderBottom: "1px solid var(--border)" }}>
        <span className="text-[11px] font-medium uppercase tracking-wider mr-1" style={{ color: "var(--text-dimmer)" }}>Equipo</span>
        {members.map(m => (
          <RoleChip key={m.id} member={m} open={roleMenuFor === m.id}
            onToggle={() => setRoleMenuFor(roleMenuFor === m.id ? null : m.id)}
            onPick={r => setRole(m.id, r)} onClose={() => setRoleMenuFor(null)} onRemove={() => removeMember(m.id)} />
        ))}
        <AddMemberButton open={addMenuOpen}
          onToggle={() => { setAddMenuOpen(!addMenuOpen); setAddSelectedUser(null) }}
          onClose={() => { setAddMenuOpen(false); setAddSelectedUser(null) }}
          selectedUser={addSelectedUser} onSelectUser={setAddSelectedUser}
          onBack={() => setAddSelectedUser(null)} onAdd={addMember} />
        <CreateRoleButton open={createRoleOpen} onToggle={() => setCreateRoleOpen(!createRoleOpen)}
          onClose={() => setCreateRoleOpen(false)} onSave={addCustomRole} />

        <div className="ml-auto flex items-center gap-1.5 flex-wrap">
          {/* Feature 1: Heatmap */}
          <GBtn active={heatmapMode} onClick={() => setHeatmapMode(!heatmapMode)}
            title="Capa de calor de carga">🌡 Heatmap</GBtn>
          {/* Feature 5: Metrics */}
          <GBtn active={metricsOpen} onClick={() => setMetricsOpen(!metricsOpen)}>📊 Métricas</GBtn>
          {/* Feature 4: Milestones */}
          <GBtn onClick={() => setShowAddMS(true)}>🏁 Hito</GBtn>
          {/* Feature 10: Pitch mode */}
          <GBtn onClick={() => setPitchMode(true)} title="Modo presentación">▶ Pitch</GBtn>
        </div>
      </div>

      {/* Skill gap alert (Feature 8) */}
      {missingRoles.length > 0 && members.length > 0 && (
        <div className="shrink-0 mx-5 mt-2.5 px-3 py-2 rounded-lg flex items-center gap-2.5"
          style={{ background: "rgba(242,153,74,0.09)", border: "1px solid rgba(242,153,74,0.28)" }}>
          <span className="text-[13px]">⚠️</span>
          <span className="text-[12px]" style={{ color: "#f2994a" }}>
            <strong>Perfiles faltantes en el equipo:</strong> {missingRoles.join(", ")}
          </span>
        </div>
      )}

      {/* Main area: graph + optional metrics panel */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Graph */}
        <div ref={containerRef} className="flex-1 min-h-0 relative overflow-hidden select-none"
          style={{ background: "radial-gradient(ellipse 60% 50% at 50% 50%,rgba(94,106,210,0.05) 0%,transparent 70%)", cursor: lassoStart.current ? "crosshair" : "default" }}
          onMouseDown={onContainerMouseDown}
          onMouseMove={onContainerMouseMove}
          onMouseUp={onContainerMouseUp}>

          {members.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ background: "rgba(94,106,210,0.1)", border: "1px dashed rgba(94,106,210,0.35)" }}>
                <span style={{ fontSize: 26 }}>🌐</span>
              </div>
              <p className="text-[14px] font-medium text-white">Mapa vacío</p>
              <p className="text-[12px]" style={{ color: "var(--text-dim)" }}>Añade miembros al equipo para ver el grafo de conexiones.</p>
            </div>
          ) : graphContent()}

          {/* Context menu (Feature 2) */}
          {ctxMenu && (
            <CtxMenuPanel x={ctxMenu.x} y={ctxMenu.y} memberId={ctxMenu.memberId}
              simDeparture={simDeparture}
              onSimulate={() => { setSimDeparture(simDeparture === ctxMenu.memberId ? null : ctxMenu.memberId); setCtxMenu(null) }}
              onRemove={() => { removeMember(ctxMenu.memberId); setCtxMenu(null) }}
              onClose={() => setCtxMenu(null)} />
          )}
        </div>

        {/* Metrics panel (Feature 5) */}
        {metricsOpen && (
          <div className="shrink-0 w-60 flex flex-col border-l" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
            <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
              <span className="text-[12px] font-semibold text-white">Radar de rendimiento</span>
              <button onClick={() => setMetricsOpen(false)} className="text-[12px] transition" style={{ color: "var(--text-dim)" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#fff")} onMouseLeave={e => (e.currentTarget.style.color = "var(--text-dim)")}>✕</button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
              <MetricBar label="Velocidad de cierre" value={velocity} color="#22c55e" desc={`${doneTasks}/${tasks.length} tareas completas`} />
              <MetricBar label="Ratio de bloqueos" value={blockedRatio} color="#f2994a" desc={`${blockedTasks} bloqueadas`} invert />
              <MetricBar label="Equilibrio de roles" value={roleBalance} color="#5e6ad2" desc={`${uniqueRoles} roles / ${members.length} miembros`} />
              <div className="mt-2 p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                <p className="text-[11px] font-medium text-white mb-2">Distribución de carga</p>
                {members.map(m => {
                  const count = tasks.filter(t => t.assignee === m.id).length
                  const pct   = tasks.length > 0 ? (count / tasks.length) * 100 : 0
                  const col   = heatColor(count)
                  return (
                    <div key={m.id} className="mb-1.5">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[10px]" style={{ color: "var(--text-dim)" }}>{m.nombre.split(" ")[0]}</span>
                        <span className="text-[10px] font-medium" style={{ color: col }}>{count}</span>
                      </div>
                      <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: col }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Timeline slider (Feature 6) */}
      {members.length > 0 && (
        <div className="shrink-0 px-6 py-3 flex items-center gap-3" style={{ borderTop: "1px solid var(--border)" }}>
          <span className="text-[10px] uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text-dimmer)" }}>Línea de tiempo</span>
          <span className="text-[10px] whitespace-nowrap" style={{ color: "var(--text-dim)" }}>{fmtDate(new Date(minTime).toISOString())}</span>
          <input type="range" min={0} max={1} step={0.001} value={timelineSlider}
            onChange={e => setTimelineSlider(parseFloat(e.target.value))}
            className="flex-1 accent-[#5e6ad2]" style={{ height: 4 }} />
          <span className="text-[10px] whitespace-nowrap min-w-[44px] text-right" style={{ color: timelineSlider >= 0.999 ? "#5e6ad2" : "var(--text-dim)" }}>
            {sliderLabel()}
          </span>
          {timelineSlider < 0.999 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap"
              style={{ background: "rgba(94,106,210,0.14)", color: "#aab2f0", border: "1px solid rgba(94,106,210,0.35)" }}>
              {visibleMembers.length}/{members.length}
            </span>
          )}
        </div>
      )}

      {/* Bulk action bar (Feature 9) */}
      {lassoSelected.size > 0 && (
        <div className="shrink-0 px-5 py-2.5 flex items-center gap-3 flex-wrap" style={{ borderTop: "1px solid var(--border)", background: "rgba(94,106,210,0.06)" }}>
          <span className="text-[12px] font-medium" style={{ color: "#aab2f0" }}>
            {lassoSelected.size} miembro{lassoSelected.size !== 1 ? "s" : ""} seleccionado{lassoSelected.size !== 1 ? "s" : ""}
          </span>
          <span className="text-[11px]" style={{ color: "var(--text-dimmer)" }}>Asignar rol:</span>
          <select onChange={e => e.target.value && handleBulkRole(e.target.value)} defaultValue=""
            className="field-input px-2 py-1 rounded-md text-[12px]">
            <option value="" disabled>Seleccionar rol…</option>
            {allRoles.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
          </select>
          <button onClick={() => setLassoSelected(new Set())}
            className="px-2.5 py-1 rounded-md text-[12px] transition" style={{ color: "var(--text-dim)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#fff")} onMouseLeave={e => (e.currentTarget.style.color = "var(--text-dim)")}>
            Deseleccionar
          </button>
        </div>
      )}

      {/* Simulation banner (Feature 2) */}
      {simDeparture && (
        <div className="shrink-0 px-5 py-2 flex items-center gap-3 flex-wrap" style={{ borderTop: "1px solid rgba(235,87,87,0.3)", background: "rgba(235,87,87,0.06)" }}>
          <span className="text-[12px]" style={{ color: "#eb5757" }}>
            ⚡ Simulación de baja: <strong>{members.find(m => m.id === simDeparture)?.nombre ?? "Miembro"}</strong>.
            Las tareas de este miembro quedarían sin responsable.
          </span>
          <button onClick={() => setSimDeparture(null)}
            className="ml-auto px-2.5 py-1 rounded-md text-[12px] font-medium transition"
            style={{ background: "rgba(235,87,87,0.15)", border: "1px solid rgba(235,87,87,0.35)", color: "#eb5757" }}>
            Finalizar simulación
          </button>
        </div>
      )}

      {/* Add milestone modal (Feature 4) */}
      {showAddMS && <MilestoneModal onSave={addMilestone} onClose={() => setShowAddMS(false)} />}

      {/* Pitch mode (Feature 10) */}
      {pitchMode && (
        <div className="fixed inset-0 z-[9999] overflow-hidden select-none"
          style={{ background: "radial-gradient(ellipse 70% 60% at 50% 50%,rgba(94,106,210,0.08) 0%,#0c0d0e 70%)" }}>
          <button onClick={() => setPitchMode(false)}
            className="absolute top-5 right-5 z-10 px-3 py-1.5 rounded-lg text-[12px] font-medium transition"
            style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-dim)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#fff")} onMouseLeave={e => (e.currentTarget.style.color = "var(--text-dim)")}>
            ✕ Salir
          </button>
          <div className="absolute top-5 left-5 text-[11px] uppercase tracking-widest font-semibold" style={{ color: "rgba(94,106,210,0.7)" }}>
            Flujo de trabajo · Presentación
          </div>
          <div className="w-full h-full relative">
            {graphContent(true)}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Metric bar helper ──
function MetricBar({ label, value, color, desc, invert = false }: {
  label: string; value: number; color: string; desc: string; invert?: boolean
}) {
  const display = invert ? Math.max(0, 100 - value) : value
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-medium text-white">{label}</span>
        <span className="text-[12px] font-bold" style={{ color }}>{value}%</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden mb-1" style={{ background: "rgba(255,255,255,0.05)" }}>
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${display}%`, background: color }} />
      </div>
      <p className="text-[10px]" style={{ color: "var(--text-dimmer)" }}>{desc}</p>
    </div>
  )
}

// ── Gestión button ──
function GBtn({ children, onClick, active = false, title }: {
  children: React.ReactNode; onClick: () => void; active?: boolean; title?: string
}) {
  return (
    <button onClick={onClick} title={title}
      className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition"
      style={{
        background: active ? "rgba(94,106,210,0.14)" : "var(--surface)",
        border: active ? "1px solid rgba(94,106,210,0.45)" : "1px solid var(--border)",
        color: active ? "#aab2f0" : "var(--text-dim)",
      }}
      onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
      onMouseLeave={e => (e.currentTarget.style.color = active ? "#aab2f0" : "var(--text-dim)")}>
      {children}
    </button>
  )
}

// ── Context menu (right-click on node) ──
function CtxMenuPanel({ x, y, memberId, simDeparture, onSimulate, onRemove, onClose }: {
  x: number; y: number; memberId: string; simDeparture: string | null
  onSimulate: () => void; onRemove: () => void; onClose: () => void
}) {
  const ref = useOutsideClick<HTMLDivElement>(onClose)
  const { members } = useWF()
  const m = members.find(x => x.id === memberId)
  return (
    <div ref={ref} className="fixed z-50 w-52 rounded-lg p-1.5"
      style={{ top: y, left: x, background: "#17191b", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 12px 32px rgba(0,0,0,0.6)" }}>
      <p className="px-2 py-1.5 text-[11px] font-semibold text-white truncate">{m?.nombre ?? "Miembro"}</p>
      <div className="h-px my-1" style={{ background: "var(--border)" }} />
      <button onClick={onSimulate}
        className="w-full text-left px-2 py-1.5 rounded-md text-[12px] transition"
        style={{ color: simDeparture === memberId ? "#22c55e" : "#f2994a" }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
        {simDeparture === memberId ? "✓ Finalizar simulación" : "⚡ Simular baja"}
      </button>
      <div className="h-px my-1" style={{ background: "var(--border)" }} />
      <button onClick={onRemove}
        className="w-full text-left px-2 py-1.5 rounded-md text-[12px] transition"
        style={{ color: "rgba(235,87,87,0.8)" }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(235,87,87,0.08)")}
        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
        Quitar del equipo
      </button>
    </div>
  )
}

// ── Milestone modal (Feature 4) ──
function MilestoneModal({ onSave, onClose }: { onSave: (label: string, color: string) => void; onClose: () => void }) {
  const [label, setLabel] = useState("")
  const [color, setColor] = useState("#f59e0b")
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    document.addEventListener("keydown", h)
    return () => document.removeEventListener("keydown", h)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[20vh]"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)" }} onMouseDown={onClose}>
      <div className="w-72 rounded-xl p-4" onMouseDown={e => e.stopPropagation()}
        style={{ background: "var(--surface)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 24px 60px rgba(0,0,0,0.6)" }}>
        <h3 className="text-[14px] font-semibold text-white mb-3">Nuevo hito</h3>
        <input autoFocus value={label} onChange={e => setLabel(e.target.value)}
          onKeyDown={e => e.key === "Enter" && label.trim() && onSave(label.trim(), color)}
          placeholder="Nombre del hito…" className="field-input w-full px-3 py-2 rounded-md text-[13px] mb-3" />
        <div className="flex items-center gap-2 mb-4">
          <span className="text-[11px]" style={{ color: "var(--text-dim)" }}>Color</span>
          <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-7 h-7 rounded cursor-pointer bg-transparent border-0" />
          <span className="text-[11px] px-2 py-0.5 rounded-md font-medium"
            style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}>{label || "Vista previa"}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-1.5 rounded-md text-[12px] transition" style={{ color: "var(--text-dim)", border: "1px solid var(--border)" }}>Cancelar</button>
          <button onClick={() => label.trim() && onSave(label.trim(), color)} disabled={!label.trim()}
            className="flex-1 py-1.5 rounded-md text-[12px] font-semibold transition disabled:opacity-40"
            style={{ background: color, color: "#fff" }}>Crear hito</button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
// ALL ROLES MODAL — cuestionario + buscador lateral
// ══════════════════════════════════════════════════════════════════
function AllRolesModal({ onPick, onClose, currentRole = "" }: {
  onPick: (role: string) => void; onClose: () => void; currentRole?: string
}) {
  const [step, setStep] = useState<"q1" | "q2" | "result">("q1")
  const [area, setArea]   = useState("")
  const [level, setLevel] = useState("")
  const [search, setSearch]     = useState("")
  const [catFilter, setCatFilter] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    document.addEventListener("keydown", h)
    return () => document.removeEventListener("keydown", h)
  }, [onClose])

  useEffect(() => { if (step === "q1") inputRef.current?.focus() }, [step])

  const suggestions = area && level ? (ROLE_SUGGESTIONS[`${area}-${level}`] ?? []) : []
  const filteredRoles = ALL_ROLES_FLAT.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) &&
    (!catFilter || r.category === catFilter)
  )

  const handle = (role: string) => { onPick(role); onClose() }

  return (
    <div className="fixed inset-0 z-[9990] flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)" }}
      onMouseDown={onClose}>
      <div className="w-full max-w-2xl flex rounded-2xl overflow-hidden"
        style={{ background: "#131416", border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.85)", maxHeight: "82vh",
          animation: "modal-pop 0.28s cubic-bezier(0.34,1.2,0.64,1) both" }}
        onMouseDown={e => e.stopPropagation()}>

        {/* ── LEFT: Cuestionario ── */}
        <div className="flex-1 flex flex-col p-5 min-w-0 overflow-hidden">
          <div className="flex items-center justify-between mb-4 shrink-0">
            <div>
              <h2 className="text-[16px] font-semibold text-white">Encuentra tu rol</h2>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--text-dimmer)" }}>Responde 2 preguntas y te recomendamos el perfil ideal.</p>
            </div>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-[13px] transition shrink-0"
              style={{ color: "var(--text-dim)" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#fff")} onMouseLeave={e => (e.currentTarget.style.color = "var(--text-dim)")}>✕</button>
          </div>

          {/* Step indicator */}
          <div className="flex gap-1.5 mb-4 shrink-0">
            {(["q1","q2","result"] as const).map((s, i) => (
              <div key={s} className="flex-1 h-0.5 rounded-full transition-all duration-400"
                style={{ background: s === step || (step === "result" && i <= 2) ? "#5e6ad2" : "rgba(255,255,255,0.1)" }} />
            ))}
          </div>

          {/* Q1 */}
          {step === "q1" && (
            <div className="flex flex-col gap-2 flex-1">
              <p className="text-[14px] font-medium text-white mb-1">¿Cuál describe mejor lo que haces?</p>
              {QUIZ_AREAS.map(opt => (
                <button key={opt.value} onClick={() => { setArea(opt.value); setStep("q2") }}
                  className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left transition group"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(94,106,210,0.1)"; e.currentTarget.style.borderColor = "rgba(94,106,210,0.35)" }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = "var(--border)" }}>
                  <span style={{ fontSize: 20 }}>{opt.emoji}</span>
                  <span className="text-[13px] text-white">{opt.label}</span>
                  <span className="ml-auto text-[12px] opacity-0 group-hover:opacity-100 transition" style={{ color: "#5e6ad2" }}>→</span>
                </button>
              ))}
            </div>
          )}

          {/* Q2 */}
          {step === "q2" && (
            <div className="flex flex-col gap-2 flex-1">
              <button onClick={() => setStep("q1")} className="flex items-center gap-1.5 mb-2 text-[11px] transition w-fit"
                style={{ color: "var(--text-dim)" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#fff")} onMouseLeave={e => (e.currentTarget.style.color = "var(--text-dim)")}>
                ← Volver
              </button>
              <p className="text-[14px] font-medium text-white mb-1">¿Cuál es tu nivel de experiencia?</p>
              {QUIZ_LEVELS.map(opt => (
                <button key={opt.value} onClick={() => { setLevel(opt.value); setStep("result") }}
                  className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left transition group"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(94,106,210,0.1)"; e.currentTarget.style.borderColor = "rgba(94,106,210,0.35)" }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = "var(--border)" }}>
                  <span style={{ fontSize: 20 }}>{opt.emoji}</span>
                  <span className="text-[13px] text-white">{opt.label}</span>
                  <span className="ml-auto text-[12px] opacity-0 group-hover:opacity-100 transition" style={{ color: "#5e6ad2" }}>→</span>
                </button>
              ))}
            </div>
          )}

          {/* Result */}
          {step === "result" && (
            <div className="flex flex-col flex-1">
              <button onClick={() => setStep("q2")} className="flex items-center gap-1.5 mb-3 text-[11px] transition w-fit"
                style={{ color: "var(--text-dim)" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#fff")} onMouseLeave={e => (e.currentTarget.style.color = "var(--text-dim)")}>
                ← Volver
              </button>
              <p className="text-[11px] uppercase tracking-wider mb-2.5" style={{ color: "var(--text-dimmer)" }}>✨ Roles recomendados para ti</p>
              <div className="flex flex-col gap-2">
                {suggestions.map((name, i) => {
                  const r = ALL_ROLES_FLAT.find(x => x.name === name)
                  const isCurrent = name === currentRole
                  return (
                    <button key={name} onClick={() => handle(name)}
                      className="flex items-center gap-3 px-3.5 py-3 rounded-xl text-left transition group"
                      style={{ background: isCurrent ? `${r?.color ?? "#5e6ad2"}14` : "rgba(255,255,255,0.03)", border: `1px solid ${isCurrent ? (r?.color ?? "#5e6ad2") + "40" : "var(--border)"}`, animationDelay: `${i * 60}ms` }}
                      onMouseEnter={e => { e.currentTarget.style.background = `${r?.color ?? "#5e6ad2"}14`; e.currentTarget.style.borderColor = `${r?.color ?? "#5e6ad2"}40` }}
                      onMouseLeave={e => { e.currentTarget.style.background = isCurrent ? `${r?.color ?? "#5e6ad2"}14` : "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = isCurrent ? `${r?.color ?? "#5e6ad2"}40` : "var(--border)" }}>
                      <span className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold text-white"
                        style={{ background: r?.color ?? "#5e6ad2" }}>{i + 1}</span>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-white">{name}</p>
                        <p className="text-[10px]" style={{ color: "var(--text-dimmer)" }}>{r?.category}</p>
                      </div>
                      <span className="ml-auto text-[11px] font-medium opacity-0 group-hover:opacity-100 transition px-2 py-0.5 rounded-md"
                        style={{ background: `${r?.color ?? "#5e6ad2"}22`, color: r?.color ?? "#5e6ad2" }}>
                        {isCurrent ? "✓ Actual" : "Seleccionar"}
                      </span>
                    </button>
                  )
                })}
              </div>
              <button onClick={() => { setStep("q1"); setArea(""); setLevel("") }}
                className="mt-4 text-[11px] transition self-start"
                style={{ color: "var(--text-dimmer)" }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--text-dim)")} onMouseLeave={e => (e.currentTarget.style.color = "var(--text-dimmer)")}>
                ↺ Repetir cuestionario
              </button>
            </div>
          )}
        </div>

        {/* ── RIGHT: Buscador lateral ── */}
        <div className="w-60 shrink-0 flex flex-col border-l" style={{ borderColor: "var(--border)", background: "rgba(255,255,255,0.015)" }}>
          <div className="p-3 shrink-0">
            <input ref={inputRef} value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar entre todos los roles…"
              className="field-input w-full px-2.5 py-1.5 rounded-md text-[12px]" />
          </div>
          {/* Category chips */}
          <div className="flex flex-wrap gap-1 px-3 pb-2.5 shrink-0">
            <button onClick={() => setCatFilter(null)}
              className="text-[10px] px-2 py-0.5 rounded-full transition"
              style={{ background: !catFilter ? "rgba(255,255,255,0.1)" : "transparent", color: !catFilter ? "#fff" : "var(--text-dimmer)", border: "1px solid var(--border)" }}>
              Todos
            </button>
            {ROLE_CATEGORIES.map(c => (
              <button key={c.label} onClick={() => setCatFilter(catFilter === c.label ? null : c.label)}
                className="text-[10px] px-2 py-0.5 rounded-full transition"
                style={{ background: catFilter === c.label ? `${c.color}22` : "transparent", color: catFilter === c.label ? c.color : "var(--text-dimmer)", border: `1px solid ${catFilter === c.label ? c.color + "44" : "var(--border)"}` }}>
                {c.emoji} {c.label}
              </button>
            ))}
          </div>
          <div className="text-[10px] px-3 pb-1.5 shrink-0" style={{ color: "var(--text-dimmer)" }}>
            {filteredRoles.length} rol{filteredRoles.length !== 1 ? "es" : ""}
          </div>
          {/* Role list */}
          <div className="flex-1 overflow-y-auto">
            {ROLE_CATEGORIES.filter(c => !catFilter || c.label === catFilter).map(cat => {
              const roles = cat.roles.filter(r => r.toLowerCase().includes(search.toLowerCase()))
              if (roles.length === 0) return null
              return (
                <div key={cat.label}>
                  {!catFilter && (
                    <div className="px-3 py-1.5 flex items-center gap-1.5 sticky top-0" style={{ background: "#131416" }}>
                      <span style={{ fontSize: 11 }}>{cat.emoji}</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: cat.color }}>{cat.label}</span>
                    </div>
                  )}
                  {roles.map(name => {
                    const isCurrent = name === currentRole
                    return (
                      <button key={name} onClick={() => handle(name)}
                        className="w-full text-left px-3 py-1.5 flex items-center justify-between gap-2 transition group"
                        style={{ background: isCurrent ? `${cat.color}10` : "transparent" }}
                        onMouseEnter={e => (e.currentTarget.style.background = `${cat.color}10`)}
                        onMouseLeave={e => (e.currentTarget.style.background = isCurrent ? `${cat.color}10` : "transparent")}>
                        <span className="text-[12px] text-white truncate">{name}</span>
                        {isCurrent
                          ? <span className="text-[10px] shrink-0" style={{ color: cat.color }}>✓</span>
                          : <span className="text-[10px] shrink-0 opacity-0 group-hover:opacity-100 transition" style={{ color: "var(--text-dimmer)" }}>→</span>
                        }
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Mini role picker para AddMemberButton ──
function AddMemberRolePicker({ userName, onBack, onPick }: {
  userName: string; onBack: () => void; onPick: (role: string) => void
}) {
  const [search, setSearch] = useState("")
  const [showAll, setShowAll] = useState(false)

  return (
    <>
      <div className="flex items-center gap-2 px-2 py-1.5">
        <button onClick={onBack} className="text-[11px] transition" style={{ color: "var(--text-dim)" }}
          onMouseEnter={e => (e.currentTarget.style.color = "#fff")} onMouseLeave={e => (e.currentTarget.style.color = "var(--text-dim)")}>← Volver</button>
        <span className="text-[12px] font-medium text-white truncate">{userName}</span>
      </div>
      {/* Search */}
      <div className="px-2 pb-1.5">
        <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar rol…" className="field-input w-full px-2.5 py-1.5 rounded-md text-[12px]" />
      </div>
      {search ? (
        <div className="max-h-48 overflow-y-auto pb-1.5">
          {ALL_ROLES_FLAT.filter(r => r.name.toLowerCase().includes(search.toLowerCase())).slice(0, 10).map(r => (
            <button key={r.name} onClick={() => onPick(r.name)}
              className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-left transition"
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
              <span className="text-[12px] text-white">{r.name}</span>
              <span className="text-[10px] shrink-0" style={{ color: "var(--text-dimmer)" }}>{r.category}</span>
            </button>
          ))}
        </div>
      ) : (
        <>
          <p className="px-2.5 pt-0.5 pb-1 text-[10px] uppercase tracking-wider" style={{ color: "var(--text-dimmer)" }}>Roles principales</p>
          <div className="px-2 pb-2 flex flex-col gap-1">
            {MAIN_QUICK_ROLES.map(r => (
              <button key={r.name} onClick={() => onPick(r.name)}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}
                onMouseEnter={e => { e.currentTarget.style.background = `${r.color}14`; e.currentTarget.style.borderColor = `${r.color}40` }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = "var(--border)" }}>
                <span style={{ fontSize: 18 }}>{r.emoji}</span>
                <div><p className="text-[12px] font-semibold text-white">{r.name}</p><p className="text-[10px]" style={{ color: "var(--text-dimmer)" }}>{r.desc}</p></div>
              </button>
            ))}
          </div>
          <div className="border-t" style={{ borderColor: "var(--border)" }}>
            <button onClick={() => setShowAll(true)}
              className="w-full flex items-center justify-between px-3 py-2 text-[12px] font-medium transition"
              style={{ color: "#aab2f0" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(94,106,210,0.08)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
              Ver todos los roles (+{ALL_ROLES_FLAT.length}) <span>→</span>
            </button>
          </div>
        </>
      )}
      {showAll && <AllRolesModal onPick={onPick} onClose={() => setShowAll(false)} />}
    </>
  )
}

// ══════════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ══════════════════════════════════════════════════════════════════
function RoleChip({ member, open, onToggle, onPick, onClose, onRemove }: {
  member: Member; open: boolean
  onToggle: () => void; onPick: (r: string) => void; onClose: () => void; onRemove: () => void
}) {
  const { allRoles } = useWF()
  const ref = useOutsideClick<HTMLDivElement>(onClose)
  const [search, setSearch] = useState("")
  const [showAll, setShowAll] = useState(false)
  const color = getRoleColor(allRoles, member.role)

  const handlePick = (name: string) => { onPick(name); setSearch(""); setShowAll(false) }

  return (
    <div className="relative" ref={ref}>
      <button onClick={onToggle} className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full transition"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)")}
        onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}>
        <MemberAvatar member={member} size={22} />
        <span className="text-[12px] font-medium text-white">{member.nombre.split(" ")[0]}</span>
        <RoleTag role={member.role} color={color} small />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-2 z-30 w-64 rounded-xl overflow-hidden"
          style={{ background: "#17191b", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 16px 40px rgba(0,0,0,0.6)" }}>
          {/* Search */}
          <div className="px-2.5 pt-2.5 pb-1.5">
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar rol…"
              className="field-input w-full px-2.5 py-1.5 rounded-md text-[12px]" />
          </div>
          {search ? (
            /* Search results */
            <div className="max-h-52 overflow-y-auto pb-1.5">
              {ALL_ROLES_FLAT.filter(r => r.name.toLowerCase().includes(search.toLowerCase())).slice(0, 12).map(r => (
                <button key={r.name} onClick={() => handlePick(r.name)}
                  className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-left transition"
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  <span className="text-[12px] text-white">{r.name}</span>
                  <span className="text-[10px] shrink-0" style={{ color: "var(--text-dimmer)" }}>{r.category}</span>
                </button>
              ))}
              {ALL_ROLES_FLAT.filter(r => r.name.toLowerCase().includes(search.toLowerCase())).length === 0 && (
                <p className="text-center py-4 text-[12px]" style={{ color: "var(--text-dimmer)" }}>Sin resultados</p>
              )}
            </div>
          ) : (
            <>
              {/* 3 roles principales */}
              <p className="px-2.5 pt-1 pb-1 text-[10px] uppercase tracking-wider" style={{ color: "var(--text-dimmer)" }}>Roles principales</p>
              <div className="px-2 pb-2 flex flex-col gap-1">
                {MAIN_QUICK_ROLES.map(r => {
                  const active = member.role === r.name
                  return (
                    <button key={r.name} onClick={() => handlePick(r.name)}
                      className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition"
                      style={{ background: active ? `${r.color}18` : "rgba(255,255,255,0.03)", border: `1px solid ${active ? r.color + "40" : "var(--border)"}` }}
                      onMouseEnter={e => (e.currentTarget.style.background = `${r.color}14`)}
                      onMouseLeave={e => (e.currentTarget.style.background = active ? `${r.color}18` : "rgba(255,255,255,0.03)")}>
                      <span style={{ fontSize: 18 }}>{r.emoji}</span>
                      <div className="min-w-0">
                        <p className="text-[12px] font-semibold" style={{ color: active ? r.color : "#fff" }}>{r.name}</p>
                        <p className="text-[10px]" style={{ color: "var(--text-dimmer)" }}>{r.desc}</p>
                      </div>
                      {active && <span className="ml-auto text-[11px]" style={{ color: r.color }}>✓</span>}
                    </button>
                  )
                })}
              </div>
              {/* Ver todos */}
              <div className="border-t" style={{ borderColor: "var(--border)" }}>
                <button onClick={() => { setShowAll(true); onClose() }}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-[12px] font-medium transition"
                  style={{ color: "#aab2f0" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(94,106,210,0.08)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  Ver todos los roles (+{ALL_ROLES_FLAT.length})
                  <span style={{ fontSize: 11 }}>→</span>
                </button>
              </div>
            </>
          )}
          {/* Quitar del equipo */}
          <div className="border-t" style={{ borderColor: "var(--border)" }}>
            <button onClick={onRemove} className="w-full text-left px-2.5 py-2 text-[12px] transition"
              style={{ color: "rgba(235,87,87,0.8)" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(235,87,87,0.08)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>Quitar del equipo</button>
          </div>
        </div>
      )}
      {/* Modal de todos los roles */}
      {showAll && <AllRolesModal currentRole={member.role} onPick={handlePick} onClose={() => setShowAll(false)} />}
    </div>
  )
}

function AddMemberButton({ open, onToggle, onClose, selectedUser, onSelectUser, onBack, onAdd }: {
  open: boolean; onToggle: () => void; onClose: () => void
  selectedUser: string | null; onSelectUser: (id: string) => void
  onBack: () => void; onAdd: (userId: string, role: string) => Promise<void>
}) {
  const { allUsers, members, allRoles } = useWF()
  const ref = useOutsideClick<HTMLDivElement>(onClose)
  const available = allUsers.filter(u => !members.some(m => m.id === u.id))
  const picked = selectedUser ? allUsers.find(u => u.id === selectedUser) : null
  return (
    <div className="relative" ref={ref}>
      <button onClick={onToggle} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium transition"
        style={{ background: open ? "rgba(94,106,210,0.14)" : "var(--surface)", border: open ? "1px solid rgba(94,106,210,0.45)" : "1px solid var(--border)", color: open ? "#aab2f0" : "var(--text-dim)" }}>
        + Añadir
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-2 z-30 w-60 rounded-lg p-1.5"
          style={{ background: "#17191b", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 12px 32px rgba(0,0,0,0.5)" }}>
          {available.length === 0 ? (
            <p className="px-2 py-3 text-[12px] text-center" style={{ color: "var(--text-dim)" }}>Todos los usuarios ya están en el equipo</p>
          ) : picked && selectedUser ? (
            <AddMemberRolePicker
              userName={picked.nombre}
              onBack={onBack}
              onPick={role => onAdd(selectedUser, role)}
            />
          ) : (
            <>
              <p className="px-2 py-1.5 text-[11px] uppercase tracking-wider" style={{ color: "var(--text-dimmer)" }}>Añadir al equipo</p>
              {available.map((u, idx) => {
                const color = MEMBER_COLORS[idx % MEMBER_COLORS.length]
                return (
                  <button key={u.id} onClick={() => onSelectUser(u.id)}
                    className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md transition text-left"
                    style={{ background: "transparent" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    {u.avatar ? (
                      <img src={u.avatar} alt={u.nombre} className="w-6 h-6 rounded-full object-cover shrink-0" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[11px] font-semibold shrink-0" style={{ background: color }}>
                        {(u.nombre || "?")[0].toUpperCase()}
                      </div>
                    )}
                    <span className="text-[13px] text-white truncate">{u.nombre}</span>
                  </button>
                )
              })}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function CreateRoleButton({ open, onToggle, onClose, onSave }: {
  open: boolean; onToggle: () => void; onClose: () => void; onSave: (r: CustomRole) => void
}) {
  const [name, setName]   = useState("")
  const [color, setColor] = useState("#a78bfa")
  const ref = useOutsideClick<HTMLDivElement>(onClose)
  const save = () => {
    if (!name.trim()) return
    onSave({ id: crypto.randomUUID(), name: name.trim(), color })
    setName(""); setColor("#a78bfa"); onClose()
  }
  return (
    <div className="relative" ref={ref}>
      <button onClick={onToggle} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium transition"
        style={{ background: open ? "rgba(167,139,250,0.12)" : "var(--surface)", border: open ? "1px solid rgba(167,139,250,0.4)" : "1px solid var(--border)", color: open ? "#c4b5fd" : "var(--text-dim)" }}>
        + Crear rol
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-2 z-30 w-56 rounded-lg p-3"
          style={{ background: "#17191b", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 12px 32px rgba(0,0,0,0.5)" }}>
          <p className="text-[11px] uppercase tracking-wider mb-2" style={{ color: "var(--text-dimmer)" }}>Nuevo rol</p>
          <input autoFocus value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && save()}
            placeholder="Nombre del rol…" className="field-input w-full px-2.5 py-1.5 rounded-md text-[13px] mb-2" />
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[11px]" style={{ color: "var(--text-dim)" }}>Color</span>
            <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent" />
            <span className="text-[11px] px-2 py-0.5 rounded-md font-medium"
              style={{ background: `${color}1a`, color, border: `1px solid ${color}33` }}>{name || "Vista previa"}</span>
          </div>
          <button onClick={save} disabled={!name.trim()} className="w-full py-1.5 rounded-md text-[12px] font-semibold transition disabled:opacity-40"
            style={{ background: color, color: "#fff" }}>Crear</button>
        </div>
      )}
    </div>
  )
}

function FocusPill({ active, onClick, label, avatar }: {
  active: boolean; onClick: () => void; label: string; avatar?: React.ReactNode
}) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-full text-[12px] font-medium transition"
      style={{ background: active ? "rgba(94,106,210,0.14)" : "var(--surface)", border: active ? "1px solid rgba(94,106,210,0.45)" : "1px solid var(--border)", color: active ? "#aab2f0" : "var(--text-dim)" }}>
      {avatar ?? <span className="w-2 h-2 rounded-full" style={{ background: active ? "#5e6ad2" : "var(--text-dimmer)" }} />}
      {label}
    </button>
  )
}

function ActionBtn({ onClick, label, hint, title, active }: {
  onClick: () => void; label: string; hint?: string; title?: string; active?: boolean
}) {
  return (
    <button onClick={onClick} title={title} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-medium transition"
      style={{ background: active ? "rgba(255,255,255,0.07)" : "var(--surface)", border: "1px solid var(--border)", color: active ? "#fff" : "var(--text-dim)" }}
      onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
      onMouseLeave={e => (e.currentTarget.style.color = active ? "#fff" : "var(--text-dim)")}>
      <span className="hidden sm:inline">{label}</span>
      {hint && <span className="text-[10px] opacity-40 hidden md:inline">{hint}</span>}
    </button>
  )
}

function TaskCard({ task, member, onDragStart, onMove, onToggleBlocked, onDelete }: {
  task: Task; member: Member
  onDragStart: () => void; onMove: (s: Status) => void
  onToggleBlocked: () => void; onDelete: () => void
}) {
  const [menu, setMenu] = useState(false)
  const ref = useOutsideClick<HTMLDivElement>(() => setMenu(false))
  const soon    = isDueSoon(task.due_date)
  const overdue = isDueOverdue(task.due_date)
  const borderColor = task.blocked ? "rgba(242,153,74,0.45)"
    : overdue ? "rgba(235,87,87,0.4)" : soon ? "rgba(242,153,74,0.3)" : "var(--border)"
  const glowStyle = soon || overdue
    ? { boxShadow: `0 0 0 1px ${overdue ? "rgba(235,87,87,0.15)" : "rgba(242,153,74,0.12)"}` } : {}
  return (
    <div draggable onDragStart={e => { e.dataTransfer.effectAllowed = "move"; onDragStart() }}
      className="group relative rounded-lg p-3 cursor-grab active:cursor-grabbing"
      style={{ background: "var(--surface)", border: `1px solid ${borderColor}`, ...glowStyle }}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <PriorityTag priority={task.priority} />
        <div className="relative" ref={ref}>
          <button onClick={() => setMenu(v => !v)}
            className="w-6 h-6 -mr-1 rounded-md flex items-center justify-center text-[15px] leading-none opacity-0 group-hover:opacity-100 transition"
            style={{ color: "var(--text-dim)" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>⋯</button>
          {menu && (
            <div className="absolute right-0 top-full mt-1 z-30 w-48 rounded-lg p-1.5"
              style={{ background: "#17191b", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 12px 32px rgba(0,0,0,0.5)" }}>
              <p className="px-2 py-1 text-[10px] uppercase tracking-wider" style={{ color: "var(--text-dimmer)" }}>Mover a</p>
              {COLUMNS.map(c => (
                <button key={c.status} onClick={() => { onMove(c.status); setMenu(false) }}
                  disabled={c.status === task.status}
                  className="w-full text-left px-2 py-1.5 rounded-md text-[12px] transition disabled:opacity-35"
                  style={{ color: "var(--text)" }}
                  onMouseEnter={e => { if (c.status !== task.status) e.currentTarget.style.background = "rgba(255,255,255,0.05)" }}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>{c.label}</button>
              ))}
              <div className="my-1 h-px" style={{ background: "var(--border)" }} />
              <button onClick={() => { onToggleBlocked(); setMenu(false) }}
                className="w-full text-left px-2 py-1.5 rounded-md text-[12px] transition"
                style={{ color: task.blocked ? "#22c55e" : "#f2994a" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                {task.blocked ? "Desbloquear" : "Marcar bloqueado"}
              </button>
              <button onClick={() => { onDelete(); setMenu(false) }}
                className="w-full text-left px-2 py-1.5 rounded-md text-[12px] transition"
                style={{ color: "rgba(235,87,87,0.85)" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(235,87,87,0.1)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>Eliminar</button>
            </div>
          )}
        </div>
      </div>
      <p className="text-[13.5px] font-medium text-white leading-snug">{task.title}</p>
      {task.description && (
        <p className="text-[12px] mt-1 leading-relaxed line-clamp-2" style={{ color: "var(--text-dim)" }}>{task.description}</p>
      )}
      {task.due_date && (
        <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-medium"
          style={{ background: overdue ? "rgba(235,87,87,0.12)" : "rgba(242,153,74,0.1)", color: overdue ? "#eb5757" : "#f2994a", border: `1px solid ${overdue ? "rgba(235,87,87,0.3)" : "rgba(242,153,74,0.25)"}` }}>
          {overdue ? "⏰ Vencida" : "📅"} {new Date(task.due_date).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
        </div>
      )}
      {task.blocked && (
        <div className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-medium"
          style={{ background: "rgba(242,153,74,0.12)", color: "#f2994a", border: "1px solid rgba(242,153,74,0.3)" }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#f2994a" }} />Bloqueado
        </div>
      )}
      <div className="flex items-center justify-end mt-3">
        <MemberAvatar member={member} size={24} />
      </div>
    </div>
  )
}

function CreateTaskModal({ status, defaultAssignee, onClose, onCreate }: {
  status: Status; defaultAssignee: string
  onClose: () => void; onCreate: (d: Omit<Task, "id">) => void
}) {
  const { members } = useWF()
  const [title, setTitle]           = useState("")
  const [description, setDescription] = useState("")
  const [priority, setPriority]     = useState<Priority>("Media")
  const [assignee, setAssignee]     = useState(defaultAssignee || members[0]?.id || "")
  const [dueDate, setDueDate]       = useState("")
  const submit = () => {
    if (!title.trim()) return
    onCreate({ title: title.trim(), description: description.trim(), priority, status, assignee: assignee || null, blocked: false, due_date: dueDate || null, eisenhower_quadrant: null })
  }
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    document.addEventListener("keydown", h)
    return () => document.removeEventListener("keydown", h)
  }, [onClose])
  const colLabel = COLUMNS.find(c => c.status === status)?.label ?? ""
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(2px)" }} onMouseDown={onClose}>
      <div className="w-full max-w-md rounded-xl p-5"
        style={{ background: "var(--surface)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 24px 60px rgba(0,0,0,0.6)" }}
        onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-semibold text-white">Nueva tarea</h3>
          <span className="text-[11px] px-2 py-0.5 rounded-md" style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-dim)" }}>{colLabel}</span>
        </div>
        <input autoFocus value={title} onChange={e => setTitle(e.target.value)}
          onKeyDown={e => e.key === "Enter" && submit()} placeholder="Título de la tarea"
          className="field-input w-full px-3.5 py-2 rounded-md text-[14px] mb-3" />
        <textarea value={description} onChange={e => setDescription(e.target.value)}
          rows={2} placeholder="Descripción corta…"
          className="field-input w-full px-3.5 py-2 rounded-md text-[13px] resize-none leading-relaxed mb-3" />
        <p className="text-[11px] font-medium uppercase tracking-wider mb-1.5" style={{ color: "var(--text-dimmer)" }}>Prioridad</p>
        <div className="flex gap-2 mb-3 flex-wrap">
          {PRIORITIES.map(p => {
            const c = PRIORITY_COLOR[p]; const active = priority === p
            return (
              <button key={p} onClick={() => setPriority(p)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium transition"
                style={{ background: active ? `${c}1f` : "rgba(255,255,255,0.03)", color: active ? c : "var(--text-dim)", border: `1px solid ${active ? `${c}55` : "var(--border)"}` }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />{p}
              </button>
            )
          })}
        </div>
        {members.length > 0 && (
          <>
            <p className="text-[11px] font-medium uppercase tracking-wider mb-1.5" style={{ color: "var(--text-dimmer)" }}>Asignar a</p>
            <div className="flex gap-2 mb-3 flex-wrap">
              {members.map(m => {
                const active = assignee === m.id
                return (
                  <button key={m.id} onClick={() => setAssignee(m.id)}
                    className="flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full text-[12px] font-medium transition"
                    style={{ background: active ? "rgba(94,106,210,0.14)" : "rgba(255,255,255,0.03)", border: active ? "1px solid rgba(94,106,210,0.45)" : "1px solid var(--border)", color: active ? "#aab2f0" : "var(--text-dim)" }}>
                    <MemberAvatar member={m} size={18} />{m.nombre.split(" ")[0]}
                  </button>
                )
              })}
            </div>
          </>
        )}
        <p className="text-[11px] font-medium uppercase tracking-wider mb-1.5" style={{ color: "var(--text-dimmer)" }}>Fecha límite (opcional)</p>
        <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
          className="field-input w-full px-3.5 py-2 rounded-md text-[13px] mb-5" style={{ colorScheme: "dark" }} />
        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-3.5 py-2 rounded-md text-[13px] font-medium transition" style={{ color: "var(--text-dim)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#fff")} onMouseLeave={e => (e.currentTarget.style.color = "var(--text-dim)")}>Cancelar</button>
          <button onClick={submit} disabled={!title.trim()}
            className="px-4 py-2 rounded-md text-[13px] font-semibold bg-white text-black transition hover:bg-white/90 disabled:opacity-40">
            Crear tarea
          </button>
        </div>
      </div>
    </div>
  )
}

function SearchModal({ query, onQueryChange, onClose }: {
  query: string; onQueryChange: (v: string) => void; onClose: () => void
}) {
  const { searchResults, members } = useWF()
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    inputRef.current?.focus()
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    document.addEventListener("keydown", h)
    return () => document.removeEventListener("keydown", h)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[15vh]"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(3px)" }} onMouseDown={onClose}>
      <div className="w-full max-w-lg rounded-xl overflow-hidden"
        style={{ background: "#131416", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 24px 60px rgba(0,0,0,0.7)" }}
        onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <span style={{ color: "var(--text-dim)", fontSize: 14 }}>🔍</span>
          <input ref={inputRef} value={query} onChange={e => onQueryChange(e.target.value)}
            placeholder="Buscar tareas…" className="flex-1 bg-transparent text-[14px] text-white outline-none placeholder:text-[var(--text-dimmer)]" />
          <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-dim)" }}>Esc</span>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {!query.trim() && <p className="text-[12px] text-center py-8" style={{ color: "var(--text-dimmer)" }}>Escribe para buscar tareas…</p>}
          {query.trim() && searchResults.length === 0 && <p className="text-[12px] text-center py-8" style={{ color: "var(--text-dimmer)" }}>Sin resultados para "{query}"</p>}
          {searchResults.map(t => {
            const col = COLUMNS.find(c => c.status === t.status)
            const m   = members.find(x => x.id === t.assignee)
            const c   = PRIORITY_COLOR[t.priority]
            return (
              <div key={t.id} className="flex items-center gap-3 px-4 py-2.5 cursor-default"
                style={{ borderBottom: "1px solid var(--border)" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-white truncate">{t.title}</p>
                  {t.description && <p className="text-[11px] truncate" style={{ color: "var(--text-dim)" }}>{t.description}</p>}
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded-md shrink-0" style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-dim)" }}>{col?.label}</span>
                {m && <span className="text-[11px] shrink-0" style={{ color: "var(--text-dimmer)" }}>{m.nombre.split(" ")[0]}</span>}
              </div>
            )
          })}
        </div>
        {searchResults.length > 0 && <p className="text-[10px] text-center py-2" style={{ color: "var(--text-dimmer)" }}>{searchResults.length} resultado{searchResults.length !== 1 ? "s" : ""}</p>}
      </div>
    </div>
  )
}

function ActivityPanel({ activity, onClose }: { activity: ActivityEntry[]; onClose: () => void }) {
  return (
    <div className="shrink-0 w-64 flex flex-col border-l overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
      <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
        <span className="text-[12px] font-semibold text-white">Actividad reciente</span>
        <button onClick={onClose} className="w-5 h-5 flex items-center justify-center rounded text-[13px] transition" style={{ color: "var(--text-dim)" }}
          onMouseEnter={e => (e.currentTarget.style.color = "#fff")} onMouseLeave={e => (e.currentTarget.style.color = "var(--text-dim)")}>✕</button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {activity.length === 0 ? (
          <p className="text-[11px] text-center py-8" style={{ color: "var(--text-dimmer)" }}>Aún no hay actividad en esta sesión.</p>
        ) : (
          <div className="flex flex-col">
            {activity.map(a => (
              <div key={a.id} className="px-4 py-2.5" style={{ borderBottom: "1px solid var(--border)" }}>
                <p className="text-[12px] text-white leading-snug">{a.text}</p>
                <p className="text-[10px] mt-0.5" style={{ color: "var(--text-dimmer)" }}>{fmtRel(a.time)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
// PRIORIDADES VIEW — Matriz de Eisenhower (espejo del Kanban) + Mi Día
// ══════════════════════════════════════════════════════════════════
function PrioridadesView() {
  const {
    visibleTasks, memberById, setTaskQuadrant, moveTask, dragId,
    myWorkloadOnly, focusMember, setMyWorkloadOnly, setFocusMember,
  } = useWF()
  const [dragOverQ, setDragOverQ] = useState<Quadrant | null>(null)
  const [miDiaOpen, setMiDiaOpen] = useState(false)

  const active = useMemo(() => visibleTasks.filter(t => t.status !== "done"), [visibleTasks])
  const doneCount = visibleTasks.length - active.length
  const filtering = myWorkloadOnly || !!focusMember

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="shrink-0 px-5 md:px-6 pb-3 flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--text-dimmer)" }}>
          Matriz de Eisenhower
        </span>
        <span className="text-[11px]" style={{ color: "var(--text-dimmer)" }}>
          · arrastra entre cuadrantes para repriorizar
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <button onClick={() => { setMyWorkloadOnly(!myWorkloadOnly); setFocusMember(null) }}
            className="px-2.5 py-1 rounded-full text-[12px] font-medium transition"
            style={{
              background: myWorkloadOnly ? "rgba(94,106,210,0.14)" : "var(--surface)",
              border: myWorkloadOnly ? "1px solid rgba(94,106,210,0.45)" : "1px solid var(--border)",
              color: myWorkloadOnly ? "#aab2f0" : "var(--text-dim)",
            }}>Mi carga</button>
          <button onClick={() => setMiDiaOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold transition"
            style={{ background: "linear-gradient(180deg,#5e6ad2,#4d59c4)", color: "#fff", boxShadow: "0 2px 8px rgba(94,106,210,0.35)" }}>
            ☀ Mi Día
          </button>
        </div>
      </div>

      {/* Matriz 2×2 */}
      <div className="flex-1 min-h-0 px-3 md:px-6 pb-4 overflow-hidden">
        <div className="h-full grid grid-cols-1 sm:grid-cols-2 grid-rows-[repeat(4,minmax(0,1fr))] sm:grid-rows-2 gap-3">
          {QUADRANTS.map(meta => {
            const items = active.filter(t => deriveQuadrant(t) === meta.q)
            const over = dragOverQ === meta.q
            return (
              <section key={meta.q}
                onDragOver={e => { e.preventDefault(); if (dragOverQ !== meta.q) setDragOverQ(meta.q) }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverQ(null) }}
                onDrop={() => { if (dragId.current) setTaskQuadrant(dragId.current, meta.q); dragId.current = null; setDragOverQ(null) }}
                className="relative flex flex-col min-h-0 rounded-xl overflow-hidden transition-all"
                style={{
                  background: over ? `${meta.color}14` : "var(--surface)",
                  border: `1px solid ${over ? `${meta.color}88` : "var(--border)"}`,
                  boxShadow: over ? `inset 0 0 0 1px ${meta.color}55, 0 0 0 3px ${meta.color}22` : "none",
                }}>
                {/* franja de color superior */}
                <div className="h-[3px] shrink-0" style={{ background: `linear-gradient(90deg, ${meta.color}, ${meta.color}33)` }} />
                <header className="flex items-start justify-between gap-2 px-3.5 pt-3 pb-2 shrink-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px]">{meta.emoji}</span>
                      <span className="text-[13px] font-semibold text-white truncate">{meta.title}</span>
                      <span className="text-[10px] px-1.5 rounded-md shrink-0"
                        style={{ color: meta.color, background: `${meta.color}1a`, border: `1px solid ${meta.color}33` }}>
                        {items.length}
                      </span>
                    </div>
                    <p className="text-[10.5px] mt-0.5" style={{ color: "var(--text-dimmer)" }}>{meta.subtitle}</p>
                  </div>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 hidden lg:inline"
                    style={{ color: meta.color, background: `${meta.color}12` }}>{meta.action}</span>
                </header>
                <div className="flex-1 min-h-0 overflow-y-auto px-2.5 pb-2.5 flex flex-col gap-2">
                  {items.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-[11px] text-center rounded-lg border border-dashed py-4"
                      style={{ color: "var(--text-dimmer)", borderColor: "var(--border)" }}>
                      Suelta tareas aquí
                    </div>
                  ) : items.map(task => (
                    <MatrixCard key={task.id} task={task} member={memberById(task.assignee)} accent={meta.color}
                      onDragStart={() => (dragId.current = task.id)}
                      onComplete={() => moveTask(task.id, "done")} />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      </div>

      <div className="shrink-0 px-5 md:px-6 pb-3 flex items-center gap-3 text-[11px]" style={{ color: "var(--text-dimmer)" }}>
        <span>{active.length} activa{active.length !== 1 ? "s" : ""}</span>
        <span>·</span>
        <span>{doneCount} completada{doneCount !== 1 ? "s" : ""}</span>
        {filtering && <><span>·</span><span style={{ color: "#aab2f0" }}>vista filtrada</span></>}
      </div>

      {miDiaOpen && <MiDiaPanel onClose={() => setMiDiaOpen(false)} />}
    </div>
  )
}

function MatrixCard({ task, member, accent, onDragStart, onComplete }: {
  task: Task; member: Member; accent: string
  onDragStart: () => void; onComplete: () => void
}) {
  const overdue = isDueOverdue(task.due_date)
  const soon = isDueSoon(task.due_date)
  return (
    <div draggable onDragStart={e => { e.dataTransfer.effectAllowed = "move"; onDragStart() }}
      className="group relative rounded-lg p-2.5 cursor-grab active:cursor-grabbing"
      style={{ background: "#17191b", border: `1px solid ${task.blocked ? "rgba(242,153,74,0.45)" : "var(--border)"}` }}>
      <div className="flex items-start gap-2">
        <span className="mt-1 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: PRIORITY_COLOR[task.priority] }} />
        <p className="flex-1 text-[12.5px] font-medium text-white leading-snug line-clamp-2">{task.title}</p>
        <button onClick={onComplete} title="Completar"
          className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] opacity-0 group-hover:opacity-100 transition"
          style={{ border: "1px solid var(--border-strong)", color: "var(--text-dim)" }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(34,197,94,0.15)"; e.currentTarget.style.color = "#22c55e"; e.currentTarget.style.borderColor = "rgba(34,197,94,0.4)" }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-dim)"; e.currentTarget.style.borderColor = "var(--border-strong)" }}>
          ✓
        </button>
      </div>
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1.5">
          {(overdue || soon) && (
            <span className="text-[9.5px] font-medium px-1.5 py-0.5 rounded"
              style={{ background: overdue ? "rgba(235,87,87,0.12)" : "rgba(242,153,74,0.1)", color: overdue ? "#eb5757" : "#f2994a" }}>
              {overdue ? "Vencida" : "Pronto"}
            </span>
          )}
          {task.blocked && <span className="text-[9.5px] font-medium px-1.5 py-0.5 rounded" style={{ background: "rgba(242,153,74,0.12)", color: "#f2994a" }}>Bloqueada</span>}
        </div>
        <div style={{ boxShadow: `0 0 0 1.5px ${accent}33`, borderRadius: 9999 }}>
          <MemberAvatar member={member} size={20} />
        </div>
      </div>
    </div>
  )
}

// ── Slide-over "Mi Día" con autolimpieza de residuos ──
function MiDiaPanel({ onClose }: { onClose: () => void }) {
  const { user, tasks, memberById, moveTask, addToast } = useWF()
  const uid = user?.id ?? "anon"
  const [plan, setPlan] = useState<MyDayPlan>(() => loadPlan(uid))
  const [shown, setShown] = useState(false)
  const cleaned = useRef(false)

  useEffect(() => {
    const r = requestAnimationFrame(() => setShown(true))
    const h = (e: KeyboardEvent) => e.key === "Escape" && close()
    document.addEventListener("keydown", h)
    return () => { cancelAnimationFrame(r); document.removeEventListener("keydown", h) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const close = () => { setShown(false); setTimeout(onClose, 260) }

  const persist = (p: MyDayPlan) => { setPlan(p); savePlan(uid, p) }

  const applyRotation = (basePlan: MyDayPlan, label: string) => {
    const res = runAutoclean(basePlan, tasks.map(t => ({ id: t.id, priority: t.priority, status: t.status, due_date: t.due_date, eisenhower_quadrant: t.eisenhower_quadrant })), dayKey())
    persist(res.plan)
    res.toBacklog.forEach(id => { const t = tasks.find(x => x.id === id); if (t && t.status !== "backlog") moveTask(id, "backlog") })
    if (res.changed) {
      const c = res.plan.carried.length, d = res.toBacklog.length
      addToast("info", `${label} · ${c} arrastrada${c !== 1 ? "s" : ""}, ${d} al backlog`)
    }
  }

  // Autolimpieza al abrir (una vez): rota el plan si es de un día anterior.
  useEffect(() => {
    if (cleaned.current) return
    cleaned.current = true
    if (plan.date !== dayKey()) applyRotation(plan, "Mi Día actualizado")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const simulateNewDay = () => {
    const y = new Date(); y.setDate(y.getDate() - 1)
    applyRotation({ ...plan, date: dayKey(y) }, "Simulación de nuevo día")
  }

  const addToDay = (id: string) => { if (!plan.ids.includes(id)) persist({ ...plan, ids: [...plan.ids, id] }) }
  const removeFromDay = (id: string) => persist({ date: plan.date, ids: plan.ids.filter(x => x !== id), carried: plan.carried.filter(x => x !== id) })
  const complete = (id: string) => { moveTask(id, "done"); removeFromDay(id) }

  const planTasks = plan.ids
    .map(id => tasks.find(t => t.id === id))
    .filter((t): t is Task => !!t && t.status !== "done")
  const pool = user ? tasks.filter(t => t.assignee === user.id && t.status !== "done" && !plan.ids.includes(t.id)) : []
  const groups = QUADRANTS
    .map(meta => ({ meta, items: planTasks.filter(t => deriveQuadrant(t) === meta.q) }))
    .filter(g => g.items.length > 0)

  const today = new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })

  return (
    <div className="fixed inset-0 z-[60]" aria-modal>
      <div onMouseDown={close} className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.5)", opacity: shown ? 1 : 0, transition: "opacity 0.26s ease" }} />
      <aside
        className="absolute top-0 right-0 h-full w-full max-w-[380px] flex flex-col"
        style={{
          background: "var(--surface-2)", borderLeft: "1px solid var(--border-strong)",
          transform: shown ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.28s cubic-bezier(0.22,0.61,0.36,1)",
          willChange: "transform", boxShadow: "-24px 0 60px rgba(0,0,0,0.5)",
        }}>
        <header className="shrink-0 px-5 pt-5 pb-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-[16px] font-semibold text-white flex items-center gap-2">☀ Mi Día</h3>
              <p className="text-[12px] mt-0.5 capitalize" style={{ color: "var(--text-dim)" }}>{today}</p>
            </div>
            <button onClick={close} className="w-7 h-7 rounded-md flex items-center justify-center text-[14px] transition"
              style={{ color: "var(--text-dim)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "#fff" }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-dim)" }}>✕</button>
          </div>
          <div className="flex items-center gap-3 mt-3 text-[11px]" style={{ color: "var(--text-dimmer)" }}>
            <span><span className="text-white font-semibold">{planTasks.length}</span> en tu día</span>
            {plan.carried.length > 0 && (
              <span className="px-2 py-0.5 rounded-full" style={{ background: "rgba(242,153,74,0.12)", color: "#f2994a" }}>
                {plan.carried.length} arrastrada{plan.carried.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 flex flex-col gap-4">
          {planTasks.length === 0 && (
            <div className="text-[12px] text-center py-8 px-4 rounded-lg border border-dashed"
              style={{ color: "var(--text-dimmer)", borderColor: "var(--border)" }}>
              Tu día está vacío. Añade tareas desde abajo para enfocarte hoy.
            </div>
          )}
          {groups.map(({ meta, items }) => (
            <div key={meta.q}>
              <div className="flex items-center gap-2 mb-2 px-1">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />
                <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: meta.color }}>{meta.title}</span>
                <span className="text-[10px]" style={{ color: "var(--text-dimmer)" }}>{meta.subtitle}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {items.map(t => {
                  const carried = plan.carried.includes(t.id)
                  return (
                    <div key={t.id} className="group flex items-center gap-2.5 px-2.5 py-2 rounded-lg"
                      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                      <button onClick={() => complete(t.id)} title="Completar"
                        className="shrink-0 w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] transition"
                        style={{ border: "1.5px solid var(--border-strong)", color: "transparent" }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = "#22c55e"; e.currentTarget.style.color = "#22c55e" }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.color = "transparent" }}>✓</button>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12.5px] text-white leading-snug truncate">{t.title}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {carried && (
                            <span className="text-[9px] font-medium px-1.5 py-px rounded"
                              style={{ background: "rgba(242,153,74,0.14)", color: "#f2994a", border: "1px solid rgba(242,153,74,0.3)" }}>
                              ↪ Arrastrada
                            </span>
                          )}
                          <span className="text-[10px]" style={{ color: PRIORITY_COLOR[t.priority] }}>{t.priority}</span>
                        </div>
                      </div>
                      <MemberAvatar member={memberById(t.assignee)} size={18} />
                      <button onClick={() => removeFromDay(t.id)} title="Quitar de hoy"
                        className="shrink-0 w-5 h-5 rounded flex items-center justify-center text-[12px] opacity-0 group-hover:opacity-100 transition"
                        style={{ color: "var(--text-dimmer)" }}
                        onMouseEnter={e => (e.currentTarget.style.color = "#eb5757")}
                        onMouseLeave={e => (e.currentTarget.style.color = "var(--text-dimmer)")}>×</button>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {pool.length > 0 && (
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider mb-2 px-1" style={{ color: "var(--text-dimmer)" }}>
                Añadir a hoy
              </p>
              <div className="flex flex-col gap-1.5">
                {pool.slice(0, 12).map(t => {
                  const meta = QUADRANT_BY_ID[deriveQuadrant(t)]
                  return (
                    <button key={t.id} onClick={() => addToDay(t.id)}
                      className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition"
                      style={{ background: "transparent", border: "1px dashed var(--border)" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = "var(--border-strong)" }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "var(--border)" }}>
                      <span className="shrink-0 w-[18px] h-[18px] rounded-md flex items-center justify-center text-[13px]"
                        style={{ background: `${meta.color}1a`, color: meta.color }}>+</span>
                      <span className="flex-1 min-w-0 text-[12.5px] truncate" style={{ color: "var(--text-dim)" }}>{t.title}</span>
                      <span className="text-[9.5px] shrink-0" style={{ color: meta.color }}>{meta.title}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <footer className="shrink-0 px-4 py-3 flex items-center justify-between gap-2" style={{ borderTop: "1px solid var(--border)" }}>
          <button onClick={simulateNewDay}
            className="text-[11px] font-medium px-2.5 py-1.5 rounded-md transition"
            style={{ color: "var(--text-dim)", border: "1px solid var(--border)" }}
            onMouseEnter={e => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.background = "rgba(255,255,255,0.04)" }}
            onMouseLeave={e => { e.currentTarget.style.color = "var(--text-dim)"; e.currentTarget.style.background = "transparent" }}>
            ⟳ Simular nuevo día
          </button>
          <span className="text-[10px]" style={{ color: "var(--text-dimmer)" }}>Autolimpieza activa</span>
        </footer>
      </aside>
    </div>
  )
}
