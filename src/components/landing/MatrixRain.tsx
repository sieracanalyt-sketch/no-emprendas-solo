import { useEffect, useRef } from "react"

type Props = {
  opacity?: number
  /** ms between frames; bajalo para más fps */
  frame?: number
  /** velocidad reset aleatorio */
  resetChance?: number
}

/**
 * Canvas con la "lluvia Matrix" clásica.
 * Usa requestAnimationFrame con throttling para 30fps suaves.
 */
export default function MatrixRain({
  opacity = 1,
  frame = 33,
  resetChance = 0.975,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!
    let raf = 0
    let last = 0

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener("resize", resize)

    const chars =
      "01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワン" +
      "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz{}[]()=+-*/&|!@#$%^"
    const fs = 14
    const cols = Math.floor(canvas.width / fs)
    const drops: number[] = Array.from({ length: cols }, () =>
      Math.floor(Math.random() * (canvas.height / fs))
    )

    const draw = (ts: number) => {
      raf = requestAnimationFrame(draw)
      if (ts - last < frame) return
      last = ts

      ctx.fillStyle = "rgba(0,0,0,0.06)"
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = "#00ff7f"
      ctx.font = `${fs}px monospace`
      for (let i = 0; i < drops.length; i++) {
        const ch = chars[Math.floor(Math.random() * chars.length)]
        ctx.fillText(ch, i * fs, drops[i] * fs)
        if (drops[i] * fs > canvas.height && Math.random() > resetChance)
          drops[i] = 0
        drops[i]++
      }
    }

    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("resize", resize)
    }
  }, [frame, resetChance])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        background: "black",
        display: "block",
        opacity,
        transition: "opacity 0.7s ease-out",
      }}
    />
  )
}
