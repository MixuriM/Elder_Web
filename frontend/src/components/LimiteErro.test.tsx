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
      <LimiteErro resetKey="/">
        <p>Tudo certo</p>
      </LimiteErro>,
    )
    expect(screen.getByText('Tudo certo')).toBeInTheDocument()
  })

  it('limpa o erro quando resetKey muda (troca de rota) sem remontar os filhos sadios', () => {
    function Tela({ quebra }: { quebra: boolean }) {
      if (quebra) throw new Error('falha de chunk')
      return <p>Tela sadia</p>
    }
    const { rerender } = render(
      <LimiteErro resetKey="/a">
        <Tela quebra />
      </LimiteErro>,
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()

    rerender(
      <LimiteErro resetKey="/b">
        <Tela quebra={false} />
      </LimiteErro>,
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByText('Tela sadia')).toBeInTheDocument()
  })

  it('mostra mensagem em português e botão de recarregar quando um filho quebra', async () => {
    const user = userEvent.setup()
    render(
      <LimiteErro resetKey="/">
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
