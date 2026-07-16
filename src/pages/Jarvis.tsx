import { useUserTier } from "../hooks/useUserTier"
import MergeConsole from "../jarvis/JarvisHud"

// MERGE — asistente de voz del fundador, embebido en NES (solo admin).
// El agente (cerebro) corre en la máquina del fundador y se une a la misma
// sala de LiveKit automáticamente.
export default function Merge() {
  const { isAdmin, loading } = useUserTier()

  if (loading) return null
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <div className="text-3xl">🔒</div>
        <p className="mt-3 text-base font-medium" style={{ color: "var(--text)" }}>
          MERGE es el puesto de mando del fundador
        </p>
        <p className="mt-1 text-sm" style={{ color: "var(--text-dim)" }}>
          Esta vista está reservada a la administración de NES.
        </p>
      </div>
    )
  }

  return <MergeConsole />
}
