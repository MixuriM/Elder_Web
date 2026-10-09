import { eventosDeHoje, idososDoAcesso, permissoesDeEscrita, resumoMedicamentos } from './resumoDia'
import type { Vinculo } from '../components/Vinculos/CardVinculo'

// Dados fake só para o teste. São Paulo não tem horário de verão desde 2019: offset fixo -03:00.
const AGORA = new Date('2026-10-09T15:00:00-03:00')

const evento = (id: number, inicio: string) => ({
  id,
  tipo_evento: 'pessoal',
  titulo: `Evento ${id}`,
  descricao: null,
  data_hora_inicio: inicio,
  data_hora_fim: null,
})

function vinculo(parcial: Partial<Vinculo>): Vinculo {
  return {
    id: 1,
    tipo_vinculo: 'cuidador',
    origem: 'solicitacao_cuidador',
    status: 'aprovado',
    data_solicitacao: '2026-10-01T10:00:00Z',
    data_resposta: null,
    confirmado_em: null,
    papel_do_chamador: 'vinculado',
    decisao: null,
    permissoes: null,
    idoso: { id: 7, nome: 'Dona Ana', email_mascarado: 'a***@mail.com' },
    vinculado: { id: 3, nome: 'Eu', email_mascarado: null },
    ...parcial,
  }
}

describe('eventosDeHoje', () => {
  it('só os do dia de hoje em São Paulo, em ordem de início', () => {
    const eventos = [
      evento(1, '2026-10-09T18:00:00-03:00'),
      evento(2, '2026-10-10T01:00:00Z'), // 22h de hoje em SP, já é amanhã em UTC
      evento(3, '2026-10-09T02:00:00Z'), // 23h de ontem em SP
      evento(4, '2026-10-09T08:00:00-03:00'),
      evento(5, '2026-10-10T08:00:00-03:00'),
    ]
    expect(eventosDeHoje(eventos, AGORA).map((e) => e.id)).toEqual([4, 1, 2])
  })
})

describe('resumoMedicamentos', () => {
  it('conta ativos e as doses registradas hoje por status, ignorando outros dias', () => {
    const medicamentos = [
      {
        ativo: true,
        doses: [
          { status_administracao: 'administrado', data_hora_administracao: '2026-10-09T11:00:00Z' },
          { status_administracao: 'pulado', data_hora_administracao: '2026-10-09T20:00:00Z' },
          { status_administracao: 'administrado', data_hora_administracao: '2026-10-09T02:00:00Z' }, // ontem em SP
        ],
      },
      { ativo: false, doses: [{ status_administracao: 'atrasado', data_hora_administracao: '2026-10-09T12:00:00Z' }] },
      { ativo: true, doses: [] },
    ]
    expect(resumoMedicamentos(medicamentos, AGORA)).toEqual({
      ativos: 2,
      dosesHoje: 3,
      porStatus: { administrado: 1, pulado: 1, atrasado: 1 },
    })
  })
})

describe('permissoesDeEscrita', () => {
  it('idoso escreve tudo nos próprios dados', () => {
    expect(permissoesDeEscrita({ tipoPerfil: 'idoso', vinculos: [] }, null)).toEqual({
      saude: true,
      dose: true,
      agenda: true,
      medicamento: true,
    })
  })

  it('cuidador: cada flag do vínculo com o idoso escolhido; nunca cadastra medicamento', () => {
    const v = vinculo({
      permissoes: { permite_registrar_saude: true, permite_marcar_dose: false, permite_criar_evento_cuidado: true },
    })
    expect(permissoesDeEscrita({ tipoPerfil: 'cuidador', vinculos: [v] }, 7)).toEqual({
      saude: true,
      dose: false,
      agenda: true,
      medicamento: false,
    })
  })

  it('cuidador: flag de outro idoso não vale para o escolhido', () => {
    const v = vinculo({
      permissoes: { permite_registrar_saude: true, permite_marcar_dose: true, permite_criar_evento_cuidado: true },
    })
    expect(permissoesDeEscrita({ tipoPerfil: 'cuidador', vinculos: [v] }, 9).saude).toBe(false)
  })

  it('familiar só escreve quando decide pelo idoso (modo familiar)', () => {
    const decide = vinculo({ tipo_vinculo: 'familiar', decisao: { modo: 'familiar', transferencia: null } })
    const naoDecide = vinculo({ tipo_vinculo: 'familiar', decisao: { modo: 'idoso', transferencia: null } })
    expect(permissoesDeEscrita({ tipoPerfil: 'familiar', vinculos: [decide] }, 7).medicamento).toBe(true)
    expect(permissoesDeEscrita({ tipoPerfil: 'familiar', vinculos: [naoDecide] }, 7)).toEqual({
      saude: false,
      dose: false,
      agenda: false,
      medicamento: false,
    })
  })

  it('vínculo pendente ou de outra pessoa (titular) não dá escrita', () => {
    const pendente = vinculo({
      status: 'pendente',
      permissoes: { permite_registrar_saude: true, permite_marcar_dose: true, permite_criar_evento_cuidado: true },
    })
    const titular = vinculo({ papel_do_chamador: 'titular', tipo_vinculo: 'familiar', decisao: { modo: 'familiar', transferencia: null } })
    expect(permissoesDeEscrita({ tipoPerfil: 'cuidador', vinculos: [pendente] }, 7).saude).toBe(false)
    expect(permissoesDeEscrita({ tipoPerfil: 'familiar', vinculos: [titular] }, 7).saude).toBe(false)
  })
})

describe('idososDoAcesso', () => {
  it('idoso: sem seletor e nunca bloqueado', () => {
    expect(idososDoAcesso({ estado: 'ok', tipoPerfil: 'idoso', vinculos: null })).toMatchObject({
      estado: 'ok',
      ehIdoso: true,
      bloqueado: false,
    })
  })

  it('carregando enquanto o acesso carrega', () => {
    expect(idososDoAcesso({ estado: 'carregando', tipoPerfil: null, vinculos: null }).estado).toBe('carregando')
  })

  it('erro quando os vínculos não carregaram', () => {
    expect(idososDoAcesso({ estado: 'erro', tipoPerfil: 'cuidador', vinculos: null }).estado).toBe('erro')
  })

  it('lista os idosos aprovados sem repetir, ignorando pendentes e idoso oculto', () => {
    const lista = idososDoAcesso({
      estado: 'ok',
      tipoPerfil: 'familiar',
      vinculos: [
        vinculo({ id: 1 }),
        vinculo({ id: 2, papel_do_chamador: 'titular' }),
        vinculo({ id: 3, status: 'pendente', idoso: { id: null, nome: null, email_mascarado: null } }),
        vinculo({ id: 4, idoso: { id: 9, nome: 'Seu João', email_mascarado: null } }),
      ],
    })
    expect(lista).toMatchObject({ estado: 'ok', ehIdoso: false, bloqueado: false, tipoPerfil: 'familiar' })
    expect(lista.idosos.map((i) => i.id)).toEqual([7, 9])
  })
})
