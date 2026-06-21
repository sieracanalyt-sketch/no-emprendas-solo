import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { supabase } from "../supabase"
import { useProfileMetrics } from "../hooks/useProfileMetrics"
import ProfileStats, { RankPill } from "../components/ProfileStats"

type UserData = {
  nombre?: string
  biografia?: string
  proyecto?: string
  buscando?: string[]
}

export default function PerfilPublico() {
  const { id } = useParams()
  const [userData, setUserData] = useState<UserData | null>(null)
  const { metrics } = useProfileMetrics(id)

  useEffect(() => {
    let cancelled = false
    const cargar = async () => {
      const { data } = await supabase
        .from("users")
        .select("nombre, biografia, proyecto, buscando")
        .eq("id", id)
        .single()
      if (!cancelled && data) setUserData(data)
    }
    setUserData(null)
    cargar()
    return () => { cancelled = true }
  }, [id])

  if (!userData)
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-white/40 text-sm">Cargando…</p>
      </div>
    )

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-5 mb-7">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white/70 shrink-0"
          style={{ background: "rgba(255,255,255,0.1)" }}
        >
          {userData.nombre?.[0]?.toUpperCase() ?? "?"}
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-white">
            {userData.nombre || "Usuario"}
          </h1>
          <div>
            <RankPill connections={metrics.connections} />
          </div>
        </div>
      </div>

      {/* ── Métricas de gamificación ────────────────────────────────────── */}
      <div className="mb-6">
        <ProfileStats metrics={metrics} />
      </div>

      <div
        className="rounded-xl divide-y overflow-hidden"
        style={{ border: "1px solid rgba(255,255,255,0.07)" }}
      >
        <InfoRow label="Biografía" value={userData.biografia || "Sin biografía"} />
        <InfoRow label="Proyecto" value={userData.proyecto || "Sin proyecto"} />

        <div className="px-5 py-4" style={{ background: "rgba(255,255,255,0.03)" }}>
          <p className="text-[11px] font-medium text-white/40 uppercase tracking-wider mb-3">
            Busca
          </p>
          {userData.buscando && userData.buscando.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {userData.buscando.map((tag, i) => (
                <span
                  key={i}
                  className="text-xs text-white px-3 py-1 rounded-full"
                  style={{
                    background: "rgba(255,255,255,0.1)",
                    border: "1px solid rgba(255,255,255,0.12)",
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-white/30 text-sm">No ha especificado nada</p>
          )}
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-5 py-4" style={{ background: "rgba(255,255,255,0.03)" }}>
      <p className="text-[11px] font-medium text-white/40 uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className="text-white/80 text-sm leading-relaxed">{value}</p>
    </div>
  )
}
