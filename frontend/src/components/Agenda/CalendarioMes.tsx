import { useEffect, useRef, type KeyboardEvent } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { EventoAgenda } from '../../lib/agendaPorDia'
import { diaDaSemana, gradeDoMes, marcasDoDia, mesDe, rotuloCelula, somarDias, somarMeses, tituloMes } from '../../lib/calendario'
import MarcaTipo, { Legenda } from './MarcaTipo'

export const BOTAO_NAVEGAR =
  'inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-xl border border-[#DDD9F2] bg-white px-3 py-2 text-base font-semibold text-[#071A38] hover:border-[#5F56EC] hover:bg-[#F8F7FF] dark:border-[#454558] dark:bg-[#181824] dark:text-[#F5F5FA] dark:hover:border-[#A89FFF] dark:hover:bg-[#1D1D29]'

const SEMANA = [
  ['Dom', 'domingo'],
  ['Seg', 'segunda-feira'],
  ['Ter', 'terça-feira'],
  ['Qua', 'quarta-feira'],
  ['Qui', 'quinta-feira'],
  ['Sex', 'sexta-feira'],
  ['Sáb', 'sábado'],
] as const

type Props = {
  porDia: Map<string, EventoAgenda[]>
  hoje: string
  focado: string // dia com tabindex 0 (roving tabindex); o mês exibido é o dele
  selecionado: string
  aoFocar: (dia: string) => void
  aoSelecionar: (dia: string) => void
}

// Visão Mês no padrão de grade do ARIA: Tab entra e sai da grade num só passo; setas andam um dia ou uma
// semana, Home e End vão a domingo e sábado, PageUp e PageDown trocam o mês; Enter e Espaço selecionam
// (o próprio <button>).
export default function CalendarioMes({ porDia, hoje, focado, selecionado, aoFocar, aoSelecionar }: Props) {
  const { ano, mes } = mesDe(focado)
  const titulo = tituloMes(ano, mes)
  const grade = useRef<HTMLDivElement>(null)
  const moverFoco = useRef(false)

  // Só move o foco do navegador quando a troca veio do teclado na grade (nunca ao abrir nem pelos botões).
  useEffect(() => {
    if (!moverFoco.current) return
    moverFoco.current = false
    grade.current?.querySelector<HTMLButtonElement>(`[data-dia="${focado}"]`)?.focus()
  }, [focado])

  function teclar(e: KeyboardEvent) {
    const passos: Record<string, () => string> = {
      ArrowLeft: () => somarDias(focado, -1),
      ArrowRight: () => somarDias(focado, 1),
      ArrowUp: () => somarDias(focado, -7),
      ArrowDown: () => somarDias(focado, 7),
      Home: () => somarDias(focado, -diaDaSemana(focado)),
      End: () => somarDias(focado, 6 - diaDaSemana(focado)),
      PageUp: () => somarMeses(focado, -1),
      PageDown: () => somarMeses(focado, 1),
    }
    if (!Object.hasOwn(passos, e.key)) return
    e.preventDefault()
    moverFoco.current = true
    aoFocar(passos[e.key]())
  }

  return (
    <div className="min-w-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 id="titulo_mes_calendario" aria-live="polite" className="text-xl font-bold text-[#071A38] dark:text-[#F5F5FA] sm:text-2xl">
          {titulo}
        </h3>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => aoFocar(somarMeses(focado, -1))} className={BOTAO_NAVEGAR}>
            <ChevronLeft size={20} aria-hidden="true" />
            Mês anterior
          </button>
          <button
            type="button"
            onClick={() => {
              aoFocar(hoje)
              aoSelecionar(hoje)
            }}
            className={BOTAO_NAVEGAR}
          >
            Hoje
          </button>
          <button type="button" onClick={() => aoFocar(somarMeses(focado, 1))} className={BOTAO_NAVEGAR}>
            Próximo mês
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Em 360 px a grade ocupa quase todo o recuo do cartão (p-5), para cada dia ter 44 px de largura. */}
      <div
        ref={grade}
        role="grid"
        aria-labelledby="titulo_mes_calendario"
        onKeyDown={teclar}
        className="-mx-4 border-l border-t border-[#E5E2F5] dark:border-[#393947] sm:mx-0"
      >
        <div role="row" className="grid grid-cols-7">
          {SEMANA.map(([curto, longo]) => (
            <div
              key={curto}
              role="columnheader"
              aria-label={longo}
              className="border-b border-r border-[#E5E2F5] bg-[#F8F7FF] py-2 text-center text-sm font-bold text-[#56657D] dark:border-[#393947] dark:bg-[#1D1D29] dark:text-[#C7C7D1]"
            >
              {curto}
            </div>
          ))}
        </div>
        {gradeDoMes(ano, mes).map((semana) => (
          <div key={semana[0].dia} role="row" className="grid grid-cols-7">
            {semana.map((c) => {
              const eventos = porDia.get(c.dia) ?? []
              const { tipos, mais } = marcasDoDia(eventos)
              const ehHoje = c.dia === hoje
              const sel = c.dia === selecionado
              return (
                <div key={c.dia} role="gridcell" aria-selected={sel} className="min-w-0 border-b border-r border-[#E5E2F5] dark:border-[#393947]">
                  <button
                    type="button"
                    data-dia={c.dia}
                    tabIndex={c.dia === focado ? 0 : -1}
                    aria-label={rotuloCelula(c.dia, eventos, ehHoje)}
                    aria-current={ehHoje ? 'date' : undefined}
                    onClick={() => {
                      aoFocar(c.dia)
                      aoSelecionar(c.dia)
                    }}
                    className={`relative flex h-full min-h-14 w-full flex-col items-center gap-1 p-1 focus-visible:z-10 sm:min-h-24 sm:items-start sm:p-2 ${
                      sel
                        ? 'bg-[#F0EDFF] shadow-[inset_0_0_0_3px_#5F56EC] dark:bg-[#29263D] dark:shadow-[inset_0_0_0_3px_#A89FFF]'
                        : c.doMes
                          ? 'bg-white hover:bg-[#F8F7FF] dark:bg-[#171721] dark:hover:bg-[#1D1D29]'
                          : 'bg-[#F8F7FF] hover:bg-[#F0EDFF] dark:bg-[#13131C] dark:hover:bg-[#1D1D29]'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-base ${
                        ehHoje
                          ? 'bg-[#5F56EC] font-bold text-white dark:bg-[#A89FFF] dark:text-[#0F0F17]'
                          : c.doMes
                            ? 'font-bold text-[#071A38] dark:text-[#F5F5FA]'
                            : 'text-[#56657D] dark:text-[#A9A9B8]'
                      }`}
                    >
                      {c.numero}
                    </span>
                    {eventos.length > 0 && (
                      <span aria-hidden="true" className="flex flex-wrap items-center justify-center gap-1 sm:justify-start">
                        {tipos.map((t, i) => (
                          <MarcaTipo key={i} tipo={t} />
                        ))}
                        {mais > 0 && <span className="text-sm font-bold leading-none text-[#56657D] dark:text-[#C7C7D1]">+{mais}</span>}
                      </span>
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        ))}
      </div>
      <div className="mt-4">
        <Legenda />
      </div>
    </div>
  )
}
