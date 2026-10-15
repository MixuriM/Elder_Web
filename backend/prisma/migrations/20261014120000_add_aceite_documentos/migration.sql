-- Aceite gravado (decisão D9 de 2026-10-14): quando e em que versão a pessoa aceitou os Termos de Uso e a Política de
-- Privacidade, e quando deu o consentimento de saúde (LGPD art. 8, par. 2: o ônus da prova do consentimento é do
-- controlador). Os 3 andam juntos: ou todos NULL (conta anterior a esta migration, sem backfill nem reaceite), ou todos
-- preenchidos. Mesmo padrão de CK_Usuario_foto_perfil_conjunto.
BEGIN TRY

BEGIN TRAN;

ALTER TABLE [dbo].[Usuario] ADD [aceite_documentos_em] DATETIME2,
[aceite_documentos_versao] NVARCHAR(20),
[consentimento_saude_em] DATETIME2;

-- EXEC: o SQL Server compila o batch inteiro antes de executar, então a CHECK não enxerga
-- as colunas recém-adicionadas acima (erro 207) se estiver no mesmo batch.
EXEC('ALTER TABLE [dbo].[Usuario] ADD CONSTRAINT [CK_Usuario_aceite_documentos_conjunto] CHECK (
  (aceite_documentos_em IS NULL AND aceite_documentos_versao IS NULL AND consentimento_saude_em IS NULL)
  OR
  (aceite_documentos_em IS NOT NULL AND aceite_documentos_versao IS NOT NULL AND consentimento_saude_em IS NOT NULL)
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
