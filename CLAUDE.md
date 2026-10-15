# Elder Web — Guia do Projeto

## Contexto
Aplicação **web** para apoiar idosos, cuidadores e familiares no gerenciamento
de saúde e rotina diária. TCC do Curso Técnico em Desenvolvimento de Sistemas
— Etec Fernando Prestes, 2026.

**Importante:** o projeto não é feito para nem será implantado no Lar São
Vicente de Paulo. Essa instituição foi entrevistada apenas como fonte de
dados/levantamento de requisitos para embasar o TCC, sem relação de cliente ou
deploy. Menções a ela nos documentos são contexto de pesquisa, não destino do produto.

**Fonte de verdade do escopo de funcionalidades: o plano de desenvolvimento
atualizado, não o PDF do TCC.** O PDF ainda descreve um app mobile com Alexa,
mensagens e loja — tudo isso foi removido. Se houver conflito entre o PDF e o
que está descrito abaixo, o que está abaixo vence.

**Fonte de verdade do modelo de dados (ER): `Elder Web - Modelagem ER.md`, não a
seção 2.5.2 do PDF do TCC.** Inversão temporária: o PDF será sincronizado com o
ER.md, que até lá é a referência canônica de entidades, atributos e relacionamentos.

**Caminhos locais (máquina do Marcos) dos documentos-fonte, fora deste repo —
cofre Obsidian:**
- Plano de desenvolvimento (fonte de verdade do escopo, ver acima):
  `C:\Users\Marcos Castelli\Documents\Notas\TCC - Elder Web\Elder Web - Plano de
  Desenvolvimento.md`
- Cofre Obsidian do projeto (ER.md e demais notas do TCC):
  `C:\Users\Marcos Castelli\Documents\Notas\TCC - Elder Web`

Protótipo antigo (mobile, GitHub Pages): https://github.com/MixuriM/Prototipo-Elder-App. É **só referência
visual**; este repositório é novo, sem código dele.

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

- **Banco de dados:** Azure SQL Database (item 9.2: TDE com chave do serviço, TLS mínimo 1.2). A `DATABASE_URL` de
  produção usa `encrypt=true` e `trustServerCertificate=false`.
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

_(Ilustrativo; estrutura completa em `Elder Web - Modelagem ER.md` seções 1 e 2.)_

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
  aprovação manual (`aprovador_id` humano; em `convite_idoso`, o cuidador ao aceitar). Para **familiar**, depende de quem
  iniciou o vínculo: se veio de convite do idoso (`convite_idoso`, só familiar) ou de
  cadastro feito pelo familiar (`cadastro_familiar`), a aprovação é automática
  por confirmação de posse do e-mail; se veio de solicitação do familiar
  (`solicitacao_familiar`), é aprovação manual como no caso do cuidador.
- **Autoridade de aprovação/recusa/contestação de vínculo segue
  `Usuario.modo_decisao`.** Em toda ação manual sobre `Vinculo` (RF-021,
  RF-022, RF-027), incluindo contestar um vínculo automático já `aprovado`
  (RF-022, Fluxo A, via `notificado_em`), quem tem autoridade pra agir é o
  mesmo campo que já controla as 3 flags de permissão do Cuidador:
  `modo_decisao='idoso'` → só o idoso; `modo_decisao='familiar'` → só
  familiar(es) com vínculo aprovado, idoso recebe 403 (nunca os dois em paralelo).
  Mecanismo completo em `Elder Web - Modelagem ER.md` seção 3.
- **Permissões granulares do cuidador.** Cada vínculo de cuidador tem 3 flags
  (`permite_registrar_saude`, `permite_marcar_dose`,
  `permite_criar_evento_cuidado`), todas nascendo `false`. Quem tem autoridade
  para ligá-las é `Usuario.modo_decisao` do idoso (`'idoso'` ou `'familiar'`),
  com transferência sujeita a salvaguardas (carência, possível segunda confirmação). Ver ER.md seção 3.

## Estrutura de pastas (confirmada pelo grupo, não reabrir)

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

