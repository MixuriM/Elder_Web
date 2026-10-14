import type { RequestHandler } from 'express'

// Decisão D2 de 2026-10-14, sem helmet. A API só responde JSON e PDF: nada nela deve ser embutido em frame, ter o
// tipo adivinhado pelo navegador, vazar a URL de origem nem pedir câmera, microfone ou localização. Sem Cache-Control
// (decisão de desempenho: só o ETag do Express).
export const CABECALHOS_SEGURANCA: Readonly<Record<string, string>> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
}

export const cabecalhosSeguranca: RequestHandler = (_req, res, next) => {
  for (const [nome, valor] of Object.entries(CABECALHOS_SEGURANCA)) res.setHeader(nome, valor)
  next()
}
