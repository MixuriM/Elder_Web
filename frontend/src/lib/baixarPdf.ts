
import { getCurrentUserToken } from './auth'

const NOME_ARQUIVO = 'historico-saude-remedios.pdf'

export async function baixarPdf(path: string): Promise<void> {
  const token = await getCurrentUserToken()

  if (!token) {
    throw new Error(
      'Sua sessão expirou. Entre novamente para baixar o histórico.',
    )
  }

  const apiUrl = import.meta.env.VITE_API_URL

  if (!apiUrl || typeof apiUrl !== 'string') {
    throw new Error(
      'A URL da API não está configurada. Verifique o arquivo .env.',
    )
  }

  const baseUrl = apiUrl.replace(/\/+$/, '')
  const caminho = path.startsWith('/') ? path : `/${path}`

  let resposta: Response

  try {
    resposta = await fetch(`${baseUrl}${caminho}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/pdf',
      },
    })
  } catch {
    throw new Error(
      'Não foi possível conectar ao servidor. Verifique a API, a conexão e as configurações de CORS.',
    )
  }

  if (!resposta.ok) {
    const corpo = await resposta.json().catch(() => null)

    throw new Error(
      typeof corpo?.error === 'string'
        ? corpo.error
        : `Não foi possível gerar o PDF (HTTP ${resposta.status}).`,
    )
  }

  const arquivo = await resposta.blob()

  if (arquivo.size === 0) {
    throw new Error('O servidor retornou um arquivo vazio.')
  }

  const tipo = resposta.headers.get('content-type') ?? ''

  if (!tipo.toLowerCase().includes('application/pdf')) {
    throw new Error(
      'O servidor não retornou um PDF válido.',
    )
  }

  const url = URL.createObjectURL(arquivo)

  try {
    const link = document.createElement('a')

    link.href = url
    link.download = NOME_ARQUIVO

    document.body.appendChild(link)
    link.click()
    link.remove()
  } finally {
    setTimeout(() => {
      URL.revokeObjectURL(url)
    }, 1000)
  }
}