`backend/src/app.ts` monta e exporta o Express app; `index.ts` só chama `app.listen` (para o Supertest). O frontend
usa Babel (`babel.config.cjs`) só no transform do Jest, que não entende `import.meta.env`; o build segue Vite/`tsc`.

## Code Style
- TypeScript em modo estrito (frontend e backend)
- React funcional com Hooks, componentes pequenos e de responsabilidade única
- Tailwind CSS utility-first
- Prisma schema como fonte única de verdade do modelo de dados
- Fontes grandes, alto contraste, áreas de toque generosas, feedback claro
  após cada ação — não é opcional, é requisito de projeto

## Workflow
- **Divisão de trabalho do grupo:** backend concluído (Marcos); frontend é do grupo todo (Marcos, Laureane,
  Jennifer). O Claude Code implementa telas completas quando o prompt pedir, no padrão de acessibilidade do projeto
  (aviso ao grupo: ver "Frontend e grupo").
- **Antes de qualquer alteração (código, docs, config), conferir a branch** (`git branch --show-current`). Padrão:
  `development`; outra só a pedido explícito. Se estiver em outra sem pedido, trocar para `development` antes de
  começar (confirmando antes se houver mudanças não commitadas).
- Planejar a estrutura antes de criar múltiplos arquivos/componentes de uma vez
- Pode criar pastas e arquivos livremente durante o scaffold inicial
- **Sempre pedir confirmação antes de**: `git init`, `git remote add`,
  `git push`, criação de branch nova (`git checkout -b`, `git branch`), e
  qualquer instalação de dependência (`npm install` etc.)
- `attribution.sessionUrl: false` em `.claude/settings.json` (projeto, commitado) tira o link `Claude-Session:` dos
  commits. Não reverter nem trocar por versão pessoal: vale para o grupo e para sessões cloud/web.
- Nunca inserir dados fake sem sinalizar claramente que são fake
- Não reaproveitar nenhum código do protótipo antigo — só olhar como referência
- Não usar a extensão Claude in Chrome neste projeto

## Lacunas em aberto — NÃO decidir sozinho, perguntar ao grupo
Nenhuma no momento (colisão de e-mail entre contas: ver Decisões fechadas).

**Riscos aceitos conscientemente (não é pendência técnica):** consentimento do idoso quando a conta é criada por
um familiar, perda progressiva de capacidade do idoso após autocadastro, e a janela de autoridade vazia entre o
cadastro de um idoso via RF-030 e a confirmação de e-mail do Familiar cadastrante (nela, nenhum vínculo novo de
Cuidador ou de outro Familiar pode ser aprovado). Sem mitigação técnica além disso: `Elder Web - Modelagem ER.md` 5.2.

**Decisões fechadas (não reabrir):** não existe tabela `Instituicao` no modelo
de dados — removida do escopo. A funcionalidade de microfone foi excluída
definitivamente do produto. `tipo_perfil` é fixo e único por conta, sem
hibridismo de papéis. A cardinalidade idoso↔cuidador/familiar é N:N. Permissão
granular do cuidador por vínculo (RF-032, os 3 flags `permite_*` de `Vinculo`),
em vez de uma variante global de acesso, e `RegistroSaude.editado_por_id`
obrigatório (RNF-006) — confirmados pelo grupo (Laureane e Jennifer). O modelo
de dados completo e validado (7 entidades: Usuario, Vinculo, Evento,
Medicamento, RegistroDoseMedicamento, RegistroSaude, RegistroAlimentar) está
descrito em `Elder Web - Modelagem ER.md` (ver nota no início). `attribution.sessionUrl`
(seção Workflow) também é decisão fechada. `backend/prisma/migrations/migration_lock.toml`
deve permanecer com `provider = "mssql"`, mesmo o datasource em `schema.prisma` usando
`provider = "sqlserver"`, não é erro. O Prisma 5.22.0 espera "mssql" nesse arquivo; trocar
quebra `prisma migrate status` (P3019, testado e revertido). Ver prisma/prisma#12087 (o Prisma
pretende unificar; não decidir sozinho, upgrade de dependência se discute com o grupo).


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
- Foto de perfil é BLOB no SQL Server, sempre WebP de até 1024 px vindo de `normalizarFoto` (sharp; formato pelos
  bytes; limites de tamanho e de envios por hora no código). Antes do multer: 2 envios em andamento no processo e 1 por
  usuário, vaga liberada só ao fim do processamento, prazo de 60 s para receber o corpo (408). Risco aceito: N contas
  seguram as vagas por até 60 s por tentativa, só a foto fica indisponível. HEIC e BMP só convertidos no navegador
  (`lib/prepararFoto.ts`). `GET /usuario/me` não devolve foto (há `GET /usuario/me/foto`); `/auth/sync` passa por
  `semFotoPerfil` e `requireAuth` usa `select` mínimo, para não carregar o BLOB à toa.
