import type { Vinculo } from '../components/Vinculos/CardVinculo'
import type { ContextoAcesso } from '../contexts/useAcesso'
import type { IdososVinculados } from '../hooks/useIdososVinculados'
import { agruparEventosPorDia, diaSP, type EventoAgenda } from './agendaPorDia'
import { idososAprovados } from './regrasIdosoVinculado'

// Funções puras do resumo do dia na Home. "Hoje" é sempre o dia em São Paulo (diaSP), nunca o do navegador.
// Nada aqui loga: medição de saúde, medicamento e título de compromisso médico são dados sensíveis (RNF-001).

export function eventosDeHoje(eventos: EventoAgenda[], agora: Date = new Date()): EventoAgenda[] {
  return agruparEventosPorDia(eventos, agora).find((g) => g.hoje)?.eventos ?? []
}

type Dose = { status_administracao: string; data_hora_administracao: string }
type Medicamento = { ativo: boolean; doses: Dose[] }

// Só o que foi registrado: o medicamento não tem horário estruturado, então "faltam" ou "atrasou" não são calculáveis.
export function resumoMedicamentos(medicamentos: Medicamento[], agora: Date = new Date()) {
  const hoje = diaSP(agora)
  const porStatus: Record<string, number> = { administrado: 0, pulado: 0, atrasado: 0 }
  let dosesHoje = 0
  for (const d of medicamentos.flatMap((m) => m.doses)) {
    if (diaSP(new Date(d.data_hora_administracao)) !== hoje) continue
    dosesHoje++
    porStatus[d.status_administracao] = (porStatus[d.status_administracao] ?? 0) + 1
  }
  return { ativos: medicamentos.filter((m) => m.ativo).length, dosesHoje, porStatus }
}

type AcessoMinimo = Pick<ContextoAcesso, 'tipoPerfil'> & { vinculos?: Vinculo[] | null }

// Mesmas regras de ator do backend, só para não sugerir uma ação que daria 403: o backend continua sendo a barreira.
// Cuidador: flag do vínculo com o idoso escolhido, e nunca cadastra medicamento. Familiar: só com modo de decisão
// "familiar". Vínculo pendente ou de outra pessoa (titular) não conta.
export function permissoesDeEscrita({ tipoPerfil, vinculos }: AcessoMinimo, idosoId: number | null) {
  if (tipoPerfil === 'idoso') return { saude: true, dose: true, agenda: true, medicamento: true }
  const v = vinculos?.find(
    (x) => x.papel_do_chamador === 'vinculado' && x.status === 'aprovado' && x.idoso.id === idosoId,
  )
  if (v?.tipo_vinculo === 'cuidador') {
    return {
      saude: v.permissoes?.permite_registrar_saude === true,
      dose: v.permissoes?.permite_marcar_dose === true,
      agenda: v.permissoes?.permite_criar_evento_cuidado === true,
      medicamento: false,
    }
  }
  const decide = v?.tipo_vinculo === 'familiar' && v.decisao?.modo === 'familiar'
  return { saude: decide, dose: decide, agenda: decide, medicamento: decide }
}

// Lista para o SeletorIdoso a partir do que o AcessoProvider já buscou: nenhuma chamada nova.
export function idososDoAcesso({
  estado,
  tipoPerfil,
  vinculos,
}: Pick<ContextoAcesso, 'estado' | 'tipoPerfil' | 'vinculos'>): IdososVinculados {
  if (estado === 'carregando') return { estado, ehIdoso: false, idosos: [], bloqueado: true }
  if (tipoPerfil === 'idoso') return { estado: 'ok', ehIdoso: true, idosos: [], bloqueado: false }
  if (!vinculos) return { estado: 'erro', ehIdoso: false, idosos: [], bloqueado: true }
  const idosos = idososAprovados(vinculos)
  return { estado: 'ok', ehIdoso: false, idosos, bloqueado: idosos.length === 0, tipoPerfil: tipoPerfil ?? undefined }
}
