export function getChatId(uid1: string, uid2: string) {
  return [uid1, uid2].sort().join("_")
}
