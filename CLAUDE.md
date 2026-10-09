# Elder Web — Guia do Projeto

## Contexto
Aplicação **web** para apoiar idosos, cuidadores e familiares no gerenciamento
de saúde e rotina diária. TCC do Curso Técnico em Desenvolvimento de Sistemas
— Etec Fernando Prestes, 2026.

**Importante:** o projeto não é feito para nem será implantado no Lar São
Vicente de Paulo. Essa instituição foi entrevistada apenas como fonte de
dados/levantamento de requisitos para embasar o TCC — não há relação de
cliente ou deploy com ela. Trate qualquer menção a ela nos documentos como
contexto de pesquisa, não como especificação de destino do produto.

**Fonte de verdade do escopo de funcionalidades: o plano de desenvolvimento
atualizado, não o PDF do TCC.** O PDF ainda descreve um app mobile com Alexa,
mensagens e loja — tudo isso foi removido. Se houver conflito entre o PDF e o
que está descrito abaixo, o que está abaixo vence.

**Fonte de verdade do modelo de dados (ER): `Elder Web - Modelagem ER.md`, não a
seção 2.5.2 do PDF do TCC.** O ER.md está mais atualizado que o PDF neste
momento — é uma inversão temporária, o PDF será sincronizado com esse modelo
em breve. Até lá, trate o ER.md como a referência canônica de trabalho para
entidades, atributos e relacionamentos.

**Caminhos locais (máquina do Marcos) dos documentos-fonte, fora deste repo —
cofre Obsidian:**
- Plano de desenvolvimento (fonte de verdade do escopo, ver acima):
  `C:\Users\Marcos Castelli\Documents\Notas\TCC - Elder Web\Elder Web - Plano de
  Desenvolvimento.md`
- Cofre Obsidian do projeto (ER.md e demais notas do TCC):
  `C:\Users\Marcos Castelli\Documents\Notas\TCC - Elder Web`

Existe um protótipo antigo em https://github.com/MixuriM/Prototipo-Elder-App
(mobile, hospedado via GitHub Pages). Ele é **apenas referência visual** — não
reaproveitar código dele. Este é um repositório novo, do zero.

## Perfis de usuário
Três perfis com login/cadastro próprios: **idoso**, **cuidador**, **familiar**.
- Cuidador só tem acesso às ferramentas da interface de cuidador depois de
  vinculado formalmente a um idoso — não antes.
- Interface do idoso deve priorizar acessibilidade acima de qualquer outra
  preocupação de design (ver seção Acessibilidade).

## Escopo funcional (fonte: plano de desenvolvimento)
**Removido em relação ao PDF antigo:** integração com Alexa, mensagens, loja/shop.

**Modificado:**
- Módulo de saúde passa a ser editável (era só leitura)
- Homecare/cuidador perde o feed
- Configurações reformuladas do zero
- Estrutura geral migrada de app para web
- Acessibilidade pra idosos reforçada em toda a interface

**Adicionado:** calendário/agenda, histórico de remédios e saúde (com opção de
download do histórico), página "sobre nós", módulo de alimentação, cadastro e
login para os 3 perfis, interface dedicada de cuidador.

## Stack técnica
- **Frontend:** React + TypeScript + Vite + Tailwind CSS + React Router
  (obrigatório — é multi-página web, não SPA de tela única)
- **Backend:** Node.js + Express + TypeScript + Prisma (ORM)
- **Banco de dados:** SQL Server 2025 (usuários, saúde, medicação)
- **Autenticação:** Firebase Auth (Firebase Web SDK) — só login/autenticação,
  não armazena dados de domínio
- **Testes:** Jest + React Testing Library; Playwright (e2e) se der tempo
- **Acessibilidade:** ARIA + HTML semântico — requisito não funcional central,
  dado o público idoso. axe-core como auditoria automática, se der tempo
- **Infra:** Docker (containeriza backend + SQL Server), Git + GitHub,
  GitHub Actions

## Infraestrutura de produção
Decisão fechada pelo grupo (Marcos, Laureane, Jennifer): onde cada parte da
aplicação roda em produção.

- **Banco de dados:** Azure SQL Database (confirmado em 2026-10-06, item 9.2: `EngineEdition` 5, TDE ativo com
  chave gerenciada pelo serviço, TLS mínimo 1.2 no portal). A `DATABASE_URL` de produção usa `encrypt=true` e
  `trustServerCertificate=false`.
