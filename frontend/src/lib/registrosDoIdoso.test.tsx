import { act, renderHook, waitFor } from '@testing-library/react'

import type { IdososVinculados } from '../hooks/useIdososVinculados'
import { caminhoRegistro, useRegistrosDoIdoso } from './registrosDoIdoso'

const mockChamarApi = jest.fn()
jest.mock('./chamarApi', () => ({ chamarApi: (...a: unknown[]) => mockChamarApi(...a) }))

const SOU_IDOSO: IdososVinculados = { estado: 'ok', ehIdoso: true, idosos: [], bloqueado: false }
const TERCEIRO: IdososVinculados = {
  estado: 'ok',
  ehIdoso: false,
  tipoPerfil: 'familiar',
  idosos: [
    { id: 5, nome: 'Idoso Cinco', email_mascarado: null },
    { id: 6, nome: 'Idoso Seis', email_mascarado: null },
  ],
  bloqueado: false,
}

const mensagemErro = (err: unknown) => ((err as { status?: number }).status === 403 ? 'sem permissão' : 'falhou')

function usar(idosos: IdososVinculados, idosoId: string, versao = 0) {
  return renderHook(
    (p: { idosos: IdososVinculados; idosoId: string; versao: number }) =>
      useRegistrosDoIdoso<{ id: number }>({ base: '/saude', mensagemErro, ...p }),
    { initialProps: { idosos, idosoId, versao } },
  )
}

function adiavel<T>() {
  let resolver: (v: T) => void = () => {}
  const promessa = new Promise<T>((r) => (resolver = r))
  return { promessa, resolver }
}

beforeEach(() => {
  mockChamarApi.mockReset()
})

describe('caminhoRegistro', () => {
  it('idoso usa /base/:id; terceiro usa /base/idoso/:idosoId/:id', () => {
    expect(caminhoRegistro('/saude', true, '', 9)).toBe('/saude/9')
    expect(caminhoRegistro('/alimentacao', false, '5', 9)).toBe('/alimentacao/idoso/5/9')
  })
})

