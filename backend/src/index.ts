import "dotenv/config";
import express, { type ErrorRequestHandler } from 'express'
import authRouter from './routes/auth'

const app = express()
const port = process.env.PORT ?? 3000

app.use(express.json())

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