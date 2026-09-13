import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import RotaProtegida from './RotaProtegida'

const mockUseAuthUser = jest.fn()
jest.mock('../hooks/useAuthUser', () => ({
  useAuthUser: () => mockUseAuthUser(),
}))

function renderComRota() {
  return render(
    <MemoryRouter initialEntries={['/perfil']}>
      <Routes>
        <Route
          path="/perfil"
          element={
            <RotaProtegida>
              <p>Conteúdo protegido</p>
            </RotaProtegida>
          }
        />
        <Route path="/login" element={<p>Tela de login</p>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('RotaProtegida', () => {
  it('mostra carregando enquanto o estado de auth ainda não resolveu', () => {
    mockUseAuthUser.mockReturnValue({ usuario: null, carregando: true })
    renderComRota()
    expect(screen.getByText('Carregando...')).toBeInTheDocument()
  })

  it('redireciona para /login quando não há usuário logado', () => {
    mockUseAuthUser.mockReturnValue({ usuario: null, carregando: false })
    renderComRota()
    expect(screen.getByText('Tela de login')).toBeInTheDocument()
  })

  it('renderiza os children quando há usuário logado', () => {
    mockUseAuthUser.mockReturnValue({ usuario: { uid: '1' }, carregando: false })
    renderComRota()
    expect(screen.getByText('Conteúdo protegido')).toBeInTheDocument()
  })
})
