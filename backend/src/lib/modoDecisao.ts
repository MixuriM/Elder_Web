// Cancelamento de uma transferência de modo_decisao em curso (RF-033): os 6 campos de
// solicitação zerados. Fica em lib, sem imports, pra ser usada por routes/auth.ts,
// routes/vinculo.ts e routes/usuario.ts sem risco de import circular entre rotas.
export const CANCELAMENTO_SOLICITACAO = {
  modo_decisao_solicitado: null,
  modo_decisao_solicitado_por_id: null,
  modo_decisao_solicitado_em: null,
  modo_decisao_expira_em: null,
  modo_decisao_segunda_confirmacao_id: null,
  modo_decisao_motivo: null,
} as const;
