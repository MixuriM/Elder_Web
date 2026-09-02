import "dotenv/config";
import express, { type ErrorRequestHandler } from 'express'
import authRouter from './routes/auth'

const app = express()
const port = process.env.PORT ?? 3000

app.use(express.json())

// CORS mínimo pro frontend Vite em dev (localhost:5173) — sem dependência nova.
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:5173')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use('/auth', authRouter)

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: 'Erro interno.' })
}
app.use(errorHandler)

app.listen(port, () => {
  console.log(`Backend rodando em http://localhost:${port}`)
})