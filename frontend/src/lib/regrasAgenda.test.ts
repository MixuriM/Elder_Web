import type { Vinculo } from '../components/Vinculos/CardVinculo'
import type { IdososVinculados } from '../hooks/useIdososVinculados'
import { modoDeCriacao, podeAlterarCompromisso } from './regrasAgenda'

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

describe('podeAlterarCompromisso (Editar e Remover no cartão do compromisso)', () => {
  const familiar = (modo: 'idoso' | 'familiar' | undefined): Vinculo =>
    ({
      id: 2,
      tipo_vinculo: 'familiar',
      origem: 'solicitacao_familiar',
      status: 'aprovado',
      papel_do_chamador: 'vinculado',
      decisao: modo ? { modo, transferencia: null } : undefined,
      idoso: { id: 5, nome: 'Idoso Teste', email_mascarado: null },
      vinculado: { id: 60, nome: 'Eu', email_mascarado: null },
    }) as Vinculo

  const base = { idosoId: '5' }
  const pessoal = { tipo_evento: 'pessoal' as const, criado_por_id: 5 }
  const cuidado = (criado_por_id?: number) => ({ tipo_evento: 'cuidado' as const, criado_por_id })

  it('idoso: pode em pessoal e médico, nunca em cuidado', () => {
    const ctx = { ...base, ehIdoso: true, tipoPerfil: undefined, vinculos: [] }

    expect(podeAlterarCompromisso({ ...ctx, evento: pessoal })).toBe(true)
    expect(podeAlterarCompromisso({ ...ctx, evento: { tipo_evento: 'medico' } })).toBe(true)
    expect(podeAlterarCompromisso({ ...ctx, evento: cuidado(50) })).toBe(false)
  })

  it('familiar: só com modo familiar, e nunca em cuidado', () => {
    const ctx = (modo: 'idoso' | 'familiar') => ({ ...base, ehIdoso: false, tipoPerfil: 'familiar', vinculos: [familiar(modo)] })

    expect(podeAlterarCompromisso({ ...ctx('familiar'), evento: pessoal })).toBe(true)
    expect(podeAlterarCompromisso({ ...ctx('idoso'), evento: pessoal })).toBe(false)
    expect(podeAlterarCompromisso({ ...ctx('familiar'), evento: cuidado(50) })).toBe(false)
  })

  it('cuidador: só em cuidado, com a flag e no que ele mesmo criou', () => {
    const ctx = (permite: boolean) => ({ ...base, ehIdoso: false, tipoPerfil: 'cuidador', vinculos: [cuidador(permite)] })

    expect(podeAlterarCompromisso({ ...ctx(true), evento: cuidado(50) })).toBe(true)
    expect(podeAlterarCompromisso({ ...ctx(true), evento: cuidado(99) })).toBe(false)
    expect(podeAlterarCompromisso({ ...ctx(false), evento: cuidado(50) })).toBe(false)
    expect(podeAlterarCompromisso({ ...ctx(true), evento: pessoal })).toBe(false)
  })

  it('falha aberta: vínculos não carregados, ou sem saber quem criou, mostram (o 403 do servidor manda)', () => {
    const ctx = { ...base, ehIdoso: false, tipoPerfil: 'cuidador' }

    expect(podeAlterarCompromisso({ ...ctx, vinculos: null, evento: cuidado(99) })).toBe(true)
    expect(podeAlterarCompromisso({ ...ctx, vinculos: [cuidador(true)], evento: cuidado(undefined) })).toBe(true)
    expect(
      podeAlterarCompromisso({ ...base, ehIdoso: false, tipoPerfil: 'familiar', vinculos: null, evento: pessoal }),
    ).toBe(true)
  })
})
