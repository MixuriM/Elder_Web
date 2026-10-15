// Documentos legais (Privacidade, Termos, Cookies) e textos do aceite no cadastro.
// Mudou dado coletado, provedor ou armazenamento do navegador: atualize as páginas e suba VERSAO_DOCUMENTOS.
// O aceite é gravado no servidor no cadastro e no anexo do idoso (D9, 2026-10-14): data, hora e esta versão.

export const VERSAO_DOCUMENTOS = '1.1'
export const DATA_ATUALIZACAO = '14 de outubro de 2026'

// Canal de suporte e de pedidos sobre dados pessoais (o mesmo das Orientações).
export const EMAIL_SUPORTE = 'elder.web.suporte@gmail.com'

export const DOCUMENTOS_LEGAIS = [
  { caminho: '/privacidade', titulo: 'Política de Privacidade' },
  { caminho: '/termos', titulo: 'Termos de Uso' },
  { caminho: '/cookies', titulo: 'Política de Cookies' },
] as const

export const TEXTO_ACEITE_TERMOS = 'Li e concordo com os Termos de Uso e com a Política de Privacidade.'
export const TEXTO_CONSENTIMENTO_SAUDE =
  'Consinto com o uso dos dados de saúde que eu cadastrar, para as finalidades descritas na Política de Privacidade. Se eu cadastrar dados de outra pessoa, declaro ter autorização dela ou de quem a representa legalmente.'
export const MENSAGEM_ACEITE = 'Marque as duas caixas para criar a conta.'

// Únicos links externos dos documentos.
export const URL_PRIVACIDADE_GOOGLE = 'https://policies.google.com/privacy'
export const URL_PRIVACIDADE_FIREBASE = 'https://firebase.google.com/support/privacy'
