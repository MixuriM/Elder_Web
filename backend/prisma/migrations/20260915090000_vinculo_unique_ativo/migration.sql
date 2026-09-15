-- Fecha o gap identificado no item 2.1 da Fase 2 (RF-020, backend/src/routes/vinculo.ts):
-- checagem de duplicidade de Vinculo cuidador↔idoso era só em nível de aplicação
-- (findFirst antes do create), sem índice único no banco pra fechar a corrida entre
-- duas solicitações simultâneas do mesmo par.
--
-- FILTRADO (WHERE status IN ('pendente','aprovado')), não sobre a tripla inteira sem
-- filtro — status='recusado' precisa permitir uma nova solicitação (comportamento
-- permitido de propósito, ver comentário em schema.prisma e vinculo.ts). Mesmo padrão
-- de índice único filtrado manual já usado em Usuario.email e Usuario.firebase_uid
-- (migrations 20260831005102_init_schema e 20260902014014_firebase_uid_nullable) —
-- @@unique do Prisma não aceita WHERE, então este SQL foi editado manualmente.
--
-- isDuplicateVinculoConstraint (backend/src/routes/vinculo.ts) já detecta o texto de
-- erro genérico de violação de índice único do driver SQL Server — nenhuma mudança
-- necessária nele, só passa a disparar de verdade depois deste índice existir.

BEGIN TRY

BEGIN TRAN;

-- CreateIndex (filtrado — permite múltiplas linhas 'recusado' para o mesmo par, só
-- bloqueia duplicidade entre linhas 'pendente'/'aprovado')
CREATE UNIQUE NONCLUSTERED INDEX [Vinculo_idoso_id_vinculado_id_tipo_vinculo_key]
    ON [dbo].[Vinculo]([idoso_id], [vinculado_id], [tipo_vinculo])
    WHERE [status] IN ('pendente', 'aprovado');

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
