import type { Vinculo } from '../components/Vinculos/CardVinculo'
import { podeAlterarRegistroSaude, podeAlterarOutroRegistro } from './permissoesEdicao'

type Ajuste = Partial<Vinculo> & { idosoId?: number; meuId?: number }

function vinculo(a: Ajuste = {}): Vinculo {
  return {
    id: 1,
    tipo_vinculo: 'familiar',
    origem: 'solicitacao_familiar',
    status: 'aprovado',
    data_solicitacao: '2026-01-01',
    data_resposta: null,
    confirmado_em: null,
    papel_do_chamador: 'vinculado',
    idoso: { id: a.idosoId ?? 7, nome: 'Idoso Teste', email_mascarado: null },
    vinculado: { id: a.meuId ?? 50, nome: 'Eu', email_mascarado: null },
    ...a,
  } as Vinculo
}

const familiar = (modo: 'idoso' | 'familiar' | undefined, ajuste: Ajuste = {}) =>
  vinculo({ tipo_vinculo: 'familiar', decisao: modo ? { modo, transferencia: null } : undefined, ...ajuste })

const cuidador = (ajuste: Ajuste = {}) =>
  vinculo({
    tipo_vinculo: 'cuidador',
    permissoes: { permite_registrar_saude: true, permite_marcar_dose: false, permite_criar_evento_cuidado: false },
    ...ajuste,
  })

describe('podeAlterarOutroRegistro (alimentação e medicamento)', () => {
  const base = { ehIdoso: false, idosoId: '7' }

  it('idoso sempre', () => {
    expect(podeAlterarOutroRegistro({ ehIdoso: true, idosoId: '', tipoPerfil: undefined, vinculos: [] })).toBe(true)
  })

  it('cuidador nunca, mesmo com todas as permissões', () => {
    expect(podeAlterarOutroRegistro({ ...base, tipoPerfil: 'cuidador', vinculos: [cuidador()] })).toBe(false)
  })

  it('familiar com modo familiar no idoso escolhido', () => {
    expect(podeAlterarOutroRegistro({ ...base, tipoPerfil: 'familiar', vinculos: [familiar('familiar')] })).toBe(true)
  })

  it('familiar com modo idoso não vê os botões', () => {
    expect(podeAlterarOutroRegistro({ ...base, tipoPerfil: 'familiar', vinculos: [familiar('idoso')] })).toBe(false)
  })

  it('decide por idoso: outro idoso com modo familiar não vale para o escolhido', () => {
    const vinculos = [familiar('idoso', { idosoId: 7 }), familiar('familiar', { id: 2, idosoId: 8 })]

    expect(podeAlterarOutroRegistro({ ...base, tipoPerfil: 'familiar', vinculos })).toBe(false)
    expect(podeAlterarOutroRegistro({ ehIdoso: false, idosoId: '8', tipoPerfil: 'familiar', vinculos })).toBe(true)
  })

  it('familiar sem vínculo aprovado com o idoso escolhido não vê', () => {
    const pendente = familiar('familiar', { status: 'pendente' })

    expect(podeAlterarOutroRegistro({ ...base, tipoPerfil: 'familiar', vinculos: [pendente] })).toBe(false)
  })

  it('vínculo em que o chamador é o dono (idoso) ou titular não conta como acesso do familiar', () => {
    const dono = familiar('familiar', { papel_do_chamador: 'dono' })

    expect(podeAlterarOutroRegistro({ ...base, tipoPerfil: 'familiar', vinculos: [dono] })).toBe(false)
  })

  it('falha abre: vínculos não carregados ou decisão desconhecida mostram os botões (o 403 manda)', () => {
    expect(podeAlterarOutroRegistro({ ...base, tipoPerfil: 'familiar', vinculos: null })).toBe(true)
    expect(podeAlterarOutroRegistro({ ...base, tipoPerfil: 'familiar', vinculos: undefined })).toBe(true)
    expect(podeAlterarOutroRegistro({ ...base, tipoPerfil: 'familiar', vinculos: [familiar(undefined)] })).toBe(true)
  })
})

describe('podeAlterarRegistroSaude', () => {
  const base = { ehIdoso: false, idosoId: '7', escritaTerceiros: true }

  it('idoso sempre, em qualquer registro', () => {
    expect(
      podeAlterarRegistroSaude({ ehIdoso: true, idosoId: '', tipoPerfil: undefined, vinculos: [], escritaTerceiros: false, registradoPorId: 3 }),
    ).toBe(true)
  })

  it('familiar segue o modo de decisão do idoso, em qualquer autoria', () => {
    expect(
      podeAlterarRegistroSaude({ ...base, tipoPerfil: 'familiar', vinculos: [familiar('familiar')], registradoPorId: 3 }),
    ).toBe(true)
    expect(
      podeAlterarRegistroSaude({ ...base, tipoPerfil: 'familiar', vinculos: [familiar('idoso')], registradoPorId: 3 }),
    ).toBe(false)
  })

  it('cuidador com permissão só no registro que ele mesmo criou', () => {
    const vinculos = [cuidador({ meuId: 50 })]

    expect(podeAlterarRegistroSaude({ ...base, tipoPerfil: 'cuidador', vinculos, registradoPorId: 50 })).toBe(true)
    expect(podeAlterarRegistroSaude({ ...base, tipoPerfil: 'cuidador', vinculos, registradoPorId: 3 })).toBe(false)
  })

  it('cuidador sem permissão nunca', () => {
    const vinculos = [cuidador({ meuId: 50 })]

    expect(
      podeAlterarRegistroSaude({ ...base, escritaTerceiros: false, tipoPerfil: 'cuidador', vinculos, registradoPorId: 50 }),
    ).toBe(false)
  })

  it('cuidador: sem saber o id de quem registrou ou o próprio id, mostra (o 403 manda)', () => {
    expect(
      podeAlterarRegistroSaude({ ...base, tipoPerfil: 'cuidador', vinculos: [cuidador({ meuId: 50 })], registradoPorId: undefined }),
    ).toBe(true)
    expect(podeAlterarRegistroSaude({ ...base, tipoPerfil: 'cuidador', vinculos: null, registradoPorId: 3 })).toBe(true)
  })
})
