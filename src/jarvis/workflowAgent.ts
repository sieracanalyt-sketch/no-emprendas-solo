import { supabase } from "../supabase"
import { normalizeText, resolveRole } from "../lib/roles"
import { QUADRANT_BY_ID, priorityForQuadrant, isUrgentQuadrant, type Quadrant } from "../lib/eisenhower"
import type {
  ActionPriority, ActionStatus, MergeAction,
  MergeActionEnvelope, MergeActionOutcome, MergeActionResult,
} from "./contract"

// ──────────────────────────────────────────────────────────────────────────────
// EJECUTOR DE ACCIONES DE MERGE SOBRE EL WORKFLOW
//
// MERGE nunca escribe en la base de datos. Publica intenciones y esto las
// ejecuta desde el navegador, con la sesión del usuario: las mismas políticas
// RLS que si hubiera pulsado los botones a mano. Si el usuario no puede hacer
// algo, MERGE tampoco.
//
// Todo lo que entra aquí viene de fuera de la app, así que se valida: se
// resuelven nombres contra lo que existe de verdad y se rechaza lo que no case.
// Nunca lanza: cada acción devuelve su propio resultado explicable en voz alta.
// ──────────────────────────────────────────────────────────────────────────────

export type WorkflowSnapshot = {
  members: { id: string; nombre: string; rol: string }[]
  users: { id: string; nombre: string }[]
  tasks: { id: string; title: string; status: string; priority: string; assignee: string | null }[]
}

const STATUS_LABEL: Record<ActionStatus, string> = {
  backlog: "Backlog", progress: "En Progreso", review: "En Revisión", done: "Completado",
}

const STATUS_ALIASES: Record<string, ActionStatus> = {
  backlog: "backlog", pendiente: "backlog", ideas: "backlog", "por hacer": "backlog",
  progress: "progress", "en progreso": "progress", progreso: "progress",
  haciendo: "progress", "en curso": "progress", activo: "progress",
  review: "review", "en revision": "review", revision: "review", revisar: "review",
  done: "done", completado: "done", hecho: "done", terminado: "done", listo: "done",
}

const PRIORITY_ALIASES: Record<string, ActionPriority> = {
  urgente: "Urgente", critica: "Urgente", critico: "Urgente", maxima: "Urgente",
  alta: "Alta", importante: "Alta",
  media: "Media", normal: "Media",
  baja: "Baja", minima: "Baja",
}

const QUADRANT_ALIASES: Record<string, Quadrant> = {
  "hacer ahora": 1, "haz ahora": 1, "urgente e importante": 1, ahora: 1,
  planificar: 2, planificado: 2, "importante no urgente": 2, agendar: 2,
  delegar: 3, delega: 3, "urgente no importante": 3,
  eliminar: 4, descartar: 4, "ni urgente ni importante": 4,
}

function toStatus(v: unknown): ActionStatus | null {
  if (typeof v !== "string") return null
  return STATUS_ALIASES[normalizeText(v)] ?? null
}
function toPriority(v: unknown): ActionPriority | null {
  if (typeof v !== "string") return null
  return PRIORITY_ALIASES[normalizeText(v)] ?? null
}
function toQuadrant(v: unknown): Quadrant | null {
  if (v === 1 || v === 2 || v === 3 || v === 4) return v
  if (typeof v === "string") {
    const n = Number(v)
    if (n === 1 || n === 2 || n === 3 || n === 4) return n as Quadrant
    return QUADRANT_ALIASES[normalizeText(v)] ?? null
  }
  return null
}
// Fecha en YYYY-MM-DD; se rechaza cualquier otra cosa antes de tocar la base.
function toDate(v: unknown): string | null {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(v)) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : v.slice(0, 10)
}
function toText(v: unknown, max = 400): string | null {
  if (typeof v !== "string") return null
  const t = v.trim()
  return t ? t.slice(0, max) : null
}

/**
 * Empareja lo que dice MERGE ("Marta", "la landing") con lo que existe.
 * De más estricto a más flexible; si hay empate, no adivina: devuelve null.
 */
