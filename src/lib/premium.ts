// ──────────────────────────────────────────────────────────────────────────────
// Premium Mode: tipos y metadatos compartidos de tiers y feature flags.
// Los flags viven en la tabla `feature_flags` (server-side, toggle sin redeploy).
// ──────────────────────────────────────────────────────────────────────────────

export type Tier = "free" | "premium"

export type FeatureFlag = {
  feature: string
  min_tier: Tier
  active: boolean
}

export type SubscriptionStatus = "active" | "canceled" | "expired"

export type Subscription = {
  id: string
  user_id: string
  tier: Tier
  status: SubscriptionStatus
  partner_id: string | null
  next_billing_date: string | null
  created_at: string
  updated_at: string
}

const TIER_RANK: Record<Tier, number> = { free: 0, premium: 1 }

export function tierAtLeast(tier: Tier, min: Tier): boolean {
  return TIER_RANK[tier] >= TIER_RANK[min]
}

// Metadatos de las 4 features premium (tarjetas del UpgradeModal y página admin)
export const FEATURE_INFO: Record<string, { nombre: string; descripcion: string; emoji: string }> = {
  matching_advanced: {
    nombre: "Matching avanzado",
    descripcion: "Conexión IA con resultados curados: describe a quién buscas y la IA encuentra tu match.",
    emoji: "🤝",
  },
  identity_public: {
    nombre: "Identidad pública",
    descripcion: "Perfil público destacado y verificado, visible para toda la red.",
    emoji: "✦",
  },
  curated_network: {
    nombre: "Red curada",
    descripcion: "Acceso a la red seleccionada de emprendedores y grupos exclusivos.",
    emoji: "🌐",
  },
  workflow_advanced: {
    nombre: "Workflow avanzado",
    descripcion: "Tablero con matriz Eisenhower, modo enfoque y gestión avanzada de tareas.",
    emoji: "⚡",
  },
}

// Doc de monetización (transparencia) — enlazado en el footer del UpgradeModal.
export const MONETIZATION_DOC_URL =
  "https://app.notion.com/p/Monetizaci-n-Futura-NES-3866d9f0785b81a99c2bdf12ab714d8e"
