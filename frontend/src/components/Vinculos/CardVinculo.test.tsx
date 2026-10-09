import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import CardVinculo, { type Vinculo } from './CardVinculo'

// Dados fake, só para o teste.
const base: Vinculo = {
  id: 1,
  tipo_vinculo: 'cuidador',
  origem: 'solicitacao_cuidador',
  status: 'aprovado',
  data_solicitacao: '2026-10-01T10:00:00.000Z',
  data_resposta: null,
  confirmado_em: null,
  papel_do_chamador: 'dono',
  idoso: { id: 5, nome: 'Maria Idosa', email_mascarado: 'ma***@mail.com' },
  vinculado: { id: 8, nome: 'João Cuidador', email_mascarado: 'jo***@mail.com' },
}

function renderizar(vinculo: Vinculo) {
  return render(
    <MemoryRouter>
      <CardVinculo vinculo={vinculo} />
    </MemoryRouter>,
  )
}

describe('CardVinculo por papel_do_chamador', () => {
  it('dono (idoso logado): mostra a pessoa vinculada', () => {
    renderizar(base)
    expect(screen.getByRole('heading', { name: 'João Cuidador' })).toBeInTheDocument()
    expect(screen.queryByText(/Maria Idosa/)).not.toBeInTheDocument()
  })

  it('vinculado (cuidador ou familiar logado): mostra o idoso, não o próprio usuário', () => {
    renderizar({ ...base, papel_do_chamador: 'vinculado' })
    expect(screen.getByRole('heading', { name: 'Maria Idosa' })).toBeInTheDocument()
    expect(screen.queryByText('João Cuidador')).not.toBeInTheDocument()
  })

  it('vinculado com idoso oculto (pendente): usa texto genérico, sem nome', () => {
    renderizar({
      ...base,
      papel_do_chamador: 'vinculado',
      status: 'pendente',
      idoso: { id: null, nome: null, email_mascarado: null },
    })
    expect(screen.getByRole('heading', { name: 'Idoso' })).toBeInTheDocument()
    expect(screen.queryByText('João Cuidador')).not.toBeInTheDocument()
  })

  it('titular: mostra a pessoa vinculada e o nome do idoso', () => {
    renderizar({ ...base, papel_do_chamador: 'titular' })
    expect(screen.getByRole('heading', { name: 'João Cuidador' })).toBeInTheDocument()
    expect(screen.getByText(/Idoso: Maria Idosa/)).toBeInTheDocument()
  })
})
