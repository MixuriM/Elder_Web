import '@testing-library/jest-dom'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AcessoProvider } from './AcessoContext'
import { useAcesso } from './useAcesso'

const mockBuscarPerfil = jest.fn()
const mockChamarApi = jest.fn()
jest.mock('../services/perfilService', () => ({
  buscarPerfil: (...a: unknown[]) => mockBuscarPerfil(...a),
}))
jest.mock('../lib/chamarApi', () => ({
  chamarApi: (...a: unknown[]) => mockChamarApi(...a),
}))

function Mostra() {
  const a = useAcesso()
  return (
    <output data-testid="acesso">
      {[a.estado, a.tipoPerfil, a.temVinculoAprovado, a.temVinculoPendente].join('|')}
    </output>
  )
}

function Extra() {
  const a = useAcesso()
  return <output data-testid="extra">{[a.vinculos ? a.vinculos.length : 'nulo', a.modoDecisao].join('|')}</output>
}

async function renderizar() {
  render(
    <AcessoProvider>
      <Mostra />
      <Mostra />
      <Extra />
    </AcessoProvider>,
  )
  // deixa as promessas resolverem
  await act(async () => {})
  return screen.getAllByTestId('acesso')[0].textContent
}

// Dados fake só para o teste.
const vinculo = (status: string, papel = 'vinculado') => ({ status, papel_do_chamador: papel })

describe('AcessoProvider', () => {
  beforeEach(() => {
    mockBuscarPerfil.mockReset()
    mockChamarApi.mockReset()
  })

  it('começa em carregando', () => {
    mockBuscarPerfil.mockReturnValue(new Promise(() => {}))
    render(
      <AcessoProvider>
        <Mostra />
      </AcessoProvider>,
    )
    expect(screen.getByTestId('acesso')).toHaveTextContent('carregando')
  })

  it('idoso: ok, e busca os vínculos uma vez (pedidos para responder nos avisos)', async () => {
    mockBuscarPerfil.mockResolvedValue({ tipo_perfil: 'idoso', modo_decisao: null })
    mockChamarApi.mockResolvedValue({ vinculos: [vinculo('pendente', 'dono')] })
    expect(await renderizar()).toBe('ok|idoso|false|false')
    expect(mockChamarApi).toHaveBeenCalledTimes(1)
    expect(screen.getAllByTestId('extra')[0]).toHaveTextContent('1|idoso')
  })

  it('idoso: falha nos vínculos não vira erro (idoso nunca é bloqueado); vínculos ficam desconhecidos', async () => {
    mockBuscarPerfil.mockResolvedValue({ tipo_perfil: 'idoso', modo_decisao: 'familiar' })
    mockChamarApi.mockRejectedValue(new Error('500'))
    expect(await renderizar()).toBe('ok|idoso|false|false')
    expect(screen.getAllByTestId('extra')[0]).toHaveTextContent('nulo|familiar')
  })

  it('cuidador: expõe a lista de vínculos já buscada', async () => {
    mockBuscarPerfil.mockResolvedValue({ tipo_perfil: 'cuidador' })
    mockChamarApi.mockResolvedValue({ vinculos: [vinculo('aprovado'), vinculo('pendente')] })
    await renderizar()
    expect(screen.getAllByTestId('extra')[0]).toHaveTextContent('2|idoso')
  })

  it('busca perfil e vínculos uma única vez, mesmo com 2 consumidores', async () => {
    mockBuscarPerfil.mockResolvedValue({ tipo_perfil: 'familiar' })
    mockChamarApi.mockResolvedValue({ vinculos: [] })
    await renderizar()
    expect(mockBuscarPerfil).toHaveBeenCalledTimes(1)
    expect(mockChamarApi).toHaveBeenCalledTimes(1)
  })

  it('cuidador com vínculo próprio aprovado', async () => {
    mockBuscarPerfil.mockResolvedValue({ tipo_perfil: 'cuidador' })
    mockChamarApi.mockResolvedValue({ vinculos: [vinculo('aprovado')] })
    expect(await renderizar()).toBe('ok|cuidador|true|false')
  })

  it('só pendente: sem vínculo aprovado e com pendente', async () => {
    mockBuscarPerfil.mockResolvedValue({ tipo_perfil: 'cuidador' })
    mockChamarApi.mockResolvedValue({ vinculos: [vinculo('pendente'), vinculo('recusado')] })
    expect(await renderizar()).toBe('ok|cuidador|false|true')
  })

  it('vínculo de outra pessoa (titular) não conta como acesso próprio', async () => {
    mockBuscarPerfil.mockResolvedValue({ tipo_perfil: 'familiar' })
    mockChamarApi.mockResolvedValue({ vinculos: [vinculo('aprovado', 'titular')] })
    expect(await renderizar()).toBe('ok|familiar|false|false')
  })

  it('falha nos vínculos: erro, mas mantém o perfil conhecido', async () => {
    mockBuscarPerfil.mockResolvedValue({ tipo_perfil: 'cuidador' })
    mockChamarApi.mockRejectedValue(new Error('500'))
    expect(await renderizar()).toBe('erro|cuidador|false|false')
  })

  it('falha no perfil: erro sem perfil, sem buscar vínculos', async () => {
    mockBuscarPerfil.mockRejectedValue(new Error('500'))
    expect(await renderizar()).toBe('erro||false|false')
    expect(mockChamarApi).not.toHaveBeenCalled()
  })

  it('recarregar busca de novo e atualiza o acesso sem voltar a carregando', async () => {
    mockBuscarPerfil.mockResolvedValue({ tipo_perfil: 'cuidador' })
    mockChamarApi.mockResolvedValue({ vinculos: [] })
    function Recarrega() {
      const { recarregar } = useAcesso()
      return <button onClick={() => recarregar?.()}>recarregar</button>
    }
    render(
      <AcessoProvider>
        <Mostra />
        <Recarrega />
      </AcessoProvider>,
    )
    await act(async () => {})
    expect(screen.getByTestId('acesso')).toHaveTextContent('ok|cuidador|false|false')

    let responder: (v: unknown) => void = () => {}
    mockChamarApi.mockReturnValue(new Promise((r) => (responder = r)))
    await userEvent.click(screen.getByRole('button', { name: 'recarregar' }))
    // Durante a nova busca o menu fica como estava (não pisca para "carregando").
    expect(screen.getByTestId('acesso')).toHaveTextContent('ok|cuidador|false|false')
    await act(async () => responder({ vinculos: [vinculo('aprovado')] }))
    expect(screen.getByTestId('acesso')).toHaveTextContent('ok|cuidador|true|false')
    expect(mockBuscarPerfil).toHaveBeenCalledTimes(2)
  })

  it('requisição que nunca responde vira erro depois do timeout', async () => {
    jest.useFakeTimers()
    try {
      mockBuscarPerfil.mockReturnValue(new Promise(() => {}))
      render(
        <AcessoProvider>
          <Mostra />
        </AcessoProvider>,
      )
      await act(async () => {
        jest.advanceTimersByTime(60_001)
      })
      expect(screen.getByTestId('acesso')).toHaveTextContent('erro')
    } finally {
      jest.useRealTimers()
    }
  })
})
