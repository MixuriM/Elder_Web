import type { Vinculo } from '../components/Vinculos/CardVinculo'

// Quem vê os botões Editar e Remover. É só conveniência de UX: a barreira real é o 403 do backend, então tudo o que
// não dá para saber (vínculos sem carregar, decisão ausente) falha ABERTO e o 403 vira mensagem fixa.
type Base = {
  ehIdoso: boolean
  // Do useIdososVinculados: só vem quando o perfil não é idoso.
  tipoPerfil?: string
  idosoId: string
  // Do AcessoContext (GET /vinculo): null ou undefined = não carregou.
  vinculos?: Vinculo[] | null
}

const meus = (vinculos: Vinculo[]) => vinculos.filter((v) => v.papel_do_chamador === 'vinculado')

// Decisão por idoso: o `modoDecisao` do contexto é o do próprio usuário (só o idoso tem), não o do idoso escolhido.
// Quem diz quem decide por ele é `decisao.modo`, que vem no vínculo aprovado de familiar do chamador.
function familiarDecide({ vinculos, idosoId }: Base): boolean {
  if (!vinculos) return true

  const vinculo = meus(vinculos).find(
    (v) => v.tipo_vinculo === 'familiar' && v.status === 'aprovado' && String(v.idoso.id) === idosoId,
  )

  if (!vinculo) return false
  if (!vinculo.decisao) return true

  return vinculo.decisao.modo === 'familiar'
}

// Alimentação e medicamento: idoso sempre; familiar só com modo familiar; cuidador nunca (regra fixa de ator).
export function podeAlterarOutroRegistro(b: Base): boolean {
  if (b.ehIdoso) return true
  if (b.tipoPerfil === 'cuidador') return false

  return familiarDecide(b)
}

// Saúde: o cuidador só altera o registro que ele mesmo criou, e só com a permissão de registrar saúde.
export function podeAlterarRegistroSaude(
  b: Base & { escritaTerceiros: boolean; registradoPorId?: number },
): boolean {
  if (b.ehIdoso) return true

  if (b.tipoPerfil === 'cuidador') {
    if (!b.escritaTerceiros) return false

    const meuId = b.vinculos ? (meus(b.vinculos)[0]?.vinculado.id ?? null) : null

    return meuId === null || b.registradoPorId === undefined || b.registradoPorId === meuId
  }

  return familiarDecide(b)
}
