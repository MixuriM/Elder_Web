// Item 9.2 (RNF-002): avaliadores puros (sem I/O) de TLS em trânsito e de criptografia em repouso.
// Alimentados pelos scripts smoke-* e por sondaHttp.ts. Nenhum resultado carrega usuário, senha,
// token ou corpo de resposta: só host, status, protocolo e textos fixos.

export type Avaliacao = { ok: boolean; detalhe: string }

// Resposta de uma sonda HTTP simples: status e Location, ou o código do erro de rede.
export type SondaHttp = { status: number; location: string | null } | { erro: string }

const REDIRECTS = [301, 302, 307, 308]
// Porta 80 fechada. Timeout e DNS não provam recusa (o servidor pode estar só lento ou fora do ar).
const ERROS_DE_RECUSA = ['ECONNREFUSED', 'ECONNRESET']

export function avaliarRedirecionamentoHttp(sonda: SondaHttp, hostEsperado: string): Avaliacao {
  if ('erro' in sonda) {
    return ERROS_DE_RECUSA.includes(sonda.erro)
      ? { ok: true, detalhe: `recusado (${sonda.erro})` }
      : { ok: false, detalhe: `erro ${sonda.erro} não prova recusa` }
  }
  if (!REDIRECTS.includes(sonda.status)) return { ok: false, detalhe: `status ${sonda.status} sem redirecionamento` }
  let destino: URL
  try {
    destino = new URL(sonda.location ?? '')
  } catch {
    return { ok: false, detalhe: `status ${sonda.status} sem Location absoluta` }
  }
  if (destino.protocol !== 'https:') return { ok: false, detalhe: `status ${sonda.status} para ${destino.protocol}//` }
  if (destino.hostname.toLowerCase() !== hostEsperado.toLowerCase()) {
    return { ok: false, detalhe: `status ${sonda.status} para outro host (${destino.hostname})` }
  }
  return { ok: true, detalhe: `status ${sonda.status} para https:// do mesmo host` }
}

const PROTOCOLOS_TLS = ['TLSv1.2', 'TLSv1.3']
const MIN_DIAS_CERTIFICADO = 14

export function avaliarTls(t: { protocolo: string; autorizado: boolean; venceEmDias: number }): Avaliacao {
  const falhas: string[] = []
  if (!PROTOCOLOS_TLS.includes(t.protocolo)) falhas.push(`protocolo ${t.protocolo || '(vazio)'} abaixo de TLSv1.2`)
  if (!t.autorizado) falhas.push('certificado não autorizado')
  if (t.venceEmDias < MIN_DIAS_CERTIFICADO) falhas.push(`certificado vence em ${t.venceEmDias} dia(s), mínimo ${MIN_DIAS_CERTIFICADO}`)
  return falhas.length > 0
    ? { ok: false, detalhe: falhas.join('; ') }
    : { ok: true, detalhe: `${t.protocolo}, certificado válido por ${t.venceEmDias} dia(s)` }
}

export type ResultadoUrlBanco = {
  host: string
  encrypt: boolean
  trustServerCertificate: boolean
  ok: boolean
  motivos: string[]
}

const HOSTS_LOCAIS = ['localhost', '127.0.0.1', '::1']
const SUFIXO_AZURE = '.database.windows.net'

// Formato JDBC do Prisma: sqlserver://host:porta;chave=valor;... Valor entre chaves pode conter ';' e
// escapa '}' como '}}'. Devolve só as chaves em minúsculas. Não repassa nada a quem chama além do que
// avaliarUrlBanco filtra: o resultado final nunca inclui user nem password.
function lerParametros(resto: string): Map<string, string> {
  const params = new Map<string, string>()
  let i = 0
  while (i < resto.length) {
    const igual = resto.indexOf('=', i)
    const fimChave = resto.indexOf(';', i)
    if (igual === -1 || (fimChave !== -1 && fimChave < igual)) {
      // Segmento sem '=': descarta até o próximo ';'.
      if (fimChave === -1) break
      i = fimChave + 1
      continue
    }
    const chave = resto.slice(i, igual).trim().toLowerCase()
    i = igual + 1
    let valor = ''
    if (resto[i] === '{') {
      i++
      for (; i < resto.length; i++) {
        if (resto[i] === '}') {
          if (resto[i + 1] === '}') {
            valor += '}'
            i++
            continue
          }
          i++
          break
        }
        valor += resto[i]
      }
      const proximo = resto.indexOf(';', i)
      i = proximo === -1 ? resto.length : proximo + 1
    } else {
      const fim = resto.indexOf(';', i)
      valor = resto.slice(i, fim === -1 ? resto.length : fim)
      i = fim === -1 ? resto.length : fim + 1
    }
    if (!params.has(chave)) params.set(chave, valor.trim())
  }
  return params
}

