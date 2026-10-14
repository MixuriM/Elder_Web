/**
 * @jest-environment node
 */
// O tsconfig de teste não carrega os tipos do Node (conflitam com src/test-globals.d.ts): só o necessário aqui.
declare const require: (modulo: string) => unknown
declare const __dirname: string
const { readFileSync } = require('fs') as { readFileSync(caminho: string, codificacao: 'utf8'): string }
const { join } = require('path') as { join(...partes: string[]): string }

// D6 (2026-10-14): cabeçalhos de segurança do frontend no vercel.json. A CSP que não pode quebrar o login vai em
// Content-Security-Policy; a CSP completa vai em Content-Security-Policy-Report-Only até o Marcos validar em produção
// (docs/checklist-seguranca-producao.md, item 11). O script de preferências saiu do index.html para não exigir
// 'unsafe-inline' em script-src.
const RAIZ = join(__dirname, '..', '..')
type Vercel = {
  rewrites?: { source: string; destination: string }[]
  headers?: { source: string; headers: { key: string; value: string }[] }[]
}
const vercel = JSON.parse(readFileSync(join(RAIZ, 'vercel.json'), 'utf8')) as Vercel
const cabecalhos = Object.fromEntries(
  (vercel.headers?.find((h) => h.source === '/(.*)')?.headers ?? []).map((h) => [h.key, h.value]),
)

const ESPERADOS: Record<string, string> = {
  'Strict-Transport-Security': 'max-age=31536000',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
  'Content-Security-Policy': "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'",
}

const diretivas = (csp: string) =>
  Object.fromEntries(
    csp
      .split(';')
      .map((d) => d.trim().split(/\s+/))
      .filter((p) => p[0])
      .map(([nome, ...valores]) => [nome, valores]),
  ) as Record<string, string[]>

describe('vercel.json: cabeçalhos de segurança', () => {
  it.each(Object.entries(ESPERADOS))('manda %s', (nome, valor) => {
    expect(cabecalhos[nome]).toBe(valor)
  })

  it('mantém o rewrite para index.html', () => {
    expect(vercel.rewrites).toEqual([{ source: '/(.*)', destination: '/index.html' }])
  })

  it('HSTS sem includeSubDomains nem preload (igual à API)', () => {
    expect(cabecalhos['Strict-Transport-Security']).not.toMatch(/includeSubDomains|preload/)
  })

  it('a CSP completa está em modo relatório, com as origens do Firebase e da API', () => {
    const csp = diretivas(cabecalhos['Content-Security-Policy-Report-Only'] ?? '')
    expect(csp['default-src']).toEqual(["'self'"])
    expect(csp['script-src']).toEqual(["'self'", 'https://apis.google.com'])
    expect(csp['style-src']).toEqual(["'self'", "'unsafe-inline'"])
    expect(csp['img-src']).toEqual(["'self'", 'data:', 'blob:'])
    expect(csp['font-src']).toEqual(["'self'"])
    expect(csp['connect-src']).toEqual([
      "'self'",
      'https://elder-web-backend.onrender.com',
      'https://identitytoolkit.googleapis.com',
      'https://securetoken.googleapis.com',
    ])
    expect(csp['frame-src']).toEqual(['https://elder-web.firebaseapp.com'])
    expect(csp['object-src']).toEqual(["'none'"])
    expect(csp['base-uri']).toEqual(["'self'"])
    expect(csp['form-action']).toEqual(["'self'"])
    expect(csp['frame-ancestors']).toEqual(["'none'"])
  })

  it("nenhuma CSP tem 'unsafe-eval', e script-src não tem 'unsafe-inline'", () => {
    for (const nome of ['Content-Security-Policy', 'Content-Security-Policy-Report-Only']) {
      expect(cabecalhos[nome]).not.toContain('unsafe-eval')
      expect(diretivas(cabecalhos[nome] ?? '')['script-src'] ?? []).not.toContain("'unsafe-inline'")
    }
  })
})

describe('index.html sem script inline', () => {
  const html = readFileSync(join(RAIZ, 'index.html'), 'utf8')

  it('todo <script> tem src', () => {
    const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
    expect(scripts.length).toBeGreaterThan(0)
    for (const [, atributos, corpo] of scripts) {
      expect(atributos).toMatch(/\bsrc="/)
      expect(corpo.trim()).toBe('')
    }
  })

  it('carrega /inicio-preferencias.js síncrono no head, antes do app', () => {
    const head = html.slice(0, html.indexOf('</head>'))
    const tag = /<script\b[^>]*src="\/inicio-preferencias\.js"[^>]*>/.exec(head)?.[0] ?? ''
    expect(tag).not.toBe('')
    expect(tag).not.toMatch(/\b(async|defer|type="module")\b/)
  })
})
