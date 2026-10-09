import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdicionarPessoa from './AdicionarPessoa'
import { chamarApi } from '../../lib/chamarApi'
import { apiFalsa, erroApi } from '../../testSupport/apiFalsa'

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

  it('cadastrar idoso: abre o formulário; no conflito de e-mail, pedir vínculo abre com o e-mail digitado', async () => {
    const mockApi = chamarApi as jest.Mock
    mockApi.mockImplementation(
      apiFalsa({
        'POST /usuario/cadastrar-idoso': () => {
          throw erroApi(409, 'Já existe uma conta com este e-mail.', { proximo_passo: 'Use Solicitar vínculo.' })
        },
      }),
    )
    render(
      <AdicionarPessoa tipo="familiar" acoes={['solicitar', 'cadastrar']} onConcluido={() => {}} onFechar={() => {}} />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Cadastrar um idoso' }))
    await userEvent.type(screen.getByLabelText(/nome do idoso/i), 'Maria Teste')
    await userEvent.type(screen.getByLabelText(/e-mail do idoso/i), 'maria.teste@exemplo.test')
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    await userEvent.click(screen.getByRole('checkbox', { name: /li e aceito o termo/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Aceitar e cadastrar' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Pedir vínculo com este e-mail' }))
    expect(screen.getByLabelText(/e-mail do idoso/i)).toHaveValue('maria.teste@exemplo.test')
    expect(screen.getByRole('button', { name: 'Enviar pedido' })).toBeInTheDocument()
  })
})
