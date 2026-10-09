import '@testing-library/jest-dom'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import SolicitacoesPendentes from './SolicitacoesPendentes'
import type { Vinculo } from './CardVinculo'
import type { ModoDecisao } from './regrasVinculo'
import { chamarApi } from '../../lib/chamarApi'
import { apiFalsa, erroApi } from '../../testSupport/apiFalsa'

expect.extend(toHaveNoViolations)

jest.mock('../../lib/chamarApi', () => ({ chamarApi: jest.fn() }))
const mockApi = chamarApi as jest.Mock
const AXE = { rules: { 'color-contrast': { enabled: false } } }

// Fixtures: dados fake, só para o teste.
function v(extra: Partial<Vinculo>): Vinculo {
  return {
    id: 20,
    tipo_vinculo: 'cuidador',
    origem: 'solicitacao_cuidador',
    status: 'pendente',
    data_solicitacao: '2026-10-01T15:00:00.000Z',
    data_resposta: null,
    confirmado_em: null,
    papel_do_chamador: 'dono',
    idoso: { id: 5, nome: 'Maria Idosa', email_mascarado: 'ma***@mail.test' },
    vinculado: { id: 8, nome: 'João Cuidador', email_mascarado: 'jo***@mail.test' },
    ...extra,
  }
}
const pedidoCuidador = v({})
const conviteFamiliar = v({
  id: 21,
  tipo_vinculo: 'familiar',
  origem: 'convite_idoso',
  vinculado: { id: 9, nome: 'Ana Familiar', email_mascarado: 'an***@mail.test' },
})
const familiarAutomatico = v({
  id: 22,
  tipo_vinculo: 'familiar',
  origem: 'cadastro_familiar',
  status: 'aprovado',
  vinculado: { id: 10, nome: 'Paulo Familiar', email_mascarado: 'pa***@mail.test' },
})

function montar(
  vinculos: Vinculo[],
  { perfil = 'idoso', modo = 'idoso' }: { perfil?: string | null; modo?: ModoDecisao } = {},
) {
  const onResolvido = jest.fn()
  const utils = render(
    <SolicitacoesPendentes vinculos={vinculos} tipoPerfil={perfil} modoDoIdoso={modo} onResolvido={onResolvido} />,
  )
  return { ...utils, onResolvido }
}

