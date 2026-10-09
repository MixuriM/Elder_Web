import { calcularAvisos } from './avisos'
import type { Vinculo } from '../components/Vinculos/CardVinculo'

// Dados fake só para o teste. São Paulo: offset fixo -03:00.
const AGORA = new Date('2026-10-09T15:00:00-03:00')

const evento = (id: number, inicio: string, fim: string | null = null, titulo = `Evento ${id}`) => ({
  id,
  tipo_evento: 'pessoal',
  titulo,
  descricao: null,
  data_hora_inicio: inicio,
  data_hora_fim: fim,
})

function vinculo(parcial: Partial<Vinculo>): Vinculo {
  return {
    id: 1,
    tipo_vinculo: 'cuidador',
    origem: 'solicitacao_cuidador',
    status: 'pendente',
    data_solicitacao: '2026-10-01T10:00:00Z',
    data_resposta: null,
    confirmado_em: null,
    papel_do_chamador: 'dono',
    decisao: null,
    permissoes: null,
    idoso: { id: 7, nome: 'Dona Ana', email_mascarado: null },
    vinculado: { id: 3, nome: 'Pessoa', email_mascarado: null },
    ...parcial,
  }
}

const base = { tipoPerfil: 'idoso', modoDecisao: 'idoso' as const, vinculos: [] as Vinculo[], agendas: [], agora: AGORA }

describe('calcularAvisos: pedidos de vínculo', () => {
  it('idoso que decide: um aviso por tipo, com a contagem e o link da lista certa', () => {
    const avisos = calcularAvisos({
      ...base,
      vinculos: [
        vinculo({ id: 1 }),
        vinculo({ id: 2 }),
        vinculo({ id: 3, tipo_vinculo: 'familiar', origem: 'solicitacao_familiar' }),
        vinculo({ id: 4, status: 'aprovado' }),
      ],
    })
    expect(avisos.map((a) => [a.texto, a.link])).toEqual([
      ['Você tem 2 pedidos de cuidador para responder.', '/cuidadores'],
      ['Você tem 1 pedido de familiar para responder.', '/familia'],
    ])
  })

  it('idoso com modo de decisão do familiar: nenhum pedido para ele', () => {
    expect(calcularAvisos({ ...base, modoDecisao: 'familiar', vinculos: [vinculo({})] })).toEqual([])
  })

  it('familiar titular decide; quem pediu (vinculado) nunca decide o próprio pedido', () => {
    const titular = vinculo({ papel_do_chamador: 'titular' })
    const proprio = vinculo({ id: 2, papel_do_chamador: 'vinculado', tipo_vinculo: 'familiar' })
    const avisos = calcularAvisos({ ...base, tipoPerfil: 'familiar', vinculos: [titular, proprio] })
    expect(avisos.map((a) => a.texto)).toEqual(['Você tem 1 pedido de cuidador para responder.'])
  })

  it('vínculos desconhecidos (null): nenhum aviso de pedido', () => {
    expect(calcularAvisos({ ...base, vinculos: null })).toEqual([])
  })
})

describe('calcularAvisos: compromissos', () => {
  it('hoje ainda não terminados e amanhã, em ordem de início; ontem, passados e depois de amanhã ficam de fora', () => {
    const avisos = calcularAvisos({
      ...base,
      agendas: [
        {
          idosoNome: null,
          eventos: [
            evento(1, '2026-10-10T09:00:00-03:00', null, 'Consulta'),
            evento(2, '2026-10-09T10:00:00-03:00'), // hoje, já passou
            evento(3, '2026-10-09T14:00:00-03:00', '2026-10-09T16:00:00-03:00'), // hoje, ainda em curso
            evento(4, '2026-10-09T19:30:00-03:00', null, 'Jantar'),
            evento(5, '2026-10-11T09:00:00-03:00'), // depois de amanhã
            evento(6, '2026-10-08T19:30:00-03:00'), // ontem
          ],
        },
      ],
    })
    expect(avisos.map((a) => [a.texto, a.link])).toEqual([
      ['Hoje, 14:00 às 16:00: Evento 3', '/agenda'],
      ['Hoje, 19:30: Jantar', '/agenda'],
      ['Amanhã, 09:00: Consulta', '/agenda'],
    ])
  })

  it('cuidador ou familiar: o nome do idoso entra no texto, juntando as agendas por horário', () => {
    const avisos = calcularAvisos({
      ...base,
      tipoPerfil: 'cuidador',
      agendas: [
        { idosoNome: 'Seu João', eventos: [evento(1, '2026-10-10T10:00:00-03:00', null, 'Fisioterapia')] },
        { idosoNome: 'Dona Ana', eventos: [evento(2, '2026-10-09T18:00:00-03:00', null, 'Banho')] },
      ],
    })
    expect(avisos.map((a) => a.texto)).toEqual(['Hoje, 18:00: Banho (Dona Ana)', 'Amanhã, 10:00: Fisioterapia (Seu João)'])
  })

  it('pedidos vêm antes dos compromissos', () => {
    const avisos = calcularAvisos({
      ...base,
      vinculos: [vinculo({})],
      agendas: [{ idosoNome: null, eventos: [evento(1, '2026-10-09T18:00:00-03:00')] }],
    })
    expect(avisos.map((a) => a.tipo)).toEqual(['pedido', 'compromisso'])
  })
})
