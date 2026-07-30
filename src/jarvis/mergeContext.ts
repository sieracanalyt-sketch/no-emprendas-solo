import { supabase } from "../supabase"

// ──────────────────────────────────────────────────────────────────────────────
// Contexto que MERGE puede leer del usuario: SOLO su agenda (calendar_events) y
// su workflow (workflow_tasks + workflow_roles). Los MENSAJES quedan fuera a
// propósito — son privados y nunca se envían al agente.
//
// La app tiene acceso a estos datos vía RLS (sesión del usuario), así que los
// recoge aquí y se los pasa al agente por el data-channel `merge.context`. El
// agente los usa como contexto para responder; nunca se muestran en crudo en la
// interfaz (ver el estado "trabajando" pixelado).
// ──────────────────────────────────────────────────────────────────────────────

export const MERGE_CONTEXT_TOPIC = "merge.context"

export type MergeContext = {
  generated_at: string
  user_id: string
  agenda: {
    titulo: string
    inicio: string
    fin: string
    estado: string | null
    tipo: string | null
    urgente: boolean
    mio: boolean
  }[]
  workflow: {
    tareas: {
      titulo: string
      estado: string | null        // columna kanban (p.ej. todo / doing / done)
      prioridad: string | null
      cuadrante: string | null     // Eisenhower
      bloqueada: boolean
      vence: string | null
      mia: boolean
    }[]
    equipo: { nombre: string; rol: string }[]
  }
  // Qué puede PEDIR MERGE sobre este workflow. No las ejecuta él: publica la
  // intención por `merge.action` y la app la aplica con la sesión del usuario.
  // Ver src/jarvis/contract.ts y docs/merge-workflow-actions.md.
  acciones_disponibles: typeof MERGE_ACTIONS
}

export const MERGE_ACTIONS = [
  { op: "task.create",   args: "title, description?, priority?, status?, assignee?, due_date?" },
  { op: "task.update",   args: "task, title?, description?, priority?, status?, assignee?, due_date?, blocked?" },
  { op: "task.move",     args: "task, status (backlog|progress|review|done)" },
  { op: "task.quadrant", args: "task, quadrant (1 hacer ahora | 2 planificar | 3 delegar | 4 eliminar)" },
  { op: "task.delete",   args: "task" },
  { op: "member.add",    args: "person, role?" },
  { op: "member.remove", args: "person" },
  { op: "member.role",   args: "person, role" },
] as const

type EventRow = {
  title: string; start_at: string; end_at: string
  status: string | null; kind: string | null; urgent: boolean | null
  owner_id: string; attendees: string[] | null
}
type TaskRow = {
  title: string; status: string | null; priority: string | null
  eisenhower_quadrant: string | null; blocked: boolean | null
  due_date: string | null; assignee: string | null
}
type RoleRow = { user_id: string; rol: string | null }

