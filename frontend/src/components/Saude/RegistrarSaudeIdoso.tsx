import { useState, type FormEvent } from 'react'

import { chamarApi } from '../../lib/chamarApi'
import Spinner from '../common/Spinner'
import CampoSaude from './CampoSaude'

const LEITURA_VAZIA = {
  idosoId: '',
  tipoMedicao: '',
  valor1: '',
  valor2: '',
  unidade: '',
  dataHora: '',
  observacoes: '',
}

function RegistrarSaudeIdoso() {
  const [campos, setCampos] = useState(LEITURA_VAZIA)

  const [carregando, setCarregando] = useState(false)
  const [resultado, setResultado] =
    useState<{ id: number } | null>(null)

  const [erro, setErro] = useState<string | null>(null)

  function atualizarCampo(
    campo: keyof typeof LEITURA_VAZIA,
    valor: string,
  ) {
    setCampos((atual) => ({
      ...atual,
      [campo]: valor,
    }))
  }

  async function handleRegistrar(e: FormEvent) {
    e.preventDefault()

    setErro(null)
    setResultado(null)
    setCarregando(true)

    try {
      const corpo = await chamarApi(
        `/saude/idoso/${campos.idosoId}`,
        {
          method: 'POST',

          body: JSON.stringify({
            tipo_medicao: campos.tipoMedicao,

            valor_1: Number(campos.valor1),

            valor_2:
              campos.valor2 === ''
                ? undefined
                : Number(campos.valor2),

            unidade: campos.unidade,

            data_hora:
              campos.dataHora === ''
                ? undefined
                : new Date(campos.dataHora).toISOString(),

            observacoes:
              campos.observacoes === ''
                ? undefined
                : campos.observacoes,
          }),
        },
      )

      setResultado(corpo)
    } catch (err) {
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
        <span className="text-sm font-bold uppercase tracking-[0.08em] text-[#5F56EC] dark:text-[#9B96FF]">
          Pessoa vinculada
        </span>

        <h2 className="mt-2 text-2xl font-bold text-[#071A38] dark:text-[#F5F5FA]">
          Registrar saúde do idoso
        </h2>

        <p className="mt-2 text-[#56657D] dark:text-[#C7C7D1]">
          Registre uma medição para um idoso vinculado à sua conta.
        </p>
      </div>

      <form
        onSubmit={handleRegistrar}
        className="space-y-5"
      >
        <CampoSaude
          id="idoso_id_cuid"
          label="ID do idoso"
          type="number"
          required
          min={1}
          step={1}
          placeholder="Digite o ID do idoso"
          value={campos.idosoId}
          onChange={(e) =>
            atualizarCampo(
              'idosoId',
              e.target.value,
            )
          }
        />

        <CampoSaude
          id="tipo_medicao_cuid"
          label="Tipo de medição"
          type="text"
          required
          maxLength={50}
          placeholder="Ex.: Glicemia"
          value={campos.tipoMedicao}
          onChange={(e) =>
            atualizarCampo(
              'tipoMedicao',
              e.target.value,
            )
          }
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <CampoSaude
            id="valor_1_cuid"
            label="Valor 1"
            type="number"
            required
            min={0}
            step="any"
            value={campos.valor1}
            onChange={(e) =>
              atualizarCampo(
                'valor1',
                e.target.value,
              )
            }
          />

          <CampoSaude
            id="valor_2_cuid"
            label="Valor 2 (opcional)"
            type="number"
            min={0}
            step="any"
            value={campos.valor2}
            onChange={(e) =>
              atualizarCampo(
                'valor2',
                e.target.value,
              )
            }
          />
        </div>

        <CampoSaude
          id="unidade_cuid"
          label="Unidade"
          type="text"
          required
          maxLength={20}
          placeholder="Ex.: mg/dL"
          value={campos.unidade}
          onChange={(e) =>
            atualizarCampo(
              'unidade',
              e.target.value,
            )
          }
        />

        <CampoSaude
          id="data_hora_cuid"
          label="Data e hora (opcional)"
          type="datetime-local"
          value={campos.dataHora}
          onChange={(e) =>
            atualizarCampo(
              'dataHora',
              e.target.value,
            )
          }
        />

        <CampoSaude
          id="observacoes_cuid"
          label="Observações (opcional)"
          type="text"
          maxLength={300}
          placeholder="Adicione alguma observação"
          value={campos.observacoes}
          onChange={(e) =>
            atualizarCampo(
              'observacoes',
              e.target.value,
            )
          }
        />

        <button
          type="submit"
          disabled={carregando}
          className="
            flex min-h-[54px] w-full
            items-center justify-center gap-2
            rounded-xl
            bg-[#5F56EC]
            px-5 py-3.5
            text-lg font-semibold text-white
            transition

            hover:bg-[#5C54E8]

            disabled:cursor-not-allowed
            disabled:opacity-60
          "
        >
          {carregando && <Spinner />}

          {carregando
            ? 'Registrando...'
            : 'Registrar leitura do idoso'}
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

      {resultado && (
        <div
          role="status"
          className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4 text-green-700 dark:border-green-900/50 dark:bg-green-950/20 dark:text-green-300"
        >
          Leitura registrada com sucesso.
        </div>
      )}
    </section>
  )
}

export default RegistrarSaudeIdoso