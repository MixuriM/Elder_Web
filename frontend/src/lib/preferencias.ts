// Preferências de exibição (tema, tamanho do texto, menos movimento) guardadas no localStorage deste navegador.
// Mesmas chaves e classes do script de index.html, que aplica tudo antes do React montar (sem piscar).
// Todo acesso ao storage fica em try/catch: bloqueado ou cheio, a preferência vale só até fechar a página.

export type Tema = 'claro' | 'escuro' | 'sistema'
export type TamanhoTexto = 'normal' | 'grande' | 'muito-grande'
export type Preferencias = { tema: Tema; tamanhoTexto: TamanhoTexto; reduzirMovimento: boolean }

// Avisa quem mostra a preferência (o BotaoTema do cabeçalho) que ela mudou em outro lugar.
export const EVENTO_PREFERENCIAS = 'elder:preferencias'

const memoria = new Map<string, string>()

function ler(chave: string): string | null {
  try {
    return localStorage.getItem(chave)
  } catch {
    return memoria.get(chave) ?? null
  }
}

function gravar(chave: string, valor: string): boolean {
  memoria.set(chave, valor)
  try {
    localStorage.setItem(chave, valor)
    return true
  } catch {
    return false
  }
}

const midia = (consulta: string) => typeof window.matchMedia === 'function' && window.matchMedia(consulta).matches

export function lerPreferencias(): Preferencias {
  const tema = ler('tema')
  const tamanho = ler('tamanhoTexto')
  const movimento = ler('reduzirMovimento')
  return {
    tema: tema === 'escuro' || tema === 'sistema' ? tema : 'claro',
    tamanhoTexto: tamanho === 'grande' || tamanho === 'muito-grande' ? tamanho : 'normal',
    // Sem escolha salva, segue o aparelho.
    reduzirMovimento: movimento === null ? midia('(prefers-reduced-motion: reduce)') : movimento === 'sim',
  }
}

// ponytail: "sistema" lê o aparelho ao aplicar; trocar o tema do aparelho com o site aberto só vale ao recarregar.
export function aplicarPreferencias(p: Preferencias) {
  const html = document.documentElement
  html.classList.toggle('dark', p.tema === 'escuro' || (p.tema === 'sistema' && midia('(prefers-color-scheme: dark)')))
  html.classList.toggle('texto-grande', p.tamanhoTexto === 'grande')
  html.classList.toggle('texto-muito-grande', p.tamanhoTexto === 'muito-grande')
  html.classList.toggle('reduzir-movimento', p.reduzirMovimento)
}

// Aplica na hora e devolve se conseguiu guardar no navegador.
export function salvarPreferencia<K extends keyof Preferencias>(chave: K, valor: Preferencias[K]): boolean {
  const guardou = gravar(chave, typeof valor === 'boolean' ? (valor ? 'sim' : 'nao') : valor)
  aplicarPreferencias({ ...lerPreferencias(), [chave]: valor })
  window.dispatchEvent(new Event(EVENTO_PREFERENCIAS))
  return guardou
}