function matchByName<T>(pool: T[], query: string, nameOf: (x: T) => string): T | null {
  const q = normalizeText(query)
  if (!q || pool.length === 0) return null

  const exact = pool.filter(x => normalizeText(nameOf(x)) === q)
  if (exact.length === 1) return exact[0]

  const starts = pool.filter(x => normalizeText(nameOf(x)).startsWith(q))
  if (starts.length === 1) return starts[0]

  const contains = pool.filter(x => {
    const n = normalizeText(nameOf(x))
    return n.includes(q) || q.includes(n)
  })
  if (contains.length === 1) return contains[0]

  // Palabras en común: "mueve rediseñar landing" → "Rediseñar la landing".
  const words = q.split(" ").filter(w => w.length > 2)
  if (words.length) {
    const scored = pool
      .map(x => ({ x, hits: words.filter(w => normalizeText(nameOf(x)).includes(w)).length }))
      .filter(s => s.hits > 0)
      .sort((a, b) => b.hits - a.hits)
    if (scored.length && (scored.length === 1 || scored[0].hits > scored[1].hits)) return scored[0].x
  }
  // Varias coincidencias igual de buenas: mejor preguntar que equivocarse.
  return exact[0] ?? starts[0] ?? null
}

/** Foto del workflow tal y como está ahora mismo, para resolver nombres. */
export async function loadWorkflowSnapshot(): Promise<WorkflowSnapshot> {
  const [roleRes, taskRes, userRes] = await Promise.allSettled([
    supabase.from("workflow_roles").select("user_id, rol"),
    supabase.from("workflow_tasks").select("id, title, status, priority, assignee"),
    supabase.from("users").select("id, nombre"),
  ])
  const roles = (roleRes.status === "fulfilled" ? roleRes.value.data : null) ?? []
  const tasks = (taskRes.status === "fulfilled" ? taskRes.value.data : null) ?? []
  const users = (userRes.status === "fulfilled" ? userRes.value.data : null) ?? []

  const nameOf = new Map(users.map(u => [u.id as string, (u.nombre as string) || "Miembro"]))
  return {
    members: roles.map(r => ({
      id: r.user_id as string,
      nombre: nameOf.get(r.user_id as string) ?? "Miembro",
      rol: (r.rol as string) ?? "Sin rol",
    })),
    users: users.map(u => ({ id: u.id as string, nombre: (u.nombre as string) || "Usuario" })),
    tasks: tasks as WorkflowSnapshot["tasks"],
  }
}

const ok = (op: MergeAction["op"], message: string): MergeActionOutcome => ({ op, ok: true, message })
const ko = (op: MergeAction["op"], message: string): MergeActionOutcome => ({ op, ok: false, message })

