import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import App from './App'

// Fiação real: App completo nas rotas protegidas /avisos e /configuracoes (lazy, dentro do layout).
let mockLogado = true
jest.mock('./lib/auth', () => ({
  onAuthChange: (cb: (u: unknown) => void) => {
    cb(mockLogado ? { uid: 'u1' } : null)
    return () => {}
  },
  getCurrentUserToken: jest.fn().mockResolvedValue(null),
  logoutUser: jest.fn(),
}))

function renderApp(caminho: string) {
  window.history.pushState({}, '', caminho)
  return render(
    <BrowserRouter>
      <App />
    </BrowserRouter>,
  )
}

describe.each([
  ['/avisos', 'Avisos'],
  ['/configuracoes', 'Configurações'],
])('App: rota protegida %s', (caminho, titulo) => {
  it('com usuário logado: mostra a página dentro do layout', async () => {
    mockLogado = true
    renderApp(caminho)
    expect(await screen.findByRole('heading', { level: 1, name: titulo })).toBeInTheDocument()
    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(window.location.pathname).toBe(caminho)
  })

  it('sem usuário: redireciona para /login', async () => {
    mockLogado = false
    renderApp(caminho)
    await waitFor(() => expect(window.location.pathname).toBe('/login'))
  })
})
