import { useState, type FormEvent, type InputHTMLAttributes } from 'react'
import { chamarApi } from '../lib/chamarApi'
import Spinner from '../components/common/Spinner'

// Esqueleto cru da Fase 6, itens 6.1 (RF-015) e 6.2 (RF-016): só os formulários de criar compromisso (POST /agenda do
// idoso e POST /agenda/idoso/:idosoId do familiar e do cuidador), pra exercitar os endpoints sem depender do
// front delas. Sem listagem, sem calendário e sem polish visual: layout final é de Laureane/Jennifer. Idoso e
// familiar escolhem 'pessoal' ou 'medico' (nunca 'cuidado'); a seção do cuidador não tem select e envia sempre
// 'cuidado'. O frontend não sabe se o cuidador tem a flag permite_criar_evento_cuidado: a seção sempre
// aparece e o 403 do backend vira mensagem de erro (limitação aceita). Nunca loga o corpo enviado nem o título.

const VAZIO = { idosoId: '', tipo: 'pessoal', titulo: '', descricao: '', inicio: '', fim: '' }

type Modo = 'idoso' | 'familiar' | 'cuidador'

// O modo é também o sufixo dos rótulos e o slug dos ids de campo (únicos por seção).
function CriarCompromisso({ titulo, modo }: { titulo: string; modo: Modo }) {
  const sufixo = modo
  const comIdoso = modo !== 'idoso'
  const [campos, setCampos] = useState(VAZIO)
  const [carregando, setCarregando] = useState(false)
  const [resultado, setResultado] = useState<{ id: number } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const setCampo = (campo: keyof typeof VAZIO) => (e: { target: { value: string } }) =>
    setCampos((atual) => ({ ...atual, [campo]: e.target.value }))

  async function handleCriar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setResultado(null)
    setCarregando(true)
    try {
      const caminho = comIdoso ? `/agenda/idoso/${campos.idosoId}` : '/agenda'
      const corpo = await chamarApi(caminho, {
        method: 'POST',
        body: JSON.stringify({
          tipo_evento: modo === 'cuidador' ? 'cuidado' : campos.tipo,
          titulo: campos.titulo,
          descricao: campos.descricao === '' ? undefined : campos.descricao,
          // datetime-local não traz fuso: toISOString() converte para UTC com Z, que o backend exige.
          data_hora_inicio: campos.inicio === '' ? undefined : new Date(campos.inicio).toISOString(),
          // Opcional em branco não é enviado.
          data_hora_fim: campos.fim === '' ? undefined : new Date(campos.fim).toISOString(),
        }),
      })
      setResultado(corpo)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao criar compromisso.')
    } finally {
      setCarregando(false)
    }
  }

  const slug = modo
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
      <form onSubmit={handleCriar} className="space-y-4">
        {comIdoso && campo(`Id do idoso (${sufixo})`, 'idosoId', { type: 'number', required: true, min: 1, step: 1 })}
        {modo !== 'cuidador' && (
          <div>
            <label htmlFor={`tipo_${slug}`} className="block text-lg font-medium text-gray-900">
              Tipo ({sufixo})
            </label>
            <select id={`tipo_${slug}`} value={campos.tipo} onChange={setCampo('tipo')} className={classe}>
              <option value="pessoal">Pessoal</option>
              <option value="medico">Médico</option>
            </select>
          </div>
        )}
        {campo(`Título (${sufixo})`, 'titulo', { type: 'text', required: true, maxLength: 150 })}
        {campo(`Descrição (opcional, ${sufixo})`, 'descricao', { type: 'text', maxLength: 500 })}
        {campo(`Início (${sufixo})`, 'inicio', { type: 'datetime-local', required: true })}
        {campo(`Fim (opcional, ${sufixo})`, 'fim', { type: 'datetime-local' })}
        <button
          type="submit"
          disabled={carregando}
          aria-busy={carregando}
          className="flex w-full items-center justify-center gap-2 rounded bg-blue-700 p-3 text-lg font-semibold text-white disabled:opacity-70"
        >
          {carregando && <Spinner />}
          {carregando ? 'Criando...' : `Criar compromisso (${sufixo})`}
        </button>
      </form>
      {erro && (
        <p role="alert" className="text-lg text-red-700">
          {erro}
        </p>
      )}
      {resultado && (
        <p role="status" className="text-lg text-gray-900">
          Compromisso criado (id {resultado.id}).
        </p>
      )}
    </section>
  )
}

export default function Agenda() {
  return (
    <main className="flex min-h-screen flex-col items-center gap-10 p-6">
      <h1 className="text-3xl font-bold text-gray-900">Agenda</h1>
      <CriarCompromisso titulo="Criar compromisso" modo="idoso" />
      <CriarCompromisso titulo="Criar compromisso para um idoso vinculado" modo="familiar" />
      <CriarCompromisso titulo="Criar compromisso de cuidado (cuidador)" modo="cuidador" />
    </main>
  )
}
