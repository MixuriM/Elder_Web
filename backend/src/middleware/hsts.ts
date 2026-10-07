import type { RequestHandler } from 'express'

// Item 9.2 (RNF-002). 1 ano, sem includeSubDomains nem preload (decisão D4). O redirecionamento
// HTTP para HTTPS é do Render, não do código.
export const HSTS_VALOR = 'max-age=31536000'

// NODE_ENV é lido a cada requisição, não no import: fora de produção o header não sai, para não
// fixar HSTS em localhost no navegador do dev.
export const hsts: RequestHandler = (_req, res, next) => {
  if (process.env.NODE_ENV === 'production') res.setHeader('Strict-Transport-Security', HSTS_VALOR)
  next()
}
