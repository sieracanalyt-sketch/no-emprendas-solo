import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { auth, db } from "../firebase"
import { doc, updateDoc } from "firebase/firestore"

export default function CompletarPerfil() {
  const [displayName, setDisplayName] = useState("")
  const [bio, setBio] = useState("")
  const [skills, setSkills] = useState("")
  const [message, setMessage] = useState("")
  const navigate = useNavigate()

  const handleSave = async () => {
    const user = auth.currentUser

    console.log("USER ID:", user?.uid)

    if (!user) {
      setMessage("No se encontró el usuario")
      return
    }

    try {
      const userRef = doc(db, "users", user.uid)

      await updateDoc(userRef, {
        display_name: displayName,
        bio,
        skills
      })

      navigate("/explorar")

    } catch (error) {
      console.log("UPDATE ERROR:", error)
      setMessage("Error al guardar el perfil")
    }
  }

  return (
    <div style={{ maxWidth: 500, margin: "0 auto" }}>
      <h2>Completa tu perfil</h2>

      <input
        type="text"
        placeholder="Tu nombre"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
      />

      <textarea
        placeholder="Tu bio"
        value={bio}
        onChange={(e) => setBio(e.target.value)}
      />

      <input
        type="text"
        placeholder="Tus skills"
        value={skills}
        onChange={(e) => setSkills(e.target.value)}
      />

      <button onClick={handleSave}>Guardar</button>

      {message && <p>{message}</p>}
    </div>
  )
}