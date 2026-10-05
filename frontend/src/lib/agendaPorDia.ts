// Item 6.3 (RF-017): funções puras para agrupar a agenda por dia. Fuso fixo America/Sao_Paulo via Intl com
// timeZone explícito: nunca depende do fuso do navegador nem do processo. Sem biblioteca de data. Nunca loga
// nada nem repete valor de data em mensagem (título de compromisso médico pode ser dado de saúde, RNF-001).

export type EventoAgenda = {
  id: number
  tipo_evento: string
  titulo: string
  descricao: string | null
  data_hora_inicio: string
  data_hora_fim: string | null
}

export type GrupoDia = {
  dia: string // YYYY-MM-DD, dia em São Paulo
  rotulo: string
  hoje: boolean
  passado: boolean
  eventos: EventoAgenda[]
}

const TZ = 'America/Sao_Paulo'
const MSG_DATA_INVALIDA = 'Data inválida na agenda.'

const fmtDia = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
const fmtHora = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const fmtRotulo = new Intl.DateTimeFormat('pt-BR', {
  timeZone: TZ,
  weekday: 'long',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

function instante(iso: string): Date {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) throw new RangeError(MSG_DATA_INVALIDA)
  return d
}

function partes(fmt: Intl.DateTimeFormat, d: Date) {
  return Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]))
}

// 'YYYY-MM-DD' do dia em São Paulo.
function diaSP(d: Date): string {
  const p = partes(fmtDia, d)
  return `${p.year}-${p.month}-${p.day}`
}

function dataHoraSP(d: Date): string {
  const p = partes(fmtDia, d)
  return `${p.day}/${p.month}/${p.year} ${fmtHora.format(d)}`
}

export function agruparEventosPorDia(eventos: EventoAgenda[], agora: Date = new Date()): GrupoDia[] {
  const hojeSP = diaSP(agora)
  const comInstante = eventos.map((e) => {
    const inicio = instante(e.data_hora_inicio)
    if (e.data_hora_fim !== null) instante(e.data_hora_fim) // fim inválido também lança
    return { e, inicio }
  })
  comInstante.sort((a, b) => a.inicio.getTime() - b.inicio.getTime() || a.e.id - b.e.id)

  const grupos: GrupoDia[] = []
  for (const { e, inicio } of comInstante) {
    const dia = diaSP(inicio)
    let g = grupos.find((x) => x.dia === dia)
    if (!g) {
      g = { dia, rotulo: fmtRotulo.format(inicio), hoje: dia === hojeSP, passado: dia < hojeSP, eventos: [] }
      grupos.push(g)
    }
    g.eventos.push(e)
  }
  return grupos // já em ordem crescente: a entrada foi ordenada por instante
}

export function formatarIntervalo(e: EventoAgenda): string {
  const inicio = instante(e.data_hora_inicio)
  const hi = fmtHora.format(inicio)
  if (e.data_hora_fim === null) return hi
  const fim = instante(e.data_hora_fim)
  return diaSP(fim) === diaSP(inicio) ? `${hi} às ${fmtHora.format(fim)}` : `${hi} até ${dataHoraSP(fim)}`
}

const ROTULOS_TIPO: Record<string, string> = { pessoal: 'Pessoal', medico: 'Médico', cuidado: 'Cuidado' }

export function rotuloTipo(tipo: string): string {
  return Object.hasOwn(ROTULOS_TIPO, tipo) ? ROTULOS_TIPO[tipo] : 'Evento'
}
