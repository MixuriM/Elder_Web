# Checklist de segurança de produção

Itens que o código não prova sozinho: ficam com o Marcos, nos painéis de cada serviço. Criado no endurecimento de
segurança de 2026-10-14 (ver `docs/historico-implementacao.md`). "Não verificado" quer dizer que nenhum comando desta
rodada provou o item; troque para "verificado em AAAA-MM-DD" quando conferir.

| Item | Onde | Como verificar | Estado |
| --- | --- | --- | --- |
| 1. Usuário da aplicação no banco só com `db_datareader` e `db_datawriter`; admin só para migrar | Azure SQL e variável `DATABASE_URL` do Render | No SSMS, conectado ao banco de produção: `SELECT dp.name, r.name FROM sys.database_role_members m JOIN sys.database_principals r ON m.role_principal_id = r.principal_id JOIN sys.database_principals dp ON m.member_principal_id = dp.principal_id;` e conferir que o usuário da `DATABASE_URL` do Render só aparece nesses dois papéis. | pendente, ação do Marcos (roteiro em `docs/azure-usuario-minimo.md`) |
| 2. Firewall sem regra aberta 0.0.0.0 a 255.255.255.255; só IPs de saída do Render e o IP do Marcos para migration; sem "Allow Azure services" se não for preciso | Azure Portal, servidor SQL, Networking | Listar as regras. Os IPs de saída do Render ficam no painel do serviço (Connect, Outbound). Atenção: a regra aberta foi mantida de propósito porque o Render free não tem IP fixo; trocar só se os IPs de saída listados forem estáveis. | pendente, ação do Marcos, decisão dele (fatos em `docs/azure-usuario-minimo.md`, seção Firewall do Azure) |
| 3. Retenção do backup point-in-time conferida e uma restauração de teste num banco descartável | Azure Portal, banco, Backups | Ver a retenção configurada e restaurar um ponto no tempo para um banco novo; conferir que abre e apagar o banco restaurado. | não verificado |
| 4. Secret Files e grupos de ambiente vinculados revistos; sem `DEBUG` nem `PRISMA_*`; `TRUST_PROXY_SALTOS` conferido | Render, serviço `elder-web-backend`, Environment | Abrir Environment, Secret Files e Environment Groups. Nenhuma variável `DEBUG` ou começando com `PRISMA_`. `TRUST_PROXY_SALTOS` igual a `3`, o valor do item 5 (também declarado no `render.yaml`). | não verificado (o `TRUST_PROXY_SALTOS` = 3 foi posto no painel em 2026-10-15) |
| 5. `trust proxy` lê o IP do cliente, não o do proxy | Produção, PowerShell, duas redes diferentes | Roteiro e resultado em "Teste do trust proxy (item 5)", abaixo. Valor correto no Render: `TRUST_PROXY_SALTOS` = 3. | verificado em 2026-10-15 (valor 3); chamada única de outra rede deu 401 (confirmado pela contagem: o IP de casa começou o segundo laço com 3 chamadas já contadas, 3 mais 297 igual a 300, e o 429 veio na requisição 298) |
| 6. Firebase Auth: política de senha (mínimo 8 caracteres, sem exigir composição, modo Require no console do Firebase) ativa e obrigatória; proteção contra enumeração de e-mail ligada; domínios autorizados só a Vercel de produção e localhost; contas `e2e-*@e2e.elderweb.test` apagadas | Console do Firebase, Authentication, Settings e Users | Conferir cada opção. O frontend exige 8 caracteres e trata `auth/password-does-not-meet-requirements` sem citar regra. Se ligar reCAPTCHA no Firebase, a CSP precisa de `https://www.google.com` (o bundle carrega `www.google.com/recaptcha` nesse caso). | não verificado |
| 7. Chave de API web do Firebase restrita por referrer HTTP e às APIs necessárias | Google Cloud Console, Credentials | Restringir referrers ao domínio da Vercel de produção, `elder-web.firebaseapp.com` e `elder-web.web.app` (a página do popup do Google fica lá), e localhost para desenvolvimento; APIs: Identity Toolkit e Token Service. | não verificado |
| 8. Autenticação em dois fatores | GitHub, Vercel, Render, Azure, Google/Firebase e Brevo | Ligar 2FA na conta de cada pessoa do grupo que tem acesso. | não verificado |
| 9. GitHub: proteção da `main` (PR obrigatório, CI verde, sem force push), secret scanning e push protection, alertas e atualizações de segurança do Dependabot | GitHub, Settings do repositório | Branch protection rules ou rulesets na `main`; Code security: secret scanning, push protection, Dependabot alerts e security updates. O `dependabot.yml` só abre PRs para `development`, sem merge automático. | não verificado |
| 10. Brevo: chave com escopo mínimo, rotação se houver dúvida, domínio próprio com SPF e DKIM | Painel da Brevo e DNS do domínio | Conferir permissões da chave usada em `EMAIL_API_KEY`; domínio próprio com SPF e DKIM continua pendente (já listado no CLAUDE.md). | não verificado |
| 11. Promover a CSP de relatório para obrigatória | `frontend/vercel.json` | Depois de publicar, com o console do navegador aberto em produção, testar: login por e-mail, login com Google, cadastro, foto, PDF do histórico, aprovar e recusar vínculo, trocar tema. Só sem nenhuma violação, trocar a chave `Content-Security-Policy-Report-Only` por `Content-Security-Policy` (juntando com a que já existe) e ajustar `cabecalhosVercel.test.ts`. Conferir também a origem da API no `connect-src` (`https://elder-web-backend.onrender.com`). | não verificado |
| 12. Registrar o item 9.5 (endurecimento de segurança) no plano de desenvolvimento | Cofre Obsidian, `Elder Web - Plano de Desenvolvimento.md` | Acrescentar o item com o resumo do histórico. | não verificado |

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
`VERSOES_DOCUMENTOS` (`backend/src/routes/auth.ts`, mantendo a anterior na lista), depois o frontend com o
`VERSAO_DOCUMENTOS` novo.
