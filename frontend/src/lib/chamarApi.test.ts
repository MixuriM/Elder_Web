import { chamarApi } from './chamarApi'

const mockToken = jest.fn().mockResolvedValue('token-fake')
jest.mock('./auth', () => ({ getCurrentUserToken: () => mockToken() }))

function resposta(status: number, corpo: unknown) {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(corpo) } as Response
}

describe('chamarApi: erro carrega o status HTTP', () => {
  it('devolve o corpo em 200', async () => {
    global.fetch = jest.fn().mockResolvedValue(resposta(200, { ok: true }))
    await expect(chamarApi('/x')).resolves.toEqual({ ok: true })
  })

  it('erro tem message do backend, status e proximo_passo', async () => {
    global.fetch = jest.fn().mockResolvedValue(resposta(409, { error: 'Conflito', proximo_passo: 'Faça isto' }))
    await expect(chamarApi('/x')).rejects.toMatchObject({ message: 'Conflito', status: 409, proximo_passo: 'Faça isto' })
  })

  it('corpo sem JSON ainda traz o status', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 502, json: () => Promise.reject(new Error('x')) })
    await expect(chamarApi('/x')).rejects.toMatchObject({ status: 502 })
  })
})

// Desempenho (2026-10-13): GET iguais e simultâneos (Avisos e Resumo do dia pedem a mesma agenda) viram uma
// requisição só. Cada chamador recebe o próprio objeto; nada fica guardado depois da resposta.
describe('chamarApi: GET simultâneos iguais compartilham a requisição', () => {
  function adiada() {
    let responder: (r: Response) => void = () => {}
    const promessa = new Promise<Response>((r) => (responder = r))
    return { promessa, responder }
  }

  it('duas chamadas ao mesmo caminho em voo fazem um fetch só, e cada uma recebe uma cópia', async () => {
    const r = adiada()
    global.fetch = jest.fn().mockReturnValue(r.promessa)
    const a = chamarApi('/agenda', { method: 'GET' })
    const b = chamarApi('/agenda')
    await Promise.resolve()
    await Promise.resolve()
    r.responder(resposta(200, { eventos: [{ id: 1 }] }))
    const [ca, cb] = await Promise.all([a, b])
    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(ca).toEqual({ eventos: [{ id: 1 }] })
    expect(cb).toEqual(ca)
    expect(cb).not.toBe(ca)
    ca.eventos.push({ id: 2 })
    expect(cb.eventos).toHaveLength(1)
  })

  it('depois da resposta, uma chamada nova vai ao servidor de novo (sem cache)', async () => {
    global.fetch = jest.fn().mockResolvedValue(resposta(200, { n: 1 }))
    await chamarApi('/vinculo')
    await chamarApi('/vinculo')
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('caminhos diferentes, POST e GET com corpo ou cabeçalho próprio não são compartilhados', async () => {
    global.fetch = jest.fn().mockImplementation(() => Promise.resolve(resposta(200, {})))
    await Promise.all([
      chamarApi('/vinculo'),
      chamarApi('/vinculo?status=aprovado'),
      chamarApi('/vinculo', { method: 'POST', body: '{}' }),
      chamarApi('/vinculo', { method: 'POST', body: '{}' }),
      chamarApi('/vinculo', { headers: { 'X-Teste': '1' } }),
    ])
    expect(global.fetch).toHaveBeenCalledTimes(5)
  })

  it('erro compartilhado chega aos dois chamadores com o status', async () => {
    const r = adiada()
    global.fetch = jest.fn().mockReturnValue(r.promessa)
    const a = chamarApi('/agenda')
    const b = chamarApi('/agenda')
    await Promise.resolve()
    await Promise.resolve()
    r.responder(resposta(500, { error: 'Erro interno.' }))
    await expect(a).rejects.toMatchObject({ status: 500 })
    await expect(b).rejects.toMatchObject({ status: 500 })
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('troca de conta com a requisição em voo: token diferente não recebe a resposta da outra conta', async () => {
    const r = adiada()
    global.fetch = jest.fn().mockReturnValueOnce(r.promessa).mockResolvedValue(resposta(200, { dono: 'B' }))
    mockToken.mockResolvedValueOnce('token-A').mockResolvedValueOnce('token-B')
    const daContaA = chamarApi('/vinculo')
    await Promise.resolve()
    await Promise.resolve()
    const daContaB = chamarApi('/vinculo')
    await expect(daContaB).resolves.toEqual({ dono: 'B' })
    r.responder(resposta(200, { dono: 'A' }))
    await expect(daContaA).resolves.toEqual({ dono: 'A' })
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it.each(['POST', 'PATCH', 'DELETE'])('escrita no meio do caminho (%s): o GET pedido depois dela não reaproveita o GET que começou antes', async (metodo) => {
    const r = adiada()
    global.fetch = jest
      .fn()
      .mockReturnValueOnce(r.promessa)
      .mockResolvedValueOnce(resposta(200, { ok: true }))
      .mockResolvedValueOnce(resposta(200, { estado: 'depois' }))
    const antes = chamarApi('/vinculo')
    await Promise.resolve()
    await Promise.resolve()
    await chamarApi('/vinculo/1/aprovar', { method: metodo })
    const depois = chamarApi('/vinculo')
    await expect(depois).resolves.toEqual({ estado: 'depois' })
    r.responder(resposta(200, { estado: 'antes' }))
    await expect(antes).resolves.toEqual({ estado: 'antes' })
    expect(global.fetch).toHaveBeenCalledTimes(3)
  })
})

