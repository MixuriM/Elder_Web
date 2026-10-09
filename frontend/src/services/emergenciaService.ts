import { chamarApi } from '../lib/chamarApi'

// POST /emergencia/avisar (RF novo, número a definir pelo grupo). O resultado vira um tipo fixo:
// a tela escolhe o texto pelo tipo e nunca mostra o texto que veio do servidor.
export type ResultadoAviso =
  | { tipo: 'enviado'; avisados: number; total: number }
  | { tipo: 'sem_vinculo' | 'limite' | 'indisponivel' | 'falha' }

export async function avisarEmergencia(): Promise<ResultadoAviso> {
  try {
    const corpo = await chamarApi('/emergencia/avisar', { method: 'POST' })
    const avisados = Number(corpo?.avisados)
    const total = avisados + Number(corpo?.falharam)
    if (!Number.isInteger(avisados) || !Number.isInteger(total)) return { tipo: 'falha' }
    if (total === 0) return { tipo: 'sem_vinculo' }
    return avisados > 0 ? { tipo: 'enviado', avisados, total } : { tipo: 'falha' }
  } catch (e) {
    const status = (e as { status?: number }).status
    if (status === 429) return { tipo: 'limite' }
    if (status === 503) return { tipo: 'indisponivel' }
    return { tipo: 'falha' }
  }
}
