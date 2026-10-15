import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'

import BarraDemonstracao from './BarraDemonstracao'

expect.extend(toHaveNoViolations)

// Modo demonstração (D7): a barra aparece só em sessão demo (claim demo do ID token) e o aviso de dados fictícios
// fica visível mesmo com ela recolhida. Contas e tokens FICTÍCIOS.
let mockUsuario: unknown = null
jest.mock('../../hooks/useAuthUser', () => ({ useAuthUser: () => ({ usuario: mockUsuario, carregando: false }) }))
const mockLogoutUser = jest.fn()
const mockEntrarComTokenDemo = jest.fn()
jest.mock('../../lib/auth', () => ({
  logoutUser: (...a: unknown[]) => mockLogoutUser(...a),
  entrarComTokenDemo: (...a: unknown[]) => mockEntrarComTokenDemo(...a),
}))
const mockChamarApi = jest.fn()
jest.mock('../../lib/chamarApi', () => ({ chamarApi: (...a: unknown[]) => mockChamarApi(...a) }))
const mockIrPara = jest.fn()
const mockRecarregar = jest.fn()
jest.mock('../../lib/recarregar', () => ({
  irPara: (...a: unknown[]) => mockIrPara(...a),
  recarregarPagina: () => mockRecarregar(),
}))

const AXE = { rules: { 'color-contrast': { enabled: false } } }
const AVISO = 'Modo demonstração: todos os dados são fictícios'
const CONTAS = [
  { slug: 'idosa-helena', nome: 'Helena Prado', tipo_perfil: 'idoso', descricao: 'a' },
  { slug: 'cuidadora-marta', nome: 'Marta Souza', tipo_perfil: 'cuidador', descricao: 'b' },
  { slug: 'familiar-carlos', nome: 'Carlos Prado', tipo_perfil: 'familiar', descricao: 'c' },
]
const sessao = (uid: string, claims: Record<string, unknown>) => ({ uid, getIdTokenResult: async () => ({ claims }) })

let armazenamento: jest.SpyInstance[]
beforeEach(() => {
  for (const m of [mockLogoutUser, mockEntrarComTokenDemo, mockChamarApi, mockIrPara, mockRecarregar]) m.mockReset()
  mockLogoutUser.mockResolvedValue(undefined)
  mockChamarApi.mockImplementation(async (caminho: string) => {
    if (caminho === '/demo/estado') return { contas: CONTAS, atual: 'idosa-helena' }
    if (caminho === '/demo/entrar-como') return { token: 'token-ficticio' }
    return { ok: true }
  })
  armazenamento = [jest.spyOn(Storage.prototype, 'setItem'), jest.spyOn(Storage.prototype, 'getItem')]
})
afterEach(() => {
  for (const s of armazenamento) expect(s).not.toHaveBeenCalled()
  jest.restoreAllMocks()
})

