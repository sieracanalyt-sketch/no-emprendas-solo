import { doc, getDoc, setDoc } from "firebase/firestore"
import { db } from "../firebase"

export async function saveUser(user: any) {
  const userRef = doc(db, "users", user.uid)
  const snapshot = await getDoc(userRef)

  if (!snapshot.exists()) {
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email || null,
      displayName: user.displayName || "Usuario",
      avatar: user.photoURL || null,
      createdAt: Date.now()
    })
  }
}
