import tls from 'node:tls'
import type { SondaHttp } from './segurancaTransporte'

// Item 9.2 (RNF-002): sondas de rede, só leitura. Nada aqui devolve corpo de resposta, cabeçalho
// além de Location, token nem mensagem bruta de erro: só status, Location e códigos fixos.

// Lê só status e Location, nunca o corpo (o corpo é descartado). redirect: 'manual' para ver o 3xx em
// vez de seguir até o HTTPS. Timeout é erro à parte ('TIMEOUT'): não prova que a porta está recusada.
export async function sondarHttpPlano(url: string, opcoes: { timeoutMs: number }): Promise<SondaHttp> {
  try {
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(opcoes.timeoutMs) })
    void res.body?.cancel().catch(() => undefined)
    return { status: res.status, location: res.headers.get('location') }
  } catch (e) {
    // Pelo name, não por instanceof: o DOMException do AbortSignal pode vir de outro realm (Jest).
    if ((e as { name?: unknown } | null)?.name === 'TimeoutError') return { erro: 'TIMEOUT' }
    const code = (e as { cause?: { code?: unknown } } | null)?.cause?.code
    return { erro: typeof code === 'string' ? code : 'DESCONHECIDO' }
  }
}

const MS_POR_DIA = 86_400_000
const TIMEOUT_TLS_MS = 30_000

// Abre a conexão TLS só para ler protocolo e validade; não envia dado. A verificação do certificado fica
// no padrão do Node: certificado inválido, vencido ou de outro host rejeita com o código do erro (por
// exemplo CERT_HAS_EXPIRED), que o script mostra no check. Com NODE_TLS_REJECT_UNAUTHORIZED=0 o ambiente
// já desliga essa verificação, então a sonda se recusa a rodar.
export function sondarTls(
  host: string,
  porta: number,
): Promise<{ protocolo: string; autorizado: boolean; venceEmDias: number }> {
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
    return Promise.reject(new Error('NODE_TLS_REJECT_UNAUTHORIZED=0 definido: sonda de TLS recusada.'))
  }
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host, port: porta, servername: host }, () => {
      const validoAte = Date.parse(socket.getPeerCertificate().valid_to)
      const resultado = {
        protocolo: socket.getProtocol() ?? '',
        autorizado: socket.authorized, // true: sem a verificação padrão a conexão nem chega aqui
        venceEmDias: Number.isNaN(validoAte) ? -1 : Math.floor((validoAte - Date.now()) / MS_POR_DIA),
      }
      socket.end()
      resolve(resultado)
    })
    socket.setTimeout(TIMEOUT_TLS_MS, () => {
      socket.destroy()
      reject(new Error('Timeout na conexão TLS.'))
    })
    // Mensagem fixa: o erro bruto não sai daqui.
    socket.on('error', (e: NodeJS.ErrnoException) => reject(new Error(`Falha na conexão TLS (${e.code ?? 'desconhecido'}).`)))
  })
}
