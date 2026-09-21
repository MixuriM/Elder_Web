-- RF-030: o aceite do termo de responsabilidade só existe para idoso cadastrado por
-- Familiar; trava a nível de banco que termo_responsabilidade_aceito_em só pode ser
-- não-nulo quando cadastrado_por_id está preenchido (hoje só POST /usuario/cadastrar-idoso
-- garante isso). Coluna já existe desde 20260831005102_init_schema, só falta a constraint.
ALTER TABLE [dbo].[Usuario] ADD CONSTRAINT [CK_Usuario_termo_cadastrado_por] CHECK (termo_responsabilidade_aceito_em IS NULL OR cadastrado_por_id IS NOT NULL);
