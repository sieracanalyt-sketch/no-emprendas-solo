type Props = {
  name: string
  src?: string | null
  size?: number
  group?: boolean
}

export default function Avatar({ name, src, size = 40, group = false }: Props) {
  const initial = (name || (group ? "G" : "?")).trim()[0]?.toUpperCase() || "?"

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    )
  }

  return (
    <div
      className="flex items-center justify-center font-semibold text-white/60 shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: "rgba(255,255,255,0.1)",
        borderRadius: group ? size * 0.3 : "9999px",
      }}
    >
      {initial}
    </div>
  )
}
