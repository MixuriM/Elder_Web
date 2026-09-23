import { useState, type FormEvent } from 'react'
import { chamarApi } from '../lib/chamarApi'
import Spinner from '../components/common/Spinner'

// Esqueleto cru da Fase 4, item 4.1 (RF-007): só o formulário de registro de leitura de
// saúde do idoso (POST /saude), pra exercitar o endpoint sem depender do front delas.
// Sem listagem, sem edição e sem polish visual: layout final é de Laureane/Jennifer.

function Saude() {
  const [tipoMedicao, setTipoMedicao] = useState('')
  const [valorSaude1, setValorSaude1] = useState('')
  const [valorSaude2, setValorSaude2] = useState('')
  const [unidadeSaude, setUnidadeSaude] = useState('')
  const [dataHoraSaude, setDataHoraSaude] = useState('')
  const [observacoesSaude, setObservacoesSaude] = useState('')
  const [carregandoSaude, setCarregandoSaude] = useState(false)
  const [resultadoSaude, setResultadoSaude] = useState<{ id: number } | null>(null)
  const [erroSaude, setErroSaude] = useState<string | null>(null)

  // Item 4.1 (RF-007). Não loga o corpo enviado nem os valores: dado de saúde é sensível.
  async function handleRegistrarSaude(e: FormEvent) {
    e.preventDefault()
    setErroSaude(null)
    setResultadoSaude(null)
    setCarregandoSaude(true)
    try {
      const corpo = await chamarApi('/saude', {
        method: 'POST',
        body: JSON.stringify({
          tipo_medicao: tipoMedicao,
          valor_1: Number(valorSaude1),
          valor_2: valorSaude2 === '' ? undefined : Number(valorSaude2),
          unidade: unidadeSaude,
          data_hora: dataHoraSaude === '' ? undefined : new Date(dataHoraSaude).toISOString(),
          observacoes: observacoesSaude === '' ? undefined : observacoesSaude,
        }),
      })
      setResultadoSaude(corpo)
    } catch (err) {
      console.error('Falha ao registrar leitura de saúde:', err instanceof Error ? err.message : 'erro')
      setErroSaude(err instanceof Error ? err.message : 'Falha ao registrar leitura de saúde.')
    } finally {
      setCarregandoSaude(false)
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center gap-10 p-6">
      <section className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Registrar leitura de saúde (só idoso)</h1>
        <form onSubmit={handleRegistrarSaude} className="space-y-4">
          <div>
            <label htmlFor="tipo_medicao_saude" className="block text-lg font-medium text-gray-900">
              Tipo de medição
            </label>
            <input
              id="tipo_medicao_saude"
              type="text"
              required
              maxLength={50}
              value={tipoMedicao}
              onChange={(e) => setTipoMedicao(e.target.value)}
              className="mt-1 w-full rounded border border-gray-400 p-3 text-lg"
            />
          </div>
          <div>
            <label htmlFor="valor_1_saude" className="block text-lg font-medium text-gray-900">
              Valor 1
            </label>
            <input
              id="valor_1_saude"
              type="number"
              required
              min={0}
              step="any"
              value={valorSaude1}
              onChange={(e) => setValorSaude1(e.target.value)}
              className="mt-1 w-full rounded border border-gray-400 p-3 text-lg"
            />
          </div>
          <div>
            <label htmlFor="valor_2_saude" className="block text-lg font-medium text-gray-900">
              Valor 2 (opcional)
            </label>
            <input
              id="valor_2_saude"
              type="number"
              min={0}
              step="any"
              value={valorSaude2}
              onChange={(e) => setValorSaude2(e.target.value)}
              className="mt-1 w-full rounded border border-gray-400 p-3 text-lg"
            />
          </div>
          <div>
            <label htmlFor="unidade_saude" className="block text-lg font-medium text-gray-900">
              Unidade
            </label>
            <input
              id="unidade_saude"
              type="text"
              required
              maxLength={20}
              value={unidadeSaude}
              onChange={(e) => setUnidadeSaude(e.target.value)}
              className="mt-1 w-full rounded border border-gray-400 p-3 text-lg"
            />
          </div>
          <div>
            <label htmlFor="data_hora_saude" className="block text-lg font-medium text-gray-900">
              Data e hora (opcional)
            </label>
            <input
              id="data_hora_saude"
              type="datetime-local"
              value={dataHoraSaude}
              onChange={(e) => setDataHoraSaude(e.target.value)}
              className="mt-1 w-full rounded border border-gray-400 p-3 text-lg"
            />
          </div>
          <div>
            <label htmlFor="observacoes_saude" className="block text-lg font-medium text-gray-900">
              Observações (opcional)
            </label>
            <input
              id="observacoes_saude"
              type="text"
              maxLength={300}
              value={observacoesSaude}
              onChange={(e) => setObservacoesSaude(e.target.value)}
              className="mt-1 w-full rounded border border-gray-400 p-3 text-lg"
            />
          </div>
          <button
            type="submit"
            disabled={carregandoSaude}
            aria-busy={carregandoSaude}
            className="flex w-full items-center justify-center gap-2 rounded bg-blue-700 p-3 text-lg font-semibold text-white disabled:opacity-70"
          >
            {carregandoSaude && <Spinner />}
            {carregandoSaude ? 'Registrando...' : 'Registrar leitura'}
          </button>
        </form>
        {erroSaude && (
          <p role="alert" className="text-lg text-red-700">
            {erroSaude}
          </p>
        )}
        {resultadoSaude && <p className="text-lg text-gray-900">Leitura registrada (id {resultadoSaude.id}).</p>}
      </section>
    </main>
  )
}

export default Saude
