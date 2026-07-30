# MERGE ⇄ Workflow — contrato de acciones

Cómo MERGE cambia el tablero de NES sin tocar la base de datos.

## La idea

MERGE **no escribe en Supabase**. Publica una intención por un data-topic de
LiveKit y **la app la ejecuta en el navegador con la sesión del usuario**, así que
se aplican exactamente las mismas políticas RLS que si el fundador hubiera pulsado
los botones a mano. Consecuencias buenas:

- El agente no necesita ni un permiso extra en la base de datos.
- Si el usuario no puede hacer algo, MERGE tampoco. No hay escalada de privilegios.
- Todo lo que hace queda reflejado en el tablero en tiempo real y a la vista, en
  el panel "MERGE ha tocado tu workflow".

Lado cliente ya implementado:

| Pieza | Archivo |
| --- | --- |
| Tipos y validación del payload | `src/jarvis/contract.ts` |
| Recepción por el data-channel | `src/jarvis/useJarvisRoom.ts` |
| Ejecución contra Supabase | `src/jarvis/workflowAgent.ts` |
| Interfaz (feed de cambios, lista de tareas) | `src/jarvis/JarvisHud.tsx` |

**Falta el lado agente**: hay que darle a MERGE una tool que publique en el topic
`merge.action`. Hasta que exista, la app está lista pero nadie le pide nada.

## Topics

| Topic | Sentido | Contenido |
| --- | --- | --- |
| `merge.context` | app → agente | Agenda, workflow y `acciones_disponibles` |
| `merge.action` | agente → app | Acciones a ejecutar |
| `merge.action.result` | app → agente | Qué salió bien y qué no |
| `aios.render` | agente → app | Paneles, incluido `aios.tasklist` |

## Petición (`merge.action`)

```json
{
  "v": 1,
  "id": "req-42",
  "actions": [
    { "op": "task.move", "task": "rediseñar la landing", "status": "progress" },
    { "op": "member.add", "person": "Marta", "role": "Diseñador UX / UI" }
  ]
}
```

También se acepta una acción suelta sin envoltorio. Máximo 20 por lote, se
ejecutan en orden y el estado se relee entre acciones (así "crea X" y luego
"mueve X" funcionan en el mismo mensaje).

### Operaciones

| `op` | Campos | Nota |
| --- | --- | --- |
| `task.create` | `title`, `description?`, `priority?`, `status?`, `assignee?`, `due_date?` | Sin `status`, va a `backlog` |
| `task.update` | `task`, y cualquiera de `title`/`description`/`priority`/`status`/`assignee`/`due_date`/`blocked` | `due_date: null` borra la fecha |
| `task.move` | `task`, `status` | |
| `task.quadrant` | `task`, `quadrant` | Ajusta prioridad y saca del backlog si pasa a urgente |
| `task.delete` | `task` | |
| `member.add` | `person`, `role?` | `person` debe existir como usuario de NES |
| `member.remove` | `person` | |
| `member.role` | `person`, `role` | |

- `status`: `backlog` · `progress` · `review` · `done`. Acepta también castellano
  ("en progreso", "revisión", "completado", "hecho"…).
- `priority`: `Urgente` · `Alta` · `Media` · `Baja` (sin distinguir mayúsculas).
- `quadrant`: `1` hacer ahora · `2` planificar · `3` delegar · `4` eliminar.
  También por nombre ("planificar").
- `due_date`: `YYYY-MM-DD`.
- `task`, `person` y `role` van **por nombre**, no por uuid: MERGE conoce "Marta"
  y "la landing". El cliente los resuelve ignorando acentos y mayúsculas, por
  coincidencia exacta → prefijo → contenido → palabras en común. Si hay empate
  entre varios candidatos no adivina: devuelve un fallo explicando que no
  encuentra a qué te refieres, y ahí MERGE debe preguntar.

## Respuesta (`merge.action.result`)

```json
{
  "id": "req-42",
  "ok": false,
  "summary": "Apliqué 1 de 2 cambios.",
  "outcomes": [
    { "op": "task.move", "ok": true,  "message": "\"Rediseñar la landing\" movida a En Progreso." },
    { "op": "member.add", "ok": false, "message": "No encuentro a nadie llamado \"Marta\" en NES." }
  ]
}
```

Cada `message` está escrito para poder decirse en voz alta tal cual. MERGE
debería confirmar lo que salió bien y explicar lo que no, sin inventarse un
"hecho" cuando `ok` es `false`.

## Lista de tareas interactiva (`aios.tasklist`)

Para cuando el fundador piensa en voz alta y quiere ver la lista al terminar:

```json
{
  "type": "aios.tasklist",
  "v": 1,
  "ts": 1753900000,
  "data": {
    "title": "Lo que has dicho que tienes que hacer",
    "intro": "Marca las que valgan y las guardo en tu Backlog.",
    "items": [
      { "title": "Llamar al gestor", "note": "antes del viernes", "priority": "Alta" },
      { "title": "Cerrar el copy de la home", "assignee": "Marta", "due_date": "2026-08-04" }
    ]
  }
}
```

Se pinta con casillas: el usuario desmarca lo que no quiera y pulsa "Guardar en
Backlog". Entran en `workflow_tasks` con `status: "backlog"`. Si no guarda nada,
la lista simplemente desaparece con el siguiente panel — es desechable a propósito.

## Nota sobre RLS

`workflow_roles` tenía políticas de SELECT / INSERT / UPDATE pero **no de DELETE**.
Con RLS activo y sin política, Postgres no da error: no encuentra filas que borrar
y devuelve éxito con cero filas. Por eso "Quitar del equipo" parecía funcionar y
el miembro reaparecía al recargar. Arreglado en
`supabase/migrations/20260730120000_workflow_roles_delete_policy.sql`.

Tanto la app como el ejecutor de MERGE encadenan `.select()` a los borrados para
distinguir "borrado" de "descartado en silencio". Si alguna vez vuelve a faltar
una política, se verá como un error en vez de como una mentira.
