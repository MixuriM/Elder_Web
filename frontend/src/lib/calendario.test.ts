import { agruparEventosPorDia, type EventoAgenda } from './agendaPorDia'
import {
  diaDaSemana,
  gradeDoMes,
  hojeSP,
  mapaPorDia,
  marcasDoDia,
  mesDe,
  posicaoNoDia,
  rotuloCelula,
  somarDias,
  somarMeses,
  tituloDia,
  tituloMes,
} from './calendario'

// Calendário da Agenda: funções puras. Datas do calendário são strings 'YYYY-MM-DD' (dia em São Paulo); o
// fuso só entra ao converter um instante (compromisso, "agora") em dia. Todos os dados são FICTÍCIOS.

function ev(id: number, inicio: string, fim: string | null = null, tipo = 'pessoal'): EventoAgenda {
  return { id, tipo_evento: tipo, titulo: `titulo-falso-${id}`, descricao: null, data_hora_inicio: inicio, data_hora_fim: fim }
}

describe('gradeDoMes', () => {
  it.each([
    [2026, 2, 28, 4], // fevereiro de 2026 começa no domingo e termina no sábado: 4 semanas exatas
    [2028, 2, 29, 5], // ano bissexto
    [2026, 9, 30, 5],
    [2026, 10, 31, 5],
    [2026, 8, 31, 6], // começa num sábado: 6 semanas
  ])('%i-%i tem %i dias do mês em %i semanas de domingo a sábado', (ano, mes, dias, semanas) => {
    const grade = gradeDoMes(ano, mes)
    expect(grade).toHaveLength(semanas)
    for (const semana of grade) {
      expect(semana).toHaveLength(7)
      expect(diaDaSemana(semana[0].dia)).toBe(0)
      expect(diaDaSemana(semana[6].dia)).toBe(6)
    }
    const doMes = grade.flat().filter((c) => c.doMes)
    expect(doMes).toHaveLength(dias)
    expect(doMes[0].dia).toBe(`${ano}-${String(mes).padStart(2, '0')}-01`)
    expect(doMes[dias - 1].numero).toBe(dias)
  })

  it('marca os dias do mês anterior e do seguinte como fora do mês', () => {
    const celulas = gradeDoMes(2026, 10).flat() // 01/10/2026 é quinta
    expect(celulas[0]).toEqual({ dia: '2026-09-27', numero: 27, doMes: false })
    expect(celulas[4]).toEqual({ dia: '2026-10-01', numero: 1, doMes: true })
    expect(celulas.at(-1)).toEqual({ dia: '2026-10-31', numero: 31, doMes: true }) // 31/10/2026 é sábado
    expect(gradeDoMes(2026, 9).flat().at(-1)).toEqual({ dia: '2026-10-03', numero: 3, doMes: false })
  })

  it('dezembro inclui os primeiros dias de janeiro do ano seguinte', () => {
    const celulas = gradeDoMes(2026, 12).flat()
    expect(celulas.at(-1)?.dia).toBe('2027-01-02')
    expect(gradeDoMes(2027, 1).flat()[0].dia).toBe('2026-12-27')
  })
})

describe('navegação', () => {
  it('somarDias atravessa mês e ano', () => {
    expect(somarDias('2026-12-31', 1)).toBe('2027-01-01')
    expect(somarDias('2027-01-01', -1)).toBe('2026-12-31')
    expect(somarDias('2028-02-28', 1)).toBe('2028-02-29')
    expect(somarDias('2026-10-04', -7)).toBe('2026-09-27')
  })

  it('somarMeses vira o ano e limita o dia ao fim do mês', () => {
    expect(somarMeses('2026-12-15', 1)).toBe('2027-01-15')
    expect(somarMeses('2027-01-15', -1)).toBe('2026-12-15')
    expect(somarMeses('2026-01-31', 1)).toBe('2026-02-28')
    expect(somarMeses('2028-01-31', 1)).toBe('2028-02-29')
    expect(somarMeses('2026-03-31', -1)).toBe('2026-02-28')
  })

  it('mesDe devolve ano e mês do dia', () => {
    expect(mesDe('2027-01-02')).toEqual({ ano: 2027, mes: 1 })
  })
})

describe('hojeSP', () => {
  it('usa o dia de São Paulo, não o UTC', () => {
    expect(hojeSP(new Date('2026-10-11T02:30:00.000Z'))).toBe('2026-10-10') // 23:30 de 10/10 em SP
    expect(hojeSP(new Date('2026-10-11T03:30:00.000Z'))).toBe('2026-10-11') // 00:30 de 11/10 em SP
  })
})

