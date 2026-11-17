import { useState, type FormEvent } from 'react'
import { CalendarPlus } from 'lucide-react'

import { chamarApi } from '../../lib/chamarApi'
import { mensagemPorStatus } from '../Vinculos/mensagensVinculo'
import type { ModoCriacao } from '../../lib/regrasAgenda'
import ModalBase from '../common/ModalBase'
import Spinner from '../common/Spinner'

interface ModalCriarCompromissoProps {
  aberto: boolean
  onFechar: () => void
  modo: ModoCriacao
  // Idoso da agenda (cuidador e familiar): o formulário usa o que já está escolhido na página e mostra o nome.
  idosoId: string
  idosoNome?: string
  onCriado: () => void
}

// Mensagem fixa por status: o corpo do erro nunca é exibido (título de compromisso médico pode ter dado de saúde).
const mensagemErroCriar = (erro: unknown) =>
  mensagemPorStatus(
    erro,
    {
      400: 'Dados inválidos. Confira título, início e fim.',
      401: 'Sessão expirada. Entre novamente.',
      403: 'Você não tem permissão para criar este compromisso.',
    },
    'Não foi possível criar o compromisso.',
  )

const CLASSE_CAMPO =
  'mt-1 min-h-12 w-full rounded-xl border border-[#DDD9F2] bg-white px-4 py-3 text-base text-[#071A38] outline-none transition placeholder:text-[#78849A] hover:border-[#A18BFF] focus:border-[#5F56EC] focus:ring-2 focus:ring-[#5F56EC]/20 disabled:cursor-not-allowed disabled:opacity-70 dark:border-[#454558] dark:bg-[#181824] dark:text-[#F5F5FA] dark:hover:border-[#66667A] dark:focus:border-[#A89FFF] dark:focus:ring-[#A89FFF]/20'
const CLASSE_LABEL = 'block text-base font-semibold text-[#071A38] dark:text-[#F5F5FA]'

const VAZIO = { tipo: 'pessoal', titulo: '', descricao: '', inicio: '', fim: '' }

function Conteudo({ onFechar, modo, idosoId, idosoNome, onCriado }: Omit<ModalCriarCompromissoProps, 'aberto'>) {
  const [campos, setCampos] = useState(VAZIO)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const alterar = (campo: keyof typeof VAZIO) => (e: { target: { value: string } }) =>
    setCampos((atual) => ({ ...atual, [campo]: e.target.value }))

  async function criar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (enviando) return

    setErro(null)

    if (campos.titulo.trim() === '') {
      setErro('Informe o título do compromisso.')
      return
    }

    const inicio = new Date(campos.inicio)

    if (campos.inicio === '' || Number.isNaN(inicio.getTime())) {
      setErro('Informe a data e hora de início.')
      return
    }

    const fim = campos.fim === '' ? null : new Date(campos.fim)

    if (fim && (Number.isNaN(fim.getTime()) || fim <= inicio)) {
      setErro('O fim precisa ser depois do início.')
      return
    }

    setEnviando(true)

    try {
      // datetime-local não traz fuso: toISOString() converte para UTC com Z, que o backend exige.
      await chamarApi(modo === 'idoso' ? '/agenda' : `/agenda/idoso/${idosoId}`, {
        method: 'POST',
        body: JSON.stringify({
          tipo_evento: modo === 'cuidador' ? 'cuidado' : campos.tipo,
          titulo: campos.titulo.trim(),
          descricao: campos.descricao.trim() === '' ? undefined : campos.descricao.trim(),
          data_hora_inicio: inicio.toISOString(),
          // Opcional em branco não é enviado.
          data_hora_fim: fim ? fim.toISOString() : undefined,
        }),
      })

      onCriado()
    } catch (err) {
      setErro(mensagemErroCriar(err))
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
      icone={<CalendarPlus size={22} aria-hidden="true" />}
      sobretitulo="Agenda"
      titulo="Criar compromisso"
      descricao={
        modo === 'idoso'
          ? 'Adicione um compromisso à sua rotina.'
          : modo === 'familiar'
            ? 'Organize um compromisso para a pessoa vinculada.'
            : 'Registre um compromisso de cuidado para a pessoa vinculada.'
      }
    >
      <form onSubmit={criar} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {modo !== 'idoso' && idosoNome && (
          <p className="rounded-xl border border-[#E5E2F5] bg-[#F8F7FC] px-4 py-3 text-base text-[#071A38] dark:border-[#393947] dark:bg-[#1C1C27] dark:text-[#F5F5FA] sm:col-span-2">
            Compromisso para: <strong>{idosoNome}</strong>
          </p>
        )}

        {modo !== 'cuidador' && (
          <div className="sm:col-span-2">
            <label htmlFor="criar-compromisso-tipo" className={CLASSE_LABEL}>
              Tipo
            </label>
            <select
              id="criar-compromisso-tipo"
              disabled={enviando}
              value={campos.tipo}
              onChange={alterar('tipo')}
              className={CLASSE_CAMPO}
            >
              <option value="pessoal">Pessoal</option>
              <option value="medico">Médico</option>
            </select>
          </div>
        )}

        <div className="sm:col-span-2">
          <label htmlFor="criar-compromisso-titulo" className={CLASSE_LABEL}>
            Título
          </label>
          <input
            id="criar-compromisso-titulo"
            type="text"
            required
            maxLength={150}
            disabled={enviando}
            value={campos.titulo}
            onChange={alterar('titulo')}
            className={CLASSE_CAMPO}
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="criar-compromisso-descricao" className={CLASSE_LABEL}>
            Descrição (opcional)
          </label>
          <textarea
            id="criar-compromisso-descricao"
            rows={3}
            maxLength={500}
            disabled={enviando}
            value={campos.descricao}
            onChange={alterar('descricao')}
            className={CLASSE_CAMPO}
          />
        </div>

        <div>
          <label htmlFor="criar-compromisso-inicio" className={CLASSE_LABEL}>
            Início
          </label>
          <input
            id="criar-compromisso-inicio"
            type="datetime-local"
            required
            disabled={enviando}
            value={campos.inicio}
            onChange={alterar('inicio')}
            className={CLASSE_CAMPO}
          />
        </div>

        <div>
          <label htmlFor="criar-compromisso-fim" className={CLASSE_LABEL}>
            Fim (opcional)
          </label>
          <input
            id="criar-compromisso-fim"
            type="datetime-local"
            disabled={enviando}
            value={campos.fim}
            onChange={alterar('fim')}
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
            disabled={enviando}
            aria-busy={enviando}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#5F56EC] px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-[#554CD8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5F56EC]/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-offset-[#171721]"
          >
            {enviando && <Spinner />}
            {enviando ? 'Criando...' : 'Criar compromisso'}
          </button>
        </div>
      </form>
    </ModalBase>
  )
}

// Só monta aberto: o formulário nasce vazio a cada abertura.
function ModalCriarCompromisso({ aberto, ...resto }: ModalCriarCompromissoProps) {
  return aberto ? <Conteudo {...resto} /> : null
}

export default ModalCriarCompromisso
