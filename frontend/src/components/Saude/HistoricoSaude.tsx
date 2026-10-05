import { useState, type FormEvent } from 'react'

import { chamarApi } from '../../lib/chamarApi'
import Spinner from '../common/Spinner'
import CampoSaude from './CampoSaude'

type RegistroLista = {
  id: number
  tipo_medicao: string
  valor_1: number
  valor_2: number | null
  unidade: string
  data_hora: string
}

function HistoricoSaude() {
  const [idosoId, setIdosoId] = useState('')
  const [carregando, setCarregando] = useState(false)

  const [registros, setRegistros] =
    useState<RegistroLista[] | null>(null)

  const [erro, setErro] = useState<string | null>(null)

  async function handleVer(e: FormEvent) {
    e.preventDefault()

    setErro(null)
    setRegistros(null)
    setCarregando(true)

    try {
      const caminho =
        idosoId === ''
          ? '/saude'
          : `/saude/idoso/${idosoId}`

      const corpo = await chamarApi(caminho, {
        method: 'GET',
      })

      setRegistros(corpo.registros)
    } catch (err) {
      setErro(
        err instanceof Error
          ? err.message
          : 'Falha ao carregar histórico de saúde.',
      )
    } finally {
      setCarregando(false)
    }
  }

  return (
    <section
      className="
        w-full
        rounded-3xl
        border border-[#E5E2F5]
        bg-white
        p-6
        shadow-sm

        dark:border-[#393947]
        dark:bg-[#171721]

        md:p-8
      "
    >
      <div className="mb-7">
        <span className="text-sm font-bold uppercase tracking-[0.08em] text-[#6C63FF] dark:text-[#9B96FF]">
          Histórico
        </span>

        <h2 className="mt-2 text-2xl font-bold text-[#071A38] dark:text-[#F5F5FA]">
          Histórico de saúde
        </h2>

        <p className="mt-2 text-[#56657D] dark:text-[#C7C7D1]">
          Consulte as medições registradas.
        </p>
      </div>

      <form
        onSubmit={handleVer}
        className="space-y-5"
      >
        <CampoSaude
          id="idoso_id_historico"
          label="ID do idoso"
          type="number"
          min={1}
          step={1}
          placeholder="Deixe vazio para ver seu histórico"
          value={idosoId}
          onChange={(e) =>
            setIdosoId(e.target.value)
          }
        />

        <button
          type="submit"
          disabled={carregando}
          className="
            flex min-h-[54px] w-full
            items-center justify-center gap-2
            rounded-xl
            bg-[#6C63FF]
            px-5 py-3.5
            text-lg font-semibold text-white

            hover:bg-[#5C54E8]

            disabled:opacity-60
          "
        >
          {carregando && <Spinner />}

          {carregando
            ? 'Carregando...'
            : 'Ver histórico'}
        </button>
      </form>

      {erro && (
        <div
          role="alert"
          className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300"
        >
          {erro}
        </div>
      )}

      {registros && registros.length === 0 && (
        <div className="mt-6 rounded-2xl border border-[#E5E2F5] bg-[#F8F7FC] p-6 text-center dark:border-[#393947] dark:bg-[#1C1C27]">
          <p className="font-semibold text-[#56657D] dark:text-[#C7C7D1]">
            Nenhum registro encontrado.
          </p>
        </div>
      )}

      {registros && registros.length > 0 && (
        <div className="mt-7 space-y-3">
          {registros.map((registro) => (
            <article
              key={registro.id}
              className="
                rounded-2xl
                border border-[#E5E2F5]
                bg-[#FAF9FD]
                p-5

                dark:border-[#393947]
                dark:bg-[#1C1C27]
              "
            >
              <div className="flex items-start justify-between gap-4">
                <h3 className="font-bold text-[#071A38] dark:text-[#F5F5FA]">
                  {registro.tipo_medicao}
                </h3>

                <span className="text-sm font-semibold text-[#6C63FF] dark:text-[#9B96FF]">
                  #{registro.id}
                </span>
              </div>

              <p className="mt-3 text-2xl font-bold text-[#071A38] dark:text-[#F5F5FA]">
                {registro.valor_1}

                {registro.valor_2 !== null
                  ? ` / ${registro.valor_2}`
                  : ''}

                <span className="ml-2 text-base font-medium text-[#56657D] dark:text-[#C7C7D1]">
                  {registro.unidade}
                </span>
              </p>

              <p className="mt-3 border-t border-[#ECEAF4] pt-3 text-sm text-[#56657D] dark:border-[#34343F] dark:text-[#AFAFBD]">
                {new Date(
                  registro.data_hora,
                ).toLocaleString('pt-BR')}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export default HistoricoSaude