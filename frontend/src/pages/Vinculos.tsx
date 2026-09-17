import { useState, type FormEvent } from 'react'
import { getCurrentUserToken } from '../lib/auth'

// Esqueleto cru da Fase 2, itens 2.1 (RF-020), 2.2 (RF-021, RF-022) e 2.6
// (RF-026) — só o necessário pra exercitar os endpoints de backend já
// implementados, sem listagem, sem polish visual. Layout final é
// responsabilidade de Laureane/Jennifer; isto existe só pra não depender do
// front delas pra testar o back.

async function chamarApi(path: string, options: RequestInit = {}) {
  const token = await getCurrentUserToken()
  const res = await fetch(`${import.meta.env.VITE_API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })
  const corpo = await res.json().catch(() => null)
  if (!res.ok) throw new Error(corpo?.error ?? `Falha na requisição: status ${res.status}`)
  return corpo
}

function Vinculos() {
  const [email, setEmail] = useState('')
  const [nomeIdoso, setNomeIdoso] = useState('')
  const [resultadoSolicitar, setResultadoSolicitar] = useState<string | null>(null)
  const [erroSolicitar, setErroSolicitar] = useState<string | null>(null)

  const [vinculoId, setVinculoId] = useState('')
  const [resultadoResponder, setResultadoResponder] = useState<string | null>(null)
  const [erroResponder, setErroResponder] = useState<string | null>(null)

  const [emailIdoso, setEmailIdoso] = useState('')
  const [resultadoSolicitarFamiliar, setResultadoSolicitarFamiliar] = useState<string | null>(null)
  const [erroSolicitarFamiliar, setErroSolicitarFamiliar] = useState<string | null>(null)

  async function handleSolicitar(e: FormEvent) {
    e.preventDefault()
    setErroSolicitar(null)
    setResultadoSolicitar(null)
    try {
      const corpo = await chamarApi('/vinculo/solicitar-cuidador', {
        method: 'POST',
        body: JSON.stringify({ email, nome_idoso: nomeIdoso || undefined }),
      })
      setResultadoSolicitar(JSON.stringify(corpo, null, 2))
    } catch (err) {
      console.error('Falha ao solicitar vínculo:', err)
      setErroSolicitar(err instanceof Error ? err.message : 'Falha ao solicitar vínculo.')
    }
  }

  async function handleResponder(acao: 'aprovar' | 'recusar') {
    setErroResponder(null)
    setResultadoResponder(null)
    try {
      const corpo = await chamarApi(`/vinculo/${vinculoId}/${acao}`, { method: 'POST' })
      setResultadoResponder(JSON.stringify(corpo, null, 2))
    } catch (err) {
      console.error(`Falha ao ${acao} vínculo:`, err)
      setErroResponder(err instanceof Error ? err.message : `Falha ao ${acao} vínculo.`)
    }
  }

  async function handleSolicitarFamiliar(e: FormEvent) {
    e.preventDefault()
    setErroSolicitarFamiliar(null)
    setResultadoSolicitarFamiliar(null)
    try {
      const corpo = await chamarApi('/vinculo/solicitar-familiar', {
        method: 'POST',
        body: JSON.stringify({ email: emailIdoso }),
      })
      setResultadoSolicitarFamiliar(JSON.stringify(corpo, null, 2))
    } catch (err) {
      console.error('Falha ao solicitar vínculo de familiar:', err)
      setErroSolicitarFamiliar(err instanceof Error ? err.message : 'Falha ao solicitar vínculo.')
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center gap-10 bg-white p-8">
      <section className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Solicitar vínculo (cuidador → idoso)</h1>
        <form onSubmit={handleSolicitar} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-lg font-medium text-gray-900">
              E-mail do idoso ou familiar
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
            <label htmlFor="nome_idoso" className="block text-lg font-medium text-gray-900">
              Nome do idoso (só se o e-mail controlar mais de um)
            </label>
            <input
              id="nome_idoso"
              type="text"
              value={nomeIdoso}
              onChange={(e) => setNomeIdoso(e.target.value)}
              className="mt-1 w-full rounded border border-gray-400 p-3 text-lg"
            />
          </div>
          <button type="submit" className="w-full rounded bg-blue-700 p-3 text-lg font-semibold text-white">
            Solicitar
          </button>
        </form>
        {erroSolicitar && (
          <p role="alert" className="text-lg text-red-700">
            {erroSolicitar}
          </p>
        )}
        {resultadoSolicitar && <pre className="whitespace-pre-wrap text-sm text-gray-700">{resultadoSolicitar}</pre>}
      </section>

      <section className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Responder solicitação de vínculo</h1>
        <div>
          <label htmlFor="vinculo_id" className="block text-lg font-medium text-gray-900">
            Id do vínculo
          </label>
          <input
            id="vinculo_id"
            type="number"
            required
            value={vinculoId}
            onChange={(e) => setVinculoId(e.target.value)}
            className="mt-1 w-full rounded border border-gray-400 p-3 text-lg"
          />
        </div>
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => handleResponder('aprovar')}
            className="flex-1 rounded bg-green-700 p-3 text-lg font-semibold text-white"
          >
            Aprovar
          </button>
          <button
            type="button"
            onClick={() => handleResponder('recusar')}
            className="flex-1 rounded bg-red-700 p-3 text-lg font-semibold text-white"
          >
            Recusar
          </button>
        </div>
        {erroResponder && (
          <p role="alert" className="text-lg text-red-700">
            {erroResponder}
          </p>
        )}
        {resultadoResponder && <pre className="whitespace-pre-wrap text-sm text-gray-700">{resultadoResponder}</pre>}
      </section>

      <section className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Solicitar vínculo (familiar → idoso, pelo e-mail)</h1>
        <form onSubmit={handleSolicitarFamiliar} className="space-y-4">
          <div>
            <label htmlFor="email_idoso" className="block text-lg font-medium text-gray-900">
              E-mail do idoso
            </label>
            <input
              id="email_idoso"
              type="email"
              required
              value={emailIdoso}
              onChange={(e) => setEmailIdoso(e.target.value)}
              className="mt-1 w-full rounded border border-gray-400 p-3 text-lg"
            />
          </div>
          <button type="submit" className="w-full rounded bg-blue-700 p-3 text-lg font-semibold text-white">
            Solicitar
          </button>
        </form>
        {erroSolicitarFamiliar && (
          <p role="alert" className="text-lg text-red-700">
            {erroSolicitarFamiliar}
          </p>
        )}
        {resultadoSolicitarFamiliar && (
          <pre className="whitespace-pre-wrap text-sm text-gray-700">{resultadoSolicitarFamiliar}</pre>
        )}
      </section>
    </main>
  )
}

export default Vinculos
