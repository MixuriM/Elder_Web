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

const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  console.error(err)
  if (res.headersSent) {
    return next(err)
  }
  res.status(500).json({ error: 'Erro interno.' })
}
app.use(errorHandler)

export default app
