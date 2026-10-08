import type {
  Dispatch,
  SetStateAction,
} from 'react'

export type CamposMedicamento = {
  nome: string
  dosagem: string
  frequencia: string
  dataInicio: string
  dataFim: string
  observacoes: string
}

interface FormMedicamentoProps {
  campos: CamposMedicamento

  setCampos: Dispatch<
    SetStateAction<CamposMedicamento>
  >

  // Cuidador e familiar: idoso escolhido na página, só leitura (o modal não troca o idoso).
  idosoNome?: string
  desabilitado?: boolean
}

function FormMedicamento({
  campos,
  setCampos,
  idosoNome,
  desabilitado = false,
}: FormMedicamentoProps) {
  function alterarCampo(
    campo: keyof CamposMedicamento,
    valor: string,
  ) {
    setCampos((atual) => ({
      ...atual,
      [campo]: valor,
    }))
  }

  const classeInput = `
    mt-2
    min-h-12
    w-full
    rounded-xl
    border
    border-[#D9D7E8]
    bg-white
    px-4
    py-3
    text-base
    text-[#071A38]
    outline-none
    transition

    placeholder:text-[#8B93A7]

    hover:border-[#BDB8DB]

    focus:border-[#6C63FF]
    focus:ring-2
    focus:ring-[#6C63FF]/15

    disabled:cursor-not-allowed
    disabled:bg-gray-100
    disabled:opacity-70

    dark:border-[#3B3B49]
    dark:bg-[#10101A]
    dark:text-[#F5F5FA]
    dark:placeholder:text-[#A7A7B5]

    dark:hover:border-[#555565]

    dark:focus:border-[#9B96FF]
    dark:focus:ring-[#9B96FF]/20

    dark:disabled:bg-[#20202A]
  `

  const classeLabel = `
    block
    text-sm
    font-semibold
    text-[#071A38]

    dark:text-[#F5F5FA]
  `

  return (
    <div className="space-y-5">
      {/* IDOSO (SÓ LEITURA) */}

      {idosoNome && (
        <p
          className="
            rounded-xl
            border
            border-[#E5E2F5]
            bg-[#F8F7FC]
            px-4
            py-3
            text-base
            text-[#071A38]

            dark:border-[#393947]
            dark:bg-[#1C1C27]
            dark:text-[#F5F5FA]
          "
        >
          Cadastrando para:{' '}
          <strong>{idosoNome}</strong>
        </p>
      )}

      {/* NOME */}

      <div>
        <label
          htmlFor="medicamento-nome"
          className={classeLabel}
        >
          Nome do medicamento
        </label>

        <input
          id="medicamento-nome"
          type="text"
          required
          disabled={desabilitado}
          value={campos.nome}
          onChange={(event) =>
            alterarCampo(
              'nome',
              event.target.value,
            )
          }
          placeholder="Ex.: Losartana"
          autoComplete="off"
          className={classeInput}
        />
      </div>

      {/* DOSAGEM */}

      <div>
        <label
          htmlFor="medicamento-dosagem"
          className={classeLabel}
        >
          Dosagem
        </label>

        <input
          id="medicamento-dosagem"
          type="text"
          required
          disabled={desabilitado}
          value={campos.dosagem}
          onChange={(event) =>
            alterarCampo(
              'dosagem',
              event.target.value,
            )
          }
          placeholder="Ex.: 50 mg"
          autoComplete="off"
          className={classeInput}
        />
      </div>

      {/* FREQUÊNCIA */}

      <div>
        <label
          htmlFor="medicamento-frequencia"
          className={classeLabel}
        >
          Frequência
        </label>

        <input
          id="medicamento-frequencia"
          type="text"
          required
          disabled={desabilitado}
          value={campos.frequencia}
          onChange={(event) =>
            alterarCampo(
              'frequencia',
              event.target.value,
            )
          }
          placeholder="Ex.: 1 vez ao dia"
          autoComplete="off"
          className={classeInput}
        />
      </div>

      {/* DATAS */}

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label
            htmlFor="medicamento-data-inicio"
            className={classeLabel}
          >
            Data de início
          </label>

          <input
            id="medicamento-data-inicio"
            type="date"
            required
            disabled={desabilitado}
            value={campos.dataInicio}
            onChange={(event) =>
              alterarCampo(
                'dataInicio',
                event.target.value,
              )
            }
            className={classeInput}
          />
        </div>

        <div>
          <label
            htmlFor="medicamento-data-fim"
            className={classeLabel}
          >
            Data de término
          </label>

          <input
            id="medicamento-data-fim"
            type="date"
            disabled={desabilitado}
            value={campos.dataFim}
            min={
              campos.dataInicio || undefined
            }
            onChange={(event) =>
              alterarCampo(
                'dataFim',
                event.target.value,
              )
            }
            className={classeInput}
          />

          <p
            className="
              mt-2
              text-xs
              text-[#56657D]

              dark:text-[#A7A7B5]
            "
          >
            Opcional. Deixe em branco para
            uso contínuo.
          </p>
        </div>
      </div>

      {/* OBSERVAÇÕES */}

      <div>
        <label
          htmlFor="medicamento-observacoes"
          className={classeLabel}
        >
          Observações
        </label>

        <textarea
          id="medicamento-observacoes"
          rows={4}
          disabled={desabilitado}
          value={campos.observacoes}
          onChange={(event) =>
            alterarCampo(
              'observacoes',
              event.target.value,
            )
          }
          placeholder="Ex.: Tomar após o café da manhã."
          className={`
            ${classeInput}
            resize-y
          `}
        />

        <p
          className="
            mt-2
            text-xs
            text-[#56657D]

            dark:text-[#A7A7B5]
          "
        >
          Campo opcional.
        </p>
      </div>
    </div>
  )
}

export default FormMedicamento