import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdicionarPessoa from './AdicionarPessoa'

jest.mock('../../lib/chamarApi', () => ({ chamarApi: jest.fn() }))

describe('AdicionarPessoa', () => {
  it('uma única ação: abre direto o formulário de pedir vínculo', () => {
    render(<AdicionarPessoa tipo="cuidador" acoes={['solicitar']} onConcluido={() => {}} onFechar={() => {}} />)
    expect(screen.getByLabelText(/e-mail do idoso/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Voltar' })).not.toBeInTheDocument()
  })

  it('duas ações: mostra a escolha, entra no formulário e Voltar retorna à escolha', async () => {
    render(
      <AdicionarPessoa tipo="familiar" acoes={['solicitar', 'cadastrar']} onConcluido={() => {}} onFechar={() => {}} />,
    )
    expect(screen.getByRole('button', { name: 'Pedir vínculo com um idoso' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cadastrar um idoso' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Pedir vínculo com um idoso' }))
    expect(screen.getByLabelText(/e-mail do idoso/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Voltar' }))
    expect(screen.getByRole('button', { name: 'Cadastrar um idoso' })).toBeInTheDocument()
  })
})
