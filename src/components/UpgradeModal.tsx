import { FEATURE_INFO, MONETIZATION_DOC_URL } from "../lib/premium"

// ──────────────────────────────────────────────────────────────────────────────
// Paywall Premium. El CTA está deshabilitado a propósito: los pagos (Stripe
// Connect vía partners) llegan en la Fase 2 — la UI queda lista.
// ──────────────────────────────────────────────────────────────────────────────

type Props = {
  feature?: string // feature bloqueada que provocó el modal
  open: boolean
  onClose: () => void
}

const ACCENT = "#5e6ad2"

export default function UpgradeModal({ feature, open, onClose }: Props) {
  if (!open) return null
  const blocked = feature ? FEATURE_INFO[feature] : null

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 overflow-y-auto"
      style={{
        background: "rgba(8,9,11,0.62)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        animation: "tourOverlayIn 0.3s ease-out",
      }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl overflow-hidden my-8"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border-strong)",
          boxShadow: "0 24px 60px -12px rgba(0,0,0,0.7)",
          animation: "tourCardIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="px-6 pt-6 pb-4 text-center">
          <div
            className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl text-xl"
            style={{
              background: `radial-gradient(circle at 30% 30%, rgba(94,106,210,0.35), rgba(94,106,210,0.08))`,
              border: "1px solid rgba(94,106,210,0.28)",
            }}
          >
            ✦
          </div>
          <h2 className="text-lg font-semibold" style={{ color: "var(--text)" }}>
            NES Premium
          </h2>
          <p className="mt-1 text-sm" style={{ color: "var(--text-dim)" }}>
            {blocked
              ? `«${blocked.nombre}» es una función premium.`
              : "Desbloquea todo el potencial de NoEmprendasSolo."}
          </p>
        </div>

        {/* Tarjetas de features */}
        <div className="grid grid-cols-1 gap-2 px-6 sm:grid-cols-2">
          {Object.entries(FEATURE_INFO).map(([key, info]) => {
            const isBlocked = key === feature
            return (
              <div
                key={key}
                className="rounded-xl p-3"
                style={{
                  background: isBlocked
                    ? `linear-gradient(180deg, rgba(94,106,210,0.10), rgba(94,106,210,0.03)), var(--surface)`
                    : "var(--surface-3)",
                  border: `1px solid ${isBlocked ? "rgba(94,106,210,0.30)" : "var(--border)"}`,
                  boxShadow: isBlocked ? "0 0 0 1px rgba(94,106,210,0.12)" : "none",
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{info.emoji}</span>
                  <span className="text-sm font-medium" style={{ color: "var(--text)" }}>
                    {info.nombre}
                  </span>
                  {isBlocked && (
                    <span
                      className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium"
                      style={{ background: "rgba(94,106,210,0.16)", color: "#9aa4f0" }}
                    >
                      bloqueada
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--text-dim)" }}>
                  {info.descripcion}
                </p>
              </div>
            )
          })}
        </div>

        {/* CTA */}
        <div className="px-6 pt-5 pb-4">
          <button
            disabled
            className="w-full rounded-lg py-2.5 text-sm font-medium cursor-not-allowed disabled:opacity-40"
            style={{
              background: `linear-gradient(180deg, ${ACCENT}, #4f5ac0)`,
              color: "#fff",
            }}
            title="Los pagos llegan pronto"
          >
            Upgrade — Próximamente
          </button>
          <button
            onClick={onClose}
            className="btn-linear mt-2 w-full rounded-lg py-2 text-sm"
            style={{ color: "var(--text-dim)" }}
          >
            Seguir con el plan gratuito
          </button>
        </div>

        {/* Footer transparencia */}
        <div
          className="px-6 py-3 text-center text-[11px]"
          style={{ borderTop: "1px solid var(--border)", color: "var(--text-dimmer)" }}
        >
          {MONETIZATION_DOC_URL ? (
            <a
              href={MONETIZATION_DOC_URL}
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-white transition"
            >
              Cómo funciona la monetización de NES →
            </a>
          ) : (
            <span>Los pagos aún no están activos. Nadie puede cobrarte todavía.</span>
          )}
        </div>
      </div>
    </div>
  )
}
