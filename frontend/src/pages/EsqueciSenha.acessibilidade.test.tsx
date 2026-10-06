import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { axe, toHaveNoViolations } from 'jest-axe'
import EsqueciSenha from './EsqueciSenha'

expect.extend(toHaveNoViolations)

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(),
  GoogleAuthProvider: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
}))
jest.mock('../lib/firebase', () => ({ app: {} }))

const mockResetPassword = jest.fn()
jest.mock('../lib/auth', () => {
  const actual = jest.requireActual('../lib/auth')
  return {
    ...actual,
    resetPassword: (...args: unknown[]) => mockResetPassword(...args),
  }
})

// LIMITE: jsdom não calcula cor, então contraste NÃO é verificado aqui (coberto pelo Playwright, item 9.1).
// page-has-heading-one não roda via jest-axe (regra de página inteira), por isso o h1 é afirmado à mão.
const AXE = { rules: { 'color-contrast': { enabled: false } } }

function renderEsqueciSenha() {
  return render(
    <MemoryRouter initialEntries={['/esqueci-senha']}>
      <EsqueciSenha />
    </MemoryRouter>
  )
}

describe('EsqueciSenha (acessibilidade)', () => {
  it('estado inicial: tem h1 e não tem violações detectáveis pelo axe', async () => {
    const { container } = renderEsqueciSenha()
    expect(screen.getAllByRole('heading', { level: 1 }).length).toBeGreaterThan(0)
    expect(await axe(container, AXE)).toHaveNoViolations()
  })

  it('com mensagem de resultado: não tem violações detectáveis pelo axe', async () => {
    mockResetPassword.mockResolvedValue(undefined)
    const user = userEvent.setup()
    const { container } = renderEsqueciSenha()

    await user.type(screen.getByLabelText(/e-mail/i), 'ana@a.com')
    await user.click(screen.getByRole('button', { name: /enviar/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/receberá/i)
    expect(screen.getAllByRole('heading', { level: 1 }).length).toBeGreaterThan(0)
    expect(await axe(container, AXE)).toHaveNoViolations()
  })
})
