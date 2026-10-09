import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { EventoAgenda } from '../../lib/agendaPorDia'
import { posicaoNoDia, somarDias, tituloDia } from '../../lib/calendario'
import CartaoCompromisso from './CartaoCompromisso'
import { BOTAO_NAVEGAR } from './CalendarioMes'

export const VAZIO_DIA = 'Nenhum compromisso neste dia.'

const hora = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

type Props = { dia: string; hoje: string; eventos: EventoAgenda[]; aoMudarDia: (dia: string) => void }

// Visão Dia: linha do tempo com os compromissos do dia por horário. Todo compromisso tem hora de início (o
// backend exige), então não existe "dia inteiro". Quem cruza a meia-noite aparece só no dia em que começa,
// como na lista, com o aviso de que continua.
export default function CalendarioDia({ dia, hoje, eventos, aoMudarDia }: Props) {
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 aria-live="polite" className="text-xl font-bold text-[#071A38] dark:text-[#F5F5FA] sm:text-2xl">
          {tituloDia(dia)}
        </h3>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => aoMudarDia(somarDias(dia, -1))} className={BOTAO_NAVEGAR}>
            <ChevronLeft size={20} aria-hidden="true" />
            Dia anterior
          </button>
          <button type="button" onClick={() => aoMudarDia(hoje)} className={BOTAO_NAVEGAR}>
            Hoje
          </button>
          <button type="button" onClick={() => aoMudarDia(somarDias(dia, 1))} className={BOTAO_NAVEGAR}>
            Próximo dia
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </div>
      </div>
      {eventos.length === 0 ? (
        <p className="rounded-2xl border border-[#E5E2F5] bg-[#FCFBFF] p-4 text-base font-semibold text-[#071A38] dark:border-[#393947] dark:bg-[#1D1D29] dark:text-[#F5F5FA]">
          {VAZIO_DIA}
        </p>
      ) : (
        <ol aria-label="Compromissos por horário" className="space-y-4">
          {eventos.map((e) => {
            const p = posicaoNoDia(e, dia)
            return (
              <li key={e.id} className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-3 sm:grid-cols-[4.5rem_minmax(0,1fr)]">
                <span aria-hidden="true" className="pt-4 text-right text-base font-bold tabular-nums text-[#554CD8] dark:text-[#B6B0FF]">
                  {hora(p.inicioMin)}
                </span>
                <div className="min-w-0 border-l-2 border-[#DDD9F2] pl-3 dark:border-[#454558] sm:pl-4">
                  <CartaoCompromisso evento={e} />
                  {p.terminaDepois && (
                    <p className="mt-2 text-base font-semibold text-[#56657D] dark:text-[#C7C7D1]">Continua no dia seguinte.</p>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
