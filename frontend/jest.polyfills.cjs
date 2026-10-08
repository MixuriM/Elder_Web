// jest-environment-jsdom (Jest 30) não expõe TextEncoder/TextDecoder no
// ambiente global — necessário para módulos como react-router-dom que os usam
// no import. Node os tem nativamente, só precisam ser copiados para o global
// do jsdom antes dos testes rodarem.
const { TextEncoder, TextDecoder } = require('node:util')

if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = TextEncoder
}
if (typeof globalThis.TextDecoder === 'undefined') {
  globalThis.TextDecoder = TextDecoder
}

// O babel-plugin-transform-vite-meta-env troca import.meta.env.X por process.env.X. Sem .env (CI), VITE_API_URL
// fica indefinida e baixarPdf lança antes do fetch. Default só preenche se não houver valor.
process.env.VITE_API_URL ??= 'http://localhost:3000'
