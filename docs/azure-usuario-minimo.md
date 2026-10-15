# Azure SQL: usuário mínimo de runtime

Guia para o Marcos. **Nada deste documento foi executado.** Os scripts abaixo nunca foram rodados contra o Azure; quem
roda é o Marcos, com a conta de admin, e cada passo que mexe no banco de produção exige a autorização dele (regra do
`CLAUDE.md`). Item 1 e item 2 de `docs/checklist-seguranca-producao.md` apontam para cá.

## O que o código prova (conferido no repo em 2026-10-15)

- Em `backend/src` (arquivos que não são teste) não há `$queryRaw`, `$executeRaw`, `$queryRawUnsafe`,
  `$executeRawUnsafe`, `Prisma.raw` nem `Prisma.sql`, e não há chamada a stored procedure (`CALL`, `EXEC`). Nenhuma
  exceção. `backend/src/infra/semSqlCru.test.ts` barra SQL cru em `src`.
- Em `backend/src` não há `child_process`, `execSync` nem chamada a `prisma migrate` ou `db push`.
- O Render roda `dockerCommand: npm start` (`render.yaml`), que é `node dist/index.js` (`backend/package.json`). O
  `Dockerfile` só roda `prisma generate` e `npm run build` na imagem, sem tocar no banco. O `render.yaml` diz que
  `migrate deploy` é manual, de uma máquina local.
- Conclusão: o runtime só faz SELECT, INSERT, UPDATE e DELETE pelo Prisma Client. Não executa DDL.
- **Não confirmado:** que o Prisma Client, com a conexão de um usuário só com `db_datareader` e `db_datawriter`, não
  precise de mais nada no Azure SQL. Isso só se confirma testando, com o roteiro de verificação abaixo e a aplicação
  usando o usuário novo (primeiro num banco de teste, se possível).

## Por que dois usuários

| Usuário | Onde fica a senha | Papéis | Para quê |
| --- | --- | --- | --- |
| admin (o atual) | só na máquina do Marcos | dono do banco | `npx prisma migrate deploy` (cria e altera tabelas) |
| `elder_app` | `DATABASE_URL` no painel do Render | `db_datareader`, `db_datawriter` | o backend em produção |

Motivo: se a `DATABASE_URL` do Render vazar (log, variável exposta, falha no backend), quem a tem só lê e escreve
linhas. Não cria nem apaga tabela, não muda permissão, não mexe em outros usuários. Por isso `elder_app` **não** entra
em `db_owner` nem em `db_ddladmin`.

Limite do desenho: `db_datareader` e `db_datawriter` ainda dão acesso a todos os dados, inclusive saúde e foto. Ele
reduz o dano de um vazamento da URL, não o elimina.

## Criar o usuário de runtime

Conecte no SSMS com a conta de admin, **no banco de produção** (não no `master`). Gere uma senha forte e longa em um
gerenciador de senhas. Não grave a senha em arquivo do repo.

```sql
CREATE USER elder_app WITH PASSWORD = '<SENHA_FORTE_GERADA>';
ALTER ROLE db_datareader ADD MEMBER elder_app;
ALTER ROLE db_datawriter ADD MEMBER elder_app;
```

É um usuário contido no banco (sem login no servidor). Ele só entra se a conexão informar o nome do banco.

Conferir os papéis (como admin):

```sql
SELECT dp.name AS usuario, r.name AS papel
FROM sys.database_role_members m
JOIN sys.database_principals r ON m.role_principal_id = r.principal_id
JOIN sys.database_principals dp ON m.member_principal_id = dp.principal_id
WHERE dp.name = 'elder_app';
```

Resultado esperado: duas linhas, `db_datareader` e `db_datawriter`, e nenhuma outra.

## Verificar o usuário

Conecte no SSMS como `elder_app` (em Opções, aba Propriedades da conexão, preencha "Conectar ao banco de dados" com o
nome do banco de produção). Rode tudo dentro de uma transação revertida:

