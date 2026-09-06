import "dotenv/config";
import express, { type ErrorRequestHandler } from 'express'
import cors from 'cors'
import authRouter from './routes/auth'

const app = express()

app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:5173' }))
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use('/auth', authRouter)

const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  console.error(err)
  if (res.headersSent) {
    return next(err)
  }
  res.status(500).json({ error: 'Erro interno.' })
}
app.use(errorHandler)

export default app
