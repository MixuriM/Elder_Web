# Modo demonstração

Acesso de administrador para apresentar o Elder Web na banca do TCC e na feira de TCC sem depender de cadastros
reais. O admin entra em `/demo`, escolhe uma das seis contas fictícias já vinculadas entre si e usa o produto como
aquela pessoa. Uma faixa amarela no topo de toda tela avisa: "Modo demonstração: todos os dados são fictícios".

## O que é e o que não é

- **É** login em contas fictícias reais do sistema, cada uma com o seu `tipo_perfil` fixo. Trocar de perfil é entrar em
  outra conta do elenco por um custom token do Firebase. Vínculos, `modo_decisao`, flags `permite_*`, 403, 404 e menus
  funcionam exatamente como em produção, sem nenhuma exceção de autorização.
- **Não é** perfil híbrido nem troca de `tipo_perfil` (decisão fechada no CLAUDE.md). O admin não é perfil, coluna nem
  linha em `Usuario`: é só um uid do Firebase listado em `DEMO_ADMIN_UIDS`.
- Desligado (`DEMO_MODO_ATIVO` diferente de `1`), as três rotas de `/demo` respondem o mesmo 404 de uma rota que não
  existe, e a tela `/demo` mostra "Página não encontrada".

## Como ligar (antes do evento)

1. No console do Firebase (Authentication, Users), crie a conta do admin com e-mail e senha fortes, ou use uma conta
   Google já existente. Copie o **User UID** dela (`<UID_DO_ADMIN>`). Nunca coloque esse uid no repositório.
2. Rode a semente no banco **local** primeiro e confira o roteiro abaixo em `http://localhost:5173/demo`:
   ```
   cd backend
   DATABASE_URL="sqlserver://localhost:14330;database=elder_web;user=sa;password=<SENHA_LOCAL>;trustServerCertificate=true" \
     npx tsx scripts/semear-demo.ts
   ```
   O script escreve no banco e no Firebase real (cria as seis contas, sem senha). Ele só imprime contagens.
3. No painel do Render (`elder-web-backend`, Environment), defina `DEMO_ADMIN_UIDS=<UID_DO_ADMIN>` (mais de um admin:
   separados por vírgula) e `DEMO_MODO_ATIVO=1`. O `render.yaml` só declara os nomes (`sync: false`).
4. Semente no Azure: **só com autorização explícita do Marcos naquele momento**:
   `npx tsx scripts/semear-demo.ts --confirmo-azure` (com a `DATABASE_URL` do Azure). Sem `--confirmo-azure` o script
   recusa qualquer banco não local.
5. Faça o roteiro inteiro uma vez em produção antes da apresentação e termine com "Restaurar dados".

## Antes de apresentar

- **Restaure imediatamente antes de começar e entre uma apresentação e outra** ("Restaurar dados" na faixa amarela, ou
  `semear-demo.ts`). Isso apaga as mudanças feitas na demonstração e qualquer pedido de vínculo de estranhos: o repositório
  é público, então qualquer pessoa pode pedir vínculo à Helena ou ao Antônio pelo e-mail previsível, e o nome dela
  apareceria no telão.
- **Restaure entre 10:00 e 18:00 (horário de Brasília).** O "hoje" (remédios e refeições já registrados, compromissos já
  passados e por vir) depende da hora da restauração: de manhã cedo o dia fica quase vazio, e à noite fica quase completo.
- A semente tem uma ordem à prova de falha: confere o banco, prepara as seis contas no Firebase e só então apaga e recria
  os dados numa transação. Se qualquer passo antes da transação falhar, o banco continua como estava. Se a transação
  falhar, ela volta inteira e a demonstração anterior continua no ar.

### Semente abortou com "Há um usuário estranho ocupando um e-mail reservado da demonstração"

Alguém (ou um teste antigo) cadastrou uma conta com um dos e-mails `<conta>@demo.elderweb.test`. O script e o botão
"Restaurar dados" não imprimem quem é. Para achar e remover:

1. No SSMS, no banco do ambiente, liste os usuários cujo e-mail termina em `@demo.elderweb.test` e cujo `firebase_uid`
   não começa com `demo-` (inclui `firebase_uid` vazio). O `SELECT` só lê.
2. Confirme que não é uma conta real. O domínio `.test` é reservado (RFC 6761) e não recebe e-mail, então não deveria ser.
3. Apague as linhas dessa conta (vínculos, registros e por fim o `Usuario`, nessa ordem de dependência) e a conta no
   console do Firebase, se existir. No Firebase, a semente já apaga sozinha uma conta intrusa com esse e-mail.
4. Rode a semente de novo.

## Como desligar (depois do evento)

A ordem importa:

1. **Primeiro** tire o modo do ar no Render: apague `DEMO_MODO_ATIVO` (ou ponha `0`) e esvazie `DEMO_ADMIN_UIDS`. A partir
   daí `/demo` dá 404.