```sql
BEGIN TRAN;

-- Devem funcionar (zero linhas afetadas, mas a permissão é checada).
UPDATE dbo.Usuario SET nome = nome WHERE 1 = 0;
DELETE FROM dbo.Usuario WHERE 1 = 0;
SELECT TOP 1 id FROM dbo.Usuario;

-- Permissão de INSERT (1 = tem):
SELECT HAS_PERMS_BY_NAME('dbo.Usuario', 'OBJECT', 'INSERT') AS pode_inserir;

-- Deve FALHAR por permissão negada:
CREATE TABLE dbo.teste_elder_app (id INT);

ROLLBACK;
```

Esperado: as três primeiras instruções rodam, `pode_inserir` vale 1 e o `CREATE TABLE` falha por falta de permissão.
Se o `CREATE TABLE` funcionar, **pare**: o usuário tem papel demais; remova com
`ALTER ROLE <papel> DROP MEMBER elder_app;` e revise. Se a tabela `teste_elder_app` existir, apague com
`DROP TABLE dbo.teste_elder_app;` como admin.

Um INSERT de linha real não está no roteiro de propósito: `Usuario` tem CHECKs e colunas obrigatórias, e inserir dado
de teste em produção é desnecessário. A consulta de permissão cobre o INSERT.

## Trocar o `DATABASE_URL` no Render

1. Copie e guarde a `DATABASE_URL` atual (a do admin) num lugar seguro. Ela é o caminho de volta.
2. Render, serviço `elder-web-backend`, aba Environment, variável `DATABASE_URL`, Edit.
3. Troque `user=` e `password=` pelos de `elder_app`. O resto fica igual, incluindo `encrypt=true` e
   `trustServerCertificate=false`. Formato:
   `sqlserver://<servidor>.database.windows.net:1433;database=<banco>;user=elder_app;password=<SENHA_FORTE_GERADA>;encrypt=true;trustServerCertificate=false`
   (Não confirmado: se o Azure pede `elder_app@<servidor>` no `user=` para usuário contido. Se o login falhar, teste
   essa forma.)
4. Salve. O Render reinicia o serviço.
5. Confira `/health` e faça um login e uma leitura de saúde pela tela. Veja os logs do Render: não deve haver erro de
   permissão (mensagem do SQL Server sobre permissão negada).

### Reverter se algo quebrar

1. Render, Environment, `DATABASE_URL`, Edit: cole de volta a URL do admin guardada no passo 1.
2. Salve e espere o reinício; confira `/health`.
3. Só depois investigue a causa (permissão faltando, formato do `user=`, firewall).

## Aviso sobre migrations

Depois da troca, `npx prisma migrate deploy` **continua exigindo a URL do admin**, na máquina local do Marcos, com
`DATABASE_URL` sobrescrita só naquele comando. `elder_app` não tem DDL e a migration falha com ele. Nunca coloque a URL
do admin no Render. A regra do `CLAUDE.md` segue valendo: aplicar migration no Azure exige autorização explícita e
separada do Marcos a cada migration.

## Firewall do Azure

Só fatos e uma decisão que **ainda é do Marcos**. Este documento não decide nada aqui.

- O Render não é um serviço do Azure. A opção "Allow Azure services and resources to access this server" **não**
  cobre o Render.
- O Render usa faixas de IP de saída compartilhadas por região. Elas aparecem no painel do serviço, em Connect,
  Outbound.
- Qualquer IP da faixa pode ser usado nas conexões de saída. Por isso uma regra de firewall teria que cobrir os
  blocos CIDR inteiros, não um IP isolado.
- A documentação do Render não afirma que as faixas padrão nunca mudam. **Não confirmado** que elas sejam estáveis.
- Hoje a regra do Azure está aberta de propósito (0.0.0.0 a 255.255.255.255), por causa desse ponto (item 2 do
  checklist).

Decisão pendente do Marcos: manter a regra aberta (aceitando o risco, com o usuário mínimo como mitigação) ou trocar
pelos blocos CIDR do Render e assumir a manutenção quando mudarem.
