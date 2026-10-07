## O que muda

<!-- Resumo curto: o que foi feito e por quê. Cite o item do plano (por exemplo, 9.4) e o RF ou RNF. -->

## Checklist

### Migrations

- [ ] Não há migration nova neste PR.
- [ ] Se há migration nova: o `backend/scripts/verify-constraints.ts` ganhou o caso de cada CHECK e de cada índice único novo, e o script foi executado no SQL Server local (`localhost:14330`, com `DATABASE_URL` sobrescrita no comando, nunca no `.env`).
- [ ] Nenhuma migration foi aplicada no Azure de produção por este PR. Aplicar no Azure só com autorização explícita do Marcos, a cada migration, e à mão, de uma máquina local, antes do deploy.
- [ ] O `render.yaml` e o `backend/Dockerfile` continuam sem `migrate deploy`, `migrate dev`, `migrate reset` nem `db push`.

### Rotas e autorização

- [ ] Não há rota nova neste PR.
- [ ] Se há rota nova: ela entrou em `ROTAS_ESPERADAS` (`backend/src/routes/autorizacaoRotas.test.ts`) com a categoria e a regra de ator corretas.
- [ ] Se a rota nova é de leitura por vínculo aprovado: ela entrou também em `backend/src/testSupport/matrizAcessoLeitura.ts`.
- [ ] O idoso alvo vem de `req.vinculoAprovado.idoso_id`, nunca do path nem do corpo, e a autoria nunca vem do corpo.

### Grupo

- [ ] O contrato HTTP não mudou. Se mudou, avisar a Laureane e a Jennifer (nova rota, campo novo, status novo).
- [ ] Nenhum arquivo de tela da Laureane ou da Jennifer foi alterado sem aviso.

### Verificação

- [ ] `npm run test:coverage` rodou no `backend/` e passou, com os limiares de cobertura.
- [ ] `npm run lint` e `npx tsc --noEmit` rodaram sem erro no pacote alterado.
- [ ] Nenhum `console.*`, log ou corpo de erro novo carrega dado de saúde.
