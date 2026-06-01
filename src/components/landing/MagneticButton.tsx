import { useEffect, useRef } from "react"

type Props = {
  children: React.ReactNode
  onClick?: () => void
  radius?: number
  strength?: number
  className?: string
  style?: React.CSSProperties
}

/**
 * Botón que atrae el cursor del usuario cuando se acerca.
 * Toda la lógica es CSS transforms → 60fps garantizados.
 */
export default function MagneticButton({
  children,
  onClick,
  radius = 140,
  strength = 0.35,
  className = "",
  style,
}: Props) {
  const ref = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const move = (e: MouseEvent) => {
      const r = el.getBoundingClientRect()
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      const dx = e.clientX - cx
      const dy = e.clientY - cy
      const dist = Math.hypot(dx, dy)
      if (dist < radius) {
        el.style.transform = `translate(${dx * strength}px, ${dy * strength}px)`
      } else {
        el.style.transform = "translate(0, 0)"
      }
    }
    const leave = () => {
      el.style.transform = "translate(0, 0)"
    }

    window.addEventListener("mousemove", move)
    window.addEventListener("mouseleave", leave)
    return () => {
      window.removeEventListener("mousemove", move)
      window.removeEventListener("mouseleave", leave)
    }
  }, [radius, strength])

  return (
    <button
      ref={ref}
      onClick={onClick}
      className={`nes-magnetic ${className}`}
      style={style}
    >
      {children}
    </button>
  )
}
