import { useEffect, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { supabase } from "../supabase"

export function useUser(): [User | null, boolean] {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Solo actualiza si el ID cambia — evita re-renders dobles cuando
  // getSession() y onAuthStateChange disparan con el mismo usuario
  // (distinta referencia de objeto) en rápida sucesión.
  const setStableUser = (newUser: User | null) => {
    setUser(prev => (prev?.id === newUser?.id ? prev : newUser))
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setStableUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setStableUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return [user, loading]
}
