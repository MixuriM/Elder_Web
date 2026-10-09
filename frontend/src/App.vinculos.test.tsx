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

function renderApp(caminho: string) {
  window.history.pushState({}, '', caminho)
  return render(
    <BrowserRouter>
      <App />
    </BrowserRouter>,
  )
}

describe('App: telas de vínculos por tipo', () => {
  it('/vinculos redireciona para /familia', async () => {
    renderApp('/vinculos')
    await waitFor(() => expect(window.location.pathname).toBe('/familia'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Família' })).toBeInTheDocument()
  })

  it('/cuidadores abre a tela de cuidadores', async () => {
    renderApp('/cuidadores')
    expect(await screen.findByRole('heading', { level: 1, name: 'Cuidadores' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/cuidadores')
  })
})
