import type { Vinculo } from '../components/Vinculos/CardVinculo'
import type { IdososVinculados } from '../hooks/useIdososVinculados'
import { modoDeCriacao } from './regrasAgenda'

const IDOSO: IdososVinculados = { estado: 'ok', ehIdoso: true, idosos: [], bloqueado: false }
const TERCEIRO = (tipoPerfil: string): IdososVinculados => ({
  estado: 'ok',
  ehIdoso: false,
  tipoPerfil,
  idosos: [{ id: 5, nome: 'Idoso Teste', email_mascarado: null }],
  bloqueado: false,
})
const CARREGANDO: IdososVinculados = { estado: 'carregando', ehIdoso: false, idosos: [], bloqueado: true }

function cuidador(permite: boolean | undefined, ajuste: Partial<Vinculo> = {}): Vinculo {
  return {
    id: 1,
    tipo_vinculo: 'cuidador',
    origem: 'solicitacao_cuidador',
    status: 'aprovado',
    papel_do_chamador: 'vinculado',
    permissoes:
      permite === undefined
        ? null
        : { permite_registrar_saude: false, permite_marcar_dose: false, permite_criar_evento_cuidado: permite },
    idoso: { id: 5, nome: 'Idoso Teste', email_mascarado: null },
    vinculado: { id: 50, nome: 'Eu', email_mascarado: null },
    ...ajuste,
  } as Vinculo
}

describe('modoDeCriacao (quem vê o botão "Criar compromisso" e com qual formulário)', () => {
  it('idoso: formulário próprio', () => {
    expect(modoDeCriacao({ tipoPerfil: 'idoso', idosos: IDOSO, vinculos: [] })).toBe('idoso')
  })

  it('familiar com idosos carregados: formulário de terceiros', () => {
    expect(modoDeCriacao({ tipoPerfil: 'familiar', idosos: TERCEIRO('familiar'), vinculos: [] })).toBe('familiar')
  })

  it('familiar ou cuidador enquanto os idosos carregam: sem botão', () => {
    expect(modoDeCriacao({ tipoPerfil: 'familiar', idosos: CARREGANDO, vinculos: [] })).toBeNull()
    expect(modoDeCriacao({ tipoPerfil: 'cuidador', idosos: CARREGANDO, vinculos: [cuidador(true)] })).toBeNull()
  })

  it('cuidador só com permite_criar_evento_cuidado === true (estrito)', () => {
    const idosos = TERCEIRO('cuidador')

    expect(modoDeCriacao({ tipoPerfil: 'cuidador', idosos, vinculos: [cuidador(true)] })).toBe('cuidador')
    expect(modoDeCriacao({ tipoPerfil: 'cuidador', idosos, vinculos: [cuidador(false)] })).toBeNull()
    expect(modoDeCriacao({ tipoPerfil: 'cuidador', idosos, vinculos: [cuidador(undefined)] })).toBeNull()
  })

  it('cuidador: só conta vínculo aprovado em que ele é o vinculado', () => {
    const idosos = TERCEIRO('cuidador')

    expect(modoDeCriacao({ tipoPerfil: 'cuidador', idosos, vinculos: [cuidador(true, { status: 'pendente' })] })).toBeNull()
    expect(modoDeCriacao({ tipoPerfil: 'cuidador', idosos, vinculos: [cuidador(true, { papel_do_chamador: 'dono' })] })).toBeNull()
  })

  it('cuidador com vínculos não carregados: falha aberta (o 403 do servidor é a barreira)', () => {
    expect(modoDeCriacao({ tipoPerfil: 'cuidador', idosos: TERCEIRO('cuidador'), vinculos: null })).toBe('cuidador')
  })

  it('perfil fora do contexto: descobre pelo hook de idosos', () => {
    expect(modoDeCriacao({ tipoPerfil: null, idosos: IDOSO, vinculos: null })).toBe('idoso')
    expect(modoDeCriacao({ tipoPerfil: null, idosos: TERCEIRO('familiar'), vinculos: null })).toBe('familiar')
  })

  it('perfil desconhecido nos dois lugares: sem botão (não dá para escolher o formulário)', () => {
    expect(modoDeCriacao({ tipoPerfil: null, idosos: CARREGANDO, vinculos: null })).toBeNull()
  })
})
