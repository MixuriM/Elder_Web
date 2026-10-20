# Checklist de segurança de produção

Itens que o código não prova sozinho: ficam com o Marcos, nos painéis de cada serviço. Criado no endurecimento de
segurança de 2026-10-14 (ver `docs/historico-implementacao.md`). "Não verificado" quer dizer que nenhum comando desta
rodada provou o item; troque para "verificado em AAAA-MM-DD" quando conferir.

| Item | Onde | Como verificar | Estado |
| --- | --- | --- | --- |
| 1. Usuário da aplicação no banco só com `db_datareader` e `db_datawriter`; admin só para migrar | Azure SQL e variável `DATABASE_URL` do Render | No SSMS, conectado ao banco de produção: `SELECT dp.name, r.name FROM sys.database_role_members m JOIN sys.database_principals r ON m.role_principal_id = r.principal_id JOIN sys.database_principals dp ON m.member_principal_id = dp.principal_id;` e conferir que o usuário da `DATABASE_URL` do Render só aparece nesses dois papéis. | FEITO em 2026-10-15. Evidência: usuário `elder_app` (`db_datareader` e `db_datawriter`) criado; `CREATE TABLE` negado em teste; consulta em `sys.dm_exec_sessions` mostrou as conexões do backend como `elder_app`; INSERT e UPDATE testados pela tela. Roteiro em `docs/azure-usuario-minimo.md` |
| 2. Firewall sem regra aberta 0.0.0.0 a 255.255.255.255; só IPs de saída do Render e o IP do Marcos para migration; sem "Allow Azure services" se não for preciso | Azure Portal, servidor SQL, Networking | Listar as regras. Os IPs de saída do Render ficam no painel do serviço (Connect, Outbound). Se o site perder o banco (P1001), ver as seções de recuperação em `docs/azure-usuario-minimo.md`. | FEITO em 2026-10-15. Evidência: regra aberta 0.0.0.0 a 255.255.255.255 removida e "Permitir serviços do Azure" desmarcado; ficaram `render-1` (74.220.48.0 a 74.220.48.255), `render-2` (74.220.56.0 a 74.220.56.255) e o IP de casa do desenvolvedor; depois disso o site gravou um registro e o Editor de Consultas funcionou. Seções "Firewall do Azure", "Se o site perder o banco" e "Se o seu IP mudar" em `docs/azure-usuario-minimo.md` |
| 3. Retenção do backup point-in-time conferida e uma restauração de teste num banco descartável | Azure Portal, banco, Backups | Ver a retenção configurada e restaurar um ponto no tempo para um banco novo; conferir que abre e apagar o banco restaurado. | não verificado |
| 4. Secret Files e grupos de ambiente vinculados revistos; sem `DEBUG` nem `PRISMA_*`; `TRUST_PROXY_SALTOS` conferido | Render, serviço `elder-web-backend`, Environment | Abrir Environment, Secret Files e Environment Groups. Nenhuma variável `DEBUG` ou começando com `PRISMA_`. `TRUST_PROXY_SALTOS` igual a `3`, o valor do item 5 (também declarado no `render.yaml`). | não verificado (o `TRUST_PROXY_SALTOS` = 3 foi posto no painel em 2026-10-15) |
| 5. `trust proxy` lê o IP do cliente, não o do proxy | Produção, PowerShell, duas redes diferentes | Roteiro e resultado em "Teste do trust proxy (item 5)", abaixo. Valor correto no Render: `TRUST_PROXY_SALTOS` = 3. | verificado em 2026-10-15 (valor 3); chamada única de outra rede deu 401 (confirmado pela contagem: o IP de casa começou o segundo laço com 3 chamadas já contadas, 3 mais 297 igual a 300, e o 429 veio na requisição 298) |
| 6. Firebase Auth: política de senha (mínimo 8, maiúscula, minúscula, número e especial, modo Require, "Forçar upgrade no login" desmarcado) ativa e obrigatória; proteção contra enumeração de e-mail ligada; domínios autorizados só a Vercel de produção e localhost; contas `e2e-*@e2e.elderweb.test` apagadas | Console do Firebase, Authentication, Settings e Users | Conferir cada opção e testar o login de uma conta existente com senha antiga (não deve ser bloqueado). O cadastro valida no cliente com `validatePassword` do SDK (política real do console) e lista o que falta; `auth/weak-password` e `auth/password-does-not-meet-requirements` mostram a lista completa. Contas `e2e-*`: rodar dentro de `backend/` primeiro `npx tsx scripts/limpar-contas-e2e.ts` (simulação, só diz quantas seriam apagadas) e, conferida a contagem, `npx tsx scripts/limpar-contas-e2e.ts --confirmo-firebase` (apaga no máximo 500 por execução, só e-mail que começa com `e2e-` e termina em `@e2e.elderweb.test`; repetir se passar do teto). Contas `e2e-*`: 0 restantes no projeto `elder-web` em 2026-10-20 (48 apagadas pelo script; os outros 12 usuários não foram tocados); contas novas dos e2e voltam a acumular, repetir o script quando precisar. Não há troca de senha dentro do app; a redefinição é pela página do Firebase. Se ligar reCAPTCHA no Firebase, a CSP precisa de `https://www.google.com` (o bundle carrega `www.google.com/recaptcha` nesse caso). | não verificado |
| 7. Chave de API web do Firebase restrita por referrer HTTP e às APIs necessárias | Google Cloud Console, Credentials | Restringir referrers ao domínio da Vercel de produção, `elder-web.firebaseapp.com` e `elder-web.web.app` (a página do popup do Google fica lá), e localhost para desenvolvimento; APIs: Identity Toolkit e Token Service. | não verificado |
| 8. Autenticação em dois fatores | GitHub, Vercel, Render, Azure, Google/Firebase e Brevo | Ligar 2FA na conta de cada pessoa do grupo que tem acesso. | não verificado |
| 9. GitHub: proteção da `main` (PR obrigatório, CI verde, sem force push), secret scanning e push protection, alertas e atualizações de segurança do Dependabot | GitHub, Settings do repositório | Branch protection rules ou rulesets na `main`; Code security: secret scanning, push protection, Dependabot alerts e security updates. O `dependabot.yml` só abre PRs para `development`, sem merge automático. | não verificado |
| 10. Brevo: chave com escopo mínimo, rotação se houver dúvida, domínio próprio com SPF e DKIM | Painel da Brevo e DNS do domínio | Conferir permissões da chave usada em `EMAIL_API_KEY`; domínio próprio com SPF e DKIM continua pendente (já listado no CLAUDE.md). | não verificado |
| 11. Promover a CSP de relatório para obrigatória | `frontend/vercel.json` | Depois de publicar, com o console do navegador aberto em produção, testar: login por e-mail, login com Google, cadastro, foto, PDF do histórico, aprovar e recusar vínculo, trocar tema. Só sem nenhuma violação, trocar a chave `Content-Security-Policy-Report-Only` por `Content-Security-Policy` (juntando com a que já existe) e ajustar `cabecalhosVercel.test.ts`. Conferir também a origem da API no `connect-src` (`https://elder-web-backend.onrender.com`). **Resultado de 2026-10-20 (em ambiente local, antes de publicar):** a CSP completa do `vercel.json`, injetada como obrigatória no HTML, deu 0 violações (`securitypolicyviolation`) e nenhum erro de CSP no console em 39 telas e estados: as 11 rotas protegidas de cada perfil (idoso, cuidador e familiar; cuidador sem `/familia`), `/vinculos/:id` e o Perfil com o diálogo de exclusão aberto em 1280 e 320 px, sem confirmar. Controle negativo: um script inline e um `fetch` a origem fora da lista dispararam `script-src-elem` e `connect-src`. Cadastro, login por e-mail, aprovar vínculo e o diálogo foram exercitados; **não cobertos**: login com Google, foto, PDF do histórico e recusar vínculo, que continuam por conta do Marcos em produção. **Promoção feita em 2026-10-20 (PR #212, `main` `efad843`):** `frontend/vercel.json` tem só a chave `Content-Security-Policy`, com a política completa (a mínima e a `Content-Security-Policy-Report-Only` saíram), e `cabecalhosVercel.test.ts` exige a ausência da chave de relatório. **Confirmada em produção em 2026-10-20** por `curl -I` (cabeçalho `Content-Security-Policy` presente, sem `Content-Security-Policy-Report-Only`) e por teste manual do Marcos com o Console aberto, sem nenhuma violação, nos fluxos: login com Google, login com e-mail e senha, troca de foto, PDF do histórico, diálogo de excluir conta, tema claro e Família. **Não testados em produção:** recusar vínculo, contestar, cadastro novo, Saúde, Agenda e Alimentação (sem violação só em local, 2026-10-20, com exceção de recusar e contestar). Qualquer violação futura pede reverter a chave para `Content-Security-Policy-Report-Only`. | verificado em produção em 20/10/2026 (fluxos acima; faltam recusar vínculo, contestar, cadastro novo, Saúde, Agenda e Alimentação) |
| 12. Registrar o item 9.5 (endurecimento de segurança) no plano de desenvolvimento | Cofre Obsidian, `Elder Web - Plano de Desenvolvimento.md` | Acrescentar o item com o resumo do histórico, incluindo "Fechamento do item 9.5 (2026-10-20)". | não verificado |
| 13. Exclusão de conta em produção: testar uma vez com uma conta descartável criada pelo próprio Marcos, conferir no Firebase que o usuário sumiu e no banco que a linha foi anonimizada | Site em produção, Console do Firebase (Authentication, Users) e SSMS no banco de produção | Só depois da publicação (seção "Publicação da exclusão de conta"). **Nunca com a conta de demonstração, nem com conta real de familiar ou idoso.** 1) Criar uma conta nova com um e-mail que o Marcos controla e que só serve para isto, perfil idoso (cadastro com as duas caixas marcadas). 2) Entrar e abrir Meu Perfil. 3) Clicar em Excluir minha conta: o diálogo abre e o botão Excluir minha conta fica desabilitado. 4) Digitar EXCLUIR e a senha (conta com senha) e clicar em Excluir minha conta. 5) Esperado: volta para a tela pública com o aviso "Conta excluída." e a sessão encerrada. 6) Tentar entrar de novo com o mesmo e-mail e a mesma senha: deve falhar. 7) Tentar cadastrar de novo com o mesmo e-mail: deve funcionar como e-mail novo (a conta antiga já não usa esse e-mail); depois excluir essa segunda conta pelo mesmo caminho. 8) Console do Firebase, Authentication, Users: o usuário não aparece mais (buscar pelo e-mail). 9) No SSMS: `SELECT id, nome, email, telefone, aceite_documentos_versao FROM Usuario WHERE nome = N'Conta excluída' ORDER BY id DESC`. A linha mais recente mostra nome `Conta excluída`, e-mail `excluido-<id>@excluido.invalid`, telefone nulo e a versão do aceite preservada (`1.2`). Se algum passo falhar, não repetir em loop: a rota limita a 3 pedidos por hora por conta. | verificado em 2026-10-20 pelo Marcos (relato dele: o roteiro acima, com conta descartável, deu certo; nenhum comando registrado) |
| 14. Collation do banco e linhas fora do padrão do marcador de conta excluída | Azure SQL, banco `elder_web`, pelo SSMS | Rodar (somente leitura): `SELECT CAST(DATABASEPROPERTYEX(DB_NAME(),'Collation') AS NVARCHAR(128))`, `SELECT CAST(SERVERPROPERTY('Collation') AS NVARCHAR(128))` e `SELECT COUNT(*) FROM Usuario WHERE email LIKE '%@excluido.invalid' AND email NOT LIKE 'excluido-%'`. O `CAST` é necessário só para o driver do Prisma; no SSMS pode ser omitido. Esperado: `SQL_Latin1_General_CP1_CI_AS` nos dois e 0 linhas. A collation é CI (não diferencia maiúscula): o guarda em Node (`ehContaExcluida`, minúsculas) e o `=`/`LIKE` do SQL concordam em maiúsculas; no banco local, com a mesma collation, o hífen suave (U+00AD) e o espaço de largura zero (U+200B) não são ignorados pelo `=`. Refazer se a collation do banco mudar. | verificado em 2026-10-20 (banco e servidor `SQL_Latin1_General_CP1_CI_AS`; 0 linhas fora do padrão) |