describe('BarraDemonstracao', () => {
  it('usuário comum: não renderiza nada nem chama o backend', async () => {
    mockUsuario = sessao('AbCdEf0123456789AbCdEf012345', {})
    const { container } = render(<BarraDemonstracao />)
    await waitFor(() => expect(container).toBeEmptyDOMElement())
    expect(mockChamarApi).not.toHaveBeenCalled()
  })

  it('sem usuário (ou usuário sem getIdTokenResult): não renderiza', async () => {
    mockUsuario = { uid: 'x' }
    const { container } = render(<BarraDemonstracao />)
    await waitFor(() => expect(container).toBeEmptyDOMElement())
  })

  it('sessão com a claim demo: aviso visível com a barra recolhida, sem violação axe', async () => {
    mockUsuario = sessao('demo-idosa-helena', { demo: true })
    const { container } = render(<BarraDemonstracao />)
    expect(await screen.findByText(AVISO)).toBeVisible()
    expect(container.querySelector('details')).not.toHaveAttribute('open')
    expect(container.querySelector('[style*="fixed"], .fixed')).toBeNull()
    expect(await axe(container, AXE)).toHaveNoViolations()
  })

  it('sessão do elenco que perdeu as claims na renovação do token: a barra continua (uid demo-)', async () => {
    mockUsuario = sessao('demo-cuidadora-marta', {})
    render(<BarraDemonstracao />)
    expect(await screen.findByText(AVISO)).toBeInTheDocument()
  })

  it('aberta: troca de conta com a atual marcada, restaurar e sair; sem violação axe', async () => {
    mockUsuario = sessao('demo-idosa-helena', { demo: true })
    const user = userEvent.setup()
    const { container } = render(<BarraDemonstracao />)
    await user.click(await screen.findByText('Trocar de conta ou restaurar'))
    const helena = await screen.findByRole('button', { name: /Helena Prado/ })
    expect(helena).toHaveAttribute('aria-current', 'true')
    expect(helena).toBeDisabled()
    expect(screen.getByRole('button', { name: /Marta Souza/ })).not.toHaveAttribute('aria-current')
    expect(await axe(container, AXE)).toHaveNoViolations()

    await user.click(screen.getByRole('button', { name: /Marta Souza/ }))
    expect(mockChamarApi).toHaveBeenCalledWith('/demo/entrar-como', { method: 'POST', body: JSON.stringify({ conta: 'cuidadora-marta' }) })
    expect(mockEntrarComTokenDemo).toHaveBeenCalledWith('token-ficticio')
    expect(mockIrPara).toHaveBeenCalledWith('/Home')
  })

  it('aberta: avisa que pedir vínculo, aceitar convite e cadastrar idoso não funcionam no modo demonstração', async () => {
    mockUsuario = sessao('demo-idosa-helena', { demo: true })
    const user = userEvent.setup()
    render(<BarraDemonstracao />)
    await user.click(await screen.findByText('Trocar de conta ou restaurar'))
    expect(screen.getByText(/pedir vínculo, aceitar convite e cadastrar idoso não funcionam neste modo/i)).toBeInTheDocument()
  })

  it('Restaurar dados chama /demo/restaurar e recarrega a página', async () => {
    mockUsuario = sessao('demo-idosa-helena', { demo: true })
    const user = userEvent.setup()
    render(<BarraDemonstracao />)
    await user.click(await screen.findByText('Trocar de conta ou restaurar'))
    await user.click(screen.getByRole('button', { name: 'Restaurar dados' }))
    expect(mockChamarApi).toHaveBeenCalledWith('/demo/restaurar', { method: 'POST' })
    await waitFor(() => expect(mockRecarregar).toHaveBeenCalledTimes(1))
  })

  it('falha ao restaurar: mensagem fixa e não recarrega', async () => {
    mockUsuario = sessao('demo-idosa-helena', { demo: true })
    mockChamarApi.mockImplementation(async (caminho: string) => {
      if (caminho === '/demo/estado') return { contas: CONTAS, atual: 'idosa-helena' }
      throw Object.assign(new Error('x'), { status: 500 })
    })
    const user = userEvent.setup()
    render(<BarraDemonstracao />)
    await user.click(await screen.findByText('Trocar de conta ou restaurar'))
    await user.click(screen.getByRole('button', { name: 'Restaurar dados' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível concluir. Tente de novo.')
    expect(mockRecarregar).not.toHaveBeenCalled()
  })

  it('Sair da demonstração sai da conta e volta para /demo', async () => {
    mockUsuario = sessao('demo-idosa-helena', { demo: true })
    const user = userEvent.setup()
    render(<BarraDemonstracao />)
    await user.click(await screen.findByText('Trocar de conta ou restaurar'))
    await user.click(screen.getByRole('button', { name: 'Sair da demonstração' }))
    expect(mockLogoutUser).toHaveBeenCalledTimes(1)
    expect(mockIrPara).toHaveBeenCalledWith('/demo')
  })

  it('estado indisponível (modo desligado no meio da sessão): ainda mostra o aviso e o botão de sair', async () => {
    mockUsuario = sessao('demo-idosa-helena', { demo: true })
    mockChamarApi.mockRejectedValue(Object.assign(new Error('x'), { status: 404 }))
    const user = userEvent.setup()
    render(<BarraDemonstracao />)
    await user.click(await screen.findByText('Trocar de conta ou restaurar'))
    expect(screen.getByText(AVISO)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sair da demonstração' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Helena Prado/ })).not.toBeInTheDocument()
  })
})