async function runOne(a: MergeAction, snap: WorkflowSnapshot): Promise<MergeActionOutcome> {
  switch (a.op) {
    // ── TAREAS ────────────────────────────────────────────────────────────────
    case "task.create": {
      const title = toText(a.title, 160)
      if (!title) return ko(a.op, "No me diste título para la tarea, así que no la he creado.")
      const status = toStatus(a.status) ?? "backlog"
      const priority = toPriority(a.priority) ?? "Media"
      const member = a.assignee ? matchByName(snap.members, a.assignee, m => m.nombre) : null
      if (a.assignee && !member) return ko(a.op, `No encuentro a "${a.assignee}" en el equipo, así que no he creado "${title}".`)
      const { error } = await supabase.from("workflow_tasks").insert({
        title,
        description: toText(a.description) ?? "",
        priority, status,
        assignee: member?.id ?? null,
        blocked: false,
        due_date: toDate(a.due_date),
        eisenhower_quadrant: null,
      })
      if (error) return ko(a.op, `No pude crear "${title}": ${error.message}`)
      return ok(a.op, `Creada "${title}" en ${STATUS_LABEL[status]}${member ? ` para ${member.nombre.split(" ")[0]}` : ""}.`)
    }

    case "task.move": {
      const status = toStatus(a.status)
      if (!status) return ko(a.op, `No sé a qué columna te refieres con "${String(a.status)}".`)
      const t = matchByName(snap.tasks, a.task ?? "", x => x.title)
      if (!t) return ko(a.op, `No encuentro ninguna tarea que se parezca a "${a.task}".`)
      const { error } = await supabase.from("workflow_tasks").update({ status }).eq("id", t.id)
      if (error) return ko(a.op, `No pude mover "${t.title}": ${error.message}`)
      return ok(a.op, `"${t.title}" movida a ${STATUS_LABEL[status]}.`)
    }

    case "task.quadrant": {
      const q = toQuadrant(a.quadrant)
      if (!q) return ko(a.op, `"${String(a.quadrant)}" no es un cuadrante de la matriz.`)
      const t = matchByName(snap.tasks, a.task ?? "", x => x.title)
      if (!t) return ko(a.op, `No encuentro ninguna tarea que se parezca a "${a.task}".`)
      // Mismo espejo que al arrastrar en la matriz: el cuadrante fija prioridad
      // y saca del backlog lo que pasa a ser urgente.
      const priority = priorityForQuadrant(q)
      const status = isUrgentQuadrant(q) && t.status === "backlog" ? "progress" : t.status
      const { error } = await supabase.from("workflow_tasks")
        .update({ eisenhower_quadrant: q, priority, status }).eq("id", t.id)
      if (error) return ko(a.op, `No pude priorizar "${t.title}": ${error.message}`)
      return ok(a.op, `"${t.title}" a ${QUADRANT_BY_ID[q].title} (prioridad ${priority}).`)
    }

    case "task.update": {
      const t = matchByName(snap.tasks, a.task ?? "", x => x.title)
      if (!t) return ko(a.op, `No encuentro ninguna tarea que se parezca a "${a.task}".`)
      const patch: Record<string, unknown> = {}
      const changes: string[] = []

      const title = toText(a.title, 160)
      if (title) { patch.title = title; changes.push(`título "${title}"`) }
      const desc = toText(a.description)
      if (desc !== null) { patch.description = desc; changes.push("descripción") }
      const priority = toPriority(a.priority)
      if (priority) { patch.priority = priority; changes.push(`prioridad ${priority}`) }
      const status = toStatus(a.status)
      if (status) { patch.status = status; changes.push(STATUS_LABEL[status]) }
      if (typeof a.blocked === "boolean") { patch.blocked = a.blocked; changes.push(a.blocked ? "bloqueada" : "desbloqueada") }
      if (a.due_date === null) { patch.due_date = null; changes.push("sin fecha límite") }
      else {
        const due = toDate(a.due_date)
        if (due) { patch.due_date = due; changes.push(`vence el ${due}`) }
      }
      if (a.assignee) {
        const m = matchByName(snap.members, a.assignee, x => x.nombre)
        if (!m) return ko(a.op, `No encuentro a "${a.assignee}" en el equipo.`)
        patch.assignee = m.id; changes.push(`asignada a ${m.nombre.split(" ")[0]}`)
      }
      if (!changes.length) return ko(a.op, `No me dijiste qué cambiar de "${t.title}".`)

      const { error } = await supabase.from("workflow_tasks").update(patch).eq("id", t.id)
      if (error) return ko(a.op, `No pude actualizar "${t.title}": ${error.message}`)
      return ok(a.op, `"${t.title}": ${changes.join(", ")}.`)
    }

    case "task.delete": {
      const t = matchByName(snap.tasks, a.task ?? "", x => x.title)
      if (!t) return ko(a.op, `No encuentro ninguna tarea que se parezca a "${a.task}".`)
      const { error } = await supabase.from("workflow_tasks").delete().eq("id", t.id)
      if (error) return ko(a.op, `No pude eliminar "${t.title}": ${error.message}`)
      return ok(a.op, `Eliminada "${t.title}".`)
    }

    // ── EQUIPO ────────────────────────────────────────────────────────────────
    case "member.add": {
      const person = toText(a.person, 120)
      if (!person) return ko(a.op, "No me dijiste a quién añadir al equipo.")
      if (matchByName(snap.members, person, m => m.nombre)) return ko(a.op, `${person} ya está en el equipo.`)
      const u = matchByName(snap.users, person, x => x.nombre)
      if (!u) return ko(a.op, `No encuentro a nadie llamado "${person}" en NES.`)
      const role = (a.role ? resolveRole(a.role) : null) ?? "Sin rol definido"
      const { error } = await supabase.from("workflow_roles")
        .upsert({ user_id: u.id, rol: role, updated_at: new Date().toISOString() })
      if (error) return ko(a.op, `No pude añadir a ${u.nombre}: ${error.message}`)
      return ok(a.op, `${u.nombre} añadido al equipo como ${role}.`)
    }

    case "member.remove": {
      const person = toText(a.person, 120)
      if (!person) return ko(a.op, "No me dijiste a quién quitar del equipo.")
      const m = matchByName(snap.members, person, x => x.nombre)
      if (!m) return ko(a.op, `"${person}" no está en el equipo.`)
      // .select() para saber si REALMENTE se borró: sin fila devuelta, RLS lo
      // descartó en silencio y decir "hecho" sería mentir.
      const { data, error } = await supabase.from("workflow_roles")
        .delete().eq("user_id", m.id).select("user_id")
      if (error) return ko(a.op, `No pude quitar a ${m.nombre}: ${error.message}`)
      if (!data || data.length === 0) return ko(a.op, `No tengo permiso para quitar a ${m.nombre} del equipo.`)
      return ok(a.op, `${m.nombre} ya no está en el equipo.`)
    }

    case "member.role": {
      const person = toText(a.person, 120)
      if (!person) return ko(a.op, "No me dijiste de quién cambiar el rol.")
      const m = matchByName(snap.members, person, x => x.nombre)
      if (!m) return ko(a.op, `"${person}" no está en el equipo.`)
      const role = a.role ? resolveRole(a.role) : null
      if (!role) return ko(a.op, `"${a.role}" no es un rol que exista en NES.`)
      const { error } = await supabase.from("workflow_roles")
        .upsert({ user_id: m.id, rol: role, updated_at: new Date().toISOString() })
      if (error) return ko(a.op, `No pude cambiar el rol de ${m.nombre}: ${error.message}`)
      return ok(a.op, `${m.nombre} pasa a ser ${role}.`)
    }
  }
}

