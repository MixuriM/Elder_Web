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
