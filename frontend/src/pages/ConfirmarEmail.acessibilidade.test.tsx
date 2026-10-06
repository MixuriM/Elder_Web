import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import ConfirmarEmail from './ConfirmarEmail'

expect.extend(toHaveNoViolations)

const mockSyncUser = jest.fn()
const mockGetCurrentUserToken = jest.fn()
const mockOnAuthChange = jest.fn()

jest.mock('../lib/auth', () => ({
  syncUser: (...args: unknown[]) => mockSyncUser(...args),
  getCurrentUserToken: (...args: unknown[]) => mockGetCurrentUserToken(...args),
  onAuthChange: (cb: (user: unknown) => void) => mockOnAuthChange(cb),
}))

// LIMITE: jsdom não calcula cor, então contraste NÃO é verificado aqui (coberto pelo Playwright, item 9.1).
// page-has-heading-one não roda via jest-axe (regra de página inteira), por isso o h1 é afirmado à mão.
const AXE = { rules: { 'color-contrast': { enabled: false } } }

function comSessao() {
  mockOnAuthChange.mockImplementation((cb: (user: unknown) => void) => {
    cb({ uid: 'uid-teste', email: 'ana@a.com' })
    return () => {}
  })
}

describe('ConfirmarEmail (acessibilidade)', () => {
  beforeEach(() => {
    mockSyncUser.mockReset()
    mockGetCurrentUserToken.mockReset()
    mockOnAuthChange.mockReset()
  })

  it('carregando (sessão ainda não resolvida): não tem violações detectáveis pelo axe', async () => {
    mockOnAuthChange.mockImplementation(() => () => {})
    const { container } = render(<ConfirmarEmail />)
    expect(await axe(container, AXE)).toHaveNoViolations()
  })

  it('sem sessão: tem h1 e não tem violações detectáveis pelo axe', async () => {
    mockOnAuthChange.mockImplementation((cb: (user: unknown) => void) => {
      cb(null)
      return () => {}
    })
    const { container } = render(<ConfirmarEmail />)
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(await axe(container, AXE)).toHaveNoViolations()
  })

  it('estado inicial com sessão: tem h1 e não tem violações detectáveis pelo axe', async () => {
    comSessao()
    const { container } = render(<ConfirmarEmail />)
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(await axe(container, AXE)).toHaveNoViolations()
  })

  it('confirmando: não tem violações detectáveis pelo axe', async () => {
    comSessao()
    mockGetCurrentUserToken.mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup()
    const { container } = render(<ConfirmarEmail />)

    await user.click(screen.getByRole('button', { name: /^confirmar e-mail$/i }))

    expect(await screen.findByRole('button', { name: /confirmando/i })).toBeDisabled()
    expect(await axe(container, AXE)).toHaveNoViolations()
  })

  it('sucesso: tem h1 e não tem violações detectáveis pelo axe', async () => {
    comSessao()
    mockGetCurrentUserToken.mockResolvedValue('token')
    mockSyncUser.mockResolvedValue({ criado: false })
    const user = userEvent.setup()
    const { container } = render(<ConfirmarEmail />)

    await user.click(screen.getByRole('button', { name: /^confirmar e-mail$/i }))

    expect(await screen.findByRole('status')).toHaveTextContent(/confirmado com sucesso/i)
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(await axe(container, AXE)).toHaveNoViolations()
  })

  it('erro: tem h1 e não tem violações detectáveis pelo axe', async () => {
    comSessao()
    mockGetCurrentUserToken.mockResolvedValue('token')
    mockSyncUser.mockRejectedValue(new Error('falha de rede'))
    jest.spyOn(console, 'error').mockImplementation(() => {})
    const user = userEvent.setup()
    const { container } = render(<ConfirmarEmail />)

    await user.click(screen.getByRole('button', { name: /^confirmar e-mail$/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/falha de rede/i)
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(await axe(container, AXE)).toHaveNoViolations()
    jest.restoreAllMocks()
  })
})
