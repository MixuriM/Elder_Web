import { getCurrentUserToken } from './auth'
import { MENSAGEM_LIMITE_TAXA } from './limiteTaxa'

type Pedido = { compartilhado: number; resposta: Promise<unknown> }

// GET simples já em voo, por token e caminho. Só deduplica chamadas simultâneas da mesma conta (Avisos e Resumo
// do dia pedem a mesma agenda ao montar): a entrada sai do mapa quando a resposta chega, então nada é guardado
// (sem cache), e outra conta na mesma aba (outro token) nunca recebe a resposta desta.
const emVoo = new Map<string, Pedido>()

async function requisitar(path: string, options: RequestInit, token: string | null) {
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
    // proximo_passo (409 de conflito de e-mail, item 3.2) e status viajam junto do erro: as telas de
    // vínculo escolhem uma mensagem fixa pelo status, sem repetir o corpo.
    // 429 (limite de taxa): sempre a mesma frase, para qualquer tela que mostre a mensagem do erro.
    const mensagem = res.status === 429 ? MENSAGEM_LIMITE_TAXA : (corpo?.error ?? `Falha na requisição: status ${res.status}`)
    throw Object.assign(new Error(mensagem), {
      status: res.status,
      proximo_passo: typeof corpo?.proximo_passo === 'string' ? corpo.proximo_passo : undefined,
    })
  }
  return corpo
}

export async function chamarApi(path: string, options: RequestInit = {}) {
  const token = await getCurrentUserToken()
  const simples = (options.method ?? 'GET').toUpperCase() === 'GET' && options.body == null && options.headers == null && options.signal == null
  if (!simples) {
    // Escrita (ou GET com opções próprias): um GET que comece depois dela não pode receber a resposta de um GET
    // que começou antes e ainda está em voo (traria o estado de antes da ação).
    emVoo.clear()
    return requisitar(path, options, token)
  }

  const chave = `${token}\n${path}`
  let pedido = emVoo.get(chave)
  if (pedido) pedido.compartilhado++
  else {
    const novo: Pedido = { compartilhado: 1, resposta: requisitar(path, options, token).finally(() => emVoo.delete(chave)) }
    emVoo.set(chave, novo)
    pedido = novo
  }
  const corpo = await pedido.resposta
  // Compartilhada: cada chamador recebe a própria cópia, para um não alterar o objeto do outro.
  return pedido.compartilhado > 1 ? JSON.parse(JSON.stringify(corpo)) : corpo
}
