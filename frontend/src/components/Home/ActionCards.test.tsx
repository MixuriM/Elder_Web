import '@testing-library/jest-dom'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ActionCards from './ActionCards'

// Renderiza os cards com o contexto de navegação.
function renderActionCards() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<ActionCards />} />
        <Route path="/saude" element={<div>Página de Saúde</div>} />
        <Route path="/remedios" element={<div>Página de Medicamentos</div>} />
        <Route path="/agenda" element={<div>Página de Agenda</div>} />
        <Route path="/alimentacao" element={<div>Página de Alimentação</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ActionCards - Home Elder Web', () => {
  // Verifica a exibição dos quatro cards.
  it('renderiza os quatro cards principais', () => {
    renderActionCards()

    expect(
      screen.getByRole('button', { name: /Minha Saúde/i }),
    ).toBeInTheDocument()

    expect(
      screen.getByRole('button', { name: /Meus Medicamentos/i }),
    ).toBeInTheDocument()

    expect(
      screen.getByRole('button', { name: /Minha Agenda/i }),
    ).toBeInTheDocument()

    expect(
      screen.getByRole('button', { name: /Alimentação e Nutrição/i }),
    ).toBeInTheDocument()
  })

  // O medicamento não possui horário estruturado,
  // apenas frequência em texto.
  it('card de medicamentos descreve só o que a tela tem', () => {
    renderActionCards()

    expect(
      screen.getByText('Veja seus remédios e o histórico de doses.'),
    ).toBeInTheDocument()

    expect(
      screen.queryByText(/horário/i),
    ).not.toBeInTheDocument()
  })

  // Verifica os textos do card de alimentação.
  it('exibe corretamente o card de alimentação', () => {
    renderActionCards()

    expect(
      screen.getByRole('button', { name: /Alimentação e Nutrição/i }),
    ).toBeInTheDocument()

    expect(
      screen.getByText('Visualize seus registros e históricos.'),
    ).toBeInTheDocument()
  })

  // Verifica o ícone de alimentação.
  it('utiliza o ícone Utensils no card de alimentação', () => {
    renderActionCards()

    const card = screen.getByRole('button', {
      name: /Alimentação e Nutrição/i,
    })

    const icon = card.querySelector('svg.lucide-utensils')

    expect(icon).toBeInTheDocument()
    expect(icon).toHaveAttribute('aria-hidden', 'true')
  })

  // Verifica se todos os cards são botões.
  it('utiliza botões acessíveis para navegação', () => {
    renderActionCards()

    const buttons = screen.getAllByRole('button')

    expect(buttons).toHaveLength(4)

    buttons.forEach((button) => {
      expect(button).toHaveAttribute('type', 'button')
      expect(button).toHaveAccessibleName()
    })
  })

  // Verifica a navegação do card de saúde.
  it('navega para a página de saúde', () => {
    renderActionCards()

    fireEvent.click(
      screen.getByRole('button', { name: /Minha Saúde/i }),
    )

    expect(
      screen.getByText('Página de Saúde'),
    ).toBeInTheDocument()
  })

  // Verifica a navegação do card de medicamentos.
  it('navega para a página de medicamentos', () => {
    renderActionCards()

    fireEvent.click(
      screen.getByRole('button', { name: /Meus Medicamentos/i }),
    )

    expect(
      screen.getByText('Página de Medicamentos'),
    ).toBeInTheDocument()
  })

  // Verifica a navegação do card de agenda.
  it('navega para a página de agenda', () => {
    renderActionCards()

    fireEvent.click(
      screen.getByRole('button', { name: /Minha Agenda/i }),
    )

    expect(
      screen.getByText('Página de Agenda'),
    ).toBeInTheDocument()
  })

  // Verifica a navegação do card de alimentação.
  it('navega para a página de alimentação', () => {
    renderActionCards()

    fireEvent.click(
      screen.getByRole('button', {
        name: /Alimentação e Nutrição/i,
      }),
    )

    expect(
      screen.getByText('Página de Alimentação'),
    ).toBeInTheDocument()
  })
})