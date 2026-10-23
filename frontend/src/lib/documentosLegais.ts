
/**
 * Configurações dos documentos legais do Elder Web.
 *
 * Ao alterar dados coletados, provedores ou armazenamento,
 * revise os documentos e atualize VERSAO_DOCUMENTOS.
 *
 * O aceite é registrado no servidor durante o cadastro
 * e no vínculo do idoso, com data, hora e versão.
 */

// ==========================================
// VERSÃO DOS DOCUMENTOS
// ==========================================

export const VERSAO_DOCUMENTOS = '1.2'

export const DATA_ATUALIZACAO = '20 de outubro de 2026'

// ==========================================
// CONTATO DE SUPORTE
// ==========================================

export const EMAIL_SUPORTE = 'elder.web.suporte@gmail.com'

// ==========================================
// DOCUMENTOS LEGAIS
// ==========================================

export const DOCUMENTOS_LEGAIS = [
  {
    caminho: '/privacidade',
    titulo: 'Política de Privacidade',
  },
  {
    caminho: '/termos',
    titulo: 'Termos de Uso',
  },
  {
    caminho: '/cookies',
    titulo: 'Política de Cookies',
  },
] as const

// ==========================================
// TERMOS E CONSENTIMENTO
// ==========================================

export const TEXTO_ACEITE_TERMOS =
  'Li e concordo com os Termos de Uso e com a Política de Privacidade.'

export const TEXTO_CONSENTIMENTO_SAUDE =
  'Consinto com o uso dos dados de saúde que eu cadastrar, para as finalidades descritas na Política de Privacidade. Se eu cadastrar dados de outra pessoa, declaro ter autorização dela ou de quem a representa legalmente.'

export const MENSAGEM_ACEITE =
  'Marque as duas caixas para criar a conta.'

// ==========================================
// LINKS EXTERNOS
// ==========================================

export const URL_PRIVACIDADE_GOOGLE =
  'https://policies.google.com/privacy'

export const URL_PRIVACIDADE_FIREBASE =
  'https://firebase.google.com/support/privacy'
