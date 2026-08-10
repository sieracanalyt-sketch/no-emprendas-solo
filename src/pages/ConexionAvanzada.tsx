import { useState } from "react"
import { useUser } from "../hooks/useUser"
import { useUserTier } from "../hooks/useUserTier"
import AdvancedMatchProfile from "../components/AdvancedMatchProfile"
import AdvancedMatchPanel from "../components/AdvancedMatchPanel"
import UpgradeModal from "../components/UpgradeModal"

// ──────────────────────────────────────────────────────────────────────────────
// Página /conexion-avanzada — el matchmaking avanzado (premium).
//   · free  → teaser + upsell (UpgradeModal, feature="matching_advanced")
//   · premium/trial/admin → editar perfil de frameworks + ver conexiones reales
// ──────────────────────────────────────────────────────────────────────────────

// Los cuatro pilares del nuevo motor (doc de investigación NES): alineación por
// encima de similitud, complementariedad de rol, fiabilidad, y cero tests raros.
const PILLARS = [
  { name: "Alineación", desc: "Misma ambición y mismo compromiso real: lo que hace que un equipo dure." },
  { name: "Complementariedad", desc: "Lo que tú necesitas es justo lo que la otra persona tiene." },
  { name: "Fiabilidad", desc: "Gente que cumple lo que promete. Es lo que más predice que aguante." },
  { name: "Sin tests raros", desc: "9 preguntas de conducta real, no un examen de personalidad." },
]

export default function ConexionAvanzada() {
  const [user] = useUser()
  const { tier, isAdmin, trialUntil, loading } = useUserTier()
  const [showUpgrade, setShowUpgrade] = useState(false)

  const isPremium =
    isAdmin || tier === "premium" || (trialUntil ? trialUntil.getTime() > Date.now() : false)

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="mb-2 flex items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text)" }}>
          Matchmaking avanzado
        </h1>
        <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
          style={{ background: "rgba(194, 84, 47,0.15)", color: "var(--accent)" }}>Premium</span>
      </div>
      <p className="mb-6 text-sm" style={{ color: "var(--text-dim)" }}>
        Conexiones basadas en la evidencia de qué hace durar a los equipos fundadores — no en tener buen rollo.
      </p>

      {/* pilares del motor */}
      <div className="mb-7 grid gap-2 sm:grid-cols-2">
        {PILLARS.map((b) => (
          <div key={b.name} className="rounded-xl p-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="text-sm font-semibold" style={{ color: "var(--accent)" }}>{b.name}</div>
            <div className="text-xs" style={{ color: "var(--text-dim)" }}>{b.desc}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="text-sm" style={{ color: "var(--text-dim)" }}>Cargando…</div>
      ) : !isPremium ? (
        <div className="rounded-2xl p-8 text-center" style={{
          background: "linear-gradient(180deg, rgba(194, 84, 47,0.08), transparent 60%), var(--surface)",
          WebkitBackdropFilter: "blur(16px)",
          backdropFilter: "blur(16px)",
          border: "1px dashed rgba(194, 84, 47,0.35)",
        }}>
          <div className="text-3xl">🔒</div>
          <p className="mt-3 text-base font-medium" style={{ color: "var(--text)" }}>
            El matchmaking avanzado es una función Premium
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm" style={{ color: "var(--text-dim)" }}>
            Responde 9 preguntas rápidas de conducta real y deja que la IA cruce toda la red para encontrar tus mejores co-fundadores.
          </p>
          <button onClick={() => setShowUpgrade(true)}
            className="mt-4 rounded-lg px-5 py-2.5 text-sm font-medium text-t1 transition hover:opacity-90"
            style={{ background: "linear-gradient(180deg, #c2542f, #a34420)" }}>
            Ver Premium
          </button>
          <UpgradeModal feature="matching_advanced" open={showUpgrade} onClose={() => setShowUpgrade(false)} />
        </div>
      ) : !user ? (
        <div className="text-sm" style={{ color: "var(--text-dim)" }}>Inicia sesión para ver tus conexiones.</div>
      ) : (
        <div className="space-y-10">
          <section>
            <h2 className="mb-4 text-lg font-semibold" style={{ color: "var(--text)" }}>Tu perfil avanzado</h2>
            <AdvancedMatchProfile userId={user.id} />
          </section>
          <section>
            <h2 className="mb-4 text-lg font-semibold" style={{ color: "var(--text)" }}>Conexiones sugeridas</h2>
            <AdvancedMatchPanel userId={user.id} />
          </section>
        </div>
      )}
    </div>
  )
}
