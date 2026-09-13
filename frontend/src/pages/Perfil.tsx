import { useEffect, useState, type FormEvent } from 'react'
import { getCurrentUserToken } from '../lib/auth'

interface DadosUsuario {
  id: number
  nome: string
  email: string | null
  telefone: string | null
  tipo_perfil: string
}

async function buscarPerfil(): Promise<DadosUsuario> {
  const token = await getCurrentUserToken()
  const res = await fetch(`${import.meta.env.VITE_API_URL}/usuario/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Falha ao buscar perfil: status ${res.status}`)
  return res.json()
}

async function salvarPerfil(dados: { nome: string; email: string; telefone: string }) {
  const token = await getCurrentUserToken()
  const res = await fetch(`${import.meta.env.VITE_API_URL}/usuario/me`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(dados),
  })
  if (!res.ok) {
    const corpo = await res.json().catch(() => null)
    throw new Error(corpo?.error ?? `Falha ao salvar perfil: status ${res.status}`)
  }
  return res.json() as Promise<DadosUsuario>
}

function Perfil() {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState(false)

  useEffect(() => {
    buscarPerfil()
      .then((dados) => {
        setNome(dados.nome)
        setEmail(dados.email ?? '')
        setTelefone(dados.telefone ?? '')
      })
      .catch((err) => {
        console.error('Falha ao carregar perfil:', err)
        setErro('Não foi possível carregar seus dados agora. Tente novamente.')
      })
      .finally(() => setCarregando(false))
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setSucesso(false)
    try {
      await salvarPerfil({ nome, email, telefone })
      setSucesso(true)
    } catch (err) {
      console.error('Falha ao salvar perfil:', err)
      setErro(err instanceof Error ? err.message : 'Não foi possível salvar. Tente novamente.')
    }
  }

  if (carregando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white p-8">
        <p className="text-lg text-gray-900">Carregando...</p>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-white p-8">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-3xl font-bold text-gray-900">Meu perfil</h1>

        <div>
          <label htmlFor="nome" className="block text-lg font-medium text-gray-900">
            Nome completo
          </label>
          <input
            id="nome"
            type="text"
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="mt-1 w-full rounded border border-gray-400 p-3 text-lg"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-lg font-medium text-gray-900">
            E-mail
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border border-gray-400 p-3 text-lg"
          />
        </div>

        <div>
          <label htmlFor="telefone" className="block text-lg font-medium text-gray-900">
            Telefone
          </label>
          <input
            id="telefone"
            type="tel"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            className="mt-1 w-full rounded border border-gray-400 p-3 text-lg"
          />
        </div>

        {erro && (
          <p role="alert" className="text-lg text-red-700">
            {erro}
          </p>
        )}

        {sucesso && (
          <p role="alert" className="text-lg text-green-700">
            Perfil atualizado com sucesso.
          </p>
        )}

        <button
          type="submit"
          className="w-full rounded bg-blue-700 p-3 text-lg font-semibold text-white"
        >
          Salvar
        </button>
      </form>
    </main>
  )
}

export default Perfil
