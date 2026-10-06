// Item 7.2 (RF-019): funções puras do histórico alimentar. Fuso fixo America/Sao_Paulo via Intl com timeZone
// explícito: nunca depende do fuso do navegador nem do processo. Sem biblioteca de data. Nunca loga nada nem repete
// o valor recebido em mensagem (a descrição e a refeição podem revelar dado de saúde, RNF-001).

const TZ = 'America/Sao_Paulo'
const MSG_DATA_INVALIDA = 'Data inválida no histórico alimentar.'
const MSG_REFEICAO_DESCONHECIDA = 'Refeição desconhecida no histórico alimentar.'

const fmt = new Intl.DateTimeFormat('pt-BR', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

// 'dd/mm/aaaa HH:MM' em São Paulo.
export function formatarDataHora(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) throw new RangeError(MSG_DATA_INVALIDA)
  const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value]))
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`
}

const ROTULOS_REFEICAO: Record<string, string> = {
  cafe_manha: 'Café da manhã',
  lanche_manha: 'Lanche da manhã',
  almoco: 'Almoço',
  lanche_tarde: 'Lanche da tarde',
  jantar: 'Jantar',
  ceia: 'Ceia',
}

export function rotuloRefeicao(valor: string): string {
  if (!Object.hasOwn(ROTULOS_REFEICAO, valor)) throw new RangeError(MSG_REFEICAO_DESCONHECIDA)
  return ROTULOS_REFEICAO[valor]
}
