import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { resetPassword } from '../lib/auth'

function EsqueciSenha() {
  const [email, setEmail] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviado, setEnviado] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    try {
      await resetPassword(email)
      setEnviado(true)
    } catch (err) {
      console.error('Falha ao solicitar redefinição de senha:', err)
      const codigo = (err as { code?: string }).code
      if (codigo === 'auth/invalid-email') {
        setErro('Digite um e-mail válido.')
      } else if (codigo === 'auth/too-many-requests') {
        setErro('Muitas tentativas. Aguarde um pouco e tente novamente.')
      } else {
        setErro('Não foi possível enviar o e-mail agora. Verifique sua conexão e tente de novo.')
      }
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-white p-8">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-3xl font-bold text-gray-900">Esqueci minha senha</h1>

        {enviado ? (
          <p role="alert" className="text-lg text-gray-900">
            Se esse e-mail estiver cadastrado, você vai receber uma mensagem com um link
            para redefinir sua senha. Verifique sua caixa de entrada (e o spam).
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
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

            {erro && (
              <p role="alert" className="text-lg text-red-700">
                {erro}
              </p>
            )}

            <button
              type="submit"
              className="w-full rounded bg-blue-700 p-3 text-lg font-semibold text-white"
            >
              Enviar link de redefinição
            </button>
          </form>
        )}

        <Link to="/login" className="block text-lg text-blue-700 underline">
          Voltar para o login
        </Link>
      </div>
    </main>
  )
}

export default EsqueciSenha
