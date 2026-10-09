import type { Vinculo } from '../components/Vinculos/CardVinculo'
import { temAutoridade, type ModoDecisao } from '../components/Vinculos/regrasVinculo'
import { agruparEventosPorDia, diaSP, formatarIntervalo, type EventoAgenda } from './agendaPorDia'

// Avisos calculados só com o que já existe: pedidos de vínculo que a pessoa pode responder e compromissos de hoje e
// de amanhã. Sem aviso de dose: o medicamento não tem horário estruturado, seria alarme falso. Função pura, sem log
// (título de compromisso médico pode ser dado de saúde, RNF-001).

export type Aviso = {
  id: string
  tipo: 'pedido' | 'compromisso'
  texto: string
  link: string
  rotuloLink: string
}

export type AgendaDoIdoso = { idosoNome: string | null; eventos: EventoAgenda[] }

type Entrada = {
  tipoPerfil: string | null
  modoDecisao?: ModoDecisao
  vinculos?: Vinculo[] | null
  agendas: AgendaDoIdoso[]
  agora?: Date
}

const UM_DIA_MS = 24 * 60 * 60 * 1000

export function calcularAvisos({ tipoPerfil, modoDecisao = 'idoso', vinculos, agendas, agora = new Date() }: Entrada): Aviso[] {
  const pedidos = (vinculos ?? []).filter((v) => v.status === 'pendente' && temAutoridade(v, tipoPerfil, modoDecisao))
  const avisos: Aviso[] = (['cuidador', 'familiar'] as const).flatMap((tipo) => {
    const n = pedidos.filter((v) => v.tipo_vinculo === tipo).length
    if (n === 0) return []
    return [
      {
        id: `pedido-${tipo}`,
        tipo: 'pedido' as const,
        texto: `Você tem ${n} ${n === 1 ? 'pedido' : 'pedidos'} de ${tipo} para responder.`,
        link: tipo === 'cuidador' ? '/cuidadores' : '/familia',
        rotuloLink: 'Responder',
      },
    ]
  })

  // ponytail: amanhã = agora + 24 h; vale porque São Paulo não tem horário de verão desde 2019.
  const amanha = diaSP(new Date(agora.getTime() + UM_DIA_MS))
  const compromissos = agendas.flatMap(({ idosoNome, eventos }) =>
    agruparEventosPorDia(eventos, agora).flatMap((g) => {
      if (g.dia !== amanha && !g.hoje) return []
      return g.eventos
        .filter((e) => !g.hoje || new Date(e.data_hora_fim ?? e.data_hora_inicio) >= agora)
        .map((e) => ({ e, idosoNome, quando: g.hoje ? 'Hoje' : 'Amanhã' }))
    }),
  )
  compromissos.sort((a, b) => new Date(a.e.data_hora_inicio).getTime() - new Date(b.e.data_hora_inicio).getTime())

  for (const { e, idosoNome, quando } of compromissos) {
    avisos.push({
      id: `compromisso-${e.id}`,
      tipo: 'compromisso',
      texto: `${quando}, ${formatarIntervalo(e)}: ${e.titulo}${idosoNome ? ` (${idosoNome})` : ''}`,
      link: '/agenda',
      rotuloLink: 'Ver agenda',
    })
  }
  return avisos
}