describe('mapaPorDia', () => {
  const AGORA = new Date('2026-10-05T15:00:00.000Z')

  it('23:30 e 00:30 em São Paulo caem em dias diferentes', () => {
    const mapa = mapaPorDia(
      agruparEventosPorDia([ev(1, '2026-10-11T02:30:00.000Z'), ev(2, '2026-10-11T03:30:00.000Z')], AGORA),
    )
    expect(mapa.get('2026-10-10')?.map((e) => e.id)).toEqual([1])
    expect(mapa.get('2026-10-11')?.map((e) => e.id)).toEqual([2])
  })

  it('compromisso que cruza a meia-noite fica só no dia em que começa', () => {
    const mapa = mapaPorDia(agruparEventosPorDia([ev(1, '2026-10-11T01:00:00.000Z', '2026-10-11T04:00:00.000Z')], AGORA))
    expect(mapa.get('2026-10-10')?.map((e) => e.id)).toEqual([1])
    expect(mapa.has('2026-10-11')).toBe(false)
  })

  it('mês sem compromisso: nenhuma célula tem eventos', () => {
    const mapa = mapaPorDia(agruparEventosPorDia([ev(1, '2026-12-01T15:00:00.000Z')], AGORA))
    expect(gradeDoMes(2026, 10).flat().filter((c) => c.doMes && mapa.has(c.dia))).toHaveLength(0)
  })
})

describe('posicaoNoDia', () => {
  it('compromisso às 23:30 em São Paulo', () => {
    expect(posicaoNoDia(ev(1, '2026-10-11T02:30:00.000Z'), '2026-10-10')).toEqual({
      inicioMin: 1410,
      fimMin: 1410,
      comecaAntes: false,
      terminaDepois: false,
    })
  })

  it('compromisso às 00:30 com fim às 01:15', () => {
    expect(posicaoNoDia(ev(1, '2026-10-11T03:30:00.000Z', '2026-10-11T04:15:00.000Z'), '2026-10-11')).toEqual({
      inicioMin: 30,
      fimMin: 75,
      comecaAntes: false,
      terminaDepois: false,
    })
  })

  it('compromisso que cruza a meia-noite: corta no fim do dia e no começo do seguinte', () => {
    const e = ev(1, '2026-10-11T01:00:00.000Z', '2026-10-11T04:00:00.000Z') // 22:00 de 10/10 até 01:00 de 11/10
    expect(posicaoNoDia(e, '2026-10-10')).toEqual({ inicioMin: 1320, fimMin: 1440, comecaAntes: false, terminaDepois: true })
    expect(posicaoNoDia(e, '2026-10-11')).toEqual({ inicioMin: 0, fimMin: 60, comecaAntes: true, terminaDepois: false })
  })
})

describe('marcasDoDia', () => {
  it('no máximo 3 marcas, na ordem dos compromissos, e o resto em +N', () => {
    const eventos = [ev(1, 'x', null, 'medico'), ev(2, 'x', null, 'cuidado'), ev(3, 'x'), ev(4, 'x'), ev(5, 'x')]
    expect(marcasDoDia(eventos)).toEqual({ tipos: ['medico', 'cuidado', 'pessoal'], mais: 2 })
    expect(marcasDoDia([])).toEqual({ tipos: [], mais: 0 })
  })
})

describe('textos', () => {
  it('rotuloCelula diz dia, quantidade e tipos', () => {
    const eventos = [ev(1, 'x', null, 'medico'), ev(2, 'x'), ev(3, 'x', null, 'medico')]
    expect(rotuloCelula('2026-10-12', eventos, false)).toBe('12 de outubro, 3 compromissos: 2 médico, 1 pessoal')
    expect(rotuloCelula('2026-10-12', [ev(1, 'x', null, 'cuidado')], true)).toBe('12 de outubro, hoje, 1 compromisso: 1 cuidado')
    expect(rotuloCelula('2026-10-01', [], false)).toBe('1 de outubro, nenhum compromisso')
  })

  it('tituloMes e tituloDia em português', () => {
    expect(tituloMes(2027, 1)).toBe('Janeiro de 2027')
    expect(tituloDia('2026-10-10')).toBe('Sábado, 10 de outubro de 2026')
  })
})
