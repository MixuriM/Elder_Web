import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ActionCards from './ActionCards'

// O card de medicamentos não promete horários: o medicamento não tem horário estruturado, só frequência em texto.
it('card de medicamentos descreve só o que a tela tem', () => {
  render(
    <MemoryRouter>
      <ActionCards />
    </MemoryRouter>,
  )
  expect(screen.getByText('Veja seus remédios e o histórico de doses.')).toBeInTheDocument()
  expect(screen.queryByText(/horário/i)).not.toBeInTheDocument()
})