- Valor de `req.body`, `req.query` ou `req.params` só entra em `where` ou `data` do Prisma depois de checagem de tipo
  (`typeof`, `Number.isInteger`, lista fechada): objeto como `{ set: "" }` vira operador. `infra/semSqlCru.test.ts`
  barra `$queryRawUnsafe`, `$executeRawUnsafe` e `Prisma.raw` em `src` (e as `Unsafe` em `scripts`).
- Medicamento também é dado sensível (mesmas regras de log de `RegistroSaude`). Cuidador
  nunca cria medicamento (regra fixa de ator, independe das flags `permite_*`). Familiar só
  cria com `modo_decisao` efetivo `'familiar'` (via `resolverModoDecisao`).
- Endurecimento (2026-10-14, histórico e `docs/checklist-seguranca-producao.md`): `lib/limiteTaxa.ts` (Map, 429 fixo,
  desligado no Jest, `LIMITE_TAXA_DESLIGADO=1` só fora de produção): 2000/15 min por usuário no `requireAuth`, `/auth/sync`
  300 por IP e 60 por uid, solicitar 20, convidar e `PATCH /usuario/me` 30, `cadastrar-idoso` 10/h. `trust proxy` só em
  produção, `TRUST_PROXY_SALTOS` (padrão 1; Render: 3, medido em 2026-10-15). `requireAuthRevogacao` (token revogado: 401) só nas 15 rotas
  `revogacao` de `ROTAS_ESPERADAS`, nunca em leitura, saúde, remédio, agenda, alimentação, emergência ou foto.
- Vínculo: terceiro recebe o mesmo 404 antes de qualquer 400 ou 409 (idoso dono sem autoridade: 403); convite pendente
  não mostra a conta convidada; `solicitar-cuidador` sem lista de idosos. Cabeçalhos: `middleware/cabecalhosSeguranca.ts`
  e `vercel.json`, CSP completa só em Report-Only até o Marcos promover; nada de script inline no `index.html`.
- `/auth/sync` exige e grava `aceite_documentos` (criação e anexo, horário do servidor, versão da lista `VERSOES_DOCUMENTOS`). Publicar: migration no Azure, depois
  Vercel, depois Render. `backend/Dockerfile` roda com `USER node` (o runtime não escreve em `/app`).

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
- O e2e cria contas `e2e-*@e2e.elderweb.test` no Firebase real, sem limpeza; o `test:a11y` cria 3 e as vincula pela UI.
- Celular (2026-10-10): menor largura 320 px, mobile-first; alvo 44x44 com 8 px livres (exceção: link em texto corrido e
  dias da grade do calendário); `input`/`select`/`textarea` com 16 px; `min-h-dvh` (não `min-h-screen`); `grid-cols-1`
  no base de grid responsivo; estouro se corrige na origem, nunca com `overflow-x-hidden`. `npm run test:responsivo`
  (local, fora do CI, mesmas exigências do `test:a11y`; cria 4 contas) mede tudo isso em 22 variantes; WebKit com
  `--browser=webkit`.
- Em merge por rebase os hashes de commit mudam. Não tratar hash de commit local como
  definitivo.

**Desempenho (2026-10-13)**
- Autorização e vínculo nunca em cache entre requisições; o `chamarApi` só junta GET iguais em voo (token mais caminho).
- Cache HTTP: só o ETag do Express; nenhum `Cache-Control` em rota de dado sensível.
- Índice novo só por migration à mão (`INCLUDE` se a rota lê todas as colunas); no Azure, o Marcos aplica.
- `test:desempenho` e `scripts/medir-desempenho.ts`: locais, fora do CI; sem dependência de desempenho.