## Teste do trust proxy (item 5)

O limite de `POST /auth/sync` é de 300 chamadas por IP em 15 minutos (`backend/src/routes/auth.ts`). O contador fica em
memória no processo, então zera depois de 15 minutos ou a cada deploy (mudar uma variável no painel do Render faz um
deploy novo). Os docs do Render não dizem quantos proxies ficam na frente do serviço; por isso o valor é medido.

Roteiro, no PowerShell, com `TRUST_PROXY_SALTOS` já definido no painel e o deploy concluído:

1. Laço de 400 chamadas com token inválido. Esperado: 401 até a 300 e 429 a partir de perto da 301.

   ```powershell
   $url = "https://elder-web-backend.onrender.com/auth/sync"
   1..400 | ForEach-Object { "$_ " + (curl.exe -s -o NUL -w '%{http_code}' -X POST -H "Authorization: Bearer invalido" $url) }
   ```

2. Numa janela nova (15 minutos depois ou depois de um deploy), o mesmo laço com um `X-Forwarded-For` falso e aleatório
   por chamada. Esperado: 429 também. Se não vier 429, o cliente consegue forjar o IP e o valor está alto demais.

   ```powershell
   1..400 | ForEach-Object {
     $ip = (1..4 | ForEach-Object { Get-Random -Minimum 1 -Maximum 255 }) -join "."
     "$_ " + (curl.exe -s -o NUL -w '%{http_code}' -X POST -H "Authorization: Bearer invalido" -H "X-Forwarded-For: $ip" $url)
   }
   ```

