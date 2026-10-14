/**
 * @jest-environment node
 */
// O tsconfig de teste não carrega os tipos do Node (conflitam com src/test-globals.d.ts): só o necessário aqui.
declare const require: (modulo: string) => unknown
declare const __dirname: string
type Fs = {
  readdirSync(caminho: string): string[]
  readFileSync(caminho: string, codificacao: 'utf8'): string
  statSync(caminho: string): { isDirectory(): boolean }
}
type Path = { join(...partes: string[]): string; relative(de: string, para: string): string; sep: string }
const { readdirSync, readFileSync, statSync } = require('fs') as Fs
const { join, relative, sep } = require('path') as Path

// A página /cookies lista tudo o que o Elder Web guarda no navegador. Código novo que usa cookie ou storage fora
// destes arquivos derruba este teste: documente a chave em pages/Cookies.tsx e suba VERSAO_DOCUMENTOS antes de
// incluir o arquivo aqui.
const PERMITIDOS = ['lib/preferencias.ts', 'contexts/FotoPerfilContext.tsx', 'lib/recarregar.ts']

const SRC = join(__dirname, '..')
const USO = /\b(?:localStorage|sessionStorage|indexedDB)\s*\.|\bdocument\s*\.\s*cookie\b/

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) return arquivos(caminho)
    return /\.(ts|tsx)$/.test(nome) && !/\.test\.tsx?$/.test(nome) ? [caminho] : []
  })
}

describe('armazenamento no navegador documentado na página de cookies', () => {
  it('só os arquivos conhecidos usam storage, e ninguém usa document.cookie', () => {
    const achados = arquivos(SRC)
      .filter((f) => USO.test(readFileSync(f, 'utf8')))
      .map((f) => relative(SRC, f).split(sep).join('/'))
    expect(achados.sort()).toEqual([...PERMITIDOS].sort())
  })

  it('index.html só lê as preferências (as mesmas chaves de lib/preferencias.ts)', () => {
    const html = readFileSync(join(SRC, '..', 'index.html'), 'utf8')
    expect(html).not.toMatch(/document\s*\.\s*cookie|sessionStorage|indexedDB/)
    expect(html.match(/localStorage\.\w+/g)).toEqual(['localStorage.getItem'])
    expect([...html.matchAll(/ler\("(\w+)"\)/g)].map((m) => m[1])).toEqual(['tema', 'tamanhoTexto', 'reduzirMovimento'])
  })

  it('nenhum script ou folha de estilo externa no index.html', () => {
    const html = readFileSync(join(SRC, '..', 'index.html'), 'utf8')
    expect(html).not.toMatch(/<script[^>]+src="https?:/)
    expect(html).not.toMatch(/<link[^>]+rel="stylesheet"[^>]+href="https?:/)
  })
})

export {}
