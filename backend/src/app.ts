import "dotenv/config";
import express, { type ErrorRequestHandler } from 'express'
import cors from 'cors'
import authRouter from './routes/auth'
import usuarioRouter from './routes/usuario'
import vinculoRouter from './routes/vinculo'
import saudeRouter from './routes/saude'
import remediosRouter from './routes/remedios'
import historicoPdfRouter from './routes/historicoPdf'
import agendaRouter from './routes/agenda'
import alimentacaoRouter from './routes/alimentacao'

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
app.use('/remedios', remediosRouter)
app.use('/historico', historicoPdfRouter)
app.use('/agenda', agendaRouter)
app.use('/alimentacao', alimentacaoRouter)

// Item 4.5 (parcial): loga só name, code, método e path. Nunca o erro inteiro, message,
// stack (começa pela message) nem req.body/req.query: um erro do Prisma carrega os args da
// query, ou seja, valores de RegistroSaude (LGPD Art. 5º, XI). Custo: sem message/stack no
// log, depurar um 500 exige reproduzir o caso.
// Quarto parâmetro (_next) é obrigatório: o Express só reconhece handler de erro por aridade 4.
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const info = typeof err === 'object' && err !== null ? (err as { name?: unknown; code?: unknown; type?: unknown }) : {}
  // Erro do body-parser (express.json) é erro do cliente, não do servidor: 4xx fixo, sem eco do corpo (pode
  // ter dado de saúde) e sem log (o erro carrega o trecho do corpo na message). Vem antes do 500 genérico.
  if (info.type === 'entity.parse.failed') return res.status(400).json({ error: 'Corpo da requisição inválido.' })
  if (info.type === 'entity.too.large') return res.status(413).json({ error: 'Corpo da requisição grande demais.' })
  console.error('Erro não tratado', {
    name: err instanceof Error && typeof info.name === 'string' ? info.name : typeof err,
    code: typeof info.code === 'string' || typeof info.code === 'number' ? info.code : undefined,
    method: req.method,
    path: req.path,
  })
  if (res.headersSent) {
    // Não delega ao handler padrão do Express: o logerror dele imprime err.stack (que começa pela
    // message, com os args da query do Prisma) em qualquer NODE_ENV diferente de 'test'.
    // Derrubar o socket é o que o handler padrão faz, sem o log.
    req.socket.destroy()
    return
  }
  res.status(500).json({ error: 'Erro interno.' })
}
app.use(errorHandler)

export default app
