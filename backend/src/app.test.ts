import request from 'supertest'

// app.ts importa authRouter incondicionalmente, que por sua vez importa o SDK
// do Firebase Admin — cuja dependência transitiva `jose` é ESM puro e quebra
// o parse do Jest. Mockado aqui porque este teste não exercita rota de auth.
jest.mock('./lib/firebaseAdmin', () => ({ auth: {} }))

import app from './app'

describe('GET /health', () => {
  it('responde 200 com status ok', async () => {
    const res = await request(app).get('/health')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok' })
  })
})
