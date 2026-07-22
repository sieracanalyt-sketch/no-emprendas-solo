import type { ReactNode } from "react"
import logo from "../assets/logo.png"

// Marca NES: el logo es un símbolo blanco sobre fondo negro. Lo pintamos como
// máscara de luminancia (el blanco → opaco, el negro → transparente), así el
// fondo desaparece de verdad en cualquier navegador, sin depender de blend modes.
export function BrandMark({ size = 30, color = "#ffffff" }: { size?: number; color?: string }) {
  const mask: React.CSSProperties = {
    display: "inline-block",
    width: size,
    height: "auto",
    aspectRatio: "1 / 1",
    maxWidth: "100%",
    background: color,
    WebkitMaskImage: `url(${logo})`,
    maskImage: `url(${logo})`,
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    maskPosition: "center",
    WebkitMaskSize: "contain",
    maskSize: "contain",
    // luminancia: el símbolo blanco marca, el fondo negro se descarta
    maskMode: "luminance",
  }
  return <span role="img" aria-label="NoEmprendasSolo" style={mask} />
}

// Shell de autenticación split-screen (ver design.md §8).
// Izquierda: panel visual con aurora + marca. Derecha: `children` (el formulario).
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-root">
      {/* Aurora a pantalla completa: baña TODO el login (sin corte a negro) */}
      <div className="auth-aurora" />
      <div className="auth-grain" />

      {/* ── Panel visual (oculto en móvil) ─────────────────────────── */}
      <div className="auth-visual">
        {/* Wordmark pequeño arriba-izquierda (el texto va aquí, separado del logo) */}
        <div className="flex items-center gap-2.5">
          <BrandMark size={22} />
          <span style={{ color: "#fff", fontWeight: 600, fontSize: "0.95rem", letterSpacing: "-0.01em" }}>
            NoEmprendasSolo
          </span>
        </div>

        {/* Logo ENORME centrado — solo el símbolo, sin fondo (máscara de luminancia) */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "relative", display: "inline-flex", width: "clamp(200px, 30vw, 380px)" }}>
            <div
              aria-hidden
              style={{
                position: "absolute",
                inset: "-30%",
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(128,140,240,0.42), rgba(94,106,210,0.14) 55%, transparent 74%)",
                filter: "blur(40px)",
              }}
            />
            <BrandMark size={380} />
          </div>
        </div>

        {/* Tagline rotatoria abajo */}
        <div>
          <h2
            className="auth-tagline"
            style={{
              color: "#fff",
              fontSize: "clamp(1.6rem, 2.6vw, 2.3rem)",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              lineHeight: 1.15,
              margin: 0,
            }}
          >
            <span>Nadie llega lejos <em style={{ fontStyle: "italic", fontWeight: 600 }}>solo.</em></span>
            <span>Encuentra a tu <em style={{ fontStyle: "italic", fontWeight: 600 }}>gente.</em></span>
            <span>Construye en <em style={{ fontStyle: "italic", fontWeight: 600 }}>comunidad.</em></span>
          </h2>
          <p style={{ marginTop: "1.1rem", color: "rgba(255,255,255,0.72)", fontSize: "0.95rem", lineHeight: 1.5, maxWidth: 360 }}>
            La tribu donde los fundadores se cruzan, colaboran y crecen juntos.
          </p>
          <div className="auth-dots" style={{ marginTop: "1.6rem" }} aria-hidden>
            <span className="auth-dot" />
            <span className="auth-dot" />
            <span className="auth-dot" />
          </div>
        </div>
      </div>

      {/* ── Panel formulario ───────────────────────────────────────── */}
      <div className="auth-form">
        <div className="auth-card">
          {/* Marca solo en móvil (el panel visual está oculto) */}
          <div className="flex md:hidden items-center gap-2.5" style={{ marginBottom: "2rem" }}>
            <BrandMark size={30} />
            <span style={{ color: "#fff", fontWeight: 600, fontSize: "1rem", letterSpacing: "-0.01em" }}>
              NoEmprendasSolo
            </span>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}

// ─── Iconos compartidos ───────────────────────────────────────────────────────
export function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

export function AppleIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden="true" fill="#fff">
      <path d="M16.365 1.43c0 1.14-.415 2.06-1.245 2.76-.865.73-1.86 1.15-2.985 1.06-.09-1.11.36-2.06 1.185-2.79.795-.7 1.845-1.09 3.045-1.03zM20.6 17.42c-.46 1.06-.985 2.03-1.58 2.92-.83 1.23-1.51 2.08-2.03 2.55-.8.75-1.66 1.13-2.58 1.15-.66.01-1.46-.19-2.4-.6-.94-.41-1.8-.6-2.6-.6-.83 0-1.72.19-2.66.6-.94.41-1.71.62-2.31.63-.87.03-1.75-.36-2.62-1.16-.56-.5-1.27-1.38-2.13-2.65-.92-1.36-1.67-2.94-2.26-4.75-.63-1.95-.95-3.84-.95-5.66 0-2.09.45-3.9 1.36-5.42.71-1.22 1.66-2.19 2.85-2.9 1.19-.71 2.47-1.08 3.86-1.1.7 0 1.62.22 2.75.65 1.13.43 1.86.65 2.18.65.24 0 1.04-.25 2.4-.75 1.28-.46 2.37-.65 3.26-.58 2.4.19 4.21 1.14 5.42 2.85-2.15 1.3-3.21 3.13-3.19 5.47.02 1.83.68 3.35 1.98 4.56.59.55 1.24.98 1.97 1.28-.16.46-.33.9-.51 1.32z" />
    </svg>
  )
}

export function EyeIcon({ off }: { off?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {off ? (
        <>
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
          <path d="M6.61 6.61A18.5 18.5 0 0 0 2 12s3 8 10 8a9.12 9.12 0 0 0 5.39-1.61M2 2l20 20" />
        </>
      ) : (
        <>
          <path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  )
}
