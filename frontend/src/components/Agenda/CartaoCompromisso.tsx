import { useContext, useId } from 'react'
import { Clock3 } from 'lucide-react'
import { formatarIntervalo, rotuloTipo, type EventoAgenda } from '../../lib/agendaPorDia'
import { AcoesCompromissoContext } from './acoesCompromisso'
import MarcaTipo from './MarcaTipo'

const BOTAO =
  'min-h-11 w-full rounded-xl border px-3 py-2.5 text-base font-semibold transition sm:w-auto sm:px-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#1D1D29]'

// Um compromisso como a lista da Agenda mostra; o calendário (painel do dia e visão Dia) usa o mesmo cartão.
// O título fica só no texto da tela, nunca em atributo (title, aria-label de fora): pode ser dado de saúde.
export default function CartaoCompromisso({ evento: e }: { evento: EventoAgenda }) {
  const acoes = useContext(AcoesCompromissoContext)
  const id = useId()
  const mostrar = acoes?.podeAlterar(e) === true

  return (
    <div className="rounded-2xl border border-[#E5E2F5] bg-[#FCFBFF] p-3 dark:border-[#393947] dark:bg-[#1D1D29] sm:p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-2 rounded-full bg-[#F0EDFF] px-3 py-1 text-sm font-bold text-[#554CD8] dark:bg-[#29263D] dark:text-[#B6B0FF]">
          <MarcaTipo tipo={e.tipo_evento} />
          {rotuloTipo(e.tipo_evento)}
        </span>
        <p className="flex items-center gap-2 text-base font-semibold text-[#56657D] dark:text-[#C7C7D1]">
          <Clock3 size={18} aria-hidden="true" className="shrink-0 text-[#5F56EC] dark:text-[#A89FFF]" />
          <time dateTime={e.data_hora_inicio}>{formatarIntervalo(e)}</time>
        </p>
      </div>
      <p id={`${id}-titulo`} className="mt-3 break-words text-lg font-bold text-[#071A38] dark:text-[#F5F5FA]">{e.titulo}</p>
      {e.descricao && <p className="mt-1 break-words text-base leading-relaxed text-[#56657D] dark:text-[#C7C7D1]">{e.descricao}</p>}
      {mostrar && acoes && (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:justify-end">
          {/* O nome do botão vem do texto da tela (Editar + título), nunca de um atributo com o título. */}
          <button
            type="button"
            id={`${id}-editar`}
            aria-labelledby={`${id}-editar ${id}-titulo`}
            onClick={() => acoes.editar(e)}
            className={`${BOTAO} border-[#5F56EC] text-[#5F56EC] hover:bg-[#5F56EC]/10 focus-visible:ring-[#5F56EC]/40 dark:border-[#A89FFF] dark:text-[#A89FFF]`}
          >
            Editar
          </button>
          <button
            type="button"
            id={`${id}-remover`}
            aria-labelledby={`${id}-remover ${id}-titulo`}
            onClick={() => acoes.remover(e)}
            className={`${BOTAO} border-red-700 text-red-700 hover:bg-red-700/10 focus-visible:ring-red-700/40 dark:border-red-400 dark:text-red-300`}
          >
            Remover
          </button>
        </div>
      )}
    </div>
  )
}
