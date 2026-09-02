import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { loginUser, loginWithGoogle, syncUser } from '../lib/auth'

function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const navigate = useNavigate()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    try {
      await loginUser(email, senha)
      await syncUser()
      navigate('/')
    } catch {
      setErro('Não foi possível entrar. Confira seu e-mail e senha.')
    }
  }

  async function handleGoogleLogin() {
    setErro(null)
    try {
      await loginWithGoogle()
      await syncUser()
      navigate('/')
    } catch {
      setErro('Não foi possível entrar com o Google.')
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-white p-8">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-3xl font-bold text-gray-900">Entrar</h1>

        <div>
          <label htmlFor="email" className="block text-lg font-medium text-gray-900">
            E-mail
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border border-gray-400 p-3 text-lg"
          />
        </div>

        <div>
          <label htmlFor="senha" className="block text-lg font-medium text-gray-900">
            Senha
          </label>
          <input
            id="senha"
            type="password"
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="mt-1 w-full rounded border border-gray-400 p-3 text-lg"
          />
        </div>

        {erro && (
          <p role="alert" className="text-lg text-red-700">
            {erro}
          </p>
        )}

        <button
          type="submit"
          className="w-full rounded bg-blue-700 p-3 text-lg font-semibold text-white"
        >
          Entrar
        </button>

        <button
          type="button"
          onClick={handleGoogleLogin}
          className="w-full rounded border border-gray-400 p-3 text-lg font-semibold text-gray-900"
        >
          Entrar com Google
        </button>
      </form>
    </main>
  )
}

export default Login
