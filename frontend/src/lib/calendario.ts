// Calendário da Agenda (visões Mês e Dia): funções puras, sem biblioteca de data. Um dia do calendário é a
// string 'YYYY-MM-DD' do dia em São Paulo; a conta de calendário (somar dias, montar a grade) usa Date.UTC só como
// aritmética de datas, sem fuso. O fuso entra apenas ao converter um instante em dia (diaSP, America/Sao_Paulo).
// Nada aqui loga nem repete título de compromisso (pode ser dado de saúde, RNF-001).
import { diaSP, type EventoAgenda, type GrupoDia } from './agendaPorDia'

export type Celula = { dia: string; numero: number; doMes: boolean }
export type Posicao = { inicioMin: number; fimMin: number; comecaAntes: boolean; terminaDepois: boolean }

const TIPOS = ['pessoal', 'medico', 'cuidado'] as const
const NOME_TIPO: Record<string, string> = { pessoal: 'pessoal', medico: 'médico', cuidado: 'cuidado' }

const paraData = (dia: string) => {
  const [a, m, d] = dia.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d))
}
const paraDia = (d: Date) => d.toISOString().slice(0, 10)

export const diaDaSemana = (dia: string) => paraData(dia).getUTCDay() // 0 = domingo
export const hojeSP = (agora: Date = new Date()) => diaSP(agora)

export function mesDe(dia: string) {
  const d = paraData(dia)
  return { ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1 }
}

export function somarDias(dia: string, n: number): string {
  const d = paraData(dia)
  d.setUTCDate(d.getUTCDate() + n)
  return paraDia(d)
}

// Mesmo dia no outro mês; 31/01 + 1 mês vira o último dia de fevereiro.
export function somarMeses(dia: string, n: number): string {
  const d = paraData(dia)
  const ultimo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n + 1, 0)).getUTCDate()
  return paraDia(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, Math.min(d.getUTCDate(), ultimo))))
}

// Semanas de domingo a sábado cobrindo o mês inteiro (4 a 6), com os dias vizinhos marcados fora do mês.
export function gradeDoMes(ano: number, mes: number): Celula[][] {
  const primeiro = paraDia(new Date(Date.UTC(ano, mes - 1, 1)))
  const ultimo = paraDia(new Date(Date.UTC(ano, mes, 0)))
  const fim = somarDias(ultimo, 6 - diaDaSemana(ultimo))
  const semanas: Celula[][] = []
  for (let dia = somarDias(primeiro, -diaDaSemana(primeiro)); dia <= fim; dia = somarDias(dia, 1)) {
    if (diaDaSemana(dia) === 0) semanas.push([])
    const d = paraData(dia)
    semanas[semanas.length - 1].push({ dia, numero: d.getUTCDate(), doMes: d.getUTCMonth() + 1 === mes })
  }
  return semanas
}

// Reaproveita o agrupamento da lista (agruparEventosPorDia): o compromisso fica no dia em que começa.
export const mapaPorDia = (grupos: GrupoDia[]) => new Map(grupos.map((g) => [g.dia, g.eventos]))

const fmtHoraMin = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})
function minutosSP(d: Date) {
  const p = Object.fromEntries(fmtHoraMin.formatToParts(d).map((x) => [x.type, x.value]))
  return Number(p.hour) * 60 + Number(p.minute)
}

// Minutos desde 00:00 do dia em São Paulo, cortados no próprio dia. Sem fim, o compromisso é um ponto.
export function posicaoNoDia(e: EventoAgenda, dia: string): Posicao {
  const inicio = new Date(e.data_hora_inicio)
  const fim = e.data_hora_fim === null ? inicio : new Date(e.data_hora_fim)
  const comecaAntes = diaSP(inicio) < dia
  const terminaDepois = diaSP(fim) > dia
  return {
    inicioMin: comecaAntes ? 0 : minutosSP(inicio),
    fimMin: terminaDepois ? 1440 : minutosSP(fim),
    comecaAntes,
    terminaDepois,
  }
}

// Até 3 marcas na célula do mês (uma por compromisso, na ordem do dia); o resto vira "+N".
export function marcasDoDia(eventos: EventoAgenda[]) {
  return { tipos: eventos.slice(0, 3).map((e) => e.tipo_evento), mais: Math.max(0, eventos.length - 3) }
}

const fmtDiaMes = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', day: 'numeric', month: 'long' })
const fmtMesAno = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', month: 'long', year: 'numeric' })
const fmtDiaLongo = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'UTC',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})
const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export const tituloMes = (ano: number, mes: number) => maiuscula(fmtMesAno.format(new Date(Date.UTC(ano, mes - 1, 1))))
export const tituloDia = (dia: string) => maiuscula(fmtDiaLongo.format(paraData(dia)))

// Nome acessível da célula: "12 de outubro, hoje, 2 compromissos: 1 médico, 1 pessoal".
export function rotuloCelula(dia: string, eventos: EventoAgenda[], hoje: boolean): string {
  const base = `${fmtDiaMes.format(paraData(dia))}${hoje ? ', hoje' : ''}`
  if (eventos.length === 0) return `${base}, nenhum compromisso`
  const contagem = [...TIPOS, 'outro'].map((t) => ({
    nome: NOME_TIPO[t] ?? 'outro',
    n: eventos.filter((e) => (t === 'outro' ? !Object.hasOwn(NOME_TIPO, e.tipo_evento) : e.tipo_evento === t)).length,
  }))
  // Maior quantidade primeiro; sort estável mantém a ordem fixa dos tipos no empate.
  const porTipo = contagem.filter((c) => c.n > 0).sort((a, b) => b.n - a.n).map((c) => `${c.n} ${c.nome}`)
  return `${base}, ${eventos.length} ${eventos.length === 1 ? 'compromisso' : 'compromissos'}: ${porTipo.join(', ')}`
}