2. **Depois** remova as contas e os dados: `npx tsx scripts/semear-demo.ts --remover` (local) e, com autorização, o mesmo
   com `--confirmo-azure` no Azure. Apaga as seis contas no banco e no Firebase. Se alguma linha de fora do elenco apontar
   para uma conta do elenco, a transação inteira volta e nada é apagado.
3. Sem o `--remover`, as sessões demo já abertas continuam funcionando nas rotas normais enquanto as contas existirem.
   Apagando as contas no Firebase, a renovação do token falha e as sessões acabam.
4. Se quiser, apague a conta do admin no console do Firebase.

## As seis contas

| Conta | Perfil | Papel na apresentação |
| --- | --- | --- |
| Helena Prado | Idoso, decide por si (`modo_decisao` `idoso`) | Conta principal, com mais dados |
| Antônio Ribeiro | Idoso, decisão com a família (`modo_decisao` `familiar`) | Mostra a outra autoridade de decisão |
| Marta Souza | Cuidador | Helena: as 3 permissões. Antônio: só marcar dose (permissão granular e N:N) |
| Paulo Lima | Cuidador | Pedido de vínculo pendente com Helena (menu restrito, aprovação ao vivo) |
| Carlos Prado | Familiar, filho de Helena | Só lê: Helena decide por si |
| Renata Ribeiro | Familiar, filha de Antônio | Escreve: Antônio passou a decisão para a família |

Vínculos: Marta e Carlos aprovados por Helena; Paulo pendente com Helena; Renata aprovada por Antônio; Marta aprovada
por Renata (depois que Antônio passou a decisão para a família). Uid `demo-<conta>`, e-mail `<conta>@demo.elderweb.test`
(domínio que não recebe e-mail), sem telefone, sem foto, sem senha.

## Dados fictícios de cada conta

Tudo é recalculado a partir do momento da semente, no horário de Brasília: "hoje" é sempre o dia da restauração. Hoje
fica parcial de propósito: só o que já passou; doses só até as 18:00 e refeições só café e almoço (o resto fica para
registrar ao vivo).
Contagens de uma restauração às 14:00:

| Tela | Helena | Antônio |
| --- | --- | --- |
| Saúde | 44 registros em 14 dias: pressão (de 145/92 a 121/79, melhora nos últimos 5 dias), glicemia em jejum, peso semanal, frequência cardíaca. Parte registrada por Helena, parte por Marta | 12 em 10 dias: pressão e peso, alternando Antônio e Renata |
| Remédios | 4 ativos (Losartana, Metformina, Sinvastatina, Omeprazol) e 1 encerrado (Amoxicilina, há 3 semanas). 54 doses: 7 dias dos ativos com 2 puladas e 1 atrasada, mais o tratamento encerrado | 3 ativos criados por Renata (Enalapril, Levotiroxina, AAS). 15 doses em 5 dias, por Antônio e Marta, 1 atrasada |
| Agenda | 18 eventos: 3 passados, 2 hoje (um já passou, um por vir), geriatra amanhã às 09:00, fisioterapia às terças e quintas, almoço em família no domingo, cardiologista em 3 semanas, aferir pressão e banho assistido criados por Marta | 7 eventos: 2 passados, retirar receita amanhã, fisioterapia, aniversário do neto, endocrinologista; nenhum de cuidado |
| Alimentação | 24 refeições em 5 dias, os 6 tipos; hoje só café e almoço | 10 refeições em 3 dias, por Antônio e Renata |
| Vínculos | Marta e Carlos aprovados, Paulo pendente (aviso "1 pedido de cuidador para responder") | Renata e Marta aprovados |

## Roteiro de apresentação (7 a 8 minutos)

Antes: abra `/demo`, entre com a conta do admin e clique em **Helena Prado**. Se a apresentação anterior mexeu nos
dados, abra a faixa amarela e clique em **Restaurar dados**.

1. **Helena, Início (1 min).** Resumo do dia com as doses da manhã, as medições de hoje e os dois compromissos. Em
   Avisos aparece o pedido de Paulo. Mostre a Saúde com a pressão melhorando nos últimos dias.
2. **Botão de emergência (1 min).** "Preciso de ajuda": a ligação para o 192 em destaque. Clique em "Avisar minha família
   e cuidadores": a mensagem diz que o aviso foi simulado e que nenhum e-mail foi enviado (2 pessoas seriam avisadas).
3. **Marta (1 min).** Faixa amarela, "Trocar de conta ou restaurar", **Marta Souza**. Em Medicamentos, escolha Helena e
   marque a dose da Metformina do jantar ou da Sinvastatina. Escolha Antônio: ela marca dose, mas não registra saúde
   nem cria evento (permissão granular).
4. **Carlos (1 min).** Troque para **Carlos Prado**. Ele vê saúde, remédios e agenda de Helena, sem botões de registrar:
   Helena decide por si.
5. **Antônio e Renata (1,5 min).** Troque para **Antônio Ribeiro** e mostre que a decisão está com a família. Troque
   para **Renata Ribeiro**: ela cadastra um remédio ou uma refeição para Antônio e aprova ou ajusta permissões.
