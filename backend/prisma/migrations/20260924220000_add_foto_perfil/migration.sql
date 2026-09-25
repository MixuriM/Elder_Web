-- Foto de perfil: BLOB no próprio SQL Server (VARBINARY(MAX)), sem storage externo.
-- foto_perfil, foto_perfil_mime_type e foto_perfil_atualizada_em formam um "conjunto" — ou
-- os 3 estão NULL (sem foto), ou os 3 estão preenchidos. Mesmo padrão de
-- CK_Usuario_modo_decisao_solicitado_conjunto.
BEGIN TRY

BEGIN TRAN;

ALTER TABLE [dbo].[Usuario] ADD [foto_perfil] VARBINARY(max),
[foto_perfil_atualizada_em] DATETIME2,
[foto_perfil_mime_type] NVARCHAR(50);

-- EXEC: o SQL Server compila o batch inteiro antes de executar, então a CHECK não enxerga
-- as colunas recém-adicionadas acima (erro 207) se estiver no mesmo batch.
EXEC('ALTER TABLE [dbo].[Usuario] ADD CONSTRAINT [CK_Usuario_foto_perfil_conjunto] CHECK (
  (foto_perfil IS NULL AND foto_perfil_mime_type IS NULL AND foto_perfil_atualizada_em IS NULL)
  OR
  (foto_perfil IS NOT NULL AND foto_perfil_mime_type IS NOT NULL AND foto_perfil_atualizada_em IS NOT NULL)
)');

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
