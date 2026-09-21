import { useState, type FormEvent } from 'react'
import { getCurrentUserToken } from '../lib/auth'
import Spinner from '../components/common/Spinner'

// Esqueleto cru da Fase 2, itens 2.1 (RF-020), 2.2 (RF-021, RF-022), 2.6
// (RF-026), 2.7 (RF-027), 2.8 (RF-032), 2.9 (RF-033) e 2.10 (RF-034), a
// contestação de vínculo automático (RF-022, dívida do 2.5) e da
// Fase 3, item 3.1 (RF-030, cadastrar idoso) — só o
// necessário pra exercitar os endpoints de backend já implementados, sem
// listagem, sem polish visual. Layout final é responsabilidade de
// Laureane/Jennifer; isto existe só pra não depender do front delas pra
// testar o back. Resultados em texto legível (não JSON cru) e botões com
// indicador de carregamento, mesmo padrão de Login/Cadastro.

type VinculoCriado = {
  id: number
  status: string
}

type VinculoRespondido = {
  id: number
  status: string
}

type IdosoCadastrado = {
  usuario: { id: number; nome: string }
  vinculo: { id: number; status: string }
}

type PermissoesAtualizadas = {
  permite_registrar_saude: boolean
  permite_marcar_dose: boolean
  permite_criar_evento_cuidado: boolean
  definido_em: string | null
}

type ModoDecisaoInfo = {
  modo_decisao: string | null
  modo_decisao_solicitado: string | null
  modo_decisao_solicitado_em: string | null
  modo_decisao_expira_em: string | null
  modo_decisao_segunda_confirmacao_id: number | null
  modo_decisao_alterado_em: string | null
  modo_decisao_motivo: string | null
}

type LadoVinculo = { id: number | null; nome: string | null; email_mascarado: string | null }

type VinculoListado = {
  id: number
  tipo_vinculo: string
  origem: string
  status: string
  data_solicitacao: string
  data_resposta: string | null
  confirmado_em: string | null
  papel_do_chamador: string
  idoso: LadoVinculo
  vinculado: LadoVinculo
}

function formatarData(valor: string | null) {
  if (!valor) return null
  return new Date(valor).toLocaleString('pt-BR')
}

