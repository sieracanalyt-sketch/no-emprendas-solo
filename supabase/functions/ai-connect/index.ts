// ──────────────────────────────────────────────────────────────────────────────
// NES CONNECT IA — Edge Function que busca fundadores compatibles con Gemini Flash.
//
// La clave de Gemini vive en el secret GEMINI_API_KEY de Supabase (nunca llega
// al navegador). El cliente envía su búsqueda + los perfiles candidatos y la
// función devuelve una lista ordenada de matches con motivo y encaje sugerido.
//
// Respuesta 200 siempre:
//   { matches: [{ id, score, reason, fit }] }
//   { error: "no_api_key" | "bad_request" | "gemini_error" }  → el cliente hace
//   fallback al algoritmo local.
//
// Secrets: GEMINI_API_KEY (obligatorio), GEMINI_MODEL (opcional, por defecto
// gemini-2.5-flash).
// ──────────────────────────────────────────────────────────────────────────────
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

type Candidate = {
  id: string
  nombre?: string | null
  biografia?: string | null
  proyecto?: string | null
  buscando?: string[] | null
  role?: string | null
  project_status?: string | null
  streak_days?: number | null
}

type Payload = {
  me?: Candidate | null
  search: {
    joinProject: boolean
    projectType?: string
    roles?: string
    personInfo?: string
  }
  candidates: Candidate[]
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    matches: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "id exacto del candidato, copiado tal cual" },
          score: { type: "integer", description: "afinidad honesta 0-100" },
          reason: { type: "string", description: "1 frase en español explicando por qué encaja, citando datos reales del perfil" },
          fit: { type: "string", description: "rol o encaje sugerido, 2-4 palabras" },
        },
        required: ["id", "score", "reason"],
      },
    },
  },
  required: ["matches"],
}

function projectStatusLabel(status: string | null | undefined): string {
  if (status === "has_project") return "tiene proyecto propio en marcha"
  if (status === "no_project")  return "no tiene proyecto definido aún"
  if (status === "looking")     return "busca unirse al proyecto de otra persona"
  return "estado de proyecto no especificado"
}

// Recorta los campos para mantener el prompt compacto y sin datos sensibles.
function clean(c: Candidate) {
  return {
    id: c.id,
    nombre: (c.nombre ?? "").slice(0, 80),
    biografia: (c.biografia ?? "").slice(0, 500),
    proyecto: (c.proyecto ?? "").slice(0, 200),
    rol: (c.role ?? "").slice(0, 60),
    busca: (c.buscando ?? []).slice(0, 10),
    estado_proyecto: projectStatusLabel(c.project_status),
    racha_dias: c.streak_days ?? 0,
  }
}

const NES_CONTEXT = `Eres el motor de matchmaking de "No Emprendas Solo" (NES), una red social española de fundadores y emprendedores que quieren encontrar cofundadores, socios y colaboradores.

SOBRE NES:
NES conecta fundadores que quieren emprender en equipo. La idea central es que nadie debería emprender solo: necesitas personas complementarias a ti. Los perfiles incluyen técnicos (CTO, dev), negocio (CEO, CMO, ventas), diseñadores, marketers, product managers, etc.

SIGNIFICADO DE CADA CAMPO DEL PERFIL:
- "nombre": nombre visible del fundador en la plataforma
- "biografia": presentación personal con habilidades, experiencia y motivación (texto libre)
- "proyecto": descripción de su proyecto o idea de startup
- "rol": su rol principal en el equipo según el Workflow de NES (ej: CEO, CTO, CMO, Diseñador, Dev Full-stack, Marketing, Ventas, Ops, etc.)
- "busca": array de tags con los tipos de perfiles que busca para su equipo (ej: ["CTO", "Diseñador UI/UX", "Marketing Digital"])
- "estado_proyecto":
    "tiene proyecto propio en marcha" → emprendedor activo que busca socios o equipo para su proyecto
    "busca unirse al proyecto de otra persona" → tiene habilidades pero quiere sumarse a algo existente
    "no tiene proyecto definido aún" → está explorando, puede ir a cualquier lado
- "racha_dias": días consecutivos de actividad reciente en NES (0 = inactivo/recién llegado, 7+ = comprometido, 30+ = muy activo)

LÓGICA DE MATCHING:
- Un buen match es cuando lo que YO busco (campo "busca") coincide con el rol/habilidades del candidato, Y lo que el candidato busca coincide con mi perfil.
- Si el buscador quiere UNIRSE a un proyecto: prioriza candidatos con estado_proyecto = "tiene proyecto propio en marcha" y cuyo proyecto sea del tipo buscado; verifica que el candidato busque el perfil que el buscador ofrece.
- Si el buscador busca PERSONAS concretas: cruza la descripción con la biografia, proyecto y rol del candidato.
- Mayor racha_dias = mayor compromiso con la plataforma → ligero bonus de fiabilidad.
- Racha_dias = 0 → puede ser recién llegado (no penalizar fuerte) o inactivo (penalizar si tiene perfil antiguo vacío).`

