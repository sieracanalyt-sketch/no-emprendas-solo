import { useEffect, useState } from "react"
import { collection, query, orderBy, doc, getDoc, limit, getDocs } from "firebase/firestore"
import { db } from "../firebase"
import { Link } from "react-router-dom"

export default function Grupos() {
  const [groups, setGroups] = useState<any[]>([])

  useEffect(() => {
    const loadGroups = async () => {
      const ref = collection(db, "groups")
      const snap = await getDocs(ref)

      const list: any[] = []

      for (const g of snap.docs) {
        const groupId = g.id

        // ⭐ Leer info del grupo
        const infoRef = doc(db, "groups", groupId, "info", "data")
        const infoSnap = await getDoc(infoRef)
        const info = infoSnap.data()

        if (!info) continue

        // ⭐ Leer último mensaje
        const messagesRef = collection(db, "groups", groupId, "messages")
        const q = query(messagesRef, orderBy("timestamp", "desc"), limit(1))
        const lastSnap = await getDocs(q)

        let lastMessage = "Sin mensajes aún"
        if (!lastSnap.empty) {
          lastMessage = lastSnap.docs[0].data().text
        }

        list.push({
          id: groupId,
          name: info.name,
          members: info.members.length,
          lastMessage
        })
      }

      setGroups(list)
    }

    loadGroups()
  }, [])

  return (
    <div className="p-6 text-white">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Grupos</h1>

        <Link to="/create-group">
          <button className="px-3 py-2 bg-blue-600 rounded">
            Crear grupo
          </button>
        </Link>
      </div>

      <div className="flex flex-col gap-3">
        {groups.map((g) => (
          <Link
            key={g.id}
            to={`/group/${g.id}`}
            className="p-3 bg-gray-800 rounded hover:bg-gray-700"
          >
            <p className="text-lg font-semibold">{g.name}</p>
            <p className="text-sm text-gray-400">{g.lastMessage}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
