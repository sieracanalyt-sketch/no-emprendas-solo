import { useNavigate } from "react-router-dom"
import { useUserTier } from "../hooks/useUserTier"
import JarvisHud from "../jarvis/JarvisHud"

// El cockpit de voz de JARVIS (AIOS) — puesto de mando del fundador. Solo admin.
// El agente Python (cerebro) corre en la máquina del fundador y se une a la misma
// sala de LiveKit automáticamente.
export default function Jarvis() {
  const { isAdmin, loading } = useUserTier()
  const navigate = useNavigate()

  if (loading) return null
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <div className="text-3xl">🔒</div>
        <p className="mt-3 text-base font-medium" style={{ color: "var(--text)" }}>
          JARVIS AIOS es el puesto de mando del fundador
        </p>
        <p className="mt-1 text-sm" style={{ color: "var(--text-dim)" }}>
          Esta vista está reservada a la administración de NES.
        </p>
      </div>
    )
  }

  return <JarvisHud onClose={() => navigate("/explorar")} />
}
