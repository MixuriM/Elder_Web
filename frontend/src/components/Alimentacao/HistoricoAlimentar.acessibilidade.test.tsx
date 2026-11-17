import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'

import HistoricoAlimentar from './HistoricoAlimentar'

expect.extend(toHaveNoViolations)

// O jsdom não calcula contraste: o contraste é auditado por npm run test:a11y (Playwright). Dados falsos de teste.
const AXE = { rules: { 'color-contrast': { enabled: false } } }

jest.mock('../../hooks/useIdososVinculados', () => ({
  useIdososVinculados: () => jest.requireActual('../../hooks/idososFixtures').listaPerfilIdoso,
}))
jest.mock('../../lib/auth', () => ({ getCurrentUserToken: () => Promise.resolve('token-fake') }))

function resposta(status: number, corpo: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(corpo) } as Response
}

const fetchMock = jest.fn()

beforeEach(() => {
  fetchMock.mockImplementation(() =>
    Promise.resolve(
      resposta(200, { registros: [{ id: 7, refeicao: 'almoco', descricao: 'arroz de teste', data_hora: '2026-10-15T15:30:00.000Z' }] }),
    ),
  )
  global.fetch = fetchMock
})

describe('HistoricoAlimentar — acessibilidade', () => {
  it('lista: região nomeada, itens em lista, botões com texto e nome pelo item, sem violações', async () => {
    const { container } = render(<HistoricoAlimentar />)

    expect(await screen.findByRole('button', { name: 'Editar refeição Almoço' })).toHaveTextContent('Editar')
    const regiao = screen.getByRole('region', { name: 'Histórico alimentar' })
    expect(within(regiao).getByRole('list')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remover refeição Almoço' })).toHaveTextContent('Remover')
    expect(await axe(container, AXE)).toHaveNoViolations()
  })

  it('carregando e vazio são anunciados com role status', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(resposta(200, { registros: [] })))
    render(<HistoricoAlimentar />)

    expect(screen.getByRole('status')).toHaveTextContent(/carregando o histórico alimentar/i)
    expect(await screen.findByText('Nenhuma refeição registrada.')).toBeInTheDocument()
    expect(screen.getByText('Nenhuma refeição registrada.').closest('[role="status"]')).not.toBeNull()
  })

  it('erro de carga é anunciado com role alert', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(resposta(500, {})))
    render(<HistoricoAlimentar />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar o histórico alimentar.')
  })

  it('modal de edição: dialog modal nomeado, foco dentro, campos rotulados e sem violações', async () => {
    const user = userEvent.setup()
    render(<HistoricoAlimentar />)

    await user.click(await screen.findByRole('button', { name: 'Editar refeição Almoço' }))

    const dialogo = screen.getByRole('dialog', { name: 'Editar refeição' })
    expect(dialogo).toHaveAttribute('aria-modal', 'true')
    expect(dialogo).toHaveFocus()
    for (const rotulo of ['Refeição', 'Descrição', 'Data e hora']) {
      expect(within(dialogo).getByLabelText(rotulo)).toBeInTheDocument()
    }
    expect(await axe(dialogo, AXE)).toHaveNoViolations()
  })

  it('confirmação de remoção: alertdialog, foco dentro, botões com texto e sem violações', async () => {
    const user = userEvent.setup()
    render(<HistoricoAlimentar />)

    await user.click(await screen.findByRole('button', { name: 'Remover refeição Almoço' }))

    const dialogo = screen.getByRole('alertdialog', { name: 'Remover refeição' })
    expect(dialogo).toHaveFocus()
    expect(within(dialogo).getByRole('button', { name: 'Remover' })).toBeInTheDocument()
    expect(within(dialogo).getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
    expect(await axe(dialogo, AXE)).toHaveNoViolations()
  })
})
