import { useState, type FormEvent } from 'react'
import { Utensils } from 'lucide-react'

import { useIdososVinculados } from '../../hooks/useIdososVinculados'
import { OPCOES_REFEICAO } from '../../lib/alimentacaoFormato'
import { getCurrentUserToken } from '../../lib/auth'
import { envioBloqueado } from '../../lib/regrasIdosoVinculado'
import ModalBase from '../common/ModalBase'
import SeletorIdoso from '../common/SeletorIdoso'
import Spinner from '../common/Spinner'

interface ModalRegistrarRefeicaoProps {
  aberto: boolean
  onFechar: () => void
  onRegistrado: () => void
}

// Cuidador nunca registra e o 403 do backend vira mensagem. Não usa chamarApi (repassa o corpo do erro): as mensagens são
// fixas por status e nunca ecoam o corpo (a descrição pode revelar dado de saúde, RNF-001). Sem console.*.
const MENSAGEM_ERRO: Record<number, string> = {
  400: 'Dados inválidos. Confira refeição, descrição e data e hora.',
  401: 'Sessão expirada. Entre novamente.',
  403: 'Você não tem permissão para registrar esta refeição.',
}
const ERRO_GENERICO = 'Não foi possível registrar a refeição.'

const VAZIO = { idosoId: '', refeicao: 'cafe_manha', descricao: '', dataHora: '' }

const CLASSE_CAMPO =
  'mt-1 min-h-12 w-full rounded-xl border border-[#DDD9F2] bg-white px-4 py-3 text-base text-[#071A38] outline-none transition placeholder:text-[#78849A] hover:border-[#A18BFF] focus:border-[#5F56EC] focus:ring-2 focus:ring-[#5F56EC]/20 disabled:cursor-not-allowed disabled:opacity-70 dark:border-[#454558] dark:bg-[#181824] dark:text-[#F5F5FA] dark:hover:border-[#66667A] dark:focus:border-[#A89FFF] dark:focus:ring-[#A89FFF]/20'
const CLASSE_LABEL = 'block text-base font-semibold text-[#071A38] dark:text-[#F5F5FA]'

function Conteudo({ onFechar, onRegistrado }: Omit<ModalRegistrarRefeicaoProps, 'aberto'>) {
  const idosos = useIdososVinculados()
  const [campos, setCampos] = useState(VAZIO)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const alterar = (campo: keyof typeof VAZIO) => (e: { target: { value: string } }) =>
    setCampos((atual) => ({ ...atual, [campo]: e.target.value }))

  async function registrar(e: FormEvent) {
    e.preventDefault()
    if (enviando) return

    setErro(null)
    setEnviando(true)

    try {
      const token = await getCurrentUserToken()
      const caminho = idosos.ehIdoso ? '/alimentacao' : `/alimentacao/idoso/${campos.idosoId}`
      const res = await fetch(`${import.meta.env.VITE_API_URL}${caminho}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refeicao: campos.refeicao,
          descricao: campos.descricao,
          // datetime-local não traz fuso: toISOString() converte para UTC com Z, que o backend exige.
          data_hora: campos.dataHora === '' ? undefined : new Date(campos.dataHora).toISOString(),
        }),
      })

      if (!res.ok) {
        setErro(MENSAGEM_ERRO[res.status] ?? ERRO_GENERICO)
        return
      }

      const corpo = await res.json().catch(() => null)

      if (typeof corpo?.id === 'number') onRegistrado()
      else setErro(ERRO_GENERICO)
    } catch {
      setErro(ERRO_GENERICO)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <ModalBase
      aberto
      onFechar={() => {
        if (!enviando) onFechar()
      }}
      icone={<Utensils size={22} aria-hidden="true" />}
      sobretitulo="Alimentação"
      titulo="Registrar refeição"
      descricao="Anote uma refeição para manter as informações alimentares organizadas."
    >
      <form onSubmit={registrar} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2 empty:hidden">
          <SeletorIdoso id="idoso_id_registrar_refeicao" escrita valor={campos.idosoId} aoMudar={(v) => setCampos((a) => ({ ...a, idosoId: v }))} lista={idosos} />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="registrar-refeicao-tipo" className={CLASSE_LABEL}>
            Refeição
          </label>
          <select id="registrar-refeicao-tipo" disabled={enviando} value={campos.refeicao} onChange={alterar('refeicao')} className={CLASSE_CAMPO}>
            {OPCOES_REFEICAO.map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="registrar-refeicao-descricao" className={CLASSE_LABEL}>
            Descrição
          </label>
          <textarea
            id="registrar-refeicao-descricao"
            required
            maxLength={500}
            rows={4}
            disabled={enviando}
            value={campos.descricao}
            onChange={alterar('descricao')}
            className={CLASSE_CAMPO}
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="registrar-refeicao-data" className={CLASSE_LABEL}>
            Data e hora
          </label>
          <input
            id="registrar-refeicao-data"
            type="datetime-local"
            required
            disabled={enviando}
            value={campos.dataHora}
            onChange={alterar('dataHora')}
            className={CLASSE_CAMPO}
          />
        </div>

        {erro && (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300 sm:col-span-2"
          >
            {erro}
          </p>
        )}

        <div className="grid grid-cols-1 gap-3 sm:col-span-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={onFechar}
            disabled={enviando}
            className="min-h-12 rounded-xl border border-[#D9D7E8] bg-white px-5 py-3 font-semibold text-[#071A38] transition hover:bg-[#F3F0FF] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5F56EC]/40 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#393947] dark:bg-[#20202A] dark:text-[#F5F5FA] dark:hover:bg-[#292933]"
          >
            Cancelar
          </button>

          <button
            type="submit"
            disabled={enviando || envioBloqueado(idosos, campos.idosoId)}
            aria-busy={enviando}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#5F56EC] px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-[#554CD8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5F56EC]/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-offset-[#171721]"
          >
            {enviando && <Spinner pequeno />}
            {enviando ? 'Salvando...' : 'Salvar refeição'}
          </button>
        </div>
      </form>
    </ModalBase>
  )
}

// Só monta aberto: o formulário nasce vazio a cada abertura.
function ModalRegistrarRefeicao({ aberto, ...resto }: ModalRegistrarRefeicaoProps) {
  return aberto ? <Conteudo {...resto} /> : null
}

export default ModalRegistrarRefeicao
