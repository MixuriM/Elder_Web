import { getCurrentUserToken } from './auth'

export async function chamarApi(path: string, options: RequestInit = {}) {
  const token = await getCurrentUserToken()
  const res = await fetch(`${import.meta.env.VITE_API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })
  const corpo = await res.json().catch(() => null)
  if (!res.ok) {
    // proximo_passo (409 de conflito de e-mail, item 3.2) viaja junto do erro.
    throw Object.assign(new Error(corpo?.error ?? `Falha na requisição: status ${res.status}`), {
      proximo_passo: typeof corpo?.proximo_passo === 'string' ? corpo.proximo_passo : undefined,
    })
  }
  return corpo
}
