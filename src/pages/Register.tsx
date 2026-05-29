import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { supabase } from "../supabase"
import AuthCard from "../components/AuthCard"
import Input from "../components/Input"

export default function Register() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      alert("Las contraseñas no coinciden")
      return
    }
    try {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) throw error
      navigate("/explorar")
    } catch {
      alert("Error al registrarte. Puede que el correo ya esté en uso.")
    }
  }

  const registerGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/explorar` },
      })
      if (error) throw error
    } catch {
      alert("Error al registrarte con Google")
    }
  }

  return (
    <div className="flex justify-center items-center h-screen">
      <AuthCard title="Crear cuenta">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={setEmail}
          />
          <Input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={setPassword}
          />
          <Input
            type="password"
            placeholder="Confirmar contraseña"
            value={confirmPassword}
            onChange={setConfirmPassword}
          />
          <button
            type="submit"
            className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded"
          >
            Crear cuenta
          </button>
          <button
            type="button"
            onClick={registerGoogle}
            className="w-full bg-red-500 hover:bg-red-600 text-white py-2 rounded"
          >
            Registrarse con Google
          </button>
        </form>
        <div className="text-center mt-4">
          <p>¿Ya tienes cuenta?</p>
          <Link to="/" className="text-blue-600 underline">
            Inicia sesión aquí
          </Link>
        </div>
      </AuthCard>
    </div>
  )
}
