import { createContext } from 'react'
import type { EventoAgenda } from '../../lib/agendaPorDia'

// O cartão de compromisso aparece na lista, no painel do dia e na visão Dia do calendário. Em vez de passar Editar e Remover por
// três componentes, a área da agenda os entrega por aqui. Sem provedor (calendário avulso, testes), os botões não aparecem.
export type AcoesCompromisso = {
  podeAlterar: (evento: EventoAgenda) => boolean
  editar: (evento: EventoAgenda) => void
  remover: (evento: EventoAgenda) => void
}

export const AcoesCompromissoContext = createContext<AcoesCompromisso | null>(null)
