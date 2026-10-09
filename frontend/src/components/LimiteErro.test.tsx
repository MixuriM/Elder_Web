import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LimiteErro from './LimiteErro'
import { recarregarPagina } from '../lib/recarregar'

jest.mock('../lib/recarregar', () => ({
  recarregarPagina: jest.fn(),
}))

function Quebrado(): never {
  throw new Error('Failed to fetch dynamically imported module')
}

describe('LimiteErro', () => {
  let erroConsole: jest.SpyInstance

  beforeEach(() => {
    // React loga o erro capturado; silencia só aqui.
    erroConsole = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    erroConsole.mockRestore()
    jest.clearAllMocks()
  })

  it('renderiza os filhos quando não há erro', () => {
    render(
      <LimiteErro>
        <p>Tudo certo</p>
      </LimiteErro>,
    )
    expect(screen.getByText('Tudo certo')).toBeInTheDocument()
  })

  it('mostra mensagem em português e botão de recarregar quando um filho quebra', async () => {
    const user = userEvent.setup()
    render(
      <LimiteErro>
        <Quebrado />
      </LimiteErro>,
    )

    const alerta = screen.getByRole('alert')
    expect(alerta).toHaveTextContent(/não foi possível carregar esta página/i)
    // Mensagem fixa: nunca ecoa o texto do erro.
    expect(alerta).not.toHaveTextContent(/dynamically imported/i)

    await user.click(screen.getByRole('button', { name: 'Recarregar a página' }))
    expect(recarregarPagina).toHaveBeenCalledTimes(1)
  })
})