**Frontend e grupo**
- Mudou contrato HTTP ou mexeu em arquivo de tela da Laureane ou da Jennifer: avisar as
  duas fica com o Marcos (lembrar ele ao concluir a tarefa).

## Decisões em aberto e pendências conhecidas
Decisões marcadas "fechada" foram tomadas por Claude sob delegação explícita do Marcos em 2026-10-04
("decisão do grupo"); reabrir só se o grupo mandar. Pendências manuais ficam com o Marcos.

**Pendências manuais (Marcos)**
- Avisar Laureane e Jennifer: PDF do histórico (5.4, `lib/baixarPdf.ts`, `Remedios.tsx`); cores (PR #143); layout e
  revisão visual (2026-10-08); rodada de 2026-10-09 (Home, `Header`, `/avisos`, `/configuracoes`, landing); calendário
  da Agenda; botão de emergência; confirmação de e-mail; foto de perfil (`FormularioPerfil`, 2026-10-10).
- Azure: usuário da aplicação só com `db_datareader` e `db_datawriter` na `DATABASE_URL` do Render (admin só migra).
- Render (9.2): Secret Files e grupos de ambiente vinculados do `elder-web-backend` ainda não vistos.
- Emergência: domínio próprio com SPF e DKIM; numerar o RF novo; apagar as contas `e2e-*@e2e.elderweb.test` do Firebase;
  cuidadores e familiares cadastrados antes do PR #162 confirmarem o e-mail no Perfil.
- Telas de vínculo (`components/Vinculos/`, regras em `regrasVinculo.ts`; botão só para quem tem autoridade, textos fixos
  por `status`). Decisões de 2026-10-09 (Marcos, no histórico): `convidar-familiar` com `modo_decisao` efetivo `idoso` e
  resposta igual com ou sem conta; aprovar origem `convite_idoso` ou `cadastro_familiar` dá 409 (só recusar ou contestar);
  `GET /vinculo` traz `decisao` (sem motivo nem id) no vínculo aprovado de familiar do chamador.
- Convite do idoso ao cuidador (2026-10-12): `POST /vinculo/convidar-cuidador` (só `modo_decisao` efetivo `idoso`; familiar
  titular não convida) cria `Vinculo` pendente (cuidador, `convite_idoso`) só se há conta de cuidador. O cuidador aprova em
  `aceitar-convite` (e-mail verificado, até 7 dias). Convite vencido é substituído ao convidar de novo (pendente de
  `solicitacao_cuidador` ou aprovado dá 409; o pedido do cuidador também o substitui). Convite repetido válido responde
  201 igual (sem 409: seria oráculo), e o aceite exige o e-mail do token igual ao do cadastro. Riscos aceitos: sem conta some em silêncio; idoso falso convida e-mail
  adivinhado (cuidador só recusa); sem limite de convites pendentes.
- Sem oráculo de conta nos dois convites (`convidar-familiar` também responde 201 igual com vínculo já existente) e
  `PATCH /usuario/me` manda `emailVerified: false` ao trocar o e-mail (o aceite e o aviso de emergência confiam nele).
- Aprovação automática por e-mail verificado (login do familiar, `cadastrar-idoso`, aceite) exige `emailDoTokenConfere` (token
  = cadastro). `PATCH /usuario/me` valida antes do Firebase. Riscos abertos e A6 (limite de taxa): histórico, 2026-10-12.
- Trocar o e-mail recusa os `convite_idoso` pendentes do usuário; e-mail no `Vinculo` (migration): grupo, histórico 2026-10-12.

**Decisões fechadas**
- `backend/Dockerfile` mantém `CMD ["npm", "run", "dev"]` (local); o Render usa `dockerCommand: npm start` e é o único
  com `NODE_ENV=production`. `backend/.dockerignore` tira `node_modules`, `dist` e `.env*` (menos `.env.example`).
- Auditoria do valor sobrescrito em edição de saúde (RNF-006): aceito como risco, sem tabela de auditoria.
- Docs legais: `lib/documentosLegais.ts`. Aceite gravado desde 2026-10-14 (ver Segurança); sem cookie
  nem banner (2026-10-14). Dado ou storage novo: `VERSAO_DOCUMENTOS`.
- Exclusão de registro, paginação e filtros dos históricos (saúde, remédios, PDF): fora do escopo; volume do TCC
  não justifica. O PDF é montado em memória, sem limite (aceito); fora de Latin-1 vira `?` (aceito).
- Dose (5.2): sem idempotência no servidor (duplicata aceita; o frontend desabilita o botão); CHECK de
  `status_administracao` case-insensitive, só a rota barra `'ADMINISTRADO'` (aceito); histórico de remédios mostra só
  ids de autor (aceito).
- `modo_decisao` NULL de idosos autocadastrados antes da mudança: sem backfill (o resolver trata `NULL` como `'idoso'`;
  o backfill tocaria o Azure sem ganho).
- Foto do Google não é semeada no anexo do item 3.3; a foto vem só do upload no perfil.
- Risco de colisão de e-mail entre contas: tratado no código, `/auth/sync` responde 409 (`CONFLITO_EMAIL`, item
  3.2) quando o e-mail já está em uso. Registrar isso no `Elder Web - Modelagem ER.md` fica com o Marcos.
- JSON malformado e corpo acima do limite: 400 e 413 fixos no `errorHandler` (sem eco nem log). `nome` em branco em
  `/auth/sync` não vence o `name` do token do Google (em branco nos dois dá 400).
- Agenda (6.1): sem biblioteca de calendário (lista por dia). Familiar só cria evento com `modo_decisao` efetivo
  `'familiar'` (via resolver). Sem idempotência nem checagem de sobreposição (aceito).
- Agenda (6.3): todos veem os 3 tipos, sem filtro (aceito). Fuso fixo `America/Sao_Paulo` via `Intl` com `timeZone`
  explícito, nunca o do navegador. Evento aparece uma vez, no dia do início; passados em `<details>` fechado.
- Agenda (6.2, delegação de 2026-10-04): cuidador cria só `cuidado`, por `POST /agenda/idoso/:idosoId` (`POST /agenda`
  segue 403), exigindo `tipo_vinculo` e `tipo_perfil` `'cuidador'` e `permite_criar_evento_cuidado === true` (estrito);
  nunca chama `resolverModoDecisao`. `pessoal`/`medico` pelo cuidador: 403; idoso e familiar não criam `cuidado` (403).
  Sem a flag, corpo inválido dá 403 (ordem das checagens e erros 400 no histórico). Campos e limites do 6.1.
- Frontend (2026-10-09): Home, `/avisos` e `/configuracoes` (detalhes no histórico). Nunca "faltam doses" nem atraso (sem
  horário estruturado, sem aviso de dose); `AcessoProvider` expõe `vinculos` e `modoDecisao` (a falha não bloqueia o idoso);
  `lib/preferencias.ts` usa as mesmas chaves do script de `index.html`, com storage em try/catch.
- Item 9.3 (revisto em 2026-10-14): CI roda `npm audit --omit=dev` (backend `low`, frontend `critical`, sem `|| true`);
  dev só aceito. `@grpc/grpc-js` (4 altos via firebase) aceito: fora do bundle, corrigir exige rebaixar o firebase.
- Item 9.4 (D1 a D9, fechadas): o item só vai a ✅ com o CI remoto verde num push em `development`; sem dependência
  nova; código de produção só muda se um teste novo provar furo real de autorização (RED, correção mínima, commit
  `fix(auth):` separado; 400 antes de 403 não é furo); testes com Prisma mockado (não prova o filtro do SQL Server
  real, aceito); `npm test` segue `jest` e o CI roda `npm run test:coverage` no lugar dele; CI em push de todas as
  branches mais PR para `main`, com `concurrency` (execução duplicada aceita); limiares = floor(medido) menos 1 (valores
  em `backend/jest.config.js`, metas mínimas em `infra/ciAutorizacao.test.ts`); mutação local vale como RED em
  teste de caracterização; regra de ator vem do código (cuidador nunca cria medicamento nem refeição, familiar só com
  `modo_decisao` efetivo `'familiar'`, flag exata e estrita).

- Frontend (2026-10-08, decisões do grupo): menu por perfil (D1, D2): idoso vê tudo; cuidador ou familiar sem vínculo
  aprovado vê só Início, Meu Perfil, a lista do seu tipo (Família ou Cuidadores) e Orientações; Saúde, Medicamentos,
  Agenda e Alimentação exigem ao menos 1 vínculo aprovado (`RotaComVinculo`); cuidador não vê Família. Falha ao carregar
  perfil ou vínculos falha aberto com aviso (D3; a barreira real é o 403). `/familia` e `/cuidadores` filtram no
  cliente o `GET /vinculo` (D4); `/vinculos` redireciona para `/familia`, `/vinculos/:id` é o detalhe. Rotas
  protegidas aninhadas em `LayoutAutenticado` (D5): páginas não têm `<main>` próprio nem botão que saia do site.

**Itens implementados (resumo; detalhes, PRs e hashes no histórico)**
- 5.2 a 5.4 (dose, histórico de remédios, PDF): leituras com vínculo aprovado basta. PDF montado inteiro em memória
  (`lib/historicoPdf.ts`, pdfkit) antes de enviar; nunca fazer pipe.
- 6.1 a 6.3 agenda (`routes/agenda.ts`, `lib/agendaPorDia.ts`; regras de ator acima). Teste de fuso por subprocesso
  `node` com `TZ` real (Node 22.18 ou superior; `process.env.TZ` no Jest é cópia e não vale).
- 7.1 e 7.2 alimentação (RF-018, RF-019): `routes/alimentacao.ts`. Cuidador nunca cria (403, resolver nunca chamado);
  familiar só com `modo_decisao` efetivo `'familiar'`; `refeicao` com 6 valores só na aplicação, `descricao` 1 a 500
  (dado sensível); leitura com vínculo aprovado, ordem `data_hora` e `id` decrescentes.
- 8.1, 8.2 e 9.1 a 9.4: resumos no histórico ("Resumo dos itens implementados movido do CLAUDE.md", 2026-10-14).
- Os `backend/scripts/verify-rotas-*.ts` NÃO revertem por transação (rota, Prisma e banco reais, só o token Firebase é
  substituído): limpam por sentinela no `finally` e recusam rodar fora de `localhost`; `firebase_uid` com prefixo
  `verify-*-` marca conta residual se o processo morrer no meio.
- Emergência (RF novo, número a definir pelo grupo): `POST /emergencia/avisar` (só idoso; 403 nos outros) manda
  e-mail aos vínculos aprovados com e-mail verificado no Firebase (`auth.getUsers`, mesmo e-mail do cadastro; erro do
  Firebase: 503, ninguém recebe) via `lib/enviarEmail.ts` (único ponto do provedor, API HTTPS: Render free bloqueia
  SMTP). Env `EMAIL_API_KEY`, `EMAIL_REMETENTE_NOME`, `EMAIL_REMETENTE_ENDERECO` (sem elas, 503). Resposta só com contagens
  (`nao_confirmados` inclusive). `BotaoAjuda` no `Header` só para idoso; perfil com mais de 3 s ou falha: só o link
  "Ligar 192". Cadastro pede a confirmação de e-mail aos 3 perfis (`SituacaoEmail` no Perfil, só cuidador e
  familiar). No ar desde 2026-10-10. Bloqueio de IPs da Brevo fica desligado
  (o IP do Render free muda); entrega em escala exige domínio próprio (aceito). Teste: `backend/scripts/testar-email.ts <endereço>` (só ao e-mail do Marcos).

## Histórico de implementação
O diário por tarefa (bugs, testes, limitações, hashes) está em `docs/historico-implementacao.md`. **Não ler por
padrão**, só quando a tarefa tocar uma feature já feita. Ao concluir uma tarefa, registrar o resumo lá, não aqui. Este
arquivo deve ficar abaixo de 30k caracteres.
