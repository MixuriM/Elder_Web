// Skeleton — chama auth.ts, sem integração com /auth/sync ainda (backend não existe).
// tipo_perfil vai no mesmo formulário do cadastro (não em etapa separada) porque
// /auth/sync vai precisar dele já no primeiro sync pós-registerUser/loginWithGoogle.
import { useState, type FormEvent } from 'react'
import { registerUser, loginWithGoogle } from '../lib/auth'

type TipoPerfil = 'idoso' | 'cuidador' | 'familiar'

function Cadastro() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [tipoPerfil, setTipoPerfil] = useState<TipoPerfil>('idoso')
  const [erro, setErro] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    try {
      await registerUser(email, senha)
      // TODO: chamar POST /auth/sync com tipoPerfil assim que a rota existir.
    } catch {
      setErro('Não foi possível criar a conta. Confira os dados e tente novamente.')
    }
  }

  async function handleGoogleCadastro() {
    setErro(null)
    try {
      await loginWithGoogle()
      // TODO: chamar POST /auth/sync com tipoPerfil assim que a rota existir.
    } catch {
      setErro('Não foi possível criar a conta com o Google.')
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-white p-8">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-3xl font-bold text-gray-900">Criar conta</h1>

        <fieldset>
          <legend className="text-lg font-medium text-gray-900">Eu sou</legend>
          <div className="mt-1 space-y-2">
            {(['idoso', 'cuidador', 'familiar'] as const).map((opcao) => (
              <label key={opcao} className="flex items-center gap-2 text-lg text-gray-900">
                <input
                  type="radio"
                  name="tipo_perfil"
                  value={opcao}
                  checked={tipoPerfil === opcao}
                  onChange={() => setTipoPerfil(opcao)}
                />
                {opcao === 'idoso' ? 'Idoso' : opcao === 'cuidador' ? 'Cuidador' : 'Familiar'}
              </label>
            ))}
          </div>
        </fieldset>

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
          Criar conta
        </button>

        <button
          type="button"
          onClick={handleGoogleCadastro}
          className="w-full rounded border border-gray-400 p-3 text-lg font-semibold text-gray-900"
        >
          Criar conta com Google
        </button>
      </form>
    </main>
  )
}

export default Cadastro