function lerHost(autoridade: string): string {
  if (autoridade.startsWith('[')) {
    const fim = autoridade.indexOf(']')
    return fim === -1 ? '' : autoridade.slice(1, fim).toLowerCase()
  }
  return autoridade.split(':')[0].trim().toLowerCase()
}

export function avaliarUrlBanco(url: string): ResultadoUrlBanco {
  const m = /^sqlserver:\/\/([^;]*)(?:;(.*))?$/is.exec(url.trim())
  const host = m ? lerHost(m[1]) : ''
  if (!m || !host) {
    return { host: '', encrypt: false, trustServerCertificate: false, ok: false, motivos: ['formato da DATABASE_URL não reconhecido'] }
  }
  const params = lerParametros(m[2] ?? '')
  const encrypt = params.has('encrypt') ? params.get('encrypt')!.toLowerCase() === 'true' : true
  const trustServerCertificate = params.has('trustservercertificate') ? params.get('trustservercertificate')!.toLowerCase() === 'true' : false

  if (HOSTS_LOCAIS.includes(host)) return { host, encrypt, trustServerCertificate, ok: true, motivos: [] }

  const motivos: string[] = []
  let ok = true
  if (!encrypt) {
    ok = false
    motivos.push('encrypt não está true em host não local')
  }
  if (trustServerCertificate) {
    ok = false
    motivos.push('trustServerCertificate=true em host não local')
  }
  if (!host.endsWith(SUFIXO_AZURE)) motivos.push(`aviso: host não termina em ${SUFIXO_AZURE}`)
  return { host, encrypt, trustServerCertificate, ok, motivos }
}

// sys.dm_exec_connections.encrypt_option devolve texto: 'TRUE' ou 'FALSE'.
export function avaliarConexaoCifrada(encryptOption: string | null | undefined): Avaliacao {
  return encryptOption === 'TRUE'
    ? { ok: true, detalhe: 'conexão cifrada (encrypt_option=TRUE)' }
    : { ok: false, detalhe: 'conexão sem cifra ou estado desconhecido' }
}

const ENGINE_AZURE_SQL_DATABASE = 5
const ESTADO_CRIPTOGRAFADO = 3

export function avaliarTde(t: {
  engineEdition: number | null
  isEncrypted: number | null
  encryptionState: number | null
  encryptorType: string | null
}): Avaliacao {
  const falhas: string[] = []
  if (t.engineEdition !== ENGINE_AZURE_SQL_DATABASE) {
    falhas.push(`EngineEdition ${t.engineEdition ?? '(nulo)'} diferente de ${ENGINE_AZURE_SQL_DATABASE}: não é Azure SQL Database`)
  }
  if (t.isEncrypted !== 1) falhas.push('is_encrypted diferente de 1: TDE desligado')
  if (t.encryptionState !== null && t.encryptionState !== ESTADO_CRIPTOGRAFADO) {
    falhas.push(
      t.encryptionState === 2
        ? 'encryption_state 2: criptografia em andamento'
        : `encryption_state ${t.encryptionState} diferente de ${ESTADO_CRIPTOGRAFADO}`,
    )
  }
  if (falhas.length > 0) return { ok: false, detalhe: falhas.join('; ') }

  if (t.encryptionState === null) return { ok: true, detalhe: 'is_encrypted=1; aviso: detalhe da chave indisponível' }
  const chave =
    // Doc da Microsoft: certificate = chave gerenciada pelo serviço; asymmetric key = Azure Key Vault.
    // CERTIFICATE_OAEP_256 (visto no Azure real) não consta na doc: tratado como a mesma família.
    t.encryptorType?.startsWith('CERTIFICATE')
      ? 'chave gerenciada pelo serviço'
      : t.encryptorType === 'ASYMMETRIC KEY'
        ? 'chave do cliente'
        : `protetor ${t.encryptorType ?? '(desconhecido)'}`
  return { ok: true, detalhe: `TDE ativo (encryption_state=3), ${chave}` }
}