// Recoge el contexto de agenda + workflow del usuario. Nunca lanza: ante
// cualquier fallo devuelve lo que haya podido reunir (o vacío).
export async function fetchMergeContext(userId: string): Promise<MergeContext> {
  const now = new Date()
  const nowIso = now.toISOString()
  const in21 = new Date(now.getTime() + 21 * 864e5).toISOString()

  const [evRes, taskRes, roleRes] = await Promise.allSettled([
    supabase
      .from("calendar_events")
      .select("title, start_at, end_at, status, kind, urgent, owner_id, attendees")
      .gte("start_at", nowIso)
      .lte("start_at", in21)
      .order("start_at", { ascending: true })
      .limit(40),
    supabase
      .from("workflow_tasks")
      .select("title, status, priority, eisenhower_quadrant, blocked, due_date, assignee")
      .order("created_at", { ascending: false })
      .limit(60),
    supabase.from("workflow_roles").select("user_id, rol"),
  ])

  const events = (evRes.status === "fulfilled" ? (evRes.value.data as EventRow[] | null) : null) ?? []
  const tasks = (taskRes.status === "fulfilled" ? (taskRes.value.data as TaskRow[] | null) : null) ?? []
  const roles = (roleRes.status === "fulfilled" ? (roleRes.value.data as RoleRow[] | null) : null) ?? []

  // nombres del equipo (gestión)
  let equipo: { nombre: string; rol: string }[] = []
  if (roles.length) {
    const { data: users } = await supabase
      .from("users")
      .select("id, nombre")
      .in("id", roles.map((r) => r.user_id))
    const nameOf = new Map((users ?? []).map((u) => [u.id as string, (u.nombre as string) || "Miembro"]))
    equipo = roles.map((r) => ({ nombre: nameOf.get(r.user_id) ?? "Miembro", rol: r.rol ?? "Sin rol" }))
  }

  const agenda = events.map((e) => ({
    titulo: e.title,
    inicio: e.start_at,
    fin: e.end_at,
    estado: e.status,
    tipo: e.kind,
    urgente: !!e.urgent,
    mio: e.owner_id === userId || (Array.isArray(e.attendees) && e.attendees.includes(userId)),
  }))

  const tareas = tasks.map((t) => ({
    titulo: t.title,
    estado: t.status,
    prioridad: t.priority,
    cuadrante: t.eisenhower_quadrant,
    bloqueada: !!t.blocked,
    vence: t.due_date,
    mia: t.assignee === userId,
  }))

  return {
    generated_at: nowIso, user_id: userId, agenda,
    workflow: { tareas, equipo },
    acciones_disponibles: MERGE_ACTIONS,
  }
}

// Resumen legible para incrustar en el mensaje al agente, de modo que MERGE
// pueda responder sobre agenda/workflow aunque su cerebro aún no lea el topic
// `merge.context`. Compacto y en lenguaje natural.
export function digestForAgent(ctx: MergeContext, kind: "agenda" | "workflow"): string {
  const fmt = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("es-ES", {
        weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
      })
    } catch { return iso }
  }

  if (kind === "agenda") {
    const items = ctx.agenda.slice(0, 12).map((e) =>
      `· ${fmt(e.inicio)} — ${e.titulo}${e.urgente ? " (urgente)" : ""}${e.estado === "proposal" ? " (propuesta)" : ""}`)
    return items.length
      ? `Estos son mis próximos eventos:\n${items.join("\n")}`
      : "No tengo eventos próximos en mi agenda."
  }

  // workflow
  const source = ctx.workflow.tareas.some((t) => t.mia) ? ctx.workflow.tareas.filter((t) => t.mia) : ctx.workflow.tareas
  const tasks = source.slice(0, 14).map((t) => {
    const meta: string[] = []
    if (t.estado) meta.push(`estado: ${t.estado}`)
    if (t.prioridad) meta.push(`prioridad: ${t.prioridad}`)
    if (t.cuadrante) meta.push(`cuadrante Eisenhower: ${t.cuadrante}`)
    if (t.bloqueada) meta.push("BLOQUEADA")
    if (t.vence) meta.push(`vence: ${t.vence}`)
    return `· "${t.titulo}"${meta.length ? ` — ${meta.join(", ")}` : ""}`
  })
  const team = ctx.workflow.equipo.slice(0, 8).map((m) => `${m.nombre} (${m.rol})`).join(", ")
  const parts: string[] = []
  parts.push(tasks.length ? `Mis tareas del workflow:\n${tasks.join("\n")}` : "No tengo tareas en el workflow.")
  if (team) parts.push(`Equipo: ${team}.`)
  // MERGE no solo lee el tablero: puede cambiarlo. Se lo recordamos aquí para
  // que ofrezca hacerlo en vez de limitarse a describir lo que ve.
  parts.push(
    "Recuerda que puedes modificar mi workflow tú mismo (crear, editar, mover, " +
    "priorizar o borrar tareas, y añadir, quitar o recolocar gente del equipo): " +
    "propónmelo y hazlo, no hace falta que lo haga yo a mano."
  )
  return parts.join("\n\n")
}
