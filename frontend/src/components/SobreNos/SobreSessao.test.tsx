import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import SobreCTA from './SobreCTA'
import SobreHeader from './SobreHeader'

// 'pendente' nunca chama o callback: a sessão fica em carregando.
let mockEstado: 'deslogado' | 'logado' | 'pendente' = 'deslogado'
jest.mock('../../lib/auth', () => ({
  onAuthChange: (cb: (u: unknown) => void) => {
    if (mockEstado === 'logado') cb({ uid: 'u1' })
    else if (mockEstado === 'deslogado') cb(null)
    return () => {}
  },
}))

function renderizar() {
  return render(
    <MemoryRouter>
      <SobreHeader />
      <SobreCTA />
    </MemoryRouter>,
  )
}

describe('SobreHeader e SobreCTA: variação por sessão', () => {
  it.each(['deslogado', 'pendente'] as const)('%s: versão de visitante', (estado) => {
    mockEstado = estado
    renderizar()
    expect(screen.getByRole('link', { name: 'Voltar ao início' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Entrar ou criar conta' })).toHaveAttribute('href', '/welcome')
    expect(screen.getByRole('link', { name: 'Conhecer o Elder' })).toHaveAttribute('href', '/welcome')
    expect(screen.queryByRole('link', { name: 'Ir para o meu início' })).not.toBeInTheDocument()
  })

  it('logado: volta e CTA levam a /Home e não há "Entrar ou criar conta"', () => {
    mockEstado = 'logado'
    renderizar()
    expect(screen.getByRole('link', { name: 'Voltar ao início' })).toHaveAttribute('href', '/Home')
    expect(screen.getByRole('link', { name: 'Ir para o meu início' })).toHaveAttribute('href', '/Home')
    expect(screen.queryByRole('link', { name: 'Entrar ou criar conta' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Conhecer o Elder' })).not.toBeInTheDocument()
  })
})