3. Logo depois de um 429, uma chamada única igual de outra rede (por exemplo, o celular em dados móveis). Esperado: 401.
   Se vier 429, o IP lido é o de um proxy compartilhado e o valor está baixo demais.

Regra: usar o MENOR valor que dá 429 no passo 1, porque um valor alto demais faz o Express aceitar como IP do cliente
um endereço que o próprio cliente escreveu no `X-Forwarded-For`. Refazer o teste se o Render mudar a infraestrutura
(por exemplo, se o limite parar de disparar ou disparar para todos ao mesmo tempo).

Resultado medido pelo Marcos em 2026-10-15:

- `TRUST_PROXY_SALTOS` = 1 e = 2: as 400 chamadas deram só 401, sem nenhum 429.
- `TRUST_PROXY_SALTOS` = 3: veio o 429. No laço com `X-Forwarded-For` falso, o 429 veio na requisição 298 (3 chamadas
  anteriores na mesma janela mais 297, total de 300), então o cabeçalho forjado não burlou o limite.
- O valor 3 ficou no painel do Render e está declarado no `render.yaml`. O código continua com 1 como padrão
  (`saltosTrustProxy` em `backend/src/app.ts`).

## Ordem de publicação do aceite gravado

1. Migration `20261014120000_add_aceite_documentos` no Azure: **aplicada em 2026-10-15** com autorização do Marcos
   (`migrate deploy` de uma máquina local; `migrate status` depois: em dia).
