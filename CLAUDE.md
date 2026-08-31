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

## Arquitetura de autenticação (Firebase Auth + SQL Server)
Decisão travada — não reabrir sem discutir com o grupo.

- `firebase_uid` **não** é chave primária em nenhuma tabela. É uma coluna
  `UNIQUE, NOT NULL` na tabela `Usuario`, que tem seu próprio `id` interno
  (PK). Todo o resto do banco referencia `Usuario.id`, nunca `firebase_uid`
  diretamente — isola a dependência do Firebase numa única coluna.
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
(Preencher assim que os `package.json` existirem — não invente comandos antes
de rodar o scaffold real.)
- Frontend dev: `npm run dev` (dentro de `frontend/`)
- Backend dev: `npm run dev` (dentro de `backend/`)
- Testes: `npm test` em cada pacote

## Code Style
- TypeScript em modo estrito (frontend e backend)
- React funcional com Hooks, componentes pequenos e de responsabilidade única
- Tailwind CSS utility-first
- Prisma schema como fonte única de verdade do modelo de dados
- Fontes grandes, alto contraste, áreas de toque generosas, feedback claro
  após cada ação — não é opcional, é requisito de projeto

## Workflow
- Planejar a estrutura antes de criar múltiplos arquivos/componentes de uma vez
- Pode criar pastas e arquivos livremente durante o scaffold inicial
- **Sempre pedir confirmação antes de**: `git init`, `git remote add`,
  `git push`, e qualquer instalação de dependência (`npm install` etc.)
- Este projeto desativa o link de sessão (`Claude-Session:`) em mensagens de
  commit via `attribution.sessionUrl: false` em `.claude/settings.json`
  (escopo de projeto, já commitado). Não reverter essa configuração nem
  substituí-la por uma versão só pessoal (`~/.claude/settings.json`) — o
  objetivo é valer pra todo o grupo e para sessões cloud/web também.
- Nunca inserir dados fake sem sinalizar claramente que são fake
- Não reaproveitar nenhum código do protótipo antigo — só olhar como referência

## Lacunas em aberto — NÃO decidir sozinho, perguntar ao grupo
- Estrutura de pastas acima (`frontend/` + `backend/` monorepo) foi assumida
  por mim — não foi validada pelo grupo. Se vocês preferirem repositórios
  separados, isso muda o `docker-compose.yml` e o CI.
- Risco de colisão de e-mail entre contas: sem registro de mitigação
  encontrado no `Elder Web - Modelagem ER.md` até a REV.9. (O que existe lá é
  outra coisa: `email` opcional + índice único filtrado, para permitir idoso
  sem e-mail próprio cadastrado pelo familiar — não trata colisão.) Não
  presumir resolvido nem tratar como bloqueante sem confirmar com o grupo.

**Riscos aceitos conscientemente (não é pendência técnica):** consentimento
do idoso quando a conta é criada por um familiar, e perda progressiva de
capacidade do idoso após autocadastro. O grupo decidiu não mitigar
tecnicamente além de certo ponto — ver `Elder Web - Modelagem ER.md` seção 5.2
para o raciocínio completo.

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
