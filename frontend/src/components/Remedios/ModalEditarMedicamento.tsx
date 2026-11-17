import { useState, type FormEvent } from 'react'
import { Pill } from 'lucide-react'

import { chamarApi } from '../../lib/chamarApi'
import { mensagemEdicao } from '../../lib/mensagensAcaoRegistro'
import ModalBase from '../common/ModalBase'
import Spinner from '../common/Spinner'
import type { MedicamentoCard } from './CardMedicamento'
import FormMedicamento, { type CamposMedicamento } from './FormMedicamento'

interface ModalEditarMedicamentoProps {
  // null = fechado.
  medicamento: MedicamentoCard | null
  // Caminho do PATCH (idoso: /remedios/:id; terceiro: /remedios/idoso/:idosoId/:id).
  caminho: string
  onFechar: () => void
  onSalvo: () => void
}

function Conteudo({
  medicamento,
  caminho,
  onFechar,
  onSalvo,
}: Omit<ModalEditarMedicamentoProps, 'medicamento'> & { medicamento: MedicamentoCard }) {
  const [campos, setCampos] = useState<CamposMedicamento>({
    nome: medicamento.nome,
    dosagem: medicamento.dosagem,
    frequencia: medicamento.frequencia,
    dataInicio: medicamento.data_inicio,
    dataFim: medicamento.data_fim ?? '',
    observacoes: medicamento.observacoes ?? '',
  })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function salvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (salvando) return

    setErro(null)

    if (!campos.nome.trim() || !campos.dosagem.trim() || !campos.frequencia.trim() || campos.dataInicio === '') {
      setErro('Preencha nome, dosagem, frequência e a data de início.')
      return
    }

    if (campos.dataFim !== '' && campos.dataFim < campos.dataInicio) {
      setErro('A data de término não pode ser antes da data de início.')
      return
    }

    setSalvando(true)

    try {
      // null limpa o término e as observações no servidor (campo ausente manteria o valor antigo).
      await chamarApi(caminho, {
        method: 'PATCH',
        body: JSON.stringify({
          nome: campos.nome.trim(),
          dosagem: campos.dosagem.trim(),
          frequencia: campos.frequencia.trim(),
          data_inicio: campos.dataInicio,
          data_fim: campos.dataFim === '' ? null : campos.dataFim,
          observacoes: campos.observacoes.trim() === '' ? null : campos.observacoes.trim(),
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
      icone={<Pill size={22} aria-hidden="true" />}
      sobretitulo="Medicamentos"
      titulo="Editar medicamento"
      descricao="Altere os dados do medicamento."
    >
      <form onSubmit={salvar} className="space-y-5">
        <FormMedicamento campos={campos} setCampos={setCampos} desabilitado={salvando} />

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
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#5F56EC] px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-[#5A52E8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C63FF]/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-offset-[#171721]"
          >
            {salvando && <Spinner pequeno />}
            {salvando ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      </form>
    </ModalBase>
  )
}

// Monta só com um medicamento: o formulário nasce com os dados dele a cada abertura.
function ModalEditarMedicamento({ medicamento, ...resto }: ModalEditarMedicamentoProps) {
  return medicamento ? <Conteudo key={medicamento.id} medicamento={medicamento} {...resto} /> : null
}

export default ModalEditarMedicamento