describe('SolicitacoesPendentes', () => {
  beforeEach(() => {
    mockApi.mockReset()
    jest.spyOn(console, 'error').mockImplementation(() => {})
    jest.spyOn(console, 'log').mockImplementation(() => {})
  })
  afterEach(() => jest.restoreAllMocks())

  it('idoso com autoridade: lista o pedido com nome, tipo e data, com Aprovar e Recusar', () => {
    montar([pedidoCuidador])
    const item = screen.getByRole('article', { name: /João Cuidador/ })
    expect(within(item).getByText(/quer ser seu cuidador/i)).toBeInTheDocument()
    expect(within(item).getByText(/jo\*\*\*@mail\.test/)).toBeInTheDocument()
    expect(within(item).getByText(/01\/10\/2026/)).toBeInTheDocument()
    expect(within(item).getByRole('button', { name: 'Aprovar o pedido de João Cuidador' })).toBeInTheDocument()
    expect(within(item).getByRole('button', { name: 'Recusar o pedido de João Cuidador' })).toBeInTheDocument()
  })

  it.each([
    ['cuidador sem autoridade', [pedidoCuidador], { perfil: 'cuidador' }],
    ['idoso com modo familiar', [pedidoCuidador], { modo: 'familiar' as ModoDecisao }],
    ['familiar vendo o próprio pedido', [v({ papel_do_chamador: 'vinculado' })], { perfil: 'familiar' }],
    ['perfil desconhecido', [pedidoCuidador], { perfil: null }],
  ])('%s: sem botões de decisão', (_nome, lista, opcoes) => {
    montar(lista, opcoes)
    expect(screen.queryByRole('button', { name: /aprovar|recusar|contestar/i })).not.toBeInTheDocument()
  })

  it('familiar titular decide o pedido do idoso que ele conduz', () => {
    montar([v({ papel_do_chamador: 'titular' })], { perfil: 'familiar' })
    const item = screen.getByRole('article', { name: /João Cuidador/ })
    expect(within(item).getByText(/idoso: maria idosa/i)).toBeInTheDocument()
    expect(within(item).getByRole('button', { name: /aprovar/i })).toBeInTheDocument()
  })

  it('aprovar: POST sem corpo, anuncia o resultado e avisa a página', async () => {
    const chamadas: string[] = []
    mockApi.mockImplementation(apiFalsa({ 'POST /vinculo/20/aprovar': () => (chamadas.push('aprovar'), { id: 20 }) }))
    const { onResolvido } = montar([pedidoCuidador])
    await userEvent.click(screen.getByRole('button', { name: /aprovar o pedido de João/i }))
    expect(await screen.findByRole('status')).toHaveTextContent('Pedido de João Cuidador aprovado.')
    expect(chamadas).toEqual(['aprovar'])
    expect(onResolvido).toHaveBeenCalledTimes(1)
  })

  it('recusar pede confirmação clara; voltar não envia nada; confirmar envia', async () => {
    mockApi.mockImplementation(apiFalsa({ 'POST /vinculo/20/recusar': () => ({ id: 20 }) }))
    const { onResolvido } = montar([pedidoCuidador])

    await userEvent.click(screen.getByRole('button', { name: /recusar o pedido de João/i }))
    const caixa = screen.getByRole('alertdialog')
    expect(caixa).toHaveTextContent('Recusar o pedido de João Cuidador?')
    await userEvent.click(within(caixa).getByRole('button', { name: 'Não, voltar' }))
    expect(mockApi).not.toHaveBeenCalled()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /recusar o pedido de João/i })).toHaveFocus()

    await userEvent.click(screen.getByRole('button', { name: /recusar o pedido de João/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Sim, recusar' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Pedido de João Cuidador recusado.')
    expect(onResolvido).toHaveBeenCalledTimes(1)
  })

  it('vínculo automático aprovado: Contestar com confirmação, POST contestar, anuncia', async () => {
    mockApi.mockImplementation(apiFalsa({ 'POST /vinculo/22/contestar': () => ({ id: 22 }) }))
    const { onResolvido } = montar([familiarAutomatico])
    expect(screen.getByRole('heading', { name: 'Vínculos automáticos para conferir' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /contestar o vínculo de Paulo Familiar/i }))
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Contestar o vínculo de Paulo Familiar?')
    expect(mockApi).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Sim, contestar' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Vínculo de Paulo Familiar contestado e desfeito.')
    expect(onResolvido).toHaveBeenCalledTimes(1)
  })

  it('o vínculo manual aprovado de familiar não pode ser contestado', () => {
    montar([{ ...familiarAutomatico, origem: 'solicitacao_familiar' }])
    expect(screen.queryByRole('button', { name: /contestar/i })).not.toBeInTheDocument()
  })

  it('aviso de e-mail não confirmado só no vínculo automático pendente sem confirmação', () => {
    montar([
      conviteFamiliar,
      pedidoCuidador,
      v({ id: 23, origem: 'convite_idoso', tipo_vinculo: 'familiar', confirmado_em: '2026-10-02T10:00:00.000Z' }),
    ])
    const avisos = screen.getAllByText(/o e-mail ainda não foi confirmado/i)
    expect(avisos).toHaveLength(1)
    expect(
      within(screen.getByRole('article', { name: /Ana Familiar/ })).getByText(/o e-mail ainda não foi confirmado/i),
    ).toBeInTheDocument()
  })

  it.each([
    [403, 'Você não pode responder a este pedido.'],
    [404, 'Este pedido não foi encontrado. A lista foi atualizada.'],
    [409, 'Este pedido já foi respondido. A lista foi atualizada.'],
    [500, 'Não foi possível concluir agora. Tente de novo em instantes.'],
  ])('aprovar com status %s: mensagem fixa no item, sem eco do corpo', async (status, texto) => {
    mockApi.mockImplementation(
      apiFalsa({
        'POST /vinculo/20/aprovar': () => {
          throw erroApi(status, 'SEGREDO-do-corpo modo_decisao')
        },
      }),
    )
    const { onResolvido } = montar([pedidoCuidador])
    await userEvent.click(screen.getByRole('button', { name: /aprovar o pedido de João/i }))
    const item = screen.getByRole('article', { name: /João Cuidador/ })
    expect(await within(item).findByRole('alert')).toHaveTextContent(texto)
    expect(document.body).not.toHaveTextContent('SEGREDO-do-corpo')
    expect(document.body).not.toHaveTextContent('modo_decisao')
    expect(within(item).getByRole('button', { name: /aprovar o pedido de João/i })).toBeEnabled()
    // 404 e 409 significam lista desatualizada: recarrega.
    expect(onResolvido).toHaveBeenCalledTimes(status === 404 || status === 409 ? 1 : 0)
    expect(console.error).not.toHaveBeenCalled()
  })

  it('contestar com 403 usa a mensagem própria de contestação', async () => {
    mockApi.mockImplementation(
      apiFalsa({
        'POST /vinculo/22/contestar': () => {
          throw erroApi(403)
        },
      }),
    )
    montar([familiarAutomatico])
    await userEvent.click(screen.getByRole('button', { name: /contestar o vínculo de Paulo/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Sim, contestar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Você não pode contestar este vínculo.')
  })

  it('durante o envio os botões ficam desligados (sem pedido duplicado)', async () => {
    let liberar!: (x: unknown) => void
    mockApi.mockImplementation(() => new Promise((r) => (liberar = r)))
    montar([pedidoCuidador])
    await userEvent.click(screen.getByRole('button', { name: /aprovar o pedido de João/i }))
    expect(screen.getByRole('button', { name: /aprovar o pedido de João/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /recusar o pedido de João/i })).toBeDisabled()
    liberar({})
    await screen.findByRole('status')
    expect(mockApi).toHaveBeenCalledTimes(1)
  })

  it('não tem violações do axe (lista, confirmação e resultado)', async () => {
    mockApi.mockImplementation(apiFalsa({ 'POST /vinculo/20/aprovar': () => ({ id: 20 }) }))
    const { container } = montar([pedidoCuidador, conviteFamiliar, familiarAutomatico])
    expect(await axe(container, AXE)).toHaveNoViolations()
    await userEvent.click(screen.getByRole('button', { name: /recusar o pedido de João/i }))
    expect(await axe(container, AXE)).toHaveNoViolations()
    await userEvent.click(screen.getByRole('button', { name: 'Não, voltar' }))
    await userEvent.click(screen.getByRole('button', { name: /aprovar o pedido de João/i }))
    await screen.findByRole('status')
    expect(await axe(container, AXE)).toHaveNoViolations()
  })
})
