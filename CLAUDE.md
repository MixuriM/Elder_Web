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

- **Banco de dados:** Azure. O serviço exato ainda não foi especificado
  (Azure SQL Database, Azure SQL Managed Instance ou SQL Server em VM) —
  confirmar com o grupo antes de configurar a `DATABASE_URL` de produção.
- **Backend:** Render.
- **Frontend:** Vercel.

Isso é só o registro de *onde* — a configuração real de deploy (Dockerfile
para o Render, variáveis de ambiente de produção, configuração do Vercel)
ainda não foi feita.

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
  docker-compose.yml
  CLAUDE.md
```

## Build and Test
- Frontend dev: `npm run dev` (dentro de `frontend/`)
- Backend dev: `npm run dev` (dentro de `backend/`)
- Frontend test: `npm test` (dentro de `frontend/`)
- Backend test: `npm test` (dentro de `backend/`)

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
- **Divisão de trabalho do grupo:** Marcos é responsável pelo backend; o
  frontend "de verdade" (layout final, polish, UX) é da Laureane e da
  Jennifer — não implementar telas completas/finais no lugar delas. Exceção:
  Marcos pode pedir um **esqueleto de frontend cru** (formulário/página
  mínima, sem estilo além do padrão de acessibilidade do projeto, sem
  listagem/refinamento) só pra ele conseguir testar uma feature de backend
  que acabou de implementar, sem depender do cronograma delas. Esse esqueleto
  cobre só a(s) rota(s) da tarefa em questão — não adianta funcionalidade que
  ainda não existe no backend, nem tenta ser a versão final da tela.
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
- Risco de colisão de e-mail entre contas: sem registro de mitigação
  encontrado no `Elder Web - Modelagem ER.md` até a REV.9. (O que existe lá é
  outra coisa: `email` opcional + índice único filtrado, para permitir idoso
  sem e-mail próprio cadastrado pelo familiar — não trata colisão.) Não
  presumir resolvido nem tratar como bloqueante sem confirmar com o grupo.

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

**Fluxo `POST /auth/sync` implementado e validado end-to-end (2026-09-06):**
`frontend/src/lib/auth.ts` expõe `syncUser()`, chamada logo após
`registerUser`/`loginUser`/`loginWithGoogle` em `Login.tsx` e `Cadastro.tsx`
(os TODOs antigos de "chamar POST /auth/sync assim que a rota existir" foram
removidos). `Cadastro.tsx` ganhou o campo "Nome completo" — obrigatório
porque `/auth/sync` exige `nome` no body quando cria conta (login por
e-mail/senha não popula `displayName` no Firebase; login por Google já traz
via `decoded.name`, então o campo é ignorado nesse fluxo). Testado
manualmente pelos 5 casos: cadastro e-mail/senha (201, criado:true), login
e-mail/senha (200, criado:false, sem duplicar), senha errada (nenhum sync
disparado), cadastro Google (201, nome automático) e login Google (200,
criado:false) — todos confirmados no SQL Server local via SSMS.

Isso exigiu adicionar CORS no backend, que não tinha nenhum: pacote `cors`
(+ `@types/cors`) instalado em `backend/`, com
`app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:5173' }))`
em `backend/src/index.ts` — libera só a origem do frontend, não `*`.
`FRONTEND_URL` documentada em `backend/.env.example`. `VITE_API_URL`
(consumida por `syncUser()`) documentada em `frontend/.env.example` — já
existia no `.env` real, só faltava no example.

**Ainda ausentes (não fazem parte da decisão acima, mapeados em auditoria
2026-09-06, não implementar sem alinhar escopo):** estado global de usuário
logado (`AuthContext`/`useCurrentUser` — `onAuthChange` em `auth.ts` está
exportado mas não é consumido em lugar nenhum), wrapper de requisição HTTP
que anexe o token automaticamente em chamadas futuras além de `/auth/sync`
(`getCurrentUserToken()` também existe mas só é usado dentro de `syncUser`),
e proteção de rota/redirecionamento (`App.tsx` só tem rotas públicas).

Os 6 campos de enum de negócio abaixo também têm o conjunto de valores
permitidos travado por CHECK constraint ativa no banco (não só validação de
aplicação) — valores documentados nos comentários de campo do próprio
`schema.prisma`: `Vinculo.tipo_vinculo`, `Vinculo.origem`, `Vinculo.status`,
`Usuario.modo_decisao`, `Usuario.modo_decisao_solicitado`,
`RegistroDoseMedicamento.status_administracao`.

**Migration inicial aplicada:** `20260831005102_init_schema` já rodou no
banco local via `npx prisma migrate dev`. As 10 constraints manuais (1
índice único filtrado + 9 CHECKs, incluindo as 6 acima) foram confirmadas
ativas de verdade no banco — não só aceitas na aplicação da migration — pelo
script `backend/scripts/verify-constraints.ts`, que tenta um insert inválido
por constraint dentro de uma transação sempre revertida. Rodar de novo:
`npx tsx scripts/verify-constraints.ts` (dentro de `backend/`). Mantido no
repo como smoke test futuro.

**`firebase_uid` nullable (decisão fechada em 2026-09-01):** resolve o
conflito entre `firebase_uid NOT NULL` e RF-030 (idoso cadastrado por
familiar, sem login Firebase próprio no momento do cadastro). Reabre e
substitui a redação original de `firebase_uid UNIQUE, NOT NULL` — o que
continua valendo da decisão original é só "não é PK, tudo referencia
`Usuario.id`". Resolução: `firebase_uid` nullable + índice único filtrado
(mesmo padrão de `email`) + `CK_Usuario_firebase_uid_cadastrado_por`
(`firebase_uid IS NOT NULL OR cadastrado_por_id IS NOT NULL`) impedindo
autocadastro sem `firebase_uid`. Migration
`20260902014014_firebase_uid_nullable` aplicada no banco local via
`npx prisma migrate deploy`; as 3 constraints novas/alteradas
(`Usuario_firebase_uid_key` filtrado + a CHECK acima) confirmadas ativas
por `verify-constraints.ts` (14/14 PASS). Ver `docs/Elder Web - Modelagem
ER.md` para o mesmo ajuste no atributo `firebase_uid`.

**Bug de produção corrigido — cadastro criava conta Firebase sem linha em
`Usuario` (causa raiz confirmada em 2026-09-09):** `backend/src/app.ts`
configura CORS com `origin: process.env.FRONTEND_URL ?? 'http://localhost:5173'`.
A variável `FRONTEND_URL` nunca tinha sido configurada no serviço backend no
Render (nem no dashboard, nem em `render.yaml`) — o CORS caía no fallback
`localhost:5173`, o browser bloqueava o fetch de `syncUser()` feito a partir
de `https://elder-web.vercel.app`, e o catch vazio em `Cadastro.tsx`/`Login.tsx`
escondia o erro. Resultado: conta criada no Firebase Authentication, mas sem
linha correspondente em `Usuario` — pelo menos 2 contas ficaram órfãs assim
(`mangabinhamp@gmail.com`, e uma anterior) antes do diagnóstico.

Correção: `FRONTEND_URL` adicionada como Environment Variable (tipo padrão,
não Secret) no dashboard do Render, valor `https://elder-web.vercel.app`
(sem barra final) — também adicionada em `render.yaml` (`sync: false`) pra
não depender de configuração manual esquecida numa próxima vez. Confirmado
também que `VITE_API_URL` no Vercel precisa ser tipo Config (não Secret) e
escopo Production — Secret não permitia adicionar essa var pro caso de uso;
como o Vite embute em build time, mudar essa var exige redeploy.

Além disso, os catches vazios de `handleSubmit`/`handleGoogleCadastro` em
`Cadastro.tsx` e `handleSubmit`/`handleGoogleLogin` em `Login.tsx` passaram a
logar o erro real via `console.error` antes de mostrar a mensagem genérica
pro usuário — esse tipo de falha não pode mais ficar invisível. `syncUser()`
em `frontend/src/lib/auth.ts` passou a lançar erro incluindo status HTTP e
corpo da resposta quando `/auth/sync` retorna não-ok (não cobre bloqueio de
CORS em si, que nem chega a virar `Response` — mas o `console.error` agora
captura esse `TypeError` também).

Validado end-to-end em PRODUÇÃO em 2026-09-09 (não só local): Network tab
mostrou `sync` 201 + preflight 204; Firebase Authentication e SQL Server
(via SSMS) confirmaram usuário e linha em `Usuario` criados juntos, tanto
pra e-mail novo (`teste123@gmail.com`) quanto pra `mangabinhamp@gmail.com`
recriado depois de excluído do Firebase. Ressalva: a validação anterior do
fluxo `/auth/sync` (entrada acima, 2026-09-06) cobriu só ambiente local —
CORS só bloqueia entre origens diferentes, então local→local não pegava
esse cenário.

**Nota operacional:** conta Firebase órfã (existe no Authentication mas sem
linha em `Usuario`) bloqueia recadastro com o mesmo e-mail — Firebase recusa
com `auth/email-already-in-use` antes de chegar no backend. Precisa excluir
a conta manualmente no Firebase Console (Authentication → usuário → excluir)
antes de recadastrar.

**Item 1.6 da Fase 1 (RF-004) implementado — editar perfil (2026-09-13):**
Antes de começar, foi conferido que o middleware `requireAuth` (item 1.3) já
existia em `backend/src/middleware/requireAuth.ts`, com teste próprio — a
tabela do plano de desenvolvimento estava certa, o item não tinha sido
achado numa checagem anterior. Nenhuma reimplementação foi feita, só reuso.

Backend: `backend/src/routes/usuario.ts` — `GET /usuario/me` (retorna id,
nome, email, telefone, tipo_perfil do usuário autenticado) e
`PATCH /usuario/me` (atualiza nome/email/telefone), ambas atrás de
`requireAuth`. Decisões:
- A CHECK `email IS NOT NULL OR telefone IS NOT NULL` é validada em
  aplicação *antes* do update (comparando com os valores atuais do usuário
  para o campo que não está sendo alterado nesta requisição), retornando 400
  com mensagem clara — não deixa o erro cru do SQL Server vazar.
