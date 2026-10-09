# Elder Web: histórico de implementação

Diário de implementação movido do `CLAUDE.md` para enxugá-lo (o arquivo passou do
limite de 150k caracteres). **Não é carregado automaticamente em toda sessão.** Consultar
sob demanda, quando a tarefa tocar o item/feature descrito (ex.: "como o item 2.9 foi
feito", "por que o `errorHandler` não loga `message`").

O que vale sempre (regras, decisões fechadas, convenções) fica no `CLAUDE.md`. Aqui
ficam os registros por tarefa: o que foi feito, testes, bugs achados, limitações
conhecidas e hashes de commit. Conteúdo preservado sem alteração, na ordem original.

---

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

**Item 3.3 da Fase 3 (RF-001, RF-030 extensão) implementado — idoso cadastrado por
Familiar assume a própria conta, anexando firebase_uid (2026-09-23):**

Em `POST /auth/sync` (`backend/src/routes/auth.ts`), a pré-checagem por e-mail (item 3.2)
ganhou um terceiro desfecho. Quando a linha encontrada é um idoso cadastrado por Familiar
(`firebase_uid` NULL, `cadastrado_por_id` preenchido) e `tipo_perfil` pedido é `idoso`:
- `decoded.email_verified === true` → anexa o `firebase_uid` do token à linha existente via
  `prisma.usuario.update` (nunca `create`) e responde 200 `{ criado: false, usuario }`, mesmo
  formato do login.
- `decoded.email_verified` falso/ausente → 409 `EMAIL_CADASTRADO_POR_FAMILIAR`, agora com texto
  definitivo orientando a confirmar o e-mail (a mensagem era provisória desde a tarefa 3.2).

Qualquer outro caso (linha já tem `firebase_uid`, ou `tipo_perfil` pedido não é `idoso`)
continua caindo no 409 `EMAIL_JA_EM_USO` genérico, sem distinguir o tipo da conta — mesmo
comportamento de antes, não mudou.

**Decisão tomada nesta tarefa (não estava explícita no plano):** a condição
`email_verified=true` + idoso + `firebase_uid` NULL + `cadastrado_por_id` preenchido, que em
3.2 disparava o 409 informativo, virou o próprio caminho de sucesso do anexo. O 409
`EMAIL_CADASTRADO_POR_FAMILIAR` foi realocado para o caso `email_verified=false` da mesma
linha — é o que o idoso vê no primeiro `/auth/sync` logo após se cadastrar no Firebase, antes
de confirmar o e-mail; a confirmação leva a uma segunda chamada de `/auth/sync` com
`email_verified=true`, que anexa sozinha.

**A validação de `nome` obrigatório em `POST /auth/sync` foi reordenada** (mesma tarefa,
achado ao escrever o e2e ponta a ponta): antes rodava logo depois de `tipo_perfil`, bloqueando
qualquer chamada sem `nome` — inclusive o caminho de anexo acima, que nunca usa `nome` (a
linha existente já tem o nome que o Familiar informou). A checagem foi movida pra depois do
bloco de pré-checagem de e-mail/anexo/conflito, exigida só quando o código vai de fato chamar
`prisma.usuario.create`. Comportamento de criação de conta nova não mudou — `nome` continua
obrigatório nesse caso, só a ORDEM em que é checado mudou.

**Reabertura da tarefa 3.1: e-mail agora é obrigatório em `POST /usuario/cadastrar-idoso`.**
A opção "só telefone" foi removida — telefone continua existindo como campo, mas só como
complemento opcional ao e-mail, nunca mais suficiente sozinho. Motivo: o anexo de 3.3 depende
do e-mail como chave de reconhecimento; sem e-mail, o idoso cadastrado por Familiar não tem
caminho nenhum pra assumir a própria conta. **Aviso pendente para Laureane e Jennifer:** o
formulário "Cadastrar idoso" (`Vinculos.tsx`, esqueleto cru, linha ~784) ainda mostra o texto
antigo "informe e-mail ou telefone (pelo menos um)" — precisa virar e-mail obrigatório,
telefone complementar — [Marcos avisar].

**`frontend/src/pages/Cadastro.tsx` também mudou (achado numa segunda rodada da mesma
tarefa):** `sendEmailVerification` (Firebase Web SDK) disparava só quando `tipoPerfil ===
"familiar"` (decisão original da tarefa 2.5). Sem isso, o idoso cadastrado por Familiar que se
autocadastra nunca recebia o e-mail de confirmação, nunca chegava em `email_verified=true`, e
o anexo desta tarefa ficava inalcançável na prática — mesmo com o backend correto. Ajuste
mínimo e cirúrgico nos dois handlers (`handleSubmit` e `handleGoogleCadastro`): condição
passou a `tipoPerfil === "familiar" || tipoPerfil === "idoso"`, nada mais tocado no arquivo.
Este é o arquivo "de verdade" de Laureane/Jennifer (ver Workflow) — **avisar as duas** sobre
essa mudança de comportamento fica com o Marcos, não foi comunicado por conta própria aqui.

**`frontend/src/pages/ConfirmarEmail.tsx` também mudou, mesmo motivo:** essa página (item 2.5)
chamava `syncUser()` sem argumentos — funcionava pro Familiar (RF-025) porque, nesse caso, o
`firebase_uid` já bate desde o cadastro e a chamada cai direto no branch de login, que ignora
`tipo_perfil`/`nome`. Pro idoso do 3.3, é exatamente aqui que o anexo deveria acontecer — e
`firebase_uid` ainda NÃO bate nesse momento, então a chamada cai no branch de criação, que
exige `tipo_perfil` (e, antes do ajuste acima, exigia `nome` também). Corrigido enviando
`syncUser({ tipoPerfil: 'idoso' })` fixo — seguro pro Familiar também, porque nesse caso o
valor é ignorado (branch de login não lê `tipo_perfil`).

Nenhuma migration em nenhuma das rodadas: nenhum campo/tabela novo, só lógica em cima do
que já existia desde a tarefa 3.1 (`firebase_uid`, `cadastrado_por_id`, `email`).

**Testes:** `backend/src/routes/auth.test.ts` ganhou o describe "idoso assume conta cadastrada
por Familiar (3.3)" com 6 casos — anexa com sucesso (`email_verified=true`, verifica `update`
chamado e `create` NÃO chamado), anexa mesmo sem `nome` no body (achado da 2ª rodada), não
anexa com `email_verified=false` (409 específico), não anexa quando o e-mail do token é
diferente (segue `create` normal), não anexa quando a linha já tem `firebase_uid` (409
genérico), segundo login cai no fluxo normal por `firebase_uid` sem duplicar. Dois testes do
describe de 3.2 foram reescritos pra refletir a mudança de comportamento (`email_verified=true`
deixou de ser conflito). `usuario.test.ts`: teste "201 só com telefone" virou "400 só com
telefone — e-mail agora é obrigatório"; teste novo confirma telefone como complemento opcional.

`frontend/src/pages/Cadastro.test.tsx`: teste de cadastro com perfil padrão (idoso) passou a
esperar `sendEmailVerification` chamado (antes esperava não-chamado); o teste único de "perfil
familiar dispara sendEmailVerification" virou `it.each` cobrindo familiar E idoso; teste novo
confirma que cuidador continua SEM disparar.

**e2e novo:** `frontend/e2e/idoso-assume-conta.spec.ts` cobre o fluxo ponta a ponta — Familiar
se cadastra e loga, cadastra um Idoso com e-mail via `/vinculos`, Idoso se autocadastra com o
MESMO e-mail (primeiro `/auth/sync` não anexa, 409 `EMAIL_CADASTRADO_POR_FAMILIAR` visível),
confirma o e-mail, Idoso loga de novo, e confirma 1 único `Usuario` com `firebase_uid`
preenchido. A confirmação de e-mail é simulada via Firebase Admin SDK (sem caixa de e-mail real
em teste) por dois scripts novos, mesma convenção dos `backend/scripts/verify-*.ts`:
- `backend/scripts/e2e-marcar-email-verificado.ts <email>` — marca `emailVerified=true` no
  Firebase Auth via Admin SDK.
- `backend/scripts/e2e-verificar-usuario-unico.ts <email>` — confirma 1 `Usuario` com esse
  e-mail e `firebase_uid` preenchido.

Chamados pelo e2e via `execFileSync` (Node), `cwd` no backend, `DATABASE_URL` sobrescrita pro
SQL Server LOCAL (mesma fórmula de `playwright.config.ts`, nunca Azure). e2e: 4/4 (era 3/3).

**Testes de regressão (terceira rodada, mesma tarefa):** dois testes cobrindo achados sem
teste próprio das rodadas anteriores — confirmados batendo em RED contra o código revertido
antes de confirmar GREEN, nenhum bug real encontrado. `auth.test.ts` ganhou 2 casos no
describe base provando que a reordenação de `nome` não vazou: criação nova sem `nome` continua
400; e-mail em conflito sem `nome` no body responde o 409 do conflito, não 400 de `nome`.
`frontend/src/pages/ConfirmarEmail.test.tsx` (arquivo novo, página não tinha teste antes) cobre
3 casos, incluindo a prova de que `syncUser({ tipoPerfil: 'idoso' })` fixo não regride o fluxo
do Familiar: com sessão ativa e resposta de sucesso do branch de login (`criado:false`), a
página trata como sucesso normalmente.

Suíte final: backend 10 arquivos/270 testes (era 262 antes da tarefa), frontend 9 arquivos/37
testes (era 32), e2e 4/4 (era 3/3). `npx tsc --noEmit` e `npm run lint` limpos nos dois
pacotes em todas as rodadas.

**Achado, não corrigido nesta tarefa — fora do escopo combinado:** a seção "Cadastrar idoso" em
`Vinculos.tsx` (~linha 784) ainda mostra o texto "informe e-mail ou telefone (pelo menos um)",
desatualizado desde a reabertura da 3.1 acima — precisa virar e-mail obrigatório. Arquivo de
Laureane/Jennifer, não tocado; aviso pendente do Marcos.

Fora de escopo desta tarefa (não implementado, por instrução explícita): correção do texto de
`Vinculos.tsx` acima; limpeza automática de contas Firebase de teste (`e2e-*@e2e.elderweb.test`
acumuladas nas três rodadas — mesma convenção de limpeza manual já usada na Fase 1); exclusão
de conta Firebase órfã quando o idoso desiste do autocadastro; normalização de caixa de e-mail
na pré-checagem (limitação já conhecida desde 3.2).

**Item 4.1 da Fase 4 (RF-007, RNF-006) implementado: idoso registra a própria leitura de saúde (2026-09-23):**

`POST /saude`, em `backend/src/routes/saude.ts` (arquivo novo, montado em `app.ts` com `app.use('/saude', saudeRouter)`), atrás de `requireAuth`. Só `tipo_perfil='idoso'` chama; cuidador e familiar recebem 403 com mensagem genérica, sem explicar regras de `modo_decisao` nem de permissão. O `tipo_perfil` vem de um `findUnique` próprio, no mesmo padrão de `PATCH /usuario/me/modo-decisao`, porque `requireAuth` não o expõe.

Autoria: `idoso_id`, `registrado_por_id` e `editado_por_id` são sempre `req.usuarioId`. Do body só são lidos `tipo_medicao`, `valor_1`, `valor_2`, `unidade`, `data_hora` e `observacoes`; `id`, `idoso_id`, `registrado_por_id`, `editado_por_id`, `created_at` e `updated_at` enviados no body são ignorados, e `created_at`/`updated_at` ficam por conta de `@default(now())`/`@updatedAt`. Resposta 201 com lista explícita de campos.

Validação (400, mensagem fixa por campo, nunca reproduz o valor enviado):
- `tipo_medicao` e `unidade`: string não vazia após `trim`, até 50 e 20 caracteres. Texto livre, sem enum fechado (o ER não define um). Gravados já com `trim`, sem normalizar caixa.
- `valor_1` obrigatório e `valor_2` opcional: `typeof number`, finito, não negativo, até 9999.99 (limite de `decimal(6,2)`) e no máximo 2 casas decimais, checado por regex sobre `String(valor)` (não por multiplicação, por causa de ponto flutuante). Sem faixa clínica: leitura não é rejeitada por parecer fisiologicamente absurda. Valor 0 é aceito.
- `observacoes`: até 300 caracteres medidos depois do `trim`; vazia ou só espaço vira `null`.
- `data_hora`: ISO 8601 com `Z` ou offset explícito. String sem fuso é rejeitada, porque o servidor roda em UTC e leria a hora local do usuário como UTC, gravando o dado com horas de diferença sem erro. Não pode ser futura além de 5 minutos de tolerância. Se ausente, usa a hora do servidor.

Resposta: `Decimal` do Prisma serializa como string, então `valor_1` e `valor_2` são convertidos para `number`; `valor_2` `null` sai `null`, nunca 0 (`Number(null)` seria 0).

Nenhuma migration, nenhum CHECK novo, `requireVinculoAprovado` não tocado.

Frontend: página nova `/saude` (`frontend/src/pages/Saude.tsx`, atrás de `RotaProtegida`), formulário "Registrar leitura de saúde", esqueleto cru (mesma exceção de divisão de trabalho da seção Workflow). Converte os campos numéricos com `Number()` antes de enviar e o `datetime-local` com `new Date(valor).toISOString()`. O `console.error` registra só a mensagem do erro, nunca o corpo enviado nem valores de saúde. A página começou como seção de `Vinculos.tsx` e foi movida para `/saude`; o helper `chamarApi` saiu de `Vinculos.tsx` para `frontend/src/lib/chamarApi.ts` e é usado pelas duas páginas. Sem link na navegação; listagem, edição e a tela de verdade são de Laureane e Jennifer.

Testes: `backend/src/routes/saude.test.ts` (novo, 48 testes) cobre sucesso, 401, 403 para cuidador e familiar, body com campos de autoria forjados, `it.each` de 400 por campo, `valor_2` null, `data_hora` (sem fuso, com `Z`, com offset, futuro dentro e além da tolerância), `trim` de `observacoes` antes de medir, conversão de `Decimal` na resposta e privacidade (corpo do 400 sem o valor enviado; `jest.spyOn` em `console.*` sem valores de saúde). Escritos antes da implementação, RED confirmado. Mutações locais, não commitadas, cada uma derrubando pelo menos um teste: `registrado_por_id` lido do body, remoção da checagem de `tipo_perfil`, `editado_por_id` nulo e medir `observacoes` antes do `trim`. `Saude.test.tsx` (novo) tem 6 testes. Suítes ao fim do 4.1: backend 11 arquivos/318 testes (era 10/270), frontend 10 suítes/46 testes (era 10/40).

A regra de que o familiar aprovado lê saúde sempre e só escreve e edita com `modo_decisao='familiar'` foi decidida pelo grupo e fica para os itens 4.2b, 4.3 e 4.4.

`backend/scripts/verify-registro-saude.ts` (smoke test no padrão de `verify-cadastrar-idoso.ts`, transação sempre revertida) confere no banco real: create com e sem `valor_2`, `decimal(6,2)` aceitando 9999.99 e rejeitando 10000.00, FK de `registrado_por_id` inexistente, `data_hora` relida sem deslocamento e `COUNT(*)` igual antes e depois. Rodar: `npx tsx scripts/verify-registro-saude.ts` (dentro de `backend/`, só contra o SQL Server local do `docker-compose.yml`, com `DATABASE_URL` sobrescrita no comando, mesma fórmula do `playwright.config.ts`; nunca contra o Azure). Rodado uma vez no banco local: 7/7 PASS, `COUNT(*)` de `RegistroSaude` 0 antes e 0 depois.

**`errorHandler` de `app.ts` deixou de registrar o erro inteiro (item 4.5, parcial, 2026-09-23):**

O handler fazia `console.error(err)`, e um erro do Prisma carrega os argumentos da query (valores de `RegistroSaude`) em `message`, `stack` e `meta`, o que os levaria ao log do Render. Passou a registrar só `name`, `code` (quando existe, string ou número), `req.method` e `req.path`. Nunca o erro inteiro, `message`, `stack`, `req.body` nem `req.query`. Valor lançado que não é `Error` (string, objeto) não quebra o handler: `name` vira o `typeof` do valor. A resposta HTTP continua `500 {error:'Erro interno.'}`.

Testes em `backend/src/app.errorHandler.test.ts` (arquivo novo; `app.test.ts`, com o teste de `/health`, ficou intacto porque esses testes precisam de outro mock de `firebaseAdmin`): 4 casos novos que forçam um `PrismaClientKnownRequestError` e um `PrismaClientValidationError` com valor de saúde conhecido nos argumentos, mais um `throw` de string e um de objeto que não é `Error`, via `POST /saude`. Confirmam com `jest.spyOn` em todos os `console.*` (inspecionados com `util.inspect`, que inclui `message`, `stack` e `meta`) que o valor não aparece, que o valor de `req.query` não aparece, e que o corpo da resposta não mudou. Escritos antes da implementação, RED confirmado (os 4 falhavam por vazamento do valor no log). Mutação local, não commitada: reintroduzir `console.error(err)` derruba os 4 testes. Suíte do backend depois desta mudança: 12 arquivos/322 testes.

Custo conhecido: o log deixou de ter `message` e `stack`, então depurar um 500 exige reproduzir o caso.

O restante do 4.5 (teste de acesso cruzado e revisão dos demais pontos de log) foi fechado na entrada do item 4.5 no fim deste arquivo (2026-09-30). Pontos encontrados por `grep` em `backend/src` (fora dos testes) que não foram alterados: `index.ts` faz `console.log` só da URL de startup (sem dado); `lib/prisma.ts` instancia `new PrismaClient()` sem opção `log`; quando `res.headersSent` é verdadeiro, o handler chama `next(err)` e o handler padrão do Express pode imprimir o `stack` do erro (caminho não coberto, pendência do 4.5). Os `console.*` de `backend/scripts/*.ts` não rodam em produção.

Log padrão do Prisma, verificado no banco local (Prisma 5.22.0, client criado como em `lib/prisma.ts`, sem `log`): três erros forçados (`PrismaClientValidationError` por campo obrigatório ausente, `PrismaClientUnknownRequestError` por `valor_1` 10000.00 acima de `decimal(6,2)`, `PrismaClientKnownRequestError` P2003 por FK inexistente), com valor de saúde reconhecível nos argumentos. Resultado: stdout e stderr do processo não contêm o valor, então o Prisma não imprime nada por padrão. Já `message` e `stack` do erro contêm o valor (confirmado), o que justifica o `errorHandler` não os registrar. `meta` do P2003 traz só modelo e nome da FK. Com `DEBUG=prisma:*` o valor aparece na saída (12 linhas com o valor); `DEBUG` e `PRISMA_*` não estavam definidos no ambiente local, e o ambiente do Render não foi inspecionado. Conclusão: sem vazamento por padrão, então nenhuma opção `log` foi adicionada. Risco restante: alguém definir `DEBUG=prisma:*` no Render, ou passar `log` ao client no futuro.

**Limitações conhecidas (não mitigadas):**
- O modelo guarda só o último editor (RNF-006): o valor sobrescrito numa edição se perde. Decisão pendente entre aceitar como risco ou criar auditoria, antes do item 4.3.
- Uma query extra de `tipo_perfil` por requisição, sem otimização.
- Sem deduplicação de leituras: o mesmo registro enviado 2 vezes cria 2 linhas.

Fora de escopo desta tarefa (não implementado, por instrução explícita): cuidador com permissão (4.2), familiar escrevendo (4.2b), edição (4.3), histórico (4.4), restante do 4.5 (acesso cruzado e revisão dos demais logs) e qualquer tela real de saúde.