- **Backend:** Render.
- **Frontend:** Vercel.

Deploy configurado e no ar: o backend roda no Render (plano free, runtime Docker, `backend/Dockerfile`,
`dockerCommand: npm start`, `healthCheckPath: /health`; as variáveis estão em `render.yaml`, com os segredos em
`sync: false` e definidos no dashboard) e o frontend no Vercel (`frontend/vercel.json`, rewrite para `index.html`).
Migrations são aplicadas à mão, de uma máquina local, antes do deploy.

## Arquitetura de autenticação (Firebase Auth + SQL Server)
Decisão travada — não reabrir sem discutir com o grupo.

- `firebase_uid` **não** é chave primária em nenhuma tabela. É uma coluna
  `UNIQUE` na tabela `Usuario` (índice único **filtrado**, `WHERE firebase_uid
  IS NOT NULL` — mesmo padrão de `email`), que tem seu próprio `id` interno
  (PK). Todo o resto do banco referencia `Usuario.id`, nunca `firebase_uid`
  diretamente — isola a dependência do Firebase numa única coluna.
  `firebase_uid` é **nullable**: só pode ser `NULL` quando `cadastrado_por_id`
  está preenchido (idoso cadastrado por familiar via RF-030, sem login
  Firebase próprio ainda) — `CK_Usuario_firebase_uid_cadastrado_por` garante
  isso a nível de banco. Autocadastro sempre passa por `/auth/sync` com token
  Firebase, então sempre tem `firebase_uid` preenchido.
- Fluxo: frontend loga via Firebase Web SDK → obtém ID Token (JWT) → manda
  pro backend em `POST /auth/sync` → backend valida o token com o
  **Firebase Admin SDK** (biblioteca server-side, diferente do SDK do
  frontend) → busca `Usuario` por `firebase_uid`; se não existir, cria (é
  aqui que `tipo_perfil` é definido, com base na escolha feita no cadastro).
- Toda requisição autenticada subsequente manda o ID Token no header
  `Authorization`; um middleware Express valida o token e resolve o `id`
  interno a partir do `firebase_uid`.
- `Vinculo` é uma tabela genérica que cobre tanto cuidador↔idoso quanto
  familiar↔idoso (não são tabelas separadas):

_(Modelo simplificado/ilustrativo — ver `Elder Web - Modelagem ER.md` seções 1–2
para a estrutura completa, incluindo campos de auditoria e do fluxo de
confirmação por e-mail.)_

```
Vinculo
  id
  idoso_id       (FK -> Usuario.id)
  vinculado_id   (FK -> Usuario.id)   -- o cuidador ou o familiar
  tipo_vinculo   (enum: 'cuidador' | 'familiar')
  origem         (enum: 'solicitacao_cuidador' | 'convite_idoso' |
                        'solicitacao_familiar' | 'cadastro_familiar')
  status         (enum: 'pendente' | 'aprovado' | 'recusado')
  aprovador_id   (FK -> Usuario.id, nullable)
  criado_em
  -- + 3 flags de permissão do cuidador (ver abaixo)
```

- **Aprovação de vínculo não é sempre manual.** Para **cuidador**, é sempre
  aprovação manual (`aprovador_id` humano). Para **familiar**, depende de quem
  iniciou o vínculo: se veio de convite do idoso (`convite_idoso`) ou de
  cadastro feito pelo familiar (`cadastro_familiar`), a aprovação é automática
  por confirmação de posse do e-mail; se veio de solicitação do familiar
  (`solicitacao_familiar`), é aprovação manual como no caso do cuidador.
- **Autoridade de aprovação/recusa/contestação de vínculo segue
  `Usuario.modo_decisao`.** Em toda ação manual sobre `Vinculo` (RF-021,
  RF-022, RF-027), incluindo contestar um vínculo automático já `aprovado`
  (RF-022, Fluxo A, via `notificado_em`), quem tem autoridade pra agir é o
  mesmo campo que já controla as 3 flags de permissão do Cuidador:
  `modo_decisao='idoso'` → só o idoso; `modo_decisao='familiar'` → só
  familiar(es) com vínculo aprovado, idoso recebe 403. Não é o Idoso e o
  Familiar decidindo em paralelo sempre, é sempre um dos dois com a caneta.
  Mecanismo completo em `Elder Web - Modelagem ER.md` seção 3.
