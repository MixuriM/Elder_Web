import '@testing-library/jest-dom'

import { act, renderHook, waitFor } from '@testing-library/react'

import { useIdososVinculados } from './useIdososVinculados'

const mockBuscarPerfil = jest.fn()
const mockChamarApi = jest.fn()

jest.mock('../services/perfilService', () => ({
  buscarPerfil: (...args: unknown[]) => mockBuscarPerfil(...args),
}))

jest.mock('../lib/chamarApi', () => ({
  chamarApi: (...args: unknown[]) => mockChamarApi(...args),
}))

function vinculo(
  id: number | null,
  nome: string | null,
  email: string | null = 'a***@mail.com',
  status = 'aprovado',
) {
  return {
    status,
    idoso: { id, nome, email_mascarado: email },
  }
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('useIdososVinculados', () => {
  it('perfil idoso: não chama /vinculo e não precisa de seletor', async () => {
    mockBuscarPerfil.mockResolvedValue({ tipo_perfil: 'idoso' })

    const { result } = renderHook(() => useIdososVinculados())

    await waitFor(() => expect(result.current.estado).toBe('ok'))

    expect(result.current.ehIdoso).toBe(true)
    expect(result.current.idosos).toEqual([])
    expect(result.current.bloqueado).toBe(false)
    expect(mockChamarApi).not.toHaveBeenCalled()
  })

  it('familiar: busca vínculos aprovados e deduplica por idoso.id', async () => {
    mockBuscarPerfil.mockResolvedValue({ tipo_perfil: 'familiar' })
    mockChamarApi.mockResolvedValue({
      vinculos: [
        vinculo(7, 'Dona Ana'),
        vinculo(7, 'Dona Ana'),
        vinculo(9, 'Seu João', null),
      ],
    })

    const { result } = renderHook(() => useIdososVinculados())

    await waitFor(() => expect(result.current.estado).toBe('ok'))

    expect(mockChamarApi).toHaveBeenCalledWith(
      '/vinculo?status=aprovado',
      { method: 'GET' },
    )
    expect(result.current.ehIdoso).toBe(false)
    expect(result.current.idosos).toEqual([
      { id: 7, nome: 'Dona Ana', email_mascarado: 'a***@mail.com' },
      { id: 9, nome: 'Seu João', email_mascarado: null },
    ])
    expect(result.current.bloqueado).toBe(false)
  })

  it('ignora vínculo com idoso oculto (id null) e vínculo não aprovado', async () => {
    mockBuscarPerfil.mockResolvedValue({ tipo_perfil: 'cuidador' })
    mockChamarApi.mockResolvedValue({
      vinculos: [
        vinculo(null, null, null),
        vinculo(3, 'Pendente', null, 'pendente'),
        vinculo(4, 'Aprovado'),
      ],
    })

    const { result } = renderHook(() => useIdososVinculados())

    await waitFor(() => expect(result.current.estado).toBe('ok'))

    expect(result.current.idosos.map((i) => i.id)).toEqual([4])
  })

  it('zero idosos: bloqueia o envio', async () => {
    mockBuscarPerfil.mockResolvedValue({ tipo_perfil: 'cuidador' })
    mockChamarApi.mockResolvedValue({ vinculos: [] })

    const { result } = renderHook(() => useIdososVinculados())

    await waitFor(() => expect(result.current.estado).toBe('ok'))

    expect(result.current.idosos).toEqual([])
    expect(result.current.bloqueado).toBe(true)
  })

  it('começa carregando e bloqueado', async () => {
    let liberar: (v: unknown) => void = () => {}
    mockBuscarPerfil.mockReturnValue(
      new Promise((resolve) => {
        liberar = resolve
      }),
    )

    const { result } = renderHook(() => useIdososVinculados())

    expect(result.current.estado).toBe('carregando')
    expect(result.current.bloqueado).toBe(true)

    // Termina a busca para não deixar promise em voo vazar para os próximos testes (módulo compartilha).
    liberar({ tipo_perfil: 'idoso' })
    await waitFor(() => expect(result.current.estado).toBe('ok'))
  })

  it('falha no perfil: estado erro e bloqueado', async () => {
    mockBuscarPerfil.mockRejectedValue(new Error('x'))

    const { result } = renderHook(() => useIdososVinculados())

    await waitFor(() => expect(result.current.estado).toBe('erro'))

    expect(result.current.bloqueado).toBe(true)
  })

  it('falha em /vinculo: estado erro', async () => {
    mockBuscarPerfil.mockResolvedValue({ tipo_perfil: 'familiar' })
    mockChamarApi.mockRejectedValue(new Error('x'))

    const { result } = renderHook(() => useIdososVinculados())

    await waitFor(() => expect(result.current.estado).toBe('erro'))
  })

  it('usos simultâneos na mesma página compartilham uma única busca', async () => {
    mockBuscarPerfil.mockResolvedValue({ tipo_perfil: 'familiar' })
    mockChamarApi.mockResolvedValue({ vinculos: [vinculo(1, 'A')] })

    const a = renderHook(() => useIdososVinculados())
    const b = renderHook(() => useIdososVinculados())

    await waitFor(() => expect(a.result.current.estado).toBe('ok'))
    await waitFor(() => expect(b.result.current.estado).toBe('ok'))

    expect(mockBuscarPerfil).toHaveBeenCalledTimes(1)
    expect(mockChamarApi).toHaveBeenCalledTimes(1)
  })

  it('nova montagem depois da busca terminar refaz a busca (vínculo novo aparece)', async () => {
    mockBuscarPerfil.mockResolvedValue({ tipo_perfil: 'familiar' })
    mockChamarApi.mockResolvedValueOnce({ vinculos: [vinculo(1, 'A')] })

    const primeira = renderHook(() => useIdososVinculados())
    await waitFor(() => expect(primeira.result.current.estado).toBe('ok'))
    primeira.unmount()

    mockChamarApi.mockResolvedValueOnce({
      vinculos: [vinculo(1, 'A'), vinculo(2, 'B')],
    })

    const segunda = renderHook(() => useIdososVinculados())
    await waitFor(() => expect(segunda.result.current.estado).toBe('ok'))

    expect(mockChamarApi).toHaveBeenCalledTimes(2)
    expect(segunda.result.current.idosos.map((i) => i.id)).toEqual([1, 2])
  })

  it('requisição que nunca responde: vira erro após o limite e a próxima montagem refaz a busca', async () => {
    jest.useFakeTimers()
    try {
      mockBuscarPerfil.mockReturnValue(new Promise(() => {}))

      const travada = renderHook(() => useIdososVinculados())
      expect(travada.result.current.estado).toBe('carregando')

      await act(async () => {
        jest.advanceTimersByTime(60_000)
      })

      expect(travada.result.current.estado).toBe('erro')
      expect(travada.result.current.bloqueado).toBe(true)
      travada.unmount()

      mockBuscarPerfil.mockResolvedValue({ tipo_perfil: 'idoso' })

      const nova = renderHook(() => useIdososVinculados())
      await waitFor(() => expect(nova.result.current.estado).toBe('ok'))
      expect(mockBuscarPerfil).toHaveBeenCalledTimes(2)
    } finally {
      jest.useRealTimers()
    }
  })
})
