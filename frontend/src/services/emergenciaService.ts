import { chamarApi } from '../lib/chamarApi'

// POST /emergencia/avisar (RF novo, número a definir pelo grupo). O resultado vira um tipo fixo:
// a tela escolhe o texto pelo tipo e nunca mostra o texto que veio do servidor.
// naoConfirmados: pessoas vinculadas que não receberam porque o e-mail ainda não foi confirmado.
export type ResultadoAviso =
  | { tipo: 'enviado'; avisados: number; total: number; naoConfirmados: number }
  | { tipo: 'nao_confirmados'; naoConfirmados: number }
  | { tipo: 'sem_vinculo' | 'limite' | 'indisponivel' | 'falha' }

export async function avisarEmergencia(): Promise<ResultadoAviso> {
  try {
    const corpo = await chamarApi('/emergencia/avisar', { method: 'POST' })
    const avisados = Number(corpo?.avisados)
    const tentados = avisados + Number(corpo?.falharam)
    const naoConfirmados = Number(corpo?.nao_confirmados ?? 0)
    if (![avisados, tentados, naoConfirmados].every(Number.isInteger)) return { tipo: 'falha' }
    if (tentados === 0) return naoConfirmados > 0 ? { tipo: 'nao_confirmados', naoConfirmados } : { tipo: 'sem_vinculo' }
    return avisados > 0
      ? { tipo: 'enviado', avisados, total: tentados + naoConfirmados, naoConfirmados }
      : { tipo: 'falha' }
  } catch (e) {
    const status = (e as { status?: number }).status
    if (status === 429) return { tipo: 'limite' }
    if (status === 503) return { tipo: 'indisponivel' }
    return { tipo: 'falha' }
  }
}