2. Frontend (Vercel): passa a mandar `aceite_documentos` no cadastro e na confirmação de e-mail. O backend antigo
   ignora o campo.
3. Backend (Render): passa a exigir o aceite. Publicado antes do frontend, todo cadastro novo daria 400.

Ao lançar uma versão nova dos documentos, a ordem se inverte: primeiro o backend com a versão nova em
`VERSOES_DOCUMENTOS` (`backend/src/lib/versoesDocumentos.ts`, mantendo a anterior na lista), depois o frontend com o
`VERSAO_DOCUMENTOS` novo.

## Itens de painel pendentes: onde clicar e valor recomendado

Ordem sugerida de execução. Só os itens ainda pendentes; os já verificados (1, 2, 5, 14) ficam como estão nas linhas
acima. Os nomes de menu são os dos painéis em 2026-10 e podem mudar: se não achar, buscar pelo nome da opção.

| Ordem | Item | Onde clicar | Valor recomendado |
| --- | --- | --- | --- |
| 1 | 8. 2FA | GitHub: Settings da conta, Password and authentication. Google: myaccount.google.com, Segurança, Verificação em duas etapas. Vercel, Render, Azure e Brevo: configurações de segurança da conta de cada serviço | Ligado na conta de cada pessoa do grupo com acesso a cada serviço. Primeiro, porque protege as contas dos demais painéis. |
| 2 | 9. GitHub | Repositório, Settings, Branches (ou Rules, Rulesets) para a `main`; Settings, Code security | `main` com PR obrigatório, checks `backend` e `frontend` obrigatórios e sem force push. Secret scanning, push protection, Dependabot alerts e security updates ligados. |
| 3 | 6. Firebase Auth | Console do Firebase, projeto `elder-web`, Authentication, Settings: abas Password policy, User actions (proteção contra enumeração de e-mail) e Authorized domains | Política de senha: mínimo 8, maiúscula, minúscula, número e caractere especial, modo Require, "Forçar upgrade no login" desmarcado. Proteção contra enumeração ligada. Domínios autorizados: só a Vercel de produção e `localhost`. |
| 4 | 7. Chave web | Google Cloud Console, projeto `elder-web`, APIs e serviços, Credenciais, chave de API web | Restrição de aplicativo: referrers HTTP (Vercel de produção, `elder-web.firebaseapp.com`, `elder-web.web.app` e `localhost`). Restrição de API: só Identity Toolkit e Token Service. |
| 5 | 4. Render | Painel do Render, serviço `elder-web-backend`, Environment (variáveis, Secret Files e Environment Groups) | Sem `DEBUG` e sem variável `PRISMA_*`; `TRUST_PROXY_SALTOS` = `3`; Secret Files e grupos vinculados revistos. |
| 6 | 3. Backup | Portal do Azure, banco `elder_web`, Backups (retenção) e Restaurar | Retenção point-in-time ativa (o padrão do Azure SQL Database é 7 dias) e uma restauração para um banco novo e descartável, que abre e depois é apagado. |
| 7 | 10. Brevo | Painel da Brevo, SMTP e API, API Keys; Senders, Domains | Chave de `EMAIL_API_KEY` só com o escopo de envio transacional. Domínio próprio com SPF e DKIM quando houver domínio; sem domínio, segue o risco aceito já registrado no CLAUDE.md. |
| 8 | Publicar | Ver "Publicação da exclusão de conta" | Feito em 2026-10-20 (PR #210, backend antes do frontend; relato do Marcos). |
| 9 | 13. Exclusão em produção | Roteiro no próprio item | Feito em 2026-10-20 (relato do Marcos). |
| 10 | 11. CSP obrigatória | `frontend/vercel.json` | Promovida em 2026-10-20 (PR #212, `main` `efad843`); verificado em produção em 20/10/2026 (curl -I e Console sem violação nos fluxos principais; não testados: recusar vínculo, contestar, cadastro novo, Saúde, Agenda, Alimentação). |
| 11 | 12. Plano de desenvolvimento | Cofre Obsidian | Registrar o item 9.5. |

## Publicação da exclusão de conta

Estado: publicado em 2026-10-20. O PR #210 foi mergeado em `main` por rebase às 17:25:35Z (14:25 em Brasília), com o backend no ar antes do frontend; o Marcos seguiu os passos 1 a 6 abaixo e relatou que todos deram certo (relato dele, sem comando registrado aqui). Os passos ficam como procedimento para a próxima publicação que mude a versão dos documentos.

Sem migration: o Azure não é tocado. Um PR só, de `development` para `main` (o commit `d4b8953` mistura backend e frontend,
só de testes, então não há divisão limpa em dois PRs sem reescrever o histórico). O CI do PR roda os checks `frontend` e
`backend`. Como o PR é um só, o que impede a janela abaixo é a ordem em que os dois serviços saem.

Como cada serviço publica (o repositório só prova parte):

- CI: `.github/workflows/ci.yml` roda em push de qualquer branch e em PR para `main`; não faz deploy.
- Render: `render.yaml` define o serviço, o Dockerfile e o `healthCheckPath: /health`, mas não declara branch observada nem
  `autoDeploy`. Não verificável pelo repositório: conferir no painel (serviço `elder-web-backend`, Settings, Build & Deploy).
- Vercel: `frontend/vercel.json` só tem rewrite e cabeçalhos. Branch de produção e deploy automático: não verificável pelo
  repositório; conferir no painel da Vercel (projeto, Settings, Git).

A janela: `VERSAO_DOCUMENTOS` do frontend passou a `1.2` e o frontend novo manda `1.2` no cadastro e na confirmação de e-mail do
idoso (`ConfirmarEmail`). O backend antigo só conhece `1.1` e responde 400 ao aceite. O build Docker do Render costuma levar
mais que o da Vercel (tempo não medido); se os dois saírem juntos do merge, o frontend novo pode ficar no ar com o backend
antigo por alguns minutos.

Passos:

1. No PR, conferir os checks `frontend` e `backend` verdes. Se a Vercel faz deploy automático da `main`, pausá-lo antes do
   merge (painel da Vercel) para o frontend só sair no passo 5.
2. Fazer o merge. O Render começa o build do backend.
3. Esperar o deploy do backend ficar ativo (painel do Render, Events ou Logs, com o commit do merge) e conferir:
   `curl.exe -s -o NUL -w '%{http_code}' https://elder-web-backend.onrender.com/health` deve dar `200`.
4. Conferir que é o build novo: `curl.exe -s -o NUL -w '%{http_code}' -X DELETE https://elder-web-backend.onrender.com/usuario/me`
   deve dar `401` (rota nova, sem token). O backend antigo daria `404`. A versão `1.2` do aceite vai no mesmo build da rota
   nova (`backend/src/lib/versoesDocumentos.ts` e o teste `authAceiteDocumentos.test.ts`); a prova com cadastro real é o
   item 13, que não deve ser feito antes do passo 5.
5. Liberar o frontend (reativar o deploy automático ou promover o deploy do commit do merge na Vercel). Conferir: abrir
   `/privacidade` e ver "Versão 1.2" com a data 20 de outubro de 2026; entrar com qualquer conta de teste e ver a seção
   Excluir minha conta no fim de Meu Perfil, sem confirmar nada.
6. Fazer o item 13 com a conta descartável.

Se alguém cair na janela (frontend novo com backend antigo): o cadastro cria o usuário no Firebase, o `/auth/sync` responde
400 e a linha em `Usuario` não existe; o frontend não desfaz o usuário do Firebase. Sintoma: a pessoa vê a falha de
sincronização e, ao tentar de novo, o Firebase diz que o e-mail já existe. Correção: Console do Firebase, Authentication,
Users, buscar o e-mail e excluir o usuário; pedir para a pessoa se cadastrar de novo depois que o backend novo estiver no ar.
A confirmação de e-mail do idoso (anexo) só falha com 400 e não cria nada: basta tentar de novo. Quem já tinha conta e só
entra (login) não é afetado.