function ResumoModoDecisao({ info }: { info: ModoDecisaoInfo }) {
  return (
    <div className="space-y-2 text-lg text-gray-900">
      <p>
        Hoje, quem decide é:{' '}
        <strong>{info.modo_decisao === 'familiar' ? 'um familiar aprovado' : 'você mesmo'}</strong>
      </p>

      {info.modo_decisao_solicitado === 'familiar' ? (
        <div>
          <p>Há uma transferência para um familiar em andamento.</p>
          {formatarData(info.modo_decisao_expira_em) && <p>Prazo até: {formatarData(info.modo_decisao_expira_em)}</p>}
          <p>
            Confirmação de um segundo familiar:{' '}
            {info.modo_decisao_segunda_confirmacao_id ? 'já registrada' : 'ainda não registrada'}
          </p>
        </div>
      ) : (
        <p>Nenhuma transferência em andamento.</p>
      )}

      {formatarData(info.modo_decisao_alterado_em) && (
        <p>
          Última alteração: {formatarData(info.modo_decisao_alterado_em)}
          {info.modo_decisao_motivo && ` — motivo: ${info.modo_decisao_motivo}`}
        </p>
      )}
    </div>
  )
}

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
  const [carregandoSolicitar, setCarregandoSolicitar] = useState(false)
  const [resultadoSolicitar, setResultadoSolicitar] = useState<VinculoCriado | null>(null)
  const [erroSolicitar, setErroSolicitar] = useState<string | null>(null)

  const [vinculoId, setVinculoId] = useState('')
  const [acaoResponderEmAndamento, setAcaoResponderEmAndamento] = useState<'aprovar' | 'recusar' | null>(null)
  const [resultadoResponder, setResultadoResponder] = useState<VinculoRespondido | null>(null)
  const [erroResponder, setErroResponder] = useState<string | null>(null)

  const [emailIdoso, setEmailIdoso] = useState('')
  const [carregandoSolicitarFamiliar, setCarregandoSolicitarFamiliar] = useState(false)
  const [resultadoSolicitarFamiliar, setResultadoSolicitarFamiliar] = useState<VinculoCriado | null>(null)
  const [erroSolicitarFamiliar, setErroSolicitarFamiliar] = useState<string | null>(null)

  const [vinculoIdPermissoes, setVinculoIdPermissoes] = useState('')
  const [permiteRegistrarSaude, setPermiteRegistrarSaude] = useState(false)
  const [permiteMarcarDose, setPermiteMarcarDose] = useState(false)
  const [permiteCriarEventoCuidado, setPermiteCriarEventoCuidado] = useState(false)
  const [carregandoPermissoes, setCarregandoPermissoes] = useState(false)
  const [resultadoPermissoes, setResultadoPermissoes] = useState<PermissoesAtualizadas | null>(null)
  const [erroPermissoes, setErroPermissoes] = useState<string | null>(null)

  const [carregandoStatusDecisao, setCarregandoStatusDecisao] = useState(false)
  const [statusDecisao, setStatusDecisao] = useState<ModoDecisaoInfo | null>(null)
  const [erroStatusDecisao, setErroStatusDecisao] = useState<string | null>(null)

  const [vinculoIdSolicitarTransferencia, setVinculoIdSolicitarTransferencia] = useState('')
  const [motivoTransferencia, setMotivoTransferencia] = useState('')
  const [carregandoSolicitarTransferencia, setCarregandoSolicitarTransferencia] = useState(false)
  const [resultadoSolicitarTransferencia, setResultadoSolicitarTransferencia] = useState<ModoDecisaoInfo | null>(null)
  const [erroSolicitarTransferencia, setErroSolicitarTransferencia] = useState<string | null>(null)

  const [vinculoIdConfirmarTransferencia, setVinculoIdConfirmarTransferencia] = useState('')
  const [carregandoConfirmarTransferencia, setCarregandoConfirmarTransferencia] = useState(false)
  const [resultadoConfirmarTransferencia, setResultadoConfirmarTransferencia] = useState<ModoDecisaoInfo | null>(null)
  const [erroConfirmarTransferencia, setErroConfirmarTransferencia] = useState<string | null>(null)

  const [modoDecisaoDesejado, setModoDecisaoDesejado] = useState<'idoso' | 'familiar'>('idoso')
  const [carregandoAlterarModoDecisao, setCarregandoAlterarModoDecisao] = useState(false)
  const [resultadoAlterarModoDecisao, setResultadoAlterarModoDecisao] = useState<ModoDecisaoInfo | null>(null)
  const [erroAlterarModoDecisao, setErroAlterarModoDecisao] = useState<string | null>(null)

  const [vinculoIdContestar, setVinculoIdContestar] = useState('')
  const [carregandoContestar, setCarregandoContestar] = useState(false)
  const [resultadoContestar, setResultadoContestar] = useState<VinculoRespondido | null>(null)
  const [erroContestar, setErroContestar] = useState<string | null>(null)

  const [nomeIdosoCadastro, setNomeIdosoCadastro] = useState('')
  const [emailIdosoCadastro, setEmailIdosoCadastro] = useState('')
  const [telefoneIdosoCadastro, setTelefoneIdosoCadastro] = useState('')
  const [aceitaTermoCadastro, setAceitaTermoCadastro] = useState(false)
  const [carregandoCadastroIdoso, setCarregandoCadastroIdoso] = useState(false)
  const [resultadoCadastroIdoso, setResultadoCadastroIdoso] = useState<IdosoCadastrado | null>(null)
  const [erroCadastroIdoso, setErroCadastroIdoso] = useState<string | null>(null)

  const [filtroStatusListar, setFiltroStatusListar] = useState('')
  const [carregandoListar, setCarregandoListar] = useState(false)
  const [vinculosListados, setVinculosListados] = useState<VinculoListado[] | null>(null)
  const [erroListar, setErroListar] = useState<string | null>(null)

  async function handleListar(e: FormEvent) {
    e.preventDefault()
    setErroListar(null)
    setVinculosListados(null)
    setCarregandoListar(true)
    try {
      const query = filtroStatusListar ? `?status=${filtroStatusListar}` : ''
      const corpo = await chamarApi(`/vinculo${query}`)
      setVinculosListados(corpo.vinculos)
    } catch (err) {
      console.error('Falha ao listar vínculos:', err)
      setErroListar(err instanceof Error ? err.message : 'Falha ao listar vínculos.')
    } finally {
      setCarregandoListar(false)
    }
  }

  async function handleContestar(e: FormEvent) {
    e.preventDefault()
    setErroContestar(null)
    setResultadoContestar(null)
    setCarregandoContestar(true)
    try {
      const corpo = await chamarApi(`/vinculo/${vinculoIdContestar}/contestar`, { method: 'POST' })
      setResultadoContestar(corpo)
    } catch (err) {
      console.error('Falha ao contestar vínculo:', err)
      setErroContestar(err instanceof Error ? err.message : 'Falha ao contestar vínculo.')
    } finally {
      setCarregandoContestar(false)
    }
  }

  async function handleCadastrarIdoso(e: FormEvent) {
    e.preventDefault()
    setErroCadastroIdoso(null)
    setResultadoCadastroIdoso(null)
    setCarregandoCadastroIdoso(true)
    try {
      const corpo = await chamarApi('/usuario/cadastrar-idoso', {
        method: 'POST',
        body: JSON.stringify({
          nome: nomeIdosoCadastro,
          email: emailIdosoCadastro || undefined,
          telefone: telefoneIdosoCadastro || undefined,
          aceita_termo_responsabilidade: aceitaTermoCadastro,
        }),
      })
      setResultadoCadastroIdoso(corpo)
    } catch (err) {
      console.error('Falha ao cadastrar idoso:', err)
      setErroCadastroIdoso(err instanceof Error ? err.message : 'Falha ao cadastrar idoso.')
    } finally {
      setCarregandoCadastroIdoso(false)
    }
  }

  async function handleSolicitar(e: FormEvent) {
    e.preventDefault()
    setErroSolicitar(null)
    setResultadoSolicitar(null)
    setCarregandoSolicitar(true)
    try {
      const corpo = await chamarApi('/vinculo/solicitar-cuidador', {
        method: 'POST',
        body: JSON.stringify({ email, nome_idoso: nomeIdoso || undefined }),
      })
      setResultadoSolicitar(corpo)
    } catch (err) {
      console.error('Falha ao solicitar vínculo:', err)
      setErroSolicitar(err instanceof Error ? err.message : 'Falha ao solicitar vínculo.')
    } finally {
      setCarregandoSolicitar(false)
    }
  }

  async function handleResponder(acao: 'aprovar' | 'recusar') {
    setErroResponder(null)
    setResultadoResponder(null)
    setAcaoResponderEmAndamento(acao)
    try {
      const corpo = await chamarApi(`/vinculo/${vinculoId}/${acao}`, { method: 'POST' })
      setResultadoResponder(corpo)
    } catch (err) {
      console.error(`Falha ao ${acao} vínculo:`, err)
      setErroResponder(err instanceof Error ? err.message : `Falha ao ${acao} vínculo.`)
    } finally {
      setAcaoResponderEmAndamento(null)
    }
  }

  async function handleSolicitarFamiliar(e: FormEvent) {
    e.preventDefault()
    setErroSolicitarFamiliar(null)
    setResultadoSolicitarFamiliar(null)
    setCarregandoSolicitarFamiliar(true)
    try {
      const corpo = await chamarApi('/vinculo/solicitar-familiar', {
        method: 'POST',
        body: JSON.stringify({ email: emailIdoso }),
      })
      setResultadoSolicitarFamiliar(corpo)
    } catch (err) {
      console.error('Falha ao solicitar vínculo de familiar:', err)
      setErroSolicitarFamiliar(err instanceof Error ? err.message : 'Falha ao solicitar vínculo.')
    } finally {
      setCarregandoSolicitarFamiliar(false)
    }
  }

  async function handleDefinirPermissoes(e: FormEvent) {
    e.preventDefault()
    setErroPermissoes(null)
    setResultadoPermissoes(null)
    setCarregandoPermissoes(true)
    try {
      const corpo = await chamarApi(`/vinculo/${vinculoIdPermissoes}/definir-permissoes`, {
        method: 'PATCH',
        body: JSON.stringify({
          permite_registrar_saude: permiteRegistrarSaude,
          permite_marcar_dose: permiteMarcarDose,
          permite_criar_evento_cuidado: permiteCriarEventoCuidado,
        }),
      })
      setResultadoPermissoes(corpo)
    } catch (err) {
      console.error('Falha ao definir permissões:', err)
      setErroPermissoes(err instanceof Error ? err.message : 'Falha ao definir permissões.')
    } finally {
      setCarregandoPermissoes(false)
    }
  }

  async function handleVerStatusDecisao() {
    setErroStatusDecisao(null)
    setStatusDecisao(null)
    setCarregandoStatusDecisao(true)
    try {
      const corpo = await chamarApi('/usuario/me')
      setStatusDecisao(corpo)
    } catch (err) {
      console.error('Falha ao buscar status de decisão:', err)
      setErroStatusDecisao(err instanceof Error ? err.message : 'Falha ao buscar status de decisão.')
    } finally {
      setCarregandoStatusDecisao(false)
    }
  }

  async function handleSolicitarTransferencia(e: FormEvent) {
    e.preventDefault()
    setErroSolicitarTransferencia(null)
    setResultadoSolicitarTransferencia(null)
    setCarregandoSolicitarTransferencia(true)
    try {
      const corpo = await chamarApi(`/vinculo/${vinculoIdSolicitarTransferencia}/solicitar-transferencia-decisao`, {
        method: 'POST',
        body: JSON.stringify({ modo_decisao_motivo: motivoTransferencia || undefined }),
      })
      setResultadoSolicitarTransferencia(corpo)
    } catch (err) {
      console.error('Falha ao solicitar transferência de decisão:', err)
      setErroSolicitarTransferencia(
        err instanceof Error ? err.message : 'Falha ao solicitar transferência de decisão.',
      )
    } finally {
      setCarregandoSolicitarTransferencia(false)
    }
  }

  async function handleConfirmarTransferencia(e: FormEvent) {
    e.preventDefault()
    setErroConfirmarTransferencia(null)
    setResultadoConfirmarTransferencia(null)
    setCarregandoConfirmarTransferencia(true)
    try {
      const corpo = await chamarApi(`/vinculo/${vinculoIdConfirmarTransferencia}/confirmar-transferencia-decisao`, {
        method: 'POST',
      })
      setResultadoConfirmarTransferencia(corpo)
    } catch (err) {
      console.error('Falha ao confirmar transferência de decisão:', err)
      setErroConfirmarTransferencia(
        err instanceof Error ? err.message : 'Falha ao confirmar transferência de decisão.',
      )
    } finally {
      setCarregandoConfirmarTransferencia(false)
    }
  }

  async function handleAlterarModoDecisao(e: FormEvent) {
    e.preventDefault()
    setErroAlterarModoDecisao(null)
    setResultadoAlterarModoDecisao(null)
    setCarregandoAlterarModoDecisao(true)
    try {
      const corpo = await chamarApi('/usuario/me/modo-decisao', {
        method: 'PATCH',
        body: JSON.stringify({ modo_decisao: modoDecisaoDesejado }),
      })
      setResultadoAlterarModoDecisao(corpo)
    } catch (err) {
      console.error('Falha ao alterar modo_decisao:', err)
      setErroAlterarModoDecisao(err instanceof Error ? err.message : 'Falha ao alterar quem decide.')
    } finally {
      setCarregandoAlterarModoDecisao(false)
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
          <button
            type="submit"
            disabled={carregandoSolicitar}
            aria-busy={carregandoSolicitar}
            className="flex w-full items-center justify-center gap-2 rounded bg-blue-700 p-3 text-lg font-semibold text-white disabled:opacity-70"
          >
            {carregandoSolicitar && <Spinner />}
            {carregandoSolicitar ? 'Enviando...' : 'Solicitar'}
          </button>
        </form>
        {erroSolicitar && (
          <p role="alert" className="text-lg text-red-700">
            {erroSolicitar}
          </p>
        )}
        {resultadoSolicitar && (
          <p className="text-lg text-gray-900">
            Solicitação enviada (vínculo #{resultadoSolicitar.id}). Aguardando aprovação.
          </p>
        )}
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
            disabled={acaoResponderEmAndamento !== null}
            aria-busy={acaoResponderEmAndamento === 'aprovar'}
            className="flex flex-1 items-center justify-center gap-2 rounded bg-green-700 p-3 text-lg font-semibold text-white disabled:opacity-70"
          >
            {acaoResponderEmAndamento === 'aprovar' && <Spinner />}
            {acaoResponderEmAndamento === 'aprovar' ? 'Aprovando...' : 'Aprovar'}
          </button>
          <button
            type="button"
            onClick={() => handleResponder('recusar')}
            disabled={acaoResponderEmAndamento !== null}
            aria-busy={acaoResponderEmAndamento === 'recusar'}
            className="flex flex-1 items-center justify-center gap-2 rounded bg-red-700 p-3 text-lg font-semibold text-white disabled:opacity-70"
          >
            {acaoResponderEmAndamento === 'recusar' && <Spinner />}
            {acaoResponderEmAndamento === 'recusar' ? 'Recusando...' : 'Recusar'}
          </button>
        </div>
        {erroResponder && (
          <p role="alert" className="text-lg text-red-700">
            {erroResponder}
          </p>
        )}
        {resultadoResponder && (
          <p className="text-lg text-gray-900">
            Vínculo #{resultadoResponder.id} {resultadoResponder.status === 'aprovado' ? 'aprovado.' : 'recusado.'}
          </p>
        )}
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
          <button
            type="submit"
            disabled={carregandoSolicitarFamiliar}
            aria-busy={carregandoSolicitarFamiliar}
            className="flex w-full items-center justify-center gap-2 rounded bg-blue-700 p-3 text-lg font-semibold text-white disabled:opacity-70"
          >
            {carregandoSolicitarFamiliar && <Spinner />}
            {carregandoSolicitarFamiliar ? 'Enviando...' : 'Solicitar'}
          </button>
        </form>
        {erroSolicitarFamiliar && (
          <p role="alert" className="text-lg text-red-700">
            {erroSolicitarFamiliar}
          </p>
        )}
        {resultadoSolicitarFamiliar && (
          <p className="text-lg text-gray-900">
            Solicitação enviada (vínculo #{resultadoSolicitarFamiliar.id}). Aguardando aprovação do idoso.
          </p>
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
          <button
            type="submit"
            disabled={carregandoPermissoes}
            aria-busy={carregandoPermissoes}
            className="flex w-full items-center justify-center gap-2 rounded bg-blue-700 p-3 text-lg font-semibold text-white disabled:opacity-70"
          >
            {carregandoPermissoes && <Spinner />}
            {carregandoPermissoes ? 'Salvando...' : 'Salvar permissões'}
          </button>
        </form>
        {erroPermissoes && (
          <p role="alert" className="text-lg text-red-700">
            {erroPermissoes}
          </p>
        )}
        {resultadoPermissoes && (
          <div className="space-y-1 text-lg text-gray-900">
            <p>Permissões salvas:</p>
            <p>Registrar saúde: {resultadoPermissoes.permite_registrar_saude ? 'sim' : 'não'}</p>
            <p>Marcar dose: {resultadoPermissoes.permite_marcar_dose ? 'sim' : 'não'}</p>
            <p>Criar evento de cuidado: {resultadoPermissoes.permite_criar_evento_cuidado ? 'sim' : 'não'}</p>
          </div>
        )}
      </section>

      <section className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Quem decide por mim</h1>
        <p className="text-base text-gray-700">
          Mostra se é você ou um familiar quem decide hoje, e se há alguma transferência em
          andamento.
        </p>
        <button
          type="button"
          onClick={handleVerStatusDecisao}
          disabled={carregandoStatusDecisao}
          aria-busy={carregandoStatusDecisao}
          className="flex w-full items-center justify-center gap-2 rounded bg-blue-700 p-3 text-lg font-semibold text-white disabled:opacity-70"
        >
          {carregandoStatusDecisao && <Spinner />}
          {carregandoStatusDecisao ? 'Buscando...' : 'Buscar status'}
        </button>
        {erroStatusDecisao && (
          <p role="alert" className="text-lg text-red-700">
            {erroStatusDecisao}
          </p>
        )}
        {statusDecisao && <ResumoModoDecisao info={statusDecisao} />}
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
          <button
            type="submit"
            disabled={carregandoSolicitarTransferencia}
            aria-busy={carregandoSolicitarTransferencia}
            className="flex w-full items-center justify-center gap-2 rounded bg-blue-700 p-3 text-lg font-semibold text-white disabled:opacity-70"
          >
            {carregandoSolicitarTransferencia && <Spinner />}
            {carregandoSolicitarTransferencia ? 'Enviando...' : 'Solicitar transferência'}
          </button>
        </form>
        {erroSolicitarTransferencia && (
          <p role="alert" className="text-lg text-red-700">
            {erroSolicitarTransferencia}
          </p>
        )}
        {resultadoSolicitarTransferencia && (
          <p className="text-lg text-gray-900">
            Transferência solicitada.
            {formatarData(resultadoSolicitarTransferencia.modo_decisao_expira_em) &&
              ` Se ninguém agir, passa a valer em ${formatarData(resultadoSolicitarTransferencia.modo_decisao_expira_em)}.`}
          </p>
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
          <button
            type="submit"
            disabled={carregandoConfirmarTransferencia}
            aria-busy={carregandoConfirmarTransferencia}
            className="flex w-full items-center justify-center gap-2 rounded bg-blue-700 p-3 text-lg font-semibold text-white disabled:opacity-70"
          >
            {carregandoConfirmarTransferencia && <Spinner />}
            {carregandoConfirmarTransferencia ? 'Confirmando...' : 'Confirmar transferência'}
          </button>
        </form>
        {erroConfirmarTransferencia && (
          <p role="alert" className="text-lg text-red-700">
            {erroConfirmarTransferencia}
          </p>
        )}
        {resultadoConfirmarTransferencia && (
          <p className="text-lg text-gray-900">
            Confirmação registrada. A mudança só é efetivada quando a janela de 7 dias expirar.
          </p>
        )}
      </section>

      <section className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Alterar quem decide (só idoso)</h1>
        <p className="text-base text-gray-700">
          Só o próprio idoso pode chamar esta rota. Muda modo_decisao imediatamente, sem janela de
          carência e sem checar familiares ao reverter de familiar pra idoso (item 2.10, RF-034).
          Se houver uma transferência em curso (item 2.9), esta ação cancela a solicitação.
        </p>
        <form onSubmit={handleAlterarModoDecisao} className="space-y-4">
          <div>
            <label htmlFor="modo_decisao_desejado" className="block text-lg font-medium text-gray-900">
              Quem decide
            </label>
            <select
              id="modo_decisao_desejado"
              value={modoDecisaoDesejado}
              onChange={(e) => setModoDecisaoDesejado(e.target.value as 'idoso' | 'familiar')}
              className="mt-1 w-full rounded border border-gray-400 p-3 text-lg"
            >
              <option value="idoso">Eu mesmo (idoso)</option>
              <option value="familiar">Familiar(es) aprovado(s)</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={carregandoAlterarModoDecisao}
            aria-busy={carregandoAlterarModoDecisao}
            className="flex w-full items-center justify-center gap-2 rounded bg-blue-700 p-3 text-lg font-semibold text-white disabled:opacity-70"
          >
            {carregandoAlterarModoDecisao && <Spinner />}
            {carregandoAlterarModoDecisao ? 'Salvando...' : 'Salvar'}
          </button>
        </form>
        {erroAlterarModoDecisao && (
          <p role="alert" className="text-lg text-red-700">
            {erroAlterarModoDecisao}
          </p>
        )}
        {resultadoAlterarModoDecisao && <ResumoModoDecisao info={resultadoAlterarModoDecisao} />}
      </section>

      <section className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Cadastrar idoso (só familiar)</h1>
        <p className="text-base text-gray-700">
          Cria a conta de um idoso em seu nome. Informe e-mail ou telefone (pelo menos um). O
          vínculo fica pendente até você confirmar o seu e-mail.
        </p>
        <form onSubmit={handleCadastrarIdoso} className="space-y-4">
          <div>
            <label htmlFor="nome_idoso_cadastro" className="block text-lg font-medium text-gray-900">
              Nome do idoso
            </label>
            <input
              id="nome_idoso_cadastro"
              type="text"
              required
              maxLength={150}
              value={nomeIdosoCadastro}
              onChange={(e) => setNomeIdosoCadastro(e.target.value)}
              className="mt-1 w-full rounded border border-gray-400 p-3 text-lg"
            />
          </div>
          <div>
            <label htmlFor="email_idoso_cadastro" className="block text-lg font-medium text-gray-900">
              E-mail do idoso (opcional se informar telefone)
            </label>
            <input
              id="email_idoso_cadastro"
              type="email"
              maxLength={255}
              value={emailIdosoCadastro}
              onChange={(e) => setEmailIdosoCadastro(e.target.value)}
              className="mt-1 w-full rounded border border-gray-400 p-3 text-lg"
            />
          </div>
          <div>
            <label htmlFor="telefone_idoso_cadastro" className="block text-lg font-medium text-gray-900">
              Telefone do idoso (opcional se informar e-mail)
            </label>
            <input
              id="telefone_idoso_cadastro"
              type="tel"
              maxLength={20}
              value={telefoneIdosoCadastro}
              onChange={(e) => setTelefoneIdosoCadastro(e.target.value)}
              className="mt-1 w-full rounded border border-gray-400 p-3 text-lg"
            />
          </div>
          <div className="flex items-start gap-3">
            <input
              id="aceite_termo_cadastro"
              type="checkbox"
              checked={aceitaTermoCadastro}
              onChange={(e) => setAceitaTermoCadastro(e.target.checked)}
              className="mt-1 h-6 w-6"
            />
            {/* TEXTO PROVISÓRIO do termo de responsabilidade — o texto final e o layout
                são de Laureane e Jennifer. */}
            <label htmlFor="aceite_termo_cadastro" className="text-lg text-gray-900">
              Declaro que sou responsável por cadastrar esta pessoa e que informei dados
              verdadeiros. (texto provisório)
            </label>
          </div>
          <button
            type="submit"
            disabled={carregandoCadastroIdoso}
            aria-busy={carregandoCadastroIdoso}
            className="flex w-full items-center justify-center gap-2 rounded bg-blue-700 p-3 text-lg font-semibold text-white disabled:opacity-70"
          >
            {carregandoCadastroIdoso && <Spinner />}
            {carregandoCadastroIdoso ? 'Cadastrando...' : 'Cadastrar idoso'}
          </button>
        </form>
        {erroCadastroIdoso && (
          <p role="alert" className="text-lg text-red-700">
            {erroCadastroIdoso}
          </p>
        )}
        {resultadoCadastroIdoso && (
          <p className="text-lg text-gray-900">
            Idoso {resultadoCadastroIdoso.usuario.nome} cadastrado (id {resultadoCadastroIdoso.usuario.id}).
            Vínculo {resultadoCadastroIdoso.vinculo.id}:{' '}
            {resultadoCadastroIdoso.vinculo.status === 'aprovado'
              ? 'aprovado.'
              : 'pendente, aguardando a confirmação do seu e-mail.'}
          </p>
        )}
      </section>

      <section className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Contestar vínculo automático de familiar</h1>
        <p className="text-base text-gray-700">
          Só vale pra vínculo de familiar criado por convite ou por cadastro feito por familiar, já
          aprovado. O id do vínculo aparece na seção "Listar vínculos".
        </p>
        <form onSubmit={handleContestar} className="space-y-4">
          <div>
            <label htmlFor="vinculo_id_contestar" className="block text-lg font-medium text-gray-900">
              Id do vínculo
            </label>
            <input
              id="vinculo_id_contestar"
              type="number"
              required
              value={vinculoIdContestar}
              onChange={(e) => setVinculoIdContestar(e.target.value)}
              className="mt-1 w-full rounded border border-gray-400 p-3 text-lg"
            />
          </div>
          <button
            type="submit"
            disabled={carregandoContestar}
            aria-busy={carregandoContestar}
            className="flex w-full items-center justify-center gap-2 rounded bg-red-700 p-3 text-lg font-semibold text-white disabled:opacity-70"
          >
            {carregandoContestar && <Spinner />}
            {carregandoContestar ? 'Contestando...' : 'Contestar vínculo'}
          </button>
        </form>
        {erroContestar && (
          <p role="alert" className="text-lg text-red-700">
            {erroContestar}
          </p>
        )}
        {resultadoContestar && (
          <p className="text-lg text-gray-900">Vínculo #{resultadoContestar.id} contestado (recusado).</p>
        )}
      </section>

      <section className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Listar vínculos</h1>
        <p className="text-base text-gray-700">
          Mostra os vínculos que você pode ver, com o id de cada um para usar nas outras seções.
        </p>
        <form onSubmit={handleListar} className="space-y-4">
          <div>
            <label htmlFor="filtro_status_listar" className="block text-lg font-medium text-gray-900">
              Situação
            </label>
            <select
              id="filtro_status_listar"
              value={filtroStatusListar}
              onChange={(e) => setFiltroStatusListar(e.target.value)}
              className="mt-1 w-full rounded border border-gray-400 p-3 text-lg"
            >
              <option value="">Todas</option>
              <option value="pendente">Pendente</option>
              <option value="aprovado">Aprovado</option>
              <option value="recusado">Recusado</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={carregandoListar}
            aria-busy={carregandoListar}
            className="flex w-full items-center justify-center gap-2 rounded bg-blue-700 p-3 text-lg font-semibold text-white disabled:opacity-70"
          >
            {carregandoListar && <Spinner />}
            {carregandoListar ? 'Buscando...' : 'Listar vínculos'}
          </button>
        </form>
        {erroListar && (
          <p role="alert" className="text-lg text-red-700">
            {erroListar}
          </p>
        )}
        {vinculosListados && vinculosListados.length === 0 && (
          <p className="text-lg text-gray-900">Nenhum vínculo encontrado.</p>
        )}
        {vinculosListados && vinculosListados.length > 0 && (
          <ul className="space-y-3">
            {vinculosListados.map((v) => (
              <li key={v.id} className="space-y-1 rounded border border-gray-400 p-3 text-lg text-gray-900">
                <p className="text-2xl font-bold">Id do vínculo: {v.id}</p>
                <p>
                  {v.tipo_vinculo} ({v.origem}), {v.status}. Seu papel: {v.papel_do_chamador}.
                </p>
                <p>
                  Idoso: {v.idoso.nome ?? 'oculto até a aprovação'}
                  {v.idoso.email_mascarado && ` (${v.idoso.email_mascarado})`}
                </p>
                <p>
                  Vinculado: {v.vinculado.nome}
                  {v.vinculado.email_mascarado && ` (${v.vinculado.email_mascarado})`}
                </p>
                <p>Solicitado em: {formatarData(v.data_solicitacao)}</p>
                {formatarData(v.data_resposta) && <p>Respondido em: {formatarData(v.data_resposta)}</p>}
                {formatarData(v.confirmado_em) && <p>E-mail confirmado em: {formatarData(v.confirmado_em)}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}

export default Vinculos
