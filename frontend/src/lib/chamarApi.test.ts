import { chamarApi } from './chamarApi'

jest.mock('./auth', () => ({ getCurrentUserToken: jest.fn().mockResolvedValue('token-fake') }))

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
