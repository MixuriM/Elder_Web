import '@testing-library/jest-dom'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import PermissoesCuidador from './PermissoesCuidador'
import { chamarApi } from '../../lib/chamarApi'
import { apiFalsa, erroApi } from '../../testSupport/apiFalsa'

expect.extend(toHaveNoViolations)

jest.mock('../../lib/chamarApi', () => ({ chamarApi: jest.fn() }))
const mockApi = chamarApi as jest.Mock
const AXE = { rules: { 'color-contrast': { enabled: false } } }

const TODAS_DESLIGADAS = {
  permite_registrar_saude: false,
  permite_marcar_dose: false,
  permite_criar_evento_cuidado: false,
}
const ROTA = 'PATCH /vinculo/12/definir-permissoes'

function montar(permissoes = TODAS_DESLIGADAS, podeEditar = true) {
  return render(<PermissoesCuidador vinculoId={12} nome="João Cuidador" permissoes={permissoes} podeEditar={podeEditar} />)
}

const interruptor = (nome: RegExp) => screen.getByRole('switch', { name: nome })

describe('PermissoesCuidador', () => {
  beforeEach(() => {
    mockApi.mockReset()
    jest.spyOn(console, 'error').mockImplementation(() => {})
    jest.spyOn(console, 'log').mockImplementation(() => {})
  })
  afterEach(() => jest.restoreAllMocks())

  it('quem decide vê 3 interruptores com estado em texto e aria-checked', () => {
    montar({ ...TODAS_DESLIGADAS, permite_marcar_dose: true })
    const interruptores = screen.getAllByRole('switch')
    expect(interruptores).toHaveLength(3)
    expect(interruptor(/registrar dados de saúde/i)).toHaveAttribute('aria-checked', 'false')
    expect(interruptor(/registrar dados de saúde/i)).toHaveTextContent('Desligado')
    expect(interruptor(/marcar doses/i)).toHaveAttribute('aria-checked', 'true')
    expect(interruptor(/marcar doses/i)).toHaveTextContent('Ligado')
    expect(screen.getByText(/pode registrar medidas de saúde do idoso/i)).toBeInTheDocument()
  })

  it('quem não decide vê só leitura: texto Ligado e Desligado, sem interruptores', () => {
    montar({ ...TODAS_DESLIGADAS, permite_marcar_dose: true }, false)
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
    expect(screen.getByText(/só quem decide pelo idoso pode mudar/i)).toBeInTheDocument()
    const itens = screen.getAllByRole('listitem')
    expect(itens).toHaveLength(3)
    expect(within(itens[1]).getByText('Ligado')).toBeInTheDocument()
    expect(within(itens[0]).getByText('Desligado')).toBeInTheDocument()
  })

  it('sem dados de permissão (não deveria ocorrer): avisa em vez de inventar', () => {
    render(<PermissoesCuidador vinculoId={12} nome="João" permissoes={null} podeEditar />)
    expect(screen.getByText(/permissões não disponíveis/i)).toBeInTheDocument()
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
  })

  it('ligar compromissos de cuidado envia só essa flag, sem confirmação, e anuncia', async () => {
    const corpos: unknown[] = []
    mockApi.mockImplementation(
      apiFalsa({ [ROTA]: (c) => (corpos.push(c), { ...TODAS_DESLIGADAS, permite_criar_evento_cuidado: true }) }),
    )
    montar()
    await userEvent.click(interruptor(/compromissos de cuidado/i))
    expect(await screen.findByRole('status')).toHaveTextContent('Compromissos de cuidado: ligado.')
    expect(corpos).toEqual([{ permite_criar_evento_cuidado: true }])
    expect(interruptor(/compromissos de cuidado/i)).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it.each([
    ['registrar dados de saúde', 'permite_registrar_saude'],
    ['marcar doses', 'permite_marcar_dose'],
  ])('ligar %s pede confirmação: voltar não envia, confirmar envia só a flag', async (nome, campo) => {
    const corpos: unknown[] = []
    mockApi.mockImplementation(apiFalsa({ [ROTA]: (c) => (corpos.push(c), { ...TODAS_DESLIGADAS, [campo]: true }) }))
    montar()
    const chave = new RegExp(nome, 'i')

    await userEvent.click(interruptor(chave))
    const caixa = screen.getByRole('alertdialog')
    expect(caixa).toHaveTextContent(/João Cuidador/)
    expect(mockApi).not.toHaveBeenCalled()
    expect(interruptor(chave)).toHaveAttribute('aria-checked', 'false')
    await userEvent.click(within(caixa).getByRole('button', { name: 'Não, voltar' }))
    expect(mockApi).not.toHaveBeenCalled()
    expect(interruptor(chave)).toHaveFocus()

    await userEvent.click(interruptor(chave))
    await userEvent.click(screen.getByRole('button', { name: 'Sim, permitir' }))
    await screen.findByRole('status')
    expect(corpos).toEqual([{ [campo]: true }])
    expect(interruptor(chave)).toHaveAttribute('aria-checked', 'true')
  })

  it('desligar uma permissão de saúde ligada envia direto, sem confirmação', async () => {
    const corpos: unknown[] = []
    mockApi.mockImplementation(apiFalsa({ [ROTA]: (c) => (corpos.push(c), TODAS_DESLIGADAS) }))
    montar({ ...TODAS_DESLIGADAS, permite_registrar_saude: true })
    await userEvent.click(interruptor(/registrar dados de saúde/i))
    expect(await screen.findByRole('status')).toHaveTextContent('Registrar dados de saúde: desligado.')
    expect(corpos).toEqual([{ permite_registrar_saude: false }])
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('durante o envio o interruptor fica desligado para novo clique e já mostra o novo estado', async () => {
    let liberar!: (v: unknown) => void
    mockApi.mockImplementation(() => new Promise((r) => (liberar = r)))
    montar()
    await userEvent.click(interruptor(/compromissos de cuidado/i))
    expect(interruptor(/compromissos de cuidado/i)).toBeDisabled()
    expect(interruptor(/compromissos de cuidado/i)).toHaveAttribute('aria-checked', 'true')
    liberar({ ...TODAS_DESLIGADAS, permite_criar_evento_cuidado: true })
    await screen.findByRole('status')
    expect(interruptor(/compromissos de cuidado/i)).toBeEnabled()
  })

  it.each([
    [400, 'Não foi possível alterar esta permissão.'],
    [403, 'Você não pode alterar estas permissões.'],
    [404, 'Vínculo não encontrado.'],
    [409, 'As permissões só podem ser alteradas em vínculo aprovado.'],
    [500, 'Não foi possível concluir agora. Tente de novo em instantes.'],
  ])('status %s: volta o interruptor ao estado anterior e mostra mensagem fixa', async (status, texto) => {
    mockApi.mockImplementation(
      apiFalsa({
        [ROTA]: () => {
          throw erroApi(status, 'SEGREDO-do-corpo modo_decisao')
        },
      }),
    )
    montar()
    await userEvent.click(interruptor(/compromissos de cuidado/i))
    expect(await screen.findByRole('alert')).toHaveTextContent(texto)
    expect(interruptor(/compromissos de cuidado/i)).toHaveAttribute('aria-checked', 'false')
    expect(interruptor(/compromissos de cuidado/i)).toBeEnabled()
    expect(document.body).not.toHaveTextContent('SEGREDO-do-corpo')
    expect(document.body).not.toHaveTextContent('modo_decisao')
    expect(console.error).not.toHaveBeenCalled()
  })

  it('não tem violações do axe (editável, confirmação, erro e somente leitura)', async () => {
    mockApi.mockImplementation(
      apiFalsa({
        [ROTA]: () => {
          throw erroApi(403)
        },
      }),
    )
    const { container, unmount } = montar()
    expect(await axe(container, AXE)).toHaveNoViolations()
    await userEvent.click(interruptor(/registrar dados de saúde/i))
    expect(await axe(container, AXE)).toHaveNoViolations()
    await userEvent.click(screen.getByRole('button', { name: 'Sim, permitir' }))
    await screen.findByRole('alert')
    expect(await axe(container, AXE)).toHaveNoViolations()
    unmount()
    const leitura = montar(TODAS_DESLIGADAS, false)
    expect(await axe(leitura.container, AXE)).toHaveNoViolations()
  })
})
