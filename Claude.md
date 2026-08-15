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
- **Banco de dados:** SQL Server (usuários, saúde, medicação — ver lacuna
  sobre a tabela de instituição)
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
- Vínculo cuidador↔idoso é uma tabela própria, não uma coluna em `Usuario`:

```
Vinculo
  id
  cuidador_id   (FK -> Usuario.id)
  idoso_id      (FK -> Usuario.id)
  status        (enum: 'pendente' | 'aprovado' | 'recusado')
  criado_em
```

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
- Nunca inserir dados fake sem sinalizar claramente que são fake
- Não reaproveitar nenhum código do protótipo antigo — só olhar como referência

## Lacunas em aberto — NÃO decidir sozinho, perguntar ao grupo
- **A tabela `Instituicao` ainda faz sentido?** Ela vem da stack original,
  que pressupunha um sistema ILPI ligado a uma instituição real. Sem uma
  instituição-cliente definida, decidir: (a) remover o conceito de
  instituição do modelo, (b) manter como campo opcional/genérico pra uso
  futuro, ou (c) outra coisa. Isso muda o schema do Prisma.
- **Quem aprova o vínculo cuidador↔idoso na tabela `Vinculo`?** Sem uma
  instituição real como stakeholder, os candidatos ficam entre: o próprio
  idoso, o familiar, ou uma aprovação automática/sem gatekeeper. Decisão de
  produto do grupo, não técnica.
- Função do microfone: manter, remover ou redefinir o propósito?
- Estrutura de pastas acima (`frontend/` + `backend/` monorepo) foi assumida
  por mim — não foi validada pelo grupo. Se vocês preferirem repositórios
  separados, isso muda o `docker-compose.yml` e o CI.