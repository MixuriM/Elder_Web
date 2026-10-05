// tsconfig.test.json não carrega @types/node (e ele conflita com test-globals.d.ts): tipos mínimos locais.
declare const process: { execPath: string; version: string; env: Record<string, string | undefined> }
declare const __dirname: string
const { execFileSync } = jest.requireActual<{
  execFileSync: (cmd: string, args: string[], opts: { env: Record<string, string | undefined>; encoding: 'utf8' }) => string
}>('node:child_process')
const { join } = jest.requireActual<{ join: (...partes: string[]) => string }>('node:path')
const { pathToFileURL } = jest.requireActual<{ pathToFileURL: (p: string) => { href: string } }>('node:url')
import { agruparEventosPorDia, formatarIntervalo, rotuloTipo, type EventoAgenda } from './agendaPorDia'

// Item 6.3 (RF-017, RNF-003): agrupar a agenda por dia em America/Sao_Paulo. Todos os dados são FICTÍCIOS.
// O fuso do processo/navegador nunca pode influir: a matriz de process.env.TZ abaixo prova isso (fake timers
// NÃO mudam fuso, só o relógio).

function ev(id: number, inicio: string, fim: string | null = null, over: Partial<EventoAgenda> = {}): EventoAgenda {
  return {
    id,
    tipo_evento: 'pessoal',
    titulo: `titulo-falso-${id}`,
    descricao: null,
    data_hora_inicio: inicio,
    data_hora_fim: fim,
    ...over,
  }
}

const AGORA = new Date('2026-10-05T15:00:00.000Z') // 12:00 em São Paulo, segunda-feira 05/10/2026

afterEach(() => {
  jest.useRealTimers()
})

// U1: resultado idêntico em qualquer fuso do processo. No Jest o process.env é uma cópia: trocar TZ ali não chega
// ao motor de datas (verificado: o controle falha). Por isso cada fuso roda num processo node filho com TZ real,
// executando o próprio agendaPorDia.ts (type-stripping do Node, sem dependência nova). Fake timers NÃO mudam fuso.
const TZS = ['UTC', 'America/Sao_Paulo', 'Asia/Tokyo', 'Pacific/Kiritimati'] as const
// Hora local de 2026-01-01T00:00:00Z em cada fuso: prova que o TZ do filho valeu de fato.
const HORA_LOCAL_DO_CONTROLE: Record<(typeof TZS)[number], number> = {
  UTC: 0,
  'America/Sao_Paulo': 21,
  'Asia/Tokyo': 9,
  'Pacific/Kiritimati': 14,
}