- Colisão de e-mail (índice único filtrado `Usuario_email_key`) é detectada
  pelo mesmo padrão de `isDuplicateFirebaseUid` (detecção genérica de
  violação de índice único do driver, já que o índice é manual, não
  `@unique` do Prisma) — nova função `isDuplicateEmail` em
  `backend/src/lib/authHelpers.ts`, retorna 409 com mensagem tratada.
- Alterar o e-mail sincroniza com Firebase Auth via Admin SDK
  (`auth.updateUser(firebase_uid, { email })`) antes do update no banco.
- Caso do idoso sem `firebase_uid` (cadastrado por familiar, RF-030) editando
  e-mail: **não precisou de tratamento especial.** `requireAuth` só resolve
  `req.usuarioId` buscando `Usuario` por `firebase_uid` a partir do token
  decodificado — logo todo usuário autenticado que chega em `/usuario/me`
  já tem `firebase_uid` preenchido por construção. Esse cenário é
  estruturalmente inalcançável neste fluxo, documentado em comentário no
  código; não é uma lacuna nova.

Frontend:
- `frontend/src/hooks/useAuthUser.ts` — hook novo (reutilizável em toda a
  Fase 1+), baseado em `onAuthChange` de `lib/auth.ts`, retorna
  `{ usuario, carregando }`.
- `frontend/src/components/RotaProtegida.tsx` — versão mínima: só resolve
  "existe alguém logado" (loading → redireciona pra `/login` se `usuario`
  for `null` → senão renderiza `children`). Sem lógica de `tipo_perfil` ou
  vínculo — isso fica para a Fase 2 (RF-032).
- `frontend/src/pages/Perfil.tsx` — formulário nome/email/telefone, mesmo
  padrão de acessibilidade de `Login.tsx`/`Cadastro.tsx`/`EsqueciSenha.tsx`
  (label associado, erro com `role="alert"`, fontes grandes, feedback de
  sucesso após salvar). Busca `GET /usuario/me` ao montar, salva via
  `PATCH /usuario/me`, propaga a mensagem específica do backend (400/409)
  em vez de um erro genérico.
- Rota `/perfil` adicionada em `App.tsx`, envolvida por `RotaProtegida`.

**Gap de infra de teste descoberto e corrigido:** `RotaProtegida.test.tsx`
foi o primeiro teste do projeto a importar `react-router-dom` — expôs que
`jest-environment-jsdom@30` não expõe `TextEncoder`/`TextDecoder` no global
do ambiente jsdom (o Node tem nativamente, mas o ambiente de teste não
herda). Corrigido com `frontend/jest.polyfills.cjs` (copia os dois do
`node:util` pro `globalThis`) referenciado em `setupFiles` de
`jest.config.cjs` — roda antes do ambiente de teste subir, não é específico
desta feature, vale para qualquer teste futuro que toque `react-router-dom`.

Fora de escopo deste item (não implementado, por instrução explícita):
logout (item 1.7), card de notificações/avisos, e qualquer lógica de
permissão por `tipo_perfil` ou vínculo (Fase 2).

