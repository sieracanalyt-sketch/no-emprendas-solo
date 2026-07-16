import MergeConsole from "../jarvis/JarvisHud"

// MERGE — asistente de voz del fundador, embebido en NES. Función premium,
// abierta a todos durante la beta (ver banner). El agente (cerebro) corre en
// la máquina del fundador y se une a la misma sala de LiveKit automáticamente.
export default function Merge() {
  return (
    <div>
      <div
        className="mx-auto mt-3 flex max-w-6xl items-center gap-2 px-4 text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: "var(--accent)" }}
      >
        <span
          className="rounded-full px-2 py-0.5"
          style={{ background: "rgba(94,106,210,0.15)", border: "1px solid rgba(94,106,210,0.35)" }}
        >
          Premium · gratis en beta
        </span>
      </div>
      <MergeConsole />
    </div>
  )
}