const SCRIPT_FILHO = `
const { agruparEventosPorDia, formatarIntervalo } = await import(process.env.LIB_URL)
const ev = (id, inicio, fim = null) => ({ id, tipo_evento: 'pessoal', titulo: 't', descricao: null, data_hora_inicio: inicio, data_hora_fim: fim })
const eventos = [
  ev(3, '2026-10-06T03:00:00.000Z'),
  ev(1, '2026-10-06T02:59:59.999Z'),
  ev(2, '2026-10-06T02:00:00.000Z', '2026-10-06T05:00:00.000Z'),
]
const grupos = agruparEventosPorDia(eventos, new Date('2026-10-05T15:00:00.000Z'))
console.log(JSON.stringify({
  controle: new Date('2026-01-01T00:00:00Z').getHours(),
  grupos: grupos.map((g) => [g.dia, g.rotulo, g.hoje, g.passado, g.eventos.map((e) => e.id)]),
  noite: formatarIntervalo(eventos[2]),
  mesmoDia: formatarIntervalo(ev(9, '2026-10-06T12:00:00.000Z', '2026-10-06T13:30:00.000Z')),
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
    env: { ...process.env, TZ: tz, LIB_URL: pathToFileURL(join(__dirname, 'agendaPorDia.ts')).href },
    encoding: 'utf8',
  })
  return JSON.parse(saida)
}

describe('independente do fuso do processo (U1)', () => {
  const resultados = Object.fromEntries(TZS.map((tz) => [tz, rodarNoFuso(tz)]))

  it.each(TZS)('controle: o TZ do processo filho mudou de fato (%s)', (tz) => {
    expect(resultados[tz].controle).toBe(HORA_LOCAL_DO_CONTROLE[tz])
  })

  it('agrupamento, flags e intervalos são os de São Paulo', () => {
    const esperado = {
      grupos: [
        ['2026-10-05', expect.stringContaining('05/10/2026'), true, false, [2, 1]],
        ['2026-10-06', expect.stringContaining('06/10/2026'), false, false, [3]],
      ],
      noite: '23:00 até 06/10/2026 02:00',
      mesmoDia: '09:00 às 10:30',
    }
    expect(resultados['America/Sao_Paulo']).toMatchObject(esperado)
  })

  it.each(TZS)('resultado idêntico ao de São Paulo com o processo em %s', (tz) => {
    const { grupos, noite, mesmoDia } = resultados[tz]
    expect({ grupos, noite, mesmoDia }).toEqual({
      grupos: resultados['America/Sao_Paulo'].grupos,
      noite: resultados['America/Sao_Paulo'].noite,
      mesmoDia: resultados['America/Sao_Paulo'].mesmoDia,
    })
  })
})

describe('bordas de dia (U2)', () => {
  it('02:59:59.999Z cai no dia anterior e 03:00:00.000Z no dia seguinte', () => {
    const grupos = agruparEventosPorDia(
      [ev(1, '2026-10-06T02:59:59.999Z'), ev(2, '2026-10-06T03:00:00.000Z')],
      AGORA,
    )
    expect(grupos.map((g) => g.dia)).toEqual(['2026-10-05', '2026-10-06'])
    expect(grupos[0].eventos[0].id).toBe(1)
    expect(grupos[1].eventos[0].id).toBe(2)
  })

  it('evento 23:00 a 02:00 aparece uma única vez, no dia do início, e o intervalo mostra a data do fim', () => {
    const noite = ev(1, '2026-10-06T02:00:00.000Z', '2026-10-06T05:00:00.000Z')
    const grupos = agruparEventosPorDia([noite], AGORA)
    expect(grupos).toHaveLength(1)
    expect(grupos[0].dia).toBe('2026-10-05')
    expect(grupos.flatMap((g) => g.eventos)).toHaveLength(1)
    expect(formatarIntervalo(noite)).toBe('23:00 até 06/10/2026 02:00')
  })

  it('evento sem fim mostra só a hora; fim no mesmo dia mostra "às"', () => {
    expect(formatarIntervalo(ev(1, '2026-10-05T12:00:00.000Z'))).toBe('09:00')
    expect(formatarIntervalo(ev(1, '2026-10-05T12:00:00.000Z', '2026-10-05T13:30:00.000Z'))).toBe('09:00 às 10:30')
  })
})

describe('ordem (U3)', () => {
  it('dias crescentes, eventos por instante e depois id, qualquer que seja a ordem de entrada, sem mutar', () => {
    const entrada = Object.freeze([
      ev(7, '2026-10-08T15:00:00.000Z'),
      ev(5, '2026-10-05T18:00:00.000Z'),
      ev(2, '2026-10-05T12:00:00.000Z'),
      ev(1, '2026-10-05T12:00:00.000Z'), // mesmo instante que o 2: desempate por id
      ev(3, '2026-10-05T12:00:00.123Z'),
    ])
    const copia = JSON.stringify(entrada)
    const grupos = agruparEventosPorDia(entrada as EventoAgenda[], AGORA)
    expect(grupos.map((g) => g.dia)).toEqual(['2026-10-05', '2026-10-08'])
    expect(grupos[0].eventos.map((e) => e.id)).toEqual([1, 2, 3, 5])
    expect(JSON.stringify(entrada)).toBe(copia)
  })

  it('mesmo id e instante diferentes por milissegundo respeitam o milissegundo', () => {
    const grupos = agruparEventosPorDia([ev(1, '2026-10-05T12:00:00.500Z'), ev(2, '2026-10-05T12:00:00.100Z')], AGORA)
    expect(grupos[0].eventos.map((e) => e.id)).toEqual([2, 1])
  })
})

describe('hoje e passado (U4)', () => {
  it('hoje vira às 03:00Z, e passado/hoje/futuro saem certos', () => {
    const eventos = [ev(1, '2026-10-04T15:00:00.000Z'), ev(2, '2026-10-05T15:00:00.000Z'), ev(3, '2026-10-06T15:00:00.000Z')]
    const antes = agruparEventosPorDia(eventos, new Date('2026-10-06T02:59:00.000Z')) // ainda 05/10 em SP
    expect(antes.map((g) => [g.dia, g.passado, g.hoje])).toEqual([
      ['2026-10-04', true, false],
      ['2026-10-05', false, true],
      ['2026-10-06', false, false],
    ])
    const depois = agruparEventosPorDia(eventos, new Date('2026-10-06T03:00:00.000Z')) // já 06/10 em SP
    expect(depois.map((g) => [g.dia, g.passado, g.hoje])).toEqual([
      ['2026-10-04', true, false],
      ['2026-10-05', true, false],
      ['2026-10-06', false, true],
    ])
  })

  it('o default de "agora" usa o relógio (falso) atual', () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-10-05T15:00:00.000Z'))
    const g = agruparEventosPorDia([ev(1, '2026-10-05T12:00:00.000Z')])
    expect(g[0].hoje).toBe(true)
    jest.setSystemTime(new Date('2026-10-20T15:00:00.000Z'))
    const g2 = agruparEventosPorDia([ev(1, '2026-10-05T12:00:00.000Z')])
    expect(g2[0].hoje).toBe(false)
    expect(g2[0].passado).toBe(true)
  })
})

describe('rótulo do dia (U5)', () => {
  it('traz dia da semana e dd/mm/aaaa, sem depender da string exata', () => {
    const [g] = agruparEventosPorDia([ev(1, '2026-10-05T12:00:00.000Z')], AGORA)
    expect(g.rotulo.toLowerCase()).toContain('segunda')
    expect(g.rotulo).toContain('05/10/2026')
  })

  it('o dia da semana é o de São Paulo, não o do UTC (23:59 de domingo em SP já é segunda em UTC)', () => {
    const [g] = agruparEventosPorDia([ev(1, '2026-10-05T02:30:00.000Z')], AGORA) // 23:30 de domingo 04/10 em SP
    expect(g.rotulo.toLowerCase()).toContain('domingo')
    expect(g.rotulo).toContain('04/10/2026')
  })
})

describe('data inválida e lista vazia (U6)', () => {
  const MSG = 'Data inválida na agenda.'

  it('início inválido lança RangeError com mensagem fixa que não repete o valor', () => {
    expect(() => agruparEventosPorDia([ev(1, 'valor-sigiloso-falso')], AGORA)).toThrow(new RangeError(MSG))
    expect(() => agruparEventosPorDia([ev(1, 'valor-sigiloso-falso')], AGORA)).toThrow(RangeError)
    try {
      agruparEventosPorDia([ev(1, 'valor-sigiloso-falso')], AGORA)
    } catch (e) {
      expect((e as Error).message).not.toContain('valor-sigiloso-falso')
    }
  })

  it('fim inválido lança RangeError, em formatarIntervalo e no agrupamento', () => {
    const ruim = ev(1, '2026-10-05T12:00:00.000Z', 'fim-sigiloso-falso')
    expect(() => formatarIntervalo(ruim)).toThrow(new RangeError(MSG))
    expect(() => agruparEventosPorDia([ruim], AGORA)).toThrow(new RangeError(MSG))
  })

  it('um evento inválido no meio da lista não some em silêncio', () => {
    expect(() => agruparEventosPorDia([ev(1, '2026-10-05T12:00:00.000Z'), ev(2, 'xx')], AGORA)).toThrow(RangeError)
  })

  it('lista vazia devolve []', () => {
    expect(agruparEventosPorDia([], AGORA)).toEqual([])
  })
})

describe('rotuloTipo (U7)', () => {
  it.each([
    ['pessoal', 'Pessoal'],
    ['medico', 'Médico'],
    ['cuidado', 'Cuidado'],
    ['qualquer-outro', 'Evento'],
    ['', 'Evento'],
  ])('%p vira %p', (tipo, rotulo) => {
    expect(rotuloTipo(tipo)).toBe(rotulo)
  })
})