- **Permissões granulares do cuidador.** Cada vínculo de cuidador tem 3 flags
  (`permite_registrar_saude`, `permite_marcar_dose`,
  `permite_criar_evento_cuidado`), todas nascendo `false`. Quem tem autoridade
  para ligá-las é `Usuario.modo_decisao` do idoso (`'idoso'` ou `'familiar'`),
  com transferência de autoridade sujeita a salvaguardas (janela de carência,
  possível segunda confirmação). Mecanismo completo em
  `Elder Web - Modelagem ER.md` seção 3.

## Estrutura de pastas (proposta — ver lacuna abaixo)

```
elder-web/
  frontend/          # React + Vite + TS
  backend/            # Node + Express + TS + Prisma
  .vscode/
    extensions.json
  .github/
    workflows/
  docs/               # historico-implementacao.md (consulta sob demanda)
  docker-compose.yml
  CLAUDE.md
```

## Build and Test
- Frontend dev: `npm run dev` (dentro de `frontend/`)
- Backend dev: `npm run dev` (dentro de `backend/`)
- Frontend test: `npm test` (dentro de `frontend/`)
- Backend test: `npm test` (dentro de `backend/`); com cobertura: `npm run test:coverage` (é o que o CI roda)

`backend/src/index.ts` foi dividido em `app.ts` (monta e exporta o Express app)
e `index.ts` (só chama `app.listen`) especificamente para viabilizar Supertest
— qualquer teste de rota deve importar de `./app`, nunca de `./index`.
O frontend usa Babel (`babel.config.cjs`) só no transform de teste do Jest,
não no build (que continua Vite/`tsc`) — necessário porque Jest não entende
`import.meta.env` nativamente.

## Code Style
- TypeScript em modo estrito (frontend e backend)
- React funcional com Hooks, componentes pequenos e de responsabilidade única
- Tailwind CSS utility-first
- Prisma schema como fonte única de verdade do modelo de dados
- Fontes grandes, alto contraste, áreas de toque generosas, feedback claro
  após cada ação — não é opcional, é requisito de projeto

## Workflow
- **Divisão de trabalho do grupo:** o backend está concluído (Marcos). O frontend
  é feito pelo grupo todo (Marcos, Laureane, Jennifer). O Claude Code implementa
  telas completas quando o prompt pedir, seguindo o padrão de acessibilidade do
  projeto. Ainda vale avisar o grupo quando um arquivo de tela mudar de
  comportamento ou de contrato HTTP.
- **Antes de qualquer alteração (código, docs, config), sempre conferir em qual
  branch está** (`git branch --show-current` ou `git status`). Toda adição/mudança
  vai por padrão na branch `development` — só usar outra branch quando o usuário
  pedir explicitamente. Se já estiver numa branch diferente sem pedido explícito
  pra isso, trocar para `development` antes de começar (confirmando antes se
  houver mudanças não commitadas na branch atual).
- Planejar a estrutura antes de criar múltiplos arquivos/componentes de uma vez
- Pode criar pastas e arquivos livremente durante o scaffold inicial
- **Sempre pedir confirmação antes de**: `git init`, `git remote add`,
  `git push`, criação de branch nova (`git checkout -b`, `git branch`), e
  qualquer instalação de dependência (`npm install` etc.)
- Este projeto desativa o link de sessão (`Claude-Session:`) em mensagens de
  commit via `attribution.sessionUrl: false` em `.claude/settings.json`
  (escopo de projeto, já commitado). Não reverter essa configuração nem
  substituí-la por uma versão só pessoal (`~/.claude/settings.json`) — o
  objetivo é valer pra todo o grupo e para sessões cloud/web também.
- Nunca inserir dados fake sem sinalizar claramente que são fake
- Não reaproveitar nenhum código do protótipo antigo — só olhar como referência
- Não usar a extensão Claude in Chrome neste projeto

## Lacunas em aberto — NÃO decidir sozinho, perguntar ao grupo
- Estrutura de pastas (`frontend/` + `backend/` monorepo) confirmada pelo
  grupo (Marcos, Laureane, Jennifer) — não reabrir.
- Risco de colisão de e-mail entre contas: tratado no código (`/auth/sync` responde 409, item 3.2); registrar
  no `Elder Web - Modelagem ER.md` (até a REV.9 sem registro) fica com o Marcos, ver Decisões fechadas.

