import { aplicarPreferencias, lerPreferencias, salvarPreferencia } from './preferencias'

function midia(reduzir: boolean, escuro = false) {
  window.matchMedia = ((query: string) => ({
    matches: query.includes('reduced-motion') ? reduzir : query.includes('dark') ? escuro : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia
}

const html = document.documentElement

beforeEach(() => {
  jest.restoreAllMocks()
  localStorage.clear()
  html.className = ''
  midia(false)
})

describe('lerPreferencias', () => {
  it('sem nada salvo: claro, normal e animações conforme o aparelho', () => {
    midia(true)
    expect(lerPreferencias()).toEqual({ tema: 'claro', tamanhoTexto: 'normal', reduzirMovimento: true })
  })

  it('lê o que foi salvo e ignora valor desconhecido', () => {
    localStorage.setItem('tema', 'sistema')
    localStorage.setItem('tamanhoTexto', 'gigante')
    localStorage.setItem('reduzirMovimento', 'nao')
    midia(true)
    expect(lerPreferencias()).toEqual({ tema: 'sistema', tamanhoTexto: 'normal', reduzirMovimento: false })
  })

  it('storage indisponível: devolve o padrão sem lançar', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    expect(lerPreferencias()).toEqual({ tema: 'claro', tamanhoTexto: 'normal', reduzirMovimento: false })
  })
})

describe('aplicarPreferencias', () => {
  it('aplica tema, tamanho do texto e movimento como classes do <html>', () => {
    aplicarPreferencias({ tema: 'escuro', tamanhoTexto: 'muito-grande', reduzirMovimento: true })
    expect(html).toHaveClass('dark', 'texto-muito-grande', 'reduzir-movimento')
    aplicarPreferencias({ tema: 'claro', tamanhoTexto: 'grande', reduzirMovimento: false })
    expect(html).toHaveClass('texto-grande')
    expect(html).not.toHaveClass('dark')
    expect(html).not.toHaveClass('texto-muito-grande')
    expect(html).not.toHaveClass('reduzir-movimento')
  })

  it('tema do sistema segue o aparelho', () => {
    midia(false, true)
    aplicarPreferencias({ tema: 'sistema', tamanhoTexto: 'normal', reduzirMovimento: false })
    expect(html).toHaveClass('dark')
  })
})

describe('salvarPreferencia', () => {
  it('grava, aplica e avisa os ouvintes', () => {
    const ouvinte = jest.fn()
    window.addEventListener('elder:preferencias', ouvinte)
    expect(salvarPreferencia('tema', 'escuro')).toBe(true)
    window.removeEventListener('elder:preferencias', ouvinte)
    expect(localStorage.getItem('tema')).toBe('escuro')
    expect(html).toHaveClass('dark')
    expect(ouvinte).toHaveBeenCalledTimes(1)
  })

  it('storage indisponível: aplica mesmo assim, devolve false e lembra até fechar a página', () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('cheio')
    })
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    expect(salvarPreferencia('tamanhoTexto', 'grande')).toBe(false)
    expect(html).toHaveClass('texto-grande')
    expect(lerPreferencias().tamanhoTexto).toBe('grande')
  })
})
