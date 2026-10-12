import '@testing-library/jest-dom'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import ConvitesRecebidos from './ConvitesRecebidos'
import type { Vinculo } from './CardVinculo'
import { formatarDataBR } from './regrasVinculo'
import { chamarApi } from '../../lib/chamarApi'
import { apiFalsa, erroApi } from '../../testSupport/apiFalsa'

expect.extend(toHaveNoViolations)

jest.mock('../../lib/chamarApi', () => ({ chamarApi: jest.fn() }))
const mockApi = chamarApi as jest.Mock
const AXE = { rules: { 'color-contrast': { enabled: false } } }

// Datas relativas a agora: o prazo do convite é de 7 dias, então uma data fixa viraria "vencido" com o tempo.
const DIA = 24 * 60 * 60 * 1000
const RECENTE = new Date(Date.now() - DIA).toISOString()
const VENCIDO = new Date(Date.now() - 30 * DIA).toISOString()

// Fixtures: dados fake, só para o teste. O backend esconde o id do idoso, mas mostra nome e e-mail mascarado.
function v(extra: Partial<Vinculo> = {}): Vinculo {
  return {
    id: 20,
    tipo_vinculo: 'cuidador',
    origem: 'convite_idoso',
    status: 'pendente',
    data_solicitacao: RECENTE,
    data_resposta: null,
    confirmado_em: null,
    papel_do_chamador: 'vinculado',
    permissoes: null,
    idoso: { id: null, nome: 'Maria Idosa', email_mascarado: 'ma***@mail.test' },
    vinculado: { id: 8, nome: 'João Cuidador', email_mascarado: 'jo***@mail.test' },
    ...extra,
  }
}

function montar(vinculos: Vinculo[]) {
  const onResolvido = jest.fn()
  const utils = render(<ConvitesRecebidos vinculos={vinculos} onResolvido={onResolvido} />)
  return { ...utils, onResolvido }
}

