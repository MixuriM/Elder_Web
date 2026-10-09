export function recarregarPagina() {
  window.location.reload()
}

const CHAVE = 'elder-preload-recarregado'

// Depois de um deploy, uma aba antiga pede chunks que não existem mais. O Vite dispara
// `vite:preloadError`: recarrega uma única vez por sessão da aba. Sem sessionStorage
// ou na segunda falha, não cancela o erro e o LimiteErro mostra o botão manual.
export function tratarPreloadError(evento: Event, recarregar = recarregarPagina) {
  try {
    if (sessionStorage.getItem(CHAVE)) return
    sessionStorage.setItem(CHAVE, '1')
  } catch {
    return
  }
  evento.preventDefault()
  recarregar()
}

// Um chunk carregou: o recarregamento anterior resolveu, então o próximo deploy pode recarregar sozinho de novo.
// Só aqui (nunca no boot): se o chunk continua falhando depois do reload, a marca fica e não há loop.
export function carregouChunk<T>(modulo: T): T {
  try {
    sessionStorage.removeItem(CHAVE)
  } catch {
    // sem sessionStorage: não há marca para limpar
  }
  return modulo
}