Deno.serve(async (req: Request) => {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...CORS, "Content-Type": "application/json" },
    })

  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })
  if (req.method !== "POST") return json({ error: "bad_request" }, 405)

  const apiKey = Deno.env.get("GEMINI_API_KEY")
  if (!apiKey) return json({ error: "no_api_key" })

  let payload: Payload
  try {
    payload = await req.json()
  } catch {
    return json({ error: "bad_request" }, 400)
  }

  const candidates = Array.isArray(payload?.candidates)
    ? payload.candidates.filter((c) => c && typeof c.id === "string")
    : []
  const search = payload?.search
  if (!search || candidates.length === 0) return json({ matches: [] })

  const objective = search.joinProject
    ? `El usuario quiere UNIRSE a un proyecto existente de otra persona.
- Tipo de proyecto al que quiere unirse: ${search.projectType || "(no especificado)"}
- Habilidades o funciones que puede aportar al equipo: ${search.roles || "(no especificado)"}
→ Prioriza candidatos con estado_proyecto = "tiene proyecto propio en marcha" cuyo proyecto coincida con lo buscado. Comprueba que ese candidato busque el perfil que el buscador ofrece.`
    : `El usuario busca PERSONAS CONCRETAS para conectar o incorporar a su equipo.
- Descripción de la persona que busca: ${search.personInfo || "(no especificado)"}
→ Cruza esta descripción con la "biografia", "proyecto" y "rol" de los candidatos. También mira si el candidato tiene en su campo "busca" tags que encajen con el perfil del buscador.`

  const meInfo = payload.me
    ? `PERFIL DEL USUARIO QUE BUSCA:
${JSON.stringify(clean(payload.me))}

`
    : ""

  const prompt = `${NES_CONTEXT}

${meInfo}OBJETIVO DE LA BÚSQUEDA:
${objective}

CANDIDATOS REALES DE LA COMUNIDAD NES (los únicos válidos; copia el campo "id" exactamente):
${JSON.stringify(candidates.map(clean))}

INSTRUCCIONES FINALES:
- Devuelve SOLO los candidatos que encajen de verdad (máximo 6). Si nadie encaja bien, devuelve lista vacía.
- "score": afinidad honesta 0-100. No infles; descarta matches débiles (<40).
- "reason": 1 frase natural en español citando datos REALES del perfil del candidato (su proyecto, rol, bio, o lo que busca). Nunca inventes datos.
- "fit": el rol o valor que esa persona aporta a esta búsqueda concreta (2-4 palabras).
- Ordena de mayor a menor score.
- NUNCA inventes ids ni crees personas ficticias.`

  const model = Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash"

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
            responseSchema: RESPONSE_SCHEMA,
          },
        }),
      },
    )

    if (!res.ok) {
      const detail = await res.text()
      console.error("gemini_error", res.status, detail.slice(0, 500))
      return json({ error: "gemini_error", status: res.status })
    }

    const data = await res.json()
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}"
    let parsed: { matches?: unknown }
    try {
      parsed = JSON.parse(text)
    } catch {
      console.error("gemini_error: respuesta no es JSON", text.slice(0, 300))
      return json({ error: "gemini_error" })
    }

    // Sanea: solo ids reales, sin duplicados, scores 0-100, máx. 6.
    const valid = new Set(candidates.map((c) => c.id))
    const seen = new Set<string>()
    const matches = (Array.isArray(parsed.matches) ? parsed.matches : [])
      // deno-lint-ignore no-explicit-any
      .filter((m: any) => {
        if (!m || typeof m.id !== "string" || !valid.has(m.id) || seen.has(m.id)) return false
        seen.add(m.id)
        return true
      })
      // deno-lint-ignore no-explicit-any
      .map((m: any) => ({
        id: m.id,
        score: Math.max(0, Math.min(100, Math.round(Number(m.score) || 0))),
        reason: String(m.reason ?? "").slice(0, 220),
        fit: m.fit ? String(m.fit).slice(0, 60) : undefined,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)

    return json({ matches })
  } catch (e) {
    console.error("ai-connect error", e)
    return json({ error: "gemini_error" })
  }
})
