import { mensagemPorStatus } from '../components/Vinculos/mensagensVinculo'

// Editar e remover registro (saúde, refeição, medicamento): mensagem fixa por status, nunca o corpo do servidor
// (o texto pode citar dado de saúde, RNF-001). 403 e 404 não dizem o motivo (nem modo_decisao).
const EDITAR = {
  400: 'Dados inválidos. Confira os campos e tente de novo.',
  401: 'Sessão expirada. Entre novamente.',
  403: 'Você não tem permissão para alterar este registro.',
  404: 'Este registro não existe mais. Feche e atualize a lista.',
}

const REMOVER = {
  401: 'Sessão expirada. Entre novamente.',
  403: 'Você não tem permissão para remover este registro.',
  404: 'Este registro já foi removido. Feche e atualize a lista.',
}

export const mensagemEdicao = (erro: unknown) =>
  mensagemPorStatus(erro, EDITAR, 'Não foi possível salvar as alterações.')

export const mensagemRemocao = (erro: unknown) =>
  mensagemPorStatus(erro, REMOVER, 'Não foi possível remover o registro.')
