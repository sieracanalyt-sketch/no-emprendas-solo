// ──────────────────────────────────────────────────────────────────────────────
// Melodías de llamada generadas con Web Audio — sin assets, sin peso extra.
//
//  · "outgoing"  → tono de llamada saliente: dos notas suaves ascendentes que se
//                  repiten mientras esperas a que contesten ("tu-tuuu…").
//  · "incoming"  → melodía entrante tipo marimba: arpegio cálido en bucle, más
//                  presente (tiene que llamar tu atención) + vibración en móvil.
//
// Un único AudioContext perezoso; start() detiene cualquier melodía anterior.
// ──────────────────────────────────────────────────────────────────────────────

type RingKind = "outgoing" | "incoming"

let ctx: AudioContext | null = null
let loopTimer: number | null = null
let master: GainNode | null = null

function ensureCtx(): AudioContext {
  if (!ctx) {
    const AC = window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    ctx = new AC()
  }
  // Los navegadores suspenden el contexto hasta que hay interacción; en una app
  // ya usada el resume() es inmediato.
  if (ctx.state === "suspended") void ctx.resume()
  return ctx
}

function note(
  ac: AudioContext,
  dest: AudioNode,
  freq: number,
  t: number,
  dur: number,
  vol: number,
  type: OscillatorType = "sine",
) {
  const o = ac.createOscillator()
  const g = ac.createGain()
  o.type = type
  o.frequency.value = freq
  o.connect(g)
  g.connect(dest)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + 0.025)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.start(t)
  o.stop(t + dur + 0.05)
}

/** Un ciclo del tono saliente: dos notas suaves ("tu-tuuu"). */
function outgoingCycle(ac: AudioContext, dest: AudioNode) {
  const t = ac.currentTime + 0.02
  note(ac, dest, 440, t, 0.55, 0.09)          // A4
  note(ac, dest, 554.37, t + 0.62, 0.9, 0.09) // C#5, más larga
}

/** Un ciclo de la melodía entrante: arpegio marimba C-E-G-C alegre. */
function incomingCycle(ac: AudioContext, dest: AudioNode) {
  const t = ac.currentTime + 0.02
  const seq: Array<[number, number, number]> = [
    // [freq, offset, dur]
    [523.25, 0.0, 0.32],   // C5
    [659.25, 0.16, 0.32],  // E5
    [783.99, 0.32, 0.32],  // G5
    [1046.5, 0.48, 0.5],   // C6
    [783.99, 0.82, 0.28],  // G5
    [659.25, 0.98, 0.42],  // E5
  ]
  for (const [f, off, dur] of seq) {
    note(ac, dest, f, t + off, dur, 0.16, "triangle")
    note(ac, dest, f * 2, t + off, dur * 0.5, 0.05, "sine") // brillo armónico
  }
}

export function startRingtone(kind: RingKind): void {
  try {
    stopRingtone()
    const ac = ensureCtx()
    master = ac.createGain()
    master.gain.value = 1
    master.connect(ac.destination)

    const cycle = kind === "outgoing" ? outgoingCycle : incomingCycle
    const period = kind === "outgoing" ? 3000 : 2100
    cycle(ac, master)
    loopTimer = window.setInterval(() => {
      if (master) cycle(ac, master)
    }, period)

    if (kind === "incoming" && "vibrate" in navigator) {
      try { navigator.vibrate([300, 180, 300]) } catch { /* sin vibración */ }
    }
  } catch { /* audio no disponible — la llamada sigue funcionando */ }
}

export function stopRingtone(): void {
  if (loopTimer !== null) {
    window.clearInterval(loopTimer)
    loopTimer = null
  }
  if (master) {
    // Fundido rápido para no cortar en seco
    try {
      const ac = ensureCtx()
      master.gain.setTargetAtTime(0.0001, ac.currentTime, 0.06)
      const m = master
      window.setTimeout(() => { try { m.disconnect() } catch { /* ya desconectado */ } }, 260)
    } catch { /* noop */ }
    master = null
  }
  if ("vibrate" in navigator) {
    try { navigator.vibrate(0) } catch { /* noop */ }
  }
}

/** Señales cortas de estado: conectado / colgado / rechazado. */
export function playCue(kind: "connected" | "ended" | "declined"): void {
  try {
    const ac = ensureCtx()
    const g = ac.createGain()
    g.connect(ac.destination)
    const t = ac.currentTime
    if (kind === "connected") {
      note(ac, g, 523.25, t, 0.14, 0.12)
      note(ac, g, 783.99, t + 0.12, 0.2, 0.12)
    } else if (kind === "ended") {
      note(ac, g, 392, t, 0.16, 0.1)
      note(ac, g, 261.63, t + 0.14, 0.26, 0.1)
    } else {
      note(ac, g, 311.13, t, 0.22, 0.11)
      note(ac, g, 311.13, t + 0.3, 0.22, 0.11)
    }
  } catch { /* noop */ }
}