**Riscos aceitos conscientemente (não é pendência técnica):** consentimento
do idoso quando a conta é criada por um familiar, perda progressiva de
capacidade do idoso após autocadastro, e a janela de autoridade vazia entre o
cadastro de um idoso via RF-030 e a confirmação de e-mail do Familiar
cadastrante (nessa janela, nenhum vínculo novo de Cuidador ou de outro
Familiar pode ser aprovado). O grupo decidiu não mitigar tecnicamente além de
certo ponto — ver `Elder Web - Modelagem ER.md` seção 5.2 para o raciocínio
completo.

**Decisões fechadas (não reabrir):** não existe tabela `Instituicao` no modelo
de dados — removida do escopo. A funcionalidade de microfone foi excluída
definitivamente do produto. `tipo_perfil` é fixo e único por conta, sem
hibridismo de papéis. A cardinalidade idoso↔cuidador/familiar é N:N. Permissão
granular do cuidador por vínculo (RF-032, os 3 flags `permite_*` de `Vinculo`),
em vez de uma variante global de acesso, e `RegistroSaude.editado_por_id`
obrigatório (RNF-006) — confirmados pelo grupo (Laureane e Jennifer). O modelo
de dados completo e validado (7 entidades: Usuario, Vinculo, Evento,
Medicamento, RegistroDoseMedicamento, RegistroSaude, RegistroAlimentar) está
descrito em `Elder Web - Modelagem ER.md` — ver nota no início deste arquivo
sobre a relação temporária desse documento com o PDF do TCC. A supressão do
link `Claude-Session:` via `attribution.sessionUrl` (ver seção Workflow) também
é decisão fechada — não é pendência técnica em aberto. `backend/prisma/migrations/migration_lock.toml`
deve permanecer com `provider = "mssql"`, mesmo o datasource em `schema.prisma` usando
`provider = "sqlserver"` — não é erro nem legado esquecido. Na versão do Prisma instalada
(5.22.0), o migration engine espera literalmente "mssql" como identificador do connector SQL
Server nesse arquivo; trocar para "sqlserver" quebra `prisma migrate status` com erro P3019
(testado e revertido). Referência: prisma/prisma#12087 (o próprio Prisma reconhece essa
inconsistência e pretende unificar em versão futura — não decidir isso sozinho antes de
discutir upgrade de dependência com o grupo).


## Convenções e regras técnicas estabelecidas
Resumo do que o histórico de implementação consolidou. Detalhes e justificativas em
`docs/historico-implementacao.md`.

**Banco e migrations**
- Usar `npx prisma migrate deploy`, nunca `migrate dev` contra o Azure (o Azure SQL
  recusa criar shadow database, erro P3020).
- Migrations com CHECK são escritas à mão. Se a CHECK usa coluna adicionada no mesmo
  batch, ela vai dentro de `EXEC('...')` (senão o SQL Server dá erro 207).
- **Aplicar migration no Azure de produção exige autorização explícita e separada do
  Marcos, a cada migration.** Autorização anterior não vale para a próxima.
- Scripts `backend/scripts/verify-*.ts` rodam em transação sempre revertida. Por padrão
  só contra o SQL Server local (`docker-compose.yml`, `localhost:14330`), com
  `DATABASE_URL` sobrescrita no comando, nunca no `.env` (o `.env` aponta para o Azure).
  Contra o Azure, só com autorização explícita. O e2e também roda só contra o local.
- Scripts `backend/scripts/smoke-*.ts` são só leitura, rodam à mão (fora do CI) e nunca imprimem corpo de
  resposta, `DATABASE_URL`, usuário, senha, token nem erro bruto do Prisma. `smoke-tde-azure.ts` só conecta a host
  não local com `--confirmo-azure`, e só com autorização do Marcos naquele momento.

**Segurança e privacidade (RegistroSaude é dado sensível, RNF-001)**
- Nenhum `console.*`, corpo de erro ou log pode conter valores de saúde. O `errorHandler`
  de `app.ts` loga só `name`, `code`, método e `req.path`, nunca `message`, `stack`,
  `req.body` nem `req.query`. Não adicionar biblioteca de log sem discutir.
