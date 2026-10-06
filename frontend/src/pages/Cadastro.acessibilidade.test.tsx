import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { axe, toHaveNoViolations } from 'jest-axe'
import Cadastro from './Cadastro'

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

// LIMITE: jsdom não calcula cor, então contraste NÃO é verificado aqui (coberto pelo Playwright, item 9.1).
// page-has-heading-one não roda via jest-axe (regra de página inteira), por isso o h1 é afirmado à mão.
const AXE = { rules: { 'color-contrast': { enabled: false } } }

function renderCadastro() {
  return render(
    <MemoryRouter initialEntries={['/cadastro']}>
      <Cadastro />
    </MemoryRouter>
  )
}

describe('Cadastro (acessibilidade)', () => {
  it('estado inicial: tem h1 e não tem violações detectáveis pelo axe', async () => {
    const { container } = renderCadastro()
    expect(screen.getAllByRole('heading', { level: 1 }).length).toBeGreaterThan(0)
    expect(await axe(container, AXE)).toHaveNoViolations()
  })

  it('com erro de validação (perfil não escolhido): não tem violações detectáveis pelo axe', async () => {
    const user = userEvent.setup()
    const { container } = renderCadastro()

    // Os radios de perfil são required (validação nativa bloqueia o submit), então o erro
    // de perfil não escolhido é provocado pelo botão do Google, como em Cadastro.test.tsx.
    await user.click(screen.getByRole('button', { name: /google/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/escolha se você é/i)
    expect(screen.getAllByRole('heading', { level: 1 }).length).toBeGreaterThan(0)
    expect(await axe(container, AXE)).toHaveNoViolations()
  })
})