describe('ConvitesRecebidos', () => {
  beforeEach(() => {
    mockApi.mockReset()
    jest.spyOn(console, 'error').mockImplementation(() => {})
    jest.spyOn(console, 'log').mockImplementation(() => {})
  })
  afterEach(() => jest.restoreAllMocks())

  it('mostra um cartão por convite com nome, e-mail mascarado, data, texto e os dois botões', () => {
    montar([v(), v({ id: 21, idoso: { id: null, nome: 'Rita Idosa', email_mascarado: 'ri***@mail.test' } })])
    expect(screen.getByRole('heading', { name: 'Convites para você' })).toBeInTheDocument()
    const item = screen.getByRole('article', { name: /Maria Idosa/ })
    expect(within(item).getByText('Convidou você para ser cuidador dele')).toBeInTheDocument()
    expect(within(item).getByText(/ma\*\*\*@mail\.test/)).toBeInTheDocument()
    expect(within(item).getByText(new RegExp(formatarDataBR(RECENTE)))).toBeInTheDocument()
    expect(within(item).queryByText(/convite vencido/i)).not.toBeInTheDocument()
    expect(within(item).getByRole('button', { name: 'Aceitar o convite de Maria Idosa' })).toBeInTheDocument()
    expect(within(item).getByRole('button', { name: 'Recusar o convite de Maria Idosa' })).toBeInTheDocument()
    expect(screen.getAllByRole('article')).toHaveLength(2)
  })

  it.each([
    ['convite de familiar', v({ tipo_vinculo: 'familiar' })],
    ['pedido do próprio cuidador', v({ origem: 'solicitacao_cuidador' })],
    ['convite já aprovado', v({ status: 'aprovado' })],
    ['convite já recusado', v({ status: 'recusado' })],
    ['visão do idoso (dono)', v({ papel_do_chamador: 'dono' })],
  ])('%s não vira convite recebido', (_nome, vinculo) => {
    montar([vinculo])
    expect(screen.queryByRole('heading', { name: 'Convites para você' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('a região de resultado existe no DOM mesmo sem convite (leitores de tela só anunciam região já presente)', () => {
    montar([])
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('aceitar: POST sem corpo, desabilita durante o envio, anuncia o resultado e avisa a página', async () => {
    const chamadas: string[] = []
    let liberar!: (valor: unknown) => void
    mockApi.mockImplementation((caminho: string, opcoes: RequestInit) => {
      chamadas.push(`${opcoes.method} ${caminho} ${opcoes.body ?? ''}`.trim())
      return new Promise((r) => (liberar = r))
    })
    const { onResolvido } = montar([v()])
    await userEvent.click(screen.getByRole('button', { name: 'Aceitar o convite de Maria Idosa' }))

    expect(screen.getByRole('button', { name: 'Aceitar o convite de Maria Idosa' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Aceitar o convite de Maria Idosa' })).toHaveAttribute('aria-busy', 'true')
    liberar({ id: 20, status: 'aprovado' })

    expect(await screen.findByText('Convite de Maria Idosa aceito.')).toBeInTheDocument()
    expect(chamadas).toEqual(['POST /vinculo/20/aceitar-convite'])
    expect(onResolvido).toHaveBeenCalledTimes(1)
  })

  it('recusar pede confirmação; voltar não envia e devolve o foco; confirmar envia a rota de recusar convite', async () => {
    mockApi.mockImplementation(apiFalsa({ 'POST /vinculo/20/recusar-convite': () => ({ id: 20, status: 'recusado' }) }))
    const { onResolvido } = montar([v()])

    await userEvent.click(screen.getByRole('button', { name: 'Recusar o convite de Maria Idosa' }))
    const caixa = screen.getByRole('alertdialog')
    expect(caixa).toHaveTextContent('Recusar o convite de Maria Idosa?')
    await userEvent.click(within(caixa).getByRole('button', { name: 'Não, voltar' }))
    expect(mockApi).not.toHaveBeenCalled()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Recusar o convite de Maria Idosa' })).toHaveFocus()

    await userEvent.click(screen.getByRole('button', { name: 'Recusar o convite de Maria Idosa' }))
    await userEvent.click(screen.getByRole('button', { name: 'Sim, recusar' }))
    expect(await screen.findByText('Convite de Maria Idosa recusado.')).toBeInTheDocument()
    expect(onResolvido).toHaveBeenCalledTimes(1)
  })

  it('a confirmação não fecha sozinha (nada some por tempo)', async () => {
    jest.useFakeTimers()
    try {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
      montar([v()])
      await user.click(screen.getByRole('button', { name: 'Recusar o convite de Maria Idosa' }))
      jest.advanceTimersByTime(60_000)
      expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    } finally {
      jest.useRealTimers()
    }
  })

  it.each([
    [403, 'Confirme o seu e-mail no Meu Perfil antes de aceitar.', false],
    [404, 'Este convite não foi encontrado. A lista foi atualizada.', true],
    [409, 'Este convite não vale mais. A lista foi atualizada.', true],
    [500, 'Não foi possível concluir agora. Tente de novo em instantes.', false],
  ])('aceitar com erro %s: mensagem fixa, sem eco do corpo; recarrega a lista só em 404 e 409', async (status, texto, recarrega) => {
    mockApi.mockImplementation(
      apiFalsa({
        'POST /vinculo/20/aceitar-convite': () => {
          throw erroApi(status, 'SEGREDO-do-corpo modo_decisao')
        },
      }),
    )
    const { onResolvido } = montar([v()])
    await userEvent.click(screen.getByRole('button', { name: 'Aceitar o convite de Maria Idosa' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(texto)
    expect(document.body).not.toHaveTextContent('SEGREDO-do-corpo')
    expect(document.body).not.toHaveTextContent('modo_decisao')
    expect(onResolvido).toHaveBeenCalledTimes(recarrega ? 1 : 0)
    expect(screen.getByRole('button', { name: 'Aceitar o convite de Maria Idosa' })).toBeEnabled()
    expect(console.error).not.toHaveBeenCalled()
  })

  it.each([
    [404, 'Este convite não foi encontrado. A lista foi atualizada.', 1],
    [409, 'Este convite não vale mais. A lista foi atualizada.', 1],
    [500, 'Não foi possível concluir agora. Tente de novo em instantes.', 0],
  ])('recusar com erro %s: mensagem fixa', async (status, texto, recargas) => {
    mockApi.mockImplementation(
      apiFalsa({
        'POST /vinculo/20/recusar-convite': () => {
          throw erroApi(status, 'SEGREDO-do-corpo')
        },
      }),
    )
    const { onResolvido } = montar([v()])
    await userEvent.click(screen.getByRole('button', { name: 'Recusar o convite de Maria Idosa' }))
    await userEvent.click(screen.getByRole('button', { name: 'Sim, recusar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(texto)
    expect(document.body).not.toHaveTextContent('SEGREDO-do-corpo')
    expect(onResolvido).toHaveBeenCalledTimes(recargas)
  })

  describe('convite vencido (mais de 7 dias)', () => {
    it('sem Aceitar: explica que venceu e mantém só Recusar', () => {
      montar([v({ data_solicitacao: VENCIDO })])
      const item = screen.getByRole('article', { name: /Maria Idosa/ })
      expect(within(item).getByText('Convite vencido. Peça um novo convite ao idoso.')).toBeInTheDocument()
      expect(within(item).queryByRole('button', { name: /aceitar/i })).not.toBeInTheDocument()
      expect(within(item).getByRole('button', { name: 'Recusar o convite de Maria Idosa' })).toBeInTheDocument()
      expect(within(item).getAllByRole('button')).toHaveLength(1)
    })

    it('convite válido e vencido na mesma lista: só o válido tem Aceitar', () => {
      montar([v(), v({ id: 21, data_solicitacao: VENCIDO, idoso: { id: null, nome: 'Rita Idosa', email_mascarado: null } })])
      expect(screen.getAllByRole('button', { name: /aceitar o convite/i })).toHaveLength(1)
      expect(screen.getByRole('button', { name: 'Aceitar o convite de Maria Idosa' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Recusar o convite de Rita Idosa' })).toBeInTheDocument()
    })

    it('recusar o vencido usa a rota normal de recusar convite', async () => {
      mockApi.mockImplementation(apiFalsa({ 'POST /vinculo/20/recusar-convite': () => ({ id: 20, status: 'recusado' }) }))
      const { onResolvido } = montar([v({ data_solicitacao: VENCIDO })])
      await userEvent.click(screen.getByRole('button', { name: 'Recusar o convite de Maria Idosa' }))
      await userEvent.click(screen.getByRole('button', { name: 'Sim, recusar' }))
      expect(await screen.findByText('Convite de Maria Idosa recusado.')).toBeInTheDocument()
      expect(onResolvido).toHaveBeenCalledTimes(1)
    })

    it('não tem violações do axe', async () => {
      const { container } = montar([v({ data_solicitacao: VENCIDO })])
      expect(await axe(container, AXE)).toHaveNoViolations()
    })
  })

  it('não tem violações do axe (lista, confirmação e erro)', async () => {
    mockApi.mockImplementation(
      apiFalsa({
        'POST /vinculo/20/aceitar-convite': () => {
          throw erroApi(403)
        },
      }),
    )
    const { container } = montar([v()])
    expect(await axe(container, AXE)).toHaveNoViolations()
    await userEvent.click(screen.getByRole('button', { name: 'Recusar o convite de Maria Idosa' }))
    expect(await axe(container, AXE)).toHaveNoViolations()
    await userEvent.click(screen.getByRole('button', { name: 'Não, voltar' }))
    await userEvent.click(screen.getByRole('button', { name: 'Aceitar o convite de Maria Idosa' }))
    await screen.findByRole('alert')
    expect(await axe(container, AXE)).toHaveNoViolations()
  })
})
