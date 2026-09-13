import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import Home from './Home'

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
    render(<Home />)

    expect(screen.getByText('Cuidado e bem-estar')).toBeInTheDocument()
  })
})
