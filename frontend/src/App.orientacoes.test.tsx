import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import App from './App'

// Fiação real: App completo em /orientacoes (rota protegida).
// Estados do mock de auth: 'deslogado' e 'logado' resolvem na hora; 'pendente' nunca chama o callback.
let mockEstado: 'deslogado' | 'logado' | 'pendente' = 'deslogado'
jest.mock('./lib/auth', () => ({
  onAuthChange: (cb: (u: unknown) => void) => {
    if (mockEstado === 'logado') cb({ uid: 'u1' })
    else if (mockEstado === 'deslogado') cb(null)
    return () => {}
  },
  getCurrentUserToken: jest.fn().mockResolvedValue(null),
}))

function renderApp() {
  window.history.pushState({}, '', '/orientacoes')
  return render(
    <BrowserRouter>
      <App />
    </BrowserRouter>
  )
}

const h1 = { level: 1, name: 'Orientações gerais' } as const

describe('App: rota protegida /orientacoes', () => {
  it('sem usuário: redireciona para /login e não mostra a página', async () => {
    mockEstado = 'deslogado'
    renderApp()
    await waitFor(() => expect(window.location.pathname).toBe('/login'))
    expect(screen.queryByRole('heading', h1)).not.toBeInTheDocument()
  })

  it('com usuário logado: mostra a página e mantém a URL', async () => {
    mockEstado = 'logado'
    renderApp()
    expect(await screen.findByRole('heading', h1)).toBeInTheDocument()
    expect(window.location.pathname).toBe('/orientacoes')
  })

  it('auth não resolvida: mostra Carregando..., sem página e sem redirecionar', () => {
    mockEstado = 'pendente'
    renderApp()
    expect(screen.getByText('Carregando...')).toBeInTheDocument()
    expect(screen.queryByRole('heading', h1)).not.toBeInTheDocument()
    expect(window.location.pathname).toBe('/orientacoes')
  })
})
