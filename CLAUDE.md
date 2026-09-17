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
