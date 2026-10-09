// Só para testes. Responde por método e rota, não pela ordem das chamadas (evita testes que quebram
// quando a ordem muda). Rota sem resposta combinada vira erro 500, para o teste não passar por acaso.
type Manipulador = (corpo: Record<string, unknown> | undefined) => unknown

export function erroApi(status: number, message = 'texto do corpo', extra: Record<string, unknown> = {}) {
  return Object.assign(new Error(message), { status, ...extra })
}

export function apiFalsa(rotas: Record<string, Manipulador>) {
  return async (caminho: string, opcoes: RequestInit = {}) => {
    const chave = `${opcoes.method ?? 'GET'} ${caminho}`
    const manipulador = rotas[chave]
    if (!manipulador) throw erroApi(500, `rota sem resposta combinada: ${chave}`)
    const corpo = typeof opcoes.body === 'string' ? JSON.parse(opcoes.body) : undefined
    return manipulador(corpo)
  }
}