**Item 2.4 da Fase 2 (RF-024) implementado — email_convite_familiar no cadastro
do idoso (2026-09-16, PR #45, commit `5abefc0`):**

A coluna `email_convite_familiar` já existia em `Usuario` desde a migration
inicial (`20260831005102_init_schema`), sem CHECK — esta tarefa não criou
coluna nova, só a regra de negócio em cima dela. Persistência usada depois
pelo item 2.5 (RF-025, fora de escopo aqui) pra casar automaticamente o
cadastro de um Familiar com o Idoso que já informou o e-mail dele; por isso
o campo não é único (`@unique`/`@@unique`) — mais de um idoso pode indicar o
mesmo e-mail de familiar.

Backend: `POST /auth/sync` (`backend/src/routes/auth.ts`) aceita o campo só
no branch de criação de conta (nunca em login de conta já existente) e só
quando `tipo_perfil === 'idoso'` — cuidador ou familiar mandando o campo
preenchido recebe 400 explícito (`"email_convite_familiar só pode ser
informado por idoso."`), mesmo padrão de erro claro já usado no
`tipo_perfil` obrigatório e em `PATCH /usuario/me`. Formato validado por
`isValidEmailFormat` (regex simples, nova em
`backend/src/lib/authHelpers.ts`) — nenhuma lib de e-mail está instalada no
backend e nenhuma validação de formato existia em nenhum lugar do projeto
até então (nem em `email` de `PATCH /usuario/me`).

CHECK `CK_Usuario_email_convite_familiar_tipo_perfil` (`email_convite_familiar
IS NULL OR tipo_perfil = 'idoso'`) trava a regra a nível de banco, mesmo
padrão de `CK_Usuario_firebase_uid_cadastrado_por`. Migration
`20260916090000_add_check_email_convite_familiar_idoso` escrita à mão (só a
`ALTER TABLE ADD CONSTRAINT`, coluna já existia) e aplicada via
`npx prisma migrate deploy` — não `migrate dev`, porque o Azure SQL recusou
criar shadow database automaticamente (erro P3020, limitação de
infraestrutura, não de rede/firewall). Rodar `migrate deploy` contra esse
banco foi autorizado explicitamente pelo Marcos só pra esta migration
pontual; a trava geral do CLAUDE.md que exige autorização separada pra
`migrate deploy` contra produção continua valendo, não foi reaberta.
`backend/scripts/verify-constraints.ts` ganhou o caso 11 pra essa CHECK —
15/15 PASS confirmados de verdade no banco (não só aceito na migration).

Testes novos: `backend/src/routes/auth.test.ts` (arquivo não existia antes
desta tarefa, criado do zero seguindo o padrão de `usuario.test.ts`) — 5
casos (idoso com o campo, idoso sem o campo, cuidador bloqueado, familiar
bloqueado, formato inválido bloqueado). Suíte inteira do backend: 6 arquivos
de teste, 43 testes, todos passando.

Frontend: campo novo em `Cadastro.tsx` via `FormularioCadastro.tsx`,
condicional só pro perfil idoso (`tipoPerfil === "idoso"`) e opcional, mesmo
padrão visual dos demais campos do formulário. `CampoTexto.tsx` ganhou prop
`required?: boolean` (default `true`) pra suportar esse campo opcional sem
alterar o comportamento dos campos existentes. `lib/auth.ts` (`syncUser`)
propaga `emailConviteFamiliar` no body de `/auth/sync` como
`email_convite_familiar`, só quando o perfil selecionado é idoso.

Fora de escopo deste item (não implementado, por instrução explícita):
casamento automático do cadastro de um Familiar com o
`email_convite_familiar` informado pelo idoso (item 2.5, RF-025).

**Item 2.5 da Fase 2 (RF-025, RNF-004) implementado — vínculo automático
Familiar↔Idoso (2026-09-16, PR #47, commit `a236b11`):**

Fluxo A completo, cobrindo as duas ordens de cadastro possíveis (Familiar
depois do Idoso, ou Idoso depois do Familiar). Sem tabela de token nova —
confirmação de posse do e-mail reaproveita `decoded.email_verified` do
próprio Firebase Auth, decisão tomada nesta tarefa pra não montar sistema de
e-mail próprio (nenhuma dependência nova instalada, nenhuma variável de
ambiente nova).

Backend, `POST /auth/sync` (`backend/src/routes/auth.ts`), branch de
cadastro: `vincularFamiliarConvidado` roda quando `tipo_perfil === 'familiar'`
— busca todo `Usuario` com `tipo_perfil='idoso'` e `email_convite_familiar`
batendo o e-mail do Familiar recém-criado (comparação de string simples,
mesmo padrão já usado em `POST /vinculo/solicitar-cuidador`), e cria um
`Vinculo` por Idoso encontrado (`origem='convite_idoso'`): `status='aprovado'`
direto se `email_verified` já vier `true` no token (comum em contas Google),
senão `status='pendente'`. `vincularIdosoComFamiliarExistente` cobre a ordem
oposta — Idoso cadastrado depois de um Familiar já existente — busca o
Familiar pelo e-mail informado em `email_convite_familiar` e cria `Vinculo`
sempre `pendente` (esta requisição não carrega o token do Familiar, não dá
pra checar `email_verified` dele agora).

Branch de login: quando `usuarioExistente.tipo_perfil === 'familiar'` e
`decoded.email_verified === true`, `prisma.vinculo.updateMany` promove todo
`Vinculo` `pendente`/`origem='convite_idoso'` desse Familiar pra `aprovado`
— idempotente por construção, `updateMany` só afeta linhas ainda `pendente`,
login repetido não duplica nem falha.

Nenhuma migration nesta tarefa — nenhum campo/tabela novo, só lógica em cima
do que já existia (`Vinculo.status`, `confirmado_em`, `notificado_em`,
`origem`, todos já modelados desde antes; `email_convite_familiar` já
persistido pelo item 2.4).

Frontend: `sendEmailVerification` (Firebase Auth Web SDK, `lib/auth.ts`)
disparado em `Cadastro.tsx` só quando `tipoPerfil === 'familiar'`, com
`actionCodeSettings.url` apontando pra
`${window.location.origin}/confirmar-email` (sem env var nova, evita repetir
o bug de `FRONTEND_URL` mal configurada já documentado acima nesta seção);
vira no-op se a conta já chegar verificada (`user.emailVerified`, caso comum
de contas Google). Página nova `frontend/src/pages/ConfirmarEmail.tsx` —
esqueleto cru (mesma exceção de divisão de trabalho já registrada na seção
Workflow), rota pública `/confirmar-email` em `App.tsx`, fora de
`RotaProtegida` de propósito: quem clica o link do e-mail sem sessão ativa
precisa cair na mensagem "faça login primeiro", não num redirect silencioso
pra `/login`. Reaproveita `useAuthUser()` já existente; força refresh do ID
token via novo parâmetro `forceRefresh` em `getCurrentUserToken` e rechama
`syncUser()`. Não implementa `handleCodeInApp`/`oobCode` customizado — no
fluxo padrão do Firebase o e-mail já é marcado como verificado antes do
usuário chegar em `continueUrl`.

Testes novos: `backend/src/routes/auth.test.ts` ganhou 11 casos cobrindo as
duas direções do vínculo automático e a promoção/idempotência no login
(cadastro de Familiar com/sem e-mail correspondente, `email_verified=true`
na hora do cadastro, e-mail batendo mais de um Idoso, cadastro de Idoso
batendo Familiar existente, login promovendo/não promovendo vínculo
pendente, login sem vínculo pendente, login repetido). Escritos e
confirmados falhando (RED) antes da implementação. Suíte inteira do backend:
6 arquivos de teste, 54 testes, todos passando. Frontend: `tsc --noEmit`
limpo, suíte existente (2 suites, 4 testes) sem regressão.

Fora de escopo deste item (não implementado, por instrução explícita):
endpoint de contestação de vínculo automático já `aprovado` via
`notificado_em` (extensão futura de `POST /vinculo/:id/aprovar|recusar` pra
`tipo_vinculo='familiar'` — hoje só aceita `'cuidador'`) — `notificado_em`
fica `NULL`, dívida técnica conhecida, não fechada nesta tarefa. Itens
2.6/2.7 (Fluxo B), 2.8/2.9 e Fase 3/RF-030 também não tocados.

**Item 2.6 da Fase 2 (RF-026) implementado — Familiar solicita vínculo
diretamente pelo e-mail do Idoso, Fluxo B (2026-09-16, PR #52, commit
`d1fb458`):**

`POST /vinculo/solicitar-familiar`, em `backend/src/routes/vinculo.ts`,
atrás de `requireAuth` — espelho de `/solicitar-cuidador` (item 2.1),
adaptado pro Familiar. Só `tipo_perfil='familiar'` pode chamar (403 caso
contrário). Diferente da 2.1, não tem ambiguidade de múltiplos idosos: a
busca é direta pelo e-mail do próprio Idoso (`email` é `@unique` filtrado em
`Usuario`, no máximo uma conta bate), então não existe branch de
desambiguação por `nome_idoso`. O `findFirst` já filtra `tipo_perfil='idoso'`
na query — uma conta de outro tipo com o mesmo e-mail resolve `null` e cai no
mesmo 404 genérico ("Nenhum idoso encontrado para este e-mail."), sem
revelar a que tipo de conta o e-mail pertence (mesmo padrão da 2.1).
Auto-vínculo não tem guard explícito: `tipo_perfil` é fixo e único por conta
(decisão fechada), o chamador já foi confirmado `familiar` e o alvo só
resolve `idoso` — os dois nunca podem ser a mesma conta, por construção.

Cria `Vinculo` com `tipo_vinculo='familiar'`, `origem='solicitacao_familiar'`,
`status='pendente'`. Nenhuma migration nova: confirmado lendo
`20260915090000_vinculo_unique_ativo/migration.sql` (item 2.3) antes de
decidir — o índice único filtrado `(idoso_id, vinculado_id, tipo_vinculo)`
`WHERE status IN ('pendente','aprovado')` não é específico de
`tipo_vinculo='cuidador'`, já cobre `'familiar'`. Duplicidade
`pendente`/`aprovado` → 409 (mesmo padrão da 2.1: se o único registro
existente for `recusado`, permite nova solicitação — decisão assumida, não
confirmada com o grupo). Esse mesmo índice/checagem não distingue `origem`:
um `Vinculo` já criado pelo Fluxo A (item 2.5, `origem='convite_idoso'`) pro
mesmo par idoso/familiar bloqueia a solicitação via Fluxo B também —
comportamento correto (não duplicar vínculo), com teste dedicado separado do
teste genérico de duplicidade. Reaproveita `isDuplicateVinculoConstraint`,
já existente em `vinculo.ts`, como rede de segurança contra corrida no
`create` (mesmo padrão da 2.1).

8 testes novos em `vinculo.test.ts` (sucesso, 403 tipo_perfil errado, 404
e-mail não encontrado, 404 e-mail de conta não-idoso, 409 pendente, 409
aprovado, 409 colisão com Fluxo A, permitido após recusado) — suíte completa
do backend em 62 testes/6 suítes, sem quebra. `npx tsc --noEmit` limpo.

Frontend: nova seção em `Vinculos.tsx` ("Solicitar vínculo (familiar → idoso,
pelo e-mail)"), esqueleto cru cobrindo só essa rota — mesmo padrão de
acessibilidade das seções existentes (label associado, erro com
`role="alert"`, fontes grandes). `tsc --noEmit` limpo, suíte existente do
frontend (2 suites, 4 testes) sem regressão.

Item 2.7 (aprovar/recusar essa solicitação) implementado depois — ver
entrada no fim deste arquivo.

**Risco residual aceito, não mitigado (decisão do grupo, não decidida por
este agente):** Idoso sem e-mail cadastrado (`Usuario.email IS NULL`,
cenário legítimo de RF-030 — cadastrado por familiar sem e-mail próprio)
deixa o Fluxo B estruturalmente inalcançável pra esse Idoso: o `findFirst`
por e-mail nunca bate, cai no mesmo 404 genérico de "nenhum idoso
encontrado" — indistinguível de e-mail que não corresponde a ninguém. Não
mitigado nesta tarefa; é decisão de escopo do grupo, mesmo tratamento dado
aos outros riscos residuais aceitos já documentados nesta seção.

**Bug de produção corrigido — `/auth/sync` retornava 500 depois de o backend
ficar ocioso, não é cold start do Render (2026-09-17):** Diagnosticado via
logs do serviço `elder-web-backend` no Render (MCP), não só suposição.
Timeline real do incidente: Express sobe e já responde em 3s
(`Backend rodando em http://localhost:10000`), mas a primeira query Prisma
falha três vezes seguidas com `PrismaClientInitializationError: Can't reach
database server at elder-web-sql-marcos.database.windows.net:1433` antes de
emplacar — ou seja, o gargalo é o Azure SQL recusando conexão logo após
ficar ocioso (padrão tipo auto-resume), não o container do Render subindo
devagar. A entrada de memória antiga (`render_free_tier_cold_start.md`)
apontava spin-down do Render como causa da lentidão em login/cadastro — isso
continua válido para a lentidão em si, mas o erro 500 especificamente tem
essa outra causa, e não foi cogitado reabrir upgrade de plano Render nem
keep-alive (já recusados 2026-09-14) porque não resolveriam esse erro.

Correção em `backend/src/lib/prisma.ts`: o client Prisma exportado passou a
ser uma client extension (`$extends` com `query.$allOperations`, não `$use`
— depreciado e a caminho de remoção no Prisma 6) que re-tenta a query com
backoff (1s/2s/4s/8s/8s/8s, ~31s de margem) especificamente em
`Prisma.PrismaClientInitializationError`, antes de deixar o erro subir pro
errorHandler genérico de `app.ts`. Como é o client único importado em toda
rota (`import { prisma } from "../lib/prisma"`), cobre `/auth/sync` e
qualquer outra rota sem precisar tocar em cada arquivo de rota individual.

Reforço no frontend, mesmo padrão de causa raiz (função compartilhada, não
por tela): `syncUser()` em `frontend/src/lib/auth.ts` ganhou retry próprio
(mesmo backoff, até 4xx que é erro real e não deve repetir) para cobrir
qualquer falha de rede que escape do retry do backend, e duas funções novas
exportadas — `mensagemErroLogin`/`mensagemErroCadastro` — que distinguem
"login/cadastro no Firebase falhou de verdade" de "Firebase OK mas
`/auth/sync` falhou": antes disso, `Login.tsx`/`Cadastro.tsx` mostravam
"confira seu e-mail e senha" mesmo quando a credencial estava certa e o
problema era só o backend/banco ainda acordando, o que podia levar o usuário
a achar (erroneamente) que errou a senha. `Cadastro.tsx` também passou a
orientar "não tente cadastrar de novo" nesse cenário, porque a conta Firebase
já foi criada — recadastrar bate no problema de conta órfã já documentado
nesta seção (ver "Nota operacional" acima).

`npx tsc --noEmit` limpo em ambos os pacotes, `npm run build` do backend
limpo, suíte do backend (62 testes/6 suítes) e do frontend (2 suítes/4
testes) sem regressão.

**Item 2.7 da Fase 2 (RF-027) implementado — aprovar/recusar solicitação de
vínculo de Familiar, Fluxo B (2026-09-17, PR #58, mergeado em `main`,
commit `8d1c3c4` — hash final diferente do commit local, mesmo padrão dos
PRs #38/#40/#47/#52):**

`responderSolicitacaoCuidador` em `backend/src/routes/vinculo.ts` renomeada
pra `responderSolicitacaoVinculo` e estendida pra também aceitar
`tipo_vinculo='familiar'` — mesma função compartilhada entre
`POST /vinculo/:id/aprovar` e `/recusar`, sem duplicar lógica. Único ponto
de mudança: removida a condição `vinculo.tipo_vinculo !== "cuidador"` que
dava 404 pra vínculo de Familiar (item 2.2, decisão de 2026-09-15, reaberta
aqui de propósito — era o próprio 404 que este item precisava fechar). Ficou
só `if (!vinculo)`: `tipo_vinculo` tem CHECK constraint no banco travando
os únicos dois valores possíveis (`'cuidador'`/`'familiar'`,
`schema.prisma:127`), então checar o valor específico depois de confirmar
que o registro existe é redundante — qualquer `Vinculo` encontrado já
pertence a um dos dois fluxos que esta rota cobre. Nenhuma mudança na
checagem de autoridade (`Usuario.modo_decisao` do idoso dono do vínculo):
lida antes de alterar e confirmado que já era agnóstica a `tipo_vinculo`.

Investigada a pergunta feita explicitamente antes de decidir sozinho: se um
Familiar consegue aprovar o próprio pedido pendente criado por ele mesmo via
`/solicitar-familiar` (item 2.6). Resposta, confirmada lendo
`20260915090000_vinculo_unique_ativo/migration.sql` (índice único filtrado
`(idoso_id, vinculado_id, tipo_vinculo)` `WHERE status IN
('pendente','aprovado')`, item 2.3): não consegue, por construção, sem
precisar de guard novo. A checagem de autoridade em `modo_decisao='familiar'`
exige um `Vinculo` já `aprovado` do chamador com aquele idoso; como o índice
único impede o mesmo par idoso/familiar/tipo_vinculo ter simultaneamente uma
linha `pendente` e uma `aprovado`, o próprio solicitante nunca tem como
satisfazer essa condição com o próprio pedido. Autoridade sempre cai pra um
Familiar diferente (já aprovado) ou pro idoso (`modo_decisao='idoso'`).
Teste dedicado cobrindo esse caso.

6 testes novos em `vinculo.test.ts` (aprovar/recusar por idoso, aprovar por
outro familiar já aprovado, 403 pro próprio idoso quando `modo_decisao`
transferido, 403 pro próprio solicitante sem vínculo aprovado prévio, e
confirmação de que o fluxo de cuidador não regrediu) — suíte completa do
backend em 68 testes/6 suítes (era 62), sem quebra.

Frontend: nenhuma seção nova — a seção "Responder solicitação de vínculo"
já existente em `Vinculos.tsx` (item 2.2) já cobria qualquer `tipo_vinculo`,
já que só pede o id do vínculo e chama a mesma rota. Só título e um parágrafo
curto atualizados pra deixar explícito que cobre os dois fluxos agora. `npx
tsc --noEmit` limpo, suíte frontend (2 suítes/4 testes) sem regressão.

Fora de escopo deste item (não implementado, por instrução explícita, fica
como dívida técnica futura): endpoint de contestação de vínculo automático
já `aprovado` via `notificado_em` (Fluxo A, item 2.5) — continua não
coberto por `/vinculo/:id/aprovar|recusar`. Item 2.8 (flags `permite_*`)
também não tocado.

**Item 2.8 da Fase 2 (RF-032) implementado — definir permissões operacionais do cuidador
(2026-09-18, PR #61, mergeado em `main` via squash, commit
`2f400ab9d4b027327d3717852b1ba37c8b1c1f16` — hash final diferente do commit local
`2eeecb0`, mesmo padrão dos PRs #38/#40/#47/#52/#58):**

Rota nova `PATCH /vinculo/:id/definir-permissoes` em `backend/src/routes/vinculo.ts`,
atrás de `requireAuth`. Atualiza `permite_registrar_saude`, `permite_marcar_dose`,
`permite_criar_evento_cuidado` com atualização parcial (mesmo padrão de `PATCH
/usuario/me` — só campos enviados são tocados), preenche `definido_por_id`/`definido_em`
em toda escrita bem-sucedida.

Decisão de design: endpoint único PATCH, não 3 rotas separadas. Justificativa:
`Vinculo.definido_em` é timestamp singular (última alteração das 3 flags, não uma por
flag — ver ER.md), e as 3 flags compartilham a mesma checagem de autoridade
(`Usuario.modo_decisao` do idoso) — 3 rotas triplicariam a mesma checagem sem ganho.
PATCH em vez de POST porque atualiza colunas específicas de um recurso existente (mesmo
padrão de `PATCH /usuario/me`), diferente de `/aprovar` e `/recusar` (transições de
estado fixas).

Ordem de validação: 404 (vínculo não existe) → 400 (`tipo_vinculo≠'cuidador'`, mesmo
código já usado no padrão de `email_convite_familiar`) → 409 (`status≠'aprovado'`, mesmo
código já usado em "vínculo já resolvido" do item 2.2) → 403 (autoridade) → 400 (nenhuma
flag booleana informada). As duas exigências `tipo_vinculo='cuidador'` e
`status='aprovado'` são obrigatórias e não opcionais: (1) as flags não têm efeito fora de
`tipo_vinculo='cuidador'` (ER.md), permitir escrita nesse caso deixaria dado morto no
banco; (2) permitir escrita num vínculo pendente ativaria a permissão automaticamente na
aprovação, sem reconfirmação — buraco de autorização.

Refatoração: a checagem de autoridade (`Usuario.modo_decisao` do idoso dono do vínculo,
mesma regra desde os itens 2.2/2.7) foi extraída de dentro de
`responderSolicitacaoVinculo` pras funções `resolverModoDecisao` e
`familiarTemVinculoAprovado`, reaproveitadas também nesta rota nova — comportamento
idêntico ao anterior, sem mudança de mensagem de erro nas rotas `/aprovar` e `/recusar`.

Nenhuma migration nova: `permite_registrar_saude`, `permite_marcar_dose`,
`permite_criar_evento_cuidado`, `definido_por_id` e `definido_em` já existiam em
`schema.prisma` desde a migration inicial (`20260831005102_init_schema`) — só faltava a
rota/lógica, como o item 2.3 já antecipava.

Testes novos em `backend/src/routes/vinculo.test.ts`
(`describe("PATCH /vinculo/:id/definir-permissoes")`): 9 casos — titular idoso atualiza
com sucesso, titular familiar aprovado atualiza com sucesso, 403 não-titular
(`modo_decisao='idoso'`), 403 familiar sem vínculo aprovado (`modo_decisao='familiar'`),
400 `tipo_vinculo='familiar'`, 409 `status≠'aprovado'`, 404 vínculo inexistente,
atualização parcial só toca campo enviado, 400 nenhuma flag enviada. Suíte completa do
backend em 77 testes/6 suítes (era 68 antes desta tarefa). `npx tsc --noEmit` limpo nos
dois pacotes.

Frontend: nova seção "Definir permissões do cuidador" em `Vinculos.tsx` — esqueleto cru
(mesma exceção de divisão de trabalho já registrada na seção Workflow), 3 checkboxes
(`permite_registrar_saude`, `permite_marcar_dose`, `permite_criar_evento_cuidado`) + id
do vínculo, chama `PATCH /vinculo/:id/definir-permissoes`. Suíte frontend sem regressão
(2 suítes/4 testes).

Fora de escopo deste item: nenhuma dívida técnica nova registrada — item fecha a Fase 2
no que diz respeito às permissões granulares do cuidador (RF-032).

**Item 2.9 da Fase 2 (RF-033) implementado — transferência de `Usuario.modo_decisao` com
janela de carência de 7 dias (2026-09-18, PR #63, mergeado em `main`, commit `98a2710`):**

Rotas novas em `backend/src/routes/vinculo.ts`: `POST /vinculo/:id/solicitar-transferencia-decisao`
(Familiar com vínculo aprovado solicita a transferência de autoridade do idoso pra
`'familiar'`) e `POST /vinculo/:id/confirmar-transferencia-decisao` (segunda confirmação,
exigida só quando o idoso tem 2+ familiares aprovados). Em ambas, `:id` é o vínculo
aprovado DO PRÓPRIO familiar chamador (`vinculado_id === req.usuarioId`) — decisão de
design desta tarefa, diferente do padrão de `/definir-permissoes` (onde `:id` é o vínculo
do cuidador-alvo, não do ator): não existe tabela separada de "solicitação de
transferência" pra escopar por id próprio, então o vínculo do próprio familiar com o idoso
serve tanto pra identificar o idoso alvo quanto pra autenticar que quem chama é de fato um
familiar aprovado dele.

Checagem preguiçosa de expiração: `resolverEstadoModoDecisao` (nova, exportada de
`vinculo.ts`) lê `Usuario.modo_decisao_solicitado` e, se a janela de 7 dias
(`modo_decisao_expira_em`) já expirou, decide entre efetivar (promove `modo_decisao` pra
`'familiar'`, preenche `modo_decisao_alterado_por_id`/`_em`) ou lapsar (limpa a solicitação
sem efetivar) — dependendo de o idoso ter 2+ `Vinculo` `tipo_vinculo='familiar'`/
`status='aprovado'` (contagem via `prisma.vinculo.count`) e, se tiver, de
`modo_decisao_segunda_confirmacao_id` já estar preenchido. A antiga `resolverModoDecisao`
(usada pra autoridade em `/aprovar`, `/recusar`, `/definir-permissoes`) virou um wrapper
fino em cima dela — ganha a checagem de expiração automaticamente, sem mudar assinatura
nem os pontos que já chamavam.

Segunda confirmação NÃO efetiva a mudança na hora — só preenche
`modo_decisao_segunda_confirmacao_id`; a efetivação de fato só acontece na próxima leitura
preguiçosa depois que a janela expirar, conforme o mecanismo descrito em `Elder Web -
Modelagem ER.md` seção 3. Confirmação do próprio solicitante é bloqueada (403).
Confirmação chegando depois da janela já ter expirado (sem segunda confirmação prévia) cai
automaticamente no lapso da leitura preguiçosa antes mesmo da rota checar — vira 409 "não
há solicitação em curso", sem checagem extra de data na rota.

`POST /auth/sync`: branch de login do idoso agora sempre cancela uma solicitação de
transferência em curso (`modo_decisao_solicitado === 'familiar'`), com prioridade sobre a
expiração da janela — não passa pela checagem preguiçosa de `resolverEstadoModoDecisao`,
faz o cancelamento direto, então mesmo se login e expiração "acontecerem ao mesmo tempo" o
login sempre ganha. `ultimo_login_em` passa a ser gravado em todo login (idoso, cuidador ou
familiar), campo que existia no schema desde a migration inicial mas nunca era escrito
antes desta tarefa.

`GET /usuario/me` estendido com `modo_decisao`, `modo_decisao_solicitado*`,
`modo_decisao_alterado_por_id`/`_em` e `modo_decisao_motivo` — chama
`resolverEstadoModoDecisao` antes de responder, então nunca devolve uma solicitação já
expirada como se ainda estivesse em curso. "Idoso é notificado" (critério de pronto desta
tarefa) = esses campos ficarem disponíveis aqui pro frontend mostrar aviso — não há envio
de e-mail, decisão de escopo desta tarefa.

`modo_decisao_motivo` (justificativa opcional do Familiar ao solicitar) é limpo junto com
os outros 4 campos de solicitação tanto no cancelamento por login quanto no lapso por
expiração sem segunda confirmação — evita motivo órfão sobrevivendo em `GET /usuario/me`
sem nenhuma solicitação pra dar contexto. Só é preenchido de novo quando uma nova
solicitação é feita; permanece intacto quando a solicitação É efetivada (fica disponível ao
lado de `modo_decisao_alterado_por_id`/`_em`).

Migration `20260918100000_add_check_modo_decisao_solicitado_conjunto` (escrita à mão,
mesmo padrão do item 2.4/2.8 — colunas já existiam desde `20260831005102_init_schema`, só
faltava a constraint) adiciona `CK_Usuario_modo_decisao_solicitado_conjunto`:
`modo_decisao_solicitado`, `modo_decisao_solicitado_por_id`, `modo_decisao_solicitado_em` e
`modo_decisao_expira_em` só podem estar todos `NULL` ou todos preenchidos
(`modo_decisao_segunda_confirmacao_id` fica de fora de propósito — é opcional mesmo com
solicitação em curso). Aplicada via `npx prisma migrate deploy` contra o Azure SQL de
produção (autorização pontual do Marcos, mesmo padrão do item 2.4 — a trava geral do
CLAUDE.md continua valendo). `backend/scripts/verify-constraints.ts` ganhou o caso 12 pra
essa CHECK — 16/16 PASS confirmados de verdade no banco.

**Limitação aceita (decisão desta tarefa, não é dívida técnica em aberto):** a expiração da
janela de 7 dias não tem job agendado — é sempre resolvida sob demanda, nos mesmos pontos
onde `modo_decisao` já era lido pra autoridade (`resolverModoDecisao`), na rota de
solicitar/confirmar transferência, em `GET /usuario/me`, e no login do idoso em `POST
/auth/sync`. Uma linha pode ficar com `modo_decisao_solicitado*` preenchido além do prazo
até o próximo desses pontos rodar — aceito conscientemente, sem mitigação nesta tarefa.

Testes novos em `backend/src/routes/vinculo.test.ts` (`describe`s de
`solicitar-transferencia-decisao`, `confirmar-transferencia-decisao` e
`resolverEstadoModoDecisao`) cobrindo: sucesso com/sem motivo, 404/400/409/403 de estado e
autoridade, edge case de confirmação chegando após expiração, e os 3 ramos da checagem
preguiçosa (efetiva com 1 familiar, lapsa com 2+ sem segunda confirmação, efetiva com 2+ e
segunda confirmação já dada) via `/aprovar` como veículo. `backend/src/routes/auth.test.ts`
ganhou `describe` dedicado pro cancelamento no login (idoso com/sem solicitação pendente,
guard por `tipo_perfil`). `backend/src/routes/usuario.test.ts` cobre a extensão de `GET
/usuario/me`. Suíte completa do backend em 104 testes/6 suítes (era 77 antes desta tarefa).
`npx tsc --noEmit` limpo nos dois pacotes.

Frontend: 3 seções novas em `Vinculos.tsx` — "Ver meu status de decisão" (`GET
/usuario/me`), "Solicitar transferência de decisão" e "Confirmar transferência de decisão"
— esqueleto cru (mesma exceção de divisão de trabalho já registrada na seção Workflow),
cobrindo só as rotas desta tarefa. Suíte frontend sem regressão (2 suítes/4 testes).

Fora de escopo desta tarefa (não implementado, por instrução explícita, fica pro item 2.10
do plano, RF-034): mudança instantânea de `modo_decisao` pelo próprio idoso, sem janela —
incluindo reverter de `'familiar'` pra `'idoso'`.

**Item 2.10 da Fase 2 (RF-034) implementado — idoso altera `Usuario.modo_decisao`
diretamente, sem janela de carência (2026-09-18, PR #65, mergeado em `main`, commit
`0e25bab` feat + `76f5669` docs):**

Rota nova `PATCH /usuario/me/modo-decisao` em `backend/src/routes/usuario.ts`, atrás de
`requireAuth`, body `{ modo_decisao: "idoso" | "familiar" }`. Separada de `PATCH
/usuario/me` de propósito, pra não misturar campo de autorização com edição de perfil.
Alvo sempre `req.usuarioId` (nunca lido de body/params). Só `tipo_perfil='idoso'` chama
(403 caso contrário); valor ausente/inválido/tipo errado recebe 400, checado depois do
403.

Chama `resolverEstadoModoDecisao` (`routes/vinculo.ts`, item 2.9) antes de decidir, mesmo
padrão de `GET /usuario/me` — garante que uma transferência vencida já foi
efetivada/lapsada antes desta rota ler o estado. Reverter `'familiar'` → `'idoso'` muda na
hora, sem checar familiares aprovados (autoridade top-level do idoso). Delegar `'idoso'`
→ `'familiar'` exige pelo menos 1 `Vinculo` `tipo_vinculo='familiar'`/`status='aprovado'`
(409 sem isso) — único desvio do texto literal do plano ("sem checar familiares
aprovados"), decisão tomada nesta tarefa e não vetada pelo Marcos. Toda mudança efetiva
grava `modo_decisao_alterado_por_id`/`_em` e zera `modo_decisao_motivo`; se havia uma
transferência em curso (item 2.9), ela é cancelada no mesmo update (6 campos
`modo_decisao_solicitado*`/`_motivo` a `NULL`). Pedido igual ao valor atual sem
solicitação em curso não grava nada; igual ao atual com solicitação em curso só cancela a
solicitação, sem tocar `modo_decisao`/`alterado_*`. No máximo 1 `prisma.usuario.update`
por request nesta rota (a escrita interna de `resolverEstadoModoDecisao`, quando ocorre,
não conta).

`MODO_DECISAO_SELECT` (antes local a `vinculo.ts`) ganhou `export` — única mudança nesse
arquivo — pra rota nova devolver os mesmos campos de `GET /usuario/me`. Nenhuma migration:
os campos usados já existiam desde a tarefa 2.9. Constante local `CANCELAMENTO_SOLICITACAO`
criada em `usuario.ts` só pra esta rota — terceira cópia da mesma lista de 6 campos (as
outras duas: `POST /auth/sync`, item 2.9, e `resolverEstadoModoDecisao`), registrada como
dívida técnica conhecida, não fechada nesta tarefa.

Testes novos em `backend/src/routes/usuario.test.ts` (TDD, RED confirmado antes da
implementação): 16 casos cobrindo os 4 ramos da tabela de decisão, guard de delegação
com/sem familiar aprovado, `NULL` tratado como `'idoso'`, reversão nunca consultando
`count`/`findFirst` de vínculo, motivo zerado, no-op com e sem solicitação em curso,
solicitação vencida efetivada antes da decisão (efetivação de `resolverEstadoModoDecisao`
+ update próprio da rota, 2 updates no total), 403 por perfil, 400 de body (4 variações
via `it.each`), e id/idoso_id no body ignorados. Suíte completa do backend: 6 arquivos de
teste, 120 testes (era 104). `npx tsc --noEmit` limpo nos dois pacotes. `npm run lint` do
backend pegou 1 erro (`_` não usado num loop de teste), corrigido antes do commit.

Frontend: seção nova "Alterar quem decide (só idoso)" em `Vinculos.tsx` — esqueleto cru
(mesma exceção de divisão de trabalho já registrada na seção Workflow), select
`idoso`/`familiar` + botão, chama a rota nova. Suíte frontend sem regressão (2 suítes/4
testes).

`docs/Elder Web - Modelagem ER.md` ganhou parágrafo novo na seção 3 (mecanismo de
alteração direta pelo idoso, logo após a lista de transferência do item 2.9) e REV.14 na
tabela de histórico.

Fora de escopo desta tarefa (não implementado, por instrução explícita): reabertura do
mecanismo da 2.9 (RF-033), contestação de vínculo via `notificado_em`, job agendado, envio
de e-mail.

**Item 3.1 da Fase 3 (RF-030) implementado — Familiar cadastra conta de Idoso (2026-09-21,
PR #70, mergeado em `main` por rebase: `a85d67d` implementação, `679c716` script de
verificação; hashes finais diferentes dos commits locais `b80ba02`/`c6148d1`, mesmo padrão
dos PRs anteriores):**

`POST /usuario/cadastrar-idoso`, em `backend/src/routes/usuario.ts`, atrás de
`requireAuth`. Só `tipo_perfil='familiar'` chama (403 caso contrário). Do body só são
lidos `nome` (obrigatório, até 150), `email` (opcional, `isValidEmailFormat`, até 255),
`telefone` (opcional, até 20) e `aceita_termo_responsabilidade` (precisa ser o booleano
`true`; ausente, `false` ou string dá 400). Pelo menos um entre `email` e `telefone` é
validado na aplicação antes do insert. `tipo_perfil`, `cadastrado_por_id`, `firebase_uid`,
`modo_decisao`, `email_convite_familiar` e o timestamp do aceite nunca vêm do body.

Um único `prisma.usuario.create` com escrita aninhada (`vinculos_como_idoso`), sem
`$transaction`. Usuario: `tipo_perfil='idoso'`, `firebase_uid` NULL,
`cadastrado_por_id` do Familiar, `termo_responsabilidade_aceito_em` gerado no servidor,
`modo_decisao='familiar'` (`modo_decisao_alterado_*` ficam NULL). Vinculo:
`tipo_vinculo='familiar'`, `origem='cadastro_familiar'`, `aprovador_id` e `notificado_em`
NULL. Status `aprovado` (com `confirmado_em`) se o e-mail do Familiar já está verificado
no token, senão `pendente`. Para isso `requireAuth` passou a expor `req.emailVerificado`
(false quando ausente, declarado em `types/express.d.ts`). E-mail duplicado: 409 com
mensagem genérica via `isDuplicateEmail`, sem dado de outra conta (mensagem específica é
o item 3.2).

`POST /auth/sync`: o `updateMany` do branch de login do Familiar passou a usar
`origem: { in: ["convite_idoso", "cadastro_familiar"] }`. `solicitacao_familiar` continua
de fora (aprovação manual).

Nenhuma migration na tarefa em si. 26 testes novos (22 em `usuario.test.ts`, 1 em
`auth.test.ts`, 3 em `requireAuth.test.ts`) mais o ajuste do teste existente do `where`
do `updateMany`. Suíte do backend: 6 arquivos, 146 testes (era 120). Frontend: seção
"Cadastrar idoso (só familiar)" em `Vinculos.tsx`, esqueleto cru (texto do termo
provisório; texto final e layout são de Laureane e Jennifer); suíte frontend sem
regressão (2 suítes/4 testes).

`backend/scripts/verify-cadastrar-idoso.ts` confirma no banco real (transação sempre
revertida, 3/3 PASS): create aninhado válido aceito, erro real de e-mail duplicado
reconhecido por `isDuplicateEmail`, nenhum Vinculo órfão. Rodar de novo:
`npx tsx scripts/verify-cadastrar-idoso.ts` (dentro de `backend/`).

CHECK `CK_Usuario_termo_cadastrado_por` (`termo_responsabilidade_aceito_em IS NULL OR
cadastrado_por_id IS NOT NULL`) trava a regra a nível de banco. Migration
`20260921090000_add_check_termo_cadastrado_por` escrita à mão (coluna já existia desde
`20260831005102_init_schema`), PR #71, mergeado em `main` (`d8be21f`). Aplicada no Azure
via `npx prisma migrate deploy` (autorização explícita de Marcos, rodada por ele mesmo;
a trava geral do CLAUDE.md continua valendo). `backend/scripts/verify-constraints.ts`
ganhou o caso 13 pra essa CHECK: 16/17 antes do deploy (caso novo falhando, como
esperado), 17/17 PASS depois, confirmados de verdade no banco.

**Limitações conhecidas (não mitigadas):** o idoso cadastrado não tem `firebase_uid` nem
conta Firebase, então não consegue logar, e nada da 3.1 cobre como ele assume a conta
(proposta: item 3.3, não implementado, aguardando decisão de Marcos); idoso só com
telefone não loga (Firebase do projeto só tem e-mail/senha e Google); o e-mail informado
pelo Familiar não é verificado e pode ocupar o e-mail de terceiro (lacuna de colisão de
e-mail já registrada acima); sem deduplicação nem limite de cadastros por Familiar; texto
do termo sem versionamento.

Fora de escopo desta tarefa (não implementado, por instrução explícita): item 3.2,
fluxo de o idoso cadastrado assumir a conta, mitigação da janela de autoridade vazia,
contestação de vínculo via `notificado_em`, envio de e-mail, job agendado.

**Contestação de vínculo automático de familiar (RF-022, dívida técnica do item 2.5)
implementada (2026-09-21, PR #74, mergeado em `main` por rebase: `25f557f`
implementação, `744cc97` script de verificação; hashes finais diferentes dos commits
locais `be70456`/`d9e77c0`, mesmo padrão dos PRs anteriores):**

`POST /vinculo/:id/contestar`, em `backend/src/routes/vinculo.ts`, atrás de
`requireAuth`. Elegível: `tipo_vinculo='familiar'`, `status='aprovado'` e `origem` em
(`convite_idoso`, `cadastro_familiar`), os dois vínculos que aprovam por e-mail, sem
aprovação humana. `origem='solicitacao_familiar'` fica fora, porque já passou por
aprovação manual. Ordem de validação: 400 id não numérico, 404 vínculo inexistente, 400
fora de elegibilidade, 409 status diferente de `aprovado`, 403 autoridade. A autoridade
segue `Usuario.modo_decisao` do idoso dono do vínculo, mesma regra de `/aprovar` e
`/recusar`, via `resolverEstadoModoDecisao` e `familiarTemVinculoAprovado`: com
`modo_decisao` diferente de `'familiar'` só o idoso contesta; com `'familiar'` o idoso
recebe 403 e só familiar com vínculo aprovado contesta. Contestar o próprio vínculo
(chamador igual a `vinculado_id`) retorna 403, porque isso seria desvincular, outro
requisito.

Efeito: `status='recusado'`, `aprovador_id` de quem contestou e `data_resposta`, os
mesmos campos que `/recusar` grava. Nos vínculos automáticos `data_resposta` era `NULL`,
então a data da contestação fica registrada (corrige a premissa inicial da tarefa, que
assumia o contrário). Sem migration e sem coluna nova.

Transferência de `modo_decisao` em curso (item 2.9): `resolverEstadoModoDecisao` não
revalida o vínculo do solicitante nem do segundo confirmador na efetivação, então a rota
trata esse caso. Se o vínculo contestado é do solicitante
(`modo_decisao_solicitado_por_id`), cancela a solicitação inteira (6 campos); se é do
segundo confirmador (`modo_decisao_segunda_confirmacao_id`), zera só esse campo. A
mudança de status e o ajuste em `Usuario` vão juntos em `prisma.$transaction([...])`, na
forma em array (nenhuma rota usava `$transaction` antes). A lista dos 6 campos
de cancelamento vive numa única constante, `CANCELAMENTO_SOLICITACAO`, em
`backend/src/lib/modoDecisao.ts` (módulo sem imports, usado por `auth.ts`, `vinculo.ts` e
`usuario.ts`, sem risco de import circular). Na implementação inicial a constante era
exportada de `vinculo.ts` e ainda restavam duas cópias inline (login do idoso em `POST
/auth/sync` e lapso por expiração em `resolverEstadoModoDecisao`); o refactor posterior,
sem mudança de comportamento e sem alterar nenhum teste, consolidou as três.

`Vinculo.notificado_em` continua não escrito por nenhum código. Não existe canal de
notificação, então gravar a data afirmaria um aviso que nunca foi enviado. A contestação
não depende do campo e não tem prazo. `docs/Elder Web - Modelagem ER.md` ganhou a nota na
seção 3 e a REV.16, que registra que o campo fica reservado para quando houver canal
real de notificação.

Testes, escritos antes da implementação (RED confirmado, 18 falhas com a rota
inexistente): 20 novos (166 contra 146 da linha de base), sendo 19 em `vinculo.test.ts` e
1 em `auth.test.ts`, contados pelas linhas `it(` e `it.each` adicionadas em `25f557f`.
Cobrem sucesso por idoso e por familiar aprovado, 403 nos dois modos, 403 do idoso com
`modo_decisao='familiar'`, 403 no próprio vínculo, 401, 400, 404, 409, vínculo contestado
deixando de passar em `requireVinculoAprovado` (com estado em memória), os casos de
transferência em curso e, em `auth.test.ts`, o login do familiar contestado não
reativando o vínculo `recusado`. Suíte do backend: 6 arquivos, 166 testes. Frontend: 2
suítes, 4 testes, sem regressão. Seção "Contestar vínculo automático de familiar" em
`frontend/src/pages/Vinculos.tsx`, esqueleto cru.

**Verificação no banco (`backend/scripts/verify-constraints.ts`):** os casos 5 a 7
(`CK_Vinculo_tipo_vinculo`, `CK_Vinculo_origem`, `CK_Vinculo_status`) foram reescritos com
controle positivo (o mesmo insert com valor válido é aceito) e com a exigência de que o
erro do banco cite o nome da constraint. Os casos novos 14 e 14b cobrem o índice único
filtrado `Vinculo_idoso_id_vinculado_id_tipo_vinculo_key`: duplicata ativa rejeitada
citando o índice, e vários `recusado` mais um ativo do mesmo par aceitos. Rodado uma vez
contra o Azure, com autorização explícita: 22/22 PASS. Cada caso roda numa
`$transaction` cujo callback sempre lança `ForceRollback`, e o Prisma reverte em qualquer
exceção. `COUNT(*)` antes e depois: `Usuario` 3 e `Vinculo` 0, iguais.

**Limitações conhecidas (não mitigadas):** (a) contestar não é reversível pelo mesmo
caminho: o familiar contestado precisa de nova solicitação pelo Fluxo B (item 2.6), que
não alcança idoso sem e-mail; (b) vínculo aprovado com `origem='solicitacao_familiar'`
não é contestável por esta rota; (c) um vínculo automático contestado e um recusado ainda
pendente podem ficar indistinguíveis quando `confirmado_em` é nulo, porque `/aprovar` não
o preenche; (d) `POST /vinculo/:id/aprovar` aprova vínculos `convite_idoso` e
`cadastro_familiar` pendentes sem exigir `confirmado_em` (`vinculo.ts:377`, `382`, `403`),
decidido pelo grupo em 21/09/2026 (opção C: permitido, sem mudança de código), sem reabrir
as decisões dos itens 2.2 e 2.7 (ver a entrada "Decisão do P1 (21/09/2026)" no fim deste
arquivo); (e)
antes do item 2.11 a contestação só era exercitável por id no esqueleto; `GET /vinculo`
(item 2.11) já lista os vínculos.

**Decisão sobre a limitação (d) (21/09/2026, opção C):** a aprovação manual de
`POST /vinculo/:id/aprovar` continua como assinatura do titular de `Usuario.modo_decisao`, sem
exigir `confirmado_em`. Não exigiu migration nem mudança de código, não reabriu as decisões
dos itens 2.2 e 2.7, e a autoridade de aprovar é a mesma que contesta depois. Exigir
`confirmado_em` (409) foi descartado por bloquear vínculo cujo e-mail de confirmação nunca
chega. Gravar `confirmado_em` na aprovação manual também está descartado, porque afirmaria uma
posse de e-mail que não houve. Detalhes na entrada "Decisão do P1 (21/09/2026)" no fim deste
arquivo.

**Verificação de tipos do script:** o `tsc` avulso sobre
`backend/scripts/verify-constraints.ts` acusava `cadastrado_por_id` desconhecido. Causa: o
script fica fora do `include` do `tsconfig.json` (só `src`), e `baseUsuario` era tipada com
`Prisma.UsuarioCreateInput`, que só aceita a relação `cadastrado_por`; o Prisma Client não
estava desatualizado. Corrigido trocando o tipo para `Prisma.UsuarioUncheckedCreateInput`.

**Item 2.11 da Fase 2 implementado: listagem de vínculos, `GET /vinculo` (2026-09-21, PR #77,
mergeado em `main`, commit `7e326259ba92e25e8eccc96243c5648530492475`, hash final
diferente do commit local `1e24557`; ajustes
posteriores no PR #78, mergeado em `main`, commit `df27b65e034eaeec3fe6b824c6b9da520ba4407b`):**

Rota `GET /vinculo` em `backend/src/routes/vinculo.ts`, atrás de `requireAuth`. Cada item traz
`papel_do_chamador` com um destes valores: `dono` (chamador é o idoso do vínculo), `vinculado`
(chamador é o cuidador ou familiar do vínculo) ou `titular` (familiar aprovado com autoridade
sobre o idoso, vendo vínculo de outra pessoa). Visibilidade: idoso lê os vínculos com
`idoso_id` igual ao próprio; cuidador e familiar leem os com `vinculado_id` igual ao próprio; o
familiar também lê todos os vínculos de um idoso quando tem vínculo `tipo_vinculo='familiar'` e
`status='aprovado'` com ele e `resolverModoDecisao` devolve `'familiar'` para esse idoso (mesma
regra de autoridade de `/aprovar`, `/recusar`, `/contestar` e `/definir-permissoes`). Cuidador
nunca é titular. Vínculo que cabe em dois papéis aparece uma vez, como `vinculado`.

Campos do item: `id`, `tipo_vinculo`, `origem`, `status`, `data_solicitacao` (o campo do
schema; não existe `criado_em` em `Vinculo`), `data_resposta`, `confirmado_em`,
`papel_do_chamador`, `idoso` e `vinculado`, cada um com `id`, `nome` e `email_mascarado`. Nunca
telefone, e-mail completo, `firebase_uid` nem outro campo de `Usuario`. A máscara é a função pura
`mascararEmail` (`backend/src/lib/mascararEmail.ts`): primeiro caractere da parte local, `***`,
arroba e domínio completo; e-mail nulo vira `null`; malformado vira `***`. Ordem por
`data_solicitacao` decrescente. Filtro opcional `?status=pendente|aprovado|recusado` (outro valor
retorna 400). Sem paginação.

Fail-closed sobre o idoso: quando o chamador é só o vinculado e o status não é `aprovado`,
`idoso.nome` e `idoso.email_mascarado` vêm `null`, para que nenhuma conta leia o nome de um idoso
apenas solicitando vínculo pelo e-mail dele. O `idoso.id` também vinha exposto nesse caso na
primeira versão (PR #77); o PR #78 passou a devolvê-lo `null`. O idoso e o titular veem sempre o
`vinculado` completo (nome e e-mail mascarado). `confirmado_em` e `data_resposta` vão na
resposta e permitem distinguir vínculo contestado de recusado ainda pendente; a listagem não
rotula isso.

`resolverEstadoModoDecisao` pode gravar durante este GET (efetiva ou lapsa transferência
vencida), mesmo padrão de `GET /usuario/me`: a leitura tem efeito colateral. Para o papel de
titular, a rota chama `resolverModoDecisao` uma vez por idoso em que o familiar tem vínculo
aprovado, o que gera uma consulta por idoso, sem otimização nesta etapa. Os idosos do titular são
derivados das próprias linhas do familiar (filtro `tipo_vinculo === "familiar" && status ===
"aprovado"`, `vinculo.ts:739` na revisão auditada) em vez de chamar `familiarTemVinculoAprovado`,
com o mesmo resultado. Nenhuma migration. Esqueleto cru em `frontend/src/pages/Vinculos.tsx`
(seção "Listar vínculos", id do vínculo em destaque); os campos de id das outras seções não foram
preenchidos a partir da lista.

Testes: backend de 166 para 195 em 8 suítes (21 em `vinculoListar.test.ts`, com fake de Prisma em
memória com dois idosos, e 8 em `mascararEmail.test.ts`); frontend 4 em 2 suítes, sem mudança.
Auditoria posterior (PR #78): o teste de vazamento passava por vacuidade sem a rota, porque a
resposta 404 não tem dados; agora todo teste parte de status 200 e lista presente, e o de
vazamento exige lista não vazia por perfil. Mutação local, não commitada, com cada uma derrubando
pelo menos um teste: telefone no item, e-mail completo no lugar do mascarado, remoção do `null`
do idoso (D7), titular com vínculo pendente ou recusado e titular sem filtro por idoso. CI do
PR #77 (`backend`, `frontend`, Vercel) e o CI de `main` no commit de merge passaram.

A dependência do P1 (`/aprovar` sem exigir `confirmado_em`) do item 2.11 foi cumprida: o titular
já vê quem é o familiar antes de aprovar. O P1 foi decidido pelo grupo em 21/09/2026 (opção C, ver a
entrada "Decisão do P1 (21/09/2026)" no fim deste arquivo), e nada em `/aprovar` foi alterado.

**Decisão do P1 (21/09/2026): aprovação manual de vínculo automático.**

`POST /vinculo/:id/aprovar` continua aprovando vínculos pendentes de origem `convite_idoso` e
`cadastro_familiar` sem exigir `confirmado_em` (opção C, confirmada pelo grupo). O backend não
muda. Quem tem autoridade para aprovar continua sendo definido por `Usuario.modo_decisao`.

Contrato para o frontend: `GET /vinculo` já devolve `confirmado_em` em cada item. O aviso "e-mail
ainda não confirmado" deve ser exibido antes de o titular aprovar, e vale só quando `origem` é
`convite_idoso` ou `cadastro_familiar`, `status` é `pendente` e `confirmado_em` é nulo. Vínculos
manuais (`solicitacao_cuidador` e `solicitacao_familiar`) têm `confirmado_em` sempre nulo por
construção e NÃO devem exibir esse aviso.

Risco aceito conscientemente: um e-mail de familiar digitado errado por um idoso pode ser
aprovado à mão sem verificação de posse do e-mail. A mitigação escolhida é informativa (aviso na
tela), não bloqueante.

Teste de caracterização: `backend/src/routes/vinculoListar.test.ts` ganhou o bloco "contrato de
`confirmado_em`", com 3 casos (dono, vinculado e titular) que afirmam o valor quando preenchido e
`null` quando nulo. O teste passa sem mudança de código, porque o comportamento já existia. Removendo
`confirmado_em` do item da resposta em `vinculo.ts`, os 3 casos falham (mutação temporária, revertida,
nunca commitada). Suíte do backend: 8 arquivos, 198 testes. Nenhuma linha de código de produção mudou.

**Item 3.2 da Fase 3 (RNF-011) implementado — mensagens específicas nos conflitos
de e-mail no cadastro (2026-09-21, PR #82, mergeado em `main`, commit `64757d9` —
hash final diferente do commit local `819dc3f`, mesmo padrão dos PRs anteriores):**

Validação em aplicação antes do `INSERT` nas duas rotas de cadastro, via `findFirst`
por e-mail. O catch de constraint (`isDuplicateEmail`) continua só como rede de
segurança para corrida.

`POST /usuario/cadastrar-idoso`: se o e-mail já existe, 409
`EMAIL_JA_EM_USO_CADASTRO_IDOSO`, uma mensagem só, sem distinguir o tipo da conta
encontrada. A pré-checagem seleciona só `id`.

`POST /auth/sync`, ramo de criação: a pré-checagem seleciona `id`, `firebase_uid`
e `cadastrado_por_id`. A mensagem específica `EMAIL_CADASTRADO_POR_FAMILIAR` só
sai quando `email_verified === true`, `tipo_perfil` pedido é `idoso`,
`firebase_uid` é nulo e `cadastrado_por_id` está preenchido — ou seja, a linha
encontrada é mesmo um idoso cadastrado por Familiar via RF-030. Em qualquer outro
caso (e-mail comum já em uso, ou idoso cadastrado por Familiar mas token não
verificado, ou perfil diferente de idoso), 409 `EMAIL_JA_EM_USO` com corpo
idêntico ao caso comum, para não revelar a origem da conta pelo formato da
resposta. O catch de `isDuplicateEmail` passou a devolver esse 409 em vez de
`next(e)` (antes virava 500).

Contrato novo desses 409: `{ error, codigo, proximo_passo }`. Textos centralizados
em `backend/src/lib/mensagensConflito.ts`, marcados como **provisórios até a
tarefa 3.3** — em especial `EMAIL_CADASTRADO_POR_FAMILIAR` não promete nenhum
fluxo de "assumir a conta", porque esse fluxo ainda não existe.

**Frontend — `lib/auth.ts` estendido além do 409 novo (mesmo commit):** durante a
implementação, ficou confirmado que `syncUser` lançava erro só como string
(`"Falha em /auth/sync: status N — {corpo}"`), sem `status` nem `codigo` como
campos, e que `mensagemErroCadastro`/`mensagemErroLogin` casavam qualquer erro
contendo `/auth/sync` na mensagem e mostravam "servidor está iniciando" (texto do
bug de 17/09) — inclusive para os 409 novos, os 400 de validação e os 401 de
token. Isso escondia o `proximo_passo` que a tarefa 3.2 pedia. Corrigido:

- `syncUser` agora lança `SyncError` (exportado de `lib/auth.ts`), com `status`,
  `message` (o `error` do backend), `codigo?` e `proximoPasso?` como propriedades
  reais, via `res.json()` dentro de `try`.
- `mensagemErroCadastro`/`mensagemErroLogin`: `SyncError` com `codigo` mostra
  `error` + `proximo_passo` (o 409 novo); `SyncError` com `status >= 500` mantém
  o texto de "servidor está iniciando" (17/09, sem regressão); `SyncError` 4xx
  sem `codigo` mostra "Falha ao sincronizar sua conta com o servidor. Confira os
  dados e tente novamente." (não culpa mais o servidor por erro de validação);
  falha de rede pura (`TypeError`) continua nos textos genéricos de antes.
- `ConfirmarEmail.tsx` consome `syncUser` direto e exibe `err.message` na tela —
  não precisou de edição, só passou a mostrar texto legível (`error` do backend)
  em vez do erro cru antigo. Essa página só atinge o branch de login de conta já
  existente, não os 409 de conflito de e-mail.

Nenhuma migration. Suíte do backend: 8 arquivos, 213 testes (era 198). Frontend:
3 suítes, 8 testes (era 2 suítes, 4 testes) — `lib/auth.test.ts` novo cobre
`SyncError` com `codigo`, `status >= 500`, 4xx sem `codigo` e erro que não é
`SyncError`. `tsc --noEmit` e lint limpos nos dois pacotes; build limpo no
backend.

**Limitações conhecidas (não mitigadas):**
- Conflito 2 deixa uma conta Firebase órfã: no cadastro por e-mail/senha, o
  Firebase já criou a conta antes de `/auth/sync` devolver o 409. O texto "use
  outro e-mail" não avisa disso.
- A orientação do conflito 2 é provisória até a tarefa 3.3 existir.
- Enumeração de e-mail no conflito 1: um Familiar autenticado descobre se um
  e-mail já tem conta ativa (inerente ao critério de pronto da tarefa). O 409
  genérico do conflito 2 limita esse mesmo vazamento no autocadastro, mas não o
  elimina por completo.
- Idoso cadastrado só com telefone continua fora de escopo (decisão da 3.3).
- `/auth/sync` não normaliza e-mail antes da pré-checagem (o Firebase costuma
  entregar em minúsculas, mas não é garantido); `/cadastrar-idoso` faz `trim()`
  sem normalizar caixa; collation do SQL Server não verificada. Risco: colisão
  real não detectada pela pré-checagem se a caixa divergir, cai só no catch de
  constraint como rede de segurança.
- A pré-checagem nova herda o retry de até ~31s de
  `PrismaClientInitializationError` da client extension de `lib/prisma.ts`.

Fora de escopo desta tarefa (não implementado, por instrução explícita): tarefa
3.3 (idoso assume conta cadastrada por Familiar, anexando `firebase_uid`), Phone
Auth, exclusão da conta Firebase órfã.

**Checklist de testes da Fase 1 fechado — todos os itens ⏳ viraram ✅ (2026-09-22, PR #85,
mergeado em `main`):**

Fonte de verdade da tarefa: nota "Elder Web - Plano de Desenvolvimento.md" no Obsidian, seção
"Fase 1 — Autenticação e identidade", bloco "Testes". Baseline antes da tarefa: backend 8
arquivos/213 testes, frontend 3 suítes/8 testes. Ao final: backend 10 arquivos/262 testes,
frontend 8 suítes/32 testes, e2e Playwright 3/3 (idoso, cuidador, familiar) — nenhum item
ficou pendente.

5 commits em `development`, PR #85 mergeado em `main` (commits preservados 1:1 por rebase, não
squash — hashes finais diferentes dos locais, mesmo padrão de PRs anteriores):
- `b5b2df8` (local) / `abcd7b0` (main) — `test(backend): completa cobertura da checklist de
  testes da Fase 1`
- `bef328a` / `6c5d47f` — `test(frontend): cobre Login/Cadastro/EsqueciSenha/Perfil/Sidebar e
  retry do syncUser`
- `d31c02b` / `4e3577f` — `test(e2e): fluxo cadastro→login→perfil→logout via Playwright (3
  perfis)`
- `7d28646` / `1e710d9` — `test(e2e): troca clique com force pelo clique no texto visível do
  rádio`
- `e167532` / `f39e9b3` — `fix(frontend): remove ponto-e-vírgula solto (no-extra-semi) em
  auth.test.ts`

**Backend (commit `b5b2df8`):** describe base novo em `auth.test.ts` pra `POST /auth/sync`
(401 sem token, 401 token inválido, 400 sem `tipo_perfil`, cria idoso/cuidador/familiar,
login não duplica, corrida de `firebase_uid` duplicado); 503 do Firebase indisponível
coberto em `auth.test.ts` e `requireAuth.test.ts` (token expirado continua 401);
`authHelpers.test.ts` novo (Jest puro, sem Supertest, `it.each` pras 5 funções);
`prisma.test.ts` novo, cobrindo o retry com backoff de `lib/prisma.ts` via fake de
`PrismaClient.$extends` + `jest.useFakeTimers` (sucesso direto, retry parcial,
esgotamento das 6 tentativas ~31s, erro que não é `PrismaClientInitializationError`
passando direto).

**Bug real #1 encontrado e corrigido — `PATCH /usuario/me` aceitava nome em branco:**
escrevendo o teste de "nome vazio" pedido pelo checklist, ficou confirmado que
`backend/src/routes/usuario.ts` não tinha nenhuma validação de `nome` (só e-mail/telefone
tinham o guard de "não pode ficar vazio"). Corrigido com o mesmo padrão 400 já usado ali —
`nome` vazio/só espaço é rejeitado antes do update.

**Frontend (commit `bef328a`):** testes novos pra `Login.tsx`, `Cadastro.tsx`,
`EsqueciSenha.tsx`, `Perfil.tsx` e `Sidebar.tsx` (logout) — sucesso, erro com
`role="alert"`, botão desabilitado durante a chamada, redirecionamento, distinção
"Firebase falhou" x "`/auth/sync` falhou" onde já existia essa lógica (item 3.2);
`lib/auth.test.ts` ganhou bloco de retry do `syncUser` (5xx, `TypeError` de rede, 4xx sem
retry, esgotamento das 5 tentativas) via `jest.useFakeTimers`.

**Bug real #2 encontrado e corrigido — acessibilidade de `CampoLogin.tsx`:** componente
usado só por `Login.tsx` tinha `<label>` sem `htmlFor` e `<input>` sem `id` — sem
associação, quebra leitor de tela e `getByLabelText` do Testing Library. Inconsistente com
`CampoTexto.tsx` (usado no Cadastro), que já seguia o padrão certo. Corrigido com o mesmo
`id`/`htmlFor`.

**Gap de infra corrigido (mesma classe do TextEncoder de 13/09):** `frontend/jest.config.cjs`
não tinha `moduleNameMapper` pra imagens — qualquer teste de página que importasse
`.png`/`.svg` (caso de `Login.tsx`, via `LadoInformativo`) quebrava o parse do Jest.
`jest.fileMock.cjs` novo resolve isso; `testPathIgnorePatterns` também ganhou `e2e/`, pra o
Jest não tentar rodar os specs do Playwright como se fossem teste unitário.

**E2E novo (commits `d31c02b` e `7d28646`):** `@playwright/test` instalado só no frontend
(autorizado explicitamente); `frontend/e2e/fluxo-completo.spec.ts` cobre cadastro→
login→perfil→logout pra idoso, cuidador e familiar, contra frontend + backend locais de
verdade, sem mock de rede. Roda contra o SQL Server LOCAL do `docker-compose.yml` (nunca
o Azure de produção) — o volume `elder_web_mssql_data` já existia com senha antiga de uma
tentativa anterior, recriado do zero pra esta tarefa. Firebase Auth continua sendo o
projeto real, porque não existe projeto de teste dedicado — e-mails de teste usam prefixo
`e2e-` e domínio `.test` (reservado pela IANA) pra ficar marcado como dado fake.
`playwright.config.ts` sobe frontend/backend via `webServer` com `reuseExistingServer:
true`; o backend usa `port: 3000`, não `url`, porque nenhuma rota GET dele responde 2xx (só
POST/PATCH autenticados) e o check por `url` do Playwright exige 2xx-3xx — com `url` ele
tentava subir um processo novo em cima do que já estava de pé (`EADDRINUSE`).

O primeiro clique no rádio customizado de perfil (`TipoPerfil.tsx`, input `sr-only` coberto
pelo ícone) usava `.click({ force: true })` direto no input, com o commit `d31c02b`.
Investigado no commit seguinte (`7d28646`): trocado pra `page.getByText(radio, { exact: true
}).click()` no texto visível dentro do `<label>`, sem `force` — passou 3/3 sem falha,
confirmando que a interação do componente está correta (delegação nativa de `<label>` pro
input) e que o `force: true` anterior mascarava só um seletor de teste ruim, não um bug
real do componente.

**Bug de CI pego só pelo lint, não localmente (commit `e167532`):** o job `frontend` do PR
#85 falhou em `npm run lint` — 5 erros `no-extra-semi` em `lib/auth.test.ts` (ponto-e-vírgula
líder `;(global.fetch as jest.Mock)...`, guard defensivo contra ASI desnecessário porque a
linha anterior sempre terminava em `{` de abertura de bloco ou estava em branco).
Reproduzido local com `npx eslint .` antes de corrigir, confirmando que não era flake nem
diferença de config do runner — só não tinha sido rodado localmente depois de escrever o
bloco de retry do `syncUser` (rodei `tsc --noEmit` e `npm test`, não `npm run lint`).

Container de teste (`elder_web-db-1`) derrubado com `docker compose down` ao final da
tarefa — nenhum artefato de teste local ficou de pé.

Fora de escopo (não implementado, por instrução explícita): CI ainda não roda o e2e
Playwright (sem infraestrutura de banco/Firebase de teste dedicada lá); nenhuma mudança de
schema ou de migration nesta tarefa.
