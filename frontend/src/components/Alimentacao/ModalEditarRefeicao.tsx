import { useState, type FormEvent } from 'react'
import { Utensils } from 'lucide-react'

import { OPCOES_REFEICAO } from '../../lib/alimentacaoFormato'
import { chamarApi } from '../../lib/chamarApi'
import { paraInputDataHora } from '../../lib/dataHoraLocal'
import { mensagemEdicao } from '../../lib/mensagensAcaoRegistro'
import ModalBase from '../common/ModalBase'
import Spinner from '../common/Spinner'

export type RefeicaoParaEditar = {
  id: number
  refeicao: string
  descricao: string
  iso: string
}

interface ModalEditarRefeicaoProps {
  // null = fechado.
  registro: RefeicaoParaEditar | null
  // Caminho do PATCH deste registro (idoso: /alimentacao/:id; terceiro: /alimentacao/idoso/:idosoId/:id).
  caminho: string
  onFechar: () => void
  onSalvo: () => void
}

const CLASSE_CAMPO =
  'mt-1 min-h-12 w-full rounded-xl border border-[#DDD9F2] bg-white px-4 py-3 text-base text-[#071A38] outline-none transition placeholder:text-[#78849A] hover:border-[#A18BFF] focus:border-[#5F56EC] focus:ring-2 focus:ring-[#5F56EC]/20 disabled:cursor-not-allowed disabled:opacity-70 dark:border-[#454558] dark:bg-[#181824] dark:text-[#F5F5FA] dark:hover:border-[#66667A] dark:focus:border-[#A89FFF] dark:focus:ring-[#A89FFF]/20'
const CLASSE_LABEL = 'block text-base font-semibold text-[#071A38] dark:text-[#F5F5FA]'

function Conteudo({ registro, caminho, onFechar, onSalvo }: Omit<ModalEditarRefeicaoProps, 'registro'> & { registro: RefeicaoParaEditar }) {
  const [refeicao, setRefeicao] = useState(registro.refeicao)
  const [descricao, setDescricao] = useState(registro.descricao)
  const [dataHora, setDataHora] = useState(paraInputDataHora(registro.iso))
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function salvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (salvando) return

    setErro(null)

    const data = new Date(dataHora)

    if (descricao.trim() === '') {
      setErro('Descreva o que foi comido.')
      return
    }

    if (dataHora === '' || Number.isNaN(data.getTime())) {
      setErro('Informe uma data e hora válidas.')
      return
    }

    setSalvando(true)

    try {
      // datetime-local não traz fuso: toISOString() converte para UTC com Z, que o backend exige.
      await chamarApi(caminho, {
        method: 'PATCH',
        body: JSON.stringify({ refeicao, descricao: descricao.trim(), data_hora: data.toISOString() }),
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
      icone={<Utensils size={22} aria-hidden="true" />}
      sobretitulo="Alimentação"
      titulo="Editar refeição"
      descricao="Altere os dados da refeição."
    >
      <form onSubmit={salvar} className="space-y-5">
        <div>
          <label htmlFor="editar-refeicao-tipo" className={CLASSE_LABEL}>
            Refeição
          </label>
          <select
            id="editar-refeicao-tipo"
            disabled={salvando}
            value={refeicao}
            onChange={(e) => setRefeicao(e.target.value)}
            className={CLASSE_CAMPO}
          >
            {OPCOES_REFEICAO.map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="editar-refeicao-descricao" className={CLASSE_LABEL}>
            Descrição
          </label>
          <textarea
            id="editar-refeicao-descricao"
            required
            maxLength={500}
            rows={4}
            disabled={salvando}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            className={CLASSE_CAMPO}
          />
        </div>

        <div>
          <label htmlFor="editar-refeicao-data" className={CLASSE_LABEL}>
            Data e hora
          </label>
          <input
            id="editar-refeicao-data"
            type="datetime-local"
            required
            disabled={salvando}
            value={dataHora}
            onChange={(e) => setDataHora(e.target.value)}
            className={CLASSE_CAMPO}
          />
        </div>

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
            {salvando && <Spinner pequeno />}
            {salvando ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      </form>
    </ModalBase>
  )
}

// Monta só com um registro: o formulário nasce com os dados dele a cada abertura.
function ModalEditarRefeicao({ registro, ...resto }: ModalEditarRefeicaoProps) {
  return registro ? <Conteudo key={registro.id} registro={registro} {...resto} /> : null
}

export default ModalEditarRefeicao