- `DEBUG=prisma:*` faz o Prisma imprimir os args das queries (vaza). Nunca definir
  `DEBUG` nem `PRISMA_*` no Render. Passar `log` ao `PrismaClient` também vazaria.
- Todo middleware ou handler async precisa de `try/catch` com `next(e)`. O Express 4.21
  não captura rejeição de async e o Node 24 derruba o processo.
- O idoso alvo de uma operação vem de `req.vinculoAprovado.idoso_id` (vínculo), nunca de
  path ou body. Autoria (`registrado_por_id`, `editado_por_id`) nunca vem do body.
- Registro inexistente e registro de outro idoso respondem o mesmo 404 (um 403 separado
  vazaria a existência). 403 é genérico e nunca cita `modo_decisao`.
- `modo_decisao`: sempre ler via `resolverModoDecisao` (honra transferência vencida),
  nunca a coluna direto. `NULL` vale `'idoso'`.
- `requireVinculoAprovado` não filtra `tipo_vinculo`. Isso só é seguro enquanto
  `tipo_vinculo` for amarrado ao `tipo_perfil` fixo na criação do vínculo. Qualquer novo
  fluxo de criação de vínculo precisa manter essa garantia.
- Foto de perfil é BLOB no SQL Server. `GET /usuario/me` não devolve foto (há
  `GET /usuario/me/foto` separado). Respostas de `/auth/sync` passam por `semFotoPerfil`
  e `requireAuth` usa `select` mínimo, para não carregar o BLOB à toa.
- Medicamento também é dado sensível (mesmas regras de log de `RegistroSaude`). Cuidador
  nunca cria medicamento (regra fixa de ator, independe das flags `permite_*`). Familiar só
  cria com `modo_decisao` efetivo `'familiar'` (via `resolverModoDecisao`).

**Testes**
- TDD: escrever o teste antes, confirmar RED, depois implementar. Fakes de Prisma devem
  filtrar de verdade pelo `where` (senão testes de acesso cruzado passam por vacuidade).
  Para regras de segurança, validar com mutação local (quebrar o código, ver o teste
  falhar, reverter).
- Testes de rota importam de `./app`, nunca de `./index`.
- `jest-axe` não calcula contraste em jsdom; o contraste é auditado por `npm run test:a11y` (Playwright, local, fora do
  CI; exige SQL Server local e `MSSQL_SA_PASSWORD`, senão o spec trava). `#6C63FF` sólido reprova sobre branco: usar
  `#5F56EC` em `text-`/`bg-` e `#554CD8` no hover com texto branco.
- A matriz `backend/src/testSupport/matrizAcessoLeitura.ts` é compartilhada por `saudeHistorico` e
  `remediosHistorico`. Toda nova rota de leitura por vínculo deve entrar nela.
- O e2e cria contas `e2e-*@e2e.elderweb.test` no Firebase real, sem limpeza automática.
- Em merge por rebase os hashes de commit mudam. Não tratar hash de commit local como
  definitivo.

**Frontend e grupo**
- Mudou contrato HTTP ou mexeu em arquivo de tela da Laureane ou da Jennifer: avisar as
  duas fica com o Marcos (lembrar ele ao concluir a tarefa).

## Decisões em aberto e pendências conhecidas
Decisões marcadas "fechada" foram tomadas por Claude sob delegação explícita do Marcos em 2026-10-04
("decisão do grupo"); reabrir só se o grupo mandar. Pendências manuais ficam com o Marcos.

**Pendências manuais (Marcos)**
- Avisar Laureane e Jennifer (contrato novo do 5.4: `GET /historico/pdf`, `GET /historico/idoso/:idosoId/pdf`,
  `lib/baixarPdf.ts`, seção nova em `Remedios.tsx`).
- Avisar Laureane e Jennifer do PR #143 (9.1, cores em ~50 telas; Home mais escura). Resolvidos na `development` (2026-10-08):
  `heading-order`, 2 `h1`, 9px do `Sidebar`. Sobra: 50 `ring-` de foco com opacidade (35 `focus:`, 15 `focus-visible:`).
- Render (9.2): Secret Files e grupos de ambiente vinculados do `elder-web-backend` ainda não vistos.

