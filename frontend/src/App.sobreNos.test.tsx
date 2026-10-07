import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import App from './App'

// Fiação real: App completo em /sobre-nos, com e sem usuário logado.
let mockUsuario: { uid: string } | null = null
jest.mock('./lib/auth', () => ({
  onAuthChange: (cb: (u: unknown) => void) => {
    cb(mockUsuario)
    return () => {}
  },
  getCurrentUserToken: jest.fn().mockResolvedValue(null),
}))

function renderApp() {
  window.history.pushState({}, '', '/sobre-nos')
  return render(
    <BrowserRouter>
      <App />
    </BrowserRouter>
  )
}

describe('App: rota pública /sobre-nos', () => {
  it('sem usuário: mostra a página, mantém a URL e não manda para login', async () => {
    mockUsuario = null
    renderApp()
    expect(await screen.findByRole('heading', { level: 1, name: 'Sobre o Elder Web' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/sobre-nos')
    expect(screen.queryByText(/carregando/i)).not.toBeInTheDocument()
  })

  it('com usuário logado: a página também renderiza', async () => {
    mockUsuario = { uid: 'u1' }
    renderApp()
    expect(await screen.findByRole('heading', { level: 1, name: 'Sobre o Elder Web' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/sobre-nos')
  })
})
