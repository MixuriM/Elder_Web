const mockChamarApi = jest.fn()
jest.mock('../lib/chamarApi', () => ({ chamarApi: (...args: unknown[]) => mockChamarApi(...args) }))
jest.mock('../lib/auth', () => ({ getCurrentUserToken: jest.fn() }))

import { excluirConta } from './perfilService'

describe('excluirConta', () => {
  beforeEach(() => mockChamarApi.mockReset())

  it('chama DELETE /usuario/me com a confirmação EXCLUIR e nada mais', async () => {
    mockChamarApi.mockResolvedValue(null)
    await expect(excluirConta()).resolves.toBeUndefined()
    expect(mockChamarApi).toHaveBeenCalledTimes(1)
    const [caminho, opcoes] = mockChamarApi.mock.calls[0]
    expect(caminho).toBe('/usuario/me')
    expect(opcoes.method).toBe('DELETE')
    expect(JSON.parse(opcoes.body)).toEqual({ confirmacao: 'EXCLUIR' })
  })

  it('o erro da API sobe com status e codigo', async () => {
    mockChamarApi.mockRejectedValue(Object.assign(new Error('Confirme.'), { status: 401, codigo: 'reautenticar' }))
    await expect(excluirConta()).rejects.toMatchObject({ status: 401, codigo: 'reautenticar' })
  })
})
