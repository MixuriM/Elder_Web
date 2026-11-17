import '@testing-library/jest-dom'

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'

import App from './App'

jest.mock('./lib/auth', () => ({
  onAuthChange: (cb: (u: unknown) => void) => {
    cb(null)
    return () => {}
  },
  getCurrentUserToken: jest.fn().mockResolvedValue(null),
}))

function renderApp(rota: string) {
  window.history.replaceState({}, '', rota)

  return render(
    <BrowserRouter>
      <App />
    </BrowserRouter>,
  )
}

const aviso = () => screen.queryByRole('region', { name: 'Aviso de cookies' })

beforeEach(() => {
  localStorage.clear()
})

describe('App: aviso de cookies', () => {
  it.each(['/', '/login', '/privacidade', '/orientacoes'])('aparece na primeira visita em %s', async (rota) => {
    renderApp(rota)

    expect(await screen.findByRole('region', { name: 'Aviso de cookies' })).toBeInTheDocument()
  })

  it('Entendi o fecha, e ele não volta ao trocar de página', async () => {
    const user = userEvent.setup()
    renderApp('/')

    await user.click(await screen.findByRole('button', { name: 'Entendi' }))
    expect(aviso()).not.toBeInTheDocument()

    await user.click((await screen.findAllByRole('link', { name: /privacidade/i }))[0])
    await screen.findByRole('heading', { level: 1 })
    expect(window.location.pathname).toBe('/privacidade')
    expect(aviso()).not.toBeInTheDocument()
  })

  it('já visto: não aparece', async () => {
    localStorage.setItem('avisoCookies', 'sim')
    renderApp('/login')

    await screen.findByRole('heading', { level: 1 })
    expect(aviso()).not.toBeInTheDocument()
  })

  it('o link leva à política de cookies', async () => {
    const user = userEvent.setup()
    renderApp('/')

    await user.click(await screen.findByRole('link', { name: /ler a política de cookies/i }))

    expect(window.location.pathname).toBe('/cookies')
  })
})
