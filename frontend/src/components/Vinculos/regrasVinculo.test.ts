import { acoesDoPerfil, emailNaoConfirmado, podeAprovarManual, podeContestar, temAutoridade, textoOrigem } from './regrasVinculo'
import type { Vinculo } from './CardVinculo'

describe('acoesDoPerfil', () => {
  it.each([
    ['cuidador', 'cuidador', ['solicitar']],
    ['familiar', 'familiar', ['solicitar', 'cadastrar']],
    ['familiar', 'cuidador', []],
    ['cuidador', 'familiar', []],
    ['idoso', 'familiar', ['convidar']],
    ['idoso', 'cuidador', []],
    [null, 'familiar', []],
  ] as const)('perfil %s na tela %s: %j', (perfil, tipo, esperado) => {
    expect(acoesDoPerfil(perfil, tipo)).toEqual(esperado)
  })
})

// Fixture: dados fake, só para o teste.
function v(extra: Partial<Vinculo>): Vinculo {
  return {
    id: 1,
    tipo_vinculo: 'cuidador',
    origem: 'solicitacao_cuidador',
    status: 'pendente',
    data_solicitacao: '2026-10-01T10:00:00.000Z',
    data_resposta: null,
    confirmado_em: null,
    papel_do_chamador: 'dono',
    idoso: { id: 5, nome: 'Maria', email_mascarado: null },
    vinculado: { id: 8, nome: 'João', email_mascarado: null },
    ...extra,
  }
}

describe('temAutoridade', () => {
  it.each([
    ['dono', 'idoso', 'idoso', true],
    ['dono', 'idoso', 'familiar', false],
    ['titular', 'familiar', 'idoso', true],
    ['titular', 'cuidador', 'idoso', false],
    ['vinculado', 'familiar', 'familiar', false],
    ['vinculado', 'cuidador', 'idoso', false],
    ['dono', 'familiar', 'idoso', false],
    ['dono', null, 'idoso', false],
  ] as const)('papel %s, perfil %s, modo %s: %s', (papel, perfil, modo, esperado) => {
    expect(temAutoridade(v({ papel_do_chamador: papel }), perfil, modo)).toBe(esperado)
  })
})

describe('podeContestar', () => {
  const auto = { tipo_vinculo: 'familiar', status: 'aprovado' }
  it.each([
    ['convite_idoso', 'aprovado', 'familiar', true],
    ['cadastro_familiar', 'aprovado', 'familiar', true],
    ['solicitacao_familiar', 'aprovado', 'familiar', false],
    ['convite_idoso', 'pendente', 'familiar', false],
    ['convite_idoso', 'recusado', 'familiar', false],
    ['convite_idoso', 'aprovado', 'cuidador', false],
  ])('origem %s, status %s, tipo %s: %s', (origem, status, tipo, esperado) => {
    expect(podeContestar(v({ ...auto, origem, status, tipo_vinculo: tipo }), 'idoso', 'idoso')).toBe(esperado)
  })

  it('exige autoridade', () => {
    expect(podeContestar(v({ ...auto, origem: 'convite_idoso' }), 'idoso', 'familiar')).toBe(false)
  })
})

describe('emailNaoConfirmado: só origem automática, pendente e sem confirmado_em', () => {
  it.each([
    ['convite_idoso', 'pendente', null, true],
    ['cadastro_familiar', 'pendente', null, true],
    ['solicitacao_familiar', 'pendente', null, false],
    ['solicitacao_cuidador', 'pendente', null, false],
    ['convite_idoso', 'pendente', '2026-10-02T10:00:00.000Z', false],
    ['convite_idoso', 'aprovado', null, false],
    ['convite_idoso', 'recusado', null, false],
  ])('origem %s, status %s, confirmado_em %s: %s', (origem, status, confirmado_em, esperado) => {
    expect(emailNaoConfirmado(v({ origem, status, confirmado_em }))).toBe(esperado)
  })
})

describe('podeAprovarManual: origem automática só se aprova pela confirmação do e-mail', () => {
  it.each([
    ['convite_idoso', false],
    ['cadastro_familiar', false],
    ['solicitacao_familiar', true],
    ['solicitacao_cuidador', true],
  ])('origem %s: %s', (origem, esperado) => {
    expect(podeAprovarManual(v({ origem }))).toBe(esperado)
  })
})

describe('textoOrigem: origem em linguagem simples, nunca o valor cru do banco', () => {
  it.each([
    ['solicitacao_cuidador', 'Pedido do cuidador'],
    ['solicitacao_familiar', 'Pedido do familiar'],
    ['convite_idoso', 'Convite do idoso'],
    ['cadastro_familiar', 'Cadastro feito pelo familiar'],
  ])('%s', (origem, texto) => {
    expect(textoOrigem(origem)).toBe(texto)
  })

  it('origem desconhecida não aparece crua', () => {
    expect(textoOrigem('outra_coisa')).toBe('Não informado')
  })
})