6. **Paulo e aprovação ao vivo (1,5 min).** Troque para **Paulo Lima**: menu restrito, sem vínculo aprovado. Volte para
   **Helena Prado**, abra Cuidadores e aprove o pedido de Paulo. Troque para Paulo de novo: agora ele vê os dados.
7. **Histórico em PDF (0,5 min).** Como Helena (ou Carlos), em Medicamentos, baixe o histórico de remédios e saúde.
8. **Fim.** "Restaurar dados" deixa tudo pronto para a próxima apresentação. "Sair da demonstração" volta para `/demo`.

Telas esperadas em cada passo: a faixa amarela sempre no topo; nas trocas de conta a página recarrega em `/Home`.

**Plano B sem internet:** rode tudo local. `docker compose up -d db`, `npx prisma migrate deploy` contra o banco local,
`npm run dev` em `backend/` (com `DEMO_MODO_ATIVO=1` e `DEMO_ADMIN_UIDS=<UID_DO_ADMIN>` no ambiente) e em `frontend/`,
semente local (passo 2 de "Como ligar"). O login e o custom token ainda precisam do Firebase: sem internet nenhuma,
use um roteiro gravado (vídeo) como plano C.

## Falhas comuns

- **`/demo` diz "Página não encontrada" depois do login:** `DEMO_MODO_ATIVO` não está exatamente `1`, ou o uid do admin
  não está em `DEMO_ADMIN_UIDS` (confira espaços e vírgulas), ou o deploy do Render ainda não pegou as variáveis.
- **"Não foi possível entrar nessa conta":** a semente não rodou no banco daquele ambiente, ou o limite de 30 trocas em
  15 minutos estourou (espere).
- **Telas vazias ou "Usuário não sincronizado":** a semente não rodou nesse banco. Rode `semear-demo.ts`.
- **"Restaurar dados" falhou:** limite de 5 por hora, ou o Azure demorou. Tente de novo em instantes; a semente é
  idempotente.
- **A faixa amarela não aparece:** a página foi aberta numa conta comum. Saia e entre de novo por `/demo`.
- **A semente abortou com "Há um usuário estranho...":** ver a seção "Antes de apresentar".
- **Pedir vínculo, aceitar convite ou cadastrar idoso dá erro:** é o limite do modo (403 nessas 6 ações); a faixa amarela
  avisa. Mostre esses fluxos fora da demonstração.
- **Primeiro acesso lento:** o Render free dorme. Abra o site 2 minutos antes de começar.

## Riscos conhecidos e segurança

- Barreiras: token do Firebase validado com revogação (401); depois flag e lista de admins (404 igual a rota
  inexistente); conta escolhida por lista fechada de slugs (400), e o uid emitido sai sempre do elenco; limites de 30
  trocas por 15 minutos e 5 restaurações por hora por admin. Nada é logado e nenhuma resposta traz uid ou e-mail.
- Conta do elenco não cria vínculo nem conta (`solicitar-cuidador`, `solicitar-familiar`, `convidar-familiar`,
  `convidar-cuidador`, `aceitar-convite` e `cadastrar-idoso` dão 403) e não alcança idoso fora do elenco, mesmo com
  vínculo aprovado no banco (`requireVinculoAprovado`). Um admin comprometido só mexe nas seis contas fictícias.
- **Claims do custom token:** a documentação do Firebase (Create Custom Tokens e Custom Claims, consultadas em
  2026-10-15) diz que as claims extras ficam disponíveis no token, mas não garante que sobrevivem à renovação do ID
  token. Por isso a sessão de uma conta do elenco vale mesmo sem a claim `demo_admin_uid` (as contas não têm senha e o
  e-mail `.test` não recebe link de redefinição: só o custom token deste backend entra nelas); se a claim existir, o
  admin dela precisa continuar na lista. A faixa amarela também aparece pelo uid `demo-`.
- Aceitos (documentados, sem mitigação): sem 2FA no admin; trocar o e-mail no Perfil de uma conta do elenco desfaz a
  identidade dela até o próximo "Restaurar dados"; o código do modo existe no bundle do frontend mesmo desligado (não há
  segredo nele); no Azure, a semente fica no mesmo banco dos dados reais (contas isoladas e removíveis com `--remover`);
  alguém pode cadastrar antes uma conta com um e-mail `@demo.elderweb.test` (o repositório é público e os e-mails são
  previsíveis) e fazer a semente falhar: ela aborta antes de apagar qualquer coisa, com mensagem fixa (ver "Antes de
  apresentar"); no Firebase a semente apaga sozinha a conta intrusa; as rotas de produção não bloqueiam esse cadastro;
  qualquer pessoa pode pedir vínculo à Helena ou ao Antônio pelo e-mail previsível, e o nome dela aparece na lista de
  vínculos (e no telão) até a próxima restauração; um idoso real que convide de propósito um e-mail do elenco pode ter o
  nome visto pelo admin na lista de vínculos, nunca os dados.
- Emergência: idoso do elenco não chama o Firebase nem o provedor de e-mail; a resposta traz `simulado: true`.
