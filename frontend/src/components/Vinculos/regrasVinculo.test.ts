import {
  acoesDoPerfil,
  conviteAguardaAceite,
  ehConviteDeCuidador,
  ehConviteVencido,
  emailNaoConfirmado,
  podeAprovarManual,
  podeContestar,
  temAutoridade,
  textoOrigem,
  VALIDADE_CONVITE_CUIDADOR_DIAS,
} from './regrasVinculo'
import type { Vinculo } from './CardVinculo'

describe('acoesDoPerfil', () => {
  it.each([
    ['cuidador', 'cuidador', ['solicitar']],
    ['familiar', 'familiar', ['solicitar', 'cadastrar']],
    ['familiar', 'cuidador', []],
    ['cuidador', 'familiar', []],
    ['idoso', 'familiar', ['convidar']],
    ['idoso', 'cuidador', ['convidar']],
    [null, 'familiar', []],
    [null, 'cuidador', []],
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

describe('ehConviteDeCuidador: só (cuidador, convite_idoso)', () => {
  it.each([
    ['cuidador', 'convite_idoso', true],
    ['familiar', 'convite_idoso', false],
    ['cuidador', 'solicitacao_cuidador', false],
    ['cuidador', 'cadastro_familiar', false],
    ['familiar', 'solicitacao_familiar', false],
  ])('tipo %s, origem %s: %s', (tipo_vinculo, origem, esperado) => {
    expect(ehConviteDeCuidador(v({ tipo_vinculo, origem }))).toBe(esperado)
  })
})

describe('emailNaoConfirmado: só origem automática de familiar, pendente e sem confirmado_em', () => {
  it.each([
    ['familiar', 'convite_idoso', 'pendente', null, true],
    ['familiar', 'cadastro_familiar', 'pendente', null, true],
    ['familiar', 'solicitacao_familiar', 'pendente', null, false],
    ['cuidador', 'solicitacao_cuidador', 'pendente', null, false],
    ['familiar', 'convite_idoso', 'pendente', '2026-10-02T10:00:00.000Z', false],
    ['familiar', 'convite_idoso', 'aprovado', null, false],
    ['familiar', 'convite_idoso', 'recusado', null, false],
    // O aviso é do familiar automático: o convite de cuidador espera o aceite, não o e-mail do idoso.
    ['cuidador', 'convite_idoso', 'pendente', null, false],
  ])('tipo %s, origem %s, status %s, confirmado_em %s: %s', (tipo_vinculo, origem, status, confirmado_em, esperado) => {
    expect(emailNaoConfirmado(v({ tipo_vinculo, origem, status, confirmado_em }))).toBe(esperado)
  })
})

describe('podeAprovarManual: origem automática só se aprova pela confirmação do e-mail ou pelo aceite do cuidador', () => {
  it.each([
    ['familiar', 'convite_idoso', false],
    ['familiar', 'cadastro_familiar', false],
    ['familiar', 'solicitacao_familiar', true],
    ['cuidador', 'solicitacao_cuidador', true],
    // Convite de cuidador: o idoso não tem o que aprovar, só o cuidador aceita.
    ['cuidador', 'convite_idoso', false],
  ])('tipo %s, origem %s: %s', (tipo_vinculo, origem, esperado) => {
    expect(podeAprovarManual(v({ tipo_vinculo, origem }))).toBe(esperado)
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

describe('ehConviteVencido: convite de cuidador pendente com mais de 7 dias', () => {
  // Relógio fixo: o prazo é medido contra `agora`, nunca contra o relógio da máquina.
  const AGORA = new Date('2026-10-12T12:00:00.000Z')
  const DIA = 24 * 60 * 60 * 1000
  const HORA = 60 * 60 * 1000
  const convite = (idadeMs: number, extra: Partial<Vinculo> = {}) =>
    v({
      tipo_vinculo: 'cuidador',
      origem: 'convite_idoso',
      status: 'pendente',
      data_solicitacao: new Date(AGORA.getTime() - idadeMs).toISOString(),
      ...extra,
    })

  it('o prazo é de 7 dias, o mesmo do backend', () => {
    expect(VALIDADE_CONVITE_CUIDADOR_DIAS).toBe(7)
  })

  it.each([
    ['recém enviado', 0, false],
    ['6 dias e 23 horas', 6 * DIA + 23 * HORA, false],
    ['exatamente 7 dias', 7 * DIA, false],
    ['7 dias e 1 ms', 7 * DIA + 1, true],
    ['30 dias', 30 * DIA, true],
  ])('convite %s (idade %i ms): vencido=%s', (_nome, idade, esperado) => {
    expect(ehConviteVencido(convite(idade), AGORA)).toBe(esperado)
  })

  it.each([
    ['já aprovado', { status: 'aprovado' }],
    ['já recusado', { status: 'recusado' }],
    ['pedido do próprio cuidador', { origem: 'solicitacao_cuidador' }],
    ['convite de familiar', { tipo_vinculo: 'familiar' }],
  ])('%s nunca conta como vencido, mesmo antigo', (_nome, extra) => {
    expect(ehConviteVencido(convite(30 * DIA, extra), AGORA)).toBe(false)
  })

  it('sem o segundo argumento usa o relógio de agora', () => {
    jest.useFakeTimers({ now: AGORA })
    try {
      expect(ehConviteVencido(convite(7 * DIA + 1))).toBe(true)
      expect(ehConviteVencido(convite(7 * DIA))).toBe(false)
    } finally {
      jest.useRealTimers()
    }
  })
})

describe('conviteAguardaAceite: o convite que o cuidador ainda pode aceitar', () => {
  const AGORA = new Date('2026-10-12T12:00:00.000Z')
  const DIA = 24 * 60 * 60 * 1000
  const recebido = (idadeMs: number, extra: Partial<Vinculo> = {}) =>
    v({
      tipo_vinculo: 'cuidador',
      origem: 'convite_idoso',
      status: 'pendente',
      papel_do_chamador: 'vinculado',
      data_solicitacao: new Date(AGORA.getTime() - idadeMs).toISOString(),
      ...extra,
    })

  it('convite pendente recebido e dentro do prazo aguarda o aceite', () => {
    expect(conviteAguardaAceite(recebido(DIA), AGORA)).toBe(true)
  })

  it.each([
    ['vencido', recebido(8 * DIA)],
    ['visão do idoso (dono)', recebido(DIA, { papel_do_chamador: 'dono' })],
    ['já aceito', recebido(DIA, { status: 'aprovado' })],
    ['já recusado', recebido(DIA, { status: 'recusado' })],
    ['pedido do próprio cuidador', recebido(DIA, { origem: 'solicitacao_cuidador' })],
    ['convite de familiar', recebido(DIA, { tipo_vinculo: 'familiar' })],
  ])('%s: não aguarda aceite', (_nome, vinculo) => {
    expect(conviteAguardaAceite(vinculo, AGORA)).toBe(false)
  })
})
