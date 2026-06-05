import { useCallback, useEffect, useRef, useState } from "react"

// ──────────────────────────────────────────────────────────────────────────────
// Grabación de notas de audio con MediaRecorder.
// Expone estado, nivel de volumen en vivo (para el waveform) y controles.
// ──────────────────────────────────────────────────────────────────────────────

export type RecorderState = "idle" | "recording" | "paused"

export function useAudioRecorder() {
  const [state, setState] = useState<RecorderState>("idle")
  const [seconds, setSeconds] = useState(0)
  const [level, setLevel] = useState(0) // 0..1, para animar el waveform
  const [error, setError] = useState<string | null>(null)

  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)

  const cleanup = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    audioCtxRef.current?.close().catch(() => {})
    timerRef.current = null
    rafRef.current = null
    streamRef.current = null
    analyserRef.current = null
    audioCtxRef.current = null
  }, [])

  useEffect(() => () => cleanup(), [cleanup])

  const start = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []

      // Analyser para el nivel de volumen en vivo
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new AudioCtx()
      const src = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      src.connect(analyser)
      audioCtxRef.current = ctx
      analyserRef.current = analyser

      // Bucle de nivel de volumen en vivo (waveform)
      const loop = () => {
        const a = analyserRef.current
        if (!a) return
        const buf = new Uint8Array(a.frequencyBinCount)
        a.getByteTimeDomainData(buf)
        let sum = 0
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128
          sum += v * v
        }
        setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 3))
        rafRef.current = requestAnimationFrame(loop)
      }
      rafRef.current = requestAnimationFrame(loop)

      const rec = new MediaRecorder(stream)
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      mediaRef.current = rec
      rec.start()

      setSeconds(0)
      setState("recording")
      timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000)
    } catch {
      setError("No se pudo acceder al micrófono")
      setState("idle")
    }
  }, [])

  /** Detiene y devuelve el Blob grabado (o null si se cancela). */
  const stop = useCallback(
    (): Promise<{ blob: Blob; duration: number } | null> =>
      new Promise((resolve) => {
        const rec = mediaRef.current
        const dur = seconds
        if (!rec || rec.state === "inactive") {
          cleanup()
          setState("idle")
          resolve(null)
          return
        }
        rec.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" })
          cleanup()
          setState("idle")
          setSeconds(0)
          setLevel(0)
          resolve(blob.size > 0 ? { blob, duration: dur } : null)
        }
        rec.stop()
      }),
    [seconds, cleanup]
  )

  const cancel = useCallback(() => {
    const rec = mediaRef.current
    if (rec && rec.state !== "inactive") {
      rec.onstop = () => {}
      rec.stop()
    }
    chunksRef.current = []
    cleanup()
    setState("idle")
    setSeconds(0)
    setLevel(0)
  }, [cleanup])

  return { state, seconds, level, error, start, stop, cancel }
}
