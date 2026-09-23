import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Home from './Home'

// Sidebar e Header usam funções de auth.ts; o teste precisa mockar o módulo
// completo para não inicializar Firebase de verdade nem chamar onAuthChange
// sem implementação.
jest.mock('../lib/auth', () => ({
  logoutUser: jest.fn(),
  onAuthChange: jest.fn(() => () => {}),
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
