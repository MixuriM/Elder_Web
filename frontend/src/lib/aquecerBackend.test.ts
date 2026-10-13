// Desempenho (2026-10-13, decisão D8). Cada teste carrega o módulo de novo (= carga de página nova).
async function carregar(): Promise<() => void> {
  let f: () => void = () => {}
  await jest.isolateModulesAsync(async () => {
    f = (await import('./aquecerBackend')).aquecerBackend
  })
  return f
}

const chamadasHealth = (f: jest.Mock) => f.mock.calls.filter(([url]) => String(url).endsWith('/health'))

describe('aquecerBackend', () => {
  it('faz um GET /health sem credencial nem token', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true })
    global.fetch = fetchMock
    const aquecer = await carregar()
    aquecer()
    expect(chamadasHealth(fetchMock)).toHaveLength(1)
    const [url, opcoes] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`${import.meta.env.VITE_API_URL}/health`)
    expect(opcoes.credentials).toBe('omit')
    expect(opcoes.method ?? 'GET').toBe('GET')
    expect(opcoes.headers).toBeUndefined()
  })

  it('no máximo 1 por carga de página', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true })
    global.fetch = fetchMock
    const aquecer = await carregar()
    aquecer()
    aquecer()
    aquecer()
    expect(chamadasHealth(fetchMock)).toHaveLength(1)
  })

  it('não devolve nada para esperar', async () => {
    global.fetch = jest.fn().mockReturnValue(new Promise(() => {}))
    expect((await carregar())()).toBeUndefined()
  })

  it('falha de rede não vira rejeição solta: a promessa do fetch ganha um catch', async () => {
    const falha = Promise.reject(new TypeError('Failed to fetch'))
    const pegou = jest.spyOn(falha, 'catch')
    global.fetch = jest.fn().mockReturnValue(falha)
    const aquecer = await carregar()
    aquecer()
    expect(pegou).toHaveBeenCalled()
    await expect(pegou.mock.results[0].value).resolves.toBeUndefined()
  })

  it('sem fetch disponível (ou erro síncrono) não lança', async () => {
    global.fetch = jest.fn(() => {
      throw new Error('sem rede')
    })
    const aquecer = await carregar()
    expect(() => aquecer()).not.toThrow()
  })
})
