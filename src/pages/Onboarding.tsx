import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../supabase"
import { useUser } from "../hooks/useUser"
import { markOnboardingDone } from "../lib/onboardingStatus"
import type { Stage } from "../lib/config/nucleos"

// ──────────────────────────────────────────────────────────────────────────────
// Onboarding — dos pantallas, sin barra de progreso y sin campos opcionales.
//
// Termina llamando a `assign_nucleo`: nadie sale de aquí sin núcleo. Por eso
// `operating_level` no puede quedar en null — es lo que decide en qué núcleo
// entras, y la función lo exige.
// ──────────────────────────────────────────────────────────────────────────────

const SECTORES = [
  "SaaS", "E-commerce", "Educación", "Salud", "Fintech", "Inmobiliario",
  "Alimentación", "Moda", "Contenido y medios", "Servicios profesionales",
  "Industria", "Turismo", "Deporte", "Sostenibilidad", "IA", "Otro",
]

type Paso = 1 | 2

export default function Onboarding() {
  const [user] = useUser()
  const navigate = useNavigate()

  const [paso, setPaso] = useState<Paso>(1)
  const [hasProject, setHasProject] = useState<boolean | null>(null)
  const [projectStage, setProjectStage] = useState<Stage | null>(null)
  const [experiencia, setExperiencia] = useState<Stage | null>(null)
  const [seekingPartner, setSeekingPartner] = useState(false)
  const [openToJoin, setOpenToJoin] = useState(false)
  const [soloHablar, setSoloHablar] = useState(false)
  const [sector, setSector] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")

  const operatingLevel: Stage | null = hasProject ? projectStage : experiencia
  const paso1Listo = operatingLevel !== null
  const paso2Listo = (seekingPartner || openToJoin || soloHablar) && sector.trim() !== ""

  const terminar = async () => {
    if (!user || !operatingLevel || guardando) return
    setGuardando(true)
    setError("")

    // Upsert y no update: `saveUser` crea la fila de forma diferida al iniciar
    // sesión, y un update que no encuentra fila no da error — se quedaría sin
    // `operating_level` y `assign_nucleo` fallaría después sin explicar por qué.
    const { error: updateError } = await supabase
      .from("users")
      .upsert(
        {
          id: user.id,
          email: user.email ?? null,
          has_project: hasProject === true,
          // La restricción `profile_stage_coherent` exige que si no hay
          // proyecto, la fase del proyecto sea null.
          project_stage: hasProject ? projectStage : null,
          operating_level: operatingLevel,
          seeking_partner: hasProject ? seekingPartner : false,
          open_to_join: openToJoin,
          sector: sector.trim(),
          onboarding_done_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      )

    if (updateError) {
      setGuardando(false)
      setError("No se pudo guardar tu perfil. Inténtalo de nuevo.")
      return
    }

    const { error: rpcError } = await supabase.rpc("assign_nucleo")
    if (rpcError) {
      setGuardando(false)
      setError("Tu perfil se guardó, pero no pudimos asignarte núcleo. Recarga e inténtalo.")
      return
    }

    markOnboardingDone(user.id)
    navigate("/chats", { replace: true })
  }

  return (
    <div className="w-full min-h-screen flex items-start justify-center px-4 py-16">
      <div className="w-full max-w-2xl">
        {paso === 1 ? (
          <section>
            <h1 className="text-2xl font-bold" style={{ color: "var(--t1)" }}>
              ¿Tienes un proyecto?
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--t3)" }}>
              Con esto te colocamos en tu núcleo. No se puede cambiar sobre la marcha,
              así que responde por dónde estás de verdad.
            </p>

            <div className="grid grid-cols-2 gap-3 mt-7">
              <Opcion
                label="Sí"
                activa={hasProject === true}
                onClick={() => { setHasProject(true); setExperiencia(null) }}
              />
              <Opcion
                label="No"
                activa={hasProject === false}
                onClick={() => { setHasProject(false); setProjectStage(null) }}
              />
            </div>

            {hasProject === true && (
              <Bloque titulo="¿En qué punto está?">
                <Opcion label="Es una idea, aún no la he empezado"
                  activa={projectStage === "ideacion"} onClick={() => setProjectStage("ideacion")} />
                <Opcion label="Ya lo estoy construyendo"
                  activa={projectStage === "aplicacion"} onClick={() => setProjectStage("aplicacion")} />
                <Opcion label="Ya está facturando"
                  activa={projectStage === "facturacion"} onClick={() => setProjectStage("facturacion")} />
              </Bloque>
            )}

            {hasProject === false && (
              <Bloque titulo="¿Qué has hecho antes?">
                <Opcion label="Estoy empezando de cero"
                  activa={experiencia === "ideacion"} onClick={() => setExperiencia("ideacion")} />
                <Opcion label="He trabajado en proyectos de otros"
                  activa={experiencia === "aplicacion"} onClick={() => setExperiencia("aplicacion")} />
                <Opcion label="He llevado un proyecto o cliente que facturaba"
                  activa={experiencia === "facturacion"} onClick={() => setExperiencia("facturacion")} />
              </Bloque>
            )}

            <button
              onClick={() => setPaso(2)}
              disabled={!paso1Listo}
              className="btn-linear w-full mt-8 py-3 text-sm font-medium rounded-full disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continuar
            </button>
          </section>
        ) : (
          <section>
            <button
              onClick={() => setPaso(1)}
              className="text-sm mb-6 transition-colors"
              style={{ color: "var(--t3)" }}
            >
              ← Atrás
            </button>

            <h1 className="text-2xl font-bold" style={{ color: "var(--t1)" }}>
              ¿Qué buscas?
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--t3)" }}>
              Marca todo lo que aplique. Al menos una.
            </p>

            <div className="flex flex-col gap-3 mt-7">
              {hasProject && (
                <Opcion
                  label="Un socio para mi proyecto"
                  activa={seekingPartner}
                  onClick={() => setSeekingPartner((v) => !v)}
                />
              )}
              <Opcion
                label="Unirme al proyecto de otra persona"
                activa={openToJoin}
                onClick={() => setOpenToJoin((v) => !v)}
              />
              <Opcion
                label="Gente con la que hablar mientras construyo"
                activa={soloHablar}
                onClick={() => setSoloHablar((v) => !v)}
              />
            </div>

            <Bloque titulo="¿En qué sector?">
              <input
                list="sectores-nes"
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                placeholder="Escribe el tuyo o elige uno"
                className="field-input w-full px-4 py-3 rounded-xl text-sm"
              />
              <datalist id="sectores-nes">
                {SECTORES.map((s) => <option key={s} value={s} />)}
              </datalist>
              <p className="text-xs mt-2" style={{ color: "var(--t3)" }}>
                El sector no te agrupa ni te bloquea: solo sirve para que tu núcleo
                no sea seis personas del mismo nicho.
              </p>
            </Bloque>

            {error && (
              <p className="text-sm mt-5" style={{ color: "var(--danger)" }} role="alert">
                {error}
              </p>
            )}

            <button
              onClick={terminar}
              disabled={!paso2Listo || guardando}
              className="btn-linear w-full mt-8 py-3 text-sm font-medium rounded-full disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {guardando ? "Asignándote núcleo…" : "Entrar en mi núcleo"}
            </button>
          </section>
        )}
      </div>
    </div>
  )
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="mt-8">
      <h2 className="text-sm font-medium mb-3" style={{ color: "var(--t2)" }}>{titulo}</h2>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  )
}

function Opcion({
  label, activa, onClick,
}: { label: string; activa: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={activa}
      className="w-full text-left px-4 py-3 rounded-xl text-sm transition-all duration-[180ms]"
      style={{
        background: activa ? "rgba(var(--accent-rgb), 0.12)" : "var(--surface)",
        border: `1px solid ${activa ? "var(--accent)" : "var(--border)"}`,
        color: activa ? "var(--t1)" : "var(--t2)",
      }}
      onMouseEnter={(e) => {
        if (!activa) e.currentTarget.style.borderColor = "var(--border-hover)"
      }}
      onMouseLeave={(e) => {
        if (!activa) e.currentTarget.style.borderColor = "var(--border)"
      }}
    >
      {label}
    </button>
  )
}
