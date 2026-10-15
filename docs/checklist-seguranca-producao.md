# Checklist de segurança de produção

Itens que o código não prova sozinho: ficam com o Marcos, nos painéis de cada serviço. Criado no endurecimento de
segurança de 2026-10-14 (ver `docs/historico-implementacao.md`). "Não verificado" quer dizer que nenhum comando desta
rodada provou o item; troque para "verificado em AAAA-MM-DD" quando conferir.

| Item | Onde | Como verificar | Estado |
| --- | --- | --- | --- |
| 1. Usuário da aplicação no banco só com `db_datareader` e `db_datawriter`; admin só para migrar | Azure SQL e variável `DATABASE_URL` do Render | No SSMS, conectado ao banco de produção: `SELECT dp.name, r.name FROM sys.database_role_members m JOIN sys.database_principals r ON m.role_principal_id = r.principal_id JOIN sys.database_principals dp ON m.member_principal_id = dp.principal_id;` e conferir que o usuário da `DATABASE_URL` do Render só aparece nesses dois papéis. | não verificado |
| 2. Firewall sem regra aberta 0.0.0.0 a 255.255.255.255; só IPs de saída do Render e o IP do Marcos para migration; sem "Allow Azure services" se não for preciso | Azure Portal, servidor SQL, Networking | Listar as regras. Os IPs de saída do Render ficam no painel do serviço (Connect, Outbound). Atenção: a regra aberta foi mantida de propósito porque o Render free não tem IP fixo; trocar só se os IPs de saída listados forem estáveis. | não verificado |
| 3. Retenção do backup point-in-time conferida e uma restauração de teste num banco descartável | Azure Portal, banco, Backups | Ver a retenção configurada e restaurar um ponto no tempo para um banco novo; conferir que abre e apagar o banco restaurado. | não verificado |
| 4. Secret Files e grupos de ambiente vinculados revistos; sem `DEBUG` nem `PRISMA_*`; `TRUST_PROXY_SALTOS` conferido | Render, serviço `elder-web-backend`, Environment | Abrir Environment, Secret Files e Environment Groups. Nenhuma variável `DEBUG` ou começando com `PRISMA_`. `TRUST_PROXY_SALTOS` ausente (vale 1) ou com o valor achado no item 5. | não verificado |
| 5. `trust proxy` lê o IP do cliente, não o do proxy | Produção, dois aparelhos em redes diferentes | Pelo celular em dados móveis, fazer mais de 300 chamadas a `POST /auth/sync` com token inválido em 15 minutos (todas 401, a 301 vira 429). Logo depois, pelo notebook no Wi-Fi, uma chamada igual: tem que vir 401. Se vier 429, o IP lido é o do proxy e `TRUST_PROXY_SALTOS` está errado (teste 2, depois 3). Os docs do Render não dizem quantos proxies há (Cloudflare mais o balanceador do Render). | não verificado |
| 6. Firebase Auth: política de senha (mínimo 8, maiúscula, minúscula e número) ativa e obrigatória; proteção contra enumeração de e-mail ligada; domínios autorizados só a Vercel de produção e localhost; contas `e2e-*@e2e.elderweb.test` apagadas | Console do Firebase, Authentication, Settings e Users | Conferir cada opção. O frontend exige 8 caracteres e trata `auth/password-does-not-meet-requirements` sem citar regra. Se ligar reCAPTCHA no Firebase, a CSP precisa de `https://www.google.com` (o bundle carrega `www.google.com/recaptcha` nesse caso). | não verificado |
| 7. Chave de API web do Firebase restrita por referrer HTTP e às APIs necessárias | Google Cloud Console, Credentials | Restringir referrers ao domínio da Vercel de produção, `elder-web.firebaseapp.com` e `elder-web.web.app` (a página do popup do Google fica lá), e localhost para desenvolvimento; APIs: Identity Toolkit e Token Service. | não verificado |
| 8. Autenticação em dois fatores | GitHub, Vercel, Render, Azure, Google/Firebase e Brevo | Ligar 2FA na conta de cada pessoa do grupo que tem acesso. | não verificado |
| 9. GitHub: proteção da `main` (PR obrigatório, CI verde, sem force push), secret scanning e push protection, alertas e atualizações de segurança do Dependabot | GitHub, Settings do repositório | Branch protection rules ou rulesets na `main`; Code security: secret scanning, push protection, Dependabot alerts e security updates. O `dependabot.yml` só abre PRs para `development`, sem merge automático. | não verificado |
| 10. Brevo: chave com escopo mínimo, rotação se houver dúvida, domínio próprio com SPF e DKIM | Painel da Brevo e DNS do domínio | Conferir permissões da chave usada em `EMAIL_API_KEY`; domínio próprio com SPF e DKIM continua pendente (já listado no CLAUDE.md). | não verificado |
| 11. Promover a CSP de relatório para obrigatória | `frontend/vercel.json` | Depois de publicar, com o console do navegador aberto em produção, testar: login por e-mail, login com Google, cadastro, foto, PDF do histórico, aprovar e recusar vínculo, trocar tema. Só sem nenhuma violação, trocar a chave `Content-Security-Policy-Report-Only` por `Content-Security-Policy` (juntando com a que já existe) e ajustar `cabecalhosVercel.test.ts`. Conferir também a origem da API no `connect-src` (`https://elder-web-backend.onrender.com`). | não verificado |
| 12. Registrar o item 9.5 (endurecimento de segurança) no plano de desenvolvimento | Cofre Obsidian, `Elder Web - Plano de Desenvolvimento.md` | Acrescentar o item com o resumo do histórico. | não verificado |

## Ordem de publicação do aceite gravado

1. Migration `20261014120000_add_aceite_documentos` no Azure, com autorização explícita e separada do Marcos
   (`npx prisma migrate deploy` com a `DATABASE_URL` do Azure, de uma máquina local).
2. Frontend (Vercel): passa a mandar `aceite_documentos` no cadastro e na confirmação de e-mail. O backend antigo
   ignora o campo.
3. Backend (Render): passa a exigir o aceite. Publicado antes do frontend, todo cadastro novo daria 400.
