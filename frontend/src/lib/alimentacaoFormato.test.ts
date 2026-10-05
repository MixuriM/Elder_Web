// tsconfig.test.json não carrega @types/node (e ele conflita com test-globals.d.ts): tipos mínimos locais.
declare const process: { execPath: string; version: string; env: Record<string, string | undefined> }
declare const __dirname: string
const { execFileSync } = jest.requireActual<{
  execFileSync: (cmd: string, args: string[], opts: { env: Record<string, string | undefined>; encoding: 'utf8' }) => string
}>('node:child_process')
const { join } = jest.requireActual<{ join: (...partes: string[]) => string }>('node:path')
const { pathToFileURL } = jest.requireActual<{ pathToFileURL: (p: string) => { href: string } }>('node:url')
import { formatarDataHora, rotuloRefeicao } from './alimentacaoFormato'

// Item 7.2 (RF-019): formatar data e hora e rótulo de refeição do histórico alimentar, em America/Sao_Paulo.
// Todos os dados são FICTÍCIOS. O fuso do processo/navegador nunca pode influir: a matriz de TZ abaixo prova isso
// (fake timers NÃO mudam fuso, só o relógio).

const MSG_DATA = 'Data inválida no histórico alimentar.'
const MSG_REFEICAO = 'Refeição desconhecida no histórico alimentar.'

// Instantes e o texto esperado em São Paulo (UTC-3, sem horário de verão).
const CASOS_DATA: [string, string][] = [
  ['2026-10-05T12:00:00.000Z', '05/10/2026 09:00'],
  ['2026-10-06T02:59:59.999Z', '05/10/2026 23:59'], // último milissegundo de 05/10 em SP
  ['2026-10-06T03:00:00.000Z', '06/10/2026 00:00'], // primeiro instante de 06/10 em SP (nunca "24:00")
  ['2027-01-01T02:59:59.999Z', '31/12/2026 23:59'], // virada de ano
  ['2026-10-05T09:00:00-03:00', '05/10/2026 09:00'], // ISO com offset
  ['2099-12-31T23:59:59.987Z', '31/12/2099 20:59'], // plano futuro
  ['2020-01-01T10:00:00.000Z', '01/01/2020 07:00'], // passado distante
]

// F1: resultado idêntico em qualquer fuso do processo. No Jest o process.env é uma cópia: trocar TZ ali não chega
// ao motor de datas. Por isso cada fuso roda num processo node filho com TZ real, executando o próprio
// alimentacaoFormato.ts (type-stripping do Node, sem dependência nova).
const TZS = ['UTC', 'America/Sao_Paulo', 'Asia/Tokyo', 'Pacific/Kiritimati'] as const
// Hora local de 2026-01-01T00:00:00Z em cada fuso: prova que o TZ do filho valeu de fato.
const HORA_LOCAL_DO_CONTROLE: Record<(typeof TZS)[number], number> = {
  UTC: 0,
  'America/Sao_Paulo': 21,
  'Asia/Tokyo': 9,
  'Pacific/Kiritimati': 14,
}

const SCRIPT_FILHO = `
const { formatarDataHora } = await import(process.env.LIB_URL)
const isos = JSON.parse(process.env.ISOS)
console.log(JSON.stringify({
  controle: new Date('2026-01-01T00:00:00Z').getHours(),
  textos: isos.map((iso) => formatarDataHora(iso)),
}))
`

// Type-stripping de .ts sem flag exige Node 22.18 ou superior. Nunca pula em silêncio: falha com mensagem clara.
function nodeSuportaTypeStripping() {
  const [maior, menor] = process.version.replace('v', '').split('.').map(Number)
  return maior > 22 || (maior === 22 && menor >= 18)
}

function rodarNoFuso(tz: string) {
  if (!nodeSuportaTypeStripping()) {
    throw new Error(`O teste de fuso exige Node 22.18 ou superior (type-stripping de .ts); este é o ${process.version}.`)
  }
  const saida = execFileSync(process.execPath, ['--input-type=module', '-e', SCRIPT_FILHO], {
    env: {
      ...process.env,
      TZ: tz,
      LIB_URL: pathToFileURL(join(__dirname, 'alimentacaoFormato.ts')).href,
      ISOS: JSON.stringify(CASOS_DATA.map(([iso]) => iso)),
    },
    encoding: 'utf8',
  })
  return JSON.parse(saida) as { controle: number; textos: string[] }
}

describe('formatarDataHora independe do fuso do processo (F1)', () => {
  const resultados = Object.fromEntries(TZS.map((tz) => [tz, rodarNoFuso(tz)]))

  it.each(TZS)('controle: o TZ do processo filho mudou de fato (%s)', (tz) => {
    expect(resultados[tz].controle).toBe(HORA_LOCAL_DO_CONTROLE[tz])
  })

  it.each(TZS)('com o processo em %s, todos os textos são os de São Paulo', (tz) => {
    expect(resultados[tz].textos).toEqual(CASOS_DATA.map(([, texto]) => texto))
  })
})

describe('formatarDataHora (F2)', () => {
  it.each(CASOS_DATA)('%s vira %p', (iso, texto) => {
    expect(formatarDataHora(iso)).toBe(texto)
  })

  it('bordas de dia: 02:59:59.999Z ainda é o dia anterior e 03:00:00.000Z já é o dia seguinte', () => {
    expect(formatarDataHora('2026-10-06T02:59:59.999Z').slice(0, 10)).toBe('05/10/2026')
    expect(formatarDataHora('2026-10-06T03:00:00.000Z').slice(0, 10)).toBe('06/10/2026')
  })

  it.each(['valor-sigiloso-falso', '', '2026-13-45T99:99:99Z'])(
    'data inválida %p lança RangeError com mensagem fixa que não repete o valor',
    (valor) => {
      expect(() => formatarDataHora(valor)).toThrow(new RangeError(MSG_DATA))
      try {
        formatarDataHora(valor)
      } catch (e) {
        expect(e).toBeInstanceOf(RangeError)
        if (valor) expect((e as Error).message).not.toContain(valor)
      }
    },
  )
})

describe('rotuloRefeicao (F3)', () => {
  it.each([
    ['cafe_manha', 'Café da manhã'],
    ['lanche_manha', 'Lanche da manhã'],
    ['almoco', 'Almoço'],
    ['lanche_tarde', 'Lanche da tarde'],
    ['jantar', 'Jantar'],
    ['ceia', 'Ceia'],
  ])('%p vira %p', (valor, rotulo) => {
    expect(rotuloRefeicao(valor)).toBe(rotulo)
  })

  it.each(['Almoco', 'ALMOCO', ' almoco', 'cafe-manha', '', 'refeicao-sigilosa-falsa', '__proto__', 'toString', 'constructor'])(
    'refeição desconhecida %p lança RangeError com mensagem fixa que não repete o valor',
    (valor) => {
      expect(() => rotuloRefeicao(valor)).toThrow(new RangeError(MSG_REFEICAO))
      try {
        rotuloRefeicao(valor)
      } catch (e) {
        expect(e).toBeInstanceOf(RangeError)
        if (valor.trim()) expect((e as Error).message).not.toContain(valor)
      }
    },
  )
})
