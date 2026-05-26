import { collection, doc, setDoc } from "firebase/firestore"
import { db } from "../firebase"

export async function createGroup(name: string, members: string[], admin: string) {
  // Crear ID automático
  const groupRef = doc(collection(db, "groups"))

  // Guardar la info del grupo
  await setDoc(doc(db, "groups", groupRef.id, "info", "data"), {
    name,
    members,
    admin,
    createdAt: Date.now()
  })

  return groupRef.id
}
