-- Tarefa de desempenho (2026-10-13). Índices não únicos nas chaves estrangeiras que as rotas de leitura filtram.
-- O SQL Server não cria índice para chave estrangeira: sem eles, cada leitura do histórico de um idoso varre a
-- tabela inteira (Clustered Index Scan), e o custo cresce com o dado de TODOS os idosos.
--
-- Cobrem as colunas (INCLUDE) porque as rotas devolvem todas as colunas de todas as linhas do idoso: um índice só
-- de chave obrigaria uma busca por linha na tabela, e o otimizador continuava preferindo a varredura (medido com o
-- idoso dono de 10% e de 2% das linhas). Com INCLUDE a leitura vira Index Seek já na ordem do ORDER BY.
-- O Prisma não representa INCLUDE: o schema.prisma tem só as colunas da chave, com os mesmos nomes.
-- Medição (SQL Server local, backend/scripts/medir-desempenho.ts) e planos em docs/historico-implementacao.md.
-- Sem CHECK nem índice único: não precisa de caso em scripts/verify-constraints.ts.

-- CreateIndex
CREATE NONCLUSTERED INDEX [RegistroSaude_idoso_id_data_hora_idx] ON [dbo].[RegistroSaude]([idoso_id], [data_hora])
  INCLUDE ([registrado_por_id], [tipo_medicao], [valor_1], [valor_2], [unidade], [observacoes], [editado_por_id], [created_at], [updated_at]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [RegistroAlimentar_idoso_id_data_hora_idx] ON [dbo].[RegistroAlimentar]([idoso_id], [data_hora])
  INCLUDE ([registrado_por_id], [refeicao], [descricao], [editado_por_id], [created_at], [updated_at]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Evento_idoso_id_data_hora_inicio_idx] ON [dbo].[Evento]([idoso_id], [data_hora_inicio])
  INCLUDE ([criado_por_id], [tipo_evento], [titulo], [descricao], [data_hora_fim], [editado_por_id], [created_at], [updated_at]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Medicamento_idoso_id_idx] ON [dbo].[Medicamento]([idoso_id])
  INCLUDE ([criado_por_id], [nome], [dosagem], [frequencia], [data_inicio], [data_fim], [observacoes], [ativo], [editado_por_id], [created_at], [updated_at]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [RegistroDoseMedicamento_medicamento_id_idx] ON [dbo].[RegistroDoseMedicamento]([medicamento_id])
  INCLUDE ([registrado_por_id], [data_hora_administracao], [status_administracao], [observacoes], [created_at]);
