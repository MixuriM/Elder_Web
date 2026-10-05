import { useState, type FormEvent } from 'react'
import Spinner from '../components/common/Spinner'
import { getCurrentUserToken } from '../lib/auth'

// Esqueleto cru da Fase 7, item 7.1 (RF-018): registrar refeição ou plano alimentar (POST /alimentacao do idoso e
// POST /alimentacao/idoso/:idosoId do familiar), pra exercitar os endpoints sem depender do front delas. Sem
// listagem (é o 7.2) e sem polish visual: layout final é de Laureane/Jennifer. O frontend não sabe quem é cuidador:
// cuidador nunca cria e o 403 do backend vira mensagem (limitação aceita). Não usa chamarApi (repassa o corpo do
// erro): as mensagens são fixas por status e nunca ecoam o corpo (a descrição pode revelar dado de saúde, RNF-001).
// Sem console.*.

const REFEICOES = [
  ['cafe_manha', 'Café da manhã'],
  ['lanche_manha', 'Lanche da manhã'],
  ['almoco', 'Almoço'],
  ['lanche_tarde', 'Lanche da tarde'],
  ['jantar', 'Jantar'],
  ['ceia', 'Ceia'],
]

const MENSAGEM_ERRO: Record<number, string> = {
  400: 'Dados inválidos. Confira refeição, descrição e data e hora.',
  401: 'Sessão expirada. Entre novamente.',
  403: 'Você não tem permissão para registrar esta refeição.',
}
const ERRO_GENERICO = 'Não foi possível registrar a refeição.'

const VAZIO = { idosoId: '', refeicao: 'cafe_manha', descricao: '', dataHora: '' }

export default function Alimentacao() {
  const [campos, setCampos] = useState(VAZIO)
  const [carregando, setCarregando] = useState(false)
  const [criadoId, setCriadoId] = useState<number | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const setCampo = (campo: keyof typeof VAZIO) => (e: { target: { value: string } }) =>
    setCampos((atual) => ({ ...atual, [campo]: e.target.value }))

  async function handleRegistrar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setCriadoId(null)
    setCarregando(true)
    try {
      const token = await getCurrentUserToken()
      const caminho = campos.idosoId === '' ? '/alimentacao' : `/alimentacao/idoso/${campos.idosoId}`
      const res = await fetch(`${import.meta.env.VITE_API_URL}${caminho}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refeicao: campos.refeicao,
          descricao: campos.descricao,
          // datetime-local não traz fuso: toISOString() converte para UTC com Z, que o backend exige.
          data_hora: campos.dataHora === '' ? undefined : new Date(campos.dataHora).toISOString(),
        }),
      })
      if (!res.ok) {
        setErro(MENSAGEM_ERRO[res.status] ?? ERRO_GENERICO)
        return
      }
      const corpo = await res.json().catch(() => null)
      if (typeof corpo?.id === 'number') setCriadoId(corpo.id)
      else setErro(ERRO_GENERICO)
    } catch {
      setErro(ERRO_GENERICO)
    } finally {
      setCarregando(false)
    }
  }

  const classe = 'mt-1 w-full rounded border border-gray-400 p-3 text-lg'
  const classeLabel = 'block text-lg font-medium text-gray-900'

  return (
    <main className="flex min-h-screen flex-col items-center gap-10 p-6">
      <h1 className="text-3xl font-bold text-gray-900">Alimentação</h1>
      <section aria-labelledby="titulo_registrar_refeicao" className="w-full max-w-sm space-y-4">
        <h2 id="titulo_registrar_refeicao" className="text-2xl font-bold text-gray-900">
          Registrar refeição
        </h2>
        <form onSubmit={handleRegistrar} className="space-y-4">
          <div>
            <label htmlFor="idoso_id_alimentacao" className={classeLabel}>
              Id do idoso (vazio = minha alimentação)
            </label>
            <input
              id="idoso_id_alimentacao"
              type="number"
              min={1}
              step={1}
              value={campos.idosoId}
              onChange={setCampo('idosoId')}
              className={classe}
            />
          </div>
          <div>
            <label htmlFor="refeicao_alimentacao" className={classeLabel}>
              Refeição
            </label>
            <select id="refeicao_alimentacao" value={campos.refeicao} onChange={setCampo('refeicao')} className={classe}>
              {REFEICOES.map(([valor, rotulo]) => (
                <option key={valor} value={valor}>
                  {rotulo}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="descricao_alimentacao" className={classeLabel}>
              Descrição
            </label>
            <textarea
              id="descricao_alimentacao"
              required
              maxLength={500}
              rows={4}
              value={campos.descricao}
              onChange={setCampo('descricao')}
              className={classe}
            />
          </div>
          <div>
            <label htmlFor="data_hora_alimentacao" className={classeLabel}>
              Data e hora
            </label>
            <input
              id="data_hora_alimentacao"
              type="datetime-local"
              required
              value={campos.dataHora}
              onChange={setCampo('dataHora')}
              className={classe}
            />
          </div>
          <button
            type="submit"
            disabled={carregando}
            aria-busy={carregando}
            className="flex w-full items-center justify-center gap-2 rounded bg-blue-700 p-3 text-lg font-semibold text-white disabled:opacity-70"
          >
            {carregando && <Spinner />}
            {carregando ? 'Registrando...' : 'Registrar refeição'}
          </button>
        </form>
        {erro && (
          <p role="alert" className="text-lg text-red-700">
            {erro}
          </p>
        )}
        {criadoId !== null && (
          <p role="status" className="text-lg text-gray-900">
            Refeição registrada (id {criadoId}).
          </p>
        )}
      </section>
    </main>
  )
}