describe('useRegistrosDoIdoso', () => {
  it('idoso: carrega sozinho ao montar, pelo caminho sem id', async () => {
    mockChamarApi.mockResolvedValue({ registros: [{ id: 1 }] })

    const { result } = usar(SOU_IDOSO, '')

    expect(result.current.fase).toBe('carregando')
    await waitFor(() => expect(result.current.fase).toBe('ok'))
    expect(result.current.registros).toEqual([{ id: 1 }])
    expect(mockChamarApi).toHaveBeenCalledWith('/saude', { method: 'GET' })
  })

  it('terceiro sem idoso escolhido: aguarda e não chama a API', () => {
    const { result } = usar(TERCEIRO, '')

    expect(result.current.fase).toBe('aguardando')
    expect(mockChamarApi).not.toHaveBeenCalled()
  })

  it('enquanto os idosos vinculados carregam: aguarda', () => {
    const { result } = usar({ estado: 'carregando', ehIdoso: false, idosos: [], bloqueado: true }, '')

    expect(result.current.fase).toBe('aguardando')
    expect(mockChamarApi).not.toHaveBeenCalled()
  })

  it('terceiro com idoso escolhido: carrega pelo caminho do idoso', async () => {
    mockChamarApi.mockResolvedValue({ registros: [] })

    const { result } = usar(TERCEIRO, '5')

    await waitFor(() => expect(result.current.fase).toBe('ok'))
    expect(mockChamarApi).toHaveBeenCalledWith('/saude/idoso/5', { method: 'GET' })
    expect(result.current.registros).toEqual([])
  })

  it('trocar de idoso recarrega e descarta a resposta atrasada da escolha anterior', async () => {
    const lento = adiavel<unknown>()
    mockChamarApi.mockImplementation((caminho: string) =>
      caminho.endsWith('/5') ? lento.promessa : Promise.resolve({ registros: [{ id: 60 }] }),
    )

    const { result, rerender } = usar(TERCEIRO, '5')
    rerender({ idosos: TERCEIRO, idosoId: '6', versao: 0 })
    await waitFor(() => expect(result.current.registros).toEqual([{ id: 60 }]))

    await act(async () => {
      lento.resolver({ registros: [{ id: 50 }] })
    })

    expect(result.current.registros).toEqual([{ id: 60 }])
  })

  it('enquanto o idoso novo carrega, não mostra a lista do anterior', async () => {
    const segundo = adiavel<unknown>()
    mockChamarApi
      .mockResolvedValueOnce({ registros: [{ id: 50 }] })
      .mockImplementationOnce(() => segundo.promessa)

    const { result, rerender } = usar(TERCEIRO, '5')
    await waitFor(() => expect(result.current.registros).toEqual([{ id: 50 }]))

    rerender({ idosos: TERCEIRO, idosoId: '6', versao: 0 })

    expect(result.current.fase).toBe('carregando')
    expect(result.current.registros).toBeNull()
  })

  it('nova versão recarrega e mantém a lista na tela até a resposta chegar', async () => {
    const recarga = adiavel<unknown>()
    mockChamarApi
      .mockResolvedValueOnce({ registros: [{ id: 1 }] })
      .mockImplementationOnce(() => recarga.promessa)

    const { result, rerender } = usar(SOU_IDOSO, '')
    await waitFor(() => expect(result.current.fase).toBe('ok'))

    rerender({ idosos: SOU_IDOSO, idosoId: '', versao: 1 })

    expect(result.current.fase).toBe('ok')
    expect(result.current.registros).toEqual([{ id: 1 }])

    await act(async () => {
      recarga.resolver({ registros: [{ id: 1 }, { id: 2 }] })
    })
    expect(result.current.registros).toEqual([{ id: 1 }, { id: 2 }])
  })

  it('erro: mensagem escolhida pela tela, sem ecoar o corpo', async () => {
    mockChamarApi.mockRejectedValue(Object.assign(new Error('DADO SENSIVEL'), { status: 403 }))

    const { result } = usar(SOU_IDOSO, '')

    await waitFor(() => expect(result.current.fase).toBe('erro'))
    expect(result.current.erro).toBe('sem permissão')
    expect(result.current.registros).toBeNull()
  })

  it('corpo sem a lista vira erro, nunca lista pela metade', async () => {
    mockChamarApi.mockResolvedValue({ outra: 1 })

    const { result } = usar(SOU_IDOSO, '')

    await waitFor(() => expect(result.current.fase).toBe('erro'))
  })

  it('campo "eventos": lê a lista desse campo do corpo (agenda)', async () => {
    mockChamarApi.mockResolvedValue({ eventos: [{ id: 3 }], registros: [{ id: 99 }] })

    const { result } = renderHook(() =>
      useRegistrosDoIdoso<{ id: number }>({
        base: '/agenda',
        campo: 'eventos',
        idosos: SOU_IDOSO,
        idosoId: '',
        versao: 0,
        mensagemErro,
      }),
    )

    await waitFor(() => expect(result.current.fase).toBe('ok'))
    expect(result.current.registros).toEqual([{ id: 3 }])
    expect(mockChamarApi).toHaveBeenCalledWith('/agenda', { method: 'GET' })
  })

  it('transformar que lança (dado inválido) vira erro e não lista nada', async () => {
    mockChamarApi.mockResolvedValue({ registros: [{ id: 1 }] })

    const { result } = renderHook(() =>
      useRegistrosDoIdoso<{ id: number }>({
        base: '/saude',
        idosos: SOU_IDOSO,
        idosoId: '',
        versao: 0,
        mensagemErro,
        transformar: () => {
          throw new RangeError('x')
        },
      }),
    )

    await waitFor(() => expect(result.current.fase).toBe('erro'))
    expect(result.current.registros).toBeNull()
  })
})
