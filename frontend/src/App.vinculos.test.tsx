import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import App from './App'

// Fiação real: App completo. Usuário sempre logado; a API devolve lista vazia.
jest.mock('./lib/auth', () => ({
  onAuthChange: (cb: (u: unknown) => void) => {
    cb({ uid: 'u1' })
    return () => {}
  },
  getCurrentUserToken: jest.fn().mockResolvedValue(null),
}))
jest.mock('./lib/chamarApi', () => ({
  chamarApi: jest.fn().mockResolvedValue({ vinculos: [] }),
}))
// Perfil fake por teste; sem valor, a busca falha e o acesso fica em erro (falha aberta).
const mockBuscarPerfil = jest.fn()
jest.mock('./services/perfilService', () => ({
  ...jest.requireActual('./services/perfilService'),
  buscarPerfil: (...a: unknown[]) => mockBuscarPerfil(...a),
}))
beforeEach(() => {
  mockBuscarPerfil.mockReset()
  mockBuscarPerfil.mockRejectedValue(new Error('sem perfil no teste'))
})

function renderApp(caminho: string) {
  window.history.pushState({}, '', caminho)
  return render(
    <BrowserRouter>
      <App />
    </BrowserRouter>,
  )
}

describe('App: telas de vínculos por tipo', () => {
  // Primeiro do arquivo: React.lazy só chama o import uma vez por módulo, e os testes seguintes reaproveitam.
  it('página carregada por lazy limpa a marca de recarga do vite:preloadError', async () => {
    sessionStorage.setItem('elder-preload-recarregado', '1')
    renderApp('/cuidadores')
    await screen.findByRole('heading', { level: 1, name: 'Cuidadores' })
    expect(sessionStorage.getItem('elder-preload-recarregado')).toBeNull()
  })

  it('/vinculos redireciona para /familia', async () => {
    renderApp('/vinculos')
    await waitFor(() => expect(window.location.pathname).toBe('/familia'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Família' })).toBeInTheDocument()
  })

  it.each([
    ['cuidador', '/cuidadores', 'Cuidadores'],
    ['familiar', '/familia', 'Família'],
    ['idoso', '/familia', 'Família'],
  ])('/vinculos leva o %s para %s', async (tipo_perfil, destino, titulo) => {
    mockBuscarPerfil.mockResolvedValue({ tipo_perfil, nome: 'Pessoa Teste' })
    renderApp('/vinculos')
    await waitFor(() => expect(window.location.pathname).toBe(destino))
    expect(await screen.findByRole('heading', { level: 1, name: titulo })).toBeInTheDocument()
  })

  it('/cuidadores abre a tela de cuidadores', async () => {
    renderApp('/cuidadores')
    expect(await screen.findByRole('heading', { level: 1, name: 'Cuidadores' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/cuidadores')
  })

  it('tela autenticada real tem menu, cabeçalho e um único main', async () => {
    renderApp('/cuidadores')
    await screen.findByRole('heading', { level: 1, name: 'Cuidadores' })
    expect(screen.getAllByRole('main')).toHaveLength(1)
    expect(screen.getByRole('navigation', { name: 'Menu principal' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Cuidadores' })).toHaveAttribute('aria-current', 'page')
  })
})
