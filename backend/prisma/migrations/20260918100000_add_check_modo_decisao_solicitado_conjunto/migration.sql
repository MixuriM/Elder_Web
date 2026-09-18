-- RF-033 (item 2.9): modo_decisao_solicitado, modo_decisao_solicitado_por_id,
-- modo_decisao_solicitado_em e modo_decisao_expira_em formam um "conjunto" — ou os 4
-- estão NULL (nenhuma transferência de decisão em curso), ou os 4 estão preenchidos
-- (transferência em curso). modo_decisao_segunda_confirmacao_id fica de fora de propósito:
-- é opcional mesmo com solicitação em curso (só é exigido quando o idoso tem 2+ familiares
-- aprovados — ver Elder Web - Modelagem ER.md seção 3). Colunas já existem desde a migration
-- 20260831005102_init_schema (mesmo caso da 20260916090000_add_check_email_convite_familiar_idoso)
-- — esta migration só adiciona a constraint.
ALTER TABLE [dbo].[Usuario] ADD CONSTRAINT [CK_Usuario_modo_decisao_solicitado_conjunto] CHECK (
  (modo_decisao_solicitado IS NULL AND modo_decisao_solicitado_por_id IS NULL AND modo_decisao_solicitado_em IS NULL AND modo_decisao_expira_em IS NULL)
  OR
  (modo_decisao_solicitado IS NOT NULL AND modo_decisao_solicitado_por_id IS NOT NULL AND modo_decisao_solicitado_em IS NOT NULL AND modo_decisao_expira_em IS NOT NULL)
);
