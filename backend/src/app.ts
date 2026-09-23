import "dotenv/config";
import express, { type ErrorRequestHandler } from 'express'
import cors from 'cors'
import authRouter from './routes/auth'
import usuarioRouter from './routes/usuario'
import vinculoRouter from './routes/vinculo'
import saudeRouter from './routes/saude'

const app = express()

app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:5173' }))
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use('/auth', authRouter)
app.use('/usuario', usuarioRouter)
app.use('/vinculo', vinculoRouter)
app.use('/saude', saudeRouter)

// Item 4.5 (parcial): loga só name, code, método e path. Nunca o erro inteiro, message,
// stack (começa pela message) nem req.body/req.query: um erro do Prisma carrega os args da
// query, ou seja, valores de RegistroSaude (LGPD Art. 5º, XI). Custo: sem message/stack no
// log, depurar um 500 exige reproduzir o caso.
const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  const info = typeof err === 'object' && err !== null ? (err as { name?: unknown; code?: unknown }) : {}
  console.error('Erro não tratado', {
    name: err instanceof Error && typeof info.name === 'string' ? info.name : typeof err,
    code: typeof info.code === 'string' || typeof info.code === 'number' ? info.code : undefined,
    method: req.method,
    path: req.path,
  })
  if (res.headersSent) {
    return next(err)
  }
  res.status(500).json({ error: 'Erro interno.' })
}
app.use(errorHandler)

export default app
