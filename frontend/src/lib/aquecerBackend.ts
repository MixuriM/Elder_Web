// O backend no Render free dorme sem tráfego e leva dezenas de segundos para acordar. Nas telas de entrada
// (landing, login, cadastro) um GET /health em segundo plano acorda o servidor enquanto a pessoa digita.
// Sem credencial, sem esperar, sem mostrar erro e no máximo 1 por carga de página. /health não consulta o
// banco: o Azure SQL ocioso continua coberto pelo retry de backend/src/lib/prisma.ts.
let disparado = false

export function aquecerBackend(): void {
  if (disparado) return
  disparado = true
  try {
    fetch(`${import.meta.env.VITE_API_URL}/health`, { credentials: 'omit' }).catch(() => {})
  } catch {
    // Sem fetch ou erro síncrono: o aquecimento é só uma ajuda, a tela segue igual.
  }
}
