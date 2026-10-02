import { useState, type FormEvent, type InputHTMLAttributes } from 'react'
import { chamarApi } from '../lib/chamarApi'
import Spinner from '../components/common/Spinner'
import { usePermissoesDose } from '../lib/permissoesDose'

// Esqueleto cru da Fase 5, item 5.1 (RF-011): só os formulários de cadastro de medicamento
// (POST /remedios do idoso e POST /remedios/idoso/:idosoId do familiar), pra exercitar os endpoints
// sem depender do front delas. Sem listagem, sem ocultação por permissão e sem polish visual:
// layout final é de Laureane/Jennifer. Nunca loga o corpo enviado nem valores de medicamento.
//
// Item 5.2 (RF-012): seções de marcar dose (POST /remedios/:medicamentoId/doses do idoso e
// POST /remedios/idoso/:idosoId/:medicamentoId/doses de cuidador/familiar). Não existe GET de
// medicamento ainda: o id do medicamento e o do idoso são digitados. As seções de dose não usam console.*.

const VAZIO = { idosoId: '', nome: '', dosagem: '', frequencia: '', dataInicio: '', dataFim: '', observacoes: '' }

function CadastroMedicamento({ titulo, sufixo, comIdoso }: { titulo: string; sufixo: string; comIdoso: boolean }) {
  const [campos, setCampos] = useState(VAZIO)
  const [carregando, setCarregando] = useState(false)
  const [resultado, setResultado] = useState<{ id: number } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const setCampo = (campo: keyof typeof VAZIO) => (e: { target: { value: string } }) =>
    setCampos((atual) => ({ ...atual, [campo]: e.target.value }))

  async function handleCadastrar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setResultado(null)
    setCarregando(true)
    try {
      const caminho = comIdoso ? `/remedios/idoso/${campos.idosoId}` : '/remedios'
      const corpo = await chamarApi(caminho, {
        method: 'POST',
        body: JSON.stringify({
          nome: campos.nome,
          dosagem: campos.dosagem,
          frequencia: campos.frequencia,
          // O valor do <input type="date"> já é YYYY-MM-DD: sem toISOString(), que deslocaria o dia.
          data_inicio: campos.dataInicio,
          // Opcional em branco não é enviado.
          data_fim: campos.dataFim === '' ? undefined : campos.dataFim,
          observacoes: campos.observacoes === '' ? undefined : campos.observacoes,
        }),
      })
      setResultado(corpo)
    } catch (err) {
      console.error('Falha ao cadastrar medicamento:', err instanceof Error ? err.message : 'erro')
      setErro(err instanceof Error ? err.message : 'Falha ao cadastrar medicamento.')
    } finally {
      setCarregando(false)
    }
  }

  const slug = comIdoso ? 'familiar' : 'idoso'
  const classe = 'mt-1 w-full rounded border border-gray-400 p-3 text-lg'
  const campo = (
    rotulo: string,
    nome: keyof typeof VAZIO,
    atributos: InputHTMLAttributes<HTMLInputElement>,
  ) => (
    <div>
      <label htmlFor={`${nome}_${slug}`} className="block text-lg font-medium text-gray-900">
        {rotulo}
      </label>
      <input id={`${nome}_${slug}`} {...atributos} value={campos[nome]} onChange={setCampo(nome)} className={classe} />
    </div>
  )

  return (
    <section className="w-full max-w-sm space-y-4">
      <h2 className="text-2xl font-bold text-gray-900">{titulo}</h2>
      <form onSubmit={handleCadastrar} className="space-y-4">
        {comIdoso && campo(`Id do idoso (${sufixo})`, 'idosoId', { type: 'number', required: true, min: 1, step: 1 })}
        {campo(`Nome (${sufixo})`, 'nome', { type: 'text', required: true, maxLength: 150 })}
        {campo(`Dosagem (${sufixo})`, 'dosagem', { type: 'text', required: true, maxLength: 50 })}
        {campo(`Frequência (${sufixo})`, 'frequencia', { type: 'text', required: true, maxLength: 100 })}
        {campo(`Data de início (${sufixo})`, 'dataInicio', { type: 'date', required: true })}
        {campo(`Data de fim (opcional, ${sufixo})`, 'dataFim', { type: 'date' })}
        {campo(`Observações (opcional, ${sufixo})`, 'observacoes', { type: 'text', maxLength: 500 })}
        <button
          type="submit"
          disabled={carregando}
          aria-busy={carregando}
          className="flex w-full items-center justify-center gap-2 rounded bg-blue-700 p-3 text-lg font-semibold text-white disabled:opacity-70"
        >
          {carregando && <Spinner />}
          {carregando ? 'Cadastrando...' : `Cadastrar medicamento (${sufixo})`}
        </button>
      </form>
      {erro && (
        <p role="alert" className="text-lg text-red-700">
          {erro}
        </p>
      )}
      {resultado && (
        <p role="status" className="text-lg text-gray-900">
          Medicamento cadastrado (id {resultado.id}).
        </p>
      )}
    </section>
  )
}

const VAZIO_DOSE = { idosoId: '', medicamentoId: '', status: 'administrado', dataHora: '', observacoes: '' }

