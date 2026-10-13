import '@testing-library/jest-dom'
import { act, render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import App from './App'

// Desempenho (2026-10-13, decisão D8): Landing, Login e Cadastro acordam o backend em segundo plano. A trava de
// 1 disparo por carga, a falta de credencial e o silêncio na falha são testados em lib/aquecerBackend.test.ts.
const mockAquecer = jest.fn()
jest.mock('./lib/aquecerBackend', () => ({ aquecerBackend: () => mockAquecer() }))
jest.mock('./lib/auth', () => ({
  onAuthChange: (cb: (u: unknown) => void) => {
    cb(null)
    return () => {}
  },
  getCurrentUserToken: jest.fn().mockResolvedValue(null),
}))

async function renderApp(rota: string) {
  window.history.pushState({}, '', rota)
  render(
    <BrowserRouter>
      <App />
    </BrowserRouter>,
  )
  await act(async () => {})
}

describe('App: aquecimento do backend nas telas de entrada', () => {
  beforeEach(() => mockAquecer.mockReset())

  it.each(['/', '/login', '/cadastro'])('%s pede o aquecimento', async (rota) => {
    await renderApp(rota)
    expect(mockAquecer).toHaveBeenCalled()
  })

  it.each(['/sobre-nos', '/esqueci-senha'])('%s não pede', async (rota) => {
    await renderApp(rota)
    expect(mockAquecer).not.toHaveBeenCalled()
  })

  it('a tela aparece sem esperar o aquecimento', async () => {
    await renderApp('/login')
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })
})
