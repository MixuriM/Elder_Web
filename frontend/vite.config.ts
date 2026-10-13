import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Firebase e React em chunks próprios: mudam só quando a dependência muda, então um deploy que mexe só no
// código do app não obriga quem volta ao site a baixar de novo ~92 kB gzip de bibliotecas (medição de
// 2026-10-13 em docs/historico-implementacao.md). A carga inicial fica do mesmo tamanho.
function vendor(id: string) {
  if (!id.includes('node_modules')) return undefined
  if (/node_modules[\\/](firebase|@firebase|idb)[\\/]/.test(id)) return 'vendor-firebase'
  if (/node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) return 'vendor-react'
  return undefined
}

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: { manualChunks: vendor },
    },
  },
  server: {
    watch: {
      // Polling custa ~20% de um núcleo o tempo todo com o dev server parado (medido em 2026-10-13). Fica ligado
      // por padrão; DEV_POLLING=nao desliga onde o observador de arquivos nativo funciona.
      usePolling: process.env.DEV_POLLING !== 'nao',
    },
  },
})
