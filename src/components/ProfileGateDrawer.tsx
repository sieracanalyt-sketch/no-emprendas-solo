import { useNavigate } from "react-router-dom"
import type { ProfileCheck } from "../lib/profileCompletion"

type Props = {
  check: ProfileCheck
  open: boolean
  onClose: () => void
}

export default function ProfileGateDrawer({ check, open, onClose }: Props) {
  const navigate = useNavigate()

  if (!open) return null

  const firstIncomplete = check.items.find((i) => !i.ok)

  const handleComplete = () => {
    onClose()
    navigate("/perfil", { state: { focusField: firstIncomplete?.key } })
  }

  return (
    <>
      {/* Overlay */}
      <div className="gate-overlay" onClick={onClose} aria-hidden="true" />

      {/* Drawer — bottom sheet (mobile) / side panel (desktop) */}
      <div className="gate-drawer" role="dialog" aria-modal="true" aria-label="Completa tu perfil">
        {/* Handle (visible solo en mobile) */}
        <div className="gate-handle" />

        <div className="gate-content">
          {/* Header */}
          <div className="mb-5">
            <h2 className="text-[17px] font-semibold leading-snug" style={{ color: "#f0ede4" }}>
              Completa tu perfil para conectar
            </h2>
            <p className="text-[13px] mt-1.5" style={{ color: "#c7c2b3" }}>
              Las personas responden mejor a perfiles completos.
            </p>
          </div>

          {/* Checklist */}
          <div className="space-y-3 mb-6">
            {check.items.map((item) => (
              <div key={item.key} className="flex items-start gap-3">
                {/* Icono 16px */}
                <span className="shrink-0 mt-[1px]">
                  {item.ok ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9a9d78" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M8 12l3 3 5-6" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                    </svg>
                  )}
                </span>

                <span className="text-[13.5px] leading-snug" style={{ color: item.ok ? "#f0ede4" : "#b4bcd0" }}>
                  {item.label}
                  {item.key === "biografia" && item.detail && !item.ok && (
                    <span className="ml-2 text-[11.5px]" style={{ color: "#8f8b7c" }}>
                      {item.detail}
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>

          {/* CTA primario */}
          <button
            onClick={handleComplete}
            className="w-full py-2.5 rounded-lg text-[14px] font-semibold text-t1 transition"
            style={{ background: "linear-gradient(180deg,#c2542f,#a34420)" }}
            onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(1.08)")}
            onMouseLeave={(e) => (e.currentTarget.style.filter = "brightness(1)")}
          >
            Completar perfil ahora
          </button>

          {/* CTA secundario */}
          <button
            onClick={onClose}
            className="w-full mt-3 py-1.5 text-[13px] transition"
            style={{ color: "#c7c2b3", background: "none", border: "none", cursor: "pointer" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#f0ede4")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#c7c2b3")}
          >
            Quizás más tarde
          </button>
        </div>
      </div>
    </>
  )
}
