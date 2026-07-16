import { useState, type ReactNode } from "react"
import { useFeatureAccess } from "../hooks/useFeatureAccess"
import { FEATURE_INFO } from "../lib/premium"
import UpgradeModal from "./UpgradeModal"

// ──────────────────────────────────────────────────────────────────────────────
// Envuelve una feature premium:
//   <FeatureGated feature="matching_advanced"><MiPanel /></FeatureGated>
// Con el flag inactivo (estado de siembra) todo el mundo ve children.
// Con el flag activo, los usuarios sin tier suficiente ven `fallback` o, por
// defecto, una tarjeta bloqueada que abre el UpgradeModal.
//
// Para páginas enteras se puede combinar con React.lazy a nivel de ruta
// (code splitting); para paneles como este, render condicional basta.
// ──────────────────────────────────────────────────────────────────────────────

type Props = {
  feature: string
  fallback?: ReactNode
  children: ReactNode
}

export default function FeatureGated({ feature, fallback, children }: Props) {
  const { allowed, loading } = useFeatureAccess(feature)

  if (loading) return null
  if (allowed) return <>{children}</>
  return <>{fallback ?? <LockedPanel feature={feature} />}</>
}

// Fallback por defecto: tarjeta bloqueada + modal de upgrade al pulsar
function LockedPanel({ feature }: { feature: string }) {
  const [open, setOpen] = useState(false)
  const info = FEATURE_INFO[feature]

  return (
    <>
      <div
        className="rounded-2xl p-5 text-center"
        style={{
          background:
            "linear-gradient(180deg, rgba(94,106,210,0.07), rgba(94,106,210,0.015) 40%), var(--surface)",
          WebkitBackdropFilter: "blur(16px)",
          backdropFilter: "blur(16px)",
          border: "1px dashed rgba(94,106,210,0.35)",
        }}
      >
        <div className="text-2xl">🔒</div>
        <p className="mt-2 text-sm font-medium" style={{ color: "var(--text)" }}>
          {info?.nombre ?? feature}
        </p>
        <p className="mt-1 text-xs" style={{ color: "var(--text-dim)" }}>
          Esta función forma parte de NES Premium.
        </p>
        <button
          onClick={() => setOpen(true)}
          className="mt-3 rounded-lg px-4 py-2 text-sm font-medium transition hover:opacity-90"
          style={{
            background: "linear-gradient(180deg, #5e6ad2, #4f5ac0)",
            color: "#fff",
          }}
        >
          Ver Premium
        </button>
      </div>
      <UpgradeModal feature={feature} open={open} onClose={() => setOpen(false)} />
    </>
  )
}
