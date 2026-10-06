import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { axe, toHaveNoViolations } from 'jest-axe'
import Login from './Login'

expect.extend(toHaveNoViolations)

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(),
  GoogleAuthProvider: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  signInWithPopup: jest.fn(),
  signOut: jest.fn(),
  onAuthStateChanged: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  sendEmailVerification: jest.fn(),
}))
jest.mock('../lib/firebase', () => ({ app: {} }))

const mockLoginUser = jest.fn()
jest.mock('../lib/auth', () => {
  const actual = jest.requireActual('../lib/auth')
  return {
    ...actual,
    loginUser: (...args: unknown[]) => mockLoginUser(...args),
  }
})

// LIMITE: jsdom não calcula cor, então contraste NÃO é verificado aqui (coberto pelo Playwright, item 9.1).
// page-has-heading-one não roda via jest-axe (regra de página inteira), por isso o h1 é afirmado à mão.
const AXE = { rules: { 'color-contrast': { enabled: false } } }

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Login />
    </MemoryRouter>
  )
}

describe('Login (acessibilidade)', () => {
  it('estado inicial: tem h1 e não tem violações detectáveis pelo axe', async () => {
    const { container } = renderLogin()
    expect(screen.getAllByRole('heading', { level: 1 }).length).toBeGreaterThan(0)
    expect(await axe(container, AXE)).toHaveNoViolations()
  })

  it('com erro de credencial: não tem violações detectáveis pelo axe', async () => {
    mockLoginUser.mockRejectedValue(Object.assign(new Error('senha errada'), { code: 'auth/wrong-password' }))
    const user = userEvent.setup()
    const { container } = renderLogin()

    await user.type(screen.getByLabelText(/^e-mail$/i), 'ana@a.com')
    await user.type(screen.getByLabelText(/^senha$/i), '123456')
    await user.click(screen.getByRole('button', { name: /^entrar$/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/e-mail ou senha incorretos/i)
    expect(screen.getAllByRole('heading', { level: 1 }).length).toBeGreaterThan(0)
    expect(await axe(container, AXE)).toHaveNoViolations()
  })
})
