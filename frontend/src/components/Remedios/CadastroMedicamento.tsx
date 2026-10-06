import {
  useState,
  type FormEvent,
} from 'react'

import {
  CheckCircle2,
  Plus,
} from 'lucide-react'

import { chamarApi } from '../../lib/chamarApi'
import Spinner from '../common/Spinner'

import FormMedicamento, {
  type CamposMedicamento,
} from './FormMedicamento'

interface CadastroMedicamentoProps {
  comIdoso?: boolean
  onSucesso?: () => void
}

const CAMPOS_VAZIOS: CamposMedicamento = {
  idosoId: '',
  nome: '',
  dosagem: '',
  frequencia: '',
  dataInicio: '',
  dataFim: '',
  observacoes: '',
}

function CadastroMedicamento({
  comIdoso = false,
  onSucesso,
}: CadastroMedicamentoProps) {
  const [campos, setCampos] =
    useState<CamposMedicamento>({
      ...CAMPOS_VAZIOS,
    })

  const [carregando, setCarregando] =
    useState(false)

  const [erro, setErro] =
    useState<string | null>(null)

  const [sucesso, setSucesso] =
    useState(false)

  async function handleCadastrar(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    setErro(null)
    setSucesso(false)
    setCarregando(true)

    try {
      const caminho = comIdoso
        ? `/remedios/idoso/${campos.idosoId}`
        : '/remedios'

      await chamarApi(caminho, {
        method: 'POST',

        body: JSON.stringify({
          nome: campos.nome.trim(),
          dosagem: campos.dosagem.trim(),
          frequencia: campos.frequencia.trim(),

          data_inicio:
            campos.dataInicio,

          data_fim:
            campos.dataFim === ''
              ? undefined
              : campos.dataFim,

          observacoes:
            campos.observacoes.trim() === ''
              ? undefined
              : campos.observacoes.trim(),
        }),
      })

      setSucesso(true)

      setCampos({
        ...CAMPOS_VAZIOS,
      })

      onSucesso?.()
    } catch (err) {
      setErro(
        err instanceof Error
          ? err.message
          : 'Não foi possível cadastrar o medicamento.',
      )
    } finally {
      setCarregando(false)
    }
  }

  return (
    <form
      onSubmit={handleCadastrar}
      className="space-y-5"
    >
      <FormMedicamento
        campos={campos}
        setCampos={setCampos}
        comIdoso={comIdoso}
        desabilitado={carregando}
      />

      {erro && (
        <div
          role="alert"
          className="
            rounded-xl
            border
            border-red-200
            bg-red-50
            px-4
            py-3
            text-sm
            font-medium
            text-red-700

            dark:border-red-900/50
            dark:bg-red-950/20
            dark:text-red-300
          "
        >
          {erro}
        </div>
      )}

      {sucesso && (
        <div
          role="status"
          className="
            flex
            items-center
            gap-2
            rounded-xl
            border
            border-green-200
            bg-green-50
            px-4
            py-3
            text-sm
            font-medium
            text-green-700

            dark:border-green-900/50
            dark:bg-green-950/20
            dark:text-green-300
          "
        >
          <CheckCircle2
            size={18}
            aria-hidden="true"
          />

          Medicamento cadastrado com sucesso.
        </div>
      )}

      <div
        className="
          sticky
          bottom-0
          -mx-5
          border-t
          border-[#EEEAF8]
          bg-white
          px-5
          pb-1
          pt-4

          sm:-mx-7
          sm:px-7

          dark:border-[#393947]
          dark:bg-[#171721]
        "
      >
        <button
          type="submit"
          disabled={carregando}
          aria-busy={carregando}
          className="
            flex
            min-h-12
            w-full
            items-center
            justify-center
            gap-2
            rounded-xl
            bg-[#5F56EC]
            px-5
            py-3
            font-semibold
            text-white
            shadow-sm
            transition

            hover:bg-[#5A52E8]

            focus:outline-none
            focus-visible:ring-2
            focus-visible:ring-[#6C63FF]/40

            disabled:cursor-not-allowed
            disabled:opacity-60
          "
        >
          {carregando ? (
            <Spinner />
          ) : (
            <Plus
              size={19}
              aria-hidden="true"
            />
          )}

          {carregando
            ? 'Adicionando...'
            : 'Adicionar medicamento'}
        </button>
      </div>
    </form>
  )
}

export default CadastroMedicamento