**Decisões fechadas**
- `backend/Dockerfile` mantém `CMD ["npm", "run", "dev"]` (uso local via `docker-compose.yml`, com volume e
  `tsx watch`); o Render usa `dockerCommand: npm start` (`render.yaml`). `NODE_ENV=production` definido só no
  `render.yaml`. `backend/.dockerignore` criado (`node_modules`, `dist`, `.env*` menos `.env.example`): o
  `COPY . .` não leva mais `.env`, `.env.azure` nem o `node_modules` do host para a imagem.
- Auditoria do valor sobrescrito em edição de saúde (RNF-006): aceito como risco, sem tabela de auditoria.
- Aceite de termos de uso e política de privacidade no cadastro (LGPD): fora do escopo do TCC (sem RF no plano);
  registrado como trabalho futuro (exigiria RF, migration e tela).
- Exclusão de registro, paginação e filtros dos históricos (saúde, remédios, PDF): fora do escopo; volume do TCC
  não justifica. O PDF é montado em memória, sem limite (aceito); fora de Latin-1 vira `?` (aceito).
- Dose (5.2): sem idempotência no servidor (o frontend desabilita o botão durante o envio; duplicata aceita); o
  CHECK de `status_administracao` é case-insensitive (collation) e só a rota barra `'ADMINISTRADO'`: aceito, sem
  migration. Histórico de remédios mostra só ids de autor, sem nome (aceito).
- `modo_decisao` NULL de idosos autocadastrados antes da mudança: sem backfill. O resolver já trata `NULL` como
  `'idoso'`, então nada muda no comportamento e o backfill exigiria tocar o Azure sem ganho.
- Foto do Google não é semeada no fluxo de anexo do item 3.3: o idoso anexado por e-mail e senha não tem foto
  Google; a foto vem só do upload no perfil.
- Risco de colisão de e-mail entre contas: tratado no código, `/auth/sync` responde 409 (`CONFLITO_EMAIL`, item
  3.2) quando o e-mail já está em uso. Registrar isso no `Elder Web - Modelagem ER.md` fica com o Marcos.
- Resolvidos em 2026-10-04: JSON malformado e corpo acima do limite agora respondem 400 e 413 fixos no
  `errorHandler` (sem eco do corpo, sem log); `nome` em branco no corpo de `/auth/sync` não vence mais o `name` do
  token do Google (aparado; em branco nos dois dá 400).
- Agenda (6.1): nenhuma biblioteca de calendário; o 6.3 será lista agrupada por dia. Familiar só cria evento com
  `modo_decisao` efetivo `'familiar'` (via resolver), como em 5.1 e 5.2. Sem idempotência nem checagem de
  sobreposição (aceito).
- Agenda (6.3): todos os atores veem os 3 tipos, sem filtro por tipo nem autor (cuidador e familiar veem
  compromissos pessoais, aceito). Fuso fixo `America/Sao_Paulo` via `Intl` com `timeZone` explícito, nunca o do
  navegador. Evento aparece uma vez, no dia do início; o fim mostra a data se cair em outro dia. "Ver agenda" sempre
  visível, `fetch` direto (não `chamarApi`) com mensagens fixas por status; passados em `<details>` fechado.
- Agenda (6.2, fechadas por Claude sob delegação do Marcos em 2026-10-04): sem rota nova, `POST /agenda/idoso/:idosoId`
  ganhou o ramo do cuidador; `POST /agenda` (idoso) segue 403 para cuidador. Cuidador cria só `cuidado`, exigindo
  `tipo_vinculo` E `tipo_perfil` `'cuidador'` E `permite_criar_evento_cuidado === true` (estrito; as outras flags não
  abrem); `resolverModoDecisao` nunca é chamado para cuidador. `pessoal`/`medico` pelo cuidador dão 403; tipo ausente,
  não string, caixa diferente ou fora da CHECK dá 400; idoso e familiar seguem sem criar `cuidado` (403). Ordem para
  cuidador: 403 de vínculo, 403 de ator ou flag, 400 de tipo, 403 de tipo, 400 de campos (sem a flag, corpo inválido
  dá 403). Campos e limites iguais aos do 6.1 (mesma função de validação, parametrizada por ator). Frontend não sabe
  se o cuidador tem a flag: a seção do cuidador sempre aparece e o 403 vira mensagem (limitação aceita).
- Item 9.3: pendência de `pdfjs-dist` (`canvas` opcional sem binário) e dos 3 avisos de `npm audit` só de dev encerrada
  como aceita; sem `npm audit` no CI (`--omit=dev` dá 0).
