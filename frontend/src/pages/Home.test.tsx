import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import Home from './Home'

// Cobre o conteúdo de scaffold provisório da rota raiz ("/"). Home ainda não
// tem lógica de auth/redirecionamento (AuthContext e proteção de rota
// pendentes, ver CLAUDE.md) — quando isso for implementado, este teste
// precisa ser atualizado ou removido.
describe('Home', () => {
  it('renderiza o título Elder Web', () => {
    render(<Home />)

    expect(screen.getByText('Elder Web')).toBeInTheDocument()
  })
})