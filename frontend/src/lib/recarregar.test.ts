import { tratarPreloadError } from './recarregar'

describe('tratarPreloadError', () => {
  beforeEach(() => sessionStorage.clear())

  it('na primeira falha cancela o erro e recarrega uma vez', () => {
    const recarregar = jest.fn()
    const evento = new Event('vite:preloadError', { cancelable: true })

    tratarPreloadError(evento, recarregar)

    expect(evento.defaultPrevented).toBe(true)
    expect(recarregar).toHaveBeenCalledTimes(1)
  })

  it('na segunda falha da mesma sessão não recarrega (sem loop)', () => {
    const recarregar = jest.fn()

    tratarPreloadError(new Event('vite:preloadError', { cancelable: true }), recarregar)
    const segundo = new Event('vite:preloadError', { cancelable: true })
    tratarPreloadError(segundo, recarregar)

    expect(recarregar).toHaveBeenCalledTimes(1)
    expect(segundo.defaultPrevented).toBe(false)
  })

  it('sem sessionStorage não recarrega (evita loop)', () => {
    const recarregar = jest.fn()
    const getItem = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })

    const evento = new Event('vite:preloadError', { cancelable: true })
    tratarPreloadError(evento, recarregar)

    expect(recarregar).not.toHaveBeenCalled()
    expect(evento.defaultPrevented).toBe(false)
    getItem.mockRestore()
  })
})