- Item 9.4 (D1 a D9, fechadas): o item só vai a ✅ com o CI remoto verde num push em `development`; sem dependência
  nova; código de produção só muda se um teste novo provar furo real de autorização (RED, correção mínima, commit
  `fix(auth):` separado; 400 antes de 403 não é furo); testes com Prisma mockado (não prova o filtro do SQL Server
  real, aceito); `npm test` segue `jest` e o CI roda `npm run test:coverage` no lugar dele; CI em push de todas as
  branches mais PR para `main`, com `concurrency` (execução duplicada aceita); limiares = floor(medido) menos 1
  (routes 95/92/99/96, middleware 99; metas mínimas 85/75/85/85 e 90/80/90/90); mutação local vale como RED em
  teste de caracterização; regra de ator vem do código (cuidador nunca cria medicamento nem refeição, familiar só com
  `modo_decisao` efetivo `'familiar'`, flag exata e estrita).

**Itens implementados (resumo; detalhes, PRs e hashes no histórico)**
- 5.2 marcar dose, 5.3 histórico de remédios, 5.4 PDF do histórico. Familiar só marca dose com `modo_decisao` efetivo
  `'familiar'` (via resolver). Leituras (`GET /remedios*`, PDF): vínculo aprovado basta. PDF montado inteiro em
  memória (`lib/historicoPdf.ts`, pdfkit) antes de enviar; nunca fazer pipe.
- 6.1 a 6.3 agenda (RF-015 a RF-017, RNF-003): `routes/agenda.ts`; idoso e familiar criam `pessoal` e `medico`,
  cuidador só `cuidado` (decisões do 6.2 acima); leituras com vínculo aprovado. `lib/agendaPorDia.ts`. Teste de fuso
  por subprocesso `node` com `TZ` real (exige Node 22.18 ou superior; `process.env.TZ` no Jest é cópia e não vale).
- 7.1 e 7.2 alimentação (RF-018, RF-019): `routes/alimentacao.ts`. Cuidador nunca cria (403, resolver nunca chamado);
  familiar só com `modo_decisao` efetivo `'familiar'`; `refeicao` com 6 valores só na aplicação, `descricao` 1 a 500
  (dado sensível); leitura com vínculo aprovado, ordem `data_hora` e `id` decrescentes.
- 8.1 "Sobre Nós" (`/sobre-nos`, pública) e 8.2 Orientações (`/orientacoes`, dentro de `RotaProtegida`): conteúdo
  provisório, texto final é da Laureane e da Jennifer.
- 9.1 auditoria axe (RNF-007): jest-axe em 9 telas e Playwright (`npm run test:a11y`, local); falha só em
  critical/serious.
- 9.2 TLS e criptografia em repouso (RNF-002): `middleware/hsts.ts` (`max-age=31536000` só com `NODE_ENV=production`,
  sem `includeSubDomains` nem `preload`) e `scripts/smoke-*.ts`. Redirect HTTP para HTTPS é do Render; TDE só
  verificado (ativo, chave gerenciada pelo serviço).
- 9.3 CI builda a imagem do backend (RNF-010): último passo do job `backend`, sem publicar nem executar a imagem
  (pega erro de build, não de boot). Teste `backend/src/infra/dockerCi.test.ts`.
- 9.4 suíte de autorização no CI (RNF-003): `routes/autorizacaoRotas.test.ts` enumera as rotas de `app._router.stack`
  e compara com `ROTAS_ESPERADAS` (rota nova sem classificação falha). Também limiares de cobertura; sem furo achado.
- Os `backend/scripts/verify-rotas-*.ts` NÃO revertem por transação (rota, Prisma e banco reais, só o token Firebase é
  substituído): limpam por sentinela no `finally` e recusam rodar fora de `localhost`; `firebase_uid` com prefixo
  `verify-dose-`, `verify-hist-` ou `verify-pdf-` marca conta residual se o processo morrer no meio.

## Histórico de implementação
O diário por tarefa (itens das Fases 1 a 4, bugs achados, testes, limitações, hashes)
está em `docs/historico-implementacao.md`. **Não ler por padrão.** Consultar só quando a
tarefa tocar uma feature já implementada e for preciso entender como e por que ela foi
feita. Ao concluir uma tarefa, registrar o resumo lá, não aqui. Este arquivo deve ficar
abaixo de 30k caracteres.
