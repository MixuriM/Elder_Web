import { getCurrentUserToken } from './auth'

// Item 5.4 (RF-014): baixa o PDF do histórico. Não usa chamarApi, que força Content-Type JSON e faz
// res.json(): aqui o corpo é binário. Nunca loga corpo, caminho ou conteúdo (dado de saúde, RNF-001).
const NOME_ARQUIVO = 'historico-saude-remedios.pdf'

export async function baixarPdf(path: string): Promise<void> {
  const token = await getCurrentUserToken()
  // Sem Content-Type: é GET sem corpo, e a resposta não é JSON.
  const res = await fetch(`${import.meta.env.VITE_API_URL}${path}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    // Erro HTTP vem como JSON { error } (mensagem fixa do backend).
    const corpo = await res.json().catch(() => null)
    throw new Error(corpo?.error ?? `Falha na requisição: status ${res.status}`)
  }
  const url = URL.createObjectURL(await res.blob())
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = NOME_ARQUIVO
    document.body.appendChild(link)
    link.click()
    link.remove()
  } finally {
    URL.revokeObjectURL(url)
  }
}
