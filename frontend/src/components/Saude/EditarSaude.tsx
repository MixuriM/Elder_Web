import { useState, type FormEvent } from 'react'

import { useIdososVinculados } from '../../hooks/useIdososVinculados'
import { chamarApi } from '../../lib/chamarApi'
import {
  envioBloqueado,
  ocultarSecaoDeTerceiros,
} from '../../lib/regrasIdosoVinculado'
import SeletorIdoso from '../common/SeletorIdoso'
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

interface EditarSaudeProps {
  titulo: string
  comIdoso: boolean
}

function EditarSaude({
  titulo,
  comIdoso,
}: EditarSaudeProps) {
  const idosos = useIdososVinculados()
  const [aberto, setAberto] = useState(false)
  const [campos, setCampos] = useState(LEITURA_VAZIA)
  const [registroId, setRegistroId] = useState('')

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

  async function handleEditar(e: FormEvent) {
    e.preventDefault()

    setErro(null)
    setResultado(null)
    setCarregando(true)

    try {
      const caminho = comIdoso
        ? `/saude/idoso/${campos.idosoId}/${registroId}`
        : `/saude/${registroId}`

      const corpo = await chamarApi(caminho, {
        method: 'PATCH',

        body: JSON.stringify({
          tipo_medicao:
            campos.tipoMedicao === ''
              ? undefined
              : campos.tipoMedicao,

          valor_1:
            campos.valor1 === ''
              ? undefined
              : Number(campos.valor1),

          valor_2:
            campos.valor2 === ''
              ? undefined
              : Number(campos.valor2),

          unidade:
            campos.unidade === ''
              ? undefined
              : campos.unidade,

          data_hora:
            campos.dataHora === ''
              ? undefined
              : new Date(campos.dataHora).toISOString(),

          observacoes:
            campos.observacoes === ''
              ? undefined
              : campos.observacoes,
        }),
      })

      setResultado(corpo)
    } catch (err) {
      setErro(
        err instanceof Error
          ? err.message
          : 'Falha ao editar leitura de saúde.',
      )
    } finally {
      setCarregando(false)
    }
  }

  function fecharFormulario() {
    setAberto(false)
    setErro(null)
    setResultado(null)
  }

  const prefixo = comIdoso
    ? 'idoso'
    : 'proprio'

  if (comIdoso && ocultarSecaoDeTerceiros(idosos)) {
    return null
  }

  return (
    <section
      className="
        w-full
        overflow-hidden
        rounded-3xl
        border border-[#E5E2F5]
        bg-white
        shadow-sm

        dark:border-[#393947]
        dark:bg-[#171721]
      "
    >
      <button
        type="button"
        onClick={() =>
          setAberto((atual) => !atual)
        }
        aria-expanded={aberto}
        className="
          flex w-full
          items-center
          justify-between
          gap-4
          p-6
          text-left
          transition

          hover:bg-[#FAF9FF]
          dark:hover:bg-[#1D1D28]

          md:p-7
        "
      >
        <div className="flex items-center gap-4">
          <div
            className="
              flex h-12 w-12
              shrink-0
              items-center justify-center
              rounded-2xl
              bg-[#F0EEFF]
              text-xl

              dark:bg-[#262533]
            "
          >
            ✏️
          </div>

          <div>
            <span className="text-sm font-bold uppercase tracking-[0.08em] text-[#5F56EC] dark:text-[#9B96FF]">
              Editar registro
            </span>

            <h2 className="mt-1 text-xl font-bold text-[#071A38] dark:text-[#F5F5FA]">
              {titulo}
            </h2>

            {!aberto && (
              <p className="mt-1 text-sm text-[#56657D] dark:text-[#C7C7D1]">
                Clique para alterar uma medição existente.
              </p>
            )}
          </div>
        </div>

        <span
          className={`
            text-2xl
            text-[#5F56EC]
            transition-transform
            duration-300
            dark:text-[#9B96FF]

            ${aberto ? 'rotate-180' : ''}
          `}
        >
          ⌄
        </span>
      </button>

      {aberto && (
        <div className="border-t border-[#E5E2F5] px-6 pb-7 pt-6 dark:border-[#393947] md:px-7">
          <p className="mb-6 text-[#56657D] dark:text-[#C7C7D1]">
            Preencha somente as informações que deseja alterar.
          </p>

          <form
            onSubmit={handleEditar}
            className="space-y-5"
          >
            {comIdoso && (
              <SeletorIdoso
                id={`idoso_${prefixo}`}
                escrita
                valor={campos.idosoId}
                aoMudar={(v) =>
                  atualizarCampo('idosoId', v)
                }
                lista={idosos}
              />
            )}

            <CampoSaude
              id={`registro_${prefixo}`}
              label="ID do registro"
              type="number"
              required
              min={1}
              step={1}
              value={registroId}
              onChange={(e) =>
                setRegistroId(e.target.value)
              }
            />

            <CampoSaude
              id={`tipo_${prefixo}`}
              label="Tipo de medição"
              type="text"
              maxLength={50}
              placeholder="Ex.: Pressão arterial"
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
                id={`valor1_${prefixo}`}
                label="Valor 1"
                type="number"
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
                id={`valor2_${prefixo}`}
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
              id={`unidade_${prefixo}`}
              label="Unidade"
              type="text"
              maxLength={20}
              value={campos.unidade}
              onChange={(e) =>
                atualizarCampo(
                  'unidade',
                  e.target.value,
                )
              }
            />

            <CampoSaude
              id={`data_${prefixo}`}
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
              id={`observacao_${prefixo}`}
              label="Observações (opcional)"
              type="text"
              maxLength={300}
              value={campos.observacoes}
              onChange={(e) =>
                atualizarCampo(
                  'observacoes',
                  e.target.value,
                )
              }
            />

            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <button
                type="submit"
                disabled={
                  carregando ||
                  (comIdoso &&
                    envioBloqueado(
                      idosos,
                      campos.idosoId,
                    ))
                }
                className="
                  flex min-h-[54px] flex-1
                  items-center justify-center gap-2
                  rounded-xl
                  bg-[#5F56EC]
                  px-5 py-3.5
                  font-semibold text-white

                  hover:bg-[#5C54E8]
                  disabled:opacity-60
                "
              >
                {carregando && <Spinner />}

                {carregando
                  ? 'Salvando...'
                  : 'Salvar alterações'}
              </button>

              <button
                type="button"
                onClick={fecharFormulario}
                disabled={carregando}
                className="
                  min-h-[54px]
                  rounded-xl
                  border border-[#DCD9EF]
                  bg-white
                  px-5 py-3.5
                  font-semibold
                  text-[#56657D]

                  dark:border-[#393947]
                  dark:bg-[#1C1C27]
                  dark:text-[#C7C7D1]
                "
              >
                Cancelar
              </button>
            </div>
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
              Registro atualizado com sucesso! Registro #{resultado.id}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

export default EditarSaude