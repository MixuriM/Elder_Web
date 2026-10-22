
import '@testing-library/jest-dom'

import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'

import App from './App'
import { DOCUMENTOS_LEGAIS } from './lib/documentosLegais'

// ==========================================
// SIMULAÇÃO DA AUTENTICAÇÃO
// ==========================================

let mockUsuario: { uid: string } | null = null

jest.mock('./lib/auth', () => ({
  onAuthChange: (cb: (u: unknown) => void) => {
    cb(mockUsuario)
    return () => {}
  },

  getCurrentUserToken: jest.fn().mockResolvedValue(null),
}))

// ==========================================
// ROTAS DOS DOCUMENTOS LEGAIS
// ==========================================

const ROTAS = DOCUMENTOS_LEGAIS.map((documento) => ({
  rota: documento.caminho,
  titulo: documento.titulo,
}))

// ==========================================
// RENDERIZAÇÃO DO APP
// ==========================================

function renderApp(rota: string) {
  window.history.replaceState({}, '', rota)

  return render(
    <BrowserRouter>
      <App />
    </BrowserRouter>,
  )
}

// ==========================================
// TESTES
// ==========================================

describe.each(ROTAS)(
  'App: rota pública $rota',
  ({ rota, titulo }) => {
    beforeEach(() => {
      mockUsuario = null
      jest.clearAllMocks()
    })

    it('sem usuário: renderiza a página sem redirecionar', async () => {
      renderApp(rota)

      const heading = await screen.findByRole(
        'heading',
        { level: 1 },
        { timeout: 3000 },
      )

      expect(heading).toBeVisible()
      expect(heading).toHaveTextContent(titulo)

      expect(window.location.pathname).toBe(rota)
      expect(window.location.pathname).not.toBe('/login')
    })

    it('com usuário logado: mantém a página pública acessível', async () => {
      mockUsuario = { uid: 'u1' }

      renderApp(rota)

      const heading = await screen.findByRole(
        'heading',
        { level: 1 },
        { timeout: 3000 },
      )

      expect(heading).toBeVisible()
      expect(heading).toHaveTextContent(titulo)

      expect(window.location.pathname).toBe(rota)
    })
  },
)
