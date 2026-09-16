---
name: atualizar-claude-md
description: Use esta skill sempre que um item do plano de desenvolvimento do Elder Web (ex: Fase 2, item 2.4) tiver sido implementado E mergeado em main, para registrar o "Detalhe da implementação X.Y" no CLAUDE.md deste repositório, seguindo exatamente o formato das entradas já existentes (2.1, 2.2, 2.3, fluxo auth/sync, fix de CORS, etc). Aciona quando o usuário disser algo como "documenta isso no CLAUDE.md", "registra a implementação do item X.Y", "atualiza o CLAUDE.md com o que a gente acabou de mergear", ou mencionar explicitamente que um PR foi mergeado e pedir pra deixar isso registrado. NÃO usar antes do PR estar de fato mergeado em main — dados como número de PR, hash de commit e nome de migration precisam ser reais, nunca inventados nem deixados como placeholder. Se o merge ainda não aconteceu, informe isso ao usuário e não escreva a entrada.
allowed-tools: Read, Grep, Bash, Edit
---

# Atualizar CLAUDE.md — Detalhe de implementação de item do plano

## Quando NÃO agir
Se o usuário pedir isso mas o PR relevante ainda não foi mergeado em `main` (confira com
`git log main --oneline -5` e/ou `gh pr view <numero>` se o CLI `gh` estiver disponível),
pare e diga isso explicitamente. Não escreva a entrada com placeholder tipo `PR #XX` ou
`[hash]` — isso viola o próprio propósito do arquivo, que é ser fonte de verdade factual.

## Passo 1 — Descobrir o item do plano
Se o usuário não disser explicitamente qual item (ex: "2.4"), pergunte. Depois, leia a nota
do Obsidian relevante (`Elder Web - Plano de Desenvolvimento.md`, via Obsidian MCP se
disponível nesta sessão) na seção "Fases detalhadas" pra confirmar o texto exato da tarefa, o
RF/RNF associado e o critério de pronto — não confie de memória no que já foi discutido em
conversas anteriores.

## Passo 2 — Coletar os dados reais, investigando antes de perguntar
Antes de pedir qualquer coisa ao usuário, tente descobrir sozinho via ferramentas:
- **Hash(es) de commit e PR**: `git log --oneline <branch>` desde o último merge conhecido, e
  `gh pr list --state merged --limit 5` (se `gh` existir) pra confirmar número de PR e se foi
  squash/rebase/merge normal (isso muda se o hash final é o mesmo do commit local).
- **Nome da migration**: `ls backend/prisma/migrations/` ordenado por data, pegue a mais
  recente relevante ao item.
- **Contagem de testes**: rode `npm test` dentro de `backend/` (ou `frontend/`, se aplicável)
  e leia o resumo final (quantos testes no arquivo novo, quantos na suíte inteira).
- **Data de conclusão**: data do commit de merge (`git log -1 --format=%cd <hash>`), não a
  data de hoje se elas divergirem.

Só pergunte ao usuário o que você genuinamente não consegue descobrir sozinho pelas
ferramentas acima — tipicamente: decisões de design tomadas durante a implementação que não
aparecem em mensagem de commit nem em código de forma óbvia (ex: "por que optou por não criar
CHECK constraint aqui"), e qualquer coisa que pareça ambígua ou incompleta.

## Passo 3 — Escrever a entrada
Leia o CLAUDE.md inteiro primeiro (não edite às cegas) e identifique:
1. Onde fica a tabela/lista "Decisões fechadas" — se o item concluído estiver listado lá como
   pendente ou não mencionado, atualize a linha correspondente.
2. O padrão exato dos parágrafos "Detalhe da implementação X.Y (data)" já existentes — mesmo
   nível de detalhe técnico, mesmo estilo de escrita (direto, com nomes de arquivo e função
   reais entre crases, sem adjetivo vago tipo "implementação robusta").

Escreva a entrada nova nesse mesmo formato e nível de detalhe. Não resuma demais — números
concretos (contagem de testes, nome exato de migration, hash) são o ponto principal da
entrada, não um detalhe dispensável. Não reescreva, reformate ou encurte nenhuma entrada
existente — só adicione a nova, no lugar certo (ordem cronológica/lógica das seções já
existentes).

## Passo 4 — Confirmar antes de gravar
Mostre o texto final da entrada pro usuário antes de gravar no arquivo, especialmente se
algum dos dados do Passo 2 ficou incompleto, teve que ser assumido, ou pareceu inconsistente
com algo já escrito no CLAUDE.md (ex: uma decisão anterior documentada que parece conflitar
com o que foi implementado agora). Só grave depois da confirmação.

## Regras fixas (não reabrir)
- Nunca invente número de PR, hash de commit, nome de migration ou contagem de testes — se
  não conseguir confirmar um desses, pare e pergunte, não estime.
- Nunca marque um item como concluído na tabela de acompanhamento se ele não foi de fato
  mergeado em `main`.
- Esta skill só documenta o que já foi implementado — não implementa, não sugere código, não
  reabre decisão de produto já fechada.
