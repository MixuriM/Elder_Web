import '@testing-library/jest-dom'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import ModoDecisao, { type DecisaoApi } from './ModoDecisao'
import type { Vinculo } from './CardVinculo'
import type { EstadoDecisao } from './useEstadoDecisao'
import { chamarApi } from '../../lib/chamarApi'
import { apiFalsa, erroApi } from '../../testSupport/apiFalsa'

expect.extend(toHaveNoViolations)

jest.mock('../../lib/chamarApi', () => ({ chamarApi: jest.fn() }))
const mockApi = chamarApi as jest.Mock
const AXE = { rules: { 'color-contrast': { enabled: false } } }

// Fixtures: dados fake, só para o teste.
const ESTADO_IDOSO: EstadoDecisao = {
  modo_decisao: null,
  modo_decisao_solicitado: null,
  modo_decisao_solicitado_por_id: null,
  modo_decisao_expira_em: null,
  modo_decisao_segunda_confirmacao_id: null,
  modo_decisao_alterado_em: null,
  modo_decisao_motivo: null,
}
const ESTADO_FAMILIA: EstadoDecisao = { ...ESTADO_IDOSO, modo_decisao: 'familiar' }
const ESTADO_PEDIDO: EstadoDecisao = {
  ...ESTADO_IDOSO,
  modo_decisao_solicitado: 'familiar',
  modo_decisao_solicitado_por_id: 9,
  modo_decisao_expira_em: '2026-10-25T12:00:00.000Z',
  modo_decisao_motivo: 'Preciso ajudar com os remédios',
}

function familiarDoIdoso(id: number, nome: string, extra: Partial<Vinculo> = {}): Vinculo {
  return {
    id,
    tipo_vinculo: 'familiar',
    origem: 'solicitacao_familiar',
    status: 'aprovado',
    data_solicitacao: '2026-10-01T10:00:00.000Z',
    data_resposta: null,
    confirmado_em: null,
    papel_do_chamador: 'dono',
    idoso: { id: 5, nome: 'Maria Idosa', email_mascarado: null },
    vinculado: { id: 100 + id, nome, email_mascarado: null },
    ...extra,
  }
}

function decisaoDe(estado: EstadoDecisao | null, pronto = true) {
  const atualizar = jest.fn()
  const recarregar = jest.fn()
  const decisao = { estado, pronto, atualizar, recarregar } as unknown as DecisaoApi
  return { decisao, atualizar, recarregar }
}

function montarIdoso(estado: EstadoDecisao | null, vinculos: Vinculo[] = [familiarDoIdoso(1, 'Ana')], pronto = true) {
  const d = decisaoDe(estado, pronto)
  const utils = render(<ModoDecisao tipoPerfil="idoso" vinculos={vinculos} decisao={d.decisao} />)
  return { ...utils, ...d }
}

const ROTA_MODO = 'PATCH /usuario/me/modo-decisao'

