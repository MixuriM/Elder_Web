import { useState, type FormEvent } from 'react'
import { HeartPulse } from 'lucide-react'

import { chamarApi } from '../../lib/chamarApi'
import { paraInputDataHora } from '../../lib/dataHoraLocal'
import { mensagemEdicao } from '../../lib/mensagensAcaoRegistro'
import ModalBase from '../common/ModalBase'
import Spinner from '../common/Spinner'
import CampoSaude from './CampoSaude'

export type RegistroSaudeLista = {
  id: number
  registrado_por_id?: number
  tipo_medicao: string
  valor_1: number
  valor_2: number | null
  unidade: string
  data_hora: string
  observacoes?: string | null
}

type Campos = {
  tipo_medicao: string
  valor_1: string
  valor_2: string
  unidade: string
  data_hora: string
  observacoes: string
}

interface ModalEditarSaudeProps {
  // null = fechado.
  registro: RegistroSaudeLista | null
  // Caminho do PATCH deste registro (idoso: /saude/:id; terceiro: /saude/idoso/:idosoId/:id).
  caminho: string
  onFechar: () => void
  onSalvo: () => void
}

const converterValor = (valor: string) => Number(valor.replace(',', '.'))

const valorNumericoValido = (valor: number) =>
  Number.isFinite(valor) && valor >= 0 && valor <= 9999.99 && /^\d+(\.\d{1,2})?$/.test(String(valor))

function Conteudo({ registro, caminho, onFechar, onSalvo }: Omit<ModalEditarSaudeProps, 'registro'> & { registro: RegistroSaudeLista }) {
  const [campos, setCampos] = useState<Campos>({
    tipo_medicao: registro.tipo_medicao,
    valor_1: String(registro.valor_1),
    valor_2: registro.valor_2 === null ? '' : String(registro.valor_2),
    unidade: registro.unidade,
    data_hora: paraInputDataHora(registro.data_hora),
    observacoes: registro.observacoes ?? '',
  })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const alterar = (campo: keyof Campos) => (e: { target: { value: string } }) =>
    setCampos((anterior) => ({ ...anterior, [campo]: e.target.value }))

  async function salvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (salvando) return

    setErro(null)

    const valor1 = converterValor(campos.valor_1)
    const valor2 = campos.valor_2.trim() === '' ? null : converterValor(campos.valor_2)

    if (!valorNumericoValido(valor1) || (valor2 !== null && !valorNumericoValido(valor2))) {
      setErro('Informe valores entre 0 e 9999,99, com até duas casas decimais.')
      return
    }

    if (
      !campos.tipo_medicao.trim() ||
      campos.tipo_medicao.trim().length > 50 ||
      !campos.unidade.trim() ||
      campos.unidade.trim().length > 20 ||
      campos.observacoes.trim().length > 300
    ) {
      setErro('Confira os campos de medição, unidade e observações.')
      return
    }

    const data = new Date(campos.data_hora)

    if (!campos.data_hora || Number.isNaN(data.getTime()) || data.getTime() > Date.now() + 5 * 60 * 1000) {
      setErro('Informe uma data e hora válidas.')
      return
    }

    setSalvando(true)

    try {
      await chamarApi(caminho, {
        method: 'PATCH',
        body: JSON.stringify({
          tipo_medicao: campos.tipo_medicao.trim(),
          valor_1: valor1,
          valor_2: valor2,
          unidade: campos.unidade.trim(),
          data_hora: data.toISOString(),
          observacoes: campos.observacoes.trim() || null,
        }),
      })

      onSalvo()
    } catch (err) {
      setErro(mensagemEdicao(err))
      setSalvando(false)
    }
  }

  return (
    <ModalBase
      aberto
      onFechar={() => {
        if (!salvando) onFechar()
      }}
      icone={<HeartPulse size={22} aria-hidden="true" />}
      sobretitulo="Saúde"
      titulo="Editar registro"
      descricao="Altere os dados da medição."
    >
      <form onSubmit={salvar} className="space-y-5">
        <CampoSaude
          id="editar-saude-tipo"
          label="Tipo de medição"
          type="text"
          maxLength={50}
          required
          disabled={salvando}
          value={campos.tipo_medicao}
          onChange={alterar('tipo_medicao')}
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <CampoSaude
            id="editar-saude-valor1"
            label="Valor 1"
            type="text"
            inputMode="decimal"
            required
            disabled={salvando}
            value={campos.valor_1}
            onChange={alterar('valor_1')}
          />

          <CampoSaude
            id="editar-saude-valor2"
            label="Valor 2 (opcional)"
            type="text"
            inputMode="decimal"
            disabled={salvando}
            value={campos.valor_2}
            onChange={alterar('valor_2')}
          />
        </div>

        <CampoSaude
          id="editar-saude-unidade"
          label="Unidade"
          type="text"
          maxLength={20}
          required
          disabled={salvando}
          value={campos.unidade}
          onChange={alterar('unidade')}
        />

        <CampoSaude
          id="editar-saude-data"
          label="Data e hora"
          type="datetime-local"
          required
          disabled={salvando}
          value={campos.data_hora}
          onChange={alterar('data_hora')}
        />

        <CampoSaude
          id="editar-saude-obs"
          label="Observações (opcional)"
          type="text"
          maxLength={300}
          disabled={salvando}
          value={campos.observacoes}
          onChange={alterar('observacoes')}
        />

        {erro && (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300"
          >
            {erro}
          </p>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onFechar}
            disabled={salvando}
            className="min-h-12 rounded-xl border border-[#D9D7E8] bg-white px-5 py-3 font-semibold text-[#071A38] transition hover:bg-[#F3F0FF] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5F56EC]/40 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#393947] dark:bg-[#20202A] dark:text-[#F5F5FA] dark:hover:bg-[#292933]"
          >
            Cancelar
          </button>

          <button
            type="submit"
            disabled={salvando}
            aria-busy={salvando}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#5F56EC] px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-[#554CD8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5F56EC]/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-offset-[#171721]"
          >
            {salvando && <Spinner />}
            {salvando ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      </form>
    </ModalBase>
  )
}

// Monta só com um registro: o formulário nasce com os dados dele a cada abertura.
function ModalEditarSaude({ registro, ...resto }: ModalEditarSaudeProps) {
  return registro ? <Conteudo key={registro.id} registro={registro} {...resto} /> : null
}

export default ModalEditarSaude
