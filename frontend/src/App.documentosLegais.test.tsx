import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import App from './App'

// Fiação real: App completo nas três rotas dos documentos, com e sem usuário logado.
let mockUsuario: { uid: string } | null = null
jest.mock('./lib/auth', () => ({
  onAuthChange: (cb: (u: unknown) => void) => {
    cb(mockUsuario)
    return () => {}
  },
  getCurrentUserToken: jest.fn().mockResolvedValue(null),
}))

const ROTAS = [
  ['/privacidade', 'Política de Privacidade'],
  ['/termos', 'Termos de Uso'],
  ['/cookies', 'Política de Cookies e armazenamento no navegador'],
] as const

function renderApp(rota: string) {
  window.history.pushState({}, '', rota)
  return render(
    <BrowserRouter>
      <App />
    </BrowserRouter>,
  )
}

describe.each(ROTAS)('App: rota pública %s', (rota, titulo) => {
  it('sem usuário: mostra a página, mantém a URL e não manda para login', async () => {
    mockUsuario = null
    renderApp(rota)
    expect(await screen.findByRole('heading', { level: 1, name: titulo })).toBeInTheDocument()
    expect(window.location.pathname).toBe(rota)
  })

  it('com usuário logado: a página também renderiza', async () => {
    mockUsuario = { uid: 'u1' }
    renderApp(rota)
    expect(await screen.findByRole('heading', { level: 1, name: titulo })).toBeInTheDocument()
    expect(window.location.pathname).toBe(rota)
  })
})
