BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[Usuario] (
    [id] INT NOT NULL IDENTITY(1,1),
    [firebase_uid] NVARCHAR(128) NOT NULL,
    [nome] NVARCHAR(150) NOT NULL,
    [email] NVARCHAR(255),
    [telefone] NVARCHAR(20),
    [tipo_perfil] NVARCHAR(20) NOT NULL,
    [email_convite_familiar] NVARCHAR(255),
    [cadastrado_por_id] INT,
    [termo_responsabilidade_aceito_em] DATETIME2,
    [modo_decisao] NVARCHAR(10),
    [ultimo_login_em] DATETIME2,
    [modo_decisao_solicitado] NVARCHAR(10),
    [modo_decisao_solicitado_por_id] INT,
    [modo_decisao_solicitado_em] DATETIME2,
    [modo_decisao_expira_em] DATETIME2,
    [modo_decisao_segunda_confirmacao_id] INT,
    [modo_decisao_alterado_por_id] INT,
    [modo_decisao_alterado_em] DATETIME2,
    [modo_decisao_motivo] NVARCHAR(300),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [Usuario_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [Usuario_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Usuario_firebase_uid_key] UNIQUE NONCLUSTERED ([firebase_uid])
);

-- CreateTable
CREATE TABLE [dbo].[Vinculo] (
    [id] INT NOT NULL IDENTITY(1,1),
    [idoso_id] INT NOT NULL,
    [vinculado_id] INT NOT NULL,
    [tipo_vinculo] NVARCHAR(20) NOT NULL,
    [origem] NVARCHAR(30) NOT NULL,
    [status] NVARCHAR(20) NOT NULL,
    [aprovador_id] INT,
    [data_solicitacao] DATETIME2 NOT NULL,
    [data_resposta] DATETIME2,
    [confirmado_em] DATETIME2,
    [notificado_em] DATETIME2,
    [permite_registrar_saude] BIT CONSTRAINT [Vinculo_permite_registrar_saude_df] DEFAULT 0,
    [permite_marcar_dose] BIT CONSTRAINT [Vinculo_permite_marcar_dose_df] DEFAULT 0,
    [permite_criar_evento_cuidado] BIT CONSTRAINT [Vinculo_permite_criar_evento_cuidado_df] DEFAULT 0,
    [definido_por_id] INT,
    [definido_em] DATETIME2,
    CONSTRAINT [Vinculo_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Evento] (
    [id] INT NOT NULL IDENTITY(1,1),
    [idoso_id] INT NOT NULL,
    [criado_por_id] INT NOT NULL,
    [tipo_evento] NVARCHAR(30) NOT NULL,
    [titulo] NVARCHAR(150) NOT NULL,
    [descricao] NVARCHAR(500),
    [data_hora_inicio] DATETIME2 NOT NULL,
    [data_hora_fim] DATETIME2,
    [editado_por_id] INT,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [Evento_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [Evento_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Medicamento] (
    [id] INT NOT NULL IDENTITY(1,1),
    [idoso_id] INT NOT NULL,
    [criado_por_id] INT NOT NULL,
    [nome] NVARCHAR(150) NOT NULL,
    [dosagem] NVARCHAR(50) NOT NULL,
    [frequencia] NVARCHAR(100) NOT NULL,
    [data_inicio] DATE NOT NULL,
    [data_fim] DATE,
    [observacoes] NVARCHAR(500),
    [ativo] BIT NOT NULL,
    [editado_por_id] INT,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [Medicamento_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [Medicamento_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[RegistroDoseMedicamento] (
    [id] INT NOT NULL IDENTITY(1,1),
    [medicamento_id] INT NOT NULL,
    [registrado_por_id] INT NOT NULL,
    [data_hora_administracao] DATETIME2 NOT NULL,
    [status_administracao] NVARCHAR(20) NOT NULL,
    [observacoes] NVARCHAR(300),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [RegistroDoseMedicamento_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [RegistroDoseMedicamento_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[RegistroSaude] (
    [id] INT NOT NULL IDENTITY(1,1),
    [idoso_id] INT NOT NULL,
    [registrado_por_id] INT NOT NULL,
    [tipo_medicao] NVARCHAR(50) NOT NULL,
    [valor_1] DECIMAL(6,2) NOT NULL,
    [valor_2] DECIMAL(6,2),
    [unidade] NVARCHAR(20) NOT NULL,
    [data_hora] DATETIME2 NOT NULL,
    [observacoes] NVARCHAR(300),
    [editado_por_id] INT NOT NULL,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [RegistroSaude_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [RegistroSaude_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[RegistroAlimentar] (
    [id] INT NOT NULL IDENTITY(1,1),
    [idoso_id] INT NOT NULL,
    [registrado_por_id] INT NOT NULL,
    [refeicao] NVARCHAR(50) NOT NULL,
    [descricao] NVARCHAR(500) NOT NULL,
    [data_hora] DATETIME2 NOT NULL,
    [editado_por_id] INT,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [RegistroAlimentar_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [RegistroAlimentar_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- AddForeignKey
ALTER TABLE [dbo].[Usuario] ADD CONSTRAINT [Usuario_cadastrado_por_id_fkey] FOREIGN KEY ([cadastrado_por_id]) REFERENCES [dbo].[Usuario]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Usuario] ADD CONSTRAINT [Usuario_modo_decisao_solicitado_por_id_fkey] FOREIGN KEY ([modo_decisao_solicitado_por_id]) REFERENCES [dbo].[Usuario]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Usuario] ADD CONSTRAINT [Usuario_modo_decisao_segunda_confirmacao_id_fkey] FOREIGN KEY ([modo_decisao_segunda_confirmacao_id]) REFERENCES [dbo].[Usuario]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Usuario] ADD CONSTRAINT [Usuario_modo_decisao_alterado_por_id_fkey] FOREIGN KEY ([modo_decisao_alterado_por_id]) REFERENCES [dbo].[Usuario]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Vinculo] ADD CONSTRAINT [Vinculo_idoso_id_fkey] FOREIGN KEY ([idoso_id]) REFERENCES [dbo].[Usuario]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Vinculo] ADD CONSTRAINT [Vinculo_vinculado_id_fkey] FOREIGN KEY ([vinculado_id]) REFERENCES [dbo].[Usuario]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Vinculo] ADD CONSTRAINT [Vinculo_aprovador_id_fkey] FOREIGN KEY ([aprovador_id]) REFERENCES [dbo].[Usuario]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Vinculo] ADD CONSTRAINT [Vinculo_definido_por_id_fkey] FOREIGN KEY ([definido_por_id]) REFERENCES [dbo].[Usuario]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Evento] ADD CONSTRAINT [Evento_idoso_id_fkey] FOREIGN KEY ([idoso_id]) REFERENCES [dbo].[Usuario]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Evento] ADD CONSTRAINT [Evento_criado_por_id_fkey] FOREIGN KEY ([criado_por_id]) REFERENCES [dbo].[Usuario]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Evento] ADD CONSTRAINT [Evento_editado_por_id_fkey] FOREIGN KEY ([editado_por_id]) REFERENCES [dbo].[Usuario]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Medicamento] ADD CONSTRAINT [Medicamento_idoso_id_fkey] FOREIGN KEY ([idoso_id]) REFERENCES [dbo].[Usuario]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Medicamento] ADD CONSTRAINT [Medicamento_criado_por_id_fkey] FOREIGN KEY ([criado_por_id]) REFERENCES [dbo].[Usuario]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Medicamento] ADD CONSTRAINT [Medicamento_editado_por_id_fkey] FOREIGN KEY ([editado_por_id]) REFERENCES [dbo].[Usuario]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[RegistroDoseMedicamento] ADD CONSTRAINT [RegistroDoseMedicamento_medicamento_id_fkey] FOREIGN KEY ([medicamento_id]) REFERENCES [dbo].[Medicamento]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[RegistroDoseMedicamento] ADD CONSTRAINT [RegistroDoseMedicamento_registrado_por_id_fkey] FOREIGN KEY ([registrado_por_id]) REFERENCES [dbo].[Usuario]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[RegistroSaude] ADD CONSTRAINT [RegistroSaude_idoso_id_fkey] FOREIGN KEY ([idoso_id]) REFERENCES [dbo].[Usuario]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[RegistroSaude] ADD CONSTRAINT [RegistroSaude_registrado_por_id_fkey] FOREIGN KEY ([registrado_por_id]) REFERENCES [dbo].[Usuario]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[RegistroSaude] ADD CONSTRAINT [RegistroSaude_editado_por_id_fkey] FOREIGN KEY ([editado_por_id]) REFERENCES [dbo].[Usuario]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[RegistroAlimentar] ADD CONSTRAINT [RegistroAlimentar_idoso_id_fkey] FOREIGN KEY ([idoso_id]) REFERENCES [dbo].[Usuario]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[RegistroAlimentar] ADD CONSTRAINT [RegistroAlimentar_registrado_por_id_fkey] FOREIGN KEY ([registrado_por_id]) REFERENCES [dbo].[Usuario]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[RegistroAlimentar] ADD CONSTRAINT [RegistroAlimentar_editado_por_id_fkey] FOREIGN KEY ([editado_por_id]) REFERENCES [dbo].[Usuario]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
