import { useTheme } from "../hooks/useTheme"

// Alterna claro/oscuro. El icono muestra el tema al que vas a cambiar
// (sol cuando estás en oscuro), que es lo que la gente espera de un toggle.
export default function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, toggle] = useTheme()
  const goingTo = theme === "light" ? "oscuro" : "claro"

  return (
    <button
      onClick={toggle}
      className={`theme-toggle ${className}`}
      title={`Cambiar a tema ${goingTo}`}
      aria-label={`Cambiar a tema ${goingTo}`}
    >
      {theme === "light" ? <MoonIcon /> : <SunIcon />}
    </button>
  )
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.4v2.3M12 19.3v2.3M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.4 12h2.3M19.3 12h2.3M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.5 14.3A8.5 8.5 0 0 1 9.7 3.5a8.5 8.5 0 1 0 10.8 10.8z" />
    </svg>
  )
}
