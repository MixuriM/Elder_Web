import { useMemo, useState } from 'react'
import type { GrupoDia } from '../../lib/agendaPorDia'
import { hojeSP, mapaPorDia, tituloDia } from '../../lib/calendario'
import { lerVisaoAgenda, salvarVisaoAgenda, type ModoCalendario } from '../../lib/preferencias'
import Alternador from './Alternador'
import CalendarioDia, { VAZIO_DIA } from './CalendarioDia'
import CalendarioMes from './CalendarioMes'
import CartaoCompromisso from './CartaoCompromisso'

const MODOS = [
  { valor: 'mes', rotulo: 'Mês' },
  { valor: 'dia', rotulo: 'Dia' },
] as const

// Calendário da Agenda sobre os mesmos grupos da lista (agruparEventosPorDia): o compromisso fica no dia em que
// começa, no fuso de São Paulo. Abre no dia de hoje; "agora" só é passado nos testes.
export default function Calendario({ grupos, agora }: { grupos: GrupoDia[]; agora?: Date }) {
  const hoje = hojeSP(agora)
  const porDia = useMemo(() => mapaPorDia(grupos), [grupos])
  const [modo, setModo] = useState<ModoCalendario>(() => lerVisaoAgenda().modo)
  const [focado, setFocado] = useState(hoje)
  const [selecionado, setSelecionado] = useState(hoje)

  function mudarModo(m: ModoCalendario) {
    setModo(m)
    salvarVisaoAgenda('agendaModo', m)
  }

  function irParaDia(dia: string) {
    setSelecionado(dia)
    setFocado(dia)
  }

  const doDia = porDia.get(selecionado) ?? []

  return (
    <div className="space-y-5">
      <Alternador legenda="Calendário por:" nome="modo_calendario" opcoes={MODOS} valor={modo} aoMudar={mudarModo} />
      {modo === 'dia' ? (
        <CalendarioDia dia={selecionado} hoje={hoje} eventos={doDia} aoMudarDia={irParaDia} />
      ) : (
        <div className="space-y-6 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-6 lg:space-y-0">
          <CalendarioMes
            porDia={porDia}
            hoje={hoje}
            focado={focado}
            selecionado={selecionado}
            aoFocar={setFocado}
            aoSelecionar={setSelecionado}
          />
          <section aria-labelledby="titulo_dia_selecionado" className="min-w-0">
            <h3 id="titulo_dia_selecionado" className="mb-3 text-lg font-bold text-[#071A38] dark:text-[#F5F5FA] sm:text-xl">
              {tituloDia(selecionado)}
            </h3>
            {doDia.length === 0 ? (
              <p className="rounded-2xl border border-[#E5E2F5] bg-[#FCFBFF] p-4 text-base font-semibold text-[#071A38] dark:border-[#393947] dark:bg-[#1D1D29] dark:text-[#F5F5FA]">
                {VAZIO_DIA}
              </p>
            ) : (
              <ul className="space-y-3">
                {doDia.map((e) => (
                  <li key={e.id}>
                    <CartaoCompromisso evento={e} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