describe('ModoDecisao: idoso', () => {
  beforeEach(() => {
    mockApi.mockReset()
    jest.spyOn(console, 'error').mockImplementation(() => {})
    jest.spyOn(console, 'log').mockImplementation(() => {})
  })
  afterEach(() => jest.restoreAllMocks())

  it('decidindo sozinho: diz quem decide e oferece passar a decisão, com confirmação', async () => {
    const corpos: unknown[] = []
    mockApi.mockImplementation(apiFalsa({ [ROTA_MODO]: (c) => (corpos.push(c), ESTADO_FAMILIA) }))
    const { atualizar } = montarIdoso(ESTADO_IDOSO)
    expect(screen.getByRole('heading', { name: 'Quem decide por mim' })).toBeInTheDocument()
    expect(screen.getByText('Hoje você decide.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Passar a decisão para minha família' }))
    const caixa = screen.getByRole('alertdialog')
    expect(caixa).toHaveTextContent(/aprovar pedidos de vínculo e liberar permissões no seu lugar/i)
    expect(mockApi).not.toHaveBeenCalled()
    await userEvent.click(within(caixa).getByRole('button', { name: 'Não, voltar' }))
    expect(mockApi).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Passar a decisão para minha família' }))
    await userEvent.click(screen.getByRole('button', { name: 'Sim, passar a decisão' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Agora a sua família decide por você.')
    expect(corpos).toEqual([{ modo_decisao: 'familiar' }])
    expect(atualizar).toHaveBeenCalledWith(ESTADO_FAMILIA)
  })

  it('409 ao passar a decisão explica que precisa de um familiar aprovado', async () => {
    mockApi.mockImplementation(
      apiFalsa({
        [ROTA_MODO]: () => {
          throw erroApi(409, 'SEGREDO-do-corpo')
        },
      }),
    )
    montarIdoso(ESTADO_IDOSO)
    await userEvent.click(screen.getByRole('button', { name: 'Passar a decisão para minha família' }))
    await userEvent.click(screen.getByRole('button', { name: 'Sim, passar a decisão' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Para passar a decisão, você precisa de pelo menos um familiar com vínculo aprovado.',
    )
    expect(document.body).not.toHaveTextContent('SEGREDO-do-corpo')
  })

  it.each([
    [400, 'Não foi possível fazer a alteração. Tente de novo.'],
    [403, 'Você não pode fazer esta alteração.'],
    [500, 'Não foi possível concluir agora. Tente de novo em instantes.'],
  ])('status %s: mensagem fixa, sem eco do corpo nem citar modo_decisao', async (status, texto) => {
    mockApi.mockImplementation(
      apiFalsa({
        [ROTA_MODO]: () => {
          throw erroApi(status, 'SEGREDO-do-corpo modo_decisao')
        },
      }),
    )
    montarIdoso(ESTADO_FAMILIA)
    await userEvent.click(screen.getByRole('button', { name: 'Voltar a decidir eu mesmo' }))
    await userEvent.click(screen.getByRole('button', { name: 'Sim, voltar a decidir' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(texto)
    expect(document.body).not.toHaveTextContent('SEGREDO-do-corpo')
    expect(document.body).not.toHaveTextContent('modo_decisao')
  })

  it('com a família decidindo: oferece voltar a decidir, com confirmação', async () => {
    const corpos: unknown[] = []
    mockApi.mockImplementation(apiFalsa({ [ROTA_MODO]: (c) => (corpos.push(c), ESTADO_IDOSO) }))
    montarIdoso(ESTADO_FAMILIA)
    expect(screen.getByText('Hoje quem decide é a sua família.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Voltar a decidir eu mesmo' }))
    await userEvent.click(screen.getByRole('button', { name: 'Sim, voltar a decidir' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Agora você decide.')
    expect(corpos).toEqual([{ modo_decisao: 'idoso' }])
  })

  it('pedido em curso com um familiar: mostra prazo e motivo, sem segunda confirmação', () => {
    montarIdoso(ESTADO_PEDIDO)
    expect(screen.getByText(/um familiar pediu para decidir por você/i)).toBeInTheDocument()
    expect(screen.getByText(/25\/10\/2026/)).toBeInTheDocument()
    expect(screen.getByText(/preciso ajudar com os remédios/i)).toBeInTheDocument()
    expect(screen.queryByText(/outro familiar precisa confirmar/i)).not.toBeInTheDocument()
  })

  it('pedido em curso com 2 familiares: explica a segunda confirmação e se já houve', () => {
    const dois = [familiarDoIdoso(1, 'Ana'), familiarDoIdoso(2, 'Paulo')]
    const { unmount } = montarIdoso(ESTADO_PEDIDO, dois)
    expect(screen.getByText(/outro familiar precisa confirmar/i)).toBeInTheDocument()
    expect(screen.getByText(/ainda falta essa confirmação/i)).toBeInTheDocument()
    unmount()
    montarIdoso({ ...ESTADO_PEDIDO, modo_decisao_segunda_confirmacao_id: 10 }, dois)
    expect(screen.getByText(/já foi confirmado por outro familiar/i)).toBeInTheDocument()
  })

  it('cancelar o pedido envia modo idoso depois de confirmar', async () => {
    const corpos: unknown[] = []
    mockApi.mockImplementation(apiFalsa({ [ROTA_MODO]: (c) => (corpos.push(c), ESTADO_IDOSO) }))
    montarIdoso(ESTADO_PEDIDO)
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar o pedido de transferência' }))
    await userEvent.click(screen.getByRole('button', { name: 'Sim, cancelar o pedido' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Pedido cancelado. Você continua decidindo.')
    expect(corpos).toEqual([{ modo_decisao: 'idoso' }])
  })

  it('aceitar o pedido agora envia modo familiar depois de confirmar', async () => {
    const corpos: unknown[] = []
    mockApi.mockImplementation(apiFalsa({ [ROTA_MODO]: (c) => (corpos.push(c), ESTADO_FAMILIA) }))
    montarIdoso(ESTADO_PEDIDO)
    await userEvent.click(screen.getByRole('button', { name: 'Aceitar o pedido agora' }))
    await userEvent.click(screen.getByRole('button', { name: 'Sim, passar a decisão' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Agora a sua família decide por você.')
    expect(corpos).toEqual([{ modo_decisao: 'familiar' }])
  })

  it('carregando: avisa; falha ao carregar: erro com nova tentativa e nenhuma ação de mudança', async () => {
    const { unmount } = montarIdoso(null, [], false)
    expect(screen.getByText('Carregando...')).toBeInTheDocument()
    unmount()
    const { recarregar } = montarIdoso(null)
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível ver quem decide hoje.')
    expect(screen.queryByRole('button', { name: /passar a decisão|voltar a decidir/i })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(recarregar).toHaveBeenCalledTimes(1)
  })

  it('não tem violações do axe (normal, confirmação, pedido em curso)', async () => {
    const { container } = montarIdoso(ESTADO_PEDIDO, [familiarDoIdoso(1, 'Ana'), familiarDoIdoso(2, 'Paulo')])
    expect(await axe(container, AXE)).toHaveNoViolations()
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar o pedido de transferência' }))
    expect(await axe(container, AXE)).toHaveNoViolations()
  })
})

describe('ModoDecisao: familiar', () => {
  beforeEach(() => {
    mockApi.mockReset()
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => jest.restoreAllMocks())

  // O familiar só enxerga os próprios vínculos (papel vinculado) e, quando o idoso já delegou, os do idoso (titular).
  const proprio = (id: number, extra: Partial<Vinculo> = {}) =>
    familiarDoIdoso(id, 'Eu Familiar', { papel_do_chamador: 'vinculado', ...extra })

  function montarFamiliar(vinculos: Vinculo[]) {
    const d = decisaoDe(null)
    const utils = render(<ModoDecisao tipoPerfil="familiar" vinculos={vinculos} decisao={d.decisao} />)
    return { ...utils, ...d }
  }

  it('lista só os idosos com vínculo de familiar aprovado do próprio familiar', () => {
    montarFamiliar([
      proprio(1),
      proprio(2, { status: 'pendente', idoso: { id: null, nome: null, email_mascarado: null } }),
      proprio(3, { tipo_vinculo: 'cuidador' }),
      proprio(4, { status: 'recusado' }),
    ])
    expect(screen.getAllByRole('button', { name: /^pedir para decidir por/i })).toHaveLength(1)
  })

  it('perfil cuidador ou desconhecido não mostra a seção', () => {
    const d = decisaoDe(null)
    const { container, rerender } = render(<ModoDecisao tipoPerfil="cuidador" vinculos={[proprio(1)]} decisao={d.decisao} />)
    expect(container).toBeEmptyDOMElement()
    rerender(<ModoDecisao tipoPerfil={null} vinculos={[proprio(1)]} decisao={d.decisao} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('idoso que já delegou (aparece vínculo titular): diz que a decisão está com a família e não oferece pedir', () => {
    montarFamiliar([proprio(1), familiarDoIdoso(2, 'Outra Pessoa', { papel_do_chamador: 'titular' })])
    expect(screen.getByText(/a decisão já está com a família/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^pedir para decidir por/i })).not.toBeInTheDocument()
  })

  it('pedir para decidir: explica prazo e segunda confirmação, envia o motivo e anuncia o prazo', async () => {
    const corpos: unknown[] = []
    mockApi.mockImplementation(
      apiFalsa({
        'POST /vinculo/1/solicitar-transferencia-decisao': (c) => (corpos.push(c), ESTADO_PEDIDO),
      }),
    )
    montarFamiliar([proprio(1)])
    await userEvent.click(screen.getByRole('button', { name: 'Pedir para decidir por Maria Idosa' }))
    const caixa = screen.getByRole('alertdialog')
    expect(caixa).toHaveTextContent(/7 dias/)
    expect(caixa).toHaveTextContent(/outro familiar precisa confirmar/i)
    expect(mockApi).not.toHaveBeenCalled()
    const motivo = within(caixa).getByLabelText(/motivo \(opcional\)/i)
    expect(motivo).toHaveAttribute('maxLength', '300')
    await userEvent.type(motivo, '  Preciso ajudar  ')
    await userEvent.click(within(caixa).getByRole('button', { name: 'Sim, enviar pedido' }))
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Pedido enviado. A decisão passa para a família em 25/10/2026 se o idoso não cancelar.',
    )
    expect(corpos).toEqual([{ modo_decisao_motivo: 'Preciso ajudar' }])
  })

  it('pedir sem motivo não envia o campo', async () => {
    const corpos: unknown[] = []
    mockApi.mockImplementation(
      apiFalsa({ 'POST /vinculo/1/solicitar-transferencia-decisao': (c) => (corpos.push(c), ESTADO_PEDIDO) }),
    )
    montarFamiliar([proprio(1)])
    await userEvent.click(screen.getByRole('button', { name: 'Pedir para decidir por Maria Idosa' }))
    await userEvent.click(screen.getByRole('button', { name: 'Sim, enviar pedido' }))
    await screen.findByRole('status')
    expect(corpos).toEqual([undefined])
  })

  it.each([
    [400, 'Confira o motivo: no máximo 300 letras.'],
    [403, 'Você não pode fazer este pedido.'],
    [404, 'Vínculo não encontrado.'],
    [
      409,
      'Não foi possível: a decisão já está com a família, já existe um pedido em curso ou o vínculo ainda não foi aprovado.',
    ],
    [500, 'Não foi possível concluir agora. Tente de novo em instantes.'],
  ])('pedir com status %s: mensagem fixa', async (status, texto) => {
    mockApi.mockImplementation(
      apiFalsa({
        'POST /vinculo/1/solicitar-transferencia-decisao': () => {
          throw erroApi(status, 'SEGREDO-do-corpo')
        },
      }),
    )
    montarFamiliar([proprio(1)])
    await userEvent.click(screen.getByRole('button', { name: 'Pedir para decidir por Maria Idosa' }))
    await userEvent.click(screen.getByRole('button', { name: 'Sim, enviar pedido' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(texto)
    expect(document.body).not.toHaveTextContent('SEGREDO-do-corpo')
  })

  it('confirmar o pedido de outro familiar: confirmação, POST e mensagem; 409 e 403 com texto próprio', async () => {
    mockApi.mockImplementation(
      apiFalsa({ 'POST /vinculo/1/confirmar-transferencia-decisao': () => ESTADO_PEDIDO }),
    )
    const { unmount } = montarFamiliar([proprio(1)])
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar o pedido de outro familiar para Maria Idosa' }))
    expect(screen.getByRole('alertdialog')).toHaveTextContent(/confirme só se você concorda/i)
    expect(mockApi).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Sim, confirmar o pedido' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Pedido confirmado. Falta só o prazo de 7 dias terminar.')
    unmount()

    for (const [status, texto] of [
      [409, 'Não há pedido de outro familiar para confirmar agora.'],
      [403, 'Você não pode confirmar este pedido. Quem fez o pedido não confirma o próprio pedido.'],
    ] as const) {
      mockApi.mockImplementation(
        apiFalsa({
          'POST /vinculo/1/confirmar-transferencia-decisao': () => {
            throw erroApi(status)
          },
        }),
      )
      const r = montarFamiliar([proprio(1)])
      await userEvent.click(screen.getByRole('button', { name: 'Confirmar o pedido de outro familiar para Maria Idosa' }))
      await userEvent.click(screen.getByRole('button', { name: 'Sim, confirmar o pedido' }))
      expect(await screen.findByRole('alert')).toHaveTextContent(texto)
      r.unmount()
    }
  })

  it('avisa que a tela não mostra se já existe pedido em curso', () => {
    montarFamiliar([proprio(1)])
    expect(screen.getByText(/esta tela não mostra se já existe um pedido em curso/i)).toBeInTheDocument()
  })

  it('não tem violações do axe (lista, pedido e confirmação)', async () => {
    const { container } = montarFamiliar([proprio(1), proprio(2, { idoso: { id: 6, nome: 'José Idoso', email_mascarado: null } })])
    expect(await axe(container, AXE)).toHaveNoViolations()
    await userEvent.click(screen.getByRole('button', { name: 'Pedir para decidir por Maria Idosa' }))
    expect(await axe(container, AXE)).toHaveNoViolations()
  })
})

describe('ModoDecisao: familiar com o estado devolvido pelo backend (decisao)', () => {
  beforeEach(() => {
    mockApi.mockReset()
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => jest.restoreAllMocks())

  const base = { exige_segunda_confirmacao: true, segunda_confirmacao_feita: false, confirmada_por_mim: false }
  const transf = (extra: object) => ({
    modo: 'idoso' as const,
    transferencia: { solicitada_por_mim: false, expira_em: '2026-10-25T12:00:00.000Z', ...base, ...extra },
  })
  const proprio = (decisao: Vinculo['decisao']) =>
    familiarDoIdoso(1, 'Eu Familiar', { papel_do_chamador: 'vinculado', decisao })

  function montar(decisao: Vinculo['decisao']) {
    const d = decisaoDe(null)
    return render(<ModoDecisao tipoPerfil="familiar" vinculos={[proprio(decisao)]} decisao={d.decisao} />)
  }
  const pedir = () => screen.queryByRole('button', { name: /^pedir para decidir por/i })
  const confirmar = () => screen.queryByRole('button', { name: /^confirmar o pedido de outro familiar/i })

  it('modo familiar: diz que a decisão está com a família e não oferece ações', () => {
    montar({ modo: 'familiar', transferencia: null })
    expect(screen.getByText(/a decisão já está com a família/i)).toBeInTheDocument()
    expect(pedir()).not.toBeInTheDocument()
    expect(confirmar()).not.toBeInTheDocument()
  })

  it('sem pedido em curso: só oferece pedir, e não mostra o aviso de tela cega', () => {
    montar({ modo: 'idoso', transferencia: null })
    expect(pedir()).toBeInTheDocument()
    expect(confirmar()).not.toBeInTheDocument()
    expect(screen.queryByText(/esta tela não mostra/i)).not.toBeInTheDocument()
  })

  it('pedido feito por mim: mostra o prazo e a falta de confirmação, sem ações', () => {
    montar(transf({ solicitada_por_mim: true }))
    expect(screen.getByText(/você pediu para decidir por maria idosa/i)).toBeInTheDocument()
    expect(screen.getByText(/25\/10\/2026/)).toBeInTheDocument()
    expect(screen.getByText(/falta outro familiar confirmar/i)).toBeInTheDocument()
    expect(pedir()).not.toBeInTheDocument()
    expect(confirmar()).not.toBeInTheDocument()
  })

  it('pedido de outro familiar que precisa da minha confirmação: oferece confirmar', () => {
    montar(transf({}))
    expect(screen.getByText(/outro familiar pediu para decidir por maria idosa/i)).toBeInTheDocument()
    expect(confirmar()).toBeInTheDocument()
    expect(pedir()).not.toBeInTheDocument()
  })

  it.each([
    ['eu já confirmei', { segunda_confirmacao_feita: true, confirmada_por_mim: true }, /você já confirmou este pedido/i],
    ['outro já confirmou', { segunda_confirmacao_feita: true }, /já foi confirmado por outro familiar/i],
  ])('pedido de outro, %s: informa e não oferece confirmar', (_nome, extra, texto) => {
    montar(transf(extra))
    expect(screen.getByText(texto)).toBeInTheDocument()
    expect(confirmar()).not.toBeInTheDocument()
  })
})
