import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useUser } from "../hooks/useUser"
import IntroSequence from "../components/landing/IntroSequence"
import HeroSection from "../components/landing/HeroSection"
import BreakRulesSection from "../components/landing/BreakRulesSection"
import HorizontalBenefits from "../components/landing/HorizontalBenefits"
import FinalCTASection from "../components/landing/FinalCTASection"
import "../styles/landing.css"

/**
 * Landing inmersiva. Flujo:
 *   1. Si el usuario ya está autenticado → redirige a /explorar.
 *   2. Si es la primera visita de la sesión → intro Matrix + pills.
 *   3. Tras "Adelante" (o si ya vio la intro) → Landing completa.
 *
 * El "skip" se memoriza en sessionStorage (solo durante esta pestaña/sesión),
 * para no martillear al usuario con la intro si vuelve a la home.
 */
export default function Landing() {
  const navigate = useNavigate()
  const [user, loading] = useUser()

  const [introDone, setIntroDone] = useState<boolean>(() => {
    if (typeof window === "undefined") return false
    return sessionStorage.getItem("nes:introSeen") === "1"
  })

  // Si está logueado, fuera de la landing directamente
  useEffect(() => {
    if (!loading && user) navigate("/explorar", { replace: true })
  }, [user, loading, navigate])

  const completeIntro = () => {
    sessionStorage.setItem("nes:introSeen", "1")
    setIntroDone(true)
    // Asegura empezar arriba del todo cuando aparece la landing real
    window.scrollTo({ top: 0, behavior: "auto" })
  }

  const goToLogin = () => navigate("/login")

  if (loading || user) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "#050505",
        }}
      />
    )
  }

  return (
    <div
      style={{
        background: "#050505",
        color: "#fff",
        // `clip` recorta el overflow horizontal SIN crear un contexto de
        // scroll, lo cual es imprescindible para que las secciones con
        // position:sticky funcionen (la horizontal-scroll lo necesita).
        overflowX: "clip",
        fontFamily: "'Inter','Segoe UI',system-ui,sans-serif",
      }}
    >
      {!introDone && <IntroSequence onComplete={completeIntro} />}

      {introDone && (
        <>
          <HeroSection onJoin={goToLogin} />
          <BreakRulesSection />
          <HorizontalBenefits />
          <FinalCTASection onEnter={goToLogin} />
        </>
      )}
    </div>
  )
}
