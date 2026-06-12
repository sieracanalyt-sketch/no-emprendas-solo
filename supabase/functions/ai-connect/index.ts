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
          reason: { type: "string", description: "1 frase en español explicando por qué encaja" },
          fit: { type: "string", description: "rol o encaje sugerido, 2-4 palabras" },
        },
        required: ["id", "score", "reason"],
      },
    },
  },
  required: ["matches"],
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
  }
}

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
    ? `Quiere UNIRSE a un proyecto existente.
- Tipo de proyecto al que quiere unirse: ${search.projectType || "(no especificado)"}
- Funciones que puede desempeñar en ese equipo: ${search.roles || "(no especificado)"}
Prioriza fundadores que tengan un proyecto de ese tipo y que busquen perfiles como el suyo.`
    : `Busca PERSONAS concretas para conectar (no unirse a un proyecto).
- Descripción de la persona que busca: ${search.personInfo || "(no especificado)"}
Prioriza candidatos cuyo rol, habilidades o biografía coincidan con esa descripción.`

  const prompt = `Eres el motor de matchmaking de "No Emprendas Solo", una red social de emprendedores.

PERFIL DEL USUARIO QUE BUSCA:
${JSON.stringify(payload.me ? clean(payload.me) : null)}

OBJETIVO DE LA BÚSQUEDA:
${objective}

CANDIDATOS REALES (los únicos válidos; usa su campo "id" copiado tal cual):
${JSON.stringify(candidates.map(clean))}

INSTRUCCIONES:
- Devuelve SOLO candidatos que encajen de verdad con el objetivo (máximo 6). Si nadie encaja, devuelve la lista vacía.
- "score": afinidad honesta 0-100. No infles puntuaciones; descarta encajes débiles (<40).
- "reason": 1 frase natural en español citando datos reales del candidato (su proyecto, rol o habilidades).
- "fit": el rol o encaje que esa persona aporta a esta búsqueda (2-4 palabras).
- Ordena de mayor a menor score. No inventes ids ni personas.`

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