/**
 * Ejecuta un lote de acciones en orden. Refresca la foto del workflow entre
 * acciones para que "crea la tarea X" y "muévela a hacer ahora" funcionen en el
 * mismo mensaje.
 */
export async function executeMergeActions(env: MergeActionEnvelope): Promise<MergeActionResult> {
  const outcomes: MergeActionOutcome[] = []
  let snap = await loadWorkflowSnapshot()

  for (const action of env.actions.slice(0, 20)) {
    let outcome: MergeActionOutcome
    try {
      outcome = await runOne(action, snap)
    } catch (e) {
      outcome = ko(action.op, `Algo falló al ejecutar ${action.op}: ${e instanceof Error ? e.message : String(e)}`)
    }
    outcomes.push(outcome)
    if (outcome.ok) snap = await loadWorkflowSnapshot()
  }

  const done = outcomes.filter(o => o.ok).length
  const failed = outcomes.length - done
  const summary = failed === 0
    ? `Hecho: ${done} ${done === 1 ? "cambio" : "cambios"} en tu workflow.`
    : done === 0
      ? "No pude aplicar ningún cambio."
      : `Apliqué ${done} de ${outcomes.length} cambios.`

  return { id: env.id, ok: failed === 0, summary, outcomes }
}

/** Crea en el Backlog la lista de tareas que MERGE propuso y tú validaste. */
export async function saveTaskListToBacklog(
  items: { title: string; note?: string | null; priority?: string | null; assignee?: string | null; due_date?: string | null }[],
): Promise<{ created: number; error: string | null }> {
  const snap = await loadWorkflowSnapshot()
  const rows = items
    .map(it => {
      const title = toText(it.title, 160)
      if (!title) return null
      const m = it.assignee ? matchByName(snap.members, it.assignee, x => x.nombre) : null
      return {
        title,
        description: toText(it.note) ?? "",
        priority: toPriority(it.priority) ?? "Media",
        status: "backlog" as const,
        assignee: m?.id ?? null,
        blocked: false,
        due_date: toDate(it.due_date),
        eisenhower_quadrant: null,
      }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)

  if (!rows.length) return { created: 0, error: "No había ninguna tarea válida que guardar." }
  const { error } = await supabase.from("workflow_tasks").insert(rows)
  if (error) return { created: 0, error: error.message }
  return { created: rows.length, error: null }
}
