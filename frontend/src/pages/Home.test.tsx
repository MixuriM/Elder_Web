import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Home from './Home'

// Sidebar chama logoutUser de lib/auth.ts, que inicializa o Firebase Auth de
// verdade no import -- sem env vars de teste isso quebra. Mock evita puxar
// esse módulo, mesmo padrão usado em RotaProtegida.test.tsx.
jest.mock('../lib/auth', () => ({
  logoutUser: jest.fn(),
}))

// jsdom não implementa matchMedia; Home usa pra detectar tema do sistema.
beforeAll(() => {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
})

describe('Home', () => {
  it('renderiza sem erros e exibe a marca Elder Web', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    )

    expect(screen.getByText('Cuidado e bem-estar')).toBeInTheDocument()
  })
})
