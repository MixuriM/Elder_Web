import { useState, type FormEvent } from 'react'

import { chamarApi } from '../../lib/chamarApi'
import Spinner from '../common/Spinner'
import CampoSaude from './CampoSaude'

function RegistrarMinhaSaude() {
  const [tipoMedicao, setTipoMedicao] = useState('')
  const [valorSaude1, setValorSaude1] = useState('')
  const [valorSaude2, setValorSaude2] = useState('')
  const [unidadeSaude, setUnidadeSaude] = useState('')
  const [dataHoraSaude, setDataHoraSaude] = useState('')
  const [observacoesSaude, setObservacoesSaude] = useState('')

  const [carregando, setCarregando] = useState(false)
  const [resultado, setResultado] =
    useState<{ id: number } | null>(null)

  const [erro, setErro] = useState<string | null>(null)

  async function handleRegistrarSaude(e: FormEvent) {
    e.preventDefault()

    setErro(null)
    setResultado(null)
    setCarregando(true)

    try {
      const corpo = await chamarApi('/saude', {
        method: 'POST',

        body: JSON.stringify({
          tipo_medicao: tipoMedicao,

          valor_1: Number(valorSaude1),

          valor_2:
            valorSaude2 === ''
              ? undefined
              : Number(valorSaude2),

          unidade: unidadeSaude,

          data_hora:
            dataHoraSaude === ''
              ? undefined
              : new Date(dataHoraSaude).toISOString(),

          observacoes:
            observacoesSaude === ''
              ? undefined
              : observacoesSaude,
        }),
      })

      setResultado(corpo)
    } catch (err) {
      console.error(
        'Falha ao registrar leitura de saúde:',
        err instanceof Error ? err.message : 'erro',
      )

      setErro(
        err instanceof Error
          ? err.message
          : 'Falha ao registrar leitura de saúde.',
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
        border
        border-[#E5E2F5]
        bg-white
        p-6
        shadow-sm

        dark:border-[#393947]
        dark:bg-[#171721]

        md:p-8
      "
    >
      <div className="mb-7">
        <span className="text-sm font-bold uppercase tracking-[0.08em] text-[#5F56EC] dark:text-[#9B96FF]">
          Minha saúde
        </span>

        <h2 className="mt-2 text-2xl font-bold text-[#071A38] dark:text-[#F5F5FA]">
          Registrar leitura de saúde
        </h2>

        <p className="mt-2 text-[#56657D] dark:text-[#C7C7D1]">
          Adicione uma nova medição ao seu histórico.
        </p>
      </div>

      <form
        onSubmit={handleRegistrarSaude}
        className="space-y-5"
      >
        <CampoSaude
          id="tipo_medicao_saude"
          label="Tipo de medição"
          type="text"
          required
          maxLength={50}
          placeholder="Ex.: Pressão arterial"
          value={tipoMedicao}
          onChange={(e) =>
            setTipoMedicao(e.target.value)
          }
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <CampoSaude
            id="valor_1_saude"
            label="Valor 1"
            type="number"
            required
            min={0}
            step="any"
            placeholder="Ex.: 120"
            value={valorSaude1}
            onChange={(e) =>
              setValorSaude1(e.target.value)
            }
          />

          <CampoSaude
            id="valor_2_saude"
            label="Valor 2 (opcional)"
            type="number"
            min={0}
            step="any"
            placeholder="Ex.: 80"
            value={valorSaude2}
            onChange={(e) =>
              setValorSaude2(e.target.value)
            }
          />
        </div>

        <CampoSaude
          id="unidade_saude"
          label="Unidade"
          type="text"
          required
          maxLength={20}
          placeholder="Ex.: mmHg"
          value={unidadeSaude}
          onChange={(e) =>
            setUnidadeSaude(e.target.value)
          }
        />

        <CampoSaude
          id="data_hora_saude"
          label="Data e hora (opcional)"
          type="datetime-local"
          value={dataHoraSaude}
          onChange={(e) =>
            setDataHoraSaude(e.target.value)
          }
        />

        <CampoSaude
          id="observacoes_saude"
          label="Observações (opcional)"
          type="text"
          maxLength={300}
          placeholder="Adicione alguma observação"
          value={observacoesSaude}
          onChange={(e) =>
            setObservacoesSaude(e.target.value)
          }
        />

        <button
          type="submit"
          disabled={carregando}
          className="
            flex
            min-h-[54px]
            w-full
            items-center
            justify-center
            gap-2
            rounded-xl
            bg-[#5F56EC]
            px-5
            py-3.5
            text-lg
            font-semibold
            text-white
            transition

            hover:bg-[#5C54E8]

            disabled:cursor-not-allowed
            disabled:opacity-60
          "
        >
          {carregando && <Spinner />}

          {carregando
            ? 'Registrando...'
            : 'Registrar leitura'}
        </button>
      </form>

      {erro && (
        <div
          role="alert"
          className="
            mt-5 rounded-xl
            border border-red-200
            bg-red-50
            p-4
            text-red-700

            dark:border-red-900/50
            dark:bg-red-950/20
            dark:text-red-300
          "
        >
          {erro}
        </div>
      )}

      {resultado && (
        <div
          role="status"
          className="
            mt-5 rounded-xl
            border border-green-200
            bg-green-50
            p-4
            text-green-700

            dark:border-green-900/50
            dark:bg-green-950/20
            dark:text-green-300
          "
        >
          Leitura registrada com sucesso.
        </div>
      )}
    </section>
  )
}

export default RegistrarMinhaSaude