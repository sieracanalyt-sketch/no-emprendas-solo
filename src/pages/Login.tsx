import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "firebase/auth"
import { auth } from "../firebase"
import { saveUser } from "../lib/saveUser"
import AuthCard from "../components/AuthCard"
import Input from "../components/Input"

export default function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const result = await signInWithEmailAndPassword(auth, email, password)
      await saveUser(result.user)
      navigate("/explorar")
    } catch (error) {
      console.error(error)
      alert("Error al iniciar sesión")
    }
  }

  const loginGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider()
      const result = await signInWithPopup(auth, provider)
      await saveUser(result.user)
      navigate("/explorar")
    } catch (error) {
      console.error(error)
      alert("Error al iniciar sesión con Google")
    }
  }

  return (
    <div className="flex justify-center items-center h-screen">
      <AuthCard title="Iniciar sesión">
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

          <button
            type="submit"
            className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded"
          >
            Entrar
          </button>

          <button
            type="button"
            onClick={loginGoogle}
            className="w-full bg-red-500 hover:bg-red-600 text-white py-2 rounded"
          >
            Entrar con Google
          </button>
        </form>

        <div className="text-center mt-4">
          <p>¿No tienes cuenta?</p>
          <Link to="/register" className="text-blue-600 underline">
            Regístrate aquí
          </Link>
        </div>
      </AuthCard>
    </div>
  )
}
