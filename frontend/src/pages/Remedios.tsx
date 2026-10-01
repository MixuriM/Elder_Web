import { useState, type FormEvent, type InputHTMLAttributes } from 'react'
import { chamarApi } from '../lib/chamarApi'
import Spinner from '../components/common/Spinner'

// Esqueleto cru da Fase 5, item 5.1 (RF-011): só os formulários de cadastro de medicamento
// (POST /remedios do idoso e POST /remedios/idoso/:idosoId do familiar), pra exercitar os endpoints
// sem depender do front delas. Sem listagem, sem ocultação por permissão e sem polish visual:
// layout final é de Laureane/Jennifer. Nunca loga o corpo enviado nem valores de medicamento.

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

export default function Remedios() {
  return (
    <main className="flex min-h-screen flex-col items-center gap-8 p-4">
      <h1 className="text-3xl font-bold text-gray-900">Medicamentos</h1>
      <CadastroMedicamento titulo="Cadastrar medicamento (só idoso)" sufixo="idoso" comIdoso={false} />
      <CadastroMedicamento titulo="Cadastrar medicamento de um idoso (familiar)" sufixo="familiar" comIdoso />
    </main>
  )
}
