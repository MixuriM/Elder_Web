-- Torna Usuario.firebase_uid nullable — suporte a RF-030 (idoso cadastrado por
-- familiar, sem login Firebase próprio ainda). Mesmo padrão já usado para
-- Usuario.email na migration 20260831005102_init_schema.
--
-- DECISÃO PENDENTE DE CONFIRMAÇÃO DO GRUPO: isto reabre "firebase_uid é UNIQUE,
-- NOT NULL" descrito como decisão fechada em CLAUDE.md, seção "Arquitetura de
-- autenticação". Não aplicar em nenhum banco (local ou remoto) antes dessa
-- confirmação. O índice UNIQUE segue intacto — passa a ser filtrado (permite
-- múltiplos NULL), não removido.

BEGIN TRY

BEGIN TRAN;

-- DropIndex (constraint UNIQUE inline criada por @unique em coluna NOT NULL)
ALTER TABLE [dbo].[Usuario] DROP CONSTRAINT [Usuario_firebase_uid_key];

-- AlterColumn
ALTER TABLE [dbo].[Usuario] ALTER COLUMN [firebase_uid] NVARCHAR(128) NULL;

-- CreateIndex (filtrado — Usuario.firebase_uid pode ser NULL quando idoso é
-- cadastrado por familiar via RF-030, mesmo padrão do Usuario_email_key)
CREATE UNIQUE NONCLUSTERED INDEX [Usuario_firebase_uid_key] ON [dbo].[Usuario]([firebase_uid]) WHERE [firebase_uid] IS NOT NULL;

-- CheckConstraint
ALTER TABLE [dbo].[Usuario] ADD CONSTRAINT [CK_Usuario_firebase_uid_cadastrado_por] CHECK (firebase_uid IS NOT NULL OR cadastrado_por_id IS NOT NULL);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
