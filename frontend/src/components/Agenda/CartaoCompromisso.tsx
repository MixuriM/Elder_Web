import { Clock3 } from 'lucide-react'
import { formatarIntervalo, rotuloTipo, type EventoAgenda } from '../../lib/agendaPorDia'
import MarcaTipo from './MarcaTipo'

// Um compromisso como a lista da Agenda mostra; o calendário (painel do dia e visão Dia) usa o mesmo cartão.
// O título fica só no texto da tela, nunca em atributo (title, aria-label de fora): pode ser dado de saúde.
export default function CartaoCompromisso({ evento: e }: { evento: EventoAgenda }) {
  return (
    <div className="rounded-2xl border border-[#E5E2F5] bg-[#FCFBFF] p-4 dark:border-[#393947] dark:bg-[#1D1D29] sm:p-5">
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
      <p className="mt-3 break-words text-lg font-bold text-[#071A38] dark:text-[#F5F5FA]">{e.titulo}</p>
      {e.descricao && <p className="mt-1 break-words text-base leading-relaxed text-[#56657D] dark:text-[#C7C7D1]">{e.descricao}</p>}
    </div>
  )
}
