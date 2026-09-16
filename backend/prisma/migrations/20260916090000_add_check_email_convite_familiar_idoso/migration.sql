-- RF-024: email_convite_familiar só faz sentido pro idoso informar o e-mail de um
-- familiar; trava a nível de banco que o campo só pode ser não-nulo quando
-- tipo_perfil='idoso' (mesmo padrão de CK_Usuario_firebase_uid_cadastrado_por).
-- Coluna [email_convite_familiar] já existe desde a migration 20260831005102_init_schema
-- (fazia parte do schema inicial, sem CHECK) — esta migration só adiciona a constraint.
ALTER TABLE [dbo].[Usuario] ADD CONSTRAINT [CK_Usuario_email_convite_familiar_tipo_perfil] CHECK (email_convite_familiar IS NULL OR tipo_perfil = 'idoso');
