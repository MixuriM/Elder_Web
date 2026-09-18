import { useState, type FormEvent } from 'react'
import { getCurrentUserToken } from '../lib/auth'

// Esqueleto cru da Fase 2, itens 2.1 (RF-020), 2.2 (RF-021, RF-022), 2.6
// (RF-026), 2.7 (RF-027), 2.8 (RF-032) e 2.9 (RF-033) — só o necessário pra
// exercitar os endpoints de backend já implementados, sem listagem, sem
// polish visual. Layout final é responsabilidade de Laureane/Jennifer; isto
// existe só pra não depender do front delas pra testar o back.

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

  const [vinculoIdPermissoes, setVinculoIdPermissoes] = useState('')
  const [permiteRegistrarSaude, setPermiteRegistrarSaude] = useState(false)
  const [permiteMarcarDose, setPermiteMarcarDose] = useState(false)
  const [permiteCriarEventoCuidado, setPermiteCriarEventoCuidado] = useState(false)
  const [resultadoPermissoes, setResultadoPermissoes] = useState<string | null>(null)
  const [erroPermissoes, setErroPermissoes] = useState<string | null>(null)

  const [resultadoStatusDecisao, setResultadoStatusDecisao] = useState<string | null>(null)
  const [erroStatusDecisao, setErroStatusDecisao] = useState<string | null>(null)

  const [vinculoIdSolicitarTransferencia, setVinculoIdSolicitarTransferencia] = useState('')
  const [motivoTransferencia, setMotivoTransferencia] = useState('')
  const [resultadoSolicitarTransferencia, setResultadoSolicitarTransferencia] = useState<string | null>(null)
  const [erroSolicitarTransferencia, setErroSolicitarTransferencia] = useState<string | null>(null)

  const [vinculoIdConfirmarTransferencia, setVinculoIdConfirmarTransferencia] = useState('')
  const [resultadoConfirmarTransferencia, setResultadoConfirmarTransferencia] = useState<string | null>(null)
  const [erroConfirmarTransferencia, setErroConfirmarTransferencia] = useState<string | null>(null)

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

  async function handleDefinirPermissoes(e: FormEvent) {
    e.preventDefault()
    setErroPermissoes(null)
    setResultadoPermissoes(null)
    try {
      const corpo = await chamarApi(`/vinculo/${vinculoIdPermissoes}/definir-permissoes`, {
        method: 'PATCH',
        body: JSON.stringify({
          permite_registrar_saude: permiteRegistrarSaude,
          permite_marcar_dose: permiteMarcarDose,
          permite_criar_evento_cuidado: permiteCriarEventoCuidado,
        }),
      })
      setResultadoPermissoes(JSON.stringify(corpo, null, 2))
    } catch (err) {
      console.error('Falha ao definir permissões:', err)
      setErroPermissoes(err instanceof Error ? err.message : 'Falha ao definir permissões.')
    }
  }

  async function handleVerStatusDecisao() {
    setErroStatusDecisao(null)
    setResultadoStatusDecisao(null)
    try {
      const corpo = await chamarApi('/usuario/me')
      setResultadoStatusDecisao(JSON.stringify(corpo, null, 2))
    } catch (err) {
      console.error('Falha ao buscar status de decisão:', err)
      setErroStatusDecisao(err instanceof Error ? err.message : 'Falha ao buscar status de decisão.')
    }
  }

  async function handleSolicitarTransferencia(e: FormEvent) {
    e.preventDefault()
    setErroSolicitarTransferencia(null)
    setResultadoSolicitarTransferencia(null)
    try {
      const corpo = await chamarApi(`/vinculo/${vinculoIdSolicitarTransferencia}/solicitar-transferencia-decisao`, {
        method: 'POST',
        body: JSON.stringify({ modo_decisao_motivo: motivoTransferencia || undefined }),
      })
      setResultadoSolicitarTransferencia(JSON.stringify(corpo, null, 2))
    } catch (err) {
      console.error('Falha ao solicitar transferência de decisão:', err)
      setErroSolicitarTransferencia(
        err instanceof Error ? err.message : 'Falha ao solicitar transferência de decisão.',
      )
    }
  }

  async function handleConfirmarTransferencia(e: FormEvent) {
    e.preventDefault()
    setErroConfirmarTransferencia(null)
    setResultadoConfirmarTransferencia(null)
    try {
      const corpo = await chamarApi(`/vinculo/${vinculoIdConfirmarTransferencia}/confirmar-transferencia-decisao`, {
        method: 'POST',
      })
      setResultadoConfirmarTransferencia(JSON.stringify(corpo, null, 2))
    } catch (err) {
      console.error('Falha ao confirmar transferência de decisão:', err)
      setErroConfirmarTransferencia(
        err instanceof Error ? err.message : 'Falha ao confirmar transferência de decisão.',
      )
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
        <h1 className="text-2xl font-bold text-gray-900">
          Responder solicitação de vínculo (cuidador ou familiar)
        </h1>
        <p className="text-base text-gray-700">
          Mesma rota pros dois tipos de vínculo — o backend resolve pelo id.
        </p>
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

      <section className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Definir permissões do cuidador</h1>
        <p className="text-base text-gray-700">
          Só o titular de modo_decisao do idoso (idoso ou familiar aprovado) pode alterar. Vínculo
          precisa ser de cuidador e já estar aprovado.
        </p>
        <form onSubmit={handleDefinirPermissoes} className="space-y-4">
          <div>
            <label htmlFor="vinculo_id_permissoes" className="block text-lg font-medium text-gray-900">
              Id do vínculo
            </label>
            <input
              id="vinculo_id_permissoes"
              type="number"
              required
              value={vinculoIdPermissoes}
              onChange={(e) => setVinculoIdPermissoes(e.target.value)}
              className="mt-1 w-full rounded border border-gray-400 p-3 text-lg"
            />
          </div>
          <div className="flex items-center gap-3">
            <input
              id="permite_registrar_saude"
              type="checkbox"
              checked={permiteRegistrarSaude}
              onChange={(e) => setPermiteRegistrarSaude(e.target.checked)}
              className="h-6 w-6"
            />
            <label htmlFor="permite_registrar_saude" className="text-lg text-gray-900">
              Permite registrar saúde
            </label>
          </div>
          <div className="flex items-center gap-3">
            <input
              id="permite_marcar_dose"
              type="checkbox"
              checked={permiteMarcarDose}
              onChange={(e) => setPermiteMarcarDose(e.target.checked)}
              className="h-6 w-6"
            />
            <label htmlFor="permite_marcar_dose" className="text-lg text-gray-900">
              Permite marcar dose
            </label>
          </div>
          <div className="flex items-center gap-3">
            <input
              id="permite_criar_evento_cuidado"
              type="checkbox"
              checked={permiteCriarEventoCuidado}
              onChange={(e) => setPermiteCriarEventoCuidado(e.target.checked)}
              className="h-6 w-6"
            />
            <label htmlFor="permite_criar_evento_cuidado" className="text-lg text-gray-900">
              Permite criar evento de cuidado
            </label>
          </div>
          <button type="submit" className="w-full rounded bg-blue-700 p-3 text-lg font-semibold text-white">
            Salvar permissões
          </button>
        </form>
        {erroPermissoes && (
          <p role="alert" className="text-lg text-red-700">
            {erroPermissoes}
          </p>
        )}
        {resultadoPermissoes && <pre className="whitespace-pre-wrap text-sm text-gray-700">{resultadoPermissoes}</pre>}
      </section>

      <section className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Ver meu status de decisão (GET /usuario/me)</h1>
        <p className="text-base text-gray-700">
          Mostra modo_decisao, a solicitação de transferência em curso (se houver) e a última
          alteração efetivada — mesmos campos que servem de aviso pro idoso (item 2.9, RF-033).
        </p>
        <button
          type="button"
          onClick={handleVerStatusDecisao}
          className="w-full rounded bg-blue-700 p-3 text-lg font-semibold text-white"
        >
          Buscar status
        </button>
        {erroStatusDecisao && (
          <p role="alert" className="text-lg text-red-700">
            {erroStatusDecisao}
          </p>
        )}
        {resultadoStatusDecisao && (
          <pre className="whitespace-pre-wrap text-sm text-gray-700">{resultadoStatusDecisao}</pre>
        )}
      </section>

      <section className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Solicitar transferência de decisão (familiar → idoso)</h1>
        <p className="text-base text-gray-700">
          Id do vínculo aprovado do próprio familiar solicitante com o idoso. Abre janela de 7
          dias; efetivação só acontece se a janela expirar sem o idoso logar (e, com 2+
          familiares aprovados, com a segunda confirmação).
        </p>
        <form onSubmit={handleSolicitarTransferencia} className="space-y-4">
          <div>
            <label htmlFor="vinculo_id_solicitar_transferencia" className="block text-lg font-medium text-gray-900">
              Id do vínculo
            </label>
            <input
              id="vinculo_id_solicitar_transferencia"
              type="number"
              required
              value={vinculoIdSolicitarTransferencia}
              onChange={(e) => setVinculoIdSolicitarTransferencia(e.target.value)}
              className="mt-1 w-full rounded border border-gray-400 p-3 text-lg"
            />
          </div>
          <div>
            <label htmlFor="motivo_transferencia" className="block text-lg font-medium text-gray-900">
              Motivo (opcional)
            </label>
            <input
              id="motivo_transferencia"
              type="text"
              maxLength={300}
              value={motivoTransferencia}
              onChange={(e) => setMotivoTransferencia(e.target.value)}
              className="mt-1 w-full rounded border border-gray-400 p-3 text-lg"
            />
          </div>
          <button type="submit" className="w-full rounded bg-blue-700 p-3 text-lg font-semibold text-white">
            Solicitar transferência
          </button>
        </form>
        {erroSolicitarTransferencia && (
          <p role="alert" className="text-lg text-red-700">
            {erroSolicitarTransferencia}
          </p>
        )}
        {resultadoSolicitarTransferencia && (
          <pre className="whitespace-pre-wrap text-sm text-gray-700">{resultadoSolicitarTransferencia}</pre>
        )}
      </section>

      <section className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Confirmar transferência de decisão (segundo familiar)</h1>
        <p className="text-base text-gray-700">
          Id do vínculo aprovado do familiar que está confirmando — precisa ser diferente de quem
          solicitou. Só marca a confirmação; não efetiva a mudança na hora.
        </p>
        <form onSubmit={handleConfirmarTransferencia} className="space-y-4">
          <div>
            <label htmlFor="vinculo_id_confirmar_transferencia" className="block text-lg font-medium text-gray-900">
              Id do vínculo
            </label>
            <input
              id="vinculo_id_confirmar_transferencia"
              type="number"
              required
              value={vinculoIdConfirmarTransferencia}
              onChange={(e) => setVinculoIdConfirmarTransferencia(e.target.value)}
              className="mt-1 w-full rounded border border-gray-400 p-3 text-lg"
            />
          </div>
          <button type="submit" className="w-full rounded bg-blue-700 p-3 text-lg font-semibold text-white">
            Confirmar transferência
          </button>
        </form>
        {erroConfirmarTransferencia && (
          <p role="alert" className="text-lg text-red-700">
            {erroConfirmarTransferencia}
          </p>
        )}
        {resultadoConfirmarTransferencia && (
          <pre className="whitespace-pre-wrap text-sm text-gray-700">{resultadoConfirmarTransferencia}</pre>
        )}
      </section>
    </main>
  )
}

export default Vinculos