// Item 5.2 (RF-012): marcar dose. Sem listagem: o id do medicamento (e o do idoso, na seção do vinculado)
// é digitado. As mensagens de erro vêm fixas do backend e nunca repetem o que foi digitado.
function MarcarDose({ titulo, sufixo, comIdoso }: { titulo: string; sufixo: string; comIdoso: boolean }) {
  const [campos, setCampos] = useState(VAZIO_DOSE)
  const [carregando, setCarregando] = useState(false)
  const [resultado, setResultado] = useState<{ id: number } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const setCampo = (campo: keyof typeof VAZIO_DOSE) => (e: { target: { value: string } }) =>
    setCampos((atual) => ({ ...atual, [campo]: e.target.value }))

  async function handleMarcar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setResultado(null)
    setCarregando(true)
    try {
      const caminho = comIdoso
        ? `/remedios/idoso/${campos.idosoId}/${campos.medicamentoId}/doses`
        : `/remedios/${campos.medicamentoId}/doses`
      const corpo = await chamarApi(caminho, {
        method: 'POST',
        body: JSON.stringify({
          status_administracao: campos.status,
          // datetime-local não traz fuso: toISOString() converte para UTC com Z, que o backend exige.
          data_hora_administracao: campos.dataHora === '' ? undefined : new Date(campos.dataHora).toISOString(),
          observacoes: campos.observacoes === '' ? undefined : campos.observacoes,
        }),
      })
      setResultado(corpo)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao marcar dose.')
    } finally {
      setCarregando(false)
    }
  }

  const slug = `dose_${sufixo}`
  const classe = 'mt-1 w-full rounded border border-gray-400 p-3 text-lg'
  const rotulo = (texto: string, nome: keyof typeof VAZIO_DOSE) => (
    <label htmlFor={`${nome}_${slug}`} className="block text-lg font-medium text-gray-900">
      {texto}
    </label>
  )
  const campo = (texto: string, nome: keyof typeof VAZIO_DOSE, atributos: InputHTMLAttributes<HTMLInputElement>) => (
    <div>
      {rotulo(texto, nome)}
      <input id={`${nome}_${slug}`} {...atributos} value={campos[nome]} onChange={setCampo(nome)} className={classe} />
    </div>
  )

  return (
    <section className="w-full max-w-sm space-y-4">
      <h2 className="text-2xl font-bold text-gray-900">{titulo}</h2>
      <form onSubmit={handleMarcar} className="space-y-4">
        {comIdoso && campo(`Id do idoso (dose, ${sufixo})`, 'idosoId', { type: 'number', required: true, min: 1, step: 1 })}
        {campo(`Id do medicamento (dose, ${sufixo})`, 'medicamentoId', { type: 'number', required: true, min: 1, step: 1 })}
        <div>
          {rotulo(`Situação da dose (${sufixo})`, 'status')}
          <select id={`status_${slug}`} value={campos.status} onChange={setCampo('status')} className={classe}>
            <option value="administrado">Administrado</option>
            <option value="pulado">Pulado</option>
            <option value="atrasado">Atrasado</option>
          </select>
        </div>
        {campo(`Data e hora (opcional, ${sufixo})`, 'dataHora', { type: 'datetime-local' })}
        {campo(`Observações da dose (opcional, ${sufixo})`, 'observacoes', { type: 'text', maxLength: 300 })}
        <button
          type="submit"
          disabled={carregando}
          aria-busy={carregando}
          className="flex w-full items-center justify-center gap-2 rounded bg-blue-700 p-3 text-lg font-semibold text-white disabled:opacity-70"
        >
          {carregando && <Spinner />}
          {carregando ? 'Marcando...' : `Marcar dose (${sufixo})`}
        </button>
      </form>
      {erro && (
        <p role="alert" className="text-lg text-red-700">
          {erro}
        </p>
      )}
      {resultado && (
        <p role="status" className="text-lg text-gray-900">
          Dose registrada (id {resultado.id}).
        </p>
      )}
    </section>
  )
}

export default function Remedios() {
  const permissoes = usePermissoesDose()
  // Mesma regra de Saude.tsx: se a consulta de vínculos falhar, mostra a seção e o 403 do backend decide.
  const mostrarDoseVinculado = permissoes.estado === 'erro' || permissoes.escrita

  return (
    <main className="flex min-h-screen flex-col items-center gap-8 p-4">
      <h1 className="text-3xl font-bold text-gray-900">Medicamentos</h1>
      <CadastroMedicamento titulo="Cadastrar medicamento (só idoso)" sufixo="idoso" comIdoso={false} />
      <CadastroMedicamento titulo="Cadastrar medicamento de um idoso (familiar)" sufixo="familiar" comIdoso />
      <MarcarDose titulo="Marcar dose (só idoso)" sufixo="idoso" comIdoso={false} />
      {mostrarDoseVinculado && <MarcarDose titulo="Marcar dose de um idoso vinculado" sufixo="vinculado" comIdoso />}
      {permissoes.avisoSemFlag && (
        <p role="status" className="w-full max-w-sm text-lg text-gray-900">
          Você ainda não tem permissão para marcar dose de um idoso vinculado. Peça a quem decide pelo idoso para liberar.
        </p>
      )}
    </main>
  )
}
