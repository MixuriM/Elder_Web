
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import SobreCTA from './SobreCTA'
import SobreHeader from './SobreHeader'

// ==========================================
// MOCK DA AUTENTICAÇÃO
// ==========================================

type EstadoSessao = 'deslogado' | 'logado' | 'pendente'

let mockEstado: EstadoSessao = 'deslogado'

// No estado pendente, o callback não é chamado.
jest.mock('../../lib/auth', () => ({
  onAuthChange: (cb: (u: unknown) => void) => {
    if (mockEstado === 'logado') {
      cb({ uid: 'u1' })
    } else if (mockEstado === 'deslogado') {
      cb(null)
    }

    return () => {}
  },
}))

// ==========================================
// RENDERIZAÇÃO
// ==========================================

function renderizar() {
  return render(
    <MemoryRouter initialEntries={['/sobre-nos']}>
      <SobreHeader />
      <SobreCTA />
    </MemoryRouter>,
  )
}

// ==========================================
// TESTES
// ==========================================

describe('SobreHeader e SobreCTA: variação por sessão', () => {
  beforeEach(() => {
    mockEstado = 'deslogado'
  })

  it.each(['deslogado', 'pendente'] as const)(
    '%s: apresenta a versão de visitante',
    (estado) => {
      mockEstado = estado
      renderizar()

      expect(
        screen.getByRole('link', {
          name: 'Voltar ao início',
        }),
      ).toHaveAttribute('href', '/')

      expect(
        screen.getByRole('link', {
          name: 'Entrar ou criar conta',
        }),
      ).toHaveAttribute('href', '/welcome')

      expect(
        screen.getByRole('link', {
          name: 'Conhecer o Elder',
        }),
      ).toHaveAttribute('href', '/welcome')

      expect(
        screen.queryByRole('link', {
          name: 'Ir para o meu início',
        }),
      ).not.toBeInTheDocument()
    },
  )

  it('logado: direciona para a Home', () => {
    mockEstado = 'logado'
    renderizar()

    expect(
      screen.getByRole('link', {
        name: 'Voltar ao início',
      }),
    ).toHaveAttribute('href', '/Home')

    expect(
      screen.getByRole('link', {
        name: 'Ir para o meu início',
      }),
    ).toHaveAttribute('href', '/Home')

    expect(
      screen.queryByRole('link', {
        name: 'Entrar ou criar conta',
      }),
    ).not.toBeInTheDocument()

    expect(
      screen.queryByRole('link', {
        name: 'Conhecer o Elder',
      }),
    ).not.toBeInTheDocument()
  })
})
