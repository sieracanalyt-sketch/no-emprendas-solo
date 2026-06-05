import { supabase } from "../supabase"

// ──────────────────────────────────────────────────────────────────────────────
// Subida de multimedia al bucket `chat-media` de Supabase Storage.
// Devuelve la URL pública lista para guardar en el mensaje.
// ──────────────────────────────────────────────────────────────────────────────

export type AttachmentKind = "image" | "audio" | "file"

const BUCKET = "chat-media"

function extFromName(name: string, fallback: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(name)
  return m ? m[1].toLowerCase() : fallback
}

export type UploadResult = {
  url: string
  type: AttachmentKind
  name: string
  size: number
  duration?: number
}

/** Decide el tipo de adjunto a partir del MIME. */
export function kindFromMime(mime: string): AttachmentKind {
  if (mime.startsWith("image/")) return "image"
  if (mime.startsWith("audio/")) return "audio"
  return "file"
}

export async function uploadChatMedia(
  file: Blob,
  opts: { userId: string; name: string; kind?: AttachmentKind; duration?: number }
): Promise<UploadResult> {
  const kind = opts.kind ?? kindFromMime(file.type || "")
  const ext = extFromName(opts.name, kind === "image" ? "png" : kind === "audio" ? "webm" : "bin")
  const rand = Math.random().toString(36).slice(2, 8)
  const path = `${opts.userId}/${Date.now()}-${rand}.${ext}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  })
  if (error) throw error

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return {
    url: data.publicUrl,
    type: kind,
    name: opts.name,
    size: (file as File).size ?? file.size ?? 0,
    duration: opts.duration,
  }
}

/** Formatea un tamaño en bytes a una cadena legible. */
export function formatBytes(bytes: number): string {
  if (!bytes) return ""
  const units = ["B", "KB", "MB", "GB"]
  let i = 0
  let n = bytes
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`
}