**Revisão das telas `/cadastro` e `/login` (2026-09-23, PRs #92 a #95, mergeados em `main`; `main` com 150 commits):**

Pedido do grupo: conferir se `/cadastro` e `/login` precisam de algum campo a mais, de acordo com o que o projeto já tem. Conclusão: **nenhum campo obrigatório novo em nenhum dos 3 perfis**; as mudanças foram de validação, mensagens e acessibilidade. Isto é frontend "de verdade" (não esqueleto), feito com o visual existente das telas, por decisão do grupo, em arquivos de Laureane e Jennifer (`Cadastro.tsx`, `Welcome.tsx`, `Login.tsx`, `FormularioCadastro.tsx`, `TipoPerfil.tsx`, `CampoTexto.tsx`, `FormularioLogin.tsx`, `CampoLogin.tsx`): avisar as duas fica com o Marcos.

PRs: #92 (`235da93`) foi revertido pelo #93 (`ddd36ff`) porque mexia em `/vinculos` (formulário "Cadastrar idoso" redesenhado), que não era o pedido; o que valeu foi #94 (`6fbb6af`, `/cadastro` e backend) e #95 (`391a24e`, `/login`). Os hashes de `main` diferem dos commits locais (rebase).

`/cadastro` (#94):
- `nome`, `email` e `email_convite_familiar` com `maxLength` 150/255/255 e `autoComplete`. `POST /auth/sync` passou a responder 400 para `nome` acima de 150 e `email_convite_familiar` acima de 255 (antes o INSERT estourava a coluna e virava 500).
- O perfil deixou de vir pré-selecionado, porque `tipo_perfil` é fixo. O radio é `required` (barra o envio por e-mail/senha) e o handler do Google confere `tipoPerfil` (mensagem "Escolha se você é idoso, cuidador ou familiar.").
- Senha: `minLength` 6 (mínimo do Firebase), dica, botão mostrar/ocultar (`components/common/BotaoMostrarSenha.tsx`, `aria-pressed`) e campo novo "Confirmação da senha", validado no cliente (alerta se divergir).
- `sendEmailVerification` (`lib/auth.ts`) agora devolve `true` quando enviou e `false` quando não havia nada a confirmar (conta Google já verificada). Cadastro de idoso ou familiar navega para `/welcome` com `state.confirmarEmail`, e `Welcome.tsx` mostra aviso fixo (`role="status"`, não some em 5s) de que é preciso confirmar o e-mail. Sem isso o Familiar não ganha o vínculo automático (RF-025) e o Idoso cadastrado por Familiar não assume a conta (3.3).
- `mensagemErroCadastro` traduz `auth/email-already-in-use`, `auth/weak-password`, `auth/invalid-email`, `auth/network-request-failed` e `auth/popup-closed-by-user`.
- `POST /auth/sync` grava `modo_decisao='idoso'` no autocadastro de idoso (o ER exige o campo para idoso; antes ficava `NULL`, tratado como `'idoso'` pelo código). Sem migration. Idosos já existentes com `NULL` continuam funcionando; backfill não feito.

`/login` (#95):
- Google autenticado sem `Usuario` no Elder (`/auth/sync` 400 por `tipo_perfil`): mensagem "ainda não tem uma conta", link para `/cadastro` e `signOut` do Firebase. O `signOut` é necessário porque `RotaProtegida` só confere sessão Firebase, e sem ele a pessoa entraria em `/Home` sem linha em `Usuario`.
- Credencial inválida (`auth/invalid-credential`, `auth/user-not-found`, `auth/wrong-password`): orienta o idoso cadastrado por Familiar a criar a conta com o mesmo e-mail e perfil Idoso, com link para o cadastro. O Firebase não distingue e-mail inexistente de senha errada, então a mesma mensagem cobre os dois.
- `erroSemContaNoLogin` e `mensagemErroLogin` em `lib/auth.ts` concentram essa lógica; também há mensagens para `auth/too-many-requests`, sem rede, `auth/user-disabled` e popup fechado.
- Acessibilidade: fontes `text-lg` (link "Esqueci minha senha", erros, separador, "Criar conta"), `autoComplete` `username`/`current-password`, `maxLength` 255 no e-mail, mostrar/ocultar senha e labels sem dois-pontos.

Testes: backend 12 arquivos/327 testes (eram 322), frontend 12 suítes/71 testes (eram 11/46). Os specs e2e (`fluxo-completo`, `idoso-assume-conta`) foram ajustados (perfil explícito, "Confirmação da senha", labels exatas por causa do botão "Mostrar senha") e **reexecutados em 2026-09-23 depois do merge: 4/4 passando (38,6s)**, contra o SQL Server local (`localhost:14330`, `docker-compose.yml`) e o backend/frontend locais, nunca o Azure; criaram mais contas `e2e-*@e2e.elderweb.test` no Firebase real, sem limpeza automática. O e2e confirmou `modo_decisao='idoso'` no idoso autocadastrado (linhas antigas seguem `NULL`). Os caminhos novos do `/login` (Google sem conta, credencial inválida com link para o cadastro) só têm teste unitário, sem e2e. Nada foi visto no navegador.

**Fora de escopo / decisões em aberto (não implementadas):** aceite de termos de uso e política de privacidade no cadastro (nenhum RF do plano especifica; decisão do grupo, dado de saúde é sensível pela LGPD); cadastro com Google sem nome na conta (400 "nome obrigatório", com mensagem genérica, caso raro); dica sobre o campo "e-mail de um familiar"; lembrete e reenvio de confirmação de e-mail no login; backfill de `modo_decisao` para idosos autocadastrados antes desta mudança; `nome` vazio no body de `/auth/sync` vence o `decoded.name` do Google (bug conhecido, não corrigido).

**Item 4.2 da Fase 4 (RF-008, RNF-003) implementado: cuidador registra leitura de saúde do idoso vinculado (2026-09-24, PR #101, mergeado em `main` por rebase: `88d526c` fix dos middlewares, `75dc630` rota e refactor, `7fdbe26` esqueleto de frontend; hashes finais diferentes dos commits locais `7a3eb59`/`df8ea0d`/`1ddb013`, mesmo padrão dos PRs anteriores):**

`POST /saude/idoso/:idosoId`, em `backend/src/routes/saude.ts`, com `requireAuth` e depois `requireVinculoAprovado("idosoId")` (primeiro uso real do middleware do item 2.3 e das flags `permite_*` do item 2.8). O id do idoso vai no path porque o middleware lê `req.params`; o middleware não foi alterado, além do `try/catch` descrito abaixo. O handler responde 403 com a mesma mensagem fixa do 4.1 ("Sem permissão para registrar leitura de saúde.") quando o vínculo aprovado não é `tipo_vinculo='cuidador'` ou `permite_registrar_saude` não é `true`. Vínculo aprovado de familiar recebe 403 aqui: a regra do familiar (`modo_decisao`) é o item 4.2b, não adiantada. `idoso_id` gravado vem de `req.vinculoAprovado.idoso_id`, nunca do path nem do body; `registrado_por_id` e `editado_por_id` são sempre `req.usuarioId` (o cuidador). Ordem de validação: 401, 400 (id não inteiro, do middleware), 403 (sem vínculo, tipo errado ou sem flag), 400 de corpo. Nenhum 400 de corpo antes do 403.

Refactor sem mudança de comportamento no mesmo arquivo: `validarCorpoLeitura` (validação e normalização do corpo) e `serializarRegistro` (`Decimal` para `number`, `valor_2` null preservado), usadas por `POST /` e pela rota nova. Os 48 testes do 4.1 seguiram verdes sem edição. Nenhuma migration, nenhum CHECK novo, nenhuma dependência nova.

Testes: `backend/src/routes/saudeCuidador.test.ts` (novo, 24 testes), com fake de `prisma.vinculo.findFirst` que filtra de verdade pelo `where` (o teste de acesso cruzado não passa por vacuidade). Cobre 401, 400 de id, 403 sem vínculo, vínculo pendente e recusado, acesso cruzado entre idosos, idoso chamando com o próprio id, flag de saúde falsa com as outras duas verdadeiras, vínculo de familiar, 403 antes de 400, campos de autoria forjados no body, `idoso_id` vindo do vínculo, `valor_2` null, `it.each` de 400 de corpo e privacidade (erro do Prisma no `create` sem valor de saúde em `console.*`). Mutações locais, não commitadas: 7 de 7 derrubaram pelo menos um teste (sem checar a flag, sem checar `tipo_vinculo`, `idoso_id` do path, `registrado_por_id` do body, `editado_por_id` nulo, sem `requireVinculoAprovado`, validar corpo antes do 403). A mutação do `idoso_id` do path sobrevivia no primeiro desenho, porque o fake filtra pelo `where` e path e vínculo coincidem; foi corrigida com um teste de mock que ignora o `where`. Suítes ao fim: backend 13 arquivos/353 testes (eram 12/327), frontend 12 suítes/76 testes (eram 12/71). `tsc`, `lint` e `build` limpos.

**Bug de produção corrigido: `requireAuth` e `requireVinculoAprovado` sem `try/catch` derrubavam o processo.** Ambos faziam `await` de Prisma sem `try/catch`. Express 4.21 não captura rejeição de middleware async, e o projeto não tem handler de `unhandledRejection` (Node 24, `engines >=24 <25`). Reproduzido em script descartável fora do repo, com Express 4 mínimo, na v24.19.0: o processo morreu com `exit=1`, não só a requisição ficou pendurada. O corpo dos dois passou a rodar em `try/catch` com `next(e)`, que chega ao `errorHandler` (500 genérico, sem valores no log). Um teste novo por middleware, escritos antes da correção (RED limpo, com `.timeout(1000)`). Auditoria feita depois em `backend/src`: nenhum outro handler async sem `try/catch`.

Frontend: segunda seção "Registrar leitura de saúde de um idoso (cuidador)" em `frontend/src/pages/Saude.tsx`, esqueleto cru (mesma exceção de divisão de trabalho da seção Workflow): id do idoso mais os campos do 4.1, chama a rota nova, sem rota nova de página, sem listagem. 5 testes novos em `Saude.test.tsx`.

**Regra do grupo para o 4.3, NÃO implementada nesta tarefa:** o cuidador edita só registro com `registrado_por_id` igual a ele e só enquanto `permite_registrar_saude` estiver ativa. Por isso `registrado_por_id` é sempre o id do cuidador. A auditoria do valor sobrescrito numa edição (o modelo guarda só o último editor, RNF-006) segue em aberto, decisão pendente antes do 4.3.

**Achado, mudança de contrato pendente:** `GET /vinculo` não expõe `permite_registrar_saude`, `permite_marcar_dose` nem `permite_criar_evento_cuidado`. A tela do cuidador (itens 4.3 e 4.4) precisa dessa fonte para saber se pode registrar ou editar; sem ela só descobre tentando e recebendo 403. Alterar o contrato de `GET /vinculo` afeta o frontend: avisar Laureane e Jennifer fica com o Marcos.

**Limitações conhecidas (não mitigadas):** a mensagem 403 é uniforme (a rota usa texto fixo e o middleware outro, sem distinguir o motivo além disso); o teste de leitura cruzada de saúde foi feito no item 4.5 (entrada no fim deste arquivo); o esqueleto do cuidador em `Saude.tsx` não é a tela final.

Fora de escopo desta tarefa (não implementado, por instrução explícita): familiar escrevendo (4.2b), edição (4.3), histórico e `GET` de saúde (4.4), restante do 4.5.

**Item 4.2b da Fase 4 (RF-007, RF-009) implementado — familiar registra leitura de saúde do idoso (2026-09-24, commits locais `80b3c20` backend, `35049ba` frontend — hashes finais podem diferir após push, mesmo padrão dos PRs anteriores):**

`POST /saude/idoso/:idosoId` (item 4.2) ganhou o ramo do familiar. Depois de `requireVinculoAprovado`, a nova `podeEscreverSaude` em `saude.ts` decide por `tipo_vinculo`: cuidador segue `permite_registrar_saude` (intacto); familiar exige `resolverModoDecisao(idoso_id) === 'familiar'`, sempre pelo resolver (nunca a coluna, para honrar transferência vencida) e com `NULL` valendo `'idoso'`. Qualquer familiar com vínculo aprovado escreve, cada um com a própria autoria (`registrado_por_id` e `editado_por_id` = familiar; `idoso_id` do vínculo). 403 genérico, nunca cita `modo_decisao`. Ordem: 401, 400 (id), 403 (vínculo), 403 (regra do perfil), 400 (corpo). Única mudança fora de `saude.ts`: `resolverModoDecisao` ganhou `export`. Nenhuma migration, dependência ou contrato novo.

**Auditoria de segurança feita antes do commit:** o `findFirst` de `requireVinculoAprovado` não filtra `tipo_vinculo`, o que poderia devolver o vínculo errado se a mesma pessoa tivesse vínculo de cuidador E de familiar aprovados com o mesmo idoso. Verificado nas 5 rotas de criação de vínculo (`/solicitar-cuidador`, `/solicitar-familiar`, `vincularFamiliarConvidado`, `vincularIdosoComFamiliarExistente`, `/cadastrar-idoso`) e nos 4 pontos de escrita de `Vinculo` em produção (`vinculo.ts:384`, `:454` dentro da `$transaction` da contestação, `:554`, `auth.ts:118`): `tipo_vinculo` nunca é gravado fora da criação, e toda criação amarra `tipo_vinculo` ao `tipo_perfil` fixo do `vinculado_id`. Hoje inalcançável, mas é garantia de convenção de aplicação, não de banco — quebra se um dia existir troca de `tipo_perfil` ou um novo fluxo de criação de vínculo sem essa checagem. Comentário documentando a suposição e a condição de quebra adicionado acima do `findFirst` em `requireVinculoAprovado.ts`. Nenhum código de comportamento mudou nesta auditoria.

Testes: `saudeFamiliar.test.ts` (novo, 22 testes) cobre a matriz `modo_decisao` x vínculo (aprovado/pendente/recusado/inexistente/outro idoso), dois familiares aprovados do mesmo idoso, transferência vencida e em curso via `resolverModoDecisao` real (com `jest.requireActual` para evitar recursão do mock), autoria forjada ignorada, ordem 401/400/403, e privacidade de log. RED confirmado: 9 dos 22 falhavam contra o código antigo (que rejeitava todo familiar com 403 fixo), os outros 13 já passavam por resultado coincidente — só as mutações provam a regra por completo. 6 mutações locais, cada uma derrubando pelo menos um teste, revertidas. Teste do 4.2 que dava 403 para qualquer familiar foi atualizado de propósito (o `findUnique` mockado devolvia `undefined` e o resolver caía em 403 pelo motivo errado); agora usa `modo_decisao: 'idoso'` explícito. Suítes ao fim: backend 16 arquivos/424 testes, frontend 14 suítes/95 testes. `tsc` limpo.

Frontend: seção "Registrar leitura de saúde de um idoso (cuidador ou familiar)" em `Saude.tsx` — título atualizado para refletir os dois perfis; esqueleto cru já existente do 4.2 reaproveitado sem mudança de comportamento na submissão, 3 testes novos.

Fora de escopo: "403 ao editar" e "leitura continua permitida" do item 4.2b migram para os itens 4.3 e 4.4 respectivamente — não implementadas aqui. `GET /vinculo` continua sem expor `permite_*`. Auditoria do valor sobrescrito numa edição (RNF-006) segue pendente antes do 4.3.


**Foto de perfil (2026-09-24) implementada — sem RF numerado no plano, feature descrita só por esta entrada:**

Conferido antes de começar: nenhum RF/item do plano de desenvolvimento nem o `Elder Web - Modelagem ER.md` menciona foto de perfil; nenhum número foi inventado. Antes desta tarefa `FormularioPerfil.tsx` já tinha um seletor de foto só de pré-visualização local (`URL.createObjectURL`, nada persistido).

Decisões: BLOB no próprio SQL Server (campo `Bytes` do Prisma, `VARBINARY(MAX)`), sem Azure Blob nem disco (filesystem do Render é efêmero); só `image/jpeg` e `image/png`, até 2 MB; sem lib de imagem, sem redimensionar; `multer` com `memoryStorage`; o backend devolve `foto_perfil_url` já como data URI (`data:image/jpeg;base64,...`) ou `null`, nunca o buffer cru; sincronização `/home` ↔ `/perfil` por um contexto React mínimo só da foto (não é o `AuthContext`, que segue como dívida separada).

Backend (`backend/src/routes/usuario.ts`, `backend/src/lib/fotoPerfil.ts`): `POST /usuario/me/foto` (campo multipart `foto`, atrás de `requireAuth`, qualquer `tipo_perfil`, alvo sempre `req.usuarioId`; grava `foto_perfil`, `foto_perfil_mime_type` e `foto_perfil_atualizada_em`; responde 200 `{ foto_perfil_url }`), `DELETE /usuario/me/foto` (idempotente, zera os 3 campos, 200 `{ foto_perfil_url: null }`) e `GET /usuario/me/foto` (200 `{ foto_perfil_url }`, data URI ou `null`; o buffer e o mime cru nunca saem na resposta). **Split de endpoint (correção posterior, mesmo dia):** a primeira versão estendia `GET /usuario/me` com `foto_perfil_url`, o que fazia o payload pesado (até ~2,7 MB em base64) viajar em toda chamada dessa rota — e o frontend a chama mais de uma vez por sessão (Provider, `Header` só pelo nome, `Perfil`). Agora `GET /usuario/me` voltou a devolver só id, nome, email, telefone, tipo_perfil e os campos de `modo_decisao` (sem `foto_perfil_url`, sem selecionar as colunas da foto), e só quem exibe a foto busca `GET /usuario/me/foto`. Sem cache/CDN, sem mudança de schema. 400 com mensagem fixa e sem ecoar o valor enviado: sem arquivo ou campo com outro nome ("Nenhuma foto enviada."), mimetype fora de JPEG/PNG, acima de 2 MB (exatamente 2 MB é aceito). Nenhum log novo; nenhum `console.*` recebe a foto (o `errorHandler` já não registra `message`, `stack` nem corpo).

Migration `20260924220000_add_foto_perfil` (escrita à mão): 3 colunas novas em `Usuario` + `CK_Usuario_foto_perfil_conjunto` (os 3 campos todos `NULL` ou todos preenchidos, mesmo padrão de `CK_Usuario_modo_decisao_solicitado_conjunto`). A `CHECK` vai dentro de `EXEC('...')` porque o SQL Server compila o batch inteiro antes de executar e a `CHECK` não enxerga colunas adicionadas no mesmo batch (erro 207; a primeira tentativa falhou assim no banco local e foi corrigida, migration marcada `--rolled-back` só no local). Aplicada primeiro no SQL Server local e depois **no Azure de produção em 2026-09-24** (`npx prisma migrate deploy`, autorização explícita do Marcos, só esta migration; alvo `elder-web-sql-marcos.database.windows.net:1433`, banco `elder_web`, conferido antes; `migrate status`: "Database schema is up to date!"). `backend/scripts/verify-constraints.ts` ganhou o caso 15 (rejeição com citação do nome da constraint + controle positivo): 24/24 PASS no banco local e 24/24 PASS no Azure (CHECK ativa de verdade em produção, com controle positivo).

Dependências novas (autorizadas): `multer` e `@types/multer` em `backend/`.

Frontend (esqueleto de lógica sobre o visual existente, sem redesenho; autorizado pelo Marcos a tocar arquivos das telas de Laureane e Jennifer): `contexts/FotoPerfilContext.tsx` (novo, só o componente; o objeto de contexto e o hook `useFotoPerfil` ficam em `contexts/useFotoPerfil.ts`, separados por causa do Fast Refresh; `FotoPerfilProvider` carrega o valor inicial via `buscarFotoPerfil` (`GET /usuario/me/foto`) quando há sessão e zera no logout; sem Provider o valor padrão é "sem foto"), `App.tsx` (Provider envolvendo `<Routes>`), `services/perfilService.ts` (`buscarFotoPerfil`, `enviarFotoPerfil`, `removerFotoPerfil`), `components/Home/Header.tsx` (o círculo das iniciais vira `<img>` quando há foto, mesmas classes de tamanho/formato; sem foto, iniciais como antes), `pages/Perfil.tsx` (não lê mais foto do próprio `GET /usuario/me`; usa só o valor do contexto pra mostrar a foto e o botão de remover) e `components/perfil/FormularioPerfil.tsx` (upload real no lugar da pré-visualização local; `accept` `.jpg,.jpeg,.png` — o `webp` que existia foi tirado porque o backend rejeita; botão "Remover foto de perfil" só com foto; feedback em `role="alert"`/`role="status"`; erro só loga a mensagem, nunca arquivo nem data URI).

Diferenças em relação ao que a tarefa supunha (registradas, não adaptadas em silêncio): o círculo das iniciais fica em `Header.tsx`, não em `Sidebar.tsx`; não existe um componente "que envolve as rotas logadas" (cada rota usa `RotaProtegida` e `Home` monta o `Header`), então o Provider ficou em `App.tsx`; o frontend usa `services/perfilService.ts` (não `chamarApi.ts`, que força `Content-Type: application/json` e quebraria o multipart).

Testes (RED confirmado antes da implementação: 21 falhas): `backend/src/routes/usuarioFoto.test.ts` (novo; casos: 401, 400 por sem arquivo/campo errado/mimetype/tamanho, limite exato de 2 MB, gravação e data URI, alvo sempre o autenticado, sem consulta de `tipo_perfil`, falha do banco sem vazar bytes em resposta nem em `console.*`, DELETE idempotente, `GET /me/foto` com 401, com e sem foto, 500 e `select` só das duas colunas; `GET /me` sem `foto_perfil_url` e sem selecionar a foto); `usuario.test.ts` voltou ao contrato original de `GET /me`. Frontend: `Header.test.tsx` (iniciais x imagem), `FotoPerfilContext.test.tsx` (carga, deslogado, falha) e 6 casos novos em `Perfil.test.tsx` (sem foto, com foto, upload ok, upload recusado, remover, hook sem Provider). Suítes: backend 15 arquivos/402 testes (era 13/353, já com o seed do Google e a auditoria de select), frontend 14 suítes/87 testes. `tsc --noEmit`, `lint` e `build` limpos nos dois pacotes, sem avisos.

**Limitações conhecidas (não mitigadas):**
- Sem validação dos bytes reais: só o `Content-Type` declarado pelo cliente é conferido, então um arquivo qualquer rotulado `image/jpeg` é aceito e servido de volta como data URI (o browser só o trata como imagem dentro de `<img>`, mas nada garante que seja imagem).
- Sem CDN nem cache: `GET /usuario/me/foto` devolve a foto inteira (até ~2,7 MB em base64) a cada carga do Provider (uma por sessão/login). Alternativa futura: `Cache-Control`/ETag nessa rota, ou storage externo.
- Sem redimensionar/comprimir, sem histórico (nova foto sobrescreve a anterior).
- O `Header` continua fazendo o próprio `buscarPerfil` só pelo nome (agora payload leve, sem foto).
- Sem e2e; nada visto no navegador.

Fora de escopo (não implementado): lib de processamento de imagem, `AuthContext` completo, qualquer outra tela além de `Header` e `Perfil`.

**Seed da foto no cadastro via Google (2026-09-24):** em `POST /auth/sync`, só no branch de CRIAÇÃO (`prisma.usuario.create`), se `decoded.picture` existir a foto do Google é baixada uma vez e gravada no MESMO `create` (`foto_perfil`, `foto_perfil_mime_type`, `foto_perfil_atualizada_em`), via `baixarFotoDoGoogle` em `backend/src/lib/fotoPerfil.ts`. Sem re-sincronização em logins seguintes, sem tocar a foto real da conta Google, e nunca nos branches de login nem de anexo do item 3.3 (`update`); `POST /usuario/cadastrar-idoso` não se aplica (sem token Google). Regras: `fetch` nativo, `AbortSignal.timeout(5000)`, sem retry; só `https://` em host `googleusercontent.com` ou subdomínio (anti-SSRF, achado de revisão de segurança; host parseado com `new URL`, então `evil.com@lh3...`, `googleusercontent.com.evil.com` e IPs internos são rejeitados), `redirect: "manual"` (3xx rejeitado); resposta 2xx; `Content-Type` na mesma whitelist do upload manual (`image/jpeg`/`image/png`, parâmetros e caixa ignorados); até 2 MB (checa `Content-Length` antes de ler e o tamanho real depois). Qualquer falha (rede, timeout, não-2xx, tipo, tamanho) é capturada, gera no máximo um `console.warn` com motivo fixo (nunca a URL nem os bytes) e o cadastro segue sem foto (iniciais). Sem dependência nova, sem migration.

Testes: `backend/src/routes/authFotoGoogle.test.ts` (novo, 26 casos, `fetch` mockado, RED confirmado antes da implementação e de novo antes do endurecimento anti-SSRF): sucesso e gravação no mesmo `create` sem `update` depois, `image/png` e parâmetros de `Content-Type`, limite exato de 2 MB, sem `picture`, URL não https, `it.each` de falhas (rede, timeout, 404, gif, sem `Content-Type`, html, corpo e `Content-Length` acima de 2 MB), sem vazamento de URL/bytes em `console.*`, e login/anexo 3.3 nunca chamando o `fetch`. Suíte do backend: 15 arquivos/402 testes.

**Correção junto (regressão minha da feature de foto, achada ao escrever o seed):** `POST /auth/sync` devolvia a linha inteira de `Usuario` em `create`/`update`, então o buffer da foto (até 2 MB) iria no JSON de login/cadastro/anexo; agora todas as respostas passam por `semFotoPerfil`. `requireAuth` e o `findFirst` do login em `/auth/sync` ganharam `select` mínimo (sem ele carregavam o BLOB da foto do banco a cada requisição autenticada / login). Testado (resposta sem `foto_perfil` em cadastro, login e anexo).

**Ajustes de UX da foto (2026-09-24, PRs #107 e #108):** (1) `FotoPerfilContext` expõe `carregandoFoto` e o `Header` não mostra iniciais enquanto não se sabe se há foto (antes elas piscavam no F5); o seed do Google pede `=s400-c` no lugar de `=s96-c` (mesmo host, só cadastros novos; quem já tem a foto de 96 px precisa reenviar). (2) O `FotoPerfilProvider` guarda a última foto conhecida no `localStorage` (`elderweb:fotoPerfil`, com o uid dono) para ela aparecer na hora no F5: o servidor confirma e atualiza o cache, que é descartado se o uid não bate e limpo no logout; falha do `localStorage` cai no comportamento anterior. Risco aceito: a foto fica no navegador até o logout. Frontend 14 suítes/92 testes. Sem e2e, nada visto no navegador.

**Gap conhecido (não decidido, não implementado):** o fluxo de anexo do item 3.3 (idoso cadastrado por Familiar que assume a própria conta, inclusive via Google) NÃO recebe o seed da foto — ninguém decidiu se deveria. Outros limites: o corpo é lido inteiro quando não há `Content-Length` (ok porque a origem é o Google, ver comentário `ponytail:` no código); o download soma até 5 s ao cadastro no pior caso (timeout), só quando o Google fornece `picture`; sem e2e (o Firebase real não foi exercitado).

**Item 4.3 da Fase 4 (RF-009, RNF-006) implementado: edição de registro de saúde (2026-09-25, sem PR ainda):**

Duas rotas em `backend/src/routes/saude.ts`, ambas com `requireAuth`: `PATCH /saude/:id` (idoso edita o próprio registro) e `PATCH /saude/idoso/:idosoId/:id` (cuidador ou familiar, com `requireVinculoAprovado("idosoId")`). Nenhuma migration, dependência nova nem contrato novo de outra rota.

Autoridade de edição, função nova `podeEditarSaude`, separada de `podeEscreverSaude` (a de criação ficou intacta). Cuidador: `permite_registrar_saude === true` E `registro.registrado_por_id === vinculo.vinculado_id` (só edita registro que ele mesmo criou, e só enquanto a flag estiver ativa). Familiar: `resolverModoDecisao(idoso_id) === 'familiar'`, sem checar autoria (edita registro de qualquer autor). Idoso: dono do registro (`registro.idoso_id === req.usuarioId`), sem consulta de vínculo, `modo_decisao` nem `tipo_perfil`. `editado_por_id` é sempre `req.usuarioId`; `idoso_id` e `registrado_por_id` nunca entram no update; id, idoso_id, registrado_por_id e editado_por_id enviados no body são ignorados.

Ordem de validação. Rota do idoso: 401, 400 (id do registro), 404, 400 (corpo). Rota de cuidador/familiar: 401, 400 (idosoId), 403 (vínculo), 400 (id do registro), 404, 403 (autoridade), 400 (corpo). O id do registro só aceita inteiro de 1 a 2147483647 (`parseIdRegistro`); qualquer outro valor dá 400 sem consultar o banco.

**Decisão: 404 unificado nas duas rotas.** Registro inexistente e registro de outro idoso respondem o mesmo 404 `{error: "Registro não encontrado."}` em `PATCH /saude/:id` e em `PATCH /saude/idoso/:idosoId/:id`. Um 403 separado vazaria a existência do registro de outro idoso. Na primeira versão a rota do idoso devolvia 403 nesse caso; foi corrigida a pedido do Marcos. Teste dedicado compara status e corpo dos dois casos.

**Decisão: edição parcial.** `validarCorpoEdicao` (nova) monta o corpo completo a partir do registro atual, sobrepõe só os campos enviados (`!== undefined`, mesmo padrão de `PATCH /usuario/me`) e revalida com `validarCorpoLeitura`, que ficou sem alteração, então regras e mensagens são as do POST. `valor_2` e `observacoes` com `null` explícito limpam o campo; `data_hora` ausente preserva a original (na primeira versão, full-replace, virava a hora do servidor; corrigido). Corpo sem nenhum dos 6 campos de leitura dá 400 "Nenhum campo de leitura informado.", para não gravar edição vazia que só trocaria `editado_por_id`.

**Decisão: sem auditoria do valor sobrescrito.** O modelo guarda só o último editor (`editado_por_id`, RNF-006), então o valor anterior se perde a cada edição. Decisão do grupo: aceito como risco por ora, sem tabela de auditoria; registrado em comentário no código, não como funcionalidade. Reabrir só se o grupo decidir criar auditoria.

Mensagem do 403 de edição: "Sem permissão para editar registro de saúde." ("registro" para a entidade, "leitura" só para o ato de registrar). Nunca cita `modo_decisao` nem repete valor enviado; nenhum `console.*` recebe valor de saúde.

Testes: `backend/src/routes/saudeEdicao.test.ts` (novo, 62 testes), escritos antes da implementação (RED confirmado: 43 de 48 falhavam na primeira rodada; 8 de 14 na edição parcial). Fake de Prisma em memória, cujo `findUnique` filtra pelo `where` e cujo `update` aplica o `data`, para o acesso cruzado e o último editor não passarem por vacuidade. Cobrem: cuidador com flag e registro próprio, cuidador com flag em registro de idoso, outro cuidador ou familiar (403), flag inativa, familiar com `modo_decisao` 'familiar' em registro de qualquer autor, 'idoso' (403), vínculo pendente, recusado, inexistente e cruzado, ordem das validações, três updates seguidos por atores diferentes (`editado_por_id` sempre o último, nunca nulo), corpo forjado ignorado, edição parcial nas duas rotas e privacidade (corpo de erro e `console.*`). Mutações locais, não commitadas, cada uma derrubando pelo menos um teste: autoria do cuidador sempre verdadeira, flag ignorada, sem 404 de outro idoso, `editado_por_id` preservando o antigo (nas duas rotas), familiar sempre autorizado, checagem de dono do idoso invertida, condição `!== undefined` invertida, `null` explícito ignorado, checagem de "nenhum campo" removida e 404 unificado voltando a 404/403. Os testes de corpo vazio e de valor inválido, que passavam só por status na primeira versão, agora exigem a mensagem exata.

Suítes: backend 17 arquivos/486 testes (era 16/424), frontend 14 suítes/109 testes (era 14/95). `tsc --noEmit` e `npm run lint` limpos nos dois pacotes.

Frontend: duas seções novas em `frontend/src/pages/Saude.tsx`, esqueleto cru (mesma exceção de divisão de trabalho da seção Workflow), pelo componente `EdicaoSaude`: "Editar registro de saúde (próprio, idoso)" e "Editar registro de saúde de um idoso (cuidador ou familiar)". Só os ids são obrigatórios; campo em branco não é enviado (edição parcial). Testes: campos por label, URL/método/Authorization/números sem campos de autoria, sucesso, erro com `role="alert"`, botão desabilitado durante a chamada, privacidade no console, edição parcial (corpo só com `valor_1`) e envio sem alterar nenhum campo (corpo `{}`, 400 do backend em `role="alert"`), todos nas duas seções. Um teste do 4.2b (título da seção de registrar) passou a usar regex ancorado em "Registrar", porque o título da edição também casava com o anterior.

**Limitações conhecidas (não mitigadas):** sem histórico do valor sobrescrito (ver decisão acima); `GET /vinculo` continua sem expor `permite_*`, então a tela do cuidador só descobre que não pode editar recebendo 403; sem e2e e nada visto no navegador; a listagem e o `GET` de saúde (item 4.4) e o restante do 4.5 (acesso cruzado de leitura e revisão dos demais logs) foram concluídos depois (item 4.4 e item 4.5, entradas abaixo); o 403 uniforme não distingue o motivo (flag, autoria ou `modo_decisao`).

Fora de escopo (não implementado): histórico e `GET` de saúde (4.4), restante do 4.5, exclusão de registro, auditoria do valor sobrescrito.

**Item 4.4 da Fase 4 (RF-010, RNF-003) implementado: histórico de saúde (2026-09-28, PR #114, mergeado em `main` por rebase: `88080b2` rotas, `79150a7` esqueleto de frontend, `fb8d3c7` docs; hashes finais diferentes dos commits locais `974b26d`/`1c3f93b`/`e3ca51b`, mesmo padrão dos PRs anteriores):**

Duas rotas de leitura em `backend/src/routes/saude.ts`, depois das PATCH: `GET /saude` (idoso lê o próprio histórico) e `GET /saude/idoso/:idosoId` (cuidador ou familiar com vínculo aprovado). Ambas respondem 200 `{ registros: [...] }`, ordenado por `data_hora` decrescente e sem paginação (mesma convenção de `GET /vinculo`), com `serializarRegistro` reaproveitada. Nenhuma migration, dependência nova ou `console.*` novo; `serializarRegistro`, `requireAuth` e `requireVinculoAprovado` não foram tocados.

`GET /saude`: `requireAuth`, depois `findUnique` de `tipo_perfil` (mesmo padrão de `POST /`). Quem não é idoso recebe 403 com mensagem própria de leitura ("Sem permissão para visualizar histórico de saúde."), diferente da mensagem de escrita. O filtro é sempre `idoso_id = req.usuarioId`. Ordem: 401, 403. O familiar lê pela outra rota, então `GET /saude` devolve 403 a ele mesmo com vínculo aprovado.

`GET /saude/idoso/:idosoId`: `requireAuth` e `requireVinculoAprovado("idosoId")`, sem nenhuma checagem além do middleware. Leitura não depende de `permite_registrar_saude` (cuidador) nem de `modo_decisao` (familiar): só escrita e edição dependem. `resolverModoDecisao` nem é chamada. O `idoso_id` da consulta vem de `req.vinculoAprovado.idoso_id`, nunca do path. Ordem: 401, 400 (`idosoId` não numérico, do middleware), 403 (sem vínculo aprovado).

**Decisão tomada ao montar a tarefa (não fechada pelo grupo):** o cuidador com vínculo aprovado lê sempre, mesmo sem a flag `permite_registrar_saude`. Se o grupo preferir exigir a flag também para leitura, é mudança pequena nesta rota mais um teste, e precisa ser avisada antes de dar o item por aceito.

Testes: `backend/src/routes/saudeHistorico.test.ts` (novo, 18 testes), escritos antes da implementação (RED confirmado: 17 de 18 falhavam). Fake de `vinculo.findFirst` que filtra de verdade pelo `where`, e fake de `registroSaude.findMany` que filtra por `where.idoso_id` e ordena por `orderBy`, para o acesso cruzado e a ordenação não passarem por vacuidade. Cobrem: idoso vê só os próprios registros em ordem decrescente, 401 nas duas rotas, 403 de cuidador e familiar em `GET /saude`, cuidador lendo sem a flag, familiar lendo com `modo_decisao='idoso'` (resolver mockado e nunca chamado), familiar vendo o mesmo conjunto que o idoso, `idoso_id` vindo do vínculo (mock que ignora o `where`), vínculo pendente, recusado e inexistente, acesso cruzado com controle positivo, 400 de id, e privacidade (corpo de 403 e `console.*` sem valor de saúde, 500 genérico sem valor no log). Mutações locais, não commitadas, cada uma derrubando pelo menos um teste: remover o filtro por `idoso_id` (4 falhas), `idoso_id` do path (1), remover a checagem de `tipo_perfil` (3), ordenar crescente (3) e exigir a flag do cuidador na leitura (1).

Suítes: backend 18 arquivos/504 testes (era 17/486), frontend 14 suítes/113 testes (era 14/110). `tsc --noEmit` e `npm run lint` limpos nos dois pacotes. CI do PR #114 (backend, frontend, Vercel) passou. Nenhuma migration nesta tarefa.

Frontend: seção nova "Ver histórico de saúde" em `frontend/src/pages/Saude.tsx` (componente `HistoricoSaude`), esqueleto cru (mesma exceção de divisão de trabalho da seção Workflow). Id do idoso em branco chama `GET /saude`; preenchido, `GET /saude/idoso/:id`. Lista simples de texto, erro em `role="alert"`, sem rota de navegação nova e sem tocar `Home.tsx`. 3 testes novos em `Saude.test.tsx`.

**Limitações conhecidas (não mitigadas):** sem paginação, então o histórico cresce sem limite; sem filtro por período ou tipo de medição; o registro não informa quem é o autor por nome (só `registrado_por_id` e `editado_por_id`); sem e2e e nada visto no navegador; o 403 de `GET /saude/idoso/:idosoId` vem do middleware e não distingue o motivo.

Fora de escopo (não implementado): restante do 4.5 (teste explícito de acesso cruzado como dado sensível e revisão dos demais pontos de log), download do histórico, exclusão de registro, auditoria do valor sobrescrito.

**Item 4.5 da Fase 4 (RNF-001) implementado: RegistroSaude tratado como dado sensível, acesso cruzado e revisão de saídas (2026-09-30, PR #118, mergeado em `main` em 2026-09-30T22:16:54Z por rebase: `9771ae5` testes e script, `e712579` fix do `errorHandler`, `7833d56` teste do frontend, `e772808` docs; hashes finais diferentes dos commits locais `e514086`, `8e7ba4f`, `0d077d7` e `41224ca`, mesmo padrão dos PRs anteriores):**

Critério do plano: nenhuma resposta de erro nem log expõe valores de `RegistroSaude` de terceiros; acesso cruzado (idoso A lendo dado do idoso B sem vínculo) retorna 403; acesso restrito ao titular e aos vínculos aprovados. Fecha o "restante do 4.5" deixado pelas entradas de 23/09 (parcial do `errorHandler`) e do 4.4. Nenhuma migration, dependência ou contrato HTTP novo; a única mudança em código de produção é o ramo `res.headersSent` do `errorHandler` de `app.ts` (ver abaixo); nenhum teste da matriz de acesso cruzado falhou contra o código.

**Auditoria dos pontos de saída (leitura do código, `grep`):** só `backend/src/routes/saude.ts` toca `registroSaude` em código de produção (o outro arquivo é o script de verificação). Saídas em `backend/src`: `app.ts:29` (`errorHandler`, loga `name`, `code`, método e `req.path`; `req.path` não inclui query e as rotas de saúde só têm ids no path), `index.ts:6` (URL de startup, sem dado), `lib/fotoPerfil.ts:40` (`console.warn` com motivo fixo, sem relação com saúde). Não existe handler de `unhandledRejection` nem de `uncaughtException`. `lib/prisma.ts` não passa `log` nem `errorFormat` ao `PrismaClient`. O corpo 400 das rotas de saúde usa mensagem fixa por campo. Frontend: `Saude.tsx` faz `console.error` só com `err.message` (texto fixo do backend ou constante); os valores de saúde só vão em corpo de requisição, nunca em URL ou query (a URL leva só ids).

**Medição do Prisma real (executada em 2026-09-30, SQL Server local):** casos novos em `backend/scripts/verify-registro-saude.ts` (FK inexistente e `PrismaClientValidationError`, com sentinelas, interceptando `process.stdout.write` e `process.stderr.write`; falha se o sentinela aparecer). O script ganhou trava: recusa rodar se o host de `DATABASE_URL` não for `localhost` ou `127.0.0.1` (o `.env` aponta para o Azure, então a URL local vai só no comando, nunca no `.env`). Rodado contra o container do `docker-compose.yml` (`localhost:14330`, depois derrubado com `docker compose down`): 9/9 PASS, incluindo os dois casos novos, com 0 bytes em stdout e stderr nos dois erros; a `message` do erro carrega os args no `PrismaClientValidationError` e não carrega no P2003 (informativo). Conclusão: o Prisma 5.22.0 sem `log` não imprime valor de saúde por conta própria (confirma a medição de 23/09; `DEBUG=prisma:*` continua vazando). `lib/prisma.ts` não foi alterado. Rodar de novo: subir o `db` e `npx tsx scripts/verify-registro-saude.ts` com `DATABASE_URL` sobrescrita no comando.

**Decisões fechadas nesta tarefa (não reabrir):** (1) cuidador aprovado lê o histórico mesmo sem `permite_registrar_saude` (a flag é de escrita e não existe flag de leitura), agora protegido por teste; (2) `PATCH /saude/:id` de registro de outro idoso continua 404 igual ao inexistente (decisão do 4.3), o 403 do critério vale para as rotas guardadas por `requireVinculoAprovado`; (3) sem biblioteca de log; (4) `GET /vinculo` sem `permite_*` continua pendente; (5) JSON malformado cai no `errorHandler` (500, não 400), não corrigido, só garantido que não vaza; status medido: 500 exato (o corpo acima de 100kb também dá 500, não 413), com asserção exata nos testes.

**Testes:** `backend/src/routes/saudeDadoSensivel.test.ts` (novo, 120 testes), com armazém em memória (os fakes filtram por `where` e aplicam `data`) e sentinelas obviamente falsos no registro do idoso B. (a) Matriz de acesso cruzado: 3 rotas guardadas pelo middleware x 6 atores sem acesso a B (idoso A, cuidador aprovado só de A, familiar aprovado só de A com `modo_decisao='familiar'`, cuidador sem vínculo, familiar pendente, familiar recusado): 403 com a mensagem fixa, sem sentinela em corpo nem headers, sem chamar `findMany`, `findUnique`, `create` nem `update`; cada rota com controle positivo. `GET /saude` e `POST /saude` ignoram `?idoso_id=B` e `idoso_id` no corpo; `PATCH /saude/:id` devolve 404 idêntico ao de id inexistente. (b) Decisão 1 protegida. (c) Falha injetada em cada ponto de I/O das 6 rotas (8 variantes por perfil): `PrismaClientKnownRequestError` com `meta` sigiloso em todos os pontos, mais `PrismaClientValidationError`, `Error`, string e objeto lançados no ponto principal: 500 com corpo exato `{ "error": "Erro interno." }` e nenhum sentinela em corpo, headers, `console.*`, `process.stdout.write` e `process.stderr.write` (captura com `util.inspect`, `depth` 12; um teste de controle prova que a captura enxerga as três saídas). (d) JSON malformado e corpo acima de 100kb nas 4 rotas de escrita. (e) Mensagem de validação sem o valor enviado: 4 rotas x 7 campos inválidos. Um bloco novo prova que o idoso alvo vem do vínculo e não do path (mock que ignora o `where`). Já tinham cobertura parcial: acesso cruzado em `saudeHistorico`, `saudeCuidador` e `saudeEdicao`; privacidade pontual em cada `saude*.test.ts` e em `app.errorHandler.test.ts` (só `POST /saude`). A matriz consolidada foi feita mesmo com a sobreposição. `frontend/src/pages/Saude.test.tsx`: +2 testes (histórico: sucesso e erro sem valor de saúde em `console.*`); as outras seções já tinham esse teste (a edição nas duas seções via `describe.each`). `backend/src/app.errorHandler.test.ts` +1 teste (headersSent, ver abaixo). Suítes: backend 19 arquivos/625 testes (era 18/504), frontend 14 suítes/115 testes (era 14/113). `tsc --noEmit` e `npm run lint` limpos nos dois pacotes. Nenhum teste novo falhou contra o código atual. Depois do merge, o PR #116 (novo layout de `Vinculos.tsx` e `ConfirmarEmail.tsx`, da Laureane) deixou `ce5d5c2` e `420b335` em `main`. O `420b335`, enviado por Marcos à branch `laureane`, corrige os testes do CI do frontend: `ConfirmarEmail.test.tsx` (botão "Confirmar e-mail") e `Vinculos.test.tsx` (suíte da seção Cadastrar idoso em `describe.skip`, porque a seção foi removida do novo layout). Contagens no `main` (`d436c4d`, 191 commits), rodadas de verdade em 30/09/2026: backend 19 arquivos/625 testes; frontend 14 suítes (1 pulada)/115 testes, sendo 112 passando e 3 pulados. `tsc` e lint limpos nos dois pacotes.

**Mutações locais, não commitadas, todas revertidas (`git diff` só com as mudanças pretendidas):** remover `requireVinculoAprovado` do `GET /saude/idoso/:idosoId` (14 testes falham); `idosoId` do path no `where` do GET, no `create` do POST e na checagem do PATCH (1 teste cada; sobreviviam até acrescentar o bloco "idoso alvo vem do vínculo"); `errorHandler` logando `err.message` (32), logando `req.body` (32), escrevendo `req.body` em `process.stderr` (32) e respondendo `err.message` (32); remover a checagem de dono em `PATCH /saude/:id` (3); validação ecoando o valor enviado (8); `GET /saude` sem filtro por idoso (2); histórico do frontend logando o corpo lido (1). A mutação de desfazer alteração em `prisma.ts` não se aplica (arquivo não alterado). Voltar o ramo `headersSent` para `next(err)` derruba 1 teste (o novo).

**Correção do `headersSent` (`backend/src/app.ts`):** o ramo `res.headersSent` do `errorHandler` fazia `next(err)`, que entrega o erro ao handler padrão do Express. O `logerror` dele (`lib/application.js`, Express 4.21) imprime `err.stack` em qualquer `NODE_ENV` diferente de `test`, inclusive produção, e o stack começa pela `message`, que num erro do Prisma carrega os args da query (valores de `RegistroSaude`). Por isso confirmar `NODE_ENV=production` no Render NÃO resolveria. Correção mínima: `errorHandler` passou a ser export nomeado (o `export default app` continua) e, depois do log já sanitizado (`name`, `code`, método e path), o ramo faz `req.socket.destroy()` e retorna, que é o que o handler padrão faz, sem o log do stack. O quarto parâmetro virou `_next` porque o Express só reconhece handler de erro por aridade 4 (remover o parâmetro faria o Express tratá-lo como middleware comum). Teste determinístico em `app.errorHandler.test.ts`, chamando `errorHandler` direto com `req` e `res` falsos (`headersSent: true`, `socket.destroy` como `jest.fn`): `next` não é chamado, `socket.destroy` é chamado uma vez, nenhuma saída (console, stdout, stderr) contém `message` nem `stack` do erro com sentinela, e o log sanitizado continua saindo.

**Observação de deploy, sem mudança nesta tarefa (decisão futura e separada):** o `backend/Dockerfile` usa `CMD ["npm", "run", "dev"]` (`tsx watch`) e nem ele nem o `render.yaml` definem `NODE_ENV`. Não afeta a correção acima, que vale em qualquer ambiente.

**Pendência manual do Marcos:** conferir no dashboard do Render (serviço `elder-web-backend`) que `DEBUG` e variáveis `PRISMA_*` não estão definidas; `DEBUG=prisma:*` faz o Prisma imprimir os args das queries. Na máquina local, `DEBUG` e `PRISMA_*` não estavam definidas.

**Risco residual aceito:** o `errorHandler` registra `code` como vier (string ou número) para erro que não é do Prisma; só o Prisma e o Node definem `code`, com valores fixos, mas um erro de terceiro com `code` arbitrário carregando dado sensível vazaria.

**Limitações conhecidas (não mitigadas):** (a) o custo já registrado de o log do `errorHandler` não ter `message` nem `stack` (depurar um 500 exige reproduzir o caso); (b) `DEBUG=prisma:*` no Render, ou um `log` passado ao client no futuro, vazam; (c) sem e2e e nada visto no navegador.

Fora de escopo (não implementado, por instrução explícita): `GET /vinculo` expondo `permite_*`, download do histórico, exclusão de registro, auditoria do valor sobrescrito, biblioteca de log, correção do status do JSON malformado.

**Item 4.x da Fase 4 (testes do frontend `/saude`): `permissoes` em `GET /vinculo`, ocultação das seções de escrita e `jest-axe` (2026-09-30, sem PR ainda, commits locais pendentes de confirmação):**

Fecha o achado do item 4.2 (`GET /vinculo` sem `permite_*`) e a última linha da tabela "Testes" da Fase 4. Escopo é o esqueleto cru `Saude.tsx`, não a tela final de Laureane e Jennifer; os testes novos valem como rede de segurança e serão reaproveitados quando a tela final chegar. Nenhuma migration, rota nova ou arquivo das duas alterado (`Vinculos.tsx`, `components/Vinculos/*`, `Home`, `Sidebar`, `Header` intactos).

**Contrato novo (aditivo) de `GET /vinculo`:** cada item ganhou `permissoes`. É `{ permite_registrar_saude, permite_marcar_dose, permite_criar_evento_cuidado }` (três booleanos do banco) quando `tipo_vinculo === 'cuidador'` E `status === 'aprovado'`, e `null` em qualquer outro caso (familiar, pendente, recusado). Sai para quem já via o item (papéis `dono`, `vinculado`, `titular`). Nenhum outro campo e nenhum `Usuario` inteiro. A regra espelha `PATCH /vinculo/:id/definir-permissoes`, que só aceita cuidador aprovado (conferido lendo a rota antes): as flags não existem fora disso. Implementado com `expoePermissoes` no `.map` de `backend/src/routes/vinculo.ts`; o Prisma já devolvia as colunas no `include`.

**Regra de ocultação (frontend, só UX; a autoridade continua sendo o 403 do backend):** novo `frontend/src/lib/permissoesSaude.ts` com `buscarPermissoesSaude()` (`GET /vinculo?status=aprovado` via `chamarApi`, tipo mínimo local `VinculoMinimo`, sem importar o tipo de `CardVinculo`), a função pura `decidirVisibilidade` e o hook `usePermissoesSaude`. As duas seções que escrevem em nome de outro idoso (registrar "cuidador ou familiar" e editar "de um idoso vinculado") só são renderizadas se existir vínculo aprovado com `papel_do_chamador === 'vinculado'` que seja de familiar, ou de cuidador com `permissoes.permite_registrar_saude === true`. Papéis `dono` e `titular` não contam, e só `permite_marcar_dose` não habilita. Sem nenhuma seção qualificada mas com vínculo de cuidador aprovado: texto dentro de uma região viva `role="status"` persistente (sempre montada, só o conteúdo muda, para o leitor de tela anunciar o aviso) ("Seu vínculo de cuidador não tem a permissão de registrar saúde ativada. Você ainda pode ver o histórico."). Sem vínculo nenhum (por exemplo o idoso): oculta sem mensagem. Carregando: a mesma região com o `Spinner` (mais o texto "Verificando permissões...") no lugar das duas seções. Erro ao buscar: as duas seções ficam visíveis e aparece `role="alert"` ("Não foi possível verificar suas permissões. O servidor continua validando cada ação."); o erro e o corpo não são logados. Histórico e seções do próprio idoso ficam sempre visíveis. Desvio pequeno do desenho original: o módulo também exporta o hook, porque o teste antigo faz `getBy` síncrono logo após `render` e um estado de carregando real quebraria as asserções; o mock permissivo de `Saude.test.tsx` troca só o hook (`jest.requireActual` para o resto), sem mexer em nenhuma asserção nem no índice de `global.fetch.mock.calls`.

**Testes:** backend, 11 casos novos em `vinculoListar.test.ts` (fake estendido com as 3 flags; nenhum teste existente precisou mudar): cada flag sozinha verdadeira para dono, vinculado e titular (pega troca de campo), cuidador aprovado com as três falsas devolve objeto e não `null`, `null` para familiar aprovado (duas origens), cuidador pendente e recusado com as flags verdadeiras no banco (prova que a rota suprime o valor), formato exato das chaves do item, `?status` continuando a filtrar. Escritos antes, RED confirmado (11 falhas). 5 mutações locais, cada uma derrubando ao menos um teste (expor para familiar: 3; para pendente: 2; trocar uma flag por outra: 2; sempre `null`: 5; expor para recusado: 2), revertidas. Frontend: `permissoesSaude.test.ts` (novo, 12), bloco "ocultação por permissão" em `Saude.test.tsx` (14 novos, RED confirmado com um stub ingênuo: 20 falhas entre os dois arquivos) e `Saude.acessibilidade.test.tsx` (novo, 16). Este último usa `jest-axe` (`jest-axe` e `@types/jest-axe` como devDependencies do frontend, autorizadas; `expect.extend(toHaveNoViolations)` só no arquivo novo) em: página com cuidador habilitado, cuidador sem flag, carregando, erro de permissões, sem vínculo, e cada uma das 5 seções (registro do idoso, registro de cuidador ou familiar, as duas edições, histórico) com erro `role="alert"` e com resultado de sucesso; mais um controle positivo (um `<input>` sem label tem de dar violação `label`). O axe não achou nenhuma violação em `Saude.tsx`, então nada foi alterado no componente por causa dele. Mutações do frontend, revertidas: remover `htmlFor` do label do histórico (17 falhas, incluindo os testes do axe), remover `htmlFor` do campo único das edições (29), remover `role="alert"` do erro do cuidador (4), remontar a região `status` (1, teste de persistência do mesmo nó), `decidirVisibilidade` contando papéis `dono` e `titular` (4), ignorando `tipo_vinculo` (7) e checar `permite_marcar_dose` em vez de `permite_registrar_saude` (6). Suítes: backend 19 arquivos/636 testes (era 19/625), frontend 16 suítes (1 pulada)/157 testes, sendo 154 passando e 3 pulados (era 14 suítes (1 pulada)/115, 112 passando). `tsc --noEmit`, `typecheck:test` e `npm run lint` limpos nos dois pacotes.

**Limitações conhecidas (não mitigadas):** (a) contraste de cor NÃO foi verificado: o `jest-axe` não calcula cor em jsdom, a regra `color-contrast` foi desligada de propósito no arquivo de teste e segue pendente para o item 9.1; (b) o id do idoso é digitado livremente no esqueleto, então com vários vínculos vale "qualquer um qualifica" e só o backend valida o idoso de fato; (c) a ocultação do familiar ignora `modo_decisao` (o familiar aprovado vê as seções mesmo com `modo_decisao='idoso'` e recebe 403 ao enviar), expor `modo_decisao` ficou fora de escopo; (d) sem e2e, sem `@axe-core/playwright` e nada visto no navegador; (e) `jest-axe` trouxe `axe-core`, `chalk` e `lodash.merge` como dependências transitivas.

**Mudança de contrato a avisar (fica com o Marcos):** `GET /vinculo` agora devolve `permissoes` em cada item; Laureane e Jennifer podem usar o campo nas telas de cuidador.

**Item 5.1 da Fase 5 (RF-011) implementado: cadastro de medicamento por idoso ou familiar, nunca cuidador (2026-10-01, PR #123, mergeado em `main` em 2026-10-01T21:04:14Z por rebase: `3ab7cc5` rotas, testes e script, `2a5a2bf` esqueleto de frontend, `f0a2daa` docs; hashes finais diferentes dos commits locais `08eca50`, `6b94463` e `a5d1210`, mesmo padrão dos PRs anteriores):**

Primeiro item da Fase 5. Nenhuma migration, CHECK, dependência nova nem mudança em `saude.ts`, nos middlewares ou em `vinculo.ts`: o modelo `Medicamento` já existia no `schema.prisma`. Código novo em `backend/src/routes/remedios.ts`, montado em `app.ts` com `app.use('/remedios', remediosRouter)`.

**Rotas e ordem de verificação.** `POST /remedios`: `requireAuth`, `findUnique` do `tipo_perfil` do chamador (só `idoso`; qualquer outro, ou usuário não encontrado, recebe 403), depois validação do corpo (400), depois `create`. `POST /remedios/idoso/:idosoId`: `requireAuth` e `requireVinculoAprovado("idosoId")`. Ordem: 401, 400 (`idosoId` não numérico, do middleware), 403 (sem vínculo aprovado), 403 (regra de ator), 403 (`modo_decisao`), 400 (corpo). Nenhum 400 de corpo antes de qualquer 403. Mensagem única de 403, "Sem permissão para cadastrar medicamento.", que não cita `modo_decisao`, flags nem o motivo.

**Regra fixa de ator (critério de pronto do plano).** Cuidador nunca cria medicamento, em nenhuma rota, com qualquer vínculo e qualquer combinação das flags `permite_*`. Na rota por vínculo valem as duas condições juntas: `vinculo.tipo_vinculo === 'familiar'` E `tipo_perfil` do chamador `'familiar'` (um `findUnique` próprio). A segunda existe para a regra continuar valendo se a convenção de `tipo_vinculo` do middleware (ver o comentário de suposição em `requireVinculoAprovado.ts`) um dia quebrar. A checagem de ator vem antes do resolver: para cuidador `resolverModoDecisao` nem é chamado. As flags `permite_*` não são lidas em lugar nenhum desta rota.

**Autoridade do familiar (extensão deliberada, decidida pelo Marcos).** Além de vínculo aprovado, o familiar só cria quando `resolverModoDecisao(vinculo.idoso_id) === 'familiar'`, sempre pelo resolver (honra transferência vencida; `NULL` vale `'idoso'`). É a mesma regra de saúde (itens 4.2b e 4.3), estendida a medicamento porque `modo_decisao` define quem tem a caneta sobre os dados do idoso. O texto literal do item 5.1 do plano não a menciona. Qualquer familiar aprovado pode criar, cada um com a própria autoria.

**Autoria e campos do servidor.** `idoso_id` é `req.usuarioId` na rota do idoso e `req.vinculoAprovado.idoso_id` na rota do familiar (nunca path nem body). `criado_por_id` é `req.usuarioId`. `editado_por_id` é `null` na criação. `ativo` é `true` sempre, passado explicitamente porque o schema não tem default. `id`, `idoso_id`, `criado_por_id`, `editado_por_id`, `ativo`, `created_at` e `updated_at` enviados no body são ignorados.

**Validação (400, mensagem fixa por campo, nunca reproduz o valor enviado).** `nome` até 150, `dosagem` até 50, `frequencia` até 100: string não vazia depois do `trim`, gravada com `trim`, texto livre. `data_inicio` obrigatória e `data_fim` opcional (ausente ou `null`): `YYYY-MM-DD` de calendário real (ida e volta pelo ISO rejeita `2026-02-30`), sem horário nem fuso; `data_fim` não pode ser anterior a `data_inicio` (igual é aceito); passado e futuro aceitos. `observacoes` opcional, até 500 caracteres medidos depois do `trim`; vazia ou só espaço vira `null`. O `Date` do Prisma sai de `${valor}T00:00:00.000Z` e a resposta serializa `YYYY-MM-DD` (`toISOString().slice(0, 10)`). O helper de texto foi duplicado em `remedios.ts` (equivalente a `textoObrigatorio`), sem exportar nem alterar nada de `saude.ts`. Resposta 201 com lista explícita de 13 campos: `id`, `idoso_id`, `criado_por_id`, `nome`, `dosagem`, `frequencia`, `data_inicio`, `data_fim`, `observacoes`, `ativo`, `editado_por_id`, `created_at`, `updated_at`.

**Privacidade (RNF-001).** Medicamento é dado de saúde sensível. Nenhum `console.*` novo no backend, `errorHandler` intacto. Testes provam que corpo do 400, corpo do 403 e `console.*` não trazem o nome nem as observações enviados, e que um erro do Prisma no `create` vira 500 genérico sem o valor em corpo nem em `console.*`.

**Testes (escritos antes, RED confirmado pelo motivo certo: 77 de 77 falharam, todos com 404 de rota inexistente).** Backend: `remedios.test.ts` (rota do idoso e validação) e `remediosVinculado.test.ts` (rota por vínculo), 77 casos no total. Cobrem a matriz familiar x `modo_decisao` com resolver mockado e com o resolver real (NULL, transferência vencida efetiva, em curso segue `'idoso'`), cuidador com as 3 flags verdadeiras (teste do plano), com cada flag sozinha, com as 3 falsas, pendente e recusado, o cruzamento ator x vínculo nos dois sentidos (vínculo `familiar` com chamador `cuidador`, e vínculo `cuidador` com chamador `familiar`), acesso cruzado entre idosos com controle positivo e fake de `vinculo.findFirst` que filtra de verdade pelo `where`, idoso chamando a rota por vínculo com o próprio id, dois familiares com autoria própria, `idoso_id` vindo do vínculo (mock que ignora o `where`), 403 antes de 400, limites exatos, `trim`, datas sem deslocamento. Frontend: `Remedios.test.tsx` (8) e `Remedios.acessibilidade.test.tsx` (6, `jest-axe`, com controle positivo). RED do frontend com stub nulo: 12 falhas e 2 passando (controle positivo e estado inicial vazio).

**Mutações locais (10, todas revertidas, `git diff` confere só as mudanças pretendidas), cada uma derrubando ao menos um teste:** remover a checagem de `tipo_vinculo` (1), remover a de `tipo_perfil` do chamador (1), aceitar cuidador com alguma flag (6), ignorar `modo_decisao` (6), `idosoId` do path no `create` (1), `criado_por_id` do body (2), remover `requireVinculoAprovado` (7), aceitar `data_fim` anterior (2), `ativo` do body (2), validar o corpo antes do 403 (2). Os testes de ator e vínculo inconsistentes existem justamente para matar as mutações 1 e 2 isoladamente. Nas primeiras tentativas as mutações 2, 4 e 7 deram erro de compilação do ts-jest (import ou variável sem uso), que não prova nada; foram refeitas com mutações válidas em TypeScript.

**Script de verificação:** `backend/scripts/verify-medicamento.ts` (transação sempre revertida, recusa host que não seja `localhost`/`127.0.0.1`): create com e sem `data_fim`/`observacoes`, limites `nvarchar` 150/50/100/500 aceitos e 151/51/101/501 rejeitados, `@db.Date` relido como o mesmo dia, `ativo` como `bit`, FK inexistente em `idoso_id` e em `criado_por_id`, `COUNT(*)` igual antes e depois. RODADO em 2026-10-01 contra o SQL Server LOCAL do `docker-compose.yml` (`localhost:14330`, `DATABASE_URL` sobrescrita na linha de comando, destino conferido antes de cada comando): 12/12 PASS. `data_inicio` e `data_fim` relidas do banco como o mesmo dia enviado (3 datas: 2026-01-01, 2026-10-01, 2026-12-31), sem deslocamento, no formato `YYYY-MM-DD` que a rota serializa; `nvarchar` aceita 150/50/100/500 e rejeita 151/51/101/501; `ativo` gravado como `bit` (relido `true`); FK inexistente em `idoso_id` e em `criado_por_id` rejeitada; create com e sem `data_fim`/`observacoes` aceito; `COUNT(*)` de `Medicamento` 0 antes e 0 depois (transações sempre revertidas). Antes do script: o container `db` foi recriado sobre o volume local `mssql_data` (de 2026-09-23), `prisma migrate deploy` não achou migration pendente e `migrate status` confirmou o schema em dia (7 migrations aplicadas); `verify-constraints.ts` deu 24/24 PASS. Nenhuma correção em `remedios.ts` foi necessária Typecheck e lint do script limpos. A premissa de que o dia de `@db.Date` não desloca segue sem prova contra o banco real até alguém rodar o script.

**Frontend (esqueleto cru, exceção de divisão de trabalho prevista no CLAUDE.md):** `frontend/src/pages/Remedios.tsx`, rota `/remedios` atrás de `RotaProtegida` em `App.tsx` (um import e uma `Route`), sem link na navegação. Duas seções ("Cadastrar medicamento (só idoso)" e "Cadastrar medicamento de um idoso (familiar)", esta com campo de id do idoso). `maxLength` 150, 50, 100 e 500 nos textos, `<input type="date">` enviado direto como `YYYY-MM-DD`, opcional em branco omitido, `label` associado, `role="alert"` no erro, `role="status"` no sucesso, botão desabilitado e `aria-busy` durante o envio. Sem ocultação por permissão, sem listagem. O `console.error` registra só a mensagem do erro. A linha "5.x Frontend /remedios" da tabela de testes do plano NÃO fica fechada por este item: ela cobre feedback após marcar dose e exportar PDF, que ainda não existem.

**Suítes antes e depois:** backend 19 arquivos/636 testes, depois 21 arquivos/713 (+77). Frontend 16 suítes (1 pulada)/157 testes, depois 18 suítes (1 pulada)/171 testes, sendo 168 passando e 3 pulados (+14). `tsc --noEmit` e `npm run lint` limpos nos dois pacotes.

**Limitações conhecidas (não mitigadas):** (a) sem listagem, edição nem desativação de medicamento (nenhum item da Fase 5 cobre edição ou desativação; listagem é o 5.3); (b) sem deduplicação: o mesmo medicamento pode ser cadastrado várias vezes; (c) `frequencia` é texto livre, sem enum; (d) a ocultação no frontend não existe, então familiar com `modo_decisao='idoso'` vê o formulário e recebe 403 ao enviar; (f) contraste de cor não verificado (jest-axe não calcula cor em jsdom), segue no item 9.1.

**Fora de escopo, não adiantado:** marcar dose (5.2), listagem e histórico (5.3), PDF (5.4), edição e desativação, paginação, deduplicação.

**Mudança de contrato a avisar (fica com o Marcos):** rotas novas `POST /remedios` e `POST /remedios/idoso/:idosoId`; Laureane e Jennifer podem usá-las na tela final. O esqueleto `Remedios.tsx` é só para teste do Marcos.

**Item 5.2 da Fase 5 (RF-012) implementado: marcar dose administrada, com cuidador condicionado a `permite_marcar_dose` (2026-10-02, PR #125, mergeado em `main` em 2026-10-02T11:48:55Z por rebase: `8d6b8b5` rotas, testes e `verify-dose-medicamento.ts`, `19a75e2` esqueleto de frontend, `474ccbd` docs, `a460398` verify de rotas, `a8325e7` docs do verify; hashes finais diferentes dos commits locais `02b1c01`, `ff0f080`, `cdb9927`, `a5f6746` e `3d72a17`, mesmo padrão dos PRs anteriores):**

Nenhuma migration, dependência nova nem mudança em `saude.ts`, nos middlewares, em `vinculo.ts` ou em `GET /vinculo`. O modelo `RegistroDoseMedicamento` e o CHECK `CK_RegistroDoseMedicamento_status_administracao` já existiam (migration `20260831005102_init_schema`, linha do `ALTER TABLE`; o `schema.prisma` só tem um TODO a respeito, mas o CHECK está no banco). Código novo em `backend/src/routes/remedios.ts`.

**Rotas e ordem de verificação.** `POST /remedios/:medicamentoId/doses` (idoso, dose do próprio medicamento): 401, 403 (`tipo_perfil` diferente de `idoso`), 400 (`medicamentoId`), 400 (corpo), 404, 409, 201. `POST /remedios/idoso/:idosoId/:medicamentoId/doses` (cuidador ou familiar): `requireAuth` e `requireVinculoAprovado("idosoId")`; 401, 400 (`idosoId`, do middleware), 403 (sem vínculo aprovado), 403 (ator, flag ou `modo_decisao`), 400 (`medicamentoId`), 400 (corpo), 404, 409, 201. Mensagem única de 403 de ator, "Sem permissão para registrar dose.", que não cita `modo_decisao`, flags nem o motivo. O 403 de vínculo continua sendo o do middleware.

**Autorização na rota por vínculo.** Cuidador: `tipo_vinculo === 'cuidador'` E `tipo_perfil` do chamador `'cuidador'` E `permite_marcar_dose === true` (comparação estrita; as outras duas flags não abrem esta porta). Familiar: `tipo_vinculo === 'familiar'` E `tipo_perfil` `'familiar'` E `modo_decisao` efetivo `'familiar'`, sempre via `resolverModoDecisao(idoso_id)` (honra transferência vencida, `NULL` vale `'idoso'`), nunca a coluna. A checagem de ator vem antes do resolver, então ator recusado nunca o aciona. Mesma regra do cadastro de medicamento (5.1) e da escrita de saúde (4.2b, 4.3): a escrita do familiar segue `modo_decisao`. O ER isenta Idoso e Familiar da flag `permite_marcar_dose`, mas não de `modo_decisao`; decisão do Marcos após a primeira versão do 5.2, que não consultava o modo. Cuidador e idoso não mudam. Qualquer outra combinação, incluindo `req.vinculoAprovado` ausente, responde 403 genérico, sem citar `modo_decisao`.

**Medicamento e corpo.** O medicamento é buscado com `findFirst({ where: { id, idoso_id } })`, com o idoso alvo (do vínculo, ou `req.usuarioId` na rota do idoso) no próprio `where`: inexistente e de outro idoso respondem o mesmo 404 ("Medicamento não encontrado."). `ativo === false` responde 409 ("Medicamento inativo."). A janela `data_inicio`/`data_fim` não é validada. `medicamentoId` só aceita dígitos de 1 a 2147483647 (rejeita `1e2`, `1.5`, `-1`, `0`). Corpo: `status_administracao` obrigatório e exatamente um de `administrado`, `pulado`, `atrasado` (caixa diferente, vazio, número, `null`, ausente: 400); `data_hora_administracao` opcional (omitida vale o relógio do servidor; enviada, ISO 8601 com fuso explícito, não futura além de 5 minutos, mesma regra de `data_hora` de `saude.ts`, replicada localmente com comentário); `observacoes` opcional, `trim`, até 300 caracteres, vazio vira `null`. `registrado_por_id` é sempre `req.usuarioId`; `id`, `created_at`, `medicamento_id`, `idoso_id` e autoria vindos do body são ignorados. A resposta 201 serializa `id`, `medicamento_id`, `registrado_por_id`, `data_hora_administracao` (ISO), `status_administracao`, `observacoes` e `created_at`. Mensagens de 400 fixas, nunca com o valor enviado; nenhum `console.*` novo.

**Testes.** `backend/src/routes/remediosDoseIdoso.test.ts` (43) e `remediosDoseVinculado.test.ts` (98), com fakes de `vinculo.findFirst` e `medicamento.findFirst` que filtram de verdade pelo `where` (chave `undefined` não filtra, como no Prisma), relógio de `Date` congelado (limite exato de 5 minutos), controle positivo da captura de `console.*`/stdout/stderr e 5 tipos de erro injetados em `medicamento.findFirst` e em `registroDoseMedicamento.create`. RED confirmado antes da implementação: 42 de 43 e 86 de 87 falhando (os 2 que passavam eram o controle positivo da captura). Mutação local, uma de cada vez, todas derrubadas por pelo menos um teste: remover a checagem de `permite_marcar_dose` (7 falhas), trocar por `permite_registrar_saude` (5), remover `tipo_perfil` do cuidador (2), remover `tipo_vinculo` do cuidador (2) e do familiar (1), `idoso_id` do path em vez do vínculo (1), tirar `idoso_id` do `where` do medicamento (6), `registrado_por_id` do body (2), remover a validação do enum (11), ignorar `ativo` (2), Regra do familiar com `modo_decisao` (segunda rodada): remover a chamada do resolver (8 falhas), resolver antes da checagem de ator (4), ler a coluna em vez do resolver (64), exigir o resolver também do cuidador (2), aceitar qualquer modo (6) e remover `tipo_perfil` do familiar (3). Frontend, seções de dose: remover `role="status"` da confirmação (7), remover `role="alert"` dos erros (16), remover `disabled` do botão (4) e fazer o erro ecoar `observacoes` (8); todas derrubadas.

**Script de verificação:** `backend/scripts/verify-dose-medicamento.ts` (transação sempre revertida, recusa host que não seja `localhost`/`127.0.0.1`). RODADO em 2026-10-02 contra o SQL Server LOCAL do `docker-compose.yml` (`localhost:14330`, banco `elder_web`, `DATABASE_URL` sobrescrita só no comando, nunca no `.env`): 12/12 PASS. Cobre create com `observacoes` nula, CHECK aceitando os 3 valores e rejeitando valor desconhecido, vazio e com espaço, `nvarchar(300)` aceitando 300 e rejeitando 301, FK de `medicamento_id` e de `registrado_por_id` inexistentes, `datetime2` relido com o mesmo instante (3 instantes, com milissegundos) e `COUNT(*)` igual antes e depois. `verify-constraints.ts` seguiu 24/24 PASS (o CHECK de `status_administracao` já era coberto lá). Achado: a collation padrão do SQL Server é case-insensitive, então o CHECK do banco ACEITA `'ADMINISTRADO'`; só a rota barra a caixa diferente (400). O caso aparece no script como informativo (sempre PASS, com o que foi medido). Nenhuma migration foi criada: tornar o CHECK sensível a caixa exigiria migration e autorização explícita e separada do Marcos para aplicar no Azure.

**Script ponta a ponta:** `backend/scripts/verify-rotas-dose.ts` sobe o `app` de `./app` com Supertest, com Prisma e SQL Server reais; só a validação do token Firebase é substituída em runtime (`auth.verifyIdToken` de `lib/firebaseAdmin` passa a devolver `{ uid: <token> }`, o "token" enviado é o `firebase_uid` da conta de teste; nenhum código de produção foi alterado). RODADO em 2026-10-02 contra o SQL Server LOCAL (`localhost:14330`, banco `elder_web`, `DATABASE_URL` sobrescrita só no comando): 14/14 PASS. Cenários: idoso cadastra o medicamento e marca a dose (`registrado_por_id` do idoso); cuidador com `permite_marcar_dose=false` (outras duas flags true) recebe 403 sem linha, e com `true` recebe 201 com autoria do cuidador; familiar com `modo_decisao` `'idoso'` recebe 403 e com `'familiar'` recebe 201; medicamento de outro idoso responde 404 igual ao inexistente (também via vínculo); `ativo=false` responde 409; `status_administracao` inválido e `'ADMINISTRADO'` respondem 400 (a rota barra mesmo o banco aceitando); `COUNT(*)` de `RegistroDoseMedicamento` conferido antes, durante (antes + 3) e depois da limpeza. Exceção deliberada à convenção dos `verify-*`: como as rotas usam o `prisma` global, o script NÃO reverte por transação; ele limpa no `finally` (doses, vínculos, medicamentos, contas), recusa rodar fora de `localhost`/`127.0.0.1` (a trava é a primeira instrução de `main()`, antes de qualquer `import` dinâmico, então antes de carregar o dotenv, o Prisma ou o app; testada sem `DATABASE_URL` no ambiente e com host remoto: recusou nos dois casos, sem conexão) e marca as contas de teste com o prefixo `verify-dose-` no `firebase_uid`, que identifica conta residual se o processo for morto no meio (o `finally` não roda nesse caso). Contagem de mutações do backend: 16 válidas, todas derrubadas (10 da primeira rodada, porque a do resolver no familiar ficou obsoleta com a mudança de regra, mais 6 do alinhamento do familiar a `modo_decisao`). O corpo do PR #125 diz 17 (contou a obsoleta); vale esta contagem.

**Frontend (esqueleto cru, só para o Marcos testar).** `Remedios.tsx` ganhou "Marcar dose (só idoso)" e "Marcar dose de um idoso vinculado", com id do medicamento (e do idoso) digitados, `<select>` de situação, data e hora opcional (`datetime-local` convertida com `toISOString()` para o ISO com `Z` que o backend exige) e observações. A seção do vinculado só aparece para familiar aprovado ou cuidador aprovado com `permite_marcar_dose`; `dono` e `titular` não contam; cuidador aprovado sem a flag vê aviso em `role="status"`; se a consulta de vínculos falhar, a seção aparece e o 403 do backend decide (mesma regra de `Saude.tsx`). Sucesso em `role="status"` ("Dose registrada (id N)."), erros em `role="alert"` com a mensagem fixa do backend, botão desabilitado com `aria-busy` durante o envio, nenhum `console.*` nas seções de dose. Arquivos novos: `lib/permissoesDose.ts` (hook `usePermissoesDose`, ao lado de `usePermissoesSaude` para não alterá-lo) e a função `decidirVisibilidadeDose` em `lib/permissoesSaude.ts` (acréscimo, nada renomeado). Testes: `Remedios.test.tsx` e `Remedios.acessibilidade.test.tsx` (jest-axe em todos os estados, com o controle positivo já existente) e `lib/permissoesDose.test.ts` (10, regra pura). Como a página passou a chamar `GET /vinculo` ao montar, os dois arquivos de teste do 5.1 ganharam só setup: um `jest.mock` de `buscarPermissoesSaude` (default: familiar aprovado) e `act`/`waitFor` no import; nenhuma asserção do 5.1 foi alterada (decisão do Marcos, "ajustar só o setup"). Mutação local em `decidirVisibilidadeDose` (6 variantes), todas derrubadas. Os testes do frontend foram escritos depois da implementação; o RED foi verificado em seguida, rodando-os contra o `Remedios.tsx` do 5.1: 22 de 31 falhando.

**Suítes antes e depois:** backend 21 arquivos/713 testes, depois 23 arquivos/854 (+141). Frontend 17 suítes passando (1 pulada)/168 testes passando (3 pulados), depois 18 suítes passando (1 pulada)/216 passando (3 pulados) (+48). `tsc` e `eslint` limpos nos dois pacotes.

**Limitações conhecidas (não mitigadas):** (a) o frontend segue ocultando a seção do vinculado sem olhar `modo_decisao` (como `Saude.tsx`): familiar com modo `'idoso'` vê o formulário e recebe 403 ao enviar; (a2) sem idempotência: duas doses idênticas seguidas são aceitas (duplo envio por rede lenta grava duas doses); (b) sem GET de doses nem de medicamentos (listagem é o 5.3), por isso o id do medicamento e o do idoso são digitados no esqueleto; (c) sem editar nem excluir dose; (d) a janela `data_inicio`/`data_fim` do medicamento não é validada, só `ativo`; (e) o CHECK de `status_administracao` no banco é case-insensitive (ver acima); (f) contraste de cor não verificado (jest-axe não calcula cor em jsdom), segue no item 9.1; (g) nada foi visto no navegador.

**Fora de escopo, não adiantado:** listagem e histórico (5.3), PDF (5.4), edição e exclusão de dose, lembretes, mudança de schema.

**Mudança de contrato a avisar (fica com o Marcos):** rotas novas `POST /remedios/:medicamentoId/doses` e `POST /remedios/idoso/:idosoId/:medicamentoId/doses`; Laureane e Jennifer podem usá-las na tela final. A linha "5.x Frontend /remedios" da tabela de testes do plano segue sem fechar: faltam a listagem e o PDF.

**Item 5.3 da Fase 5 (RF-013, RNF-003) implementado: histórico de remédios (prescrições + doses) (2026-10-02, PR #127, mergeado em `main` em 2026-10-02T16:37:20Z por rebase: `a40431d` rotas, testes, matriz e `verify-rotas-historico-remedios.ts`, `0d36e8b` esqueleto de frontend, `af3b7d6` docs; hashes finais diferentes dos commits locais `48921de`, `6d818fd` e `df0c516`, mesmo padrão dos PRs anteriores; CI backend, frontend e Vercel verdes; `main` com 210 commits):**

Nenhuma migration, dependência nova nem mudança em `saude.ts`, nos middlewares, em `vinculo.ts`, em `GET /vinculo` ou no `errorHandler`. Código novo em `backend/src/routes/remedios.ts` (duas rotas GET e a função `historicoDoIdoso`, que reaproveita `serializarMedicamento` e `serializarDose`).

**Rotas e ordem de verificação.** `GET /remedios` (idoso lê o próprio histórico): `requireAuth`, `findUnique` de `tipo_perfil`; 401, 403 (não é idoso; cuidador e familiar leem pela outra rota); `idoso_id` é `req.usuarioId`. `GET /remedios/idoso/:idosoId` (cuidador ou familiar): `requireAuth` e `requireVinculoAprovado("idosoId")`; 401, 400 (`idosoId`, do middleware), 403 (vínculo). Nenhuma checagem além do middleware, de propósito; o idoso da consulta é `req.vinculoAprovado.idoso_id`, nunca path, query ou body, e `req.vinculoAprovado` ausente dá 403 sem non-null assertion. Mensagem de 403 de perfil `MSG_403_LEITURA_REMEDIOS` ("Sem permissão para visualizar histórico de remédios."), a mesma nas duas rotas, sem citar o motivo; o 403 de vínculo continua sendo o do middleware.

**Autorização de leitura.** Vínculo aprovado basta. Cuidador aprovado lê sempre, mesmo com as 3 flags `permite_*` false (`permite_marcar_dose` é de escrita e não existe flag de leitura). Familiar aprovado lê sempre, mesmo com `modo_decisao` `'idoso'`; `resolverModoDecisao` não é chamado em rota de leitura (os testes falham se for). Sem filtro por `tipo_vinculo` (a premissa já está documentada no middleware).

**Resposta e acesso a dados.** 200 com `{ medicamentos: [...] }`; cada item é `serializarMedicamento(m)` mais `doses: [...]` com `serializarDose`. Nenhum campo novo e nenhum nome de autor (só ids, como no 4.4). Medicamento sem dose tem `doses: []`; sem medicamento, 200 com `{ medicamentos: [] }`. Entram medicamentos inativos e fora da janela `data_inicio`/`data_fim` (é histórico), com `ativo` na resposta. Ordenação: medicamentos por `data_inicio` desc e `id` desc; doses por `data_hora_administracao` desc e `id` desc. Uma única consulta `prisma.medicamento.findMany` com `where { idoso_id }`, `orderBy` em array e `include` da relação `doses` com `orderBy` interno; como o filtro é no `Medicamento`, dose de medicamento de outro idoso nunca entra. Sem paginação, filtro por período ou tipo, nem limite (mesma decisão de `GET /vinculo` e do 4.4).

**Matriz compartilhada com o 4.4.** `backend/src/testSupport/matrizAcessoLeitura.ts` exporta só dados (ids fictícios `IDOSO_A=5`, `IDOSO_B=6`, `CUIDADOR`, `FAMILIAR` e `CASOS_ACESSO_LEITURA`, 16 casos: idoso, familiar com os dois `modo_decisao`, cuidador com flags false e true, sem vínculo, pendente, recusado, vínculo só do idoso B, idoso na rota de vínculo). Os dois módulos a consomem: `remediosHistorico.test.ts` e um bloco adicional em `saudeHistorico.test.ts` (nenhum teste do 4.4 foi removido nem enfraquecido). O 4.4 real passou os 16 casos sem ajuste. O `exclude` do tsconfig não adianta (o tsc emite o arquivo no `dist` por import dos testes, e os `*.test.ts` já iam para o `dist`), então o tsconfig ficou intacto.

**Testes.** `backend/src/routes/remediosHistorico.test.ts` (71): matriz (16), forma da resposta, conteúdo e ordenação (inclusive desempate por id), paridade (familiar e cuidador sem flags com corpo idêntico ao do idoso), origem do idoso (path, query e corpo ignorados), ordem de erros (401, 400 para `abc`, `1.5` e `1,5`), 403 literal por ator e privacidade (sentinelas em nome, dosagem e observações; erro injetado em `usuario.findUnique`, `vinculo.findFirst` e `medicamento.findMany` com 5 tipos de erro; sem sentinela em corpo, headers, `console.*`, stdout e stderr; controle positivo da captura). Fakes de `vinculo.findFirst` e `medicamento.findMany` filtram de verdade pelo `where`, aplicam `orderBy` e devolvem as doses do `include` ordenadas. RED confirmado antes da implementação: 70 de 71 falhando (404 por rota inexistente; o único que passava era o controle positivo da captura; o teste do texto do 403 foi reescrito para comparar com a string literal e provado contra um 404). Mutação local, uma de cada vez, todas derrubadas e revertidas: M1 remover o filtro `idoso_id` (20 falhas), M2 `idosoId` do path em vez do vínculo (1), M3 remover a checagem de `tipo_perfil` (3), M4 exigir `permite_marcar_dose` (16), M5 chamar `resolverModoDecisao` (17), M6 inverter a ordem dos medicamentos (2), M7 inverter, remover ou trocar o desempate da ordem das doses (3 cada), M8 filtrar `ativo: true` (4), M9 remover o `include` (22), M10 `data_inicio` sem o `slice` (2), M11 `console.log` do resultado (1), M12 trocar um status esperado da matriz (derrubou o 5.3 e o bloco do 4.4), M13 trocar o texto da constante do 403 (5).

**Frontend (esqueleto cru, só para o Marcos testar; a tela final é da Laureane e da Jennifer).** Seção "Ver histórico de remédios" em `frontend/src/pages/Remedios.tsx`, sempre visível para todos os perfis (leitura não depende de flag nem de `modo_decisao`; não usa `usePermissoesDose`). Campo "Id do idoso (vazio = meu histórico)": vazio chama `GET /remedios`, preenchido chama `GET /remedios/idoso/:id`. Mostra nome, dosagem, frequência, "Início", "Fim" ou "Sem data de término", "Situação: Ativo" ou "Inativo", observações e a sub-lista de doses ("dd/mm/aaaa HH:mm, Administrado | Pulado | Atrasado") ou "Nenhuma dose registrada.". Datas `data_inicio` e `data_fim` formatadas por `split` (sem `new Date`, que deslocaria o dia); hora da dose por `Intl.DateTimeFormat('pt-BR')` com `timeZone: 'America/Sao_Paulo'` fixo. Erro em `role="alert"`, resultado em `role="status"`, estado nunca só por cor, nenhum `console.*`. Testes em `Remedios.test.tsx` (10) e `Remedios.acessibilidade.test.tsx` (5, jest-axe em antes da busca, carregando, resultados com doses, vazio e erro, com o controle positivo e `color-contrast` desligado como já estava). RED: 16 de 16 falhando antes da seção existir. Mutação local, todas derrubadas e revertidas: F1 data com `new Date`, F2 sem `role="alert"`, F3 situação só por cor, F4 fuso da máquina em vez de `America/Sao_Paulo`, F5 `console.error` no erro.

**Script de verificação:** `backend/scripts/verify-rotas-historico-remedios.ts`: rota, Prisma e banco reais, só o token Firebase substituído em runtime; recusa host que não seja `localhost`/`127.0.0.1`. NÃO reverte por transação (as rotas usam o `prisma` global; mesma exceção deliberada de `verify-rotas-dose.ts`): toda linha criada leva uma sentinela única da execução (`verify-hist-<tag>` no `firebase_uid`, `SENT_VERIFY_*_<tag>` no nome), o `finally` apaga só essas linhas (doses, vínculos, medicamentos, contas) e, se o `COUNT(*)` final diferir do inicial, o script falha alto e lista o que sobrou. RODADO em 2026-10-02 contra o SQL Server LOCAL do `docker-compose.yml` (`localhost:14330`, banco `elder_web`, `DATABASE_URL` sobrescrita só no comando, nunca no `.env`): 18/18 PASS. Cobre idoso lendo o próprio histórico (medicamento ativo, inativo e sem doses, com duas doses em ordem correta), datas sem deslocamento, familiar e cuidador sem flags com corpo idêntico ao do idoso, pendente e recusado 403, acesso cruzado, `COUNT(*)` de `Medicamento` e `RegistroDoseMedicamento` iguais antes e depois das leituras (leitura não escreve) e depois da limpeza (0 para 0, nenhuma conta sobrou), e 0 bytes de sentinela em stdout e stderr. Medição com Prisma real, sem PASS nem FAIL: `GET /remedios/idoso/2147483648` respondeu 403 e `GET /remedios/idoso/99999999999` respondeu 403. O middleware compartilhado ficou intocado.

**Suítes antes e depois:** backend 23 arquivos/854 testes, depois 24 arquivos/941 (+87). Frontend 18 suítes passando (1 pulada)/216 testes passando (3 pulados), 219 no total, depois 18 suítes passando (1 pulada)/232 passando (3 pulados), 235 no total (+16). `tsc` e `eslint` limpos nos dois pacotes.

**Limitações conhecidas (não mitigadas):** (a) sem paginação, filtro por período ou tipo, nem limite; (b) sem nome de autor, só ids (`registrado_por_id`, `criado_por_id`, `editado_por_id`); (c) o middleware só rejeita com 400 o que `Number()` não converte em inteiro (`abc`, `1.5`, `1,5`); `0`, negativo, `1e2` e acima de INT32_MAX passam por ele e dão 403 por falta de vínculo, medido também com Prisma real; (d) contraste de cor não verificado (jest-axe não calcula cor em jsdom), segue no item 9.1; (e) nada foi visto no navegador; (f) sem e2e; (g) download do histórico (PDF) é o item 5.4 e não foi adiantado.

**Fora de escopo, não adiantado:** PDF (5.4), edição e exclusão de dose, lembretes, mudança de schema.

**Mudança de contrato a avisar (fica com o Marcos):** rotas novas `GET /remedios` e `GET /remedios/idoso/:idosoId` (formato `{ medicamentos: [{ ...medicamento, doses: [...] }] }`) e seção nova em `frontend/src/pages/Remedios.tsx`, arquivo de tela; Laureane e Jennifer podem usá-las na tela final.

**Item 5.4 da Fase 5 (RF-014) implementado: exportar o histórico combinado de remédios e saúde em um único PDF (2026-10-04, PR #129, mergeado em `main` em 2026-10-04T18:46:01Z por rebase: `0c425b3` backend, `4cd6ca2` frontend, `72feaf0` docs, `45efc8c` docs da pendência de `.dockerignore`; hashes finais diferentes dos commits locais `6d6ebac`, `ce28d6e`, `fc4f1cb` e `e275347`, mesmo padrão dos PRs anteriores; CI backend, frontend e Vercel verdes):**

Nenhuma migration e nenhuma mudança em `saude.ts`, `remedios.ts`, `vinculo.ts`, middlewares, `errorHandler`, schema Prisma nem `chamarApi.ts`. Código novo: `backend/src/lib/historicoPdf.ts` (builder, função pura que recebe dados já carregados e devolve `Promise<Buffer>`), `backend/src/routes/historicoPdf.ts` (duas rotas), montagem `app.use('/historico', ...)` em `app.ts`, `backend/src/testSupport/extrairTextoPdf.ts` (só testes e verify) e `backend/scripts/verify-rotas-historico-pdf.ts`.

**Dependências (instaladas com confirmação do Marcos).** `pdfkit@0.20.2` (dependência), `@types/pdfkit@0.17.6` e `pdfjs-dist@3.11.174` (devDependencies). O plano era `pdf-parse`: o `1.1.1` falha com `bad XRef entry` em qualquer PDF do pdfkit (testado com `compress: false` e `pdfVersion` 1.3 e 1.4; é o pdfjs antigo embutido, o `3.x` lê o mesmo arquivo sem erro), e o `2.4.5` exige o binário nativo `@napi-rs/canvas`, risco para o `npm ci` do Dockerfile no Render. Por isso `pdf-parse` e `@types/pdf-parse` foram instalados e depois removidos (0 ocorrências no `package.json` e no lockfile). O `pdfjs-dist` 3.x declara `canvas@2.11.2` como optionalDependency: entrou no lockfile (com `tar` e `@mapbox/node-pre-gyp`), mas o script de instalação do `canvas` fica bloqueado por `allowScripts` (não alterado), então não há binário; `npm ci` em cópia isolada terminou limpo, e `npm ci --omit=optional` também (os testes de extração passam sem o `canvas`). `npm audit`: 1 alta antes (`brace-expansion`); depois 4 (`pdfjs-dist` alta, `tar` crítica, `@mapbox/node-pre-gyp` alta, mais a anterior), todas só devDependency; `npm audit --omit=dev` dá 0. Aceito pelo Marcos. O CI (`ci.yml`) não roda `npm audit`. `docker build ./backend` rodado UMA vez em 2026-10-04, só como verificação (exceção autorizada pelo Marcos; imagem removida depois): terminou com sucesso em `node:24-alpine`, o `npm ci` instalou 672 pacotes sem erro (só avisos de deprecação e o aviso de `npm audit`), `prisma generate` e `tsc` passaram. O `canvas` foi só desempacotado, sem binário (`node_modules/canvas/build` ausente): não compilou nem falhou, o script de instalação não rodou. Ressalva já existente, fora do 5.4: não há `.dockerignore`, então o `COPY . .` copia o `node_modules` do host por cima do da imagem; validar mesmo assim o `npm ci` do Render no primeiro deploy após o merge e olhar o log; revisar `pdfjs-dist` e `canvas` quando o item 9.3 (docker build no CI) entrar.

**`extrairTextoPdf(buffer)`** devolve `{ texto, paginas }`: junta os itens com espaço, `\n` quando o item indica fim de linha, normaliza espaços repetidos. Usa `verbosity: 0` e `isEvalSupported: false` (mitiga a falha de execução de JS por PDF malicioso do pdfjs até 4.1.392, embora só se leiam PDFs gerados aqui). O pdfjs 3.x imprime via `console.log` um aviso de polyfill ao ser carregado; o módulo é carregado de forma preguiçosa com `console.log` mudo, restaurado num `finally` (teste força o `require` a lançar e confere a restauração; mutação sem a restauração derruba o teste). Teste prova que a extração não escreve em stdout, stderr nem `console.*`, e nos testes de privacidade a extração roda fora das janelas de captura.

**Rotas e ordem de verificação.** `GET /historico/pdf` (idoso exporta o próprio): `requireAuth`, `findUnique` de `nome` e `tipo_perfil`; 401, 403 (não é idoso); idoso da consulta é `req.usuarioId`. `GET /historico/idoso/:idosoId/pdf` (cuidador ou familiar): `requireAuth` e `requireVinculoAprovado("idosoId")`; 401, 400 (`idosoId`), 403 (vínculo); idoso da consulta é `req.vinculoAprovado.idoso_id`, nunca path, query ou body, e o `findUnique` do nome usa `select: { nome: true }` (nunca o BLOB da foto). 403 de perfil: `MSG_403_EXPORTACAO` ("Sem permissão para exportar histórico."), a mesma nas duas rotas, sem citar o motivo; o 403 de vínculo é o do middleware. Autorização igual à leitura dos itens 4.4 e 5.3: vínculo aprovado basta, cuidador exporta com as 3 flags `false`, familiar exporta com `modo_decisao` `'idoso'`, `resolverModoDecisao` não é chamado (os testes falham se for), sem checagem de `tipo_vinculo`.

**Montagem em memória.** O PDF é montado inteiro (`Buffer`) antes de qualquer byte ser enviado, nunca por pipe: se algo falhar no meio, o erro cai no `errorHandler` como 500 JSON normal em vez de acionar o ramo `headersSent` (que derruba o socket e entregaria PDF truncado). Headers: `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="historico-saude-remedios.pdf"` (nome fixo, sem nome nem id), `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`. Consultas (todas com `where` de `idoso_id`): `medicamento.findMany` com `include` das doses (mesmo formato do 5.3), `registroSaude.findMany` por `data_hora` desc, `Decimal` convertido com `Number()`.

**Conteúdo do PDF** (A4, Helvetica, preto sobre branco, corpo 12 pt, títulos 18 e 14 pt): título, nome do idoso e "Gerado em dd/mm/aaaa hh:mm" (America/Sao_Paulo, `hourCycle: 'h23'`); seção "Remédios" (por medicamento: nome, dosagem, frequência, período, situação Ativo ou Inativo, observações e doses com data e hora, situação e observações); seção "Saúde" (data e hora, tipo com a primeira letra maiúscula, valor em pt-BR `valor_1/valor_2 unidade` ou `valor_1 unidade`, observações); estado vazio por seção ("Nenhum medicamento cadastrado." e "Nenhum registro de saúde.", com 200); rodapé "Página X de Y" via `bufferPages`. Sem ids, autor, e-mail nem foto. Campo `date` formatado com `timeZone: 'UTC'` (não desloca o dia). Período do medicamento sem término sai como "de dd/mm/aaaa, sem data de término". Saneamento: todo texto vindo do banco passa por NFC e vira `?` por code point fora de U+0020 a U+007E e U+00A0 a U+00FF; quebra de linha preservada.

**Testes.** Backend: `routes/historicoPdf.test.ts` (97): matriz compartilhada (16 casos, agora citando o item 5.4 no comentário), headers e `%PDF`/`%%EOF`, texto extraído (nome do idoso, medicamento, rótulo da dose, "120/80 mmHg"), paridade (familiar e cuidador sem flags com texto igual ao do idoso, sem a linha "Gerado em"), acesso cruzado com controle positivo, idoso do path, query e corpo ignorados, ordem de erros (401, 400, 403 literal), estados vazios, 300 medicamentos gerando várias páginas, e privacidade (falha injetada em `usuario.findUnique`, `vinculo.findFirst`, `medicamento.findMany`, `registroSaude.findMany` e no builder, com 5 tipos de erro: 500 exato, resposta sem PDF e sem `Content-Disposition`, sem sentinela em corpo, headers, `console.*`, stdout e stderr; controle positivo da captura). `lib/historicoPdfBuilder.test.ts` (22): data `date` sem deslocamento, datetime em São Paulo (inclusive 23:59 do dia anterior), decimais pt-BR, `valor_2` nulo, `data_fim` nula, acentos, NFD vira NFC, emoji e CJK viram `?`, observação multilinha, ordem respeitada, rodapé "Página X de Y" em documento de várias páginas e teste de POSIÇÃO do rodapé (por `extrairItensPdf`, que lê o `transform` do `getTextContent`: em 15 páginas o rodapé fica em y 32,82 em todas, e o texto mais baixo do corpo em y 58,67, então nada fica abaixo nem sobreposto; passou de primeira contra o código existente, que já usa `x` e `y` explícitos, `MARGEM` e `doc.page.height - 40`, com a margem inferior zerada só durante a escrita do rodapé, depois de todo o conteúdo). `testSupport/extrairTextoPdf.test.ts` (3). Fakes de `usuario.findUnique`, `vinculo.findFirst`, `medicamento.findMany` e `registroSaude.findMany` filtram de verdade pelo `where` e aplicam `orderBy` e `select`. RED confirmado antes da implementação: 117 de 118 falhando nas duas suítes novas (o único que passava era o controle positivo da captura), com tipos e `tsc` limpos (o builder existia só como stub que lança). Mutação local, uma de cada vez, 24 mutações, todas derrubadas por asserção (nenhuma só por erro de compilação; a corrida final foi refeita com detecção de `error TS`) e revertidas: remover a checagem de `tipo_perfil` (5 falhas), `idoso_id` do path em vez do vínculo (1), sem o filtro `idoso_id` em `medicamento.findMany` (17), em `registroSaude.findMany` (8) e no `usuario.findUnique` (8), exigir `permite_registrar_saude` (32), exigir `modo_decisao` via resolver (33), remover `Cache-Control` (2), `Content-Disposition` (2) e `X-Content-Type-Options` (2), omitir a seção de saúde (8), omitir as doses (2), data com fuso local em vez de UTC (2), remover o saneamento (2), enviar bytes antes de o builder terminar (33), `select` do usuário pedindo `foto_perfil` (1), `console.log` do nome (16), rodapé com contagem errada (3), registros em ordem crescente (1), sem NFC (1), estado vazio removido (3), `valor_2` ignorado (2), idoso fixo na rota própria (13) e rodapé sem `x` e `y` explícitos (2, inclusive o teste de posição). Nenhuma mutação sobreviveu e nenhum teste novo foi preciso; uma primeira versão da mutação de saneamento só quebrava a compilação, foi refeita para alterar o comportamento.

**Frontend (esqueleto cru, só para o Marcos testar; a tela final é da Laureane e da Jennifer).** `frontend/src/lib/baixarPdf.ts`: `getCurrentUserToken` e `fetch` com `Authorization` e sem `Content-Type` JSON (por isso não usa `chamarApi`), lê o corpo como `Blob`, dispara o download com `URL.createObjectURL` e um `<a download="historico-saude-remedios.pdf">` temporário, e revoga a URL num `finally`; em erro HTTP lê o JSON `{ error }` e lança com a mensagem. Seção "Exportar histórico em PDF" em `Remedios.tsx`, sempre visível: campo "Id do idoso para exportar (vazio = meu histórico)" (vazio chama `/historico/pdf`, preenchido `/historico/idoso/:id/pdf`) e botão "Baixar histórico em PDF" (`aria-busy` e desabilitado durante a geração, "Gerando PDF..."), sucesso em `role="status"` ("PDF gerado. O download começou."), erro em `role="alert"` com a mensagem do backend, mensagem anterior limpa ao reenviar, sem `console.*`. Sem botão em `Saude.tsx`. Testes: `baixarPdf.test.ts` (9), 9 casos novos em `Remedios.test.tsx` mais 2 de feedback de dose, 5 em `Remedios.acessibilidade.test.tsx` (jest-axe em inicial, carregando, sucesso e erro, com controle positivo; `color-contrast` desligado como já estava). RED: 9 de 9 da seção falhando antes de existir (e o helper sem módulo). Mutação local, 12, todas derrubadas e revertidas: sem `aria-busy` (2 falhas), sem `role="alert"` (5), não revogar a URL (2), não limpar a mensagem ao reenviar (1), `Content-Type` JSON no download (1), sem `disabled` (2), caminho do próprio errado (1), sucesso sem `role="status"` (6), botão nunca reabilitado (4), `console.error` no catch (1), erro HTTP ignorando a mensagem do backend (2) e dose sem limpar a mensagem ao reenviar (2). Duas dessas mutações tinham padrão que não casava (o arquivo está em CRLF no Windows) e foram refeitas.

**Feedback ao marcar dose (item 5.x, D12), auditoria.** `MarcarDose` já tinha botão desabilitado com `aria-busy` durante o envio (teste de duplo envio nas duas seções), sucesso em `role="status"`, erro em `role="alert"` (403, 400, 404, 409) e limpeza da mensagem ao reenviar na implementação. Faltava só o teste da limpeza ao reenviar (erro some, depois sucesso some, nas duas seções); foi adicionado e a mutação sem a limpeza o derruba. Nenhuma mudança de implementação em `MarcarDose`.

**Script de verificação:** `backend/scripts/verify-rotas-historico-pdf.ts`, no padrão do `verify-rotas-historico-remedios.ts`: rota, Prisma e banco reais, só o token Firebase substituído em runtime; recusa host que não seja `localhost`/`127.0.0.1`; NÃO reverte por transação, limpa por sentinela única (`verify-pdf-<tag>`, `SENT_VERIFY_*_<tag>`) no `finally`, `COUNT(*)` de `Medicamento`, `RegistroDoseMedicamento` e `RegistroSaude` iguais antes e depois, 0 bytes de sentinela em stdout e stderr, texto do PDF extraído de verdade. RODADO em 2026-10-04 contra o SQL Server LOCAL do `docker-compose.yml` (`localhost:14330`, banco `elder_web`, `DATABASE_URL` sobrescrita só no comando, nunca no `.env`; `prisma migrate status` antes: 7 migrations, schema em dia): 21/21 PASS. Cobre idoso exportando o próprio (200, `application/pdf`, os 4 headers, `%PDF` e `%%EOF`, 2113 bytes), texto extraído de verdade (nome do idoso com acento, 3 medicamentos com ativo, inativo e futuro, doses com situação, "120/80 mmHg" e "36,6 °C", dose de 12:30Z saindo 09:30, datas sem deslocar o dia, "Página 1 de 1"), familiar (`modo_decisao` NULL) e cuidador sem flags com texto igual ao do idoso, pendente e recusado 403, acesso cruzado 403 sem dado do B, PDF do A sem sentinela do B (e o do B com a dele, controle positivo), 401 sem token e 400 com `idosoId` inválido, 0 bytes de sentinela em stdout e stderr (com controle positivo da captura), `COUNT(*)` de `Medicamento`, `RegistroDoseMedicamento` e `RegistroSaude` iguais antes e depois das leituras (4/4, 3/3, 3/3) e depois da limpeza (0 para 0 nas três, nenhuma conta sobrou).

**Suítes antes e depois:** backend 24 arquivos/941 testes, depois 27 arquivos/1063 (+122: 97 + 22 + 3). Frontend 18 suítes passando (1 pulada, `Vinculos.test.tsx`, já assim antes de qualquer mudança)/232 testes passando (3 pulados), 235 no total, depois 19 passando (1 pulada)/257 passando (3 pulados), 260 no total (+25: 9 + 11 + 5). `tsc` (build) e `eslint` limpos nos dois pacotes.

**Limitações conhecidas (não mitigadas):** (a) sem paginação, filtro nem limite: o PDF inteiro é montado em memória, então um histórico muito grande custa memória e tempo do servidor (volume testado: 300 medicamentos com doses); (b) fontes padrão do PDF (Helvetica): qualquer caractere fora de Latin-1 vira `?`; (c) um medicamento pode ser cortado entre páginas (sem controle de quebra); (d) sem nome de autor nem ids no documento; (e) contraste de cor não verificado (jest-axe não calcula cor em jsdom), segue no item 9.1; (f) nada foi visto no navegador (o download real com `<a download>` só foi testado em jsdom); (g) a URL do objeto é revogada logo após o clique; (h) 3 avisos de `npm audit` só de devDependency aceitos (ver acima); (i) o `npm ci` do Render não foi validado (o `docker build` local passou, ver acima).

**Fora de escopo, não adiantado:** paginação e filtros do histórico, botão em `Saude.tsx`, assinatura ou marca d'água no PDF, envio por e-mail, mudança de schema.

**Mudança de contrato a avisar (fica com o Marcos):** rotas novas `GET /historico/pdf` e `GET /historico/idoso/:idosoId/pdf` (resposta `application/pdf`, anexo), helper novo `frontend/src/lib/baixarPdf.ts` e seção nova em `frontend/src/pages/Remedios.tsx`, arquivo de tela; Laureane e Jennifer podem usar o helper na tela final.

**Rodada de pendências pós-5.4 (2026-10-04): decisões e correções, por delegação do Marcos ("decisão do grupo"):**

**Corrigido em código (TDD, RED antes, mutação depois).** (a) `backend/src/app.ts`: o `errorHandler` passou a responder 400 `{ error: "Corpo da requisição inválido." }` para `entity.parse.failed` (JSON malformado) e 413 `{ error: "Corpo da requisição grande demais." }` para `entity.too.large`, antes do 500 genérico, sem eco do corpo e sem `console.*` (a `message` desse erro traz um trecho do corpo, que pode ter dado de saúde, RNF-001). O 500 de erro de verdade segue igual e segue registrado só com `name`, `code`, método e `req.path`. Testes novos em `backend/src/app.corpoInvalido.test.ts` (7: 3 rotas com JSON malformado, sem token, corpo de 100 kb, controle positivo e 500 real). O teste de 4.5 em `saudeDadoSensivel.test.ts` que documentava o 500 "medido, não corrigido de propósito" foi atualizado para 400 e 413 (continua provando que o corpo enviado não aparece em resposta nem em saídas). (b) `backend/src/routes/auth.ts`: `nome` em branco no corpo de `/auth/sync` (vazio ou só espaços) não vence mais o `decoded.name` do Google; o nome do token também é aparado; em branco nos dois continua 400 e acima de 150 caracteres continua 400. Testes novos em `backend/src/routes/authNomeGoogle.test.ts` (8). RED: 9 de 15 falhando antes da correção (os 6 que passavam eram comportamento já existente). Mutação local, todas derrubadas e revertidas: sem o ramo `parse.failed` (4 falhas), sem o ramo `too.large` (1), 400 que registra em `console.error` (5), nome em branco vencendo o Google (4), nome do token sem `trim` (1).

**Infra.** `backend/.dockerignore` criado (`node_modules`, `dist`, `.env`, `.env.*` exceto `.env.example`, `*.tsbuildinfo`, `npm-debug.log*`, `coverage`): antes o `COPY . .` do build local levava `.env`, `.env.azure` e o `node_modules` do host para a imagem. `docker build ./backend` refeito (passou; a imagem agora só tem `.env.example`, `dist` compilado dentro dela e o `node_modules` do próprio `npm ci`; imagem removida). Não foi rodada com `npm start` porque o Firebase Admin exige credenciais reais na inicialização. `render.yaml` ganhou `NODE_ENV=production` (o Render já usava `dockerCommand: npm start`; o `CMD ["npm", "run", "dev"]` do Dockerfile só vale para o `docker-compose.yml` local e foi mantido). Nenhum comando contra o Azure.

**Decididas e fechadas (sem código; detalhes na seção "Decisões em aberto e pendências conhecidas" do `CLAUDE.md`):** auditoria do valor sobrescrito em edição de saúde (RNF-006) aceita sem tabela; aceite de termos e política de privacidade (LGPD) fora do escopo do TCC, como trabalho futuro; exclusão de registro, paginação e filtros fora do escopo; dose sem idempotência no servidor e CHECK de `status_administracao` case-insensitive aceitos, sem migration; histórico de remédios só com ids de autor; sem backfill de `modo_decisao` nulo (o resolver já trata `NULL` como `'idoso'`); foto do Google não semeada no fluxo de anexo do 3.3; colisão de e-mail tratada no código pelo 409 de `/auth/sync` (registro no ER fica com o Marcos).

**Continua com o Marcos:** conferir `DEBUG` e `PRISMA_*` no Render; conferir/definir `NODE_ENV` no dashboard se o blueprint não sincronizar; olhar o log do `npm ci` e do 1º deploy do Render (o Render MCP exigiu workspace confirmado, e nada foi consultado lá); avisar Laureane e Jennifer do contrato do 5.4; revisar `pdfjs-dist`, `canvas` e os 3 avisos de `npm audit` de dev no item 9.3; contraste de cor no item 9.1.

**Item 6.1 da Fase 6 (RF-015) implementado: idoso ou familiar cria compromisso na agenda, `Evento` tipo `pessoal` ou `medico` (2026-10-04, branch `development`):**

Nenhuma migration e nenhuma mudança em `schema.prisma`, `remedios.ts`, `saude.ts`, `vinculo.ts`, `historicoPdf.ts`, middlewares, `errorHandler`, `Home.tsx` nem Sidebar. A CHECK `CK_Evento_tipo_evento` (`'cuidado','medico','pessoal'`) já existia na migration inicial. Código novo: `backend/src/routes/agenda.ts` (montado em `app.ts` como `/agenda`), `backend/src/testSupport/agendaCasosCorpo.ts` (casos de corpo compartilhados pelas duas suítes), `backend/scripts/verify-rotas-agenda.ts`, `frontend/src/pages/Agenda.tsx` (esqueleto cru, rota `/agenda` protegida em `App.tsx`). Nenhuma dependência nova.

**Rotas.** `POST /agenda` (idoso, própria agenda) e `POST /agenda/idoso/:idosoId` (familiar, `requireAuth` + `requireVinculoAprovado("idosoId")`). Resposta 201 com objeto plano via `serializarEvento`: `id`, `idoso_id`, `criado_por_id`, `tipo_evento`, `titulo`, `descricao`, `data_hora_inicio` e `data_hora_fim` (ISO UTC, fim `null` se ausente), `editado_por_id`, `created_at`, `updated_at`.

**Regra de ator.** Rota do idoso: 403 se `tipo_perfil` não for `idoso`. Rota por vínculo: exige `tipo_vinculo === 'familiar'` E `tipo_perfil` `'familiar'` (o middleware não filtra `tipo_vinculo`) E `resolverModoDecisao(idoso_id) === 'familiar'`, sempre pelo resolver (honra transferência vencida, `NULL` vale `'idoso'`). A checagem de ator vem antes do resolver: para cuidador o resolver nunca é chamado. Cuidador recebe 403 sempre nesta rota, com qualquer vínculo e qualquer combinação de flags `permite_*`; o 6.2 trata o cuidador depois. A exigência de `modo_decisao` é uma extensão deliberada do Marcos: o texto literal do 6.1 não a cita, mas a regra do grupo vale (familiar só escreve com `modo_decisao` efetivo `'familiar'`). Qualquer familiar aprovado pode criar, cada um com a própria autoria. O 403 é genérico ("Sem permissão para criar compromisso.") e nunca cita `modo_decisao` nem o motivo.

**Ordem de erros.** Idoso: 401, 403 (perfil), 400 (tipo), 403 (`cuidado`), 400 (demais campos), 201. Por vínculo: 401, 400 (`idosoId`), 403 (vínculo), 403 (ator ou `modo_decisao`), 400 (tipo), 403 (`cuidado`), 400 (demais campos), 201. O `tipo_evento` é validado antes dos demais campos: `cuidado` com título inválido responde 403, não 400. Tipo ausente, não string, vazio, com caixa diferente (`Cuidado` inclusive) ou fora do CHECK: 400.

**Campos e datas.** Whitelist do corpo: `tipo_evento`, `titulo`, `descricao`, `data_hora_inicio`, `data_hora_fim`; o resto é ignorado. O servidor define `idoso_id` (de `req.usuarioId` na rota do idoso, de `req.vinculoAprovado.idoso_id` na rota por vínculo, nunca de path, query ou body), `criado_por_id = req.usuarioId` e `editado_por_id = null`, e não passa `created_at`/`updated_at` ao Prisma. `titulo`: obrigatório, `trim`, 1 a 150. `descricao`: opcional, ausente, `null` ou vazia após `trim` vira `null`, no máximo 500. Datas: ISO 8601 com `Z` ou offset (mesma regex `ISO_COM_FUSO` do 5.2, replicada sem refatorar `remedios.ts`); sem fuso é 400 porque o servidor leria em UTC. Dia real de calendário conferido por ida e volta de ano, mês e dia (o `Date` do Node aceita `2026-02-30` e rola para março, medido). Passado e futuro aceitos sem limite; fim maior ou igual ao início (igual aceito; evento que atravessa a meia-noite é válido). Grava o instante UTC exato (`09:00-03:00` vira `12:00Z`).

**Privacidade (RNF-001).** Evento `medico` pode carregar dado de saúde no título. Mensagens de erro fixas que nunca incluem o valor enviado, nenhum `console.*` novo, `errorHandler` intocado, nenhuma biblioteca de log. Todo handler async tem `try/catch` com `next(e)`.

**Testes (TDD).** Linha de base antes: backend 29 suítes e 1078 testes; frontend 19 suítes passando mais 1 pulada (3 testes pulados), 257 passando de 260. RED inicial: `agenda.test.ts` 91 falhando de 92 (o que passava era o controle positivo da captura), `agendaVinculado.test.ts` 172 de 173, tudo por 404 (rota inexistente); `Agenda.test.tsx` e `Agenda.acessibilidade.test.tsx` não rodavam (módulo inexistente). Depois: backend 31 suítes e 1343 testes (265 novos); frontend 21 suítes passando mais 1 pulada, 284 passando de 287 (27 novos). `tsc` e `lint` limpos nos dois pacotes. Fakes de Prisma filtram de verdade pelo `where`; controle positivo no acesso cruzado, nos campos forjados e na captura de `console.*`/stdout/stderr; falha injetada em `vinculo.findFirst`, `usuario.findUnique` e `evento.create` com 5 tipos de erro (500 exato, sem sentinela no corpo, nos headers, em `console.*`, stdout e stderr). Casos de corpo compartilhados em `describe.each` sobre as duas rotas. `jest-axe` com `color-contrast` desligada (jsdom não calcula cor; contraste segue no item 9.1).

**Mutações locais, todas derrubadas e revertidas.** Backend, 23: liberar `cuidado`, liberar o cuidador, remover `modo_decisao`, ler a coluna em vez do resolver, resolver antes do ator, `criado_por_id` do corpo, `idoso_id` do path, `idoso_id` do corpo, `editado_por_id` do corpo, spread do corpo no create, remover `trim` (título e descrição), remover dia real, aceitar data sem fuso, fim anterior ao início, fim igual recusado, limites 151 e 501, remover `tipo_perfil` do familiar, remover `tipo_vinculo`, idoso sem checar perfil, `cuidado` depois dos campos, tipo case-insensitive. Frontend, 16: opção `cuidado`, `htmlFor` (inputs e select), `role="alert"`, `role="status"`, data local sem `toISOString` (início e fim), id do idoso fora do caminho e no corpo, não limpar erro nem sucesso ao reenviar, sem `aria-busy`, sem `disabled`, fim vazio enviado, descrição vazia enviada, log do título. Observação de método: mutante que não compila (`noUnusedLocals`) dá "0 total" e não prova nada; as mutações foram aplicadas com `// @ts-nocheck` para chegarem aos testes.

**Frontend (esqueleto cru, só para o Marcos testar).** `Agenda.tsx` em `/agenda`: dois formulários ("Criar compromisso" do idoso e "Criar compromisso para um idoso vinculado" do familiar, com id do idoso digitado). Select de tipo só com Pessoal e Médico. Início e fim (`datetime-local`) vão como `new Date(valor).toISOString()`; fim e descrição vazios não são enviados. Acessibilidade desde o início: `label` com `htmlFor`, botão desabilitado com `aria-busy`, `Spinner`, `role="status"` no sucesso, `role="alert"` no erro, mensagem anterior limpa ao reenviar. Sem listagem nem calendário.

**Script de verificação.** `backend/scripts/verify-rotas-agenda.ts` (rota, Prisma e banco reais; só o token Firebase é substituído; recusa rodar fora de `localhost`; limpeza por sentinela no `finally`; prefixo `verify-agenda-`). Executado no SQL Server local (`localhost:14330`, `DATABASE_URL` só no comando): 12 de 12 PASS. Cobre idoso `pessoal` e `medico`, `09:00-03:00` lido de volta como `12:00Z`, `cuidado` com 403 e nenhuma linha, familiar com `modo_decisao` `'idoso'` (403) e `'familiar'` (201), cuidador com as 3 flags (403), INSERT direto com tipo inválido barrado por `CK_Evento_tipo_evento`, contagem de `Evento` (antes mais 3 durante, igual a antes depois) e de `Usuario` (igual antes e depois), nenhuma conta residual e 0 ocorrências da sentinela em stdout e stderr. A primeira execução deu 11 de 12: o esperado da contagem durante estava errado no script (4 em vez de 3, porque os 403 de `cuidado` não criam linha); corrigido no script, sem enfraquecer a verificação.

**Limitações aceitas.** Sem idempotência (duas criações iguais seguidas são aceitas), sem checagem de sobreposição de horários, sem paginação, sem listagem (é o 6.3), sem edição, exclusão nem notificação. Nenhuma biblioteca de calendário: o 6.3 será lista agrupada por dia.

**Continua com o Marcos:** avisar Laureane e Jennifer do contrato novo (`POST /agenda`, `POST /agenda/idoso/:idosoId`, `Agenda.tsx`); contraste de cor segue no item 9.1; nada visto no navegador.

**Item 6.2 da Fase 6 (RF-016, RF-032) implementado: cuidador cria compromisso de cuidado, `Evento` tipo `cuidado`, condicionado a `permite_criar_evento_cuidado` (2026-10-04, branch `development`; commits e PR ainda não feitos ao registrar esta entrada, completar hashes e PR depois do merge):**

Decisões D1 a D6 e D11 fechadas por Claude sob delegação explícita do Marcos em 2026-10-04. Linha de base real antes de mexer: backend 31 suítes e 1343 testes, frontend 22 arquivos (1 pulado) e 284 passando de 287, `tsc --noEmit` e lint limpos nos dois pacotes (igual ao declarado no plano). Sem migration, sem mudança de schema, sem dependência nova.

**Backend (`backend/src/routes/agenda.ts`).** Sem rota nova: `POST /agenda/idoso/:idosoId` ganhou o ramo do cuidador, no padrão da 5.2. `cuidadorAutorizado` é `tipo_vinculo === "cuidador"` E `chamador?.tipo_perfil === "cuidador"` E `vinculo.permite_criar_evento_cuidado === true` (igualdade estrita, lida do banco a cada requisição; `permite_marcar_dose` e `permite_registrar_saude` não abrem a porta). `familiarAutorizado` só avalia `resolverModoDecisao` quando `tipo_vinculo` e `tipo_perfil` são `'familiar'` (curto-circuito), então para cuidador o resolver nunca é chamado. Sem nenhum autorizado: 403 com `MSG_403`, sem citar flag nem motivo. `validarCorpoEvento(body, ator)` passou a receber o ator (`"comum"` para idoso e familiar, `"cuidador"`): cuidador com `pessoal` ou `medico` dá 403, com qualquer outro tipo que não seja exatamente `cuidado` dá 400; idoso e familiar mantêm o 403 de `cuidado` antes dos demais campos. Campos, limites e datas são os do 6.1 (mesma função, sem duplicar validação). `criarEvento` ganhou o parâmetro `ator`. Ordem para cuidador: 401, 400 (idosoId), 403 (vínculo), 403 (ator ou flag), 400 (tipo), 403 (tipo `pessoal`/`medico`), 400 (demais campos), 201. `POST /agenda` (idoso) não mudou: cuidador segue 403.

**Testes backend (TDD, RED pelo motivo certo).** Novo `agendaCuidador.test.ts` (fake de `vinculo.findFirst` que filtra pelo `where`, resolver mockado, captura de `console.*`, stdout e stderr): autorização (201 com objeto exato no `evento.create`; flag false com as outras duas true; cada outra flag sozinha; as 3 false; `null`, `undefined`, `1` e `"true"` dão 403), revogação (true para false entre duas requisições), tipos (403 para `pessoal` e `medico` com e sem flag; 400 para ausente, número, `null`, vazio, `Cuidado`, `CUIDADO`, ` cuidado`, `cuidado `, `outro`), vínculo (pendente, recusado, acesso cruzado com controle positivo, 401, 400, vínculo e perfil trocados), `modo_decisao` `'idoso'`, `'familiar'` e NULL sem consulta ao resolver real, ordem de erros, campos forjados, casos de corpo compartilhados com tipo-base `cuidado` e privacidade com falha injetada em `vinculo.findFirst`, `usuario.findUnique` e `evento.create` (5 tipos de erro). `agendaCasosCorpo.ts` ganhou `BODY_OK_CUIDADO` e `CASOS_201_CUIDADOR` (sem os casos "tipo 'medico'" e "tipo 'pessoal'", que para cuidador são 403). RED: 89 testes falhando, todos por "esperado 201, 400 ou 500, recebido 403" (30, 49 e 10), nenhum por import ou compilação. Depois da implementação: 388 testes verdes nas 3 suítes de agenda. Suíte completa: 32 suítes e 1466 testes; `tsc --noEmit` e lint limpos.

**Testes do 6.1 reescritos (D8), nenhum apagado.** Em `agendaVinculado.test.ts`: o cabeçalho (antes "Cuidador NUNCA cria nesta rota") passou a descrever o 6.2; o bloco "cuidador: nunca cria nesta rota" virou "cuidador: só cria 'cuidado' com a flag", ganhou um 201 de sanidade (flag true, tipo `cuidado`) e os 403 que seguem valendo agora enviam corpo `cuidado` (para não passarem só pelo tipo); o caso "403 com só a flag %s verdadeira" deixou de iterar a própria `permite_criar_evento_cuidado` (agora só as outras duas); o caso do resolver nunca chamado cobre 201 e 403; "403 com modo 'familiar'" usa flag falsa; "403 antes de 400: cuidador com corpo inválido" usa flag falsa (com a flag true e corpo `{}` o resultado correto agora é 400). `agenda.test.ts` não precisou mudar (cuidador em `POST /agenda` segue 403).

**Mutações backend, 18 aplicadas (`// @ts-nocheck`), 18 derrubadas, arquivo restaurado por cópia:** remover a flag; trocar por `permite_marcar_dose` e por `permite_registrar_saude`; truthy no lugar de `=== true`; remover `tipo_vinculo`; remover `tipo_perfil`; cuidador cria `pessoal`/`medico`; idoso e familiar criam `cuidado`; resolver exigido e resolver chamado e ignorado; `criado_por_id` e `idoso_id` do corpo; validar tipo antes da flag; 403 citando a flag; 403 repetindo valor enviado; cuidador aceita tipo inválido; `editado_por_id` diferente de null; familiar sem `modo_decisao`.

**Frontend (esqueleto cru).** `Agenda.tsx`: o booleano `comIdoso` virou `modo` (`'idoso' | 'familiar' | 'cuidador'`, que também é o sufixo dos rótulos e o slug dos ids). Terceira seção "Criar compromisso de cuidado (cuidador)" com id do idoso, título, descrição opcional, início e fim opcional, sem select de tipo (corpo sempre com `tipo_evento: "cuidado"`), datas via `toISOString()`, mesmo padrão de `label`/`htmlFor`, `aria-busy`, `role="status"` e `role="alert"`. 15 testes novos (RED por rótulo inexistente, 15 falhas), `jest-axe` nos estados inicial, carregando, sucesso e erro 400 e 403 da seção (a auditoria passou a parametrizar o rótulo do id do idoso por seção). Frontend final: 299 passando, 3 pulados. 9 mutações frontend, 9 derrubadas: tipo diferente de `cuidado`, select presente, `role="alert"` e `role="status"` ausentes, `aria-busy` ausente, mensagem não limpa, caminho `/agenda`, início sem `toISOString`, botão sem `disabled`.

**Script de verificação.** `verify-rotas-agenda.ts` estendido (17 cenários), executado no SQL Server local (`localhost:14330`, `DATABASE_URL` só no comando): 17 de 17 PASS. Cobre cuidador com a flag criando `cuidado` (linha com `criado_por_id`, `idoso_id` e `tipo_evento` corretos, primeira vez que `cuidado` passa pela `CK_Evento_tipo_evento` de verdade), cuidador sem flag e só com as outras duas (403, sem linha), `pessoal` e `medico` (403), `Cuidado` (400), `POST /agenda` (403), revogação da flag no banco (403), contagens de `Evento` (antes mais 4 durante, igual depois), `Usuario` e `Vinculo` iguais antes e depois, nenhuma conta residual e 0 ocorrências da sentinela em stdout e stderr.

**Limitações aceitas.** O frontend não sabe se o cuidador tem a flag: a seção sempre aparece e o 403 vira mensagem de erro. Flags não aparecem em `GET /vinculo` (contrato fora do escopo). Sem idempotência, sem checagem de sobreposição, sem listagem (6.3), sem edição nem exclusão.

**Continua com o Marcos:** avisar Laureane e Jennifer (contrato de `POST /agenda/idoso/:idosoId` agora aceita cuidador com a flag e tipo `cuidado`; `Agenda.tsx` ganhou seção; frontend não conhece a flag); contraste de cor segue no item 9.1; nada visto no navegador; hashes e PR a registrar depois do merge.

**Item 6.3 da Fase 6 (RF-017, RNF-003) implementado: visualizar a agenda do idoso (2026-10-05, branch `development`; commits locais de backend, frontend, testes e docs; PR e hashes a registrar depois do merge):**

**Decisões (D1 a D11, fechadas pelo grupo).** D1: duas rotas novas em `agenda.ts`, `GET /agenda` (idoso) e `GET /agenda/idoso/:idosoId` (cuidador ou familiar), sem edição, exclusão nem notificação. D2: mesmo padrão do 4.4 e do 5.3; vínculo aprovado basta (cuidador lê com as 3 flags `permite_*` falsas, familiar lê com qualquer `modo_decisao`), `resolverModoDecisao` nunca é chamado, o idoso da consulta vem de `req.vinculoAprovado.idoso_id` ou de `req.usuarioId`, e o ramo sem `req.vinculoAprovado` responde 403 explícito. D3: todos os atores veem os 3 tipos, sem filtro por tipo nem por autor (risco aceito: cuidador e familiar veem compromissos pessoais; título `medico` segue as regras do RNF-001). D4: 200 `{ eventos }` por `serializarEvento`, uma única `findMany` por `idoso_id` com `orderBy` `data_hora_inicio` e `id` crescentes, sem paginação nem `Cache-Control` novo. D5: ordem de erros 401, 403 (perfil) em `GET /agenda`; 401, 400, 403 (vínculo) na outra; 403 de perfil com a mensagem fixa "Sem permissão para visualizar agenda.". D6: sem migration, `schema.prisma`, middlewares, `errorHandler`, `vinculo.ts`, `saude.ts`, `remedios.ts`, `historicoPdf.ts`, `serializarEvento` nem validação de criação; sem dependência nova; nada no Azure. D7 e D8: fuso fixo `America/Sao_Paulo` via `Intl.DateTimeFormat` com `timeZone` explícito; cada evento aparece uma vez, no dia do início, e o fim mostra a data quando cai em outro dia. D9: `frontend/src/lib/agendaPorDia.ts` com `agruparEventosPorDia`, `formatarIntervalo` e `rotuloTipo`; data inválida lança `RangeError` com mensagem fixa. D10: seção "Ver agenda" em `Agenda.tsx`, sempre visível, dias de hoje em diante em lista e passados em `<details>` "Compromissos anteriores". D11: `verify-rotas-agenda.ts` estendido.

**Fatos de implementação.** (a) O teste de fuso roda cada fuso (`UTC`, `America/Sao_Paulo`, `Asia/Tokyo`, `Pacific/Kiritimati`) num processo `node` filho com `TZ` real, executando o próprio `agendaPorDia.ts` por type-stripping do Node, que exige Node 22.18 ou superior (o projeto fixa `>=24 <25` e o CI usa 24.x). Motivo: no Jest o `process.env` é uma cópia, trocar `TZ` ali não chega ao motor de datas (o controle falhou) e fake timers não mudam fuso. O controle confere a hora local de `2026-01-01T00:00:00Z` em cada filho (0, 21, 9 e 14). Em Node mais antigo o teste falha com mensagem clara ("exige Node 22.18 ou superior"), nunca pula. (b) A seção "Ver agenda" usa `fetch` direto, não `chamarApi`: este força `Content-Type` JSON e repassa o texto de erro do corpo, o que contraria as mensagens fixas por status (400, 401, 403 e demais) do D10. Reaproveita `getCurrentUserToken` e `VITE_API_URL`; duplica o `fetch` com cabeçalho Bearer de `baixarPdf.ts`; sem tratamento próprio de 401 (como nas demais telas). Só `ErroAgenda` tem mensagem exibível, qualquer outro erro cai na genérica. (c) `agendaPorDia.test.ts` declara tipos mínimos locais (`process`, `__dirname`, `jest.requireActual` tipado), porque `tsconfig.test.json` não carrega `@types/node` e ele conflita com `test-globals.d.ts`. (d) Teste do ramo defensivo: `agendaLeitura.test.ts` troca `requireVinculoAprovado` por um wrapper que delega ao middleware real e, com um flag, passa sem preencher o vínculo; esperado 403 fixo, sem o id enviado, `evento.findMany` nunca chamado.

**Testes.** Backend: `agendaLeitura.test.ts` novo, 69 testes (matriz compartilhada de 16 casos por `it.each` nas duas rotas, ordem com desempate por id e entrada embaralhada, paridade entre atores, origem do idoso, ordem de erros, instantes exatos com milissegundos, privacidade com falha injetada em `vinculo.findFirst`, `usuario.findUnique` e `evento.findMany` com 5 tipos de erro, ramo defensivo). RED: 67 falhas por 404 e 1 passando (controle da captura). Frontend: `agendaPorDia.test.ts` (27), 14 testes novos em `Agenda.test.tsx` e 6 em `Agenda.acessibilidade.test.tsx`. RED da lib por módulo inexistente e do componente por 15 falhas (seção inexistente); os testes de `jest-axe` passaram de primeira, sem RED, porque só auditam a UI já implementada (contraste desligado, item 9.1). Suítes ao fim: backend 33 arquivos e 1535 testes (antes 32 e 1466), frontend 22 arquivos mais 1 pulado, 347 passando (antes 299); `tsc` e lint limpos nos dois pacotes.

**Mutações (todas derrubadas, aplicadas em cópia com `// @ts-nocheck`).** Backend, 21: sem filtro por `idoso_id`, `idoso_id` do path, da query, sem checagem de perfil, ordem decrescente, sem desempate, sem `orderBy`, exigir `permite_*`, exigir `modo_decisao` (lido da coluna), chamar o resolver, filtrar por tipo, filtrar por `criado_por_id`, 403 citando o motivo (nas duas rotas), erro repetindo o valor, 500 vazando `message`, data com `toString`, sem `requireVinculoAprovado`, ramo sem vínculo respondendo 200 ou chamando `findMany`. Para exigir `modo_decisao`, o fake de `usuario.findUnique` passou a devolver `modo_decisao: "idoso"`, senão a mutação sobrevivia por vacuidade do fake. Frontend lib, 13 (fuso do navegador, dia em UTC, hoje em UTC, passado incluindo hoje, sem ordenar, sem desempate, id decrescente, duplicar no dia do fim, `RangeError` engolido, fim inválido ignorado, mensagem repetindo o valor, fim sem data, tipo desconhecido). Frontend componente, 22 (tipo omitido ou só por cor, `<details>` aberto, passados fora do `<details>`, sem "(hoje)", sem `role="alert"`, sem `aria-busy`, botão sem `disabled`, erro e resultado não limpos, caminhos errados, sem `Authorization`, `Content-Type` JSON, `RangeError` engolido, eco do corpo, seção não renderizada, sem `dateTime`, sem descrição, 200 sem lista aceito, vazio sem mensagem). Mais uma no axe: remover o `htmlFor` do label da seção derruba 18 testes de `Agenda.acessibilidade`.

**Verificação em banco real local.** `verify-rotas-agenda.ts` estendido, 24/24 PASS no SQL Server local (`localhost:14330`, `DATABASE_URL` só no comando): idoso lê a própria agenda com ordem e instantes exatos (milissegundos) após a ida e volta no `datetime2`, evento que atravessa a meia-noite volta intacto, cuidador sem nenhuma flag e familiar com `modo_decisao` `'idoso'` leem com corpo igual ao do idoso, pendente, recusado e sem vínculo dão 403, acesso cruzado entre idosos, cuidador em `GET /agenda` dá 403; contagens de `Evento` (0 antes, 4 durante, 0 depois), `Usuario` (25) e `Vinculo` (6) iguais antes e depois, nenhuma conta residual, 0 bytes de sentinela em stdout e stderr. Nada rodado no Azure.

**Limitações aceitas.** Sem paginação, filtro, edição, exclusão nem notificação; sem refresh automático da lista depois de criar compromisso; cuidador e familiar veem compromissos pessoais; contraste de cor segue no item 9.1; nada visto no navegador.

**Continua com o Marcos:** avisar Laureane e Jennifer (contrato novo: `GET /agenda`, `GET /agenda/idoso/:idosoId`, `lib/agendaPorDia.ts` e a seção nova de `Agenda.tsx`); registrar PR e hashes depois do merge; contraste de cor no item 9.1.

**Item 7.1 da Fase 7 (RF-018) implementado: registrar refeição ou plano alimentar, idoso ou familiar, nunca cuidador (2026-10-05, branch `development`; commits e PR ainda não feitos ao registrar esta entrada, completar hashes e PR depois do merge):**

Decisões D1 a D12 fechadas por Claude sob delegação explícita do Marcos em 2026-10-05. Linha de base real antes de mexer: backend 33 suítes e 1535 testes, frontend 23 arquivos (1 pulado) e 347 passando de 350 (igual ao declarado no plano). Nenhuma migration, CHECK, dependência nova nem mudança em `schema.prisma`, middlewares, `errorHandler`, `vinculo.ts`, `saude.ts`, `remedios.ts`, `agenda.ts` ou `historicoPdf.ts`: o modelo `RegistroAlimentar` já existia. Código novo: `backend/src/routes/alimentacao.ts`, `backend/src/testSupport/alimentacaoCasosCorpo.ts`, `backend/scripts/verify-rotas-alimentacao.ts`, `frontend/src/pages/Alimentacao.tsx`; `app.ts` e `App.tsx` ganharam só o registro da rota.

**D1, rotas.** `POST /alimentacao` (idoso, própria alimentação) e `POST /alimentacao/idoso/:idosoId` (`requireAuth` e `requireVinculoAprovado("idosoId")`), montadas com `app.use('/alimentacao', alimentacaoRouter)`. A rota por vínculo não tem ramo de sucesso para cuidador: ele só recebe 403 de ator.

**D2, ator na rota do idoso.** 403 se `tipo_perfil` não for `idoso` (ou o `Usuario` não for achado), lido por `usuario.findUnique` com `select` mínimo.

**D3, ator na rota por vínculo.** Sucesso só com `tipo_vinculo === 'familiar'` E `tipo_perfil === 'familiar'` E `resolverModoDecisao(vinculo.idoso_id) === 'familiar'`, sempre pelo resolver (honra transferência vencida; `NULL` vale `'idoso'`). Extensão deliberada: o texto literal do 7.1 não cita `modo_decisao`; vale a regra do grupo de 4.2b, 5.1, 5.2 e 6.1. Qualquer familiar aprovado que cumpra isso cria, cada um com a própria autoria.

**D4, cuidador.** 403 sempre, com qualquer vínculo (aprovado, pendente, recusado) e qualquer combinação das flags `permite_*`, inclusive as 3 em `true`. As flags não são lidas em lugar nenhum da rota. A checagem de ator vem antes do resolver e o `&&` faz curto-circuito: o resolver nunca é chamado para cuidador. 403 genérico e fixo, "Sem permissão para registrar refeição.", que nunca cita flag, `modo_decisao`, motivo nem o valor enviado.

**D5, whitelist.** Só `refeicao`, `descricao` e `data_hora` vão ao `create`; o resto do corpo é ignorado. O servidor define `idoso_id` (de `req.usuarioId` ou do vínculo, nunca de path, query ou body), `registrado_por_id = req.usuarioId` e `editado_por_id = null`, e não passa `created_at` nem `updated_at` ao Prisma.

**D6, `refeicao`.** Obrigatória, string, valor exato (caixa e espaço contam) entre `cafe_manha`, `lanche_manha`, `almoco`, `lanche_tarde`, `jantar` e `ceia`; qualquer outro valor dá 400 "refeicao inválida.". As migrations foram conferidas antes: não existe CHECK sobre `RegistroAlimentar.refeicao` (só `NVARCHAR(50) NOT NULL` na migration inicial), então valeu a lista de D6, validada só na aplicação, sem migration.

**D7, `descricao`.** Obrigatória (o ER marca "Sim"), string, `trim`, 1 a 500 caracteres após o `trim`; vazia, só espaços, não string, `null`, ausente ou acima de 500 dá 400 "descricao inválida.".

**D8, `data_hora`.** Obrigatória, ISO 8601 com `Z` ou offset (regex `ISO_COM_FUSO` replicada de `agenda.ts`, sem refatorar) e conferência de dia real de calendário por ida e volta (o `Date` do Node rola `2026-02-30` para março). Sem fuso, dia inexistente, não string ou ausente dá 400 "data_hora inválida.". Passado e futuro aceitos, sem limite (o item cobre plano alimentar). Grava o instante UTC exato (`09:00-03:00` vira `12:00Z`).

**D9, uma entidade.** Refeição e plano alimentar são o mesmo `RegistroAlimentar`; nenhum campo, tipo ou tabela para plano.

**D10, ordem de erros.** Idoso: 401, 403 (perfil), 400 (corpo), 201. Por vínculo: 401, 400 (`idosoId`, do middleware), 403 (vínculo), 403 (ator ou `modo_decisao`), 400 (corpo), 201. Dentro do corpo: `refeicao`, `descricao`, `data_hora`. Não autorizado com corpo inválido responde 403, nunca 400.

**D11, resposta 201.** Objeto plano via `serializarRegistroAlimentar`: `id`, `idoso_id`, `registrado_por_id`, `refeicao`, `descricao`, `data_hora` (ISO UTC), `editado_por_id`, `created_at`, `updated_at`. Só ids, sem nome de autor.

**D12, privacidade (RNF-001 por analogia).** `descricao` pode revelar dieta e, por tabela, condição de saúde: tratada como dado sensível. Mensagens de erro fixas que nunca repetem o valor enviado, nenhum `console.*` novo, `errorHandler` intocado, nada de `DEBUG` nem `PRISMA_*`. Os dois handlers async têm `try/catch` com `next(e)`.

**Testes (TDD).** `alimentacao.test.ts` (86, rota do idoso) e `alimentacaoVinculado.test.ts` (181, rota por vínculo e casos de corpo compartilhados por `describe.each` sobre as duas rotas, vindos de `testSupport/alimentacaoCasosCorpo.ts`). RED: 85 de 86 e 180 de 181, tudo por 404 (um indireto: o `create` nunca era chamado); só o controle positivo da captura de logs passava. Cobertura: cuidador com as 3 flags em `true` (caso do plano, com controle positivo de que o vínculo foi achado e o 403 é de ator), as 8 combinações de flags, cada flag sozinha, vínculo pendente, recusado e inexistente, `modo_decisao` `'familiar'` real no idoso, corpo válido e inválido (sempre 403), `POST /alimentacao` também 403; em todos, nenhuma linha criada e o resolver não chamado. Vínculo e perfil inconsistentes nos dois sentidos. Familiar: matriz com resolver mockado (`'idoso'` 403, `'familiar'` 201, `null` 403), resolver real com `NULL`, `'idoso'`, `'familiar'`, transferência vencida (201) e em curso (403); dois familiares com autoria própria; acesso cruzado com controle positivo. Corpo: limites 500 e 501 (com e sem `trim`), 500 acentuados, caixa, espaço, acento em `refeicao`, dia inexistente (30/02, 31/04, 29/02 de ano comum), 29/02 de ano bissexto aceito, sem fuso, offset sem dois-pontos, instante exato com offset e milissegundos, passado e futuro; mensagem exata por campo e ordem entre campos. Campos forjados no body, `idoso_id` no path e na query nunca vencem o do token ou do vínculo (mock que ignora o `where`). Privacidade: falha injetada em `vinculo.findFirst`, `usuario.findUnique` e `registroAlimentar.create` com 5 tipos de erro, 500 exato, sentinela ausente do corpo, headers, `console.*`, stdout e stderr, com controle positivo da captura. Fakes de Prisma filtram pelo `where`. Frontend: `Alimentacao.test.tsx` (23) e `Alimentacao.acessibilidade.test.tsx` (7); RED com módulo inexistente e depois com stub vazio, 27 de 30 falhando (passavam os 2 controles positivos do axe e o axe do estado inicial sobre página vazia).

**Mutações locais, todas derrubadas e revertidas (aplicadas com `// @ts-nocheck`; mutante que não compila dá "0 total" e não prova nada).** Backend, 36: cuidador autorizado por qualquer flag, só por `permite_criar_evento_cuidado` e sem checar flags; remover `tipo_vinculo`; remover `tipo_perfil`; resolver chamado antes do ator (para cuidador); resolver ignorado; resolver chamado e ignorado; `modo_decisao` lido da coluna; `idoso_id` do body, do path e da query; `registrado_por_id` e `editado_por_id` do body; `editado_por_id` diferente de null; spread do corpo no `create`; `created_at` do corpo e do servidor passado ao Prisma; whitelist de `refeicao` removida; caixa e espaço de `refeicao` relaxados; limite 501; `trim` removido; descrição vazia aceita; data sem fuso aceita; dia real removido; passado recusado; futuro recusado; `refeicao` validada depois de `descricao`; corpo validado antes de autorizar (nas duas rotas); idoso sem checar perfil; 403 citando o motivo; 403 e 400 repetindo o valor enviado; 400 virando 422. Frontend, 24: caminho sempre `/alimentacao`, caminho por vínculo errado, `idoso_id` no corpo, `htmlFor` dos 4 campos, `role="status"` e `role="alert"` ausentes, `aria-busy` ausente, botão sem `disabled`, erro e sucesso anteriores não limpos, data sem `toISOString`, select com valor fora da lista e com caixa diferente, sem `Content-Type`, sem `Authorization`, eco da mensagem do servidor e do erro de rede, log da descrição, descrição sem `maxLength`, não obrigatória e virando `input`.

**Frontend (esqueleto cru, só para o Marcos testar).** `Alimentacao.tsx` em `/alimentacao`, protegida por `RotaProtegida` como `/agenda`. Uma seção "Registrar refeição": id do idoso (vazio usa `POST /alimentacao`; preenchido usa `POST /alimentacao/idoso/:id`, com o id só no caminho), select com os 6 valores e rótulos em português, `textarea` de descrição (obrigatória, `maxLength` 500), data e hora (`datetime-local`) enviada com `toISOString()`. `fetch` direto (não `chamarApi`, que repassa o corpo do erro), com `Authorization` e `Content-Type: application/json`, e mensagens fixas por status (400, 401, 403 e genérica para o resto e para falha de rede). `label` com `htmlFor`, botão com `disabled` e `aria-busy`, `Spinner`, `role="status"`, `role="alert"`, mensagem anterior limpa ao reenviar. Sem listagem (é o 7.2); o frontend não sabe quem é cuidador e o 403 vira mensagem (limitação aceita).

**Script de verificação.** `backend/scripts/verify-rotas-alimentacao.ts` (rota, Prisma e banco reais; só o token Firebase substituído; recusa rodar fora de `localhost`; limpeza por sentinela no `finally`; prefixo `verify-alim-`). Executado no SQL Server local (`localhost:14330`, `DATABASE_URL` só no comando): 14 de 14 PASS. Idoso cria e a linha existe com `idoso_id`, `registrado_por_id`, `refeicao` e `editado_por_id` null; `09:00-03:00` lido de volta como `12:00Z`; descrição de 500 caracteres com acentos cabe em `nvarchar(500)` e volta idêntica; familiar com `modo_decisao` `'idoso'` leva 403 sem linha e com `'familiar'` cria com a própria autoria; cuidador com as 3 flags leva 403 nas duas rotas sem linha; familiar com vínculo pendente leva 403; `Almoco` e 30/02 levam 400 sem linha; `RegistroAlimentar` 0 antes, 3 durante e 0 depois; `Usuario` (25) e `Vinculo` (6) iguais antes e depois; nenhuma conta residual; 0 ocorrência da sentinela em stdout e stderr. Nada rodado no Azure.

**Suítes ao fim.** Backend 35 suítes e 1802 testes (antes 33 e 1535, mais 267); frontend 25 arquivos (1 pulado) e 377 passando de 380 (antes 23 e 347 de 350, mais 30). `tsc` e lint limpos nos dois pacotes.

**Limitações aceitas.** Sem idempotência, sem checagem de sobreposição, sem paginação, sem leitura ou histórico (é o 7.2), edição, exclusão nem notificação; `refeicao` fechada em 6 valores só na aplicação (sem CHECK); contraste de cor segue no item 9.1; nada visto no navegador.

**Continua com o Marcos:** avisar Laureane e Jennifer (contrato novo: `POST /alimentacao`, `POST /alimentacao/idoso/:idosoId` e `Alimentacao.tsx`); registrar no ER que `RegistroAlimentar.refeicao` é fechada nos 6 valores; registrar PR e hashes depois do merge.

**Item 7.2 da Fase 7 (RF-019) implementado: visualizar o histórico alimentar, cuidador sem depender de flag (2026-10-05, branch `development`; commits e PR ainda não feitos ao registrar esta entrada, completar hashes e PR depois do merge):**

Decisões D1 a D13 fechadas por Claude sob delegação explícita do Marcos em 2026-10-05; a D15 (renomear a referência ao ER no `CLAUDE.md`) foi anulada pelo Marcos: o repo tem `docs/Elder Web - Modelagem ER.md` com hífen, só o cofre Obsidian tem o nome sem hífen. Linha de base real antes de mexer: backend 35 suítes e 1802 testes, frontend 25 arquivos (1 pulado) e 377 passando de 380 (igual ao declarado). Nenhuma migration, CHECK, dependência nova nem mudança em `schema.prisma`, middlewares, `errorHandler`, `vinculo.ts`, `saude.ts`, `remedios.ts`, `agenda.ts`, `historicoPdf.ts` ou no POST do 7.1; a matriz compartilhada não foi alterada. Fonte da regra: `Elder Web - Modelagem ER.md` diz que alimentação nunca é configurável por vínculo e que o cuidador só visualiza.

**Rotas e autorização (D1, D2, D5, D6).** Em `backend/src/routes/alimentacao.ts`: `GET /alimentacao` (idoso lê o próprio: 401, 403 se `tipo_perfil` não for `idoso`, 200) e `GET /alimentacao/idoso/:idosoId` (`requireAuth` e `requireVinculoAprovado("idosoId")`: 401, 400 de `idosoId` pelo middleware, 403 de vínculo, 200). Vínculo aprovado basta: o cuidador lê com qualquer combinação das 3 flags `permite_*` (inclusive todas `false`), o familiar lê com qualquer `modo_decisao` (`'idoso'`, `'familiar'` ou `NULL`), e nem as flags nem `modo_decisao` são lidos; `resolverModoDecisao` nunca é chamado. O idoso da consulta vem de `req.vinculoAprovado.idoso_id` ou de `req.usuarioId`, nunca de path, query ou body. O ramo sem `req.vinculoAprovado` responde 403 explícito. O 403 de perfil usa a mensagem fixa "Sem permissão para visualizar alimentação.".

**Resposta e consulta (D3, D4).** 200 `{ registros }`, cada item por `serializarRegistroAlimentar` (só ids de autor e editor, sem nome), lista vazia 200 `{ registros: [] }`. Uma única `prisma.registroAlimentar.findMany` com só `where: { idoso_id }` e `orderBy: [{ data_hora: "desc" }, { id: "desc" }]`, sem paginação, filtro, limite, `include` nem seleção por refeição; passado e plano futuro entram.

**Privacidade (D7).** `descricao` tratada como dado sensível (RNF-001 por analogia): nenhum `console.*` novo, `errorHandler` intocado, mensagens fixas. Os dois handlers têm `try/catch` com `next(e)`.

**Testes (TDD).** `backend/src/routes/alimentacaoLeitura.test.ts` novo, 88 testes, no molde de `agendaLeitura.test.ts`: matriz `matrizAcessoLeitura.ts` (16 casos) por `it.each` nas duas rotas; caso nomeado do critério de pronto ("cuidador com vínculo aprovado e as 3 flags false vê o histórico alimentar (200)"), as 8 combinações de flags e "sem vínculo, 403"; cuidador pendente, recusado e só do idoso B, com flags `false` e `true`, sempre 403 sem linha lida; `modo_decisao` `'idoso'`, `'familiar'` e `NULL` na coluna, para familiar e idoso; `afterEach` que exige o resolver nunca chamado; forma exata da resposta; argumentos exatos da `findMany`; ordem com empate e entrada embaralhada, sem mutar a fixture; passado e futuro; milissegundos; paridade entre atores; origem do idoso (path, query e corpo forjados); acesso cruzado com controle positivo (fake de `registroAlimentar.findMany` que filtra de verdade pelo `where`); ordem de erros 401, 400, 403, 200; 403 literal; ramo defensivo; privacidade com falha injetada em `usuario.findUnique`, `vinculo.findFirst` e `registroAlimentar.findMany`, 5 tipos de erro, sem sentinela no corpo, headers, `console.*`, stdout e stderr. RED: 87 de 88, todos pelo 404 da rota inexistente (79 por status, 8 indiretos: corpo sem `registros` ou `findMany` não chamado); passava só o controle positivo da captura.

**Mutações no backend (30, todas derrubadas, aplicadas em cópia com `// @ts-nocheck` e revertidas; nenhuma por timeout).** Testes falhando, de 88: M1 exigir `permite_registrar_saude` 27; M2 exigir as 3 flags 30; M3 exigir `permite_criar_evento_cuidado` só do cuidador 13; M4 ler `modo_decisao` da coluna para o familiar 11; M5 ler `modo_decisao` e barrar só `'idoso'` 9; M6 resolver exigido para o familiar 14; M7 resolver chamado e ignorado com erro engolido (rota por vínculo) 33, todas pelo `afterEach` do resolver, sem mudança de status; M8 idem na rota própria 27; M9 sem filtro `idoso_id` 32; M10 filtro extra só passado 4; M11 `idoso_id` do path 1; M12 da query na rota por vínculo 1; M13 da query na rota própria 1; M14 do corpo na rota própria 1; M15 do corpo na rota por vínculo 1; M16 ordem crescente 25; M17 sem desempate por `id` 1; M18 desempate por `id` crescente 23; M19 `take: 3` 1; M20 sem `requireVinculoAprovado` 52; M21 sem checagem de perfil 6; M22 aceitar cuidador na rota própria 4; M23 campo extra no serializer 1; M24 nome do autor na leitura 1; M25 403 de perfil citando flag 6; M26 403 repetindo o valor enviado 1; M27 `console.log` com a descrição 1; M28 sem `try/catch` na rota por vínculo 5; M29 sem `try/catch` na rota própria 11; M30 sem o ramo defensivo 1. M19 só é pego por um teste (o que exige os argumentos exatos da `findMany`), porque o fake não aplica `take`.

**Problemas do harness de mutação (achados e corrigidos durante o item).** (a) O harness gravava o mutante a partir do arquivo original em CRLF, então as mutações de várias linhas não casavam e viravam no-op: na primeira rodada M9 (sem filtro `idoso_id`) "sobreviveu", o que é impossível. Aplicada à mão, M9 derrubava a suíte; correção: gravar a partir da versão normalizada em LF e conferir no disco que a mutação chegou. (b) M28 (sem `try/catch`) deixou o Jest pendurado por cerca de 37 minutos (handles abertos depois da rejeição não tratada); o processo foi encerrado, o arquivo restaurado e conferido por sha1, e o harness passou a rodar com `--forceExit` e timeout de processo por mutante. (c) A checagem nova de aplicação deu falso alarme em M8, M19 e M27, cujo trecho novo contém o original; ajustada e as três rodaram. A normalização para LF vale só para a cópia mutada: arquivos reais não tiveram fim de linha alterado (um `sed -i` no passo do `verify` tinha deixado a cópia de trabalho de `verify-rotas-alimentacao.ts` em LF; o CRLF foi restaurado, índice sempre em LF).

**Script de verificação (D13).** `backend/scripts/verify-rotas-alimentacao.ts` estendido, não reescrito: 10 cenários novos, 24/24 PASS no SQL Server local (`localhost:14330`, `DATABASE_URL` só no comando; antes de rodar, conferido que o script recusa um host que não seja `localhost`). Idoso lê o próprio com 6 registros na ordem do banco; três registros com o mesmo `data_hora` vêm consecutivos por `id` decrescente (desempate feito pelo banco real); milissegundos voltam exatos do `datetime2` (`12:34:56.789Z`, `23:59:59.987Z`), plano futuro primeiro e passado por último; cuidador aprovado com as 3 flags `false` e familiar com `modo_decisao` `'idoso'` recebem corpo idêntico ao do idoso; cuidador pendente 403; acesso cruzado entre dois idosos e familiar de A pedindo B 403; idoso sem registro 200 `{ registros: [] }`; cuidador em `GET /alimentacao` 403 com a mensagem fixa; leituras não criam nem apagam registro. `RegistroAlimentar` 0 antes e depois, `Usuario` 25 e `Vinculo` 6 iguais antes e depois, nenhuma conta residual, 0 ocorrência da sentinela em stdout e stderr. O container `elder_web-db-1` estava parado (Exited 137) ao começar; foi subido com `docker compose up -d db` e parado com `docker compose stop db` ao fim (que também termina em Exited 137, então o estado anterior provavelmente era só um stop normal). Nada rodado no Azure.

**Frontend (D10 a D12, esqueleto cru, só para o Marcos testar; tela final da Laureane e da Jennifer).** `frontend/src/lib/alimentacaoFormato.ts` novo: `formatarDataHora(iso)` com `Intl.DateTimeFormat` em `timeZone: 'America/Sao_Paulo'` e `hourCycle: 'h23'`, formato `dd/mm/aaaa HH:MM`; `rotuloRefeicao(valor)` por `Object.hasOwn` sobre os 6 valores. As duas lançam `RangeError` com mensagem fixa que não repete o valor. Seção "Ver histórico alimentar" em `Alimentacao.tsx`, sempre visível, sem rota nova: `fetch` direto (não `chamarApi`) com `method: 'GET'` e só `Authorization`, sem `Content-Type`; lista plana na ordem recebida, cada item com o rótulo em `<strong>`, `<time dateTime>` com o ISO recebido e o texto em São Paulo, e a descrição; todos os itens são formatados antes de exibir. A lista não atualiza sozinha depois de registrar (D12).

**Textos fixos do frontend, para a Laureane e a Jennifer.** Região e título: "Ver histórico alimentar". Label do campo: "Id do idoso para ver o histórico (vazio = meu histórico)". Botão: "Ver histórico alimentar"; durante o envio, "Carregando..." com `disabled` e `aria-busy`. Status (`role="status"`): "Carregando o histórico alimentar...", "Nenhuma refeição registrada." e "N registro(s) encontrado(s).". Erros (`role="alert"`): 400 "Id de idoso inválido."; 401 "Sessão expirada. Entre novamente."; 403 "Você não tem permissão para ver este histórico alimentar."; qualquer outro status, 200 sem `registros` e falha de rede "Não foi possível carregar o histórico alimentar."; refeição desconhecida ou data inválida num registro "Não foi possível exibir o histórico alimentar.". Rótulos de refeição: `cafe_manha` "Café da manhã", `lanche_manha` "Lanche da manhã", `almoco` "Almoço", `lanche_tarde` "Lanche da tarde", `jantar` "Jantar", `ceia` "Ceia". Exceções da lib: "Data inválida no histórico alimentar." e "Refeição desconhecida no histórico alimentar.".

**Contrato HTTP novo.** `GET /alimentacao` (idoso) e `GET /alimentacao/idoso/:idosoId` (cuidador ou familiar com vínculo aprovado), ambos com `Authorization: Bearer <ID Token>`, sem corpo. 200 `{ registros: [{ id, idoso_id, registrado_por_id, refeicao, descricao, data_hora, editado_por_id, created_at, updated_at }] }`, por `data_hora` e `id` decrescentes; 400 `idosoId` inválido; 401 sem token ou token inválido; 403 perfil errado na rota própria ("Sem permissão para visualizar alimentação.") ou sem vínculo aprovado ("Vínculo aprovado não encontrado para este idoso."); 500 `{ error: "Erro interno." }`.

**Testes do frontend.** `alimentacaoFormato.test.ts` novo (34): matriz de fusos `UTC`, `America/Sao_Paulo`, `Asia/Tokyo` e `Pacific/Kiritimati` em processo `node` filho com `TZ` real e controle da hora local (Node 22.18 ou superior; CI e `.nvmrc` em 24), bordas `02:59:59.999Z` e `03:00:00.000Z`, virada de ano, offset, futuro e passado, 6 rótulos, `RangeError` para 3 datas inválidas e 9 refeições desconhecidas (caixa, espaço, `__proto__`, `toString`, `constructor`). `Alimentacao.test.tsx` ganhou 22 (de 23 para 45): caminho conforme o campo, headers exatamente `{ Authorization }`, `chamarApi` nunca chamado, ordem recebida, rótulo em texto, `<time dateTime>`, carregando, vazio, erros 400, 401, 403, 404, 500, 503 e rede, mensagem limpa ao reenviar, 200 sem `registros`, `RangeError`, nada em `console.*`, seção do 7.1 intacta e lista sem refresh automático. `Alimentacao.acessibilidade.test.tsx` ganhou 7 (de 7 para 14): inicial, carregando, sucesso com itens, vazio, erro 403 e 400, e controle positivo (sem o `for` do label o `jest-axe` acusa `label`); contraste desligado (item 9.1). RED: a lib não carregava (`Cannot find module './alimentacaoFormato'`, único erro do `tsc -p tsconfig.test.json`) e as 29 falhas da página eram todas "região Ver histórico alimentar inexistente"; os 30 testes do 7.1 seguiam passando.

**Mutações no frontend (24, todas derrubadas, mesmo harness corrigido; nenhuma por timeout).** Testes falhando, de 93: F1 caminho errado com id preenchido 1; F2 caminho errado no próprio 1; F3 `Content-Type` presente 2; F4 ordem invertida no cliente 2; F5 reordenar por data crescente no cliente 1; F6 `<time>` sem `dateTime` 1; F7 `role="alert"` ausente 13; F8 `role="status"` ausente no vazio e na contagem 5; F9 `role="status"` ausente no carregando 2; F10 `aria-busy` ausente 3; F11 mensagem de erro não limpa ao reenviar 2; F12 lista anterior não limpa ao reenviar 1; F13 fuso do navegador (lib sem `timeZone`) 3, os fusos UTC, Tóquio e Kiritimati da matriz; F14 rótulo errado 3; F15 `htmlFor` removido 33; F16 mensagem de status do vazio trocada 6; F17 mensagem do 403 trocada 1; F18 botão sem `disabled` 1; F19 rótulo por objeto comum, sem `Object.hasOwn` 3; F20 rótulo pelo operador `in` 3; F21 `chamarApi` no lugar de `fetch` 19; F22 dia e mês trocados 12; F23 `RangeError` não tratado 2; F24 corpo do erro ecoado 6.

**Observação sem correção.** O comentário de cabeçalho de `backend/src/testSupport/matrizAcessoLeitura.ts` cita só os itens 4.4, 5.3 e 5.4 e as suítes de saúde, remédios e PDF, mas a matriz já é consumida também por `agendaLeitura.test.ts` (6.3) e agora por `alimentacaoLeitura.test.ts` (7.2). Ficou como está porque a matriz não pode ser alterada neste item.

**Fim de linha.** Não há `.gitattributes` no repo; `core.autocrlf=true` vem do `gitconfig` de sistema do Git for Windows nesta máquina. O índice guarda LF; os arquivos editados seguem em CRLF na cópia de trabalho e os 3 novos estão em LF, sem diferença no diff (idêntico com e sem `--ignore-cr-at-eol`).

**Suítes ao fim.** Backend 36 suítes e 1890 testes (antes 35 e 1802, mais 88); frontend 26 arquivos (1 pulado) e 440 passando de 443 (antes 25 e 377 de 380, mais 63). `tsc` (backend; frontend `tsc -b` e `typecheck:test`) e lint limpos nos dois pacotes.

**Limitações aceitas.** Sem paginação, filtro, edição, exclusão nem notificação; a lista não atualiza sozinha depois de registrar; a seção não conhece o perfil (o 403 vira mensagem); um registro com `refeicao` desconhecida ou data inválida derruba a lista inteira no esqueleto (`refeicao` não tem CHECK no banco); M19 só é pego por um teste porque o fake não aplica `take`; contraste de cor segue no item 9.1; nada visto no navegador.

**Continua com o Marcos:** avisar Laureane e Jennifer (contrato novo: `GET /alimentacao`, `GET /alimentacao/idoso/:idosoId`, `lib/alimentacaoFormato.ts` e a seção nova de `Alimentacao.tsx`, com os textos fixos acima); commits e PR; registrar PR e hashes depois do merge.

## Item 8.1 — Página "Sobre Nós" pública (RF-029)

Decisões D0 a D8 fechadas por Claude sob delegação explícita do Marcos em 2026-10-06 ("decisão do grupo").

- **D0.** Conferido antes de codar: nenhuma branch, commit ou código com `SobreNos` ou `sobre-nos`. Branch `development`, árvore limpa.
- **D1.** Backend intocado. Esqueleto cru de frontend com conteúdo provisório; tela é da Laureane e da Jennifer. Único arquivo existente editado: `App.tsx` (import e uma rota).
- **D2.** Rota `/sobre-nos`, pública, fora de `RotaProtegida`. Arquivo `frontend/src/pages/SobreNos.tsx`. Não usa `useAuthUser` nem contexto de foto.
- **D3.** Cabeçalho próprio com 2 links ("Voltar para a página inicial" para `/`; "Entrar ou criar conta" para `/welcome`), `<main>` com um `<h1>` e 5 `<section aria-labelledby>` com `<h2>`. Sem `Header`, `Sidebar`, `Navbar` ou `Footer` existentes.
- **D4.** Texto só com fatos do CLAUDE.md e do TCC; acessibilidade em tom de intenção ("buscamos"); equipe só com primeiros nomes; sem instituição, contato, número ou link externo.
- **D5.** `text-lg` no corpo, alvos `min-h-[44px]`, foco visível. Texto de corpo e links em `#071A38` sobre fundo claro; roxo da marca só em borda, fundo sem texto e h1/h2 grandes e em negrito. As outras páginas não definem `document.title`, então não foi adicionado.
- **D6.** `components/landing/*` intocado: a página não tem link de entrada a partir da landing (pendência da Laureane).
- **D7.** Só testes do 8.1.
- **D8.** Este registro; no CLAUDE.md, 2 linhas.

**Testes.** `SobreNos.test.tsx` (h1 e main únicos, 5 h2 e regiões, 2 links com href, termos proibidos ausentes), `App.sobreNos.test.tsx` (`<App />` real em `BrowserRouter` com `pushState('/sobre-nos')`, sem usuário e com usuário; pathname mantido), `SobreNos.acessibilidade.test.tsx` (jest-axe, `color-contrast` desligado; h1 afirmado à mão porque `page-has-heading-one` não roda via jest-axe).

**Mutações locais (revertidas, `git diff` limpo).** M1 (rota dentro de `RotaProtegida`): cai o teste "sem usuário" de `App.sobreNos`. M2 (`/welcome` para `/login`): cai o teste do link em `SobreNos.test`. M3 (sem `<h1>`): caem `SobreNos.test`, `SobreNos.acessibilidade` e os 2 de `App.sobreNos`. Na primeira versão do T3, M3 não derrubava o axe; corrigido com a asserção do h1.

**Suítes.** Frontend 26 arquivos e 388 testes (0 pulados) antes; 29 arquivos e 396 testes depois (mais 8). `tsc --noEmit`, `typecheck:test`, lint e build limpos. Backend não rodado (não tocado).

**Limitações aceitas.** Contraste de cor segue no item 9.1; nada visto no navegador; texto e layout provisórios.

**Continua com o Marcos:** avisar Laureane e Jennifer (página nova provisória e rota em `App.tsx`); link de entrada na landing é da Laureane; atualizar no Obsidian o Acompanhamento 8.1 e a tabela de Testes do 8.1; PR #139 mergeado em `main` por rebase: `a36b35c` (feat) e `73173f8` (docs).

## Item 8.2 e teste 8.x — Orientações Gerais (RF-031) e navegação Landing/Welcome

Decisões D0 a D14 fechadas por Claude sob delegação explícita do Marcos em 2026-10-06 ("decisão do grupo").

- **D0.** Nenhuma página, rota ou teste de Orientações em branches, commits ou código. O único `orientacoes` no `frontend/src` era o `navigate("/orientacoes")` do `Sidebar` (PR #140). Branch `development`, árvore limpa. Linha de base: 29 arquivos e 396 testes.
- **D1 e D2.** Backend intocado, sem dependência nova. Esqueleto cru com conteúdo provisório (texto e layout finais: Laureane e Jennifer). Único arquivo existente editado: `App.tsx` (import e uma rota).
- **D3.** Rota `/orientacoes` dentro de `RotaProtegida`. Conteúdo estático: sem `tipo_perfil`, sem vínculo, sem backend, igual para os 3 perfis.
- **D4.** Os esqueletos autenticados não têm cabeçalho comum (`Remedios` usa só `navigate(-1)`); cabeçalho próprio com `Link` para `/Home` ("Voltar para o início") e `/perfil` ("Meu perfil").
- **D5.** h1 "Orientações gerais" e 5 seções com h2: Como começar, Senha e acesso, Perfis e vínculos, O que você encontra no Elder Web, Ajuda e aviso importante. Rótulo da recuperação de senha tirado de `FormularioLogin.tsx`: "Esqueci minha senha". Suporte por `mailto:`; avisos de não enviar informações de saúde por e-mail e de SAMU 192. Sem orientação médica, sem instituição, sem `modo_decisao`.
- **D7.** Constantes de foco e de link duplicadas do `SobreNos.tsx`; `text-lg`, `min-h-[44px]`, foco de 4px, um único `<main>`.
- **D8.** `RotaProtegida` e o texto "Carregando..." intocados.

**Testes.** `Orientacoes.test.tsx` (6), `Orientacoes.acessibilidade.test.tsx` (1, jest-axe com `color-contrast` desligado, h1 à mão) e `App.orientacoes.test.tsx` (3: sem usuário vai para `/login`; com usuário renderiza; auth não resolvida mostra "Carregando..." sem redirecionar, via mock de `onAuthChange` que não chama o callback). RED confirmado antes de implementar (módulo e rota inexistentes). 8.x: `LandingPage.navegacao.test.tsx` (2: "Entrar" e "Criar minha conta" vão para `/welcome`) e `Welcome.navegacao.test.tsx` (4: a `Welcome` renderiza os dois botões duas vezes, layout mobile e desktop, então cada cópia é testada).

**Mutações locais (revertidas à mão).** M1 (rota sem `RotaProtegida`): caem 2 de `App.orientacoes`. M2 (sem h1): caem 1 de `Orientacoes.test`, o axe e 1 de `App.orientacoes`. M3 ("Alexa" numa seção): cai o teste de termos proibidos. M4 (`handleLogin` para `/login`): cai o teste da Navbar. M5 (`handleCadastro` para `/cadastro`): cai o da CTASection. M6 (destinos invertidos em `WelcomeBotoes`): caem os 4 da Welcome. M7 (`href` de suporte trocado): cai o teste do `mailto:`. Na primeira tentativa a M1 gerou JSX inválido (0 testes rodaram) e foi refeita.

**Suítes.** Frontend 29 arquivos e 396 testes antes; 34 arquivos e 412 depois (mais 16). `typecheck:test`, lint e build (`tsc -b` e `vite build`) limpos. Backend não tocado.

**Limitações aceitas.** Conteúdo provisório, sem as ilustrações do guia rápido do TCC (2.9.1 e 2.9.3); o `Sidebar` já aponta para `/orientacoes`; sem link na Home e na landing (telas da Laureane e da Jennifer); contraste de cor segue no item 9.1; nada visto no navegador.

**Observações para a auditoria axe (9.x).** O `Login` renderiza 2 `h1` (`LadoInformativo.tsx` e `FormularioLogin.tsx`) e nenhum dos dois tem classe de breakpoint que o esconda (`hidden`, `md:` ou `lg:`): os dois ficam visíveis ao mesmo tempo, em qualquer largura. A `Welcome` renderiza os botões em duplicata, mas escondida por breakpoint: a seção mobile tem `md:hidden` e a seção desktop (`LandingWelcome`) tem `hidden md:block`, então só uma cópia aparece por largura. No jsdom o Tailwind não é carregado, por isso as duas cópias existem no DOM dos testes.

**PR e hashes.** PR #141, mergeado em `main` em 2026-10-06T13:20:42Z por rebase (`259c195` feat, `4f33d1d` test e `56fcf28` docs; os hashes locais `df66c8f`, `a3f2e85` e `600ce7c` mudaram no rebase). CI do PR verde: backend, frontend e Vercel.

**Continua com o Marcos:** avisar Laureane e Jennifer (página nova provisória, rota em `App.tsx`).

## Item 9.1 — Auditoria de acessibilidade com axe-core (RNF-007)

Decisões D1 a D15 fechadas por Claude sob delegação explícita do Marcos em 2026-10-06 ("decisão do grupo"), mais 3 rodadas de ajuste pedidas por ele.

- **D0.** Branch `development`, árvore limpa. Linha de base: 34 arquivos e 412 testes. `jest-axe@11.0.0` usa `axe-core@4.12.1` (o `3.5.6` listado vem só de `@types/jest-axe`). `@axe-core/playwright` instalado na `4.12.1` (depende de `axe-core ~4.12.1`, uma versão só do axe; a `4.13.0` traria um segundo axe).
- **D1 a D4 (jest-axe).** 9 arquivos `src/pages/*.acessibilidade.test.tsx`, padrão de `Orientacoes.acessibilidade.test.tsx` (const `AXE` com `color-contrast` desligado, h1 à mão): Cadastro (2), Login (2), EsqueciSenha (2), ConfirmarEmail (6 estados), Welcome (2), LandingPage (1), Home (1), Perfil (2) e Vinculos (3). Cadastro, Login e EsqueciSenha afirmam "pelo menos um h1" (há 2). O estado de erro do Cadastro vem do botão Google, porque os radios de perfil são `required` e a validação nativa bloqueia o submit. LandingPage desliga também `heading-order` (moderate), só nesse teste.
- **D5 a D11 (Playwright).** `e2e/acessibilidade-publicas.spec.ts` (7 rotas, `/cadastro` com erro, `/cadastro` com cada perfil selecionado, `/login` com credencial inválida: 12 testes), `e2e/acessibilidade-autenticadas.spec.ts` (8 rotas x 3 perfis, um `test` por perfil com `test.step` por rota e `expect.soft`: o `describe.serial` pulava as rotas seguintes na primeira falha, e um test por rota reiniciaria o worker e criaria contas a mais), `e2e/helpers/axe.ts` e `e2e/helpers/conta.ts`. Script `test:a11y` (`playwright test acessibilidade`). Variantes: desktop claro (1280x800), mobile (390x844) e desktop escuro (só onde há `BotaoTema`). Falha só em critical e serious; tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` e `best-practice`; nenhuma regra desligada. O helper desliga transições CSS antes de auditar (cor intermediária de `transition-colors` dava falso positivo). Privacidade: imprime só id, impacto, `target`, contagem e `helpUrl` (e cores e razão no `color-contrast`, motivo e seletor nos `incomplete`), nunca `node.html`. Trava: `exigirBancoLocal()` lança erro se `MSSQL_SA_PASSWORD` não estiver definida (o backend cairia no `.env` do Azure). `playwright.config.ts` não foi alterado e segue com esse risco de fallback; o config reaproveita o servidor da porta 3000, então conferir que ela está livre antes de rodar.
- **Ambiente.** O container `elder_web-db-1` estava parado; subido com `docker compose up -d db`. `prisma migrate status` com `DATABASE_URL` local: 7 migrations, schema em dia. Nada tocou o Azure; backend intocado. Contas Firebase `e2e-*@e2e.elderweb.test` criadas nos testes: 18, sem limpeza.
- **Correções (só critical/serious, troca de classe de cor).** `#6C63FF` sólido em `text-` e `bg-` (97 + 25 ocorrências, 45 arquivos) passou a `#5F56EC` (4,32:1 para 5,21:1 sobre branco, 4,65:1 sobre `#F3F0FF`). Hover (`hover:bg`, `hover:text`, `dark:hover:bg` com texto branco) passou a `#554CD8` (6,16:1; 24 trocas mais `FormularioCadastro` 3,62:1, `Navbar` 3,07:1 e `WelcomeBotoes` 2,54:1). Outros: `slate-500` para `slate-600` e `#858594` para `#8A8A99` nos textos de 9px do `Sidebar` e em "Hoje"; "ou" do `FormularioLogin` de `gray-400` para `gray-500`; `dark:bg` dos botões de `#817AFF`/`#7C74FF`/`#6C63FF` para `#5F56EC`; link do `FormularioEsqueciSenha` ganhou `dark:text-[#A89FFF]`; numeral decorativo de `ComoFuncionaSection` virou `::before` com `aria-hidden` (axe não exclui `aria-hidden` do contraste).
- **`incomplete` de contraste, por pior caso.** Home: gradientes dos 4 `ActionCards` (emerald 700→800, `#5F56EC`→`#5149D8`, blue 600→700, orange 700→800), `BannerSaude` (`#554CD8`/`#5A52E0`/`#6259EF`), avatar do `Header` (`#5F56EC`→`#554CD8`) e descrição/subtítulo de `text-white/80` para `text-white` (todos acima de 4,9:1). `HeroSection`: pixels reais das folhas decorativas lidos no Chromium; badge `#554CD8` e `dark:#EDEBFF`, chips `gray-700`/`dark:gray-200`, descrição do card `gray-600`/`dark:gray-300`. Resolvidos sem mudança: botão "Voltar" sobre `folhaInformativo.png` (13,43 e 14,47), emojis `nonBmp`, `.px-12 > p` do Perfil (7,56).

**Testes.** Frontend 34 arquivos e 412 testes antes; 43 arquivos e 433 depois (mais 21). `npm run test:a11y`: 15 passando. `typecheck:test`, lint e build limpos. Mutações locais (revertidas à mão): `aria-label` do `BotaoTema` removido faz Welcome e Home falharem com `button-name`; `text-gray-300` em `SobreNos` falha no Playwright com `color-contrast` (1,47). Remover o `htmlFor` do `CampoLogin` NÃO foi detectado pelo axe (o `placeholder` já serve de nome acessível). O e2e da rodada 3 (3 trocas de hover no escuro) não rodou: hover não é coberto pelo axe.

**Limitações aceitas.** `moderate`: `heading-order` na landing (h1 vai direto a h3 nos cards da `HeroSection`), não corrigido. 2 `h1` por tela em Cadastro, Login e EsqueciSenha (um do `LadoInformativo`, outro do `Formulario*`), não corrigido. `incomplete` seguem indecidíveis para o axe (gradiente, imagem, emoji), com análise de pior caso acima. Textos de 9px no `Sidebar` (linhas 210 e 271) e de 10px e 11px em `Header`, `ResumoDia` e `CardAjuda`, não alterados. 38 `focus:ring-`/`focus-visible:ring-` com opacidade (`/15` a `/70`) só listados, sem calcular 3:1. A análise dos gradientes assume os valores do Tailwind e a posição do texto estimada pelo layout, não é medição no navegador. O axe cobre só parte do WCAG; sem teste com leitor de tela, só teclado ou usuários reais. O e2e não roda no CI.

**PR e hashes.** PR #143, mergeado em `main` em 2026-10-06T18:59:56Z por rebase (`gh pr view 143`: MERGED). Hashes em `main`, de `git log` e conferidos no remoto (`main` idêntico a `df1ac10`; os demais são ancestrais): `af29bc7` (test jest-axe), `0aa3996` (test Playwright), `c8189f3`, `cdba455` e `70670d3` (fix de contraste) e `df1ac10` (docs). Os hashes `4e1656f`, `f18ad7a`, `3ab488a`, `96c99a0`, `cf291cc` e `6d435d1`, que este registro citava como locais, são os do PR antes do rebase e não existem em `main`.

**Continua com o Marcos:** avisar Laureane e Jennifer (cores em ~50 arquivos de tela; a Home fica visivelmente mais escura, em especial o laranja) e levar ao grupo os itens de limitação acima.

## Item 9.2: TLS em trânsito e criptografia em repouso (RNF-002)

**Status: concluído em 2026-10-06.** PR #145 mergeado e smoke pós-deploy com 6 de 6 PASS (detalhes abaixo).

Decisões D1 a D10 fechadas pelo grupo (Marcos, por delegação). O prompt original só definia D1 a D9; a D10 foi acrescentada pelo Marcos depois (abaixo). Critério do plano: "Conexão à API só aceita HTTPS em ambiente não-local; banco no Azure configurado com TDE ou equivalente".

- **D0.** Branch `development`, árvore limpa. Linha de base: 36 suítes e 1890 testes no backend; `CLAUDE.md` com 29.411 bytes. `scripts/` fica fora do `tsc` (`include: ["src"]`) e roda por `tsx`, como os `verify-*`.
- **D1.** Banco é Azure SQL Database, confirmado por `SERVERPROPERTY('EngineEdition')` igual a 5. **D2.** TDE com chave gerenciada pelo serviço; só verificado, nunca alterado. **D3.** Redirect de HTTP para HTTPS é do Render: sem `trust proxy` e sem redirect no código.
- **D4.** HSTS `Strict-Transport-Security: max-age=31536000` (sem `includeSubDomains`, sem `preload`), só com `NODE_ENV=production`, lido a cada requisição, primeiro `app.use` de `app.ts` (`middleware/hsts.ts`, exporta `HSTS_VALOR` e `hsts`). Ele vem antes do CORS e do `express.json` para sair também em preflight, 400 e 413.
- **D5 a D7.** Sem guarda de boot por `DATABASE_URL`: a checagem é função pura, script e prova de conexão cifrada. Scripts `smoke-*` só leem e nunca imprimem corpo, `DATABASE_URL`, usuário, senha, token nem erro bruto. Sem migration e sem escrita no Azure. **D8.** Frontend intocado; nenhuma URL `http://` não local em configuração de produção do frontend. **D9.** Sem travessão. **D10.** Sem esqueleto de frontend neste item: não há rota nem contrato HTTP novo, nenhum arquivo de tela tocado.

**Código.** `lib/segurancaTransporte.ts` (puro): `avaliarRedirecionamentoHttp` (301, 302, 307 ou 308 para `https://` do mesmo host; `ECONNREFUSED` e `ECONNRESET` valem como recusado; timeout e DNS não provam recusa), `avaliarTls` (TLSv1.2 ou 1.3, certificado autorizado, 14 dias ou mais), `avaliarUrlBanco` (parser do formato JDBC do Prisma com valores entre `{}` e `}}` escapado; devolve só `host`, `encrypt`, `trustServerCertificate`, `ok` e `motivos`, nunca usuário nem senha), `avaliarConexaoCifrada` (só `'TRUE'`), `avaliarTde` (FAIL se `EngineEdition` diferente de 5, `is_encrypted` diferente de 1 ou `encryption_state` diferente de 3). `lib/sondaHttp.ts` (I/O): `sondarHttpPlano` (`fetch` com `redirect: 'manual'`, só status e `Location`, corpo nunca lido) e `sondarTls` (recusa rodar com `NODE_TLS_REJECT_UNAUTHORIZED=0`). `scripts/smoke-https-producao.ts` (C1 redirect, C2 TLS, C3 `/health`, C4 HSTS) e `scripts/smoke-tde-azure.ts` (4 SELECT fixos; host não local só com `--confirmo-azure`). `.env.example` ganhou só um comentário com a forma da `DATABASE_URL` de produção.

**Testes.** `app.hsts.test.ts` (15), `segurancaTransporte.test.ts` (77) e `sondaHttp.test.ts` (11, servidores `http.createServer` em porta efêmera). RED confirmado pelo motivo certo, com stub de assinatura final e comportamento errado (11 de 15, 62 de 76 e 6 de 10 falharam por asserção, não por import). Backend 36 suítes e 1890 testes antes; 39 suítes e 1993 depois (mais 103). Lint e build limpos. Achado no caminho: no Jest o `DOMException` do `AbortSignal.timeout` vem de outro realm, então `instanceof Error` falhava; a sonda reconhece o timeout pelo `name`. Também no teste de CORS: com `origin` fixo, o `cors` devolve sempre a origem configurada e não ecoa a do pedido; o teste afirma isso.

**Mutações (12 de 12 derrubadas).** Aplicadas no próprio arquivo com `// @ts-nocheck`, com backup e restauração conferida por SHA-256 no fim (não em cópia). M1 (`NODE_ENV` invertido): 14 falhas em `app.hsts`. M2 (`max-age` outro): 1. M3 (`hsts` depois do `express.json`): 4. M4 (redirect aceita 200): 1. M5 (outro host): 2. M6 (`http://`): 1. M7 (ignora `trustServerCertificate`): 1. M8 (`encrypt` ausente como `false`): 1. M9 (`encryption_state` 2 como PASS): 1. M10 (aceita `TLSv1.1`): 1. M11 (devolve a senha): 4. M12 (timeout como recusado): 1.

**Execuções.**
- Local (3.3), `smoke-tde-azure.ts` no SQL Server do `docker-compose.yml` (`localhost:14330`, `docker compose down` sem `-v` depois): conexão cifrada PASS; `EngineEdition` 3 e TDE desligado FAIL, como esperado, então o check não passa por vacuidade. Sem `--confirmo-azure` num host não local fictício: não conecta e sai com 1. Login errado no local: texto fixo, 0 ocorrências da senha sentinela.
- Produção (3.4), `smoke-https-producao.ts https://elder-web-backend.onrender.com` (URL achada na memória do projeto, não nos docs do repo), antes do deploy do 9.2: C1 (`/health` e `/usuario/me` em `http://`) PASS com 301 para `https://` do mesmo host; C2 PASS com TLSv1.3 e certificado válido por 74 dias; C3 PASS; C4 FAIL (HSTS ausente em `/health` e em `/usuario/me`, 401), como esperado.
- Azure (3.5), `smoke-tde-azure.ts --confirmo-azure`. **Autorização do Marcos, dada no chat:** leitura pelo `smoke-tde-azure`, escopo exato de 4 SELECT (`EngineEdition`, `is_encrypted`, `sys.dm_database_encryption_keys`, `encrypt_option`) e nenhuma escrita; o Marcos confirmou depois que a autorização cobre também a versão reescrita do script. A 1ª tentativa falhou com "falha na consulta (detalhe omitido)" e **a causa dessa 1ª falha não foi diagnosticada** (o texto fixo escondia o motivo, e o erro não foi reproduzido). O script passou a consultar uma a uma e a mostrar só nome da classe do erro, código do Prisma e número SQL; a reexecução do mesmo escopo deu 3 de 3 PASS: formato da URL, `encrypt_option=TRUE` e TDE ativo (`EngineEdition` 5, `is_encrypted` 1, `encryption_state` 3, protetor `CERTIFICATE_OAEP_256`).
- **CONFIRMADO pelo portal do Azure (Marcos, 2026-10-06):** `encryptor_type = CERTIFICATE_OAEP_256` é chave gerenciada pelo serviço. Até então era inferência: a doc da Microsoft (TDE protector, `sys.dm_database_encryption_keys`) só diz que `certificate` significa chave gerenciada pelo serviço e `asymmetric key` significa Azure Key Vault, e `CERTIFICATE_OAEP_256` não consta nela (foi lido como variante da família `CERTIFICATE` pelo prefixo). A confirmação veio de três telas do portal, vistas pelo Marcos: servidor, Transparent Data Encryption, com "Chave gerenciada pelo serviço" selecionada; banco `elder_web`, Criptografia de Dados, com criptografia ativa e status "Criptografado"; e o resultado do smoke (`is_encrypted` 1, `encryption_state` 3). O tratamento no código continua informativo e não afeta o PASS ou FAIL do TDE.
- Smoke pós-deploy, `smoke-https-producao.ts https://elder-web-backend.onrender.com`, 2026-10-06, só HTTP, uma execução: **6 de 6 PASS**. C1: `http://` em `/health` e em `/usuario/me` dá 301 para `https://` do mesmo host. C2: TLSv1.3, certificado válido por 74 dias. C3: `/health` 200 com `status=ok`. C4: `Strict-Transport-Security: max-age=31536000` em `/health` (200) e em `/usuario/me` (401). O C4 passou de FAIL (pré-deploy) para PASS, o que prova o código novo no ar e `NODE_ENV=production` aplicado no processo. O Render fez o deploy do commit final `520a947`, gerou o `dist` e subiu com "Your service is live", sem erro de boot (visto pelo Marcos no dashboard). O script rodou do checkout local em `58025e7`, de conteúdo idêntico ao `520a947` (`git range-diff`). O Marcos aceitou o resultado e considera o 9.2 concluído.

**Convenção `smoke-*`.** Scripts em `backend/scripts/smoke-*.ts`: só leitura, rodam à mão e não entram no CI; imprimem só status, nome do check, host e PASS/FAIL. Os que tocam banco não local exigem flag explícita e autorização do Marcos naquele momento.

**Limitações aceitas.** `sondarTls` só é exercitado no smoke real: sem certificado de teste no CI e sem dependência nova, o teste automatizado cobre a recusa por `NODE_TLS_REJECT_UNAUTHORIZED=0` e a rejeição com mensagem fixa (só o código, sem o texto bruto) num aperto de mão que falha (servidor HTTP puro; mutação que devolve a mensagem bruta derruba o teste). O caso específico de certificado inválido ou vencido virar FAIL com código fixo (por exemplo `CERT_HAS_EXPIRED`) só é coberto pelo smoke real, e nenhum certificado ruim foi sondado. Os scripts `smoke-*` não têm teste de unidade (a lógica está nos avaliadores testados) e a rede real só é provada nas execuções acima. O redirect de HTTP para HTTPS depende do Render e só é provado pelo smoke. A versão mínima de TLS do servidor Azure (1.2) não é verificável pelos scripts; foi conferida pelo Marcos no portal (abaixo). O smoke pós-deploy já deu 6 de 6 PASS (acima).

**PR e hashes.** PR #145, mergeado em `main` em 2026-10-07T00:36:35Z (2026-10-06 21:36 em Brasília) por rebase. Hashes finais em `main`: `8f0ae4e` (HSTS e avaliadores), `92fd486` (scripts smoke), `0bab6f6` (docs) e `520a947` (docs das pendências). Os locais `76f59a8`, `cedb023`, `25420f7` e `58025e7` mudaram no rebase (mapeamento por `git range-diff`: conteúdo idêntico).

**PR #144 (não faz parte do 9.2).** `0165e20`, mergeado em `main` em 2026-10-07T00:35:10Z, uns 80 segundos antes do #145; 13 arquivos em `frontend/`. Redesenho das páginas Vínculos, Detalhes do Vínculo e Agenda. Alterou `Agenda.tsx`, que era o esqueleto do 6.1 a 6.3, e os testes `Agenda*.test.tsx`.

**Git.** A `development` foi alinhada sem reescrever história e sem force: `git merge --ff-only origin/development` (para `97c1d17`, o merge de `main` que já estava na remota) e merge normal de `origin/main` (`65775ca`). Conteúdo igual ao da `main` (`git diff development origin/main` vazio); `git log origin/main..development` lista 6 commits por causa dos hashes antigos do 9.2 e do merge `97c1d17`.

**Pendências manuais 1 (Azure) e 2 (Render): fechadas em 2026-10-06, com evidência vista pelo Marcos (prints do portal e leitura do dashboard).**
- Azure, servidor `elder-web-sql-marcos`, Segurança, Rede, Conectividade: versão mínima do TLS = TLS 1.2 (print). Servidor, Transparent Data Encryption: "Chave gerenciada pelo serviço" selecionada (print). Banco `elder_web`, Criptografia de Dados: criptografia ativa, status "Criptografado" (print).
- Render, serviço `elder-web-backend`, Environment: `NODE_ENV=production`; `FRONTEND_URL=https://elder-web.vercel.app` (https, sem barra final); não existem `DEBUG` nem `PRISMA_*`. Serviço Live em `main` no commit `df1ac10` (anterior ao 9.2; conferido: `main` era idêntico a `df1ac10`). O Marcos não olhou Secret Files nem grupos de ambiente vinculados: limitação aceita.
- `DATABASE_URL` do Render: o Marcos leu o final em texto, `encrypt=true` e `trustServerCertificate=false`, com host e banco iguais aos do portal. Nenhum outro trecho da URL é registrado.

**Continua com o Marcos:** (i) Render: Secret Files e grupos de ambiente vinculados do `elder-web-backend` ainda não vistos; (ii) avisar Laureane e Jennifer do contrato do 5.4 e do PR #143 (o 9.2 não gerou aviso: sem contrato HTTP novo e sem arquivo de tela); (iii) atualizar o plano no Obsidian com os hashes finais (feito fora do Claude Code).

## Item 9.3: CI builda a imagem Docker do backend (RNF-010)

**Status: concluído em 2026-10-07.** PR #149 mergeado e CI verde, com o passo de build passando no runner. Critério do plano: o pipeline de CI falha se a imagem do backend não buildar, pegando erro de build antes do Render tentar.

Decisões D1 a D9 fechadas pelo grupo (Marcos, Laureane, Jennifer):

- **D0.** Branch `development`, árvore limpa, HEAD `1230de6`. Ambiente igual ao snapshot de `main` (`ci.yml`, `backend/Dockerfile`, `backend/.dockerignore`, `render.yaml` e `.nvmrc` sem divergência material). Linha de base: 39 suítes e 1993 testes no backend; `CLAUDE.md` com 29.148 bytes. Docker Desktop precisou ser aberto pelo Marcos (daemon parado na primeira verificação); servidor Docker 29.8.2.
- **D1.** O passo entra no job `backend` como último passo, depois de `npm run build`. Sem job novo, sem matrix, gatilhos intactos. **D2.** Comando `docker build -t elder-web-backend:ci ./backend` com `working-directory: .` no passo, porque o job tem `defaults.run.working-directory: backend` e sem o override o contexto viraria `backend/backend`.
- **D3.** Sem publicar (`docker push`, `docker login`, `docker/login-action`, `docker/build-push-action` proibidos) e sem `docker run`: o Firebase Admin exige credenciais reais no start e nenhum segredo entra no CI. **D4.** Sem cache de camadas, sem `docker/setup-buildx-action`, sem action nova de terceiros.
- **D5.** `backend/Dockerfile`, `backend/.dockerignore`, `render.yaml`, `package.json` e lockfile não foram alterados. **D6.** A pendência de `pdfjs-dist` (devDependency, `canvas` opcional sem binário) e dos 3 avisos de `npm audit` só de dev (`pdfjs-dist`, `tar`, `@mapbox/node-pre-gyp`) foi encerrada como aceita: sem mudança de dependência e sem `npm audit` no CI (`--omit=dev` dá 0 e o CI não deve depender da base de advisories).
- **D7 a D9.** Testes: contrato em Jest sem biblioteca de YAML, mutação local e prova local de falha do Docker em cópia temporária; sem branch quebrada e sem falha forçada no CI remoto. Sem esqueleto de frontend (item só de infraestrutura, sem rota nem contrato HTTP; ninguém a avisar). Itens 9.4 e as linhas "9.x" do plano intactos.

**Código.** Um passo novo ao fim do job `backend` em `.github/workflows/ci.yml`: nome "Build da imagem Docker do backend", `working-directory: .`, `run: docker build -t elder-web-backend:ci ./backend`. Nada mais mudou no arquivo. O PyYAML não está instalado nesta máquina, então a sintaxe do YAML não foi validada por parser; o teste de contrato lê a estrutura e a validação real é o primeiro CI do PR.

**Testes.** `backend/src/infra/dockerCi.test.ts`, 8 testes de contrato (só `fs` e regex; `REPO_ROOT` por `path.resolve(__dirname, ...)`). T1 passo dentro do job `backend` e ausente do `frontend`; T2 `working-directory: .`; T3 depois do passo `npm run build`; T4 sem `docker push`, `docker login`, `login-action`, `build-push-action` nem `--push`; T5 contexto do build igual ao `dockerContext` do `render.yaml` e `dockerfilePath` existente apontando para `backend/Dockerfile`; T6 `FROM node:24` e `.nvmrc` com major 24 (RNF-008); T7 `.dockerignore` com `node_modules`, `.env`, `.env.*` e `!.env.example`; T8 sem `COPY` nem `ADD` de `.env` no Dockerfile. RED confirmado por asserção: T1, T2, T3 e T5 falharam (4 de 8) antes de o passo existir; GREEN com o passo (8 de 8). Backend: 39 suítes e 1993 testes antes, 40 e 2001 depois; lint e build limpos. O lint apontou `no-regex-spaces` em dois pontos do teste, corrigidos com `{2}`.

**Mutações (7 de 7 derrubadas).** Aplicadas por `sed` no próprio arquivo, com backup e restauração por cópia, conferida por `git diff` (só ficou o passo legítimo). M1 remover o passo: 4 falhas. M2 contexto `./frontend`: 2. M3 apagar `working-directory: .`: 1. M4 acrescentar `--push`: 1. M5 `dockerContext: ./api` no `render.yaml`: 1. M6 `FROM node:22-alpine`: 1. M7 remover `.env` e `.env.*` do `.dockerignore`: 1. As 7 foram rodadas duas vezes (antes e depois da correção de lint), com o mesmo resultado.

**Prova local do Docker.** Linha de base: `docker build -t elder-web-backend:ci-9-3-base ./backend` com exit code 0 em 28 s (imagem removida em seguida). Em cópias temporárias de `backend/` (sem `node_modules`), três quebras, todas com exit code 1: F1 `COPY inexistente.json ./` (`"/inexistente.json": not found`); F2 tag `node:24-alpinee` (`node:24-alpinee: not found`); F3 arquivo `src/erroDeTipo.ts` com `const x: number = "a"` (`error TS2322` no `npm run build` do Dockerfile). Cópias e imagens temporárias removidas.

**Limitações aceitas.** (1) O CI não executa a imagem: pega erro de build, não erro de boot, de variável de ambiente nem de porta do Render. (2) Sem cache de camadas, o tempo do CI aumenta. (3) A tag `node:24-alpine` é flutuante e pode mudar o resultado sem mudança de código. (4) O teste de contrato lê arquivos fora de `backend/`, então só roda no host e no CI, não dentro do container do `docker-compose.yml` (que monta só `./backend`). (5) A prova de falha foi local, não no CI remoto. (6) Arquivos do repositório estão com CRLF no disco e LF no índice (`core.autocrlf=true`); o passo foi acrescentado com CRLF para casar com o arquivo, e o Git normaliza para LF no commit.

**Documentação.** Plano: 9.3 marcado como ✅ (07/10/2026) nas tabelas Acompanhamento e Testes, parágrafo "Item 9.3 implementado" e a frase da linha 40 ("Não builda as imagens Docker") atualizada. `CLAUDE.md`: pendência de `pdfjs-dist` removida, decisão D6 em "Decisões fechadas", resumo do 9.3 em "Itens implementados" e o resumo do 9.2 comprimido (29.119 bytes no fim).

**PR e hashes.** PR #149, mergeado em `main` em 2026-10-07T20:19:58Z (2026-10-07 17:19 em Brasília) por rebase. Hashes finais em `main`: `995bac5` (teste de contrato), `90df423` (passo no `ci.yml`) e `d14f493` (docs). Os locais `fc4675b`, `153ec3f` e `4936609` mudaram no rebase.

**CI do PR.** `backend` pass em 1m14s, `frontend` pass em 1m4s, `Vercel` e `Vercel Preview Comments` pass. Job `backend`: o passo "Build da imagem Docker do backend" rodou depois de `npm run build` e passou (`naming to docker.io/library/elder-web-backend:ci done`, camada final em 3,7 s). Sem diferença de resultado entre o Docker local e o do runner. O `ci.yml` também passou no `actionlint` (imagem `rhysd/actionlint:latest`, removida depois).

**Fora do 9.3, para registro.** O hook `PostToolUse:Edit` que falha com `C:/Users/Marcos: No such file or directory` vem do plugin `render` 0.2.2 (`${CLAUDE_PLUGIN_ROOT}/scripts/validate-render-yaml-hook.sh` sem aspas, caminho com espaço), não de configuração do projeto; causa inferida pelo padrão, não reproduzida. Nenhuma mudança feita.

## Item 9.4 e testes 9.x: suíte de autorização por inventário de rotas, cobertura e migrations (RNF-003)

**Status: implementado em `development` em 2026-10-07; PR #151 aberto para `main`, ainda não mergeado.** O CI remoto rodou em push de `development` (run 37687672235, commit `26df7f2`, https://github.com/MixuriM/Elder_Web/actions/runs/37687672235): `frontend` e `backend` verdes, com os passos `npm run test:coverage`, `npm run build` e "Build da imagem Docker do backend" passando; isso cumpre a D1 e o plano marcou o item e as duas linhas 9.x como ✅. Data do merge e hashes finais entram aqui depois do merge. Critério do plano: a suíte cobre pelo menos 401 sem token, 403 sem vínculo aprovado e 403 sem permissão de Cuidador, e roda em CI a cada push, não só localmente. Cobre também as duas linhas 9.x da tabela de Testes: cobertura mínima com `coverageThreshold` em `routes/` e `middleware/`, e migrations sem aplicação automática.

Decisões D1 a D9 fechadas pelo grupo:

- **D1.** A 9.4 e as duas linhas 9.x só vão a ✅ com todas as tarefas verdes e o CI remoto verde num push em `development`.
- **D2.** Nenhuma dependência nova. Cobertura usa o provider padrão do Jest.
- **D3.** Nenhum código de produção muda, exceto se um teste novo provar furo real de autorização (RED, correção mínima, commit `fix(auth):` separado, aviso ao Marcos). Ordem de 400 e 403 em rota sem permissão não é furo. Resultado: nenhum furo achado, nenhum código de produção alterado.
- **D4.** Frontend, Azure, migrations e scripts `verify-*` e `smoke-*` não foram tocados nem executados. Os testes usam Prisma mockado; um mock não prova o filtro do SQL Server real (limitação aceita, como na seção 2.8.4 do TCC).
- **D5.** `npm test` continua `jest`. Novo script `test:coverage` é `jest --coverage`, e o CI roda `npm run test:coverage` no lugar de `npm test`.
- **D6.** `push` em todas as branches (`["**"]`) mais `pull_request` para `main`, com `concurrency` por workflow e ref (`cancel-in-progress: true`). Execução duplicada em branch com PR aberto é aceita.
- **D7.** Limiares por diretório: metas mínimas `middleware/` 90/90/90/80 e `routes/` 85/85/85/75 (statements, lines, functions, branches); se a medição supera a meta, o limiar é floor(medido) menos 1.
- **D8.** Mutação local substitui o RED onde o teste é de caracterização.
- **D9.** A regra de ator vem do código e do `CLAUDE.md`: cuidador nunca cria medicamento nem refeição; familiar só escreve com `modo_decisao` efetivo `'familiar'` (via `resolverModoDecisao`); cuidador só age com a flag exata, sem que uma flag abra outra; leitura por vínculo aprovado basta.

**Inventário (T1).** Feito por leitura do código e dos nomes de teste (grep), antes da T2. "Lacuna" é falta de teste nomeado para a categoria, não falha encontrada. 40 rotas, 39 não públicas.

| Rota | Middlewares | Regra de ator | Flag | Teste existente (401, 403 vínculo, 403 flag) | Lacuna antes da T2 |
|---|---|---|---|---|---|
| `GET /health` | nenhum | pública | | | nenhuma (sem autorização) |
| `POST /auth/sync` | nenhum (valida o token no handler) | token próprio | | `auth.test.ts` (401, 503) | sem inventário |
| `GET /usuario/me`, `POST /usuario/cadastrar-idoso`, `GET`, `POST` e `DELETE /usuario/me/foto` | `requireAuth` | qualquer perfil, alvo `req.usuarioId` | | `usuario.test.ts`, `usuarioFoto.test.ts` (401) | 403 sem Usuario só no `requireAuth.test.ts` |
| `PATCH /usuario/me`, `PATCH /usuario/me/modo-decisao` | `requireAuth` | titular da conta | | | 401 sem teste nomeado |
| `GET /vinculo`, `POST /vinculo/:id/contestar` | `requireAuth` | por `modo_decisao` | | `vinculoListar.test.ts`, `vinculo.test.ts` (401) | |
| `POST /vinculo/solicitar-cuidador`, `solicitar-familiar`, `:id/aprovar`, `:id/recusar`, `:id/solicitar-transferencia-decisao`, `:id/confirmar-transferencia-decisao`, `PATCH :id/definir-permissoes` | `requireAuth` | por perfil e `modo_decisao` | | `vinculo.test.ts` (403 de ator, sem 401) | 401 sem teste nomeado nas 7 |
| `POST /saude`, `GET /saude`, `GET /historico/pdf`, `POST` e `GET /remedios`, `POST /remedios/:medicamentoId/doses`, `POST` e `GET /agenda`, `POST` e `GET /alimentacao` | `requireAuth` | só idoso | | `saude.test.ts`, `saudeHistorico.test.ts`, `remedios*.test.ts`, `agenda*.test.ts`, `alimentacao*.test.ts`, `historicoPdf.test.ts` (401, 403 de perfil) | |
| `PATCH /saude/:id` | `requireAuth` | dono do registro | | `saudeEdicao.test.ts` (401, 404) | |
| `GET /saude/idoso/:idosoId`, `GET /remedios/idoso/:idosoId`, `GET /agenda/idoso/:idosoId`, `GET /alimentacao/idoso/:idosoId`, `GET /historico/idoso/:idosoId/pdf` | `requireAuth`, `requireVinculoAprovado` | vínculo aprovado basta | nenhuma | `matrizAcessoLeitura.ts` e `*Historico`, `*Leitura`, `historicoPdf.test.ts` (401, 403) | |
| `POST /saude/idoso/:idosoId` | idem | cuidador com flag; familiar com `modo_decisao` | `permite_registrar_saude` | `saudeCuidador.test.ts`, `saudeFamiliar.test.ts` | |
| `PATCH /saude/idoso/:idosoId/:id` | idem | cuidador com flag e autor do registro; familiar com `modo_decisao` | `permite_registrar_saude` | `saudeEdicao.test.ts` | |
| `POST /remedios/idoso/:idosoId` | idem | só familiar com `modo_decisao`; cuidador nunca | nenhuma | `remediosVinculado.test.ts` | |
| `POST /remedios/idoso/:idosoId/:medicamentoId/doses` | idem | cuidador com flag; familiar com `modo_decisao` | `permite_marcar_dose` | `remediosDoseVinculado.test.ts` | |
| `POST /agenda/idoso/:idosoId` | idem | cuidador com flag (só `cuidado`); familiar com `modo_decisao` | `permite_criar_evento_cuidado` | `agendaVinculado.test.ts`, `agendaCuidador.test.ts` | |
| `POST /alimentacao/idoso/:idosoId` | idem | só familiar com `modo_decisao`; cuidador nunca | nenhuma | `alimentacaoVinculado.test.ts` | |

Lacunas transversais, todas fechadas pela T2: nenhum teste garantia que o conjunto de rotas do app é o conjunto classificado (rota nova sem 401, vínculo ou flag passava sem teste); o corpo do 403 de vínculo não era comparado entre sem vínculo, pendente, recusado e vínculo só de outro idoso na mesma rota; a flag errada não era testada rota a rota (uma flag abrir outra); os 401 das 9 rotas de `usuario` e `vinculo` acima.

**O que mudou.** `backend/src/testSupport/rotasApp.ts` enumera as rotas de `app._router.stack` (expande `route.methods`, deriva o prefixo de `layer.regexp` e lança erro se o formato mudar). `backend/src/testSupport/prismaFakeAutorizacao.ts` é o fake de Prisma e Firebase: filtra de verdade pelo `where` (igualdade e `{ in }`, valor `undefined` ignorado como no Prisma, filtro não suportado lança erro), grava as chamadas de escrita e fica carregado por `jest.requireActual` dentro das fábricas de `jest.mock`. `backend/src/routes/autorizacaoRotas.test.ts` tem a tabela `ROTAS_ESPERADAS` (categoria `publica`, `token_proprio`, `autenticada`, `vinculo`, `vinculo_flag` ou `registro_por_id`, mais regra de cuidador e de familiar e corpo mínimo válido) e seis blocos:

- **A. Completude (8 testes).** As rotas do app são exatamente `ROTAS_ESPERADAS`; sem repetição; toda rota não pública tem `requireAuth` como primeiro handler; rota pública e de token próprio não usam `requireAuth`; rota com `:idosoId` tem o handler de vínculo e declara a regra dos dois atores; categoria coerente com a presença de flag.
- **B. Autenticação (39 rotas, até 9 casos cada).** Sem header, `Basic`, `Bearer`, `Bearer ` e `bearer` em minúscula e `Token`: 401; token rejeitado com código `auth/*`: 401; erro sem código `auth/*`: 503; token válido sem Usuario: 403 (menos `POST /auth/sync`, que cria o Usuario). Em todos, zero escrita no Prisma.
- **C. Vínculo (11 rotas com `:idosoId`).** Cuidador e familiar sem vínculo, pendente, recusado e aprovado só do idoso B pedindo o A (com as 3 flags e `modo_decisao` `'familiar'` ligados, para nada além do vínculo causar o 403): 403, corpo idêntico entre os quatro cenários e igual à mensagem do middleware, zero escrita. Idoso com o próprio id: 403. Id não numérico: 400 sem consultar vínculo. Controle positivo com o ator autorizado: 200 ou 201.
- **D. Flag do Cuidador (4 rotas: 4.2, 4.3 por vínculo, 5.2, 6.2).** 3 flags `false`: 403; só as outras duas: 403; cada uma das outras sozinha: 403; corpo inválido sem a flag continua 403 (a autorização vem antes da validação); só a flag certa: passa e escreve uma vez.
- **E. Ator de escrita.** Familiar nas 6 rotas de escrita por vínculo: `modo_decisao` `'idoso'` e `NULL`: 403; `'familiar'`: passa; transferência vencida (coluna `'idoso'`, `modo_decisao_expira_em` no passado) passa pelo resolver; transferência ainda na janela dá 403. Cuidador em medicamento e alimentação: 403 com as 3 flags e `modo_decisao` `'familiar'`, e com cada flag sozinha. Cuidador e familiar nas 10 rotas próprias do idoso: 403 mesmo com vínculo aprovado e tudo ligado; o idoso passa.
- **F. Registro por id (6 testes).** `PATCH /saude/:id` e `PATCH /saude/idoso/:idosoId/:id`: registro inexistente e registro de outro idoso dão o mesmo 404 e o mesmo corpo (idoso, cuidador com flag, familiar com `modo_decisao`); cuidador não edita registro de outro autor (403, depois do 404); cuidador e familiar não editam pela rota própria (404).

**T3, lacunas das Fases 1 e 2** (`vinculo.test.ts`, 11 testes novos): 2.1 `create` rejeitado pelo índice único vira 409 em `solicitar-cuidador` e `solicitar-familiar`, mais controle negativo (erro comum continua 500); 2.2 id não numérico (`abc`, `1.5`, `NaN`, `Infinity`) em `aprovar` e `recusar` dá 400 sem consultar nem escrever; 2.9 `modo_decisao_expira_em` igual a "agora" (`jest.useFakeTimers` com `doNotFake` para tudo menos `Date`, e `jest.setSystemTime`) conta como vencido (`<=`), um milissegundo depois ainda não, um milissegundo antes sim. As demais linhas das tabelas de Testes das Fases 1 e 2 já tinham teste.

**Cobertura (T4).** `jest.config.js` ganhou `collectCoverageFrom` (`src/routes/**/*.ts` e `src/middleware/**/*.ts`, sem `*.test.ts` e sem `testSupport`), `coverageDirectory: 'coverage'` e `coverageThreshold` por diretório. `coverage/` entrou no `.gitignore` e no `ignorePatterns` do ESLint (`backend/.dockerignore` já tinha). Medição antes (commit `64b87e1`, worktree temporário, 40 suítes e 2001 testes): `routes/` 95,71 statements, 92,91 branches, 98,95 functions, 96,25 lines; `middleware/` 100 em tudo. Depois (43 suítes e 2550 testes): `routes/` 96,44, 93,71, 100 e 97,04; `middleware/` 100 em tudo. Como a medição superou as metas, valeu floor(medido) menos 1: `routes/` statements 95, branches 92, functions 99, lines 96; `middleware/` 99 nos quatro. Provado que o limiar derruba: com `statements: 99` o Jest falha com `Coverage for statements (96.44%) does not meet "./src/routes/" threshold (99%)`. Linhas não cobertas em `routes/`, aceitas (ramos defensivos): `vinculo.ts` 35, 75, 90, 166, 216, 299, 390, 475, 498, 522, 544, 568, 583, 641, 655, 694, 724 e 796; `historicoPdf.ts` 91 a 94 (branches 75%); `usuario.ts` 32, 65, 110, 229 e 270; `auth.ts` 148 e 269 a 272; `saude.ts` 46, 199, 206, 251 e 307; `remedios.ts` 36, 184, 275 e 336; `agenda.ts` 48 e 138; `alimentacao.ts` 35 e 98.

**CI (T5).** `.github/workflows/ci.yml`: `push` com `branches: ["**"]`, `pull_request` para `main`, `concurrency` (`group: ${{ github.workflow }}-${{ github.ref }}`, `cancel-in-progress: true`) e, no job `backend`, `npm run test:coverage` no lugar de `npm test` (o job `frontend` não mudou). Nenhum teste dependia da string `npm test` do `ci.yml`. `backend/src/infra/ciAutorizacao.test.ts` (14 testes, só `fs` e regex, helper `testSupport/repoArquivos.ts`): push cobre `development`; push sem `paths`, `branches-ignore` nem `tags`; `pull_request` para `main`; `concurrency`; passo `npm run test:coverage` no job `backend`, antes do `npm run build`; sem `npm test` no job; sem `continue-on-error`, `|| true` nem `|| :`; job sem `secrets.`; `npm test` é `jest` e `test:coverage` é `jest --coverage`; limiares respeitam as metas mínimas; cobertura medida em `routes/` e `middleware/`; sem `.only`, `.skip`, `.todo`, `xit`, `fit` nas suítes de autorização; `ci.yml` é o único workflow. Leitura (sem alterar nada): `gh api repos/MixuriM/Elder_Web/branches/main/protection` mostra `frontend` e `backend` como checks obrigatórios (`strict: true`), `enforce_admins: true`, revisão de PR exigida com 0 aprovações, sem force push; rulesets vazio.

**Migrations (T6).** `backend/src/infra/migrationsSemDeploy.test.ts` (13 testes): `render.yaml` (sem comentários, que citam `migrate deploy`), `backend/Dockerfile`, scripts do `backend/package.json`, `docker-compose.yml` e todos os workflows não contêm `migrate deploy`, `migrate dev`, `migrate reset` nem `db push` (`prisma generate` e `prisma validate` passam); `render.yaml` segue com `dockerCommand: npm start`; controle do próprio detector. Toda `CONSTRAINT <nome> CHECK` (inclusive dentro de `EXEC('...')`, caso da migration da foto de perfil) e todo `CREATE UNIQUE ... INDEX <nome>` de `backend/prisma/migrations` aparece em `verify-constraints.ts` (comentários removidos antes da busca, para um comentário não valer como caso); CHECK sem nome é recusada; 17 constraints achadas (14 CHECK e 3 índices únicos). `LEGADO_SEM_CASO` está vazia (todas as 7 migrations existentes têm caso, linha de base de 07/10/2026) e um teste fixa o tamanho em 0, então a lista não cresce sem edição consciente. `.github/pull_request_template.md` com o checklist (migration nova exige caso e execução local; Azure só com autorização explícita do Marcos; rota nova em `ROTAS_ESPERADAS` e, se for leitura por vínculo, na matriz; contrato HTTP mudou, avisar Laureane e Jennifer; testes e lint).

**Testes.** Backend 40 suítes e 2001 testes antes, 43 e 2550 depois: `autorizacaoRotas.test.ts` 511, `vinculo.test.ts` +11, `ciAutorizacao.test.ts` 14, `migrationsSemDeploy.test.ts` 13. `npm run lint`, `npx tsc --noEmit`, `npm run build` e `npm run test:coverage` limpos, limiares passando.

**Mutações (D8).** 22 de 22 derrubadas, restauradas uma a uma, `git status` limpo no fim. T3 (3): `isDuplicateVinculoConstraint` sem casar (2 testes caem), `<=` vira `<` no resolver (1), checagem de id inteiro removida (5). T7 (19, só as suítes novas): M1 `requireAuth` removido de `GET /alimentacao` (12); M2 `requireVinculoAprovado` removido de `GET /agenda/idoso/:idosoId` (6); M3 403 do middleware vira `next()` (33); M4 rota 4.2 aceita qualquer flag (3); M5 rota 5.2 aceita `permite_registrar_saude` (4); M6 rota 6.2 ignora a flag (5); M7 404 de registro de outro idoso vira 403 (2); M8 cuidador cria medicamento (1; a primeira tentativa não compilou por variável não usada e foi refeita); M9 rota nova sem classificação (1); M10 `development` fora do gatilho de push (1); M11 `migrate deploy` no `render.yaml` (2); M12 migration de teste com CHECK sem caso (1); M16 `ci.yml` volta a `npm test` (2); M17 limiar de statements baixado para 50 (1); M18 `|| true` no passo de cobertura (2); M19 resolver ignora transferência vencida (12); M20 middleware deixa de filtrar `status: "aprovado"` (22); M21 `requireAuth` deixa passar token sem Usuario (35); M22 `paths` no gatilho de push (1).

**Limitações aceitas.** (1) O Prisma é fake em memória: prova o que a rota pergunta ao banco, não o filtro do SQL Server real nem os índices (os `verify-*` cobrem isso, fora do CI). (2) `POST /saude/idoso/:idosoId` e a edição checam `tipo_vinculo` mas não `tipo_perfil` do chamador, enquanto dose, agenda e medicamento checam os dois; hoje não é furo porque `tipo_vinculo` é amarrado ao `tipo_perfil` fixo na criação do vínculo (premissa já registrada no `requireVinculoAprovado`), e nenhum teste novo exerce esse estado inconsistente. (3) O limiar de cobertura é por diretório, não por arquivo: um arquivo pode cair se o resto compensar. (4) Execução duplicada do CI em branch com PR aberto (push e pull_request), e `cancel-in-progress` pode cancelar uma execução em andamento no `main` quando dois pushes chegam seguidos (D6). (5) O contrato de CI e o de migrations leem arquivos fora de `backend/`, então não rodam no container do `docker-compose.yml`. (6) O CI não verifica por si que `frontend` e `backend` são checks obrigatórios; isso é configuração do GitHub, só lida. (7) O CI remoto só rodou uma vez com estas mudanças (push de `development`, run 37687672235); o resultado do `pull_request` do PR #151 entra aqui depois do merge.

**Nenhum furo real de autorização foi encontrado.** Em todos os casos negativos dos blocos B a F a resposta foi o 401, 403 ou 404 esperado, sem escrita no Prisma. Em nenhuma rota de flag o 400 veio antes do 403 (o teste "corpo inválido sem a flag continua 403" passa nas 4 rotas). Código de produção não mudou. Nenhum contrato HTTP mudou: não há aviso novo para Laureane e Jennifer.

**Commits locais (hashes mudam no rebase do merge).** `bb58f0e` suíte de autorização, `d5880cb` lacunas 2.1, 2.2 e 2.9, `6181e47` cobertura, `9a5f030` CI, `6173bdd` migrations e template de PR.

## Ajuste visual da página Alimentação (2026-10-07)

`frontend/src/pages/Alimentacao.tsx` recebeu navegação de retorno e controle de tema, cabeçalho e cartões responsivos no padrão de Agenda/Medicamentos, com a paleta já adotada e estados de sucesso/erro/carregamento adaptados ao tema escuro. Campos, chamadas HTTP, mensagens, semântica acessível e conteúdo do histórico foram preservados. Os testes existentes passaram a renderizar a página dentro de `MemoryRouter`, necessário pelo novo link de navegação. Testes focados de comportamento e acessibilidade: 59/59 passaram.

## Lacunas do backend das telas de vínculo (2026-10-09)

Três lacunas achadas na rodada das telas de vínculo foram fechadas por decisão do Marcos (delegação "decisão do grupo"), sem schema nem migration. (1) **Convite do idoso**: `POST /vinculo/convidar-familiar` em `routes/vinculo.ts`. Só idoso (403 nos demais), e-mail validado (400), 403 se o `modo_decisao` efetivo for `familiar` (quem decide é o familiar, então o idoso não adiciona familiar automático), 400 para o próprio e-mail. Grava `email_convite_familiar` e, se existe conta de familiar com o e-mail, cria `Vinculo` `convite_idoso` `pendente` (promovido no login com e-mail verificado, regra de sempre). Resposta `201 { registrado: true }` igual com ou sem conta (sem oráculo de enumeração); 409 só se o idoso já tem vínculo pendente ou aprovado com essa conta. Limite aceito: a coluna guarda um e-mail só, então um convite novo substitui o anterior ainda não usado. (2) **Aprovar origem automática**: `aprovar` de vínculo pendente `convite_idoso` ou `cadastro_familiar` agora responde 409, depois da checagem de autoridade; `recusar` e `contestar` seguem iguais. Fecha o atalho que dispensava a confirmação de posse do e-mail. (3) **Decisão visível ao familiar**: `GET /vinculo` devolve `decisao { modo, transferencia }` só no vínculo aprovado de familiar do próprio chamador (`null` nos demais); `transferencia` traz `solicitada_por_mim`, `expira_em`, `exige_segunda_confirmacao`, `segunda_confirmacao_feita` e `confirmada_por_mim`, nunca o motivo nem o id de quem pediu. A contagem de familiares aprovados só roda quando há pedido em curso.

Testes: `vinculoConvidarFamiliar.test.ts` (15), `vinculoAprovarAutomatico.test.ts` (6), bloco novo em `vinculoListar.test.ts`, rota nova em `ROTAS_ESPERADAS` de `autorizacaoRotas.test.ts`. Mutação local na checagem de `modo_decisao` do convite derrubou o teste esperado. Backend: 45 suítes, 2586 testes, cobertura acima dos limiares. Frontend: `ConvidarFamiliar`, Aprovar escondido em origem automática, `ModoDecisao` do familiar lendo `decisao` (com fallback para resposta antiga); 76 suítes, 762 testes.

## Item 9.4: merge do PR #151 (2026-10-07)

Fecha o "Status" da entrada do item 9.4, que foi escrita antes do merge. PR #151 mergeado em `main` em 2026-10-07T22:38:43Z (19:38 em Brasília) por rebase. Hashes finais em `main`: `9f891e6` suíte de autorização, `2f1496b` lacunas 2.1, 2.2 e 2.9, `da59c5b` cobertura, `5888ccb` CI, `c1d0043` migrations e template de PR, `93185ba` e `34cacd7` docs, `804eed8` timeout do alert em `Remedios.test.tsx` (flake no CI). Os hashes locais `bb58f0e`, `d5880cb`, `6181e47`, `9a5f030`, `6173bdd`, `26df7f2`, `8fab223` e `ff0776a` mudaram no rebase.

## Seletor de idosos vinculados e PRs do grupo (2026-10-07)

**PR #155** (`development` para `main`, mergeado em 2026-10-08T02:39:32Z por rebase; o PR #154 levou a branch `feat/seletor-idoso` para `development`): `036d9f7` hook `useIdososVinculados` (perfil por `buscarPerfil`, vínculos aprovados de `GET /vinculo`, dedupe por idoso, busca compartilhada com limite de 60 s) e `SeletorIdoso` (sem opção vazia; com 2 ou mais idosos, a tela de escrita exige escolha; regras `envioBloqueado` e `ocultarSecaoDeTerceiros`); `40f9485` troca o campo "ID do idoso" pelo seletor em Saúde, Agenda, Alimentação e Remédios (o idoso não vê o seletor e segue nos endpoints sem id; o modal de medicamento herda o idoso da página); `32be1d5` prop `semTemaEscuro` no seletor de `/alimentacao` (rótulo com contraste 1,08 quando o `<html>` mantinha `dark`). Testes: `SeletorIdoso.test.tsx` (20) e `useIdososVinculados.test.tsx` (10).

**PR #152** (Jennifer, `jennifer` para `main`, mergeado em 2026-10-08T02:50:26Z): `4685974` e `7b8e12c`, links e ajuste visual de `Alimentacao.tsx` (ver a entrada "Ajuste visual da página Alimentação").

**PR #153** (Laureane, `laureane` para `main`, mergeado em 2026-10-08T03:11:42Z): `5d25e59` testes de `ExportarHistorico`, `ce93b64` `baixarPdf` com tratamento de erro e validação da resposta, `67ec7b8` testes de `baixarPdf`; `33218e3` e `939ddd5` (Marcos) corrigem o CI do PR: sem `.env` no CI `VITE_API_URL` ficava indefinida (default passou para `jest.polyfills.cjs`) e o teste de PDF por idoso em `Remedios` esperava `/remedios/historico/idoso/7/pdf`, mas a rota real é `/historico/idoso/7/pdf`.

## Acessibilidade, layout por perfil e telas de vínculo (2026-10-08, PR #156)

PR #156 (`development` para `main`), mergeado em 2026-10-09T02:36:14Z (2026-10-08 23:36 em Brasília) por rebase, 143 arquivos. Hashes em `main`, por lote:

- **Acessibilidade e performance:** `4782f02` `:focus-visible` global opaco (3px), bloco `prefers-reduced-motion`, script inline em `index.html` que aplica `dark` antes do React e `fontFamily.sans` com Atkinson Hyperlegible; `f48c77b` fonte hospedada em `public/fonts` (woff2 400 e 700, subset latin, licença OFL), sem `@import` do Google; `bad3ef1` um `h1` por página, `useTitulo` (`"<Tela> | Elder Web"`), textos de 9 a 12 px subindo para `text-sm`, alvos de 44 px, confirmação de dose sem fechar sozinha; `16e2c99` `React.lazy` e `Suspense` em 14 páginas (JS inicial de 641,40 kB para 435,55 kB) e imagens decorativas com `loading=lazy`; `c3640be` `useFocoModal` (foco preso e devolvido) nos modais de Remédios, `asyncUtilTimeout` de 10 s e `testTimeout` de 30 s no Jest; `468374c` `:where(.dark)` no contorno de foco; `b328497` logo e folhas decorativas em WebP; `3d83334` modal de medicamento sem fechamento automático e limite de erro para chunks.
- **Layout e menu por perfil (decisões D1 a D5 do CLAUDE.md):** `87cd8e4` `/familia` e `/cuidadores` filtram `GET /vinculo` no cliente; `9d0be61` `LayoutAutenticado` único com menu por `NavLink`, skip link e um `main`; `c659d8f` menu e `RotaComVinculo` por perfil e vínculo aprovado, cartão na Home sem vínculo.
- **Telas de vínculo (`components/Vinculos/`):** `b480b30` `ModalVinculo`, `ResumoVinculos` e "Adicionar pessoa" por perfil; `15c2504` `SolicitarVinculo` e `AdicionarPessoa` (mensagens fixas por status; `chamarApi` anexa o status ao erro); `5ffb8a8` `SolicitacoesPendentes` (aprovar, recusar, contestar, aviso de e-mail não confirmado só em origem automática pendente sem `confirmado_em`); `c9c1b34` `PermissoesCuidador` (`role=switch`, rollback se falhar); `f8efdbf` `ModoDecisao`; `d11537b` `CadastrarIdoso` em dois passos com o termo e a tela de conflito do 409.
- **Lacunas do backend:** `b2bc794` (backend) e `a8ea3cb` (frontend) são os commits da entrada "Lacunas do backend das telas de vínculo (2026-10-09)" acima.
- **Docs:** `4d09988`, `b25e5a8`, `c999339`, `b4a3540` e `f773bc5`.

## Telas por perfil com `useAcesso` (2026-10-09, PR #157)

PR #157, mergeado em 2026-10-09T13:22:27Z (10:22 em Brasília) por rebase. `0d3f518` `AcessoProvider` guarda o nome do perfil e expõe `recarregar`, chamado depois de pedir, cadastrar, aprovar, recusar ou contestar vínculo; `/vinculos` leva o cuidador para `/cuidadores`; a marca de recarga do `vite:preloadError` é limpa quando um `import()` de página carrega. `703d410` Saúde e Remédios mostram só a escrita que o perfil pode fazer (cuidador sem "Adicionar medicamento" e com "Marcar dose" só com a flag; 403 vira mensagem fixa). `64e34ae` cada formulário da Agenda só para o seu ator; cuidador não vê "Registrar refeição"; perfil desconhecido mostra tudo (a barreira é o 403). `4c3c2ee` cartão de vínculo sem scroll lateral e na mesma aba. `c4e886c` Perfil sem tema duplicado e com alvos de 44 px, contraste do Sobre Nós. `63adaef` o `test:a11y` vincula idoso, cuidador e familiar pela interface antes de auditar. `ff3f2aa` docs.

## Home com dados reais, avisos e configurações (2026-10-09, PR #158)

PR #158, mergeado em 2026-10-09T16:34:47Z (13:34 em Brasília) por rebase. `e246032` `ResumoDia` com 3 cards reais (compromissos de hoje, últimas medições, medicamentos ativos e doses registradas hoje, dia em `America/Sao_Paulo`), carregando, vazio e erro com mensagem fixa; nunca "faltam doses" nem atraso (sem horário estruturado); `AcessoProvider` busca `/vinculo` também para o idoso e expõe `vinculos` e `modoDecisao`. `602c8b9` busca do `Header` removida (não fazia nada); o sino vira link para `/avisos` com contador; `lib/avisos.ts` (função pura) calcula pedidos que a pessoa pode decidir e compromissos de hoje e amanhã, sem aviso de dose; `AvisosProvider`. `8cd63e8` `/configuracoes` com tema, tamanho do texto e reduzir animações em `lib/preferencias.ts` (classes no `<html>`, mesmas chaves do script de `index.html`, `localStorage` em try/catch); rotas `/avisos` e `/configuracoes` na auditoria axe do Playwright. `080187e` landing fala só em avisos dentro do site. `231258d` CLAUDE.md condensado (28.479 bytes). Testes: `resumoDia.test.ts` (11), `ResumoDia.test.tsx` (8), `avisos.test.ts` (7), `Avisos.test.tsx` (5), `preferencias.test.ts` (10), `Configuracoes.test.tsx` (8), `App.avisosConfiguracoes.test.tsx` (4).

## Calendário da Agenda (2026-10-09, PR #159)

PR #159, mergeado em 2026-10-09T19:39:56Z (16:39 em Brasília) por rebase. `950dc97` `lib/calendario.ts` (grade do mês de domingo a sábado, 4 a 6 semanas; hoje em `America/Sao_Paulo`; navegação por dia e mês; posição do compromisso na visão Dia; textos acessíveis de cada célula; só `Intl` e `Date`, reaproveitando `agruparEventosPorDia` e `diaSP`) e `lerVisaoAgenda`/`salvarVisaoAgenda` em `lib/preferencias.ts` (sem escolha salva, Calendário a partir de 640 px e Lista abaixo). `15670cf` "Ver como: Calendário | Lista"; visão Mês em grid ARIA com roving tabindex (setas, Home, End, PageUp, PageDown), até 3 marcas por tipo por cor e forma e "+N", legenda visível; visão Dia por horário; `CartaoCompromisso` compartilhado; sem rota nova nem biblioteca. `e281b35` card de medicamentos sem prometer horários. `1596c18` erro ao sair da conta com mensagem fixa e nova tentativa. `74ce16a` docs. Testes: `calendario.test.ts` (20) e `Calendario.test.tsx` (14).

## Aviso de emergência, RF novo com número a definir pelo grupo (2026-10-09, PRs #160 e #161)

**PR #160**, mergeado em 2026-10-09T20:31:53Z (17:31 em Brasília) por rebase. `a01eace` (backend) `POST /emergencia/avisar` (`routes/emergencia.ts`, montada em `app.ts`): só idoso (403 para os demais), e-mail aos vínculos aprovados com `Promise.allSettled`, resposta só com contagens e mensagens fixas (200, 502 se falhar para todos, 503 sem configuração, 429 no limite com `Retry-After`); `lib/enviarEmail.ts` é o único ponto do provedor (API HTTPS da Brevo, `fetch` nativo, `AbortSignal.timeout(8000)`, `redirect: "error"`, sem retry, erro só com código `SEM_CONFIGURACAO`, `TIMEOUT`, `REDE` ou `HTTP_<status>`, nunca lê o corpo); variáveis `EMAIL_API_KEY`, `EMAIL_REMETENTE_NOME` e `EMAIL_REMETENTE_ENDERECO` no `.env.example`; rota em `ROTAS_ESPERADAS` (`statusOk` opcional por rota); `scripts/verify-rotas-emergencia.ts` (prefixo `verify-emerg-`). `2393ed8` (frontend) `BotaoAjuda` no `Header`, só para o idoso: diálogo (foco preso, Esc fecha, não fecha ao clicar fora) com `tel:192`, o 192 em texto grande, Bombeiros 193, "Avisar minha família e cuidadores" e o aviso fixo; estados enviando, sucesso ("Avisamos X de Y pessoas."), falha, sem vínculo, limite e indisponível; portal em `document.body` (o `backdrop-blur` do header prendia o `position: fixed`). `9335364` Tipo da Agenda volta ao padrão depois de criar. `b3505f9` docs.

Checagem da documentação oficial da Brevo antes de implementar: remetente em domínio gratuito (gmail.com) não pode ser autenticado e tende a ser recusado ou trocado. A integração ficou isolada e o provedor definitivo ficou em aberto; o remetente exige domínio próprio com SPF e DKIM.

**PR #161**, mergeado em 2026-10-09T21:54:55Z (18:54 em Brasília) por rebase, depois de alerta de segurança (conta criada com o e-mail de outra pessoa receberia o aviso depois de aprovada). `46bd425` só recebe quem tem, no Firebase, o mesmo e-mail do cadastro e verificado (`auth.getUsers` em chamada única); erro do Firebase dá 503 e ninguém recebe (falha fechada, log com código `VERIFICACAO_EMAIL`); resposta com `nao_confirmados`; o teto de 5 por hora conta toda tentativa, a espera de 2 minutos só vale após envio com sucesso e um envio em curso bloqueia o segundo pedido. `5571ec9` diálogo mostra quantos não confirmaram; perfil com mais de 3 s ou falha deixa no cabeçalho só o link "Ligar 192", para qualquer pessoa autenticada. `e148fe2` `ModalVinculo` sem `<header>` (`landmark-no-duplicate-banner`). `59a5070` Agenda limpa todos os campos depois de criar. `bc524e7` as 3 variáveis `EMAIL_*` em `render.yaml` com `sync: false`. `dd1d323` docs. Vermelho do botão `#B42318` (claro) e `#D92D20` (escuro, 4,83:1 no texto e 3,64:1 contra o cabeçalho).

Testes: `emergencia.test.ts` (24, Prisma fake que filtra pelo `where`, `getUsers` mockado, `Date.now` controlado), `enviarEmail.test.ts` (7, `fetch` mockado), `BotaoAjuda.test.tsx` (18), `Header.test.tsx` (18); `verify-rotas-emergencia.ts` 8/8 PASS no SQL Server local com Firebase e `fetch` mockados. Mutações locais derrubaram os testes esperados; duas sobreviveram de início ("envio em curso bloqueia" e a guarda `tipoPerfil === null`) e os testes foram reforçados. Nenhum e-mail real foi enviado. Sem migration, sem tabela de histórico de acionamentos. Limites aceitos: limite em memória zera quando o servidor reinicia; Render free dorme e o primeiro aviso pode demorar; e-mail pode cair em spam.

## Confirmação de e-mail dos 3 perfis (2026-10-09, PR #162)

PR #162, mergeado em 2026-10-09T22:34:50Z (19:34 em Brasília) por rebase. Motivo: o aviso de emergência só vai para e-mail verificado, e o cadastro do cuidador não pedia a confirmação nem havia caminho para reenviar. `aee553f` `Cadastro.tsx` (e-mail e senha ou Google) pede a confirmação do Firebase aos 3 perfis; falha no envio não derruba o cadastro e a `Welcome` avisa ("Não conseguimos enviar o e-mail de confirmação agora.", mais "Você pode pedir de novo em Meu Perfil." para cuidador e familiar); o erro não é logado; `emailConfirmado()` em `lib/auth.ts` recarrega o usuário (sem rede, fica com o valor que tinha). `b70c002` `components/perfil/SituacaoEmail.tsx` no Perfil, só cuidador e familiar: "E-mail confirmado" ou o aviso de que sem confirmar não recebe o aviso de emergência; "Reenviar e-mail de confirmação" e "Já confirmei", desativados durante o envio; `auth/too-many-requests` vira "Aguarde alguns minutos para pedir de novo."; demais erros, mensagem fixa. `698317a` docs (CLAUDE.md com 28.972 bytes). Testes: `SituacaoEmail.test.tsx` (9, Firebase mockado, nenhum `console.*`), casos novos em `Cadastro`, `Welcome`, `auth`, `Perfil` e `Perfil.acessibilidade`.

Contagem na `development` (mesma árvore da `main` depois do #162), medida em 2026-10-09: backend 47 suítes e 2629 testes; frontend 91 suítes e 940 testes. Contagens intermediárias por PR não foram remedidas aqui.

**Continua com o Marcos:** domínio próprio e provedor de e-mail com SPF e DKIM; os 3 `EMAIL_*` no painel do Render; teste real com o próprio e-mail; numerar o RF novo; avisar Laureane e Jennifer (contrato `nao_confirmados`, `Header`, `ModalVinculo`, `Agenda`, `Cadastro`, `Welcome`, `Perfil`); cuidadores e familiares cadastrados antes do #162 precisam confirmar o e-mail no Perfil; apagar as contas `e2e-*@e2e.elderweb.test` do Firebase.
