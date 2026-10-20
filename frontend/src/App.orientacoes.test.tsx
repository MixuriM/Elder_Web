import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import App from './App'

// Fiação real: App completo em /orientacoes (rota pública; logado ganha a moldura autenticada).
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

// O <header> do cabeçalho da página fica dentro do main e não é landmark banner; o jsdom (aria-query) o conta mesmo assim.
function bannersReais() {
  return screen.getAllByRole('banner').filter((el) => !el.closest('main'))
}

const h1 = { level: 1, name: 'Orientações gerais' } as const

describe('App: rota pública /orientacoes', () => {
  it('sem usuário: mostra a página, mantém a URL e não manda para login', async () => {
    mockEstado = 'deslogado'
    renderApp()
    expect(await screen.findByRole('heading', h1)).toBeInTheDocument()
    expect(window.location.pathname).toBe('/orientacoes')
  })

  it('com usuário logado: mostra a página dentro da moldura autenticada e mantém a URL', async () => {
    mockEstado = 'logado'
    renderApp()
    expect(await screen.findByRole('heading', h1)).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Menu principal' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/orientacoes')
  })

  it('auth não resolvida: mostra Carregando..., sem página e sem redirecionar', () => {
    mockEstado = 'pendente'
    renderApp()
    expect(screen.getByText('Carregando...')).toBeInTheDocument()
    expect(screen.queryByRole('heading', h1)).not.toBeInTheDocument()
    expect(window.location.pathname).toBe('/orientacoes')
  })

  it('visitante: um main, um h1, um banner, um contentinfo e o link para entrar', async () => {
    mockEstado = 'deslogado'
    renderApp()
    await screen.findByRole('heading', h1)
    expect(screen.getAllByRole('main')).toHaveLength(1)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(bannersReais()).toHaveLength(1)
    expect(screen.getAllByRole('contentinfo')).toHaveLength(1)
    expect(screen.getByRole('link', { name: 'Entrar ou criar conta' })).toHaveAttribute('href', '/welcome')
  })

  it('logado: não mostra o link "Entrar ou criar conta"', async () => {
    mockEstado = 'logado'
    renderApp()
    await screen.findByRole('heading', h1)
    await waitFor(() => expect(screen.getAllByRole('main')).toHaveLength(1))
    expect(screen.queryByRole('link', { name: 'Entrar ou criar conta' })).not.toBeInTheDocument()
  })
})
