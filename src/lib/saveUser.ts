import { doc, getDoc, setDoc } from "firebase/firestore"
import { db } from "../firebase"

export async function saveUser(user: { uid: string; email?: string | null; displayName?: string | null; photoURL?: string | null }) {
  const userRef = doc(db, "users", user.uid)
  const snapshot = await getDoc(userRef)

  if (!snapshot.exists()) {
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email || null,
      nombre: user.displayName || user.email?.split("@")[0] || "Usuario",
      avatar: user.photoURL || null,
      createdAt: Date.now()
    })
  }
}
